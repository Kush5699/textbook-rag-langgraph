import os
import hashlib
import uuid
import logging
from fastapi import UploadFile, BackgroundTasks
import aiosqlite
from ..database import get_db
from ..config import settings
from .metadata import parse_filename
from .pdf_extractor import extract_text_from_pdf
from .chunker import process_chunks
# We'll import retrieval stores locally to avoid circular dependencies at top level
import asyncio

logger = logging.getLogger(__name__)

async def compute_file_hash(file_path: str):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

async def process_pdf_ingestion(db_path: str, doc_id: str, file_path: str, filename: str):
    logger.info(f"Starting ingestion for {filename}")
    
    # 1. Update status to Processing
    async with aiosqlite.connect(db_path) as db:
        await db.execute("UPDATE documents SET status = 'Processing' WHERE id = ?", (doc_id,))
        await db.commit()

    try:
        # 2. Extract Metadata
        meta = parse_filename(filename)
        
        # 3. Extract Text
        # Blocking call, run in executor
        pages_data = await asyncio.to_thread(extract_text_from_pdf, file_path)
        page_count = len(pages_data)
        
        # 4. Chunking
        chunks = process_chunks(pages_data, meta)
        chunk_count = len(chunks)

        # 5. Embed and Index
        from ..retrieval.vector_store import add_chunks_to_vector_store
        from ..retrieval.bm25_store import bm25_index
        
        # Add to vector store
        await asyncio.to_thread(add_chunks_to_vector_store, chunks)
        # Add to BM25
        await asyncio.to_thread(bm25_index.add_chunks, chunks)

        # 6. Update DB with success
        async with aiosqlite.connect(db_path) as db:
            await db.execute("""
                UPDATE documents 
                SET status = 'Completed', textbook_name = ?, standard = ?, subject = ?, page_count = ?, chunk_count = ?
                WHERE id = ?
            """, (meta["textbook_name"], meta["standard"], meta["subject"], page_count, chunk_count, doc_id))
            await db.commit()
            
        logger.info(f"Successfully ingested {filename}. Chunks: {chunk_count}")

    except Exception as e:
        logger.error(f"Failed to ingest {filename}: {e}")
        async with aiosqlite.connect(db_path) as db:
            await db.execute("UPDATE documents SET status = 'Failed' WHERE id = ?", (doc_id,))
            await db.commit()

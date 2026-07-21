from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Chunk, Document
from app.services.chunking import build_parent_child_chunks, contextualize
from app.services.pdf_processor import extract_pages, needs_ocr, ocr_pages
from app.services.providers import EmbeddingProvider
from app.services.retrieval import index_lexical_chunk
from app.services.vector_store import QdrantVectorStore


class IngestionService:
    def __init__(self, settings: Settings, embedder: EmbeddingProvider, vector_store: QdrantVectorStore) -> None:
        self.settings = settings
        self.embedder = embedder
        self.vector_store = vector_store

    def ingest(self, db: Session, document_id: str) -> None:
        document = db.get(Document, document_id)
        if not document:
            return
        document.status = "processing"
        document.error_message = None
        db.commit()
        try:
            pages = extract_pages(document.stored_path)
            if needs_ocr(pages):
                ocr_language = "guj+eng" if (document.language or "").lower().startswith("guj") else "eng"
                pages = ocr_pages(document.stored_path, ocr_language)
            if not any(page.text.strip() for page in pages):
                raise ValueError("No readable text was found. Upload a higher-quality PDF or enable OCR.")

            parent_drafts, child_drafts = build_parent_child_chunks(pages, self.settings)
            if not child_drafts:
                raise ValueError("No searchable text chunks could be created from this PDF.")

            parents: dict[int, Chunk] = {}
            for draft in parent_drafts:
                parent = Chunk(
                    document_id=document.id,
                    text=draft.text,
                    contextual_text=contextualize(
                        draft.text, source_name=document.original_name, page_start=draft.page_start,
                        page_end=draft.page_end, heading=draft.heading, subject=document.subject, standard=document.standard,
                    ),
                    page_start=draft.page_start, page_end=draft.page_end,
                    ordinal=draft.ordinal, kind="parent", heading=draft.heading,
                )
                db.add(parent)
                parents[draft.ordinal] = parent
            db.flush()

            children: list[Chunk] = []
            for draft in child_drafts:
                child = Chunk(
                    document_id=document.id,
                    parent_id=parents[draft.parent_ordinal].id if draft.parent_ordinal else None,
                    text=draft.text,
                    contextual_text=contextualize(
                        draft.text, source_name=document.original_name, page_start=draft.page_start,
                        page_end=draft.page_end, heading=draft.heading, subject=document.subject, standard=document.standard,
                    ),
                    page_start=draft.page_start, page_end=draft.page_end,
                    ordinal=draft.ordinal, kind="child", heading=draft.heading,
                )
                db.add(child)
                children.append(child)
            db.flush()

            vectors = self.embedder.embed_many([chunk.contextual_text for chunk in children])
            self.vector_store.upsert([
                (
                    child.vector_id,
                    vector,
                    {
                        "owner_id": document.owner_id,
                        "document_id": document.id,
                        "subject": document.subject or "",
                        "standard": document.standard or "",
                        "page_start": child.page_start,
                        "page_end": child.page_end,
                    },
                )
                for child, vector in zip(children, vectors, strict=True)
            ])
            for child in children:
                index_lexical_chunk(db, child, document.owner_id)

            document.page_count = len(pages)
            document.chunk_count = len(children)
            document.status = "ready"
            db.commit()
        except Exception as exc:
            db.rollback()
            failed_document = db.get(Document, document_id)
            if failed_document:
                failed_document.status = "failed"
                failed_document.error_message = str(exc)[:2000]
                db.commit()


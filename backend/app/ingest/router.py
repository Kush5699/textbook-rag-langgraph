from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException, BackgroundTasks
import aiosqlite
import os
import uuid
import aiofiles
import logging
from ..database import get_db
from ..auth.service import require_admin
from ..config import settings
from .service import process_pdf_ingestion, compute_file_hash

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("")
@router.post("/")
async def upload_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_admin(request, db)
    
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    os.makedirs(settings.PDF_STORAGE_DIR, exist_ok=True)
    file_path = os.path.join(settings.PDF_STORAGE_DIR, file.filename)
    
    content = await file.read()
    
    # Save file with fallback if previously locked by a process on Windows
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            await out_file.write(content)
    except PermissionError:
        safe_filename = f"{uuid.uuid4().hex[:6]}_{file.filename}"
        file_path = os.path.join(settings.PDF_STORAGE_DIR, safe_filename)
        async with aiofiles.open(file_path, 'wb') as out_file:
            await out_file.write(content)
        
    file_hash = await compute_file_hash(file_path)
    
    # Check deduplication / retry failed
    async with db.execute("SELECT id, status FROM documents WHERE file_hash = ? OR filename = ?", (file_hash, file.filename)) as cursor:
        existing = await cursor.fetchone()
        if existing:
            doc_id = existing["id"]
            # Reset status and re-trigger background processing
            await db.execute("UPDATE documents SET status = 'Processing' WHERE id = ?", (doc_id,))
            await db.commit()
            background_tasks.add_task(process_pdf_ingestion, settings.SQLITE_DB_PATH, doc_id, file_path, file.filename)
            return {"message": "Re-ingesting document", "doc_id": doc_id}
            
    doc_id = str(uuid.uuid4())
    
    await db.execute(
        "INSERT INTO documents (id, filename, status, file_hash) VALUES (?, ?, 'Uploaded', ?)",
        (doc_id, file.filename, file_hash)
    )
    await db.commit()
    
    background_tasks.add_task(process_pdf_ingestion, settings.SQLITE_DB_PATH, doc_id, file_path, file.filename)
    
    return {"message": "Upload successful, ingestion started", "doc_id": doc_id}

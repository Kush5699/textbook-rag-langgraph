from fastapi import APIRouter, Depends, Request, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional
import aiosqlite
import os
import logging
from ..database import get_db
from ..auth.service import get_current_user, require_admin, verify_firebase_token, sync_user
from ..models import DocumentResponse
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("", response_model=list[DocumentResponse])
@router.get("/", response_model=list[DocumentResponse])
async def list_documents(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    # Any authenticated user can view documents list (metadata only)
    await get_current_user(request, db)
    async with db.execute("SELECT * FROM documents ORDER BY created_at DESC") as cursor:
        rows = await cursor.fetchall()
        return [
            DocumentResponse(
                id=r["id"], filename=r["filename"], textbook_name=r["textbook_name"],
                standard=r["standard"], subject=r["subject"], status=r["status"],
                page_count=r["page_count"], chunk_count=r["chunk_count"], created_at=r["created_at"]
            ) for r in rows
        ]

@router.get("/{doc_id}/pdf")
async def get_pdf(
    doc_id: str,
    request: Request,
    token: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    # Authenticate user from header or query token
    user = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        user = await get_current_user(request, db)
    elif token:
        payload = verify_firebase_token(token)
        user = await sync_user(db, payload["sub"], payload.get("email", ""))
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Restrict raw PDF file viewing to admin accounts only
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="PDF textbook viewing is restricted to admin accounts only")

    async with db.execute(
        "SELECT filename FROM documents WHERE id = ? OR filename = ? OR textbook_name = ?",
        (doc_id, doc_id, doc_id)
    ) as cursor:
        row = await cursor.fetchone()
        filename = row["filename"] if row else doc_id
        
        file_path = os.path.join(settings.PDF_STORAGE_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="PDF file not found on disk")
        
        return FileResponse(file_path, media_type="application/pdf")

@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    request: Request,
    db: aiosqlite.Connection = Depends(get_db)
):
    # Only admin can delete textbooks from the library
    await require_admin(request, db)

    async with db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)) as cursor:
        doc = await cursor.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

    textbook_name = doc["textbook_name"] or doc["filename"]
    filename = doc["filename"]

    # 1. Delete from ChromaDB
    from ..retrieval.vector_store import delete_by_document
    try:
        delete_by_document(textbook_name)
    except Exception as e:
        logger.warning(f"Error removing vectors for {textbook_name}: {e}")

    # 2. Delete from BM25 Store
    from ..retrieval.bm25_store import bm25_index
    try:
        bm25_index.remove_by_document(textbook_name)
    except Exception as e:
        logger.warning(f"Error removing BM25 chunks for {textbook_name}: {e}")

    # 3. Delete physical PDF file from disk
    file_path = os.path.join(settings.PDF_STORAGE_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Error deleting file {file_path}: {e}")

    # 4. Delete document record from SQLite
    await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    await db.commit()

    logger.info(f"Successfully deleted document {filename} (id={doc_id}) from library.")
    return {"message": "Document deleted successfully", "id": doc_id, "filename": filename}

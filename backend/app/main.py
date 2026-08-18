from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging
import os
import shutil
import uuid
import asyncio
import gc
from .database import init_db
from .config import settings

# Import routers
from .auth.router import router as auth_router
from .ingest.router import router as ingest_router
from .sessions.router import router as sessions_router
from .documents.router import router as documents_router
from .chat.router import router as chat_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def auto_seed_sample_textbooks():
    """Auto-seed sample textbooks sequentially with low-memory batching."""
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_pdfs")
    if not os.path.exists(sample_dir):
        return

    import aiosqlite
    from .ingest.service import process_pdf_ingestion, compute_file_hash

    try:
        # Wait 3 seconds for server boot and port binding to complete
        await asyncio.sleep(3)
        
        async with aiosqlite.connect(settings.SQLITE_DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) as count FROM documents") as cursor:
                row = await cursor.fetchone()
                if row and row[0] > 0:
                    return

            files = [f for f in sorted(os.listdir(sample_dir)) if f.lower().endswith(".pdf")]
            for filename in files:
                src = os.path.join(sample_dir, filename)
                dest = os.path.join(settings.PDF_STORAGE_DIR, filename)
                if not os.path.exists(dest):
                    shutil.copyfile(src, dest)
                
                file_hash = await compute_file_hash(dest)
                doc_id = str(uuid.uuid4())
                await db.execute(
                    "INSERT INTO documents (id, filename, status, file_hash) VALUES (?, ?, 'Uploaded', ?)",
                    (doc_id, filename, file_hash)
                )
                await db.commit()
                
                # Ingest SEQUENTIALLY to stay strictly under 512MB RAM
                logger.info(f"Auto-seeding startup textbook (sequential): {filename}")
                await process_pdf_ingestion(settings.SQLITE_DB_PATH, doc_id, dest, filename)
                gc.collect()
                await asyncio.sleep(2)
                
    except Exception as e:
        logger.warning(f"Auto-seeding skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting up GSSTB Scholar Backend")

    # Ensure data directories exist
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    os.makedirs(settings.PDF_STORAGE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(settings.BM25_PERSIST_PATH), exist_ok=True)

    init_db()
    logger.info("Database initialized")

    # Auto-seed sample books sequentially in the background
    asyncio.create_task(auto_seed_sample_textbooks())

    yield
    logger.info("Shutting down GSSTB Scholar Backend")


app = FastAPI(
    title="GSSTB Scholar API",
    description="Conversational RAG for Gujarat State Board Textbooks",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(ingest_router, prefix="/api/ingest", tags=["Ingest"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok", "service": "gsstb-scholar-backend"}


# Serve frontend SPA static files if dist directory exists (e.g. in Docker / production)
frontend_dist_dirs = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist"),
]

dist_path = next((d for d in frontend_dist_dirs if os.path.exists(d)), None)

if dist_path:
    assets_path = os.path.join(dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))

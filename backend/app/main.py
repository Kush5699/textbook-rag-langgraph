from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging
import os
import shutil
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting up GSSTB Scholar Backend")

    # Ensure base data directory exists
    data_dir = os.path.dirname(settings.SQLITE_DB_PATH)
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    os.makedirs(settings.PDF_STORAGE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.BM25_PERSIST_PATH), exist_ok=True)

    # Instant zero-RAM startup seeder: Copy pre-indexed ChromaDB, BM25 & SQLite if fresh
    seed_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed_data")
    if os.path.exists(seed_dir):
        db_needs_seed = not os.path.exists(settings.SQLITE_DB_PATH) or os.path.getsize(settings.SQLITE_DB_PATH) == 0
        if db_needs_seed:
            logger.info("Restoring pre-indexed vector stores and textbooks from seed_data...")
            for item in os.listdir(seed_dir):
                s = os.path.join(seed_dir, item)
                d = os.path.join(data_dir, item)
                if os.path.isdir(s):
                    if os.path.exists(d):
                        shutil.rmtree(d)
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
            logger.info("Pre-indexed textbooks, vector embeddings, and BM25 index restored instantly (< 0.1s).")

    init_db()
    logger.info("Database initialized successfully.")

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

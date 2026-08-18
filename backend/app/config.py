from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # Firebase
    FIREBASE_PROJECT_ID: str = "gsstb-scholar-f670e"

    # Retrieval tuning
    DISTANCE_THRESHOLD: float = 1.30
    ENABLE_RERANKER: bool = False
    TOP_K_VECTOR: int = 10
    TOP_K_BM25: int = 10

    # Chunking
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # Storage paths
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    SQLITE_DB_PATH: str = "./data/scholar.db"
    BM25_PERSIST_PATH: str = "./data/bm25_index.pkl"
    PDF_STORAGE_DIR: str = "./data/pdfs"

    # Server
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()

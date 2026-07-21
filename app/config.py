from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Textbook RAG"
    environment: str = "development"
    database_url: str = "sqlite:///./data/app.db"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "textbook_chunks"
    upload_dir: Path = Path("./uploads")
    max_upload_mb: int = Field(default=75, ge=1, le=250)

    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=480, ge=15)
    cookie_secure: bool = False
    allowed_origins: str = "http://localhost:8000"

    openai_api_key: str | None = None
    embedding_provider: str = "openai"
    chat_provider: str = "openai"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4.1-mini"
    embedding_dimensions: int = Field(default=1536, ge=32)

    child_chunk_tokens: int = Field(default=260, ge=80, le=800)
    parent_chunk_tokens: int = Field(default=900, ge=250, le=2000)
    chunk_overlap_tokens: int = Field(default=45, ge=0, le=250)
    retrieval_candidates: int = Field(default=20, ge=5, le=100)
    final_context_chunks: int = Field(default=4, ge=1, le=12)
    min_evidence_score: float = Field(default=0.015, ge=0.0, le=1.0)
    enable_reranking: bool = True
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Chunk, Document
from app.services.providers import EmbeddingProvider
from app.services.vector_store import QdrantVectorStore


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: Chunk
    document: Document
    score: float


def initialise_lexical_index(db: Session) -> None:
    if db.bind and db.bind.dialect.name == "sqlite":
        db.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(chunk_id UNINDEXED, owner_id UNINDEXED, document_id UNINDEXED, text)"))
        db.commit()
    elif db.bind and db.bind.dialect.name == "postgresql":
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_chunks_contextual_text_fts ON chunks USING gin (to_tsvector('simple', contextual_text))"))
        db.commit()


def index_lexical_chunk(db: Session, chunk: Chunk, owner_id: str) -> None:
    if db.bind and db.bind.dialect.name == "sqlite":
        db.execute(
            text("INSERT INTO chunks_fts(chunk_id, owner_id, document_id, text) VALUES (:chunk_id, :owner_id, :document_id, :text)"),
            {"chunk_id": chunk.id, "owner_id": owner_id, "document_id": chunk.document_id, "text": chunk.contextual_text},
        )


def delete_lexical_document(db: Session, document_id: str) -> None:
    if db.bind and db.bind.dialect.name == "sqlite":
        db.execute(text("DELETE FROM chunks_fts WHERE document_id = :document_id"), {"document_id": document_id})


def _fts_query(question: str) -> str:
    terms = re.findall(r"[\w]+", question, flags=re.UNICODE)
    return " OR ".join(f'"{term}"' for term in terms[:20])


def lexical_search(db: Session, *, owner_id: str, question: str, document_ids: list[str] | None, limit: int) -> list[tuple[str, float]]:
    if not db.bind:
        return []
    if db.bind.dialect.name == "postgresql":
        document_clause = ""
        params: dict[str, object] = {"query": question, "owner_id": owner_id, "limit": limit}
        if document_ids:
            placeholders = ", ".join(f":document_{index}" for index in range(len(document_ids)))
            document_clause = f" AND c.document_id IN ({placeholders})"
            params.update({f"document_{index}": value for index, value in enumerate(document_ids)})
        rows = db.execute(text(f"""
            SELECT c.id, ts_rank(to_tsvector('simple', c.contextual_text), websearch_to_tsquery('simple', :query)) AS score
            FROM chunks c JOIN documents d ON c.document_id = d.id
            WHERE c.kind = 'child' AND d.owner_id = :owner_id
              AND to_tsvector('simple', c.contextual_text) @@ websearch_to_tsquery('simple', :query){document_clause}
            ORDER BY score DESC LIMIT :limit
        """), params).all()
        return [(str(row[0]), float(row[1])) for row in rows]
    if db.bind.dialect.name != "sqlite":
        return []
    query = _fts_query(question)
    if not query:
        return []
    document_clause = ""
    params: dict[str, object] = {"query": query, "owner_id": owner_id, "limit": limit}
    if document_ids:
        placeholders = ", ".join(f":document_{index}" for index in range(len(document_ids)))
        document_clause = f" AND document_id IN ({placeholders})"
        params.update({f"document_{index}": value for index, value in enumerate(document_ids)})
    rows = db.execute(
        text(f"SELECT chunk_id, -bm25(chunks_fts) AS score FROM chunks_fts WHERE chunks_fts MATCH :query AND owner_id = :owner_id{document_clause} ORDER BY bm25(chunks_fts) LIMIT :limit"),
        params,
    ).all()
    return [(str(row[0]), float(row[1])) for row in rows]


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for position, identifier in enumerate(ranking, start=1):
            scores[identifier] = scores.get(identifier, 0.0) + 1.0 / (k + position)
    return scores


class RetrievalService:
    def __init__(self, settings: Settings, embedder: EmbeddingProvider, vector_store: QdrantVectorStore) -> None:
        self.settings = settings
        self.embedder = embedder
        self.vector_store = vector_store

    def retrieve(self, db: Session, *, owner_id: str, question: str, subject: str | None, standard: str | None, document_ids: list[str] | None) -> list[RetrievedChunk]:
        query_vector = self.embedder.embed_many([question])[0]
        semantic_hits = self.vector_store.search(
            query_vector,
            owner_id=owner_id,
            subject=subject,
            standard=standard,
            document_ids=document_ids,
            limit=self.settings.retrieval_candidates,
        )
        semantic_ids = [hit.vector_id for hit in semantic_hits]
        lexical_hits = lexical_search(db, owner_id=owner_id, question=question, document_ids=document_ids, limit=self.settings.retrieval_candidates)
        lexical_chunk_ids = [identifier for identifier, _ in lexical_hits]
        lexical_vector_ids = {
            chunk.id: chunk.vector_id
            for chunk in db.query(Chunk).filter(Chunk.id.in_(lexical_chunk_ids)).all()
        }
        lexical_ids = [lexical_vector_ids[identifier] for identifier in lexical_chunk_ids if identifier in lexical_vector_ids]
        fused = reciprocal_rank_fusion([semantic_ids, lexical_ids])
        if not fused:
            return []
        chunks = db.query(Chunk).join(Document).filter(Chunk.vector_id.in_(fused), Document.owner_id == owner_id).all()
        by_vector_id = {chunk.vector_id: chunk for chunk in chunks}
        results = [RetrievedChunk(chunk=by_vector_id[identifier], document=by_vector_id[identifier].document, score=score) for identifier, score in fused.items() if identifier in by_vector_id]
        if subject:
            results = [result for result in results if result.document.subject == subject]
        if standard:
            results = [result for result in results if result.document.standard == standard]
        return sorted(results, key=lambda result: result.score, reverse=True)[: self.settings.retrieval_candidates]

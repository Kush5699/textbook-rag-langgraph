from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, models

from app.config import Settings


@dataclass(frozen=True)
class VectorHit:
    vector_id: str
    score: float


class QdrantVectorStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)

    def ensure_collection(self) -> None:
        if not self.client.collection_exists(self.settings.qdrant_collection):
            self.client.create_collection(
                collection_name=self.settings.qdrant_collection,
                vectors_config=models.VectorParams(
                    size=self.settings.embedding_dimensions,
                    distance=models.Distance.COSINE,
                ),
            )
            for field_name in ("owner_id", "document_id", "subject", "standard"):
                self.client.create_payload_index(
                    self.settings.qdrant_collection,
                    field_name=field_name,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )

    def upsert(self, points: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        if not points:
            return
        self.ensure_collection()
        self.client.upsert(
            collection_name=self.settings.qdrant_collection,
            points=[models.PointStruct(id=point_id, vector=vector, payload=payload) for point_id, vector, payload in points],
            wait=True,
        )

    def search(self, vector: list[float], *, owner_id: str, subject: str | None, standard: str | None, document_ids: list[str] | None, limit: int) -> list[VectorHit]:
        self.ensure_collection()
        conditions: list[models.FieldCondition] = [
            models.FieldCondition(key="owner_id", match=models.MatchValue(value=owner_id))
        ]
        if subject:
            conditions.append(models.FieldCondition(key="subject", match=models.MatchValue(value=subject)))
        if standard:
            conditions.append(models.FieldCondition(key="standard", match=models.MatchValue(value=standard)))
        if document_ids:
            conditions.append(models.FieldCondition(key="document_id", match=models.MatchAny(any=document_ids)))
        response = self.client.query_points(
            collection_name=self.settings.qdrant_collection,
            query=vector,
            query_filter=models.Filter(must=conditions),
            limit=limit,
            with_payload=False,
        )
        return [VectorHit(vector_id=str(point.id), score=float(point.score)) for point in response.points]

    def delete(self, vector_ids: list[str]) -> None:
        if vector_ids and self.client.collection_exists(self.settings.qdrant_collection):
            self.client.delete(
                collection_name=self.settings.qdrant_collection,
                points_selector=models.PointIdsList(points=vector_ids),
                wait=True,
            )

from __future__ import annotations

import re

from app.config import Settings
from app.services.retrieval import RetrievedChunk


class Reranker:
    """Cross-encoder reranking with a deterministic lexical fallback.

    The optional CrossEncoder is loaded lazily so a first deployment can start
    quickly and a missing model never prevents textbook-only refusal behaviour.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model = None
        self._load_attempted = False

    def _cross_encoder(self):
        if not self.settings.enable_reranking:
            return None
        if self._load_attempted:
            return self._model
        self._load_attempted = True
        try:
            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(self.settings.reranker_model)
        except Exception:
            self._model = None
        return self._model

    @staticmethod
    def _lexical_score(question: str, text: str) -> float:
        query_terms = set(re.findall(r"\w+", question.lower(), flags=re.UNICODE))
        document_terms = set(re.findall(r"\w+", text.lower(), flags=re.UNICODE))
        return len(query_terms & document_terms) / max(len(query_terms), 1)

    def rerank(self, question: str, results: list[RetrievedChunk]) -> list[RetrievedChunk]:
        if not results:
            return []
        model = self._cross_encoder()
        if model is not None:
            scores = model.predict([(question, result.chunk.contextual_text) for result in results])
            adjusted = [
                RetrievedChunk(chunk=result.chunk, document=result.document, score=float(score))
                for result, score in zip(results, scores, strict=True)
            ]
        else:
            adjusted = [
                RetrievedChunk(
                    chunk=result.chunk,
                    document=result.document,
                    score=(0.7 * result.score) + (0.3 * self._lexical_score(question, result.chunk.contextual_text)),
                )
                for result in results
            ]
        return sorted(adjusted, key=lambda result: result.score, reverse=True)


"""Custom LangChain retriever wrapping the hybrid (vector + BM25 + RRF) search pipeline."""

from typing import List
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from ..retrieval.hybrid import hybrid_search
from ..retrieval.reranker import rerank_results
import logging

logger = logging.getLogger(__name__)


class HybridRetriever(BaseRetriever):
    """LangChain-compatible retriever that uses hybrid vector + BM25 search with RRF fusion."""

    filters: dict = {}
    top_k: int = 5
    enable_rerank: bool = True

    class Config:
        arbitrary_types_allowed = True

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        """Retrieve documents using hybrid search (vector + BM25 + RRF) with optional reranking."""
        # Run hybrid search
        candidates = hybrid_search(query, self.filters)
        logger.info(f"Hybrid search returned {len(candidates)} candidates for query: '{query[:80]}...'")

        if not candidates:
            return []

        # Optional cross-encoder reranking
        if self.enable_rerank:
            candidates = rerank_results(query, candidates)

        # Convert to LangChain Document objects (take top_k)
        documents = []
        for chunk in candidates[:self.top_k]:
            doc = Document(
                page_content=chunk["text"],
                metadata={
                    "chunk_id": chunk["chunk_id"],
                    "textbook_name": chunk["metadata"].get("textbook_name", ""),
                    "page_number": chunk["metadata"].get("page_number", 0),
                    "standard": chunk["metadata"].get("standard", ""),
                    "subject": chunk["metadata"].get("subject", ""),
                    "rrf_score": chunk.get("rrf_score", 0.0),
                },
            )
            documents.append(doc)

        return documents

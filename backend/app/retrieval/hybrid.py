from .vector_store import query_vector_store
from .bm25_store import bm25_index
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def _perform_search(query: str, filters: dict, top_k_vector: int, top_k_bm25: int):
    # 1. Vector Search
    vector_results = query_vector_store(query, filters, top_k_vector)
    vector_filtered = [r for r in vector_results if r["distance"] < settings.DISTANCE_THRESHOLD]

    # 2. BM25 Search
    bm25_results = bm25_index.query(query, filters, top_k_bm25)

    # 3. Reciprocal Rank Fusion (RRF)
    k = 60
    rrf_scores = {}
    chunk_map = {}

    for rank, doc in enumerate(vector_filtered):
        cid = doc["chunk_id"]
        rrf_scores[cid] = rrf_scores.get(cid, 0) + 1.0 / (k + rank + 1)
        chunk_map[cid] = doc

    for rank, doc in enumerate(bm25_results):
        cid = doc["chunk_id"]
        rrf_scores[cid] = rrf_scores.get(cid, 0) + 1.0 / (k + rank + 1)
        if cid not in chunk_map:
            chunk_map[cid] = doc

    sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    final_results = []
    for cid, score in sorted_chunks:
        doc = chunk_map[cid]
        doc["rrf_score"] = score
        final_results.append(doc)

    return final_results

def hybrid_search(query: str, filters: dict, top_k_vector: int = settings.TOP_K_VECTOR, top_k_bm25: int = settings.TOP_K_BM25):
    results = []
    if filters:
        results = _perform_search(query, filters, top_k_vector, top_k_bm25)
        if not results:
            logger.info("Filtered search returned no results, falling back to global textbook search.")
            results = _perform_search(query, {}, top_k_vector, top_k_bm25)
    else:
        results = _perform_search(query, {}, top_k_vector, top_k_bm25)

    return results

from ..config import settings

def rerank_results(query: str, candidates: list):
    """
    Optional reranker. Toggled by ENABLE_RERANKER.
    """
    if not settings.ENABLE_RERANKER or not candidates:
        return candidates

    try:
        from sentence_transformers import CrossEncoder
        model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
        
        pairs = [[query, doc["text"]] for doc in candidates]
        scores = model.predict(pairs)
        
        for doc, score in zip(candidates, scores):
            doc["rerank_score"] = float(score)
            
        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Reranking failed: {e}")

    return candidates

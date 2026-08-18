from app.retrieval.hybrid import hybrid_search

# Mocking the dependencies to test threshold filtering and hybrid logic
def test_hybrid_search_distance_threshold(monkeypatch):
    def mock_query_vector(query, filters, top_k):
        return [
            {"chunk_id": "1", "text": "Good match", "metadata": {}, "distance": 1.0},
            {"chunk_id": "2", "text": "Bad match", "metadata": {}, "distance": 1.5}
        ]
        
    def mock_bm25_query(query, filters, top_k):
        return []
        
    monkeypatch.setattr("app.retrieval.hybrid.query_vector_store", mock_query_vector)
    # Use an object with a query method instead of just a function
    class MockBM25:
        def query(self, query, filters, top_k):
            return mock_bm25_query(query, filters, top_k)
            
    monkeypatch.setattr("app.retrieval.hybrid.bm25_index", MockBM25())
    monkeypatch.setenv("DISTANCE_THRESHOLD", "1.30")
    
    # Reload settings if needed, or directly mock it
    import app.config
    monkeypatch.setattr(app.config.settings, "DISTANCE_THRESHOLD", 1.30)
    
    results = hybrid_search("test query", {})
    assert len(results) == 1
    assert results[0]["chunk_id"] == "1"

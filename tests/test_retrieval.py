from app.services.retrieval import reciprocal_rank_fusion


def test_rrf_rewards_results_supported_by_both_retrievers():
    scores = reciprocal_rank_fusion([["semantic-only", "shared"], ["shared", "keyword-only"]])
    assert scores["shared"] > scores["semantic-only"]
    assert scores["shared"] > scores["keyword-only"]


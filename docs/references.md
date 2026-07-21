# Technical references

These sources informed the implementation choices. They are included to make the architecture and deployment assumptions easy to review.

- [FastAPI: container deployment](https://fastapi.tiangolo.com/deployment/docker/) - use a standard Python base image and run the application process directly in the container.
- [Qdrant: hybrid search](https://qdrant.tech/documentation/search/text-search/hybrid-search/) - combines semantic and lexical retrieval to cover meaning-based and exact-term questions.
- [Qdrant: hybrid reranking](https://qdrant.tech/documentation/advanced-tutorials/reranking-hybrid-search/) - retrieve a broad candidate set, then apply a deeper reranker to improve precision.
- [Qdrant: production checklist](https://qdrant.tech/documentation/production-checklist/) - payload indexing, filtering, batching, and capacity considerations.
- [RAPTOR paper](https://arxiv.org/abs/2401.18059) - hierarchical retrieval background for long-document RAG.
- [Late Chunking paper](https://arxiv.org/abs/2409.04701) - contextual chunk representation research.
- [Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) - context prefixes for improving isolated-chunk retrieval.


import chromadb
from chromadb.utils import embedding_functions
from ..config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

collection = chroma_client.get_or_create_collection(
    name="gsstb_chunks",
    embedding_function=emb_fn,
    metadata={"hnsw:space": "cosine"}
)

def add_chunks_to_vector_store(chunks: list, batch_size: int = 150):
    if not chunks:
        return
    
    # Process in batches to maintain high throughput and prevent memory spikes
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        ids = [c["chunk_id"] for c in batch]
        texts = [c["text"] for c in batch]
        metadatas = [c["metadata"] for c in batch]
        
        collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )
    logger.info(f"Added {len(chunks)} chunks to Vector Store in batches of {batch_size}.")

def query_vector_store(query: str, filters: dict, top_k: int = settings.TOP_K_VECTOR):
    where = {}
    if filters:
        if len(filters) == 1:
            key, val = list(filters.items())[0]
            if isinstance(val, list):
                if len(val) == 1:
                    where[key] = val[0]
                elif len(val) > 1:
                    where[key] = {"$in": val}
            else:
                where[key] = val
        else:
            and_filters = []
            for k, v in filters.items():
                if isinstance(v, list):
                    if len(v) == 1:
                        and_filters.append({k: v[0]})
                    elif len(v) > 1:
                        and_filters.append({k: {"$in": v}})
                else:
                    and_filters.append({k: v})
            where = {"$and": and_filters} if and_filters else {}

    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        where=where if where else None,
        include=["documents", "metadatas", "distances"]
    )
    
    docs = []
    if results["ids"] and len(results["ids"]) > 0:
        for i in range(len(results["ids"][0])):
            docs.append({
                "chunk_id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i] if results["distances"] else 0.0
            })
    return docs

def delete_by_document(textbook_name: str):
    collection.delete(where={"textbook_name": textbook_name})

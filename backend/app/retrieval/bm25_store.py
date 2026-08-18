import pickle
import os
import re
from rank_bm25 import BM25Okapi
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def tokenize(text: str):
    # Regex split on non-alphanumeric, lowercase
    text = text.lower()
    tokens = re.split(r'\W+', text)
    stop_words = {"the", "is", "in", "and", "to", "of", "a", "it", "for", "on", "with"}
    return [t for t in tokens if t and t not in stop_words]

class BM25Store:
    def __init__(self, persist_path: str):
        self.persist_path = persist_path
        self.chunks = []
        self.bm25 = None
        self._load()

    def _load(self):
        if os.path.exists(self.persist_path):
            try:
                with open(self.persist_path, "rb") as f:
                    data = pickle.load(f)
                    self.chunks = data.get("chunks", [])
                self.rebuild()
                logger.info(f"Loaded BM25 store with {len(self.chunks)} chunks.")
            except Exception as e:
                logger.warning(f"Failed to load BM25 store from {self.persist_path}: {e}")
                self.chunks = []
                self.bm25 = None
        else:
            logger.info("BM25 store not found, creating new.")

    def save(self):
        os.makedirs(os.path.dirname(self.persist_path), exist_ok=True)
        with open(self.persist_path, "wb") as f:
            pickle.dump({"chunks": self.chunks}, f)

    def rebuild(self):
        if self.chunks:
            tokenized_corpus = [tokenize(c["text"]) for c in self.chunks]
            self.bm25 = BM25Okapi(tokenized_corpus)
        else:
            self.bm25 = None

    def add_chunks(self, chunks: list):
        existing_ids = {c["chunk_id"] for c in self.chunks}
        new_chunks = [c for c in chunks if c["chunk_id"] not in existing_ids]
        if new_chunks:
            self.chunks.extend(new_chunks)
            self.rebuild()
            self.save()
            logger.info(f"Added {len(new_chunks)} new chunks to BM25 store.")

    def remove_by_document(self, textbook_name: str):
        original_count = len(self.chunks)
        self.chunks = [
            c for c in self.chunks 
            if c.get("metadata", {}).get("textbook_name") != textbook_name and
               c.get("metadata", {}).get("filename") != textbook_name
        ]
        if len(self.chunks) != original_count:
            self.rebuild()
            self.save()
            logger.info(f"Removed chunks for {textbook_name} from BM25 store ({original_count} -> {len(self.chunks)}).")

    def query(self, query: str, filters: dict, top_k: int = settings.TOP_K_BM25):
        if not self.bm25:
            return []
            
        tokenized_query = tokenize(query)
        scores = self.bm25.get_scores(tokenized_query)
        
        # Filter and rank
        scored_chunks = []
        for idx, score in enumerate(scores):
            if score > 0:
                c = self.chunks[idx]
                # Apply filters manually
                match = True
                if filters:
                    for k, v in filters.items():
                        c_val = c["metadata"].get(k)
                        if isinstance(v, list):
                            if c_val not in v:
                                match = False
                                break
                        else:
                            if c_val != v:
                                match = False
                                break
                if match:
                    scored_chunks.append({
                        "chunk_id": c["chunk_id"],
                        "text": c["text"],
                        "metadata": c["metadata"],
                        "score": score
                    })
                    
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

bm25_index = BM25Store(settings.BM25_PERSIST_PATH)

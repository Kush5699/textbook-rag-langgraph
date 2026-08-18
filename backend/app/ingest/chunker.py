import hashlib
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ..config import settings


# LangChain text splitter with sentence-aware recursive splitting
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.CHUNK_SIZE * 5,  # char-based (approx 5 chars per token)
    chunk_overlap=settings.CHUNK_OVERLAP * 5,
    separators=["\n\n", "\n", ". ", "; ", ", ", " ", ""],
    length_function=len,
)


def process_chunks(pages_data, metadata):
    """Process extracted PDF pages into chunks using LangChain's RecursiveCharacterTextSplitter."""
    all_chunks = []

    for page in pages_data:
        text = page["text"]
        if not text:
            continue

        # Use LangChain splitter for sentence-aware chunking
        page_chunks = text_splitter.split_text(text)

        for idx, chunk in enumerate(page_chunks):
            # Deterministic hash for deduplication
            chunk_hash_input = f"{metadata['textbook_name']}_{page['page_number']}_{idx}_{chunk}"
            chunk_id = hashlib.sha256(chunk_hash_input.encode("utf-8")).hexdigest()

            all_chunks.append({
                "chunk_id": chunk_id,
                "text": chunk,
                "metadata": {
                    "textbook_name": metadata["textbook_name"],
                    "page_number": page["page_number"],
                    "standard": metadata.get("standard") or "",
                    "subject": metadata.get("subject") or "",
                },
            })

    return all_chunks

# GSSTB Scholar - Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Ingestion Pipeline](#ingestion-pipeline)
3. [Retrieval Pipeline](#retrieval-pipeline)
4. [Generation Pipeline](#generation-pipeline)
5. [Conversational Context Resolution](#conversational-context-resolution)
6. [Distance-Threshold Refusal Mechanism](#distance-threshold-refusal-mechanism)
7. [Authentication and Session Management](#authentication-and-session-management)
8. [Data Storage](#data-storage)
9. [Frontend Architecture](#frontend-architecture)
10. [Deployment Architecture](#deployment-architecture)

---

## System Overview

GSSTB Scholar is a conversational RAG (Retrieval-Augmented Generation) system designed to answer student questions exclusively from official Gujarat State Board textbook PDFs. The system enforces strict grounding: every answer must be traceable to specific textbook pages, and questions outside the corpus are refused deterministically.

The architecture follows a layered pipeline design:

```
User Question
    |
    v
[Conversation Context Manager] -- pulls last 10 turns
    |
    v
[Standalone Query Rewriter] -- rewrites follow-ups into self-contained queries
    |
    v
[Query Router] -- extracts standard(s) and subject(s) via LLM function-calling
    |
    v
[Hybrid Retriever] -- parallel vector + BM25 search with metadata filters
    |
    v
[Reciprocal Rank Fusion] -- merges and deduplicates results
    |
    v
[Distance Threshold Gate] -- cosine distance >= 1.30 triggers refusal
    |
    v
[Optional Cross-Encoder Reranker] -- reranks fused candidates
    |
    v
[Context Constructor] -- builds grounded prompt with chunk text + metadata
    |
    v
[LLM Generator] -- Groq llama-3.3-70b-versatile, streaming via SSE
    |
    v
[Citation Extractor] -- maps used chunks to {textbook, page, snippet}
    |
    v
[SSE Response Stream] -- tokens + final citation payload
```

---

## Ingestion Pipeline

### PDF Text Extraction

The ingestion pipeline uses a two-tier extraction strategy:

1. **Primary: PyMuPDF (fitz)**
   - Handles most GSSTB textbooks which use standard embedded fonts
   - Preserves Unicode text including Identity-H encoded fonts
   - Extracts text page-by-page with page number tracking

2. **Fallback: pytesseract OCR**
   - Activated per-page when PyMuPDF extracts fewer than 50 characters
   - Handles scanned pages (common in older editions and supplementary readers)
   - Logs which pages required OCR for debugging

### Metadata Extraction

Each PDF's filename is parsed to extract structured metadata:

```
"Std-9_Science_English Medium.pdf"
  -> standard: "Std_09"
  -> subject: "Science"
  -> medium: "English"
```

**Standard Normalization**: All variant forms ("Std 9", "STD-11", "Std-09") are normalized to zero-padded canonical form: `Std_09`, `Std_10`, `Std_11`, `Std_12`.

**Subject Extraction**: Includes a typo correction map for known filename errors in the GSSTB corpus:
- `Psaychology` / `psaychology` -> `Psychology`
- `Bilology` -> `Biology`
- `Sanskrut` -> `Sanskrit`
- `Lapwimg` -> `Lapwing`

**English Literature Mapping**: Prescribed textbook titles (`Beehive`, `Hornbill`, `First Flight`, `Kaleidoscope`, etc.) are mapped to subject `English`.

### Chunking Strategy

Text is chunked at **500 tokens** with **50-token overlap** using a whitespace-based tokenizer:

1. Split page text into sentences using period/newline boundaries
2. Accumulate sentences until the token count reaches 500
3. When a chunk boundary is reached, include the last 50 tokens as overlap with the next chunk
4. Each chunk receives a deterministic `chunk_id` computed as `SHA256(textbook_name + page_number + chunk_position)`

Metadata attached to every chunk:
- `chunk_id` (for idempotency)
- `textbook_name`
- `page_number`
- `standard` (normalized)
- `subject`
- `text` (the chunk content)

### Idempotency

Before inserting chunks into ChromaDB:
1. Check if `chunk_id` already exists in the collection
2. Skip existing chunks to prevent duplication
3. Track file content hashes to detect duplicate PDFs stored in different directories

---

## Retrieval Pipeline

### Vector Search (ChromaDB)

- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors)
- **Collection**: Single persistent ChromaDB collection with metadata filtering
- **Query**: Embed the rewritten query, search top-K (default 10) results
- **Metadata Filters**: When the query router confidently detects a standard/subject, these are applied as `where` filters to narrow the search space

### Keyword Search (BM25)

- **Algorithm**: BM25Okapi from the `rank_bm25` library
- **Tokenizer**: Custom regex tokenizer that:
  - Lowercases all text
  - Splits on non-alphanumeric characters
  - Removes English stop words (`the`, `is`, `a`, `an`, `who`, `what`, `where`, `when`, `how`, `are`, `was`, `were`, etc.)
- **Persistence**: The BM25 index is serialized to disk via pickle after build
- **Post-filtering**: Metadata filters (standard/subject) are applied after BM25 scoring since BM25 does not natively support metadata

### Reciprocal Rank Fusion (RRF)

Vector and BM25 results are merged using RRF with constant k=60:

```
RRF_score(d) = sum over all rankers R of: 1 / (k + rank_R(d))
```

This produces a single ranked list that balances semantic similarity (vectors) with exact term matching (BM25).

### Distance Threshold Filtering

After fusion, chunks are filtered by their original cosine distance from the vector search:

- Chunks with cosine distance >= `DISTANCE_THRESHOLD` (default 1.30, configurable via env) are discarded
- If zero chunks survive this filter, the system short-circuits to the refusal response without making any LLM call
- This is the primary mechanism for out-of-domain detection

### Optional Cross-Encoder Reranking

When `ENABLE_RERANKER=true`:
- Fused candidates are re-scored using `cross-encoder/ms-marco-MiniLM-L-6-v2`
- The cross-encoder takes (query, chunk_text) pairs and produces relevance scores
- Results are re-sorted by cross-encoder score
- This typically improves precision by 5-15% at the cost of ~200ms latency

---

## Generation Pipeline

### LLM Provider Interface

The generation layer uses a provider-agnostic interface:

```python
class LLMProvider(ABC):
    @abstractmethod
    async def generate_stream(
        self, messages: list[dict], temperature: float
    ) -> AsyncIterator[str]:
        ...
```

Swapping from Groq to OpenAI requires only changing the provider implementation, not the pipeline code.

### System Prompt Design

The system prompt enforces strict grounding:

1. **No hallucination**: "Answer ONLY using the provided context. If the context does not contain the answer, say so."
2. **No meta-phrases**: "Do NOT use phrases like 'according to the textbook' or 'based on the provided context'."
3. **Math formatting**: "Use $ ... $ for inline math and $$ ... $$ for display math."
4. **Direct answers**: "Provide direct, educational answers as if you are explaining to a student."

### SSE Streaming

Responses are streamed via Server-Sent Events using `sse-starlette`:

```
event: token
data: {"text": "The "}

event: token
data: {"text": "volume "}

event: token
data: {"text": "of a cylinder..."}

event: done
data: {
  "citations": [
    {
      "textbook": "Std-10_Maths_EnglishMedium.pdf",
      "standard": "Std_10",
      "subject": "Mathematics",
      "page": 142,
      "snippet": "The volume of a cylinder is calculated by..."
    }
  ],
  "refused": false
}
```

---

## Conversational Context Resolution

### The Problem

Follow-up questions like "what about std 11?" or "explain in more detail" are meaningless without the context of prior turns. A bare vector search on "what about std 11?" will return irrelevant results.

### The Solution: Query Rewriting

Before retrieval, the system rewrites follow-up questions into standalone queries:

1. Retrieve the last 10 turns from the session's message history
2. Send the conversation context + current question to the LLM with a rewriting prompt
3. The LLM produces a standalone query that incorporates context

**Example:**
```
Turn 1: "What is the formula for area of a circle?"
Turn 2: "What about the volume of a sphere?"
Turn 3: "Explain for std 11"

Rewritten query for Turn 3:
"Explain the formula for the volume of a sphere as covered in Standard 11 Mathematics textbook"
```

### Query Routing

After rewriting, the query router uses LLM function-calling to extract structured metadata:

```json
{
  "standards": ["Std_11"],
  "subjects": ["Mathematics"]
}
```

These are applied as hard metadata filters during retrieval, dramatically improving precision.

---

## Distance-Threshold Refusal Mechanism

### How It Works

1. After hybrid retrieval, examine the cosine distances from the vector search
2. Discard any chunk with cosine distance >= `DISTANCE_THRESHOLD` (default: 1.30)
3. If zero chunks remain after filtering:
   - Return the exact string: "The requested information is unavailable in the provided Gujarat State Board textbooks."
   - Attach zero citations
   - Set `refused: true` in the response payload
   - Do NOT call the LLM at all (saves API cost and latency)

### Why 1.30?

ChromaDB uses L2 (Euclidean) distance by default for cosine similarity, where:
- Distance 0.0 = identical vectors
- Distance ~1.0 = orthogonal (unrelated)
- Distance ~2.0 = opposite

The threshold of 1.30 provides a comfortable margin above orthogonality, catching truly out-of-domain queries while allowing for some semantic drift in legitimate textbook questions. This value is configurable via the `DISTANCE_THRESHOLD` environment variable for corpus-specific tuning.

### Why Not LLM-Based Refusal?

LLM-based refusal (asking the model "is this answerable?") has several drawbacks:
- Consumes an API call even for obvious out-of-domain queries
- Adds ~1-2s latency
- LLMs sometimes override their own refusal instructions

The distance threshold provides deterministic, zero-cost, zero-latency refusal.

---

## Authentication and Session Management

### Authentication Flow

1. User registers with email + password
2. Password is hashed with bcrypt and stored in SQLite
3. On login, a JWT token is created and set as an httponly cookie
4. The first registered user automatically receives the `admin` role
5. Subsequent users receive the `customer` role
6. Admin users can upload PDFs and manage the library
7. Customer users can chat and view the library (read-only)

### Session Persistence

- Each chat conversation is a "session" stored in SQLite
- Messages (both user and assistant) are stored with their citations
- Sessions survive page refreshes and browser restarts
- The conversation context window (last 10 turns) is loaded from the session for query rewriting

---

## Data Storage

| Component | Technology | Persistence |
|:---|:---|:---|
| Vector embeddings | ChromaDB | `./data/chroma/` directory |
| User accounts, sessions, chat history | SQLite | `./data/scholar.db` |
| BM25 keyword index | Pickle serialization | `./data/bm25_index.pkl` |
| Uploaded PDF files | Local filesystem | `./data/pdfs/` |

All storage is file-based under a single `./data/` directory, mapped to a Docker volume or Railway persistent storage.

---

## Frontend Architecture

### Design System: Daylight Studio

The frontend implements the "Daylight Studio" design system - a high-clarity academic workspace with:
- Lavender-tinted white canvas (`#faf8ff`)
- Hairline borders instead of shadows
- Royal Blue primary actions
- Subject color-coding (Maths=Blue, Science=Emerald, Social Science=Amber)
- Plus Jakarta Sans headlines, Inter body text, JetBrains Mono for code

### Component Architecture

```
AppLayout
  +-- Sidebar (260px, fixed left)
  +-- TopAppBar (sticky, backdrop-blur)
  +-- Page Content
      +-- LandingPage (3D hero, ambient gradient)
      +-- ChatPage
      |   +-- ChatView
      |   |   +-- ChatMessage (user/assistant)
      |   |   +-- CitationPill
      |   |   +-- RetrievalIndicator
      |   +-- ChatInput (floating, pill-shaped)
      |   +-- PDFInspectorDrawer (split-view)
      +-- LibraryPage
      |   +-- FilterChips
      |   +-- LibraryGrid
      |   |   +-- DocumentCard (subject-coded)
      |   +-- UploadZone (admin only)
      +-- SettingsPage
      +-- LoginPage
```

### Performance Optimizations

- **Lazy-loaded 3D**: `@react-three/fiber` bundle loads only on the landing page via `React.lazy()`
- **SSE Streaming**: Chat responses stream token-by-token via `EventSource`
- **Reduced Motion**: `prefers-reduced-motion` disables 3D rotation and ambient gradient drift
- **Virtualized rendering**: Long chat histories are efficiently rendered

---

## Deployment Architecture

```
Railway Project
  +-- Backend Service
  |   +-- FastAPI (Dockerfile)
  |   +-- Persistent Volume: /app/data
  |   +-- Environment variables
  +-- Frontend Service
      +-- Nginx serving built React app (Dockerfile)
      +-- Build arg: VITE_API_URL -> backend URL
```

Both services deploy from the same GitHub repository with different root directories (`backend/` and `frontend/`).

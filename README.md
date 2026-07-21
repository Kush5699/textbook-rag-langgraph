# Textbook RAG

A production-oriented, conversational Retrieval-Augmented Generation (RAG) application for school textbook PDFs. It answers from a signed-in user's uploaded textbooks only, retains conversation context, and attaches verified source names, PDF page numbers, and supporting snippets to every grounded response.

## Assignment coverage

| Requirement | Implementation |
| --- | --- |
| Multiple textbook PDFs | Private PDF upload library per user |
| Searchable RAG pipeline | PDF/OCR extraction, parent-child chunks, embeddings, Qdrant |
| One conversational interface | Responsive browser chat and saved conversations |
| Automatic textbook selection | Hybrid search ranks evidence across all uploaded books |
| Textbook-only answers | Evidence threshold, restrictive prompt, fixed refusal without evidence |
| Source + page citations | Source/page metadata travels from page extraction to the response |
| Relevant snippets | Each citation includes the retrieved textbook excerpt |
| Hybrid search | Qdrant semantic retrieval + SQLite FTS keyword retrieval + RRF fusion |
| Metadata filters | Subject, standard, and selected-document filters are supported by the API |
| Reranking | Optional cross-encoder with deterministic fallback |
| OCR | Automatic fallback for scanned PDFs through Tesseract |
| Streaming | Server-sent response tokens in the web UI |
| Auth and history | Password hashing, signed HTTP-only cookie, user isolation, conversations |
| Docker deployment | Dockerfile, Compose stack, persistent volumes, health endpoint |

## Architecture

```text
Browser
  ├─ account, PDF library, chat, source cards
  │
FastAPI application
  ├─ authentication and conversation history ───────── SQLite/PostgreSQL
  ├─ PDF parser + optional OCR
  ├─ generic parent-child chunker with page provenance
  ├─ embedding provider ─────────────────────────────── OpenAI by default
  ├─ hybrid retrieval ───────────────────────────────── Qdrant + SQLite FTS
  ├─ optional cross-encoder reranker
  └─ grounded answer generator ──────────────────────── OpenAI by default
```

The full design, trade-offs, and safety controls are in [docs/architecture.md](docs/architecture.md). The implementation research sources are in [docs/references.md](docs/references.md).

## Quick start with Docker

1. Copy the environment template and set secrets:

   ```powershell
   Copy-Item .env.example .env
   ```

2. In `.env`, set a strong `JWT_SECRET` and an `OPENAI_API_KEY`. Keep `EMBEDDING_PROVIDER=openai` and `CHAT_PROVIDER=openai` for normal operation.

3. Start the application and Qdrant:

   ```powershell
   docker compose up --build
   ```

4. Open [http://localhost:8000](http://localhost:8000), create an account, upload PDFs, wait for each document to become `ready`, and ask a question.

## Local development

Requires Python 3.12+, Qdrant, and (for OCR) Poppler plus Tesseract.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

For unit tests without external services, use the deterministic local embedding provider:

```powershell
$env:EMBEDDING_PROVIDER = "hash"
$env:EMBEDDING_DIMENSIONS = "128"
pytest
```

The user interface is served from the FastAPI application. API documentation is available at `/docs` while running.

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required for hosted answer generation and embeddings |
| `JWT_SECRET` | Long random production secret |
| `DATABASE_URL` | SQLite by default; use managed PostgreSQL in production |
| `QDRANT_URL` | Qdrant service endpoint |
| `QDRANT_API_KEY` | Required when connecting to Qdrant Cloud |
| `CHILD_CHUNK_TOKENS` | Precise retrieval unit, default 260 approximate tokens |
| `PARENT_CHUNK_TOKENS` | Larger context unit, default 900 approximate tokens |
| `ENABLE_RERANKING` | Enables lazy-loaded cross-encoder reranking |
| `COOKIE_SECURE` | Set `true` behind HTTPS |
| `ALLOWED_ORIGINS` | Comma-separated allowed browser origins |

## Deployment

Follow [docs/deployment.md](docs/deployment.md) for Docker Compose, Render plus Qdrant Cloud, GitHub Actions, secrets, database backup, HTTPS, and production hardening.

## Evaluation checklist

Before submission, test at least these cases:

1. A direct question from one textbook produces the correct source and PDF page.
2. A question whose answer is in a different subject automatically retrieves that textbook.
3. An exact vocabulary question benefits from keyword search.
4. A pronoun follow-up such as “Why did she say that?” uses the prior turn while retrieving fresh evidence.
5. A question outside every uploaded book returns the fixed unavailable-information response.
6. A scanned test PDF is readable after OCR.

## Important limitation

No RAG system can make an absolute mathematical guarantee that a language model never behaves unexpectedly. This project reduces that risk by refusing before generation when retrieval is insufficient, passing only evidence to the model, forbidding outside knowledge in the system prompt, and generating citations from stored page metadata rather than asking the model to invent them.

# Deployment and GitHub handoff

## Pre-deployment checklist

1. Create a unique `JWT_SECRET` of at least 32 random bytes.
2. Create an OpenAI API key and add it as `OPENAI_API_KEY` only in the hosting provider's secret store.
3. Provision Qdrant Cloud or a managed/private Qdrant deployment.
4. Provision managed PostgreSQL if this will be used beyond a demo; set `DATABASE_URL` accordingly.
5. Set `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://your-domain.example`.
6. Use persistent storage/object storage for uploaded PDFs and database backups.

## Docker Compose demo deployment

On a Linux VM with Docker Compose:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL> textbook-rag
cd textbook-rag
cp .env.example .env
# Edit .env with the secrets and production values above.
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

Put a TLS reverse proxy such as Caddy, Nginx, or your cloud load balancer in front of port 8000. Do not expose Qdrant's port publicly.

## Render + Qdrant Cloud

1. Push this repository to GitHub.
2. Create a Qdrant Cloud cluster. Copy its HTTPS endpoint into `QDRANT_URL` and store its API key only if your chosen client configuration includes it.
3. Create a Docker-based Render web service from the repository.
4. Add a persistent disk mounted at `/app/data` and `/app/uploads`, or replace those paths with managed PostgreSQL plus object storage.
5. Add `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY`, `COOKIE_SECURE=true`, and the public domain in `ALLOWED_ORIGINS` as secret environment variables.
6. Use `/health` as the health check path.
7. Run the six evaluation cases in the README against the live URL before sharing the demo.

## GitHub push

```powershell
git init
git add .
git commit -m "Build production-oriented textbook RAG application"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Never commit `.env`, API keys, user PDFs, database files, or Qdrant storage.

## Operations

- Back up SQL records and original PDFs.
- Monitor failed ingestion jobs and Qdrant availability.
- Set a retention policy for user-uploaded textbooks.
- Rotate API keys and JWT secrets through the hosting secret manager.
- Add rate limits before inviting public traffic.

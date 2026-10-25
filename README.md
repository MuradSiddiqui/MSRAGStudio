# MS RAG Studio

One studio, three ways to read your files: **Basic RAG** for text documents,
**Multimodal RAG** for text + images (plans, drawings, scans), and **Agentic RAG**,
which plans, retrieves in steps and verifies completeness — all matching items,
not just the top few.

Upload documents and images, ask in plain language, get cited answers, view them
in the studio or download a report (PDF / Markdown).

## Architecture

- **Live path (in-app):** Next.js frontend -> FastAPI Q&A service -> Qdrant + Groq (streaming answers)
- **Orchestration (n8n):** ingestion workflows, scheduled re-indexing, report delivery, evaluation runs.
  n8n runs separately (self-hosted Docker or n8n Cloud) — it does not run on Vercel.

## Stack

FastAPI · Next.js · Qdrant · BGE embeddings · Groq (gpt-oss-120b answers, gpt-oss-20b fast tasks, Llama 4 Scout vision) · n8n · Docker

## Run locally

```bash
docker compose up -d            # Qdrant + n8n
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in keys
uvicorn app.main:app --port 8000
```

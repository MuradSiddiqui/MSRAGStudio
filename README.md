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
docker compose up -d            # Qdrant + n8n (optional if you use Qdrant Cloud)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in keys
uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Deploy (Vercel UI + separate API)

**Vercel only hosts the Next.js frontend.** The FastAPI backend loads a local
BGE embedding model (PyTorch) and talks to Qdrant / Groq / Gemini — that cannot
run on Vercel serverless. Split the stack:

| Piece | Where it runs | What it needs |
| --- | --- | --- |
| Studio UI | **Vercel** (`frontend/`) | `NEXT_PUBLIC_API_URL` → your public backend URL |
| RAG API | **Railway / Render / Fly.io / a VPS** (`backend/`) | `MSRAG_*` keys from `backend/.env.example` |
| Vectors | **Qdrant Cloud** (or Docker) | URL + API key |
| LLMs | **Groq** (+ **Gemini** for images) | API keys |

### 1. Deploy the backend somewhere with a persistent Python process

Example on Railway / Render / Fly: root = `backend/`, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, set env vars from
`backend/.env.example`. First boot downloads the embedding model (~130 MB).

Expose HTTPS (e.g. `https://msrag-api.up.railway.app`). CORS already allows
`*.vercel.app` and localhost.

### 2. Deploy the frontend on Vercel

- Framework: Next.js · Root Directory: **`frontend`**
- Environment variable:

```
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-HOST
```

Without that variable the browser expects a local proxy to `localhost:8000`,
which does not exist for visitors on the Vercel site.

### 3. How a visitor uses the live site

1. Open your Vercel URL (e.g. `https://ms-rag-studio.vercel.app`).
2. Go to **Studio**, upload PDFs / images / text.
3. Pick Basic / Multimodal / Agentic and ask — the UI calls your hosted
   FastAPI, which embeds, searches Qdrant, and answers via Groq.

If the UI shows “API offline”, the backend URL is wrong, down, or blocked by
CORS (custom domains need to be allowed in `backend/app/main.py`).

### Temporary: UI on Vercel, API on your laptop

```bash
# terminal A — backend
cd backend && uvicorn app.main:app --port 8000

# terminal B — public tunnel (Cloudflare or ngrok)
cloudflared tunnel --url http://localhost:8000
# set NEXT_PUBLIC_API_URL on Vercel to the tunnel HTTPS URL, then redeploy
```

Good for demos; for real users host the backend permanently.

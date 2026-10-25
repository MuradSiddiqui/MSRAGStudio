# n8n workflows (orchestration layer)

n8n does NOT answer questions — the FastAPI backend does that (streaming, low latency).
n8n runs the async work around it. Self-hosted via the root docker-compose, or n8n Cloud.

1. **Ingestion** (webhook): file received -> extract text / OCR -> chunk -> embed -> Qdrant upsert (native Qdrant + LangChain nodes).
2. **Nightly sync** (cron): scan Drive/uploads -> re-ingest changed files only.
3. **Reports & eval** (on approve / weekly): build PDF report -> email + Drive; golden-set evaluation run with scores logged.

# n8n workflows (orchestration layer)

n8n does NOT answer questions — the FastAPI backend does that (streaming, low latency).
n8n runs the async work around it. Self-hosted via the root docker-compose, or n8n Cloud.

1. **Ingestion** (webhook): file received -> extract text / OCR -> chunk -> embed -> Qdrant upsert (native Qdrant + LangChain nodes).
2. **Nightly sync** (cron): scan Drive/uploads -> re-ingest changed files only.
3. **Reports & eval** (on approve / weekly): build PDF report -> email + Drive; golden-set evaluation run with scores logged.

## Importable workflows (`workflows/`)

Ready-to-import JSON exports. In n8n: Workflows -> Import from File.

| File | Trigger | What it does |
| --- | --- | --- |
| `01-ingestion-webhook.json` | `POST /webhook/msrag-ingest` (file upload) | Sends the file to the backend `POST /files` (extract, chunk, embed, Qdrant upsert) and replies with the indexed chunk count, or 422 if nothing was indexable. |
| `02-nightly-sync.json` | Cron, nightly 02:00 Europe/Berlin | Health-checks the backend, lists the watched Google Drive folder, and re-ingests only files changed since the last run (watermark in workflow static data). |
| `03-reports-and-eval.json` | Cron, Mondays 08:00 + `POST /webhook/msrag-report` | Weekly: asks the golden question set in Agentic mode, scores each answer (answer + sources + coverage present), emails the summary. On demand: fetches the backend Markdown report for a question and returns it. |

Setup after import:

- Set the environment variable `MSRAG_BACKEND_URL` for n8n (default inside the workflows is `http://host.docker.internal:8000`, which fits the root docker-compose where the backend runs on the host; if the backend runs as a compose service, use its service name instead).
- Workflow 02: paste your Drive folder id on the Drive node and connect a Google Drive credential.
- Workflow 03: connect a Gmail credential on the email node and set the recipient address.
- Placeholders are marked `PASTE_...` inside the JSON; nothing in these files contains real credentials.

# MS RAG Studio: Frontend

Next.js 14 (App Router, TypeScript, Tailwind CSS) frontend for MS RAG Studio,
built from the approved Figma design.

## Pages

- `/` Landing page: the three modes, how it works, the building code demo
  example, and the tech stack.
- `/studio` Workspace: upload documents and images, ask questions in Basic,
  Multimodal or Agentic mode, inspect cited sources, read the Agentic
  coverage report, and download or copy the Markdown report.
  Accepts `?mode=basic|multimodal|agentic` and `?q=<question>` to prefill.

## Run locally

Start the backend first (from `../backend`, port 8000), then:

```bash
npm install
npm run dev        # http://localhost:3000
```

## API wiring

The client talks to the FastAPI backend through `lib/api.ts`:

| Call | Backend endpoint |
| --- | --- |
| Health badge | `GET /health` |
| Upload a file | `POST /files` (multipart, field `file`) |
| Ask | `POST /ask` with `{ question, mode }` |
| Report | `GET /report?question=...` (Markdown, downloaded as a file) |

Base URL rule: if `NEXT_PUBLIC_API_URL` is set, the browser calls that URL
directly (copy `.env.example` to `.env.local` to set it). Otherwise requests
go to the same-origin `/backend` proxy in `next.config.mjs`, which forwards
to `http://localhost:8000`. The proxy exists because the backend ships
without CORS middleware, so a direct call from `localhost:3000` would be
blocked by the browser.

## Notes and gaps

- The backend has no endpoint to list or delete previously uploaded files,
  so the Studio file list shows this session's uploads only. Removing a file
  from the list does not remove its chunks from the Qdrant index.
- Upload accepts what the backend extractor handles: PDF, DOCX, TXT and
  PNG/JPG/WebP images (no GIF, BMP or TIFF).
- Agentic plan steps come from the response's `coverage.sub_questions`
  field; the backend returns no separate `plan` array.

/**
 * API client for the MS RAG Studio backend (FastAPI, local default port 8000).
 *
 * Base URL handling:
 * - If NEXT_PUBLIC_API_URL is set, the browser calls that backend directly.
 * - Otherwise requests go to the same-origin "/backend" proxy defined in
 *   next.config.mjs, which forwards to http://localhost:8000. This matters
 *   because the backend has no CORS middleware, so a direct cross-origin
 *   call from localhost:3000 would be blocked by the browser.
 */

export type Mode = "basic" | "multimodal" | "agentic";

/** POST /files response: multer-style field "file", returns ingest counts. */
export interface UploadResult {
  uploaded: string;
  file: string;
  chunks: number;
}

/** One item of the `sources` array returned by POST /ask (Qdrant payload + score). */
export interface SourceHit {
  source: string;
  page?: number;
  chunk?: number;
  /** "text" for document chunks, "image" for vision-described image chunks. */
  kind?: string;
  text: string;
  score: number;
}

/** Agentic mode only: completeness check against the whole index. */
export interface Coverage {
  sub_questions: { sub_question: string; found: number }[];
  unique_sources: number;
  chunks_considered: number;
}

/** POST /ask response. `coverage` is present only in agentic mode. */
export interface AskResult {
  mode: Mode;
  answer: string;
  sources: SourceHit[];
  coverage?: Coverage;
}

/** Client-side record of a file sent to POST /files in this session. */
export interface UploadedFile {
  name: string;
  chunks: number | null;
  status: "uploading" | "done" | "error";
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

async function errorFrom(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.detail) {
      message =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail);
    }
  } catch {
    // keep the status-based message
  }
  return new Error(message);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/files`, { method: "POST", body: form });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function askQuestion(
  question: string,
  mode: Mode
): Promise<AskResult> {
  const res = await fetch(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/** GET /report?question=... returns a Markdown document as plain text. */
export async function fetchReport(question: string): Promise<string> {
  const res = await fetch(
    `${BASE}/report?question=${encodeURIComponent(question)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw await errorFrom(res);
  return res.text();
}

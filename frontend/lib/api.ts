/**
 * API client for the MS RAG Studio backend (FastAPI, local default port 8000).
 *
 * Base URL handling:
 * - If NEXT_PUBLIC_API_URL is set, the browser calls that backend directly
 *   (the backend's CORS policy allows localhost and *.vercel.app origins).
 * - Otherwise requests go to the same-origin "/backend" proxy defined in
 *   next.config.mjs, which forwards to http://localhost:8000.
 */

export type Mode = "basic" | "multimodal" | "agentic";

/** POST /files response. */
export interface UploadResult {
  uploaded: string;
  file: string;
  chunks: number;
}

/** One file in the Qdrant index, as returned by GET /documents. */
export interface IndexedDocument {
  name: string;
  kind: "text" | "image" | string;
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
  /** Filenames the search was limited to; empty means the whole index. */
  scoped_to?: string[];
}

export interface Health {
  ok: boolean;
  modelReady: boolean;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

export const MAX_UPLOAD_MB = 50;
export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function isImageName(name: string) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Returns a user-facing reason the file can't be uploaded, or null if it's fine. */
export function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "Unsupported type. Use PDF, DOCX, TXT, MD, PNG, JPG or WebP.";
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `Larger than the ${MAX_UPLOAD_MB} MB limit.`;
  }
  return null;
}

async function errorFrom(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text);
    if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body?.detail)) {
      message = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
    }
  } catch {
    // The backend always answers with JSON, so a non-JSON error comes from the
    // dev proxy failing to reach it (refused, reset or timed out).
    if (res.status >= 500) {
      message = "Couldn't reach the backend. Check that it is running on port 8000, then retry.";
    }
  }
  return new Error(message);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Could not reach the backend. Is it running on port 8000?");
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}

export async function checkHealth(): Promise<Health> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, modelReady: false };
    const body = await res.json();
    return { ok: true, modelReady: body.model_ready !== false };
  } catch {
    return { ok: false, modelReady: false };
  }
}

export async function listDocuments(): Promise<IndexedDocument[]> {
  const res = await request("/documents");
  const body = await res.json();
  return body.documents ?? [];
}

export async function deleteDocument(name: string): Promise<void> {
  await request(`/documents/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await request("/files", { method: "POST", body: form });
  return res.json();
}

export async function askQuestion(
  question: string,
  mode: Mode,
  options?: { sources?: string[]; signal?: AbortSignal }
): Promise<AskResult> {
  const res = await request("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      mode,
      sources: options?.sources ?? [],
    }),
    signal: options?.signal,
  });
  return res.json();
}

export function sourceLocation(hit: Pick<SourceHit, "kind" | "page">) {
  return hit.kind === "image" ? "image" : `p.${hit.page ?? "-"}`;
}

/** Markdown report built from an answer, so it works for history items too. */
export function buildReport(question: string, result: AskResult): string {
  const lines = [
    "# MS RAG Studio — Report",
    "",
    `**Mode:** ${result.mode}`,
    `**Question:** ${question}`,
    `**Generated:** ${new Date().toLocaleString()}`,
    ...(result.scoped_to && result.scoped_to.length > 0
      ? [`**Scoped to:** ${result.scoped_to.join(", ")}`]
      : []),
    "",
    "## Answer",
    "",
    result.answer,
    "",
    "## Sources",
    "",
    ...result.sources.map(
      (s) => `- ${s.source} · ${sourceLocation(s)} (score ${(s.score ?? 0).toFixed(2)})`
    ),
  ];
  if (result.coverage) {
    const c = result.coverage;
    lines.push(
      "",
      "## Coverage",
      "",
      `Chunks considered: ${c.chunks_considered}`,
      `Unique sources: ${c.unique_sources}`,
      "",
      ...c.sub_questions.map(
        (s, i) => `${i + 1}. ${s.sub_question} (${s.found} found)`
      )
    );
  }
  return lines.join("\n");
}

/**
 * API client for the MS RAG Studio backend (FastAPI, local default port 8000).
 *
 * Base URL handling:
 * - If NEXT_PUBLIC_API_URL is set, the browser calls that backend directly
 *   (the backend's CORS policy allows localhost and *.vercel.app origins).
 * - Otherwise requests go to the same-origin "/backend" proxy defined in
 *   next.config.mjs, which forwards to http://localhost:8000.
 */

export type Mode = "basic" | "multimodal" | "agentic" | "stair";

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
  /** Leaf section heading the chunk belongs to (structure-aware indexing). */
  section?: string;
  /** Full section breadcrumb, e.g. "§4 Fire protection > §4.2 Doors". */
  section_path?: string;
  text: string;
  score: number;
}

/** Agentic mode only: completeness check against the whole index. */
export interface Coverage {
  sub_questions: { sub_question: string; found: number }[];
  unique_sources: number;
  chunks_considered: number;
}

/** STAIR mode only: how the table of contents was navigated. */
export interface StructureReport {
  navigated: boolean;
  reason: string;
  toc_sections: number;
  chosen: { source: string; section: string; section_path: string; chunks: number }[];
}

/** POST /ask response. `coverage` is present only in agentic mode,
 *  `structure` only in stair mode. */
export interface AskResult {
  mode: Mode;
  answer: string;
  sources: SourceHit[];
  /** Soft flag from the top hit score — not a hard retrieval cutoff. */
  evidence?: "ok" | "low";
  coverage?: Coverage;
  structure?: StructureReport;
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

const WORKSPACE_KEY = "msrag-workspace";
let workspaceId: string | null = null;

/** Random id for this browser; the backend shows each id only its own files.
 *  Not an account: clearing site data starts an empty library. */
export function getWorkspaceId(): string {
  if (workspaceId) return workspaceId;
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) {
      workspaceId = saved;
      return saved;
    }
  } catch {
    // Storage blocked (private mode): fall through to a per-tab id.
  }
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  workspaceId = fresh;
  try {
    localStorage.setItem(WORKSPACE_KEY, fresh);
  } catch {
    // Not persisted; the library lasts for this tab only.
  }
  return fresh;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  const headers = new Headers(init?.headers);
  headers.set("X-Workspace-Id", getWorkspaceId());
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, headers });
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

export type Preview =
  | { kind: "file"; name: string; url: string; mime: string }
  | { kind: "image"; name: string; stored: false; description: string }
  | {
      kind: "text";
      name: string;
      stored: boolean;
      truncated: boolean;
      pages: { page: number; text: string }[];
    };

/** The uploaded file (PDF/image, as a blob URL the caller must revoke) or its
 *  extracted text. When the server lost the original, the indexed text. */
export async function fetchPreview(name: string, signal?: AbortSignal): Promise<Preview> {
  const res = await request(`/documents/${encodeURIComponent(name)}/preview`, { signal });
  const mime = res.headers.get("content-type") ?? "";
  if (mime.includes("application/json")) {
    return { name, ...(await res.json()) };
  }
  const blob = await res.blob();
  return { kind: "file", name, url: URL.createObjectURL(blob), mime: blob.type || mime };
}

export function sourceLocation(hit: Pick<SourceHit, "kind" | "page" | "section">) {
  if (hit.kind === "image") return "image";
  const page = `p.${hit.page ?? "-"}`;
  return hit.section ? `${hit.section} · ${page}` : page;
}

/** Markdown report built from an answer, so it works for history items too. */
export function buildReport(question: string, result: AskResult): string {
  const lines = [
    "# MS RAG Studio — Report",
    "",
    `**Mode:** ${result.mode}`,
    `**Question:** ${question}`,
    `**Generated:** ${new Date().toLocaleString()}`,
    ...(result.evidence === "low" ? ["**Evidence:** low — check sources"] : []),
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
  if (result.structure) {
    const st = result.structure;
    lines.push("", "## Structure (STAIR)", "");
    if (st.navigated) {
      lines.push(
        `Sections in scope: ${st.toc_sections}`,
        ...(st.reason ? [`Navigation: ${st.reason}`] : []),
        "",
        ...st.chosen.map(
          (ch) => `- ${ch.source} · ${ch.section_path} (${ch.chunks} chunks read in full)`
        )
      );
    } else {
      lines.push(st.reason);
    }
  }
  return lines.join("\n");
}

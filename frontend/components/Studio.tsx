"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  History,
  Loader2,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  askQuestion,
  buildReport,
  checkHealth,
  deleteDocument,
  listDocuments,
  uploadFile,
  validateFile,
  type AskResult,
  type IndexedDocument,
  type Mode,
} from "@/lib/api";
import { MODES, MODE_THEMES } from "@/lib/theme";
import UploadZone, { type UploadItem } from "./UploadZone";
import AnswerPanel from "./AnswerPanel";

const DEMO_QUESTION = "Which doors must be fire-rated?";
const HISTORY_KEY = "msrag-history";
const HISTORY_LIMIT = 25;
const MAX_QUESTION = 2000;

const SUGGESTIONS = [
  DEMO_QUESTION,
  "Summarise the key points of my documents",
  "List every deadline or date mentioned",
  "What does the floor plan show?",
];

interface HistoryEntry {
  id: string;
  question: string;
  mode: Mode;
  result: AskResult;
  elapsedMs?: number;
  at: number;
}

interface Toast {
  id: number;
  tone: "ok" | "error";
  text: string;
}

type HealthState = "unknown" | "ok" | "warming" | "down";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "report"
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export default function Studio() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("basic");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>("unknown");
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [documentsState, setDocumentsState] = useState<"loading" | "ready" | "error">("loading");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [recent, setRecent] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingFiles = useRef(new Map<string, File>());
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // URL params: /studio?mode=agentic&q=...
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuestion(q.slice(0, MAX_QUESTION));
    const m = searchParams.get("mode");
    if (m === "basic" || m === "multimodal" || m === "agentic") setMode(m);
  }, [searchParams]);

  // History persists across reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // corrupt or unavailable storage: start fresh
    }
  }, []);

  const persistHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // quota or private mode: keep in memory only
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    setDocumentsState("loading");
    try {
      setDocuments(await listDocuments());
      setDocumentsState("ready");
    } catch {
      setDocumentsState("error");
    }
  }, []);

  // Health polling: fast while the backend is down or the model is loading.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let wasOk = false;
    const tick = async () => {
      const h = await checkHealth();
      if (cancelled) return;
      const next: HealthState = !h.ok ? "down" : h.modelReady ? "ok" : "warming";
      setHealth(next);
      if (h.ok && !wasOk) refreshDocuments();
      wasOk = h.ok;
      timer = setTimeout(tick, next === "ok" ? 30000 : 4000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshDocuments]);

  // Elapsed timer while asking.
  useEffect(() => {
    if (!asking) return;
    const start = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(t);
  }, [asking]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [question]);

  // "/" focuses the composer from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      if (e.key === "Escape" && abortRef.current) abortRef.current.abort();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runUpload = useCallback(
    async (id: string) => {
      const file = pendingFiles.current.get(id);
      if (!file) return;
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "uploading", error: undefined } : u))
      );
      try {
        const res = await uploadFile(file);
        pendingFiles.current.delete(id);
        setUploads((prev) => prev.filter((u) => u.id !== id));
        if (res.chunks > 0) {
          setRecent((prev) => new Set(prev).add(res.file));
          toast(`Indexed ${res.file} · ${res.chunks} chunk${res.chunks === 1 ? "" : "s"}`);
        } else {
          toast(`${res.file} had no readable text (scanned PDF?)`, "error");
        }
        await refreshDocuments();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "error", error: message } : u))
        );
      }
    },
    [refreshDocuments, toast]
  );

  // Uploads run one at a time so the backend isn't embedding several files at once.
  const enqueue = useCallback(
    (id: string) => {
      uploadQueue.current = uploadQueue.current.then(() => runUpload(id));
    },
    [runUpload]
  );

  const handleFiles = useCallback(
    (incoming: File[]) => {
      for (const file of incoming) {
        const invalid = validateFile(file);
        const id = uid();
        pendingFiles.current.set(id, file);
        setUploads((prev) => [
          ...prev.filter((u) => !(u.name === file.name && u.status === "error")),
          { id, name: file.name, status: invalid ? "error" : "uploading", error: invalid ?? undefined },
        ]);
        if (!invalid) enqueue(id);
      }
    },
    [enqueue]
  );

  const handleRetry = useCallback(
    (id: string) => {
      const file = pendingFiles.current.get(id);
      if (!file) return;
      const invalid = validateFile(file);
      if (invalid) return;
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: "uploading" } : u)));
      enqueue(id);
    },
    [enqueue]
  );

  const handleDismiss = useCallback((id: string) => {
    pendingFiles.current.delete(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await deleteDocument(name);
        setDocuments((prev) => prev.filter((d) => d.name !== name));
        toast(`Removed ${name} from the index`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not remove the file", "error");
      }
    },
    [toast]
  );

  const ask = useCallback(
    async (q: string, m: Mode) => {
      q = q.trim();
      if (!q || abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setAsking(true);
      setError(null);
      const started = Date.now();
      try {
        const result = await askQuestion(q, m, controller.signal);
        const entry: HistoryEntry = {
          id: uid(),
          question: q,
          mode: m,
          result,
          elapsedMs: Date.now() - started,
          at: Date.now(),
        };
        setCurrent(entry);
        setHealth((h) => (h === "down" ? "ok" : h));
        setHistory((prev) => {
          const next = [entry, ...prev].slice(0, HISTORY_LIMIT);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          } catch {
            // keep in memory only
          }
          return next;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong while asking.");
      } finally {
        abortRef.current = null;
        setAsking(false);
      }
    },
    []
  );

  const handleAsk = () => ask(question, mode);

  const handleAskInMode = (m: Mode) => {
    if (!current) return;
    setMode(m);
    setQuestion(current.question);
    ask(current.question, m);
  };

  const handleDownload = () => {
    if (!current) return;
    downloadText(
      `${slugify(current.question)}-${current.mode}.md`,
      buildReport(current.question, current.result)
    );
  };

  const handleCopy = async (what: "answer" | "report") => {
    if (!current) return;
    await copyText(
      what === "answer" ? current.result.answer : buildReport(current.question, current.result)
    );
  };

  const restore = (entry: HistoryEntry) => {
    setCurrent(entry);
    setMode(entry.mode);
    setQuestion(entry.question);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const theme = MODE_THEMES[mode];
  const canAsk = question.trim().length > 0 && !asking;
  const noDocs = documentsState === "ready" && documents.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Studio</h1>
        </div>
        <StatusPill health={health} />
      </div>

      {health === "down" && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium">The API isn&apos;t reachable.</p>
            <p className="mt-0.5 text-muted">
              Start it with{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">
                uvicorn app.main:app --port 8000
              </code>{" "}
              in <code className="font-mono text-xs">backend/</code>. This page reconnects automatically.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <UploadZone
              documents={documents}
              documentsState={documentsState}
              uploads={uploads}
              recent={recent}
              onFiles={handleFiles}
              onRetry={handleRetry}
              onDismiss={handleDismiss}
              onDelete={handleDelete}
              onRefresh={refreshDocuments}
            />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> History
              </p>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    persistHistory([]);
                    toast("History cleared");
                  }}
                  className="text-xs text-muted hover:text-danger"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-muted">Questions you ask are saved here on this device.</p>
            ) : (
              <ul className="-mx-1.5 mt-2 max-h-72 space-y-0.5 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => restore(h)}
                      className={`w-full rounded-lg px-2 py-2 pr-8 text-left transition-colors hover:bg-raised ${
                        current?.id === h.id ? "bg-raised" : ""
                      }`}
                    >
                      <span className="line-clamp-2 text-[13px] leading-snug">{h.question}</span>
                      <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-faint">
                        <span className={`h-1.5 w-1.5 rounded-full ${MODE_THEMES[h.mode].dot}`} />
                        {MODE_THEMES[h.mode].short} · {timeAgo(h.at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => persistHistory(history.filter((x) => x.id !== h.id))}
                      className="absolute right-1.5 top-2 rounded p-1 text-faint opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label="Delete from history"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 space-y-4">
          {/* Mode switch */}
          <div>
            <div
              role="radiogroup"
              aria-label="Retrieval mode"
              className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1"
            >
              {MODES.map((m) => {
                const t = MODE_THEMES[m];
                const active = m === mode;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(m)}
                    className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-ink text-canvas" : "hover:bg-raised"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                      {t.short}
                    </span>
                    <span
                      className={`mt-0.5 hidden text-xs sm:block ${active ? "text-canvas/60" : "text-muted"}`}
                    >
                      {t.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 px-1 text-sm text-muted">{theme.help}</p>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className={`card px-4 pb-3 pt-4 ring-4 ring-transparent transition-[border-color,box-shadow] ${theme.ring}`}
          >
            <label htmlFor="question" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="question"
              ref={textareaRef}
              value={question}
              maxLength={MAX_QUESTION}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              rows={2}
              placeholder="Ask anything about your documents…"
              className="block max-h-[280px] w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-faint"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="hidden items-center gap-1 text-xs text-faint sm:inline-flex">
                <span className="kbd">↵</span> to ask · <span className="kbd">⇧</span>
                <span className="kbd">↵</span> new line · <span className="kbd">/</span> focus
              </span>
              {question.length > MAX_QUESTION * 0.8 && (
                <span className="font-mono text-[11px] text-muted">
                  {question.length}/{MAX_QUESTION}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {question && !asking && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion("");
                      textareaRef.current?.focus();
                    }}
                    className="btn-quiet py-1.5 text-xs"
                  >
                    Clear
                  </button>
                )}
                {asking ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="btn-ghost py-1.5"
                    title="Stop (Esc)"
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop
                  </button>
                ) : (
                  <button type="submit" disabled={!canAsk} className="btn-primary py-1.5">
                    Ask {theme.short} <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Suggestions */}
          {!current && !asking && !question && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuestion(s);
                    if (s === DEMO_QUESTION) setMode("agentic");
                    textareaRef.current?.focus();
                  }}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-faint hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Progress */}
          {asking && (
            <div className="card animate-fade-up px-5 py-5" role="status">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className={`h-4 w-4 animate-spin ${theme.text}`} />
                <span>
                  {mode === "agentic"
                    ? elapsed < 3000
                      ? "Planning sub-questions…"
                      : elapsed < 7000
                        ? "Retrieving for each sub-question…"
                        : "Checking coverage and writing the answer…"
                    : elapsed < 1500
                      ? "Searching the index…"
                      : "Drafting a cited answer…"}
                </span>
                <span className="ml-auto font-mono text-xs text-faint">
                  {(elapsed / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="skeleton h-3 w-11/12" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          )}

          {error && !asking && (
            <div className="flex animate-fade-up items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="flex-1">
                <p className="font-medium">The request failed</p>
                <p className="mt-0.5 text-muted">{error}</p>
              </div>
              <button type="button" onClick={handleAsk} className="btn-ghost py-1 text-xs">
                Retry
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded p-1 text-muted hover:text-ink"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {current && !asking && (
            <AnswerPanel
              result={current.result}
              question={current.question}
              elapsedMs={current.elapsedMs}
              onDownload={handleDownload}
              onCopy={handleCopy}
              onAskInMode={handleAskInMode}
            />
          )}

          {!current && !asking && !error && (
            <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <p className="font-display text-2xl font-semibold tracking-tight">
                {noDocs ? (
                  <>
                    Start with a <span className="font-serif font-normal italic">document.</span>
                  </>
                ) : (
                  <>
                    Ask your first <span className="font-serif font-normal italic">question.</span>
                  </>
                )}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {noDocs
                  ? "Upload a PDF, Word file or image on the left. Then ask, and the answer will cite the exact pages and images it used."
                  : "Pick a mode and ask in plain language. Every answer lists the pages and images it came from."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up rounded-xl px-4 py-2.5 text-sm shadow-lg ${
              t.tone === "error" ? "bg-danger text-white" : "bg-ink text-canvas"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ health }: { health: HealthState }) {
  const map: Record<HealthState, { dot: string; text: string; pulse?: boolean }> = {
    unknown: { dot: "bg-faint", text: "Connecting…", pulse: true },
    ok: { dot: "bg-success", text: "API connected" },
    warming: { dot: "bg-basic", text: "Loading embedding model…", pulse: true },
    down: { dot: "bg-danger", text: "API offline" },
  };
  const s = map[health];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] text-muted">
      <span className="relative flex h-2 w-2">
        {s.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${s.dot}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      {s.text}
    </span>
  );
}

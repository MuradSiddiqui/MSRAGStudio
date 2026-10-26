"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  askQuestion,
  checkHealth,
  fetchReport,
  uploadFile,
  type AskResult,
  type Mode,
  type UploadedFile,
} from "@/lib/api";
import { MODES, MODE_THEMES } from "@/lib/theme";
import UploadZone from "./UploadZone";
import AnswerPanel from "./AnswerPanel";

const DEMO_QUESTION = "Which doors must be fire-rated?";

const MODE_HELP: Record<Mode, string> = {
  basic: "Top matching passages from your text documents, answered with page citations.",
  multimodal:
    "Text and images in one index. Image chunks are cited by file name, like [plan.png · image].",
  agentic:
    "Plans sub-questions, retrieves for each one, then reports coverage across the whole index. Use it for list-all questions.",
};

export default function Studio() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("basic");
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [askedQuestion, setAskedQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<"unknown" | "ok" | "down">("unknown");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuestion(q);
    const m = searchParams.get("mode");
    if (m === "basic" || m === "multimodal" || m === "agentic") setMode(m);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setHealth(ok ? "ok" : "down");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiles = useCallback(async (incoming: File[]) => {
    for (const file of incoming) {
      setFiles((prev) => {
        const without = prev.filter((f) => f.name !== file.name);
        return [
          ...without,
          { name: file.name, chunks: null, status: "uploading" as const },
        ];
      });
      try {
        const res = await uploadFile(file);
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? { name: file.name, chunks: res.chunks, status: "done" as const }
              : f
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? {
                  name: file.name,
                  chunks: null,
                  status: "error" as const,
                  error: message,
                }
              : f
          )
        );
      }
    }
  }, []);

  const handleRemove = useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    setCopied(false);
    try {
      const res = await askQuestion(q, mode);
      setResult(res);
      setAskedQuestion(q);
      setHealth("ok");
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while asking."
      );
    } finally {
      setAsking(false);
    }
  }, [question, mode, asking]);

  const handleDownload = useCallback(async () => {
    if (!result) return;
    setDownloading(true);
    setError(null);
    try {
      const markdown = await fetchReport(askedQuestion);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ms-rag-studio-report.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not download the report."
      );
    } finally {
      setDownloading(false);
    }
  }, [result, askedQuestion]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      const markdown = await fetchReport(askedQuestion);
      await navigator.clipboard.writeText(markdown);
    } catch {
      const fallback = [
        result.answer,
        "",
        "Sources:",
        ...result.sources.map(
          (s) => `- ${s.source} · ${s.kind === "image" ? "image" : `p.${s.page ?? "-"}`}`
        ),
      ].join("\n");
      await navigator.clipboard.writeText(fallback);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [result, askedQuestion]);

  const theme = MODE_THEMES[mode];
  const indexedCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
        {health === "ok" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            API connected
          </span>
        )}
        {health === "down" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            API not reachable. Start the backend on port 8000.
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Your documents
          </h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Files are extracted, chunked, embedded with BGE and stored in
            Qdrant. Questions search everything indexed so far, including
            earlier sessions.
          </p>
          <UploadZone
            files={files}
            onFiles={handleFiles}
            onRemove={handleRemove}
          />
        </aside>

        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Retrieval mode"
            className="flex flex-wrap gap-2"
          >
            {MODES.map((m) => {
              const t = MODE_THEMES[m];
              const active = m === mode;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? t.tabActive
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${active ? "bg-white" : t.dot}`}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-slate-500">{MODE_HELP[mode]}</p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <label
              htmlFor="question"
              className="text-sm font-semibold text-slate-800"
            >
              Ask a question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleAsk();
              }}
              rows={3}
              placeholder="For example: Which doors must be fire-rated?"
              className={`mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-[15px] outline-none ring-4 ring-transparent ${theme.focusRing}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAsk}
                disabled={asking || question.trim().length === 0}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${theme.button}`}
              >
                {asking ? "Working..." : `Ask with ${theme.short}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion(DEMO_QUESTION);
                  setMode("agentic");
                }}
                className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
              >
                Use the demo question
              </button>
              <span className="text-xs text-slate-400">
                {indexedCount > 0
                  ? `${indexedCount} file${indexedCount === 1 ? "" : "s"} indexed in this session`
                  : "Tip: Ctrl or Cmd + Enter to ask"}
              </span>
            </div>
          </div>

          {asking && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              {mode === "agentic"
                ? "Planning, retrieving per sub-question, and checking coverage..."
                : "Searching the index and drafting a cited answer..."}
            </div>
          )}

          {error && !asking && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5">{error}</p>
              <p className="mt-1 text-red-600">
                If this keeps happening, check that the backend is running
                (uvicorn app.main:app --port 8000).
              </p>
            </div>
          )}

          {result && !asking && (
            <div className="mt-4">
              <AnswerPanel
                result={result}
                question={askedQuestion}
                onDownload={handleDownload}
                onCopy={handleCopy}
                downloading={downloading}
                copied={copied}
              />
            </div>
          )}

          {!result && !asking && !error && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No answer yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Upload a document or an image on the left, pick a mode, and
                ask. The answer will list the exact pages and images it came
                from.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

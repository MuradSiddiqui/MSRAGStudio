"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download, FileDown, Clock } from "lucide-react";
import { sourceLocation, type AskResult, type Mode } from "@/lib/api";
import { MODES, MODE_THEMES } from "@/lib/theme";
import SourceChip from "./SourceChip";

interface Props {
  result: AskResult;
  question: string;
  elapsedMs?: number;
  onDownload: () => void;
  onCopy: (what: "answer" | "report") => Promise<void>;
  onAskInMode: (mode: Mode) => void;
}

const CITE_PREFIX = "#cite:";
// [file.pdf · p.3] not already followed by "(" (i.e. not an existing Markdown link).
const CITATION_RE = /\[([^[\]\n]+? · [^[\]\n]+?)\](?!\()/g;

function linkCitations(text: string) {
  return text.replace(
    CITATION_RE,
    (_, label: string) =>
      `[${label}](${CITE_PREFIX}${encodeURIComponent(label).replace(/\(/g, "%28").replace(/\)/g, "%29")})`
  );
}

/** Finds the source row a citation label like "plan.png · image" refers to. */
function matchSource(label: string, result: AskResult): number {
  const first = label.split(/[;,]\s*(?=[^·]+ · )/)[0];
  const [file, where] = first.split(" · ").map((s) => s.trim());
  const exact = result.sources.findIndex(
    (s) => s.source === file && sourceLocation(s) === where
  );
  if (exact !== -1) return exact;
  return result.sources.findIndex((s) => s.source === file);
}

export default function AnswerPanel({
  result,
  question,
  elapsedMs,
  onDownload,
  onCopy,
  onAskInMode,
}: Props) {
  const theme = MODE_THEMES[result.mode];
  const coverage = result.coverage;
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [highlight, setHighlight] = useState<number | null>(null);
  const [copied, setCopied] = useState<"answer" | "report" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setOpen(new Set());
    setHighlight(null);
    setShowAll(false);
  }, [result]);

  useEffect(() => {
    if (highlight === null) return;
    const t = setTimeout(() => setHighlight(null), 1800);
    return () => clearTimeout(t);
  }, [highlight]);

  const markdown = useMemo(() => linkCitations(result.answer), [result.answer]);
  const visibleSources = showAll ? result.sources : result.sources.slice(0, 6);
  const uniqueFiles = new Set(result.sources.map((s) => s.source)).size;

  const focusSource = useCallback(
    (label: string) => {
      const idx = matchSource(label, result);
      if (idx === -1) return;
      if (idx >= 6) setShowAll(true);
      setOpen((prev) => new Set(prev).add(idx));
      setHighlight(idx);
      requestAnimationFrame(() =>
        rowRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    },
    [result]
  );

  const copy = async (what: "answer" | "report") => {
    await onCopy(what);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="card animate-fade-up overflow-hidden" aria-label="Answer">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium ${theme.softBg} ${theme.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
          {theme.short}
        </span>
        <span className="font-mono text-[11px] text-faint">
          {result.sources.length} passage{result.sources.length === 1 ? "" : "s"} · {uniqueFiles} file
          {uniqueFiles === 1 ? "" : "s"}
          {result.scoped_to && result.scoped_to.length > 0
            ? ` · scoped to ${result.scoped_to.length}`
            : ""}
        </span>
        {elapsedMs !== undefined && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-faint">
            <Clock className="h-3 w-3" /> {(elapsedMs / 1000).toFixed(1)}s
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => copy("answer")} className="btn-quiet py-1.5 text-xs">
            {copied === "answer" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "answer" ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={() => copy("report")} className="btn-quiet py-1.5 text-xs">
            {copied === "report" ? <Check className="h-3.5 w-3.5" /> : <FileDown className="h-3.5 w-3.5" />}
            {copied === "report" ? "Copied" : "Copy report"}
          </button>
          <button type="button" onClick={onDownload} className="btn-ghost py-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> .md
          </button>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <h2 className="font-display text-xl font-semibold tracking-tight">{question}</h2>
        <div className="prose-answer mt-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith(CITE_PREFIX)) {
                  const label = decodeURIComponent(href.slice(CITE_PREFIX.length));
                  return (
                    <button
                      type="button"
                      onClick={() => focusSource(label)}
                      className="cite mx-0.5 inline-flex max-w-full items-center rounded-md border border-line bg-raised px-1.5 align-baseline font-mono text-[11px] leading-5 text-muted transition-colors hover:border-faint hover:text-ink"
                      title="Show the passage"
                    >
                      <span className="truncate">{children}</span>
                    </button>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>

      {coverage && (
        <div className="border-t border-line px-5 py-6 sm:px-7">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-base font-semibold">Coverage report</h3>
            <p className="text-xs text-muted">Checked the whole index, not just the top matches</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              [coverage.sub_questions.length, "plan steps"],
              [coverage.chunks_considered, "chunks read"],
              [coverage.unique_sources, "sources"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-raised px-3 py-3">
                <p className="font-display text-2xl font-semibold">{value}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
              </div>
            ))}
          </div>
          <ol className="mt-4 divide-y divide-line rounded-xl border border-line">
            {coverage.sub_questions.map((step, i) => (
              <li key={i} className="flex items-baseline gap-3 px-3.5 py-2.5 text-sm">
                <span className={`font-mono text-xs ${theme.text}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{step.sub_question}</span>
                <span
                  className={`shrink-0 font-mono text-[11px] ${step.found === 0 ? "text-danger" : "text-muted"}`}
                >
                  {step.found} found
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="border-t border-line px-5 py-6 sm:px-7">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Sources</h3>
            <button
              type="button"
              onClick={() =>
                setOpen((prev) =>
                  prev.size > 0 ? new Set() : new Set(visibleSources.map((_, i) => i))
                )
              }
              className="text-xs text-muted hover:text-ink"
            >
              {open.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {visibleSources.map((hit, i) => (
              <SourceChip
                key={`${hit.source}-${hit.page ?? "img"}-${hit.chunk ?? i}-${i}`}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                hit={hit}
                index={i}
                theme={theme}
                open={open.has(i)}
                highlighted={highlight === i}
                onToggle={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              />
            ))}
          </div>
          {result.sources.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-sm text-muted hover:text-ink"
            >
              {showAll ? "Show fewer" : `Show all ${result.sources.length} sources`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/50 px-5 py-3 sm:px-7">
        <span className="text-xs text-muted">Compare with</span>
        {MODES.filter((m) => m !== result.mode).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onAskInMode(m)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:bg-raised"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${MODE_THEMES[m].dot}`} />
            {MODE_THEMES[m].short}
          </button>
        ))}
      </div>
    </section>
  );
}

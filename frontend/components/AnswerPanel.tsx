"use client";

import type { AskResult } from "@/lib/api";
import { MODE_THEMES } from "@/lib/theme";
import SourceChip from "./SourceChip";

interface Props {
  result: AskResult;
  question: string;
  onDownload: () => void;
  onCopy: () => void;
  downloading: boolean;
  copied: boolean;
}

/** Renders the answer text, styling inline citations like [file.pdf · p.3]. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]+ · [^\]\n]+\])/g);
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
      {parts.map((part, i) =>
        part.startsWith("[") && part.includes(" · ") ? (
          <span
            key={i}
            className="mx-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 align-baseline text-[13px] font-medium text-slate-600"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

export default function AnswerPanel({
  result,
  question,
  onDownload,
  onCopy,
  downloading,
  copied,
}: Props) {
  const theme = MODE_THEMES[result.mode];
  const coverage = result.coverage;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.chip} border`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
          {theme.label}
        </span>
        <span className="text-xs text-slate-400">
          {result.sources.length} source{result.sources.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {copied ? "Copied" : "Copy report"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${theme.button}`}
          >
            {downloading ? "Preparing..." : "Download report (.md)"}
          </button>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-medium text-slate-500">{question}</h3>
      <div className="mt-2">
        <AnswerText text={result.answer} />
      </div>

      {coverage && (
        <div className={`mt-5 rounded-xl border ${theme.border} ${theme.softBg} p-4`}>
          <h4 className={`text-sm font-semibold ${theme.text}`}>
            Coverage report
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            Agentic mode checked the whole index before answering, not only
            the top matches.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-white px-2 py-3">
              <p className="text-xl font-semibold text-slate-900">
                {coverage.sub_questions.length}
              </p>
              <p className="text-xs text-slate-500">Plan steps</p>
            </div>
            <div className="rounded-lg bg-white px-2 py-3">
              <p className="text-xl font-semibold text-slate-900">
                {coverage.chunks_considered}
              </p>
              <p className="text-xs text-slate-500">Chunks considered</p>
            </div>
            <div className="rounded-lg bg-white px-2 py-3">
              <p className="text-xl font-semibold text-slate-900">
                {coverage.unique_sources}
              </p>
              <p className="text-xs text-slate-500">Unique sources</p>
            </div>
          </div>
          <ol className="mt-3 space-y-1.5">
            {coverage.sub_questions.map((step, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 rounded-lg bg-white px-3 py-2 text-sm"
              >
                <span className={`font-semibold ${theme.text}`}>{i + 1}.</span>
                <span className="flex-1 text-slate-700">{step.sub_question}</span>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {step.found} found
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-700">Sources</h4>
          <div className="mt-2 space-y-2">
            {result.sources.map((hit, i) => (
              <SourceChip
                key={`${hit.source}-${hit.page ?? "img"}-${hit.chunk ?? i}-${i}`}
                hit={hit}
                index={i}
                theme={theme}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

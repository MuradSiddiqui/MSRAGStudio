"use client";

import { useState } from "react";
import type { SourceHit } from "@/lib/api";
import type { ModeTheme } from "@/lib/theme";

interface Props {
  hit: SourceHit;
  index: number;
  theme: ModeTheme;
}

/**
 * Citation chip for one retrieved chunk. Collapsed it shows the source file,
 * page (or image marker) and match score; expanded it shows the passage text
 * the answer drew from.
 */
export default function SourceChip({ hit, index, theme }: Props) {
  const [open, setOpen] = useState(false);
  const isImage = hit.kind === "image";
  const location = isImage ? "image" : `p.${hit.page ?? "-"}`;
  const score = Math.round((hit.score ?? 0) * 100);

  return (
    <div className={`rounded-lg border ${theme.border} bg-white`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold text-white ${theme.dot}`}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
          {hit.source}
          <span className="text-slate-400"> · {location}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-slate-500">
          {score}% match
        </span>
        <span className="shrink-0 text-xs text-slate-400">
          {open ? "Hide passage" : "Show passage"}
        </span>
      </button>
      {open && (
        <p className="border-t border-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-600">
          {hit.text}
        </p>
      )}
    </div>
  );
}

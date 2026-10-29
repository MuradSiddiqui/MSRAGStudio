"use client";

import { forwardRef } from "react";
import { ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import { sourceLocation, type SourceHit } from "@/lib/api";
import type { ModeTheme } from "@/lib/theme";

interface Props {
  hit: SourceHit;
  index: number;
  theme: ModeTheme;
  open: boolean;
  highlighted: boolean;
  onToggle: () => void;
}

/**
 * Citation row for one retrieved chunk. Collapsed it shows the source file,
 * page (or image marker) and match score; expanded it shows the passage text
 * the answer drew from.
 */
const SourceChip = forwardRef<HTMLDivElement, Props>(function SourceChip(
  { hit, index, theme, open, highlighted, onToggle },
  ref
) {
  const isImage = hit.kind === "image";
  const score = Math.max(0, Math.min(100, Math.round((hit.score ?? 0) * 100)));
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-300 ${
        highlighted ? `${theme.border} ring-4 ring-accent/40` : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-raised/50"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${theme.softBg} ${theme.text}`}
        >
          {index + 1}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{hit.source}</span>
          <span className="font-mono text-xs text-faint"> · {sourceLocation(hit)}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex" title={`${score}% similarity`}>
          <span className="h-1 w-14 overflow-hidden rounded-full bg-raised">
            <span className={`block h-full rounded-full ${theme.bar}`} style={{ width: `${score}%` }} />
          </span>
          <span className="w-8 text-right font-mono text-[11px] text-muted">{score}%</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="animate-fade-up whitespace-pre-wrap border-t border-line bg-canvas/60 px-4 py-3 text-sm leading-relaxed text-muted">
          {hit.text}
        </p>
      )}
    </div>
  );
});

export default SourceChip;

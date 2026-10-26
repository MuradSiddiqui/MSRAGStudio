import type { Mode } from "./api";

/**
 * Per-mode visual identity from the Figma design:
 * indigo is the product primary, violet marks Multimodal, emerald marks Agentic.
 * All class strings are complete literals so Tailwind picks them up.
 */
export interface ModeTheme {
  label: string;
  short: string;
  dot: string;
  text: string;
  softBg: string;
  border: string;
  tabActive: string;
  button: string;
  chip: string;
  focusRing: string;
}

export const MODES: Mode[] = ["basic", "multimodal", "agentic"];

export const MODE_THEMES: Record<Mode, ModeTheme> = {
  basic: {
    label: "Basic RAG",
    short: "Basic",
    dot: "bg-indigo-500",
    text: "text-indigo-600",
    softBg: "bg-indigo-50",
    border: "border-indigo-200",
    tabActive: "bg-indigo-600 text-white border-indigo-600",
    button:
      "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-800",
    focusRing: "focus:border-indigo-400 focus:ring-indigo-100",
  },
  multimodal: {
    label: "Multimodal RAG",
    short: "Multimodal",
    dot: "bg-violet-500",
    text: "text-violet-600",
    softBg: "bg-violet-50",
    border: "border-violet-200",
    tabActive: "bg-violet-600 text-white border-violet-600",
    button:
      "bg-violet-600 text-white hover:bg-violet-500 disabled:bg-violet-300",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
    focusRing: "focus:border-violet-400 focus:ring-violet-100",
  },
  agentic: {
    label: "Agentic RAG",
    short: "Agentic",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    softBg: "bg-emerald-50",
    border: "border-emerald-200",
    tabActive: "bg-emerald-600 text-white border-emerald-600",
    button:
      "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    focusRing: "focus:border-emerald-400 focus:ring-emerald-100",
  },
};

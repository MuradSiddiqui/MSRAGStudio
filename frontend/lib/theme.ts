import type { Mode } from "./api";

/**
 * Per-mode visual identity: orange for Basic, cyan for Multimodal, green for
 * Agentic, amber for STAIR.
 * Colours come from CSS variables in globals.css so they adapt to light and dark.
 * All class strings are complete literals so Tailwind picks them up.
 */
export interface ModeTheme {
  label: string;
  short: string;
  tagline: string;
  help: string;
  dot: string;
  text: string;
  softBg: string;
  border: string;
  ring: string;
  bar: string;
}

export const MODES: Mode[] = ["basic", "multimodal", "agentic", "stair"];

export const MODE_THEMES: Record<Mode, ModeTheme> = {
  basic: {
    label: "Basic RAG",
    short: "Basic",
    tagline: "Fast, cited answers",
    help: "Top matching passages from your text documents, answered with page citations.",
    dot: "bg-basic",
    text: "text-basic",
    softBg: "bg-basic/10",
    border: "border-basic/30",
    ring: "focus-within:border-basic/60 focus-within:ring-basic/15",
    bar: "bg-basic",
  },
  multimodal: {
    label: "Multimodal RAG",
    short: "Multimodal",
    tagline: "Text and images",
    help: "Text and images in one index. Image chunks are cited by file name, like [plan.png · image].",
    dot: "bg-multi",
    text: "text-multi",
    softBg: "bg-multi/10",
    border: "border-multi/30",
    ring: "focus-within:border-multi/60 focus-within:ring-multi/15",
    bar: "bg-multi",
  },
  agentic: {
    label: "Agentic RAG",
    short: "Agentic",
    tagline: "Plans, checks coverage",
    help: "Plans sub-questions, retrieves for each one, then reports coverage across the index. Best for list-all questions.",
    dot: "bg-agentic",
    text: "text-agentic",
    softBg: "bg-agentic/10",
    border: "border-agentic/30",
    ring: "focus-within:border-agentic/60 focus-within:ring-agentic/15",
    bar: "bg-agentic",
  },
  stair: {
    label: "STAIR",
    short: "STAIR",
    tagline: "Contents first, then the section",
    help: "Structure-aware retrieval, after IBM's STAIR: reads the documents' table of contents, opens the section that should hold the answer, and reads it in full. Citations name the section.",
    dot: "bg-stair",
    text: "text-stair",
    softBg: "bg-stair/10",
    border: "border-stair/30",
    ring: "focus-within:border-stair/60 focus-within:ring-stair/15",
    bar: "bg-stair",
  },
};

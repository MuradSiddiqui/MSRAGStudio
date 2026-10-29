import {
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  ScanSearch,
  Sparkles,
  Upload,
} from "lucide-react";

function UploadPreview() {
  return (
    <div className="space-y-2">
      {[
        { Icon: FileText, name: "building-code.pdf", meta: "14 chunks", tone: "bg-basic/10 text-basic", done: true },
        { Icon: ImageIcon, name: "floor-plan.png", meta: "reading image…", tone: "bg-multi/10 text-multi", done: false },
      ].map(({ Icon, name, meta, tone, done }) => (
        <div key={name} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{name}</span>
            {done ? (
              <span className="block font-mono text-[10px] text-faint">{meta}</span>
            ) : (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-raised">
                <span className="block h-full w-2/3 rounded-full bg-multi" />
              </span>
            )}
          </span>
          {done && <Check className="h-3.5 w-3.5 text-success" />}
        </div>
      ))}
    </div>
  );
}

function AskPreview() {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5">
      <div className="flex gap-1">
        {[
          ["Basic", "bg-basic"],
          ["Multimodal", "bg-multi"],
          ["Agentic", "bg-agentic"],
        ].map(([label, dot], i) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] ${
              i === 2 ? "bg-ink text-canvas" : "text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2">
        <span className="truncate text-[13px]">
          Which doors must be fire-rated?
          <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-ink" />
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-canvas">
          ↑
        </span>
      </div>
    </div>
  );
}

function VerifyPreview() {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[13px] leading-6">
        Doors between stairwells and corridors must be T30{" "}
        <span className="rounded-md border border-accent bg-accent/25 px-1.5 py-px font-mono text-[10px]">
          code.pdf · p.4
        </span>
      </p>
      <div className="mt-2 border-l-2 border-accent pl-2.5 text-[11px] leading-5 text-muted">
        “…the following doors must be fire-rated (T30 or higher): doors between a stairwell and any
        corridor…”
      </div>
    </div>
  );
}

function ExportPreview() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="relative flex h-14 w-11 shrink-0 flex-col justify-end gap-1 rounded-md border border-line bg-canvas p-1.5">
        <span className="absolute right-0 top-0 h-3 w-3 rounded-bl-md border-b border-l border-line bg-raised" />
        <span className="h-0.5 w-full rounded bg-line" />
        <span className="h-0.5 w-3/4 rounded bg-line" />
        <span className="h-0.5 w-full rounded bg-line" />
        <span className="font-mono text-[8px] font-semibold text-muted">.md</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">fire-rated-doors-agentic.md</p>
        <p className="font-mono text-[10px] text-faint">answer · 5 sources · coverage</p>
      </div>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink">
        <Download className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

const STEPS = [
  {
    Icon: Upload,
    title: "Upload",
    text: "Files are split into passages, embedded with BGE and stored in Qdrant. Images are described by a vision model first.",
    Preview: UploadPreview,
  },
  {
    Icon: Sparkles,
    title: "Ask",
    text: "Pick Basic, Multimodal or Agentic. Each mode reads the same index in a different way.",
    Preview: AskPreview,
  },
  {
    Icon: ScanSearch,
    title: "Verify",
    text: "Every claim carries a citation. Click it to read the exact passage behind the sentence.",
    Preview: VerifyPreview,
  },
  {
    Icon: Download,
    title: "Export",
    text: "Copy the answer or download a Markdown report with the mode, sources and coverage.",
    Preview: ExportPreview,
  },
];

// Dividers per cell: one column on mobile, 2×2 from sm up.
const CELL_DIVIDERS = [
  "dash-b sm:dash-r",
  "dash-b",
  "dash-b sm:dash-r sm:no-dash-b",
  "",
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-tight">
              From file to cited answer <span className="font-serif font-normal italic">in four steps.</span>
            </h2>
          </div>
          <p className="max-w-sm text-muted">
            One pipeline behind every mode: index once, ask in any mode, and check each claim
            against its source.
          </p>
        </div>

        <ol className="relative mt-14 grid sm:grid-cols-2">
          {/* Marker where the dotted dividers cross */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent ring-1 ring-line sm:block"
          />
          {STEPS.map(({ Icon, title, text, Preview }, i) => (
            <li
              key={title}
              className={`group relative flex flex-col gap-6 py-10 ${
                i % 2 === 0 ? "sm:pr-10" : "sm:pl-10"
              } ${CELL_DIVIDERS[i]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-canvas transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-canvas">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="font-display text-6xl font-semibold leading-none tracking-tighter text-transparent [-webkit-text-stroke:1px_rgb(var(--faint)/0.6)] transition-colors group-hover:[-webkit-text-stroke:1px_rgb(var(--ink))]">
                  0{i + 1}
                </span>
              </div>
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{text}</p>
              </div>
              <div className="mt-auto max-w-md transition-transform duration-300 group-hover:-translate-y-0.5">
                <Preview />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

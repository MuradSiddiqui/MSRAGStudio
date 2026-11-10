import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  ListChecks,
  ListTree,
  ScanSearch,
} from "lucide-react";
import HowItWorks from "@/components/HowItWorks";

const DEMO_HREF = `/studio?mode=agentic&q=${encodeURIComponent(
  "Which doors must be fire-rated?"
)}`;

const MODE_CARDS = [
  {
    mode: "basic" as const,
    index: "01",
    name: "Basic",
    dot: "bg-basic",
    text: "text-basic",
    Icon: FileText,
    description:
      "Fast answers from text documents. Upload PDFs, Word files or notes and ask in plain language.",
    points: ["Top passages, ranked by relevance", "Citations down to the page", "Manuals, specs and reports"],
  },
  {
    mode: "multimodal" as const,
    index: "02",
    name: "Multimodal",
    dot: "bg-multi",
    text: "text-multi",
    Icon: ScanSearch,
    description:
      "Text and images in one index. A vision model reads plans, drawings and scans so you can ask about what is drawn.",
    points: ["Images cited as [plan.png · image]", "Floor plans, drawings, scans", "Same cited answer format"],
  },
  {
    mode: "agentic" as const,
    index: "03",
    name: "Agentic",
    dot: "bg-agentic",
    text: "text-agentic",
    Icon: ListChecks,
    description:
      "For questions where missing one item means a wrong answer. Plans sub-questions, retrieves for each, then reports coverage.",
    points: ["Plan steps with hit counts", "Coverage across the whole index", "Built for list-all questions"],
  },
  {
    mode: "stair" as const,
    index: "04",
    name: "STAIR",
    dot: "bg-stair",
    text: "text-stair",
    Icon: ListTree,
    description:
      "Structure-aware retrieval, after IBM's STAIR. Reads the table of contents first, opens the section that should hold the answer, and reads it in full.",
    points: ["Table-of-contents navigation", "Whole sections, not top-k samples", "Citations carry the section name"],
  },
];

const STACK = [
  { name: "Next.js", role: "Studio UI" },
  { name: "FastAPI", role: "Upload, ask, report API" },
  { name: "Qdrant", role: "Vector search" },
  { name: "STAIR", role: "Structure-aware section retrieval" },
  { name: "Groq", role: "gpt-oss-120b answers, gpt-oss-20b planning" },
  { name: "Gemini / Llama 4", role: "Image understanding" },
  { name: "BGE small", role: "Local embeddings" },
  { name: "n8n", role: "Ingestion and scheduled re-indexing" },
];

function Cite({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-md border border-line bg-raised px-1.5 py-px align-baseline font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
          <Link
            href="/studio"
            className="group inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs text-muted hover:text-ink"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-ink">
              New
            </span>
            Agentic mode now reports coverage
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-6 max-w-4xl animate-fade-up font-display text-[clamp(2.6rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.035em] [animation-delay:60ms]">
            Answers you can{" "}
            <span className="font-serif font-normal italic tracking-normal">trace back</span>{" "}
            to the page.
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted [animation-delay:120ms]">
            Drop in PDFs, Word files and drawings. Ask in plain language. Every sentence in
            the answer points to the exact page or image it came from.
          </p>
          <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:180ms]">
            <Link href="/studio" className="btn-primary px-5 py-2.5">
              Open the Studio <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href={DEMO_HREF} className="btn-ghost px-5 py-2.5">
              Try the fire-door demo
            </Link>
          </div>

          {/* Product preview */}
          <div className="mt-16 animate-fade-up [animation-delay:260ms]">
            <div className="card overflow-hidden shadow-[0_30px_80px_-40px_rgb(0_0_0/0.35)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="ml-3 font-mono text-[11px] text-faint">studio / agentic</span>
              </div>
              <div className="grid lg:grid-cols-[260px_1fr]">
                <div className="hidden space-y-2 border-r border-line p-4 lg:block">
                  <p className="eyebrow mb-3">Library</p>
                  {[
                    { name: "Building code excerpt.pdf", meta: "14 chunks", Icon: FileText },
                    { name: "Ground floor plan.png", meta: "image", Icon: ImageIcon },
                    { name: "Door schedule.docx", meta: "6 chunks", Icon: FileText },
                  ].map(({ name, meta, Icon }) => (
                    <div key={name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
                      <span className="font-mono text-[10px] text-faint">{meta}</span>
                    </div>
                  ))}
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-agentic/10 px-2.5 py-1 font-mono text-[11px] font-medium text-agentic">
                      <span className="h-1.5 w-1.5 rounded-full bg-agentic" /> Agentic
                    </span>
                    <span className="font-mono text-[11px] text-faint">4.2s · 3 sources</span>
                  </div>
                  <p className="mt-4 font-display text-xl font-semibold tracking-tight">
                    Which doors must be fire-rated?
                  </p>
                  <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink/90">
                    Fire-rated doors (T30 or higher) are required between stairwells and
                    corridors <Cite>Building code excerpt.pdf · p.4</Cite>, at basement and
                    garage access points, and for the plant room shown on the ground floor{" "}
                    <Cite>Ground floor plan.png · image</Cite>.
                  </p>
                  <div className="mt-5 grid max-w-lg grid-cols-3 gap-2">
                    {[
                      ["4", "plan steps"],
                      ["23", "chunks read"],
                      ["3", "sources"],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-xl bg-raised px-3 py-2.5">
                        <p className="font-display text-xl font-semibold">{value}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Four modes, one index</p>
              <h2 className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-tight">
                Pick the mode that fits <span className="font-serif font-normal italic">the question.</span>
              </h2>
            </div>
            <p className="max-w-sm text-muted">
              All four search the same uploaded files. They differ in how much of the
              index they read before they answer.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
            {MODE_CARDS.map(({ mode, index, name, dot, text, Icon, description, points }) => (
              <Link
                key={mode}
                href={`/studio?mode=${mode}`}
                className="group flex flex-col bg-surface p-6 transition-colors hover:bg-raised/60 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-faint">{index}</span>
                  <Icon className={`h-5 w-5 ${text}`} strokeWidth={1.75} />
                </div>
                <h3 className="mt-10 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {name}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>
                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                  {points.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${dot}`} />
                      {point}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-medium">
                  Try {name}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Demo walkthrough */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Example</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              A building code and a floor plan, <span className="font-serif font-normal italic">read together.</span>
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              The rules sit in a code document, but half the answer is drawn in a plan.
              Upload both: the code says which door types need a fire rating, and the
              plan shows where those doors actually are.
            </p>
            <p className="mt-3 leading-relaxed text-muted">
              Agentic mode splits the question into one sub-question per door category
              and reports how much of the index it covered, so a missing door shows up
              as a gap instead of a silent omission.
            </p>
            <Link href={DEMO_HREF} className="btn-primary mt-7 px-5 py-2.5">
              Open this demo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { Icon: FileText, name: "Building code excerpt.pdf", meta: "Indexed as passages with page numbers", tone: "text-basic bg-basic/10" },
              { Icon: ImageIcon, name: "Ground floor plan.png", meta: "Read by the vision model, indexed as a description", tone: "text-multi bg-multi/10" },
            ].map(({ Icon, name, meta, tone }) => (
              <div key={name} className="card flex items-center gap-4 px-4 py-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted">{meta}</p>
                </div>
              </div>
            ))}
            <div className="card px-4 py-4">
              <p className="eyebrow">Question</p>
              <p className="mt-2 font-display text-lg font-semibold">Which doors must be fire-rated?</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stack + CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Under the hood</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {STACK.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-baseline gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted">{item.role}</span>
              </span>
            ))}
          </div>

          <div className="relative mt-16 overflow-hidden rounded-3xl bg-ink px-6 py-14 text-canvas sm:px-12">
            <div
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative max-w-2xl">
              <h3 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Bring your own <span className="font-serif font-normal italic">documents.</span>
              </h3>
              <p className="mt-4 max-w-lg text-canvas/70">
                Upload a spec, a plan or a folder of reports and start asking. Answers stay
                tied to their sources, so you can verify before you use them.
              </p>
              <Link href="/studio" className="btn-accent mt-8 px-5 py-2.5">
                Open the Studio <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

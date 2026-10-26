import Link from "next/link";

const DEMO_HREF = `/studio?mode=agentic&q=${encodeURIComponent(
  "Which doors must be fire-rated?"
)}`;

const MODE_CARDS = [
  {
    mode: "basic" as const,
    name: "Basic RAG",
    accent: "indigo",
    dot: "bg-indigo-500",
    titleText: "text-indigo-600",
    ring: "hover:border-indigo-300",
    description:
      "Fast answers from text documents. Upload PDFs, Word documents or text files and ask in plain language.",
    points: [
      "Top matching passages, ranked by relevance",
      "Citations down to the page",
      "Fits manuals, specifications and reports",
    ],
  },
  {
    mode: "multimodal" as const,
    name: "Multimodal RAG",
    accent: "violet",
    dot: "bg-violet-500",
    titleText: "text-violet-600",
    ring: "hover:border-violet-300",
    description:
      "Text and images in one index. A vision model reads plans, drawings and scans, so you can ask about what is drawn, not only what is written.",
    points: [
      "Images cited by file, like [plan.png · image]",
      "Floor plans, drawings and scanned pages",
      "Same cited answer format as text mode",
    ],
  },
  {
    mode: "agentic" as const,
    name: "Agentic RAG",
    accent: "emerald",
    dot: "bg-emerald-500",
    titleText: "text-emerald-600",
    ring: "hover:border-emerald-300",
    description:
      "For questions where missing one item means a wrong answer. The agent plans sub-questions, retrieves for each, then checks coverage before replying.",
    points: [
      "Plan steps shown with hit counts",
      "Coverage report over the whole index",
      "Built for list-all questions",
    ],
  },
];

const STEPS = [
  {
    title: "1. Upload",
    text: "Documents are split into passages, embedded with BGE and stored in Qdrant. Images go through a vision model first and are indexed as descriptions.",
  },
  {
    title: "2. Ask",
    text: "Pick Basic, Multimodal or Agentic mode and ask in plain language. Each mode searches the same index in a different way.",
  },
  {
    title: "3. Check the sources",
    text: "Every answer lists the files and pages it came from. Expand any source to read the exact passage behind the claim.",
  },
  {
    title: "4. Take the report",
    text: "Download the answer as a Markdown report, or copy it, with the question, mode, sources and coverage included.",
  },
];

const STACK = [
  { name: "Next.js", role: "Frontend and Studio UI" },
  { name: "FastAPI", role: "Upload, ask and report API" },
  { name: "Qdrant", role: "Vector search over chunks" },
  { name: "Groq", role: "Answers (gpt-oss-120b), planning (gpt-oss-20b), vision (Llama 4 Scout)" },
  { name: "BGE embeddings", role: "bge-small-en-v1.5, run locally" },
  { name: "n8n", role: "Orchestration: ingestion workflows, scheduled re-indexing, report delivery" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Three retrieval modes, one workspace
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Ask your documents anything. Check every answer.
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-slate-600">
              MS RAG Studio reads your PDFs, documents and images, answers in
              plain language, and shows the exact page or image behind every
              claim. For list-all questions, Agentic mode checks the whole
              index instead of stopping at the top few matches.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Open the Studio
              </Link>
              <a
                href="#how-it-works"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                How it works
              </a>
            </div>
          </div>

          {/* Static preview of a Studio answer */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Demo answer
            </p>
            <p className="mt-2 text-sm font-medium text-slate-800">
              Which doors must be fire-rated?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Based on the code excerpt and the ground floor plan, the
              stairwell doors, the corridor doors on both floors and the plant
              room door must be fire-rated.{" "}
              <span className="rounded bg-white px-1.5 py-0.5 text-[13px] font-medium text-slate-500 ring-1 ring-slate-200">
                [Building code excerpt.pdf · p.4]
              </span>{" "}
              <span className="rounded bg-white px-1.5 py-0.5 text-[13px] font-medium text-slate-500 ring-1 ring-slate-200">
                [Ground floor plan.png · image]
              </span>
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              Coverage: 4 plan steps, 23 chunks considered, 2 sources. Nothing
              in the index was skipped.
            </div>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Pick the mode that fits the question
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          All three modes search the same uploaded files. They differ in how
          much of the index they read before answering.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {MODE_CARDS.map((card) => (
            <Link
              key={card.mode}
              href={`/studio?mode=${card.mode}`}
              className={`group rounded-2xl border border-slate-200 bg-white p-5 transition-colors ${card.ring}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${card.dot} block`} />
              <h3 className={`mt-3 text-lg font-semibold ${card.titleText}`}>
                {card.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {card.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {card.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-slate-400">·</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-block text-sm font-medium text-slate-700 group-hover:underline">
                Try {card.name} in the Studio
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo walkthrough */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Example: building code plus a floor plan
            </h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              A common case in architecture work: the rules sit in a code
              document, but half the answer is drawn in a plan. Upload both,
              and the studio reads them together. The code excerpt says which
              door types need a fire rating; the plan shows where those doors
              actually are.
            </p>
            <p className="mt-3 leading-relaxed text-slate-600">
              Agentic mode splits the question into sub-questions, one per
              door category, retrieves for each, and then reports how much of
              the index it covered, so a missing door is visible as a gap in
              coverage rather than a silent omission.
            </p>
            <Link
              href={DEMO_HREF}
              className="mt-5 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Open this demo in the Studio
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-[10px] font-bold text-white">
                DOC
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Building code excerpt.pdf
                </p>
                <p className="text-xs text-slate-500">
                  Text document, indexed as passages with page numbers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500 text-[10px] font-bold text-white">
                IMG
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Ground floor plan.png
                </p>
                <p className="text-xs text-slate-500">
                  Image, read by the vision model and indexed as a description
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Question
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                Which doors must be fire-rated?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Tech stack</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {item.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{item.role}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-indigo-600 px-6 py-8 text-center">
            <h3 className="text-xl font-semibold text-white">
              Bring your own documents
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-indigo-100">
              Upload a specification, a plan, or a folder of reports and start
              asking. Answers stay tied to the sources, so you can verify them
              before you use them.
            </p>
            <Link
              href="/studio"
              className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Open the Studio
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

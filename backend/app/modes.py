"""The four retrieval modes.

basic      - top-k vector search over text chunks only, cited answer.
multimodal - same index, but image chunks (vision descriptions) are included and
             cited by file + region text.
agentic    - multi-step: plan -> retrieve per sub-question -> completeness check
             against the whole index -> final answer with a coverage report.
stair      - structure-aware (after IBM's STAIR): the model first reads the
             documents' table of contents, picks the leaf sections that should
             hold the answer, then reads those sections in full instead of a
             top-k sample. Falls back to vector search when the scoped
             documents carry no structure (indexed before it existed).

Optional `sources` limits every retrieve step to those filenames.
"""
from . import embeddings, llm, store

MAX_SUB_QUESTIONS = 6


def _retrieve(
    question: str,
    limit: int = 8,
    kind: str | None = None,
    sources: list[str] | None = None,
) -> list[dict]:
    vector = embeddings.embed_query(question)
    store.ensure_collection(len(vector))
    return store.search(vector, limit=limit, kind=kind, sources=sources)


def basic(question: str, sources: list[str] | None = None) -> dict:
    hits = _retrieve(question, kind="text", sources=sources)
    answer = llm.answer_with_citations(question, hits)
    return {"mode": "basic", "answer": answer, "sources": hits, "scoped_to": sources or []}


def multimodal(question: str, sources: list[str] | None = None) -> dict:
    hits = _retrieve(question, limit=10, sources=sources)
    answer = llm.answer_with_citations(
        question,
        hits,
        mode_note="Some context comes from images; cite those as [image.png · image].",
    )
    return {"mode": "multimodal", "answer": answer, "sources": hits, "scoped_to": sources or []}


def _plan(question: str) -> list[str]:
    plan_raw = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "Break the user's question into sub-questions that together cover it "
                    "COMPLETELY (for 'list all' questions, one sub-question per category). "
                    f"Use at most {MAX_SUB_QUESTIONS} sub-questions. "
                    'Reply with JSON: {"sub_questions": ["...", "..."]}'
                ),
            },
            {"role": "user", "content": question},
        ],
        model=llm.settings.groq_fast_model,
        json_mode=True,
    )
    subs = llm.parse_json(plan_raw).get("sub_questions")
    if not isinstance(subs, list):
        subs = []
    subs = [s.strip() for s in subs if isinstance(s, str) and s.strip()]
    return subs[:MAX_SUB_QUESTIONS] or [question]


def agentic(question: str, sources: list[str] | None = None) -> dict:
    sub_questions = _plan(question)
    all_hits: dict[tuple, dict] = {}
    per_sub = []
    for sub in sub_questions:
        hits = _retrieve(sub, limit=8, sources=sources)
        for h in hits:
            key = (h.get("source"), h.get("page"), h.get("chunk"))
            if key not in all_hits or h["score"] > all_hits[key]["score"]:
                all_hits[key] = h
        per_sub.append({"sub_question": sub, "found": len(hits)})
    contexts = sorted(all_hits.values(), key=lambda h: h["score"], reverse=True)
    answer = llm.answer_with_citations(
        question,
        contexts,
        mode_note=(
            "The user needs a COMPLETE answer. Enumerate every matching item you can "
            "find in the context, grouped clearly. Do not stop at the first few."
        ),
    )
    coverage = {
        "sub_questions": per_sub,
        "unique_sources": len({h["source"] for h in contexts}),
        "chunks_considered": len(contexts),
    }
    return {
        "mode": "agentic",
        "answer": answer,
        "sources": contexts,
        "coverage": coverage,
        "scoped_to": sources or [],
    }


MAX_STAIR_SECTIONS = 3
MAX_STAIR_CHUNKS = 32


def _navigate(question: str, toc: list[dict]) -> tuple[list[int], str]:
    """Ask the fast model which ToC entries should hold the answer.

    Returns (chosen toc indices, one-line reason). Empty choice on any
    parse problem, so the caller can fall back to vector search.
    """
    listing = "\n".join(
        f"{i}. [{e['source']}] {e['section_path']} "
        f"({e['chunks']} chunks, pages {e['page_from']}-{e['page_to']})"
        for i, e in enumerate(toc)
    )
    raw = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "You navigate a document library by its table of contents. "
                    "Given a question and the contents list, pick the sections "
                    "that should contain the answer: prefer the deepest (leaf) "
                    f"sections, at most {MAX_STAIR_SECTIONS}. "
                    'Reply with JSON: {"sections": [0, 2], "reason": "one short line"}'
                ),
            },
            {
                "role": "user",
                "content": f"Table of contents:\n{listing}\n\nQuestion: {question}",
            },
        ],
        model=llm.settings.groq_fast_model,
        json_mode=True,
    )
    parsed = llm.parse_json(raw)
    picks = parsed.get("sections")
    if not isinstance(picks, list):
        return [], ""
    chosen = [
        p
        for p in picks
        if isinstance(p, int) and 0 <= p < len(toc)
    ][:MAX_STAIR_SECTIONS]
    reason = parsed.get("reason")
    return chosen, reason.strip() if isinstance(reason, str) else ""


def stair(question: str, sources: list[str] | None = None) -> dict:
    toc = store.list_sections(sources)
    if not toc:
        # No structure in scope (documents indexed before STAIR, or plain
        # text without headings): answer by vector search, but say so in
        # the structure report instead of pretending to navigate.
        hits = _retrieve(question, limit=10, sources=sources)
        answer = llm.answer_with_citations(question, hits)
        return {
            "mode": "stair",
            "answer": answer,
            "sources": hits,
            "structure": {
                "navigated": False,
                "reason": "No table of contents in the selected documents yet; "
                "answered by vector search. Re-upload a document to index its structure.",
                "toc_sections": 0,
                "chosen": [],
            },
            "scoped_to": sources or [],
        }
    picks, reason = _navigate(question, toc)
    if not picks:
        picks = list(range(min(1, len(toc))))
        reason = reason or "Navigation was inconclusive; opened the first matching section."
    contexts: list[dict] = []
    chosen_meta = []
    seen: set[tuple] = set()
    for p in picks:
        entry = toc[p]
        chunks = store.fetch_section_chunks(entry["source"], entry["section_path"])
        added = 0
        for c in chunks:
            key = (c.get("source"), c.get("page"), c.get("chunk"))
            if key in seen:
                continue
            seen.add(key)
            contexts.append(c)
            added += 1
        chosen_meta.append(
            {
                "source": entry["source"],
                "section": entry["section"],
                "section_path": entry["section_path"],
                "chunks": added,
            }
        )
    # A small vector top-up catches relevant passages outside the chosen
    # sections (cross-references, definitions) without diluting the
    # section-first reading.
    for h in _retrieve(question, limit=4, sources=sources):
        key = (h.get("source"), h.get("page"), h.get("chunk"))
        if key not in seen:
            seen.add(key)
            contexts.append(h)
    contexts = contexts[:MAX_STAIR_CHUNKS]
    answer = llm.answer_with_citations(
        question,
        contexts,
        mode_note=(
            "The context is the full text of the document section(s) the table of "
            "contents points to for this question, so enumerate matching items "
            "completely instead of sampling. Citations include the section, like "
            "[file.pdf · §4.2 Doors · p.3]."
        ),
    )
    return {
        "mode": "stair",
        "answer": answer,
        "sources": contexts,
        "structure": {
            "navigated": True,
            "reason": reason,
            "toc_sections": len(toc),
            "chosen": chosen_meta,
        },
        "scoped_to": sources or [],
    }

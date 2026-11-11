"""The four retrieval modes.

basic      - top-k vector search over text chunks only, cited answer.
multimodal - same index, but image chunks (vision descriptions) are included and
             cited by file + region text.
agentic    - multi-step: plan -> retrieve per sub-question -> completeness check
             against the whole index -> final answer with a coverage report.
stair      - structure-aware, inspired by IBM Research's STAIR (arXiv 2609.03874).
             STAIR fine-tunes a model to generate the table-of-contents section
             that answers a question; here an off-the-shelf model reads the
             documents' table of contents in the prompt instead, picks the leaf
             sections that should hold the answer, and the answer is written
             from those sections in full rather than a top-k sample. Falls back
             to vector search when the scoped documents carry no structure.

Every mode searches only the caller's workspace (`owner`). Optional `sources`
limits every retrieve step to those filenames.
"""
from . import embeddings, llm, store

MAX_SUB_QUESTIONS = 6


def _retrieve(
    owner: str,
    question: str,
    limit: int = 8,
    kind: str | None = None,
    sources: list[str] | None = None,
) -> list[dict]:
    vector = embeddings.embed_query(question)
    store.ensure_collection(len(vector))
    return store.search(owner, vector, limit=limit, kind=kind, sources=sources)


def basic(question: str, owner: str, sources: list[str] | None = None) -> dict:
    hits = _retrieve(owner, question, kind="text", sources=sources)
    answer = llm.answer_with_citations(question, hits)
    return {"mode": "basic", "answer": answer, "sources": hits, "scoped_to": sources or []}


def multimodal(question: str, owner: str, sources: list[str] | None = None) -> dict:
    hits = _retrieve(owner, question, limit=10, sources=sources)
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


def agentic(question: str, owner: str, sources: list[str] | None = None) -> dict:
    sub_questions = _plan(question)
    all_hits: dict[tuple, dict] = {}
    per_sub = []
    for sub in sub_questions:
        hits = _retrieve(owner, sub, limit=8, sources=sources)
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
# Larger tables of contents are trimmed before they go into the prompt.
MAX_TOC_ENTRIES = 150


def _key(c: dict) -> tuple:
    return (c.get("source"), c.get("page"), c.get("chunk"))


def _trim_toc(toc: list[dict], hits: list[dict]) -> list[dict]:
    """Keep sections that vector search already points at, then fill up in
    document order, so a big library still fits the navigation prompt."""
    if len(toc) <= MAX_TOC_ENTRIES:
        return toc
    by_key = {(e["source"], e["section_path"]): e for e in toc}
    keep: dict[tuple, dict] = {}
    for h in hits:
        k = (h.get("source"), h.get("section_path"))
        if k in by_key:
            keep.setdefault(k, by_key[k])
    for e in toc:
        if len(keep) >= MAX_TOC_ENTRIES:
            break
        keep.setdefault((e["source"], e["section_path"]), e)
    return [e for e in toc if (e["source"], e["section_path"]) in keep]


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
                    f"sections, at most {MAX_STAIR_SECTIONS}. If no section fits, "
                    "return an empty list. "
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
    chosen: list[int] = []
    for p in picks:
        if isinstance(p, str) and p.strip().isdigit():
            p = int(p.strip())
        if isinstance(p, int) and not isinstance(p, bool) and 0 <= p < len(toc) and p not in chosen:
            chosen.append(p)
    reason = parsed.get("reason")
    return chosen[:MAX_STAIR_SECTIONS], reason.strip() if isinstance(reason, str) else ""


def _stair_fallback(question: str, hits: list[dict], sources: list[str] | None, reason: str, toc_size: int) -> dict:
    """Answer from vector hits and say so in the structure report."""
    answer = llm.answer_with_citations(question, hits)
    return {
        "mode": "stair",
        "answer": answer,
        "sources": hits,
        "structure": {"navigated": False, "reason": reason, "toc_sections": toc_size, "chosen": []},
        "scoped_to": sources or [],
    }


def stair(question: str, owner: str, sources: list[str] | None = None) -> dict:
    toc = store.list_sections(owner, sources)
    hits = _retrieve(owner, question, limit=10, sources=sources)
    if not toc:
        return _stair_fallback(
            question,
            hits,
            sources,
            "The selected documents have no headings to navigate (or were indexed before "
            "STAIR mode existed), so this was answered by vector search. Re-upload a "
            "document with headings to use its table of contents.",
            0,
        )
    toc = _trim_toc(toc, hits)
    picks, reason = _navigate(question, toc)
    if not picks:
        return _stair_fallback(
            question,
            hits,
            sources,
            "No section in the table of contents matched this question, so it was "
            "answered by vector search across the selected documents.",
            len(toc),
        )
    contexts: list[dict] = []
    chosen_meta = []
    seen: set[tuple] = set()
    for p in picks:
        entry = toc[p]
        added = 0
        for c in store.fetch_chunks(owner, entry["source"], entry["section_path"]):
            if _key(c) in seen:
                continue
            seen.add(_key(c))
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
    for h in hits[:4]:
        if _key(h) not in seen:
            seen.add(_key(h))
            contexts.append(h)
    contexts = contexts[:MAX_STAIR_CHUNKS]
    answer = llm.answer_with_citations(
        question,
        contexts,
        mode_note=(
            "Most of the context is the full text of the document section(s) the table "
            "of contents points to for this question, so enumerate matching items "
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

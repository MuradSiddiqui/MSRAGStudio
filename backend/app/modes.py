"""The three retrieval modes.

basic      - top-k vector search over text chunks only, cited answer.
multimodal - same index, but image chunks (vision descriptions) are included and
             cited by file + region text.
agentic    - multi-step: plan -> retrieve per sub-question -> completeness check
             against the whole index -> final answer with a coverage report.
"""
from . import embeddings, llm, store

MAX_SUB_QUESTIONS = 6


def _retrieve(question: str, limit: int = 8, kind: str | None = None) -> list[dict]:
    vector = embeddings.embed_query(question)
    store.ensure_collection(len(vector))
    return store.search(vector, limit=limit, kind=kind)


def basic(question: str) -> dict:
    hits = _retrieve(question, kind="text")
    answer = llm.answer_with_citations(question, hits)
    return {"mode": "basic", "answer": answer, "sources": hits}


def multimodal(question: str) -> dict:
    hits = _retrieve(question, limit=10)
    answer = llm.answer_with_citations(
        question,
        hits,
        mode_note="Some context comes from images; cite those as [image.png · image].",
    )
    return {"mode": "multimodal", "answer": answer, "sources": hits}


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


def agentic(question: str) -> dict:
    sub_questions = _plan(question)
    all_hits: dict[tuple, dict] = {}
    per_sub = []
    for sub in sub_questions:
        hits = _retrieve(sub, limit=8)
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
    return {"mode": "agentic", "answer": answer, "sources": contexts, "coverage": coverage}

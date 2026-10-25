"""The three retrieval modes.

basic      - hybrid-style top-k vector search over text chunks, cited answer.
multimodal - same index, but image chunks (vision descriptions) are included and
             cited by file + region text.
agentic    - multi-step: plan -> retrieve per sub-question -> completeness check
             against the whole index -> final answer with a coverage report.
"""
from . import embeddings, llm, store


def _retrieve(question: str, limit: int = 8) -> list[dict]:
    return store.search(embeddings.embed_query(question), limit=limit)


def basic(question: str) -> dict:
    hits = _retrieve(question)
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


def agentic(question: str) -> dict:
    plan_raw = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "Break the user's question into sub-questions that together cover it "
                    "COMPLETELY (for 'list all' questions, one sub-question per category). "
                    'Reply with JSON: {"sub_questions": ["...", "..."]}'
                ),
            },
            {"role": "user", "content": question},
        ],
        model=llm.settings.groq_fast_model,
        json_mode=True,
    )
    sub_questions = llm.parse_json(plan_raw).get("sub_questions", [question])
    all_hits: dict[str, dict] = {}
    per_sub = []
    for sub in sub_questions:
        hits = _retrieve(sub, limit=8)
        for h in hits:
            all_hits[h["text"][:80]] = h
        per_sub.append({"sub_question": sub, "found": len(hits)})
    contexts = list(all_hits.values())
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

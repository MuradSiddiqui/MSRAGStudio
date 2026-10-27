"""Groq client: chat answers (gpt-oss-120b), fast tasks (gpt-oss-20b), vision (llama-4-scout)."""
import base64
import json

import httpx

from .config import settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}


def chat(messages: list[dict], model: str | None = None, json_mode: bool = False) -> str:
    body = {
        "model": model or settings.groq_chat_model,
        "messages": messages,
        "temperature": 0.2,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    with httpx.Client(timeout=120) as client:
        resp = client.post(GROQ_URL, headers=_headers(), json=body)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def _vision_provider() -> str:
    if settings.vision_provider != "auto":
        return settings.vision_provider
    return "gemini" if settings.gemini_api_key else "groq"


def _gemini_generate(model: str, data: str, mime: str, prompt: str) -> str:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime, "data": data}},
                ]
            }
        ],
        # Image description for indexing needs no reasoning; disabling
        # thinking keeps it fast (verified live 2026-10-28).
        "generationConfig": {"thinkingConfig": {"thinkingBudget": 0}},
    }
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            url, headers={"x-goog-api-key": settings.gemini_api_key}, json=body
        )
        resp.raise_for_status()
        parts = resp.json()["candidates"][0]["content"]["parts"]
        # Skip internal "thought" parts on Gemini 3 models; keep answer text only.
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def _describe_image_gemini(data: str, mime: str, prompt: str) -> str:
    """Vision description via Google Gemini.

    Groq's current catalogue for this account has no vision model at all
    (verified 2026-10-28 in the console and via the API), so image
    descriptions route to Gemini when its key is configured.

    Models come and go for new accounts (gemini-2.5-flash already returns
    404 for new users) and the newest Flash models intermittently return
    503 under load, so try the configured model first, then the fallback
    chain, and only fail when every model fails.
    """
    models = [settings.gemini_vision_model] + [
        m.strip()
        for m in settings.gemini_vision_fallbacks.split(",")
        if m.strip() and m.strip() != settings.gemini_vision_model
    ]
    last_error: Exception | None = None
    for model in models:
        try:
            return _gemini_generate(model, data, mime, prompt)
        except httpx.HTTPError as exc:
            # 404 (model closed to this account), 429/503 (load), timeouts,
            # and model-specific 400s (e.g. generationConfig support) all
            # mean: try the next model instead of failing the upload.
            last_error = exc
    raise RuntimeError(f"All Gemini vision models failed: {models}") from last_error


def describe_image(path: str, hint: str = "") -> str:
    """Vision description of an uploaded image so its content becomes searchable text."""
    data = base64.b64encode(open(path, "rb").read()).decode()
    ext = path.rsplit(".", 1)[-1].lower()
    mime = "image/png" if ext == "png" else "image/jpeg"
    prompt = (
        "Describe this image in detail for a search index: every visible object, label, "
        "dimension, number and text. List objects one per line as 'object: description'. "
        + hint
    )
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}},
            ],
        }
    ]
    if _vision_provider() == "gemini":
        return _describe_image_gemini(data, mime, prompt)
    return chat(messages, model=settings.groq_vision_model)


def answer_with_citations(question: str, contexts: list[dict], mode_note: str = "") -> str:
    context_text = "\n\n".join(
        f"[{c['source']} · p.{c.get('page', '-')}] {c['text']}" for c in contexts
    )
    system = (
        "You answer strictly from the provided context. Cite sources inline like "
        "[file.pdf · p.3]. If the context does not contain the answer, say so honestly. "
        + mode_note
    )
    return chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"},
        ]
    )


def parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        return json.loads(text[start : end + 1])

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration comes from environment / backend/.env (prefix MSRAG_)."""

    groq_api_key: str = ""
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    embed_model: str = "BAAI/bge-small-en-v1.5"
    collection: str = "msrag_chunks"
    groq_chat_model: str = "openai/gpt-oss-120b"
    groq_fast_model: str = "openai/gpt-oss-20b"
    groq_vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    gemini_api_key: str = ""
    # gemini-2.5-flash is closed to new users (verified 2026-10-28: API
    # returns 404 and names gemini-3.8-flash as its replacement).
    gemini_vision_model: str = "gemini-3.8-flash"
    gemini_vision_fallbacks: str = "gemini-3-flash-preview,gemini-flash-latest,gemini-3.5-flash"
    vision_provider: str = "auto"  # auto | groq | gemini
    # Top-hit cosine below this → API returns evidence: "low" (Alex 2026-11-19:
    # off-topic ~0.64 vs on-topic ~0.70, so this is a soft flag, not a cutoff).
    low_evidence_threshold: float = 0.68

    class Config:
        env_prefix = "MSRAG_"
        env_file = ".env"


settings = Settings()

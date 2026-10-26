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
    gemini_vision_model: str = "gemini-2.5-flash"
    vision_provider: str = "auto"  # auto | groq | gemini

    class Config:
        env_prefix = "MSRAG_"
        env_file = ".env"


settings = Settings()

"""Local BGE embeddings (sentence-transformers). Lazy-loaded singleton."""
from .config import settings

_model = None


def embed(texts: list[str]) -> list[list[float]]:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(settings.embed_model)
    vecs = _model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


def embed_query(text: str) -> list[float]:
    return embed([text])[0]

"""Local BGE embeddings (sentence-transformers). Lazy-loaded singleton."""
import threading

from .config import settings

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer

                _model = SentenceTransformer(settings.embed_model)
    return _model


def is_loaded() -> bool:
    return _model is not None


def warm_up() -> int:
    """Load the model ahead of the first request; returns the vector size."""
    return len(embed(["warm up"])[0])


def embed(texts: list[str]) -> list[list[float]]:
    vecs = _get_model().encode(texts, normalize_embeddings=True, batch_size=32)
    return [v.tolist() for v in vecs]


def embed_query(text: str) -> list[float]:
    # BGE v1.5 retrieves better when short queries carry its instruction prefix.
    if "bge" in settings.embed_model.lower() and "-en" in settings.embed_model.lower():
        text = "Represent this sentence for searching relevant passages: " + text
    return embed([text])[0]

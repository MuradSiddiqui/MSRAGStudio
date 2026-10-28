"""Qdrant vector store: one collection, payload carries source/page/region for citations."""
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from .config import settings

_client = None


def client() -> QdrantClient:
    global _client
    if _client is None:
        # Explicit generous timeout: Qdrant Cloud over a proxied/slow link
        # times out with the client defaults (seen live 2026-10-28).
        _client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=60,
            check_compatibility=False,
        )
    return _client


def ensure_collection(dim: int) -> None:
    c = client()
    names = [col.name for col in c.get_collections().collections]
    if settings.collection not in names:
        c.create_collection(
            collection_name=settings.collection,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )


def upsert(chunks: list[dict], vectors: list[list[float]]) -> int:
    points = [
        PointStruct(id=str(uuid.uuid4()), vector=vec, payload=chunk)
        for chunk, vec in zip(chunks, vectors)
    ]
    client().upsert(collection_name=settings.collection, points=points)
    return len(points)


def search(vector: list[float], limit: int = 8) -> list[dict]:
    hits = client().query_points(
        collection_name=settings.collection, query=vector, limit=limit
    ).points
    return [{"score": h.score, **h.payload} for h in hits]


def scroll_all(limit: int = 500) -> list[dict]:
    points, _ = client().scroll(collection_name=settings.collection, limit=limit)
    return [p.payload for p in points]

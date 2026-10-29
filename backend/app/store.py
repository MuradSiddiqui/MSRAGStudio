"""Qdrant vector store: one collection, payload carries source/page/region for citations."""
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from .config import settings

_client = None
_ready = False

# Filtering on these fields requires a payload index on Qdrant Cloud (strict mode).
_INDEXED_FIELDS = ("source", "kind")


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


def collection_exists() -> bool:
    return client().collection_exists(settings.collection)


def ensure_collection(dim: int) -> None:
    global _ready
    if _ready:
        return
    c = client()
    if not c.collection_exists(settings.collection):
        c.create_collection(
            collection_name=settings.collection,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
    existing = c.get_collection(settings.collection).payload_schema or {}
    for field in _INDEXED_FIELDS:
        if field not in existing:
            c.create_payload_index(
                collection_name=settings.collection,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
    _ready = True


def _source_filter(source: str) -> Filter:
    return Filter(must=[FieldCondition(key="source", match=MatchValue(value=source))])


def delete_source(source: str) -> None:
    if not collection_exists():
        return
    client().delete(
        collection_name=settings.collection,
        points_selector=FilterSelector(filter=_source_filter(source)),
        wait=True,
    )


def upsert(chunks: list[dict], vectors: list[list[float]]) -> int:
    points = [
        PointStruct(
            # Deterministic ids: re-indexing the same file overwrites instead of duplicating.
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{c['source']}|{c['page']}|{c['chunk']}")),
            vector=vec,
            payload=c,
        )
        for c, vec in zip(chunks, vectors)
    ]
    for i in range(0, len(points), 128):
        client().upsert(collection_name=settings.collection, points=points[i : i + 128])
    return len(points)


def search(vector: list[float], limit: int = 8, kind: str | None = None) -> list[dict]:
    if not collection_exists():
        return []
    query_filter = (
        Filter(must=[FieldCondition(key="kind", match=MatchValue(value=kind))]) if kind else None
    )
    hits = client().query_points(
        collection_name=settings.collection,
        query=vector,
        limit=limit,
        query_filter=query_filter,
    ).points
    return [{"score": h.score, **h.payload} for h in hits]


def list_documents() -> list[dict]:
    """Every indexed file with its chunk count, derived from point payloads."""
    if not collection_exists():
        return []
    docs: dict[str, dict] = {}
    offset = None
    while True:
        points, offset = client().scroll(
            collection_name=settings.collection,
            limit=1000,
            offset=offset,
            with_payload=["source", "kind"],
            with_vectors=False,
        )
        for p in points:
            payload = p.payload or {}
            name = payload.get("source", "unknown")
            doc = docs.setdefault(name, {"name": name, "kind": payload.get("kind", "text"), "chunks": 0})
            doc["chunks"] += 1
        if offset is None:
            break
    return sorted(docs.values(), key=lambda d: d["name"].lower())

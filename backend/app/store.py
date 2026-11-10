"""Qdrant vector store: one collection, payload carries source/page/region for citations."""
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchAny,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from .config import settings

_client = None
_ready = False

# Filtering on these fields requires a payload index on Qdrant Cloud (strict mode).
_INDEXED_FIELDS = ("source", "kind", "section_path")


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


def search(
    vector: list[float],
    limit: int = 8,
    kind: str | None = None,
    sources: list[str] | None = None,
) -> list[dict]:
    if not collection_exists():
        return []
    must = []
    if kind:
        must.append(FieldCondition(key="kind", match=MatchValue(value=kind)))
    if sources:
        must.append(FieldCondition(key="source", match=MatchAny(any=sources)))
    hits = client().query_points(
        collection_name=settings.collection,
        query=vector,
        limit=limit,
        query_filter=Filter(must=must) if must else None,
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


def list_sections(sources: list[str] | None = None) -> list[dict]:
    """The table of contents of the index: every distinct section_path with
    its chunk count and page span, in document order per source.

    Only text chunks indexed by the structure-aware pipeline carry a
    section; chunks from before it (and image chunks) are invisible here,
    which is exactly what STAIR's fallback logic keys on.
    """
    if not collection_exists():
        return []
    scroll_filter = None
    if sources:
        scroll_filter = Filter(
            must=[FieldCondition(key="source", match=MatchAny(any=sources))]
        )
    agg: dict[tuple[str, str], dict] = {}
    offset = None
    while True:
        points, offset = client().scroll(
            collection_name=settings.collection,
            scroll_filter=scroll_filter,
            limit=1000,
            offset=offset,
            with_payload=["source", "kind", "section", "section_path", "page"],
            with_vectors=False,
        )
        for p in points:
            payload = p.payload or {}
            path = payload.get("section_path") or ""
            if not path or payload.get("kind") == "image":
                continue
            key = (payload.get("source", "unknown"), path)
            entry = agg.setdefault(
                key,
                {
                    "source": key[0],
                    "section": payload.get("section", ""),
                    "section_path": path,
                    "chunks": 0,
                    "pages": set(),
                },
            )
            entry["chunks"] += 1
            if isinstance(payload.get("page"), int):
                entry["pages"].add(payload["page"])
        if offset is None:
            break
    out = []
    for entry in agg.values():
        pages = sorted(entry.pop("pages"))
        entry["page_from"] = pages[0] if pages else None
        entry["page_to"] = pages[-1] if pages else None
        out.append(entry)
    return sorted(out, key=lambda e: (e["source"].lower(), e["page_from"] or 0, e["section_path"]))


def fetch_section_chunks(
    source: str, section_path: str, limit: int = 256
) -> list[dict]:
    """Every chunk of one section, in document order (page, then chunk).

    STAIR reads the whole chosen section instead of a top-k sample, so
    this is a payload-filtered scroll, not a vector search. Returned hits
    carry score 0.0: membership in the section, not similarity, selected
    them.
    """
    if not collection_exists():
        return []
    scroll_filter = Filter(
        must=[
            FieldCondition(key="source", match=MatchValue(value=source)),
            FieldCondition(key="section_path", match=MatchValue(value=section_path)),
        ]
    )
    found: list[dict] = []
    offset = None
    while len(found) < limit:
        points, offset = client().scroll(
            collection_name=settings.collection,
            scroll_filter=scroll_filter,
            limit=min(256, limit - len(found)),
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for p in points:
            found.append({"score": 0.0, **(p.payload or {})})
        if offset is None:
            break
    found.sort(key=lambda c: (c.get("page") or 0, c.get("chunk") or 0))
    return found

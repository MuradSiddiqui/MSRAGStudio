"""Ingestion pipeline: extract -> (vision for images) -> chunk -> embed -> Qdrant upsert.
The same steps are mirrored by the n8n ingestion workflow for async/bulk imports."""
import base64
import mimetypes
from pathlib import Path

from . import chunking, embeddings, extract, llm, store

# Keep a durable preview in Qdrant: Railway's local disk is wiped on redeploy.
# Cap so a huge photo doesn't blow the payload; floor-plan PNGs are usually under this.
_MAX_PREVIEW_BYTES = 2_500_000


def _image_preview_fields(path: str) -> dict:
    raw = Path(path).read_bytes()
    if not raw or len(raw) > _MAX_PREVIEW_BYTES:
        return {}
    mime = mimetypes.guess_type(path)[0] or "image/png"
    return {"preview_b64": base64.b64encode(raw).decode("ascii"), "preview_mime": mime}


def ingest_file(path: str, owner: str) -> dict:
    name = Path(path).name
    if extract.is_image(path):
        description = llm.describe_image(path)
        chunks = [
            {
                "source": name,
                "page": 0,
                "chunk": 0,
                "section": "",
                "section_path": "",
                "kind": "image",
                "text": description,
                **_image_preview_fields(path),
            }
        ] if description.strip() else []
    else:
        pages = extract.extract_text(path)
        outline = extract.extract_outline(path)
        chunks = [
            {**c, "kind": "text"}
            for c in chunking.chunk_pages(pages, name, outline=outline)
        ]
    if not chunks:
        return {"file": name, "chunks": 0}
    vectors = embeddings.embed([c["text"] for c in chunks])
    store.ensure_collection(len(vectors[0]))
    store.delete_source(owner, name)
    count = store.upsert(owner, chunks, vectors)
    return {"file": name, "chunks": count}

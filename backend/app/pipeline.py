"""Ingestion pipeline: extract -> (vision for images) -> chunk -> embed -> Qdrant upsert.
The same steps are mirrored by the n8n ingestion workflow for async/bulk imports."""
from pathlib import Path

from . import chunking, embeddings, extract, llm, store


def ingest_file(path: str) -> dict:
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
    store.delete_source(name)
    count = store.upsert(chunks, vectors)
    return {"file": name, "chunks": count}

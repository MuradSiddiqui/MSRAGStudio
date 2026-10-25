"""Simple paragraph-aware chunking with overlap. Keeps page references for citations."""


def chunk_pages(pages: list[dict], source: str, size: int = 900, overlap: int = 150) -> list[dict]:
    chunks = []
    for page in pages:
        text = " ".join(page["text"].split())
        start = 0
        idx = 0
        while start < len(text):
            piece = text[start : start + size]
            if piece.strip():
                chunks.append(
                    {
                        "source": source,
                        "page": page["page"],
                        "chunk": idx,
                        "text": piece,
                    }
                )
                idx += 1
            start += size - overlap
    return chunks

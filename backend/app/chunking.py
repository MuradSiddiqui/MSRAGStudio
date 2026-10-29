"""Simple paragraph-aware chunking with overlap. Keeps page references for citations."""


def chunk_pages(pages: list[dict], source: str, size: int = 900, overlap: int = 150) -> list[dict]:
    chunks = []
    for page in pages:
        text = " ".join(page["text"].split())
        start = 0
        idx = 0
        while start < len(text):
            end = min(start + size, len(text))
            # Prefer to break on a sentence or word boundary instead of mid-word.
            if end < len(text):
                window = text[start:end]
                cut = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
                if cut < size // 2:
                    cut = window.rfind(" ")
                if cut > size // 2:
                    end = start + cut + 1
            piece = text[start:end].strip()
            if piece:
                chunks.append(
                    {
                        "source": source,
                        "page": page["page"],
                        "chunk": idx,
                        "text": piece,
                    }
                )
                idx += 1
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
    return chunks

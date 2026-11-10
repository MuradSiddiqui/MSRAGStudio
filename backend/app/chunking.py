"""Paragraph-aware chunking with overlap, structure-aware since STAIR.

Each page is first split at heading lines (see structure.py); segments are
chunked separately so a chunk never straddles a section boundary, and
every chunk records `section` (leaf heading) and `section_path`
(breadcrumb) for citations and STAIR navigation. A section started on an
earlier page carries over to continuation pages; a PDF outline, when
present, is the fallback for pages with no detectable heading at all.
"""
from . import structure


def _chunk_text(text: str, size: int, overlap: int) -> list[str]:
    text = " ".join(text.split())
    pieces = []
    start = 0
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
            pieces.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return pieces


def chunk_pages(
    pages: list[dict],
    source: str,
    size: int = 900,
    overlap: int = 150,
    outline: list[dict] | None = None,
) -> list[dict]:
    chunks = []
    carry: tuple[str, str] = ("", "")  # section in progress from earlier pages
    for page in pages:
        outline_fb = structure.outline_section_for_page(outline or [], page["page"])
        idx = 0
        for seg in structure.split_segments(page["text"]):
            if seg["section_path"]:
                carry = (seg["section"], seg["section_path"])
                section, section_path = carry
            elif carry[1]:
                section, section_path = carry
            else:
                section, section_path = outline_fb
            for piece in _chunk_text(seg["text"], size, overlap):
                chunks.append(
                    {
                        "source": source,
                        "page": page["page"],
                        "chunk": idx,
                        "section": section,
                        "section_path": section_path,
                        "text": piece,
                    }
                )
                idx += 1
    return chunks

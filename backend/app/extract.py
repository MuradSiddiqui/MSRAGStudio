"""Text extraction from uploaded files. Images go through the vision LLM in llm.py."""
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
DOC_EXTS = {".pdf", ".docx", ".txt", ".md"}
SUPPORTED_EXTS = IMAGE_EXTS | DOC_EXTS


def is_image(path: str) -> bool:
    return Path(path).suffix.lower() in IMAGE_EXTS


def is_supported(path: str) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_EXTS


def extract_text(path: str) -> list[dict]:
    """Return [{'page': int, 'text': str}] for document files."""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        if reader.is_encrypted:
            reader.decrypt("")
        return [
            {"page": i + 1, "text": page.extract_text() or ""}
            for i, page in enumerate(reader.pages)
        ]
    if ext == ".docx":
        import docx

        doc = docx.Document(path)
        parts = []
        for p in doc.paragraphs:
            # Heading styles become Markdown markers so structure.py can
            # recover the document outline from the flattened text.
            style = (p.style.name or "").lower() if p.style else ""
            level = 0
            for marker in ("heading ", "überschrift "):
                if style.startswith(marker):
                    try:
                        level = int(style[len(marker):].strip()[:1])
                    except ValueError:
                        level = 0
                    break
            parts.append(("#" * level + " " if level else "") + p.text)
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        return [{"page": 1, "text": "\n".join(parts)}]
    if ext in {".txt", ".md"}:
        return [{"page": 1, "text": Path(path).read_text(encoding="utf-8", errors="ignore")}]
    return []


def extract_outline(path: str) -> list[dict]:
    """PDF bookmarks as [{'title': str, 'level': int, 'page': int}].

    Empty for non-PDF files and PDFs without an outline. STAIR uses this
    as the structure fallback for pages whose text has no headings.
    """
    if Path(path).suffix.lower() != ".pdf":
        return []
    from pypdf import PdfReader

    reader = PdfReader(path)
    if reader.is_encrypted:
        reader.decrypt("")
    out: list[dict] = []

    def walk(items: list, level: int) -> None:
        for item in items:
            if isinstance(item, list):
                walk(item, level + 1)
                continue
            try:
                page = reader.get_destination_page_number(item) + 1
                title = str(item.title).strip()
            except Exception:
                continue
            if title:
                out.append({"title": title, "level": level, "page": page})

    try:
        walk(reader.outline, 1)
    except Exception:
        return []
    return out

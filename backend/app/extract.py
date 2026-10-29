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
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        return [{"page": 1, "text": "\n".join(parts)}]
    if ext in {".txt", ".md"}:
        return [{"page": 1, "text": Path(path).read_text(encoding="utf-8", errors="ignore")}]
    return []

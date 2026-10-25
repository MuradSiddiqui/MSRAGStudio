"""Text extraction from uploaded files. Images go through the vision LLM in llm.py."""
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def is_image(path: str) -> bool:
    return Path(path).suffix.lower() in IMAGE_EXTS


def extract_text(path: str) -> list[dict]:
    """Return [{'page': int, 'text': str}] for document files."""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        return [
            {"page": i + 1, "text": page.extract_text() or ""}
            for i, page in enumerate(reader.pages)
        ]
    if ext == ".docx":
        import docx

        doc = docx.Document(path)
        text = "\n".join(p.text for p in doc.paragraphs)
        return [{"page": 1, "text": text}]
    if ext in {".txt", ".md"}:
        return [{"page": 1, "text": Path(path).read_text(encoding="utf-8", errors="ignore")}]
    return []

"""Document structure: the table-of-contents layer STAIR navigates.

Standard RAG chunks text blind. STAIR (IBM Research, "STructure Aware
Information Retriever") instead reads the document's own structure first.
This module recovers that structure at ingestion time:

- Markdown headings (# .. ######) - .md files natively, .docx via the
  heading-style markers extract.py emits, .txt/.pdf via the same syntax.
- Numbered headings common in codes and specs: "4.2 Fire doors",
  "§ 4.2 Fire-rated doors", "§4 Fire protection".
- A PDF outline/bookmark tree, when present, as the per-page fallback for
  pages whose text carries no detectable heading.

Every chunk produced from a segment carries two extra payload fields:
`section` (the leaf heading, e.g. "§4.2 Fire-rated doors") and
`section_path` (the full breadcrumb, e.g. "§4 Fire protection > §4.2
Fire-rated doors"). Text before the first heading keeps empty values.
"""
import re

# Markdown ATX heading, levels 1-6.
_MD_HEADING = re.compile(r"^(#{1,6})\s+(.{2,120})$")
# Numbered heading: optional section sign, dotted number, then a title that
# starts with a capital and is short enough to be a heading, not a sentence.
_NUM_HEADING = re.compile(
    r"^(§\s*)?(\d+(?:\.\d+){0,3})\.?\s+([A-ZÄÖÜ][^.\n]{1,78})$"
)
# Bare section-sign heading: "§4 Fire protection" / "§ 12 Ventilation".
_SIGN_HEADING = re.compile(r"^(§\s*\d+(?:\.\d+){0,3})\.?\s+([A-ZÄÖÜ][^.\n]{1,78})$")


def _numbered_level(number: str) -> int:
    return number.count(".") + 1


def match_heading(line: str) -> tuple[int, str] | None:
    """Return (level, title) if the line is a heading, else None."""
    line = line.strip()
    if not line or len(line) > 130:
        return None
    m = _MD_HEADING.match(line)
    if m:
        return len(m.group(1)), m.group(2).strip()
    m = _SIGN_HEADING.match(line)
    if m:
        number = m.group(1).replace("§", "").strip()
        return _numbered_level(number), f"§{number} {m.group(2).strip()}"
    m = _NUM_HEADING.match(line)
    if m:
        sign, number, title = m.group(1), m.group(2), m.group(3).strip()
        # A numbered line ending in a comma or lowercase continuation is a
        # list item or sentence, not a heading.
        if title.endswith(","):
            return None
        prefix = "§" if sign else ""
        return _numbered_level(number), f"{prefix}{number} {title}"
    return None


def split_segments(page_text: str) -> list[dict]:
    """Split one page's raw text at heading lines.

    Returns [{'section': leaf title, 'section_path': breadcrumb, 'text': str}].
    Heading lines stay at the start of their segment's text so the chunk
    itself still reads naturally.
    """
    segments: list[dict] = []
    stack: list[tuple[int, str]] = []  # (level, title), outermost first
    current_lines: list[str] = []

    def flush() -> None:
        text = "\n".join(current_lines).strip()
        if not text:
            return
        path = " > ".join(t for _, t in stack)
        segments.append(
            {
                "section": stack[-1][1] if stack else "",
                "section_path": path,
                "text": text,
            }
        )

    for raw_line in page_text.splitlines():
        heading = match_heading(raw_line)
        if heading is None:
            current_lines.append(raw_line)
            continue
        level, title = heading
        flush()
        stack = [(lv, t) for lv, t in stack if lv < level]
        stack.append((level, title))
        current_lines = [raw_line.strip()]
    flush()
    return segments


def toc_from_pages(pages: list[dict]) -> list[dict]:
    """Distinct sections across the document, in order of appearance."""
    seen: dict[str, dict] = {}
    for page in pages:
        for seg in split_segments(page["text"]):
            path = seg["section_path"]
            if not path or path in seen:
                continue
            seen[path] = {
                "section": seg["section"],
                "section_path": path,
                "page": page["page"],
            }
    return list(seen.values())


def outline_section_for_page(outline: list[dict], page_number: int) -> tuple[str, str]:
    """(section, section_path) from a PDF outline for a page: the deepest
    outline entry starting at or before the page, with its ancestors."""
    if not outline:
        return "", ""
    chain: list[dict] = []
    for entry in outline:
        if entry["page"] > page_number:
            break
        chain = [e for e in chain if e["level"] < entry["level"]]
        chain.append(entry)
    if not chain:
        return "", ""
    return chain[-1]["title"], " > ".join(e["title"] for e in chain)

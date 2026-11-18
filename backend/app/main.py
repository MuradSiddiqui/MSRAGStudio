"""MS RAG Studio API: upload -> ingest -> ask (4 modes) -> report download.

Each browser sends a random workspace id in the X-Workspace-Id header; files,
search and previews are scoped to it. There are no accounts: the id is the
only key, so anyone holding it can read that workspace. Requests without the
header (n8n, curl) share the "default" workspace.
"""
import logging
import mimetypes
import os
import re
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from . import embeddings, extract, llm, modes, pipeline, store

log = logging.getLogger("msrag")

# Default: backend/data/uploads (works locally and in Docker/Railway).
# Override with MSRAG_UPLOAD_DIR if you mount a volume elsewhere.
UPLOAD_DIR = Path(
    os.environ.get("MSRAG_UPLOAD_DIR")
    or (Path(__file__).resolve().parents[1] / "data" / "uploads")
)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_PREVIEW_CHARS = 200_000
_WORKSPACE_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

_sessions: dict[tuple[str, str, str], dict] = {}
_last_by_question: dict[tuple[str, str], dict] = {}


def workspace(x_workspace_id: Annotated[str | None, Header()] = None) -> str:
    if x_workspace_id is None:
        return "default"
    if not _WORKSPACE_RE.match(x_workspace_id):
        raise HTTPException(400, "Invalid workspace id.")
    return x_workspace_id


Owner = Annotated[str, Depends(workspace)]


def _owner_dir(owner: str) -> Path:
    path = UPLOAD_DIR / owner
    path.mkdir(parents=True, exist_ok=True)
    return path


def _warm_up() -> None:
    # Best-effort: never blocks startup. First upload/ask after a cold deploy
    # was measured at 93s / >180s; warming embed + one tiny LLM call drops that.
    try:
        dim = embeddings.warm_up()
        store.ensure_collection(dim)
        log.info("Embedding model and Qdrant collection ready")
    except Exception:  # noqa: BLE001
        log.exception("Warm-up (embed/store) failed; will retry on first request")
        return
    try:
        vector = embeddings.embed_query("warm-up ping")
        store.search("__warmup__", vector, limit=1)
        llm.warm_provider()
        log.info("Retrieval path and LLM provider warmed")
    except Exception:  # noqa: BLE001
        log.exception("Warm-up (retrieve/LLM) failed; first ask may be slow")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Loading BGE (and downloading it on first run) takes long enough to time out
    # the first upload, so do it in the background as soon as the server starts.
    threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="MS RAG Studio", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_name(filename: str | None) -> str:
    name = Path(filename or "").name.strip()
    name = re.sub(r"[\x00-\x1f/\\]", "_", name)
    if not name or name in {".", ".."}:
        raise HTTPException(400, "The file has no usable name.")
    return name


def _fail(exc: Exception, action: str) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    if isinstance(exc, llm.LLMError):
        # Busy / rate-limit → 503 so the UI can retry; never echo provider text
        # (already stripped inside llm.py). Log the action for the server log.
        log.warning("%s: %s", action, exc)
        status = 503 if str(exc) == llm.BUSY_MSG else 502
        return HTTPException(status, str(exc))
    log.exception("%s failed", action)
    return HTTPException(500, f"{action} failed. Please try again.")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ms-rag-studio",
        "model_ready": embeddings.is_loaded(),
    }


# Sync handlers run in FastAPI's threadpool, so a long ingest doesn't block other requests.
@app.post("/files")
def upload(owner: Owner, file: UploadFile = File(...)):
    name = _safe_name(file.filename)
    if not extract.is_supported(name):
        allowed = ", ".join(sorted(extract.SUPPORTED_EXTS))
        raise HTTPException(415, f"Unsupported file type. Allowed: {allowed}")
    dest = _owner_dir(owner) / name
    size = 0
    try:
        with open(dest, "wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File is larger than the 50 MB limit.")
                out.write(chunk)
        if size == 0:
            raise HTTPException(400, "The file is empty.")
        result = pipeline.ingest_file(str(dest), owner)
    except Exception as exc:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise _fail(exc, "Indexing") from exc
    return {"uploaded": name, **result}


@app.get("/documents")
def documents(owner: Owner):
    try:
        return {"documents": store.list_documents(owner)}
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Listing documents") from exc


@app.delete("/documents/{name}")
def delete_document(name: str, owner: Owner):
    name = _safe_name(name)
    try:
        store.delete_source(owner, name)
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Deleting") from exc
    (UPLOAD_DIR / owner / name).unlink(missing_ok=True)
    return {"deleted": name}


@app.get("/documents/{name}/preview")
def preview_document(name: str, owner: Owner):
    """The uploaded file itself for PDFs and images; extracted text otherwise.

    Railway's disk is wiped on redeploy, so when the original is gone this
    falls back to the indexed text (or the vision description for images).
    """
    name = _safe_name(name)
    path = UPLOAD_DIR / owner / name
    ext = path.suffix.lower()
    try:
        if path.is_file():
            if extract.is_image(str(path)) or ext == ".pdf":
                media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
                return FileResponse(path, media_type=media_type, content_disposition_type="inline")
            pages = extract.extract_text(str(path))
            return _text_preview(name, [(p["page"], p["text"]) for p in pages], stored=True)
        chunks = store.fetch_chunks(owner, name, limit=2000)
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Preview") from exc
    if not chunks:
        raise HTTPException(404, "This file is not in your library.")
    if chunks[0].get("kind") == "image":
        return {"name": name, "kind": "image", "stored": False, "description": chunks[0].get("text", "")}
    by_page: dict[int, list[str]] = {}
    for c in chunks:
        by_page.setdefault(c.get("page") or 1, []).append(c.get("text", ""))
    return _text_preview(name, [(p, "\n\n".join(t)) for p, t in sorted(by_page.items())], stored=False)


def _text_preview(name: str, pages: list[tuple[int, str]], stored: bool) -> dict:
    out, used = [], 0
    for page, text in pages:
        if used >= MAX_PREVIEW_CHARS:
            break
        text = text[: MAX_PREVIEW_CHARS - used]
        used += len(text)
        out.append({"page": page, "text": text})
    return {
        "name": name,
        "kind": "text",
        "stored": stored,
        "truncated": used >= MAX_PREVIEW_CHARS,
        "pages": out,
    }


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: Literal["basic", "multimodal", "agentic", "stair"] = "basic"
    # Empty / omitted = search the whole index. Non-empty = only these filenames.
    sources: list[str] = Field(default_factory=list, max_length=100)


@app.post("/ask")
def ask(req: AskRequest, owner: Owner):
    question = req.question.strip()
    if not question:
        raise HTTPException(422, "The question is empty.")
    sources = [s.strip() for s in req.sources if isinstance(s, str) and s.strip()][:100] or None
    fn = {
        "basic": modes.basic,
        "multimodal": modes.multimodal,
        "agentic": modes.agentic,
        "stair": modes.stair,
    }[req.mode]
    try:
        if not store.has_documents(owner, sources):
            if sources and store.has_documents(owner):
                raise HTTPException(409, "The selected files are no longer in your library.")
            raise HTTPException(409, "Upload a document or image before asking a question.")
        result = fn(question, owner, sources=sources)
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Answering") from exc
    _sessions[(owner, req.mode, question)] = result
    _last_by_question[(owner, question)] = result
    if len(_sessions) > 200:
        _sessions.pop(next(iter(_sessions)))
    if len(_last_by_question) > 200:
        _last_by_question.pop(next(iter(_last_by_question)))
    return result


@app.get("/report", response_class=PlainTextResponse)
def report(owner: Owner, question: str, mode: str | None = None):
    """Downloadable Markdown report for the last answer to a question."""
    question = question.strip()
    result = (
        _sessions.get((owner, mode, question)) if mode else _last_by_question.get((owner, question))
    )
    if not result:
        raise HTTPException(404, "No answer for this question yet. Ask it first.")
    lines = [
        "# MS RAG Studio — Report",
        "",
        f"**Mode:** {result['mode']}",
        f"**Question:** {question}",
        *(
            ["**Evidence:** low — check sources"]
            if result.get("evidence") == "low"
            else []
        ),
        "",
        "## Answer",
        "",
        result["answer"],
        "",
        "## Sources",
        "",
    ]
    for s in result["sources"]:
        where = "image" if s.get("kind") == "image" else f"p.{s.get('page', '-')}"
        if s.get("section") and s.get("kind") != "image":
            where = f"{s['section']} · {where}"
        lines.append(f"- {s['source']} · {where} (score {s.get('score', 0):.2f})")
    if "coverage" in result:
        cov = result["coverage"]
        lines += ["", "## Coverage", "", f"Chunks considered: {cov['chunks_considered']}"]
        lines.append(f"Unique sources: {cov['unique_sources']}")
        for i, step in enumerate(cov["sub_questions"], 1):
            lines.append(f"{i}. {step['sub_question']} ({step['found']} found)")
    if "structure" in result:
        st = result["structure"]
        lines += ["", "## Structure (STAIR)", ""]
        if st.get("navigated"):
            lines.append(f"Sections in scope: {st['toc_sections']}")
            if st.get("reason"):
                lines.append(f"Navigation: {st['reason']}")
            for ch in st.get("chosen", []):
                lines.append(
                    f"- {ch['source']} · {ch['section_path']} ({ch['chunks']} chunks read in full)"
                )
        else:
            lines.append(st.get("reason", "No table of contents available."))
    return "\n".join(lines)

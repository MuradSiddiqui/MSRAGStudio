"""MS RAG Studio API: upload -> ingest -> ask (3 modes) -> report download."""
import logging
import re
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from . import embeddings, extract, llm, modes, pipeline, store

log = logging.getLogger("msrag")

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

_sessions: dict[tuple[str, str], dict] = {}
_last_by_question: dict[str, dict] = {}


def _warm_up() -> None:
    try:
        dim = embeddings.warm_up()
        store.ensure_collection(dim)
        log.info("Embedding model and Qdrant collection ready")
    except Exception:  # noqa: BLE001 - warm-up is best effort; requests retry lazily
        log.exception("Warm-up failed; will retry on first request")


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
        return HTTPException(502, str(exc))
    log.exception("%s failed", action)
    return HTTPException(500, f"{action} failed: {type(exc).__name__}: {exc}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ms-rag-studio",
        "model_ready": embeddings.is_loaded(),
    }


# Sync handlers run in FastAPI's threadpool, so a long ingest doesn't block other requests.
@app.post("/files")
def upload(file: UploadFile = File(...)):
    name = _safe_name(file.filename)
    if not extract.is_supported(name):
        allowed = ", ".join(sorted(extract.SUPPORTED_EXTS))
        raise HTTPException(415, f"Unsupported file type. Allowed: {allowed}")
    dest = UPLOAD_DIR / name
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
        result = pipeline.ingest_file(str(dest))
    except Exception as exc:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise _fail(exc, "Indexing") from exc
    return {"uploaded": name, **result}


@app.get("/documents")
def documents():
    try:
        return {"documents": store.list_documents()}
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Listing documents") from exc


@app.delete("/documents/{name}")
def delete_document(name: str):
    name = _safe_name(name)
    try:
        store.delete_source(name)
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Deleting") from exc
    (UPLOAD_DIR / name).unlink(missing_ok=True)
    return {"deleted": name}


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: Literal["basic", "multimodal", "agentic"] = "basic"


@app.post("/ask")
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(422, "The question is empty.")
    fn = {"basic": modes.basic, "multimodal": modes.multimodal, "agentic": modes.agentic}[req.mode]
    try:
        result = fn(question)
    except Exception as exc:  # noqa: BLE001
        raise _fail(exc, "Answering") from exc
    _sessions[(req.mode, question)] = result
    _last_by_question[question] = result
    if len(_sessions) > 200:
        _sessions.pop(next(iter(_sessions)))
    if len(_last_by_question) > 200:
        _last_by_question.pop(next(iter(_last_by_question)))
    return result


@app.get("/report", response_class=PlainTextResponse)
def report(question: str, mode: str | None = None):
    """Downloadable Markdown report for the last answer to a question."""
    question = question.strip()
    result = _sessions.get((mode, question)) if mode else _last_by_question.get(question)
    if not result:
        raise HTTPException(404, "No answer for this question yet. Ask it first.")
    lines = [
        "# MS RAG Studio — Report",
        "",
        f"**Mode:** {result['mode']}",
        f"**Question:** {question}",
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
        lines.append(f"- {s['source']} · {where} (score {s.get('score', 0):.2f})")
    if "coverage" in result:
        cov = result["coverage"]
        lines += ["", "## Coverage", "", f"Chunks considered: {cov['chunks_considered']}"]
        lines.append(f"Unique sources: {cov['unique_sources']}")
        for i, step in enumerate(cov["sub_questions"], 1):
            lines.append(f"{i}. {step['sub_question']} ({step['found']} found)")
    return "\n".join(lines)

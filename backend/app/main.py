"""MS RAG Studio API: upload -> ingest -> ask (3 modes) -> report download."""
import shutil
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from . import modes, pipeline

app = FastAPI(title="MS RAG Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):3000|https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_sessions: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-rag-studio"}


@app.post("/files")
async def upload(file: UploadFile = File(...)):
    dest = UPLOAD_DIR / file.filename
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    result = pipeline.ingest_file(str(dest))
    return {"uploaded": file.filename, **result}


class AskRequest(BaseModel):
    question: str
    mode: str = "basic"  # basic | multimodal | agentic


@app.post("/ask")
def ask(req: AskRequest):
    fn = {"basic": modes.basic, "multimodal": modes.multimodal, "agentic": modes.agentic}[
        req.mode
    ]
    result = fn(req.question)
    _sessions[req.question[:60]] = result
    return result


@app.get("/report", response_class=PlainTextResponse)
def report(question: str):
    """Downloadable Markdown report for the last answer to a question."""
    result = _sessions.get(question[:60])
    if not result:
        return "# No report found for this question"
    lines = [
        f"# MS RAG Studio — Report",
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
        lines.append(f"- {s['source']} · p.{s.get('page', '-')} (score {s.get('score', 0):.2f})")
    if "coverage" in result:
        lines += ["", "## Coverage", "", f"Chunks considered: {result['coverage']['chunks_considered']}"]
    return "\n".join(lines)

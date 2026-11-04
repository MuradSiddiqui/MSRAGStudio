# Live test pack — MS RAG Studio

Upload these 3 files in the Studio, then run the questions below.

Folder on your Mac:
`Documents/projects/MSRAGStudio/data/demo/test-pack/`

Site: https://ms-rag-studio-muradsiddiqui.vercel.app/studio

---

## Files

| File | Type | What it contains |
| --- | --- | --- |
| `01-building-code.txt` | Text | Fire-rated doors, escape routes, corridor widths |
| `02-ground-floor-plan.png` | Image | Rooms + doors D1–D4 (some fire-rated) |
| `03-project-deadlines.txt` | Text | Team names + dated deadlines + open risks |

---

## Checklist

### 1. Upload
1. Open Studio → drop all 3 files (one by one is fine).
2. Library should show 3 files; the image may take longer (vision model).
3. Status: **API connected**.

### 2. Basic RAG
Mode: **Basic**  
Question:
> Which doors must be fire-rated?

Expect: list of 4 door types from the building code, with citations like `[01-building-code.txt · p.1]`.

Follow-up:
> What is the minimum corridor width for escape routes?

Expect: 1.25 m (1.50 m if >200 occupants).

### 3. Multimodal RAG
Mode: **Multimodal**  
Question:
> Looking at the floor plan, which doors are marked fire-rated?

Expect: D1, D2, D3 (not D4), citation like `[02-ground-floor-plan.png · image]`.

Follow-up:
> Which room is next to the stairwell on the ground floor plan?

Expect: Open Office / Plant or Meeting depending on layout description.

### 4. Agentic RAG
Mode: **Agentic** (or use “Try the fire-door demo”)  
Question:
> List every deadline in the project handbook, with dates.

Expect: coverage report with plan steps; all 5 dates (12 Mar, 28 Mar, 4 Apr, 22 Apr, 15 Sep 2026).

Follow-up:
> List all open risks mentioned in the documents.

Expect: plant room door, corridor width, smoke extraction — plus coverage stats.

### 5. Cross-document
Mode: **Agentic**  
Question:
> Which doors must be fire-rated according to the code, and which of those appear on the floor plan?

Expect: code list + D1/D2/D3 from the plan; citations from both files.

### 6. Report
After any good answer: **Copy report** / **Download .md** — file should include question, answer, sources (and coverage for Agentic).

---

## Pass / fail signals

| Signal | Meaning |
| --- | --- |
| API connected | Vercel ↔ Railway OK |
| Upload shows chunk counts | Embed + Qdrant OK |
| Image indexes as “image” | Gemini vision OK |
| Citations clickable | UI OK |
| Agentic shows Coverage report | Planning + multi-retrieve OK |
| API offline / 502 | Railway asleep, OOM, or wrong `NEXT_PUBLIC_API_URL` |

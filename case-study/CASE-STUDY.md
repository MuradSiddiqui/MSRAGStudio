# Case Study: Building-Code Research — corpus note

An example use case for MS RAG Studio, chosen because building-code research stresses two hard problems: **completeness instead of top-k** (for "list all" questions, a top-5 answer is dangerous) and **rules that live in tables, lists and drawings**, not only in prose.

## Corpus (small on purpose — fully indexed and verified)

| File | What it is | Index |
|---|---|---|
| `MBO-Auszug-Gebaeudeklassen-Brandschutz.pdf` | Excerpt of the official Musterbauordnung (MBO), Bauministerkonferenz, via is-argebau.de: § 2 Abs. 3 (Gebäudeklassen) + §§ 26–39 complete (Brandschutz, Rettungswege, Treppenräume, Flure, Aufzüge). 17 pages, built from the official 73-page PDF. | 71 chunks, with STAIR section payloads |
| `Grundriss-Erdgeschoss.png` | Ground-floor plan drawn for this case study: Büro 1/2, Besprechung, notwendiger Flur, Treppenraum, Aufzug (Fahrschacht), Technikraum, Lagerraum; 9 doors D1–D9, numbered only — the plan deliberately does NOT print any fire ratings, so the ratings must come from the code. | 1 chunk (Gemini vision description, verified 3× before upload: all 9 doors with correct connections, all rooms) |

Workspace: `building-codes-demo` (the Studio library is keyed to a per-browser workspace ID — see RUNBOOK.md).

## Demo questions

1. Multimodal: "Welche Türen in diesem Grundriss müssen feuerhemmend oder rauchdicht sein?" — plan × code.
2. Agentic: "Welche Türen müssen feuerhemmend oder rauchdicht sein? Liste alle Fälle auf." — completeness + coverage report.
3. STAIR showcase: same list-all question; Structure path panel shows the table-of-contents navigation.
4. Classification: "Ein Gebäude ist 12 m hoch und die Nutzungseinheiten sind jeweils nicht mehr als 400 m² groß. Welche Gebäudeklasse ist das?" (§ 2 Abs. 3)
5. Abstention: "Welche Brandschutzanforderungen gelten für Großgaragen?" — not in the excerpt; the system must decline.

## Honesty notes

- The MBO contains no table; the classification question therefore targets the structured Gebäudeklassen list in § 2 Abs. 3 (7 m / 13 m / 22 m, 400 m² thresholds) instead of pretending otherwise.
- Agentic "coverage" measures retrieval breadth per planned sub-question (chunks found per category, unique sources). It is not a verifier pass over the final answer.
- Image chunks are vision-model descriptions embedded as text, cited as image sources — not native image tokens at query time.
- Present as a prototype: ingestion of real project archives, permissions, and evaluation on real architect questions are the open next steps.

## Verification — 19 Nov 2026, live deployment (workspace `building-codes-demo`)

Indexing: excerpt PDF 71 chunks (45 s upload), plan PNG 1 chunk (132 s — includes the vision call), § 2 text file 2 chunks.

| Check | Result | Time |
|---|---|---|
| Multimodal Q1 (plan × code) | **Fails as a combined demo, twice, deterministically:** the plan's image chunk never reaches the top-10 sources (71 text chunks outrank it), so the answer lists the code's door rules correctly but never mentions doors D1–D9. The plan chunk itself is fine — scoped to the plan alone it enumerates all 9 doors with correct locations. Fix direction (code): kind-balanced retrieval or a higher multimodal limit. | 29.2 s / 11.6 s |
| Agentic list-all | Good answer (real § 35 cases: Keller, Dachräume, Werkstätten, Läden, Lager). Coverage: 6 sub-questions, 27 chunks, 1 source — but every sub-question reports "found: 8" (= the retrieval limit, so the counts carry little signal), and the planner framed two sub-questions around "DIN 4102", which is not in the corpus. | 49.8 s |
| STAIR list-all | Navigation works (21 ToC sections), but it chose the § 26 component-requirement sections instead of §§ 30/35/36; the answer stayed reasonable via the vector top-up. | 13.9 s (after one 502 + retry) |
| Gebäudeklassen (Basic + STAIR, PDF only) | **Failed:** § 2 Abs. 3 is chunked per class item, and neither path surfaced the Gebäudeklasse-4 chunk; both answered "only classes 1–2 are defined". | 8.4 s / 9.7 s |
| Gebäudeklassen (with the § 2 text file above) | **Passes:** Gebäudeklasse 4, correct reasoning (12 m ≤ 13 m, ≤ 400 m²). The text file is the verbatim § 2 Abs. 3 wording, added because the PDF's list fragments across chunks. | 8.4 s |
| Abstention (Großgaragen) | **Passes:** clean refusal — the loaded excerpt does not cover it. | 8.1 s |

Also observed: one burst of 502s from the Railway instance right after the first heavy ask (self-recovered within ~1–2 minutes; see RUNBOOK.md), and Basic-mode answers came back in English despite German questions (other modes answered in German).

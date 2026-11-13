# Demo Runbook — HENN Round 2, Wed 25 Nov 2026, 13:00, Berlin

Case study: Building-Code Research in MS RAG Studio (Musterbauordnung excerpt + ground-floor plan).
Live app: https://ms-rag-studio-muradsiddiqui.vercel.app · Backend: Railway (Hobby), `msragstudio-production.up.railway.app`

## The one thing that can silently break the demo: the workspace

The Studio library is keyed to a per-browser workspace ID (localStorage key `msrag-workspace`).
The case-study documents (MBO excerpt, 71 chunks + floor plan, 1 chunk) live in workspace **`henn-case-study`**.
A browser that has never set this ID shows an EMPTY library. Prepare the exact browser/profile you will present from:

1. Open the Studio page in the demo browser.
2. Open DevTools → Console and run: `localStorage.setItem('msrag-workspace', 'henn-case-study')`
3. Reload the page. The library must show: `MBO-Auszug-Gebaeudeklassen-Brandschutz.pdf` and `Grundriss-Erdgeschoss.png`.
4. Leave that tab open. Do not clear browser data afterwards.

Fallback if the library is empty and there is no time: re-upload the two files from `case-study/` in this repo (upload takes ~45 s for the PDF, ~2 min for the plan image).

## Morning of 25 Nov — checklist

- [ ] **Warm-up is MANDATORY.** After a redeploy or a long idle period the first requests are severely slowed by model warm-up (measured 19 Nov: first upload 93 s in a smoke test, first ask >180 s, the identical warm ask 22 s). At least 30 minutes before leaving: open the Studio (demo browser, workspace set), ask one cheap Basic question, wait for the answer. Then ask Demo Q1 once in Multimodal mode so the path is warm.
- [ ] Check `https://msragstudio-production.up.railway.app/health` returns `{"status":"ok","model_ready":true}`.
- [ ] **Pre-run the Agentic question** (it is the slowest path) and keep the result + downloaded Markdown report open in a tab: "Welche Türen müssen feuerhemmend oder rauchdicht sein? Liste alle Fälle auf." — if the live run stalls in the room, present the pre-run report: "If the live demo stalls, the downloaded report shows the same run."
- [ ] Have the plan image and the MBO excerpt PDF open locally as a visual fallback.
- [ ] Budget discipline: Railway Hobby is capped (hard limit ~$7, subscription ends after the interview) and Groq/Gemini are free tiers. No exploratory testing on the day; only the rehearsed questions.

## The demo (rehearsed order)

Setup line: "This workspace is preloaded with an excerpt of the Musterbauordnung. I will ask it the kind of question where a top-5 answer is dangerous."

1. **Multimodal (main):** "Welche Türen in diesem Grundriss müssen feuerhemmend oder rauchdicht sein?"
   Combines the plan (which doors exist, D1–D9) with the code clauses. Expected rated doors: D2 (Treppenraum), D4 (Rauchabschnitt im Flur), D7 (Aufzug/Fahrschacht); the office/entrance/storage doors are the unrated controls.
2. **Agentic (completeness, pre-run):** "Welche Türen müssen feuerhemmend oder rauchdicht sein? Liste alle Fälle auf."
   Show the Coverage report: sub-questions per door category, chunks considered, unique sources. Honest framing: coverage = retrieval breadth per planned sub-question, not a verifier pass over the answer.
3. **STAIR (showcase only):** same list-all question in STAIR mode; point at the Structure path panel — the model navigated the document's table of contents and read the chosen sections in full.
4. **Gebäudeklassen (if asked / if time):** "Ein Gebäude ist 12 m hoch und die Nutzungseinheiten sind jeweils nicht mehr als 400 m² groß. Welche Gebäudeklasse ist das?" → Gebäudeklasse 4 (§ 2 Abs. 3 MBO).
5. **Abstention (if probed):** "Welche Brandschutzanforderungen gelten für Großgaragen?" → not covered by the loaded excerpt; the system must say so.

## If something fails in the room

- **502 / no answer:** the Railway instance occasionally restarts under load (observed once on 19 Nov; it recovered by itself within ~1–2 minutes and `/health` came back 200). Wait, reload once, re-ask. Do not spam the Ask button — every click is a full pipeline run.
- **Slow Agentic:** switch to the pre-run report tab (see checklist).
- **Empty library:** wrong workspace — redo the localStorage step above.
- **Answer ignores the plan:** check the Sources panel; if the image chunk is missing, scope the question to both files (ask-scope chips) and re-ask once.

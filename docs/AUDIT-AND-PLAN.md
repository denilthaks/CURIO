# Phase 1: audit and implementation plan

## Audit of the repository before this change

| Area | Found |
|---|---|
| Stack | Vanilla HTML/CSS/ES modules, no build step, 2.5k lines. Hash router; DOM built with a text-only `h()` helper (no `innerHTML` for content). |
| Content | `data/quests/missing-signal.json` (9 scenes: dialogue, evidence, 5 choices, assemble, ending) and `data/world.json` (5 regions, 1 playable). |
| Engine | `js/game-engine.js`: pure functions for progression, evaluation, hints, reveal after 3 attempts, XP with first-try bonus, skill report and levels. |
| Validation | `js/quest-loader.js`: `validateQuest` and `validateWorld` (references, correct answers, feedback, every objective assessed). |
| Persistence | `js/progress-store.js`: localStorage schema v1 with a `migrate()` hook; validates and clamps loaded data; best-XP replay rule; handles corrupted, missing and blocked storage. |
| Tests / CI | 26 `node:test` tests (engine, store, validation), **all passing before any change**. A test workflow, and a Pages workflow publishing the repo root. |
| Assets | Favicon SVG and inline SVG art only. Relative paths throughout. |
| Accessibility | Skip link, focus management, live region, keyboard support, reduced motion, larger text, forced colours, 48px targets, status shown with text. |
| Deployment | GitHub Pages from `main`, published as-is (no build). |

## Decisions

- **Move to React + TypeScript + Vite + Three.js**, as requested. Nothing in the audit argued for keeping vanilla JS: the engine was already pure and portable, and a build step is cheap on Pages. The Pages workflow now builds and publishes `dist/`. A relative base keeps it working at `/CURIO/`.
- **Preserve:**
  - The Missing Signal quest content, unchanged except for two new metadata fields: `destination` and `subject`.
  - All engine rules, ported 1:1 to TypeScript.
  - Validation rules.
  - The save format, migrated v1 → v2 with no loss: identity, XP, completion, badges and settings all carry over, and stars are back-filled from the last finished run.
  - All 26 original tests, ported to Vitest.
  - Every accessibility feature listed above.
- **Refactor:**
  - The UI into React screens.
  - The engine to support new challenge types.
  - World data from "regions" to spatially positioned "destinations".
- **Create:**
  - The 3D world and asset pipeline.
  - SQL, Python, Excel and KPI challenge types with real evaluation.
  - Four new quests.
  - Stars, the progress and settings screen, and the graphics setting.
  - The 2D fallback.
  - End-to-end browser tests.

## Reconciling the brief

- **Regions:** Phase 3 lists the Signal Woods, Market Quarter, Workshop and Web Frontier. Phase 9 asks for the Signal Woods (SQL), Viking Workshop (Python), Trading Market (Excel) and Great Hall (analytics) on the island. Phase 9 is the more specific, later instruction, so the island has those four destinations. The Market Quarter becomes the Trading Market. The Web Frontier is kept as a **planned** destination on the island's pier tower, so all of Phase 3's regions exist without inventing an unfinished quest.
- **Signal Woods:** Phase 9 puts SQL there, but the existing AI-literacy quest also lives there and had to be preserved. So the Signal Woods holds two quests in order: The Missing Signal, then The Ledger in the Woods.
- **Python:** a full interpreter (Pyodide) is over 10 MB. The Workshop uses a small, sandboxed evaluator for Python *expressions*, with CPython-accurate semantics and error messages, which covers what the quest teaches.
- **Reference screens A–I:** the brief refers to a CurioTrail reference image of these screens. The images supplied were a fantasy world-map illustration, a render of the Viking Island and the island's texture atlas, not a screen mock-up. The screens were designed from the written description, using the requested palette: deep navy navigation, teal actions, gold rewards, and lush greens and turquoise water.

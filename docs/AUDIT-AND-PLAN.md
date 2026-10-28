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

---

# Learning platform, Phase 1: audit and plan

## Audit (before any change, against `main` at `fc54e59`)

Baseline: `npm run typecheck` clean, `npm test` **67 / 67**, `npx vite build` OK.

| Area | How it worked | Relevant files |
|---|---|---|
| Content | One JSON file per quest. Scenes are `dialogue`, `evidence`, `choice`, `assemble`, `sql`, `python`, `excel`, `kpi` and `ending`. `world.json` maps destinations to quests and to `unlockedBy`. | `public/data/` |
| Engine | Pure TypeScript. A run is `{ sceneIndex, inspected, results }`. Challenges track attempts, hints (index = attempts − 1), reveal after 3 tries, XP (+ first-try bonus), stars and a skill report. | `src/engine/game-engine.ts` |
| Progress | Schema v2 in localStorage. Best-XP and best-star replay rule. v1 → v2 migration. Everything validated and clamped. | `src/engine/progress-store.ts` |
| Unlocking | A destination is unlocked by quests, then quests unlock in order within the destination. | `src/engine/progression.ts` |
| UI | React screens. Quest steps are rendered by type. Shared feedback panel. Hand-written pointer drag for the KPI cards (no drag library). No syntax-highlighting library. | `src/ui/` |
| Styles | Design tokens plus base, components and game CSS. Teal for actions, gold for rewards, parchment cards on a navy world. | `src/styles/` |
| Tests | Vitest unit tests and a Playwright end-to-end script against the production build. | `tests/`, `e2e/` |

**Risk found:** saved runs record position only as an index (`sceneIndex`). Inserting lesson steps into existing quests would have moved a returning player mid-quest onto the wrong step, or blocked them on an unfinished one.

## What Phase 1 changed

- **Lessons** are a new non-scored scene type, `lesson`, stored in the quest JSON next to the step they prepare for. Each holds an objective, a plain-English explanation, an analogy, an example, why it matters, a common mistake, a takeaway, and an optional *simplification* disclosure. One `LessonCard` component renders them all. 11 lessons were added to the 5 existing quests, plus 2 in the new lab quest. `tools/add-lessons.py` records the content migration and is idempotent.
- **Learning-cycle labels:** challenges can carry `phase: guided | practice | assessment`, shown as colour-coded badges (Learn, Guided exercise, Practice, Check your understanding).
- **Lab:** a new `schema` challenge type inside a normal quest, *The Star Chart*. XP, stars, best-score replays, saving and unlocking therefore reuse the existing rules; there is no second reward system. The interaction reducer and validator (`src/engine/schema-lab.ts`) are pure and unit-tested. The workspace (`src/ui/quest/SchemaLab.tsx`) is 2D: SVG lines and HTML cards, pointer drag with arrow-key moving, click-to-connect, and a stacked layout on phones. No new dependency was added. Three.js wasn't used, because a 2D diagram is clearer here.
- **Validator rules,** computed from the lab's sample rows wherever possible:
  - expected tables present
  - fact table at transaction grain
  - relationships join key fields
  - dimension keys unique, so no accidental many-to-many
  - every foreign key finds a match
  - star shape: fact to dimension only, fact on the "many" side
  - learner-chosen cardinality matches the data
  - single filter direction
  - no ambiguous duplicate relationships
  - every dimension connected
  - extra tables are a warning only
- **Saves:** schema v3 adds `lessons` (read lessons, which give no XP) and a stable `sceneId` on runs. The v2 → v3 migration converts saved indices to step ids using a frozen table of the v2 step order (`V2_SCENE_ORDER`). It's tested with real v2 saves in unit tests and in the browser.
- **Prerequisites:** quests can declare `requires`. The lab requires *The Ledger in the Woods* (SQL) and comes after the dashboard quest at the Great Hall.
- **Curriculum:** `public/data/curriculum.json` defines eight modules (0–7). A module's status comes only from its real quests, so a module without quests shows **Planned**, with its planned topics listed as text and no controls. Each module records `requires` for Phase 2 gating, which isn't enforced yet.

### Module mapping

| Module | Content now | Notes |
|---|---|---|
| 0 Digital Foundations | The Missing Signal, The Broken Tally, The Market Ledger, The Jarl's Dashboard | AI literacy, Python, spreadsheets and KPI thinking are foundations for everything after. The KPI quest is tool-agnostic, so it isn't counted as Power BI. |
| 1 SQL Essentials | The Ledger in the Woods | |
| 5 Data Modelling | The Star Chart (lab) | |
| 2, 3, 4, 6, 7 | Planned | Topics listed; nothing playable is implied. |

## Designed for Phases 2–4 (not built)

- Each lesson names the objectives (`skills`) it teaches, and attempt history is kept per challenge. A Phase 2 "I don't know where to start" report can therefore map weak skills back to specific lessons and labs.
- `CurriculumModule.requires` and `Quest.requires` provide the data for prerequisite-based module gating.
- New challenge types (fill-in-the-blank SQL/DAX, debug-the-query) slot into `evaluate()` like `schema` did. Lesson examples already support a `dax` kind.

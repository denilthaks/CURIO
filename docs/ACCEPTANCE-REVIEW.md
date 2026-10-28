# Acceptance review: The Merchant's Ledger (gameplay-integrity and first-player-readiness pass)

Branch `feature/game-first-market-slice`. **Not pushed, not deployed, no pull request, nothing merged.** This covers one Excel chapter, a vertical slice. No learner has played it: nothing here, and no automated test, shows that the chapter is educationally effective.

History on this branch: `5dde7a5` vertical slice → `9de0cf6` review pass → `f23b52d` polish pass (accepted for internal review; its report is at `f23b52d:docs/ACCEPTANCE-REVIEW.md`) → this pass.

## 1. Priority 1: click-until-correct

### What the risk was

Each evidence step was a finite grid with unlimited picks. A player could try cells until one turned green. Retries cost first-time credit, and a reveal was offered after 3 misses, but nothing stopped enumeration. The 4-row verdict step could be brute-forced in 4 clicks.

| Step | Candidates | Risk before |
|---|---|---|
| Where is the honey? (cell) | 15 cells | Enumerable, slowly |
| Why the rope rotted (cell) | 18 cells | Enumerable, slowly |
| Audit III: missing coins (cell) | 16 cells (realistically the 4 count cells) | Enumerable among 4 |
| Audit V: verdict (row) | 4 rows | Trivially enumerable |
| Wheel CELL segment (cell) | 9 cells | Enumerable |

### Attempt policy (engine-enforced: `pickLimit`, `picksMade`, `submitAnswer`)

- **Pick budget:** wrong picks are limited to half the candidates, never more than 3. Concretely, 3 for each cell step and 2 for the 4-row verdict. With 2 of 4 rows, blind guessing passes at most half the time, and only after the working formula is right (see section 2).
- **Repeats are free:** the same cell, or the same row in a row step, is refused with "You already tried C3" and not counted.
- **Feedback, not answers:** every wrong pick is told what that cell shows. Where the player has a working column, it also says what their working shows on that row ("Row 3 (Honey): your profit column shows 60…"). A test checks that a wrong-pick message never contains the answer address. Practice steps add a hint from the first miss; boss steps from the second, as before.
- **The budget is visible:** "Wrong picks left: 2 of 3 · already tried: C3". On the last pick it adds "after one more miss the answer is shown, with no credit". Tried cells keep a ✗ mark.
- **At the limit:** the answer is shown with its explanation ("Out of picks: here's the evidence, and why"). It is counted exactly like a revealed answer: no XP, no boss credit, no first-time credit, the concept recorded as "seen", and Gold is ruled out.
- **Saves:** picks are saved with the run, so reloading cannot reset the budget. Tampered picks are cleaned (addresses only, at most 3). A replay starts with no picks.
- **Calculation misses are not picks:** a wrong working formula in the boss counts as an attempt (it lowers credit, like a wrong workshop formula) but uses no pick. Experimenting with the calculation is not punished as guessing.

### Accessibility kept

Every cell is a button with an address-and-value label. Tried cells add ", already tried"; the evidence adds ", the evidence". The name box accepts a typed address with Enter. No step needs drag-and-drop or precise pointing.

### Tests added

- **`tests/game-mechanics.test.ts` ("Evidence picks cannot be won by clicking until correct"):**
  - the budget per step;
  - repeat picks not counted, for cells and rows;
  - wrong-pick feedback never names the answer;
  - the limit shows the answer and the step earns 0 XP and 0 credit, with further submissions refused;
  - a locked step rules out Gold but not the unlock;
  - the wheel evidence segment follows the same policy;
  - picks survive restore, tampering is cleaned, and a replay is fresh.
- **`tests/saves-and-replay.test.ts`:** a mid-step reload through the real save store keeps the picks, so the third pick still locks.

## 2. Priority 2: does the boss assess the intended skill?

| Step | Claimed objective | Measured before this pass | Change | Measures now |
|---|---|---|---|---|
| I · Hrolf's figures (workshop) | Write formulas that fill down | Formula construction, relative refs; no preview | None | Same: formula construction |
| II · The short tax (repair) | Debug formulas; use ranges | Diagnosis plus repair, also checked on a hidden second dataset | None | Same: diagnosis and repair |
| III · The missing coins (evidence) | Use calculations to decide | Only a cell pick; arithmetic optional and unassessed | The expected-coins working column is **required and checked first**. It accepts `=B2*C2` or a difference column (`=D2-B2*C2`, `=B2*C2-D2`); typed numbers are rejected. Then the mismatching count is picked | Formula construction **and** evidence interpretation |
| IV · Hrolf's riddle (rune-word) | Choose and use SUM/AVERAGE… | Function choice by recall | Kept, but **weight 0.5** in the boss score | Recall, honestly weighted |
| V · The verdict (evidence) | Decide with data (profit, not revenue) | Only a row pick out of 4 | The profit working column `=B2-C2` is **required and checked first**; then the row is picked | Formula construction **and** the decision |

**Scoring now reflects what is demonstrated.**

- The boss score is the weighted average of step credit (1 / 0.6 / 0.3 / 0), with weights 1, 1, 1, 0.5, 1. The pass mark stays 70%.
- Missing the rune step costs 11 points (4/4.5 = 89%). Missing a formula step costs 22 points (3.5/4.5 = 78%). Both are tested.
- The tasks were not made harder for their own sake. The working formulas are the ones taught earlier in the chapter (revenue in round 2, profit in the Gambit). Working-column preview stays on, because using your calculation to read the ledger is the skill being assessed.

**Tests added ("The boss assesses the skill each step claims"):**

- No working means the pick is not counted.
- Typed numbers fail without using a pick.
- Expected and difference columns are both accepted.
- The verdict needs profit, not revenue.
- Wrong-pick feedback quotes the player's own working.
- The weighting is checked.

## 3. Priority 3: segmented question cards

| Moment | Before | Now | Why kept or changed |
|---|---|---|---|
| After a right answer | Strip with a generic "Continue →" | Button names where it leads: "Next round: The typical price →" or "Next stage: …". Focus lands on it, with the result as its description, so one Enter moves on | The next action follows from the story. Explicit confirmation is kept so players can look at the ledger verdict, and keyboard and screen-reader users keep control of pacing |
| After a wrong answer | Strip, hint, reveal | Same, plus ✗ marks and the pick budget in the scene | Recovery needs the player to read; nothing auto-advances |
| Story transitions | "Open the ledger", "Face the audit", "See your results" | Unchanged | Already narrative actions |
| Practice rounds | "Continue" | "Practise again" | Says what it does |

**Not done:** auto-advance after a correct answer. It would remove time to read the verdict, could surprise screen-reader users, and conflicts with reduced-motion expectations. If it is tried later, it should be an opt-in setting.

**Perceivable without colour, animation or 3D:**

- Ledger verdicts now carry ✓/✗ marks plus screen-reader text ("(right)", "(wrong)", ", already tried", ", the evidence").
- The pick budget is text.
- The result strip is text and receives or announces focus.
- The 2D and 3D reactions are decorative extras (`aria-hidden`), never the only signal.
- "Why it works" stays one disclosure away; revealed or locked steps show the full explanation.

## 4. Priority 4: usability test

The plan is in `docs/USABILITY-TEST.md`. **No sessions have been run; there are no findings.** It contains:

- A facilitator-free script for 3–5 newcomers: verbatim instructions and 5 task prompts.
- 13 observations to record.
- Completion criteria: completed, recovered, explained, found the outcome.
- 10 post-play questions, two with scoring rubrics (fill-down, `$`).
- Reporting rules: counts not percentages, verbatim quotes, no effectiveness claims.
- A separate screen-reader checklist (NVDA, VoiceOver, TalkBack) and a real-device mobile checklist.

The organiser's start-state save snippet is checked by a unit test, so the plan does not rely on an untried setup.

## 5. Regression and scope

- **Preserved:**
  - save schema v4 and the v3 migration;
  - medal rules (mastery evidence only);
  - optional silver wagering, independent of XP, medals, mastery and unlocks (tests unchanged and passing);
  - reduced motion, keyboard alternatives and the no-WebGL fallback.
- **Not touched:**
  - the SQL, Python and schema engines (`sql-check.ts`, `python-lite.ts`, `schema-lab.ts`);
  - `world.json` and the curriculum;
  - every quest except `market-ledger.json`;
  - DAX appears only as a lesson-example label (`LessonCard.tsx`, `types.ts`); there is no DAX engine, and nothing DAX-related changed.
- **Shared UI changed in this pass:** `GameFeedback` (game quests only), `LedgerGrid` (verdict marks; only game views use it) and the e2e `next()` helper (also accepts "Next round/stage").

## 6. Verification on the final state

| Check | Result |
|---|---|
| `npm test` | **208 passed** (194 before this pass). New: 7 pick-policy tests, 5 boss-assessment tests, 2 save tests (picks through the real store; the usability start save). Existing helpers were updated to pick fresh wrong cells and supply the required working formula |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Succeeds |
| `npm run e2e` | **34/34 passed** on the final build. P9-6c now also checks the pick budget text, the refusal of a repeated pick, and that the boss requires the working formula before a pick. The `next()` helper accepts "Next round/stage". An earlier run hit my 590 s timeout during L5 while unit tests ran alongside; rerun alone, it passed |
| Diff against `main` | Changes are limited to the Market quest, the game engine, types, game UI, styles, tests and docs. `sql-check.ts`, `python-lite.ts`, `schema-lab.ts`, `world.json`, the curriculum and all other quests are unchanged |
| Play-throughs | Desktop 1360×860 (software WebGL), phone 390×844 (touch) and graphics off: all **Gold**, with no console errors. Weak player (boss calculations wrong, guessed cells, then revealed): **no medal**, mastery 0, Great Hall sealed with an explanation, no console errors. After a right answer, focus was on "Next round: The typical price →" |
| Screenshots reviewed | Wrong pick with ✗ and the "2 of 3" budget; solved pick with ✓ and the named next step (phone); boss working column checked first (desktop and phone); verdict row marked ✓ after correct working. A phone layout problem found here was fixed and re-checked: the working column was cut off and headings broke mid-word |

## 7. Known limitations

1. Two of the four verdict rows can still be guessed once the profit column is right. At that point the decision is reading the smallest number, which is the intended skill, but a guesser can still pass with reduced credit.
2. Hints are per step, not per mistake.
3. The rune-word weight (0.5) is a design judgement, not calibrated against learner data.
4. Phone layout: the sticky top bar plus the pinned HUD cover 23–41% of the screen, depending on phone and text size (measured in section 9.3; the earlier "about 35%" was an estimate). Evidence ledgers with a working column fit at 390 px.
5. Performance on real devices is unmeasured (software rendering in tests runs at 6–9 fps).
6. Screen-reader behaviour is designed and code-reviewed, but not yet tested with real assistive technology.
7. Educational effectiveness is unknown. It needs the sessions in `docs/USABILITY-TEST.md` at minimum, and a proper learner study before any claim.

## 8. Proposed next steps (for your decision)

1. Run the usability sessions and the screen-reader and real-device checklists; triage the issues found.
2. Mistake-specific hints for the common formula errors (relative vs absolute, missing brackets, revenue vs profit).
3. A compact phone quest layout (merge the top bar and HUD).
4. Only then extend the pattern to other domains.

## 9. Final verification pass (on `c115b4d`; verification only)

No game code changed in this pass. Added: two test files that pin the audited behaviour, this section, and a corrected limitation (4). Throw-away measurement scripts live only in the session scratchpad.

### 9.1 Boss scoring matrix

**Per-step credit**, played through the engine (`tests/boss-scoring-audit.test.ts`, part 1):

| Step (weight) | First time | One extra try | More tries | Budget exhausted | Revealed |
|---|---|---|---|---|---|
| I · revenue workshop (1) | 1 | 0.6 (one wrong formula) | 0.3 | n/a | 0 |
| II · tax repair (1) | 1 | 0.6 (a wrong diagnosis counts, even with a right fix) | 0.3 | n/a | 0 |
| III · missing coins (1) | 1 | 0.6 (one wrong working **or** one wrong pick) | 0.3 | 0: locked after 3 wrong picks | 0 |
| IV · rune-word (0.5) | 1 (solved within par = 3 guesses) | 0.6 (4 guesses) | 0.3 (5–6 guesses) | n/a | 0 |
| V · verdict (1) | 1 | 0.6 (one wrong row or one wrong working) | 0.3 only through working misses | 0: locked after 2 wrong rows | 0 |

Boss score = Σ weight × credit ÷ 4.5. Pass = boss score ≥ 70%.

**All 4⁵ = 1024 combinations** (`boss-scoring-audit.test.ts`, part 2):

- **Formula:** the engine score equals the formula for every combination, and passes exactly when the score is ≥ 70%.
- **Passes:** 100 combinations pass.
  - 27 of them contain one step at 0.
  - 12 of those 27 have a full-weight step (I, II, III or V) at 0. Each is one zero with every other full-weight step first time; the rune-word can be 1, 0.6 or 0.3 (78%, 73% or **exactly 70.0%**).
  - The other 15 have the rune-word at 0.
- **Failures:** two full-weight zeros never pass. All steps at 0.6 scores 64.4% and fails.
- **Medals** (with all other rounds first time): 11 Gold, 89 Silver, 924 none.
  - Gold never occurs with any step at 0 (revealed or locked), and always has a boss score ≥ 85%.
  - Stars always equal the medal (3/2/1/0).
- **Outside the boss:** a locked or revealed round elsewhere rules out Gold but never blocks the unlock.
- **Great Hall:** it opens only from a stored completion whose run passed the boss. A failed boss (two zeros, or all at 0.6) leaves it locked.

**No unintended pass, medal or unlock was found against the stated rules.** Two outcomes follow the rules but may not match your intent. They need a decision, not a fix:

- **D1:** a player can have a whole full-weight boss step revealed or locked (for example, the formula-construction step) and still pass. They get Silver and the Great Hall, if every other full-weight step was right first time. The previous equal weighting allowed this too (80%).
- **D2:** the 70% threshold is reachable exactly (one revealed full-weight step plus the rune-word at 0.3). The rule is "≥ 70%", so this passes.

### 9.2 Persistence

All verified by `tests/persistence-audit.test.ts` through the real save store, unless marked "code".

| Situation | Behaviour |
|---|---|
| Refresh during an evidence step | Same step and the same data variant (the seed is saved); spent picks and attempts kept; the next wrong pick is judged against the same budget |
| Refresh after a step locked | Stays solved-and-revealed with no credit; further picks refused |
| Refresh after a wrong working formula | Attempt kept, no pick spent |
| Typed working formula, selected cell, last feedback text (code) | **Not saved** (component state). After a refresh the player retypes the working formula; tried cells and the budget are shown again from the saved run |
| "Out of picks" wording after a refresh (code) | Not saved: a locked step reopened after a refresh reads "Here's the answer". The result is identical |
| Tampered picks | Cleaned to addresses, at most 3. Extra stored picks can only make the budget smaller. Deleting picks from local storage restores the normal budget; that cannot be prevented in a client-only game, and no stored record gains anything from it |
| Replay | New run: new seed, no picks, no results. The stored best XP, medal, mastery and unlock are untouched |
| Practice rounds (code) | Never saved; a refresh starts a fresh practice round |
| v3 save migration | Completion, XP, stars, badge and lessons kept; counted as mastered; no medal claimed |
| Records from earlier rules on this branch | Stored mastery, best medal and best stars never go down, so a record earned under an earlier rule (e.g. `f23b52d`, before working columns were required) keeps them. The results screen without a fresh completion rescores the last run under current rules and may show a different medal from the stored best ("best so far"). Only development saves from this unreleased branch can be affected; no released build wrote these records |

**Unresolved ambiguity.** Should a stored best medal earned under an older rule set be kept or recomputed? Current behaviour: kept. I recommend clearing local development saves before the usability sessions (the test plan's setup snippet already starts from a clean save).

### 9.3 Mobile HUD

Measured with Chromium at phone sizes, during the first evidence step, graphics off:

| Viewport | Text size | Top bar | Pinned HUD | Covered now | With proposal |
|---|---|---|---|---|---|
| 390 × 844 | normal | 106 px | 84 px | 190 px (23%) | 84 px (10%) |
| 360 × 640 | normal | 106 px | 84 px | 190 px (30%) | 84 px (13%) |
| 390 × 844 | large | 174 px | 91 px | 265 px (31%) | 91 px (11%) |
| 360 × 640 | large | 174 px | 91 px | 265 px (41%) | 91 px (14%) |

The site's sticky top bar is the larger share, not the quest HUD.

**Proposal: the smallest safe change, not implemented.** On screens narrower than 900 px, and only while a quest or practice round is open (the `app--quest` / `app--practice` route classes), let the site top bar scroll away and pin the quest HUD at the top. It is two CSS rules:

```css
@media (max-width: 899px) {
  .app--quest .topbar, .app--practice .topbar { position: static; }
  .app--quest .quest-hud--pinned { top: 0; }
}
```

This was prototyped by injecting the rules into the page (not committed). It is what produced the right-hand column above.

- **Kept:** the HUD (round runes, XP, silver purse, Codex), DOM order, focus order, screen-reader landmarks and the skip link. Reduced motion is unaffected (no animation involved).
- **Trade-off:** the site navigation and total-XP bar scroll out of view during a quest; scrolling up brings them back. Desktop is unchanged.
- **Risk to check if approved:** e2e A16 (mobile layout).

A related small inconsistency was found (not fixed): the visible badge says "Round 1 of 12", counting non-boss rounds, while the HUD's screen-reader text says "Round 1 of 17", counting every challenge.

### 9.4 Other findings from reading the code

- **F1 (low):** when an evidence step locks because the budget ran out, `recordStep` is not called, because the quest and practice screens record a step only when `outcome.correct`. A manual "Show me the answer" reveal does record a "revealed" concept event. So locked steps leave no trace in concept mastery: never an over-count, but inconsistent. Fix if approved: also record when `outcome.locked` (two lines).
- **F2 (low):** the Round "x of n" mismatch for screen readers described in 9.3.
- **F3 (info):** `withCompletion` defaults `mastered` to true when a caller omits it. The only caller (the quest screen) always passes it; it matters only for future callers.
- **Course quests:** the shared view changes (`Scenes.tsx`, `common.tsx`) are additive (`sheet` and `mechanic` render only when present; `isFirstTry` equals the old `attempts === 1` for course steps), so course-quest behaviour is unchanged.

### 9.5 Checks run on `c115b4d` plus the two audit test files

| Check | Exact outcome |
|---|---|
| `npx vitest run` | Exit 0: **11 test files, 228 tests passed** (208 before, plus 12 in `boss-scoring-audit.test.ts` and 8 in `persistence-audit.test.ts`) |
| `npx tsc --noEmit` | Exit 0, no errors |
| `npm run build` | Exit 0 |
| `npm run e2e` | Exit 0: **34/34 checks passed** (run alone) |
| Play-through, desktop 1360×860, software WebGL | Exit 0. Gold; mastered; boss 100%; Great Hall open; 11 concept records; focus on "Next round: The typical price →" after a right answer; no console errors; 5 fps (software rendering) |
| Play-through, phone 390×844, touch | Exit 0. Gold; mastered; same focus behaviour; no console errors; 8 fps |
| Play-through, graphics off (2D fallback) | Exit 0. Gold; mastered; no console errors |

**Not run in this pass:** the weak-player play-through. It last ran on `c115b4d` in the previous pass: no medal, mastery 0, Great Hall sealed. Its rules are now covered exhaustively by `boss-scoring-audit.test.ts`.

### 9.6 Remaining risks

1. D1 and D2 above (policy decisions).
2. F1 and F2 (small inconsistencies, not fixed in a verification-only pass).
3. No real device, screen reader or player has used the chapter. `docs/USABILITY-TEST.md` is still a plan with no findings.
4. Rendering performance on real phones is unknown (5–8 fps in headless software rendering says nothing about real GPUs).
5. Educational effectiveness is not established by any of the above.


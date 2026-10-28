# Acceptance review: The Merchant's Ledger game-first slice

Branch `feature/game-first-market-slice`. **Not pushed, not deployed.** This is a review of a vertical slice (one Excel quest), not of the full game-first vision.

## Verdict

The slice is ready for approval as a **vertical slice**:

- Medals now come only from demonstrated mastery, so Gold is reachable without any wager.
- Every mechanic evaluates the player's own work.
- Existing saves keep everything they earned.

It still feels partly like a quiz; see section 2. SQL, DAX, Power BI and Excel Chapter 2 have not been started.

## 1. Diff safety (nothing unrelated damaged)

| Check | Evidence |
|---|---|
| Other quests unchanged | `git diff main --name-only -- public/data/quests` lists only `market-ledger.json` |
| Other engines, world and curriculum unchanged | No diff in the SQL and Python engines, `world.json` or curriculum files |
| Quest ids kept | `row-revenue` and `total` keep their ids, so old results carry over |
| Existing tests | All 99 pre-existing tests pass. Two were updated deliberately: the lesson test now accepts concept-tagged game quests, and an e2e assertion covers the new title and save v4 |
| e2e | `npm run e2e`: 34/34 passed, including "a save from the previous release resumes on the right step" and "no console errors during the whole run" |

## 2. Where it still feels like a quiz

These come from the screenshots of four scripted browser play-throughs (desktop, phone, graphics off, weak player).

| Finding | Status |
|---|---|
| Course badges ("Practice", "Guided exercise") on every step | **Fixed.** Game quests now show "Round x of 13" and "Boss · stage k of 5" |
| The HUD (runes, XP, purse) scrolled away | **Fixed on desktop** (≥ 900px): it is pinned, and focus targets land below it. Phones still scroll it away |
| Wheel segments were mostly multiple choice | **Improved.** 4 of 6 segments are now formulas (MAX, and `$` lock with fill-down). 2 remain multiple choice |
| Wheel text still said "Stake XP" | **Fixed.** It now says silver, and that silver never changes XP or medals |
| Every step is a parchment card with a Check → "Correct!" → "WHY IT MATTERS" → Continue loop | **Open.** This is the strongest remaining quiz signal |
| 4 plain multiple-choice scenes (find-cell, explain-restock, two boss steps) | **Open.** The boss ones vary with data, but they are still pick-one |
| On phones the match shows a select menu under every rune, as well as the cards | **Open.** It reads like a form; the menus should be collapsed behind a "use menus" toggle |
| The 3D stall's reactions are barely visible beside the panel | **Open** |
| Results page is about 3 screens long (medal, XP, stars, badge, skills, strengths, 18 replay links) | **Open** |
| Stars and medals are two parallel ratings | **Open.** Confusing; one should go for game quests |

## 3. The seven mechanics

| Mechanic | Player interaction | What is really evaluated | Distinct feedback | Weakness |
|---|---|---|---|---|
| Ledger Workshop | Builds a formula from fragments by drag, tap, keyboard or typing | excel-lite runs it with fill-down. Every target cell is compared, required functions are checked, and typed constants are rejected | Per-cell results, plus "when filled down it becomes …" | None significant |
| Repair Mission | Diagnoses the fault, then writes the fix | Diagnosis id, then the fix on the ledger **and** on a second hidden dataset | Separate diagnosis and fix messages; data-specific failure | Diagnosis is a radio pick |
| Rune-word | Wordle-style guesses of function names | Letter scoring with repeats; guesses must be one of 377 real function names; par decides "first time" | Coloured letter tiles; invalid words are not counted | Tests recall of the name, not its use (a workshop round follows to cover that) |
| Rune Wheel | Spins (seeded, cannot be re-spun), then solves the landed task | 4 formula segments via excel-lite (one needs `$E$2`, so typed constants fail), 2 choice segments | Same as the workshop or choice it lands on | The spin itself involves no skill (by design: it chooses what to review, never a payout) |
| Rune match | Pairs error runes with causes | Exact pairs | Each wrong pair is explained | Recognition-level only |
| Trader's Gambit | Sets order quantities within a purse and writes a profit formula | The formula is checked row by row against the outcome of the player's own orders, and probed with over-demand and zero orders; the purse and target are enforced | The purse refuses overspending; real profit is reported | Strongest mechanic |
| Explain / Mystery (`choice` + sheet) | Reads a ledger and picks an answer | Option id; in the boss it depends on the data variant | Option-specific feedback | Still multiple choice: the most quiz-like mechanic |

Conclusion: six of the seven are genuinely different kinds of interaction with different evaluation. Explain/Mystery is a dressed-up multiple-choice question, and should become "point at the cell that proves it" (see P1).

## 4. Medals

- XP is earned only for solving rounds.
- Medals come only from mastery evidence:
  - Bronze: boss ≥ 70%.
  - Silver: Bronze and ≥ 60% of rounds right first time.
  - Gold: boss ≥ 85%, ≥ 80% of rounds right first time, and nothing revealed.
- Wagers are an optional silver purse that never touches XP, medals, mastery or unlocks.
- Tests (`tests/game-mechanics.test.ts`) prove:
  - a perfect run with no stakes earns Gold;
  - the same run with stakes gets the same medal and XP;
  - one reveal gives Silver;
  - 7 retries give Bronze;
  - a revealed boss gives no medal;
  - boss retries give Silver and still count as mastered.
- Browser: Gold was earned with stakes on desktop, with no stakes on phone and graphics-off, and no medal in the weak run.

## 5. Excel engine audit (`tests/excel-lite-audit.test.ts`)

excel-lite is a **teaching evaluator, not Excel**, and the docs no longer claim otherwise.

- **Supported:**
  - numbers, `.5`, `%`;
  - A1 and `$A$1` references, ranges inside functions;
  - `+ - * / ^`, unary minus with Excel precedence (`=-2^2` is 4, `=2^3^2` is 64);
  - `SUM AVERAGE MIN MAX COUNT ROUND` (Excel half-away-from-zero rounding);
  - `#DIV/0! #NAME? #VALUE! #REF! #NUM!`;
  - fill-down.
- **Bug found and fixed:** a range that contains its own cell (`=SUM(D1:D7)` in D6) was accepted. It is now a circular reference.
- **Unsupported, with an honest message:**
  - comparisons `= < >`;
  - text and `&`;
  - other sheets `!`;
  - TRUE and FALSE;
  - Unicode minus, × and ÷, which get a hint to use the keyboard operator instead.
- **Known differences, pinned by tests:**
  - Stricter than Excel: Excel auto-closes a missing bracket and accepts an empty argument, `D:D` and columns past Z.
  - More lenient than Excel: `;` is accepted as a separator, and `MAX()` returns 0.
  - Floating-point display can differ in the last digit.
  - Single-letter columns only.

## 6. Saves, mastery, replay and the boss gate (`tests/saves-and-replay.test.ts`)

| Case | Result |
|---|---|
| v3 player who finished the old quest | Keeps completion, XP, stars, badge, lessons and the Great Hall. Shows "Completed in an earlier version" until replayed; no medal is claimed |
| v3 player mid-quest | Resumes at the first new step (`rune-max`) with earlier results kept; Great Hall stays locked |
| Legacy player fails the new boss on replay | Keeps the Great Hall; best XP is kept |
| Legacy player passes the new boss on replay | Gold is added; completions count correctly |
| New player fails the boss | Quest completed, but no badge and Great Hall locked. Passing later unlocks it exactly once |
| Replays | Keep the best medal; never stack XP |
| Tampered saves | Mastery without completion, unknown medals, negative silver and bad concept data are cleaned. Saves from a newer version are not trusted |
| Concept mastery | Reveals, retries and same-day repetition cannot reach "mastered"; it needs ≥ 3 first-try successes in ≥ 3 contexts over ≥ 2 days |

Caveat: v4 saves made by earlier builds of **this unreleased branch** may hold a medal earned under the old wager rule. No released version wrote v4.

## 7. Outstanding issues

- No human play-testing and no screen-reader testing.
- Performance on real hardware is unmeasured. Headless software rendering ran at 6–9 fps, with about 3 s per click at desktop size.
- The quiz-feel items marked Open in section 2.
- The phone HUD is not pinned.
- The legacy `excel` scene type still accepts numeric-only expected values.

## 8. Prioritised improvements

1. **P1:** Replace the remaining multiple-choice steps with action-based evidence. For example, "click the cell that proves it" for explain and verdict, and a formula for the two remaining wheel segments.
2. **P1:** Make feedback part of the scene: the stall and ledger react in place, and the "WHY IT MATTERS" panel is folded into the Codex or shown only after a miss.
3. **P1:** Use one rating for game quests: drop stars in favour of medals.
4. **P2:** Collapse the results page: medal, XP, unlocks and next action first; skills and replay links behind a disclosure.
5. **P2:** Pin a compact HUD on phones; collapse the match select menus behind a toggle.
6. **P2:** Make 3D reactions visible: zoom the camera on the stall during rounds.
7. **P3:** Measure on real devices; run a screen-reader pass; play-test with 3–5 learners.
8. **P3:** Extend excel-lite only as later quests need it (comparisons and IF, text and `&`), keeping the "not supported" messages.

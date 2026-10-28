# Game-first vertical slice: The Merchant's Ledger

Status: **vertical slice only**, on branch `feature/game-first-market-slice`. It has not been pushed or deployed. The rest of the game-first vision (the other domains, the later Excel arcs, the cross-domain capstone) is planned, not built.

## 1. What the slice proves

The slice is one Excel quest that runs through the full game loop:

**explore → discover → experiment → solve → see consequences → unlock → recall → master**

| Loop stage | In the slice |
|---|---|
| Explore | The island map. Hovering or focusing a destination card makes its 3D marker rise and glow. |
| Discover | The Trading Market now has a procedural market stall (crates, coin stack, balance scales, lantern) beside Tove. |
| Experiment | Live ledger previews and the bench of formula fragments. Previews never count as attempts. |
| Solve | 13 rounds across 7 mechanics, all evaluated by the engine. |
| See consequences | The scales level or tip, coins pop, crates lift. In 3D, the stall's coins hop or its crates shudder. The Trader's Gambit reports the real outcome of the player's own orders. |
| Unlock | The Great Hall opens only when the boss mission (Hrolf's audit) reaches 70% mastery. A rising beam and sparks reveal it on the map. |
| Recall | The Rune Wheel draws only on concepts already taught, weighted towards weak or fading ones. Practice rounds can be replayed with fresh data. |
| Master | Per-concept records (seen → practised → demonstrated → mastered). Mastered requires first-time success on a later day. |

## 2. Mechanics

All are pure TypeScript in `src/engine/` and unit-tested. The UI is in `src/ui/games/`.

| Mechanic | Scene type | What is really checked | Accessible alternative |
|---|---|---|---|
| Ledger Workshop | `workshop` | The assembled formula is run by excel-lite, with fill-down. Every target cell is compared. Required functions are checked. Typed-in numbers are rejected. | Tap or Enter on fragments; Backspace removes one; *Type it instead* |
| Repair Mission | `repair` | The diagnosis must match. The fix must pass on the ledger **and** on a second dataset, so a typed result cannot pass. | Radio buttons and a text field |
| Rune-word (Wordle-style) | `runeword` | Wordle scoring, repeated letters included. Guesses must be real Excel function names: a dictionary of 377 names generated from the encyclopedia inventory. Invalid guesses are not counted. Solving within par counts as "first time". | Text field; the on-screen keyboard is optional |
| Rune Wheel | `wheel` | The spin is seeded and reproducible, and cannot be re-spun. The landed segment's challenge is evaluated: four of six segments are formulas run by excel-lite (one filled down, one requiring a cell reference rather than a typed constant); two remain multiple choice. The spin never decides a payout. | Spin button; reduced motion lands instantly |
| Rune match | `match` | Exact pairs; each wrong pair is explained. | A select menu per rune |
| Trader's Gambit | `gambit` | The player's profit formula is checked row by row against the true outcome of **their** orders. It is also probed with orders above demand and zero orders, so a formula that ignores demand fails. The purse and target profit are enforced. | Number fields with +/− steppers |
| Explain the outcome / Mystery | `choice` with a `sheet` | Option IDs. In the boss, the correct answer depends on the run's data variant. | Radio buttons |

**Boss mission (Hrolf's audit).** Five steps of mixed types: workshop, repair, investigation, rune-word and verdict.

- Workshop, repair and the two choice steps each have three data variants, chosen by the run's seed. A memorised answer from one run fails on another (tested). The rune-word step is fixed.
- The first hint is held back until the second miss.
- Step titles never name the function to use.
- Boss workshop and repair steps show no live preview: the formula is only checked when submitted.

## 3. Medals, XP and the optional silver purse

These are three separate things. Only mastery evidence decides a medal or an unlock.

**XP** is earned for solving rounds (more for right-first-time). It is never staked and never lost.

**Medals** come from demonstrated mastery only (`computeMedal` in `game-engine.ts`):

| Medal | Requirements |
|---|---|
| Bronze | Final challenge passed (boss ≥ 70%) |
| Silver | Bronze **and** ≥ 60% of rounds right first time |
| Gold | Boss ≥ 85% **and** ≥ 80% of rounds right first time **and** no answers revealed |

A player who never stakes anything can earn Gold. Tests check that the medal and XP are identical with and without stakes. The results card shows the evidence (final-challenge %, rounds right first time, answers revealed) and what the next medal needs. Replays keep the best medal and never take mastery away.

**Silver purse (optional wager side-game).** The first rune-word, the wheel and the gambit offer an optional stake of up to 50% of the purse, placed before the first attempt. Right first time (or within par for the rune-word) wins the stake; otherwise it is lost. The purse never falls below 50% of what was earned. Silver is shown separately in the HUD and the results card, and it never changes XP, medals, mastery or unlocks. There is no money, nothing purchasable, and luck never decides a payout.

**Existing players.** Quests completed under the earlier version keep their completion, XP, stars, badge and unlocks. They show "Completed in an earlier version" instead of a medal until replayed.

## 4. Engine truth

- **excel-lite now follows Excel:**
  - `=-2^2` is 4;
  - `=2^3^2` is 64;
  - `ROUND` rounds halves away from zero and uses the decimal value (`ROUND(1.005,2)` = 1.01);
  - `.5` and `10%` literals work.

  These match the discrepancies recorded in the Excel Encyclopedia, Volume 12.
- Content validation (run at load time and in tests) rejects quests whose solutions fail on any data variant, whose broken formulas aren't broken, whose wheel segments use untaught concepts, whose workshop solutions can't be built from their fragments, or whose concepts have no Codex card.
- excel-lite is a teaching evaluator, **not** full Excel. `tests/excel-lite-audit.test.ts` pins down the quest formulas, error codes and circular references (including a range that contains its own cell), and documents known differences: stricter on missing brackets, empty arguments, whole-column `D:D` and two-letter columns; more lenient on `;` as a separator and `MAX()` with no arguments. Unsupported syntax (comparisons, text and `&`, other sheets, TRUE/FALSE) gets an honest "Not supported in this ledger" message instead of an invented Excel error.
- Save schema **v4**: per-concept mastery, medals and mastery flags. v3 saves migrate with completed quests counted as mastered, so no one loses an unlock.

## 5. The Codex

`public/data/codex.json` holds 11 concept cards written from the Excel Encyclopedia, each with its volume, chapter and page. They are opened on demand from the quest HUD or a practice round. The concept IDs match encyclopedia Volume 12 (`XL.REF.ABSOLUTE`, etc.).

## 6. Proposed cross-domain curriculum map

```
ARRIVAL (AI literacy: The Missing Signal)
   ├─► MATHS · Rune Stones (number sense, %, ratios, averages) — light, alongside Excel
   ▼
EXCEL · Trading Market   Arc 1 Merchant's Ledger (built) → Arc 2 Missing Shipment → Arc 3 Northern Expansion
   ├─► SQL · Signal Woods     SELECT/WHERE → JOIN/GROUP BY/HAVING/NULL → subqueries/windows
   ├─► PYTHON · Viking Workshop (parallel branch)
   ▼
POWER BI · The Observatory   Power Query → model → visuals/slicers → performance & defensible insight
   ▼
DAX · Great Hall engine      measures → filter context & relationships → time intelligence & patterns
   ▼
CAPSTONE · The Jarl's Council (cross-domain mystery; maths/statistics woven in)
```

**Excel arcs** (concept IDs from encyclopedia Volume 12):

| Arc | Concepts | Boss | Status |
|---|---|---|---|
| 1 · The Merchant's Ledger | Addresses, formulas, references ($), SUM/AVERAGE/MIN/MAX, precedence, errors, profit | The Tax Collector's Audit | **Built** |
| 2 · The Missing Shipment | IF/AND/OR/IFS, SUMIFS/COUNTIFS, XLOOKUP, text cleaning, dates, PivotTables, charts | The Smuggler's Books | Planned; needs excel-lite steps 1–6 |
| 3 · The Northern Expansion | Dynamic arrays, LET/LAMBDA, PMT/NPV, CORREL/forecast, what-if | The Jarl's Investment | Planned |

**SQL, Power BI, DAX, Python and Maths** reuse the same scene contract, run seed, wager, medal, mastery and Codex systems. Each needs its own evaluator:

| Domain | Evaluator |
|---|---|
| SQL | The existing real SQLite runner |
| Python | The existing python-lite sandbox |
| DAX | A scoped filter-context simulator over a defined model — to be built and clearly labelled |
| Power BI | Model and visual-interaction simulators — to be built and clearly labelled |

## 7. WebGL fallback and reduced motion

- **Graphics off, or WebGL unavailable:** the 2D fallback map is used and the whole quest is playable. Tested by a scripted play-through with graphics off, and by e2e checks A15a and A15c.
- **Reduced motion** (system setting or the in-game setting):
  - all CSS animations are cut by the global rules in `base.css`;
  - the wheel lands instantly;
  - markers lift without easing;
  - the 3D stall stays still;
  - celebration bursts are skipped.
- Every drag action has a tap, keyboard or select alternative. There are no timed challenges in this slice.

## 8. Verification (what was actually run)

| Check | Result |
|---|---|
| `npm test` (Vitest) | **183 passed**: 99 existing (2 updated for the new design), plus mechanics, medal/wager, excel-lite audit and save/replay tests |
| `npm run typecheck` | Clean |
| `npm run build` | Succeeds |
| `npm run e2e` | **34/34 passed**. P9-6c rewritten for the new quest; two assertions updated for the new title and save v4 |
| Scripted full play-through, desktop 1360×860 (Chromium, software WebGL) | Gold with stakes placed; Great Hall unlocked; 11 concept records; no console errors |
| Same, phone viewport (390×844, touch) | Gold; no console errors |
| Same, graphics off (2D fallback) | Gold; no console errors |
| Same, boss answers revealed | No medal; mastery 0; Great Hall stays sealed with an explanation; no console errors |

The review findings and the prioritised improvements are in [ACCEPTANCE-REVIEW.md](ACCEPTANCE-REVIEW.md).

**Not done:**

- No human play-testing.
- No screen-reader testing (NVDA, VoiceOver, TalkBack).
- No measurement on real phones or GPUs. Headless software rendering reported 7–10 fps, which says nothing about real hardware.
- The legacy `excel` scene type still has a numeric-only `expected`.
- In headless software rendering each click took about 3 s at desktop size. Real-hardware performance is unmeasured.

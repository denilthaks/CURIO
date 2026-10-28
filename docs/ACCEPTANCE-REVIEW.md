# Acceptance review: The Merchant's Ledger game-first slice (polish pass 2)

Branch `feature/game-first-market-slice`. **Not pushed, not deployed, no pull request.** This reviews one Excel quest (a vertical slice), not the full game-first vision. No learner has played it, so nothing here claims educational effectiveness.

## 1. What changed in this pass

### 1.1 Feedback happens in the scene, not in a card

The old loop was: card → Check → "Correct!" panel → "WHY IT MATTERS" → Continue. A new `GameFeedback` component (`src/ui/games/feedback.tsx`) replaces it for every game mechanic.

**The ledger gives the verdict in place.** After a check, each target cell turns green (right) or red (wrong, with a short shake), while the formula on screen is the one that was checked.

- Workshop, repair and wheel-formula steps all do this.
- Boss steps still show no live preview. After a check they show what the checked formula produced.

**The world reacts:**

- Evidence, repair and gambit steps now have a market reaction beside their ledger too (scales tip or level, coins pop, crates lift), not just some workshops. Rune-word and match steps react through their own tiles and pairs.
- The 3D stall now stands beside Tove, inside the quest camera's view. Previously it was about 27 units away and barely visible.
- Right answers make sparks rise from the stall and its coins hop higher. Wrong answers shake its crates harder.
- Its lantern turns green-gold or red, a colour change that still shows with reduced motion.

**The words are a one-line strip:**

- The engine's own feedback plus "+XP · first try".
- "Why it works" sits behind a disclosure.
- Wrong answers show the specific issues (without repeating the headline) and the hint, attributed to the character.
- Revealed answers still show the full explanation.

**Accessibility:**

- The existing focus target (`[data-feedback]`) and live-region behaviour are kept.
- Everything is text or table markup, and animation is removed by the reduced-motion setting.
- Course quests still use the original feedback card; they are unchanged.

### 1.2 No plain multiple choice left in the quest

There is a new mechanic, **Evidence hunt** (`spot` scene type). The player selects the cell, or for a decision the row, that proves the point. Every cell is a button, or the player can type the address in an Excel-style name box and press Enter. Selecting is free; only "Point it out" or "Show Hrolf" is checked.

| Was (multiple choice) | Now |
|---|---|
| Where is the honey? (pick B3/C3/B2/A3) | Select the cell holding the honey price, or type its address. Wrong cells are explained by what they hold ("C3 is Honey's quantity sold") |
| Why the rope rotted (pick one of 4 explanations) | "Where did the other 16 silver go?" Select the cause: the 8 unsold coils (D3). Near-miss cells get targeted feedback, e.g. "2 silver is the cost each: which number, times 2, makes 16?" |
| Audit III: the missing coins (pick an item) | Select the coins count that doesn't match. The answer cell depends on the run's data variant. An optional working column (never scored, not selectable) lets the player compute price × quantity first |
| Audit V: the verdict (pick an item) | Select the row of the good to drop. Variant-dependent; working column available |
| Wheel CELL segment (pick an address) | Select the Gull's cargo cell. Typing requires knowing the address, so the name box is not a shortcut |
| Wheel ORDER segment (pick 16/36/…) | Build `=(A2+B2)*C2` so that it really makes 36. `=A2+B2*C2` gives 16 and is shown as such |

- **Engine:** `evaluateSpot`, `normaliseAddress`, `spotCell`. Addresses like `b3` and `$B$3` are accepted. Selecting outside the ledger, or in the working column, is not counted as an attempt.
- **Content validation** rejects answers on headings, outside the ledger, or that fail their own check, on every data variant.

### 1.3 One rating: the medal

- Game-quest results no longer show stars or the star key.
- For game quests, stars now mirror the medal (Gold 3, Silver 2, Bronze 1, none 0), so the island-wide ★ total stays consistent without a competing score.
- The map card and the progress table show the medal for game quests. The progress table's "Stars" column is now titled "Rating".
- Medal rules are unchanged: mastery evidence only.

### 1.4 Mobile, results, HUD

**Rune match:**

- On phones, runes and causes sit side by side (tap a rune, then its cause).
- The select menus are behind "Use menus instead" instead of under every rune. Both routes stay keyboard-accessible.

**Results:** about half the length. The order is now:

1. Medal and its evidence.
2. XP and level.
3. Unlock or sealed note.
4. Next, Map and Replay buttons.
5. Badge.
6. "Practise next" (up to 3 weak rounds).
7. One disclosure, "Skills, strengths and every round".

**HUD:**

- The first pinned HUD sat at `top: 0`. The page scrolls under the sticky top bar, so it was half-hidden there, and the quest header's back link had been hidden the same way.
- The HUD now sits outside the header and pins just below the top bar's measured height (`--topbar-h`, set by a `ResizeObserver` in `TopBar`), on every screen size.
- On phones the rune track compresses into one row.
- Scroll and focus targets have a matching `scroll-margin-top`.

### 1.5 Unchanged by design

- Optional silver wagering: still separate, and never affects XP, medals, mastery or unlocks. Tested.
- Save schema v4 and the v3 migration.
- excel-lite and formula validation.
- Reduced motion, the no-WebGL fallback, and all other quests.

## 2. What was verified

| Check | Result |
|---|---|
| `npm test` (Vitest) | **194 passed**. New: 8 evidence-step tests (address spellings, out-of-bounds and working column not counted, row mode, near-miss feedback, wheel CELL/ORDER, validation rejects bad answers) and 3 rating tests (stars mirror the medal; wagers change neither; course quests keep star rules). Updated: test helpers for the new step type; the "memorised answer fails on another variant" test now uses cells |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Succeeds |
| `npm run e2e` | **34/34 passed**. P9-6c (the Market quest) was updated: a wrong cell is explained and flagged in the ledger, the name-box route, the fill-down result read from the ledger, match via the menu toggle, and evidence picks in the boss |
| Diff against `main` | Other quests, `world.json`, curriculum, and the SQL, Python and schema engines are unchanged. Shared UI files changed only as described in 1.3 and 1.4 |
| Scripted play-through, desktop 1360×860, software WebGL | Gold; a half-right formula (`=B2*C$2`) showed 1 green and 3 red cells; the name box selected B3; stall visible beside Tove; no console errors |
| Same, phone 390×844, touch | Gold; match side by side without menus; HUD pinned under the top bar; no console errors |
| Same, graphics off | Gold; no console errors |
| Same, boss answers revealed (weak player) | No medal; mastery 0; Great Hall stays sealed with the explanation; no console errors |

### Screenshots reviewed (desktop, phone, graphics off)

- The wrong-cell verdict on an evidence step.
- The half-right workshop verdict in the ledger.
- The solved workshop with the compact strip.
- The boss evidence step with the working column.
- The match screen on a phone.
- The results page, collapsed and expanded.
- The pinned HUD on desktop and phone.

## 3. Still open

1. **Feedback strip timing.** Every round still ends with a Continue button. This is deliberate (player control, focus management), but it is still a pause.
2. **Hints are per step, not per mistake.** A fill-down error can get the generic "Formulas start with =…" hint. The per-cell verdict is specific; the hint is not.
3. **Evidence hunts have a finite search space.** A player can click cells until right; a ledger of 12–24 cells is still harder to guess than 4 options. Retries cost first-time credit and the medal, and reveal is offered after 3 misses, as before.
4. **The working column is a free calculator in the boss.** This is deliberate: the assessed act is choosing the evidence. It does mean the arithmetic itself is not assessed there.
5. **Phone layout.**
   - The pinned HUD plus the two-row top bar take about 35% of an 844px-tall screen.
   - Wide evidence ledgers (with the working column) scroll sideways inside their frame.
6. **Performance.** Software rendering ran at 6–9 fps; real devices are unmeasured.

## 4. Needs real-player testing

None of this has been tried by learners. These need observation, not more automated checks:

- Do players read the in-ledger verdict, or only the strip? Is "Why it works" opened when needed?
- Does the evidence hunt feel like investigation, or like "click until green"?
- Is the 3D stall reaction noticed while attention is on the panel?
- Do medals motivate replays? Does the optional silver side-game distract or engage?
- Screen-reader passes (NVDA, VoiceOver, TalkBack) of the evidence grid and name box.
- Learning effect: requires a learner study (pre/post or delayed recall). No claim is made here.

## 5. Suggested next improvements

1. Mistake-specific hints: map common wrong formulas (relative vs absolute, missing brackets) to targeted hints.
2. Auto-advance option after a correct first-try answer, keeping Continue as the default for accessibility.
3. A compact phone layout: merge the top bar and quest HUD while in a quest.
4. Evidence hunts that need two cells (cause and effect) for the boss.
5. Run the play-tests and screen-reader passes in section 4 before extending to other domains.

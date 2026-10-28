# Usability test plan: The Merchant's Ledger

Status: **planned, not run.** No sessions have happened, and no findings exist yet. This plan must not be used to claim that the chapter teaches effectively. It checks whether first-time players can play it, understand it and recover from mistakes.

## 1. Purpose and questions

Three to five people who have never seen CurioTrail play the Trading Market chapter on their own. We want to learn:

1. **Ledger:** do players understand that the grid is a spreadsheet (column letters, row numbers, cells) and that their formula fills down?
2. **Reactions:** do players notice the in-scene verdict (green ✓ / red ✗ cells), the market reaction beside the ledger, and the 3D stall?
3. **Recovery:** after a wrong answer, can players use the feedback and hints to recover, without guessing until something works?
4. **Explanation:** can players explain at least one formula idea in their own words afterwards? For example, why `=B2*C2` becomes `=B3*C3` in the next row, or why `$` keeps `E2` fixed.
5. **Friction:** where do players hesitate, get lost or give up? Does the pick budget feel fair?

## 2. Participants

- 3–5 adults (or students aged 13+ with consent), unfamiliar with CurioTrail.
- Mixed spreadsheet experience: aim for at least one who has never written a formula, and at least one who uses spreadsheets occasionally. Record experience on a 0–3 scale (0 = never opened one, 3 = writes formulas weekly).
- At least one session on a phone and one on a laptop.
- Do not recruit from the development team.

## 3. Setup (facilitator-free)

The participant reads a printed or on-screen instruction sheet and plays alone. An observer may sit silently, or the session is screen-recorded with consent. Nobody gives help during play.

- **Build:** the local build of branch `feature/game-first-market-slice` (commit noted in the session log), served locally. Never use the live site. For laptop sessions: `npm run build && npx vite preview --port 4174 --strictPort`, then open `http://localhost:4174/`. For phone sessions, serve it on the local network: `npx vite preview --host --port 4174 --strictPort`, then open `http://<computer's LAN address>:4174/` on the phone (same Wi-Fi; allow the port through the computer's firewall).
- **Pre-check:** before the first session, run `node tools/usability-precheck.cjs` against the served build. It must pass. It checks this setup and the focus and naming behaviour that screen readers rely on; it is not a substitute for section 8.
- **Fresh profile:** clear site data first, so there is no earlier save.
- **Start state:** the Trading Market opens after "The Missing Signal". So that participants start at the Market, the organiser (not the participant) opens the browser console on the game page before the session, runs the snippet below with that participant's code ("P1"…"P5") as the name, then reloads.

  The player is set in advance so that personal names stay out of the save. (An earlier build had a second reason: the identity screen's "Begin the quest" always continued to The Missing Signal. That was fixed on this branch, and e2e check L5b covers it.)

  ```js
  localStorage.setItem('curiotrail.progress', JSON.stringify({ version: 4, player: { name: 'P1', emblem: 'fox' },
    quests: { 'missing-signal': { run: null, runXp: 0, lastRun: null, lastXp: 60, bestXp: 60, bestStars: 3, completed: true, completions: 1, mastered: true, bestMastery: null, bestMedal: 'none', bestSilver: 0 } },
    achievements: [], lessons: [], settings: { motion: 'system', textSize: 'normal', graphics: 'auto' }, concepts: {} }));
  ```

  After the reload the game shows its home page. "Explore the map" leads to the island, where the Trading Market is open and its quest can be started. Check this before each session; `tools/usability-precheck.cjs` checks it automatically.

  **On a phone**, run the snippet through remote debugging: for Android, Chrome on the computer → `chrome://inspect` → the phone's tab → Console; for an iPhone, Safari on a Mac → Develop → the phone → the page → Console. If remote debugging is not available, have the participant play "The Missing Signal" first and record the extra time; this is not an intervention.
- **Between participants:** clear the site data (or run the snippet again with the next code), reload, and check the home page appears.
- **Records:** use the templates in `docs/usability/` (observer sheet, results, checklist results). File names use participant codes only.
- **Recording:** screen recording with audio for think-aloud, if the participant consents. Otherwise use the observer's notes only.
- **Time box:** 35 minutes of play, plus 10 minutes of questions.

## 4. Instructions given to the participant (read verbatim)

> This is a game about a market and its ledger. Please play it as you would at home. There are no wrong ways to play and we are testing the game, not you. Please say out loud what you are thinking, what you expect to happen, and anything that surprises or confuses you. Nobody will help you during the game; if you are completely stuck for more than two minutes, you may stop. When you finish, or after 35 minutes, we will ask a few questions.

### Task prompts (on the sheet, one at a time)

1. Find the Trading Market on the island and start Tove's quest.
2. Play until Hrolf the tax collector arrives. Use any help the game offers.
3. Finish Hrolf's audit.
4. Look at your results. Then find the Great Hall on the map and tell us whether it is open.
5. (Optional, if time remains) Replay one round from "Practise next".

## 5. What the observer records

Use one sheet per participant. Record times from the screen recording.

| # | Observation | How to record |
|---|---|---|
| O1 | Time to start the quest from the map | mm:ss |
| O2 | First evidence step ("Where is the honey?"): number of wrong picks; whether they used clicking or the name box; did they read the pick budget? | count; method; yes/no |
| O3 | First Ledger Workshop: did they notice the cells filling down (preview)? Did they say anything about rows 3–5? | yes/no; quote |
| O4 | After their first wrong formula: did they look at the red ✗ cells, read the strip, use the hint, or just try something else? | first thing they did |
| O5 | Did they notice the 2D market reaction (scales, coins, crates)? The 3D stall? (Ask only after play if not mentioned.) | spontaneous / when asked / no |
| O6 | Did they open "Why it works" or the Codex at any point? | which, when |
| O7 | Rune-word: did invalid guesses confuse them? | yes/no; quote |
| O8 | Rune Wheel and stakes: did they understand that silver never changes XP or medals? Did they stake? | stake yes/no; quote |
| O9 | Boss working column: did they understand that it is checked first? How many working attempts? | count; quote |
| O10 | Any evidence step where they ran out of picks | which step |
| O11 | Moments of being stuck for more than 60 s | step, what they tried |
| O12 | Did they find the Great Hall status, and were they right about it? | yes/no |
| O13 | Errors, crashes, layout problems (screenshot) | description |

### Completion criteria per participant

- **Completed:** reached the results screen.
- **Recovered:** at least one wrong answer was followed by a right answer within two more attempts, without revealing.
- **Explained:** gave a correct own-words explanation of at least one concept in Q3 below. Judge it against the rubric in section 6, ideally by two people independently.
- **Found the outcome:** correctly said whether the Great Hall is open, and why (passed or failed the audit).

## 6. Post-play questions (ask in this order; do not prompt answers)

1. In one or two sentences, what was the game about?
2. What was the grid with letters and numbers? What is "B3"?
3. You wrote a formula in D2 and it was used for rows 3 to 5 as well. What happened to it in row 3? *(Rubric: correct if they say the references move down a row, e.g. B2 becomes B3, or equivalent.)*
4. In one round a formula had a `$` in it (`$E$2`). What did the `$` do? *(Rubric: correct if they say it keeps the reference fixed or pointing at the same cell when copied.)*
5. When you got something wrong, what helped you most to fix it? What did not help?
6. Did you notice anything happening in the market or in the 3D scene when you answered? What?
7. Did the limit on wrong picks feel fair? Did you ever feel you were guessing?
8. What did the medal at the end mean to you? Did the silver coins matter?
9. Was there a moment you wanted to stop playing? When?
10. On a scale of 1–5, how much would you want to play the next chapter? Why?

## 7. Analysis and reporting rules

- Report counts, not percentages, for fewer than 10 people ("3 of 4 noticed…").
- Quote participants verbatim. Separate what was observed from what the participant said.
- Record what did **not** happen as well (e.g. "nobody opened the Codex").
- Do not draw conclusions about learning effectiveness from this test. Q3 and Q4 show whether a player can explain an idea right after playing, not whether they learned it from the game.
- Turn each problem seen in 2 or more sessions into an issue with severity: blocks completion / causes errors or confusion / cosmetic.

## 8. Screen-reader checklist (separate session, ideally with an experienced screen-reader user)

Test with at least one of each pairing where available: NVDA + Firefox (Windows), VoiceOver + Safari (macOS or iOS), TalkBack + Chrome (Android).

- [ ] The quest title and each step title are announced when a step starts, and focus moves to the step title.
- [ ] The pinned HUD reads as "Round x of n" plus the XP and purse figures. It does not trap focus.
- [ ] **Evidence hunt:** each cell button announces its address and content (e.g. "C3: 15"). Already-tried cells announce "already tried"; the answer announces "the evidence".
- [ ] The name box: typing "b3" and pressing Enter selects B3, and the selected value is announced through the output.
- [ ] The pick budget ("Wrong picks left: 2 of 3") is announced after a wrong pick.
- [ ] After a wrong check, focus moves to the feedback strip and the reason is read in full. Flagged cells read "(wrong)".
- [ ] After a right answer, focus lands on the "Next round: …" button and the result is read as its description.
- [ ] "Why it works" opens and closes with Enter or Space and its text is read.
- [ ] **Ledger Workshop:** fragments can be added with Tab and Enter; Backspace on the bar removes one; "Type it instead" works.
- [ ] **Rune-word:** guesses are announced with their letter results.
- [ ] **Rune match:** tap-pairs work by keyboard, and "Use menus instead" gives one select per rune.
- [ ] **Trader's Gambit:** order steppers have names ("One more Furs"); the purse status is announced.
- [ ] The wheel spin result is announced; reduced motion lands it instantly.
- [ ] The results page: medal, evidence line, unlock note and buttons are reachable in a sensible order; the "Skills, strengths and every round" disclosure works.
- [ ] Nothing important is conveyed only by colour, animation or the 3D scene.

## 9. Real-device mobile checklist

Devices: at least one small Android phone (≤ 6.1", mid-range) and one iPhone. Also one tablet if available. Use the device's default browser.

- [ ] The world loads, or the 2D fallback appears without errors. Note load time and whether the device heats up or lags.
- [ ] During a quest the site top bar scrolls away and the quest HUD stays pinned at the top while scrolling, in portrait and in landscape; scrolling up brings the top bar back. Note how much of the screen the HUD covers (emulation measured 10–14% in portrait and 22% in landscape on a 390 px-high screen).
- [ ] Ledger cells are easy to tap (no mis-taps on neighbouring cells); wide ledgers scroll sideways inside their frame, not the page.
- [ ] The on-screen keyboard does not hide the formula field or the name box while typing.
- [ ] Dragging fragments works with a finger, and tapping them works too.
- [ ] Match: tapping a rune then a cause works without scrolling between them.
- [ ] The wheel spins smoothly, or lands instantly with reduced motion turned on in the OS.
- [ ] Rotate the device mid-step: no lost input, no layout breakage.
- [ ] Background the browser for one minute and return: the run resumes on the same step with picks and stakes kept.
- [ ] With text size set to large (in-game setting and OS setting), nothing overlaps or is cut off.
- [ ] Battery and frame rate over 20 minutes of play (note the device's own indicators). Headless testing reported 6–9 fps with software rendering, which says nothing about real hardware.

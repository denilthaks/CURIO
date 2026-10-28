# Checklist results: screen reader (protocol §8) and real devices (§9)

**Status: neither checklist has been performed.** No screen reader and no physical device has been used with this build. Each item below is marked **Not tested** until someone actually does it.

Allowed statuses: **Pass**, **Fail** (with a note), **Blocked** (with the reason), **Not tested**. Record who, when, the assistive technology or device (with versions), and the commit for every result.

## 1. Screen-reader checklist (§8)

Pairings: NVDA + Firefox (Windows) · VoiceOver + Safari (macOS or iOS) · TalkBack + Chrome (Android).

| # | Item | NVDA + Firefox | VoiceOver + Safari | TalkBack + Chrome | Notes |
|---|---|---|---|---|---|
| SR1 | Quest and step titles announced; focus moves to the step title | Not tested | Not tested | Not tested | |
| SR2 | HUD reads "Round x of n", XP and purse; no focus trap | Not tested | Not tested | Not tested | |
| SR3 | Evidence cells announce address and content; "already tried"; "the evidence" | Not tested | Not tested | Not tested | |
| SR4 | Name box: "b3" + Enter selects B3; value announced | Not tested | Not tested | Not tested | |
| SR5 | Pick budget announced after a wrong pick | Not tested | Not tested | Not tested | |
| SR6 | After a wrong check, focus on the feedback strip, read in full; flagged cells read "(wrong)" | Not tested | Not tested | Not tested | |
| SR7 | After a right answer, focus on "Next round: …", result read as its description | Not tested | Not tested | Not tested | |
| SR8 | "Why it works" opens and closes with Enter or Space; text read | Not tested | Not tested | Not tested | |
| SR9 | Ledger Workshop: Tab + Enter adds a fragment; Backspace removes; "Type it instead" works | Not tested | Not tested | Not tested | |
| SR10 | Rune-word guesses announced with letter results | Not tested | Not tested | Not tested | |
| SR11 | Rune match by keyboard; "Use menus instead" gives a select per rune | Not tested | Not tested | Not tested | |
| SR12 | Gambit steppers named; purse status announced | Not tested | Not tested | Not tested | |
| SR13 | Wheel result announced; reduced motion lands it instantly | Not tested | Not tested | Not tested | |
| SR14 | Results page order and disclosure | Not tested | Not tested | Not tested | |
| SR15 | Nothing conveyed only by colour, animation or 3D | Not tested | Not tested | Not tested | |

## 2. Real-device checklist (§9)

| # | Item | Android phone (model, OS, browser) | iPhone (model, iOS, Safari) | Tablet (optional) | Notes |
|---|---|---|---|---|---|
| D1 | World loads, or the 2D fallback appears; load time; heat or lag | Not tested | Not tested | Not tested | |
| D2 | Top bar scrolls away during a quest; HUD stays pinned (portrait and landscape); share of screen covered | Not tested | Not tested | Not tested | |
| D3 | Ledger cells easy to tap; no page-level sideways scroll | Not tested | Not tested | Not tested | |
| D4 | On-screen keyboard does not hide the formula field or the name box | Not tested | Not tested | Not tested | |
| D5 | Drag fragments with a finger; tapping also works | Not tested | Not tested | Not tested | |
| D6 | Match: rune then cause, without scrolling between them | Not tested | Not tested | Not tested | |
| D7 | Wheel smooth, or instant with OS reduced motion | Not tested | Not tested | Not tested | |
| D8 | Rotate mid-step: no lost input or broken layout | Not tested | Not tested | Not tested | |
| D9 | Background the browser 1 minute: run resumes with picks and stakes | Not tested | Not tested | Not tested | |
| D10 | Large text (in-game and OS): nothing overlaps or is cut off | Not tested | Not tested | Not tested | |
| D11 | Battery and frame rate over 20 minutes | Not tested | Not tested | Not tested | |

## 3. Automated pre-checks (separate from the checklists above)

These were run in **headless Chromium**, not with a screen reader or on a device. They show that the markup and focus behaviour the checklist relies on are in place. They do **not** count as checklist passes and do not replace any item above.

**Run:** game code at commit `2434514` (the usability-preparation pass changed no game code), local preview build. `node tools/usability-precheck.cjs`, desktop 1280×860 with reduced motion.

| Pre-check | Supports item | Result | Detail |
|---|---|---|---|
| S1 Start-state snippet: home page → map → Trading Market open, quest available | Protocol §3 | Pass | |
| S2 Choosing the quest opens The Merchant's Ledger directly | Protocol §3 | Pass | With `player: null` it first failed: the identity screen sends new players to The Missing Signal. The protocol now sets the player to the participant code |
| R1 Focus on the step title when a step starts | SR1 | Pass | "Where is the honey?" |
| R2 HUD text matches the badge; XP label; one tab stop (Codex) | SR2 | Pass | "Round 1 of 12. 0 of 17 challenges solved." · "0 of 410 XP earned. Trader's purse: 0 silver" |
| R3 Evidence cells are buttons named "address: content" | SR3 | Pass | "C3: 15" |
| R4 Name box labelled; b3 + Enter selects B3; output is a polite live region | SR4 | Pass | |
| R5 Wrong pick: focus on the strip; budget live; "already tried" | SR5, SR3, SR6 | Pass | "Wrong picks left: 2 of 3 · already tried: C3" |
| R6 Right answer: focus on "Next round: …" described by the result; "the evidence" | SR7, SR3 | Pass | "Next round: Balance the scales" |
| R7 "Why it works" opens with Enter | SR8 | Pass | |
| R8 Workshop: Tab + Enter adds, Backspace removes, typed field labelled | SR9 | Pass | |
| R15 Wrong workshop cells carry "✗ (wrong)" text | SR6, SR15 | Pass | "48✗ (wrong)" |
| E0 No page errors | — | Pass | |

**Emulated phone checks** (Chromium device emulation, not real devices):

| Check | Supports item | Result | Detail |
|---|---|---|---|
| Top bar scrolls away; HUD covers 10–14% (390×844 and 360×640, normal and large text); keyboard-focused controls never hidden under the HUD; nav reachable; landmarks intact | D2, D10 | Pass (emulated) | See `docs/ACCEPTANCE-REVIEW.md` §10.3 |
| Rotate 390×844 → 844×390 mid-step with a half-typed name box | D8 | Pass (emulated) | Input kept, same step, no sideways scroll. HUD is 84 px of 390 px (22%) in landscape: worth checking on a real phone |
| Refresh mid-step keeps picks, attempts and data | D9 (partly) | Pass (unit tests) | `tests/persistence-audit.test.ts`; backgrounding on a real browser is untested |

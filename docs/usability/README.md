# Usability validation kit: The Merchant's Ledger

**Status: no sessions have been run.** No participant, screen-reader user or real device has used this build. Every result field in this folder is empty, and stays empty until the checks actually happen. Do not fill any of it from memory, estimates or automated runs.

The protocol is `docs/USABILITY-TEST.md`; this folder only holds the records. If the two disagree, the protocol wins.

| File | Purpose | State |
|---|---|---|
| `README.md` | Organiser handoff checklist, intervention rules, data handling | Ready |
| `OBSERVER-SHEET.md` | One copy per participant (P1–P5) | Template, unused |
| `RESULTS.md` | Combined results and the review against the acceptance criteria | Empty: pending sessions |
| `CHECKLIST-RESULTS.md` | Screen-reader (§8) and real-device (§9) checklist results, plus the automated pre-check run separately | Checklists: not tested. Pre-check: run |

## 1. Handoff checklist (organiser)

### Before recruiting

- [ ] Recruit 3–5 people unfamiliar with CurioTrail; not on the development team. Mixed spreadsheet experience (0–3 scale in the protocol §2). At least one session on a phone and one on a laptop.
- [ ] Get consent (see 3) and decide whether the session is screen-recorded. Without consent, observer notes only.
- [ ] Book a separate screen-reader session, ideally with an experienced screen-reader user (protocol §8), and borrow or book the devices (§9: a small Android phone, an iPhone, a tablet if possible).

### Build and environment (once)

- [ ] Check out `feature/game-first-market-slice` at the commit under test and write the commit hash in every observer sheet.
- [ ] `npm ci` (first time), then `npm run build`.
- [ ] Laptop: `npx vite preview --port 4174 --strictPort`.
- [ ] Phone: `npx vite preview --host --port 4174 --strictPort`, then open `http://<LAN address>:4174/` on the phone on the same Wi-Fi.
- [ ] Run `node tools/usability-precheck.cjs` against the served build. Every line must say PASS. If anything fails, stop and report it; do not run sessions on a failing build.
- [ ] Never use the live site.

### Before each participant

- [ ] Fresh profile: clear the site's data for the test origin (or use a private window on laptops).
- [ ] Run the start-state snippet from protocol §3 with this participant's code (P1…P5) as the name, and reload. On a phone, use remote debugging (protocol §3). If that is not possible, the participant plays The Missing Signal first and the observer records the extra time (this is not an intervention).
- [ ] Check that the home page appears, "Explore the map" shows the Trading Market open, and its quest can be started. Then go back to the home page so the participant starts from there.
- [ ] Set the device to its normal state for that participant: no reduced-motion or large-text settings unless the participant uses them day to day (record them if so).
- [ ] Print or open the participant instruction sheet (protocol §4) and a fresh copy of `OBSERVER-SHEET.md` named `P<n>.md`.
- [ ] Start the recording only after consent is confirmed.

### After each participant

- [ ] Ask the post-play questions (protocol §6) in order, without prompting. Write answers verbatim, or mark them "paraphrased" if not recorded.
- [ ] Copy the run outcome from the game's results screen (medal, boss %, first-time count, revealed count) into the sheet.
- [ ] Save any screenshots of errors with the participant code and time.
- [ ] Clear the site data before the next participant.

### After all sessions

- [ ] Fill in `RESULTS.md` from the observer sheets only.
- [ ] Fill in `CHECKLIST-RESULTS.md` from the separate screen-reader and device checks.
- [ ] Two people independently judge the "Explained" answers (Q3, Q4) against the rubric, then agree.
- [ ] Classify issues by severity and write proposed fixes separately from the observations.
- [ ] Update `docs/ACCEPTANCE-REVIEW.md` with a summary that links here.

## 2. Interventions

The protocol says nobody helps during play. Anything the observer or organiser says or does to the game during play is an **intervention**, and is logged in the observer sheet with the time, the step, the exact words or action, and the reason.

| Code | When it is allowed | Effect on the task |
|---|---|---|
| I-T (technical) | The game crashes, freezes or loses the page; the organiser reloads or restarts it without advice on how to play | Note it as a bug; the task can still count as completed |
| I-S (stuck stop) | The participant has been stuck for more than 2 minutes and chooses to stop (protocol §4) | The task is **not** completed independently |
| I-W (wellbeing or consent) | The participant is distressed or withdraws consent | The session ends; keep only what they agree to keep |
| I-H (help given) | Any hint about the game itself, even "try the Codex" | Not allowed by the protocol. If it happens anyway, log it truthfully and mark the task as not completed independently |

## 3. Consent and data handling

- **Consent script (read before starting):** "We're testing a learning game, not you. We'll note what you do and say. With your permission we'll record the screen and audio; you can say no and still take part. You can stop at any time without giving a reason. We'll store notes under a code, not your name, and delete recordings after the analysis." Record "yes/no" for taking part and separately for recording.
- **Under-18 participants:** guardian consent as well, and follow the organisation's safeguarding rules.
- **Storage:** observer sheets and recordings use participant codes only; keep the code-to-name list (if any) separately and offline. Do not commit recordings or personal data to the repository.
- **Reporting:** follow protocol §7 (counts not percentages, verbatim quotes, no claims of learning effectiveness).

# CurioTrail

**Find your way through the digital world.**

CurioTrail is a free, open-source, story-driven game for building everyday digital skills. Players become *Pathfinders* who solve short quests in a fictional world. Each quest teaches a real skill through decisions rather than lectures.

> **Status:** early prototype. One complete quest is playable. Other regions on the map are labelled as locked or in development and are not presented as working features.
> "CurioTrail" is a working name. Trademarks and domains have not been checked.

## Play

- **Hosted:** https://denilthaks.github.io/CURIO/ (deployed from `main` by `.github/workflows/deploy-pages.yml`; in the repo's *Settings → Pages*, set the source to **GitHub Actions**).
- **Locally:** browsers block `fetch()` from `file://` pages, so serve the folder:

  ```sh
  python3 -m http.server 8000   # then open http://localhost:8000
  ```

No account, sign-up, API key or build step is needed.

## Quest 01: The Missing Signal

*Region: The Signal Woods · about 5–8 minutes*

An AI assistant drafted a workshop announcement, and some details may be wrong. Mira, the village archivist, asks you to check it against the evidence (the organiser's notice, the AI summary and an unverified message) before it's published.

The player shows they can:

1. Tell an original source apart from an AI-generated summary
2. Spot where two pieces of information disagree
3. Choose a sensible way to check a claim (including when a rumour seems to "confirm" an error)
4. Explain why a prompt needs context and limits

The final task is to assemble the announcement from verified lines only. Every wrong answer explains why it's wrong and gives a hint. After three tries the player can choose to see the answer. That step then earns no XP and is recorded honestly as "reviewed with help".

The recap reports how each skill was shown (*demonstrated*, *after a hint*, or *reviewed with help*), not just a badge.

## Features

- Complete quest with dialogue, evidence inspection, multiple-choice challenges and an assembly task
- Contextual feedback, progressive hints, retry and an optional reveal
- XP with a first-try bonus and five levels. Replays keep your **best** score rather than stacking XP.
- Quest map showing completed, in-progress, available, revealed and locked regions, using icons and text, not colour alone
- Progress saved in `localStorage`: identity, the quest and step you're on, XP, badge and settings
- Replay a quest and reset all progress, with a confirmation step
- Settings for motion (follow device / reduce / allow) and larger text
- Responsive from 320px phones to desktop. On narrow screens it shows one challenge at a time.
- Feedback link for testers

No streaks, timers, leaderboards or loss of progress.

## Accessibility

- Semantic HTML: real buttons, links, `fieldset`/`legend` radio groups, native `<dialog>` and `<details>`
- Fully keyboard operable, with a visible focus ring and a skip link
- Focus moves to the new heading when you change screen, and to the feedback after you check an answer. Other updates are announced through a polite live region.
- Honours `prefers-reduced-motion`, plus an in-game override. Supports forced-colours mode.
- Status never relies on colour alone. Touch targets are at least 48px.

Known gaps: not yet tested with a full range of screen readers or with real beginner users (see the roadmap below). Emoji emblems and region icons may look different on each platform.

## Architecture

Content, rules and presentation are kept separate:

```
data/quests/*.json  →  js/game-engine.js  →  js/ui/*.js  →  js/progress-store.js
  (quest content)        (pure rules)        (rendering)     (localStorage)
```

```
.
├── index.html
├── assets/favicon.svg
├── css/        tokens.css · base.css · components.css · game.css
├── data/
│   ├── world.json              regions and unlock rules
│   └── quests/missing-signal.json
├── js/
│   ├── app.js                  wiring and screen routing
│   ├── router.js               hash routes (no server rewrites needed)
│   ├── game-engine.js          scene progression, scoring, hints, XP, skill report
│   ├── quest-loader.js         fetch and validate quest/world JSON
│   ├── progress-store.js       versioned, validated save data
│   ├── accessibility.js        settings, focus and announcements
│   ├── dom.js                  tiny element builder (text only, no innerHTML)
│   └── ui/                     home, map, quest, rewards, settings, art
└── tests/                      node:test suites
```

- **Engine:** pure functions (`createRun`, `submitAnswer`, `advance`, `computeXp`, `skillReport`, …). They don't touch the DOM, so the UI can be redesigned without rewriting quests.
- **Quest data model:** stable ID, region, intro, learning objectives, evidence, ordered scenes (`dialogue`, `evidence`, `choice`, `assemble`, `ending`), options with feedback, correct answers, hints, explanations, XP and a badge. `validateQuest()` checks references, correct answers, feedback and that every objective is actually assessed.
- **Saved data** is versioned (`version: 1`) with a `migrate()` hook. Everything read back is validated and clamped. Corrupted, missing, future-version or blocked storage falls back to a fresh start without crashing. Saved runs are re-checked against the quest, so a player can't jump past an unsolved step.
- **Paths are relative**, so the site works under a GitHub Pages project path.

> localStorage can be read and edited by the user. It is fine for a personal prototype, but not for accounts, sensitive data or trusted scores.

## Adding a quest

1. Create `data/quests/<id>.json` following `missing-signal.json`.
2. Point a region's `quest` at it in `data/world.json`, and set `unlockedBy`.
3. Run `npm test`. The validation suite flags broken references and unassessed objectives.

## Tests

Requires Node 22+ and has no dependencies:

```sh
npm test
```

The tests cover scene progression, gating, scoring, hints and reveal, assembly checks, skill reports, save/restore with tampered data, storage failures, replay scoring and content validation. CI runs them on every push and pull request (`.github/workflows/test.yml`), and the Pages deploy only runs if they pass.

## Privacy

There are no analytics, cookies or network calls beyond loading the game's own files. Progress stays in your browser, and clearing your browsing data erases it.

## Roadmap

1. **Beginner testing:** watch people who don't see themselves as technical play the quest. Can they start, understand the choices, recover from mistakes and explain what they learned? Fix the biggest problems before adding content.
2. Screen-reader passes (NVDA, VoiceOver, TalkBack).
3. Quest 02 in the Market Quarter: *The Quiet Till* (data and spreadsheets).

Deliberately deferred: AI tutor, accounts or cloud sync, multiplayer or leaderboards, payments.

## Feedback

Open an issue: [CurioTrail feedback](https://github.com/denilthaks/CURIO/issues/new?title=CurioTrail%20feedback).

## Licence

MIT. See [LICENSE](LICENSE).

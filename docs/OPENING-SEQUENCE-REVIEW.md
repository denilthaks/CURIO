# Opening sequence review

**Status:** a minimal ordering change and optional onboarding preferences are in place. The broader curriculum design is **deliberately not started**: it waits for the Excel Encyclopedia, the module encyclopedia and the detailed curriculum plans.

## Intended direction (as given)

1. Digital and data foundations
2. AI literacy and responsible AI
3. Excel fundamentals
4. Database concepts and SQL
5. Python programming and data processing
6. Business analytics and data modelling

## What exists today

| Quest | Subject | Destination | Unlocked by | What it teaches (theory cards and challenges) |
|---|---|---|---|---|
| #1 The Missing Signal | AI literacy | Signal Woods | open from the start (the opening quest) | Sources and summaries; writing a useful prompt; 5 choice questions and a message assembly |
| #4 The Merchant's Ledger | Excel | Trading Market | passing #1 | Cell addresses, formulas and fill-down, SUM, AVERAGE, MAX, `$`, order of operations, error codes, a profit decision; boss audit |
| #2 The Ledger in the Woods | SQL | Signal Woods (2nd quest) | passing #1 | WHERE, GROUP BY + SUM, ORDER BY + LIMIT on real SQLite |
| #3 The Broken Tally | Python | Viking Workshop | passing #1 | Reading errors and data types; calculating from variables |
| #5 The Jarl's Dashboard | Business analytics | Great Hall | passing the #4 audit | Grouping KPIs; choosing a chart |
| #6 The Star Chart | Data modelling | Great Hall (2nd quest) | #5, and also #2 | Facts, dimensions, grain; keys and cardinality |

Quest numbers (#1–#6) are display numbers and were not changed.

## What changed (minimal, no new locks)

Unlock rules are unchanged: after The Missing Signal, Excel, SQL and Python all open, exactly as before. Only the guidance follows the intended direction:

- **Map order:** the Trading Market (Excel) is now listed before the Viking Workshop (Python) (`public/data/world.json`).
- **Suggested "Next" quest** on the results page now follows `recommendedOrder` in `world.json`: Missing Signal → Merchant's Ledger → Ledger in the Woods → Broken Tally → Jarl's Dashboard → Star Chart. Before this change it followed the map order, so after The Missing Signal it suggested SQL before Excel. The order is a suggestion only; locked quests are never suggested, and in-progress quests remain open.

**Why no hard dependencies:** making SQL require Excel, or Python require SQL, would lock content that players can reach today and that existing players may already have started. It would also fix a curriculum order before the plans arrive. The suggestion order can be changed, or replaced by real unlock rules, once the plans are agreed.

## Onboarding preferences

The existing name and emblem screen now has two optional groups. Each has a "Skip" choice, selected by default.

- **Your background:** Non-technical beginner, Technical background, Student, Personal skills development.
- **Your learning goal:** Data Analyst, Business Analyst, Data Engineer, AI Engineer, General learning / personal development.

Choices are stored with the player in the existing save (`player.background`, `player.goal`). They are absent when skipped, and unknown values are dropped. Older saves load unchanged. **Nothing in the game uses them yet:** no role-specific paths, conditional content or role-based unlocks. Tests check that every quest status and suggestion is identical with or without them.

## Gaps to review once the encyclopedia and plans arrive

1. **No digital and data foundations content.** No quest introduces files and folders, data types, what a table or dataset is, or what a spreadsheet is before the Excel quest. The Missing Signal is AI literacy, although the curriculum lists it under "Module 0: Digital Foundations". The Merchant's Ledger starts at cell addresses, which assumes a learner knows what a spreadsheet grid is.
2. **Responsible AI** is covered only implicitly (verifying sources, prompt quality). There is no explicit content on bias, privacy or limits.
3. **Database concepts before SQL:** the SQL quest teaches queries but not what a table, row, key or relational database is. The Star Chart covers keys later.
4. **Data processing in Python:** the Python quest covers errors, types and variables, not processing data collections.
5. **Curriculum file:** `curriculum.json` Module 0 lists Python before Excel, and puts Python, Excel and analytics under "Digital Foundations". It was left as is, because module structure is part of the broader curriculum decision.
6. **Use of the onboarding preferences:** they are recorded but unused. Any use (suggestions, paths) is a later decision.

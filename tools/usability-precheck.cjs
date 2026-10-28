// Automated pre-checks before usability sessions (docs/USABILITY-TEST.md).
//
// What this is: setup verification plus checks of the Chromium accessibility
// tree and focus behaviour for the mechanically checkable items of the
// screen-reader checklist. What this is NOT: a screen-reader test, a
// real-device test or a usability session. Every result is labelled
// "automated pre-check" and must not be reported as a checklist pass.
//
// Usage: npm run build && npx vite preview --port 4174 --strictPort
//        node tools/usability-precheck.cjs [http://localhost:4174/]
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4174/';
// The organiser's start-state snippet from docs/USABILITY-TEST.md §3 (participant code P0 here).
const START = { version: 4, player: { name: 'P0', emblem: 'fox' },
  quests: { 'missing-signal': { run: null, runXp: 0, lastRun: null, lastXp: 60, bestXp: 60, bestStars: 3, completed: true, completions: 1, mastered: true, bestMastery: null, bestMedal: 'none', bestSilver: 0 } },
  achievements: [], lessons: [], settings: { motion: 'system', textSize: 'normal', graphics: 'off' }, concepts: {} };

const results = [];
const check = async (id, label, fn) => {
  try { const detail = await fn(); results.push({ id, label, ok: true, detail: detail ?? '' }); }
  catch (e) { results.push({ id, label, ok: false, detail: e.message.split('\n')[0].slice(0, 160) }); }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const focused = () => page.evaluate(() => {
    const e = document.activeElement;
    const desc = e?.getAttribute('aria-describedby');
    return { tag: e?.tagName, cls: e?.className || '', text: (e?.textContent || '').trim().slice(0, 80), label: e?.getAttribute('aria-label') || '', describedBy: desc ? (document.getElementById(desc)?.textContent || '').trim() : '' };
  });

  // ---- Setup (§3) ----
  await check('S1', 'Start-state snippet: home page, then the map shows the Trading Market open with its quest available', async () => {
    await page.goto(BASE);
    await page.evaluate((s) => localStorage.setItem('curiotrail.progress', JSON.stringify(s)), START);
    await page.reload();
    await page.waitForTimeout(800);
    await page.getByRole('link', { name: 'Explore the map' }).click();
    await page.waitForTimeout(600);
    await page.locator('a[href="#/map/trading-market"]').click();
    await page.waitForTimeout(600);
    must(await page.locator('a[href="#/quest/market-ledger"]').count(), 'no link to the Merchant\u2019s Ledger');
    return 'home → map → Trading Market → quest link present';
  });
  await check('S2', 'Choosing the quest opens The Merchant\u2019s Ledger directly (no identity screen detour)', async () => {
    await page.locator('a[href="#/quest/market-ledger"]').click();
    await page.waitForTimeout(800);
    must(/#\/quest\/market-ledger/.test(page.url()), `ended at ${page.url()}`);
    return 'map → quest';
  });

  // ---- Screen-reader checklist items that can be checked mechanically (§8) ----
  await page.locator('.scene .actions .btn-primary').click(); // "Open the ledger"
  await page.waitForTimeout(500);

  await check('R1', 'Focus moves to the step title when a step starts', async () => {
    const f = await focused();
    must(f.cls.includes('scene-title'), `focus is on ${f.tag}.${f.cls}`);
    return `focused title: "${f.text}"`;
  });
  await check('R2', 'HUD text gives the round (same words as the badge) and XP; it is not a focus trap', async () => {
    const sr = (await page.locator('.round-track .sr-only').textContent()).trim();
    const badge = (await page.locator('.phase-badge').textContent()).replace(/^\W+/, '').trim();
    must(sr.startsWith(badge), `HUD "${sr}" vs badge "${badge}"`);
    const pot = await page.locator('.pot').getAttribute('aria-label');
    must(/XP/.test(pot), 'XP meter has no label');
    const tabbables = await page.locator('.quest-hud--pinned').evaluate((el) => el.querySelectorAll('button, a, input, select, [tabindex="0"]').length);
    must(tabbables <= 1, `${tabbables} tab stops in the HUD`);
    return `"${sr}" · meter: "${pot}" · tab stops in HUD: ${tabbables} (Codex)`;
  });
  await check('R3', 'Evidence cells are buttons named "address: content"', async () => {
    const name = await page.locator('.cell-btn').filter({ hasText: '15' }).first().getAttribute('aria-label');
    must(name === 'C3: 15', `C3 is named "${name}"`);
    return `e.g. "${name}"`;
  });
  await check('R4', 'Name box is labelled; typing b3 + Enter selects B3; the value output is a live region', async () => {
    const box = page.getByLabel(/Name box/);
    await box.fill('b3'); await box.press('Enter');
    must((await page.locator('.ledger--pick td.is-picked .cell-btn').getAttribute('aria-label')) === 'B3: 8', 'B3 not selected');
    must((await page.locator('output.name-value').getAttribute('aria-live')) === 'polite', 'output is not a live region');
    return 'B3 selected, output aria-live=polite';
  });
  await check('R5', 'After a wrong pick: focus on the feedback strip; budget text is live; the tried cell says "already tried"', async () => {
    await page.getByLabel(/Name box/).fill('c3'); await page.getByLabel(/Name box/).press('Enter');
    await page.getByRole('button', { name: 'Point it out' }).click();
    await page.waitForTimeout(300);
    const f = await focused();
    must(f.cls.includes('feedback--retry'), `focus on ${f.tag}.${f.cls}`);
    must((await page.locator('.picks-left').getAttribute('aria-live')) === 'polite', 'budget not live');
    const tried = await page.locator('.cell-btn[aria-label^="C3:"]').getAttribute('aria-label');
    must(/already tried/.test(tried), `C3 is "${tried}"`);
    return `strip: "${f.text.slice(0, 60)}…" · budget: "${(await page.locator('.picks-left').textContent()).trim()}" · "${tried}"`;
  });
  await check('R6', 'After a right answer: focus on the "Next round" button, described by the result', async () => {
    await page.getByLabel(/Name box/).fill('b3'); await page.getByLabel(/Name box/).press('Enter');
    await page.getByRole('button', { name: 'Point it out' }).click();
    await page.waitForTimeout(300);
    const f = await focused();
    must(f.tag === 'BUTTON' && /^Next round/.test(f.text), `focus on ${f.tag} "${f.text}"`);
    must(f.describedBy.length > 10, 'no description');
    const solved = await page.locator('.cell-btn[aria-label^="B3:"]').getAttribute('aria-label');
    must(/the evidence/.test(solved), `B3 is "${solved}"`);
    return `"${f.text}" described by "${f.describedBy.slice(0, 60)}…" · "${solved}"`;
  });
  await check('R7', '"Why it works" opens with the keyboard', async () => {
    const summary = page.locator('.why-more summary');
    await summary.focus(); await page.keyboard.press('Enter');
    must(await page.locator('.why-more').evaluate((d) => d.open), 'did not open');
    return 'opened with Enter';
  });
  await check('R8', 'Ledger Workshop: Tab + Enter adds a fragment; Backspace removes it; "Type it instead" gives a labelled field', async () => {
    await page.getByRole('button', { name: /^Next round/ }).click();
    await page.waitForTimeout(400);
    const chip = page.locator('.bench .chip').filter({ hasText: /^=$/ }).first();
    await chip.focus(); await page.keyboard.press('Enter');
    must((await page.locator('.builder-bar .chip').count()) === 1, 'fragment not added');
    await page.locator('.builder-bar').focus(); await page.keyboard.press('Backspace');
    must((await page.locator('.builder-bar .chip').count()) === 0, 'fragment not removed');
    await page.getByRole('button', { name: /Type it instead/ }).click();
    const label = await page.locator('.builder input.formula-input').getAttribute('aria-label');
    must(label, 'typed field has no label');
    return `typed field label: "${label.slice(0, 50)}"`;
  });
  await check('R15', 'A wrong workshop check marks cells with text, not colour alone', async () => {
    await page.locator('.builder input.formula-input').fill('=B2*C$2');
    await page.getByRole('button', { name: 'Write it in the ledger' }).click();
    await page.waitForTimeout(300);
    const marks = await page.locator('.ledger td.is-flag').evaluateAll((tds) => tds.map((td) => td.textContent.trim()));
    must(marks.length && marks.every((t) => /✗/.test(t) && /\(wrong\)/.test(t)), `marks: ${JSON.stringify(marks)}`);
    return `${marks.length} cells, e.g. "${marks[0]}"`;
  });

  await check('E0', 'No page errors during the pre-check', async () => { must(!errors.length, errors.join(' | ')); return 'none'; });
  await browser.close();

  console.log('Automated pre-check (Chromium accessibility tree and focus; NOT a screen-reader or real-device test)');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();

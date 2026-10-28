import { beforeAll, describe, expect, test } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { runQueryWith } from '../src/runtime/sql-runner';
import * as engine from '../src/engine/game-engine';
import * as store from '../src/engine/progress-store';
import * as progression from '../src/engine/progression';
import type { SqlScene } from '../src/engine/types';
import { loadAllQuests, loadQuest, loadWorld } from './helpers';

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });

describe('SQL against a real SQLite database', () => {
  const quest = loadQuest('the-ledger');
  const sqlScenes = quest.scenes.filter((s): s is SqlScene => s.type === 'sql');

  test.each(sqlScenes.map((s) => [s.id, s] as const))('the %s solution runs and passes the engine', (_id, scene) => {
    const outcome = runQueryWith(SQL, scene.setup, scene.solution);
    expect(outcome.error).toBeUndefined();
    const evaluation = engine.evaluate(scene, { query: scene.solution, result: outcome.result });
    expect(evaluation.correct, evaluation.feedback).toBe(true);
  });

  test('the shown table matches the setup data', () => {
    for (const scene of sqlScenes) {
      const out = runQueryWith(SQL, scene.setup, `SELECT * FROM ${scene.tables[0].name}`);
      expect(out.result!.rows).toEqual(scene.tables[0].rows);
    }
  });

  test('realistic wrong queries are rejected with useful feedback', () => {
    const group = sqlScenes.find((s) => s.id === 'group-products')!;
    const byRegion = runQueryWith(SQL, group.setup, 'SELECT region, SUM(revenue) FROM sales GROUP BY region');
    expect(engine.evaluate(group, { query: 'SELECT region, SUM(revenue) FROM sales GROUP BY region', result: byRegion.result }).correct).toBe(false);

    const north = sqlScenes.find((s) => s.id === 'filter-north')!;
    const lower = runQueryWith(SQL, north.setup, "SELECT product, revenue FROM sales WHERE region = 'north'");
    const r = engine.evaluate(north, { query: "... WHERE region = 'north'", result: lower.result });
    expect(r.correct).toBe(false);
    expect(r.feedback).toMatch(/returned no rows/);

    const syntax = runQueryWith(SQL, north.setup, 'SELEC * FROM sales');
    expect(syntax.error).toMatch(/syntax error/);
  });

  test('each query runs on a fresh database, so destructive SQL cannot persist', () => {
    const scene = sqlScenes[0];
    expect(runQueryWith(SQL, scene.setup, 'DROP TABLE sales').error).toBeUndefined();
    expect(runQueryWith(SQL, scene.setup, 'SELECT COUNT(*) FROM sales').result!.rows).toEqual([[8]]);
    expect(runQueryWith(SQL, scene.setup, 'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT * FROM c').error).toMatch(/Recursive/);
  });
});

describe('progression and unlocking', () => {
  const world = loadWorld();
  const quests = loadAllQuests();
  const dest = (id: string) => world.destinations.find((d) => d.id === id)!;
  const complete = (p: store.Progress, id: string) => {
    const q = quests.get(id)!;
    const run = { ...engine.createRun(q), sceneIndex: q.scenes.length - 1, completed: true };
    return store.withCompletion(p, run, 50, 2, q.badge?.id);
  };

  test('a new player can only play The Missing Signal', () => {
    const p = store.defaultProgress();
    const statuses = Object.fromEntries(world.destinations.map((d) => [d.id, progression.destinationStatus(d, quests, p)]));
    expect(statuses).toEqual({ 'signal-woods': 'available', 'viking-workshop': 'locked', 'trading-market': 'locked', 'great-hall': 'locked', 'web-frontier': 'planned' });
    expect(progression.nextQuestAt(dest('signal-woods'), quests, p)!.id).toBe('missing-signal');
    expect(progression.questStatus(quests.get('the-ledger')!, dest('signal-woods'), p)).toBe('locked');
    expect(progression.unlockRequirement(dest('viking-workshop'), quests, p)).toMatch(/The Missing Signal/);
    expect(progression.unlockRequirement(dest('web-frontier'), quests, p)).toMatch(/Planned/);
  });

  test('completing quests unlocks exactly the right content', () => {
    let p = complete(store.defaultProgress(), 'missing-signal');
    expect(progression.newlyUnlocked(world, store.defaultProgress(), p).map((d) => d.id).sort()).toEqual(['trading-market', 'viking-workshop']);
    expect(progression.destinationStatus(dest('signal-woods'), quests, p)).toBe('available'); // SQL quest still to do
    expect(progression.nextQuestAt(dest('signal-woods'), quests, p)!.id).toBe('the-ledger');
    expect(progression.destinationStatus(dest('great-hall'), quests, p)).toBe('locked');

    const before = p;
    p = complete(p, 'market-ledger');
    expect(progression.newlyUnlocked(world, before, p).map((d) => d.id)).toEqual(['great-hall']);
    expect(progression.destinationStatus(dest('trading-market'), quests, p)).toBe('completed');
    expect(progression.destinationStatus(dest('web-frontier'), quests, p)).toBe('planned');
  });

  test('an unfinished replay shows as in progress but keeps unlocks', () => {
    let p = complete(store.defaultProgress(), 'missing-signal');
    p = store.withReplay(p, 'missing-signal');
    p = store.withRun(p, { ...engine.createRun(quests.get('missing-signal')!), sceneIndex: 2 }, 10);
    expect(progression.questStatus(quests.get('missing-signal')!, dest('signal-woods'), p)).toBe('in-progress');
    expect(progression.destinationStatus(dest('viking-workshop'), quests, p)).toBe('available');
  });

  test('maximum XP across all quests reaches the top level', () => {
    const total = [...quests.values()].reduce((s, q) => s + engine.maxXp(q), 0);
    expect(engine.levelFor(total).name).toBe('Cartographer');
  });
});

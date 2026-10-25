import { describe, expect, test } from 'vitest';
import * as store from '../src/engine/progress-store';
import type { Run } from '../src/engine/types';
import { loadAllQuests, memoryStorage } from './helpers';

const run = (overrides: Partial<Run> = {}): Run => ({ questId: 'missing-signal', sceneIndex: 2, inspected: [], results: {}, completed: false, ...overrides });

describe('progress store (ported from the original suite)', () => {
  test('save and load round-trip', () => {
    const s = store.createProgressStore(memoryStorage());
    let progress = store.withPlayer(store.defaultProgress(), 'Asha', 'owl');
    progress = store.withRun(progress, run(), 25);
    expect(s.save(progress)).toBe(true);
    expect(s.load()).toEqual(progress);
  });

  test('missing, corrupted or future data falls back to defaults', () => {
    expect(store.createProgressStore(memoryStorage()).load()).toEqual(store.defaultProgress());
    expect(store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: '{not json' })).load()).toEqual(store.defaultProgress());
    const future = JSON.stringify({ version: store.SCHEMA_VERSION + 1, player: { name: 'X' } });
    expect(store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: future })).load()).toEqual(store.defaultProgress());
    expect(store.sanitizeProgress('nonsense')).toEqual(store.defaultProgress());
    expect(store.sanitizeProgress({ player: { name: 'no version' } })).toEqual(store.defaultProgress());
  });

  test('works without storage at all', () => {
    const s = store.createProgressStore(null);
    expect(s.available).toBe(false);
    expect(s.save(store.defaultProgress())).toBe(false);
    expect(s.load()).toEqual(store.defaultProgress());
    s.reset();
  });

  test('storage that throws is handled', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
    const s = store.createProgressStore(broken);
    expect(s.load()).toEqual(store.defaultProgress());
    expect(s.save(store.defaultProgress())).toBe(false);
    s.reset();
  });

  test('tampered values are validated and clamped', () => {
    const clean = store.sanitizeProgress({
      version: 2,
      player: { name: '  <b>Very long name that goes on and on</b>\u0007 ', emblem: 'dragon' },
      quests: {
        'missing-signal': { run: run({ questId: 'other' }), runXp: 50, bestXp: 1e12, bestStars: 9, completed: 'yes', completions: -4 },
        'Bad Id!': { bestXp: 10 },
        'ok-quest': 'not an object',
      },
      achievements: ['signal-restorer', 'signal-restorer', 42, '<script>'],
      settings: { motion: 'wild', textSize: 'large', graphics: 'ultra' },
    });
    expect(clean.player!.name.length).toBe(store.MAX_NAME_LENGTH);
    expect(clean.player!.emblem).toBe('fox');
    expect(Object.keys(clean.quests)).toEqual(['missing-signal']);
    expect(clean.quests['missing-signal']).toEqual({ ...store.emptyRecord(), bestXp: 100000, bestStars: 3 });
    expect(clean.achievements).toEqual(['signal-restorer']);
    expect(clean.settings).toEqual({ motion: 'system', textSize: 'large', graphics: 'auto' });
  });

  test('blank names default to Pathfinder', () => {
    expect(store.withPlayer(store.defaultProgress(), '   ', 'deer').player!.name).toBe('Pathfinder');
  });

  test('replays keep the best score instead of stacking XP', () => {
    let p = store.defaultProgress();
    p = store.withCompletion(p, run({ completed: true }), 100, 2, 'signal-restorer');
    expect(store.totalXp(p)).toBe(100);
    expect(p.quests['missing-signal'].completions).toBe(1);

    p = store.withCompletion(p, run({ completed: true }), 100, 2, 'signal-restorer');
    expect(p.quests['missing-signal'].completions).toBe(1);

    p = store.withReplay(p, 'missing-signal');
    expect(p.quests['missing-signal'].completed).toBe(true);
    expect(p.quests['missing-signal'].run).toBeNull();
    expect(p.quests['missing-signal'].lastRun!.completed).toBe(true);
    expect(p.quests['missing-signal'].lastXp).toBe(100);
    p = store.withRun(p, run(), 30);
    expect(store.totalXp(p)).toBe(100);
    p = store.withCompletion(p, run({ completed: true }), 80, 1, 'signal-restorer');
    expect(store.totalXp(p)).toBe(100);
    expect(p.quests['missing-signal'].bestStars).toBe(2);
    p = store.withReplay(p, 'missing-signal');
    p = store.withCompletion(p, run({ completed: true }), 120, 3, 'signal-restorer');
    expect(store.totalXp(p)).toBe(120);
    expect(store.totalStars(p)).toBe(3);
    expect(p.quests['missing-signal'].completions).toBe(3);
    expect(p.achievements).toEqual(['signal-restorer']);
  });

  test('in-progress XP counts toward the total on a first run', () => {
    expect(store.totalXp(store.withRun(store.defaultProgress(), run(), 30))).toBe(30);
  });

  test('reset clears saved progress', () => {
    const storage = memoryStorage();
    const s = store.createProgressStore(storage);
    s.save(store.withPlayer(store.defaultProgress(), 'Asha', 'owl'));
    s.reset();
    expect(storage.data.size).toBe(0);
    expect(s.load()).toEqual(store.defaultProgress());
  });

  test('settings merge and validate', () => {
    let p = store.withSettings(store.defaultProgress(), { motion: 'reduce' });
    p = store.withSettings(p, { textSize: 'huge' as never, graphics: 'low' });
    expect(p.settings).toEqual({ motion: 'reduce', textSize: 'normal', graphics: 'low' });
  });
});

describe('schema migration v1 → v2 → v3', () => {
  test('a save from the first release keeps identity, XP and completion, and gains stars', () => {
    const quests = loadAllQuests();
    const quest = quests.get('missing-signal')!;
    // A real v1 save: completed quest, one step needed a hint.
    const results: Run['results'] = {};
    for (const s of quest.scenes) if ('xp' in s) results[s.id] = { attempts: s.id === 'rumour' ? 2 : 1, solved: true, revealed: false };
    // A real v1 save uses v1/v2 step indices (before lesson steps existed).
    const lastRun = { questId: quest.id, sceneIndex: store.V2_SCENE_ORDER[quest.id].length - 1, inspected: ['notice', 'ai-draft', 'message'], results, completed: true };
    const v1 = {
      version: 1,
      player: { name: 'Asha', emblem: 'owl' },
      quests: { 'missing-signal': { run: lastRun, runXp: 120, lastRun, lastXp: 120, bestXp: 120, completed: true, completions: 1 } },
      achievements: ['signal-restorer'],
      settings: { motion: 'reduce', textSize: 'large' },
    };
    const loaded = store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: JSON.stringify(v1) })).load();
    expect(loaded.version).toBe(store.SCHEMA_VERSION); // v1 → v2 → v3
    expect(loaded.lessons).toEqual([]);
    expect(loaded.player).toEqual({ name: 'Asha', emblem: 'owl' });
    expect(loaded.settings).toEqual({ motion: 'reduce', textSize: 'large', graphics: 'auto' });
    expect(store.totalXp(loaded)).toBe(120);
    expect(loaded.quests['missing-signal'].bestStars).toBe(0);

    const reconciled = store.reconcileStars(loaded, quests);
    expect(reconciled.quests['missing-signal'].bestStars).toBe(2);
    expect(store.reconcileStars(reconciled, quests)).toBe(reconciled); // idempotent
  });
});

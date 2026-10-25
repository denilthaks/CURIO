import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/progress-store.js';
import { memoryStorage } from './helpers.js';

const run = (overrides = {}) => ({ questId: 'missing-signal', sceneIndex: 2, inspected: [], results: {}, completed: false, ...overrides });

test('save and load round-trip', () => {
  const storage = memoryStorage();
  const s = store.createProgressStore(storage);
  let progress = store.withPlayer(store.defaultProgress(), 'Asha', 'owl');
  progress = store.withRun(progress, run(), 25);
  assert.equal(s.save(progress), true);
  assert.deepEqual(s.load(), progress);
});

test('missing, corrupted or future data falls back to defaults', () => {
  assert.deepEqual(store.createProgressStore(memoryStorage()).load(), store.defaultProgress());
  assert.deepEqual(store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: '{not json' })).load(), store.defaultProgress());
  const future = JSON.stringify({ version: store.SCHEMA_VERSION + 1, player: { name: 'X' } });
  assert.deepEqual(store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: future })).load(), store.defaultProgress());
  assert.deepEqual(store.sanitizeProgress('nonsense'), store.defaultProgress());
  assert.deepEqual(store.sanitizeProgress({ player: { name: 'no version' } }), store.defaultProgress());
});

test('works without storage at all', () => {
  const s = store.createProgressStore(null);
  assert.equal(s.available, false);
  assert.equal(s.save(store.defaultProgress()), false);
  assert.deepEqual(s.load(), store.defaultProgress());
  s.reset();
});

test('storage that throws is handled', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const s = store.createProgressStore(broken);
  assert.deepEqual(s.load(), store.defaultProgress());
  assert.equal(s.save(store.defaultProgress()), false);
  s.reset();
});

test('tampered values are validated and clamped', () => {
  const clean = store.sanitizeProgress({
    version: 1,
    player: { name: '  <b>Very long name that goes on and on</b>\u0007 ', emblem: 'dragon' },
    quests: {
      'missing-signal': { run: run({ questId: 'other' }), runXp: 50, bestXp: 1e12, completed: 'yes', completions: -4 },
      'Bad Id!': { bestXp: 10 },
      'ok-quest': 'not an object',
    },
    achievements: ['signal-restorer', 'signal-restorer', 42, '<script>'],
    settings: { motion: 'wild', textSize: 'large' },
  });
  assert.equal(clean.player.name.length, store.MAX_NAME_LENGTH);
  assert.equal(clean.player.emblem, 'fox');
  assert.deepEqual(Object.keys(clean.quests), ['missing-signal']);
  assert.deepEqual(clean.quests['missing-signal'], {
    run: null, runXp: 0, lastRun: null, lastXp: 0, bestXp: 100000, completed: false, completions: 0,
  });
  assert.deepEqual(clean.achievements, ['signal-restorer']);
  assert.deepEqual(clean.settings, { motion: 'system', textSize: 'large' });
});

test('blank names default to Pathfinder', () => {
  assert.equal(store.withPlayer(store.defaultProgress(), '   ', 'deer').player.name, 'Pathfinder');
});

test('replays keep the best score instead of stacking XP', () => {
  let p = store.defaultProgress();
  p = store.withCompletion(p, run({ completed: true }), 100, 'signal-restorer');
  assert.equal(store.totalXp(p), 100);
  assert.equal(p.quests['missing-signal'].completions, 1);

  p = store.withCompletion(p, run({ completed: true }), 100, 'signal-restorer');
  assert.equal(p.quests['missing-signal'].completions, 1, 'saving the same finished run twice does not double count');

  p = store.withReplay(p, 'missing-signal');
  assert.equal(p.quests['missing-signal'].completed, true, 'replaying keeps completion');
  assert.equal(p.quests['missing-signal'].run, null);
  assert.equal(p.quests['missing-signal'].lastRun.completed, true, 'results stay viewable during a replay');
  assert.equal(p.quests['missing-signal'].lastXp, 100);
  p = store.withRun(p, run(), 30);
  assert.equal(store.totalXp(p), 100, 'in-progress replay below best does not change total');
  p = store.withCompletion(p, run({ completed: true }), 120, 'signal-restorer');
  assert.equal(store.totalXp(p), 120);
  assert.equal(p.quests['missing-signal'].completions, 2);
  assert.deepEqual(p.achievements, ['signal-restorer']);
});

test('in-progress XP counts toward the total on a first run', () => {
  const p = store.withRun(store.defaultProgress(), run(), 30);
  assert.equal(store.totalXp(p), 30);
});

test('reset clears saved progress', () => {
  const storage = memoryStorage();
  const s = store.createProgressStore(storage);
  s.save(store.withPlayer(store.defaultProgress(), 'Asha', 'owl'));
  s.reset();
  assert.equal(storage.data.size, 0);
  assert.deepEqual(s.load(), store.defaultProgress());
});

test('settings merge and validate', () => {
  let p = store.withSettings(store.defaultProgress(), { motion: 'reduce' });
  p = store.withSettings(p, { textSize: 'huge' });
  assert.deepEqual(p.settings, { motion: 'reduce', textSize: 'normal' });
});

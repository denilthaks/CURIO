import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../js/game-engine.js';
import { loadQuest } from './helpers.js';

const quest = loadQuest();

// Play the whole quest, answering every challenge correctly first time.
function playPerfectly() {
  let run = engine.createRun(quest);
  while (!run.completed) {
    const scene = engine.currentScene(quest, run);
    if (scene.type === 'evidence') {
      for (const id of scene.evidence) run = engine.inspectEvidence(quest, run, id);
    }
    if (engine.isChallenge(scene)) {
      const { run: next, outcome } = engine.submitAnswer(quest, run, engine.correctAnswer(scene));
      assert.equal(outcome.correct, true, `correct answer accepted for ${scene.id}`);
      run = next;
    }
    const before = run;
    run = engine.advance(quest, run);
    assert.notEqual(run, before, `advanced past ${scene.id}`);
  }
  return run;
}

function goTo(sceneId) {
  let run = engine.createRun(quest);
  while (engine.currentScene(quest, run).id !== sceneId) {
    const scene = engine.currentScene(quest, run);
    if (scene.type === 'evidence') scene.evidence.forEach((id) => (run = engine.inspectEvidence(quest, run, id)));
    if (engine.isChallenge(scene)) run = engine.submitAnswer(quest, run, engine.correctAnswer(scene)).run;
    run = engine.advance(quest, run);
  }
  return run;
}

test('a perfect playthrough completes with maximum XP', () => {
  const run = playPerfectly();
  assert.equal(run.completed, true);
  assert.equal(engine.computeXp(quest, run), engine.maxXp(quest));
  assert.ok(engine.skillReport(quest, run).every((s) => s.status === 'demonstrated'));
});

test('evidence must all be inspected before continuing', () => {
  let run = goTo('investigate');
  assert.equal(engine.canAdvance(quest, run), false);
  run = engine.inspectEvidence(quest, run, 'notice');
  run = engine.inspectEvidence(quest, run, 'notice');
  assert.deepEqual(run.inspected, ['notice']);
  assert.equal(engine.advance(quest, run), run, 'advance is a no-op while incomplete');
  run = engine.inspectEvidence(quest, run, 'ai-draft');
  run = engine.inspectEvidence(quest, run, 'message');
  assert.equal(engine.canAdvance(quest, run), true);
});

test('unknown evidence ids are ignored', () => {
  const run = goTo('investigate');
  assert.equal(engine.inspectEvidence(quest, run, 'nope'), run);
});

test('a challenge cannot be skipped without solving it', () => {
  const run = goTo('verify-time');
  assert.equal(engine.canAdvance(quest, run), false);
  assert.equal(engine.advance(quest, run), run);
});

test('submitting nothing does not count as an attempt', () => {
  const run = goTo('verify-time');
  const { run: after, outcome } = engine.submitAnswer(quest, run, undefined);
  assert.equal(outcome.valid, false);
  assert.equal(after, run);
});

test('wrong answers give option feedback, progressive hints and then a reveal', () => {
  let run = goTo('verify-time');
  const scene = engine.currentScene(quest, run);

  let result = engine.submitAnswer(quest, run, 'trust-ai');
  assert.equal(result.outcome.correct, false);
  assert.match(result.outcome.feedback, /confident/i);
  assert.equal(result.outcome.hint, scene.hints[0]);
  assert.equal(result.outcome.canReveal, false);
  run = result.run;

  result = engine.submitAnswer(quest, run, 'average');
  assert.equal(result.outcome.hint, scene.hints[1]);
  run = result.run;

  assert.equal(engine.revealAnswer(quest, run), run, 'reveal not offered yet');
  result = engine.submitAnswer(quest, run, 'reasonable');
  assert.equal(result.outcome.hint, scene.hints[1], 'last hint repeats');
  assert.equal(result.outcome.canReveal, true);
  run = engine.revealAnswer(quest, result.run);
  assert.deepEqual(engine.resultFor(run, scene.id), { attempts: 3, solved: true, revealed: true });
  assert.equal(engine.canAdvance(quest, run), true);
});

test('XP: first-try bonus, retry still earns base XP, reveal earns none', () => {
  const scene = quest.scenes.find((s) => s.id === 'verify-time');
  assert.equal(engine.sceneXp(quest, scene, { attempts: 1, solved: true, revealed: false }), scene.xp + quest.xp.firstTryBonus);
  assert.equal(engine.sceneXp(quest, scene, { attempts: 2, solved: true, revealed: false }), scene.xp);
  assert.equal(engine.sceneXp(quest, scene, { attempts: 3, solved: true, revealed: true }), 0);
  assert.equal(engine.sceneXp(quest, scene, { attempts: 2, solved: false, revealed: false }), 0);
});

test('a solved challenge cannot be re-submitted for more attempts', () => {
  let run = goTo('find-source');
  run = engine.submitAnswer(quest, run, 'notice').run;
  const again = engine.submitAnswer(quest, run, 'ai-draft');
  assert.equal(again.outcome.valid, false);
  assert.equal(again.run, run);
});

test('assemble: lists every unsupported line and requires every slot', () => {
  let run = goTo('assemble');
  const incomplete = engine.submitAnswer(quest, run, { slots: { time: '1400' }, extras: [] });
  assert.equal(incomplete.outcome.valid, false);
  assert.match(incomplete.outcome.message, /Laptops/);

  const wrong = engine.submitAnswer(quest, run, {
    slots: { time: '1500', laptops: 'borrow', registration: 'none' },
    extras: ['free', 'lunch'],
  });
  assert.equal(wrong.outcome.correct, false);
  assert.deepEqual(wrong.outcome.issues.map((i) => i.id), ['time', 'registration', 'lunch']);
  run = wrong.run;

  const right = engine.submitAnswer(quest, run, {
    slots: { time: '1400', laptops: 'borrow', registration: 'desk' },
    extras: ['beginners'],
  });
  assert.equal(right.outcome.correct, true, 'supported extras are optional');
  assert.ok(right.outcome.explanation);
});

test('skill report distinguishes hints and reveals', () => {
  let run = goTo('find-source');
  run = engine.submitAnswer(quest, run, 'message').run;
  run = engine.submitAnswer(quest, run, 'notice').run;
  const report = Object.fromEntries(engine.skillReport(quest, run).map((s) => [s.id, s.status]));
  assert.equal(report['identify-contradiction'], 'not-yet');
  // distinguish-source is also assessed by the later "rumour" scene.
  assert.equal(report['distinguish-source'], 'not-yet');

  const full = playPerfectly();
  const withHint = { ...full, results: { ...full.results, rumour: { attempts: 2, solved: true, revealed: false } } };
  const withReveal = { ...full, results: { ...full.results, 'better-prompt': { attempts: 3, solved: true, revealed: true } } };
  const hintReport = Object.fromEntries(engine.skillReport(quest, withHint).map((s) => [s.id, s.status]));
  const revealReport = Object.fromEntries(engine.skillReport(quest, withReveal).map((s) => [s.id, s.status]));
  assert.equal(hintReport['distinguish-source'], 'with-hints');
  assert.equal(hintReport['verify-claims'], 'with-hints');
  assert.equal(revealReport['prompt-context'], 'reviewed');
});

test('restoreRun keeps valid progress and rejects tampered data', () => {
  const run = goTo('rumour');
  const restored = engine.restoreRun(quest, JSON.parse(JSON.stringify(run)));
  assert.deepEqual(restored, run);

  assert.deepEqual(engine.restoreRun(quest, null), engine.createRun(quest));
  assert.deepEqual(engine.restoreRun(quest, { questId: 'other' }), engine.createRun(quest));

  const skipped = engine.restoreRun(quest, { questId: quest.id, sceneIndex: 7, inspected: ['notice', 'bogus'], results: {} });
  assert.equal(engine.currentScene(quest, skipped).id, 'investigate', 'cannot jump past unfinished steps');
  assert.deepEqual(skipped.inspected, ['notice']);

  const clamped = engine.restoreRun(quest, { questId: quest.id, sceneIndex: 999, inspected: [], results: {} });
  assert.ok(clamped.sceneIndex < quest.scenes.length);

  const fakeCompletion = engine.restoreRun(quest, { questId: quest.id, sceneIndex: 0, completed: true });
  assert.equal(fakeCompletion.completed, false);
});

test('levels', () => {
  assert.equal(engine.levelFor(0).name, 'Newcomer');
  assert.equal(engine.levelFor(39).level, 1);
  assert.equal(engine.levelFor(40).name, 'Scout');
  assert.equal(engine.levelFor(engine.maxXp(quest)).name, 'Trailblazer');
  assert.equal(engine.levelFor(10000).next, null);
});

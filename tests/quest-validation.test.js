import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuest, validateWorld } from '../js/quest-loader.js';
import { loadQuest, readJson } from './helpers.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('the shipped quest is valid', () => {
  assert.deepEqual(validateQuest(loadQuest()), []);
});

test('the shipped world is valid and its quests exist', () => {
  const world = readJson('data/world.json');
  assert.deepEqual(validateWorld(world, ['missing-signal']), []);
  for (const region of world.regions.filter((r) => r.quest)) {
    assert.equal(readJson(`data/quests/${region.quest}.json`).id, region.quest);
  }
});

test('every challenge has a meaningful explanation and feedback for every wrong answer', () => {
  for (const scene of loadQuest().scenes) {
    if (scene.type === 'choice') {
      assert.equal(scene.options.filter((o) => o.id === scene.correct).length, 1, scene.id);
      for (const option of scene.options) assert.ok(option.feedback.length > 20, `${scene.id}/${option.id}`);
    }
    if (scene.type === 'choice' || scene.type === 'assemble') assert.ok(scene.explanation.length > 40, scene.id);
  }
});

test('broken content is reported', () => {
  const quest = loadQuest();

  const badCorrect = clone(quest);
  badCorrect.scenes.find((s) => s.type === 'choice').correct = 'missing';
  assert.match(validateQuest(badCorrect).join('\n'), /is not an option/);

  const badEvidence = clone(quest);
  badEvidence.scenes.find((s) => s.type === 'evidence').evidence.push('ghost');
  assert.match(validateQuest(badEvidence).join('\n'), /unknown evidence "ghost"/);

  const noEnding = clone(quest);
  noEnding.scenes.pop();
  assert.match(validateQuest(noEnding).join('\n'), /last scene must be an ending/);

  const unassessed = clone(quest);
  unassessed.objectives.push({ id: 'extra', label: 'Something never tested' });
  assert.match(validateQuest(unassessed).join('\n'), /"extra" is never assessed/);

  const twoCorrect = clone(quest);
  twoCorrect.scenes.find((s) => s.type === 'assemble').slots[0].options.forEach((o) => (o.correct = true));
  assert.match(validateQuest(twoCorrect).join('\n'), /exactly one correct option/);

  assert.deepEqual(validateQuest(null), ['Quest is not an object.']);
  assert.match(validateWorld({ regions: [{ id: 'a', name: 'A', theme: 't', quest: 'nope' }] }).join(), /unknown quest/);
});

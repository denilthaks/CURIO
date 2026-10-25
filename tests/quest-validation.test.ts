import { describe, expect, test } from 'vitest';
import { validateQuest, validateWorld } from '../src/engine/quest-validation';
import type { Quest } from '../src/engine/types';
import { QUEST_IDS, loadQuest, loadWorld } from './helpers';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('shipped content', () => {
  test.each(QUEST_IDS)('%s is valid', (id) => {
    expect(validateQuest(loadQuest(id))).toEqual([]);
  });

  test('the world is valid and references every shipped quest exactly once', () => {
    const world = loadWorld();
    expect(validateWorld(world, QUEST_IDS)).toEqual([]);
    const referenced = world.destinations.flatMap((d) => d.quests).sort();
    expect(referenced).toEqual([...QUEST_IDS].sort());
  });

  test('quest numbers are unique and sequential', () => {
    expect(QUEST_IDS.map((id) => loadQuest(id).number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('every challenge has a meaningful explanation and feedback for every wrong answer', () => {
    for (const id of QUEST_IDS) {
      for (const scene of loadQuest(id).scenes) {
        if (scene.type === 'choice') {
          expect(scene.options.filter((o) => o.id === scene.correct)).toHaveLength(1);
          for (const option of scene.options) expect(option.feedback.length, `${id}/${scene.id}/${option.id}`).toBeGreaterThan(20);
        }
        if ('explanation' in scene) expect(scene.explanation.length, `${id}/${scene.id}`).toBeGreaterThan(40);
      }
    }
  });
});

describe('broken content is reported', () => {
  const quest = loadQuest();
  test('choice, evidence, ending, objectives and assemble errors', () => {
    const badCorrect = clone(quest);
    (badCorrect.scenes.find((s) => s.type === 'choice') as { correct: string }).correct = 'missing';
    expect(validateQuest(badCorrect).join('\n')).toMatch(/is not an option/);

    const badEvidence = clone(quest);
    (badEvidence.scenes.find((s) => s.type === 'evidence') as { evidence: string[] }).evidence.push('ghost');
    expect(validateQuest(badEvidence).join('\n')).toMatch(/unknown evidence "ghost"/);

    const noEnding = clone(quest);
    noEnding.scenes.pop();
    expect(validateQuest(noEnding).join('\n')).toMatch(/last scene must be an ending/);

    const unassessed = clone(quest);
    unassessed.objectives.push({ id: 'extra', label: 'Something never tested' });
    expect(validateQuest(unassessed).join('\n')).toMatch(/"extra" is never assessed/);

    const twoCorrect = clone(quest);
    (twoCorrect.scenes.find((s) => s.type === 'assemble') as { slots: { options: { correct?: boolean }[] }[] }).slots[0].options.forEach((o) => { o.correct = true; });
    expect(validateQuest(twoCorrect).join('\n')).toMatch(/exactly one correct option/);

    expect(validateQuest(null)).toEqual(['Quest is not an object.']);
  });

  test('a Python or Excel solution that fails its own check is caught', () => {
    const py = clone(loadQuest('broken-tally')) as Quest;
    (py.scenes.find((s) => s.id === 'average') as { solution: string }).solution = 'sum(orders)';
    expect(validateQuest(py).join('\n')).toMatch(/solution does not pass/);

    const xl = clone(loadQuest('market-ledger')) as Quest;
    (xl.scenes.find((s) => s.id === 'total') as { solution: string }).solution = '=SUM(D2:D4)';
    expect(validateQuest(xl).join('\n')).toMatch(/solution does not pass/);
  });

  test('world errors', () => {
    expect(validateWorld({ destinations: [{ id: 'a', name: 'A', theme: 't', quests: ['nope'], unlockedBy: [], position: [0, 0] }]}).join()).toMatch(/unknown quest/);
    expect(validateWorld({ destinations: [{ id: 'a', name: 'A', theme: 't', quests: [], unlockedBy: [], position: [0] }]}).join()).toMatch(/position/);
  });
});

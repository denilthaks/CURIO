import { describe, expect, test } from 'vitest';
import * as engine from '../src/engine/game-engine';
import * as store from '../src/engine/progress-store';
import * as progression from '../src/engine/progression';
import { evaluateFormula, excelRound, makeSheet } from '../src/engine/excel-lite';
import { scoreGuess, guessProblem, letterStates } from '../src/engine/games/runeword';
import { draw, mulberry32, weightedIndex } from '../src/engine/games/rng';
import { conceptLevel, recordConcepts, reviewWeight, sanitizeConcepts } from '../src/engine/games/mastery';
import { buildableFrom, validateCodex, validateQuest } from '../src/engine/quest-validation';
import type { Answer, Codex, GambitScene, Quest, RepairScene, Run, WheelScene } from '../src/engine/types';
import { QUEST_IDS, loadAllQuests, loadQuest, loadWorld, memoryStorage, readJson } from './helpers';

const q = loadQuest('market-ledger');
const quests = loadAllQuests();
const world = loadWorld();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Advance to a step, solving everything before it correctly on the first try. */
function goTo(id: string, seed = 1, quest: Quest = q): Run {
  let run = engine.createRun(quest, seed);
  while (engine.currentScene(quest, run).id !== id) {
    const scene = engine.currentScene(quest, run);
    if (scene.type === 'wheel') run = engine.spinWheel(quest, run);
    if (engine.isChallenge(scene)) run = engine.submitAnswer(quest, run, engine.correctAnswer(scene, run)!).run;
    run = engine.advance(quest, run);
  }
  return run;
}

function finish(run: Run, quest: Quest = q, answer: (r: Run) => Answer | null = (r) => engine.correctAnswer(engine.currentScene(quest, r), r)): Run {
  let r = run;
  while (!r.completed) {
    const scene = engine.currentScene(quest, r);
    if (scene.type === 'wheel') r = engine.spinWheel(quest, r);
    if (engine.isChallenge(scene) && !engine.resultFor(r, scene.id).solved) {
      const a = answer(r);
      r = a ? engine.submitAnswer(quest, r, a).run : r;
      if (!engine.resultFor(r, scene.id).solved) {
        while (engine.resultFor(r, scene.id).attempts < engine.revealAfter(scene)) {
          const before = engine.resultFor(r, scene.id).attempts;
          r = engine.submitAnswer(quest, r, wrongAnswer(scene, r)).run;
          if (engine.resultFor(r, scene.id).attempts === before) throw new Error(`wrong answer for ${scene.id} was not a valid attempt`);
        }
        r = engine.revealAnswer(quest, r);
      }
    }
    r = engine.advance(quest, r);
  }
  return r;
}

/** A valid but wrong answer for any step type in the Market quest. */
function wrongAnswer(scene: ReturnType<typeof engine.currentScene>, run: Run): Answer {
  const guesses = run.guesses?.[scene.id] ?? [];
  switch (scene.type) {
    case 'choice': return scene.options.find((o) => o.id !== engine.resolveScene(scene, run).correct)!.id;
    case 'workshop': return { formula: '=1+1' };
    case 'repair': return { diagnosis: scene.diagnoses.find((d) => d.id !== scene.correctDiagnosis)!.id, formula: scene.solution };
    case 'runeword': return { guess: (scene.word.length === 3 ? ['SUM', 'MIN', 'ABS', 'DAY', 'COS', 'EXP', 'INT', 'LEN'] : ['ACCRINT', 'ADDRESS', 'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BETAINV', 'CEILING']).filter((w) => w.length === scene.word.length && !guesses.includes(w) && w !== scene.word)[0] };
    case 'match': return { pairs: Object.fromEntries(scene.left.map((l, i) => [l.id, scene.right[(i + 1) % scene.right.length].id])) };
    case 'gambit': return { orders: scene.items.map((it) => it.demand), formula: scene.solution.formula };
    case 'wheel': {
      const seg = engine.landedSegment(scene, run)!;
      return { response: seg.challenge.kind === 'choice' ? seg.challenge.options.find((o) => o.id !== (seg.challenge as { correct: string }).correct)!.id : { formula: '=1' } };
    }
    default: throw new Error(`no wrong answer for ${scene.type}`);
  }
}

describe('excel-lite follows Excel', () => {
  const val = (f: string) => evaluateFormula(f, makeSheet(['A'], [[5]])).value;
  test('negation binds tighter than ^, and ^ is left-associative', () => {
    expect(val('=-2^2')).toBe(4);
    expect(val('=0-2^2')).toBe(-4);
    expect(val('=2^3^2')).toBe(64);
    expect(val('=2^-1')).toBe(0.5);
  });
  test('percent and decimal literals', () => {
    expect(val('=50%')).toBe(0.5);
    expect(val('=A2*10%')).toBeCloseTo(0.5);
    expect(val('=.5+.25')).toBe(0.75);
  });
  test('ROUND rounds halves away from zero and uses the decimal value', () => {
    expect(excelRound(-2.5, 0)).toBe(-3);
    expect(excelRound(2.5, 0)).toBe(3);
    expect(excelRound(1.005, 2)).toBe(1.01);
    expect(excelRound(1234.5, -2)).toBe(1200);
    expect(val('=ROUND(-2.5,0)')).toBe(-3);
  });
  test('MIN of two expressions caps sales at demand', () => {
    expect(evaluateFormula('=B2*MIN(D2,E2)-C2*E2', makeSheet(['A', 'B', 'C', 'D', 'E'], [['Rope', 5, 2, 22, 30]]), 'F2').value).toBe(50);
  });
});

describe('random draws are reproducible', () => {
  test('same seed and label give the same draw; labels are independent', () => {
    expect(draw(42, 'a')).toBe(draw(42, 'a'));
    expect(draw(42, 'a')).not.toBe(draw(42, 'b'));
    const r = mulberry32(7);
    const first = [r(), r(), r()];
    const s = mulberry32(7);
    expect([s(), s(), s()]).toEqual(first);
  });
  test('weighted picks respect weights', () => {
    expect(weightedIndex([0, 0, 5], 0.01)).toBe(2);
    expect(weightedIndex([1, 1], 0.49)).toBe(0);
    expect(weightedIndex([1, 1], 0.51)).toBe(1);
  });
});

describe('Rune-word (Wordle rules)', () => {
  test('hits, near-misses and repeated letters', () => {
    expect(scoreGuess('MIN', 'MAX')).toEqual(['hit', 'miss', 'miss']);
    expect(scoreGuess('AVERAGEA'.slice(0, 7), 'AVERAGE')).toEqual(Array(7).fill('hit'));
    // Only one unmatched A remains in COUNTA, so the second A in the guess is a miss.
    expect(scoreGuess('AAAAAA', 'COUNTA')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss', 'hit']);
    expect(scoreGuess('ROUND', 'COUNT')).toEqual(['miss', 'hit', 'hit', 'hit', 'miss']);
    expect(scoreGuess('TRUNC', 'COUNT')).toEqual(['near', 'miss', 'hit', 'hit', 'near']);
  });
  test('only real function names of the right length count as guesses', () => {
    expect(guessProblem('ab', 'MAX', [])).toMatch(/3 letters/);
    expect(guessProblem('XYZ', 'MAX', [])).toMatch(/isn’t an Excel function/);
    expect(guessProblem('sum', 'MAX', ['SUM'])).toMatch(/already tried/);
    expect(guessProblem('min', 'MAX', [])).toBeNull();
    expect(letterStates(['MIN', 'SUM'], 'MAX')).toMatchObject({ M: 'hit', I: 'miss', S: 'miss' });
  });
  test('invalid guesses are not attempts; guesses are remembered; par counts as first time', () => {
    let run = goTo('rune-max');
    const bad = engine.submitAnswer(q, run, { guess: 'ZZZ' });
    expect(bad.outcome.valid).toBe(false);
    let r = engine.submitAnswer(q, run, { guess: 'sum' });
    expect(r.outcome.tiles).toEqual(['miss', 'miss', 'near']);
    run = r.run;
    r = engine.submitAnswer(q, run, { guess: 'MIN' });
    run = r.run;
    r = engine.submitAnswer(q, run, { guess: 'MAX' });
    expect(r.outcome.correct).toBe(true);
    expect(r.run.guesses!['rune-max']).toEqual(['SUM', 'MIN', 'MAX']);
    const scene = engine.currentScene(q, r.run);
    expect(engine.isFirstTry(scene, engine.resultFor(r.run, 'rune-max'))).toBe(true); // 3 guesses = par
  });
});

describe('Ledger Workshop', () => {
  test('the fill-down workshop keeps the original Excel checks', () => {
    const run = goTo('row-revenue');
    expect(engine.submitAnswer(q, run, { formula: '=B2*C2' }).outcome.correct).toBe(true);
    expect(engine.submitAnswer(q, run, { formula: '=25*6' }).outcome.feedback).toMatch(/typed numbers/);
    expect(engine.submitAnswer(q, run, { formula: '=$B$2*$C$2' }).outcome.issues!.map((i) => i.id)).toEqual(['D3', 'D4', 'D5']);
  });
  test('solutions must be buildable from the bench fragments', () => {
    expect(buildableFrom('=SUM(D2:D5)', ['=', 'SUM(', 'D2:D5', ')'])).toBe(true);
    expect(buildableFrom('=SUM(D2:D5)', ['=', 'SUM(', 'D2:D6', ')'])).toBe(false);
    const broken = clone(q);
    (broken.scenes.find((s) => s.id === 'total') as { tokens: string[] }).tokens = ['=', 'SUM(', ')', 'D2:D6'];
    expect(validateQuest(broken).join('\n')).toMatch(/cannot be built from its fragments/);
  });
});

describe('Repair Mission', () => {
  const run = goTo('absolute');
  test('both the diagnosis and the fix are checked', () => {
    expect(engine.submitAnswer(q, run, { diagnosis: 'drift', formula: '=B2*$E$2' }).outcome.correct).toBe(true);
    const wrongCause = engine.submitAnswer(q, run, { diagnosis: 'rate', formula: '=B2*$E$2' }).outcome;
    expect(wrongCause.correct).toBe(false);
    expect(wrongCause.feedback).toMatch(/diagnosis is off/);
    expect(engine.submitAnswer(q, run, { diagnosis: 'drift', formula: '=B2*E2' }).outcome.correct).toBe(false);
  });
  test('a fix that only works on today’s numbers fails the second ledger', () => {
    const typed = engine.submitAnswer(q, run, { diagnosis: 'drift', formula: '=B2*0.1' }).outcome;
    expect(typed.correct).toBe(false);
    expect(typed.issues!.map((i) => i.id)).toContain('check');
  });
  test('content validation rejects a "broken" formula that actually works', () => {
    const bad = clone(q);
    (bad.scenes.find((s) => s.id === 'absolute') as RepairScene).broken = '=B2*$E$2';
    expect(validateQuest(bad).join('\n')).toMatch(/not actually broken/);
  });
});

describe('Rune Wheel', () => {
  test('must spin before answering; the spin is reproducible and cannot be redone', () => {
    const run = goTo('rune-wheel', 99);
    expect(engine.submitAnswer(q, run, { response: 'x' }).outcome.message).toMatch(/Spin the wheel/);
    const a = engine.spinWheel(q, run);
    const b = engine.spinWheel(q, goTo('rune-wheel', 99));
    expect(a.spins!['rune-wheel']).toBe(b.spins!['rune-wheel']);
    expect(engine.spinWheel(q, a)).toBe(a); // no re-spin
    const scene = engine.currentScene(q, a) as WheelScene;
    const seg = engine.landedSegment(scene, a)!;
    expect(engine.submitAnswer(q, a, engine.correctAnswer(scene, a)!).outcome.correct).toBe(true);
    // Hints and concepts come from the landed segment.
    const wrong = engine.submitAnswer(q, a, wrongAnswer(scene, a)).outcome;
    expect(wrong.hint).toBe(seg.hints[0]);
    expect(engine.conceptsFor(scene, a)).toEqual(seg.concepts);
  });
  test('every segment can land, and review weights steer the spin towards weak concepts', () => {
    const landed = new Set<string>();
    for (let seed = 1; seed < 400; seed += 1) landed.add(engine.spinWheel(q, goTo('rune-wheel', seed)).spins!['rune-wheel']);
    expect(landed.size).toBe((q.scenes.find((s) => s.id === 'rune-wheel') as WheelScene).segments.length);
    const weights = { 'XL.REF.ABSOLUTE': 1000 };
    let hits = 0;
    for (let seed = 1; seed < 60; seed += 1) if (engine.spinWheel(q, goTo('rune-wheel', seed), weights).spins!['rune-wheel'] === 'exchange') hits += 1;
    expect(hits).toBeGreaterThan(50);
  });
  test('segments may only use concepts the quest has already taught', () => {
    const bad = clone(q);
    const wheel = bad.scenes.find((s) => s.id === 'rune-wheel') as WheelScene;
    wheel.segments[0].concepts = ['XL.LOOKUP.XLOOKUP'];
    expect(validateQuest(bad).join('\n')).toMatch(/before it is introduced/);
  });
});

describe('Rune match', () => {
  test('incomplete boards are not attempts; wrong pairs are explained', () => {
    const run = goTo('error-runes');
    expect(engine.submitAnswer(q, run, { pairs: { div0: 'zero' } }).outcome.valid).toBe(false);
    const swapped = { div0: 'zero', name: 'text', value: 'spell', ref: 'deleted' };
    const out = engine.submitAnswer(q, run, { pairs: swapped }).outcome;
    expect(out.correct).toBe(false);
    expect(out.issues!.map((i) => i.id).sort()).toEqual(['name', 'value']);
  });
});

describe("Trader's Gambit: the player's own numbers decide the outcome", () => {
  const run = goTo('restock');
  const scene = engine.currentScene(q, run) as GambitScene;
  const formula = scene.solution.formula;
  test('a profitable, affordable restock with a correct model succeeds', () => {
    const out = engine.submitAnswer(q, run, { orders: [6, 15, 0, 22], formula }).outcome;
    expect(out.correct).toBe(true);
    expect(out.trade!.total).toBe(186);
    expect(out.trade!.spend).toBe(194);
  });
  test('overspending the purse is refused', () => {
    const out = engine.submitAnswer(q, run, { orders: [6, 15, 3, 22], formula }).outcome;
    expect(out.issues!.map((i) => i.id)).toContain('purse');
  });
  test('too little profit fails, with the true outcome reported', () => {
    const out = engine.submitAnswer(q, run, { orders: [0, 5, 0, 10], formula }).outcome;
    expect(out.issues!.map((i) => i.id)).toEqual(['profit']);
    expect(out.trade!.total).toBe(50);
  });
  test('a profit formula that ignores demand is caught, even on orders where it happens to work', () => {
    const naive = engine.submitAnswer(q, run, { orders: [6, 15, 0, 22], formula: '=(B2-C2)*E2' }).outcome;
    expect(naive.correct).toBe(false);
    expect(naive.issues!.map((i) => i.id)).toContain('probe');
  });
  test('invalid orders are not attempts', () => {
    expect(engine.submitAnswer(q, run, { orders: [1, 2], formula }).outcome.valid).toBe(false);
    expect(engine.submitAnswer(q, run, { orders: [1, 2, 3, 99], formula }).outcome.valid).toBe(false);
  });
});

describe('Boss mission with data variants', () => {
  test('variants are chosen per run and stay fixed for that run', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 60; seed += 1) seen.add(engine.variantIndex(q.scenes.find((s) => s.id === 'audit-revenue')!, engine.createRun(q, seed)));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
  test('a memorised answer from another variant fails', () => {
    // Find two seeds that give different discrepancy variants.
    const scene = q.scenes.find((s) => s.id === 'audit-discrepancy')!;
    const seeds = [...Array(60).keys()].map((i) => i + 1);
    const a = seeds.find((s) => engine.variantIndex(scene, engine.createRun(q, s)) === 0)!;
    const b = seeds.find((s) => engine.variantIndex(scene, engine.createRun(q, s)) === 1)!;
    const runA = goTo('audit-discrepancy', a);
    const runB = goTo('audit-discrepancy', b);
    expect(engine.submitAnswer(q, runA, 'amber').outcome.correct).toBe(true);
    expect(engine.submitAnswer(q, runB, 'amber').outcome.correct).toBe(false);
    expect(engine.submitAnswer(q, runB, 'honey').outcome.correct).toBe(true);
  });
  test('boss steps hold back the first hint', () => {
    const run = goTo('audit-revenue');
    const first = engine.submitAnswer(q, run, { formula: '=1+1' });
    expect(first.outcome.hint).toBeNull();
    expect(engine.submitAnswer(q, first.run, { formula: '=1+1' }).outcome.hint).toBeTruthy();
  });
  test('perfect boss = mastery 1; a weak boss is not mastered and does not unlock the Great Hall', () => {
    const perfect = finish(goTo('audit-revenue'));
    expect(engine.bossScore(q, perfect)).toBe(1);
    expect(engine.isMastered(q, perfect)).toBe(true);

    // Reveal every boss answer: 0 mastery.
    let weak = goTo('audit-revenue');
    weak = finish(weak, q, (r) => wrongAnswer(engine.currentScene(q, r), r));
    expect(engine.bossScore(q, weak)).toBe(0);
    expect(engine.isMastered(q, weak)).toBe(false);
    expect(engine.computeMedal(q, weak)).toBe('none');

    const base = store.withCompletion(store.defaultProgress(), { ...engine.createRun(quests.get('missing-signal')!), completed: true }, 50, 3);
    const hall = world.destinations.find((d) => d.id === 'great-hall')!;
    const failed = store.withCompletion(base, weak, engine.computeXp(q, weak), 1, q.badge?.id, { mastered: false, mastery: 0, medal: 'none' });
    expect(progression.isDestinationUnlocked(hall, failed)).toBe(false);
    expect(progression.unlockRequirement(hall, quests, failed)).toMatch(/Pass the final challenge/);
    const passed = store.withCompletion(failed, perfect, engine.computeXp(q, perfect), 3, q.badge?.id, { mastered: true, mastery: 1, medal: 'silver' });
    expect(progression.isDestinationUnlocked(hall, passed)).toBe(true);
    expect(progression.newlyUnlocked(world, failed, passed).map((d) => d.id)).toEqual(['great-hall']);
    // A later weak replay never takes mastery or the medal away.
    const replay = store.withCompletion(passed, weak, 10, 1, undefined, { mastered: false, mastery: 0, medal: 'none' });
    expect(store.questRecord(replay, 'market-ledger')).toMatchObject({ mastered: true, bestMastery: 1, bestMedal: 'silver' });
  });
});

describe('XP wagers and medals', () => {
  test('stakes are capped at half the pot so far, and only before the first attempt', () => {
    const run = goTo('rune-max');
    const pot = engine.potBefore(q, run, 'rune-max');
    expect(pot).toBe(engine.computeXp(q, run));
    expect(engine.maxStake(q, run)).toBe(Math.floor(pot / 2));
    const staked = engine.placeWager(q, run, 10_000);
    expect(staked.wagers!['rune-max']).toBe(engine.maxStake(q, run));
    const tried = engine.submitAnswer(q, staked, { guess: 'SUM' }).run;
    expect(engine.placeWager(q, tried, 1)).toBe(tried); // locked after an attempt
    // Steps without a wager flag can't be staked on.
    const other = goTo('total');
    expect(engine.maxStake(q, other)).toBe(0);
    expect(engine.placeWager(q, other, 5)).toBe(other);
  });
  test('a correct first-time answer wins the stake; a miss loses it; the pot never drops below the floor', () => {
    const run = goTo('rune-max');
    const stake = engine.maxStake(q, run);
    const won = engine.submitAnswer(q, engine.placeWager(q, run, stake), { guess: 'MAX' }).run;
    expect(engine.wagerNet(q, won)).toBe(stake);
    expect(engine.computeXp(q, won)).toBe(engine.baseXp(q, won) + stake);

    let lost = engine.placeWager(q, run, stake);
    for (const g of ['SUM', 'MIN', 'ABS', 'DAY']) lost = engine.submitAnswer(q, lost, { guess: g }).run; // 4 misses: beyond par
    lost = engine.submitAnswer(q, lost, { guess: 'MAX' }).run;
    expect(engine.wagerNet(q, lost)).toBe(-stake);
    expect(engine.computeXp(q, lost)).toBe(Math.max(Math.ceil(engine.baseXp(q, lost) / 2), engine.baseXp(q, lost) - stake));
    expect(engine.computeXp(q, lost)).toBeGreaterThanOrEqual(Math.ceil(engine.baseXp(q, lost) / 2));
  });
  test('gold needs a stake and strong boss mastery; the safe path tops out at silver', () => {
    const safe = finish(engine.createRun(q, 3));
    expect(engine.computeMedal(q, safe)).toBe('silver');
    let bold = goTo('rune-max', 3);
    bold = engine.placeWager(q, bold, engine.maxStake(q, bold));
    bold = finish(bold);
    expect(engine.stakesPlaced(q, bold)).toBe(1);
    expect(engine.computeMedal(q, bold)).toBe('gold');
    expect(engine.MEDAL_RANK.gold).toBeGreaterThan(engine.MEDAL_RANK.silver);
  });
  test('wagers survive save and reload; tampered values are cleaned', () => {
    const run = engine.placeWager(q, goTo('rune-max'), 5);
    const restored = engine.restoreRun(q, JSON.parse(JSON.stringify(run)));
    expect(restored.wagers).toEqual({ 'rune-max': 5 });
    expect(restored.seed).toBe(run.seed);
    const tampered = engine.restoreRun(q, { ...run, wagers: { 'rune-max': -9, nope: 3 }, spins: { 'rune-wheel': 'ghost' }, guesses: { 'rune-max': ['<b>', 'MIN'] } });
    expect(tampered.wagers).toEqual({});
    expect(tampered.spins).toEqual({});
    expect(tampered.guesses).toEqual({ 'rune-max': ['MIN'] });
  });
});

describe('concept mastery and spaced recall', () => {
  const ctx = (c: string, day: number) => ({ firstTry: true, revealed: false, wrongAttempts: 0, context: c, day });
  test('levels rise only with real first-time successes across contexts and days', () => {
    let m = recordConcepts({}, ['XL.FN.SUM'], { firstTry: false, revealed: false, wrongAttempts: 2, context: 'market-ledger/total', day: 100 });
    expect(conceptLevel(m['XL.FN.SUM'])).toBe('practised');
    m = recordConcepts(m, ['XL.FN.SUM'], ctx('market-ledger/total', 100));
    m = recordConcepts(m, ['XL.FN.SUM'], ctx('market-ledger/rune-wheel', 100));
    expect(conceptLevel(m['XL.FN.SUM'])).toBe('demonstrated');
    m = recordConcepts(m, ['XL.FN.SUM'], ctx('market-ledger/audit-tax', 100));
    expect(conceptLevel(m['XL.FN.SUM'])).toBe('demonstrated'); // same day: not yet spaced
    m = recordConcepts(m, ['XL.FN.SUM'], ctx('market-ledger/rune-wheel', 103));
    expect(conceptLevel(m['XL.FN.SUM'])).toBe('mastered');
    const revealed = recordConcepts({}, ['XL.FN.MINMAX'], { firstTry: true, revealed: true, wrongAttempts: 3, context: 'market-ledger/rune-max', day: 1 });
    expect(conceptLevel(revealed['XL.FN.MINMAX'])).toBe('seen');
  });
  test('weak and fading concepts get more review weight', () => {
    const strong = recordConcepts({}, ['XL.FN.SUM'], ctx('a/b', 100))['XL.FN.SUM'];
    expect(reviewWeight(undefined, 100)).toBeGreaterThan(reviewWeight(strong, 100));
    expect(reviewWeight(strong, 120)).toBeGreaterThan(reviewWeight(strong, 100));
  });
  test('saved concept records are sanitised', () => {
    const clean = sanitizeConcepts({ 'XL.FN.SUM': { attempts: 3, contexts: ['a/b', '<x>'], days: [5, -1] }, 'bad id': {} });
    expect(Object.keys(clean)).toEqual(['XL.FN.SUM']);
    expect(clean['XL.FN.SUM'].contexts).toEqual(['a/b']);
    expect(clean['XL.FN.SUM'].days).toEqual([5]);
  });
});

describe('save schema v4', () => {
  test('a v3 save keeps completions and unlocks: completed quests count as mastered', () => {
    const v3 = { version: 3, player: { name: 'Asha', emblem: 'owl' }, quests: { 'missing-signal': { run: null, runXp: 0, lastRun: null, lastXp: 60, bestXp: 60, bestStars: 3, completed: true, completions: 1 }, 'market-ledger': { run: null, runXp: 0, lastRun: null, lastXp: 50, bestXp: 50, bestStars: 2, completed: true, completions: 1 } }, achievements: [], lessons: [], settings: { motion: 'system', textSize: 'normal', graphics: 'auto' } };
    const loaded = store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: JSON.stringify(v3) })).load();
    expect(loaded.version).toBe(4);
    expect(loaded.concepts).toEqual({});
    expect(store.questRecord(loaded, 'market-ledger')).toMatchObject({ completed: true, mastered: true, bestMedal: 'none', bestMastery: null });
    expect(progression.isDestinationUnlocked(world.destinations.find((d) => d.id === 'great-hall')!, loaded)).toBe(true);
  });
  test('progress with concepts and medals round-trips', () => {
    let p = store.withConcepts(store.defaultProgress(), recordConcepts({}, ['XL.FN.SUM'], ctx2()));
    p = store.withCompletion(p, { ...engine.createRun(q), completed: true }, 100, 3, undefined, { mastered: true, mastery: 0.9, medal: 'gold' });
    const s = store.createProgressStore(memoryStorage());
    s.save(p);
    const back = s.load();
    expect(back.concepts['XL.FN.SUM'].firstTry).toBe(1);
    expect(store.questRecord(back, 'market-ledger')).toMatchObject({ bestMedal: 'gold', bestMastery: 0.9, mastered: true });
  });
  function ctx2() { return { firstTry: true, revealed: false, wrongAttempts: 0, context: 'market-ledger/total', day: 10 }; }
});

describe('Codex and content integrity', () => {
  const codex = readJson<Codex>('public/data/codex.json');
  test('every concept used by any quest has a Codex card with an encyclopedia reference', () => {
    expect(validateCodex(codex, [...quests.values()])).toEqual([]);
  });
  test('missing Codex cards are reported', () => {
    const c = clone(codex);
    delete c.entries['XL.FN.SUM'];
    expect(validateCodex(c, [q]).join('\n')).toMatch(/XL.FN.SUM/);
  });
  test('every quest validates, including every data variant', () => {
    for (const id of QUEST_IDS) expect(validateQuest(loadQuest(id)), id).toEqual([]);
  });
  test('the Merchant’s Ledger mixes at least five distinct mechanics and ends in a boss', () => {
    const types = new Set(q.scenes.filter((s) => engine.isChallenge(s)).map((s) => s.type));
    expect(types.size).toBeGreaterThanOrEqual(5);
    expect(engine.bossScenes(q).length).toBeGreaterThanOrEqual(4);
    expect(new Set(engine.bossScenes(q).map((s) => s.type)).size).toBeGreaterThanOrEqual(3);
  });
});

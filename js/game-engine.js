// Pure game rules. No DOM access, no storage: every function takes state
// and returns new state, so the UI can be redesigned without touching quests.

export const CHALLENGE_TYPES = new Set(['choice', 'assemble']);
export const REVEAL_AFTER_ATTEMPTS = 3;

export const LEVELS = [
  { min: 0, name: 'Newcomer' },
  { min: 40, name: 'Scout' },
  { min: 100, name: 'Trailblazer' },
  { min: 200, name: 'Wayfinder' },
  { min: 350, name: 'Cartographer' },
];

export function isChallenge(scene) {
  return Boolean(scene) && CHALLENGE_TYPES.has(scene.type);
}

export function createRun(quest) {
  return { questId: quest.id, sceneIndex: 0, inspected: [], results: {}, completed: false };
}

// Rebuild a run from saved (untrusted) data, discarding anything that no
// longer matches the quest. Falls back to a fresh run when unusable.
export function restoreRun(quest, saved) {
  if (!saved || typeof saved !== 'object' || saved.questId !== quest.id) return createRun(quest);
  const last = quest.scenes.length - 1;
  const index = Number.isInteger(saved.sceneIndex) ? Math.min(Math.max(saved.sceneIndex, 0), last) : 0;
  const evidenceIds = new Set(quest.evidence.map((e) => e.id));
  const inspected = Array.isArray(saved.inspected)
    ? [...new Set(saved.inspected.filter((id) => evidenceIds.has(id)))]
    : [];
  const results = {};
  for (const scene of quest.scenes.filter(isChallenge)) {
    const r = saved.results && saved.results[scene.id];
    if (!r || typeof r !== 'object') continue;
    const attempts = Number.isInteger(r.attempts) && r.attempts > 0 ? Math.min(r.attempts, 99) : 0;
    if (!attempts && !r.revealed) continue;
    results[scene.id] = { attempts, solved: Boolean(r.solved), revealed: Boolean(r.revealed) };
  }
  const run = { questId: quest.id, sceneIndex: index, inspected, results, completed: false };
  // Never let a restored run sit beyond a challenge that was not solved.
  for (let i = 0; i < index; i += 1) {
    if (!isSceneDone(quest, run, quest.scenes[i])) {
      run.sceneIndex = i;
      break;
    }
  }
  run.completed = Boolean(saved.completed) && run.sceneIndex === last;
  return run;
}

export function currentScene(quest, run) {
  return quest.scenes[run.sceneIndex];
}

export function resultFor(run, sceneId) {
  return run.results[sceneId] || { attempts: 0, solved: false, revealed: false };
}

function isSceneDone(quest, run, scene) {
  if (scene.type === 'evidence') return scene.evidence.every((id) => run.inspected.includes(id));
  if (isChallenge(scene)) return resultFor(run, scene.id).solved;
  return true;
}

export function canAdvance(quest, run) {
  return !run.completed && isSceneDone(quest, run, currentScene(quest, run));
}

export function inspectEvidence(quest, run, evidenceId) {
  const scene = currentScene(quest, run);
  if (scene.type !== 'evidence' || !scene.evidence.includes(evidenceId)) return run;
  if (run.inspected.includes(evidenceId)) return run;
  return { ...run, inspected: [...run.inspected, evidenceId] };
}

export function advance(quest, run) {
  if (!canAdvance(quest, run)) return run;
  if (currentScene(quest, run).type === 'ending') return { ...run, completed: true };
  return { ...run, sceneIndex: run.sceneIndex + 1 };
}

function evaluateChoice(scene, answer) {
  const option = scene.options.find((o) => o.id === answer);
  if (!option) return { valid: false, message: 'Choose an option first.' };
  return { valid: true, correct: option.id === scene.correct, feedback: option.feedback, issues: [] };
}

function evaluateAssemble(scene, answer) {
  const slots = (answer && answer.slots) || {};
  const extras = new Set((answer && answer.extras) || []);
  const missing = scene.slots.filter((slot) => !slot.options.some((o) => o.id === slots[slot.id]));
  if (missing.length) {
    return { valid: false, message: `Choose an option for: ${missing.map((s) => s.label).join(', ')}.` };
  }
  const issues = [];
  for (const slot of scene.slots) {
    const chosen = slot.options.find((o) => o.id === slots[slot.id]);
    if (!chosen.correct) issues.push({ id: slot.id, label: slot.label, text: chosen.feedback });
  }
  for (const extra of scene.extras || []) {
    if (extras.has(extra.id) && !extra.supported) issues.push({ id: extra.id, label: extra.text, text: extra.feedback });
  }
  const correct = issues.length === 0;
  const feedback = correct
    ? scene.successFeedback || 'Everything checks out.'
    : `${issues.length} ${issues.length === 1 ? 'line needs' : 'lines need'} another look.`;
  return { valid: true, correct, feedback, issues };
}

export function evaluate(scene, answer) {
  if (scene.type === 'choice') return evaluateChoice(scene, answer);
  if (scene.type === 'assemble') return evaluateAssemble(scene, answer);
  return { valid: false, message: 'This step has no answer to check.' };
}

// Submit an answer for the current challenge. Invalid submissions (nothing
// chosen yet) do not count as an attempt.
export function submitAnswer(quest, run, answer) {
  const scene = currentScene(quest, run);
  const previous = resultFor(run, scene.id);
  if (!isChallenge(scene) || previous.solved) {
    return { run, outcome: { valid: false, message: 'This step is already complete.' } };
  }
  const result = evaluate(scene, answer);
  if (!result.valid) return { run, outcome: result };

  const attempts = previous.attempts + 1;
  const next = { attempts, solved: result.correct, revealed: false };
  const outcome = { ...result, attempts };
  if (result.correct) {
    outcome.explanation = scene.explanation;
  } else {
    const hints = scene.hints || [];
    outcome.hint = hints.length ? hints[Math.min(attempts - 1, hints.length - 1)] : null;
    outcome.canReveal = attempts >= REVEAL_AFTER_ATTEMPTS;
  }
  return { run: { ...run, results: { ...run.results, [scene.id]: next } }, outcome };
}

// After several attempts the player may ask to see the answer. The step is
// then complete but earns no XP and the skill is recorded as "reviewed".
export function revealAnswer(quest, run) {
  const scene = currentScene(quest, run);
  const previous = resultFor(run, scene.id);
  if (!isChallenge(scene) || previous.solved || previous.attempts < REVEAL_AFTER_ATTEMPTS) return run;
  return {
    ...run,
    results: { ...run.results, [scene.id]: { attempts: previous.attempts, solved: true, revealed: true } },
  };
}

export function correctAnswer(scene) {
  if (scene.type === 'choice') return scene.correct;
  if (scene.type === 'assemble') {
    const slots = {};
    for (const slot of scene.slots) slots[slot.id] = slot.options.find((o) => o.correct).id;
    return { slots, extras: (scene.extras || []).filter((e) => e.supported).map((e) => e.id) };
  }
  return null;
}

export function sceneXp(quest, scene, result) {
  if (!isChallenge(scene) || !result.solved || result.revealed) return 0;
  return (scene.xp || 0) + (result.attempts === 1 ? quest.xp.firstTryBonus || 0 : 0);
}

export function computeXp(quest, run) {
  let total = 0;
  for (const scene of quest.scenes) total += sceneXp(quest, scene, resultFor(run, scene.id));
  if (run.completed) total += quest.xp.completion || 0;
  return total;
}

export function maxXp(quest) {
  const perfect = { attempts: 1, solved: true, revealed: false };
  return quest.scenes.reduce((sum, scene) => sum + sceneXp(quest, scene, perfect), 0) + (quest.xp.completion || 0);
}

export const SKILL_STATUS = {
  demonstrated: 'Demonstrated',
  'with-hints': 'Demonstrated after a hint',
  reviewed: 'Reviewed with help',
  'not-yet': 'Not yet demonstrated',
};

// A badge alone is not proof of learning: report each objective with how it
// was shown, based on the challenges mapped to it.
export function skillReport(quest, run) {
  return quest.objectives.map((objective) => {
    const scenes = quest.scenes.filter((s) => isChallenge(s) && (s.skills || []).includes(objective.id));
    const results = scenes.map((s) => resultFor(run, s.id));
    let status = 'not-yet';
    if (results.length && results.every((r) => r.solved)) {
      if (results.some((r) => r.revealed)) status = 'reviewed';
      else if (results.every((r) => r.attempts === 1)) status = 'demonstrated';
      else status = 'with-hints';
    }
    return { id: objective.id, label: objective.label, status, statusLabel: SKILL_STATUS[status] };
  });
}

export function progressSummary(quest, run) {
  return { step: run.sceneIndex + 1, total: quest.scenes.length };
}

export function levelFor(xp) {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (xp >= level.min) index = i;
  });
  const next = LEVELS[index + 1] || null;
  return { level: index + 1, name: LEVELS[index].name, min: LEVELS[index].min, next };
}

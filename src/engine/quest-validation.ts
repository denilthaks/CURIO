// Checks quest and world content is well formed, so a content mistake shows
// up in tests (or as a clear error) instead of as a broken quest.

import type { Quest, World } from './types';
import type { Curriculum } from './types';
import { evaluate, correctAnswer } from './game-engine';
import { solutionModel, validateModel } from './schema-lab';

const SCENE_TYPES = new Set(['dialogue', 'evidence', 'lesson', 'choice', 'assemble', 'sql', 'python', 'excel', 'kpi', 'schema', 'ending']);
const CHALLENGES = ['choice', 'assemble', 'sql', 'python', 'excel', 'kpi', 'schema'];

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

export function validateQuest(quest: unknown): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);
  if (!quest || typeof quest !== 'object') return ['Quest is not an object.'];
  const q = quest as Quest;

  if (q.schemaVersion !== 1) fail('Unsupported schemaVersion.');
  if (!isText(q.id) || !/^[a-z0-9-]+$/.test(q.id)) fail('Quest id must be a lowercase slug.');
  for (const key of ['title', 'region', 'destination', 'subject', 'intro', 'takeaway'] as const) if (!isText(q[key])) fail(`Missing ${key}.`);
  if (!q.xp || !Number.isFinite(q.xp.completion) || !Number.isFinite(q.xp.firstTryBonus)) {
    fail('xp.completion and xp.firstTryBonus must be numbers.');
  }

  const objectives = Array.isArray(q.objectives) ? q.objectives : [];
  if (!objectives.length) fail('Quest needs at least one learning objective.');
  const objectiveIds = objectives.map((o) => o.id);
  duplicates(objectiveIds).forEach((id) => fail(`Duplicate objective id "${id}".`));
  objectives.forEach((o) => isText(o.label) || fail(`Objective "${o.id}" needs a label.`));

  const evidence = Array.isArray(q.evidence) ? q.evidence : [];
  const evidenceIds = evidence.map((e) => e.id);
  duplicates(evidenceIds).forEach((id) => fail(`Duplicate evidence id "${id}".`));
  evidence.forEach((e) => {
    if (!isText(e.title) || !isText(e.kindLabel) || !Array.isArray(e.body) || !e.body.length) {
      fail(`Evidence "${e.id}" needs a title, kindLabel and body.`);
    }
  });

  const characters = q.characters || {};
  const scenes = Array.isArray(q.scenes) ? q.scenes : [];
  if (!scenes.length) fail('Quest has no scenes.');
  duplicates(scenes.map((s) => s.id)).forEach((id) => fail(`Duplicate scene id "${id}".`));
  if (scenes.length && scenes[scenes.length - 1].type !== 'ending') fail('The last scene must be an ending.');
  if (scenes.filter((s) => s.type === 'ending').length > 1) fail('Only one ending scene is allowed.');

  const covered = new Set<string>();
  scenes.forEach((scene) => {
    const at = `Scene "${scene.id}"`;
    if (!SCENE_TYPES.has(scene.type)) { fail(`${at} has unknown type "${(scene as { type: string }).type}".`); return; }
    if (!isText(scene.title)) fail(`${at} needs a title.`);
    if (scene.speaker && !characters[scene.speaker]) fail(`${at} speaker "${scene.speaker}" is not a character.`);

    if (scene.type === 'evidence') {
      if (!Array.isArray(scene.evidence) || !scene.evidence.length) fail(`${at} lists no evidence.`);
      (scene.evidence || []).forEach((id) => evidenceIds.includes(id) || fail(`${at} references unknown evidence "${id}".`));
    }

    if (scene.type === 'lesson') {
      const l = scene.lesson;
      if (!l) { fail(`${at} has no lesson content.`); return; }
      for (const key of ['concept', 'objective', 'plainEnglish', 'analogy', 'whyItMatters', 'commonMistake', 'takeaway'] as const) {
        if (!isText(l[key])) fail(`${at} lesson needs ${key}.`);
      }
      if (l.example && !isText(l.example.code)) fail(`${at} lesson example needs code.`);
      if (!Array.isArray(scene.skills) || !scene.skills.length) fail(`${at} lesson must name the objectives it teaches.`);
      (scene.skills || []).forEach((id) => objectiveIds.includes(id) || fail(`${at} lesson references unknown objective "${id}".`));
    }

    if (CHALLENGES.includes(scene.type)) {
      const c = scene as Extract<typeof scene, { prompt: string }>;
      if (!isText(c.prompt)) fail(`${at} needs a prompt.`);
      if (!isText(c.explanation)) fail(`${at} needs an explanation.`);
      if (!Array.isArray(c.hints) || !c.hints.length) fail(`${at} needs at least one hint.`);
      if (!Number.isFinite(c.xp) || c.xp < 0) fail(`${at} needs a non-negative xp value.`);
      if (!Array.isArray(c.skills) || !c.skills.length) fail(`${at} must map to at least one objective.`);
      (c.skills || []).forEach((id) => {
        if (objectiveIds.includes(id)) covered.add(id);
        else fail(`${at} references unknown objective "${id}".`);
      });
    }

    if (scene.type === 'choice') {
      const options = Array.isArray(scene.options) ? scene.options : [];
      if (options.length < 2) fail(`${at} needs at least two options.`);
      duplicates(options.map((o) => o.id)).forEach((id) => fail(`${at} has duplicate option "${id}".`));
      if (!options.some((o) => o.id === scene.correct)) fail(`${at} correct answer "${scene.correct}" is not an option.`);
      options.forEach((o) => (isText(o.text) && isText(o.feedback)) || fail(`${at} option "${o.id}" needs text and feedback.`));
    }

    if (scene.type === 'assemble') {
      const slots = Array.isArray(scene.slots) ? scene.slots : [];
      if (!slots.length) fail(`${at} needs at least one slot.`);
      slots.forEach((slot) => {
        const options = Array.isArray(slot.options) ? slot.options : [];
        if (options.filter((o) => o.correct).length !== 1) fail(`${at} slot "${slot.id}" needs exactly one correct option.`);
        options.forEach((o) => {
          if (!isText(o.text)) fail(`${at} slot "${slot.id}" option "${o.id}" needs text.`);
          if (!o.correct && !isText(o.feedback)) fail(`${at} slot "${slot.id}" option "${o.id}" needs feedback.`);
        });
      });
      (scene.extras || []).forEach((extra) => {
        if (!isText(extra.text)) fail(`${at} extra "${extra.id}" needs text.`);
        if (!extra.supported && !isText(extra.feedback)) fail(`${at} extra "${extra.id}" needs feedback.`);
      });
    }

    if (scene.type === 'sql') {
      if (!isText(scene.setup) || !isText(scene.solution)) fail(`${at} needs setup SQL and a solution.`);
      if (!Array.isArray(scene.tables) || !scene.tables.length) fail(`${at} must show at least one table.`);
      if (!scene.expected || !Array.isArray(scene.expected.rows) || !scene.expected.rows.length) fail(`${at} needs expected rows.`);
      // The solution itself is executed against the setup in tests/sql-runner.test.ts.
    }

    if (scene.type === 'python' || scene.type === 'excel') {
      if (!isText(scene.solution)) fail(`${at} needs a solution.`);
      else {
        const result = evaluate(scene, correctAnswer(scene)!);
        if (!result.correct) fail(`${at} solution does not pass its own check: ${result.feedback ?? result.message}`);
      }
    }

    if (scene.type === 'schema') {
      const ids = (scene.tables || []).map((t) => t.id);
      duplicates(ids).forEach((id) => fail(`${at} has duplicate table "${id}".`));
      [...(scene.requiredTables || []), scene.factTable, ...(scene.dimensions || [])].forEach((id) => ids.includes(id) || fail(`${at} references unknown table "${id}".`));
      (scene.tables || []).forEach((t) => {
        if (!t.rows?.length || t.rows.some((r) => r.length !== t.columns.length)) fail(`${at} table "${t.id}" rows must match its columns.`);
      });
      if (scene.solution) {
        const result = validateModel(scene, solutionModel(scene));
        if (!result.correct) fail(`${at} solution fails the model rules: ${result.issues.filter((i) => i.severity === 'error').map((i) => i.title).join('; ')}`);
      } else fail(`${at} needs a solution.`);
    }

    if (scene.type === 'kpi') {
      const ids = (scene.categories || []).map((c) => c.id);
      if (ids.length < 2) fail(`${at} needs at least two categories.`);
      (scene.cards || []).forEach((card) => {
        if (!ids.includes(card.category)) fail(`${at} card "${card.id}" has an unknown category.`);
        if (!isText(card.feedback)) fail(`${at} card "${card.id}" needs feedback.`);
      });
      if ((scene.cards || []).length < 3) fail(`${at} needs at least three cards.`);
    }
  });

  objectiveIds.filter((id) => !covered.has(id)).forEach((id) => fail(`Objective "${id}" is never assessed.`));
  return errors;
}

export function validateWorld(world: unknown, questIds: string[] = []): string[] {
  const errors: string[] = [];
  const w = world as World | null;
  const destinations = w && Array.isArray(w.destinations) ? w.destinations : [];
  if (!destinations.length) return ['World has no destinations.'];
  duplicates(destinations.map((d) => d.id)).forEach((id) => errors.push(`Duplicate destination id "${id}".`));
  destinations.forEach((d) => {
    if (!isText(d.name) || !isText(d.theme)) errors.push(`Destination "${d.id}" needs a name and theme.`);
    if (!Array.isArray(d.position) || d.position.length !== 2 || !d.position.every(Number.isFinite)) {
      errors.push(`Destination "${d.id}" needs an [x, z] position.`);
    }
    (d.quests || []).forEach((q) => questIds.includes(q) || errors.push(`Destination "${d.id}" references unknown quest "${q}".`));
    if (d.unlockedBy !== 'planned') {
      if (!Array.isArray(d.unlockedBy)) errors.push(`Destination "${d.id}" needs unlockedBy (array or "planned").`);
      else d.unlockedBy.forEach((q) => questIds.includes(q) || errors.push(`Destination "${d.id}" is unlocked by unknown quest "${q}".`));
      if (!d.quests?.length) errors.push(`Destination "${d.id}" is not planned but has no quests.`);
    }
  });
  return errors;
}

/** Quest prerequisites must exist and must not form a cycle. */
export function validateRequirements(quests: Quest[]): string[] {
  const errors: string[] = [];
  const ids = new Set(quests.map((q) => q.id));
  for (const q of quests) (q.requires || []).forEach((r) => ids.has(r) || errors.push(`Quest "${q.id}" requires unknown quest "${r}".`));
  const byId = new Map(quests.map((q) => [q.id, q]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): boolean => {
    if (done.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const ok = (byId.get(id)?.requires || []).every(visit);
    visiting.delete(id);
    done.add(id);
    return ok;
  };
  for (const q of quests) if (!visit(q.id)) errors.push(`Quest prerequisites form a cycle involving "${q.id}".`);
  return [...new Set(errors)];
}

export function validateCurriculum(curriculum: unknown, questIds: string[]): string[] {
  const errors: string[] = [];
  const c = curriculum as Curriculum | null;
  const modules = c && Array.isArray(c.modules) ? c.modules : [];
  if (!modules.length) return ['Curriculum has no modules.'];
  const moduleIds = modules.map((m) => m.id);
  duplicates(moduleIds).forEach((id) => errors.push(`Duplicate module id "${id}".`));
  duplicates(modules.map((m) => String(m.number))).forEach((n) => errors.push(`Duplicate module number ${n}.`));
  const seen = new Map<string, string>();
  for (const m of modules) {
    if (!isText(m.title) || !isText(m.subject) || !isText(m.summary)) errors.push(`Module "${m.id}" needs a title, subject and summary.`);
    if (!['Beginner', 'Intermediate', 'Advanced', 'Capstone'].includes(m.level)) errors.push(`Module "${m.id}" has an unknown level.`);
    (m.quests || []).forEach((q) => {
      if (!questIds.includes(q)) errors.push(`Module "${m.id}" lists unknown quest "${q}".`);
      if (seen.has(q)) errors.push(`Quest "${q}" is in modules "${seen.get(q)}" and "${m.id}".`);
      seen.set(q, m.id);
    });
    (m.requires || []).forEach((r) => moduleIds.includes(r) || errors.push(`Module "${m.id}" requires unknown module "${r}".`));
    if (!(m.quests || []).length && !(m.planned || []).length) errors.push(`Module "${m.id}" has neither quests nor planned topics.`);
  }
  questIds.filter((q) => !seen.has(q)).forEach((q) => errors.push(`Quest "${q}" is not in any module.`));
  return errors;
}

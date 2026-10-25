// Loads quest/world JSON and checks it is well formed, so a content mistake
// shows up in tests (or as a clear error) instead of as a broken quest.

const SCENE_TYPES = new Set(['dialogue', 'evidence', 'choice', 'assemble', 'ending']);

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function duplicates(ids) {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

export function validateQuest(quest) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!quest || typeof quest !== 'object') return ['Quest is not an object.'];

  if (quest.schemaVersion !== 1) fail('Unsupported schemaVersion.');
  if (!isText(quest.id) || !/^[a-z0-9-]+$/.test(quest.id)) fail('Quest id must be a lowercase slug.');
  for (const key of ['title', 'region', 'intro', 'takeaway']) if (!isText(quest[key])) fail(`Missing ${key}.`);
  if (!quest.xp || !Number.isFinite(quest.xp.completion) || !Number.isFinite(quest.xp.firstTryBonus)) {
    fail('xp.completion and xp.firstTryBonus must be numbers.');
  }

  const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
  if (!objectives.length) fail('Quest needs at least one learning objective.');
  const objectiveIds = objectives.map((o) => o.id);
  duplicates(objectiveIds).forEach((id) => fail(`Duplicate objective id "${id}".`));
  objectives.forEach((o) => isText(o.label) || fail(`Objective "${o.id}" needs a label.`));

  const evidence = Array.isArray(quest.evidence) ? quest.evidence : [];
  const evidenceIds = evidence.map((e) => e.id);
  duplicates(evidenceIds).forEach((id) => fail(`Duplicate evidence id "${id}".`));
  evidence.forEach((e) => {
    if (!isText(e.title) || !isText(e.kindLabel) || !Array.isArray(e.body) || !e.body.length) {
      fail(`Evidence "${e.id}" needs a title, kindLabel and body.`);
    }
  });

  const characters = quest.characters || {};
  const scenes = Array.isArray(quest.scenes) ? quest.scenes : [];
  if (!scenes.length) fail('Quest has no scenes.');
  duplicates(scenes.map((s) => s.id)).forEach((id) => fail(`Duplicate scene id "${id}".`));
  if (scenes.length && scenes[scenes.length - 1].type !== 'ending') fail('The last scene must be an ending.');
  if (scenes.filter((s) => s.type === 'ending').length > 1) fail('Only one ending scene is allowed.');

  const covered = new Set();
  scenes.forEach((scene) => {
    const at = `Scene "${scene.id}"`;
    if (!SCENE_TYPES.has(scene.type)) return fail(`${at} has unknown type "${scene.type}".`);
    if (!isText(scene.title)) fail(`${at} needs a title.`);
    if (scene.speaker && !characters[scene.speaker]) fail(`${at} speaker "${scene.speaker}" is not a character.`);

    if (scene.type === 'evidence') {
      if (!Array.isArray(scene.evidence) || !scene.evidence.length) fail(`${at} lists no evidence.`);
      (scene.evidence || []).forEach((id) => evidenceIds.includes(id) || fail(`${at} references unknown evidence "${id}".`));
    }

    if (scene.type === 'choice' || scene.type === 'assemble') {
      if (!isText(scene.prompt)) fail(`${at} needs a prompt.`);
      if (!isText(scene.explanation)) fail(`${at} needs an explanation.`);
      if (!Array.isArray(scene.hints) || !scene.hints.length) fail(`${at} needs at least one hint.`);
      if (!Number.isFinite(scene.xp) || scene.xp < 0) fail(`${at} needs a non-negative xp value.`);
      if (!Array.isArray(scene.skills) || !scene.skills.length) fail(`${at} must map to at least one objective.`);
      (scene.skills || []).forEach((id) => {
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
  });

  objectiveIds.filter((id) => !covered.has(id)).forEach((id) => fail(`Objective "${id}" is never assessed.`));
  return errors;
}

export function validateWorld(world, questIds = []) {
  const errors = [];
  const regions = world && Array.isArray(world.regions) ? world.regions : [];
  if (!regions.length) return ['World has no regions.'];
  duplicates(regions.map((r) => r.id)).forEach((id) => errors.push(`Duplicate region id "${id}".`));
  regions.forEach((r) => {
    if (!isText(r.name) || !isText(r.theme)) errors.push(`Region "${r.id}" needs a name and theme.`);
    if (r.quest && !questIds.includes(r.quest)) errors.push(`Region "${r.id}" references unknown quest "${r.quest}".`);
    if (r.unlockedBy && r.unlockedBy !== 'future' && !questIds.includes(r.unlockedBy)) {
      errors.push(`Region "${r.id}" is unlocked by unknown quest "${r.unlockedBy}".`);
    }
  });
  return errors;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  return response.json();
}

// Paths are relative so the site works under a GitHub Pages project path.
export async function loadQuest(id) {
  const quest = await fetchJson(`data/quests/${id}.json`);
  const errors = validateQuest(quest);
  if (errors.length) throw new Error(`Quest "${id}" is invalid: ${errors[0]}`);
  return quest;
}

export async function loadWorld() {
  const world = await fetchJson('data/world.json');
  const questIds = world.regions.map((r) => r.quest).filter(Boolean);
  const errors = validateWorld(world, questIds);
  if (errors.length) throw new Error(`World data is invalid: ${errors[0]}`);
  return world;
}

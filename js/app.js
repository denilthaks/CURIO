// Wires content, rules, storage and screens together.
// Quest content → game engine → UI rendering → progress storage.

import { h } from './dom.js';
import { startRouter, navigate } from './router.js';
import { loadQuest, loadWorld } from './quest-loader.js';
import * as engine from './game-engine.js';
import * as store from './progress-store.js';
import { applySettings, focusMainHeading, announce } from './accessibility.js';
import { renderHome, renderStart, EMBLEM_INFO } from './ui/home.js';
import { renderMap } from './ui/map.js';
import { renderQuest } from './ui/quest.js';
import { renderRewards } from './ui/rewards.js';
import { createSettingsDialog } from './ui/settings.js';

const FEEDBACK_URL =
  'https://github.com/denilthaks/CURIO/issues/new?title=CurioTrail%20feedback&body=What%20felt%20confusing%3F%0A%0AWhat%20did%20you%20learn%3F%0A%0AWould%20you%20try%20another%20quest%3F';

const main = document.getElementById('main');
const persistence = store.createProgressStore();
let progress = persistence.load();
let world;
const quests = new Map();
let currentRoute = null;

function save(next) {
  progress = next;
  persistence.save(progress);
  updateHud();
}

// ---- Header (identity + XP) ----

const hud = document.getElementById('hud');
function updateHud() {
  const total = store.totalXp(progress);
  const level = engine.levelFor(total);
  if (!progress.player) {
    hud.replaceChildren();
    hud.hidden = true;
    return;
  }
  const emblem = EMBLEM_INFO[progress.player.emblem];
  const span = level.next ? level.next.min - level.min : 1;
  const into = level.next ? total - level.min : 1;
  hud.hidden = false;
  hud.replaceChildren(
    h('span', { class: 'hud-emblem', 'aria-hidden': 'true' }, emblem.symbol),
    h('span', { class: 'hud-text' },
      h('span', { class: 'hud-name' }, progress.player.name),
      h('span', { class: 'hud-level' }, `Level ${level.level} · ${level.name} · ${total} XP`)),
    h('progress', {
      class: 'hud-xp', max: String(span), value: String(into),
      'aria-label': level.next ? `${level.next.min - total} XP until ${level.next.name}` : 'Highest level reached',
    }));
}

const settings = createSettingsDialog({
  getProgress: () => progress,
  storageAvailable: persistence.available,
  onChange(change) {
    save(store.withSettings(progress, change));
    applySettings(progress.settings);
  },
  onReset() {
    persistence.reset();
    progress = store.defaultProgress();
    applySettings(progress.settings);
    updateHud();
    announce('All progress has been reset.');
    navigate('/');
  },
});
document.body.append(settings.element);
document.getElementById('open-settings').addEventListener('click', () => settings.open());

// ---- Screens ----

function questState(questId) {
  const quest = quests.get(questId);
  const record = store.questRecord(progress, questId);
  const run = engine.restoreRun(quest, record.run);
  return { quest, record, run };
}

function resumeInfo() {
  for (const [id, quest] of quests) {
    const record = progress.quests[id];
    if (record?.run && !record.run.completed) {
      const run = engine.restoreRun(quest, record.run);
      return { questId: id, step: run.sceneIndex + 1, total: quest.scenes.length };
    }
  }
  return null;
}

function replay(questId) {
  save(store.withReplay(progress, questId));
  navigate(`/quest/${questId}`);
}

function show(view, title) {
  main.replaceChildren(view);
  document.title = title ? `${title} · CurioTrail` : 'CurioTrail: Find your way through the digital world';
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === currentRoute.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  focusMainHeading(main);
}

function route(r) {
  currentRoute = r;
  if (r.name === 'start') {
    return show(renderStart({
      player: progress.player,
      onSubmit(name, emblem) {
        save(store.withPlayer(progress, name, emblem));
        navigate('/quest/missing-signal');
      },
    }), 'Choose your identity');
  }

  if (r.name === 'map') {
    return show(renderMap({ world, quests, progress, onReplay: replay }), 'The Atlas');
  }

  if (r.name === 'quest' || r.name === 'complete') {
    if (!quests.has(r.id)) return navigate('/map');
    if (!progress.player) return navigate('/start');
    const { quest, record, run } = questState(r.id);
    const region = world.regions.find((reg) => reg.id === quest.region);

    if (r.name === 'complete') {
      if (!record.completed) return navigate(`/quest/${quest.id}`);
      // Results come from the last finished run, so they survive starting a replay.
      const finished = engine.restoreRun(quest, record.lastRun);
      return show(renderRewards({
        quest, run: finished, xp: record.lastXp, bestXp: record.bestXp, total: store.totalXp(progress), world, feedbackUrl: FEEDBACK_URL, onReplay: replay,
      }), `${quest.title}: results`);
    }

    // A finished run opened from the quest URL starts a fresh replay.
    const active = run.completed ? engine.createRun(quest) : run;
    if (run.completed) save(store.withReplay(progress, quest.id));
    return show(renderQuest({
      quest,
      regionName: region ? region.name : '',
      run: active,
      onUpdate(next) {
        save(store.withRun(progress, next, engine.computeXp(quest, next)));
      },
      onFinish(finished) {
        save(store.withCompletion(progress, finished, engine.computeXp(quest, finished), quest.badge?.id));
        navigate(`/complete/${quest.id}`);
      },
    }), quest.title);
  }

  return show(renderHome({
    resume: resumeInfo(),
    hasPlayer: Boolean(progress.player),
    storageAvailable: persistence.available,
    feedbackUrl: FEEDBACK_URL,
  }));
}

function showError(error) {
  const fileProtocol = location.protocol === 'file:';
  main.replaceChildren(h('section', { class: 'narrow error-state', 'aria-labelledby': 'error-title' },
    h('h1', { id: 'error-title' }, 'The trail is blocked'),
    h('p', {}, 'CurioTrail couldn’t load its quest data.'),
    fileProtocol
      ? h('p', {}, 'It looks like this page was opened directly from a file. Browsers block that. Run a small local server instead (see the README), or use the hosted version.')
      : h('p', {}, 'Please check your connection and reload the page.'),
    h('p', { class: 'hint' }, `Details: ${error.message}`),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, 'Reload')));
  focusMainHeading(main);
}

async function init() {
  applySettings(progress.settings);
  updateHud();
  try {
    world = await loadWorld();
    const ids = world.regions.map((r) => r.quest).filter(Boolean);
    const loaded = await Promise.all(ids.map((id) => loadQuest(id)));
    loaded.forEach((quest) => quests.set(quest.id, quest));
  } catch (error) {
    showError(error);
    return;
  }
  startRouter(route);
}

init();

import { h } from '../dom.js';

// Status is always shown as text plus an icon, never colour alone.
const STATUS = {
  completed: { icon: '✓', label: 'Completed' },
  'in-progress': { icon: '◐', label: 'In progress' },
  available: { icon: '●', label: 'Available' },
  revealed: { icon: '✦', label: 'Revealed: quest in development' },
  locked: { icon: '🔒', label: 'Locked' },
};

export function regionStatus(region, progress) {
  const unlocked = region.unlockedBy === null || Boolean(progress.quests[region.unlockedBy]?.completed);
  if (!unlocked) return 'locked';
  if (!region.quest) return 'revealed';
  const record = progress.quests[region.quest];
  if (record?.run && !record.run.completed) return 'in-progress';
  if (record?.completed) return 'completed';
  return 'available';
}

function regionAction(region, status, quests, progress, onReplay) {
  const quest = quests.get(region.quest);
  if (!quest) return null;
  const record = progress.quests[region.quest];
  if (status === 'in-progress') {
    return h('a', { class: 'btn btn-primary', href: `#/quest/${quest.id}` },
      `Continue: step ${record.run.sceneIndex + 1} of ${quest.scenes.length}`);
  }
  if (status === 'completed') {
    return h('div', { class: 'cta-row' },
      h('a', { class: 'btn btn-secondary', href: `#/complete/${quest.id}` }, 'View results'),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => onReplay(quest.id) }, 'Replay quest'));
  }
  return h('a', { class: 'btn btn-primary', href: `#/quest/${quest.id}` }, 'Start quest');
}

export function renderMap({ world, quests, progress, onReplay }) {
  const items = world.regions.map((region) => {
    const status = regionStatus(region, progress);
    const quest = quests.get(region.quest);
    const record = quest ? progress.quests[quest.id] : null;
    const titleId = `region-${region.id}`;
    let description;
    if (quest && status !== 'locked') {
      description = h('div', {},
        h('p', { class: 'region-quest' }, `Quest ${String(quest.number).padStart(2, '0')}: ${quest.title}`),
        h('p', {}, quest.intro),
        h('p', { class: 'meta' }, `About ${quest.estimatedMinutes} minutes`, record?.bestXp ? ` · Best: ${record.bestXp} XP` : ''));
    } else if (status === 'revealed') {
      description = h('p', {}, region.teaser, ' This quest is still being built. Check back in a future update.');
    } else {
      description = h('p', {}, region.teaser, ' Unlocks in a future update.');
    }
    return h('li', { class: `region region--${status}` },
      h('span', { class: 'region-icon', 'aria-hidden': 'true' }, region.icon),
      h('div', { class: 'region-body' },
        h('div', { class: 'region-head' },
          h('h2', { id: titleId }, region.name),
          h('span', { class: `status status--${status}` },
            h('span', { 'aria-hidden': 'true' }, STATUS[status].icon), ' ', STATUS[status].label)),
        h('p', { class: 'region-theme' }, region.theme),
        description,
        status === 'locked' || status === 'revealed' ? null : regionAction(region, status, quests, progress, onReplay)));
  });

  return h('section', { class: 'map-page', 'aria-labelledby': 'map-title' },
    h('p', { class: 'eyebrow' }, 'The Unmapped World'),
    h('h1', { id: 'map-title' }, 'The Atlas'),
    h('p', { class: 'lede' }, 'Each region holds a practical skill. Complete quests to reveal new paths.'),
    h('ol', { class: 'atlas' }, items));
}

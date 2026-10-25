import { h, svg } from '../dom.js';
import { EMBLEMS, MAX_NAME_LENGTH } from '../progress-store.js';
import { HERO_ART } from './art.js';

export const EMBLEM_INFO = {
  fox: { symbol: '🦊', label: 'Fox', trait: 'Curious and quick to explore' },
  owl: { symbol: '🦉', label: 'Owl', trait: 'Careful and thoughtful' },
  deer: { symbol: '🦌', label: 'Deer', trait: 'Calm and observant' },
  badger: { symbol: '🦡', label: 'Badger', trait: 'Persistent and practical' },
};

export function renderHome({ resume, hasPlayer, storageAvailable, feedbackUrl }) {
  const primary = resume
    ? h('a', { class: 'btn btn-primary btn-lg', href: `#/quest/${resume.questId}` }, `Continue your quest (step ${resume.step} of ${resume.total})`)
    : h('a', { class: 'btn btn-primary btn-lg', href: hasPlayer ? '#/quest/missing-signal' : '#/start' }, 'Start your first quest');

  return h('div', { class: 'home' },
    h('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'eyebrow' }, 'A free, story-driven learning adventure'),
        h('h1', { id: 'hero-title', class: 'hero-title' }, 'CurioTrail'),
        h('p', { class: 'tagline' }, 'Find your way through the digital world.'),
        h('p', { class: 'lede' }, 'Solve short story quests that build everyday digital skills, starting with how to check what an AI tells you.'),
        h('div', { class: 'cta-row' },
          primary,
          hasPlayer ? h('a', { class: 'btn btn-ghost btn-lg', href: '#/map' }, 'Open the map') : null),
        h('p', { class: 'fine-print' }, 'No account, no sign-up, no cost. One quest takes about 5–8 minutes.')),
      h('div', { class: 'hero-visual' }, svg(HERO_ART))),

    h('section', { class: 'how', 'aria-labelledby': 'how-title' },
      h('h2', { id: 'how-title' }, 'How it works'),
      h('ol', { class: 'how-steps' },
        h('li', {}, h('span', { class: 'how-icon', 'aria-hidden': 'true' }, '🔍'), h('h3', {}, 'Investigate'), h('p', {}, 'A character brings you a real-world problem and the evidence to go with it.')),
        h('li', {}, h('span', { class: 'how-icon', 'aria-hidden': 'true' }, '🧭'), h('h3', {}, 'Decide'), h('p', {}, 'Make choices. Wrong answers come with hints and a chance to try again, never a penalty.')),
        h('li', {}, h('span', { class: 'how-icon', 'aria-hidden': 'true' }, '🗺️'), h('h3', {}, 'Restore the Atlas'), h('p', {}, 'Earn XP, see which skills you showed, and open new paths on the map.')))),

    h('section', { class: 'about card-quiet', 'aria-labelledby': 'about-title' },
      h('h2', { id: 'about-title' }, 'About this prototype'),
      h('ul', { class: 'plain-list' },
        h('li', {}, 'This is an early, open-source prototype with one complete quest. More regions are planned.'),
        h('li', {}, storageAvailable
          ? 'Your progress is saved only in this browser. Clearing your browsing data will erase it.'
          : 'Your browser is blocking storage, so progress will not be saved between visits.'),
        h('li', {}, 'We don’t collect personal information. There are no ads, streaks or timers.')),
      h('p', {}, h('a', { href: feedbackUrl, target: '_blank', rel: 'noopener' }, 'Share feedback on GitHub', h('span', { class: 'sr-only' }, ' (opens in a new tab)')))));
}

export function renderStart({ player, onSubmit }) {
  const nameInput = h('input', {
    id: 'pathfinder-name', name: 'name', type: 'text', maxlength: String(MAX_NAME_LENGTH), autocomplete: 'nickname',
    value: player ? player.name : '', 'aria-describedby': 'name-hint',
  });
  const selected = player ? player.emblem : EMBLEMS[0];

  const form = h('form', { class: 'identity-form', novalidate: true },
    h('div', { class: 'field' },
      h('label', { for: 'pathfinder-name' }, 'What should Mira call you?'),
      h('p', { id: 'name-hint', class: 'hint' }, `Optional. Use a nickname. Up to ${MAX_NAME_LENGTH} characters. It stays on this device.`),
      nameInput),
    h('fieldset', { class: 'field' },
      h('legend', {}, 'Choose your emblem'),
      h('div', { class: 'emblem-grid' },
        EMBLEMS.map((id) => h('label', { class: 'emblem-option' },
          h('input', { type: 'radio', name: 'emblem', value: id, checked: id === selected }),
          h('span', { class: 'emblem-card' },
            h('span', { class: 'emblem-symbol', 'aria-hidden': 'true' }, EMBLEM_INFO[id].symbol),
            h('span', { class: 'emblem-label' }, EMBLEM_INFO[id].label),
            h('span', { class: 'emblem-trait' }, EMBLEM_INFO[id].trait)))))),
    h('div', { class: 'cta-row' },
      h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Begin the quest'),
      h('a', { class: 'btn btn-ghost', href: '#/' }, 'Back')));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onSubmit(String(data.get('name') || ''), String(data.get('emblem') || EMBLEMS[0]));
  });

  return h('section', { class: 'start narrow', 'aria-labelledby': 'start-title' },
    h('p', { class: 'eyebrow' }, 'Join the Pathfinders'),
    h('h1', { id: 'start-title' }, 'Choose your Pathfinder identity'),
    h('p', { class: 'lede' }, 'Pathfinders rebuild the Atlas, a map of practical knowledge, by solving everyday problems.'),
    form);
}

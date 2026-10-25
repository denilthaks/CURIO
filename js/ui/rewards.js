import { h } from '../dom.js';
import { skillReport, levelFor } from '../game-engine.js';

const SKILL_ICON = { demonstrated: '✓', 'with-hints': '✓', reviewed: '💡', 'not-yet': '○' };

export function renderRewards({ quest, run, xp, bestXp, total, world, feedbackUrl, onReplay }) {
  const skills = skillReport(quest, run);
  const level = levelFor(total);
  const nextRegion = world.regions.find((r) => r.id === quest.next?.region);

  return h('section', { class: 'rewards narrow', 'aria-labelledby': 'rewards-title' },
    h('p', { class: 'eyebrow' }, `Quest ${String(quest.number).padStart(2, '0')} complete`),
    h('h1', { id: 'rewards-title' }, quest.completionTitle || 'Quest complete'),
    h('p', { class: 'lede' }, `You finished “${quest.title}”.`),

    h('dl', { class: 'stats' },
      h('div', { class: 'stat' }, h('dt', {}, 'XP this run'), h('dd', {}, String(xp))),
      h('div', { class: 'stat' }, h('dt', {}, 'Best on this quest'), h('dd', {}, String(bestXp))),
      h('div', { class: 'stat' }, h('dt', {}, 'Your level'), h('dd', {}, `${level.level} · ${level.name}`))),

    quest.badge
      ? h('div', { class: 'badge-card' },
        h('span', { class: 'badge-medal', 'aria-hidden': 'true' }, quest.badge.icon || '🏅'),
        h('div', {}, h('p', { class: 'badge-kicker' }, 'Badge earned'), h('p', { class: 'badge-name' }, quest.badge.name), h('p', {}, quest.badge.description)))
      : null,

    h('h2', {}, 'Skills you showed'),
    h('ul', { class: 'skills' }, skills.map((skill) => h('li', { class: `skill skill--${skill.status}` },
      h('span', { class: 'skill-icon', 'aria-hidden': 'true' }, SKILL_ICON[skill.status]),
      h('span', { class: 'skill-text' }, h('span', { class: 'skill-label' }, skill.label), h('span', { class: 'skill-status' }, skill.statusLabel))))),

    h('h2', {}, 'Take this with you'),
    h('p', { class: 'takeaway' }, quest.takeaway),

    h('div', { class: 'cta-row' },
      h('a', { class: 'btn btn-primary btn-lg', href: '#/map' }, 'Explore the map'),
      h('button', { class: 'btn btn-secondary btn-lg', type: 'button', onclick: () => onReplay(quest.id) }, 'Replay quest')),

    h('div', { class: 'card-quiet feedback-ask' },
      h('h2', {}, 'Help shape CurioTrail'),
      h('p', {}, 'Was anything confusing? Would you try another quest? Your feedback decides what gets built next.'),
      h('a', { href: feedbackUrl, target: '_blank', rel: 'noopener' }, 'Share feedback on GitHub', h('span', { class: 'sr-only' }, ' (opens in a new tab)'))),

    quest.next
      ? h('aside', { class: 'next-preview', 'aria-labelledby': 'next-title' },
        h('p', { class: 'eyebrow' }, 'New region revealed'),
        h('h2', { id: 'next-title' }, nextRegion ? `${nextRegion.icon} ${nextRegion.name}` : quest.next.title),
        h('p', { class: 'region-quest' }, `Coming next: ${quest.next.title}`),
        h('p', {}, quest.next.teaser),
        h('p', { class: 'status status--revealed' }, h('span', { 'aria-hidden': 'true' }, '✦'), ' In development, not playable yet'))
      : null);
}

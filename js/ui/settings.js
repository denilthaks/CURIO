import { h } from '../dom.js';

// Settings live in a native <dialog>, which traps focus, closes on Escape
// and returns focus to the button that opened it.
export function createSettingsDialog({ getProgress, storageAvailable, onChange, onReset }) {
  const dialog = h('dialog', { class: 'settings-dialog', 'aria-labelledby': 'settings-title' });

  function radioGroup(legend, name, choices, current) {
    return h('fieldset', { class: 'field' },
      h('legend', {}, legend),
      h('div', { class: 'options options--compact' }, choices.map(([value, label, hint]) => h('label', { class: 'option' },
        h('input', { type: 'radio', name, value, checked: current === value, onchange: () => onChange({ [name]: value }) }),
        h('span', { class: 'option-text' }, label, hint ? h('span', { class: 'hint' }, ` ${hint}`) : null)))));
  }

  function renderResetArea(confirming) {
    if (!confirming) {
      return h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: () => swapReset(true) }, 'Reset all progress');
    }
    return h('div', { class: 'confirm', role: 'group', 'aria-labelledby': 'confirm-text' },
      h('p', { id: 'confirm-text' }, 'This erases your identity, XP and quest progress on this device. It can’t be undone.'),
      h('div', { class: 'cta-row' },
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { onReset(); dialog.close(); } }, 'Yes, reset everything'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => swapReset(false) }, 'Keep my progress')));
  }

  function swapReset(confirming) {
    const area = dialog.querySelector('.reset-area');
    area.replaceChildren(renderResetArea(confirming));
    area.querySelector('button').focus();
  }

  function render() {
    const { settings } = getProgress();
    dialog.replaceChildren(
      h('div', { class: 'dialog-head' },
        h('h2', { id: 'settings-title' }, 'Settings'),
        h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Close settings', onclick: () => dialog.close() }, '✕')),
      radioGroup('Motion', 'motion', [
        ['system', 'Follow my device setting'],
        ['reduce', 'Reduce motion', '(no animations)'],
        ['full', 'Allow motion'],
      ], settings.motion),
      radioGroup('Text size', 'textSize', [
        ['normal', 'Standard'],
        ['large', 'Larger text'],
      ], settings.textSize),
      h('section', { class: 'field' },
        h('h3', {}, 'Your progress'),
        h('p', { class: 'hint' }, storageAvailable
          ? 'Progress is saved only in this browser. Clearing browsing data will also erase it.'
          : 'This browser is blocking storage, so progress won’t be kept after you leave.'),
        h('div', { class: 'reset-area' }, renderResetArea(false))));
  }

  return {
    element: dialog,
    open() {
      render();
      dialog.showModal();
    },
  };
}

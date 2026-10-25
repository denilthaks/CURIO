import { h, svg, uniqueId } from '../dom.js';
import * as engine from '../game-engine.js';
import { announce, focusElement } from '../accessibility.js';
import { NOTICEBOARD_ART } from './art.js';

const KIND_ICON = { source: '📜', ai: '🤖', message: '💬' };

// Renders one quest and drives it through the engine. The view owns no game
// rules: it reports actions to the engine and redraws from the returned run.
export function renderQuest({ quest, regionName, run: initialRun, onUpdate, onFinish }) {
  let run = initialRun;
  // View-only state for the current step; reset whenever the step changes.
  let view = { sceneId: null, outcome: null, tried: [], answer: null };

  const progressLabel = h('span', { class: 'progress-label', id: 'quest-progress-label' });
  const progressBar = h('progress', { max: String(quest.scenes.length), 'aria-labelledby': 'quest-progress-label' });
  const stage = h('div', { class: 'quest-stage' });
  const evidencePanel = h('aside', { class: 'evidence-panel', 'aria-label': 'Evidence you have collected' });

  const root = h('section', { class: 'quest', 'aria-labelledby': 'quest-title' },
    h('header', { class: 'quest-head' },
      h('p', { class: 'eyebrow' }, `${regionName} · Quest ${String(quest.number).padStart(2, '0')}`),
      h('h1', { id: 'quest-title', class: 'quest-title' }, quest.title),
      h('div', { class: 'quest-progress' }, progressLabel, progressBar)),
    h('div', { class: 'quest-body' }, stage, evidencePanel));

  function commit(next, { focus } = {}) {
    run = next;
    onUpdate(run);
    draw(focus);
  }

  function draw(focus) {
    const scene = engine.currentScene(quest, run);
    const entering = view.sceneId !== scene.id;
    if (entering) view = { sceneId: scene.id, outcome: null, tried: [], answer: null };
    const { step, total } = engine.progressSummary(quest, run);
    progressLabel.textContent = `Step ${step} of ${total}`;
    progressBar.value = step;

    const article = renderScene(scene);
    // Only animate on arrival, not on every redraw after checking an answer.
    if (entering) article.classList.add('scene--enter');
    stage.replaceChildren(article);
    drawEvidencePanel(scene);

    if (focus === 'scene') focusElement(stage.querySelector('.scene-title'));
    if (focus === 'feedback') focusElement(stage.querySelector('.feedback'));
  }

  function drawEvidencePanel(scene) {
    const collected = quest.evidence.filter((e) => run.inspected.includes(e.id));
    const show = collected.length > 0 && scene.type !== 'evidence' && scene.type !== 'ending' && scene.type !== 'dialogue';
    evidencePanel.hidden = !show;
    if (!show) return;
    const wasOpen = evidencePanel.querySelector('details')?.open;
    const open = wasOpen ?? window.matchMedia('(min-width: 960px)').matches;
    evidencePanel.replaceChildren(
      h('details', { class: 'evidence-drawer', open },
        h('summary', {}, h('span', {}, 'Evidence'), h('span', { class: 'count' }, ` (${collected.length})`)),
        h('div', { class: 'evidence-stack' }, collected.map((item) => evidenceCard(item, { compact: true })))));
  }

  function next(focus = 'scene') {
    const before = run;
    const after = engine.advance(quest, run);
    if (after === before) return;
    if (after.completed) {
      run = after;
      onFinish(run);
      return;
    }
    commit(after, { focus });
  }

  // ---- Scene renderers ----

  function renderScene(scene) {
    const parts = [h('h2', { class: 'scene-title' }, scene.title)];
    if (scene.speaker) parts.push(speech(scene));
    if (scene.type === 'dialogue') parts.push(actions(h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => next() }, scene.action || 'Continue')));
    if (scene.type === 'evidence') parts.push(evidenceScene(scene));
    if (scene.type === 'choice') parts.push(choiceScene(scene));
    if (scene.type === 'assemble') parts.push(assembleScene(scene));
    if (scene.type === 'ending') parts.push(endingScene(scene));
    return h('article', { class: `scene scene--${scene.type} parchment` }, parts);
  }

  function speech(scene) {
    const character = quest.characters[scene.speaker];
    const lines = scene.lines || (scene.context ? [scene.context] : []);
    return h('div', { class: 'speech' },
      h('div', { class: 'speaker' },
        h('span', { class: `portrait portrait--${scene.speaker}`, 'aria-hidden': 'true' }, character.initial),
        h('p', { class: 'speaker-id' }, h('span', { class: 'speaker-name' }, character.name), h('span', { class: 'speaker-role' }, character.role))),
      h('div', { class: 'speech-bubble' }, lines.map((line) => h('p', {}, line))));
  }

  function evidenceCard(item, { compact = false, collapsed = false, onInspect } = {}) {
    const bodyId = uniqueId('evidence');
    const body = h('div', { class: 'evidence-body', id: bodyId, hidden: collapsed },
      item.body.map((line) => h('p', {}, line)));
    const header = h('header', { class: 'evidence-head' },
      h('span', { class: `tag tag--${item.kind}` }, h('span', { 'aria-hidden': 'true' }, KIND_ICON[item.kind] || '•'), ' ', item.kindLabel),
      h('h3', { class: 'evidence-title' }, item.title),
      h('p', { class: 'evidence-from' }, h('span', { class: 'label' }, 'From: '), item.from));
    const card = h('article', { class: `evidence evidence--${item.kind}${compact ? ' evidence--compact' : ''}`, dataset: { evidence: item.id } }, header, body);
    if (onInspect) {
      card.append(h('button', {
        class: 'btn btn-secondary evidence-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': bodyId,
        onclick: () => onInspect(item.id),
      }, 'Inspect ', h('span', { class: 'sr-only' }, item.title)));
    }
    return card;
  }

  function evidenceScene(scene) {
    const items = scene.evidence.map((id) => quest.evidence.find((e) => e.id === id));
    const done = items.filter((e) => run.inspected.includes(e.id)).length;
    const cards = items.map((item) => {
      const inspected = run.inspected.includes(item.id);
      return evidenceCard(item, {
        collapsed: !inspected,
        onInspect: inspected ? null : (id) => {
          commit(engine.inspectEvidence(quest, run, id));
          const body = stage.querySelector(`[data-evidence="${item.id}"] .evidence-body`);
          focusElement(body);
          const remaining = scene.evidence.length - run.inspected.filter((e) => scene.evidence.includes(e)).length;
          announce(remaining ? `${item.title} opened. ${remaining} left to inspect.` : `${item.title} opened. All evidence inspected.`);
        },
      });
    });
    const complete = done === items.length;
    return h('div', {},
      h('div', { class: 'evidence-grid' }, cards),
      complete
        ? actions(h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => next() }, scene.action || 'Continue'))
        : h('p', { class: 'gate-note' }, `Inspect every item to continue (${done} of ${items.length} inspected).`));
  }

  // ---- Challenges ----

  function choiceScene(scene) {
    const result = engine.resultFor(run, scene.id);
    const solved = result.solved;
    const correctId = scene.correct;
    const name = uniqueId('answer');
    const selected = solved ? correctId : view.answer;

    const options = scene.options.map((option) => {
      const tried = view.tried.includes(option.id);
      const isCorrect = solved && option.id === correctId;
      return h('label', { class: `option${tried ? ' option--tried' : ''}${isCorrect ? ' option--correct' : ''}` },
        h('input', {
          type: 'radio', name, value: option.id, checked: selected === option.id, disabled: solved,
          onchange: () => { view.answer = option.id; },
        }),
        h('span', { class: 'option-text' }, option.text,
          tried && !isCorrect ? h('span', { class: 'option-note' }, ' · tried') : null,
          isCorrect ? h('span', { class: 'option-note' }, ' · correct answer') : null));
    });

    const form = h('form', { class: 'challenge', novalidate: true },
      h('fieldset', {},
        h('legend', { class: 'prompt' }, scene.prompt),
        h('div', { class: 'options' }, options)),
      solved ? null : actions(h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Check answer')));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      check(scene, view.answer);
    });

    return h('div', {}, form, feedback(scene, result));
  }

  function draftPreview(scene, answer, { restored = false } = {}) {
    const lines = scene.slots.map((slot) => {
      const option = slot.options.find((o) => o.id === answer.slots[slot.id]);
      return h('li', { class: option ? '' : 'placeholder' }, option ? option.text : `[${slot.label}]`);
    });
    const extras = (scene.extras || []).filter((e) => answer.extras.includes(e.id)).map((e) => h('li', {}, e.text));
    return h('div', { class: `notice-preview${restored ? ' notice-preview--restored' : ''}` },
      h('p', { class: 'notice-kicker' }, restored ? 'Published' : 'Draft preview'),
      h('h3', {}, scene.heading),
      (scene.fixedLines || []).map((line) => h('p', {}, line)),
      h('ul', {}, lines, extras));
  }

  function assembleScene(scene) {
    const result = engine.resultFor(run, scene.id);
    const solved = result.solved;
    if (!view.answer) view.answer = { slots: {}, extras: [] };
    const answer = solved ? engine.correctAnswer(scene) : view.answer;
    const previewHolder = h('div', { class: 'preview-holder', 'aria-label': 'Live preview of your announcement', role: 'region' }, draftPreview(scene, answer));
    const refresh = () => previewHolder.replaceChildren(draftPreview(scene, view.answer));

    const slotGroups = scene.slots.map((slot) => {
      const name = uniqueId(`slot-${slot.id}`);
      return h('fieldset', { class: 'slot' },
        h('legend', {}, slot.label),
        h('div', { class: 'options options--compact' }, slot.options.map((option) => h('label', { class: `option${solved && option.correct ? ' option--correct' : ''}` },
          h('input', {
            type: 'radio', name, value: option.id, checked: answer.slots[slot.id] === option.id, disabled: solved,
            onchange: () => { view.answer.slots[slot.id] = option.id; refresh(); },
          }),
          h('span', { class: 'option-text' }, option.text)))));
    });

    const extras = (scene.extras || []).length
      ? h('fieldset', { class: 'slot' },
        h('legend', {}, 'Extra details ', h('span', { class: 'hint' }, '(optional, tick any that the notice supports)')),
        h('div', { class: 'options options--compact' }, scene.extras.map((extra) => h('label', { class: 'option option--check' },
          h('input', {
            type: 'checkbox', value: extra.id, checked: answer.extras.includes(extra.id), disabled: solved,
            onchange: (event) => {
              const set = new Set(view.answer.extras);
              if (event.target.checked) set.add(extra.id); else set.delete(extra.id);
              view.answer.extras = scene.extras.map((e) => e.id).filter((id) => set.has(id));
              refresh();
            },
          }),
          h('span', { class: 'option-text' }, extra.text)))))
      : null;

    const form = h('form', { class: 'challenge assemble', novalidate: true },
      h('p', { class: 'prompt' }, scene.prompt),
      h('div', { class: 'assemble-grid' }, h('div', { class: 'assemble-fields' }, slotGroups, extras), previewHolder),
      solved ? null : actions(h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Check announcement')));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      check(scene, { slots: { ...view.answer.slots }, extras: [...view.answer.extras] });
    });

    return h('div', {}, form, feedback(scene, result));
  }

  function check(scene, answer) {
    const { run: after, outcome } = engine.submitAnswer(quest, run, answer);
    if (!outcome.valid) {
      const message = stage.querySelector('.form-message') || h('p', { class: 'form-message' });
      message.textContent = outcome.message;
      stage.querySelector('.challenge .actions')?.before(message);
      announce(outcome.message);
      return;
    }
    view.outcome = outcome;
    if (!outcome.correct && scene.type === 'choice' && !view.tried.includes(answer)) view.tried.push(answer);
    commit(after, { focus: 'feedback' });
  }

  function feedback(scene, result) {
    const outcome = view.outcome;
    if (result.solved) {
      const xp = engine.sceneXp(quest, scene, result);
      const title = result.revealed ? 'Here’s the answer' : 'Correct!';
      return h('div', { class: `feedback feedback--${result.revealed ? 'revealed' : 'correct'}`, tabindex: '-1' },
        h('p', { class: 'feedback-title' }, h('span', { 'aria-hidden': 'true' }, result.revealed ? '💡 ' : '✓ '), title),
        outcome && outcome.correct && outcome.feedback ? h('p', {}, outcome.feedback) : null,
        h('div', { class: 'why' }, h('p', { class: 'why-label' }, 'Why it matters'), h('p', {}, scene.explanation)),
        result.revealed
          ? h('p', { class: 'xp-note' }, 'No XP for this step, and your recap will show this skill as “reviewed with help”. That’s fine. You can replay later.')
          : h('p', { class: 'xp-note' }, `+${xp} XP`, result.attempts === 1 ? ' (includes first-try bonus)' : ''),
        actions(h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => next() }, 'Continue')));
    }
    if (!outcome || outcome.correct) return null;

    return h('div', { class: 'feedback feedback--retry', tabindex: '-1' },
      h('p', { class: 'feedback-title' }, h('span', { 'aria-hidden': 'true' }, '↻ '), 'Not quite. Try again'),
      outcome.issues && outcome.issues.length
        ? h('div', {}, h('p', {}, outcome.feedback),
          h('ul', { class: 'issues' }, outcome.issues.map((issue) => h('li', {}, h('strong', {}, `${issue.label}: `), issue.text))))
        : h('p', {}, outcome.feedback),
      outcome.hint ? h('p', { class: 'hint-box' }, h('strong', {}, 'Hint: '), outcome.hint) : null,
      outcome.canReveal
        ? h('div', { class: 'reveal' },
          h('p', {}, 'Stuck? You can see the answer and an explanation, then carry on.'),
          h('button', {
            class: 'btn btn-ghost', type: 'button',
            onclick: () => { view.outcome = null; commit(engine.revealAnswer(quest, run), { focus: 'feedback' }); },
          }, 'Show me the answer'))
        : null);
  }

  function endingScene(scene) {
    const assemble = quest.scenes.find((s) => s.type === 'assemble');
    const xp = engine.computeXp(quest, { ...run, completed: true });
    return h('div', { class: 'ending' },
      h('div', { class: 'restored' },
        svg(NOTICEBOARD_ART),
        assemble ? draftPreview(assemble, engine.correctAnswer(assemble), { restored: true }) : null),
      h('p', { class: 'xp-total' }, h('span', { 'aria-hidden': 'true' }, '✨ '), `You earned ${xp} XP on this quest.`),
      actions(h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => next() }, scene.action || 'Finish')));
  }

  function actions(...buttons) {
    return h('div', { class: 'actions' }, buttons);
  }

  draw();
  return root;
}

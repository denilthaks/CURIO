import { useState } from 'react';
import { useGame } from '../../app/game';
import { afterIdentityPath, navigate } from '../../app/router';
import { BACKGROUNDS, BACKGROUND_LABELS, EMBLEMS, GOALS, GOAL_LABELS, MAX_NAME_LENGTH, withPlayer, type Emblem } from '../../engine/progress-store';
import { EMBLEM_INFO } from '../emblems';

/** `next`: the quest the player chose before being asked who they are, if any. */
export function StartScreen({ next }: { next?: string }) {
  const { progress, update, quests } = useGame();
  const [name, setName] = useState(progress.player?.name ?? '');
  const [emblem, setEmblem] = useState<Emblem>(progress.player?.emblem ?? EMBLEMS[0]);
  // Optional preferences: '' means skipped. They are stored only and change nothing in the game yet.
  const [background, setBackground] = useState<string>(progress.player?.background ?? '');
  const [goal, setGoal] = useState<string>(progress.player?.goal ?? '');
  const choices = (group: string, legend: string, options: readonly string[], labels: Record<string, string>, value: string, set: (v: string) => void) => (
    <fieldset className="field pref-field">
      <legend>{legend} <span className="hint">(optional)</span></legend>
      <div className="pref-grid">
        {options.map((id) => (
          <label className="pref-option" key={id}>
            <input type="radio" name={group} value={id} checked={value === id} onChange={() => set(id)} />
            <span className="pref-card">{labels[id]}</span>
          </label>
        ))}
        <label className="pref-option pref-option--skip">
          <input type="radio" name={group} value="" checked={value === ''} onChange={() => set('')} />
          <span className="pref-card">Skip</span>
        </label>
      </div>
    </fieldset>
  );

  return (
    <section className="start panel-center" aria-labelledby="start-title">
      <div className="card-solid">
        <p className="eyebrow">Join the Pathfinders</p>
        <h1 id="start-title">Choose your Pathfinder identity</h1>
        <p className="lede">Pathfinders rebuild the Atlas, a map of practical knowledge, by solving everyday problems.</p>
        <form
          className="identity-form"
          onSubmit={(e) => {
            e.preventDefault();
            update((p) => withPlayer(p, name, emblem, { background: background || null, goal: goal || null }));
            navigate(afterIdentityPath(next, (id) => quests.has(id)));
          }}
        >
          <div className="field">
            <label htmlFor="pathfinder-name">What should Mira call you?</label>
            <p id="name-hint" className="hint">Optional. Use a nickname of up to {MAX_NAME_LENGTH} characters. It stays on this device.</p>
            <input id="pathfinder-name" type="text" maxLength={MAX_NAME_LENGTH} autoComplete="nickname" aria-describedby="name-hint" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="field">
            <legend>Choose your emblem</legend>
            <div className="emblem-grid">
              {EMBLEMS.map((id) => (
                <label className="emblem-option" key={id}>
                  <input type="radio" name="emblem" value={id} checked={emblem === id} onChange={() => setEmblem(id)} />
                  <span className="emblem-card">
                    <span className="emblem-symbol" aria-hidden="true">{EMBLEM_INFO[id].symbol}</span>
                    <span className="emblem-label">{EMBLEM_INFO[id].label}</span>
                    <span className="emblem-trait">{EMBLEM_INFO[id].trait}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {choices('background', 'Your background', BACKGROUNDS, BACKGROUND_LABELS, background, setBackground)}
          {choices('goal', 'Your learning goal', GOALS, GOAL_LABELS, goal, setGoal)}
          <p className="hint">Both are optional and can be skipped. They are saved only on this device.</p>
          <div className="cta-row">
            <button className="btn btn-primary btn-lg" type="submit">Begin the quest</button>
            <a className="btn btn-ghost" href="#/">Back</a>
          </div>
        </form>
      </div>
    </section>
  );
}

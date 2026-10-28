import { useState } from 'react';
import { useGame } from '../../app/game';
import { afterIdentityPath, navigate } from '../../app/router';
import { EMBLEMS, MAX_NAME_LENGTH, withPlayer, type Emblem } from '../../engine/progress-store';
import { EMBLEM_INFO } from '../emblems';

/** `next`: the quest the player chose before being asked who they are, if any. */
export function StartScreen({ next }: { next?: string }) {
  const { progress, update, quests } = useGame();
  const [name, setName] = useState(progress.player?.name ?? '');
  const [emblem, setEmblem] = useState<Emblem>(progress.player?.emblem ?? EMBLEMS[0]);

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
            update((p) => withPlayer(p, name, emblem));
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
          <div className="cta-row">
            <button className="btn btn-primary btn-lg" type="submit">Begin the quest</button>
            <a className="btn btn-ghost" href="#/">Back</a>
          </div>
        </form>
      </div>
    </section>
  );
}

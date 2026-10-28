// In-world feedback for the game mechanics. The scene itself shows what
// happened (ledger cells settle or flag, the stall reacts); this strip only
// says it in words, so it stays short. The explanation is one tap away
// instead of stopping every round. Revealed answers keep the full explanation.

import type { ReactNode } from 'react';
import type { ChallengeResult, ChallengeScene, Outcome, Quest } from '../../engine/types';
import { isFirstTry, sceneXp } from '../../engine/game-engine';
import { Actions } from '../quest/common';

const CELL = /^[A-Z][1-9]\d*$/;

/** Cells the engine flagged in its last check (issue ids that are cell addresses). */
export function flaggedCells(outcome: Outcome | null): string[] {
  if (!outcome || outcome.correct) return [];
  return (outcome.issues ?? []).map((i) => i.id).filter((id) => CELL.test(id));
}

export function GameFeedback({ quest, scene, result, outcome, onReveal, onNext, revealedAnswer, note, speaker, practice = false }: {
  quest: Quest; scene: ChallengeScene; result: ChallengeResult; outcome: Outcome | null; practice?: boolean;
  onReveal: () => void; onNext: () => void; revealedAnswer?: ReactNode; note?: ReactNode;
  /** Who reacts in the story (defaults to the step's speaker). */
  speaker?: string;
}) {
  const who = quest.characters[speaker ?? scene.speaker ?? '']?.name;
  if (result.solved && result.revealed) {
    return (
      <div className="feedback feedback--revealed feedback--game" tabIndex={-1} data-feedback>
        <p className="game-result"><span className="game-result-icon" aria-hidden="true">💡</span><strong>Here’s the answer</strong></p>
        {revealedAnswer}
        <p className="game-why-open">{scene.explanation}</p>
        {!practice && <p className="xp-note">No XP for this step, and your recap will show this skill as “reviewed with help”. Replay later for the full reward.</p>}
        {note && <p className="xp-note wager-note">{note}</p>}
        <Actions><button type="button" className="btn btn-primary btn-lg" onClick={onNext}>Continue</button></Actions>
      </div>
    );
  }
  if (result.solved) {
    const xp = sceneXp(quest, scene, result);
    const first = isFirstTry(scene, result);
    return (
      <div className="feedback feedback--correct feedback--game" tabIndex={-1} data-feedback>
        <p className="game-result">
          <span className="game-result-icon" aria-hidden="true">✓</span>
          <span className="sr-only">Correct. </span>
          <span>{outcome?.correct && outcome.feedback ? outcome.feedback : 'Solved.'}</span>
          {!practice && <span className="xp-chip">+{xp} XP{first ? ' · first try' : ` · attempt ${result.attempts}`}</span>}
        </p>
        {note && <p className="xp-note wager-note">{note}</p>}
        <div className="game-result-row">
          <details className="why-more">
            <summary>Why it works</summary>
            <p>{scene.explanation}</p>
          </details>
          <button type="button" className="btn btn-primary" onClick={onNext}>Continue <span aria-hidden="true">→</span></button>
        </div>
      </div>
    );
  }
  if (!outcome || outcome.correct) return null;
  const inScene = flaggedCells(outcome).length > 0;
  // Don't repeat the headline in the list (an evidence pick has a single issue that is the headline).
  const issues = (outcome.issues ?? []).filter((i) => i.text !== outcome.feedback);
  return (
    <div className="feedback feedback--retry feedback--game" tabIndex={-1} data-feedback>
      <p className="game-result"><span className="game-result-icon" aria-hidden="true">↻</span><span className="sr-only">Not yet. </span><span>{outcome.feedback}</span></p>
      {note && <p className="xp-note wager-note">{note}</p>}
      {issues.length > 0 && (
        <ul className={`issues issues--compact${inScene ? ' is-marked' : ''}`}>{issues.map((issue) => <li key={issue.id}><strong>{issue.label}: </strong>{issue.text}</li>)}</ul>
      )}
      {outcome.hint && <p className="game-whisper"><span aria-hidden="true">💬 </span>{who ? `${who}: ` : ''}{outcome.hint}</p>}
      {outcome.canReveal && (
        <p className="game-reveal">Stuck? <button type="button" className="btn btn-ghost btn-sm" onClick={onReveal}>Show me the answer</button></p>
      )}
    </div>
  );
}

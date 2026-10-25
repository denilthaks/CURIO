import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { navigate } from '../../app/router';
import { announce, focusElement } from '../../app/a11y';
import * as engine from '../../engine/game-engine';
import { questRecord, totalXp, withCompletion, withRun } from '../../engine/progress-store';
import { destinationForQuest, newlyUnlocked } from '../../engine/progression';
import type { Answer, Outcome, Run } from '../../engine/types';
import type { Pose } from '../../world/characters';
import { EvidenceCard, type SceneProps } from '../quest/common';
import { AssembleView, ChoiceView, DialogueView, EndingView, EvidenceView, ExcelView, KpiView, PythonView, SqlView } from '../quest/Scenes';

interface Props {
  questId: string;
  onPose: (p: { character?: string; pose: Pose }) => void;
}

export function QuestScreen({ questId, onPose }: Props) {
  const game = useGame();
  const { quests, world, update, setLastCompletion } = game;
  const quest = quests.get(questId)!;
  const destination = destinationForQuest(world, questId)!;
  const [run, setRun] = useState<Run>(() => {
    const record = questRecord(game.progress, questId);
    return record.run && !record.run.completed ? engine.restoreRun(quest, record.run) : engine.createRun(quest);
  });
  const [view, setView] = useState<{ sceneId: string; outcome: Outcome | null; tried: string[]; invalid: string | null }>(
    { sceneId: '', outcome: null, tried: [], invalid: null },
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<'scene' | 'feedback' | null>(null);
  const progressRef = useRef(game.progress);
  progressRef.current = game.progress;

  const scene = engine.currentScene(quest, run);
  const v = view.sceneId === scene.id ? view : { sceneId: scene.id, outcome: null, tried: [], invalid: null };
  const result = engine.resultFor(run, scene.id);

  // Character pose in the 3D world follows the story.
  useEffect(() => {
    let pose: Pose = 'idle';
    if (scene.type === 'dialogue') pose = 'talk';
    else if (scene.type === 'evidence') pose = 'point';
    else if (scene.type === 'ending') pose = 'wave';
    else if (result.solved && !result.revealed) pose = 'celebrate';
    else if (v.outcome && !v.outcome.correct) pose = 'talk';
    onPose({ character: scene.speaker ?? Object.keys(quest.characters)[0], pose });
  }, [scene, result.solved, result.revealed, v.outcome, onPose, quest]);

  // Focus management after each render that changed the step or feedback.
  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === 'scene') focusElement(stageRef.current?.querySelector('.scene-title'));
    if (target === 'feedback') focusElement(stageRef.current?.querySelector('[data-feedback]'));
  });

  const commit = (next: Run, focus: 'scene' | 'feedback' | null) => {
    setRun(next);
    focusTarget.current = focus;
    update((p) => withRun(p, next, engine.computeXp(quest, next)));
  };

  const onCheck = (answer: Answer) => {
    const { run: next, outcome } = engine.submitAnswer(quest, run, answer);
    if (!outcome.valid) {
      setView({ ...v, invalid: outcome.message ?? 'Please answer first.' });
      announce(outcome.message ?? '');
      return;
    }
    const tried = scene.type === 'choice' && !outcome.correct && typeof answer === 'string' && !v.tried.includes(answer) ? [...v.tried, answer] : v.tried;
    setView({ sceneId: scene.id, outcome, tried, invalid: null });
    commit(next, 'feedback');
  };

  const onReveal = () => {
    setView({ ...v, outcome: null, invalid: null });
    commit(engine.revealAnswer(quest, run), 'feedback');
  };

  const onInspect = (id: string) => {
    const next = engine.inspectEvidence(quest, run, id);
    commit(next, null);
    const item = quest.evidence.find((e) => e.id === id)!;
    const remaining = scene.type === 'evidence' ? scene.evidence.filter((e) => !next.inspected.includes(e)).length : 0;
    announce(remaining ? `${item.title} opened. ${remaining} left to inspect.` : `${item.title} opened. All evidence inspected.`);
    window.setTimeout(() => focusElement(stageRef.current?.querySelector(`[data-evidence="${id}"] .evidence-body`)), 30);
  };

  const onNext = () => {
    const after = engine.advance(quest, run);
    if (after === run) return;
    if (!after.completed) {
      commit(after, 'scene');
      return;
    }
    // Quest finished: the engine computes XP and stars; the store keeps the
    // best result so replays never stack rewards.
    const before = progressRef.current;
    const xp = engine.computeXp(quest, after);
    const stars = engine.computeStars(quest, after);
    const record = questRecord(before, quest.id);
    const nextProgress = withCompletion(before, after, xp, stars, quest.badge?.id);
    // XP shows live during a run, so measure the gain against the total as it
    // stood before this run: other quests plus this quest's previous best.
    const baseline = totalXp(before) - Math.max(record.bestXp, record.runXp) + record.bestXp;
    setLastCompletion({
      questId: quest.id,
      runXp: xp,
      totalBefore: baseline,
      totalAfter: totalXp(nextProgress),
      stars,
      bestStarsBefore: record.bestStars,
      firstCompletion: !record.completed,
      unlocked: newlyUnlocked(world, before, nextProgress).map((d) => d.id),
    });
    setRun(after);
    update(() => nextProgress);
    navigate(`/complete/${quest.id}`);
  };

  const props: SceneProps = { quest, scene, result, outcome: v.outcome, tried: v.tried, inspected: run.inspected, onCheck, onReveal, onNext, onInspect, invalid: v.invalid };
  const { step, total } = engine.progressSummary(quest, run);
  const collected = quest.evidence.filter((e) => run.inspected.includes(e.id));
  const showDrawer = collected.length > 0 && engine.isChallenge(scene);

  let body: React.ReactNode;
  switch (scene.type) {
    case 'dialogue': body = <DialogueView {...(props as SceneProps<typeof scene>)} />; break;
    case 'evidence': body = <EvidenceView {...(props as SceneProps<typeof scene>)} />; break;
    case 'choice': body = <ChoiceView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'assemble': body = <AssembleView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'sql': body = <SqlView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'python': body = <PythonView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'excel': body = <ExcelView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'kpi': body = <KpiView key={scene.id} {...(props as SceneProps<typeof scene>)} />; break;
    case 'ending': body = <EndingView {...(props as SceneProps<typeof scene>)} run={run} />; break;
    default: body = null;
  }

  return (
    <section className="quest-screen" aria-labelledby="quest-title">
      <div className="quest-panel">
        <header className="quest-head">
          <a className="back-link" href={`#/map/${destination.id}`}>← {destination.name}</a>
          <p className="eyebrow">Quest {String(quest.number).padStart(2, '0')} · {quest.subject}</p>
          <h1 id="quest-title" className="quest-title">{quest.title}</h1>
          <div className="quest-progress">
            <span id="quest-progress-label">Step {step} of {total}</span>
            <progress max={total} value={step} aria-labelledby="quest-progress-label" />
          </div>
        </header>
        <div ref={stageRef}>
          <article key={scene.id} className={`scene scene--${scene.type} parchment`}>
            <h2 className="scene-title" tabIndex={-1}>{scene.title}</h2>
            {body}
          </article>
        </div>
        {showDrawer && (
          <details className="evidence-drawer">
            <summary>Evidence ({collected.length})</summary>
            <div className="evidence-stack">{collected.map((item) => <EvidenceCard key={item.id} item={item} compact />)}</div>
          </details>
        )}
      </div>
    </section>
  );
}

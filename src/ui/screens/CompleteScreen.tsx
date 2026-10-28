import { useGame } from '../../app/game';
import { navigate } from '../../app/router';
import { bossScore, computeMedal, conceptReport, isChallenge, isFirstTry, levelFor, maxXp, resultFor, restoreRun, skillReport, stakesPlaced, wagerNet, type Medal, type SkillStatus } from '../../engine/game-engine';
import { questRecord, totalXp, withReplay } from '../../engine/progress-store';
import { destinationForQuest, nextQuestAt } from '../../engine/progression';
import { Stars } from '../Stars';

const SKILL_ICON: Record<SkillStatus, string> = { demonstrated: '✓', 'with-hints': '✓', reviewed: '💡', 'not-yet': '○' };
const MEDAL_TEXT: Record<Medal, { icon: string; name: string; why: string }> = {
  gold: { icon: '🥇', name: 'Gold medal', why: 'Pot of at least 85% of the maximum, a strong audit and a stake placed with confidence.' },
  silver: { icon: '🥈', name: 'Silver medal', why: 'Pot of at least 65% of the maximum. For gold: master the audit (85%+) and stake XP on what you know.' },
  bronze: { icon: '🥉', name: 'Bronze medal', why: 'Audit passed. Fewer retries and hints raise your pot towards silver and gold.' },
  none: { icon: '🛡️', name: 'No medal yet', why: 'The audit score was below the pass mark. Practise the rounds below, then replay the quest: the audit uses new figures each time.' },
};

export function CompleteScreen({ questId, feedbackUrl }: { questId: string; feedbackUrl: string }) {
  const { quests, world, progress, update, lastCompletion, codex } = useGame();
  const quest = quests.get(questId)!;
  const record = questRecord(progress, questId);
  const run = restoreRun(quest, record.lastRun);
  const skills = skillReport(quest, run);
  // The summary from this session, if the player just finished; after a
  // reload we can still show the saved results, just not the level change.
  const summary = lastCompletion?.questId === questId ? lastCompletion : null;
  const total = totalXp(progress);
  const level = levelFor(total);
  const levelBefore = summary ? levelFor(summary.totalBefore) : null;
  const levelUp = levelBefore && levelBefore.level < level.level;
  const gained = summary ? summary.totalAfter - summary.totalBefore : null;

  const unlocked = (summary?.unlocked ?? []).map((id) => world.destinations.find((d) => d.id === id)!).filter(Boolean);
  const isGame = quest.scenes.some((sc) => isChallenge(sc) && Boolean(sc.mechanic));
  const medal: Medal = summary?.medal ?? computeMedal(quest, run);
  const mastery = summary?.mastery ?? bossScore(quest, run);
  const threshold = quest.mastery?.threshold ?? 0.7;
  const net = wagerNet(quest, run);
  const concepts = conceptReport(quest, run);
  const rounds = quest.scenes.filter(isChallenge);
  // Suggest the next playable quest anywhere on the island.
  const nextQuest = world.destinations.map((d) => nextQuestAt(d, quests, progress)).find((q) => q && q.id !== questId) ?? null;
  const nextDest = nextQuest ? destinationForQuest(world, nextQuest.id) : null;

  return (
    <section className="complete panel-center" aria-labelledby="complete-title">
      <div className="card-solid rewards">
        <p className="eyebrow">Quest {String(quest.number).padStart(2, '0')} complete · {quest.subject}</p>
        <h1 id="complete-title">{quest.completionTitle || 'Quest complete'}</h1>
        <p className="lede">You finished “{quest.title}”.</p>

        {isGame && (
          <div className={`medal-card medal--${medal}`} role="status">
            <span className="medal-icon" aria-hidden="true">{MEDAL_TEXT[medal].icon}</span>
            <div>
              <p className="medal-name">{MEDAL_TEXT[medal].name}{record.bestMedal !== 'none' && record.bestMedal !== medal ? ` · best so far: ${record.bestMedal}` : ''}</p>
              <p>{MEDAL_TEXT[medal].why}</p>
              {mastery !== null && (
                <p className="medal-mastery">
                  Audit (boss) mastery: <strong>{Math.round(mastery * 100)}%</strong> — pass mark {Math.round(threshold * 100)}%.
                  {' '}Pot: {record.lastXp} of {maxXp(quest)} XP{stakesPlaced(quest, run) ? ` · stakes ${net >= 0 ? 'won' : 'lost'} ${Math.abs(net)} XP` : ' · no stakes placed'}.
                </p>
              )}
            </div>
          </div>
        )}
        <dl className="stats">
          <div className="stat"><dt>XP this run</dt><dd>{record.lastXp}</dd></div>
          <div className="stat">
            <dt>Added to your total</dt>
            <dd>{gained === null ? '—' : `+${gained}`}</dd>
          </div>
          <div className="stat"><dt>Stars</dt><dd><Stars count={summary?.stars ?? record.bestStars} /></dd></div>
          <div className="stat"><dt>Level</dt><dd>{level.level} · {level.name}</dd></div>
        </dl>
        {summary && !summary.firstCompletion && gained === 0 && (
          <p className="note">Replays keep your best score ({record.bestXp} XP), so this run didn’t add XP. Rewards are never counted twice.</p>
        )}
        {summary && !summary.firstCompletion && gained !== null && gained > 0 && (
          <p className="note">A new best! Only the improvement on your previous best ({gained} XP) was added.</p>
        )}
        {levelUp && (
          <p className="level-up" role="status"><span aria-hidden="true">⬆️ </span>Level up! {levelBefore!.name} → <strong>{level.name}</strong></p>
        )}
        <p className="star-key">
          {(summary?.stars ?? record.bestStars) === 3 && 'Three stars: every challenge right first time.'}
          {(summary?.stars ?? record.bestStars) === 2 && 'Two stars: finished without revealing an answer. Get everything right first time for three.'}
          {(summary?.stars ?? record.bestStars) === 1 && 'One star: finished with a revealed answer. Replay to earn more.'}
        </p>

        {quest.badge && record.mastered && (
          <div className="badge-card">
            <span className="badge-medal" aria-hidden="true">{quest.badge.icon ?? '🏅'}</span>
            <div><p className="badge-kicker">Badge earned</p><p className="badge-name">{quest.badge.name}</p><p>{quest.badge.description}</p></div>
          </div>
        )}

        <h2>Skills you showed</h2>
        <ul className="skills">
          {skills.map((s) => (
            <li key={s.id} className={`skill skill--${s.status}`}>
              <span className="skill-icon" aria-hidden="true">{SKILL_ICON[s.status]}</span>
              <span className="skill-text"><span className="skill-label">{s.label}</span><span className="skill-status">{s.statusLabel}</span></span>
            </li>
          ))}
        </ul>

        {isGame && concepts.length > 0 && (
          <>
            <h2>Strengths and weak spots</h2>
            <ul className="concept-report">
              {concepts.map((c) => (
                <li key={c.id} className={`concept concept--${c.strength}`}>
                  <span className="concept-icon" aria-hidden="true">{c.strength === 'strong' ? '💪' : c.strength === 'developing' ? '🌱' : '📖'}</span>
                  <span><strong>{codex.entries[c.id]?.title ?? c.id}</strong> — {c.strength === 'strong' ? 'right first time every time' : c.strength === 'developing' ? `right first time in ${c.firstTry} of ${c.total} rounds` : 'needed the answer revealed; worth reviewing'}
                    {c.strength !== 'strong' && codex.entries[c.id] && <span className="hint"> · Codex: Encyclopedia {codex.entries[c.id].ref.volume}, {codex.entries[c.id].ref.chapter}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <h2>Practise a round</h2>
            <p className="hint">Replay any round with fresh data and full feedback. Practice gives no XP but strengthens your memory of the skill.</p>
            <ul className="practice-list">
              {rounds.map((r) => {
                const res = resultFor(run, r.id);
                const how = !res.solved ? 'not finished' : res.revealed ? 'answer revealed' : isFirstTry(r, res) ? 'first time' : `${res.attempts} attempts`;
                return (
                  <li key={r.id}>
                    <a href={`#/practice/${quest.id}/${r.id}`}>{r.boss ? '⚔️ ' : ''}{r.title}</a>
                    <span className={`practice-how${res.revealed || !res.solved ? ' is-weak' : ''}`}> · {r.mechanic ?? r.type} · {how}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <h2>Take this with you</h2>
        <p className="takeaway">{quest.takeaway}</p>

        {isGame && !record.mastered && (
          <div className="unlocked locked-note" role="status">
            <h2>The next destination is still sealed</h2>
            <p>Reach {Math.round(threshold * 100)}% in the audit to open what lies beyond. Replay the quest — the audit will use different figures — or practise the rounds above first.</p>
          </div>
        )}
        {unlocked.length > 0 && (
          <div className="unlocked" role="status">
            <h2>New on the map</h2>
            <ul className="plain-list">
              {unlocked.map((d) => <li key={d.id}><span aria-hidden="true">{d.icon}</span> <strong>{d.name}</strong> is now open: {d.theme}. <a href={`#/map/${d.id}`}>See it on the map</a></li>)}
            </ul>
          </div>
        )}

        <div className="cta-row">
          {nextQuest && nextDest ? (
            <a className="btn btn-primary btn-lg" href={`#/map/${nextDest.id}`}>Next: {nextQuest.title}</a>
          ) : (
            <a className="btn btn-primary btn-lg" href="#/map">Explore the map</a>
          )}
          <a className="btn btn-secondary btn-lg" href="#/map">Back to the map</a>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => { update((p) => withReplay(p, questId)); navigate(`/quest/${questId}`); }}>Replay quest</button>
        </div>

        <div className="card-quiet feedback-ask">
          <h2>Help shape CurioTrail</h2>
          <p>Was anything confusing? Would you try another quest? Your feedback decides what gets built next.</p>
          <a href={feedbackUrl} target="_blank" rel="noopener">Share feedback on GitHub<span className="sr-only"> (opens in a new tab)</span></a>
        </div>
      </div>
    </section>
  );
}

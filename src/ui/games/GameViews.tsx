// Game mechanics for the Trading Market (and future quests). Each view shows
// the player's real work being evaluated by the engine: nothing here decides
// correctness on its own.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GambitScene, MatchScene, RepairScene, Run, RunewordScene, Scene, Tile, TradeReport, WheelScene, WorkshopScene } from '../../engine/types';
import { GAMBIT_COLUMNS, correctAnswer, landedSegment, tradeProfit, wheelStopAngle } from '../../engine/game-engine';
import { letterStates, normaliseGuess, scoreGuess } from '../../engine/games/runeword';
import { Actions, CodeBlock, Feedback, InvalidMessage, Speech, type SceneProps } from '../quest/common';
import { FormulaBuilder, GameFrame, LedgerGrid, MarketReaction, previewColumn } from './parts';

type GameProps<S extends Scene> = SceneProps<S> & { run: Run; reducedMotion: boolean; onSpin?: () => void };

function reactionState(solved: boolean, revealed: boolean, wrong: boolean): 'idle' | 'right' | 'wrong' {
  if (solved && !revealed) return 'right';
  return wrong ? 'wrong' : 'idle';
}

// ---- Ledger Workshop ----

export function WorkshopView(props: GameProps<WorkshopScene>) {
  const { quest, scene, result, outcome, onCheck, invalid } = props;
  const [formula, setFormula] = useState('');
  const solved = result.solved;
  const shown = solved ? scene.solution : formula;
  const values = useMemo(() => previewColumn(shown, scene.columns, scene.rows, scene.target, scene.fillDownTo), [shown, scene]);
  const state = reactionState(solved, result.revealed, Boolean(outcome && !outcome.correct));
  return (
    <GameFrame mechanic={scene.mechanic ?? 'Ledger Workshop'} icon="🛠️">
      <Speech quest={quest} scene={scene} />
      <div className="workshop-stage">
        <LedgerGrid columns={scene.columns} rows={scene.rows} target={scene.target} fillDownTo={scene.fillDownTo} values={values} solved={solved && !result.revealed} label="Tove's ledger" />
        {scene.consequence && <MarketReaction kind={scene.consequence} state={state} />}
      </div>
      <form className="challenge" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ formula }); }}>
        <p className="prompt" id={`ws-prompt-${scene.id}`}>{scene.prompt}</p>
        <FormulaBuilder id={`ws-${scene.id}`} tokens={scene.tokens} value={shown} onChange={setFormula} disabled={solved} cell={scene.target} label={scene.prompt} />
        {scene.fillDownTo && <p className="hint">Your formula in {scene.target} is filled down to {scene.fillDownTo}. The grid previews what each row would show — checking is what counts.</p>}
        <InvalidMessage text={invalid} />
        {!solved && <Actions><button type="submit" className="btn btn-primary btn-lg">Write it in the ledger</button></Actions>}
      </form>
      <Feedback {...props} revealedAnswer={<CodeBlock code={scene.solution} label="One correct formula" />} />
    </GameFrame>
  );
}

// ---- Repair Mission ----

export function RepairView(props: GameProps<RepairScene>) {
  const { quest, scene, result, onCheck, invalid } = props;
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [formula, setFormula] = useState(scene.broken);
  const solved = result.solved;
  const broken = useMemo(() => previewColumn(scene.broken, scene.columns, scene.rows, scene.target, scene.fillDownTo), [scene]);
  const fixed = useMemo(() => previewColumn(solved ? scene.solution : formula, scene.columns, scene.rows, scene.target, scene.fillDownTo), [formula, scene, solved]);
  const wrongCells = Object.entries(broken).filter(([cell, v]) => scene.expected[cell] !== undefined && v !== String(Math.round(scene.expected[cell] * 100) / 100)).map(([c]) => c);
  return (
    <GameFrame mechanic={scene.mechanic ?? 'Repair Mission'} icon="🔧">
      <Speech quest={quest} scene={scene} />
      <figure className="repair-before">
        <figcaption>The broken ledger: <code>{scene.broken}</code> in {scene.target}{scene.fillDownTo ? `, filled to ${scene.fillDownTo}` : ''}</figcaption>
        <LedgerGrid columns={scene.columns} rows={scene.rows} target={scene.target} fillDownTo={scene.fillDownTo} values={broken} highlight={wrongCells} label="Broken ledger" />
      </figure>
      <form className="challenge" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ diagnosis: diagnosis ?? '', formula }); }}>
        <fieldset>
          <legend className="prompt">1 · What went wrong?</legend>
          <div className="options options--compact">
            {scene.diagnoses.map((d) => (
              <label key={d.id} className={`option${solved && d.id === scene.correctDiagnosis ? ' option--correct' : ''}`}>
                <input type="radio" name={`dx-${scene.id}`} value={d.id} checked={(solved ? scene.correctDiagnosis : diagnosis) === d.id} disabled={solved} onChange={() => setDiagnosis(d.id)} />
                <span className="option-text">{d.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="prompt" htmlFor={`fix-${scene.id}`}>2 · Repaired formula for {scene.target}</label>
        <div className="formula-bar">
          <span className="cell-name" aria-hidden="true">{scene.target}</span>
          <span className="fx" aria-hidden="true">fx</span>
          <input id={`fix-${scene.id}`} className="formula-input" value={solved ? scene.solution : formula} readOnly={solved} onChange={(e) => setFormula(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
        </div>
        <LedgerGrid columns={scene.columns} rows={scene.rows} target={scene.target} fillDownTo={scene.fillDownTo} values={fixed} solved={solved && !result.revealed} label="Ledger with your repair (preview)" />
        <InvalidMessage text={invalid} />
        {!solved && <Actions><button type="submit" className="btn btn-primary btn-lg">Repair the ledger</button></Actions>}
      </form>
      <Feedback {...props} revealedAnswer={<CodeBlock code={`${scene.diagnoses.find((d) => d.id === scene.correctDiagnosis)!.text}\n${scene.solution}`} label="Cause and repair" />} />
    </GameFrame>
  );
}

// ---- Rune-word (Wordle-style) ----

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export function RunewordView(props: GameProps<RunewordScene>) {
  const { quest, scene, result, run, onCheck, invalid } = props;
  const guesses = run.guesses?.[scene.id] ?? [];
  const [entry, setEntry] = useState('');
  const solved = result.solved;
  const len = scene.word.length;
  const states = letterStates(guesses, scene.word);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (solved) return;
    onCheck({ guess: entry });
  };
  // Clear the entry after a counted guess.
  useEffect(() => { setEntry(''); }, [guesses.length]);
  const type = (ch: string) => setEntry((e) => (e.length < len ? e + ch : e));
  const rows = Array.from({ length: scene.maxGuesses }, (_, i) => guesses[i] ?? (i === guesses.length && !solved ? entry.padEnd(len, ' ') : ''.padEnd(len, ' ')));
  return (
    <GameFrame mechanic={scene.mechanic ?? 'Rune-word'} icon="ᚱ">
      <Speech quest={quest} scene={scene} />
      <p className="rune-clue"><span className="sr-only">Clue: </span>“{scene.clue}”</p>
      <p className="hint">Guess the {len}-letter Excel function in {scene.maxGuesses} tries. Solving within {scene.par} counts as first time. Green: right place. Amber: in the word, elsewhere.</p>
      <div className="rune-grid" style={{ ['--len' as string]: len }} role="grid" aria-label="Your guesses">
        {rows.map((word, r) => {
          const done = r < guesses.length;
          const tiles: Tile[] | null = done ? scoreGuess(word, scene.word) : null;
          return (
            <div key={r} role="row" className={`rune-row${done ? ' is-done' : ''}${r === guesses.length && !solved ? ' is-current' : ''}`} aria-label={done ? `Guess ${r + 1}: ${word}, ${tiles!.map((t) => ({ hit: 'right place', near: 'elsewhere', miss: 'not in word' })[t]).join(', ')}` : undefined}>
              {word.split('').map((ch, i) => (
                <span key={i} role="gridcell" className={`rune-tile${tiles ? ` tile--${tiles[i]}` : ch.trim() ? ' tile--typed' : ''}`} style={{ ['--i' as string]: i }}>{ch.trim()}</span>
              ))}
            </div>
          );
        })}
      </div>
      {!solved && (
        <form className="challenge rune-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="sr-only" htmlFor={`rune-${scene.id}`}>Your guess</label>
          <input
            ref={inputRef} id={`rune-${scene.id}`} className="formula-input rune-input" value={entry} maxLength={len}
            onChange={(e) => setEntry(normaliseGuess(e.target.value).slice(0, len))}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off"
            placeholder={'_ '.repeat(len).trim()}
          />
          <div className="rune-keys" aria-hidden="true">
            {KEY_ROWS.map((row) => (
              <div key={row} className="rune-key-row">
                {row.split('').map((k) => (
                  <button key={k} type="button" tabIndex={-1} className={`rune-key${states[k] ? ` tile--${states[k]}` : ''}`} onClick={() => { type(k); inputRef.current?.focus(); }}>{k}</button>
                ))}
              </div>
            ))}
            <div className="rune-key-row">
              <button type="button" tabIndex={-1} className="rune-key rune-key--wide" onClick={() => { setEntry((e) => e.slice(0, -1)); inputRef.current?.focus(); }}>⌫</button>
            </div>
          </div>
          <InvalidMessage text={invalid} />
          <Actions><button type="submit" className="btn btn-primary btn-lg">Carve the rune</button></Actions>
        </form>
      )}
      <Feedback {...props} revealedAnswer={<CodeBlock code={scene.word} label="The hidden function" />} />
    </GameFrame>
  );
}

// ---- Rune Wheel ----

const WHEEL_COLORS = ['#c08a1a', '#0f766e', '#7a4a2a', '#1d3a63', '#9a5714', '#4c2f9e', '#166534', '#8a1c3b'];

export function WheelView(props: GameProps<WheelScene>) {
  const { quest, scene, result, run, onCheck, invalid, onSpin, reducedMotion } = props;
  const segment = landedSegment(scene, run);
  const [spinning, setSpinning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [formula, setFormula] = useState('');
  const solved = result.solved;
  const n = scene.segments.length;
  const stop = segment ? wheelStopAngle(scene, segment.id) : 0;
  // Rotate so the landed segment ends under the pointer at the top, after a few turns.
  const angle = segment ? 360 * 5 - stop * 360 : 0;
  const spin = () => {
    if (segment || !onSpin) return;
    setSpinning(!reducedMotion);
    onSpin();
    window.setTimeout(() => setSpinning(false), reducedMotion ? 0 : 2600);
  };
  const r = 90;
  const arc = (i: number) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
    return `M100 100 L${100 + r * Math.cos(a0)} ${100 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${100 + r * Math.cos(a1)} ${100 + r * Math.sin(a1)} Z`;
  };
  const challenge = segment?.challenge;
  const showChallenge = segment && !spinning;
  return (
    <GameFrame mechanic={scene.mechanic ?? 'Rune Wheel'} icon="☸">
      <Speech quest={quest} scene={scene} />
      <div className="wheel-stage">
        <div className="wheel-pointer" aria-hidden="true">▼</div>
        <svg className={`wheel${spinning ? ' is-spinning' : ''}`} viewBox="0 0 200 200" style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true">
          {scene.segments.map((s, i) => {
            const mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
            return (
              <g key={s.id}>
                <path d={arc(i)} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#f7f0e1" strokeWidth="2" />
                <text x={100 + 58 * Math.cos(mid)} y={100 + 58 * Math.sin(mid)} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(mid * 180) / Math.PI + 90} ${100 + 58 * Math.cos(mid)} ${100 + 58 * Math.sin(mid)})`}>{s.label}</text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="16" fill="#2a2118" stroke="#f2b134" strokeWidth="3" />
        </svg>
        <div className="wheel-side">
          <p className="hint">Runes on the wheel: {scene.segments.map((s) => s.label).join(' · ')}</p>
          {!segment && <button type="button" className="btn btn-primary btn-lg" onClick={spin}>Spin the wheel</button>}
          {segment && <p className="wheel-landed" role="status">{spinning ? 'The wheel is spinning…' : <>Landed on <strong>{segment.label}</strong></>}</p>}
        </div>
      </div>
      {showChallenge && challenge && (
        <form className="challenge" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ response: challenge.kind === 'choice' ? response ?? '' : { formula } }); }}>
          {challenge.kind === 'choice' ? (
            <>
              {challenge.code && <CodeBlock code={challenge.code} />}
              <fieldset>
                <legend className="prompt">{challenge.prompt}</legend>
                <div className="options">
                  {challenge.options.map((o) => (
                    <label key={o.id} className={`option${solved && o.id === challenge.correct ? ' option--correct' : ''}`}>
                      <input type="radio" name={`wheel-${scene.id}`} checked={(solved ? challenge.correct : response) === o.id} disabled={solved} onChange={() => setResponse(o.id)} />
                      <span className={`option-text${o.code ? ' mono' : ''}`}>{o.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <p className="prompt">{challenge.prompt}</p>
              <LedgerGrid columns={challenge.columns} rows={challenge.rows} target={challenge.target} values={previewColumn(solved ? challenge.solution : formula, challenge.columns, challenge.rows, challenge.target)} label="Ledger" />
              <div className="formula-bar">
                <span className="cell-name" aria-hidden="true">{challenge.target}</span>
                <span className="fx" aria-hidden="true">fx</span>
                <input className="formula-input" aria-label={challenge.prompt} value={solved ? challenge.solution : formula} readOnly={solved} onChange={(e) => setFormula(e.target.value)} placeholder="=" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
              </div>
            </>
          )}
          <InvalidMessage text={invalid} />
          {!solved && <Actions><button type="submit" className="btn btn-primary btn-lg">Answer the rune</button></Actions>}
        </form>
      )}
      {!segment && <InvalidMessage text={invalid} />}
      {segment && <Feedback {...props} scene={{ ...scene, explanation: segment.explanation, hints: segment.hints }} revealedAnswer={<CodeBlock code={challenge!.kind === 'choice' ? challenge!.options.find((o) => o.id === challenge!.correct)!.text : challenge!.solution} label="Answer" />} />}
    </GameFrame>
  );
}

// ---- Rune match ----

export function MatchView(props: GameProps<MatchScene>) {
  const { quest, scene, result, onCheck, invalid, outcome } = props;
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const solved = result.solved;
  const shown = solved ? (correctAnswer(scene) as { pairs: Record<string, string> }).pairs : pairs;
  const wrong = new Set((outcome?.issues ?? []).map((i) => i.id));
  const pairOf = (rightId: string) => Object.keys(shown).find((l) => shown[l] === rightId);
  const choose = (rightId: string) => {
    if (!picked || solved) return;
    setPairs((p) => {
      const next = { ...p };
      for (const k of Object.keys(next)) if (next[k] === rightId) delete next[k];
      next[picked] = rightId;
      return next;
    });
    setPicked(null);
  };
  const letter = (i: number) => String.fromCharCode(65 + i);
  return (
    <GameFrame mechanic={scene.mechanic ?? 'Rune match'} icon="🔗">
      <Speech quest={quest} scene={scene} />
      <form className="challenge" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ pairs: { ...pairs } }); }}>
        <p className="prompt">{scene.prompt}</p>
        <p className="hint">Choose a rune on the left, then its partner on the right — or use each rune’s menu.</p>
        <div className="match-board">
          <ul className="match-col" aria-label="Runes">
            {scene.left.map((l) => {
              const partner = scene.right.findIndex((r) => r.id === shown[l.id]);
              return (
                <li key={l.id} className={`match-item${picked === l.id ? ' is-picked' : ''}${partner >= 0 ? ' is-paired' : ''}${wrong.has(l.id) && !solved ? ' is-wrong' : ''}${solved ? ' is-right' : ''}`}>
                  <button type="button" className="match-btn" aria-pressed={picked === l.id} disabled={solved} onClick={() => setPicked(picked === l.id ? null : l.id)}>
                    <span className={l.code ? 'mono' : ''}>{l.text}</span>
                    {partner >= 0 && <span className="match-tag" aria-hidden="true">{letter(partner)}</span>}
                  </button>
                  <label className="sr-only" htmlFor={`m-${scene.id}-${l.id}`}>Partner for {l.text}</label>
                  <select id={`m-${scene.id}-${l.id}`} className="match-select" value={shown[l.id] ?? ''} disabled={solved} onChange={(e) => setPairs((p) => { const next = { ...p }; for (const k of Object.keys(next)) if (next[k] === e.target.value) delete next[k]; if (e.target.value) next[l.id] = e.target.value; else delete next[l.id]; return next; })}>
                    <option value="">Not paired</option>
                    {scene.right.map((r, i) => <option key={r.id} value={r.id}>{letter(i)}: {r.text}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
          <ul className="match-col" aria-label="Causes">
            {scene.right.map((r, i) => (
              <li key={r.id} className={`match-item${pairOf(r.id) ? ' is-paired' : ''}`}>
                <button type="button" className="match-btn" disabled={solved || !picked} onClick={() => choose(r.id)}>
                  <span className="match-tag" aria-hidden="true">{letter(i)}</span><span>{r.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <InvalidMessage text={invalid} />
        {!solved && <Actions><button type="submit" className="btn btn-primary btn-lg">Break the curse</button></Actions>}
      </form>
      <Feedback {...props} />
    </GameFrame>
  );
}

// ---- Trader's Gambit ----

function TradeTable({ report }: { report: TradeReport }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="How the restock played out">
      <table className="data-table trade-table">
        <thead><tr><th scope="col">Item</th><th scope="col">Ordered</th><th scope="col">Sold</th><th scope="col">Unsold</th><th scope="col">Real profit</th><th scope="col">Your F column</th></tr></thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.item}>
              <th scope="row">{r.item}</th><td>{r.order}</td><td>{r.sold}</td><td className={r.leftover ? 'warn' : ''}>{r.leftover}</td>
              <td>{r.profit}</td><td className={r.yours === r.profit ? 'ok' : 'bad'}>{r.yours === null ? 'error' : Math.round(r.yours * 100) / 100}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td colSpan={3}>Spent {report.spend} / {report.purse}</td><td><strong>{report.total}</strong></td><td>Target {report.target}</td></tr></tfoot>
      </table>
    </div>
  );
}

export function GambitView(props: GameProps<GambitScene>) {
  const { quest, scene, result, outcome, onCheck, invalid } = props;
  const [orders, setOrders] = useState<number[]>(() => scene.items.map(() => 0));
  const [formula, setFormula] = useState('');
  const solved = result.solved;
  const shownOrders = solved ? scene.solution.orders : orders;
  const spend = scene.items.reduce((s, it, i) => s + it.cost * (shownOrders[i] || 0), 0);
  const rows = scene.items.map((it, i) => [it.name, it.price, it.cost, it.demand, shownOrders[i] || 0, null]);
  const values = useMemo(() => previewColumn(solved ? scene.solution.formula : formula, GAMBIT_COLUMNS, rows, 'F2', `F${scene.items.length + 1}`), [formula, rows, scene, solved]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (i: number, n: number) => setOrders((o) => o.map((v, j) => (j === i ? Math.max(0, Math.min(scene.maxOrder, Math.round(n) || 0)) : v)));
  const over = spend > scene.purse;
  const tokens = ['=', 'B2', 'C2', 'D2', 'E2', '*', '-', '+', 'MIN(', 'MAX(', ',', ')', '(', 'SUM('];
  return (
    <GameFrame mechanic={scene.mechanic ?? "Trader's Gambit"} icon="⚓">
      <Speech quest={quest} scene={scene} />
      <form className="challenge" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ orders: [...orders], formula }); }}>
        <p className="prompt">{scene.prompt}</p>
        <LedgerGrid columns={GAMBIT_COLUMNS} rows={rows} target="F2" fillDownTo={`F${scene.items.length + 1}`} values={values} label="Restock ledger (Order column E is set below)" />
        <FormulaBuilder id={`gb-${scene.id}`} tokens={tokens} value={solved ? scene.solution.formula : formula} onChange={setFormula} disabled={solved} cell="F2" label="Profit formula for F2" />
        <fieldset className="orders">
          <legend className="prompt">Orders (column E)</legend>
          {scene.items.map((it, i) => (
            <div key={it.name} className="order-row">
              <label htmlFor={`ord-${scene.id}-${i}`}><strong>{it.name}</strong> <span className="hint">cost {it.cost} · demand {it.demand}</span></label>
              <div className="stepper">
                <button type="button" className="btn btn-ghost btn-sm" disabled={solved} onClick={() => set(i, (orders[i] || 0) - 1)} aria-label={`One fewer ${it.name}`}>−</button>
                <input id={`ord-${scene.id}-${i}`} type="number" inputMode="numeric" min={0} max={scene.maxOrder} value={shownOrders[i]} readOnly={solved} onChange={(e) => set(i, Number(e.target.value))} />
                <button type="button" className="btn btn-ghost btn-sm" disabled={solved} onClick={() => set(i, (orders[i] || 0) + 1)} aria-label={`One more ${it.name}`}>+</button>
              </div>
            </div>
          ))}
        </fieldset>
        <div className={`purse${over ? ' is-over' : ''}`} role="status" aria-live="polite">
          <span>Purse</span>
          <span className="purse-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (spend / scene.purse) * 100)}%` }} /></span>
          <span><strong>{spend}</strong> / {scene.purse} silver{over ? ' — over budget!' : ''}</span>
        </div>
        <InvalidMessage text={invalid} />
        {!solved && <Actions><button type="submit" className="btn btn-primary btn-lg">Send the order to the ship</button></Actions>}
      </form>
      {outcome?.trade && <TradeTable report={outcome.trade} />}
      <Feedback {...props} revealedAnswer={<CodeBlock code={`${scene.solution.formula}\nOrders: ${scene.items.map((it, i) => `${it.name} ${scene.solution.orders[i]}`).join(', ')} → profit ${scene.items.reduce((s, it, i) => s + tradeProfit(it, scene.solution.orders[i]), 0)}`} label="One winning plan" />} />
    </GameFrame>
  );
}

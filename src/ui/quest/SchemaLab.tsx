import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Cardinality, ColumnRef, LabModel, LabTable, SchemaScene } from '../../engine/types';
import { CARDINALITY_LABEL, cleanModel, initialLabState, labReducer, solutionModel, validateModel, type LabAction } from '../../engine/schema-lab';
import { announce } from '../../app/a11y';
import { Actions, Feedback, InvalidMessage, Speech, type SceneProps } from './common';

const DRAFT_PREFIX = 'curiotrail.lab-draft.';
const refKey = (r: ColumnRef) => `${r.table}.${r.column}`;

// Unsent work is kept in this browser only (a convenience, not progress):
// it survives a reload, and is cleared once the model is checked correct.
function loadDraft(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + key) || 'null'); } catch { return null; }
}
function saveDraft(key: string, model: LabModel | null) {
  try {
    if (model) localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(model));
    else localStorage.removeItem(DRAFT_PREFIX + key);
  } catch { /* storage unavailable: drafts are optional */ }
}

function SampleRows({ table }: { table: LabTable }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`Sample rows of ${table.id}`}>
      <table className="data-table lab-sample">
        <thead><tr>{table.columns.map((c) => <th key={c.name} scope="col">{c.name}{c.key ? ` (${c.key.toUpperCase()})` : ''}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v === null ? 'NULL' : String(v)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function SchemaLabView(props: SceneProps<SchemaScene> & { draftKey: string }) {
  const { quest, scene, result, onCheck, invalid, outcome, draftKey } = props;
  const solved = result.solved;
  const [state, rawDispatch] = useReducer(
    (s: ReturnType<typeof initialLabState>, a: LabAction) => labReducer(scene, s, a),
    undefined,
    () => initialLabState(solved ? solutionModel(scene) : cleanModel(scene, loadDraft(draftKey))),
  );
  const dispatch = useCallback((a: LabAction) => { if (!solved || a.type === 'load') rawDispatch(a); }, [solved]);
  const { model, pending } = state;

  // When the step is solved (or the answer revealed), show the finished model.
  useEffect(() => {
    if (result.solved) {
      if (result.revealed) rawDispatch({ type: 'load', model: solutionModel(scene) });
      saveDraft(draftKey, null);
    }
  }, [result.solved, result.revealed, scene, draftKey]);
  useEffect(() => { if (!solved) saveDraft(draftKey, model); }, [model, solved, draftKey]);
  useEffect(() => { if (state.message) announce(state.message); }, [state.message]);

  const placedIds = new Set(model.placed.map((p) => p.table));
  const tray = scene.tables.filter((t) => !placedIds.has(t.id));
  const issues = outcome && !outcome.correct ? outcome.issues ?? [] : [];
  // Only table-level problems outline a table; relationship problems flag their line and list entry.
  const flagged = (table: string) => issues.some((i) => i.id === `unlinked-${table}` || i.id === `extra-${table}` || (i.id === 'wrong-fact' && model.factTable === table));
  const validation = useMemo(() => (solved ? validateModel(scene, model) : null), [solved, scene, model]);

  // ---- Workspace geometry (lines between columns) ----
  const workspace = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const [compact, setCompact] = useState(false);
  const [layoutTick, forceLayout] = useState(0);
  useLayoutEffect(() => {
    const el = workspace.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      setCompact(el.clientWidth < 640);
      forceLayout((n) => n + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [lines, setLines] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  useLayoutEffect(() => {
    const el = workspace.current;
    if (!el || compact) { setLines([]); return; }
    const box = el.getBoundingClientRect();
    const next = model.relationships.flatMap((r) => {
      const a = anchors.current.get(refKey(r.from))?.getBoundingClientRect();
      const b = anchors.current.get(refKey(r.to))?.getBoundingClientRect();
      if (!a || !b) return [];
      // Leave from the side of each column that faces the other table.
      const aRight = a.left + a.width / 2 < b.left + b.width / 2;
      return [{
        id: r.id,
        x1: (aRight ? a.right : a.left) - box.left,
        y1: a.top + a.height / 2 - box.top,
        x2: (aRight ? b.left : b.right) - box.left,
        y2: b.top + b.height / 2 - box.top,
      }];
    });
    setLines(next);
  }, [model, compact, layoutTick]);

  // ---- Dragging cards (pointer) ----
  const drag = useRef<{ table: string; dx: number; dy: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent, table: string) => {
    if (solved || compact || (e.target as HTMLElement).closest('button')) return;
    const box = workspace.current!.getBoundingClientRect();
    const p = model.placed.find((x) => x.table === table)!;
    drag.current = { table, dx: e.clientX - (box.left + p.x * box.width), dy: e.clientY - (box.top + p.y * box.height) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const box = workspace.current!.getBoundingClientRect();
    dispatch({ type: 'move', table: d.table, x: (e.clientX - d.dx - box.left) / box.width, y: (e.clientY - d.dy - box.top) / box.height });
  };
  const onHandleUp = () => { drag.current = null; };
  const onHandleKey = (e: React.KeyboardEvent, table: string) => {
    const step = 0.03;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      dispatch({ type: 'nudge', table, dx: moves[e.key][0], dy: moves[e.key][1] });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch({ type: 'cancel' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const tableCard = (t: LabTable) => {
    const p = model.placed.find((x) => x.table === t.id)!;
    const isFact = model.factTable === t.id;
    return (
      <article
        key={t.id}
        className={`lab-table${isFact ? ' lab-table--fact' : ''}${flagged(t.id) ? ' is-flagged' : ''}`}
        style={compact ? undefined : { left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        aria-label={`${t.id}${isFact ? ', marked as the fact table' : ''}`}
      >
        <header
          className="lab-table-head"
          tabIndex={solved || compact ? -1 : 0}
          aria-label={`${t.id}. Use the arrow keys to move this card.`}
          onPointerDown={(e) => onHandleDown(e, t.id)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={(e) => onHandleKey(e, t.id)}
        >
          {!compact && !solved && <span className="lab-grip" aria-hidden="true">⠿</span>}
          <span className="lab-table-name">{t.id}</span>
          <span className={`lab-role ${isFact ? 'lab-role--fact' : ''}`}>{isFact ? 'Fact' : t.id.startsWith('Dim') ? 'Dimension' : 'Table'}</span>
          {!solved && (
            <button type="button" className="lab-remove" onClick={() => dispatch({ type: 'remove', table: t.id })} aria-label={`Remove ${t.id} from the model`}>×</button>
          )}
        </header>
        <p className="lab-grain">{t.grain}</p>
        <ul className="lab-columns">
          {t.columns.map((c) => {
            const ref = { table: t.id, column: c.name };
            const isPending = pending && refKey(pending) === refKey(ref);
            const linked = model.relationships.some((r) => refKey(r.from) === refKey(ref) || refKey(r.to) === refKey(ref));
            return (
              <li key={c.name}>
                <button
                  type="button"
                  ref={(el) => { if (el) anchors.current.set(refKey(ref), el); else anchors.current.delete(refKey(ref)); }}
                  className={`lab-column${isPending ? ' is-pending' : ''}${linked ? ' is-linked' : ''}`}
                  aria-pressed={Boolean(isPending)}
                  disabled={solved}
                  onClick={() => dispatch({ type: 'select-column', ref })}
                  title={c.description}
                >
                  <span className="lab-key" aria-hidden="true">{c.key === 'pk' ? '🔑' : c.key === 'fk' ? '🔗' : ''}</span>
                  <span>{c.name}</span>
                  {c.key && <span className="sr-only">{c.key === 'pk' ? ' (primary key)' : ' (foreign key)'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </article>
    );
  };

  const endLabel = (cardinality: Cardinality | null, side: 'from' | 'to') => {
    if (!cardinality) return '?';
    const [a, b] = cardinality.split('-to-');
    const value = side === 'from' ? a : b;
    return value === 'many' ? '*' : '1';
  };

  return (
    <>
      <Speech quest={quest} scene={scene} />
      <form className="challenge lab" noValidate onSubmit={(e) => { e.preventDefault(); onCheck({ model }); }}>
        <p className="prompt">{scene.prompt}</p>

        {!solved && (
          <section className="lab-tray" aria-labelledby="lab-tray-title">
            <h3 id="lab-tray-title">Available tables <span className="count">({tray.length})</span></h3>
            {tray.length === 0 ? <p className="hint">Every table is in the workspace.</p> : (
              <ul className="lab-tray-list">
                {tray.map((t) => (
                  <li key={t.id} className="lab-tray-item">
                    <div className="lab-tray-text">
                      <p className="lab-table-name">{t.id}</p>
                      <p className="lab-grain">Grain: {t.grain}</p>
                      <p className="hint">{t.description}</p>
                      <details>
                        <summary>Preview {t.rows.length} rows</summary>
                        <SampleRows table={t} />
                      </details>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => dispatch({ type: 'add', table: t.id })}>Add<span className="sr-only"> {t.id}</span> to model</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="lab-instructions hint" aria-live="polite">
          {solved ? 'Your finished model.' : pending
            ? <>Selected <strong>{refKey(pending)}</strong>. Now select the matching column in another table (Esc cancels).</>
            : compact ? 'Select a column, then the matching column in another table, to connect them.' : 'Drag cards by their title bar (or focus it and use the arrow keys). Select a column, then the matching column in another table, to connect them.'}
        </div>

        <div ref={workspace} className={`lab-workspace${compact ? ' lab-workspace--compact' : ''}`} role="group" aria-label="Modelling workspace">
          {!compact && (
            <svg className="lab-lines" aria-hidden="true">
              <defs>
                <marker id="lab-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                </marker>
              </defs>
              {lines.map((l) => {
                // Line geometry is measured after render, so it can briefly lag behind a removal.
                const r = model.relationships.find((x) => x.id === l.id);
                if (!r) return null;
                const fromOne = endLabel(r.cardinality, 'from') === '1';
                const toOne = endLabel(r.cardinality, 'to') === '1';
                // Filters flow from the "one" side to the "many" side.
                const markerStart = r.cardinality && (r.direction === 'both' || (toOne && !fromOne)) ? 'url(#lab-arrow)' : undefined;
                const markerEnd = r.cardinality && (r.direction === 'both' || (fromOne && !toOne)) ? 'url(#lab-arrow)' : undefined;
                const mx = (l.x1 + l.x2) / 2;
                const bad = issues.some((i) => i.id.startsWith(`${r.id}-`));
                return (
                  <g key={l.id} className={`lab-line${bad ? ' is-flagged' : ''}${r.cardinality ? '' : ' is-unset'}`}>
                    <path d={`M${l.x1},${l.y1} C${mx},${l.y1} ${mx},${l.y2} ${l.x2},${l.y2}`} fill="none" markerStart={markerStart} markerEnd={markerEnd} />
                    <text x={l.x1 + (l.x2 > l.x1 ? 10 : -18)} y={l.y1 - 6}>{endLabel(r.cardinality, 'from')}</text>
                    <text x={l.x2 + (l.x2 > l.x1 ? -18 : 10)} y={l.y2 - 6}>{endLabel(r.cardinality, 'to')}</text>
                  </g>
                );
              })}
            </svg>
          )}
          {model.placed.length === 0 && <p className="lab-empty">Add tables from the list above to start building.</p>}
          {model.placed.map((p) => tableCard(scene.tables.find((t) => t.id === p.table)!))}
        </div>

        <div className="lab-panels">
          <fieldset className="lab-fact" disabled={solved}>
            <legend>Which table records the transactions (the fact table)?</legend>
            {model.placed.length === 0 ? <p className="hint">Add tables first.</p> : (
              <div className="options options--compact">
                {model.placed.map((p) => (
                  <label key={p.table} className="option">
                    <input type="radio" name={`fact-${scene.id}`} checked={model.factTable === p.table} onChange={() => dispatch({ type: 'set-fact', table: p.table })} />
                    <span className="option-text">{p.table}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <section className="lab-relationships" aria-labelledby="lab-rel-title">
            <h3 id="lab-rel-title">Relationships <span className="count">({model.relationships.length})</span></h3>
            {model.relationships.length === 0 ? <p className="hint">No relationships yet.</p> : (
              <ul className="lab-rel-list">
                {model.relationships.map((r) => {
                  const bad = issues.some((i) => i.id.startsWith(`${r.id}-`));
                  return (
                    <li key={r.id} data-rel-id={r.id} className={`lab-rel${bad ? ' is-flagged' : ''}`}>
                      <p className="lab-rel-ends">
                        <code>{refKey(r.from)}</code>
                        <span className="lab-rel-symbol" aria-hidden="true"> {endLabel(r.cardinality, 'from')} — {endLabel(r.cardinality, 'to')} </span>
                        <span className="sr-only"> to </span>
                        <code>{refKey(r.to)}</code>
                      </p>
                      <div className="lab-rel-controls">
                        <label>
                          <span>Cardinality</span>
                          <select value={r.cardinality ?? ''} disabled={solved} onChange={(e) => dispatch({ type: 'set-cardinality', id: r.id, value: (e.target.value || null) as Cardinality | null })}>
                            <option value="">Choose…</option>
                            {(Object.keys(CARDINALITY_LABEL) as Cardinality[]).map((c) => <option key={c} value={c}>{CARDINALITY_LABEL[c]}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Filter direction</span>
                          <select value={r.direction} disabled={solved} onChange={(e) => dispatch({ type: 'set-direction', id: r.id, value: e.target.value as 'single' | 'both' })}>
                            <option value="single">Single (one side filters the many side)</option>
                            <option value="both">Both directions</option>
                          </select>
                        </label>
                        {!solved && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'remove-relationship', id: r.id })}>Remove<span className="sr-only"> relationship {refKey(r.from)} to {refKey(r.to)}</span></button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <InvalidMessage text={invalid} />
        {!solved && (
          <Actions>
            <button type="submit" className="btn btn-primary btn-lg">Check model</button>
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'reset' })}>Reset workspace</button>
          </Actions>
        )}
      </form>

      <Feedback {...props} />
      {validation && validation.correct && (
        <section className="lab-why" aria-labelledby="lab-why-title">
          <h3 id="lab-why-title">Why this model works</h3>
          <ul>
            {validation.checks.map((c) => (
              <li key={c.rule}><span aria-hidden="true">✓ </span><strong>{c.label}.</strong> <span className="hint">{c.detail}</span></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

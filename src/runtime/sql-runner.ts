// Runs learners' SQL in a fresh, in-memory SQLite database (sql.js / WebAssembly).
// Nothing persists between runs and nothing leaves the browser. The engine
// only receives the resulting rows (see engine/sql-check.ts).

import type { SqlJsStatic } from 'sql.js';
import type { Cell, SqlResult } from '../engine/types';

const MAX_QUERY_LENGTH = 2000;
const MAX_ROWS = 200;

export interface QueryOutcome { result?: SqlResult; error?: string }

/** Pure-ish core, usable from Node tests with any initialised sql.js module. */
export function runQueryWith(SQL: SqlJsStatic, setup: string, query: string): QueryOutcome {
  const text = query.trim();
  if (!text) return { error: 'The query is empty.' };
  if (text.length > MAX_QUERY_LENGTH) return { error: 'That query is too long for this exercise.' };
  // Recursive queries could run forever on the main thread; they aren't needed here.
  if (/\bRECURSIVE\b/i.test(text)) return { error: 'Recursive queries are not available in this practice database.' };
  const db = new SQL.Database();
  try {
    db.run(setup);
    const results = db.exec(text);
    if (!results.length) return { result: { columns: [], rows: [] } };
    const last = results[results.length - 1];
    return {
      result: {
        columns: last.columns,
        rows: last.values.slice(0, MAX_ROWS).map((row) => row.map((v) => (v instanceof Uint8Array ? '[binary]' : (v as Cell)))),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    db.close();
  }
}

let loading: Promise<SqlJsStatic> | null = null;

/** Loads SQLite on first use (about 650 KB of WebAssembly, served locally). */
export function loadSql(): Promise<SqlJsStatic> {
  if (!loading) {
    loading = Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')])
      .then(([mod, wasm]) => mod.default({ locateFile: () => wasm.default }))
      .catch((error) => {
        loading = null; // allow a retry
        throw error;
      });
  }
  return loading;
}

export async function runQuery(setup: string, query: string): Promise<QueryOutcome> {
  try {
    const SQL = await loadSql();
    return runQueryWith(SQL, setup, query);
  } catch {
    return { error: 'The practice database could not be loaded. Check your connection and try again.' };
  }
}

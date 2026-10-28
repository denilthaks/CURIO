// Pure comparison of SQL results. Running the query happens in sql-runner
// (sql.js / SQLite in WebAssembly); the engine only judges the result rows.

import type { Cell, SqlResult } from './types';

function norm(v: Cell): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  const n = Number(v);
  if (v.trim() !== '' && !Number.isNaN(n)) return String(Math.round(n * 100) / 100);
  return v.trim();
}

const rowKey = (row: Cell[]) => JSON.stringify(row.map(norm));

/** Returns null when rows match, otherwise a learner-friendly difference. */
export function compareRows(actual: Cell[][], expected: Cell[][], ordered: boolean): string | null {
  if (actual.length !== expected.length) {
    const what = actual.length === 0 ? 'no rows' : `${actual.length} row${actual.length === 1 ? '' : 's'}`;
    return `Your query returned ${what}; we expected ${expected.length}. Check your WHERE, GROUP BY or LIMIT.`;
  }
  const width = expected[0]?.length ?? 0;
  if (actual.some((r) => r.length !== width)) {
    const got = actual[0]?.length ?? 0;
    return `Your query returned ${got} column${got === 1 ? '' : 's'}; we expected ${width}. Check the list after SELECT.`;
  }
  const a = actual.map(rowKey);
  const e = expected.map(rowKey);
  if (ordered) {
    if (a.every((k, i) => k === e[i])) return null;
    const sameSet = [...a].sort().join() === [...e].sort().join();
    return sameSet
      ? 'The right rows, but not in the right order. Check your ORDER BY.'
      : 'The values in your results don’t match what we expected. Compare them with the table.';
  }
  if ([...a].sort().join() === [...e].sort().join()) return null;
  return 'The values in your results don’t match what we expected. Compare them with the table.';
}

export function formatTable(result: SqlResult): string {
  if (!result.columns.length) return '(no rows)';
  const rows = result.rows.map((r) => r.map((v) => (v === null ? 'NULL' : String(typeof v === 'number' ? Math.round(v * 100) / 100 : v))));
  const widths = result.columns.map((c, i) => Math.max(c.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' | ');
  return [line(result.columns), widths.map((w) => '-'.repeat(w)).join('-+-'), ...rows.map(line)].join('\n') + (rows.length ? '' : '\n(no rows)');
}

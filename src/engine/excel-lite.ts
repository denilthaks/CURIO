// A small spreadsheet formula evaluator: numbers, cell references (A1, $A$1),
// ranges inside functions (B2:B5), + - * / ^, unary minus, parentheses and
// SUM / AVERAGE / MIN / MAX / COUNT / ROUND. Errors use Excel's codes.
// Also supports "fill down": copying a formula to the rows below, shifting
// relative row references exactly like Excel's fill handle.

import type { Cell } from './types';

export class SheetError extends Error {}

export type Sheet = Record<string, Cell>; // "B2" → value

/** Build a sheet from header labels and data rows (data starts at row 2). */
export function makeSheet(columns: string[], rows: Cell[][]): Sheet {
  const sheet: Sheet = {};
  columns.forEach((label, c) => { sheet[`${colName(c)}1`] = label; });
  rows.forEach((row, r) => row.forEach((value, c) => { sheet[`${colName(c)}${r + 2}`] = value; }));
  return sheet;
}

export function colName(index: number): string {
  return String.fromCharCode(65 + index);
}

const REF = /^\$?([A-Z])\$?(\d+)$/;

type Token = { t: 'num' | 'ref' | 'fn' | 'op' | 'end'; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = src.toUpperCase();
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i += 1; continue; }
    const numMatch = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (numMatch) { tokens.push({ t: 'num', v: numMatch[0] }); i += numMatch[0].length; continue; }
    const refMatch = /^\$?[A-Z]+\$?\d+/.exec(s.slice(i));
    if (refMatch) { tokens.push({ t: 'ref', v: refMatch[0] }); i += refMatch[0].length; continue; }
    const fnMatch = /^[A-Z][A-Z0-9.]*/.exec(s.slice(i));
    if (fnMatch) { tokens.push({ t: 'fn', v: fnMatch[0] }); i += fnMatch[0].length; continue; }
    if ('+-*/^(),:'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i += 1; continue; }
    if (ch === ';') { tokens.push({ t: 'op', v: ',' }); i += 1; continue; }
    throw new SheetError('#NAME?');
  }
  tokens.push({ t: 'end', v: '' });
  return tokens;
}

export interface FormulaResult {
  ok: boolean;
  value?: number;
  error?: string;
  refs: string[];
  functions: string[];
}

const FUNCTIONS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND'];

function cellNumber(sheet: Sheet, ref: string): number {
  const m = REF.exec(ref);
  if (!m) throw new SheetError('#REF!');
  const value = sheet[`${m[1]}${m[2]}`];
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  throw new SheetError('#VALUE!');
}

function rangeValues(sheet: Sheet, from: string, to: string): number[] {
  const a = REF.exec(from);
  const b = REF.exec(to);
  if (!a || !b) throw new SheetError('#REF!');
  const values: number[] = [];
  const [c0, c1] = [a[1].charCodeAt(0), b[1].charCodeAt(0)].sort((x, y) => x - y);
  const [r0, r1] = [+a[2], +b[2]].sort((x, y) => x - y);
  for (let c = c0; c <= c1; c += 1) {
    for (let r = r0; r <= r1; r += 1) {
      const v = sheet[`${String.fromCharCode(c)}${r}`];
      if (typeof v === 'number') values.push(v); // like Excel, functions skip text
    }
  }
  return values;
}

export function evaluateFormula(formula: string, sheet: Sheet, self?: string): FormulaResult {
  const refs: string[] = [];
  const functions: string[] = [];
  const text = formula.trim();
  if (!text.startsWith('=')) {
    return { ok: false, error: 'A formula must start with "=". Without it, Excel treats your entry as plain text or a typed number.', refs, functions };
  }
  try {
    const tokens = tokenize(text.slice(1));
    let p = 0;
    const peek = () => tokens[p];
    const next = () => tokens[p++];
    const isOp = (v: string) => peek().t === 'op' && peek().v === v;
    const useRef = (ref: string) => {
      const plain = ref.replace(/\$/g, '');
      if (!REF.test(ref)) throw new SheetError('#REF!');
      if (self && plain === self) throw new SheetError('Circular reference: a cell cannot use its own value');
      refs.push(plain);
      return ref;
    };

    const expr = (): number => {
      let v = term();
      while (isOp('+') || isOp('-')) v = next().v === '+' ? v + term() : v - term();
      return v;
    };
    const term = (): number => {
      let v = factor();
      while (isOp('*') || isOp('/')) {
        const op = next().v;
        const r = factor();
        if (op === '/' && r === 0) throw new SheetError('#DIV/0!');
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const factor = (): number => {
      if (isOp('-')) { next(); return -factor(); }
      if (isOp('+')) { next(); return factor(); }
      const base = atom();
      if (isOp('^')) { next(); return base ** factor(); }
      return base;
    };
    const args = (): number[][] => {
      const list: number[][] = [];
      if (isOp(')')) { next(); return list; }
      for (;;) {
        if (peek().t === 'ref' && tokens[p + 1]?.t === 'op' && tokens[p + 1].v === ':') {
          const from = useRef(next().v);
          next();
          if (peek().t !== 'ref') throw new SheetError('#REF!');
          const to = useRef(next().v);
          list.push(rangeValues(sheet, from, to));
        } else {
          list.push([expr()]);
        }
        if (isOp(',')) { next(); continue; }
        if (isOp(')')) { next(); return list; }
        throw new SheetError('There is a problem with this formula: check the brackets and commas.');
      }
    };
    const atom = (): number => {
      const tok = next();
      if (tok.t === 'num') return parseFloat(tok.v);
      if (tok.t === 'ref') return cellNumber(sheet, useRef(tok.v));
      if (tok.t === 'op' && tok.v === '(') {
        const v = expr();
        if (!isOp(')')) throw new SheetError('There is a problem with this formula: a bracket is missing.');
        next();
        return v;
      }
      if (tok.t === 'fn') {
        if (!FUNCTIONS.includes(tok.v)) throw new SheetError('#NAME?');
        if (!isOp('(')) throw new SheetError('#NAME?');
        next();
        functions.push(tok.v);
        const a = args();
        const flat = a.flat();
        switch (tok.v) {
          case 'SUM': return flat.reduce((s, v) => s + v, 0);
          case 'AVERAGE':
            if (!flat.length) throw new SheetError('#DIV/0!');
            return flat.reduce((s, v) => s + v, 0) / flat.length;
          case 'MIN': return flat.length ? Math.min(...flat) : 0;
          case 'MAX': return flat.length ? Math.max(...flat) : 0;
          case 'COUNT': return flat.length;
          case 'ROUND': {
            const [x, d = [0]] = a;
            const f = 10 ** (d[0] ?? 0);
            return Math.round((x?.[0] ?? 0) * f) / f;
          }
          default: throw new SheetError('#NAME?');
        }
      }
      throw new SheetError('There is a problem with this formula.');
    };

    const value = expr();
    if (peek().t !== 'end') throw new SheetError('There is a problem with this formula.');
    if (!Number.isFinite(value)) throw new SheetError('#NUM!');
    return { ok: true, value, refs, functions };
  } catch (e) {
    return { ok: false, error: e instanceof SheetError ? e.message : 'There is a problem with this formula.', refs, functions };
  }
}

/** Shift relative row numbers by `offset`, as Excel's fill handle does. */
export function fillFormula(formula: string, offset: number): string {
  return formula.replace(/(\$?)([A-Za-z])(\$?)(\d+)/g, (match, colAbs, col, rowAbs, row, index, whole) => {
    // Don't touch function names like LOG10 (letters directly before).
    if (index > 0 && /[A-Za-z]/.test(whole[index - 1])) return match;
    return `${colAbs}${col}${rowAbs}${rowAbs ? row : Number(row) + offset}`;
  });
}

export function splitRef(ref: string): { col: string; row: number } {
  const m = REF.exec(ref.toUpperCase());
  if (!m) throw new Error(`Bad cell reference ${ref}`);
  return { col: m[1], row: Number(m[2]) };
}

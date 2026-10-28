// A small, sandboxed evaluator for a subset of Python *expressions*.
// It never touches the page, network or storage: it walks a parse tree.
// Supported: int/float/str/bool/None, lists, names, + - * / // % **, unary -,
// comparisons, and/or/not, indexing, and the builtins listed in BUILTINS.
// Error messages follow CPython's wording so learners see realistic errors.

export type PyValue =
  | { k: 'int'; v: number }
  | { k: 'float'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'none' }
  | { k: 'list'; v: PyValue[] };

export class PyError extends Error {
  constructor(public pyType: string, detail: string) {
    super(`${pyType}: ${detail}`);
  }
}

type Token = { t: 'num' | 'str' | 'name' | 'op' | 'end'; v: string };

const OPS = ['**', '//', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '<', '>', '(', ')', '[', ']', ','];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      tokens.push({ t: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (/[fF]$/.test(tokens.length && tokens[tokens.length - 1].t === 'name' ? tokens[tokens.length - 1].v : '')) {
        throw new PyError('SyntaxError', 'f-strings are not supported in this practice sandbox; try str() instead');
      }
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const esc = src[j + 1];
          out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
          j += 2;
        } else {
          out += src[j];
          j += 1;
        }
      }
      if (j >= src.length) throw new PyError('SyntaxError', 'unterminated string literal');
      tokens.push({ t: 'str', v: out });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ t: 'name', v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) {
      if (ch === '=') throw new PyError('SyntaxError', 'invalid syntax. Write an expression, not an assignment');
      throw new PyError('SyntaxError', `invalid character '${ch}'`);
    }
    tokens.push({ t: 'op', v: op });
    i += op.length;
  }
  tokens.push({ t: 'end', v: '' });
  return tokens;
}

type Node =
  | { n: 'lit'; value: PyValue }
  | { n: 'name'; id: string }
  | { n: 'list'; items: Node[] }
  | { n: 'bin'; op: string; l: Node; r: Node }
  | { n: 'unary'; op: string; x: Node }
  | { n: 'call'; fn: Node; args: Node[] }
  | { n: 'index'; x: Node; i: Node };

function parse(src: string): Node {
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const isOp = (v: string) => peek().t === 'op' && peek().v === v;
  const isKw = (v: string) => peek().t === 'name' && peek().v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new PyError('SyntaxError', v === ')' ? "'(' was never closed" : 'invalid syntax');
    next();
  };

  function orExpr(): Node {
    let l = andExpr();
    while (isKw('or')) { next(); l = { n: 'bin', op: 'or', l, r: andExpr() }; }
    return l;
  }
  function andExpr(): Node {
    let l = notExpr();
    while (isKw('and')) { next(); l = { n: 'bin', op: 'and', l, r: notExpr() }; }
    return l;
  }
  function notExpr(): Node {
    if (isKw('not')) { next(); return { n: 'unary', op: 'not', x: notExpr() }; }
    return comparison();
  }
  function comparison(): Node {
    let l = additive();
    while (peek().t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = next().v;
      l = { n: 'bin', op, l, r: additive() };
    }
    return l;
  }
  function additive(): Node {
    let l = term();
    while (isOp('+') || isOp('-')) { const op = next().v; l = { n: 'bin', op, l, r: term() }; }
    return l;
  }
  function term(): Node {
    let l = unary();
    while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) { const op = next().v; l = { n: 'bin', op, l, r: unary() }; }
    return l;
  }
  function unary(): Node {
    if (isOp('-') || isOp('+')) { const op = next().v; return { n: 'unary', op, x: unary() }; }
    return power();
  }
  function power(): Node {
    const base = postfix();
    if (isOp('**')) { next(); return { n: 'bin', op: '**', l: base, r: unary() }; }
    return base;
  }
  function postfix(): Node {
    let x = atom();
    for (;;) {
      if (isOp('(')) {
        next();
        const args: Node[] = [];
        while (!isOp(')')) {
          args.push(orExpr());
          if (!isOp(')')) expect(',');
        }
        next();
        x = { n: 'call', fn: x, args };
      } else if (isOp('[')) {
        next();
        const i = orExpr();
        expect(']');
        x = { n: 'index', x, i };
      } else {
        return x;
      }
    }
  }
  function atom(): Node {
    const tok = next();
    if (tok.t === 'num') {
      const isFloat = /[.eE]/.test(tok.v);
      return { n: 'lit', value: isFloat ? { k: 'float', v: parseFloat(tok.v) } : { k: 'int', v: parseInt(tok.v, 10) } };
    }
    if (tok.t === 'str') return { n: 'lit', value: { k: 'str', v: tok.v } };
    if (tok.t === 'name') {
      if (tok.v === 'True' || tok.v === 'False') return { n: 'lit', value: { k: 'bool', v: tok.v === 'True' } };
      if (tok.v === 'None') return { n: 'lit', value: { k: 'none' } };
      if (['if', 'for', 'while', 'def', 'import', 'lambda', 'return', 'class'].includes(tok.v)) {
        throw new PyError('SyntaxError', `'${tok.v}' isn't available here. Write a single expression`);
      }
      return { n: 'name', id: tok.v };
    }
    if (tok.t === 'op' && tok.v === '(') {
      const x = orExpr();
      expect(')');
      return x;
    }
    if (tok.t === 'op' && tok.v === '[') {
      const items: Node[] = [];
      while (!isOp(']')) {
        items.push(orExpr());
        if (!isOp(']')) expect(',');
      }
      next();
      return { n: 'list', items };
    }
    if (tok.t === 'end') throw new PyError('SyntaxError', 'incomplete input');
    throw new PyError('SyntaxError', 'invalid syntax');
  }

  const tree = orExpr();
  if (peek().t !== 'end') throw new PyError('SyntaxError', 'invalid syntax');
  return tree;
}

// ---- Values ----

export function fromJs(value: unknown): PyValue {
  if (value === null || value === undefined) return { k: 'none' };
  if (typeof value === 'boolean') return { k: 'bool', v: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { k: 'int', v: value } : { k: 'float', v: value };
  if (typeof value === 'string') return { k: 'str', v: value };
  if (Array.isArray(value)) return { k: 'list', v: value.map(fromJs) };
  throw new Error('Unsupported variable type');
}

const typeName = (x: PyValue) => ({ int: 'int', float: 'float', str: 'str', bool: 'bool', none: 'NoneType', list: 'list' })[x.k];
const isNum = (x: PyValue): x is { k: 'int' | 'float' | 'bool'; v: number } & PyValue => x.k === 'int' || x.k === 'float' || x.k === 'bool';
const num = (x: PyValue) => (x.k === 'bool' ? (x.v ? 1 : 0) : (x as { v: number }).v);
const mkNum = (v: number, float: boolean): PyValue => (float ? { k: 'float', v } : { k: 'int', v });

function formatFloat(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf';
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return `${v}.0`;
  return String(v);
}

export function repr(x: PyValue): string {
  switch (x.k) {
    case 'str': return `'${x.v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    default: return str(x);
  }
}

export function str(x: PyValue): string {
  switch (x.k) {
    case 'int': return String(x.v);
    case 'float': return formatFloat(x.v);
    case 'str': return x.v;
    case 'bool': return x.v ? 'True' : 'False';
    case 'none': return 'None';
    case 'list': return `[${x.v.map(repr).join(', ')}]`;
    default: return '';
  }
}

function truthy(x: PyValue): boolean {
  if (x.k === 'none') return false;
  if (x.k === 'str' || x.k === 'list') return x.v.length > 0;
  return num(x) !== 0;
}

function pyEquals(a: PyValue, b: PyValue): boolean {
  if (isNum(a) && isNum(b)) return num(a) === num(b);
  if (a.k !== b.k) return false;
  if (a.k === 'list' && b.k === 'list') return a.v.length === b.v.length && a.v.every((x, i) => pyEquals(x, b.v[i]));
  if (a.k === 'none') return true;
  return (a as { v: unknown }).v === (b as { v: unknown }).v;
}

function compare(op: string, a: PyValue, b: PyValue): boolean {
  if (op === '==') return pyEquals(a, b);
  if (op === '!=') return !pyEquals(a, b);
  let x: number | string;
  let y: number | string;
  if (isNum(a) && isNum(b)) { x = num(a); y = num(b); }
  else if (a.k === 'str' && b.k === 'str') { x = a.v; y = b.v; }
  else throw new PyError('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
  return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
}

function binary(op: string, a: PyValue, b: PyValue): PyValue {
  if (op === '+') {
    if (a.k === 'str' && b.k === 'str') return { k: 'str', v: a.v + b.v };
    if (a.k === 'list' && b.k === 'list') return { k: 'list', v: [...a.v, ...b.v] };
    if (a.k === 'str') throw new PyError('TypeError', `can only concatenate str (not "${typeName(b)}") to str`);
    if (a.k === 'list') throw new PyError('TypeError', `can only concatenate list (not "${typeName(b)}") to list`);
  }
  if (op === '*') {
    if (a.k === 'str' && (b.k === 'int' || b.k === 'bool')) return { k: 'str', v: a.v.repeat(Math.max(0, num(b))) };
    if (b.k === 'str' && (a.k === 'int' || a.k === 'bool')) return { k: 'str', v: b.v.repeat(Math.max(0, num(a))) };
  }
  if (!isNum(a) || !isNum(b)) {
    throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
  }
  const x = num(a);
  const y = num(b);
  const float = a.k === 'float' || b.k === 'float';
  switch (op) {
    case '+': return mkNum(x + y, float);
    case '-': return mkNum(x - y, float);
    case '*': return mkNum(x * y, float);
    case '/':
      if (y === 0) throw new PyError('ZeroDivisionError', 'division by zero');
      return { k: 'float', v: x / y };
    case '//':
      if (y === 0) throw new PyError('ZeroDivisionError', 'integer division or modulo by zero');
      return mkNum(Math.floor(x / y), float);
    case '%':
      if (y === 0) throw new PyError('ZeroDivisionError', 'integer modulo by zero');
      return mkNum(((x % y) + y) % y, float);
    case '**': return mkNum(x ** y, float || y < 0);
    default: throw new PyError('SyntaxError', 'invalid syntax');
  }
}

// Python 3 rounds halves to even: round(2.5) == 2.
function roundHalfEven(x: number, digits: number): number {
  const f = 10 ** digits;
  const scaled = x * f;
  const r = Math.round(scaled);
  const isHalf = Math.abs(Math.abs(scaled % 1) - 0.5) < 1e-9;
  return (isHalf && r % 2 !== 0 ? r - Math.sign(scaled) : r) / f;
}

function numbersOf(fn: string, x: PyValue): number[] {
  if (x.k !== 'list') throw new PyError('TypeError', `'${typeName(x)}' object is not iterable`);
  return x.v.map((item) => {
    if (!isNum(item)) throw new PyError('TypeError', `unsupported operand type(s) for ${fn === 'sum' ? '+' : fn}: 'int' and '${typeName(item)}'`);
    return num(item);
  });
}

type Builtin = (args: PyValue[]) => PyValue;
const BUILTINS: Record<string, Builtin> = {
  len: ([x]) => {
    if (x?.k === 'str' || x?.k === 'list') return { k: 'int', v: x.v.length };
    throw new PyError('TypeError', `object of type '${x ? typeName(x) : 'NoneType'}' has no len()`);
  },
  sum: ([x]) => {
    const values = numbersOf('sum', x);
    const float = x.k === 'list' && x.v.some((i) => i.k === 'float');
    return mkNum(values.reduce((s, v) => s + v, 0), float);
  },
  max: (args) => extreme(args, 'max'),
  min: (args) => extreme(args, 'min'),
  abs: ([x]) => {
    if (!x || !isNum(x)) throw new PyError('TypeError', `bad operand type for abs(): '${x ? typeName(x) : 'NoneType'}'`);
    return mkNum(Math.abs(num(x)), x.k === 'float');
  },
  round: ([x, d]) => {
    if (!x || !isNum(x)) throw new PyError('TypeError', `type ${x ? typeName(x) : 'NoneType'} doesn't define __round__ method`);
    if (!d || d.k === 'none') return { k: 'int', v: roundHalfEven(num(x), 0) };
    return mkNum(roundHalfEven(num(x), num(d)), x.k === 'float');
  },
  str: ([x]) => ({ k: 'str', v: x ? str(x) : '' }),
  int: ([x]) => {
    if (x?.k === 'str') {
      if (!/^\s*[-+]?\d+\s*$/.test(x.v)) throw new PyError('ValueError', `invalid literal for int() with base 10: ${repr(x)}`);
      return { k: 'int', v: parseInt(x.v, 10) };
    }
    if (x && isNum(x)) return { k: 'int', v: Math.trunc(num(x)) };
    throw new PyError('TypeError', 'int() argument must be a string or a number');
  },
  float: ([x]) => {
    if (x?.k === 'str') {
      const v = Number(x.v);
      if (x.v.trim() === '' || Number.isNaN(v)) throw new PyError('ValueError', `could not convert string to float: ${repr(x)}`);
      return { k: 'float', v };
    }
    if (x && isNum(x)) return { k: 'float', v: num(x) };
    throw new PyError('TypeError', 'float() argument must be a string or a number');
  },
  sorted: ([x]) => {
    if (x?.k !== 'list') throw new PyError('TypeError', `'${x ? typeName(x) : 'NoneType'}' object is not iterable`);
    return { k: 'list', v: [...x.v].sort((a, b) => (compare('<', a, b) ? -1 : compare('>', a, b) ? 1 : 0)) };
  },
};

function extreme(args: PyValue[], fn: 'max' | 'min'): PyValue {
  const items = args.length === 1 && args[0].k === 'list' ? args[0].v : args;
  if (!items.length) throw new PyError('ValueError', `${fn}() arg is an empty sequence`);
  return items.reduce((best, x) => (compare(fn === 'max' ? '>' : '<', x, best) ? x : best));
}

// Only an object's own keys count, so names like "constructor" or
// "__proto__" can never reach JavaScript's prototype chain.
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

function evaluateNode(node: Node, env: Record<string, PyValue>): PyValue {
  switch (node.n) {
    case 'lit': return node.value;
    case 'name': {
      if (own(env, node.id)) return env[node.id];
      if (own(BUILTINS, node.id)) throw new PyError('TypeError', `'builtin_function_or_method' needs to be called, e.g. ${node.id}(…)`);
      if (node.id === 'print') throw new PyError('SyntaxError', 'print is already part of the program. Just write what goes inside it');
      throw new PyError('NameError', `name '${node.id}' is not defined`);
    }
    case 'list': return { k: 'list', v: node.items.map((i) => evaluateNode(i, env)) };
    case 'unary': {
      const x = evaluateNode(node.x, env);
      if (node.op === 'not') return { k: 'bool', v: !truthy(x) };
      if (!isNum(x)) throw new PyError('TypeError', `bad operand type for unary ${node.op}: '${typeName(x)}'`);
      return mkNum(node.op === '-' ? -num(x) : num(x), x.k === 'float');
    }
    case 'bin': {
      if (node.op === 'and') { const l = evaluateNode(node.l, env); return truthy(l) ? evaluateNode(node.r, env) : l; }
      if (node.op === 'or') { const l = evaluateNode(node.l, env); return truthy(l) ? l : evaluateNode(node.r, env); }
      const l = evaluateNode(node.l, env);
      const r = evaluateNode(node.r, env);
      if (['==', '!=', '<', '>', '<=', '>='].includes(node.op)) return { k: 'bool', v: compare(node.op, l, r) };
      return binary(node.op, l, r);
    }
    case 'index': {
      const x = evaluateNode(node.x, env);
      const i = evaluateNode(node.i, env);
      if (x.k !== 'list' && x.k !== 'str') throw new PyError('TypeError', `'${typeName(x)}' object is not subscriptable`);
      if (i.k !== 'int' && i.k !== 'bool') throw new PyError('TypeError', `${x.k} indices must be integers, not ${typeName(i)}`);
      const len = x.v.length;
      const idx = num(i) < 0 ? len + num(i) : num(i);
      if (idx < 0 || idx >= len) throw new PyError('IndexError', `${x.k} index out of range`);
      return x.k === 'list' ? x.v[idx] : { k: 'str', v: x.v[idx] };
    }
    case 'call': {
      if (node.fn.n !== 'name' || !own(BUILTINS, node.fn.id)) {
        if (node.fn.n === 'name' && node.fn.id === 'print') {
          throw new PyError('SyntaxError', 'print is already part of the program. Just write what goes inside it');
        }
        const name = node.fn.n === 'name' ? node.fn.id : 'object';
        if (node.fn.n === 'name' && !own(env, node.fn.id)) throw new PyError('NameError', `name '${name}' is not defined`);
        throw new PyError('TypeError', `'${typeName(evaluateNode(node.fn, env))}' object is not callable`);
      }
      return BUILTINS[node.fn.id](node.args.map((a) => evaluateNode(a, env)));
    }
    default: throw new PyError('SyntaxError', 'invalid syntax');
  }
}

export type EvalResult = { ok: true; value: PyValue; names: string[] } | { ok: false; error: string };

export function evaluatePython(expression: string, variables: Record<string, unknown>): EvalResult {
  if (!expression.trim()) return { ok: false, error: 'SyntaxError: write an expression first' };
  if (expression.length > 500) return { ok: false, error: 'SyntaxError: expression is too long for this exercise' };
  try {
    const env: Record<string, PyValue> = Object.create(null);
    for (const [k, v] of Object.entries(variables)) env[k] = fromJs(v);
    const tree = parse(expression);
    const names = new Set<string>();
    const walk = (n: Node): void => {
      if (n.n === 'name') names.add(n.id);
      if (n.n === 'list') n.items.forEach(walk);
      if (n.n === 'bin') { walk(n.l); walk(n.r); }
      if (n.n === 'unary') walk(n.x);
      if (n.n === 'index') { walk(n.x); walk(n.i); }
      if (n.n === 'call') { walk(n.fn); n.args.forEach(walk); }
    };
    walk(tree);
    return { ok: true, value: evaluateNode(tree, env), names: [...names] };
  } catch (e) {
    if (e instanceof PyError) return { ok: false, error: e.message };
    return { ok: false, error: 'SyntaxError: invalid syntax' };
  }
}

export function toJs(x: PyValue): unknown {
  if (x.k === 'list') return x.v.map(toJs);
  if (x.k === 'none') return null;
  return x.v;
}

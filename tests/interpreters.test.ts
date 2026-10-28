import { describe, expect, test } from 'vitest';
import { evaluatePython, str } from '../src/engine/python-lite';
import { evaluateFormula, fillFormula, makeSheet } from '../src/engine/excel-lite';

const py = (expr: string, vars: Record<string, unknown> = {}) => {
  const r = evaluatePython(expr, vars);
  return r.ok ? str(r.value) : r.error;
};

describe('python-lite', () => {
  test('arithmetic follows Python semantics', () => {
    expect(py('7 / 2')).toBe('3.5');
    expect(py('8 / 2')).toBe('4.0');
    expect(py('7 // 2')).toBe('3');
    expect(py('-7 // 2')).toBe('-4');
    expect(py('-7 % 3')).toBe('2');
    expect(py('2 ** 3 ** 2')).toBe('512');
    expect(py('-2 ** 2')).toBe('-4');
    expect(py('0.1 + 0.2')).toBe('0.30000000000000004');
    expect(py('(1 + 2) * 3')).toBe('9');
  });

  test('builtins', () => {
    expect(py('sum(xs) / len(xs)', { xs: [12, 7, 9, 4] })).toBe('8.0');
    expect(py('round(2.5)')).toBe('2');
    expect(py('round(3.5)')).toBe('4');
    expect(py('round(32 / 3, 1)')).toBe('10.7');
    expect(py('max(xs)', { xs: [3, 9, 2] })).toBe('9');
    expect(py('min(4, 1, 8)')).toBe('1');
    expect(py('str(32) + "!"')).toBe('32!');
    expect(py('int("41") + 1')).toBe('42');
    expect(py('sorted([3, 1, 2])')).toBe('[1, 2, 3]');
    expect(py("['a', 'b'][-1]")).toBe('b');
  });

  test('errors match CPython wording', () => {
    expect(py('"Total: " + 3')).toBe('TypeError: can only concatenate str (not "int") to str');
    expect(py('3 + "x"')).toBe("TypeError: unsupported operand type(s) for +: 'int' and 'str'");
    expect(py('totl', { total: 1 })).toBe("NameError: name 'totl' is not defined");
    expect(py('1 / 0')).toBe('ZeroDivisionError: division by zero');
    expect(py('[1][3]')).toBe('IndexError: list index out of range');
    expect(py('int("x")')).toBe("ValueError: invalid literal for int() with base 10: 'x'");
    expect(py('(1 + 2')).toMatch(/^SyntaxError/);
    expect(py('x = 3')).toMatch(/^SyntaxError/);
    expect(py('')).toMatch(/^SyntaxError/);
  });

  test('cannot reach JavaScript or the page', () => {
    expect(py('constructor')).toMatch(/NameError/);
    expect(py('__proto__')).toMatch(/NameError/);
    expect(py('globalThis')).toMatch(/NameError/);
    expect(py('eval("1")')).toMatch(/NameError/);
  });
});

describe('excel-lite', () => {
  const sheet = makeSheet(['Item', 'Price', 'Qty'], [['Furs', 25, 6], ['Honey', 8, 15]]);
  const val = (f: string) => {
    const r = evaluateFormula(f, sheet);
    return r.ok ? r.value : r.error;
  };
  test('references, operators and functions', () => {
    expect(val('=B2*C2')).toBe(150);
    expect(val('=b3 * c3')).toBe(120);
    expect(val('=SUM(B2:B3)')).toBe(33);
    expect(val('=AVERAGE(B2:B3)')).toBe(16.5);
    expect(val('=MAX(C2:C3)-MIN(C2:C3)')).toBe(9);
    expect(val('=COUNT(A2:C3)')).toBe(4);
    expect(val('=ROUND(10/3, 2)')).toBe(3.33);
    expect(val('=2^3+-1')).toBe(7);
    expect(val('=$B$2+1')).toBe(26);
  });
  test('errors', () => {
    expect(val('=B2/0')).toBe('#DIV/0!');
    expect(val('=SUMM(B2:B3)')).toBe('#NAME?');
    expect(val('=A2*2')).toBe('#VALUE!');
    expect(val('B2*C2')).toMatch(/must start with "="/);
    expect(evaluateFormula('=D2+1', sheet, 'D2').error).toMatch(/Circular/);
  });
  test('fill down shifts relative rows only', () => {
    expect(fillFormula('=B2*C2', 2)).toBe('=B4*C4');
    expect(fillFormula('=B2*$F$1', 1)).toBe('=B3*$F$1');
    expect(fillFormula('=SUM(B2:B5)*B$1', 1)).toBe('=SUM(B3:B6)*B$1');
  });
});

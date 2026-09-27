// Tiny evaluator for the template's Conf formulas, used only to write correct
// cached <v> values (Excel recalculates anyway: fullCalcOnLoad="1").
// Supported: string/number literals, references, & + -, parentheses and TEXT().

export type CellValue = number | string;
export type RefLookup = (sheet: string | undefined, ref: string) => CellValue | undefined;

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** Excel serial (1900 system) of an ISO date "YYYY-MM-DD". */
export function isoToSerial(iso: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EPOCH) / DAY_MS);
}
export function serialToDate(serial: number): Date {
  return new Date(EPOCH + Math.floor(serial) * DAY_MS);
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** Excel TEXT() for dates with German (TT/MM/JJJJ) or English (dd/mm/yyyy) codes. */
export function formatDate(serial: number, format: string): string {
  const date = serialToDate(serial);
  const day = date.getUTCDate(),
    month = date.getUTCMonth(),
    year = date.getUTCFullYear(),
    weekday = WEEKDAYS[date.getUTCDay()];
  return format.replace(/T{1,4}|d{1,4}|M{1,4}|m{1,4}|J{2,4}|j{2,4}|y{2,4}|Y{2,4}/g, (token) => {
    const kind = token[0].toLowerCase(),
      len = token.length;
    if (kind === 't' || kind === 'd')
      return len >= 4 ? weekday : len === 3 ? weekday.slice(0, 2) : len === 2 ? pad(day) : `${day}`;
    if (kind === 'm')
      return len >= 4
        ? MONTHS[month]
        : len === 3
          ? MONTHS[month].slice(0, 3)
          : len === 2
            ? pad(month + 1)
            : `${month + 1}`;
    return len >= 3 ? `${year}` : pad(year % 100);
  });
}

export function valueToText(value: CellValue): string {
  if (typeof value === 'string') return value;
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
}

type Token =
  | { kind: 'str'; value: string }
  | { kind: 'num'; value: number }
  | { kind: 'ref'; sheet?: string; ref: string }
  | { kind: 'fn'; name: string }
  | { kind: 'op'; value: string };

const TOKEN_RULES: [RegExp, (m: RegExpExecArray) => Token | null][] = [
  [/^\s+/, () => null],
  [/^"((?:[^"]|"")*)"/, (m) => ({ kind: 'str', value: m[1].replace(/""/g, '"') })],
  [
    /^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!(\$?[A-Z]{1,3}\$?\d+)/,
    (m) => ({
      kind: 'ref',
      sheet: (m[1] ?? m[2]).replace(/''/g, "'"),
      ref: m[3].replace(/\$/g, ''),
    }),
  ],
  [/^([A-Z][A-Z0-9.]*)\(/i, (m) => ({ kind: 'fn', name: m[1].toUpperCase() })],
  [/^\$?[A-Z]{1,3}\$?\d+(?![\w(])/, (m) => ({ kind: 'ref', ref: m[0].replace(/\$/g, '') })],
  [/^\d+(?:\.\d+)?/, (m) => ({ kind: 'num', value: Number(m[0]) })],
  [/^[&+\-(),]/, (m) => ({ kind: 'op', value: m[0] })],
];

function tokenize(formula: string): Token[] | undefined {
  const tokens: Token[] = [];
  let rest = formula.trim().replace(/^=/, '');
  while (rest.length) {
    let matched = false;
    for (const [re, make] of TOKEN_RULES) {
      const m = re.exec(rest);
      if (!m) continue;
      const token = make(m);
      if (token) tokens.push(token);
      rest = rest.slice(m[0].length);
      matched = true;
      break;
    }
    if (!matched) return undefined;
  }
  return tokens;
}

class Unsupported extends Error {}

/** Returns the formula result, or undefined when the formula is not supported. */
export function evaluateFormula(formula: string, lookup: RefLookup): CellValue | undefined {
  if (formula.includes('#REF!')) return undefined;
  const tokens = tokenize(formula);
  if (!tokens?.length) return undefined;
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const isOp = (value: string): boolean => {
    const t = peek();
    return t?.kind === 'op' && t.value === value;
  };
  const expect = (value: string): void => {
    if (!isOp(value)) throw new Unsupported();
    pos++;
  };
  const toNumber = (value: CellValue): number => {
    if (typeof value === 'number') return value;
    if (value.trim() === '') return 0;
    const n = Number(value);
    if (Number.isNaN(n)) throw new Unsupported();
    return n;
  };

  const concat = (): CellValue => {
    let left = additive();
    while (isOp('&')) {
      pos++;
      left = valueToText(left) + valueToText(additive());
    }
    return left;
  };
  const additive = (): CellValue => {
    let left = unary();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = toNumber(unary());
      left = op === '+' ? toNumber(left) + right : toNumber(left) - right;
    }
    return left;
  };
  const unary = (): CellValue => {
    if (isOp('-')) {
      pos++;
      return -toNumber(unary());
    }
    const t = tokens[pos++];
    if (!t) throw new Unsupported();
    if (t.kind === 'str' || t.kind === 'num') return t.value;
    if (t.kind === 'ref') {
      const value = lookup(t.sheet, t.ref);
      if (value === undefined) throw new Unsupported();
      return value;
    }
    if (t.kind === 'op' && t.value === '(') {
      const inner = concat();
      expect(')');
      return inner;
    }
    if (t.kind === 'fn' && t.name === 'TEXT') {
      const value = concat();
      expect(',');
      const format = concat();
      expect(')');
      if (typeof format !== 'string') throw new Unsupported();
      return typeof value === 'number' ? formatDate(value, format) : value;
    }
    throw new Unsupported();
  };

  try {
    const result = concat();
    return pos === tokens.length ? result : undefined;
  } catch (error) {
    if (error instanceof Unsupported) return undefined;
    throw error;
  }
}

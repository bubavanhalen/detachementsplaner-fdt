// Minimal, order-preserving model of a worksheet's <sheetData>. Everything outside
// sheetData stays byte-identical, so drawings, styles and page setup survive.

export interface SheetCell {
  col: number;
  xml: string;
}
export interface SheetRow {
  r: number;
  /** Raw attribute string of <row>, including r="…". */
  attrs: string;
  cells: SheetCell[];
}
export interface SheetDoc {
  before: string;
  rows: SheetRow[];
  after: string;
}

const ROW_RE = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

/** Drops characters XML 1.0 does not allow (control characters, lone surrogates, U+FFFE/F). */
function xmlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const allowed =
      code === 0x9 ||
      code === 0xa ||
      code === 0xd ||
      (code >= 0x20 && code !== 0xfffe && code !== 0xffff && (code < 0xd800 || code > 0xdfff));
    if (allowed) out += ch;
  }
  return out;
}

export function escapeXml(text: string): string {
  return xmlChars(text.replace(/\r\n?/g, '\n'))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code: string) => {
    const lower = code.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const value = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number(lower.slice(1));
    return String.fromCodePoint(value);
  });
}

export function getAttr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}="([^"]*)"`).exec(attrs);
  return m ? m[1] : undefined;
}

/** Sets (or with `undefined` removes) one attribute in a raw attribute string. */
export function setAttr(attrs: string, name: string, value: string | undefined): string {
  const re = new RegExp(`\\s${name.replace(':', '\\:')}="[^"]*"`);
  if (value === undefined) return attrs.replace(re, '');
  const next = ` ${name}="${value}"`;
  return re.test(attrs) ? attrs.replace(re, next) : `${attrs}${next}`;
}

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}
export function colName(index: number): string {
  let n = index,
    out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref);
  return m ? { col: colIndex(m[1]), row: Number(m[2]) } : null;
}

export function parseSheet(xml: string): SheetDoc {
  const empty = /<sheetData\s*\/>/.exec(xml);
  if (empty)
    return {
      before: `${xml.slice(0, empty.index)}<sheetData>`,
      rows: [],
      after: `</sheetData>${xml.slice(empty.index + empty[0].length)}`,
    };
  const open = /<sheetData\b[^>]*>/.exec(xml);
  const close = xml.indexOf('</sheetData>');
  if (!open || close < open.index) throw new Error('Tabellenblatt ohne Zellbereich.');
  const inner = xml.slice(open.index + open[0].length, close);
  let previousRow = 0;
  const rows = [...inner.matchAll(ROW_RE)].map((m) => {
    const r = Number(getAttr(m[1], 'r') ?? previousRow + 1);
    previousRow = r;
    let previousCol = 0;
    const cells = [...(m[2] ?? '').matchAll(CELL_RE)].map((c) => {
      const ref = getAttr(c[1], 'r');
      const col = (ref && parseRef(ref)?.col) || previousCol + 1;
      previousCol = col;
      return { col, xml: ref ? c[0] : c[0].replace(/^<c\b/, `<c r="${colName(col)}${r}"`) };
    });
    return { r, attrs: getAttr(m[1], 'r') ? m[1] : ` r="${r}"${m[1]}`, cells };
  });
  return {
    before: xml.slice(0, open.index + open[0].length),
    rows,
    after: xml.slice(close),
  };
}

/** Rows ascending and unique, cells ascending and unique (later entries win). */
export function serializeSheet(doc: SheetDoc): string {
  const byRow = new Map<number, SheetRow>();
  for (const row of doc.rows) {
    const previous = byRow.get(row.r);
    byRow.set(row.r, previous ? { ...row, cells: [...previous.cells, ...row.cells] } : row);
  }
  const rows = [...byRow.values()]
    .sort((a, b) => a.r - b.r)
    .map((row) => {
      const cells = [...new Map(row.cells.map((c) => [c.col, c])).values()].sort(
        (a, b) => a.col - b.col,
      );
      return cells.length
        ? `<row${row.attrs}>${cells.map((c) => c.xml).join('')}</row>`
        : `<row${row.attrs}/>`;
    });
  return `${doc.before}${rows.join('')}${doc.after}`;
}

/** Row element; `lines` > 1 sets a custom height of 13 pt per line. */
export function newRow(r: number, cells: SheetCell[], lines = 1, lineHeight = 13): SheetRow {
  const ht = lines > 1 ? ` ht="${round1(lines * lineHeight)}" customHeight="1"` : '';
  return { r, attrs: ` r="${r}"${ht}`, cells };
}
const round1 = (n: number): number => Math.round(n * 10) / 10;

const styleAttr = (s: number | string | undefined): string => (s === undefined ? '' : ` s="${s}"`);

/** Inline string cell; an empty text gives an empty cell with the style only. */
export function textCell(
  col: number,
  row: number,
  text: string,
  s: number | string | undefined,
): SheetCell {
  if (text) return stringCell(col, row, text, s);
  return { col, xml: `<c r="${colName(col)}${row}"${styleAttr(s)}/>` };
}

/** Inline string cell, also for '' (a referenced empty string shows nothing, a blank shows 0). */
export function stringCell(
  col: number,
  row: number,
  text: string,
  s: number | string | undefined,
): SheetCell {
  return {
    col,
    xml: `<c r="${colName(col)}${row}"${styleAttr(s)} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`,
  };
}

export function formulaCell(
  col: number,
  row: number,
  formula: string,
  value: string,
  s: number,
): SheetCell {
  return {
    col,
    xml: `<c r="${colName(col)}${row}" s="${s}" t="str"><f>${escapeXml(formula)}</f><v>${escapeXml(value)}</v></c>`,
  };
}

export function numberCell(
  col: number,
  row: number,
  value: number,
  s: number | string | undefined,
): SheetCell {
  return { col, xml: `<c r="${colName(col)}${row}"${styleAttr(s)}><v>${value}</v></c>` };
}

/** Keeps only the style of a cell (drops value, formula and type). */
export function clearCell(cell: SheetCell, row: number): SheetCell {
  const attrs = /^<c\b([^>]*?)\/?>/.exec(cell.xml)?.[1] ?? '';
  const s = getAttr(attrs, 's');
  return { col: cell.col, xml: `<c r="${colName(cell.col)}${row}"${s ? ` s="${s}"` : ''}/>` };
}

export function cellStyle(cell: SheetCell): string | undefined {
  return getAttr(/^<c\b([^>]*?)\/?>/.exec(cell.xml)?.[1] ?? '', 's');
}

/** Replaces (or inserts) one cell, creating the row when needed. */
export function putCell(doc: SheetDoc, row: number, cell: SheetCell): void {
  let target = doc.rows.find((r) => r.r === row);
  if (!target) {
    target = newRow(row, []);
    doc.rows.push(target);
    doc.rows.sort((a, b) => a.r - b.r);
  }
  target.cells = [...target.cells.filter((c) => c.col !== cell.col), cell].sort(
    (a, b) => a.col - b.col,
  );
}

export function findCell(doc: SheetDoc, ref: string): SheetCell | undefined {
  const pos = parseRef(ref);
  if (!pos) return undefined;
  return doc.rows.find((r) => r.r === pos.row)?.cells.find((c) => c.col === pos.col);
}

/** "A2:I61" covering all cells of the sheet. */
export function dimensionRef(doc: SheetDoc): string {
  let minRow = Infinity,
    maxRow = 0,
    minCol = Infinity,
    maxCol = 0;
  for (const row of doc.rows)
    for (const cell of row.cells) {
      minRow = Math.min(minRow, row.r);
      maxRow = Math.max(maxRow, row.r);
      minCol = Math.min(minCol, cell.col);
      maxCol = Math.max(maxCol, cell.col);
    }
  if (!maxRow) return 'A1';
  return `${colName(minCol)}${minRow}:${colName(maxCol)}${maxRow}`;
}

/** Plain text of a cell (inline string, cached formula string or number). */
export function cellText(cell: SheetCell, sharedStrings: readonly string[] = []): string {
  const m = /^<c\b([^>]*?)(?:\/>|>([\s\S]*)<\/c>)$/.exec(cell.xml);
  if (!m?.[2]) return '';
  const type = getAttr(m[1], 't');
  if (type === 'inlineStr') return richText(/<is>([\s\S]*?)<\/is>/.exec(m[2])?.[1] ?? '');
  const v = /<v>([\s\S]*?)<\/v>/.exec(m[2])?.[1];
  if (v === undefined) return '';
  if (type === 's') return sharedStrings[Number(v)] ?? '';
  return unescapeXml(v);
}

/** Concatenated <t> texts of a string item (<si> / <is>). */
export function richText(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)]
    .map((m) => unescapeXml(m[1] ?? ''))
    .join('');
}

export function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) =>
    richText((m[1] ?? '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')),
  );
}

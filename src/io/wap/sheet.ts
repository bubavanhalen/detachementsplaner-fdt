// Worksheet cells, merges and geometry (column widths / row heights in EMU).
// Geometry is only used to place anchors and header cells in one common space;
// times are calibrated against the hour labels, never against row numbers.
import { cellColor, type Rgb, type Theme } from './colors';
import { child, children, num, numText, tagAttributes } from './xml';

export const EMU_PER_PX = 9525;

export interface Cell {
  row: number;
  col: number;
  text: string;
  value?: number;
  style: number;
}

export interface Merge {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface CellStyles {
  /** Maximum digit width of the default font in px (column width unit). */
  mdw: number;
  fill(style: number): Rgb | null;
}

const section = (text: string, tag: string): string => {
  const start = text.indexOf(`<${tag}`);
  if (start < 0) return '';
  const end = text.indexOf(`</${tag}>`, start);
  return end < 0 ? '' : text.slice(start, end);
};

/**
 * Reads fonts, fills and cell formats with light regex parsing: the styles part of a
 * WAP can be several megabytes of unused named styles.
 */
export function parseStyles(text: string | null, theme: Theme): CellStyles {
  if (!text) return { mdw: 7, fill: () => null };
  const fonts = section(text, 'fonts');
  const firstFont = fonts.match(/<font>([\s\S]*?)<\/font>|<font\s[^>]*>([\s\S]*?)<\/font>/);
  const fontBody = firstFont ? (firstFont[1] ?? firstFont[2] ?? '') : '';
  const size = Number(fontBody.match(/<sz\s+val="([\d.]+)"/)?.[1] ?? 11);
  const face = fontBody.match(/<name\s+val="([^"]+)"/)?.[1] ?? 'Calibri';
  const factor = /arial|helvetica|liberation sans|arimo/i.test(face)
    ? 0.556
    : /calibri|carlito/i.test(face)
      ? 0.507
      : 0.55;
  const mdw = Math.max(5, Math.round(((size * 96) / 72) * factor));

  const fills: (Rgb | null)[] = [];
  for (const match of section(text, 'fills').matchAll(/<fill\s*\/>|<fill>([\s\S]*?)<\/fill>/g)) {
    const body = match[1] ?? '';
    const pattern = body.match(/<patternFill([^>]*)>?/);
    const type = pattern ? (tagAttributes(pattern[1]).patternType ?? '') : '';
    let rgb: Rgb | null = null;
    if (pattern && type && type !== 'none') {
      const fg = body.match(/<fgColor([^>]*)\/?>/);
      rgb = fg ? cellColor(tagAttributes(fg[1]), theme) : null;
    } else if (/<gradientFill/.test(body)) {
      const stop = body.match(/<color([^>]*)\/?>/);
      rgb = stop ? cellColor(tagAttributes(stop[1]), theme) : null;
    }
    fills.push(rgb);
  }
  const xfFill: number[] = [];
  for (const match of section(text, 'cellXfs').matchAll(/<xf\b([^>]*)>/g))
    xfFill.push(Number(tagAttributes(match[1]).fillId ?? 0));
  return { mdw, fill: (style) => fills[xfFill[style] ?? 0] ?? null };
}

export function parseSharedStrings(doc: Document | null): string[] {
  if (!doc) return [];
  return children(doc.documentElement, 'si').map((si) =>
    [...si.getElementsByTagNameNS('*', 't')]
      .filter((t) => t.parentElement?.localName !== 'rPh')
      .map((t) => t.textContent ?? '')
      .join(''),
  );
}

/** "BK75" → { row: 74, col: 62 } (0-based). */
export function parseRef(ref: string): { row: number; col: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, col: col - 1 };
}

export interface SheetModel {
  cells: Cell[];
  merges: Merge[];
  cellAt(row: number, col: number): Cell | undefined;
  /** Merge range covering this cell, or a 1×1 range. */
  rangeAt(row: number, col: number): Merge;
  fillOf(cell: Cell | undefined): Rgb | null;
  colWidth(col: number): number;
  rowHeight(row: number): number;
  colX(col: number): number;
  rowY(row: number): number;
  /** Fractional column index for an x position in EMU. */
  xToCol(x: number): number;
}

export function parseSheet(
  doc: Document,
  sharedStrings: readonly string[],
  styles: CellStyles,
): SheetModel {
  const root = doc.documentElement;
  const format = child(root, 'sheetFormatPr');
  const mdw = styles.mdw;
  const charsToPx = (chars: number) =>
    Math.trunc(((256 * chars + Math.trunc(128 / mdw)) / 256) * mdw);
  const defaultWidthPx = charsToPx(
    num(format, 'defaultColWidth', num(format, 'baseColWidth', 8) + 0.43),
  );
  const defaultRowPx = Math.round((num(format, 'defaultRowHeight', 15) * 96) / 72);

  const colPx = new Map<number, number>();
  for (const col of children(child(root, 'cols'), 'col')) {
    const min = num(col, 'min', 1),
      max = Math.min(num(col, 'max', min), 16384);
    const hidden = /^(?:1|true)$/i.test(col.getAttribute('hidden') ?? '');
    const px = hidden ? 0 : charsToPx(num(col, 'width', 0));
    for (let c = min; c <= max && c <= min + 2000; c++) colPx.set(c - 1, px);
  }

  const rowPx = new Map<number, number>();
  const cells: Cell[] = [];
  const index = new Map<string, Cell>();
  for (const row of children(child(root, 'sheetData'), 'row')) {
    const r = num(row, 'r', 0) - 1;
    if (r >= 0) {
      if (/^(?:1|true)$/i.test(row.getAttribute('hidden') ?? '')) rowPx.set(r, 0);
      else if (row.hasAttribute('ht')) rowPx.set(r, Math.round((num(row, 'ht', 15) * 96) / 72));
    }
    for (const c of children(row, 'c')) {
      const ref = parseRef(c.getAttribute('r') ?? '');
      if (!ref) continue;
      const type = c.getAttribute('t') ?? 'n';
      const v = child(c, 'v');
      let text = '';
      let value: number | undefined;
      if (type === 's') text = sharedStrings[numText(v, -1)] ?? '';
      else if (type === 'inlineStr')
        text = [...(child(c, 'is')?.getElementsByTagNameNS('*', 't') ?? [])]
          .map((t) => t.textContent ?? '')
          .join('');
      else if (type === 'str' || type === 'e') text = v?.textContent ?? '';
      else if (v) {
        value = Number(v.textContent);
        text = v.textContent ?? '';
        if (!Number.isFinite(value)) value = undefined;
      }
      const cell: Cell = { row: ref.row, col: ref.col, text, value, style: num(c, 's', 0) };
      cells.push(cell);
      index.set(`${ref.row},${ref.col}`, cell);
    }
  }

  const merges: Merge[] = [];
  for (const merge of children(child(root, 'mergeCells'), 'mergeCell')) {
    const [a, b] = (merge.getAttribute('ref') ?? '').split(':');
    const p = parseRef(a ?? ''),
      q = parseRef(b ?? a ?? '');
    if (p && q)
      merges.push({
        r0: Math.min(p.row, q.row),
        c0: Math.min(p.col, q.col),
        r1: Math.max(p.row, q.row),
        c1: Math.max(p.col, q.col),
      });
  }

  const colWidth = (col: number) => (colPx.get(col) ?? defaultWidthPx) * EMU_PER_PX;
  const rowHeight = (row: number) => (rowPx.get(row) ?? defaultRowPx) * EMU_PER_PX;
  const colStarts: number[] = [0];
  const rowStarts: number[] = [0];
  const colX = (col: number) => {
    while (colStarts.length <= col)
      colStarts.push(colStarts[colStarts.length - 1] + colWidth(colStarts.length - 1));
    return colStarts[Math.max(0, col)];
  };
  const rowY = (row: number) => {
    while (rowStarts.length <= row)
      rowStarts.push(rowStarts[rowStarts.length - 1] + rowHeight(rowStarts.length - 1));
    return rowStarts[Math.max(0, row)];
  };

  return {
    cells,
    merges,
    cellAt: (row, col) => index.get(`${row},${col}`),
    rangeAt(row, col) {
      return (
        merges.find((m) => row >= m.r0 && row <= m.r1 && col >= m.c0 && col <= m.c1) ?? {
          r0: row,
          c0: col,
          r1: row,
          c1: col,
        }
      );
    },
    fillOf: (cell) => (cell ? styles.fill(cell.style) : null),
    colWidth,
    rowHeight,
    colX,
    rowY,
    xToCol(x) {
      let col = 0;
      while (col < 16384 && colX(col + 1) <= x) col++;
      const width = colWidth(col);
      return width ? col + (x - colX(col)) / width : col;
    },
  };
}

/** Excel serial date → ISO date (YYYY-MM-DD). */
export function serialToIso(serial: number, date1904 = false): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  // Serial 60 is the fictitious 29.02.1900; all WAP dates are far later.
  const ms = Date.UTC(1899, 11, 30) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Page layout of one Tagesbefehl, replicating a day sheet of the official template
// (A4 portrait, columns B | C | D | E, header rows 1–10). The PDF and the HTML print
// view both render this layout, so wrapping, font size and positions are identical.
import { StandardFontEmbedder, StandardFonts } from 'pdf-lib';
import type { TbOrder } from '../../model/tagesbefehl/types';
import type { TbTemplateLogo } from './template';

/** All coordinates are PDF points (1/72 in), measured from the top-left page corner. */
export const PT_PER_MM = 72 / 25.4;
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

// Template geometry (Excel at 100 %): margins left/top/bottom 15 mm; column A is an empty
// strip of 49 pt, then B 79 pt, C 204 pt, D 98 pt, E 98 pt (derived from drawing anchors).
const MARGIN_LEFT = 15 * PT_PER_MM;
const MARGIN_TOP = 15 * PT_PER_MM;
const MARGIN_BOTTOM = 15 * PT_PER_MM;
const COL_A = 49;
const WIDTHS = { B: 79, C: 204, D: 98, E: 98 } as const;
export type SheetColumn = keyof typeof WIDTHS;
const X_B = MARGIN_LEFT + COL_A;
const COLUMN_X: Record<SheetColumn, number> = {
  B: X_B,
  C: X_B + WIDTHS.B,
  D: X_B + WIDTHS.B + WIDTHS.C,
  E: X_B + WIDTHS.B + WIDTHS.C + WIDTHS.D,
};
const CONTENT_RIGHT = COLUMN_X.E + WIDTHS.E;
/** Horizontal cell padding like Excel's (≈ 2 px). */
const PAD = 2;
/** Template row heights of the header rows 1–10. */
const HEADER_ROWS = [13, 66.5, 18, 14, 4.5, 13, 16, 13, 13, 13];
const HEADER_TOP = (row: number): number =>
  MARGIN_TOP + HEADER_ROWS.slice(0, row - 1).reduce((sum, height) => sum + height, 0);
const BODY_TOP = HEADER_TOP(HEADER_ROWS.length + 1);
const BODY_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;
/** Excel row height 13 pt at Arial 10. */
const LINE_FACTOR = 1.3;
export const BASE_FONT_SIZE = 10;
/**
 * Step-wise shrinking (0.25 pt) keeps every order on exactly one page. Normal days end
 * above 7 pt; only extreme content continues down to the hard minimum.
 */
const FONT_STEP = 0.25;
const MIN_FONT_SIZE = 3;
const FONT_STEPS = Array.from(
  { length: Math.round((BASE_FONT_SIZE - MIN_FONT_SIZE) / FONT_STEP) + 1 },
  (_, index) => BASE_FONT_SIZE - index * FONT_STEP,
);
const LOGO_INSET = 3;
// Signature picture of the template: 1 060 000 EMU wide, anchored 55 000 EMU below the first
// blank row's top down to 5 000 EMU into the name row (2 × 13 pt − 4.33 pt + 0.39 pt).
const SIGNATURE = { width: 83.46, height: 22.06, offset: 4.33 };

export interface SheetCell {
  column: SheetColumn;
  /** Text box (padding already applied). */
  x: number;
  top: number;
  width: number;
  lines: string[];
  size: number;
  lineHeight: number;
  bold: boolean;
  align: 'left' | 'right';
  color: 'black' | 'white';
}

export type SheetRowKind =
  | 'unit'
  | 'bar'
  | 'title'
  | 'lk'
  | 'section'
  | 'group'
  | 'entry'
  | 'officer'
  | 'signature'
  | 'verteiler-heading'
  | 'verteiler';

export interface SheetRow {
  kind: SheetRowKind;
  top: number;
  height: number;
  cells: SheetCell[];
  entryId?: string;
}

export interface SheetBox {
  x: number;
  top: number;
  width: number;
  height: number;
}

export interface SheetLayout {
  /** Body font size after fitting (10 pt unless the content needed shrinking). */
  fontSize: number;
  rows: SheetRow[];
  /** Black bar behind "Tagesbefehl" (template row 4). */
  bars: SheetBox[];
  /** Logo boxes, same order as the logos passed in (stretched like in Excel). */
  logos: (SheetBox & { index: number })[];
  /** Box for the signature picture (fit "contain", left aligned). */
  signature: SheetBox;
}

/**
 * Baseline of a line inside its CSS line box (Arial/Helvetica: ascent 0.905 em, descent
 * 0.212 em), so the PDF places text exactly where the browser does in the print view.
 */
export const textBaseline = (cell: SheetCell, lineIndex: number): number =>
  cell.top + lineIndex * cell.lineHeight + cell.lineHeight / 2 + 0.3465 * cell.size;

// ---------------------------------------------------------------------------
// Text metrics: pdf-lib's standard Helvetica (WinAnsi), synchronous and offline.

type FontName = Parameters<typeof StandardFontEmbedder.for>[0];
let embedders: { regular: StandardFontEmbedder; bold: StandardFontEmbedder } | undefined;
const fonts = () =>
  (embedders ??= {
    regular: StandardFontEmbedder.for(StandardFonts.Helvetica as unknown as FontName),
    bold: StandardFontEmbedder.for(StandardFonts.HelveticaBold as unknown as FontName),
  });

const FALLBACKS: Record<string, string> = {
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '−': '-',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '≈': '~',
  '′': "'",
  '″': '"',
  '✓': 'v',
  '✔': 'v',
};

/** Text as it can be drawn with the WinAnsi standard fonts (umlauts, é, – stay intact). */
export function pdfText(text: string): string {
  const encoding = fonts().regular.encoding;
  const can = (value: string): boolean =>
    [...value].every((char) => encoding.canEncodeUnicodeCodePoint(char.codePointAt(0) ?? 0));
  let out = '';
  for (const char of text.normalize('NFC')) {
    if (/\s/.test(char)) out += ' ';
    else if (can(char)) out += char;
    else {
      const fallback = FALLBACKS[char] ?? char.normalize('NFD').replace(/\p{M}/gu, '');
      out += fallback && can(fallback) ? fallback : '?';
    }
  }
  return out;
}

export function textWidth(text: string, size: number, bold = false): number {
  return fonts()[bold ? 'bold' : 'regular'].widthOfTextAtSize(pdfText(text), size);
}

/** Word wrap like Excel: at spaces, overlong words are broken by character. */
export function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  const fits = (value: string) => textWidth(value, size, bold) <= maxWidth;
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && !fits(line + char)) {
          lines.push(line);
          line = char;
        } else line += char;
      }
    }
    if (line || !lines.length) lines.push(line);
  }
  return lines;
}

// ---------------------------------------------------------------------------

interface CellSpec {
  column: SheetColumn;
  text: string;
  /** Columns the text may use (Excel overflow into empty neighbours). */
  span?: SheetColumn[];
  bold?: boolean;
  wrap?: boolean;
}

const spanWidth = (columns: SheetColumn[]): number =>
  columns.reduce((sum, column) => sum + WIDTHS[column], 0);

function cellFor(spec: CellSpec, size: number): Omit<SheetCell, 'top'> {
  const width = spanWidth(spec.span ?? [spec.column]) - 2 * PAD;
  const bold = Boolean(spec.bold);
  const lines = spec.wrap === false ? [spec.text.trim()] : wrapText(spec.text, width, size, bold);
  return {
    column: spec.column,
    x: COLUMN_X[spec.column] + PAD,
    width,
    lines,
    size,
    lineHeight: size * LINE_FACTOR,
    bold,
    align: 'left',
    color: 'black',
  };
}

type RowSpec =
  | { kind: 'blank'; lines?: number; signature?: boolean }
  | {
      kind: Exclude<SheetRowKind, 'unit' | 'bar' | 'title' | 'lk'>;
      cells: CellSpec[];
      entryId?: string;
    };

/** "Inf Ustü Kp 99/9 (via Anschlag)" → B "Inf Ustü Kp 99/9", C "(via Anschlag)" as in the template. */
function verteilerCells(line: string, size: number): CellSpec[] {
  const match = /^(.*\S)\s+(\([^()]*\))$/.exec(line.trim());
  if (match && textWidth(match[1], size) <= WIDTHS.B - 2 * PAD)
    return [
      { column: 'B', text: match[1], wrap: false },
      { column: 'C', text: match[2], span: ['C', 'D', 'E'] },
    ];
  return [{ column: 'B', text: line, span: ['B', 'C', 'D', 'E'] }];
}

function bodyRows(order: TbOrder, size: number): RowSpec[] {
  const rows: RowSpec[] = [];
  const heading = (kind: 'section' | 'group', text: string): RowSpec => ({
    kind,
    cells: [{ column: 'B', text, bold: true, span: ['B', 'C', 'D', 'E'] }],
  });
  order.blocks.forEach((block, index) => {
    if (block.kind === 'section') {
      if (index > 0) rows.push({ kind: 'blank' });
      rows.push(heading('section', block.heading));
    } else if (block.kind === 'group') {
      rows.push({ kind: 'blank' }, heading('group', block.heading));
    } else {
      rows.push({
        kind: 'entry',
        entryId: block.entryId,
        cells: [
          { column: 'B', text: block.zeit },
          { column: 'C', text: block.taetigkeit },
          { column: 'D', text: block.verantwortlich },
          { column: 'E', text: block.ort },
        ],
      });
    }
  });
  rows.push({ kind: 'blank', lines: 2 });
  const officer = order.officer.lines;
  for (let index = 0; index < Math.max(2, officer.length); index += 2) {
    rows.push({
      kind: 'officer',
      cells: [
        ...(index === 0 ? [{ column: 'C' as const, text: order.officer.label }] : []),
        { column: 'D', text: officer[index] ?? '' },
        { column: 'E', text: officer[index + 1] ?? '' },
      ],
    });
  }
  rows.push({ kind: 'blank', lines: 2 });
  const signatureCell = (text: string): CellSpec => ({ column: 'D', text, span: ['D', 'E'] });
  rows.push({ kind: 'signature', cells: [signatureCell(order.signature.einheit)] });
  rows.push({ kind: 'blank', lines: 2, signature: true });
  rows.push({ kind: 'signature', cells: [signatureCell(order.signature.name)] });
  rows.push({ kind: 'signature', cells: [signatureCell(order.signature.funktion)] });
  const { gehtAn, zK } = order.verteiler;
  if (gehtAn.length || zK.length) rows.push({ kind: 'blank' });
  if (gehtAn.length) {
    rows.push({
      kind: 'verteiler-heading',
      cells: [{ column: 'B', text: 'Geht an', bold: true, span: ['B', 'C', 'D', 'E'] }],
    });
    for (const line of gehtAn) rows.push({ kind: 'verteiler', cells: verteilerCells(line, size) });
  }
  if (zK.length) {
    if (gehtAn.length) rows.push({ kind: 'blank' });
    rows.push({
      kind: 'verteiler-heading',
      cells: [{ column: 'B', text: 'z K an', span: ['B', 'C', 'D', 'E'] }],
    });
    for (const line of zK) rows.push({ kind: 'verteiler', cells: verteilerCells(line, size) });
  }
  return rows;
}

interface Body {
  rows: SheetRow[];
  height: number;
  signatureTop: number;
}

function layoutBody(order: TbOrder, size: number): Body {
  const lineHeight = size * LINE_FACTOR;
  const rows: SheetRow[] = [];
  let top = BODY_TOP,
    signatureTop = 0;
  for (const spec of bodyRows(order, size)) {
    if (spec.kind === 'blank') {
      // The two blank rows after the unit line hold the signature picture.
      if (spec.signature) signatureTop = top;
      top += lineHeight * (spec.lines ?? 1);
      continue;
    }
    const cells = spec.cells.map((cell) => cellFor(cell, size));
    const height = Math.max(1, ...cells.map((cell) => cell.lines.length)) * lineHeight;
    rows.push({
      kind: spec.kind,
      top,
      height,
      cells: cells.map((cell) => ({ ...cell, top })),
      ...(spec.entryId ? { entryId: spec.entryId } : {}),
    });
    top += height;
  }
  return { rows, height: top - BODY_TOP, signatureTop };
}

function fitBody(order: TbOrder): { body: Body; size: number } {
  const available = BODY_BOTTOM - BODY_TOP;
  let size = FONT_STEPS[0],
    body = layoutBody(order, size);
  for (const step of FONT_STEPS.slice(1)) {
    if (body.height <= available) break;
    size = step;
    body = layoutBody(order, size);
  }
  return { body, size };
}

/** Single line in a header row (B … E), bottom-aligned like Excel's default; shrinks to fit. */
function headerRow(
  kind: SheetRowKind,
  row: number,
  text: string,
  fontSize: number,
  options: Partial<Pick<SheetCell, 'bold' | 'align' | 'color'>> = {},
): SheetRow {
  const rowTop = HEADER_TOP(row),
    height = HEADER_ROWS[row - 1];
  const width = spanWidth(['B', 'C', 'D', 'E']) - 2 * PAD;
  const natural = textWidth(text, fontSize, options.bold);
  const size = natural > width ? Math.floor(fontSize * (width / natural) * 20) / 20 : fontSize;
  const lineHeight = size * LINE_FACTOR;
  return {
    kind,
    top: rowTop,
    height,
    cells: [
      {
        column: 'B',
        x: COLUMN_X.B + PAD,
        top: rowTop + height - lineHeight,
        width,
        lines: [text],
        size,
        lineHeight,
        bold: Boolean(options.bold),
        align: options.align ?? 'left',
        color: options.color ?? 'black',
      },
    ],
  };
}

function logoBoxes(logos: readonly TbTemplateLogo[]): SheetLayout['logos'] {
  const bandTop = HEADER_TOP(2);
  let left = COLUMN_X.B + LOGO_INSET,
    right = CONTENT_RIGHT - LOGO_INSET;
  const centered = logos.filter((logo) => logo.align === 'center');
  const centerWidth = centered.reduce((sum, logo) => sum + logo.widthMm * PT_PER_MM, 0);
  let center = (COLUMN_X.B + CONTENT_RIGHT) / 2 - centerWidth / 2;
  return logos.map((logo, index) => {
    const width = logo.widthMm * PT_PER_MM,
      height = logo.heightMm * PT_PER_MM,
      top = bandTop + (logo.topMm ?? 0) * PT_PER_MM;
    let x: number;
    if (logo.align === 'left') {
      x = left;
      left += width + LOGO_INSET;
    } else if (logo.align === 'right') {
      right -= width;
      x = right;
      right -= LOGO_INSET;
    } else {
      x = center;
      center += width;
    }
    return { index, x, top, width, height };
  });
}

/** Layout of one order on one A4 portrait page. */
export function layoutOrder(order: TbOrder, logos: readonly TbTemplateLogo[] = []): SheetLayout {
  const { body, size } = fitBody(order);
  const scale = size / BASE_FONT_SIZE;
  const header: SheetRow[] = [
    headerRow('unit', 3, `Kdt ${order.einheit}`.trim(), 14, { bold: true }),
    headerRow('bar', 4, 'Tagesbefehl', 11, { bold: true, align: 'right', color: 'white' }),
    headerRow('title', 7, order.title, 12, { bold: true }),
    headerRow('lk', 8, order.lk, BASE_FONT_SIZE),
  ];
  return {
    fontSize: size,
    rows: [...header, ...body.rows],
    bars: [
      {
        x: COLUMN_X.B,
        top: HEADER_TOP(4),
        width: CONTENT_RIGHT - COLUMN_X.B,
        height: HEADER_ROWS[3],
      },
    ],
    logos: logoBoxes(logos),
    signature: {
      x: COLUMN_X.D,
      top: body.signatureTop + SIGNATURE.offset * scale,
      width: SIGNATURE.width * scale,
      height: SIGNATURE.height * scale,
    },
  };
}

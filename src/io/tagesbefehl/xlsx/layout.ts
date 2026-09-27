// Row layout of one Tagesbefehl in the template (port of the reference build).
import type { TbOrder, TbOrderBlock } from '../../../model/tagesbefehl/types';
import { formulaCell, newRow, type SheetRow, textCell } from './sheet';
import { wrappedLines } from './wrap';

/** Template cellXfs ids (Tagesbefehle_Vorlage.xlsx). */
export const STYLE = { text: 1, group: 9, section: 10 } as const;
/** Characters per line used for the row-height estimate. */
const WIDTH = { B: 14, C: 40, D: 18, E: 18 } as const;
const B = 2,
  C = 3,
  D = 4,
  E = 5;

export interface LayoutStyles {
  /** Added cellXfs: wrapped text, top aligned. */
  wrap: number;
  /** Added cellXfs: text format "@", top aligned (time column). */
  time: number;
}

export type OrderContent = Pick<TbOrder, 'blocks' | 'officer' | 'verteiler' | 'signature'>;
type EntryBlock = Extract<TbOrderBlock, { kind: 'entry' }>;

export interface DayLayout {
  rows: SheetRow[];
  /** 1-based row of the signature "Einheit" formula (picture goes below it). */
  unitRow: number;
  lastRow: number;
}

function entryRow(r: number, e: EntryBlock, styles: LayoutStyles): SheetRow {
  const lines = Math.max(
    wrappedLines(e.taetigkeit, WIDTH.C),
    wrappedLines(e.verantwortlich, WIDTH.D),
    wrappedLines(e.ort, WIDTH.E),
  );
  return newRow(
    r,
    [
      textCell(B, r, e.zeit, styles.time),
      textCell(C, r, e.taetigkeit, styles.wrap),
      textCell(D, r, e.verantwortlich, styles.wrap),
      textCell(E, r, e.ort, styles.wrap),
    ],
    lines,
  );
}

const headRow = (r: number, text: string, s: number): SheetRow =>
  newRow(r, [textCell(B, r, text, s)]);

function officerRow(r: number, officer: TbOrder['officer']): SheetRow {
  const [first = '', ...rest] = officer.lines;
  return newRow(r, [
    textCell(C, r, officer.label, STYLE.text),
    textCell(D, r, first, STYLE.text),
    textCell(E, r, rest.join(', '), STYLE.text),
  ]);
}

/** "{Einheit} (via Anschlag)" → B: unit, C: "(via Anschlag)" as in the template. */
export function splitVerteilerLine(line: string): [string, string] {
  const m = /^(.*\S)\s+(\([^()]*\))$/.exec(line.trim());
  return m ? [m[1], m[2]] : [line.trim(), ''];
}

/** Verteiler lines: "Geht an" (bold), lines, blank, "z K an", lines. */
function verteilerItems(verteiler: TbOrder['verteiler']): ([string, string, number] | null)[] {
  const items: ([string, string, number] | null)[] = [];
  if (verteiler.gehtAn.length) {
    items.push(['Geht an', '', STYLE.section]);
    for (const line of verteiler.gehtAn) items.push([...splitVerteilerLine(line), STYLE.text]);
  }
  if (verteiler.zK.length) {
    if (items.length) items.push(null);
    items.push(['z K an', '', STYLE.text]);
    for (const line of verteiler.zK) items.push([...splitVerteilerLine(line), STYLE.text]);
  }
  return items;
}

/** Signature block: D = Conf!B7, two empty rows (picture), D = Conf!B8, D = Conf!B9. */
function signatureRows(r: number, signature: TbOrder['signature']): SheetRow[] {
  return [
    newRow(r, [formulaCell(D, r, 'Conf!B7', signature.einheit, STYLE.text)]),
    newRow(r + 3, [formulaCell(D, r + 3, 'Conf!B8', signature.name, STYLE.text)]),
    newRow(r + 4, [formulaCell(D, r + 4, 'Conf!B9', signature.funktion, STYLE.text)]),
  ];
}

/** Rows from 11 of a day sheet (Mo–Fr and the hidden single Sa / So sheets). */
export function layoutDay(order: OrderContent, styles: LayoutStyles): DayLayout {
  const rows: SheetRow[] = [];
  let r = 11;
  let first = true;
  for (const block of order.blocks) {
    if (block.kind === 'section') {
      if (!first) r++;
      rows.push(headRow(r++, block.heading, STYLE.section));
    } else if (block.kind === 'group') {
      r++;
      rows.push(headRow(r++, block.heading, STYLE.group));
    } else rows.push(entryRow(r++, block, styles));
    first = false;
  }
  r += 2;
  rows.push(officerRow(r, order.officer));
  r += 3;
  const unitRow = r;
  rows.push(...signatureRows(r, order.signature));
  r += 6;
  let lastRow = unitRow + 4;
  for (const item of verteilerItems(order.verteiler)) {
    if (item) {
      const [b, c, s] = item;
      rows.push(newRow(r, [textCell(B, r, b, s), ...(c ? [textCell(C, r, c, s)] : [])]));
      lastRow = r;
    }
    r++;
  }
  return { rows, unitRow, lastRow };
}

// ---------------------------------------------------------------------------
// "Sa + So": two orders on one page with fixed rows; drawing anchors stay.

export interface FixedRegion {
  /** First and last row that may be written; rows in [top, clearEnd] are replaced. */
  top: number;
  lastUsable: number;
  clearEnd: number;
}
export interface WeekendHalf extends FixedRegion {
  officerRow: number;
  /** Template slots: heading row and entry rows per section. */
  slots: { head: number; first: number; last: number }[];
}

export const SA_HALF: WeekendHalf = {
  top: 11,
  lastUsable: 23,
  clearEnd: 24,
  officerRow: 22,
  slots: [
    { head: 11, first: 12, last: 18 },
    { head: 19, first: 20, last: 21 },
  ],
};
export const SO_HALF: WeekendHalf = {
  top: 47,
  lastUsable: 54,
  clearEnd: 55,
  officerRow: 53,
  slots: [
    { head: 47, first: 48, last: 49 },
    { head: 50, first: 51, last: 52 },
  ],
};
export const SA_VERTEILER: FixedRegion = { top: 31, lastUsable: 36, clearEnd: 37 };
export const SO_VERTEILER: FixedRegion = { top: 62, lastUsable: 67, clearEnd: 68 };

type Item = { kind: 'group'; heading: string } | EntryBlock;
interface Section {
  heading: string;
  items: Item[];
}

function sections(blocks: TbOrderBlock[]): Section[] {
  const out: Section[] = [];
  for (const block of blocks) {
    if (block.kind === 'section') out.push({ heading: block.heading, items: [] });
    else {
      if (!out.length) out.push({ heading: '', items: [] });
      out[out.length - 1].items.push(block);
    }
  }
  return out;
}

const itemColumns = (item: Item): [string, string, string, string] =>
  item.kind === 'group'
    ? ['', item.heading, '', '']
    : [item.zeit, item.taetigkeit, item.verantwortlich, item.ort];

/** Several items in one row: columns joined line by line so entries stay aligned. */
function stackedRow(r: number, items: Item[], styles: LayoutStyles): SheetRow {
  const columns: string[][] = [[], [], [], []];
  let total = 0;
  for (const item of items) {
    const values = itemColumns(item);
    const widths = [WIDTH.B, WIDTH.C, WIDTH.D, WIDTH.E];
    const lines = values.map((v, i) => (v ? wrappedLines(v, widths[i]) : 1));
    const height = Math.max(...lines);
    total += height;
    values.forEach((v, i) => {
      columns[i].push(v + '\n'.repeat(height - lines[i]));
    });
  }
  const text = (i: number) => columns[i].join('\n').replace(/\n+$/, '');
  return newRow(
    r,
    [B, C, D, E].map((col, i) => textCell(col, r, text(i), styles.wrap)),
    total,
  );
}

function itemRow(r: number, item: Item, styles: LayoutStyles): SheetRow {
  return item.kind === 'group' ? headRow(r, item.heading, STYLE.group) : entryRow(r, item, styles);
}

/**
 * Rows of one weekend half. Uses the template slots when everything fits,
 * otherwise a compact layout; if even that overflows, the last items of the
 * largest section share one wrapped row, so no entry is dropped.
 */
export function layoutWeekendHalf(
  order: OrderContent | undefined,
  half: WeekendHalf,
  styles: LayoutStyles,
): SheetRow[] {
  if (!order) return [];
  const list = sections(order.blocks);
  const fitsTemplate =
    list.length <= half.slots.length &&
    list.every((s, i) => s.items.length <= half.slots[i].last - half.slots[i].first + 1);
  const rows: SheetRow[] = [];
  if (fitsTemplate) {
    list.forEach((section, i) => {
      const slot = half.slots[i];
      rows.push(headRow(slot.head, section.heading, STYLE.section));
      section.items.forEach((item, j) => {
        rows.push(itemRow(slot.first + j, item, styles));
      });
    });
    rows.push(officerRow(half.officerRow, order.officer));
    return rows;
  }
  const capacity = half.lastUsable - half.top + 1 - list.length - 1;
  const budget = list.map((s) => s.items.length);
  while (budget.reduce((a, b) => a + b, 0) > Math.max(capacity, list.length)) {
    const i = budget.indexOf(Math.max(...budget));
    if (budget[i] <= 1) break;
    budget[i]--;
  }
  let r = half.top;
  list.forEach((section, i) => {
    rows.push(headRow(r++, section.heading, STYLE.section));
    const slots = budget[i];
    const single = slots > 0 ? section.items.slice(0, slots - 1) : [];
    for (const item of single) rows.push(itemRow(r++, item, styles));
    const rest = section.items.slice(single.length);
    if (rest.length === 1) rows.push(itemRow(r++, rest[0], styles));
    else if (rest.length > 1) rows.push(stackedRow(r++, rest, styles));
  });
  // One blank row before the officer line when there is room for it.
  rows.push(officerRow(r + 1 <= half.lastUsable ? r + 1 : r, order.officer));
  return rows;
}

/** Verteiler rows inside a fixed region; overflow lines share the last row. */
export function layoutVerteiler(
  verteiler: TbOrder['verteiler'],
  region: FixedRegion,
  styles: LayoutStyles,
): SheetRow[] {
  const items = verteilerItems(verteiler);
  const capacity = region.lastUsable - region.top + 1;
  const rows: SheetRow[] = [];
  const fitted = items.length > capacity ? items.filter((item) => item !== null) : items;
  let r = region.top;
  fitted.forEach((item, i) => {
    if (r > region.lastUsable) return;
    if (!item) {
      r++;
      return;
    }
    if (r === region.lastUsable && i < fitted.length - 1) {
      const rest = fitted.slice(i).filter((x): x is [string, string, number] => x !== null);
      rows.push(
        newRow(
          r,
          [
            textCell(B, r, rest.map(([b]) => b).join('\n'), styles.wrap),
            textCell(C, r, rest.map(([, c]) => c).join('\n'), styles.wrap),
          ],
          rest.length,
        ),
      );
      r++;
      return;
    }
    const [b, c, s] = item;
    rows.push(newRow(r, [textCell(B, r, b, s), ...(c ? [textCell(C, r, c, s)] : [])]));
    r++;
  });
  return rows;
}

// Neutrale Zeit- und Kopf-Kalibrierung für den WAP-Import (Vertrag E1-07 §2c).
// Befristete Doppelung zu src/io/wap/calibrate.ts (Tagesbefehl, unverändert) bis Etappe 4
// (ADR-008, Entscheid E12 c). Alle x/y in EMU des Blatts (Raum von drawing.ts).
import type { Box, WapShape } from './drawing';
import { XlsxError } from './errors';
import { type Cell, type SheetModel, serialToIso } from './sheet';
import { SHEET_WEEKDAYS, type SheetWeekday, weekdayOfText } from './weekday';

/** Stundenmarke: Minuten seit 0000 (Vielfaches von 60, 0 … 1440) und y-Mitte der Marke. */
export interface SheetHourLabel {
  readonly minute: number;
  readonly y: number;
}

export interface SheetTimeScale {
  /** Nach minute und y streng aufsteigend, mindestens zwei. */
  readonly labels: readonly SheetHourLabel[];
  /** y → Minuten seit 0000, stückweise linear zwischen den Marken, ausserhalb linear verlängert. Ungerundet. */
  toMinute(y: number): number;
  /** Umkehrung von toMinute (gleiche Stückelung und Verlängerung). */
  toY(minute: number): number;
  /** Rechte Kante der linken Markenspalte. */
  readonly gridLeft: number;
  /** Linke Kante der rechten Markenspalte; Number.POSITIVE_INFINITY bei nur einer Markenspalte. */
  readonly gridRight: number;
  /** Erste Marke minus eine Stunde (y). */
  readonly gridTop: number;
  /** Letzte Marke plus 1,25 Stunden (y). */
  readonly gridBottom: number;
  /** WapShape.index aller Formen, die als Stundenmarke dienen (Zeitachse, nie Inhalt). */
  readonly labelShapes: ReadonlySet<number>;
}

export type SheetColumnKind = 'planning' | 'rap' | 'beso' | 'unlabeled';

export interface SheetColumn {
  /** Kopftext, Leerraum zusammengefasst und getrimmt; '' bei 'unlabeled'. */
  readonly name: string;
  readonly kind: SheetColumnKind;
  readonly x0: number;
  readonly x1: number;
}

export interface SheetDayBlock {
  readonly day: SheetWeekday;
  /** ISO-Datum (yyyy-mm-dd) = startDate + Tagesversatz; null, wenn startDate null ist. */
  readonly date: string | null;
  readonly x0: number;
  readonly x1: number;
  /** Nach x0 aufsteigend, lückenlos von x0 bis x1 des Tags, ohne Überlappung. */
  readonly columns: readonly SheetColumn[];
}

export interface SheetLayout {
  /** Montag der Woche (ISO) oder null, wenn das Blatt kein Datum nennt. */
  readonly startDate: string | null;
  /** Nach Wochentag Mo … So sortiert, je Wochentag höchstens einmal. */
  readonly days: readonly SheetDayBlock[];
  /** Zeile der Tagesköpfe (0-basiert). */
  readonly headerRow: number;
  /** Zeile der Spaltenköpfe (0-basiert) oder null, wenn keine gefunden. */
  readonly subHeaderRow: number | null;
}

// ---------------------------------------------------------------------------
// Zeitachse

const HOUR = /^([01]\d|2[0-4])00$/;
const centreX = (b: Box): number => (b.x0 + b.x1) / 2;
const centreY = (b: Box): number => (b.y0 + b.y1) / 2;
/** Nicht leere Zeilen aneinandergefügt (Kandidatentext). */
const labelText = (shape: WapShape): string => shape.lines.filter(Boolean).join('');

const calibrationFailed = (): XlsxError => new XlsxError('calibrationFailed');

/** Abschnitt zwischen zwei benachbarten Marken. */
interface Segment {
  readonly a: SheetHourLabel;
  readonly b: SheetHourLabel;
}

/**
 * Gruppen nach x-Mitte als Kette (wie calibrate.ts): Ein Element kommt zur aktuellen Gruppe,
 * wenn seine x-Mitte höchstens `tolerance` von der des zuletzt aufgenommenen entfernt ist.
 */
function chainByCentre(candidates: readonly WapShape[], tolerance: number): WapShape[][] {
  const groups: WapShape[][] = [];
  let current: WapShape[] = [];
  let lastCentre = Number.NaN;
  for (const shape of [...candidates].sort((a, b) => centreX(a.box) - centreX(b.box))) {
    const centre = centreX(shape.box);
    if (Math.abs(lastCentre - centre) <= tolerance) current.push(shape);
    else {
      current = [shape];
      groups.push(current);
    }
    lastCentre = centre;
  }
  return groups;
}

/** Je Stunde der Mittelwert der y-Mitten (Summenreihenfolge wie calibrate.ts), nur streng steigende y. */
function hourLabels(columns: readonly (readonly WapShape[])[]): SheetHourLabel[] {
  const byHour = new Map<number, number[]>();
  for (const column of columns)
    for (const shape of column) {
      const minute = Number(labelText(shape).slice(0, 2)) * 60;
      byHour.set(minute, [...(byHour.get(minute) ?? []), centreY(shape.box)]);
    }
  const raw = [...byHour.entries()]
    .map(([minute, ys]) => ({ minute, y: ys.reduce((a, b) => a + b, 0) / ys.length }))
    .sort((a, b) => a.minute - b.minute);
  const labels: SheetHourLabel[] = [];
  let lastY = Number.NEGATIVE_INFINITY;
  for (const label of raw)
    if (label.y > lastY) {
      labels.push(label);
      lastY = label.y;
    }
  return labels;
}

/**
 * Zeitkalibrierung aus den Stundenmarken-Formen («0500» … «2400»).
 * Fehler: XlsxError 'calibrationFailed' (weniger als zwei auswertbare Marken).
 */
export function calibrateSheetTime(shapes: readonly WapShape[]): SheetTimeScale {
  const candidates = shapes.filter((s) => HOUR.test(labelText(s)));
  if (candidates.length < 2) throw calibrationFailed();
  const widths = candidates.map((s) => s.box.x1 - s.box.x0).sort((a, b) => a - b);
  const middle = Math.floor(widths.length / 2);
  const tolerance = Math.max(1, ...widths.slice(middle, middle + 1));
  const columns = chainByCentre(candidates, tolerance).filter(
    (group) => new Set(group.map((s) => s.lines.join(''))).size >= 3,
  );
  const [left] = columns;
  const right = columns.slice(1).at(-1);
  if (!left) throw calibrationFailed();

  const labels = hourLabels(columns);
  const segments: Segment[] = [];
  let previous: SheetHourLabel | null = null;
  for (const label of labels) {
    if (previous) segments.push({ a: previous, b: label });
    previous = label;
  }
  const [firstSegment] = segments;
  const lastSegment = segments.at(-1);
  if (!firstSegment || !lastSegment) throw calibrationFailed();
  // Abschnitt wie calibrate.ts: der erste, dessen Endmarke über dem Wert liegt, sonst der letzte.
  const segmentFor = (value: number, key: (l: SheetHourLabel) => number): Segment =>
    segments.find((s) => key(s.b) > value) ?? lastSegment;
  const toMinute = (y: number): number => {
    const { a, b } = segmentFor(y, (l) => l.y);
    return a.minute + ((y - a.y) * (b.minute - a.minute)) / (b.y - a.y);
  };
  const toY = (minute: number): number => {
    const { a, b } = segmentFor(minute, (l) => l.minute);
    return a.y + ((minute - a.minute) * (b.y - a.y)) / (b.minute - a.minute);
  };
  const first = firstSegment.a;
  const last = lastSegment.b;
  const perHour = (last.y - first.y) / ((last.minute - first.minute) / 60);
  return {
    labels,
    toMinute,
    toY,
    gridLeft: Math.max(...left.map((s) => s.box.x1)),
    gridRight: right ? Math.min(...right.map((s) => s.box.x0)) : Number.POSITIVE_INFINITY,
    gridTop: first.y - perHour,
    gridBottom: last.y + perHour * 1.25,
    labelShapes: new Set(columns.flat().map((s) => s.index)),
  };
}

// ---------------------------------------------------------------------------
// Kopf: Tage, Spalten, Startdatum

interface DayCell {
  readonly day: SheetWeekday;
  readonly col: number;
}

interface Header {
  readonly row: number;
  /** Je Wochentag die erste Fundstelle, nach Spalte sortiert (mindestens zwei). */
  readonly days: readonly DayCell[];
  readonly first: DayCell;
  readonly last: DayCell;
}

const RAP = /^rap(?:port)?(?:e|s)?\.?$/i;
const BESO = /^(?:beso|bes|besonderes?)\.?$/i;

const classify = (name: string): SheetColumnKind =>
  RAP.test(name) ? 'rap' : BESO.test(name) ? 'beso' : 'planning';

const dayIndex = (day: SheetWeekday): number => SHEET_WEEKDAYS.indexOf(day);

const isDateSerial = (value: number | undefined): value is number =>
  value !== undefined && value > 30000 && value < 80000;

const byCol = (a: Cell, b: Cell): number => a.col - b.col;

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Montag derselben Woche (ISO). */
function toMonday(iso: string): string {
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return addDays(iso, -((weekday + 6) % 7));
}

/** Gültiges Kalenderdatum als ISO, sonst null (z.B. 31.02.). */
function calendarIso(day: number, month: number, year: number): string | null {
  const date = new Date(Date.UTC(2000, 0, 1, 12));
  date.setUTCFullYear(year, month - 1, day);
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date.toISOString().slice(0, 10) : null;
}

/** Startdatum (Vertrag §2c Schritt 6): (a) «Woche vom», (b) Datum in der Kopfzeile, (c) «‹Tag› dd.mm.yy[yy]». */
function detectStartDate(
  sheet: SheetModel,
  headerRow: number,
  date1904: boolean,
  firstDay: DayCell,
): string | null {
  for (const cell of sheet.cells) {
    if (!/woche\s+vom/i.test(cell.text)) continue;
    const next = sheet.cells
      .filter((c) => c.row === cell.row && c.col > cell.col && isDateSerial(c.value))
      .sort(byCol)[0];
    if (next && isDateSerial(next.value)) return toMonday(serialToIso(next.value, date1904));
  }
  const dated = sheet.cells
    .filter((c) => c.row === headerRow && c.col >= firstDay.col && isDateSerial(c.value))
    .sort(byCol)[0];
  if (dated && isDateSerial(dated.value)) return toMonday(serialToIso(dated.value, date1904));
  for (const cell of sheet.cells) {
    if (cell.row !== headerRow) continue;
    const day = weekdayOfText(cell.text);
    const match = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/.exec(cell.text);
    if (!day || !match) continue;
    const [, dd = '', mm = '', yy = ''] = match;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const iso = calendarIso(Number(dd), Number(mm), year);
    if (iso) return addDays(iso, -dayIndex(day));
  }
  return null;
}

/** Erste Zeile (0–29) mit den meisten verschiedenen Wochentagen, mindestens zwei. */
function findHeader(sheet: SheetModel): Header | null {
  let header: Header | null = null;
  let best = 0;
  const rows = [...new Set(sheet.cells.map((c) => c.row))]
    .filter((r) => r < 30)
    .sort((a, b) => a - b);
  for (const row of rows) {
    const found: DayCell[] = [];
    for (const cell of sheet.cells) {
      if (cell.row !== row || !cell.text.trim()) continue;
      const day = weekdayOfText(cell.text);
      if (day) found.push({ day, col: sheet.rangeAt(cell.row, cell.col).c0 });
    }
    found.sort((a, b) => a.col - b.col);
    const days = found.filter((d, i, all) => all.findIndex((o) => o.day === d.day) === i);
    const [first] = days;
    const last = days.at(-1);
    if (first && last && days.length >= 2 && days.length > best) {
      header = { row, days, first, last };
      best = days.length;
    }
  }
  return header;
}

/** Beschriftete Spalten eines Tags (Verbund beginnt im Tag, Breite > 0), x1 auf den Tag begrenzt. */
function labelledColumns(
  sheet: SheetModel,
  subHeaderRow: number,
  x0: number,
  x1: number,
): SheetColumn[] {
  const columns: SheetColumn[] = [];
  const seen = new Set<number>();
  const cells = sheet.cells.filter((c) => c.row === subHeaderRow && c.text.trim()).sort(byCol);
  for (const cell of cells) {
    const range = sheet.rangeAt(cell.row, cell.col);
    if (seen.has(range.c0)) continue;
    seen.add(range.c0);
    const cx0 = sheet.colX(range.c0);
    const cx1 = sheet.colX(range.c1 + 1);
    if (cx1 - cx0 <= 0 || cx0 < x0 || cx0 >= x1) continue;
    const name = cell.text.replace(/\s+/g, ' ').trim();
    columns.push({ name, kind: classify(name), x0: cx0, x1: Math.min(cx1, x1) });
  }
  return columns;
}

/** Ergänzt Lücken als 'unlabeled', so dass die Spalten [x0, x1] lückenlos und ohne Überlappung decken. */
function coverDay(labelled: readonly SheetColumn[], x0: number, x1: number): SheetColumn[] {
  const out: SheetColumn[] = [];
  let cursor = x0;
  for (const column of [...labelled].sort((a, b) => a.x0 - b.x0)) {
    if (column.x0 > cursor) out.push({ name: '', kind: 'unlabeled', x0: cursor, x1: column.x0 });
    const start = Math.max(column.x0, cursor);
    if (column.x1 <= start) continue;
    out.push({ ...column, x0: start });
    cursor = column.x1;
  }
  if (cursor < x1) out.push({ name: '', kind: 'unlabeled', x0: cursor, x1 });
  return out;
}

/** Rechte Grenze des letzten Tags: «Zeit» rechts davon, sonst gridRight, sonst 12 Spalten weiter. */
function rightLimitOf(
  sheet: SheetModel,
  time: SheetTimeScale,
  headerRow: number,
  lastDayCol: number,
): number {
  const zeit = sheet.cells
    .filter((c) => c.row === headerRow && c.col > lastDayCol && /^\s*zeit\s*$/i.test(c.text))
    .sort(byCol)[0];
  if (zeit) return sheet.colX(zeit.col);
  return Number.isFinite(time.gridRight) ? time.gridRight : sheet.colX(lastDayCol + 12);
}

/** Unter den vier Zeilen nach der Kopfzeile die mit den meisten nicht leeren Zellen im Tagesbereich. */
function findSubHeader(
  sheet: SheetModel,
  headerRow: number,
  firstCol: number,
  rightLimit: number,
): number | null {
  let subHeaderRow: number | null = null;
  let best = 0;
  for (let row = headerRow + 1; row <= headerRow + 4; row++) {
    const count = sheet.cells.filter(
      (c) => c.row === row && c.col >= firstCol && sheet.colX(c.col) < rightLimit && c.text.trim(),
    ).length;
    if (count > best) {
      best = count;
      subHeaderRow = row;
    }
  }
  return subHeaderRow;
}

/**
 * Tage, Daten und Spalten aus den Kopfzellen.
 * Fehler: XlsxError 'calibrationFailed' (keine Kopfzeile mit mindestens zwei Wochentagen).
 */
export function detectSheetLayout(
  sheet: SheetModel,
  time: SheetTimeScale,
  date1904 = false,
): SheetLayout {
  const header = findHeader(sheet);
  if (!header) throw calibrationFailed();
  const { row: headerRow, days: dayCells, first: firstDay } = header;
  const rightLimit = rightLimitOf(sheet, time, headerRow, header.last.col);
  const subHeaderRow = findSubHeader(sheet, headerRow, firstDay.col, rightLimit);
  const startDate = detectStartDate(sheet, headerRow, date1904, firstDay);

  const days: SheetDayBlock[] = [];
  dayCells.forEach((cell, i) => {
    const x0 = sheet.colX(cell.col);
    const next = dayCells[i + 1];
    const x1 = next ? sheet.colX(next.col) : rightLimit;
    if (x1 - x0 <= 0) return;
    const labelled = subHeaderRow === null ? [] : labelledColumns(sheet, subHeaderRow, x0, x1);
    days.push({
      day: cell.day,
      date: startDate === null ? null : addDays(startDate, dayIndex(cell.day)),
      x0,
      x1,
      columns: coverDay(labelled, x0, x1),
    });
  });
  days.sort((a, b) => dayIndex(a.day) - dayIndex(b.day));

  return { startDate, days, headerRow, subHeaderRow };
}

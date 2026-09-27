// Calibration in drawing space: Y → time from the hour labels (0500 … 2300) drawn as
// shapes in the left/right label columns, X → day blocks and sub-columns from the
// header cells (day names row, sub-header row with merged ranges; hidden columns
// have zero width and disappear).
import { TB_WEEKDAYS, type TbWeekday } from '../../model/tagesbefehl/types';
import type { Box, WapShape } from './drawing';
import { type SheetModel, serialToIso } from './sheet';
import { WapError } from './xml';

export interface HourLabel {
  minutes: number;
  y: number;
}

export interface TimeScale {
  labels: HourLabel[];
  /** y (EMU) → minutes since 00:00, piecewise linear, extrapolated at both ends. */
  toMinutes(y: number): number;
  /** Right edge of the left label column and left edge of the right label column. */
  gridLeft: number;
  gridRight: number;
  /** y range of the grid (first label − 1 h … last label + 1 h). */
  gridTop: number;
  gridBottom: number;
  /** Shapes used as labels (by index) — never treated as content. */
  labelShapes: Set<number>;
}

const HOUR = /^([01]\d|2[0-4])00$/;
const cx = (b: Box) => (b.x0 + b.x1) / 2;
const cy = (b: Box) => (b.y0 + b.y1) / 2;

export function calibrateTime(shapes: readonly WapShape[]): TimeScale {
  const candidates = shapes.filter((s) => HOUR.test(s.lines.filter(Boolean).join('')));
  if (candidates.length < 2)
    throw new WapError('Im Tabellenblatt wurden keine Stundenmarken (z. B. 0600, 0700) gefunden.');
  // Cluster by x centre; tolerance = typical label width.
  const widths = candidates.map((s) => s.box.x1 - s.box.x0).sort((a, b) => a - b);
  const tolerance = Math.max(widths[Math.floor(widths.length / 2)] ?? 0, 1);
  const clusters: WapShape[][] = [];
  for (const shape of [...candidates].sort((a, b) => cx(a.box) - cx(b.box))) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(cx(last[last.length - 1].box) - cx(shape.box)) <= tolerance)
      last.push(shape);
    else clusters.push([shape]);
  }
  const columns = clusters.filter((c) => new Set(c.map((s) => s.lines.join(''))).size >= 3);
  if (!columns.length)
    throw new WapError('Im Tabellenblatt wurden keine Stundenmarken (z. B. 0600, 0700) gefunden.');

  const byHour = new Map<number, number[]>();
  for (const column of columns)
    for (const shape of column) {
      const text = shape.lines.filter(Boolean).join('');
      const minutes = Number(text.slice(0, 2)) * 60;
      byHour.set(minutes, [...(byHour.get(minutes) ?? []), cy(shape.box)]);
    }
  const raw = [...byHour.entries()]
    .map(([minutes, ys]) => ({ minutes, y: ys.reduce((a, b) => a + b, 0) / ys.length }))
    .sort((a, b) => a.minutes - b.minutes);
  // Keep a strictly increasing sequence (drop stray labels).
  const labels: HourLabel[] = [];
  for (const label of raw)
    if (!labels.length || label.y > labels[labels.length - 1].y) labels.push(label);
  if (labels.length < 2)
    throw new WapError('Die Stundenmarken im Tabellenblatt sind nicht auswertbar.');

  const toMinutes = (y: number): number => {
    let i = labels.findIndex((l) => l.y > y) - 1;
    if (i < 0) i = y < labels[0].y ? 0 : labels.length - 2;
    i = Math.max(0, Math.min(labels.length - 2, i));
    const a = labels[i],
      b = labels[i + 1];
    return a.minutes + ((y - a.y) * (b.minutes - a.minutes)) / (b.y - a.y);
  };
  const perHour =
    (labels[labels.length - 1].y - labels[0].y) /
    ((labels[labels.length - 1].minutes - labels[0].minutes) / 60);
  const left = columns[0],
    right = columns.length > 1 ? columns[columns.length - 1] : null;
  return {
    labels,
    toMinutes,
    gridLeft: Math.max(...left.map((s) => s.box.x1)),
    gridRight: right ? Math.min(...right.map((s) => s.box.x0)) : Number.POSITIVE_INFINITY,
    gridTop: labels[0].y - perHour,
    gridBottom: labels[labels.length - 1].y + perHour * 1.25,
    labelShapes: new Set(columns.flat().map((s) => s.index)),
  };
}

// ---------------------------------------------------------------------------
// Header layout.

export type ColumnKind = 'group' | 'rap' | 'beso';

export interface SubColumn {
  day: TbWeekday;
  /** Header text as in the sheet, e.g. "ALPHA 1", "Rap", "Beso". */
  label: string;
  kind: ColumnKind;
  x0: number;
  x1: number;
  /** Position within the day (0 …). */
  order: number;
}

export interface DayBlock {
  day: TbWeekday;
  x0: number;
  x1: number;
  columns: SubColumn[];
}

export interface Layout {
  days: DayBlock[];
  /** Monday of the week (ISO) if the sheet states a date, else ''. */
  startDate: string;
  headerRow: number;
  subHeaderRow: number;
}

const DAY_NAMES: Record<string, TbWeekday> = {
  montag: 'Mo',
  dienstag: 'Di',
  mittwoch: 'Mi',
  donnerstag: 'Do',
  freitag: 'Fr',
  samstag: 'Sa',
  sonntag: 'So',
  mo: 'Mo',
  di: 'Di',
  mi: 'Mi',
  do: 'Do',
  fr: 'Fr',
  sa: 'Sa',
  so: 'So',
};
const DAY_RE =
  /^\s*(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so)(?=$|[\s.,:\d])/i;

export const dayOfText = (text: string): TbWeekday | null => {
  const match = DAY_RE.exec(text);
  return match ? DAY_NAMES[match[1].toLowerCase()] : null;
};

const classify = (label: string): ColumnKind =>
  /^rap(?:port)?(?:e|s)?\.?$/i.test(label.trim())
    ? 'rap'
    : /^(?:beso|bes|besonderes?)\.?$/i.test(label.trim())
      ? 'beso'
      : 'group';

function isoWeekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
}
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const toMonday = (iso: string) => addDays(iso, -((isoWeekday(iso) + 6) % 7));

function detectStartDate(
  sheet: SheetModel,
  headerRow: number,
  date1904: boolean,
  firstDay: { day: TbWeekday; col: number } | undefined,
): string {
  const isDateSerial = (v: number | undefined) => v != null && v > 30000 && v < 80000;
  // 1. "Woche vom <date>"
  for (const cell of sheet.cells) {
    if (!/woche\s+vom/i.test(cell.text)) continue;
    const next = sheet.cells
      .filter((c) => c.row === cell.row && c.col > cell.col && isDateSerial(c.value))
      .sort((a, b) => a.col - b.col)[0];
    if (next?.value != null) return toMonday(serialToIso(next.value, date1904));
  }
  // 2. A date serial in the day header row right of the first day name.
  if (firstDay) {
    const dated = sheet.cells
      .filter((c) => c.row === headerRow && c.col >= firstDay.col && isDateSerial(c.value))
      .sort((a, b) => a.col - b.col)[0];
    if (dated?.value != null) {
      const iso = serialToIso(dated.value, date1904);
      return toMonday(iso);
    }
  }
  // 3. "Sa 03.10.26" style headers.
  for (const cell of sheet.cells.filter((c) => c.row === headerRow)) {
    const day = dayOfText(cell.text);
    const m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(cell.text);
    if (!day || !m) continue;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso))) return addDays(iso, -TB_WEEKDAYS.indexOf(day));
  }
  return '';
}

export function detectLayout(sheet: SheetModel, time: TimeScale, date1904 = false): Layout {
  // Day header row: the row (near the top) naming the most distinct weekdays.
  let headerRow = -1;
  let dayCells: { day: TbWeekday; col: number }[] = [];
  const rows = [...new Set(sheet.cells.map((c) => c.row))]
    .filter((r) => r < 30)
    .sort((a, b) => a - b);
  for (const row of rows) {
    const found = sheet.cells
      .filter((c) => c.row === row && c.text.trim())
      .map((c) => ({ day: dayOfText(c.text), col: sheet.rangeAt(c.row, c.col).c0 }))
      .filter((d): d is { day: TbWeekday; col: number } => !!d.day)
      .sort((a, b) => a.col - b.col);
    const distinct = new Set(found.map((d) => d.day)).size;
    if (distinct >= 2 && distinct > new Set(dayCells.map((d) => d.day)).size) {
      headerRow = row;
      dayCells = found.filter((d, i, all) => all.findIndex((o) => o.day === d.day) === i);
    }
  }
  if (headerRow < 0)
    throw new WapError('Im Tabellenblatt wurde keine Kopfzeile mit Wochentagen gefunden.');

  // Right boundary of the last day: a "Zeit" cell in the header row or the right label column.
  const zeitCols = sheet.cells
    .filter((c) => c.row === headerRow && /^\s*zeit\s*$/i.test(c.text))
    .map((c) => c.col);
  const lastDayCol = dayCells[dayCells.length - 1].col;
  const rightZeit = zeitCols.filter((c) => c > lastDayCol).sort((a, b) => a - b)[0];
  const rightLimit =
    rightZeit != null
      ? sheet.colX(rightZeit)
      : Number.isFinite(time.gridRight)
        ? time.gridRight
        : sheet.colX(lastDayCol + 12);

  // Sub-header row: the row below with the most text cells inside the day range.
  const firstCol = dayCells[0].col;
  let subHeaderRow = -1,
    best = 0;
  for (let row = headerRow + 1; row <= headerRow + 4; row++) {
    const count = sheet.cells.filter(
      (c) => c.row === row && c.col >= firstCol && sheet.colX(c.col) < rightLimit && c.text.trim(),
    ).length;
    if (count > best) {
      best = count;
      subHeaderRow = row;
    }
  }

  const days: DayBlock[] = [];
  dayCells.forEach((cell, i) => {
    const x0 = sheet.colX(cell.col);
    const x1 = i + 1 < dayCells.length ? sheet.colX(dayCells[i + 1].col) : rightLimit;
    if (x1 - x0 <= 0) return;
    const columns: SubColumn[] = [];
    if (subHeaderRow >= 0) {
      const seen = new Set<number>();
      for (const c of sheet.cells
        .filter((c) => c.row === subHeaderRow && c.text.trim())
        .sort((a, b) => a.col - b.col)) {
        const range = sheet.rangeAt(c.row, c.col);
        if (seen.has(range.c0)) continue;
        seen.add(range.c0);
        const cx0 = sheet.colX(range.c0),
          cx1 = sheet.colX(range.c1 + 1);
        if (cx1 - cx0 <= 0 || cx0 < x0 - 1 || cx0 >= x1) continue;
        const label = c.text.replace(/\s+/g, ' ').trim();
        columns.push({
          day: cell.day,
          label,
          kind: classify(label),
          x0: cx0,
          x1: Math.min(cx1, x1),
          order: columns.length,
        });
      }
    }
    if (!columns.length)
      columns.push({ day: cell.day, label: '', kind: 'group', x0, x1, order: 0 });
    days.push({ day: cell.day, x0, x1, columns });
  });
  days.sort((a, b) => TB_WEEKDAYS.indexOf(a.day) - TB_WEEKDAYS.indexOf(b.day));

  return {
    days,
    startDate: detectStartDate(sheet, headerRow, date1904, dayCells[0]),
    headerRow,
    subHeaderRow,
  };
}

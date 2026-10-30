// Raster-Layout einer Woche: Tage, Spalten, Zeit, Band und alle Einträge mit Text (Vertrag E1-02d Abschnitt 2;
// ADR-004, Leitplanke 2). Rein und deterministisch, ohne DOM, Uhr und Zufall (R-L-02).

import { weekDates } from '../../calendar';
import { dayColumns, requireWeek } from '../../derive/columns';
import { entriesOnDate } from '../../derive/entries';
import type { FontSizes } from '../../template';
import type { Plan, Week } from '../../types';
import type { DayContext } from '../entries/draft';
import { layoutEntries } from '../entries/layoutEntries';
import { GridLayoutError } from './errors';
import { columnWeight, columnWidths, dayWidths } from './geometry';
import type {
  ColumnGeometry,
  DayGeometry,
  GridFrame,
  GridLayout,
  GridLayoutInput,
  TimeScale,
} from './types';

/** Das Band ist die erste Stunde des Anzeigebereichs (B-F-06, F-63 a). */
const BAND_MINUTES = 60;
const DAY_MINUTES = 1440;
const TIME_STEP = 5;

function checkDisplayRange(range: Plan['displayRange']): void {
  const { from, to } = range;
  const valid =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from % TIME_STEP === 0 &&
    to % TIME_STEP === 0 &&
    from >= 0 &&
    from + BAND_MINUTES < to &&
    to <= DAY_MINUTES;
  if (!valid) throw new GridLayoutError('invalidDisplayRange');
}

function checkFrame(frame: GridFrame): void {
  const { rect } = frame;
  const sizes = [frame.timeAxisWidthPt, frame.dayHeaderHeightPt, frame.columnHeaderHeightPt];
  const valid =
    [rect.x, rect.y, rect.w, rect.h, ...sizes].every(Number.isFinite) &&
    sizes.every((s) => s >= 0) &&
    rect.w > 2 * frame.timeAxisWidthPt &&
    rect.h > frame.dayHeaderHeightPt + frame.columnHeaderHeightPt;
  if (!valid) throw new GridLayoutError('gridFrameTooSmall');
}

function checkFontSizes(fs: FontSizes): void {
  const sizes = [fs.standard, fs.blockTitle, fs.besoNumber, fs.rapportCode];
  const valid =
    [...sizes, fs.min].every(Number.isFinite) && fs.min > 0 && sizes.every((s) => fs.min <= s);
  if (!valid) {
    throw new RangeError(
      'layoutGrid: Die Schriftgrössen der Vorlage müssen endlich sein, mit 0 < Mindestgrösse ≤ jeder übrigen Grösse.',
    );
  }
}

/**
 * Tages- und Spaltengeometrie der sichtbaren Tage ohne Einträge (2a Nr 2, 3); dieselbe Rechnung wie in layoutGrid.
 * Genutzt für die Höhe der Spaltenkopfzeile (F-LAYOUT2 Punkt 11), die nur von den Breiten abhängt.
 */
export function dayGeometries(plan: Plan, week: Week, x0: number, width: number): DayGeometry[] {
  return buildDays(plan, week, x0, width, false).map((d) => d.geo);
}

/** Sichtbare Tage in Wochenreihenfolge, lückenlos ab x0 (2a Nr 2, 3). */
function buildDays(
  plan: Plan,
  week: Week,
  x0: number,
  width: number,
  withEntries = true,
): DayContext[] {
  const dates = weekDates(week.startDate);
  const widths = dayWidths(week.days, width);
  const out: DayContext[] = [];
  let x = x0;
  week.days.forEach((cfg, i) => {
    if (cfg.display === 'hidden') return;
    const date = dates[i] as string;
    const w = widths[i] as number;
    const columns = dayColumns(plan, week.id, cfg.weekday);
    const colWidths = columnWidths(columns, w);
    let cx = x;
    const geometry = columns.map((c, j): ColumnGeometry => {
      const cw = colWidths[j] as number;
      const g: ColumnGeometry = {
        columnId: c.id,
        kind: c.kind,
        x: cx,
        w: cw,
        lanes:
          c.kind === 'beso'
            ? [
                { x: cx, w: cw / 2 },
                { x: cx + cw / 2, w: cw / 2 },
              ]
            : [],
      };
      cx += cw;
      return g;
    });
    const units = columns.reduce((s, c) => s + columnWeight(c), 0);
    out.push({
      geo: {
        date,
        weekday: cfg.weekday,
        display: cfg.display,
        x,
        w,
        unitPt: units === 0 ? 0 : w / units,
        columns: geometry,
      },
      columns,
      entries: withEntries ? entriesOnDate(plan, date) : [],
    });
    x += w;
  });
  return out;
}

/**
 * Legt die Woche `input.weekId` in `input.frame`. Fachliche Zustände (Text passt nicht, dritter Querbalken,
 * fehlende Spalte) erscheinen in `fallbacks` bzw. `entries`, nie als Ausnahme.
 * @throws ModelError 'unknownWeek'; GridLayoutError 'invalidDisplayRange', 'gridFrameTooSmall';
 *   RangeError bei ungültigen `template.fontSizes` (Vertrag Abschnitt 2a Nr 1).
 */
export function layoutGrid(input: GridLayoutInput): GridLayout {
  const { plan, weekId, template, frame } = input;
  const week = requireWeek(plan, weekId);
  checkDisplayRange(plan.displayRange);
  checkFrame(frame);
  checkFontSizes(template.fontSizes);
  const x0 = frame.rect.x + frame.timeAxisWidthPt;
  const width = frame.rect.w - 2 * frame.timeAxisWidthPt;
  const yTop = frame.rect.y + frame.dayHeaderHeightPt + frame.columnHeaderHeightPt;
  const { from, to } = plan.displayRange;
  const timeScale: TimeScale = {
    fromMin: from,
    toMin: to,
    yTop,
    ptPerMinute: (frame.rect.y + frame.rect.h - yTop) / (to - from),
  };
  const band = {
    x: x0,
    y: yTop,
    w: width,
    h: BAND_MINUTES * timeScale.ptPerMinute,
  };
  const days = buildDays(plan, week, x0, width);
  const laid = layoutEntries(
    {
      plan,
      template,
      lines: frame.lines,
      scale: timeScale,
      v0: from + BAND_MINUTES,
      v1: to,
      days,
      ...(input.showStatus === true ? { showStatus: true } : {}),
      ...(input.changedEntryIds !== undefined && input.changedEntryIds.length > 0
        ? { changedEntryIds: new Set(input.changedEntryIds) }
        : {}),
    },
    weekId,
  );
  return {
    timeScale,
    band,
    days: days.map((d) => d.geo),
    items: laid.items,
    entries: laid.entries,
    fallbacks: laid.fallbacks,
  };
}

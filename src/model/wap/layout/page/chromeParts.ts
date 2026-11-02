// Gemeinsame Teile von Rasterkopf, Fortsetzungsseite und Seitenleiste: Stundenzeiten, Tagesgrenzen, Terminspalten,
// Tagesköpfe (Stundenzeiten auch für die Stundenregel der Seitenleiste, Vertrag E1-02k §2.2 Punkt 11; CR-E102k-01)
// (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt C4, E2, E3; R-10-13, R-10-14, R-4.4-14, R-4.8-02;
// F-10, V-02e-9, V-02e-13). Intern: nicht über page/index.ts exportiert. Rein (R-L-02).

import { formatDate } from '../../calendar';
import type { IsoDate, Weekday } from '../../types';
import type { DayGeometry, GridLayout } from '../grid';
import type { StyledRun } from '../text/types';
import {
  ascentPt,
  INSET,
  lineHeightPt,
  pageEvent,
  plainRuns,
  type RegionBuilder,
  textItem,
  width,
} from './common';
import { fitHead } from './fitHead';
import { pageLage } from './geometryKpLage';
import type { PageContext } from './types';

/** Das Band ist die erste Stunde des Anzeigebereichs (B-F-06, F-63 a); V0 = from + 60. */
const BAND_MINUTES = 60;

/**
 * Volle Stunden V0 ≤ t < to und Halbstunden from < t < to mit t ≡ 30 (mod 60) (E2, V05). Die vollen Stunden
 * bestimmen auch den Stil der Seitenleistenregeln (Vertrag E1-02k §2.2 Punkt 11).
 */
export function hourTimes(range: { readonly from: number; readonly to: number }): {
  readonly hours: readonly number[];
  readonly halves: readonly number[];
} {
  const v0 = range.from + BAND_MINUTES;
  const hours: number[] = [];
  for (let t = Math.ceil(v0 / 60) * 60; t < range.to; t += 60) hours.push(t);
  const halves: number[] = [];
  for (let t = Math.floor(range.from / 60) * 60 + 30; t < range.to; t += 60) {
    if (t > range.from) halves.push(t);
  }
  return { hours, halves };
}

const LANG: { readonly [W in Weekday]: string } = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

/** Linke Kante der Tagesfläche X0 und ihre Breite W (E1-02d 2a Nr 2). */
export function dayArea(ctx: PageContext): { readonly X0: number; readonly W: number } {
  const g = ctx.frame.grid;
  return { X0: g.rect.x + g.timeAxisWidthPt, W: g.rect.w - 2 * g.timeAxisWidthPt };
}

/**
 * Zusammengefasstes Wochenende im Terminbereich (E3, F-10, V-02e-13): bei 'combined' oder bei 'auto', wenn Sa und
 * So beide kompakt sind, und nur, wenn beide sichtbar sind.
 */
export function weekendCombined(ctx: PageContext): boolean {
  const sa = ctx.week.days[5];
  const so = ctx.week.days[6];
  if (sa.display === 'hidden' || so.display === 'hidden') return false;
  if (ctx.week.agendaWeekend === 'combined') return true;
  return ctx.week.agendaWeekend === 'auto' && sa.display === 'compact' && so.display === 'compact';
}

export interface AgendaColumn {
  readonly x: number;
  readonly w: number;
  readonly dates: readonly IsoDate[];
}

/** Terminspalten je sichtbarem Tag; Sa und So bei Zusammenfassung eine Spalte von Sa.x bis So.x + So.w. */
export function agendaColumns(ctx: PageContext, grid: GridLayout): AgendaColumn[] {
  const combined = weekendCombined(ctx);
  const out: AgendaColumn[] = [];
  for (const d of grid.days) {
    const last = out.at(-1);
    if (combined && d.weekday === 'So' && last !== undefined && last.dates.length === 1) {
      const sa = grid.days.find((x) => x.weekday === 'Sa');
      if (sa !== undefined && last.dates[0] === sa.date) {
        out[out.length - 1] = { x: last.x, w: d.x + d.w - last.x, dates: [sa.date, d.date] };
        continue;
      }
    }
    out.push({ x: d.x, w: d.w, dates: [d.date] });
  }
  return out;
}

export interface DayEdge {
  readonly x: number;
  /** Grenze zwischen zusammengefasstem Sa und So (endet am Raster bzw. an der Tageskopfzeile). */
  readonly weekendInner: boolean;
}

/** Tageskanten von links, auch links am ersten und rechts am letzten sichtbaren Tag (E2). */
export function dayEdges(ctx: PageContext, grid: GridLayout): DayEdge[] {
  const { X0, W } = dayArea(ctx);
  if (grid.days.length === 0) {
    return [
      { x: X0, weekendInner: false },
      { x: X0 + W, weekendInner: false },
    ];
  }
  const combined = weekendCombined(ctx);
  const edges: DayEdge[] = grid.days.map((d) => ({
    x: d.x,
    weekendInner: combined && d.weekday === 'So',
  }));
  const last = grid.days[grid.days.length - 1] as DayGeometry;
  edges.push({ x: last.x + last.w, weekendInner: false });
  return edges;
}

/** Halbe Breite der Tagesgrenze (Abstand der Texte zur Grenze zusätzlich zum Innenabstand). */
function borderHalf(ctx: PageContext): number {
  return ctx.geometry.lines.dayBorder.widthPt / 2;
}

/**
 * Tagesköpfe (E2, R-10-13, R-10-14): voller Tag «Wochentag» und Datum dd.mm.yyyy (B-Kp-28), kompakter Tag
 * «‹Mo…So› ‹dd.mm.yy›» zentriert (B-Kp-29). Passt ein Kopf nicht, gilt V-02e-9; die Kurzform ist keine Stufe.
 * Ereignisse nur mit `events` (Wochenseite).
 */
export function dayHeads(
  ctx: PageContext,
  grid: GridLayout,
  b: RegionBuilder,
  events: boolean,
): void {
  const lage = pageLage(ctx.geometry);
  const S = ctx.template.fontSizes.standard;
  const min = ctx.template.fontSizes.min;
  const color = ctx.geometry.colors.text;
  const yK = ctx.frame.grid.rect.y;
  const rowH = ctx.frame.grid.dayHeaderHeightPt;
  const baseline = yK + lage.dayBaselineShare * rowH;
  const bh = borderHalf(ctx);

  // Textfläche (S3-23 d): Tageskopfzeile zwischen Kopf-Unterlinie und Tageskopf-Unterlinie, je um den halben
  // Strich und textInsetPt verkleinert; ihre Höhe ist die Querabmessung (S3-22 b). Grundlinie nach B-Kp-28, bei
  // Bedarf in die Fläche geklemmt (S3-23 e).
  const cellTop = yK + ctx.geometry.pageLines.headerBottom.widthPt / 2 + INSET;
  const cellH = yK + rowH - ctx.geometry.pageLines.dayHeadBottom.widthPt / 2 - INSET - cellTop;
  const place = (
    runs: readonly StyledRun[],
    frameX: number,
    frameW: number,
    align: 'left' | 'center',
    day: DayGeometry,
  ): void => {
    const r = fitHead(runs, frameW, cellH, S, min);
    if (events && (r.result === 'ellipsis' || r.result === 'omitted')) {
      b.event(
        pageEvent(
          r.result === 'ellipsis' ? 'ellipsis' : 'textOmitted',
          'gridHead',
          ctx.week.id,
          'dayHead',
          {
            date: day.date,
          },
        ),
      );
    }
    const w = width(r.runs, r.sizePt);
    const x = align === 'left' ? frameX : frameX + (frameW - w) / 2;
    // Grundlinie nach B-Kp-28, so verschoben, dass der Zeilenkasten in der Zelle bleibt.
    const asc = ascentPt(r.sizePt);
    const y = Math.min(
      Math.max(baseline, cellTop + asc),
      cellTop + cellH - lineHeightPt(r.sizePt) + asc,
    );
    b.text(
      textItem({
        role: 'dayHeader',
        x,
        baselineY: y,
        sizePt: r.sizePt,
        runs: r.runs,
        color,
        frame: { x: frameX, y: cellTop, w: Math.max(frameW, 0), h: Math.max(cellH, 0) },
      }),
      'dayHead',
      S,
      day.date,
    );
  };

  for (const day of grid.days) {
    const right = day.x + day.w - bh - INSET;
    if (day.display === 'compact') {
      const runs = plainRuns(`${day.weekday} ${formatDate(day.date, 'compact')}`, 'bold');
      const left = day.x + bh + INSET;
      place(runs, left, right - left, 'center', day);
      continue;
    }
    const name = plainRuns(LANG[day.weekday], 'bold');
    const date = plainRuns(formatDate(day.date, 'long'), 'bold');
    const left = day.x + lage.dayNameX;
    const nameW = width(name, S);
    const dateW = width(date, S);
    if (left + nameW + lage.dayGap + dateW <= right) {
      // B-Kp-28: Datum bei Tag links + 5,1 u; weicht nur aus, wenn es den Wochentag berühren oder rechts
      // über den Tag hinausreichen würde.
      const dateX = Math.min(
        Math.max(day.x + lage.dayDateU * day.unitPt, left + nameW + lage.dayGap),
        right - dateW,
      );
      place(name, left, dateX - lage.dayGap - left, 'left', day);
      place(date, dateX, right - dateX, 'left', day);
      continue;
    }
    // Platzmangel: Breite im Verhältnis der Standardbreiten teilen; jeder Text in seinem Teil (V-02e-9).
    const avail = right - left - lage.dayGap;
    const nameFrame = avail > 0 ? (avail * nameW) / (nameW + dateW) : 0;
    const dateFrame = avail > 0 ? avail - nameFrame : 0;
    place(name, left, nameFrame, 'left', day);
    place(date, left + nameFrame + lage.dayGap, dateFrame, 'left', day);
  }
}

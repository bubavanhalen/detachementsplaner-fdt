// Rasterlinien, Tages- und Spaltenköpfe, Zeitachsen (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2»
// Abschnitt E2, D; R-4.4-02, -08, R-4.5-03 bis -06, R-10-13 bis -15; B-Kp-28 bis -48). Rein (R-L-02).

import { dayColumns, requireWeek } from '../../derive/columns';
import { formatMilTime } from '../../time';
import type { Id, Weekday } from '../../types';
import { textBounds } from '../entries/outsideLabel';
import { inset, overlaps } from '../entries/rects';
import { type GridLayout, timeToY } from '../grid';
import type { LineItem, PageItem, Rect, Stroke } from '../pageModel';
import type { StyledRun } from '../text/types';
import { dayArea, dayEdges, dayHeads, hourTimes } from './chromeParts';
import { headBounds, layoutColumnHeads } from './columnHeads';
import {
  ascentPt,
  INSET,
  lineHeightPt,
  lineItem,
  pageEvent,
  plainRuns,
  RegionBuilder,
  rectItem,
  textItem,
  width,
} from './common';
import { pageLage } from './geometryKpLage';
import { borderLeftOf, dayHeadSetup } from './headInputs';
import { fitSingleLine } from './texts';
import type { PageContext, RegionLayout } from './types';

const WHITE = { r: 255, g: 255, b: 255 } as const;
/**
 * E1-02l R1: Reicht der Kopfbereich auch umbrochen nicht, darf ein Kopf so weit unter das Band ragen, wie dort Platz
 * frei ist (weisser Träger, Befund «zu viele Spalten für diesen Tag» bleibt).
 */
const OVERFLOW_REACH_PT = 60;

/** Spaltensatz des Tages (Befund «zu viele Spalten für diesen Tag», E1-02l R1). */
function dayColumnSetId(plan: PageContext['plan'], weekId: Id, weekday: Weekday): Id | null {
  return requireWeek(plan, weekId).days.find((d) => d.weekday === weekday)?.columnSetId ?? null;
}

/** Umrisse der Einträge (Flächen, Linien, Texte), die `region` schneiden. */
function occupied(items: readonly PageItem[], region: Rect): Rect[] {
  const out: Rect[] = [];
  for (const it of items) {
    const r =
      it.kind === 'text'
        ? textBounds(it)
        : it.kind === 'rect' || it.kind === 'image'
          ? it.rect
          : it.kind === 'line'
            ? {
                x: Math.min(it.x1, it.x2) - it.stroke.widthPt / 2,
                y: Math.min(it.y1, it.y2) - it.stroke.widthPt / 2,
                w: Math.abs(it.x2 - it.x1) + it.stroke.widthPt,
                h: Math.abs(it.y2 - it.y1) + it.stroke.widthPt,
              }
            : null;
    if (r !== null && overlaps(r, region)) out.push(r);
  }
  return out;
}

/** Linien und Kopftexte des Rasters der Wochenseite aus GridLayout.days, timeScale und band. */
export function layoutGridChrome(ctx: PageContext, grid: GridLayout): RegionLayout {
  const { plan, week, template, geometry: g, frame: pf } = ctx;
  const lage = pageLage(g);
  const b = new RegionBuilder();
  const S = template.fontSizes.standard;
  const min = template.fontSizes.min;
  const color = g.colors.text;
  const { X0, W } = dayArea(ctx);
  const fx = pf.frame.x;
  const xS = pf.standCell.x;
  const a = pf.grid.timeAxisWidthPt;
  const yK = pf.grid.rect.y;
  const yHead = yK + pf.grid.dayHeaderHeightPt;
  const yFrom = grid.timeScale.yTop;
  const yTo = pf.grid.rect.y + pf.grid.rect.h;
  const yT = pf.agenda.y;
  const yU = pf.frame.y + pf.frame.h;
  const line = (x1: number, y1: number, x2: number, y2: number, s: Stroke): LineItem =>
    lineItem('gridLine', x1, y1, x2, y2, s);

  // 1. Halbstunden- und Stundenlinien von oben (R-4.5-04, R-4.5-05; keine anderen im Zeitbereich, R-4.5-06).
  const { hours, halves } = hourTimes(plan.displayRange);
  for (const t of halves) {
    const y = timeToY(grid.timeScale, t);
    b.shape(line(X0, y, X0 + W, y, g.lines.halfHour));
  }
  for (const t of hours) {
    const y = timeToY(grid.timeScale, t);
    b.shape(line(X0, y, X0 + W, y, g.lines.hour));
  }
  // 2. Spalten- und Bahngrenzen Tag für Tag von links (B-Kp-39 bis -41).
  for (const day of grid.days) {
    const borders: { x: number; item: LineItem }[] = [];
    day.columns.forEach((col, j) => {
      if (j > 0) {
        borders.push({
          x: col.x,
          item: line(col.x, yHead, col.x, yTo, borderLeftOf(g.lines, day.columns, j)),
        });
      }
      const lane = col.lanes[1];
      if (col.kind === 'beso' && lane !== undefined) {
        borders.push({ x: lane.x, item: line(lane.x, yFrom, lane.x, yTo, g.lines.laneBorder) });
      }
    });
    borders.sort((p, q) => p.x - q.x);
    for (const x of borders) b.shape(x.item);
  }
  // 3. Tageskopf-Unterlinie, Rasterbegrenzung oben und unten, Seitenleistenlinie.
  b.shape(line(X0, yHead, X0 + W, yHead, g.pageLines.dayHeadBottom));
  b.shape(line(fx, yFrom, xS, yFrom, g.lines.gridEdge));
  b.shape(line(fx, yTo, xS, yTo, g.lines.gridEdge));
  b.shape(line(xS, yK, xS, yTo, g.pageLines.sidebarEdge)); // ab der Kopf-Unterlinie (B-Kp-119)
  // 4. Tagesgrenzen von yK bis yU; zwischen zusammengefasstem Sa und So nur bis y(to) (V-02e-13).
  for (const e of dayEdges(ctx, grid)) {
    b.shape(line(e.x, yK, e.x, e.weekendInner ? yTo : yU, g.lines.dayBorder));
  }
  // 5. Termine-Oberlinie (bis zur rechten Zeitachse, B-Kp-13, -85) und «Was»-Linie (B-Kp-87).
  b.shape(line(fx, yT, xS - a, yT, g.pageLines.agendaTop));
  const yWas = yT + g.heightsH.agendaHead * pf.h;
  b.shape(line(X0, yWas, X0 + W, yWas, g.pageLines.agendaHeadBottom));

  // Texte: «Zeit», Stundenbeschriftung links und rechts, Tagesköpfe, Spaltenköpfe.
  const axes: readonly { readonly x: number; readonly w: number }[] = [
    { x: fx, w: a },
    { x: xS - a, w: a },
  ];
  const axisInset = g.lines.dayBorder.widthPt / 2 + INSET;
  const axisText = (
    text: string,
    axis: { readonly x: number; readonly w: number },
    baseline: number,
    kind: 'axisHead' | 'hour',
  ): void => {
    const fw = axis.w - 2 * axisInset;
    const runs = plainRuns(text, 'bold');
    let sizePt = S;
    let out: readonly StyledRun[] = [];
    if (fw > 0) {
      const r = fitSingleLine(runs, fw, { standard: S, min });
      out = r.runs;
      sizePt = r.sizePt;
      if (r.result === 'ellipsis' || r.result === 'omitted') {
        b.event(
          pageEvent(
            r.result === 'ellipsis' ? 'ellipsis' : 'textOmitted',
            'gridHead',
            week.id,
            kind,
          ),
        );
      }
    } else {
      b.event(pageEvent('textOmitted', 'gridHead', week.id, kind));
    }
    const w = width(out, sizePt);
    b.text(
      textItem({
        role: 'timeAxis',
        x: axis.x + (axis.w - w) / 2,
        baselineY: baseline,
        sizePt,
        runs: out,
        color,
        frame: {
          x: axis.x + axisInset,
          y: baseline - ascentPt(sizePt),
          w: Math.max(fw, 0),
          h: lineHeightPt(sizePt),
        },
      }),
      kind,
      S,
      null,
    );
  };
  const headBaseline = yK + lage.dayBaselineShare * pf.grid.dayHeaderHeightPt;
  for (const axis of axes) axisText('Zeit', axis, headBaseline, 'axisHead');
  for (const axis of axes) {
    for (const t of hours) axisText(formatMilTime(t), axis, timeToY(grid.timeScale, t), 'hour');
  }

  dayHeads(ctx, grid, b, true);

  // Spaltenköpfe (E2; E1-02l R1, R-10-54): Nutzbreite = Spaltenbreite − 2·textInsetPt − (linker + rechter
  // Grenzstrich)/2. Nie gekürzt: waagrecht bis 4,5 pt, dann senkrecht (Entscheid «2 a»), sonst vollständig im Kopfbereich mit Befund
  // «zu viele Spalten für diesen Tag» am Spaltensatz des Tages.
  for (const day of grid.days) {
    const { inputs, area } = dayHeadSetup(
      g.lines,
      g.pageLines.dayHeadBottom,
      template.fontSizes,
      day,
      dayColumns(plan, week.id, day.weekday),
      yHead,
      yFrom,
    );
    // Reicht der Kopfbereich nicht, darf ein Kopf in das Band darunter ragen, soweit es frei ist (E1-02l R1).
    // Höchstens bis OVERFLOW_REACH_PT unter das Band, nie unter die Rasterbegrenzung unten.
    const reach = Math.min(grid.band.y + grid.band.h + OVERFLOW_REACH_PT, yTo) - INSET;
    const extended: Rect = { ...area, h: reach - area.y };
    const heads = layoutColumnHeads(
      inputs,
      { area, extended, blocked: occupied(grid.items, extended) },
      { standard: S, min },
    );
    const overflow = heads.find((h) => h.result === 'overflow');
    if (overflow !== undefined) {
      b.event({
        ...pageEvent('tooManyColumns', 'gridHead', week.id, 'columnHead', {
          date: day.date,
          columnId: overflow.columnId,
        }),
        columnSetId: dayColumnSetId(plan, week.id, day.weekday),
      });
    }
    for (const h of heads) {
      // Ein Kopf, der über seine Spalte hinausragt (ins Band oder im Kopfbereich daneben), erhält einen weissen Träger,
      // damit keine Rasterlinie durch ihn läuft (R-14.3-02 H8 a; F-LAYOUT2 Runde 2, VQA-2-06).
      const bounds = h.result === 'overflow' ? headBounds(h.lines) : null;
      if (bounds !== null) {
        b.shape(rectItem('columnHeader', inset(bounds, -INSET), WHITE, null));
      }
      for (const l of h.lines) {
        b.text(
          textItem({
            role: 'columnHeader',
            x: l.x,
            baselineY: l.baselineY,
            rotation: l.rotation,
            sizePt: l.sizePt,
            runs: l.runs,
            color,
            frame: h.frame,
          }),
          'columnHead',
          S,
          day.date,
        );
      }
    }
  }
  return b.build();
}

// Terminbereich: Spalten, Einheiten, Verkleinern, Fortsetzung und Kürzung (Vertrag E1-02e, Notiz «Ausarbeitung
// Schritt 2» Abschnitt C4, E3, E6, F; V-02e-3, V-02e-18, V01; S3-8 b, S3-13). Intern: nicht über page/index.ts
// exportiert. Rein (R-L-02).

import { agendaLinesForDate } from '../../derive/agenda';
import type { Id, IsoDate, Plan } from '../../types';
import { markChangedRuns, styleAgendaRuns } from '../entries/status';
import type { GridLayout } from '../grid';
import type { Rect } from '../pageModel';
import type { StyledRun } from '../text/types';
import { type AgendaColumn, agendaColumns, dayArea } from './chromeParts';
import {
  ascentPt,
  breakParagraph,
  FIT_EPS,
  INSET,
  lineHeightPt,
  pageEvent,
  paragraphRuns,
  plainRuns,
  RegionBuilder,
  runsFrom,
  runsUntilBreak,
  sizeSteps,
  textItem,
  truncateLine,
  width,
} from './common';
import { fitHead, type HeadResult } from './fitHead';
import { pageLage } from './geometryKpLage';
import type {
  PageContext,
  PageFallbackEvent,
  PageFrame,
  PageGeometry,
  RegionLayout,
} from './types';

/** Eine Terminzeile (Einheit, E3). Auch für den Terminbereich am Bildschirm (agendaScreen, CR-H-U-04). */
export interface Unit {
  readonly entryId: Id;
  readonly date: IsoDate;
  readonly runs: readonly StyledRun[];
  /** Hängender Einzug nur bei Beso-Zeilen (R-4.8-07): Text «‹Nr› » im Schnitt des ersten Laufs. */
  readonly indentRuns: readonly StyledRun[] | null;
}

/** Gesetzte Zeilen einer Einheit. */
export interface LaidUnit {
  readonly unit: Unit;
  readonly lines: readonly (readonly StyledRun[])[];
  readonly indent: number;
}

interface ColumnPage {
  readonly sizePt: number;
  readonly laid: readonly LaidUnit[];
}

/** Lage der Terminzeilen einer Seite: Oberkante der Textfläche und Höhe (S3-8 b). */
function textArea(
  ctx: PageContext,
  page: number,
): { readonly top: number; readonly bottom: number } {
  return agendaTextArea(ctx.geometry, ctx.frame, page);
}

/** Textfläche der Termine einer Seite aus Geometrie und Rahmen (auch für den Bildschirm, CR-H-U-04). */
export function agendaTextArea(
  g: PageGeometry,
  pf: PageFrame,
  page: number,
): { readonly top: number; readonly bottom: number } {
  const yWas =
    page === 0
      ? pf.agenda.y + g.heightsH.agendaHead * pf.h
      : pf.grid.rect.y + (g.heightsH.dayHeader + g.heightsH.agendaHead) * pf.h;
  return {
    top: yWas + g.pageLines.agendaHeadBottom.widthPt / 2 + INSET,
    bottom: pf.frame.y + pf.frame.h - INSET,
  };
}

function unitsOf(ctx: PageContext, dates: readonly IsoDate[]): Unit[] {
  return agendaUnits(ctx.plan, dates);
}

/** Einheiten der Terminzeilen der Tage `dates` in Tages- und Zeilenreihenfolge. */
export function agendaUnits(plan: Plan, dates: readonly IsoDate[]): Unit[] {
  const out: Unit[] = [];
  for (const date of dates) {
    for (const l of agendaLinesForDate(plan, date)) {
      const runs = paragraphRuns(
        l.text.map((r) => ({
          text: r.text,
          weight: r.bold ? ('bold' as const) : ('regular' as const),
        })),
      );
      const isBeso = plan.entries[l.entryId]?.type === 'beso';
      const nr = l.number === null ? '–' : String(l.number);
      out.push({
        entryId: l.entryId,
        date,
        runs,
        indentRuns: isBeso ? [{ text: `${nr} `, weight: runs[0]?.weight ?? 'regular' }] : null,
      });
    }
  }
  return out;
}

export function layUnit(u: Unit, w: number, sizePt: number): LaidUnit {
  const indent = u.indentRuns === null ? 0 : width(u.indentRuns, sizePt);
  const wR = w - indent > 0.01 ? w - indent : w;
  const p = breakParagraph(u.runs, w, wR, sizePt);
  return { unit: u, lines: p.lines.map((l) => l.runs), indent: wR === w ? 0 : indent };
}

export function height(laid: readonly LaidUnit[], sizePt: number): number {
  return laid.reduce((s, l) => s + l.lines.length, 0) * lineHeightPt(sizePt);
}

/**
 * Längster Anfang einer Einheit, der in die Höhe passt: ganze Zeilen bis zur letzten passenden, diese gekürzt mit
 * «…» in Mindestgrösse (E3 Nr 4); null, wenn nicht einmal eine Zeile passt.
 */
function truncateUnit(u: Unit, w: number, avail: number, min: number): LaidUnit | null {
  const m = Math.floor((avail + FIT_EPS) / lineHeightPt(min));
  if (m <= 0) return null;
  const indent = u.indentRuns === null ? 0 : width(u.indentRuns, min);
  const wR = w - indent > 0.01 ? w - indent : w;
  const p = breakParagraph(u.runs, w, wR, min);
  const keep = p.lines.slice(0, m - 1).map((l) => l.runs);
  const start = p.starts[m - 1] ?? 0;
  const lastW = m === 1 ? w : wR;
  const cut = truncateLine(runsUntilBreak(runsFrom(u.runs, start)), lastW, min);
  return { unit: u, lines: cut === null ? keep : [...keep, cut], indent: wR === w ? 0 : indent };
}

export interface AgendaFlow {
  /** Je Seite und Spalte die gesetzten Einheiten. */
  readonly pages: readonly (readonly ColumnPage[])[];
  readonly columns: readonly AgendaColumn[];
  /** Ereignisse in Spaltenreihenfolge, je Spalte continuationPage vor ellipsis (F). */
  readonly columnEvents: readonly (readonly PageFallbackEvent[])[];
}

/**
 * Platzmangel (V-02e-3, V-02e-18): alle Zeilen einer Spalte in 0,25-pt-Schritten bis zur Mindestgrösse
 * verkleinern; dann ganze Einheiten vom Ende auf die nächste Fortsetzungsseite. Auf Fortsetzungsseiten gilt
 * dasselbe; eine Einheit, die dort am Spaltenanfang nicht passt, wird nach ihrer letzten passenden Zeile mit «…»
 * gekürzt. Jede Fortsetzungsseite nimmt so je übervolle Spalte mindestens eine Einheit auf (V01).
 */
export function agendaFlow(ctx: PageContext, grid: GridLayout): AgendaFlow {
  const lage = pageLage(ctx.geometry);
  const S = ctx.template.fontSizes.standard;
  const min = ctx.template.fontSizes.min;
  const columns = agendaColumns(ctx, grid);
  const pages: ColumnPage[][] = [];
  const columnEvents: PageFallbackEvent[][] = [];
  columns.forEach((col, ci) => {
    const w = col.w - 2 * lage.agendaX;
    let rest = unitsOf(ctx, col.dates);
    const colEvents: PageFallbackEvent[] = [];
    const ellipses: PageFallbackEvent[] = [];
    for (let page = 0; page === 0 || rest.length > 0; page++) {
      const area = textArea(ctx, page);
      const avail = area.bottom - area.top;
      let placed: ColumnPage | null = null;
      let next: Unit[] = [];
      for (const size of sizeSteps(S, min)) {
        const laid = rest.map((u) => layUnit(u, w, size));
        if (height(laid, size) <= avail + FIT_EPS) {
          placed = { sizePt: size, laid };
          break;
        }
      }
      if (placed === null) {
        const laid = rest.map((u) => layUnit(u, w, min));
        let used = 0;
        let n = 0;
        while (n < laid.length) {
          const hgt = height([laid[n] as LaidUnit], min);
          if (used + hgt > avail + FIT_EPS) break;
          used += hgt;
          n++;
        }
        if (n === 0 && page > 0) {
          const first = rest[0] as Unit;
          const cut = truncateUnit(first, w, avail, min);
          ellipses.push(
            pageEvent(
              cut === null ? 'textOmitted' : 'ellipsis',
              'agenda',
              ctx.week.id,
              'agendaLine',
              {
                date: first.date,
                entryId: first.entryId,
              },
            ),
          );
          placed = { sizePt: min, laid: cut === null ? [] : [cut] };
          next = rest.slice(1);
        } else {
          placed = { sizePt: min, laid: laid.slice(0, n) };
          next = rest.slice(n);
          if (page === 0 && next.length > 0) {
            colEvents.push(
              pageEvent('continuationPage', 'agenda', ctx.week.id, 'agendaLine', {
                date: col.dates[0] ?? null,
                entryId: (next[0] as Unit).entryId,
              }),
            );
          }
        }
      }
      while (pages.length <= page) pages.push(columns.map(() => ({ sizePt: S, laid: [] })));
      (pages[page] as ColumnPage[])[ci] = placed;
      rest = next;
    }
    columnEvents.push([...colEvents, ...ellipses]);
  });
  if (pages.length === 0) pages.push(columns.map(() => ({ sizePt: S, laid: [] })));
  return { pages, columns, columnEvents };
}

/**
 * Termine einer Seite (D Schritt 5, Rolle agenda): «Termine» senkrecht in der linken Zeitachse, «Was» je Spalte,
 * Terminzeilen. `page` 0 = Wochenseite (Bereich yT … yU), sonst Fortsetzungsseite (yK … yU, C4). Zeichen- und
 * Ereignisfolge je Terminspalte (S3-23 b): «Termine», dann je Spalte ihr «Was» und ihre Terminzeilen. Ereignisse
 * nur mit `firstPage` (S3-22 a, b). Textflächen nach S3-23 (d): Zelle zwischen den Strichmitten, je Seite um den
 * halben Strich der dortigen Linie und textInsetPt verkleinert.
 */
export function agendaPart(
  ctx: PageContext,
  flow: AgendaFlow,
  page: number,
  firstPage: boolean,
): RegionLayout {
  const { template, geometry: g, frame: pf } = ctx;
  const lage = pageLage(g);
  const b = new RegionBuilder();
  const S = template.fontSizes.standard;
  const min = template.fontSizes.min;
  const color = g.colors.text;
  const { X0 } = dayArea(ctx);
  const fx = pf.frame.x;
  const top = page === 0 ? pf.agenda.y : pf.grid.rect.y;
  const yU = pf.frame.y + pf.frame.h;
  // Linie über dem Bereich: Termine-Oberlinie (Wochenseite) bzw. Kopf-Unterlinie (Fortsetzungsseite).
  const lineAboveArea = page === 0 ? g.pageLines.agendaTop : g.pageLines.headerBottom;
  const reportHead = (
    r: HeadResult,
    field: 'agendaLabel' | 'agendaHead',
    date: string | null,
  ): void => {
    if (!firstPage || (r.result !== 'ellipsis' && r.result !== 'omitted')) return;
    b.event(
      pageEvent(
        r.result === 'ellipsis' ? 'ellipsis' : 'textOmitted',
        'agenda',
        ctx.week.id,
        field,
        {
          date,
        },
      ),
    );
  };

  // «Termine» (B-Kp-86; R-4.8-03, R-4.9-11): fett, rotation 90, in der linken Zeitachse und im Bereich zentriert.
  // Zelle: Zeitachse zwischen Rahmenlinie und erster Tagesgrenze, oben die Linie über dem Bereich, unten die
  // Rahmenlinie; Querabmessung = Breite der Textfläche (S3-22 b, S3-23 d).
  const labelTop = top + lineAboveArea.widthPt / 2 + INSET;
  const labelX = fx + g.frameStroke.widthPt / 2 + INSET;
  const label: Rect = {
    x: labelX,
    y: labelTop,
    w: X0 - g.lines.dayBorder.widthPt / 2 - INSET - labelX,
    h: yU - g.frameStroke.widthPt / 2 - INSET - labelTop,
  };
  const lr = fitHead(plainRuns(template.agendaHeading, 'bold'), label.h, label.w, S, min);
  reportHead(lr, 'agendaLabel', null);
  const llh = lineHeightPt(lr.sizePt);
  b.text(
    textItem({
      role: 'agenda',
      x: label.x + (label.w - llh) / 2 + ascentPt(lr.sizePt),
      baselineY: label.y + (label.h + width(lr.runs, lr.sizePt)) / 2,
      rotation: 90,
      sizePt: lr.sizePt,
      runs: lr.runs,
      color,
      frame: label,
    }),
    'agendaLabel',
    S,
    null,
  );

  // «Was» je Terminspalte (B-Kp-87): frame = Kopfzelle, verkleinert um halben Grenzstrich + textInsetPt (S3-22 b).
  const headTop = page === 0 ? pf.agenda.y : pf.grid.rect.y + g.heightsH.dayHeader * pf.h;
  const lineAboveHead = page === 0 ? g.pageLines.agendaTop : g.pageLines.dayHeadBottom;
  const headH = g.heightsH.agendaHead * pf.h;
  const border = g.lines.dayBorder.widthPt / 2 + INSET;
  const cellY = headTop + lineAboveHead.widthPt / 2 + INSET;
  const cellH = headTop + headH - g.pageLines.agendaHeadBottom.widthPt / 2 - INSET - cellY;
  const area = textArea(ctx, page);
  const colPages = flow.pages[page] ?? [];
  flow.columns.forEach((col, ci) => {
    const cellX = col.x + border;
    const cellW = col.w - 2 * border;
    const x = col.x + lage.wasX;
    const date = col.dates[0] ?? null;
    const wr = fitHead(plainRuns('Was', 'bold'), cellX + cellW - x, cellH, S, min);
    reportHead(wr, 'agendaHead', date);
    const wlh = lineHeightPt(wr.sizePt);
    b.text(
      textItem({
        role: 'agenda',
        x,
        baselineY: cellY + (cellH - wlh) / 2 + ascentPt(wr.sizePt),
        sizePt: wr.sizePt,
        runs: wr.runs,
        color,
        frame: { x: cellX, y: cellY, w: Math.max(cellW, 0), h: Math.max(cellH, 0) },
      }),
      'agendaHead',
      S,
      date,
    );
    if (firstPage) for (const e of flow.columnEvents[ci] ?? []) b.event(e);

    // Terminzeilen (E3): erste Grundlinie = «Was»-Linie + halbe Strichbreite + textInsetPt + ascentPt.
    const cp = colPages[ci];
    if (cp === undefined) return;
    const frame: Rect = {
      x: col.x + lage.agendaX,
      y: area.top,
      w: col.w - 2 * lage.agendaX,
      h: area.bottom - area.top,
    };
    const lh = lineHeightPt(cp.sizePt);
    let y = area.top;
    for (const lu of cp.laid) {
      lu.lines.forEach((runs, i) => {
        const item = textItem({
          role: 'agenda',
          entryId: lu.unit.entryId,
          x: frame.x + (i === 0 ? 0 : lu.indent),
          baselineY: y + ascentPt(cp.sizePt),
          sizePt: cp.sizePt,
          runs,
          color,
          frame,
        });
        // Status der Terminzeile (Beschrieb 10; R-10-27 bis R-10-29), pro PDF abschaltbar (R-10-31).
        b.text(
          {
            ...item,
            runs: markChangedRuns(
              styleAgendaRuns(item.runs, ctx.plan.entries[lu.unit.entryId], ctx.options.showStatus),
              ctx.options.changedEntryIds?.includes(lu.unit.entryId) === true,
            ),
          },
          'agendaLine',
          S,
          lu.unit.date,
        );
        y += lh;
      });
    }
  });
  return b.build();
}

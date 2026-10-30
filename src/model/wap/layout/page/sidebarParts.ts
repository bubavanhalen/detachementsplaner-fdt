// Seitenleiste: Abschnitte, Verkleinern, Fortsetzung, Kürzung und unterer Teil (Vertrag E1-02e, Notiz
// «Ausarbeitung Schritt 2» Abschnitt E4, E6, F; V-02e-3, -4, -7, -8, -12, -14, -15, -18, V30; Änderungsnotiz Tests
// Schritt 3 S3-2, S3-7, S3-8 e, S3-12, S3-13, S3-17). Linienführung und Bedeutungsspalte nach Vertrag E1-02k §2
// und §4 (Gate S A4; R-10-51 bis R-10-53). Intern: nicht über page/index.ts exportiert. Rein (R-L-02).

import { abbreviationMeaning, abbreviationsForWeek } from '../../derive/abbreviations';
import { remarksForWeek } from '../../derive/remarks';
import { formatMilTime } from '../../time';
import type { Id, LtgCategory } from '../../types';
import { type TimeScale, timeToY } from '../grid';
import type { ItemRole, Rect, Stroke } from '../pageModel';
import type { StyledRun } from '../text/types';
import { hourTimes } from './chromeParts';
import { type CoatOfArms, readCoatOfArms } from './coatOfArms';
import {
  ascentPt,
  breakParagraph,
  FIT_EPS,
  INSET,
  lineHeightPt,
  lineItem,
  pageEvent,
  paragraphRuns,
  plainRuns,
  RegionBuilder,
  rectItem,
  runsFrom,
  runsUntilBreak,
  sizeSteps,
  textItem,
  truncateLine,
  width,
} from './common';
import { fitHead } from './fitHead';
import { pageLage } from './geometryKpLage';
import { moonPath, sunPath } from './sunSymbols';
import type { PageContext, PageFallbackEvent, PageTextKind, RegionLayout } from './types';

type Field = 'goal' | 'readiness' | 'remark' | 'abbreviation' | 'legendLabel';

/** Titelzeile des Bereitschaftskastens (B-Kp-75, Referenz; H-LAYOUT, Zusatzbefund visual-qa (e)). */
const READINESS_TITLE: readonly StyledRun[] = [{ text: 'Erhöhte Bereitschaft:', weight: 'bold' }];
const WHITE = { r: 255, g: 255, b: 255 } as const;

/**
 * Rang in der Reihenfolge B-Kp-72 (F «Seitenleiste»): Wochenziele, Bereitschaft, Bemerkungen, Kürzelliste,
 * Legende; darunter Unterschriftblock, Motto, Sonnenzeiten.
 */
const RANG = {
  goal: 0,
  readiness: 1,
  remark: 2,
  abbreviation: 3,
  remarkNumber: 2.5,
  legendLabel: 4,
  signature: 5,
  motto: 6,
  sunTime: 7,
} as const;

/** Ereignisse der Seitenleiste mit Rang; sortiert nach Rang, je Rang continuationPage zuerst. */
class EventSink {
  private readonly list: { readonly rank: number; readonly e: PageFallbackEvent }[] = [];

  add(e: PageFallbackEvent, rank: number): void {
    this.list.push({ rank, e });
  }

  sorted(): PageFallbackEvent[] {
    const cp = (e: PageFallbackEvent): number => (e.kind === 'continuationPage' ? 0 : 1);
    return [...this.list].sort((p, q) => p.rank - q.rank || cp(p.e) - cp(q.e)).map((x) => x.e);
  }
}

interface Goal {
  readonly id: Id;
  readonly runs: readonly StyledRun[];
  /** Gekürzte Zeilen (V-02e-18), sonst null. */
  readonly cut: readonly (readonly StyledRun[])[] | null;
}

interface Remark {
  readonly id: Id;
  readonly number: number | null;
  readonly runs: readonly StyledRun[];
  readonly cut: readonly (readonly StyledRun[])[] | null;
}

interface Readiness {
  readonly runs: readonly StyledRun[];
  readonly cut: readonly (readonly StyledRun[])[] | null;
  /** Kastenhöhe bei gekürztem Text (höchstens der Seitenleistenteil), sonst null. */
  readonly boxH: number | null;
}

/** Einheiten der Seitenleiste in der Reihenfolge B-Kp-72. */
interface Content {
  readonly goals: readonly Goal[];
  readonly readiness: readonly Readiness[];
  readonly remarks: readonly Remark[];
  readonly abbr: readonly string[];
  readonly legend: readonly LtgCategory[];
}

function count(c: Content): number {
  return c.goals.length + c.readiness.length + c.remarks.length + c.abbr.length + c.legend.length;
}

/** Masse der Seitenleiste (C2, C3, S3-2). */
interface Metrics {
  readonly xS: number;
  readonly right: number;
  /** Rechter Rand der Textflächen: Rahmen rechts − ½ Rahmenstrich − textInsetPt (S3-2). */
  readonly textRight: number;
  readonly a: number;
  readonly h: number;
  readonly S: number;
  readonly min: number;
  readonly rowH: number;
  readonly gap: number;
  readonly sink: EventSink;
  /** y der vollen Stunden des Rasters der Wochenseite (Stundenregel, Vertrag E1-02k §2.2 Punkt 11). */
  readonly hourYs: readonly number[];
}

/** Toleranz «Regel liegt auf einer Stundenlinie» (Vertrag E1-02k §2.2 Punkt 11). */
const HOUR_EPS = 0.01;

/**
 * Textfläche zwischen zwei waagrechten Linien auf `y1` und `y2` mit den Strichbreiten `w1` und `w2`: je Seite um
 * die halbe Strichbreite und textInsetPt verkleinert (S3-23 d; Vertrag E1-02k §2.0 «zwischen»).
 */
function between(
  y1: number,
  w1: number,
  y2: number,
  w2: number,
): { readonly top: number; readonly h: number } {
  const top = y1 + w1 / 2 + INSET;
  return { top, h: y2 - w2 / 2 - INSET - top };
}

/**
 * Waagrechte Regel der Seitenleiste von `x1` (Standard xS) bis zum Rahmen rechts. Auf der Wochenseite liegt eine
 * Regel auf einer vollen Stunde des Rasters im Stil der Stundenlinie (Vertrag E1-02k §2.2 Punkt 11); das gilt für
 * die Striche T, E, `dayHeadBottom` und `agendaTop`, die feinen Regeln F zeichnet `fineRule`.
 */
function rule(
  ctx: PageContext,
  m: Metrics,
  b: RegionBuilder,
  y: number,
  stroke: Stroke,
  week: boolean,
  x1: number = m.xS,
): void {
  const onHour = week && m.hourYs.some((yh) => Math.abs(yh - y) <= HOUR_EPS);
  b.shape(lineItem('sidebar', x1, y, m.right, y, onHour ? ctx.geometry.lines.hour : stroke));
}

/** Feine Regel der Bemerkungen (B-Kp-116) von xS bis zum Rahmen rechts; immer durchgezogen. */
function fineRule(ctx: PageContext, m: Metrics, b: RegionBuilder, y: number): void {
  b.shape(lineItem('sidebar', m.xS, y, m.right, y, ctx.geometry.pageLines.remarkRule));
}

/**
 * Fortsetzungsseite: Die Ziele sind der letzte Abschnitt des Teils und werden mit einer Regel T geschlossen
 * (Vertrag E1-02k §2.3).
 */
function goalsCloseContinuation(c: Content): boolean {
  return (
    c.goals.length > 0 &&
    c.readiness.length === 0 &&
    c.remarks.length === 0 &&
    c.abbr.length + c.legend.length === 0
  );
}

export interface SidebarFlow {
  readonly parts: readonly RegionLayout[];
}

/**
 * Seitenleiste der Wochenseite und der Fortsetzungsseiten (E4). `coat`: das einmal dekodierte Wappen des Plans
 * (CR-E102e-04); ohne Angabe dekodiert die Funktion es selbst.
 */
export function sidebarFlow(
  ctx: PageContext,
  coat: CoatOfArms | null = ctx.plan.coatOfArms === null
    ? null
    : readCoatOfArms(ctx.plan.coatOfArms),
): SidebarFlow {
  const { plan, week, template, geometry: g, frame: pf } = ctx;
  const lage = pageLage(g);
  const yTo = pf.grid.rect.y + pf.grid.rect.h;
  const yTop = pf.grid.rect.y + pf.grid.dayHeaderHeightPt + pf.grid.columnHeaderHeightPt;
  // Zeitskala wie layoutGrid (gleicher Rahmen pf.grid), damit die Regeln genau auf den Stundenlinien liegen.
  const { from, to } = plan.displayRange;
  const scale: TimeScale = {
    fromMin: from,
    toMin: to,
    yTop,
    ptPerMinute: (yTo - yTop) / (to - from),
  };
  const m: Metrics = {
    xS: pf.sidebarUpper.x,
    right: pf.frame.x + pf.frame.w,
    textRight: pf.frame.x + pf.frame.w - g.frameStroke.widthPt / 2 - INSET,
    a: pf.grid.timeAxisWidthPt,
    h: pf.h,
    S: template.fontSizes.standard,
    min: template.fontSizes.min,
    rowH: lage.tableRowH * pf.h,
    gap: lage.sectionGapH * pf.h,
    sink: new EventSink(),
    hourYs: hourTimes(plan.displayRange).hours.map((t) => timeToY(scale, t)),
  };
  const readinessText = paragraphRuns(plainRuns(week.heightenedReadiness, 'bold'));
  const all: Content = {
    goals: week.weekGoals.map((x) => ({
      id: x.id,
      runs: paragraphRuns(plainRuns(`- ${x.text}`, 'regular')),
      cut: null,
    })),
    readiness:
      week.heightenedReadiness.trim() === ''
        ? []
        : [{ runs: readinessText, cut: null, boxH: null }],
    remarks: remarksForWeek(plan, week.id).map((r) => ({
      id: r.id,
      number: r.number,
      runs: paragraphRuns(plainRuns(r.text, 'regular')),
      cut: null,
    })),
    abbr: abbreviationsForWeek(plan, week.id),
    legend: plan.legend.filter((c) => c.inLegend && !c.neutral),
  };
  const sizer = new Sizer(ctx, m);
  const parts: RegionLayout[] = [];

  // Wochenseite: oben verkleinern, dann Einheiten verschieben (E4 Platzmangel Nr 1, 2).
  const boundary = (nA: number, nL: number): number => {
    const legendTop = yTo - lage.legendEndAboveGridH * m.h - nL * m.rowH;
    const headingRowTop = legendTop - nA * m.rowH - m.rowH;
    const slot = abbreviationHeadingSlot(ctx, m, headingRowTop);
    return slot.top + (slot.h - lineHeightPt(m.S)) / 2 - lage.sectionGapH * m.h;
  };
  const stackBottom = (c: Content, s: number): number => yTop + sizer.topHeight(c, s, true);
  let size = m.min;
  let page0: Content = all;
  let moved: Content = { goals: [], readiness: [], remarks: [], abbr: [], legend: [] };
  const fitting = sizeSteps(m.S, m.min).find(
    (s) => stackBottom(all, s) <= boundary(all.abbr.length, all.legend.length) + FIT_EPS,
  );
  if (fitting !== undefined) {
    size = fitting;
  } else {
    let nG = all.goals.length;
    let nR = all.remarks.length;
    let nA = all.abbr.length;
    let nL = all.legend.length;
    let ready = all.readiness.length;
    const current = (): Content => ({
      goals: all.goals.slice(0, nG),
      readiness: all.readiness.slice(0, ready),
      remarks: all.remarks.slice(0, nR),
      abbr: all.abbr.slice(0, nA),
      legend: all.legend.slice(0, nL),
    });
    while (stackBottom(current(), m.min) > boundary(nA, nL) + FIT_EPS) {
      if (nR > 0) nR--;
      else if (nA > 0) nA--;
      else if (nG > 0) nG--;
      else if (ready > 0) ready--;
      else if (nL > 1) nL--;
      else break;
    }
    page0 = current();
    moved = {
      goals: all.goals.slice(nG),
      readiness: all.readiness.slice(ready),
      remarks: all.remarks.slice(nR),
      abbr: all.abbr.slice(nA),
      legend: all.legend.slice(nL),
    };
    const ev = (field: Field, entryId: Id | null = null): void =>
      m.sink.add(
        pageEvent('continuationPage', 'sidebar', week.id, field, { entryId }),
        RANG[field],
      );
    if (moved.goals.length > 0) ev('goal');
    if (moved.readiness.length > 0) ev('readiness');
    if (moved.remarks.length > 0) ev('remark', (moved.remarks[0] as Remark).id);
    if (moved.abbr.length > 0) ev('abbreviation');
    if (moved.legend.length > 0) ev('legendLabel');
  }
  const first = new RegionBuilder();
  const top0 = renderTop(ctx, m, first, page0, size, yTop, true);
  const legendTop = yTo - lage.legendEndAboveGridH * m.h - page0.legend.length * m.rowH;
  const headingTop = legendTop - page0.abbr.length * m.rowH - m.rowH;
  // Nr-Spaltenlinie bis zur Kürzel-Titelzeile (E1-02k §2.2 Punkt 6); Abschluss am Raster (Punkt 9, B-Kp-118).
  nrColumnLine(ctx, m, first, top0.nrColumnTop, headingTop);
  rule(ctx, m, first, yTo, g.lines.gridEdge, true);
  rule(ctx, m, first, pf.agenda.y, g.pageLines.agendaTop, true, m.xS - m.a);
  renderTable(ctx, m, first, page0, headingTop, true);
  renderLower(ctx, m, first, coat);
  parts.push(first.build());

  // Fortsetzungsseiten (V30): Einheiten ab der Tageskopf-Unterlinie yH (E1-02k §2.3, V-02k-9); Überschriften nur
  // mit Einheiten; Kürzung als letzter Schritt.
  const top = pf.grid.rect.y + pf.grid.dayHeaderHeightPt;
  const bottom = pf.frame.y + pf.frame.h - g.frameStroke.widthPt / 2 - INSET;
  let rest = moved;
  while (count(rest) > 0) {
    let placed = rest;
    let next: Content = { goals: [], readiness: [], remarks: [], abbr: [], legend: [] };
    while (top + sizer.contHeight(placed, size) > bottom + FIT_EPS && count(placed) > 1) {
      const r = evictOne(placed, next);
      placed = r.placed;
      next = r.next;
    }
    if (top + sizer.contHeight(placed, size) > bottom + FIT_EPS) {
      const cut = sizer.truncateSingle(placed, size, bottom - top);
      placed = cut.content;
      m.sink.add(
        pageEvent(cut.omitted ? 'textOmitted' : 'ellipsis', 'sidebar', week.id, cut.field, {
          entryId: cut.entryId,
        }),
        RANG[cut.field],
      );
    }
    const b = new RegionBuilder();
    const stack = renderTop(ctx, m, b, placed, size, top, false);
    let y = stack.bottom;
    // Nr-Spaltenlinie bis zur letzten Regel F (E1-02k §2.3).
    nrColumnLine(ctx, m, b, stack.nrColumnTop, y);
    if (placed.abbr.length + placed.legend.length > 0) {
      if (y > top) y += m.gap;
      renderTable(ctx, m, b, placed, y, false);
    }
    parts.push(b.build());
    rest = next;
  }
  const firstPart = parts[0] as RegionLayout;
  parts[0] = { ...firstPart, fallbacks: [...firstPart.fallbacks, ...m.sink.sorted()] };
  return { parts };
}

/** Eine Einheit in der Reihenfolge von E4 Nr 2 von `placed` an den Anfang von `next` verschieben. */
function evictOne(placed: Content, next: Content): { placed: Content; next: Content } {
  if (placed.remarks.length > 0) {
    return {
      placed: { ...placed, remarks: placed.remarks.slice(0, -1) },
      next: { ...next, remarks: [...placed.remarks.slice(-1), ...next.remarks] },
    };
  }
  if (placed.abbr.length > 0) {
    return {
      placed: { ...placed, abbr: placed.abbr.slice(0, -1) },
      next: { ...next, abbr: [...placed.abbr.slice(-1), ...next.abbr] },
    };
  }
  if (placed.goals.length > 0) {
    return {
      placed: { ...placed, goals: placed.goals.slice(0, -1) },
      next: { ...next, goals: [...placed.goals.slice(-1), ...next.goals] },
    };
  }
  if (placed.readiness.length > 0) {
    return {
      placed: { ...placed, readiness: [] },
      next: { ...next, readiness: [...placed.readiness, ...next.readiness] },
    };
  }
  return {
    placed: { ...placed, legend: placed.legend.slice(0, -1) },
    next: { ...next, legend: [...placed.legend.slice(-1), ...next.legend] },
  };
}

/** Zeilen und Höhen der Absätze je Grösse (zwischengespeichert). */
class Sizer {
  private readonly cache = new Map<string, readonly (readonly StyledRun[])[]>();
  private readonly ctx: PageContext;
  private readonly m: Metrics;
  private readonly lage: ReturnType<typeof pageLage>;

  constructor(ctx: PageContext, m: Metrics) {
    this.ctx = ctx;
    this.m = m;
    this.lage = pageLage(ctx.geometry);
  }

  /** Zeilen eines Ziels (S3-2): Zeile 1 ab xS + 1,0, der Rest ab xS + 4,6, je bis zum rechten Rand. */
  goalLines(gl: Goal, s: number): readonly (readonly StyledRun[])[] {
    if (gl.cut !== null) return gl.cut;
    return this.memo(`g|${gl.id}|${s}`, () => {
      const w1 = this.m.textRight - (this.m.xS + this.lage.goalX);
      const wR = this.m.textRight - (this.m.xS + this.lage.goalIndentX);
      return breakParagraph(gl.runs, w1, wR, s).lines.map((l) => l.runs);
    });
  }

  remarkLines(r: Remark, s: number): readonly (readonly StyledRun[])[] {
    if (r.cut !== null) return r.cut;
    return this.memo(`r|${r.id}|${s}`, () => {
      const w = this.remarkWidth();
      return breakParagraph(r.runs, w, w, s).lines.map((l) => l.runs);
    });
  }

  /** Zeilen des Bereitschaftskastens: Titelzeile «Erhöhte Bereitschaft:» (B-Kp-75, Referenz), dann der Text. */
  readinessLines(rd: Readiness): readonly (readonly StyledRun[])[] {
    if (rd.cut !== null) return [READINESS_TITLE, ...rd.cut];
    return this.memo('b', () => {
      const w = this.readinessWidth();
      const s = this.ctx.geometry.fontSizes.readiness;
      return [READINESS_TITLE, ...breakParagraph(rd.runs, w, w, s).lines.map((l) => l.runs)];
    });
  }

  remarkWidth(): number {
    return this.m.textRight - this.remarkX();
  }

  /** Was-Spalte rechts der feinen Nr-Spaltenlinie (E1-02k §2.2 Punkt 6). */
  remarkX(): number {
    return this.m.xS + this.m.a + this.ctx.geometry.pageLines.remarkRule.widthPt / 2 + INSET;
  }

  readinessWidth(): number {
    return (
      this.m.textRight -
      (this.m.xS + this.ctx.geometry.pageLines.readinessFrame.widthPt / 2 + INSET)
    );
  }

  readinessBoxH(rd: Readiness): number {
    if (rd.boxH !== null) return rd.boxH;
    const s = this.ctx.geometry.fontSizes.readiness;
    const need = this.readinessLines(rd).length * lineHeightPt(s) + 2 * INSET;
    return Math.max(this.lage.readinessHeightH * this.m.h, need);
  }

  /**
   * Kompakte Bemerkungszeile (Arbeitsannahme Q-048): Zahl der Textzeilen × Zeilenhöhe, mindestens eine Zeile für
   * jede Bemerkung, auch ohne Text und Nummer (E1-02k §2.2 Punkt 6, Entscheid V02).
   */
  remarkRowH(r: Remark, s: number): number {
    return Math.max(this.remarkLines(r, s).length, 1) * lineHeightPt(s);
  }

  /**
   * Abstand vom Beginn des Zielabschnitts bis zur ersten Zielzeile (E1-02k §2.2 Punkt 3, §2.3): Wochenseite unter
   * der Linie auf y(from), Fortsetzung unter der Titelzeile «Wochenziele».
   */
  goalsStart(week: boolean): number {
    const g = this.ctx.geometry;
    return week
      ? g.lines.gridEdge.widthPt / 2 + INSET
      : this.m.rowH + g.pageLines.table.widthPt / 2 + INSET;
  }

  /** Abstand der Schlussregel unter der letzten Zielzeile der Fortsetzung (E1-02k §2.3). */
  goalsCloseGap(): number {
    return this.ctx.geometry.pageLines.table.widthPt / 2 + INSET;
  }

  /**
   * Höhe des oberen Stapels ab seinem Beginn (Wochenseite: ab y(from), Fortsetzung: ab yH): Ziele, Abstand,
   * Bereitschaft und Abstand, Titelzeile «Bemerkungen», Kopfzeile «Nr | Was», Bemerkungen (E1-02k §2.4). Auf der
   * Wochenseite sind die Überschriften fest (E4 Nr 3).
   */
  topHeight(c: Content, s: number, week: boolean): number {
    const lh = lineHeightPt(s);
    let y = 0;
    let belegt = false;
    if (week || c.goals.length > 0) {
      y += this.goalsStart(week);
      for (const gl of c.goals) y += this.goalLines(gl, s).length * lh;
      belegt = true;
    }
    for (const rd of c.readiness) {
      if (belegt) y += this.m.gap;
      y += this.readinessBoxH(rd);
      belegt = true;
    }
    if (week || c.remarks.length > 0) {
      if (belegt) y += this.m.gap;
      y += 2 * this.m.rowH;
      for (const r of c.remarks) y += this.remarkRowH(r, s);
    }
    return y;
  }

  /** Höhe des ganzen Inhalts einer Fortsetzungsseite (Stapel und Tabelle; E1-02k §2.4). */
  contHeight(c: Content, s: number): number {
    let y = this.topHeight(c, s, false);
    if (goalsCloseContinuation(c)) y += this.goalsCloseGap();
    const rows = c.abbr.length + c.legend.length;
    if (rows > 0) y += (y > 0 ? this.m.gap : 0) + (rows + 1) * this.m.rowH;
    return y;
  }

  /**
   * Die einzige Einheit einer leeren Fortsetzungsseite passt nicht: Ziel, Bemerkung oder Bereitschaftstext
   * enden nach ihrer letzten passenden Zeile mit «…»; der Bereitschaftskasten höchstens so hoch wie der Teil
   * (V-02e-18).
   */
  truncateSingle(
    c: Content,
    s: number,
    avail: number,
  ): { content: Content; field: Field; entryId: Id | null; omitted: boolean } {
    const gl = c.goals[0];
    if (gl !== undefined) {
      // E1-02k §2.4: Titelzeile mit Abstand zur ersten Zeile und Schlussregel unter der letzten.
      const w1 = this.m.textRight - (this.m.xS + this.lage.goalX);
      const wR = this.m.textRight - (this.m.xS + this.lage.goalIndentX);
      const avail1 = avail - this.goalsStart(false) - this.goalsCloseGap();
      const cut = cutParagraph(gl.runs, w1, wR, s, avail1);
      return {
        content: { ...c, goals: [{ ...gl, cut }] },
        field: 'goal',
        entryId: null,
        omitted: cut.length === 0,
      };
    }
    const r = c.remarks[0];
    if (r !== undefined) {
      const w = this.remarkWidth();
      const cut = cutParagraph(r.runs, w, w, s, avail - 2 * this.m.rowH);
      return {
        content: { ...c, remarks: [{ ...r, cut }] },
        field: 'remark',
        entryId: r.id,
        omitted: cut.length === 0,
      };
    }
    const rd = c.readiness[0];
    if (rd !== undefined) {
      const sr = this.ctx.geometry.fontSizes.readiness;
      const w = this.readinessWidth();
      // Eine Zeile für die Titelzeile «Erhöhte Bereitschaft:» (B-Kp-75).
      const cut = cutParagraph(rd.runs, w, w, sr, avail - 2 * INSET - lineHeightPt(sr));
      return {
        content: { ...c, readiness: [{ ...rd, cut, boxH: avail }] },
        field: 'readiness',
        entryId: null,
        omitted: cut.length === 0,
      };
    }
    return {
      content: c,
      field: c.abbr.length > 0 ? 'abbreviation' : 'legendLabel',
      entryId: null,
      omitted: true,
    };
  }

  private memo(
    key: string,
    f: () => readonly (readonly StyledRun[])[],
  ): readonly (readonly StyledRun[])[] {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const v = f();
    this.cache.set(key, v);
    return v;
  }
}

/** Ganze Zeilen bis zur letzten passenden, diese mit «…» gekürzt (wie E1-02d 2e); [] wenn keine passt. */
function cutParagraph(
  runs: readonly StyledRun[],
  w1: number,
  wR: number,
  s: number,
  avail: number,
): (readonly StyledRun[])[] {
  const n = Math.floor((avail + FIT_EPS) / lineHeightPt(s));
  if (n <= 0) return [];
  const p = breakParagraph(runs, w1, wR, s);
  const keep: (readonly StyledRun[])[] = p.lines.slice(0, n - 1).map((l) => l.runs);
  const cut = truncateLine(
    runsUntilBreak(runsFrom(runs, p.starts[n - 1] ?? 0)),
    n === 1 ? w1 : wR,
    s,
  );
  return cut === null ? keep : [...keep, cut];
}

/**
 * Einzeiliger Text der Seitenleiste (E6, V-02e-9): `fitHead` mit Querabmessung (S3-22 b; ohne `slot` unbegrenzt).
 * Mit `slot` steht die Zeile senkrecht zentriert darin, `frame` ist der Slot; sonst gilt `baseline` und `frame`
 * ist der Zeilenkasten. Ereignisse bei Kürzung oder Wegfall nur mit `report` (Standard true).
 */
function single(
  ctx: PageContext,
  sink: EventSink,
  b: RegionBuilder,
  spec: {
    readonly rank: number;
    readonly role: ItemRole;
    readonly runs: readonly StyledRun[];
    readonly kind: PageTextKind;
    readonly standard: number;
    /** Mindestgrösse der Einpassung (Standard `fontSizes.min`). */
    readonly min?: number;
    /** `standardSizePt` des Textverweises (Standard `standard`). */
    readonly refSize?: number;
    readonly frameX: number;
    readonly frameW: number;
    readonly baseline?: number;
    readonly slot?: { readonly top: number; readonly h: number };
    readonly align: 'left' | 'center' | 'right';
    readonly centerX?: number;
    /** Ereignisse melden (Standard true; wiederholte Überschriften nur auf der Wochenseite, S3-23 c). */
    readonly report?: boolean;
  },
): void {
  const r = fitHead(
    spec.runs,
    spec.frameW,
    spec.slot === undefined ? Number.POSITIVE_INFINITY : spec.slot.h,
    spec.standard,
    spec.min ?? ctx.template.fontSizes.min,
  );
  if ((spec.report ?? true) && (r.result === 'ellipsis' || r.result === 'omitted')) {
    sink.add(
      pageEvent(
        r.result === 'ellipsis' ? 'ellipsis' : 'textOmitted',
        'sidebar',
        ctx.week.id,
        spec.kind,
      ),
      spec.rank,
    );
  }
  const sizePt = r.sizePt;
  const w = width(r.runs, sizePt);
  const x =
    spec.align === 'left'
      ? spec.frameX
      : spec.align === 'right'
        ? spec.frameX + spec.frameW - w
        : (spec.centerX ?? spec.frameX + spec.frameW / 2) - w / 2;
  const lh = lineHeightPt(sizePt);
  const baseline =
    spec.slot === undefined
      ? (spec.baseline ?? 0)
      : spec.slot.top + (spec.slot.h - lh) / 2 + ascentPt(sizePt);
  const frame: Rect =
    spec.slot === undefined
      ? { x: spec.frameX, y: baseline - ascentPt(sizePt), w: Math.max(spec.frameW, 0), h: lh }
      : {
          x: spec.frameX,
          y: spec.slot.top,
          w: Math.max(spec.frameW, 0),
          h: Math.max(spec.slot.h, 0),
        };
  b.text(
    textItem({
      role: spec.role,
      x,
      baselineY: baseline,
      sizePt,
      runs: r.runs,
      color: ctx.geometry.colors.text,
      frame,
    }),
    spec.kind,
    spec.refSize ?? spec.standard,
    null,
  );
}

/** Ergebnis des oberen Stapels. */
interface TopResult {
  /** Unterkante des Stapels (letzte Regel bzw. Zeile). */
  readonly bottom: number;
  /** Oberes Ende der Nr-Spaltenlinie (Unterlinie der Titelzeile «Bemerkungen»); null ohne Bemerkungen. */
  readonly nrColumnTop: number | null;
}

/**
 * Oberer Stapel ab `y0` (Wochenseite: y(from), Titelzeile «Wochenziele» in der Spaltenkopfzeile, B-Kp-73;
 * Fortsetzung: yH) mit den Regeln nach Vertrag E1-02k §2.2 Punkt 2 bis 6 und §2.3 (B-Kp-113 bis -116).
 */
function renderTop(
  ctx: PageContext,
  m: Metrics,
  b: RegionBuilder,
  c: Content,
  s: number,
  y0: number,
  week: boolean,
): TopResult {
  const g = ctx.geometry;
  const lage = pageLage(g);
  const sizer = new Sizer(ctx, m);
  const S = m.S;
  const lh = lineHeightPt(s);
  const color = g.colors.text;
  const T = g.pageLines.table;
  const F = g.pageLines.remarkRule;
  const r = m.rowH;
  const headX = m.xS + g.pageLines.sidebarEdge.widthPt / 2 + INSET;
  const headW = m.textRight - headX;
  // Überschriften: Ereignisse nur auf der Wochenseite (S3-22 d); Querabmessung = Textfläche der Titelzeile.
  const heading = (text: string, slot: { top: number; h: number }, rank: number): void =>
    single(ctx, m.sink, b, {
      rank,
      role: 'sidebar',
      runs: plainRuns(text, 'bold'),
      kind: 'sidebarHeading',
      standard: S,
      frameX: headX,
      frameW: headW,
      slot,
      align: 'center',
      report: week,
    });
  let y = y0;
  let belegt = false;
  let nrColumnTop: number | null = null;
  if (week || c.goals.length > 0) {
    if (week) {
      // Titelzeile in der Spaltenkopfzeile, gerahmt auf yH und y(from) (B-Kp-113).
      const yH = ctx.frame.grid.rect.y + ctx.frame.grid.dayHeaderHeightPt;
      const yF = yH + ctx.frame.grid.columnHeaderHeightPt;
      const edge = g.lines.gridEdge;
      rule(ctx, m, b, yH, g.pageLines.dayHeadBottom, week);
      rule(ctx, m, b, yF, edge, week);
      heading(
        'Wochenziele',
        between(yH, g.pageLines.dayHeadBottom.widthPt, yF, edge.widthPt),
        RANG.goal,
      );
    } else {
      // Eigene Titelzeile r ab dem oberen Rand des Teils (E1-02k §2.3).
      rule(ctx, m, b, y, T, week);
      rule(ctx, m, b, y + r, T, week);
      heading('Wochenziele', between(y, T.widthPt, y + r, T.widthPt), RANG.goal);
    }
    y += sizer.goalsStart(week);
    const x1 = m.xS + lage.goalX;
    const xR = m.xS + lage.goalIndentX;
    for (const gl of c.goals) {
      const lines = sizer.goalLines(gl, s);
      const frame: Rect = { x: x1, y, w: m.textRight - x1, h: lines.length * lh };
      lines.forEach((runs, i) => {
        b.text(
          textItem({
            role: 'sidebar',
            x: i === 0 ? x1 : xR,
            baselineY: y + i * lh + ascentPt(s),
            sizePt: s,
            runs,
            color,
            frame,
          }),
          'goal',
          S,
          null,
        );
      });
      y += lines.length * lh;
    }
    if (!week && goalsCloseContinuation(c)) {
      // Ziele als letzter Abschnitt der Fortsetzung: Schlussregel T (E1-02k §2.3).
      y += sizer.goalsCloseGap();
      rule(ctx, m, b, y, T, week);
    }
    belegt = true;
  }
  // Der Kasten der Wochenziele schliesst mit dem Bereitschaftsrahmen bzw. der Oberlinie «Bemerkungen» (B-Kp-114).
  for (const rd of c.readiness) {
    if (belegt) y += m.gap;
    const boxH = sizer.readinessBoxH(rd);
    const box: Rect = { x: m.xS, y, w: m.right - m.xS, h: boxH };
    b.shape(rectItem('sidebar', box, g.colors.readinessGrey, g.pageLines.readinessFrame));
    const sr = g.fontSizes.readiness;
    const lhr = lineHeightPt(sr);
    const lines = sizer.readinessLines(rd);
    const fx = m.xS + g.pageLines.readinessFrame.widthPt / 2 + INSET;
    const frame: Rect = { x: fx, y: y + INSET, w: m.textRight - fx, h: boxH - 2 * INSET };
    const top = frame.y + (frame.h - lines.length * lhr) / 2;
    lines.forEach((runs, i) => {
      const w = width(runs, sr);
      b.text(
        textItem({
          role: 'sidebar',
          x: fx + (frame.w - w) / 2,
          baselineY: top + i * lhr + ascentPt(sr),
          sizePt: sr,
          runs,
          color,
          frame,
        }),
        'readiness',
        sr,
        null,
      );
    });
    y += boxH;
    belegt = true;
  }
  if (week || c.remarks.length > 0) {
    if (belegt) y += m.gap;
    // Titelzeile «Bemerkungen» r zwischen zwei Regeln T (B-Kp-115).
    rule(ctx, m, b, y, T, week);
    rule(ctx, m, b, y + r, T, week);
    heading('Bemerkungen', between(y, T.widthPt, y + r, T.widthPt), RANG.remark);
    y += r;
    nrColumnTop = y;
    // Kopfzeile «Nr» | «Was» r mit feiner Regel unten (R-10-23, B-Kp-116); Nr-Spalte in Achsbreite (V-02e-14).
    fineRule(ctx, m, b, y + r);
    const slot = between(y, T.widthPt, y + r, F.widthPt);
    const nrX = m.xS + g.pageLines.sidebarEdge.widthPt / 2 + INSET;
    // Nr-Zelle (S3-23 d): links die Seitenleistenlinie, rechts die feine Nr-Spaltenlinie.
    const nrW = m.xS + m.a - F.widthPt / 2 - INSET - nrX;
    const wasX = sizer.remarkX();
    const wasW = sizer.remarkWidth();
    single(ctx, m.sink, b, {
      rank: RANG.remark,
      role: 'sidebar',
      runs: plainRuns('Nr', 'bold'),
      kind: 'sidebarHeading',
      standard: S,
      frameX: nrX,
      frameW: nrW,
      slot,
      align: 'center',
      report: week,
    });
    single(ctx, m.sink, b, {
      rank: RANG.remark,
      role: 'sidebar',
      runs: plainRuns('Was', 'bold'),
      kind: 'sidebarHeading',
      standard: S,
      frameX: wasX,
      frameW: wasW,
      slot,
      align: 'left',
      report: week,
    });
    y += r;
    // Je Bemerkung eine kompakte Zeile mit feiner Regel auf der Zeilengrenze (B-Kp-116, Q-048).
    for (const rm of c.remarks) {
      const lines = sizer.remarkLines(rm, s);
      const rowH = sizer.remarkRowH(rm, s);
      if (rm.number !== null) {
        // S3-22 (c): einzeilig in der Nr-Zelle − 2·textInsetPt, Grösse σ der Bemerkungen ohne Verkleinern.
        single(ctx, m.sink, b, {
          rank: RANG.remarkNumber,
          role: 'sidebar',
          runs: plainRuns(String(rm.number), 'regular'),
          kind: 'remarkNumber',
          standard: s,
          min: s,
          refSize: S,
          frameX: nrX,
          frameW: nrW,
          baseline: y + ascentPt(s),
          align: 'center',
        });
      }
      const frame: Rect = { x: wasX, y, w: wasW, h: rowH };
      lines.forEach((runs, i) => {
        b.text(
          textItem({
            role: 'sidebar',
            entryId: rm.id,
            x: wasX,
            baselineY: y + i * lh + ascentPt(s),
            sizePt: s,
            runs,
            color,
            frame,
          }),
          'remark',
          S,
          null,
        );
      });
      y += rowH;
      fineRule(ctx, m, b, y);
    }
  }
  return { bottom: y, nrColumnTop };
}

/** Senkrechte feine Nr-Spaltenlinie auf xS + a von `top` bis `bottom` (B-Kp-116); ohne Bemerkungen keine. */
function nrColumnLine(
  ctx: PageContext,
  m: Metrics,
  b: RegionBuilder,
  top: number | null,
  bottom: number,
): void {
  if (top === null) return;
  const x = m.xS + m.a;
  b.shape(lineItem('sidebar', x, top, x, bottom, ctx.geometry.pageLines.remarkRule));
}

/**
 * Textfläche der Kürzelüberschrift (S3-23 d): Titelzeile 0,5 h ab `headingTop` zwischen ihrer Ober- und
 * Unterlinie, die immer gezeichnet werden (E1-02k §2.2 Punkt 7, B-Kp-117); gestrichelte Regeln sind gleich breit.
 */
function abbreviationHeadingSlot(
  ctx: PageContext,
  m: Metrics,
  headingTop: number,
): { readonly top: number; readonly h: number } {
  const w = ctx.geometry.pageLines.table.widthPt;
  return between(headingTop, w, headingTop + m.rowH, w);
}

/**
 * Kürzelliste und Legende (E4 «Unten verankert», B-Kp-77 bis -79, B-Kp-117): Titelzeile ab `headingTop` zwischen
 * zwei Regeln, darunter die Kürzelzeilen (Kürzel fett in der Kürzelspalte, Bedeutung normal rechts daneben,
 * R-10-53) und die Legendenzeilen (Farbfeld in Kürzelspaltenbreite, Beschriftung `legendLabel` normal rechts
 * daneben); Zeilenhöhe 0,5 h. Regeln auf vollen Stunden der Wochenseite im Stil der Stundenlinie (B-Kp-78); die
 * Kürzel-Spaltenlinie reicht auf der Wochenseite bis y(to), auf der Fortsetzung bis zur letzten Regel.
 */
function renderTable(
  ctx: PageContext,
  m: Metrics,
  b: RegionBuilder,
  c: Content,
  headingTop: number,
  week: boolean,
): void {
  const g = ctx.geometry;
  const S = m.S;
  const lhS = lineHeightPt(S);
  const table = g.pageLines.table;
  const rows = c.abbr.length + c.legend.length;
  const rowsTop = headingTop + m.rowH;
  const rowsBottom = rowsTop + rows * m.rowH;
  for (let i = 0; i <= rows + 1; i++) rule(ctx, m, b, headingTop + i * m.rowH, table, week);
  if (week || rows > 0) {
    const x = m.xS + m.a;
    const yEnd = week ? ctx.frame.grid.rect.y + ctx.frame.grid.rect.h : rowsBottom;
    b.shape(lineItem('sidebar', x, rowsTop, x, yEnd, table));
  }
  const headX = m.xS + g.pageLines.sidebarEdge.widthPt / 2 + INSET;
  single(ctx, m.sink, b, {
    rank: RANG.abbreviation,
    role: 'sidebar',
    runs: plainRuns(ctx.template.abbreviationHeading, 'bold'),
    kind: 'sidebarHeading',
    standard: S,
    frameX: headX,
    frameW: m.textRight - headX,
    slot: abbreviationHeadingSlot(ctx, m, headingTop),
    align: 'center',
    report: week,
  });
  if (rows === 0) return;
  const cellX = m.xS + g.pageLines.sidebarEdge.widthPt / 2 + INSET;
  const cellW = m.xS + m.a - table.widthPt / 2 - INSET - cellX;
  const labelX = m.xS + m.a + table.widthPt / 2 + INSET;
  const baselineIn = (top: number): number => top + (m.rowH - lhS) / 2 + ascentPt(S);
  const min = ctx.template.fontSizes.min;
  c.abbr.forEach((k, i) => {
    const top = rowsTop + i * m.rowH;
    const baseline = baselineIn(top);
    const runs = plainRuns(k, 'bold');
    // Ein Kürzel wird nie gekürzt (H-LAYOUT, Zusatzbefund visual-qa (c); R2 sinngemäss): passt es auch in Mindestgrösse
    // nicht in die Kürzelspalte, steht es vollständig auf weissem Träger über der Spaltenlinie, die Bedeutung rückt
    // dahinter; Befund P8 «neben dem Kästchen».
    const need = width(runs, min);
    const over = need > cellW + FIT_EPS;
    if (over) {
      const tw = table.widthPt;
      b.shape(
        rectItem('sidebar', { x: cellX, y: top + tw / 2, w: need, h: m.rowH - tw }, WHITE, null),
      );
      m.sink.add(
        { ...pageEvent('labelOutside', 'sidebar', ctx.week.id, 'abbreviation'), text: k },
        RANG.abbreviation,
      );
    }
    single(ctx, m.sink, b, {
      rank: RANG.abbreviation,
      role: 'sidebar',
      runs,
      kind: 'abbreviation',
      standard: S,
      frameX: cellX,
      frameW: over ? need : cellW,
      baseline,
      align: 'left',
    });
    // Bedeutung (R-10-53, E1-02k §4): Planfeld vor Vorlage; leer → kein Text und kein Ereignis.
    const meaning = abbreviationMeaning(ctx.plan, k, ctx.template);
    if (meaning !== '') {
      const x = over ? Math.max(labelX, cellX + need + 2 * INSET) : labelX;
      single(ctx, m.sink, b, {
        rank: RANG.abbreviation,
        role: 'sidebar',
        runs: plainRuns(meaning, 'regular'),
        kind: 'abbreviationMeaning',
        standard: S,
        frameX: x,
        frameW: m.textRight - x,
        baseline,
        align: 'left',
      });
    }
  });
  c.legend.forEach((cat, i) => {
    const top = rowsTop + (c.abbr.length + i) * m.rowH;
    b.shape(rectItem('legend', { x: m.xS, y: top, w: m.a, h: m.rowH }, cat.color, table));
    single(ctx, m.sink, b, {
      rank: RANG.legendLabel,
      role: 'legend',
      runs: plainRuns(cat.legendLabel, 'regular'),
      kind: 'legendLabel',
      standard: S,
      frameX: labelX,
      frameW: m.textRight - labelX,
      baseline: baselineIn(top),
      align: 'left',
    });
  });
}

/** Unterer Teil der Seitenleiste der Wochenseite (B-Kp-81 bis -84; R-10-25, R-10-26, R-4.1-07, R-15-08). */
function renderLower(
  ctx: PageContext,
  m: Metrics,
  b: RegionBuilder,
  coat: CoatOfArms | null,
): void {
  const { plan, week, geometry: g, frame: pf } = ctx;
  const lage = pageLage(g);
  const h = m.h;
  const xSa = m.xS - m.a;
  const yT = pf.agenda.y;
  const yU = pf.frame.y + pf.frame.h;
  const fs = g.fontSizes;

  // Sonnentabelle (B-Kp-84): 2 Zeilen × (quadratische Symbolzelle + Wertzelle), unten rechts.
  const cell = lage.sunCellH * h;
  const tableW = cell * (1 + lage.sunValueCells);
  const x0 = m.right - lage.sunMargin - tableW;
  const y0 = yU - lage.sunMargin - 2 * cell;
  const sunStroke = g.pageLines.sunTable;
  b.shape(rectItem('sun', { x: x0, y: y0, w: tableW, h: 2 * cell }, null, sunStroke));
  b.shape(lineItem('sun', x0, y0 + cell, x0 + tableW, y0 + cell, sunStroke));
  b.shape(lineItem('sun', x0 + cell, y0, x0 + cell, y0 + 2 * cell, sunStroke));
  const black = g.colors.text;
  b.shape({
    kind: 'path',
    role: 'sun',
    d: sunPath({ x: x0, y: y0, w: cell, h: cell }),
    fill: { r: black.r, g: black.g, b: black.b },
    stroke: null,
  });
  b.shape({
    kind: 'path',
    role: 'sun',
    d: moonPath({ x: x0, y: y0 + cell, w: cell, h: cell }),
    fill: { r: black.r, g: black.g, b: black.b },
    stroke: null,
  });

  // Unterschriftblock (S3-7): Einheit 0,77 h und Name 2,51 h unter yT, Funktion eine Zeilenhöhe unter dem Namen.
  const sx = xSa + lage.signatureX;
  const sw = m.textRight - sx;
  const c = plan.commander;
  const nameParts =
    c.nameOrder === 'gradVornameName' ? [c.grad, c.vorname, c.name] : [c.grad, c.name, c.vorname];
  const name = nameParts
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .join(' ');
  const unitY = yT + lage.signatureUnitH * h;
  const nameY = yT + lage.signatureNameH * h;
  const funcY = nameY + lineHeightPt(fs.signature);
  const sig = (text: string, baseline: number): void =>
    single(ctx, m.sink, b, {
      rank: RANG.signature,
      role: 'signature',
      runs: plainRuns(text, 'regular'),
      kind: 'signature',
      standard: fs.signature,
      frameX: sx,
      frameW: sw,
      baseline,
      align: 'left',
    });

  // Unterschrift als Bild (R-4.1-08, Beschrieb 4.1, 15; Vorgabe aus R-15-03): nur mit plan.signatureEnabled, in der
  // Leerzeile zwischen Einheit und Name, mit Seitenverhältnis eingepasst, links bündig (Notiz E1-02e zu E1-10).
  const signature =
    plan.signatureEnabled && plan.signatureImage !== null
      ? readCoatOfArms(plan.signatureImage)
      : null;
  if (signature !== null) {
    const top = unitY + lineHeightPt(fs.signature) - ascentPt(fs.signature);
    const bottom = nameY - ascentPt(fs.signature);
    const space = bottom - top;
    if (space > 0 && sw > 0) {
      const scale = Math.min(sw / signature.widthPx, space / signature.heightPx);
      const w = signature.widthPx * scale;
      const ih = signature.heightPx * scale;
      b.shape({
        kind: 'image',
        role: 'signature',
        rect: { x: sx, y: top + (space - ih) / 2, w, h: ih },
        mime: signature.mime,
        bytes: signature.bytes,
      });
    }
  }

  // Wappen (V-02e-12): mit Seitenverhältnis in den Kasten nach B-Kp-82, oben bündig, waagrecht zentriert.
  const box: Rect = {
    x: sx,
    y: funcY + lage.coatTop,
    w: lage.coatWidthH * h,
    h: lage.coatHeightH * h,
  };
  let imageBottom = box.y + box.h;
  if (coat !== null) {
    const scale = Math.min(box.w / coat.widthPx, box.h / coat.heightPx);
    const w = coat.widthPx * scale;
    const ih = coat.heightPx * scale;
    b.shape({
      kind: 'image',
      role: 'sidebar',
      rect: { x: box.x + (box.w - w) / 2, y: box.y, w, h: ih },
      mime: coat.mime,
      bytes: coat.bytes,
    });
    imageBottom = box.y + ih;
  }

  // Texte: Unterschrift, Motto, Sonnenzeiten.
  sig(plan.unit, unitY);
  sig(name, nameY);
  sig(c.funktion, funcY);
  // Motto (B-Kp-83, S3-17): auf die Wappen- bzw. Kastenmitte zentriert, Grundlinie 7 pt unter dem Bild bzw.
  // dem Kasten; links bis zum Rand, rechts bis vor die Sonnentabelle.
  const cx = box.x + box.w / 2;
  const leftLimit = xSa + g.lines.dayBorder.widthPt / 2 + INSET;
  const half = Math.min(cx - leftLimit, x0 - sunStroke.widthPt / 2 - INSET - cx);
  single(ctx, m.sink, b, {
    rank: RANG.motto,
    role: 'sidebar',
    runs: plainRuns(plan.motto, 'regular'),
    kind: 'motto',
    standard: fs.motto,
    frameX: cx - half,
    frameW: 2 * half,
    baseline: imageBottom + lage.mottoBelow,
    align: 'center',
    centerX: cx,
  });
  const valueX = x0 + cell + sunStroke.widthPt / 2 + INSET;
  const valueW = x0 + tableW - sunStroke.widthPt / 2 - INSET - valueX;
  const lhSun = lineHeightPt(fs.sunTime);
  const sun = week.sunOverride;
  [sun.sunrise, sun.sunset].forEach((t, i) => {
    single(ctx, m.sink, b, {
      rank: RANG.sunTime,
      role: 'sun',
      runs: plainRuns(t === null ? '–' : formatMilTime(t), 'regular'),
      kind: 'sunTime',
      standard: fs.sunTime,
      frameX: valueX,
      frameW: valueW,
      baseline: y0 + i * cell + (cell - lhSun) / 2 + ascentPt(fs.sunTime),
      align: 'right',
    });
  });
}

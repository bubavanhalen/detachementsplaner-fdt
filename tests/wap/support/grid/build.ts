// Testhilfen für das Raster-Layout (Paket E1-02d, Vertrag docs/wap-planer/plan/vertraege/E1-02d.md).
// Pläne entstehen als Literale aus den Bausteinen von E1-02a (tests/wap/support/model/builders.ts); Erwartungen
// werden aus den festen Rahmenmassen berechnet, nie aus `timeToY` oder anderen Funktionen dieses Pakets.
// Alle Inhalte sind fiktiv.
import { expect } from 'vitest';
import { layoutGrid } from '../../../../src/model/wap/layout/grid/layout';
import type {
  DayGeometry,
  EntryGeometry,
  EntryPiece,
  FallbackEvent,
  GridFrame,
  GridLayout,
  GridLineStyles,
  PieceKind,
} from '../../../../src/model/wap/layout/grid/types';
import type {
  LineItem,
  PageItem,
  PathItem,
  Rect,
  RectItem,
  Stroke,
  TextItem,
} from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import type {
  Column,
  ColumnKind,
  ColumnSet,
  ColumnWeight,
  DayDisplay,
  Entry,
  Id,
  IsoDate,
  MarkerLabelSetting,
  MilTime,
  Plan,
  Rgb,
} from '../../../../src/model/wap/types';
import { basePlan, col, WEEKDAYS, week, withEntries } from '../model/builders';

// ---------------------------------------------------------------------------------------------------------
// Rahmen
// ---------------------------------------------------------------------------------------------------------

const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };
const strich = (widthPt: number, dash: readonly number[] | null = null): Stroke => ({
  color: SCHWARZ,
  widthPt,
  dash,
});

/** Linienarten mit den Strichbreiten aus Anhang B-Kp (Vertrag E1-02d Abschnitt 5). */
export const LINIEN: GridLineStyles = {
  hour: strich(0.48, [1.56, 0.48]),
  halfHour: strich(0.12),
  gridEdge: strich(0.48),
  dayBorder: strich(0.48),
  columnBorder: strich(0.12),
  rapSeparator: strich(0.48, [1.56, 0.48]),
  laneBorder: strich(0.12),
  blockBorder: strich(0.48),
  rapportBorder: strich(0.96),
  besoBoxBorder: strich(0.375),
  querbalkenBorder: strich(0.375),
  markerLine: strich(1.56),
  markerFieldBorder: strich(0.48),
};

/** Linker und oberer Rand des Rahmens, Zeitachse und Kopfhöhen (fiktive Masse). */
export const RAHMEN_X = 10;
export const RAHMEN_Y = 20;
export const ACHSE = 20;
export const TAGESKOPF = 15;
export const SPALTENKOPF = 25;
/** Linker Rand der Tagesfläche: rect.x + Zeitachse. */
export const X0 = RAHMEN_X + ACHSE;
/** y(from) = rect.y + Tageskopf + Spaltenkopf. */
export const Y0 = RAHMEN_Y + TAGESKOPF + SPALTENKOPF;
/** Standard-Massstab der Pflicht-Testfälle (Notiz Runde 2: ptPerMinute 0,3). */
export const PPM = 0.3;

/** Rahmen mit Tagesfläche `W` und einem Anzeigebereich, der genau `ppm` pt je Minute ergibt. */
export function rahmen(
  W: number,
  range: { readonly from: MilTime; readonly to: MilTime },
  ppm: number = PPM,
  lines: GridLineStyles = LINIEN,
): GridFrame {
  return {
    rect: {
      x: RAHMEN_X,
      y: RAHMEN_Y,
      w: W + 2 * ACHSE,
      h: TAGESKOPF + SPALTENKOPF + (range.to - range.from) * ppm,
    },
    timeAxisWidthPt: ACHSE,
    dayHeaderHeightPt: TAGESKOPF,
    columnHeaderHeightPt: SPALTENKOPF,
    lines,
  };
}

/** Erwartetes y einer Zeit (Vertrag 2a Nr 4), unabhängig von `timeToY`. */
export function yZeit(t: number, from: MilTime = 240, ppm: number = PPM): number {
  return Y0 + (t - from) * ppm;
}

/** Layout der Woche `weekId` von `plan` in einem Rahmen mit Tagesfläche `W`. */
export function lege(
  plan: Plan,
  opts: {
    readonly W?: number;
    readonly ppm?: number;
    readonly weekId?: Id;
    readonly template?: LevelTemplate;
    readonly lines?: GridLineStyles;
  } = {},
): GridLayout {
  return layoutGrid({
    plan,
    weekId: opts.weekId ?? WOCHE,
    template: opts.template ?? kpTemplate(),
    frame: rahmen(opts.W ?? STD_BREITE, plan.displayRange, opts.ppm ?? PPM, opts.lines),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Pläne
// ---------------------------------------------------------------------------------------------------------

export const WOCHE = 'w26';
export const WOCHE2 = 'w27';
export const MO = '2026-09-28';
export const DI = '2026-09-29';
export const MI = '2026-09-30';
export const DO = '2026-10-01';
export const FR = '2026-10-02';
export const SA = '2026-10-03';
export const SO = '2026-10-04';
export const MO2 = '2026-10-05';
export const DI2 = '2026-10-06';

export interface SpaltenSpec {
  readonly id: Id;
  readonly kind: ColumnKind;
  readonly weight?: ColumnWeight;
}

/** Spaltensatz aus Kurzangaben (Gewicht Standard «normal»). */
export function satz(id: Id, spalten: readonly SpaltenSpec[]): ColumnSet {
  return {
    id,
    name: `Satz ${id}`,
    columns: spalten.map(
      (s): Column => col(s.id, `Spalte ${s.id}`, s.kind, { weight: s.weight ?? 'normal' }),
    ),
  };
}

/** Standardsatz: drei Planungsspalten (normal), Rap, Beso → 2 + 2 + 2 + 1 + 2 = 9 Einheiten. */
export const STD = {
  set: 's90',
  p1: 'c91',
  p2: 'c92',
  p3: 'c93',
  rap: 'c94',
  beso: 'c95',
} as const;
/** Tagesbreite des Standardtags: 9 Einheiten zu 20 pt (Planungsspalte 40, Rap 20, Beso 40 pt). */
export const STD_BREITE = 180;

export function stdSatz(): ColumnSet {
  return satz(STD.set, [
    { id: STD.p1, kind: 'planning' },
    { id: STD.p2, kind: 'planning' },
    { id: STD.p3, kind: 'planning' },
    { id: STD.rap, kind: 'rap' },
    { id: STD.beso, kind: 'beso' },
  ]);
}

/** x-Bereiche des Standardtags am Montag als einzigem sichtbaren Tag (X0 = 30). */
export const STD_X = {
  p1: { x: X0, w: 40 },
  p2: { x: X0 + 40, w: 40 },
  p3: { x: X0 + 80, w: 40 },
  rap: { x: X0 + 120, w: 20 },
  beso: { x: X0 + 140, w: 40 },
} as const;

export interface TagSpec {
  readonly set: Id | null;
  readonly display: DayDisplay;
}

/** Sieben Tage; nur der Montag sichtbar (voll) mit dem Satz `set`. */
export function nurMontag(set: Id = STD.set): readonly TagSpec[] {
  return WEEKDAYS.map((_, i) => ({ set, display: i === 0 ? 'full' : 'hidden' }));
}

/** Sieben Tage mit demselben Satz und derselben Darstellung. */
export function alleTage(set: Id = STD.set, display: DayDisplay = 'full'): readonly TagSpec[] {
  return WEEKDAYS.map(() => ({ set, display }));
}

function tageDerWoche(tage: readonly TagSpec[]): ReturnType<typeof week>['days'] {
  const d = (i: number) => ({
    weekday: WEEKDAYS[i] ?? 'Mo',
    columnSetId: tage[i]?.set ?? null,
    display: tage[i]?.display ?? 'hidden',
    internalNote: '',
  });
  return [d(0), d(1), d(2), d(3), d(4), d(5), d(6)];
}

/**
 * Plan mit den Wochen w26 (ab 28.09.2026) und w27 (ab 05.10.2026). Ohne Angaben: Satz `stdSatz()`, nur der
 * Montag von w26 sichtbar, w27 wie w26, Anzeigebereich 0400–2400.
 */
export function rasterPlan(
  opts: {
    readonly sets?: readonly ColumnSet[];
    readonly tage?: readonly TagSpec[];
    readonly tage2?: readonly TagSpec[];
    readonly range?: { readonly from: MilTime; readonly to: MilTime };
    readonly entries?: readonly Entry[];
    readonly over?: Partial<Plan>;
    readonly markerLabels?: readonly MarkerLabelSetting[];
  } = {},
): Plan {
  const tage = opts.tage ?? nurMontag();
  const plan = basePlan({
    columnSets: [...(opts.sets ?? [stdSatz()])],
    weeks: [
      week(WOCHE, MO, { days: tageDerWoche(tage) }),
      week(WOCHE2, MO2, { days: tageDerWoche(opts.tage2 ?? tage) }),
    ],
    displayRange: opts.range ?? { from: 240, to: 1440 },
    nextSeq: 500,
    ...(opts.markerLabels === undefined ? {} : { markerLabels: [...opts.markerLabels] }),
    ...opts.over,
  });
  return withEntries(plan, opts.entries ?? []);
}

// ---------------------------------------------------------------------------------------------------------
// Abfragen
// ---------------------------------------------------------------------------------------------------------

export function geo(L: GridLayout, id: Id): EntryGeometry {
  const g = L.entries.find((e) => e.entryId === id);
  expect(g, `EntryGeometry für ${id}`).toBeDefined();
  return g as EntryGeometry;
}

export function teile(L: GridLayout, id: Id, kind?: PieceKind): readonly EntryPiece[] {
  return geo(L, id).pieces.filter((p) => kind === undefined || p.kind === kind);
}

export function einTeil(L: GridLayout, id: Id, kind?: PieceKind): EntryPiece {
  const ps = teile(L, id, kind);
  expect(ps, `genau ein Teilstück ${kind ?? ''} von ${id}`).toHaveLength(1);
  return ps[0] as EntryPiece;
}

export function itemsVon(L: GridLayout, id: Id): readonly PageItem[] {
  return L.items.filter((i) => i.entryId === id);
}

export function texte(L: GridLayout, id: Id): readonly TextItem[] {
  return itemsVon(L, id).filter((i): i is TextItem => i.kind === 'text');
}

export function rechtecke(L: GridLayout, id: Id): readonly RectItem[] {
  return itemsVon(L, id).filter((i): i is RectItem => i.kind === 'rect');
}

export function linien(L: GridLayout, id: Id): readonly LineItem[] {
  return itemsVon(L, id).filter((i): i is LineItem => i.kind === 'line');
}

export function pfade(L: GridLayout, id: Id): readonly PathItem[] {
  return itemsVon(L, id).filter((i): i is PathItem => i.kind === 'path');
}

export function zeilenText(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

/** Zeilen von `id`, deren Rahmen innerhalb von `r` liegt (Text eines bestimmten Teilstücks). */
export function texteIn(L: GridLayout, id: Id, r: Rect): readonly TextItem[] {
  return texte(L, id).filter((t) => innerhalb(t.frame, r, 0.01));
}

export function ereignisse(L: GridLayout, id: Id): readonly FallbackEvent[] {
  return L.fallbacks.filter((f) => f.entryId === id);
}

export function tag(L: GridLayout, date: IsoDate): DayGeometry {
  const d = L.days.find((x) => x.date === date);
  expect(d, `Tag ${date} in days`).toBeDefined();
  return d as DayGeometry;
}

export function spalte(L: GridLayout, date: IsoDate, columnId: Id) {
  const c = tag(L, date).columns.find((x) => x.columnId === columnId);
  expect(c, `Spalte ${columnId} am ${date}`).toBeDefined();
  return c as NonNullable<typeof c>;
}

// ---------------------------------------------------------------------------------------------------------
// Vergleiche
// ---------------------------------------------------------------------------------------------------------

/** |ist − soll| ≤ tol (Vertrag Abschnitt 6: 0,01 pt, wo nicht anders genannt). */
export function nahe(ist: number, soll: number, tol = 0.01, was = ''): void {
  expect(Number.isFinite(ist), `${was} endlich`).toBe(true);
  expect(ist, `${was} ≥ ${soll} − ${tol}`).toBeGreaterThanOrEqual(soll - tol);
  expect(ist, `${was} ≤ ${soll} + ${tol}`).toBeLessThanOrEqual(soll + tol);
}

export function rechteckNahe(ist: Rect, soll: Rect, tol = 0.01, was = ''): void {
  nahe(ist.x, soll.x, tol, `${was} x`);
  nahe(ist.y, soll.y, tol, `${was} y`);
  nahe(ist.w, soll.w, tol, `${was} w`);
  nahe(ist.h, soll.h, tol, `${was} h`);
}

/** Liegt `a` innerhalb von `b` (mit Toleranz)? */
export function innerhalb(a: Rect, b: Rect, tol = 0.01): boolean {
  return (
    a.x >= b.x - tol &&
    a.y >= b.y - tol &&
    a.x + a.w <= b.x + b.w + tol &&
    a.y + a.h <= b.y + b.h + tol
  );
}

/** Fläche des offenen Schnitts zweier Rechtecke (0 bei Berührung). */
export function schnittFlaeche(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Rechteck aus Spalten-x-Bereich und Zeitspanne (Standardrahmen 0400–2400, 0,3 pt/min). */
export function feld(
  xb: { readonly x: number; readonly w: number },
  von: number,
  bis: number,
  from: MilTime = 240,
  ppm: number = PPM,
): Rect {
  const y = yZeit(von, from, ppm);
  return { x: xb.x, y, w: xb.w, h: yZeit(bis, from, ppm) - y };
}

/** Textfläche nach Vertrag 2e (V-02d-9): auf jeder Seite um 0,5 pt + halbe Strichbreite verkleinert. */
export function textflaeche(r: Rect, strichBreite: number): Rect {
  const d = 0.5 + strichBreite / 2;
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

/**
 * Prüft, dass eine Zeile in ihrem `frame` liegt (Prompt §7 «nie Text ausserhalb seines Rahmens»): waagrecht
 * Zeilenkasten [Grundlinie − Oberlänge, + Zeilenhöhe] × [x, x + Breite]; bei Drehung 90 (E1-02c: Leserichtung
 * nach oben, Oberlängen nach links) Zeilenkasten [x − Oberlänge, + Zeilenhöhe] × [Grundlinie − Breite, Grundlinie].
 */
export function zeileImRahmen(t: TextItem, tol = 0.01): void {
  const breite = measureRuns(
    t.runs.map((r) => ({ text: r.text, weight: r.weight })),
    t.sizePt,
  );
  const lh = lineHeightPt(t.sizePt);
  const asc = ascentPt(t.sizePt);
  const f = t.frame;
  const kasten: Rect =
    t.rotation === 0
      ? { x: t.x, y: t.baselineY - asc, w: breite, h: lh }
      : t.rotation === 90
        ? { x: t.x - asc, y: t.baselineY - breite, w: lh, h: breite }
        : { x: t.x + asc - lh, y: t.baselineY, w: lh, h: breite };
  expect(innerhalb(kasten, f, tol), `Zeile «${zeilenText(t)}» liegt in ihrem Rahmen`).toBe(true);
}

/** Erwartete Schriftgrössen der Kp-Vorlage (5 / 5,5 / 5 / 5 / 4,5). */
export const GROESSE = kpTemplate().fontSizes;

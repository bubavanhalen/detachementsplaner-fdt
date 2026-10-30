// Bildschirmraster aus der gemeinsamen Layout-Schicht (Paket E1-02l, R-10-54, R-10-55, R-14.3-04; ADR-004,
// Leitplanke 2): Flächen, Teilstücke, Texte, Beschriftungen neben dem Kästchen und Spaltenköpfe kommen aus
// `layoutGrid` bzw. `layoutColumnHeads` – dieselben Regeln wie im PDF. Die Bildschirmgeometrie ist der Rahmen in
// pt (px ÷ Faktor); gezeichnet werden nur die vorberechneten Zeilen, der Browser bricht nie selbst um.

import { addDays } from '../../../model/wap/calendar';
import { resolveTitle } from '../../../model/wap/derive/agenda';
import { hasNextDayPart } from '../../../model/wap/layout/entries/spans';
import { layoutGrid } from '../../../model/wap/layout/grid/layout';
import type { GridLayout, GridLineStyles } from '../../../model/wap/layout/grid/types';
import { agendaTextArea } from '../../../model/wap/layout/page/agendaParts';
import { layoutAgendaScreen } from '../../../model/wap/layout/page/agendaScreen';
import { agendaColumns } from '../../../model/wap/layout/page/chromeParts';
import {
  type ColumnHeadLayout,
  layoutColumnHeads,
} from '../../../model/wap/layout/page/columnHeads';
import { pageGeometryFor } from '../../../model/wap/layout/page/geometry';
import type { PageContext, WeekPageLayout } from '../../../model/wap/layout/page/types';
import type { PageItem, Rect as PtRect, TextItem } from '../../../model/wap/layout/pageModel';
import { measureRuns } from '../../../model/wap/layout/text/measure';
import type { StyledRun } from '../../../model/wap/layout/text/types';
import { builtInTemplates, type LevelTemplate } from '../../../model/wap/template';
import type { Entry, Id, IsoDate, Plan, Rgb, Week } from '../../../model/wap/types';
import { type EntryView, RAPPORT_IN_COLUMNS, type Rect } from './entryViews';
import { BASE_DAY_WIDTH, BASE_MINUTE_HEIGHT, type DayBox, type Scale } from './geometry';

/** px je pt bei 100 % (Standardschrift 5 pt = 11 px wie bisher am Bildschirm). */
export const SCREEN_PX_PER_PT = 2.2;

/** px je pt der Zoomstufe: dieselbe Zahl in beiden Richtungen, damit Text und Flächen zusammen skalieren. */
export function screenFactor(scale: Scale): number {
  // Bildschirm = PDF (F-UX2 P1): der Massstab trägt seinen Faktor; nur ältere Massstäbe ohne PDF-Bezug rechnen ihn.
  if (scale.factor !== undefined) return scale.factor;
  return SCREEN_PX_PER_PT * Math.min(scale.day / BASE_DAY_WIDTH, scale.minute / BASE_MINUTE_HEIGHT);
}

/** Ein Lauf einer Bildschirmzeile. */
export interface ScreenRun {
  readonly text: string;
  readonly bold: boolean;
  readonly color: string;
  readonly strike: boolean;
  /** Breite des Laufs in px. */
  readonly widthPx: number;
}

/**
 * Eine vorberechnete Zeile relativ zur Ansicht: Oberkante eine Schriftgrösse über der Grundlinie. Schriftgrösse direkt
 * in px der Zoomstufe (ohne CSS-Skalierung je Zeile: viele transformierte Zeilen machten das Ziehen träge, I2b-A A3).
 */
export interface ScreenLine {
  readonly left: number;
  readonly top: number;
  /** Schriftgrösse in px der Zoomstufe. */
  readonly fontPx: number;
  readonly rotation: 0 | 90 | 270;
  readonly runs: readonly ScreenRun[];
}

/** Formen einer Ansicht als SVG in pt (viewBox), gezeichnet ab der linken oberen Ecke der Ansicht. */
export interface ScreenShapes {
  readonly viewBox: string;
  /** Linke obere Ecke der Ansicht in pt und px je pt. */
  readonly x0: number;
  readonly y0: number;
  readonly factor: number;
  readonly width: number;
  readonly height: number;
  readonly items: readonly Exclude<PageItem, TextItem>[];
  /** Querbalken: auf den Tag zuschneiden; sonst dürfen Rahmen und Beschriftungen über die Ansicht hinausragen. */
  readonly clip: boolean;
}

export interface LayoutRender {
  readonly shapes: ScreenShapes;
  readonly lines: readonly ScreenLine[];
  /**
   * Ansicht aus genau einem gefüllten, gerahmten Rechteck: Füllung und Rahmen trägt das Element der Ansicht selbst
   * (weniger Elemente beim Ziehen, I2b-A A3); `shapes.items` ist dann leer.
   */
  readonly simple: {
    readonly fill: string;
    readonly border: string;
    readonly borderPx: number;
  } | null;
}

function css(c: Rgb): string {
  return `rgb(${String(c.r)} ${String(c.g)} ${String(c.b)})`;
}

function lineOf(t: TextItem, x0: number, y0: number, f: number): ScreenLine {
  return {
    left: (t.x - x0) * f,
    top: (t.baselineY - y0 - t.sizePt) * f,
    fontPx: t.sizePt * f,
    rotation: t.rotation,
    runs: t.runs.map((r) => ({
      text: r.text,
      bold: r.weight === 'bold',
      color: css(r.color),
      strike: r.strike,
      widthPx: measureRuns([{ text: r.text, weight: r.weight }], t.sizePt) * f,
    })),
  };
}

function bounds(item: Exclude<PageItem, TextItem>): PtRect | null {
  if (item.kind === 'rect' || item.kind === 'image') return item.rect;
  if (item.kind === 'line') {
    return {
      x: Math.min(item.x1, item.x2),
      y: Math.min(item.y1, item.y2),
      w: Math.abs(item.x2 - item.x1),
      h: Math.abs(item.y2 - item.y1),
    };
  }
  const nums = item.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  if (xs.length === 0) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function contains(outer: PtRect, inner: PtRect): boolean {
  const e = 0.01;
  return (
    inner.x >= outer.x - e &&
    inner.y >= outer.y - e &&
    inner.x + inner.w <= outer.x + outer.w + e &&
    inner.y + inner.h <= outer.y + outer.h + e
  );
}

/** Ein Eintrag des Tages mit seinen Flächen und Texten in pt. */
interface EntryRender {
  readonly rect: PtRect;
  /** Teilstücke der Ansicht (Trefferflächen, F-UX2 P4). */
  readonly pieces: readonly PtRect[];
  readonly shapes: Exclude<PageItem, TextItem>[];
  readonly texts: TextItem[];
}

/** Layout eines Tages in pt: unabhängig vom Zoom (Bildschirm = PDF, F-UX2 P1); px erst in den Ansichten. */
interface DayLayout {
  readonly layout: GridLayout;
}

const cache = new Map<string, DayLayout>();
/** Letzte Eingabe und Ergebnis je Woche und Tag (Vergleich nach Objektidentität). */
const lastByDay = new Map<
  string,
  { readonly refs: readonly unknown[]; readonly layout: DayLayout }
>();
/** Fertige Ansichten je Tageslayout und Faktor (gleiches Objekt = gleicher Inhalt des Tags). */
const finished = new WeakMap<DayLayout, Map<number, readonly EntryView[]>>();
const CACHE_LIMIT = 64;

function remember(key: string, value: DayLayout): DayLayout {
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, value);
  return value;
}

/** JSON eines Objekts, je Objekt einmal berechnet (Schlüssel des Zwischenspeichers beim Ziehen). */
const jsonOf = new WeakMap<object, string>();
function json(value: object | null): string {
  if (value === null) return 'null';
  const known = jsonOf.get(value);
  if (known !== undefined) return known;
  const text = JSON.stringify(value);
  jsonOf.set(value, text);
  return text;
}

/** IDs der Beso, auf die Titel eines Eintrags verweisen (je Objekt einmal bestimmt; meist leer). */
const refsOf = new WeakMap<Entry, readonly Id[]>();
function besoRefs(e: Entry): readonly Id[] {
  const known = refsOf.get(e);
  if (known !== undefined) return known;
  const titles = [
    ...('title' in e ? [e.title] : []),
    ...(e.type === 'block' ? (e.subtasks ?? []).map((s) => s.title) : []),
  ];
  const ids = [
    ...new Set(
      titles.flatMap((t) => t.flatMap((r) => (r.besoRef === undefined ? [] : [r.besoRef]))),
    ),
  ];
  refsOf.set(e, ids);
  return ids;
}

/**
 * Aufgelöste Verweisnummern der Einträge eines Tages (CR-H-U-01, R-5.3-11): Der Beso kann an einem anderen Tag
 * liegen; seine Nummer gehört deshalb in den Schlüssel des Tageslayouts, sonst bliebe der Tag nach einer
 * Umnummerierung veraltet.
 */
function refNumbers(plan: Plan, own: readonly Entry[]): string {
  const parts: string[] = [];
  for (const e of own) {
    for (const id of besoRefs(e)) {
      const target = plan.entries[id];
      parts.push(`${id}=${target?.type === 'beso' ? String(target.besoNumber) : '-'}`);
    }
  }
  return parts.join(',');
}

/** Eintrag mit gegen den ganzen Plan aufgelösten Verweisen im Titel (wie im PDF, das den ganzen Plan legt). */
function withResolvedTitle(plan: Plan, e: Entry): Entry {
  if (besoRefs(e).length === 0 || !('title' in e)) return e;
  return { ...e, title: resolveTitle(plan, e.title) };
}

/** Linien der Vorlage (Rahmenstärken der Einträge wie im PDF). */
function linesOf(template: LevelTemplate): GridLineStyles {
  return pageGeometryFor(template.pageGeometryId).lines;
}

/**
 * Raster eines Tages aus der Layout-Schicht: die Woche mit allen Querbalken und nur den Einträgen dieses und des
 * Vortags (Fortsetzung über Mitternacht). Zwischengespeichert nach Inhalt, damit beim Ziehen nur der betroffene Tag
 * neu gelegt wird. Verweise «(Nr)» in Titeln werden vorher gegen den ganzen Plan aufgelöst (CR-H-U-01).
 */
function dayLayout(
  plan: Plan,
  weekId: Id,
  date: IsoDate,
  entries: readonly Entry[],
  widthPt: number,
  heightPt: number,
  template: LevelTemplate,
): DayLayout {
  const before = addDays(date, -1);
  const own = entries.filter(
    (e) =>
      e.type === 'querbalken' ||
      ('date' in e && (e.date === date || (e.date === before && hasNextDayPart(e, template)))),
  );
  const week = plan.weeks.find((w) => w.id === weekId);
  const sets = plan.columnSets;
  const numbers = refNumbers(plan, own);
  // Schnellweg: dieselben Objekte wie beim letzten Aufruf für diesen Tag (beim Ziehen die übrigen Tage).
  const refs: readonly unknown[] = [
    plan.id,
    widthPt,
    heightPt,
    plan.displayRange,
    template,
    week?.days,
    sets,
    plan.legend,
    plan.markerLabels,
    plan.persons,
    numbers,
    ...own,
  ];
  const slot = `${weekId}|${date}`;
  const last = lastByDay.get(slot);
  if (
    last !== undefined &&
    last.refs.length === refs.length &&
    last.refs.every((r, i) => r === refs[i])
  ) {
    return last.layout;
  }
  const key = [
    JSON.stringify([plan.id, weekId, date, widthPt, heightPt, plan.displayRange]),
    template.id,
    json(week?.days ?? null),
    json(sets),
    json(plan.legend),
    json(plan.markerLabels),
    json(plan.persons),
    numbers,
    ...own.map(json),
  ].join('');
  const hit = cache.get(key);
  if (hit !== undefined) {
    lastByDay.set(slot, { refs, layout: hit });
    return hit;
  }
  const subset: Plan = {
    ...plan,
    entries: Object.fromEntries(own.map((e) => [e.id, withResolvedTitle(plan, e)])),
  };
  const layout = layoutGrid({
    plan: subset,
    weekId,
    template,
    frame: {
      rect: { x: 0, y: 0, w: widthPt, h: heightPt },
      timeAxisWidthPt: 0,
      dayHeaderHeightPt: 0,
      columnHeaderHeightPt: 0,
      lines: linesOf(template),
    },
    // Status wie im PDF (Beschrieb 10; Leitplanke 2): offen rot, gestrichen rot durchgestrichen.
    showStatus: true,
  });
  const made = remember(key, { layout });
  lastByDay.set(slot, { refs, layout: made });
  return made;
}

/** Flächen und Texte je Eintrag und Ansicht eines Tages. */
function rendersOfDay(day: DayLayout, date: IsoDate): Map<string, EntryRender> {
  const { layout } = day;
  const geo = layout.days.find((d) => d.date === date);
  const out = new Map<string, EntryRender>();
  if (geo === undefined) return out;
  const x0 = geo.x;
  const x1 = geo.x + geo.w;
  const byEntry = new Map<Id, PageItem[]>();
  for (const item of layout.items) {
    if (item.entryId === undefined) continue;
    const list = byEntry.get(item.entryId) ?? [];
    list.push(item);
    byEntry.set(item.entryId, list);
  }
  for (const g of layout.entries) {
    const pieces = g.pieces.filter(
      (p) =>
        (p.kind === 'querbalken' ? p.rect.x < x1 && p.rect.x + p.rect.w > x0 : p.date === date) &&
        p.rect.w > 0,
    );
    if (pieces.length === 0) continue;
    // Ansicht je Beso-Zeitfenster (Kästchen und seine Beschriftung daneben), sonst je Eintrag.
    const keyOf = (i: number): string => {
      const p = pieces[i];
      if (p === undefined) return g.entryId;
      if (g.type === 'beso') {
        const box = p.kind === 'outsideLabel' ? g.pieces[p.part] : p;
        return `${g.entryId}:${box?.windowId ?? ''}`;
      }
      // Rapport «auch/nur in Spalten» (Beschrieb 4.6): der Teil in den Planungsspalten ist eine eigene Ansicht.
      if (g.type === 'rapport' && p.kind === 'block') return `${g.entryId}:${RAPPORT_IN_COLUMNS}`;
      return g.type === 'querbalken' ? `${g.entryId}:${date}` : g.entryId;
    };
    pieces.forEach((p, i) => {
      // Beschriftungen neben dem Kästchen zählen nicht zur bedienbaren Fläche der Ansicht.
      if (p.kind === 'outsideLabel') return;
      const key = keyOf(i);
      const rect: PtRect =
        p.kind === 'querbalken'
          ? {
              x: Math.max(p.rect.x, x0),
              y: p.rect.y,
              w: Math.min(p.rect.x + p.rect.w, x1) - Math.max(p.rect.x, x0),
              h: p.rect.h,
            }
          : p.rect;
      const prev = out.get(key);
      if (prev === undefined) {
        out.set(key, { rect, pieces: [rect], shapes: [], texts: [] });
        return;
      }
      const x = Math.min(prev.rect.x, rect.x);
      const y = Math.min(prev.rect.y, rect.y);
      out.set(key, {
        ...prev,
        pieces: [...prev.pieces, rect],
        rect: {
          x,
          y,
          w: Math.max(prev.rect.x + prev.rect.w, rect.x + rect.w) - x,
          h: Math.max(prev.rect.y + prev.rect.h, rect.y + rect.h) - y,
        },
      });
    });
    // Elemente den Ansichten zuordnen: nach dem Teilstück, das ihre Mitte bzw. ihren Rahmen enthält.
    const owner = (r: PtRect): string | null => {
      const i = pieces.findIndex((p) => contains(p.rect, r) || contains(r, p.rect));
      if (i >= 0) return keyOf(i);
      const j = pieces.findIndex(
        (p) =>
          r.x + r.w / 2 >= p.rect.x - 0.01 &&
          r.x + r.w / 2 <= p.rect.x + p.rect.w + 0.01 &&
          r.y + r.h / 2 >= p.rect.y - 0.01 &&
          r.y + r.h / 2 <= p.rect.y + p.rect.h + 0.01,
      );
      return j >= 0 ? keyOf(j) : null;
    };
    for (const item of byEntry.get(g.entryId) ?? []) {
      if (item.kind === 'text') {
        if (g.type === 'querbalken') {
          // Querbalkentext: genau einmal, am Tag, an dem seine Zeile beginnt.
          if (!(item.x >= x0 - 1e-6 && item.x < x1 - 1e-6)) continue;
        } else if (!pieces.some((p) => contains(p.rect, item.frame))) {
          continue;
        }
        const k =
          g.type === 'querbalken' ? `${g.entryId}:${date}` : (owner(item.frame) ?? keyOf(0));
        out.get(k)?.texts.push(item);
        continue;
      }
      const b = bounds(item);
      if (b === null) continue;
      if (g.type === 'querbalken') {
        if (b.x < x1 && b.x + b.w > x0) out.get(`${g.entryId}:${date}`)?.shapes.push(item);
        continue;
      }
      const k = owner(b);
      if (k !== null) out.get(k)?.shapes.push(item);
    }
  }
  return out;
}

/** Ansicht mit Lage und Darstellung aus der Layout-Schicht (Koordinaten relativ zum Tag in px). */
function withRender(
  view: EntryView,
  r: EntryRender,
  dayX: number,
  yTop: number,
  f: number,
): EntryView {
  const rect: Rect = {
    left: (r.rect.x - dayX) * f,
    top: (r.rect.y - yTop) * f,
    width: r.rect.w * f,
    height: r.rect.h * f,
  };
  const x0 = r.rect.x;
  const y0 = r.rect.y;
  const only = r.shapes.length === 1 ? r.shapes[0] : undefined;
  const simple =
    only !== undefined &&
    only.kind === 'rect' &&
    only.fill !== null &&
    only.stroke !== null &&
    only.stroke.dash === null &&
    view.kind !== 'querbalken' &&
    Math.abs(only.rect.x - x0) < 1e-6 &&
    Math.abs(only.rect.y - y0) < 1e-6 &&
    Math.abs(only.rect.w - r.rect.w) < 1e-6 &&
    Math.abs(only.rect.h - r.rect.h) < 1e-6
      ? { fill: css(only.fill), border: css(only.stroke.color), borderPx: only.stroke.widthPt * f }
      : null;
  const shapes: ScreenShapes = {
    viewBox: `${String(x0)} ${String(y0)} ${String(r.rect.w)} ${String(r.rect.h)}`,
    x0,
    y0,
    factor: f,
    width: rect.width,
    height: rect.height,
    items: simple === null ? r.shapes : [],
    clip: view.kind === 'querbalken',
  };
  return {
    ...view,
    rect,
    pieces: [],
    textPiece: 0,
    hitRects: r.pieces.map((p) => ({
      left: (p.x - dayX) * f,
      top: (p.y - yTop) * f,
      width: p.w * f,
      height: p.h * f,
    })),
    render: { shapes, lines: r.texts.map((t) => lineOf(t, x0, y0, f)), simple },
    ...(r.texts.length > 0 && view.kind === 'querbalken' ? { z: view.z + 1 } : {}),
  };
}

/**
 * Ansichten aller Tage mit Lage, Flächen und Texten aus der Layout-Schicht. Ansichten ohne Fläche am Tag entfallen
 * (wie im PDF: z.B. Querbalken über zwei belegten Lagen, Einträge ausserhalb des Zeitbereichs).
 */
export function layoutViews(input: {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly days: readonly DayBox[];
  readonly entries: readonly Entry[];
  readonly scale: Scale;
  readonly template: LevelTemplate;
  /**
   * Ansichten eines Tages vor dem Layout. Aufgerufen nur für Tage, deren Layout sich geändert hat; beim Ziehen also
   * nur für die Vorschau und die betroffenen Nachbarn (PERF, R-5.1-14).
   */
  readonly viewsOf: (day: DayBox) => readonly EntryView[];
}): Map<IsoDate, readonly EntryView[]> {
  const { plan, weekId, days, entries, scale, template, viewsOf } = input;
  const f = screenFactor(scale);
  const totalWidth = days.reduce((s, d) => s + d.width, 0);
  const height = (plan.displayRange.to - plan.displayRange.from) * scale.minute;
  const out = new Map<IsoDate, readonly EntryView[]>();
  if (totalWidth <= 0 || height <= 0) return out;
  // Rahmen in pt: aus der PDF-Seite, wenn der Massstab ihn trägt (Bildschirm = PDF, F-UX2 P1); sonst aus den px.
  const widthPt = scale.pt?.width ?? totalWidth / f;
  const heightPt = scale.pt?.height ?? height / f;
  for (const day of days) {
    const dl = dayLayout(plan, weekId, day.date, entries, widthPt, heightPt, template);
    const geo = dl.layout.days.find((d) => d.date === day.date);
    if (geo === undefined) continue;
    // Unveränderter Tag (gleiches Layout-Objekt aus dem Zwischenspeicher): dieselben Ansichten, damit React die
    // Zeichnung nicht neu aufbaut (Ziehen ohne Ruckeln, I2b-A A3).
    const byFactor = finished.get(dl) ?? new Map<number, readonly EntryView[]>();
    const known = byFactor.get(f);
    if (known !== undefined) {
      out.set(day.date, known);
      continue;
    }
    const renders = rendersOfDay(dl, day.date);
    const list: EntryView[] = [];
    for (const v of viewsOf(day)) {
      const r = renders.get(v.key);
      if (r === undefined) continue;
      list.push(withRender(v, r, geo.x, dl.layout.timeScale.yTop, f));
    }
    // Wenige Zoomstufen je Tageslayout behalten (Zoom ohne neues Layout, gleiche Umbrüche).
    if (byFactor.size >= 4) byFactor.delete(byFactor.keys().next().value as number);
    byFactor.set(f, list);
    finished.set(dl, byFactor);
    out.set(day.date, list);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Spaltenköpfe (R1)
// ---------------------------------------------------------------------------------------------------------

/** Kopf eines Tages am Bildschirm: Zeilen relativ zum Kopfbereich des Tages. */
export interface ScreenHeads {
  readonly heads: readonly { readonly columnId: Id; readonly lines: readonly ScreenLine[] }[];
  /** Alle Zeilen der Köpfe des Tages (stabil je Berechnung). */
  readonly lines: readonly ScreenLine[];
  /** Mindestens ein Kopf passt nicht in seine Spalte (Befund «zu viele Spalten für diesen Tag»). */
  readonly tooManyColumns: boolean;
  /** Benötigte Höhe des Kopfbereichs in px. */
  readonly heightPx: number;
}

const HEAD_INSET_PT = 0.5;

/**
 * Spaltenköpfe eines Tages mit `layoutColumnHeads` (dieselbe Regel wie im PDF): Kopfhöhe `heightPx`; reicht sie
 * nicht, wächst der Kopfbereich nach unten (statt Kürzung oder Überlappung).
 */
export function screenHeads(
  day: DayBox,
  heightPx: number,
  scale: Scale,
  template: LevelTemplate,
  text: (column: DayBox['columns'][number]['column'], usablePt: number) => string,
): ScreenHeads {
  const f = screenFactor(scale);
  const h = heightPx / f;
  const inputs = day.columns.map((c) => {
    const x = c.left / f + HEAD_INSET_PT;
    const w = c.width / f - 2 * HEAD_INSET_PT;
    const frame: PtRect = { x, y: HEAD_INSET_PT, w, h: h - 2 * HEAD_INSET_PT };
    const system = c.column.kind === 'rap' || c.column.kind === 'beso';
    const runs: StyledRun[] = [{ text: text(c.column, w), weight: 'bold' }];
    return {
      columnId: c.column.id,
      runs: runs[0]?.text === '' ? [] : runs,
      frame,
      frameV: frame,
      prefer:
        !system && c.column.labelOrientation === 'vertical'
          ? ('vertical' as const)
          : ('horizontal' as const),
      hyphenate: system ? ('never' as const) : ('ifWordDoesNotFit' as const),
    };
  });
  const area: PtRect = {
    x: HEAD_INSET_PT,
    y: HEAD_INSET_PT,
    w: day.width / f - 2 * HEAD_INSET_PT,
    h: h - 2 * HEAD_INSET_PT,
  };
  const laid: ColumnHeadLayout[] = layoutColumnHeads(
    inputs,
    { area, extended: { ...area, h: area.h * 4 }, blocked: [] },
    { standard: template.fontSizes.standard, min: template.fontSizes.min },
  );
  let bottom = h;
  for (const l of laid) bottom = Math.max(bottom, l.frame.y + l.frame.h + HEAD_INSET_PT);
  const heads = laid.map((l) => ({
    columnId: l.columnId,
    lines: l.lines.map((line) =>
      lineOf(
        {
          kind: 'text',
          role: 'columnHeader',
          x: line.x,
          baselineY: line.baselineY,
          rotation: line.rotation,
          sizePt: line.sizePt,
          runs: line.runs.map((r) => ({
            text: r.text,
            weight: r.weight,
            color: { r: 23, g: 32, b: 27 },
            strike: false,
          })),
          frame: l.frame,
        },
        0,
        0,
        f,
      ),
    ),
  }));
  return {
    heads,
    lines: heads.flatMap((h) => h.lines),
    tooManyColumns: laid.some((l) => l.result === 'overflow'),
    heightPx: Math.ceil(bottom * f),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Terminbereich (CR-H-U-04)
// ---------------------------------------------------------------------------------------------------------

/** Eine Terminzeile am Bildschirm: Lage in px relativ zum Terminbereich, Zeilen relativ zur Einheit. */
export interface ScreenAgendaUnit {
  readonly entryId: Id;
  readonly top: number;
  readonly height: number;
  readonly lines: readonly ScreenLine[];
}

export interface ScreenAgenda {
  /** Höhe des Terminbereichs in px (Textfläche der Wochenseite in der Zoomstufe). */
  readonly heightPx: number;
  /** Benötigte Höhe aller Zeilen in px (grösser als heightPx: der Bereich rollt). */
  readonly contentPx: number;
  readonly sizePt: number;
  readonly units: readonly ScreenAgendaUnit[];
}

/**
 * Termine eines Tages am Bildschirm aus der Layout-Schicht (CR-H-U-04; ADR-004 Punkt 4): vorberechnete Zeilen mit
 * denselben Regeln wie die Termine der Wochenseite (`layoutAgendaScreen`), Breite = Tagesbreite, Höhe = Textfläche der
 * Termine der Wochenseite; die Zoomstufe skaliert nur (gleiche Umbrüche). Status wie im Raster (Beschrieb 10).
 */
export function screenAgenda(input: {
  readonly plan: Plan;
  readonly date: IsoDate;
  /** Tage der Terminspalte (zusammengefasstes Wochenende: Sa und So; VQA-3-04); fehlt = nur `date`. */
  readonly dates?: readonly IsoDate[];
  readonly widthPx: number;
  readonly availPt: number;
  readonly scale: Scale;
  readonly template: LevelTemplate;
}): ScreenAgenda {
  const { plan, date, widthPx, availPt, scale, template } = input;
  const f = screenFactor(scale);
  const laid = layoutAgendaScreen({
    plan,
    dates: input.dates ?? [date],
    columnWidthPt: widthPx / f,
    availPt,
    template,
    showStatus: true,
  });
  return {
    heightPx: Math.round(availPt * f),
    contentPx: laid.heightPt * f,
    sizePt: laid.sizePt,
    units: laid.units.map((u) => ({
      entryId: u.entryId,
      top: u.top * f,
      height: u.height * f,
      lines: u.lines.map((t) => lineOf(t, 0, u.top, f)),
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Köpfe und Termine aus dem Seitenlayout der Woche (F-UX2 Runde 2, VQA-2-01/-02; Beschrieb 5, R-5-01)
// ---------------------------------------------------------------------------------------------------------

/**
 * Spaltenköpfe am Bildschirm aus derselben Layout-Ausgabe wie das PDF (`layoutWeekPage`): die Kopfzeilen der
 * Wochenseite mit ihrer Trennung, Grösse und Lage, relativ zum Kopfbereich des Tages (VQA-2-01). Höhe = Höhe der
 * Spaltenkopfzeile der Seite in der Zoomstufe; «zu viele Spalten» aus den Rückfallereignissen der Seite.
 */
export function pageHeads(
  page: WeekPageLayout,
  scale: Scale,
  /**
   * Rand zwischen Kopfbereich und Raster in px (Unterkante des Tageskopfs). Angegeben, liegen die Zeilen relativ zur
   * Rasteroberkante wie im PDF, trotz gerundeter Kopfhöhe und Rand (VQA-3-05); fehlt = relativ zum Kopfbereich.
   */
  borderPx?: number,
): Map<IsoDate, ScreenHeads> {
  const f = screenFactor(scale);
  const grid = page.frame.grid;
  const heightPx = Math.max(8, Math.round(grid.columnHeaderHeightPt * f));
  const shift = borderPx === undefined ? 0 : heightPx + borderPx - grid.columnHeaderHeightPt * f;
  const top = grid.rect.y + grid.dayHeaderHeightPt - shift / f;
  const items = (page.pages[0]?.items ?? []).filter(
    (i): i is TextItem => i.kind === 'text' && i.role === 'columnHeader',
  );
  const out = new Map<IsoDate, ScreenHeads>();
  for (const day of page.grid.days) {
    const own = items.filter((t) => t.frame.x >= day.x - 1e-6 && t.frame.x < day.x + day.w - 1e-6);
    const lines = own.map((t) => lineOf(t, day.x, top, f));
    out.set(day.date, {
      heads: [],
      lines,
      tooManyColumns: page.fallbacks.some(
        (e) => e.kind === 'tooManyColumns' && e.date === day.date,
      ),
      heightPx,
    });
  }
  return out;
}

/**
 * Terminspalten der Wochenseite (VQA-3-04): je Spalte die Tage, deren Termine sie zeigt – beim zusammengefassten
 * Wochenende Sa und So in einer Spalte, sonst ein Tag. Dieselbe Regel wie im PDF (`agendaColumns`).
 */
export function pageAgendaColumns(
  page: WeekPageLayout,
  plan: Plan,
  week: Week,
  template: LevelTemplate,
): readonly (readonly IsoDate[])[] {
  const ctx: PageContext = {
    plan,
    week,
    template,
    geometry: pageGeometryFor(template.pageGeometryId),
    frame: page.frame,
    options: { paper: 'A4', showStatus: true, templates: builtInTemplates() },
  };
  return agendaColumns(ctx, page.grid).map((c) => c.dates);
}

/** Terminbereich am Bildschirm wie auf der Wochenseite (VQA-2-02): Lagen relativ zur Rasterunterkante in px. */
export interface ScreenAgendaFrame {
  /** Oberkante der Textfläche (erste Terminzeile) unter der Rasterunterkante. */
  readonly textTopPx: number;
  /** Termine-Oberlinie und «Was»-Linie (Mitte der Linie) und ihre Stärke in pt. */
  readonly topLinePx: number;
  readonly wasLinePx: number;
  readonly lineWidthPt: number;
  /** «Was» je Terminspalte, relativ zur linken Kante des Tages und zur Rasterunterkante. */
  readonly was: ReadonlyMap<IsoDate, readonly ScreenLine[]>;
}

export function pageAgendaFrame(
  page: WeekPageLayout,
  template: LevelTemplate,
  scale: Scale,
): ScreenAgendaFrame {
  const f = screenFactor(scale);
  const g = pageGeometryFor(template.pageGeometryId);
  const pf = page.frame;
  const yTo = pf.grid.rect.y + pf.grid.rect.h;
  const area = agendaTextArea(g, pf, 0);
  const yWas = pf.agenda.y + g.heightsH.agendaHead * pf.h;
  const was = new Map<IsoDate, ScreenLine[]>();
  for (const t of page.pages[0]?.items ?? []) {
    if (t.kind !== 'text' || t.role !== 'agenda' || t.entryId !== undefined || t.rotation !== 0)
      continue;
    const day = page.grid.days.find((d) => t.x >= d.x - 1e-6 && t.x < d.x + d.w - 1e-6);
    if (day === undefined) continue;
    was.set(day.date, [...(was.get(day.date) ?? []), lineOf(t, day.x, yTo, f)]);
  }
  return {
    textTopPx: (area.top - yTo) * f,
    topLinePx: (pf.agenda.y - yTo) * f,
    wasLinePx: (yWas - yTo) * f,
    lineWidthPt: g.pageLines.agendaTop.widthPt,
    was,
  };
}

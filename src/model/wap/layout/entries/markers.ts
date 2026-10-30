// Marker eines Tages: Linie je Lauf und Beschriftungsfeld (Vertrag E1-02d Abschnitt 2c, 2d Nr 5; Änderungsnotizen
// V06 b/c, V11, Runde 2 V15, V16 b, Nachtrag V-02d-18, T1, R2-4, R5-2; Beschrieb 4.6 «Marker»; B-Kp-65 bis -68).

import { MARKER_COLUMNS, markerLabel } from '../../derive/marker';
import { formatMilTime } from '../../time';
import type { Marker } from '../../types';
import { GRID_CONSTANTS } from '../grid/constants';
import { timeToY } from '../grid/geometry';
import type { Rect } from '../pageModel';
import { lineHeightPt } from '../text/metrics';
import type { StyledRun } from '../text/types';
import { type Run, runsOf, selectColumns } from './columns';
import {
  compareEntries,
  type DayContext,
  type Drawable,
  type EntriesContext,
  type PieceDraft,
  type TextSpec,
} from './draft';
import { categoryFill } from './fill';
import { overlaps } from './rects';
import { singleLineRuns, singleLineWidth } from './text';

/** Kategorie der Feldfüllung (B-Kp-67). */
const FIELD_CATEGORY = 'Ltg Kp';
/** Rundungstoleranz bei den Grenzen des Zeitbereichs in pt. */
const EPS = 1e-6;
/**
 * Vorgabe der Dauer des flachen Blocks in Minuten, wenn `Marker.flatBlockMinutes` fehlt (R-4.6-15; H-LAYOUT,
 * Zusatzbefund visual-qa (f): «flacher Block» = Block 0,5 h mit Text wie in der Referenz, ab dem Zeitpunkt).
 */
const FLAT_MINUTES = 30;
/** Kürzeste Dauer des flachen Blocks in Minuten (Raster 5 Min). */
const FLAT_MIN_MINUTES = 5;
/** Feldhöhe, bis zu der ein abgeschnittenes Feld entfällt (T1 c). */
const MIN_FIELD_PT = 0.01;

interface MarkerItem {
  readonly marker: Marker;
  readonly runs: readonly Run[];
  /** y der Linienachse: y(min(max(at, V0), V1)) (R5-2). */
  readonly y: number;
  /** Linienband je Lauf; beim flachen Block dessen Rechteck (Hindernis für die Felder anderer Marker). */
  readonly lines: readonly Rect[];
  readonly head: readonly StyledRun[];
  readonly tail: readonly StyledRun[];
}

type FieldPlacement =
  | { readonly kind: 'free'; readonly rect: Rect }
  | { readonly kind: 'blocked'; readonly rect: Rect; readonly openBottom: boolean }
  | { readonly kind: 'none' };

/** Beschriftung nach `markerLabel`; mit Zuschnitt immer «‹Art› ‹hhmm›» (V01); einzeilig (V11). */
function label(
  ctx: EntriesContext,
  m: Marker,
  clipped: boolean,
): { readonly head: readonly StyledRun[]; readonly tail: readonly StyledRun[] } {
  const kind = m.kind === 'custom' ? m.customKind : m.kind;
  const full = clipped ? `${kind} ${formatMilTime(m.at)}` : markerLabel(m, ctx.plan);
  const tail = full.slice(kind.length);
  return {
    head: singleLineRuns([{ text: kind, weight: 'bold' }]),
    tail: tail === '' ? [] : [{ text: tail, weight: 'bold' }],
  };
}

/** Index des breitesten Laufs (gleich breit: der linke). */
function widest(runs: readonly Run[]): number {
  let best = 0;
  runs.forEach((r, i) => {
    if (r.w > (runs[best] as Run).w + EPS) best = i;
  });
  return best;
}

/** `blocks`: Blockflächen des Tages; das Feld eines Linienmarkers meidet sie, solange es eine freie Lage gibt. */
export function layoutMarkers(
  ctx: EntriesContext,
  day: DayContext,
  blocks: readonly Rect[] = [],
): Drawable[] {
  const lw = ctx.lines.markerLine.widthPt;
  const items: MarkerItem[] = [];
  for (const e of day.entries) {
    if (e.type !== 'marker' || e.date !== day.geo.date) continue;
    // Immer über alle Planungsspalten (MARKER_COLUMNS; Entscheid Auftraggeber 21.10.2026).
    const runs = runsOf(selectColumns(ctx.plan, MARKER_COLUMNS, day.columns), day.geo);
    const at = Math.min(Math.max(e.at, ctx.v0), ctx.v1);
    const y = timeToY(ctx.scale, at);
    const { head, tail } = label(ctx, e, at !== e.at);
    // Flacher Block: seine Rechtecke sind das Hindernis für die Felder anderer Marker (CR-TE-HL-03-01).
    const flat = e.asFlatBlock ? flatSpan(ctx, e) : null;
    items.push({
      marker: e,
      runs,
      y,
      lines: runs.map((r) =>
        flat === null
          ? { x: r.x, y: y - lw / 2, w: r.w, h: lw }
          : { x: r.x, y: flat.y0, w: r.w, h: flat.y1 - flat.y0 },
      ),
      head,
      tail,
    });
  }
  items.sort((a, b) => a.marker.at - b.marker.at || compareEntries(a.marker, b.marker));
  const placed: Rect[] = [];
  return items.map((item) => {
    if (item.marker.asFlatBlock) return flatBlock(ctx, day, item);
    const field = item.runs.length === 0 ? null : placeField(ctx, day, item, items, placed, blocks);
    return drawable(ctx, day, item, field);
  });
}

/**
 * Lage des Felds (2d Nr 5; V15, T1): unter der Linie; läge es unter y(V1) oder schnitte es Linie oder Feld eines
 * anderen Markers, darüber, sofern es dort nicht über y(V0) ragt und nichts schneidet; sonst unten ohne Text,
 * an y(V1) abgeschnitten, bei Höhe ≤ 0,01 pt ohne Feld.
 * GB-LAYOUT 18a (Gate B, VQA-3-03): Vorher wird eine Lage gesucht, die zusätzlich keine Blockfläche überdeckt –
 * unter der Linie, mittig auf der Linie (wie die Referenz), darüber. Gibt es keine, gilt die Regel oben (Marker liegen über Blöcken).
 */
function placeField(
  ctx: EntriesContext,
  day: DayContext,
  item: MarkerItem,
  all: readonly MarkerItem[],
  placed: Rect[],
  blocks: readonly Rect[],
): { readonly run: number; readonly placement: FieldPlacement } {
  const c = GRID_CONSTANTS;
  const run = widest(item.runs);
  const r = item.runs[run] as Run;
  const labelWidth = singleLineWidth([...item.head, ...item.tail], ctx.template.fontSizes.standard);
  const w = Math.min(
    r.w,
    Math.max(c.markerFieldUnits * day.geo.unitPt, labelWidth + 2 * c.textInsetPt),
  );
  const h = Math.max(
    c.markerFieldMinutes * ctx.scale.ptPerMinute,
    lineHeightPt(ctx.template.fontSizes.standard) +
      2 * (c.textInsetPt + ctx.lines.markerFieldBorder.widthPt / 2),
  );
  const x = r.x + (r.w - w) / 2;
  const top = timeToY(ctx.scale, ctx.v0);
  const end = timeToY(ctx.scale, ctx.v1);
  const others = all.filter((o) => o !== item).flatMap((o) => o.lines);
  const blocked = (f: Rect): boolean =>
    others.some((l) => overlaps(l, f)) || placed.some((p) => overlaps(p, f));
  const below: Rect = { x, y: item.y + c.markerFieldGapPt, w, h };
  const above: Rect = { x, y: item.y - c.markerFieldGapPt - h, w, h };
  const middle: Rect = { x, y: item.y - h / 2, w, h };
  const inRange = (f: Rect): boolean => f.y >= top - EPS && f.y + f.h <= end + EPS;
  for (const f of [below, middle, above]) {
    if (inRange(f) && !blocked(f) && !blocks.some((b) => overlaps(b, f))) {
      placed.push(f);
      return { run, placement: { kind: 'free', rect: f } };
    }
  }
  if (below.y + below.h <= end + EPS && !blocked(below)) {
    placed.push(below);
    return { run, placement: { kind: 'free', rect: below } };
  }
  if (above.y >= top - EPS && !blocked(above)) {
    placed.push(above);
    return { run, placement: { kind: 'free', rect: above } };
  }
  const cutHeight = Math.min(below.h, end - below.y);
  if (cutHeight <= MIN_FIELD_PT) return { run, placement: { kind: 'none' } };
  const rect: Rect = { ...below, h: cutHeight };
  placed.push(rect);
  return { run, placement: { kind: 'blocked', rect, openBottom: cutHeight < below.h } };
}

/**
 * Marker als flacher Block (R-4.6-15; H-LAYOUT): je Lauf ein gerahmtes Rechteck in der Farbe des Beschriftungsfelds
 * von at − Dauer bis at (`flatBlockMinutes`, sonst 30 Min; am Anfang des Zeitbereichs ab V0; GB-LAYOUT 17a), die
 * Beschriftung im breitesten Lauf wie in einem Block; kein
 * eigenes Feld, keine Linie.
 */
/** Lage des flachen Blocks: at − Dauer bis at, am Anfang des Zeitbereichs ab V0 (R-4.6-15; GB-LAYOUT 17a). */
function flatSpan(
  ctx: EntriesContext,
  m: Marker,
): { readonly from: number; readonly y0: number; readonly y1: number } {
  const at = Math.min(Math.max(m.at, ctx.v0), ctx.v1);
  const minutes = Math.max(FLAT_MIN_MINUTES, m.flatBlockMinutes ?? FLAT_MINUTES);
  // GB-LAYOUT 17a (Gate B, VQA-2-04): endet auf der genannten Zeit wie die Referenz; am Anfang des Zeitbereichs ab y(V0).
  const from = Math.max(ctx.v0, at - minutes);
  const to = Math.min(ctx.v1, from + minutes);
  return { from, y0: timeToY(ctx.scale, from), y1: timeToY(ctx.scale, to) };
}

function flatBlock(ctx: EntriesContext, day: DayContext, item: MarkerItem): Drawable {
  const m = item.marker;
  const { from, y0, y1 } = flatSpan(ctx, m);
  const carrier = item.runs.length === 0 ? -1 : widest(item.runs);
  const category = ctx.plan.legend.find((k) => k.name === FIELD_CATEGORY)?.id ?? null;
  const pieces: PieceDraft[] = item.runs.map((run, i) => ({
    kind: 'markerLine',
    date: day.geo.date,
    rect: { x: run.x, y: y0, w: run.w, h: y1 - y0 },
    span: { from: m.at, to: m.at },
    part: i,
    windowId: null,
    textCarrier: i === carrier,
    openTop: false,
    openBottom: false,
    continuation: 'none',
    fill: categoryFill(ctx.plan, category),
    stroke: ctx.lines.markerFieldBorder,
    role: 'marker',
    lineY: null,
    text: i === carrier ? { kind: 'singleLine', head: item.head, tail: item.tail } : null,
    obstacle: 'allText',
  }));
  return {
    entryId: m.id,
    type: 'marker',
    group: 5,
    bandLevel: 0,
    date: day.geo.date,
    start: from,
    seq: m.createdSeq,
    sub: 0,
    pieces,
  };
}

function drawable(
  ctx: EntriesContext,
  day: DayContext,
  item: MarkerItem,
  field: { readonly run: number; readonly placement: FieldPlacement } | null,
): Drawable {
  const m = item.marker;
  const span = { from: m.at, to: m.at };
  const lineCarrier = field !== null && field.placement.kind === 'none' ? field.run : -1;
  const base = {
    date: day.geo.date,
    span,
    windowId: null,
    openTop: false,
    continuation: 'none',
    role: 'marker',
    obstacle: 'allText',
  } as const;
  const pieces: PieceDraft[] = item.runs.map((_run, i) => ({
    ...base,
    kind: 'markerLine',
    rect: item.lines[i] as Rect,
    part: i,
    textCarrier: i === lineCarrier,
    openBottom: false,
    fill: null,
    stroke: ctx.lines.markerLine,
    lineY: item.y,
    text: i === lineCarrier ? { kind: 'omitted' } : null,
  }));
  if (field !== null && field.placement.kind !== 'none') {
    const p = field.placement;
    const text: TextSpec =
      p.kind === 'free'
        ? { kind: 'singleLine', head: item.head, tail: item.tail }
        : { kind: 'omitted' };
    const category = ctx.plan.legend.find((k) => k.name === FIELD_CATEGORY)?.id ?? null;
    pieces.push({
      ...base,
      kind: 'markerField',
      rect: p.rect,
      part: field.run,
      textCarrier: true,
      openBottom: p.kind === 'blocked' && p.openBottom,
      fill: categoryFill(ctx.plan, category),
      stroke: ctx.lines.markerFieldBorder,
      lineY: null,
      text,
    });
  }
  return {
    entryId: m.id,
    type: 'marker',
    group: 5,
    bandLevel: 0,
    date: day.geo.date,
    start: Math.min(Math.max(m.at, ctx.v0), ctx.v1),
    seq: m.createdSeq,
    sub: 0,
    pieces,
  };
}

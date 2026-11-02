// Blockartige Einträge eines Tages: Block und Rapport-Block mit Nebeneinander, Aussparung und Textträger
// (Vertrag E1-02d Abschnitt 2b, 2d Nr 2, Nr 3; Änderungsnotizen V06 d, Runde 2 V14, R2-7; Beschrieb 4.6
// «Überdeckung und Ausnahmen»; F-06, F-07, R-4.6-56 bis -60).

import { resolveTitle } from '../../derive/agenda';
import { formatTimeSpec } from '../../time';
import type { Block, Column, Id, Rapport } from '../../types';
import { timeToY } from '../grid/geometry';
import type { ColumnGeometry } from '../grid/types';
import type { Rect } from '../pageModel';
import { type Run, runsOf, selectColumns } from './columns';
import {
  compareEntries,
  type DayContext,
  type Drawable,
  type EntriesContext,
  type PieceDraft,
} from './draft';
import { categoryFill } from './fill';
import { assignSlots, largest, subtract } from './rects';
import { blockSpanSource, type DayPart, dayPart, rapportSpanSource } from './spans';
import { type BlockTextSpec, titleRuns } from './text';

/** Kanten eines Teilstücks gelten als Kante des Elements bis zu dieser Abweichung in pt. */
const EDGE_EPS = 1e-6;

interface Element {
  readonly entry: Block | Rapport;
  readonly part: DayPart;
  readonly columns: readonly Column[];
  readonly ids: ReadonlySet<Id>;
  /** Schlüssel der Spaltenmenge (gleiche Menge ⇔ gleicher Schlüssel, Spalten in Tagesreihenfolge). */
  readonly key: string;
  readonly runs: readonly Run[];
}

function elementOf(ctx: EntriesContext, day: DayContext, entry: Block | Rapport): Element | null {
  const isBlock = entry.type === 'block';
  if (!isBlock && entry.display === 'rapColumn') return null;
  const src = isBlock ? blockSpanSource(entry.time) : rapportSpanSource(entry.time);
  const part = dayPart(src, entry.date, day.geo.date, ctx.v0, ctx.v1);
  if (part === null) return null;
  const sel = isBlock ? entry.columns : entry.displayColumns;
  const columns = selectColumns(ctx.plan, sel, day.columns);
  const runs = runsOf(columns, day.geo);
  if (runs.length === 0) return null;
  return {
    entry,
    part,
    columns,
    ids: new Set(columns.map((c) => c.id)),
    key: columns.map((c) => c.id).join('\u0000'),
    runs,
  };
}

const overlapsInTime = (a: Element, b: Element): boolean =>
  a.part.drawn.from < b.part.drawn.to && b.part.drawn.from < a.part.drawn.to;

const isStrictSubset = (a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean =>
  a.size < b.size && [...a].every((id) => b.has(id));

/** Text eines Blocks bzw. Rapport-Blocks (2e «Blockzeilen»; V06 d). */
function textSpec(ctx: EntriesContext, el: Element): BlockTextSpec {
  const timeLine = el.part.timeLine ? formatTimeSpec(el.entry.time, el.entry.date) : null;
  const ltgMode = ctx.template.ltgInBlock;
  const e = el.entry;
  if (e.type === 'rapport') {
    return {
      timeLine,
      title: titleRuns([{ text: e.code, bold: true }]),
      titleHyphenate: 'never',
      supplement: '',
      ltg: '',
      ort: e.ort.trim(),
      tn: '',
      tenue: '',
      ltgMode,
      direction: 'auto',
      subtasks: [],
    };
  }
  return {
    timeLine,
    title: titleRuns(resolveTitle(ctx.plan, e.title)),
    titleHyphenate: 'ifWordDoesNotFit',
    supplement: e.supplement.trim(),
    ltg: e.ltg.trim(),
    ort: e.ort.trim(),
    tn: e.printTn ? e.tn.trim() : '',
    tenue: e.printTenue ? e.tenue.trim() : '',
    ltgMode,
    direction: e.textDirection,
    // Teilaufgaben (Gate S A1, R-10-47): Titel wie Blocktitel (Verweise mit aktueller Nummer, K-5), immer fett.
    subtasks: (e.subtasks ?? []).map((t) => ({
      title: titleRuns(resolveTitle(ctx.plan, t.title).map((r) => ({ ...r, bold: true }))),
      ltg: t.ltg.trim(),
      ort: t.ort.trim(),
    })),
  };
}

/** Block und Rapport-Block eines Tages (2d Nr 2). */
export function layoutBlocks(ctx: EntriesContext, day: DayContext): Drawable[] {
  const elements: Element[] = [];
  for (const e of day.entries) {
    if (e.type !== 'block' && e.type !== 'rapport') continue;
    const el = elementOf(ctx, day, e);
    if (el !== null) elements.push(el);
  }
  // Nebeneinander: gleiche Spaltenmenge, Stellen in Reihenfolge (a, createdSeq, id).
  const slot = new Map<Element, { readonly k: number; readonly n: number }>();
  const byKey = new Map<string, Element[]>();
  for (const el of elements) byKey.set(el.key, [...(byKey.get(el.key) ?? []), el]);
  for (const group of byKey.values()) {
    const ordered = [...group].sort(
      (a, b) => a.part.drawn.from - b.part.drawn.from || compareEntries(a.entry, b.entry),
    );
    const s = assignSlots(ordered.map((el) => el.part.drawn));
    ordered.forEach((el, i) => {
      slot.set(el, { k: s.slot[i] as number, n: s.count[i] as number });
    });
  }
  // Aussparungen: Spalten der Ausnahme × Zeitschnitt (F-06).
  const holes = new Map<Element, Rect[]>(elements.map((el) => [el, []]));
  const columnGeo = new Map(day.geo.columns.map((c) => [c.columnId, c] as const));
  const cut = (into: Element, ids: readonly Id[], from: number, to: number): void => {
    const y0 = timeToY(ctx.scale, from);
    const y1 = timeToY(ctx.scale, to);
    for (const id of ids) {
      const c = columnGeo.get(id) as ColumnGeometry;
      holes.get(into)?.push({ x: c.x, y: y0, w: c.w, h: y1 - y0 });
    }
  };
  elements.forEach((a, i) => {
    for (const b of elements.slice(i + 1)) {
      if (!overlapsInTime(a, b) || a.key === b.key) continue;
      const shared = a.columns.filter((c) => b.ids.has(c.id)).map((c) => c.id);
      if (shared.length === 0) continue;
      const from = Math.max(a.part.drawn.from, b.part.drawn.from);
      const to = Math.min(a.part.drawn.to, b.part.drawn.to);
      if (isStrictSubset(b.ids, a.ids)) cut(a, shared, from, to);
      else if (isStrictSubset(a.ids, b.ids)) cut(b, shared, from, to);
      else {
        // Teilweise: der später erfasste ist die Ausnahme (F-06).
        const earlier = compareEntries(a.entry, b.entry) < 0 ? a : b;
        cut(earlier, shared, from, to);
      }
    }
  });
  return elements.map((el) => drawable(ctx, day, el, slot.get(el), holes.get(el) ?? []));
}

function drawable(
  ctx: EntriesContext,
  day: DayContext,
  el: Element,
  position: { readonly k: number; readonly n: number } | undefined,
  holes: readonly Rect[],
): Drawable {
  const { k, n } = position ?? { k: 0, n: 1 };
  const y0 = timeToY(ctx.scale, el.part.drawn.from);
  const y1 = timeToY(ctx.scale, el.part.drawn.to);
  const fill = categoryFill(ctx.plan, el.entry.categoryId);
  // Gemeinsame Leitung (R-4.7-03) und offenes Ende (R-4.7-13) nur bei Blöcken (Beschrieb 4.7, 10 «Blöcke»).
  const e = el.entry;
  const secondFill =
    e.type === 'block' && e.secondCategoryId !== null && e.secondCategoryId !== e.categoryId
      ? categoryFill(ctx.plan, e.secondCategoryId)
      : null;
  const openEnd = e.type === 'block' && e.openEnd;
  const spec = textSpec(ctx, el);
  const pieces: PieceDraft[] = [];
  el.runs.forEach((run, r) => {
    const w = run.w / n;
    const rects = subtract({ x: run.x + k * w, y: y0, w, h: y1 - y0 }, holes);
    const carrier = largest(rects);
    rects.forEach((rect, i) => {
      pieces.push({
        kind: 'block',
        date: day.geo.date,
        rect,
        span: el.part.span,
        part: r,
        windowId: null,
        textCarrier: i === carrier,
        openTop: el.part.openTop && Math.abs(rect.y - y0) <= EDGE_EPS,
        openBottom: el.part.openBottom && Math.abs(rect.y + rect.h - y1) <= EDGE_EPS,
        continuation: el.part.continuation,
        fill,
        secondFill,
        wavyBottom: openEnd && !el.part.openBottom && Math.abs(rect.y + rect.h - y1) <= EDGE_EPS,
        stroke: ctx.lines.blockBorder,
        role: 'block',
        lineY: null,
        text: i === carrier ? { kind: 'block', spec } : null,
        obstacle: null,
      });
    });
  });
  return {
    entryId: el.entry.id,
    type: el.entry.type,
    group: 2,
    bandLevel: 0,
    date: day.geo.date,
    start: el.part.drawn.from,
    seq: el.entry.createdSeq,
    sub: 0,
    pieces,
  };
}

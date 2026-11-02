// Rechteck-Hilfen des Raster-Layouts: Schnitt, Aussparung, Textträger, Stellen (Vertrag E1-02d Abschnitt 2d;
// Beschrieb 4.6 «Überdeckung und Ausnahmen»; F-06, F-07, F-62).

import type { Rect } from '../pageModel';

/** Rechtecke mit Breite oder Höhe bis zu diesem Wert entfallen (2d Nr 2). */
const MIN_SIDE_PT = 0.01;
/** Flächen mit höchstens diesem Unterschied gelten als gleich gross (2d Nr 1, 2; F-07). */
const SAME_AREA_PT2 = 0.01;
/** Rechengenauigkeit beim Vergleich von Koordinaten. */
const EPS = 1e-9;

/** Offener Schnitt: positive Überdeckung in x und y (Berührung zählt nicht). */
export function overlaps(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > EPS && h > EPS;
}

/** Rechteck, auf jeder Seite um `d` verkleinert. */
export function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

interface Interval {
  readonly from: number;
  readonly to: number;
}

/** [from, to] ohne die Vereinigung der Intervalle `holes`, aufsteigend. */
function freeIntervals(from: number, to: number, holes: readonly Interval[]): Interval[] {
  const sorted = [...holes].sort((a, b) => a.from - b.from);
  const free: Interval[] = [];
  let cursor = from;
  for (const h of sorted) {
    if (h.to <= cursor) continue;
    if (h.from > cursor) free.push({ from: cursor, to: Math.min(h.from, to) });
    cursor = Math.max(cursor, h.to);
    if (cursor >= to) break;
  }
  if (cursor < to) free.push({ from: cursor, to });
  return free.filter((i) => i.to - i.from > EPS);
}

/**
 * Fläche `r` ohne die Vereinigung der Aussparungen (2d Nr 2 «Teilstücke»): Schnitt an allen y-Kanten der
 * Aussparungen in Streifen, je Streifen die freien x-Abschnitte; senkrecht anschliessende Rechtecke mit gleichem
 * x-Bereich zusammengefasst; Rechtecke mit Breite oder Höhe ≤ 0,01 pt entfallen; Reihenfolge nach y, dann x.
 */
export function subtract(r: Rect, holes: readonly Rect[]): Rect[] {
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const cut = holes
    .filter((h) => overlaps(h, r))
    .map((h) => ({
      x0: Math.max(h.x, r.x),
      x1: Math.min(h.x + h.w, right),
      y0: Math.max(h.y, r.y),
      y1: Math.min(h.y + h.h, bottom),
    }));
  const edges = [r.y, bottom];
  for (const h of cut) edges.push(h.y0, h.y1);
  edges.sort((a, b) => a - b);
  const ys = edges.filter((y, i) => i === 0 || y - (edges[i - 1] as number) > EPS);
  const done: Rect[] = [];
  let open: Rect[] = [];
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i] as number;
    const y1 = ys[i + 1] as number;
    const covering = cut
      .filter((h) => h.y0 <= y0 + EPS && h.y1 >= y1 - EPS)
      .map((h) => ({ from: h.x0, to: h.x1 }));
    const next: Rect[] = [];
    for (const f of freeIntervals(r.x, right, covering)) {
      const k = open.findIndex(
        (o) =>
          Math.abs(o.x - f.from) <= EPS &&
          Math.abs(o.x + o.w - f.to) <= EPS &&
          Math.abs(o.y + o.h - y0) <= EPS,
      );
      if (k >= 0) {
        const o = open[k] as Rect;
        next.push({ x: o.x, y: o.y, w: o.w, h: y1 - o.y });
        open.splice(k, 1);
      } else {
        next.push({ x: f.from, y: y0, w: f.to - f.from, h: y1 - y0 });
      }
    }
    done.push(...open);
    open = next;
  }
  done.push(...open);
  return done
    .filter((p) => p.w > MIN_SIDE_PT && p.h > MIN_SIDE_PT)
    .sort((a, b) => (Math.abs(a.y - b.y) > EPS ? a.y - b.y : a.x - b.x));
}

/**
 * Index des grössten Rechtecks (Unterschied ≤ 0,01 pt² gilt als gleich; dann das linke, dann das obere),
 * -1 bei leerer Liste (R-4.6-57, F-07).
 */
export function largest(rects: readonly Rect[]): number {
  let best = -1;
  rects.forEach((r, i) => {
    const b = rects[best];
    if (b === undefined) {
      best = i;
      return;
    }
    const diff = r.w * r.h - b.w * b.h;
    if (diff > SAME_AREA_PT2) best = i;
    else if (diff >= -SAME_AREA_PT2) {
      if (r.x < b.x - EPS || (Math.abs(r.x - b.x) <= EPS && r.y < b.y - EPS)) best = i;
    }
  });
  return best;
}

/** Spanne in Minuten oder pt für die Stellenvergabe. */
export interface Span1D {
  readonly from: number;
  readonly to: number;
}

const spansOverlap = (a: Span1D, b: Span1D): boolean => a.from < b.to && b.from < a.to;

/**
 * Stellen für Elemente in der gegebenen Reihenfolge (2d Nr 2 «Nebeneinander», Nr 3, Nr 4): jedes erhält die
 * kleinste Stelle k ohne Überschneidung (Berührung zählt nicht) mit Elementen derselben Stelle; `count` = Anzahl
 * Stellen der über Überschneidung zusammenhängenden Gruppe des Elements.
 */
export function assignSlots(spans: readonly Span1D[]): {
  readonly slot: readonly number[];
  readonly count: readonly number[];
} {
  const slot: number[] = [];
  spans.forEach((s, i) => {
    let k = 0;
    while (spans.some((o, j) => j < i && slot[j] === k && spansOverlap(s, o))) k++;
    slot.push(k);
  });
  // Gruppen über Überschneidung (Vereinigungssuche).
  const parent = spans.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    return r;
  };
  spans.forEach((s, i) => {
    spans.forEach((o, j) => {
      if (j > i && spansOverlap(s, o)) parent[root(j)] = root(i);
    });
  });
  const maxSlot = new Map<number, number>();
  spans.forEach((_, i) => {
    const r = root(i);
    maxSlot.set(r, Math.max(maxSlot.get(r) ?? 0, slot[i] as number));
  });
  return { slot, count: spans.map((_, i) => (maxSlot.get(root(i)) ?? 0) + 1) };
}

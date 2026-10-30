// Beschriftung neben dem Kästchen (Paket E1-02l, R-10-55; Auftraggeber R2 vom 09.10.2026): Rapportkürzel und
// Beso-Nummer werden nie gekürzt. Passt der Text auch in Mindestgrösse nicht ins Kästchen, steht er vollständig in
// einem eigenen Träger daneben, im nächsten freien Bereich des Tages; nie über fremdem Text oder einem Kästchen.
// Rein und deterministisch (Leitplanke 2).

import type { Rect, TextItem } from '../pageModel';
import { measureRuns } from '../text/measure';
import { ascentPt, fontMetrics, lineHeightPt } from '../text/metrics';
import { overlaps } from './rects';

/** Abstand des Trägers zum Kästchen und zu Hindernissen in pt. */
const GAP_PT = 0.5;
/** Schritt der Suche entlang einer Seite des Kästchens in pt. */
const STEP_PT = 1;
/** Grösster Suchabstand vom Kästchen in pt. */
const REACH_PT = 30;
/** Abstände von der Kästchenseite, in denen gesucht wird (nah fein, fern grob). */
const GAPS_PT: readonly number[] = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 11, 15, 20, 25, 30];

/** Umriss einer Zeile (Ober- bis Unterlänge) im Seitenkoordinatensystem. */
export function textBounds(t: TextItem): Rect {
  const m = fontMetrics();
  const a = ascentPt(t.sizePt);
  const d = (-m.descender * t.sizePt) / m.unitsPerEm;
  const w = t.runs.reduce(
    (s, r) => s + measureRuns([{ text: r.text, weight: r.weight }], t.sizePt),
    0,
  );
  if (t.rotation === 0) return { x: t.x, y: t.baselineY - a, w, h: a + d };
  if (t.rotation === 90) return { x: t.x - a, y: t.baselineY - w, w: a + d, h: w };
  return { x: t.x - d, y: t.baselineY, w: a + d, h: w };
}

export interface LabelSearch {
  /** Kästchen, neben das die Beschriftung kommt. */
  readonly box: Rect;
  /** Breite und Höhe des Trägers. */
  readonly w: number;
  readonly h: number;
  /** Erlaubter Bereich: Tag und Zeitbereich ohne Band. */
  readonly bounds: Rect;
  /** Nie überdecken: Kästchen, Marker, Texte, andere Träger. */
  readonly hard: readonly Rect[];
  /** Zuerst meiden: Blockflächen (im zweiten Durchgang erlaubt, wie ein Beso-Kästchen über einem Block). */
  readonly soft: readonly Rect[];
}

function grown(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

function inside(r: Rect, b: Rect): boolean {
  const e = 1e-6;
  return (
    r.x >= b.x - e && r.y >= b.y - e && r.x + r.w <= b.x + b.w + e && r.y + r.h <= b.y + b.h + e
  );
}

/** Abstand zwischen zwei Rechtecken (0 bei Berührung oder Schnitt). */
function distance(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/** Versatz einer Lage relativ zur linken oberen Ecke des Kästchens. */
interface Offset {
  readonly dx: number;
  readonly dy: number;
}

/** Sortierte Versätze je Kästchen- und Trägergrösse (rein; Zwischenspeicher spart das Sortieren). */
const offsetCache = new Map<string, readonly Offset[]>();

/** Lagen rund um das Kästchen, nach Abstand zum Kästchen (bei Gleichstand: rechts, links, unten, oben). */
function offsets(boxW: number, boxH: number, w: number, h: number): readonly Offset[] {
  const key = `${String(boxW)}|${String(boxH)}|${String(w)}|${String(h)}`;
  const known = offsetCache.get(key);
  if (known !== undefined) return known;
  const box: Rect = { x: 0, y: 0, w: boxW, h: boxH };
  const out: { o: Offset; d: number; k: number }[] = [];
  let k = 0;
  const push = (dx: number, dy: number): void => {
    out.push({ o: { dx, dy }, d: distance({ x: dx, y: dy, w, h }, box), k: k++ });
  };
  const cy = boxH / 2 - h / 2;
  const cx = boxW / 2 - w / 2;
  for (const gap of GAPS_PT) {
    for (let off = 0; off <= REACH_PT; off += STEP_PT) {
      for (const o of off === 0 ? [0] : [off, -off]) {
        push(boxW + gap, cy + o);
        push(-gap - w, cy + o);
        push(cx + o, boxH + gap);
        push(cx + o, -gap - h);
      }
    }
  }
  out.sort((a, b) => a.d - b.d || a.k - b.k);
  const sorted = out.map((c) => c.o);
  if (offsetCache.size > 500) offsetCache.clear();
  offsetCache.set(key, sorted);
  return sorted;
}

/**
 * Lagen im ganzen Tag (H-LAYOUT, Zusatzbefund visual-qa (d)): rechts, links und mittig zum Kästchen, senkrecht über
 * die ganze Höhe von `bounds` in STEP_PT-Schritten, nach Abstand zum Kästchen.
 */
function farOffsets(s: LabelSearch): Offset[] {
  const xs = [s.box.w + GAP_PT, -GAP_PT - s.w, s.box.w / 2 - s.w / 2];
  const box: Rect = { x: 0, y: 0, w: s.box.w, h: s.box.h };
  const out: { o: Offset; d: number; k: number }[] = [];
  let k = 0;
  for (let y = s.bounds.y; y + s.h <= s.bounds.y + s.bounds.h + 1e-6; y += STEP_PT) {
    for (const dx of xs) {
      const o = { dx, dy: y - s.box.y };
      out.push({ o, d: distance({ x: o.dx, y: o.dy, w: s.w, h: s.h }, box), k: k++ });
    }
  }
  out.sort((a, b) => a.d - b.d || a.k - b.k);
  return out.map((c) => c.o);
}

/**
 * Nächste freie Lage des Trägers: innerhalb `bounds`, ohne Schnitt mit `hard` (mit Abstand); ohne `allowSoft` auch
 * ohne Schnitt mit `soft` (Blockflächen), sonst zuerst ohne. `far`: im ganzen Tag statt nur nahe am Kästchen
 * (H-LAYOUT). null, wenn es keine solche Lage gibt.
 */
/** In den Bereich geschoben (nur für die Suche am Kästchen, F-LAYOUT2 Runde 2). */
function clampInto(r: Rect, b: Rect): Rect {
  return {
    ...r,
    x: Math.min(Math.max(r.x, b.x), b.x + b.w - r.w),
    y: Math.min(Math.max(r.y, b.y), b.y + b.h - r.h),
  };
}

/**
 * Unmittelbar am Kästchen (F-LAYOUT2 Runde 2, VQA-2-03/-07): Abstand höchstens `gap` und gemeinsame Projektion –
 * waagrecht (darüber oder darunter) bzw. senkrecht (links oder rechts).
 */
function adjacentTo(r: Rect, box: Rect, gap: number): boolean {
  const x = Math.min(r.x + r.w, box.x + box.w) - Math.max(r.x, box.x);
  const y = Math.min(r.y + r.h, box.y + box.h) - Math.max(r.y, box.y);
  return (x > 0.01 || y > 0.01) && distance(r, box) <= gap + 1e-6;
}

export function findLabelSpot(
  s: LabelSearch,
  opts: {
    readonly allowSoft?: boolean;
    readonly far?: boolean;
    /** Nur Lagen unmittelbar am Kästchen (Abstand ≤ Wert, gemeinsame Projektion); ausserhalb des Bereichs geschoben. */
    readonly adjacent?: number;
  } = {},
): Rect | null {
  const near = opts.far === true ? s.bounds : grown(s.box, REACH_PT + Math.max(s.w, s.h) + GAP_PT);
  const hard = s.hard.filter((r) => overlaps(r, near)).map((r) => grown(r, GAP_PT - 1e-6));
  const soft = s.soft.filter((r) => overlaps(r, near));
  let first: Rect | null = null;
  const list = opts.far === true ? farOffsets(s) : offsets(s.box.w, s.box.h, s.w, s.h);
  for (const o of list) {
    let r: Rect = { x: s.box.x + o.dx, y: s.box.y + o.dy, w: s.w, h: s.h };
    if (opts.adjacent !== undefined) {
      if (!inside(r, s.bounds)) r = clampInto(r, s.bounds);
      if (!adjacentTo(r, s.box, opts.adjacent)) continue;
    }
    if (!inside(r, s.bounds) || hard.some((o) => overlaps(o, r))) continue;
    if (!soft.some((o) => overlaps(o, r))) return r;
    first ??= r;
  }
  return opts.allowSoft === false ? null : first;
}

/** Träger für den Fall ohne freie Lage: rechts neben dem Kästchen, in den Bereich geschoben. */
export function fallbackSpot(s: LabelSearch): Rect {
  const x = Math.min(
    Math.max(s.box.x + s.box.w + GAP_PT, s.bounds.x),
    s.bounds.x + s.bounds.w - s.w,
  );
  const y = Math.min(
    Math.max(s.box.y + s.box.h / 2 - s.h / 2, s.bounds.y),
    s.bounds.y + s.bounds.h - s.h,
  );
  return { x, y, w: s.w, h: s.h };
}

/** Breite und Höhe der Textzeile einer Beschriftung. */
export function labelLineSize(
  runs: readonly { readonly text: string; readonly weight: 'regular' | 'bold' }[],
  sizePt: number,
): { readonly w: number; readonly h: number } {
  return { w: measureRuns(runs, sizePt), h: lineHeightPt(sizePt) };
}

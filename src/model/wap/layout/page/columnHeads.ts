// Spaltenköpfe eines Tages ohne Kürzung (Paket E1-02l, R-10-54; Auftraggeber R1 vom 09.10.2026; Beschrieb 10
// «Schrift», 4.4). Gemeinsame Regel für PDF und Bildschirm (ADR-004, Leitplanke 2): rein und deterministisch.
//
// Reihenfolge je Kopf (Entscheid Auftraggeber 14.10.2026 «2 a», wie Referenz B-Kp-31): zuerst die bevorzugte
// Ausrichtung (waagrecht, mit Umbruch an Wortgrenzen) in allen Grössenstufen von der Standardgrösse bis zur
// Mindestgrösse; die andere Ausrichtung nur, wenn die bevorzugte auch in Mindestgrösse nicht passt. Passt der Kopf auch in Mindestgrösse nicht in seine Spalte, wird er trotzdem vollständig in
// Mindestgrösse gezeichnet: senkrecht oder waagrecht umbrochen, wenn nötig über die Spalte hinaus in den freien
// Kopfbereich des Tages, nie über einen anderen Kopf. Dieser Fall ist der Befund «zu viele Spalten für diesen Tag».
// H-LAYOUT: Finden alle überlaufenden Köpfe eines Tages im Kopfbereich Platz, bleiben sie dort (nie unter die
// Kopf-Unterlinie); nur sonst ragen sie wie bisher ins freie Band.

import type { Id } from '../../types';
import type { Rect } from '../pageModel';
import { breakText } from '../text/break';
import { measureRuns } from '../text/measure';
import { ascentPt, fontMetrics, lineHeightPt } from '../text/metrics';
import type { StyledRun } from '../text/types';

export type ColumnHeadOrientation = 'horizontal' | 'vertical';

export interface ColumnHeadInput {
  readonly columnId: Id;
  /** Kopftext (fett); leer = kein Kopf. */
  readonly runs: readonly StyledRun[];
  /** Waagrechte Textfläche in der Spalte. */
  readonly frame: Rect;
  /** Senkrechte Textfläche in der Spalte; ihre Höhe ist die Zeilenlänge, die Grundlinie beginnt unten. */
  readonly frameV: Rect;
  readonly prefer: ColumnHeadOrientation;
  /** 'never' für Rap- und Beso-Köpfe (einzelne Wörter, nie getrennt). */
  readonly hyphenate: 'ifWordDoesNotFit' | 'never';
}

export interface ColumnHeadLine {
  readonly runs: readonly StyledRun[];
  readonly x: number;
  readonly baselineY: number;
  readonly rotation: 0 | 90;
  readonly sizePt: number;
}

export interface ColumnHeadLayout {
  readonly columnId: Id;
  readonly orientation: ColumnHeadOrientation;
  readonly sizePt: number;
  readonly lines: readonly ColumnHeadLine[];
  /**
   * 'fits' in Standardgrösse, 'reduced' verkleinert; 'overflow' = passt auch in Mindestgrösse nicht in die Spalte
   * (R1: vollständig gezeichnet, Befund am Spaltensatz).
   */
  readonly result: 'fits' | 'reduced' | 'overflow';
  /** Rahmen der Zeilen: Textfläche der Spalte bzw. bei 'overflow' die belegte Fläche im Kopfbereich. */
  readonly frame: Rect;
}

export interface ColumnHeadSizes {
  readonly standard: number;
  readonly min: number;
}

const EPS = 1e-6;
/** Schritt der Grössenstufen (V-02d-8). */
const STEP = 0.25;
/** Abstand zwischen Köpfen, die über ihre Spalte hinausragen, in pt. */
const GAP_PT = 0.5;
/** Schritt beim Verbreitern bzw. Verschieben eines überlaufenden Kopfs in pt. */
const SEARCH_STEP_PT = 0.5;

function steps(standard: number, min: number): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const s = Math.max(min, standard - i * STEP);
    out.push(s);
    if (s <= min) return out;
  }
}

function descent(sizePt: number): number {
  const m = fontMetrics();
  return (-m.descender * sizePt) / m.unitsPerEm;
}

interface Broken {
  readonly lines: readonly (readonly StyledRun[])[];
  readonly widths: readonly number[];
  readonly fits: boolean;
}

function broken(
  runs: readonly StyledRun[],
  maxWidth: number,
  size: number,
  h: ColumnHeadInput['hyphenate'],
): Broken {
  const r = breakText(runs, { maxWidthPt: maxWidth, sizePt: size, hyphenate: h });
  return { lines: r.lines.map((l) => l.runs), widths: r.lines.map((l) => l.widthPt), fits: r.fits };
}

/** Passt der Text in dieser Grösse und Ausrichtung ganz in die Textfläche der Spalte? */
function attempt(head: ColumnHeadInput, o: ColumnHeadOrientation, size: number): Broken | null {
  const f = o === 'horizontal' ? head.frame : head.frameV;
  const length = o === 'horizontal' ? f.w : f.h;
  const cross = o === 'horizontal' ? f.h : f.w;
  if (!(length > 0.01 && cross > 0.01)) return null;
  const b = broken(head.runs, length, size, head.hyphenate);
  if (!b.fits || b.lines.length * lineHeightPt(size) > cross + EPS) return null;
  return b;
}

/** Zeilen einer Ausrichtung in der Fläche `box`: waagrecht senkrecht zentriert, senkrecht waagrecht zentriert. */
function place(
  b: Broken,
  o: ColumnHeadOrientation,
  size: number,
  box: Rect,
  baseline: number,
): ColumnHeadLine[] {
  const lh = lineHeightPt(size);
  const asc = ascentPt(size);
  if (o === 'horizontal') {
    const top = box.y + (box.h - b.lines.length * lh) / 2;
    return b.lines.map((runs, i) => ({
      runs,
      x: box.x + (box.w - (b.widths[i] as number)) / 2,
      baselineY: top + i * lh + asc,
      rotation: 0,
      sizePt: size,
    }));
  }
  const left = box.x + (box.w - b.lines.length * lh) / 2;
  return b.lines.map((runs, i) => ({
    runs,
    x: left + i * lh + asc,
    baselineY: baseline,
    rotation: 90,
    sizePt: size,
  }));
}

/** Zeilenkästen (Zeilenhöhe hhea) der Zeilen: Rahmen eines überlaufenden Kopfs. */
function lineBoxes(lines: readonly ColumnHeadLine[]): Rect | null {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const l of lines) {
    const w = measureRuns(l.runs, l.sizePt);
    const a = ascentPt(l.sizePt);
    const lh = lineHeightPt(l.sizePt);
    const r =
      l.rotation === 0
        ? { x: l.x, y: l.baselineY - a, w, h: lh }
        : { x: l.x - a, y: l.baselineY - w, w: lh, h: w };
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return lines.length === 0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Umriss der Zeilen (Ober- bis Unterlänge). */
export function headBounds(lines: readonly ColumnHeadLine[]): Rect | null {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const l of lines) {
    const w = measureRuns(l.runs, l.sizePt);
    const a = ascentPt(l.sizePt);
    const d = descent(l.sizePt);
    const r =
      l.rotation === 0
        ? { x: l.x, y: l.baselineY - a, w, h: a + d }
        : { x: l.x - a, y: l.baselineY - w, w: a + d, h: w };
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return lines.length === 0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function overlap(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > -GAP_PT + EPS && h > -GAP_PT + EPS;
}

/** Kopf in seiner Spalte (Normalfall) oder null, wenn er auch in Mindestgrösse nicht passt. */
function fitInColumn(head: ColumnHeadInput, sizes: ColumnHeadSizes): ColumnHeadLayout | null {
  const order: readonly ColumnHeadOrientation[] =
    head.prefer === 'vertical' ? ['vertical', 'horizontal'] : ['horizontal', 'vertical'];
  for (const o of order) {
    for (const [i, size] of steps(sizes.standard, sizes.min).entries()) {
      const b = attempt(head, o, size);
      if (b === null) continue;
      const frame = o === 'horizontal' ? head.frame : head.frameV;
      return {
        columnId: head.columnId,
        orientation: o,
        sizePt: size,
        lines: place(b, o, size, head.frame, head.frameV.y + head.frameV.h),
        result: i === 0 ? 'fits' : 'reduced',
        frame,
      };
    }
  }
  return null;
}

/** Darstellung eines überlaufenden Kopfs in Mindestgrösse, unabhängig von der Lage. */
interface Shape {
  readonly orientation: ColumnHeadOrientation;
  readonly b: Broken;
  readonly w: number;
  readonly h: number;
}

/** Waagrecht umbrochen bei wachsender Breite bzw. senkrecht bei der Länge `length`, je höchstens `maxH` hoch. */
function shapes(
  head: ColumnHeadInput,
  min: number,
  maxW: number,
  maxH: number,
  lengths: readonly number[],
): Shape[] {
  const lh = lineHeightPt(min);
  if (head.hyphenate === 'never') {
    // Rap- und Beso-Kopf: ein Wort, immer einzeilig (S3-20), waagrecht oder senkrecht.
    const one = broken(head.runs, Number.POSITIVE_INFINITY, min, 'never');
    const w = Math.max(...one.widths);
    const single: Shape[] = [
      { orientation: 'horizontal', b: one, w, h: lh },
      { orientation: 'vertical', b: one, w: lh, h: w },
    ];
    return single.filter((c) => c.w <= maxW + EPS && c.h <= maxH + EPS);
  }
  const horizontal: Shape[] = [];
  for (let w = Math.max(head.frame.w, 0.02); ; w += SEARCH_STEP_PT) {
    const width = Math.min(w, maxW);
    const b = broken(head.runs, width, min, head.hyphenate);
    const h = b.lines.length * lh;
    if (h <= maxH + EPS) {
      horizontal.push({ orientation: 'horizontal', b, w: Math.max(...b.widths), h });
      if (b.fits) break;
    }
    if (width >= maxW) break;
  }
  const vertical: Shape[] = lengths
    .filter((l) => l > 0.01 && l <= maxH + EPS)
    .map((l) => {
      const b = broken(head.runs, l, min, head.hyphenate);
      return { orientation: 'vertical' as const, b, w: b.lines.length * lh, h: l };
    })
    .filter((v) => v.w <= maxW + EPS);
  return head.prefer === 'vertical' ? [...vertical, ...horizontal] : [...horizontal, ...vertical];
}

/** Zeilen einer Darstellung mit der oberen linken Ecke (x, y). */
function linesAt(s: Shape, min: number, x: number, y: number): ColumnHeadLine[] {
  const lh = lineHeightPt(min);
  const asc = ascentPt(min);
  if (s.orientation === 'horizontal') {
    return s.b.lines.map((runs, i) => ({
      runs,
      x: x + (s.w - (s.b.widths[i] as number)) / 2,
      baselineY: y + i * lh + asc,
      rotation: 0,
      sizePt: min,
    }));
  }
  return s.b.lines.map((runs, i) => ({
    runs,
    x: x + i * lh + asc,
    baselineY: y + s.h,
    rotation: 90,
    sizePt: min,
  }));
}

/** Freiraum für überlaufende Köpfe (E1-02l R1). */
export interface HeadSpace {
  /** Kopfbereich des Tages (alle Spalten, Höhe der Spaltenköpfe). */
  readonly area: Rect;
  /**
   * Erweiterter Bereich (Kopfbereich und darunter freier Platz, z.B. das Querbalken-Band); null = keiner. Nur
   * genutzt, wenn der Kopfbereich allein nicht reicht.
   */
  readonly extended: Rect | null;
  /** Belegte Flächen im erweiterten Bereich (Querbalken, Einträge, Texte). */
  readonly blocked: readonly Rect[];
}

/**
 * Lage eines überlaufenden Kopfs (E1-02l R1): mittig über der eigenen Spalte, zuerst im Kopfbereich, dann nach unten
 * in den freien Platz unter dem Kopf (`space.extended`); erst wenn das nirgends frei ist, seitlich verschoben. Zuerst
 * Darstellungen ohne Notumbruch. Nie über einem anderen Kopf oder einer belegten Fläche, solange eine freie Lage
 * existiert; sonst (Befund bleibt) die erste Darstellung über der Spalte. Der Rahmen umschliesst genau die Zeilen.
 */
function placeOverflow(
  head: ColumnHeadInput,
  space: HeadSpace,
  min: number,
  taken: readonly Rect[],
): ColumnHeadLayout {
  const center = head.frame.x + head.frame.w / 2;
  const region = space.extended ?? space.area;
  const make = (sh: Shape, x: number, y: number): ColumnHeadLayout => {
    const lines = linesAt(sh, min, x, y);
    return {
      columnId: head.columnId,
      orientation: sh.orientation,
      sizePt: min,
      lines,
      result: 'overflow',
      frame: lineBoxes(lines) ?? { x, y, w: sh.w, h: sh.h },
    };
  };
  const all = shapes(head, min, region.w, region.h, [head.frameV.h, region.h]);
  const free = (b: Rect, inHead: boolean): boolean =>
    !taken.some((t) => overlap(t, b)) && (inHead || !space.blocked.some((t) => overlap(t, b)));
  let fallback: ColumnHeadLayout | null = null;
  for (const sideways of [false, true]) {
    for (const pass of [true, false]) {
      for (const sh of all.filter((c) => c.b.fits === pass)) {
        const rel = headBounds(linesAt(sh, min, 0, 0));
        const maxX = region.x + region.w - sh.w;
        const x0 = center - sh.w / 2;
        const xs: number[] = [];
        if (!sideways) {
          if (x0 >= region.x - EPS && x0 <= maxX + EPS) xs.push(x0);
        } else {
          for (let d = 0; d <= region.w; d += SEARCH_STEP_PT) {
            for (const x of d === 0 ? [x0] : [x0 - d, x0 + d]) {
              if (x >= region.x - EPS && x <= maxX + EPS) xs.push(x);
            }
          }
        }
        if (xs.length === 0) continue;
        const ys: number[] = [];
        if (sh.h <= space.area.h + EPS) ys.push(space.area.y + (space.area.h - sh.h) / 2);
        for (let y = region.y; y + sh.h <= region.y + region.h + EPS; y += SEARCH_STEP_PT)
          ys.push(y);
        for (const y of ys) {
          const inHead = y + sh.h <= space.area.y + space.area.h + EPS;
          for (const x of xs) {
            if (rel === null) return make(sh, x, y);
            const b: Rect = { x: rel.x + x, y: rel.y + y, w: rel.w, h: rel.h };
            if (free(b, inHead)) return make(sh, x, y);
            fallback ??= make(sh, x, y);
          }
        }
      }
    }
  }
  if (fallback !== null) return fallback;
  const v = broken(head.runs, Math.max(head.frameV.h, 0.02), min, head.hyphenate);
  const sh: Shape = {
    orientation: 'vertical',
    b: v,
    w: v.lines.length * lineHeightPt(min),
    h: head.frameV.h,
  };
  return make(sh, center - sh.w / 2, head.frameV.y);
}

/**
 * Lage eines überlaufenden Kopfs ganz im Kopfbereich (H-LAYOUT, Entscheid «2 a»): wie placeOverflow, aber nur mit
 * Darstellungen bis zur Höhe des Kopfbereichs, senkrecht darin zentriert; null, wenn es dort keine freie Lage gibt.
 */
function placeInHead(
  head: ColumnHeadInput,
  area: Rect,
  min: number,
  taken: readonly Rect[],
): ColumnHeadLayout | null {
  const center = head.frame.x + head.frame.w / 2;
  const all = shapes(head, min, area.w, area.h, [head.frameV.h, area.h]);
  for (const sideways of [false, true]) {
    for (const pass of [true, false]) {
      for (const sh of all.filter((c) => c.b.fits === pass)) {
        const rel = headBounds(linesAt(sh, min, 0, 0));
        const maxX = area.x + area.w - sh.w;
        const x0 = center - sh.w / 2;
        const xs: number[] = [];
        for (let d = 0; d <= (sideways ? area.w : 0); d += SEARCH_STEP_PT) {
          for (const x of d === 0 ? [x0] : [x0 - d, x0 + d]) {
            if (x >= area.x - EPS && x <= maxX + EPS) xs.push(x);
          }
        }
        const y = area.y + (area.h - sh.h) / 2;
        for (const x of xs) {
          const lines = linesAt(sh, min, x, y);
          const b = rel === null ? null : { x: rel.x + x, y: rel.y + y, w: rel.w, h: rel.h };
          if (b !== null && taken.some((t) => overlap(t, b))) continue;
          return {
            columnId: head.columnId,
            orientation: sh.orientation,
            sizePt: min,
            lines,
            result: 'overflow',
            frame: lineBoxes(lines) ?? { x, y, w: sh.w, h: sh.h },
          };
        }
      }
    }
  }
  return null;
}

/** Lage der Köpfe eines Tages bei gegebener Kopfhöhe (F-LAYOUT2 Punkt 11, Höhe der Kopfzeile). */
export type HeadsFit = 'columns' | 'area' | 'none';

/**
 * 'columns': jeder Kopf passt in seine Spalte (kein Befund «zu viele Spalten»); 'area': alle überlaufenden Köpfe
 * finden eine freie Lage ganz im Kopfbereich `area` (H-LAYOUT); 'none': mindestens ein Kopf ragt darunter hinaus.
 * Dieselben Regeln wie layoutColumnHeads.
 */
export function headsFit(
  heads: readonly ColumnHeadInput[],
  area: Rect,
  sizes: ColumnHeadSizes,
): HeadsFit {
  const laid = heads.map((h) => (h.runs.length === 0 ? null : fitInColumn(h, sizes)));
  if (heads.every((h, i) => h.runs.length === 0 || laid[i] !== null)) return 'columns';
  const taken: Rect[] = [];
  for (const l of laid) {
    const b = l === null ? null : headBounds(l.lines);
    if (b !== null) taken.push(b);
  }
  for (const [i, h] of heads.entries()) {
    if (h.runs.length === 0 || laid[i] !== null) continue;
    const l = placeInHead(h, area, sizes.min, taken);
    if (l === null) return 'none';
    const b = headBounds(l.lines);
    if (b !== null) taken.push(b);
  }
  return 'area';
}

/**
 * Köpfe eines Tages. Passt ein Kopf auch in Mindestgrösse nicht in seine Spalte, steht er vollständig im Freiraum
 * `space` (Ergebnis 'overflow'). Reihenfolge der Ausgabe = Reihenfolge der Eingabe.
 */
export function layoutColumnHeads(
  heads: readonly ColumnHeadInput[],
  space: HeadSpace,
  sizes: ColumnHeadSizes,
): ColumnHeadLayout[] {
  const out: (ColumnHeadLayout | null)[] = heads.map((h) =>
    h.runs.length === 0
      ? {
          columnId: h.columnId,
          orientation: h.prefer,
          sizePt: sizes.standard,
          lines: [],
          result: 'fits',
          frame: h.frame,
        }
      : fitInColumn(h, sizes),
  );
  const fixed: Rect[] = [];
  for (const l of out) {
    const b = l === null ? null : headBounds(l.lines);
    if (b !== null) fixed.push(b);
  }
  // H-LAYOUT (Entscheid «2 a»): Finden alle überlaufenden Köpfe des Tages eine freie Lage ganz im Kopfbereich, gilt
  // diese; sonst die Lage nach E1-02l R1 (wenn nötig unter die Kopf-Unterlinie ins freie Band).
  const inHead: (ColumnHeadLayout | null)[] = [...out];
  const takenHead = [...fixed];
  let allInHead = true;
  heads.forEach((h, i) => {
    if (!allInHead || inHead[i] !== null) return;
    const l = placeInHead(h, space.area, sizes.min, takenHead);
    if (l === null) {
      allInHead = false;
      return;
    }
    const b = headBounds(l.lines);
    if (b !== null) takenHead.push(b);
    inHead[i] = l;
  });
  if (allInHead) return inHead as ColumnHeadLayout[];
  const taken = [...fixed];
  heads.forEach((h, i) => {
    if (out[i] !== null) return;
    const l = placeOverflow(h, space, sizes.min, taken);
    const b = headBounds(l.lines);
    if (b !== null) taken.push(b);
    out[i] = l;
  });
  return out as ColumnHeadLayout[];
}

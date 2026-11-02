// Ausgabe A3 (Vertrag E1-10 Abschnitt 1; Beschrieb 10 «optional A3»; F-43; R-10-04): die A4-Seite um √2 skaliert,
// gleiche Anordnung und gleiche Umbrüche. Rein.

import type { PageItem, PageModel, Rect, Stroke } from '../pageModel';
import type { WeekPageLayout } from './types';

/** A3 quer in pt (R-10-04). */
export const A3_PAPER = { widthPt: 1190.55, heightPt: 841.89 } as const;

function rect(r: Rect, k: number): Rect {
  return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
}

function stroke(s: Stroke, k: number): Stroke {
  return { ...s, widthPt: s.widthPt * k, dash: s.dash === null ? null : s.dash.map((d) => d * k) };
}

/** Zahl ohne Exponent, höchstens 4 Nachkommastellen (Pfad-Grammatik des Seitenmodells). */
function num(n: number): string {
  let s = (Math.round(n * 1e4) / 1e4).toFixed(4);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/** Jede Zahl der Pfaddaten mal k (x und y gleich skaliert). */
function path(d: string, k: number): string {
  return d.replace(/-?(?:\d+(?:\.\d+)?|\.\d+)/g, (m) => num(Number(m) * k));
}

function item(it: PageItem, k: number): PageItem {
  switch (it.kind) {
    case 'rect':
      return {
        ...it,
        rect: rect(it.rect, k),
        stroke: it.stroke === null ? null : stroke(it.stroke, k),
      };
    case 'line':
      return {
        ...it,
        x1: it.x1 * k,
        y1: it.y1 * k,
        x2: it.x2 * k,
        y2: it.y2 * k,
        stroke: stroke(it.stroke, k),
      };
    case 'path':
      return {
        ...it,
        d: path(it.d, k),
        stroke: it.stroke === null ? null : stroke(it.stroke, k),
      };
    case 'text':
      return {
        ...it,
        x: it.x * k,
        baselineY: it.baselineY * k,
        sizePt: it.sizePt * k,
        frame: rect(it.frame, k),
      };
    case 'image':
      return { ...it, rect: rect(it.rect, k) };
  }
}

/** Seiten der Woche auf A3 (Faktor Breite A3 / Breite A4 ≈ √2); Raster, Rahmen und Ereignisse bleiben. */
export function a3(layout: WeekPageLayout): WeekPageLayout {
  const pages = layout.pages.map((p): PageModel => {
    const k = A3_PAPER.widthPt / p.widthPt;
    return {
      widthPt: A3_PAPER.widthPt,
      heightPt: A3_PAPER.heightPt,
      kind: p.kind,
      items: p.items.map((it) => item(it, k)),
    };
  });
  return { ...layout, pages };
}

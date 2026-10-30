// Ebenen einer Seite am Bildschirm (Vertrag E1-02c §3.2, P-12; Änderungsnotiz Vertragsprüfung V04, V05, V08,
// Runde 2 V18, V22). Rein: aus dem Seitenmodell entsteht die Folge von SVG-Ebenen und Zeilen in
// Zeichenreihenfolge, unabhängig von der Zoomstufe.

import { sanitizeImageBytes } from '../../../io/wap-pdf/imageBytes';
import { invalidItemProblem } from '../../../io/wap-pdf/itemCheck';
import {
  type Bounds,
  formatPathData,
  parsePathData,
  pathBounds,
} from '../../../io/wap-pdf/pathData';
import type {
  PageItem,
  PageModel,
  Rect,
  Stroke,
  TextItem,
} from '../../../model/wap/layout/pageModel';
import type { Rgb } from '../../../model/wap/types';

/** Eine Form in einer SVG-Ebene. */
export type Form =
  | {
      readonly art: 'pfad';
      readonly index: number;
      readonly d: string;
      readonly fill: Rgb | null;
      readonly stroke: Stroke | null;
    }
  | { readonly art: 'bild'; readonly index: number; readonly rect: Rect; readonly href: string };

/** Ein SVG mit Formen in Reihenfolge oder eine Zeile (Index in `items`). */
export type Ebene =
  | { readonly art: 'svg'; readonly formen: readonly Form[] }
  | { readonly art: 'zeile'; readonly index: number; readonly item: TextItem };

/** Begrenzung, die alles schneidet (Rahmen mit nicht endlichen Werten: vorsichtig nie zusammenlegen). */
const UEBERALL: Bounds = {
  minX: Number.NEGATIVE_INFINITY,
  minY: Number.NEGATIVE_INFINITY,
  maxX: Number.POSITIVE_INFINITY,
  maxY: Number.POSITIVE_INFINITY,
};

function rechteckGrenzen(r: Rect | null | undefined): Bounds {
  if (typeof r !== 'object' || r === null || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) {
    return UEBERALL;
  }
  return {
    minX: Math.min(r.x, r.x + r.w),
    minY: Math.min(r.y, r.y + r.h),
    maxX: Math.max(r.x, r.x + r.w),
    maxY: Math.max(r.y, r.y + r.h),
  };
}

/** Geometrie mit Strichzugabe 5 × widthPt je Seite (Gehrungsgrenze 10, V22). */
function mitStrich(g: Bounds, s: Stroke | null): Bounds {
  const z = s === null ? 0 : 5 * s.widthPt;
  return { minX: g.minX - z, minY: g.minY - z, maxX: g.maxX + z, maxY: g.maxY + z };
}

function schneiden(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** Bytes als Base64 (in Teilen, damit grosse Bilder die Grenze für Funktionsargumente nicht erreichen). */
function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Form und Begrenzung eines gültigen Nicht-Text-Elements; `null`, wenn nichts gezeichnet wird. */
function formVon(
  item: Exclude<PageItem, TextItem>,
  index: number,
): { readonly form: Form; readonly grenzen: Bounds } | null {
  switch (item.kind) {
    case 'rect': {
      if (item.fill === null && item.stroke === null) return null;
      const { x, y, w, h } = item.rect;
      const d = formatPathData([
        { cmd: 'M', values: [x, y] },
        { cmd: 'L', values: [x + w, y] },
        { cmd: 'L', values: [x + w, y + h] },
        { cmd: 'L', values: [x, y + h] },
        { cmd: 'Z', values: [] },
      ]);
      const form: Form = { art: 'pfad', index, d, fill: item.fill, stroke: item.stroke };
      return { form, grenzen: mitStrich(rechteckGrenzen(item.rect), item.stroke) };
    }
    case 'line': {
      const segmente = [
        { cmd: 'M', values: [item.x1, item.y1] },
        { cmd: 'L', values: [item.x2, item.y2] },
      ] as const;
      const form: Form = {
        art: 'pfad',
        index,
        d: formatPathData(segmente),
        fill: null,
        stroke: item.stroke,
      };
      return { form, grenzen: mitStrich(pathBounds(segmente), item.stroke) };
    }
    case 'path': {
      const segmente = parsePathData(item.d) ?? [];
      if (segmente.length === 0 || (item.fill === null && item.stroke === null)) return null;
      const form: Form = {
        art: 'pfad',
        index,
        d: formatPathData(segmente),
        fill: item.fill,
        stroke: item.stroke,
      };
      return { form, grenzen: mitStrich(pathBounds(segmente), item.stroke) };
    }
    default: {
      // Dieselben bereinigten Bytes wie im PDF (V18); nicht lesbar → nicht gezeichnet.
      const sauber = sanitizeImageBytes(item.mime, item.bytes);
      if (sauber === null) return null;
      const href = `data:${item.mime};base64,${base64(sauber)}`;
      return {
        form: { art: 'bild', index, rect: item.rect, href },
        grenzen: rechteckGrenzen(item.rect),
      };
    }
  }
}

/**
 * Folge der Ebenen in Zeichenreihenfolge (P-12): jede Zeile für sich; jede ununterbrochene Folge von
 * Nicht-Text-Elementen ein SVG. Eine Folge kommt in die vorangehende SVG-Ebene, wenn keine ihrer Begrenzungen
 * (Geometrie mit Kontrollpunkten und Strichzugabe) den Rahmen (`frame`) einer dazwischenliegenden Zeile
 * schneidet (V08, V22); die Darstellung bleibt dann gleich. Geometrisch ungültige Elemente (Prüfung wie im
 * PDF-Schreiber) entfallen; Zeilen mit gesperrten Zeichen werden gezeichnet (der Schreiber lehnt sie ab).
 */
export function ebenenVon(page: PageModel): readonly Ebene[] {
  const ebenen: Ebene[] = [];
  let letztesSvg: Form[] | null = null;
  let rahmenDazwischen: Bounds[] = [];
  let folge: { readonly form: Form; readonly grenzen: Bounds }[] = [];

  const schliesseFolge = (): void => {
    if (folge.length === 0) return;
    const formen = folge.map((f) => f.form);
    const frei = folge.every((f) => rahmenDazwischen.every((r) => !schneiden(f.grenzen, r)));
    if (letztesSvg !== null && frei) {
      letztesSvg.push(...formen);
    } else {
      letztesSvg = formen;
      ebenen.push({ art: 'svg', formen });
      rahmenDazwischen = [];
    }
    folge = [];
  };

  for (const [index, item] of page.items.entries()) {
    const problem = invalidItemProblem(item);
    if (item.kind === 'text') {
      schliesseFolge();
      if (problem !== null && problem.character === null) continue;
      ebenen.push({ art: 'zeile', index, item });
      rahmenDazwischen.push(rechteckGrenzen(item.frame));
    } else if (problem === null) {
      const f = formVon(item, index);
      if (f !== null) folge.push(f);
    }
  }
  schliesseFolge();
  return ebenen;
}

// Fiktive, handgebaute Seitenmodelle für die Tests von PDF-Schreiber und Bildschirm-Zeichner (Paket E1-02c).
// Vertrag: docs/wap-planer/plan/vertraege/E1-02c.md §1 (Seitenmodell) und §5 (Testorte). Nur Typimporte aus
// src/, damit die Datei auch in Playwright (Node-Seite der E2E-Tests) und in der Harness ohne Vite-Eigenheiten
// lädt. Alle Texte sind erfunden.
import type {
  ImageItem,
  LineItem,
  PageItem,
  PageModel,
  PathItem,
  Rect,
  RectItem,
  Stroke,
  TextItem,
  TextRunOut,
} from '../../../../../src/model/wap/layout/pageModel';
import type { FontWeight } from '../../../../../src/model/wap/layout/text/types';
import type { Rgb } from '../../../../../src/model/wap/types';

/** A4 quer in pt (R-10-01). */
export const A4_QUER = { widthPt: 841.89, heightPt: 595.28 } as const;

export const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };
export const ROT: Rgb = { r: 200, g: 16, b: 46 };
export const BLAU: Rgb = { r: 12, g: 34, b: 156 };
export const GRUEN: Rgb = { r: 20, g: 140, b: 60 };
export const GRAU: Rgb = { r: 128, g: 128, b: 128 };
export const ORANGE: Rgb = { r: 240, g: 150, b: 30 };
export const VIOLETT: Rgb = { r: 110, g: 40, b: 150 };

/** Seite mit den Elementen in Zeichenreihenfolge. */
export function seite(
  items: readonly PageItem[],
  groesse: { readonly widthPt: number; readonly heightPt: number } = A4_QUER,
  kind: PageModel['kind'] = 'week',
): PageModel {
  return { widthPt: groesse.widthPt, heightPt: groesse.heightPt, kind, items };
}

/** Ein Lauf; Standard: regular, schwarz, nicht durchgestrichen. */
export function lauf(
  text: string,
  opts: { readonly weight?: FontWeight; readonly color?: Rgb; readonly strike?: boolean } = {},
): TextRunOut {
  return {
    text,
    weight: opts.weight ?? 'regular',
    color: opts.color ?? SCHWARZ,
    strike: opts.strike ?? false,
  };
}

/** Fetter Lauf. */
export function fett(text: string, color: Rgb = SCHWARZ): TextRunOut {
  return lauf(text, { weight: 'bold', color });
}

/** Grosszügiger Rahmen um den Grundlinienbeginn (wird nicht gezeichnet und vom Schreiber nicht geprüft). */
function rahmenUm(x: number, y: number): Rect {
  return { x: x - 400, y: y - 400, w: 800, h: 800 };
}

/** Eine vorberechnete Zeile. */
export function zeile(opts: {
  readonly x: number;
  readonly baselineY: number;
  readonly runs: readonly TextRunOut[];
  readonly sizePt?: number;
  readonly rotation?: 0 | 90 | 270;
  readonly frame?: Rect;
  readonly role?: PageItem['role'];
}): TextItem {
  return {
    role: opts.role ?? 'block',
    kind: 'text',
    x: opts.x,
    baselineY: opts.baselineY,
    rotation: opts.rotation ?? 0,
    sizePt: opts.sizePt ?? 10,
    runs: opts.runs,
    frame: opts.frame ?? rahmenUm(opts.x, opts.baselineY),
  };
}

/** Einzeiliger Text in einem Lauf (Kurzform). */
export function text(
  x: number,
  baselineY: number,
  inhalt: string,
  opts: { readonly sizePt?: number; readonly weight?: FontWeight; readonly color?: Rgb } = {},
): TextItem {
  return zeile({
    x,
    baselineY,
    sizePt: opts.sizePt ?? 10,
    runs: [lauf(inhalt, { weight: opts.weight ?? 'regular', color: opts.color ?? SCHWARZ })],
  });
}

export function strich(color: Rgb, widthPt: number, dash: readonly number[] | null = null): Stroke {
  return { color, widthPt, dash };
}

export function rechteck(rect: Rect, fill: Rgb | null, stroke: Stroke | null): RectItem {
  return { role: 'block', kind: 'rect', rect, fill, stroke };
}

export function linie(x1: number, y1: number, x2: number, y2: number, stroke: Stroke): LineItem {
  return { role: 'gridLine', kind: 'line', x1, y1, x2, y2, stroke };
}

export function pfad(d: string, fill: Rgb | null, stroke: Stroke | null): PathItem {
  return { role: 'block', kind: 'path', d, fill, stroke };
}

export function bild(rect: Rect, mime: ImageItem['mime'], bytes: Uint8Array): ImageItem {
  return { role: 'signature', kind: 'image', rect, mime, bytes };
}

/** Codepunkte eines Textes als Zahlen. */
export function codepunkte(s: string): number[] {
  return Array.from(s, (c) => c.codePointAt(0) as number);
}

/** «U+XXXX» mit mindestens vier hexadezimalen Grossbuchstaben (Vertragsprüfung V07). */
export function uPlus(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

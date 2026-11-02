// Seitenmodell: Schnittstelle Layout → Zeichner (Vertrag E1-02c Abschnitt 1; ADR-004, ADR-005, Leitplanke 2).
// Rein, nur Typen und eine Schriftkonstante. Masse in pt, Ursprung oben links, y nach unten.
// PDF-Schreiber (src/io/wap-pdf/) und Bildschirm-Zeichner (src/components/wap/render/) zeichnen nur dieses
// Modell; der Browser bricht nie selbst um.

import type { Id, Rgb } from '../types';
import type { FontWeight } from './text/types';

/** Rechteck in pt, Ursprung oben links. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Strich: Breite in pt (endlich, > 0), mittig auf der geometrischen Kante; `dash` in pt (jede Zahl endlich
 * und > 0, mindestens ein Wert, Phase 0), `null` = durchgezogen. Linienenden stumpf, Ecken spitz mit
 * Gehrungsgrenze 10 (PDF und SVG gleich).
 */
export interface Stroke {
  readonly color: Rgb;
  readonly widthPt: number;
  readonly dash: readonly number[] | null;
}

export type ItemRole =
  | 'header'
  | 'frame'
  | 'timeAxis'
  | 'gridLine'
  | 'dayHeader'
  | 'columnHeader'
  | 'band'
  | 'block'
  | 'querbalken'
  | 'marker'
  | 'rapport'
  | 'besoBox'
  | 'agenda'
  | 'sidebar'
  | 'legend'
  | 'signature'
  | 'sun'
  | 'continuation';

interface ItemBase {
  readonly role: ItemRole;
  readonly entryId?: Id;
}

/**
 * Fläche und/oder Rahmen; beide `null` → nichts gezeichnet. Beide Zeichner zeichnen es als Pfad ab oben links
 * im Uhrzeigersinn (M x y, L x+w y, L x+w y+h, L x y+h, Z), damit Strichelungen gleich liegen.
 */
export interface RectItem extends ItemBase {
  readonly kind: 'rect';
  readonly rect: Rect;
  readonly fill: Rgb | null;
  readonly stroke: Stroke | null;
}

export interface LineItem extends ItemBase {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: Stroke;
}

/**
 * Pfad in SVG-Syntax, nur absolute Befehle `M`, `L`, `C`, `Z` (Grossbuchstaben), Zahlen in pt im
 * Seitenkoordinatensystem (y nach unten); für diagonal geteilte Füllung und gewellten Rand. Füllregel nonzero.
 * Grammatik: beginnt mit `M`; je Segment genau ein Befehlsbuchstabe (keine implizite Wiederholung) mit 2 (M, L),
 * 6 (C) bzw. 0 (Z) Zahlen; Zahl `-?(\d+(\.\d+)?|\.\d+)` ohne Exponent; Trenner ein oder mehrere Leerzeichen oder
 * ein Komma mit optionalen Leerzeichen (Vertrag E1-02c, Änderungsnotiz Vertragsprüfung V06).
 */
export interface PathItem extends ItemBase {
  readonly kind: 'path';
  readonly d: string;
  readonly fill: Rgb | null;
  readonly stroke: Stroke | null;
}

/** Ein Lauf einer Zeile mit einheitlichem Schnitt, einheitlicher Farbe und Durchstreichung. */
export interface TextRunOut {
  readonly text: string;
  readonly weight: FontWeight;
  readonly color: Rgb;
  readonly strike: boolean;
}

/**
 * Eine vorberechnete Zeile. `x`/`baselineY` = Beginn der Grundlinie vor der Drehung (Drehpunkt);
 * `rotation` 90 = von unten nach oben lesbar, 270 = von oben nach unten. Die Läufe folgen ohne Abstand
 * aufeinander (Vorschub je Lauf = `measureRuns([lauf], sizePt)`).
 */
export interface TextItem extends ItemBase {
  readonly kind: 'text';
  readonly x: number;
  readonly baselineY: number;
  readonly rotation: 0 | 90 | 270;
  readonly sizePt: number;
  readonly runs: readonly TextRunOut[];
  /** Rahmen, in dem die Zeile liegen muss (Ebene-2-Prüfung); wird nicht gezeichnet. */
  readonly frame: Rect;
}

/**
 * Rasterbild (Unterschrift E1-10, Wappen E1-02e); die einzigen Rasterelemente im PDF. Füllt `rect` ohne
 * Erhalt des Seitenverhältnisses (das verantwortet das Layout). Beide Zeichner verwenden die Bytes nach
 * `sanitizeImageBytes` (src/io/wap-pdf/imageBytes.ts; Vertrag E1-02c, Vertragsprüfung V03, Runde 2 V17–V19).
 */
export interface ImageItem extends ItemBase {
  readonly kind: 'image';
  readonly rect: Rect;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly bytes: Uint8Array;
}

export type PageItem = RectItem | LineItem | PathItem | TextItem | ImageItem;

/** Zeichenreihenfolge = Reihenfolge in `items` (spätere liegen oben). */
export interface PageModel {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly kind: 'week' | 'continuation';
  readonly items: readonly PageItem[];
}

/**
 * Durchstreichung in em der Schriftgrösse, aus der Tabelle OS/2 von Arimo 1.341 (beide Schnitte gleich,
 * unitsPerEm 2048): Mitte = (yStrikeoutPosition − yStrikeoutSize / 2) / unitsPerEm = (530 − 51) / 2048 über
 * der Grundlinie, Dicke = yStrikeoutSize / unitsPerEm = 102 / 2048. Gilt für PDF und Bildschirm
 * (Vertrag E1-02c Abschnitt 2.3, 3.2).
 */
export const STRIKE_EM: { readonly center: number; readonly thickness: number } = {
  center: 479 / 2048,
  thickness: 102 / 2048,
};

/**
 * Codepunkte, die in keiner Zeile stehen dürfen (Bereiche einschliesslich der Grenzen): Steuerzeichen,
 * Zeilen- und Absatztrenner sowie unsichtbare bzw. Bidi-Zeichen, die Arimo als Glyphe führt, die der Browser
 * aber anders oder gar nicht zeichnet: alle Default-Ignorables von Arimo mit Kontur oder Vorschub > 0 (Vertrag
 * E1-02c, Änderungsnotizen Vertragsprüfung V01 und Runde 2 V15). Ausserdem verlangt der Schreiber NFC ohne
 * kombinierende Zeichen (Runde 2 V16). Der PDF-Schreiber lehnt beides mit `invalidItem` ab; Layout (E1-02e),
 * Import (E1-08) und Eingabe (E1-12) nutzen dieselben Regeln.
 */
export const LINE_EXCLUDED_CODEPOINTS: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x061c, 0x061c],
  [0x200c, 0x200f],
  [0x2028, 0x202e],
  [0x2061, 0x2064],
  [0x2066, 0x206f],
];

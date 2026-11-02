// Eingabeprüfung eines Seitenmodells (Vertrag E1-02c §2.4, P-7; Änderungsnotiz Vertragsprüfung V01, V06, V13,
// Runde 2 V15, V16). Rein und ohne DOM; der PDF-Schreiber lehnt mit `invalidItem` bzw. `missingGlyph` ab, der
// Bildschirm-Zeichner lässt geometrisch ungültige Elemente weg. Nicht geprüft: frame, role, entryId, Lage
// ausserhalb der Seite, Schriftgrösse unter 4,5 pt (Ebene-2-Prüfung und P8).

import {
  LINE_EXCLUDED_CODEPOINTS,
  type PageItem,
  type PageModel,
  type Rect,
  type Stroke,
  type TextItem,
  type TextRunOut,
} from '../../model/wap/layout/pageModel';
import { fontMetrics } from '../../model/wap/layout/text/metrics';
import type { Rgb } from '../../model/wap/types';
import { parsePathData } from './pathData';

/** Ein Verstoss gegen die Eingaberegeln; `character` bei gesperrtem Codepunkt bzw. NFC-Verstoss. */
export interface ItemProblem {
  readonly character: string | null;
}

const OHNE_ZEICHEN: ItemProblem = { character: null };

function endlich(...werte: readonly unknown[]): boolean {
  return werte.every((w) => typeof w === 'number' && Number.isFinite(w));
}

/** Seitengrösse endlich und > 0. */
export function pageSizeValid(page: PageModel): boolean {
  return endlich(page.widthPt, page.heightPt) && page.widthPt > 0 && page.heightPt > 0;
}

function farbeGueltig(c: Rgb | null | undefined): boolean {
  if (c === null || typeof c !== 'object') return false;
  return [c.r, c.g, c.b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
}

function rechteckGueltig(r: Rect | null | undefined): boolean {
  if (r === null || typeof r !== 'object') return false;
  return endlich(r.x, r.y, r.w, r.h) && r.w >= 0 && r.h >= 0;
}

function strichGueltig(s: Stroke | null | undefined): boolean {
  if (s === null || typeof s !== 'object') return false;
  if (!farbeGueltig(s.color) || !endlich(s.widthPt) || s.widthPt <= 0) return false;
  if (s.dash === null) return true;
  return Array.isArray(s.dash) && s.dash.length > 0 && s.dash.every((v) => endlich(v) && v > 0);
}

/** Fläche bzw. Strich ist `null` oder gültig. */
function optional<T>(wert: T | null, gueltig: (w: T) => boolean): boolean {
  return wert === null || gueltig(wert);
}

function laufGueltig(r: TextRunOut): boolean {
  return (
    r !== null &&
    typeof r === 'object' &&
    typeof r.text === 'string' &&
    (r.weight === 'regular' || r.weight === 'bold') &&
    farbeGueltig(r.color)
  );
}

function zeileGueltig(t: TextItem): boolean {
  return (
    endlich(t.x, t.baselineY, t.sizePt) &&
    t.sizePt > 0 &&
    (t.rotation === 0 || t.rotation === 90 || t.rotation === 270) &&
    Array.isArray(t.runs) &&
    t.runs.every(laufGueltig)
  );
}

/** Steht der Codepunkt in einem Bereich von `LINE_EXCLUDED_CODEPOINTS`? */
export function isExcludedCodepoint(cp: number): boolean {
  return LINE_EXCLUDED_CODEPOINTS.some(([a, b]) => cp >= a && cp <= b);
}

/**
 * Erstes Zeichen, das gegen V16 verstösst: Text ≠ NFC oder Zeichen der Kategorie M. Geliefert wird das erste
 * Zeichen der Kategorie M, sonst das erste Zeichen, ab dem sich Text und NFC-Form unterscheiden; `null`, wenn
 * der Text NFC ohne kombinierende Zeichen ist.
 */
export function nfcViolation(text: string): string | null {
  const nfc = text.normalize('NFC');
  const marke = /\p{M}/u.exec(text);
  if (marke !== null) return marke[0];
  if (nfc === text) return null;
  const a = [...text];
  const b = [...nfc];
  return a.find((z, i) => z !== b[i]) ?? text;
}

/** Erstes gesperrtes bzw. nicht NFC-gerechtes Zeichen der Läufe in Reihenfolge, sonst `null`. */
function zeichenProblem(runs: readonly TextRunOut[]): string | null {
  for (const r of runs) {
    for (const z of r.text) {
      if (isExcludedCodepoint(z.codePointAt(0) as number)) return z;
    }
    const nfc = nfcViolation(r.text);
    if (nfc !== null) return nfc;
  }
  return null;
}

/**
 * Prüft ein Element ohne Bildbytes (die prüft der Schreiber über `sanitizeImageBytes` und pdf-lib):
 * Zahlen endlich, `rect.w`/`rect.h` ≥ 0, `sizePt` > 0, Strich nach `Stroke`, Farben ganzzahlig 0–255, `d` nach
 * V06, `rotation`, `weight`, `mime`, bekannte `kind`; bei Zeilen danach gesperrte Codepunkte und NFC.
 * Liefert den ersten Verstoss oder `null`.
 */
export function invalidItemProblem(item: PageItem): ItemProblem | null {
  switch (item.kind) {
    case 'rect':
      return rechteckGueltig(item.rect) &&
        optional(item.fill, farbeGueltig) &&
        optional(item.stroke, strichGueltig)
        ? null
        : OHNE_ZEICHEN;
    case 'line':
      return endlich(item.x1, item.y1, item.x2, item.y2) && strichGueltig(item.stroke)
        ? null
        : OHNE_ZEICHEN;
    case 'path':
      return typeof item.d === 'string' &&
        parsePathData(item.d) !== null &&
        optional(item.fill, farbeGueltig) &&
        optional(item.stroke, strichGueltig)
        ? null
        : OHNE_ZEICHEN;
    case 'image':
      return rechteckGueltig(item.rect) && (item.mime === 'image/png' || item.mime === 'image/jpeg')
        ? null
        : OHNE_ZEICHEN;
    case 'text': {
      if (!zeileGueltig(item)) return OHNE_ZEICHEN;
      const z = zeichenProblem(item.runs);
      return z === null ? null : { character: z };
    }
    default:
      return OHNE_ZEICHEN;
  }
}

/** Erstes Zeichen ohne Glyphe im Schnitt seines Laufs (V-02c-1), sonst `null`. */
export function firstMissingGlyph(item: TextItem): string | null {
  const m = fontMetrics();
  for (const r of item.runs) {
    for (const z of r.text) {
      if (m.advance(z.codePointAt(0) as number, r.weight) === null) return z;
    }
  }
  return null;
}

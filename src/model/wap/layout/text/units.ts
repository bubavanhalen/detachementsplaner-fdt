// Interne Rechenhilfen der Textschicht: Vorschub je Zeichen und Umrechnung in pt (Vertrag E1-02b 2.2, P-7).
import { fontMetrics } from './metrics';
import type { FontWeight } from './types';

/** Vorschub eines Zeichens (ein Codepunkt) in Font-Einheiten; ohne Glyphe der Vorschub von .notdef. */
export function charUnits(char: string, weight: FontWeight): number {
  const m = fontMetrics();
  return m.advance(char.codePointAt(0) as number, weight) ?? m.notdefAdvance(weight);
}

/** Breite in pt aus einer Summe von Font-Einheiten: erst summieren, dann × sizePt / unitsPerEm. */
export function unitsToPt(units: number, sizePt: number): number {
  return (units * sizePt) / fontMetrics().unitsPerEm;
}

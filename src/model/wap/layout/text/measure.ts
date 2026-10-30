import { assertSizePt } from './errors';
import { fontMetrics } from './metrics';
import type { StyledRun } from './types';
import { charUnits, unitsToPt } from './units';

export type { StyledRun } from './types';

/**
 * Breite in pt = (Summe der Vorschübe aller Codepunkte aller Läufe in Font-Einheiten) × sizePt / unitsPerEm,
 * in dieser Reihenfolge gerechnet. Ohne Kerning, ohne Ligaturen; ein Codepunkt ohne Glyphe zählt mit dem
 * Vorschub von .notdef seines Schnitts.
 * @throws WapError `invalidTextBox`, wenn sizePt nicht endlich oder ≤ 0 ist.
 */
export function measureRuns(runs: readonly StyledRun[], sizePt: number): number {
  assertSizePt(sizePt);
  let units = 0;
  for (const run of runs) {
    for (const char of run.text) units += charUnits(char, run.weight);
  }
  return unitsToPt(units, sizePt);
}

/**
 * Verschiedene Zeichen (je ein Codepunkt als String) ohne Glyphe in mindestens einem Schnitt,
 * in der Reihenfolge ihres ersten Vorkommens. Leerer Text ergibt eine leere Liste. Wirft nie.
 */
export function missingGlyphs(text: string): readonly string[] {
  const m = fontMetrics();
  const missing = new Set<string>();
  for (const char of text) {
    const cp = char.codePointAt(0) as number;
    if (m.advance(cp, 'regular') === null || m.advance(cp, 'bold') === null) missing.add(char);
  }
  return [...missing];
}

/**
 * true genau dann, wenn `missingGlyphs(text)` leer ist (jedes Zeichen hat in beiden Schnitten eine Glyphe).
 * Grundlage der Eingabeprüfung (E1-12) und der Ersetzung im Import (E1-08), ADR-004 AR0-13. Wirft nie.
 */
export function isRenderable(text: string): boolean {
  return missingGlyphs(text).length === 0;
}

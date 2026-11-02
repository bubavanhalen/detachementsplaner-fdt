import { assertSizePt } from './errors';
import { ARIMO_METRICS } from './metrics.generated';
import type { FontWeight } from './types';

/** Metriken der gebündelten Schrift Arimo (ADR-003), gelesen aus `metrics.generated.ts`. */
export interface FontMetrics {
  readonly unitsPerEm: number;
  /** hhea.ascender in Font-Einheiten (positiv). */
  readonly ascender: number;
  /** hhea.descender in Font-Einheiten (negativ). */
  readonly descender: number;
  /** hhea.lineGap in Font-Einheiten. */
  readonly lineGap: number;
  /** Vorschub in Font-Einheiten; null = Codepunkt nicht in der cmap des Schnitts (auch bei ungültigem Codepunkt). */
  advance(codePoint: number, weight: FontWeight): number | null;
  /** Vorschub der Glyphe .notdef in Font-Einheiten; damit werden fehlende Zeichen gemessen. */
  notdefAdvance(weight: FontWeight): number;
}

/** Codepunkt → Vorschub aus der flachen Paarliste [cp0, adv0, cp1, adv1, …]. */
function advanceTable(pairs: readonly number[]): ReadonlyMap<number, number> {
  const table = new Map<number, number>();
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    table.set(pairs[i] as number, pairs[i + 1] as number);
  }
  return table;
}

let metrics: FontMetrics | undefined;

/** Liefert bei jedem Aufruf dasselbe Objekt; wirft nie. */
export function fontMetrics(): FontMetrics {
  if (metrics === undefined) {
    const tables: { readonly [W in FontWeight]: ReadonlyMap<number, number> } = {
      regular: advanceTable(ARIMO_METRICS.advances.regular),
      bold: advanceTable(ARIMO_METRICS.advances.bold),
    };
    // Nur die Tabelle zählt: Codepunkte ausserhalb der cmap, ungültige Werte und NaN ergeben null.
    metrics = Object.freeze({
      unitsPerEm: ARIMO_METRICS.unitsPerEm,
      ascender: ARIMO_METRICS.ascender,
      descender: ARIMO_METRICS.descender,
      lineGap: ARIMO_METRICS.lineGap,
      advance: (codePoint: number, weight: FontWeight): number | null =>
        tables[weight].get(codePoint) ?? null,
      notdefAdvance: (weight: FontWeight): number => ARIMO_METRICS.notdefAdvance[weight],
    });
  }
  return metrics;
}

/**
 * (ascender − descender + lineGap) × sizePt / unitsPerEm (ADR-003: Faktor 1,1499).
 * @throws WapError `invalidTextBox`, wenn sizePt nicht endlich oder ≤ 0 ist.
 */
export function lineHeightPt(sizePt: number): number {
  assertSizePt(sizePt);
  const m = fontMetrics();
  return ((m.ascender - m.descender + m.lineGap) * sizePt) / m.unitsPerEm;
}

/**
 * ascender × sizePt / unitsPerEm: Abstand von der Oberkante der Zeile zur Grundlinie.
 * @throws WapError `invalidTextBox`, wenn sizePt nicht endlich oder ≤ 0 ist.
 */
export function ascentPt(sizePt: number): number {
  assertSizePt(sizePt);
  const m = fontMetrics();
  return (m.ascender * sizePt) / m.unitsPerEm;
}

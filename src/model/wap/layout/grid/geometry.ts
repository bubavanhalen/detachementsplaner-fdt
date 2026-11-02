// Geometrie des Rasters: Tages- und Spaltenbreiten, Zeit → y (Vertrag E1-02d Abschnitt 2a; Beschrieb 4.4, 4.5).
// Rein und deterministisch (R-L-02).

import type { ColumnKind, ColumnWeight, DayDisplay } from '../../types';
import type { TimeScale } from './types';

/** Anteile in Dritteln: voll 3, kompakt 1 (= 1/3 eines vollen Tags, F-40), ausgeblendet 0. */
const DAY_SHARE: { readonly [D in DayDisplay]: number } = { full: 3, compact: 1, hidden: 0 };

/** Gewicht einer Planungsspalte nach ihrer gespeicherten Breite (Beschrieb 4.4). */
const PLANNING_WEIGHT: { readonly [W in ColumnWeight]: number } = { narrow: 1, normal: 2, wide: 3 };

/**
 * Feste Gewichte der übrigen Spaltenarten; ihr gespeichertes Gewicht wirkt nicht (R-4.4-13). Nebenspalte 2 statt 1:
 * bewusste Abweichung von Beschrieb 4.4, Entscheid Auftraggeber 19.10.2026 «12: ja» (Q-HL-03, F-LAYOUT2).
 */
const FIXED_WEIGHT: { readonly [K in Exclude<ColumnKind, 'planning'>]: number } = {
  secondary: 2,
  rap: 1,
  beso: 2,
};

/**
 * Anteil voll 1, kompakt 1/3, ausgeblendet 0; Breite = totalWidthPt · Anteil / Summe der Anteile; ohne
 * sichtbaren Tag alle 0 (R-4.4-10 bis -12, F-40).
 * @throws RangeError, wenn totalWidthPt nicht endlich oder ≤ 0 ist.
 */
export function dayWidths(
  days: readonly { readonly display: DayDisplay }[],
  totalWidthPt: number,
): readonly number[] {
  if (!Number.isFinite(totalWidthPt) || totalWidthPt <= 0) {
    throw new RangeError('dayWidths: Die Gesamtbreite muss endlich und grösser als 0 sein.');
  }
  const shares = days.map((d) => DAY_SHARE[d.display]);
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum === 0) return shares.map(() => 0);
  return shares.map((s) => (totalWidthPt * s) / sum);
}

/** Planungsspalte schmal 1, normal 2, breit 3; Nebenspalte 2 (F-LAYOUT2), Rap-Spalte 1, Beso-Spalte 2 (R-4.4-13). */
export function columnWeight(column: {
  readonly kind: ColumnKind;
  readonly weight: ColumnWeight;
}): number {
  return column.kind === 'planning' ? PLANNING_WEIGHT[column.weight] : FIXED_WEIGHT[column.kind];
}

/**
 * Breite je Spalte = dayWidthPt · Gewicht / Summe der Gewichte, in Eingabereihenfolge; leer → [].
 * @throws RangeError, wenn dayWidthPt nicht endlich oder < 0 ist.
 */
export function columnWidths(
  columns: readonly { readonly kind: ColumnKind; readonly weight: ColumnWeight }[],
  dayWidthPt: number,
): readonly number[] {
  if (!Number.isFinite(dayWidthPt) || dayWidthPt < 0) {
    throw new RangeError('columnWidths: Die Tagesbreite muss endlich und mindestens 0 sein.');
  }
  const weights = columns.map(columnWeight);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  return weights.map((g) => (dayWidthPt * g) / sum);
}

/** scale.yTop + (t − scale.fromMin) · scale.ptPerMinute, ohne Begrenzung (R-4.5-02). */
export function timeToY(scale: TimeScale, t: number): number {
  return scale.yTop + (t - scale.fromMin) * scale.ptPerMinute;
}

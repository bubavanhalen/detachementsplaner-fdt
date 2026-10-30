// Texte der Seite: Titel, Wochenzeile und Einpassung einzeiliger Texte (Vertrag E1-02e, Notiz
// «Ausarbeitung Schritt 2» Abschnitt B, E1, E6; R-4.9-01, R-6-05, R-10-11, R-10-13). Rein (R-L-02).

import { addDays, formatDate, isoWeek } from '../../calendar';
import { requireWeek } from '../../derive/columns';
import type { LevelTemplate } from '../../template';
import type { Id, Plan } from '../../types';
import { singleLineRuns } from '../entries/text';
import type { StyledRun } from '../text/types';
import { FIT_EPS, sizeSteps, truncateLine, width } from './common';

/**
 * titlePattern der Vorlage: jedes {unit} → plan.unit, {weekLabel} → week.label; übrige Zeichen wörtlich.
 * @throws ModelError 'unknownWeek', wenn weekId im Plan fehlt.
 */
export function weekTitle(plan: Plan, weekId: Id, template: LevelTemplate): string {
  const week = requireWeek(plan, weekId);
  return template.titlePattern.replace(/\{unit\}|\{weekLabel\}/g, (p) =>
    p === '{unit}' ? plan.unit : week.label,
  );
}

/**
 * «Woche vom ‹dd.mm.yyyy› bis ‹dd.mm.yyyy› KW ‹n›», KW ohne führende Null (V-02e-10).
 * @throws ModelError 'unknownWeek', wenn weekId im Plan fehlt.
 */
export function weekRangeText(plan: Plan, weekId: Id): string {
  const week = requireWeek(plan, weekId);
  const start = week.startDate;
  const end = addDays(start, 6);
  return `Woche vom ${formatDate(start, 'long')} bis ${formatDate(end, 'long')} KW ${String(isoWeek(start))}`;
}

/**
 * Einzeilige Texte bei Platzmangel (E6, V-02e-9): erst CR LF, CR, LF → U+0020 und Rand trimmen; dann
 * Stufen d = 0, 0,25, … mit Grösse max(sizes.min, sizes.standard − d), passt ⇔ measureRuns ≤
 * widthPt + 1e-6; sonst Kürzung wie E1-02d 2e in sizes.min; sonst leer.
 * @throws RangeError, wenn widthPt nicht endlich oder ≤ 0 ist oder die Grössen ungültig sind.
 */
export function fitSingleLine(
  runs: readonly StyledRun[],
  widthPt: number,
  sizes: { readonly standard: number; readonly min: number },
): {
  readonly runs: readonly StyledRun[];
  readonly sizePt: number;
  readonly result: 'fits' | 'reduced' | 'ellipsis' | 'omitted';
} {
  if (!(Number.isFinite(widthPt) && widthPt > 0)) {
    throw new RangeError('fitSingleLine: Die Breite muss endlich und grösser als 0 sein.');
  }
  const { standard, min } = sizes;
  if (!(Number.isFinite(standard) && Number.isFinite(min) && min > 0 && min <= standard)) {
    throw new RangeError(
      'fitSingleLine: Die Grössen müssen endlich sein, mit 0 < Mindestgrösse ≤ Standardgrösse.',
    );
  }
  const text = singleLineRuns(runs);
  const steps = sizeSteps(standard, min);
  for (const [i, size] of steps.entries()) {
    if (width(text, size) <= widthPt + FIT_EPS) {
      return { runs: text, sizePt: size, result: i === 0 ? 'fits' : 'reduced' };
    }
  }
  // S3-18: «…» ohne verbliebene Zeichen im Schnitt des ersten Laufs.
  const cut = truncateLine(text, widthPt, min, 'firstRun');
  if (cut !== null) return { runs: cut, sizePt: min, result: 'ellipsis' };
  return { runs: [], sizePt: min, result: 'omitted' };
}

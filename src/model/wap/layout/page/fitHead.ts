// Einpassen einzeiliger Köpfe mit Querabmessung (Vertrag E1-02e, Notiz S3-22 (b); E6 «fitSingleLine»).
// Intern: nicht über page/index.ts exportiert. Rein (R-L-02).

import { singleLineRuns } from '../entries/text';
import type { StyledRun } from '../text/types';
import { FIT_EPS, lineHeightPt, sizeSteps } from './common';
import { fitSingleLine } from './texts';

export interface HeadResult {
  readonly runs: readonly StyledRun[];
  readonly sizePt: number;
  readonly result: 'fits' | 'reduced' | 'ellipsis' | 'omitted';
}

/**
 * S3-22 (b): Höchstgrösse ist die grösste Stufe σ ≤ `standard` (0,25-pt-Schritte) mit `lineHeightPt(σ)` ≤
 * `crossPt`; dann `fitSingleLine(runs, widthPt, { standard: σ, min })`. Ohne σ ≥ `min` oder bei Breite bzw.
 * Querabmessung ≤ 0 entfällt der Text ('omitted'). Ein leerer Text passt.
 */
export function fitHead(
  runs: readonly StyledRun[],
  widthPt: number,
  crossPt: number,
  standard: number,
  min: number,
): HeadResult {
  if (singleLineRuns(runs).length === 0) return { runs: [], sizePt: standard, result: 'fits' };
  const lower = Math.min(min, standard);
  const sigma = sizeSteps(standard, lower).find((s) => lineHeightPt(s) <= crossPt + FIT_EPS);
  if (!(widthPt > 0) || !(crossPt > 0) || sigma === undefined) {
    return { runs: [], sizePt: lower, result: 'omitted' };
  }
  const r = fitSingleLine(runs, widthPt, { standard: sigma, min: lower });
  const result = r.result === 'fits' && sigma < standard ? 'reduced' : r.result;
  return { runs: r.runs, sizePt: r.sizePt, result };
}

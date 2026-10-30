// Beschriftung eines Markers (Vertrag E1-02a Abschnitt 3 und 8 P-11; R-4.6-14, F-55).

import { formatMilTime } from '../time';
import type { ColumnSelection, Marker, Plan } from '../types';

/**
 * Wirksame Spalten eines Markers: immer alle Planungsspalten des Tages (Entscheid Auftraggeber 21.10.2026 «Marker
 * sollen per se immer über alle Det-Spalten gehen»). Eine gespeicherte Spaltenliste älterer Pläne bleibt in der Datei
 * erhalten (verlustfrei), wirkt aber nicht.
 */
export const MARKER_COLUMNS: ColumnSelection = { kind: 'all' };

/** Art (frei: customKind), mit Zeit gemäss plan.markerLabels, z.B. «ABV 2330». */
export function markerLabel(m: Marker, plan: Plan): string {
  const kind = m.kind === 'custom' ? m.customKind : m.kind;
  const withTime = plan.markerLabels.find((s) => s.kind === m.kind)?.withTime ?? false;
  return withTime ? `${kind} ${formatMilTime(m.at)}` : kind;
}

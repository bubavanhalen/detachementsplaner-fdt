// Auffüllen per Doppelklick auf die Blockkante (F-UX2 P5; Rückmeldung N5 vom 19.10.2026: «mit Doppelklick auf einem
// Blockrand oben oder unten soll der Block aufgefüllt werden bis zum nächsten Block»; Beschrieb 4.5, 4.6); hält auch
// an Markern in den Spalten des Blocks (F-UX3, Rückmeldung 21.10.2026 «ABV wird nicht berücksichtigt»). Rein.

import { weekdayOf } from '../../../model/wap/calendar';
import { relativeColumns } from '../../../model/wap/commands/columns';
import { weekOfDate } from '../../../model/wap/commands/command';
import { dayColumns } from '../../../model/wap/derive/columns';
import type { Block, Plan } from '../../../model/wap/types';
import { blockSpan } from './entryViews';

/** Band über dem Raster (Querbalken, Q-013 a): Blöcke beginnen frühestens an seinem Ende. */
const BAND_MINUTES = 60;

/**
 * Neue Zeit der Kante: oben das späteste Ende eines vorangehenden Blocks am selben Tag, der mindestens eine Spalte
 * mit `entry` teilt und vor ihm endet, sonst der Rasterbeginn unter dem Band; unten der früheste Beginn eines
 * folgenden, sonst das Ende des Anzeigebereichs. Blöcke, die `entry` zeitlich überlappen (Ausnahme, parallel), zählen
 * nicht.
 */
export function fillTarget(plan: Plan, entry: Block, edge: 'start' | 'end'): number {
  const span = blockSpan(entry.time, plan);
  const week = weekOfDate(plan, entry.date);
  const columns = week === null ? [] : dayColumns(plan, week.id, weekdayOf(entry.date));
  const mine = new Set(relativeColumns(plan, entry.columns, columns).map((c) => c.id));
  let limit = edge === 'start' ? plan.displayRange.from + BAND_MINUTES : plan.displayRange.to;
  for (const e of Object.values(plan.entries)) {
    // Jeder Marker des Tages (AV, ABV, HV, frei) begrenzt ebenfalls: Marker gelten über alle Planungsspalten
    // (Entscheid Auftraggeber 21.10.2026; Änderungsnotiz R-5.1-28).
    if (e.type === 'marker' && e.date === entry.date && e.id !== entry.id) {
      if (edge === 'start' && e.at <= span.from) limit = Math.max(limit, e.at);
      if (edge === 'end' && e.at >= span.to) limit = Math.min(limit, e.at);
      continue;
    }
    if (e.id === entry.id || e.type !== 'block' || e.date !== entry.date) continue;
    if (!relativeColumns(plan, e.columns, columns).some((c) => mine.has(c.id))) continue;
    const s = blockSpan(e.time, plan);
    if (edge === 'start' && s.to <= span.from) limit = Math.max(limit, s.to);
    if (edge === 'end' && s.from >= span.to) limit = Math.min(limit, s.from);
  }
  return limit;
}

// Spalten eines Tages (Vertrag E1-02a Abschnitt 3 und 8 P-7, P-11; Beschrieb 4.3, 4.4).

import { modelError } from '../errors';
import type { Column, ColumnSelection, Id, Plan, Week, Weekday } from '../types';

/** Woche des Plans; unbekannt → ModelError 'unknownWeek' (P-7). */
export function requireWeek(plan: Plan, weekId: Id): Week {
  const week = plan.weeks.find((w) => w.id === weekId);
  if (week === undefined) throw modelError('unknownWeek');
  return week;
}

/** Spalten des Spaltensatzes des Tages; columnSetId null oder unbekannt → []; Woche unbekannt → ModelError 'unknownWeek'. */
export function dayColumns(plan: Plan, weekId: Id, weekday: Weekday): readonly Column[] {
  const week = requireWeek(plan, weekId);
  const setId = week.days.find((d) => d.weekday === weekday)?.columnSetId ?? null;
  if (setId === null) return [];
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
}

/** 'all' = alle Planungsspalten; 'ids' = genannte Spalten in Anzeigereihenfolge, unbekannte IDs entfallen. */
export function resolveColumns(
  sel: ColumnSelection,
  columns: readonly Column[],
): readonly Column[] {
  if (sel.kind === 'all') return columns.filter((c) => c.kind === 'planning');
  const wanted = new Set(sel.ids);
  return columns.filter((c) => wanted.has(c.id));
}

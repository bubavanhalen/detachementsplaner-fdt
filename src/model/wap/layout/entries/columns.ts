// Spalten eines Eintrags an einem Tag und ihre Läufe (Vertrag E1-02d Abschnitt 2b; E1-03 `relativeColumns`;
// Beschrieb 4.4, 4.6; F-48, R-4.6-60).

import { relativeColumns } from '../../commands/columns';
import type { Column, ColumnSelection, Plan } from '../../types';
import type { ColumnGeometry, DayGeometry } from '../grid/types';

/** Folge in der Spaltenliste des Tages unmittelbar benachbarter Spalten (ein Teilblock). */
export interface Run {
  readonly x: number;
  readonly w: number;
  readonly columns: readonly ColumnGeometry[];
}

/**
 * Spalten der Auswahl am Tag nach `relativeColumns` (E1-03), in Anzeigereihenfolge; nennt die Auswahl IDs und
 * liegt keine davon am Tag, alle Planungsspalten des Tages (O-1, Q-027).
 */
export function selectColumns(
  plan: Plan,
  sel: ColumnSelection,
  dayColumns: readonly Column[],
): readonly Column[] {
  const chosen = relativeColumns(plan, sel, dayColumns);
  if (chosen.length === 0 && sel.kind === 'ids' && sel.ids.length > 0) {
    return dayColumns.filter((c) => c.kind === 'planning');
  }
  return chosen;
}

/** Läufe der gewählten Spalten von links (2b «Läufe»). */
export function runsOf(selected: readonly Column[], day: DayGeometry): readonly Run[] {
  const index = new Map(day.columns.map((c, i) => [c.columnId, i] as const));
  const groups: ColumnGeometry[][] = [];
  let previous = -2;
  for (const c of selected) {
    const i = index.get(c.id);
    if (i === undefined) continue;
    const geometry = day.columns[i] as ColumnGeometry;
    const last = groups.at(-1);
    if (last !== undefined && i === previous + 1) last.push(geometry);
    else groups.push([geometry]);
    previous = i;
  }
  return groups.map((cols) => {
    const first = cols[0] as ColumnGeometry;
    const end = cols.at(-1) as ColumnGeometry;
    return { x: first.x, w: end.x + end.w - first.x, columns: cols };
  });
}

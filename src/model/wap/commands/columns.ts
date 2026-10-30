// Spalten beim Tageswechsel und Spaltensatz-Änderung (Vertrag E1-03 Abschnitt 2b; Beschrieb 5.1, 5.2; F-48).
// Fehlende Spalten bleiben als Spalten-ID stehen (Grundlage für P1, E1-06); gezeichnet an relativer Lage.

import { castDraft } from 'immer';
import type {
  Column,
  ColumnSelection,
  ColumnSet,
  ColumnWeight,
  Entry,
  Id,
  LabelOrientation,
  Plan,
} from '../types';
import { validateColumnSet } from '../validate';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
  structurallyEqual,
} from './command';

export type ColumnSetChange =
  | {
      readonly op: 'add';
      /** Position in columns, ganze Zahl 0 … columns.length, sonst RangeError. */
      readonly index: number;
      readonly column: {
        readonly name: string;
        readonly kind: 'planning' | 'secondary';
        readonly weight?: ColumnWeight;
        readonly labelOrientation?: LabelOrientation;
        readonly defaultCategoryId?: Id | null;
      };
    }
  | {
      readonly op: 'update';
      readonly columnId: Id;
      readonly changes: Partial<
        Pick<Column, 'name' | 'weight' | 'labelOrientation' | 'defaultCategoryId'>
      >;
    }
  | { readonly op: 'remove'; readonly columnId: Id };

/** Planungs- und Nebenspalten in Anzeigereihenfolge (nur sie nehmen Einträge auf, R-4.4-05). */
function placeable(columns: readonly Column[]): readonly Column[] {
  return columns.filter((c) => c.kind === 'planning' || c.kind === 'secondary');
}

/** Name der Spalte mit dieser ID in den Spaltensätzen des Plans (erster Treffer). */
function columnName(plan: Plan, id: Id): string | null {
  for (const s of plan.columnSets) {
    const c = s.columns.find((x) => x.id === id);
    if (c !== undefined) return c.name;
  }
  return null;
}

/** Gleiche ID, sonst gleicher Name, sonst ID bleibt (fehlt im Satz → P1); 'all' bleibt 'all' (R-5.1-17/19, R-5.2-08/09). */
export function carryColumnSelection(
  plan: Plan,
  sel: ColumnSelection,
  target: readonly Column[],
): ColumnSelection {
  if (sel.kind === 'all') return sel;
  const candidates = placeable(target);
  const chosen = new Set<Id>();
  const missing: Id[] = [];
  for (const id of sel.ids) {
    if (target.some((c) => c.id === id)) {
      chosen.add(id);
      continue;
    }
    const name = columnName(plan, id);
    const byName = candidates.find((c) => c.name === name && !chosen.has(c.id));
    if (name !== null && byName !== undefined) chosen.add(byName.id);
    else if (!missing.includes(id)) missing.push(id);
  }
  const ids = [...target.filter((c) => chosen.has(c.id)).map((c) => c.id), ...missing];
  return structurallyEqual(ids, sel.ids) ? sel : { kind: 'ids', ids };
}

/** Wie carryColumnSelection für eine einzelne Spalte (Zeitfenster eines Beso); null bleibt null. */
export function carryColumnId(plan: Plan, id: Id | null, target: readonly Column[]): Id | null {
  if (id === null || target.some((c) => c.id === id)) return id;
  const name = columnName(plan, id);
  const byName = placeable(target).find((c) => c.name === name);
  return name !== null && byName !== undefined ? byName.id : id;
}

/**
 * Spalten eines Eintrags am Zieltag (Mitnehmen R-5.1-17/19, R-5.2-08/09): Block und Marker `columns`,
 * Rapport `displayColumns`, Beso-Zeitfenster `columnId`; andere Typen unverändert. Gleicher Wert → gleiches
 * Objekt.
 */
export function carryEntryColumns(plan: Plan, e: Entry, target: readonly Column[]): Entry {
  switch (e.type) {
    case 'block':
    case 'marker': {
      const columns = carryColumnSelection(plan, e.columns, target);
      return columns === e.columns ? e : { ...e, columns };
    }
    case 'rapport': {
      const displayColumns = carryColumnSelection(plan, e.displayColumns, target);
      return displayColumns === e.displayColumns ? e : { ...e, displayColumns };
    }
    case 'beso': {
      const windows = e.windows.map((w) => {
        const columnId = carryColumnId(plan, w.columnId, target);
        return columnId === w.columnId ? w : { ...w, columnId };
      });
      return windows.every((w, i) => w === e.windows[i]) ? e : { ...e, windows };
    }
    default:
      return e;
  }
}

/** Breite einer Spalte für die relative Lage (Beschrieb 4.4; V-03-6): Planungsspalte 1/2/3, Nebenspalte 1. */
function width(c: Column): number {
  if (c.kind === 'secondary') return 1;
  return c.weight === 'narrow' ? 1 : c.weight === 'wide' ? 3 : 2;
}

/** Zähler der Mitte z = 2B + w je Spalte und Summe S der Breiten (Änderungsnotiz V01, ganzzahlig). */
function centres(columns: readonly Column[]): {
  readonly z: ReadonlyMap<Id, number>;
  readonly s: number;
} {
  const z = new Map<Id, number>();
  let before = 0;
  for (const c of columns) {
    z.set(c.id, 2 * before + width(c));
    before += width(c);
  }
  return { z, s: before };
}

/** Spalten, in denen ein Eintrag am Zieltag liegt: vorhandene und fehlende an gleicher relativer Lage (F-48, R-5.1-18). */
export function relativeColumns(
  plan: Plan,
  sel: ColumnSelection,
  target: readonly Column[],
): readonly Column[] {
  if (sel.kind === 'all') return target.filter((c) => c.kind === 'planning');
  const chosen = new Set<Id>(sel.ids.filter((id) => target.some((c) => c.id === id)));
  const candidates = placeable(target);
  const goal = centres(candidates);
  for (const id of sel.ids) {
    if (chosen.has(id) || target.some((c) => c.id === id)) continue;
    const source = plan.columnSets.find((s) => s.columns.some((c) => c.id === id));
    const origin = source === undefined ? undefined : centres(placeable(source.columns));
    const zq = origin?.z.get(id);
    if (origin === undefined || zq === undefined) continue;
    let best: Column | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      if (chosen.has(c.id)) continue;
      const d = Math.abs(zq * goal.s - (goal.z.get(c.id) ?? 0) * origin.s);
      if (d < bestDistance) {
        best = c;
        bestDistance = d;
      }
    }
    if (best !== null) chosen.add(best.id);
  }
  return target.filter((c) => chosen.has(c.id));
}

function columnSetError(field: string, cause: string, nextStep: string): CommandError {
  return new CommandError('invalidColumnSet', { cause, nextStep }, { field });
}

function checkName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') {
    throw columnSetError(
      'name',
      'Die Spalte hat keinen Namen.',
      'Einen Namen für die Spalte eingeben, z.B. «Zfhr».',
    );
  }
  return trimmed;
}

function checkCategory(plan: Plan, id: Id | null | undefined): void {
  if (id === undefined || id === null || plan.legend.some((c) => c.id === id)) return;
  throw columnSetError(
    'defaultCategoryId',
    'Die Standard-Kategorie der Spalte ist in der Legende des Plans nicht vorhanden.',
    'Eine Kategorie aus der Legende wählen oder keine Standard-Kategorie setzen.',
  );
}

function checkSet(set: ColumnSet): void {
  const first = validateColumnSet(set)[0];
  if (first !== undefined)
    throw columnSetError(first.field, first.message.cause, first.message.nextStep);
}

function requireColumn(set: ColumnSet, columnId: Id): number {
  const index = set.columns.findIndex((c) => c.id === columnId);
  if (index < 0) {
    throw new CommandError(
      'unknownColumn',
      {
        cause: `Die Spalte ist im Spaltensatz «${set.name}» nicht vorhanden.`,
        nextStep: 'Eine Spalte dieses Spaltensatzes wählen.',
      },
      { field: 'columnId' },
    );
  }
  return index;
}

/** Spalte hinzufügen, ändern oder entfernen; Einträge bleiben in ihrer Spalte bzw. werden nie gelöscht (R-5.2-08/09). */
export function updateColumnSet(
  plan: Plan,
  setId: Id,
  change: ColumnSetChange,
  ctx: CommandContext,
): CommandResult {
  const setIndex = plan.columnSets.findIndex((s) => s.id === setId);
  const set = plan.columnSets[setIndex];
  if (set === undefined) {
    throw new CommandError('unknownColumnSet', {
      cause: 'Der Spaltensatz ist im Plan nicht vorhanden.',
      nextStep: 'Einen vorhandenen Spaltensatz wählen.',
    });
  }
  const label = `Spaltensatz «${set.name}» geändert`;
  switch (change.op) {
    case 'add': {
      const { index, column } = change;
      if (!Number.isInteger(index) || index < 0 || index > set.columns.length) {
        throw new RangeError(
          `updateColumnSet: index muss eine ganze Zahl von 0 bis ${set.columns.length} sein.`,
        );
      }
      const name = checkName(column.name);
      checkCategory(plan, column.defaultCategoryId);
      // Vorab mit Platzhalter-ID prüfen, damit ein ungültiger Satz nichts vergibt.
      const added = (id: Id): Column => ({
        id,
        name,
        kind: column.kind,
        weight: column.weight ?? 'normal',
        labelOrientation: column.labelOrientation ?? 'horizontal',
        defaultCategoryId: column.defaultCategoryId ?? null,
        origin: 'manual',
      });
      const columnsWith = (c: Column): Column[] => [
        ...set.columns.slice(0, index),
        c,
        ...set.columns.slice(index),
      ];
      checkSet({ ...set, columns: columnsWith(added(`c${plan.nextId}`)) });
      return command(
        plan,
        label,
        (d, t) => {
          const target = d.columnSets[setIndex];
          if (target !== undefined) target.columns.splice(index, 0, castDraft(added(t.newId('c'))));
        },
        ctx,
      );
    }
    case 'update': {
      const columnIndex = requireColumn(set, change.columnId);
      const old = set.columns[columnIndex] as Column;
      const { name, weight, labelOrientation, defaultCategoryId } = change.changes;
      const updated: Column = {
        ...old,
        ...(name === undefined ? {} : { name: checkName(name) }),
        ...(weight === undefined ? {} : { weight }),
        ...(labelOrientation === undefined ? {} : { labelOrientation }),
        ...(defaultCategoryId === undefined ? {} : { defaultCategoryId }),
      };
      checkCategory(plan, defaultCategoryId);
      const columns = set.columns.map((c, i) => (i === columnIndex ? updated : c));
      checkSet({ ...set, columns });
      return command(
        plan,
        label,
        (d) => {
          const target = d.columnSets[setIndex]?.columns[columnIndex];
          if (target === undefined) return;
          if (target.name !== updated.name) target.name = updated.name;
          if (target.weight !== updated.weight) target.weight = updated.weight;
          if (target.labelOrientation !== updated.labelOrientation) {
            target.labelOrientation = updated.labelOrientation;
          }
          if (target.defaultCategoryId !== updated.defaultCategoryId) {
            target.defaultCategoryId = updated.defaultCategoryId;
          }
        },
        ctx,
      );
    }
    case 'remove': {
      const columnIndex = requireColumn(set, change.columnId);
      checkSet({ ...set, columns: set.columns.filter((_, i) => i !== columnIndex) });
      return command(
        plan,
        label,
        (d) => {
          d.columnSets[setIndex]?.columns.splice(columnIndex, 1);
        },
        ctx,
      );
    }
  }
}

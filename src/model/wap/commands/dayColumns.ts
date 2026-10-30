// Spaltenkopf im Raster: Name und Breite einer Spalte für einen Tag oder alle Tage mit dem Spaltensatz
// (I2b-A A8; Beschrieb 4.4 Gewicht schmal/normal/breit, 5.2 Spaltensatz pro Tag).

import { castDraft } from 'immer';
import { addDays, formatDate, isIsoDate } from '../calendar';
import type { Column, ColumnSet, Entry, Id, Plan, Weekday } from '../types';
import { validateColumnSet } from '../validate';
import { combineResults } from './arrange';
import { updateColumnSet } from './columns';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
  writeEntry,
} from './command';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Geltungsbereich einer Änderung am Spaltenkopf. */
export type ColumnScope = 'day' | 'set';

export type DayColumnChanges = Partial<Pick<Column, 'name' | 'weight'>>;

/** Anzahl Tage (über alle Wochen, auch gelöschte, CR-H-D-05), die den Spaltensatz verwenden. */
export function columnSetUsage(plan: Plan, setId: Id): number {
  let n = 0;
  for (const w of [...plan.weeks, ...plan.deletedWeeks.map((x) => x.week)])
    for (const d of w.days) if (d.columnSetId === setId) n++;
  return n;
}

function requireDay(plan: Plan, weekId: Id, weekday: Weekday) {
  const weekIndex = plan.weeks.findIndex((w) => w.id === weekId);
  const week = plan.weeks[weekIndex];
  const dayIndex = WEEKDAYS.indexOf(weekday);
  const day = week?.days[dayIndex];
  if (week === undefined || day === undefined) {
    throw new CommandError('unknownWeek', {
      cause: 'Der Tag ist im Plan nicht vorhanden.',
      nextStep: 'Einen Tag einer vorhandenen Woche wählen.',
    });
  }
  const set = plan.columnSets.find((s) => s.id === day.columnSetId);
  if (set === undefined) {
    throw new CommandError('unknownColumnSet', {
      cause: 'Der Tag hat keinen Spaltensatz.',
      nextStep: 'Dem Tag zuerst einen Spaltensatz zuweisen.',
    });
  }
  return { weekIndex, week, dayIndex, set };
}

function checkedName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const trimmed = name.trim();
  if (trimmed === '') {
    throw new CommandError(
      'invalidColumnSet',
      {
        cause: 'Die Spalte hat keinen Namen.',
        nextStep: 'Einen Namen für die Spalte eingeben, z.B. «Zfhr».',
      },
      { field: 'name' },
    );
  }
  return trimmed;
}

/** Spalten-IDs eines Eintrags über eine Zuordnung alt → neu ersetzen (nur Einträge mit Datum). */
/** Spalten-IDs, die ein Eintrag nennt (Block, Marker, Rapport-Anzeige, Beso-Zeitfenster). */
function entryColumnIds(e: Entry): readonly Id[] {
  // Marker wirken über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026): kein Verweis auf eine Spalte.
  if (e.type === 'block' && e.columns.kind === 'ids') return e.columns.ids;
  if (e.type === 'rapport' && e.displayColumns.kind === 'ids') return e.displayColumns.ids;
  if (e.type === 'beso') return e.windows.flatMap((w) => (w.columnId === null ? [] : [w.columnId]));
  return [];
}

/** Alle Einträge des Plans, auch die gelöschter Wochen (wiederherstellbar; CR-4-04). */
function allEntries(plan: Plan): readonly Entry[] {
  return [...Object.values(plan.entries), ...plan.deletedWeeks.flatMap((w) => w.entries)];
}

/** Nennt ein Eintrag (auch einer gelöschten Woche) die Spalte `id`? */
function referencesColumn(plan: Plan, id: Id): boolean {
  return allEntries(plan).some((e) => entryColumnIds(e).includes(id));
}

/**
 * Anzahl Einträge (auch gelöschter Wochen), die eine Spalte des Satzes nennen: deren Lage hängt am Satz (Rückfrage
 * vor dem Löschen eines aufbewahrten Satzes; CR-4-02).
 */
export function columnSetReferences(plan: Plan, setId: Id): number {
  const set = plan.columnSets.find((s) => s.id === setId);
  if (set === undefined) return 0;
  const ids = new Set(set.columns.map((c) => c.id));
  return allEntries(plan).filter((e) => entryColumnIds(e).some((id) => ids.has(id))).length;
}

/** Name eines aufbewahrten Satzes «‹Satz› (vor Entfernen von «‹Spalte›»)», bei Bedarf mit Zähler. */
const KEPT_SET = / \(vor Entfernen von «[^»]*»\)( \(\d+\))?$/u;

/** Freier Name: `base`, sonst «base (2)», «base (3)» … (Namen eindeutig wie bei den übrigen Befehlen; CR-4-01). */
function freeSetName(plan: Plan, base: string): string {
  const taken = new Set(plan.columnSets.map((s) => s.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} (${String(n)})`)) return `${base} (${String(n)})`;
}

/**
 * Vom Befehl «Spalte entfernen» aufbewahrte Sätze, die `after` gegenüber `before` neu hat (CR-5-03): neuer Satz an
 * keinem Tag, der die ID einer Spalte trägt, die vorher in einem anderen Satz stand und nun in keinem anderen mehr.
 * Am Aufbau erkannt, nicht am Namen; ohne Formatänderung (die Sitzung führt die Liste).
 */
export function createdKeptSets(before: Plan, after: Plan): readonly Id[] {
  if (after.columnSets === before.columnSets) return [];
  const old = new Set(before.columnSets.map((s) => s.id));
  const oldColumns = new Set(before.columnSets.flatMap((s) => s.columns.map((c) => c.id)));
  return after.columnSets
    .filter(
      (s) =>
        !old.has(s.id) &&
        columnSetUsage(after, s.id) === 0 &&
        s.columns.some(
          (c) =>
            oldColumns.has(c.id) &&
            !after.columnSets.some((o) => o.id !== s.id && o.columns.some((x) => x.id === c.id)),
        ),
    )
    .map((s) => s.id);
}

/**
 * Aufbewahrter Satz: an keinem Tag (auch gelöschter Wochen) zugewiesen und – mit Liste der Sitzung – darin geführt
 * (CR-5-03); ohne Liste (Aufruf ausserhalb der Sitzung) wie bisher am Namen nach KEPT_SET.
 */
function isKeptSet(plan: Plan, setId: Id, name: string, tracked?: ReadonlySet<Id>): boolean {
  if (columnSetUsage(plan, setId) !== 0) return false;
  return tracked === undefined ? KEPT_SET.test(name) : tracked.has(setId);
}

/**
 * Räumt aufbewahrte Sätze auf, auf deren Spalten kein Eintrag mehr verweist (CR-4-03): im selben Rückgängig-Schritt
 * wie die auslösende Handlung (Eintrag verschoben, gelöscht, Spalte wieder eingefügt …). Ohne solche Sätze unverändert.
 */
export function tidyKeptColumnSets(
  result: CommandResult,
  ctx: CommandContext,
  tracked?: ReadonlySet<Id>,
): CommandResult {
  const plan = result.plan;
  const kept = plan.columnSets.filter((s) => isKeptSet(plan, s.id, s.name, tracked));
  if (kept.length === 0) return result;
  const stale = kept.filter((s) => columnSetReferences(plan, s.id) === 0).map((s) => s.id);
  if (stale.length === 0) return result;
  const cleanup = command(
    plan,
    result.label,
    (d) => {
      for (let i = d.columnSets.length - 1; i >= 0; i--)
        if (stale.includes((d.columnSets[i] as ColumnSet).id)) d.columnSets.splice(i, 1);
    },
    ctx,
  );
  return combineResults(result, cleanup, result.label);
}

function remapEntry(e: Entry, map: ReadonlyMap<Id, Id>): Entry {
  switch (e.type) {
    case 'block':
    case 'marker':
      return e.columns.kind === 'ids'
        ? { ...e, columns: { kind: 'ids', ids: e.columns.ids.map((id) => map.get(id) ?? id) } }
        : e;
    case 'rapport':
      return e.displayColumns.kind === 'ids'
        ? {
            ...e,
            displayColumns: {
              kind: 'ids',
              ids: e.displayColumns.ids.map((id) => map.get(id) ?? id),
            },
          }
        : e;
    case 'beso':
      return {
        ...e,
        windows: e.windows.map((w) =>
          w.columnId === null ? w : { ...w, columnId: map.get(w.columnId) ?? w.columnId },
        ),
      };
    default:
      return e;
  }
}

/**
 * Ändert Name und/oder Breite einer Spalte. `scope` 'set': im Spaltensatz (alle Tage, die ihn verwenden);
 * 'day': nur dieser Tag – wird der Spaltensatz auch an anderen Tagen verwendet, erhält der Tag eine Kopie mit
 * neuen Spalten-IDs, und seine Einträge folgen in die Kopie. Ein Undo-Schritt.
 */
export function updateDayColumn(
  plan: Plan,
  weekId: Id,
  weekday: Weekday,
  columnId: Id,
  changes: DayColumnChanges,
  scope: ColumnScope,
  ctx: CommandContext,
): CommandResult {
  const { weekIndex, week, dayIndex, set } = requireDay(plan, weekId, weekday);
  const name = checkedName(changes.name);
  const columnIndex = set.columns.findIndex((c) => c.id === columnId);
  const column = set.columns[columnIndex];
  if (column === undefined) {
    throw new CommandError(
      'unknownColumn',
      {
        cause: `Die Spalte ist im Spaltensatz «${set.name}» nicht vorhanden.`,
        nextStep: 'Eine Spalte dieses Spaltensatzes wählen.',
      },
      { field: 'columnId' },
    );
  }
  const update = {
    ...(name === undefined ? {} : { name }),
    ...(changes.weight === undefined ? {} : { weight: changes.weight }),
  };
  const what = name !== undefined && name !== column.name ? 'umbenannt' : 'geändert';
  if (scope === 'set' || columnSetUsage(plan, set.id) <= 1) {
    const r = updateColumnSet(plan, set.id, { op: 'update', columnId, changes: update }, ctx);
    return { ...r, label: `Spalte «${name ?? column.name}» ${what}` };
  }
  const date = isIsoDate(week.startDate) ? addDays(week.startDate, dayIndex) : null;
  return command(
    plan,
    `Spalte «${name ?? column.name}» ${what} (nur ${weekday}${date === null ? '' : ` ${formatDate(date, 'long')}`})`,
    (d, t) => {
      const map = new Map<Id, Id>();
      const columns: Column[] = set.columns.map((c, i) => {
        const id = t.newId('c');
        map.set(c.id, id);
        return i === columnIndex ? { ...c, ...update, id } : { ...c, id };
      });
      const copy: ColumnSet = {
        id: t.newId('s'),
        name: `${set.name} (${weekday}${date === null ? '' : ` ${formatDate(date, 'compact')}`})`,
        columns,
      };
      const issue = validateColumnSet(copy)[0];
      if (issue !== undefined)
        throw new CommandError('invalidColumnSet', issue.message, { field: issue.field });
      d.columnSets.push(castDraft(copy));
      const target = d.weeks[weekIndex]?.days[dayIndex];
      if (target !== undefined) target.columnSetId = copy.id;
      if (date === null) return;
      for (const e of Object.values(plan.entries)) {
        if (!('date' in e) || e.date !== date) continue;
        const next = remapEntry(e, map);
        if (next !== e) writeEntry(d, e, next);
      }
    },
    ctx,
  );
}

/** Spalte im Spaltenkopf einfügen bzw. entfernen (F-UX2 P6; Rückmeldung N1 vom 19.10.2026; Beschrieb 4.4, 5.2). */
export type DayColumnInsertRemove =
  | {
      readonly op: 'insert';
      /** Position im Spaltensatz; wird auf den Bereich der Planungsspalten begrenzt (Reihenfolge der Spaltenarten). */
      readonly index: number;
      readonly name: string;
    }
  | { readonly op: 'remove'; readonly columnId: Id };

/** Ergebnis mit der Kennung der eingefügten Spalte (null beim Entfernen). */
export type DayColumnResult = CommandResult & { readonly columnId: Id | null };

/**
 * Fügt eine Planungsspalte ein oder entfernt eine Planungs- bzw. Nebenspalte. `scope` 'set': im Spaltensatz (alle Tage,
 * die ihn verwenden); 'day': nur dieser Tag – der Tag erhält eine Kopie mit neuen Spalten-IDs, seine Einträge folgen in
 * die Kopie. Einträge der entfernten Spalte behalten ihre Spalte und tragen danach den Befund P1 (Beschrieb 5.2: nie
 * gelöscht). Ein Undo-Schritt.
 */
export function insertOrRemoveDayColumn(
  plan: Plan,
  weekId: Id,
  weekday: Weekday,
  change: DayColumnInsertRemove,
  scope: ColumnScope,
  ctx: CommandContext,
): DayColumnResult {
  const { weekIndex, week, dayIndex, set } = requireDay(plan, weekId, weekday);
  const planningCount = set.columns.filter((c) => c.kind === 'planning').length;
  let columns: Column[];
  let label: string;
  let removedId: Id | null = null;
  let insertAt = -1;
  if (change.op === 'insert') {
    const name = checkedName(change.name) ?? '';
    insertAt = Math.max(0, Math.min(planningCount, Math.trunc(change.index)));
    columns = [...set.columns];
    columns.splice(insertAt, 0, {
      id: '',
      name,
      kind: 'planning',
      weight: 'normal',
      labelOrientation: 'horizontal',
      defaultCategoryId: null,
      origin: 'manual',
    });
    label = `Spalte «${name}» eingefügt`;
  } else {
    const column = set.columns.find((c) => c.id === change.columnId);
    if (column === undefined) {
      throw new CommandError(
        'unknownColumn',
        {
          cause: `Die Spalte ist im Spaltensatz «${set.name}» nicht vorhanden.`,
          nextStep: 'Eine Spalte dieses Spaltensatzes wählen.',
        },
        { field: 'columnId' },
      );
    }
    if (column.kind === 'rap' || column.kind === 'beso') {
      throw new CommandError(
        'invalidColumnSet',
        {
          cause: `Die ${column.kind === 'rap' ? 'Rap' : 'Beso'}-Spalte gehört zu jedem Spaltensatz.`,
          nextStep: 'Eine Planungs- oder Nebenspalte wählen.',
        },
        { field: 'columnId' },
      );
    }
    if (column.kind === 'planning' && planningCount <= 1) {
      throw new CommandError(
        'invalidColumnSet',
        {
          cause: 'Der Tag braucht mindestens eine Planungsspalte.',
          nextStep: 'Zuerst eine andere Spalte einfügen, dann diese entfernen.',
        },
        { field: 'columnId' },
      );
    }
    removedId = column.id;
    columns = set.columns.filter((c) => c.id !== column.id);
    label = `Spalte «${column.name}» entfernt`;
  }
  const shared = scope === 'day' && columnSetUsage(plan, set.id) > 1;
  if (!shared) {
    if (change.op === 'insert') {
      const inserted = columns[insertAt] as Column;
      const r = updateColumnSet(
        plan,
        set.id,
        { op: 'add', index: insertAt, column: { name: inserted.name, kind: 'planning' } },
        ctx,
      );
      const id = r.plan.columnSets.find((s) => s.id === set.id)?.columns[insertAt]?.id ?? null;
      return { ...r, label, columnId: id };
    }
    const r = updateColumnSet(plan, set.id, { op: 'remove', columnId: removedId as Id }, ctx);
    if (!referencesColumn(plan, removedId as Id)) return { ...r, label, columnId: null };
    // Einträge in der entfernten Spalte behalten ihre Spalte (P1) und ihre Lage: die frühere Spaltenfolge bleibt als
    // ungenutzter Satz erhalten (nur die entfernte Spalte mit ihrer ID), damit `relativeColumns` sie in der gleichen
    // relativen Lage zeichnet – wie bei «nur dieser Tag» an einem geteilten Satz (UX-3-02; sonst ganze Breite, Q-027).
    const removed = removedId as Id;
    const before = set;
    const history = command(
      r.plan,
      label,
      (d, t) => {
        const keep: ColumnSet = {
          id: t.newId('s'),
          name: freeSetName(
            r.plan,
            `${before.name.replace(KEPT_SET, '')} (vor Entfernen von «${before.columns.find((c) => c.id === removed)?.name ?? ''}»)`,
          ),
          columns: before.columns.map((c) =>
            c.id === removed ? { ...c } : { ...c, id: t.newId('c') },
          ),
        };
        const issue = validateColumnSet(keep)[0];
        if (issue !== undefined)
          throw new CommandError('invalidColumnSet', issue.message, { field: issue.field });
        d.columnSets.push(castDraft(keep));
      },
      ctx,
    );
    return { ...combineResults(r, history, label), label, columnId: null };
  }
  const date = isIsoDate(week.startDate) ? addDays(week.startDate, dayIndex) : null;
  let newId: Id | null = null;
  const result = command(
    plan,
    `${label} (nur ${weekday}${date === null ? '' : ` ${formatDate(date, 'long')}`})`,
    (d, t) => {
      const map = new Map<Id, Id>();
      const copyColumns: Column[] = columns.map((c) => {
        const id = t.newId('c');
        if (c.id === '') newId = id;
        else map.set(c.id, id);
        return { ...c, id };
      });
      const copy: ColumnSet = {
        id: t.newId('s'),
        name: `${set.name} (${weekday}${date === null ? '' : ` ${formatDate(date, 'compact')}`})`,
        columns: copyColumns,
      };
      const issue = validateColumnSet(copy)[0];
      if (issue !== undefined)
        throw new CommandError('invalidColumnSet', issue.message, { field: issue.field });
      d.columnSets.push(castDraft(copy));
      const target = d.weeks[weekIndex]?.days[dayIndex];
      if (target !== undefined) target.columnSetId = copy.id;
      if (date === null) return;
      for (const e of Object.values(plan.entries)) {
        if (!('date' in e) || e.date !== date) continue;
        const next = remapEntry(e, map);
        if (next !== e) writeEntry(d, e, next);
      }
    },
    ctx,
  );
  return { ...result, columnId: newId };
}

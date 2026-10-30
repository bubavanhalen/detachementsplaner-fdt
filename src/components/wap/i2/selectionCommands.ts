// Befehle auf der Auswahl (I2b-B B1–B3; Beschrieb 5.1, 6 «Tastatur»): gemeinsames Verschieben mit Nachbarblöcken
// nach Variante c (I2b-A A7), Dauer per Tastatur, Duplizieren, Einfügen mit relativer Lage. Jeder Aufruf ist
// genau ein Befehl und damit genau ein Undo-Schritt. Nutzt nur die Befehle des Modells (AE-005: nicht umbauen).

import { daysBetween, weekdayOf } from '../../../model/wap/calendar';
import {
  type ArrangeMode,
  applyArrangement,
  arrangeBlocks,
  combineResults,
  writeArrangement,
} from '../../../model/wap/commands/arrange';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  weekOfDate,
} from '../../../model/wap/commands/command';
import {
  copyEntries,
  type MoveSpec,
  moveEntries,
  updateEntry,
} from '../../../model/wap/commands/entries';
import { dayColumns } from '../../../model/wap/derive/columns';
import type { Column, Entry, Id, IsoDate, Plan } from '../../../model/wap/types';

/** Zeitspanne eines Eintrags für relative Lagen (Beginn bis Ende in Minuten des eigenen Tags). */
export function entrySpan(e: Entry): { readonly from: number; readonly to: number } | null {
  switch (e.type) {
    case 'block':
    case 'rapport': {
      const t = e.time;
      if (t.form === 'range') return { from: t.from, to: t.to };
      if (t.form === 'point') return { from: t.at, to: t.at + 30 };
      if (t.form === 'from') return { from: t.from, to: t.from + 60 };
      return { from: t.to - 60, to: t.to };
    }
    case 'marker':
      return { from: e.at, to: e.at };
    case 'beso': {
      const spans = e.windows.map((w) =>
        w.time.form === 'range'
          ? { from: w.time.from, to: w.time.to }
          : w.time.form === 'point'
            ? { from: w.time.at, to: w.time.at + 30 }
            : null,
      );
      const valid = spans.filter((s): s is { from: number; to: number } => s !== null);
      if (valid.length === 0) return null;
      return {
        from: Math.min(...valid.map((s) => s.from)),
        to: Math.max(...valid.map((s) => s.to)),
      };
    }
    default:
      return null;
  }
}

/** Erster Tag eines Eintrags. */
export function entryDate(e: Entry): IsoDate | null {
  if (e.type === 'querbalken') return e.fromDate;
  if (e.type === 'multiDayRemark') return e.scope.kind === 'range' ? e.scope.fromDate : null;
  return e.date;
}

/** Frühester Eintrag (Tag, dann Beginn) einer Auswahl: Bezugspunkt für relative Lagen. */
export function referencePoint(
  entries: readonly Entry[],
): { readonly date: IsoDate; readonly minute: number } | null {
  let best: { date: IsoDate; minute: number } | null = null;
  for (const e of entries) {
    const date = entryDate(e);
    if (date === null) continue;
    const minute = entrySpan(e)?.from ?? 0;
    if (
      best === null ||
      daysBetween(best.date, date) < 0 ||
      (date === best.date && minute < best.minute)
    )
      best = { date, minute };
  }
  return best;
}

/** Ohne Planeinträge des übrigen Auswahl-Teils: so passt Variante c nur Nachbarn ausserhalb der Auswahl an. */
function withoutOthers(plan: Plan, keep: Id, others: ReadonlySet<Id>): Plan {
  const entries: Record<Id, Entry> = {};
  for (const [id, e] of Object.entries(plan.entries))
    if (id === keep || !others.has(id)) entries[id] = e;
  return { ...plan, entries };
}

/**
 * Verschiebt alle Einträge der Auswahl um dieselbe Zeit, dieselben Tage und Spalten (moveEntries) und passt danach
 * je verschobenem Block die Nachbarn gleicher Spalten nach Variante c an (gekürzt bzw. ausgespart; Shift rückt nach;
 * 'none' ändert nichts). Einträge der Auswahl werden nie gegeneinander angepasst. Ein Befehl, ein Undo-Schritt.
 */
export function moveSelection(
  plan: Plan,
  ids: readonly Id[],
  move: MoveSpec,
  mode: ArrangeMode,
  ctx: CommandContext,
): CommandResult {
  const moved = moveEntries(plan, ids, move, ctx);
  if (mode === 'none' || moved.patches.length === 0) return moved;
  const selected = new Set(ids);
  let result = moved;
  for (const id of ids) {
    const e = result.plan.entries[id];
    if (e?.type !== 'block' || e.time.form !== 'range') continue;
    const arrangement = arrangeBlocks(
      withoutOthers(result.plan, id, selected),
      {
        kind: 'move',
        blockId: id,
        target: { date: e.date, from: e.time.from, to: e.time.to, columns: e.columns },
      },
      mode,
    );
    // Am Tagesende kein Platz (CR-F3-01): verständliche Meldung statt einer Zeit über 2400.
    if (arrangement.dayEnd === true)
      throw new CommandError(
        'invalidPlacement',
        {
          cause: 'Die folgenden Einträge reichen über das Tagesende.',
          nextStep: 'Weniger weit verschieben oder mit Alt parallel legen.',
        },
        { field: 'time', entryId: id },
      );
    // Auch nur mitrückende Beso-Kästchen bzw. Rapporte zählen (CR-F3-03).
    if (
      arrangement.changes.length === 0 &&
      arrangement.splits.length === 0 &&
      (arrangement.shifts ?? []).length === 0
    )
      continue;
    const neighbours = writeArrangement(result.plan, arrangement, moved.label, ctx);
    result = combineResults(result, neighbours, moved.label);
  }
  return result;
}

/** Dauer per Tastatur (Shift+↑/↓): Ende um `delta` Minuten, mindestens 15 Min; Block mit Nachbar nach Variante c. */
export function resizeEnd(plan: Plan, id: Id, delta: number, ctx: CommandContext): CommandResult {
  const e = plan.entries[id];
  if (e?.type === 'block' && e.time.form === 'range') {
    const time = e.time;
    const edge = Math.max(time.from + 15, Math.min(time.from + 1440, time.to + delta));
    return applyArrangement(
      plan,
      { kind: 'end', blockId: id, edge },
      'adjust',
      (p, t) => ({
        ...updateEntry(p, id, 'block', { time: { form: 'range', from: t.from, to: t.to } }, ctx),
        entryId: id,
      }),
      ctx,
    );
  }
  if (e?.type === 'rapport') {
    const from = e.time.form === 'range' ? e.time.from : e.time.at;
    const to = e.time.form === 'range' ? e.time.to : e.time.at + 30;
    const next = Math.max(from + 15, Math.min(1440, to + delta));
    return updateEntry(plan, id, 'rapport', { time: { form: 'range', from, to: next } }, ctx);
  }
  return {
    plan,
    patches: [],
    inversePatches: [],
    label: '',
    affectedDates: [],
    affectedEntryIds: [],
  };
}

/** Ctrl+D: Kopie unmittelbar anschliessend (Beginn = Ende der Auswahl, gleiche Spalten; UI-Richtlinie 5.7). */
export function duplicateSelection(
  plan: Plan,
  ids: readonly Id[],
  ctx: CommandContext,
): CommandResult & { readonly newIds: readonly Id[] } {
  const entries = ids.map((id) => plan.entries[id]).filter((e): e is Entry => e !== undefined);
  const spans = entries.map(entrySpan).filter((s): s is { from: number; to: number } => s !== null);
  const span =
    spans.length === 0
      ? 0
      : Math.max(...spans.map((s) => s.to)) - Math.min(...spans.map((s) => s.from));
  const delta = Math.max(15, Math.round(span / 5) * 5);
  const r = copyEntries(plan, ids, { deltaMinutes: delta }, ctx);
  return { ...r, label: `${r.label.replace(/ kopiert$/, ' dupliziert')}` };
}

/** Spalten des Tages von `date` im Plan; ausserhalb der Wochen leer. */
export function columnsAt(plan: Plan, date: IsoDate): readonly Column[] {
  const week = weekOfDate(plan, date);
  return week === null ? [] : dayColumns(plan, week.id, weekdayOf(date));
}

export interface PasteResult extends CommandResult {
  readonly newIds: readonly Id[];
  /** Namen der Spalten, die es am Ziel nicht gibt (gleiche relative Lage, Befund P1). */
  readonly missing: readonly string[];
}

/** Name einer Spalten-ID in den Spaltensätzen des Plans. */
function columnName(plan: Plan, id: Id): string {
  for (const set of plan.columnSets) {
    const c = set.columns.find((x) => x.id === id);
    if (c !== undefined) return c.name;
  }
  return id;
}

/** Spalten der Einträge, die am eigenen Tag fehlen (P1-Kandidaten nach dem Einfügen oder Verschieben). */
export function missingColumns(plan: Plan, ids: readonly Id[]): readonly string[] {
  const names = new Set<string>();
  for (const id of ids) {
    const e = plan.entries[id];
    if (e === undefined || !('date' in e)) continue;
    const present = new Set(columnsAt(plan, e.date).map((c) => c.id));
    const used =
      e.type === 'block'
        ? e.columns.kind === 'ids'
          ? e.columns.ids
          : []
        : e.type === 'beso'
          ? e.windows.map((w) => w.columnId).filter((c): c is Id => c !== null)
          : [];
    for (const c of used) if (!present.has(c)) names.add(columnName(plan, c));
  }
  return [...names];
}

/**
 * Einfügen (Ctrl+V; UI-Richtlinie 5.7): Der früheste Eintrag beginnt an Tag und Zeit des Ziels, die übrigen
 * behalten ihre relative Lage. Spalten gleichen Namens am Zieltag, sonst gleiche relative Lage (Befund P1).
 * `move` true: die Einträge werden verschoben (nach Ausschneiden), sonst unabhängig kopiert.
 */
export function pasteEntries(
  plan: Plan,
  ids: readonly Id[],
  target: { readonly date: IsoDate; readonly minute: number },
  move: boolean,
  ctx: CommandContext,
): PasteResult {
  const existing = ids.filter((id) => plan.entries[id] !== undefined);
  const entries = existing.map((id) => plan.entries[id] as Entry);
  const ref = referencePoint(entries);
  if (ref === null) throw new RangeError('Keine einfügbaren Einträge.');
  const spec: MoveSpec = {
    deltaMinutes: Math.round((target.minute - ref.minute) / 5) * 5,
    dayOffset: daysBetween(ref.date, target.date),
  };
  if (move) {
    const r = moveSelection(plan, existing, spec, 'adjust', ctx);
    return { ...r, newIds: existing, missing: missingColumns(r.plan, existing) };
  }
  const r = copyEntries(plan, existing, spec, ctx);
  return {
    ...r,
    label:
      existing.length === 1
        ? r.label.replace(/ kopiert$/, ' eingefügt')
        : `${existing.length} Einträge eingefügt`,
    missing: missingColumns(r.plan, r.newIds),
  };
}

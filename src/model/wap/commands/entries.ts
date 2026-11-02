// Befehle auf Einträgen (Vertrag E1-03 Abschnitt 2a): erfassen, ändern, verschieben, löschen, kopieren;
// Standard-Kategorie (R-4.7-11/12, R-4.6-18) und Kategorievorschlag (R-4.7-10).

import { castDraft } from 'immer';
import { addDays, isIsoDate, weekdayOf } from '../calendar';
import { dayColumns, resolveColumns } from '../derive/columns';
import type { EntryInput } from '../factories';
import { isMilTime, isValidTimeSpec } from '../time';
import type {
  Beso,
  Block,
  Column,
  ColumnSelection,
  DayRemark,
  Entry,
  EntryStatus,
  EntryType,
  Id,
  IsoDate,
  Marker,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
  RichText,
  Subtask,
  TimeSpec,
} from '../types';
import { carryEntryColumns } from './columns';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  clonePlain,
  command,
  entryError,
  entryLabel,
  requireEntry,
  structurallyEqual,
  weekOfDate,
  writeEntry,
} from './command';
import { linkBesoRefs } from './refs';
import { subtaskFields, subtasksForBlock, withSubtasks } from './subtasks';

/** Zeitfenster ohne ID; die ID vergibt der Befehl (Präfix 't'). Standard: columnId null, supplement ''. */
export interface BesoWindowDraft {
  readonly time: TimeSpec;
  readonly columnId?: Id | null;
  readonly supplement?: string;
}

/** Pflichtfelder K, übrige Felder optional mit Standardwerten (Abschnitt 2a); X entfällt ganz. */
type DraftOf<
  T extends Entry,
  K extends keyof EntryInput<T>,
  X extends keyof EntryInput<T> = never,
> = { readonly type: T['type'] } & Pick<EntryInput<T>, K> & Partial<Omit<EntryInput<T>, K | X>>;

export type BlockDraft = DraftOf<Block, 'date' | 'time' | 'columns'>;
export type QuerbalkenDraft = DraftOf<Querbalken, 'fromDate' | 'toDate'>;
export type MarkerDraft = DraftOf<Marker, 'date' | 'at' | 'kind'>;
export type RapportDraft = DraftOf<Rapport, 'date' | 'code' | 'time'>;
/** Nummer und Fixierung vergibt die Nummerierung (Abschnitt 3); fixieren mit setBesoNumberFixed. */
export type BesoDraft = DraftOf<Beso, 'date', 'windows' | 'besoNumber' | 'numberFixed'> & {
  readonly windows: readonly BesoWindowDraft[];
};
export type DayRemarkDraft = DraftOf<DayRemark, 'date' | 'text'>;
export type MultiDayRemarkDraft = DraftOf<MultiDayRemark, 'text' | 'scope'>;
export type EntryDraft =
  | BlockDraft
  | QuerbalkenDraft
  | MarkerDraft
  | RapportDraft
  | BesoDraft
  | DayRemarkDraft
  | MultiDayRemarkDraft;

/** Nicht über updateEntry änderbar; Zeitfenster, Nummer und Fixierung des Beso über beso.ts. */
type NotEditable = 'id' | 'type' | 'createdSeq' | 'removedText';
export type EntryChanges<K extends EntryType> = Partial<
  Omit<
    Extract<Entry, { readonly type: K }>,
    NotEditable | (K extends 'beso' ? 'windows' | 'besoNumber' | 'numberFixed' : never)
  >
>;

/** Massenänderung (R-5.1-21): ein Befehl, ein Undo-Schritt. */
export interface BulkChanges {
  readonly categoryId?: Id;
  readonly status?: EntryStatus;
}

/** Ganze Zahlen; deltaMinutes Vielfaches von 5, sonst RangeError (Programmfehler). */
export interface MoveSpec {
  readonly deltaMinutes?: number;
  readonly dayOffset?: number;
  readonly columnShift?: number;
}

// ---------------------------------------------------------------------------------------------------------
// Gemeinsames (Abschnitt 2 «Gemeinsam»)
// ---------------------------------------------------------------------------------------------------------

/** Spalten des Tages von `date`; null, wenn das Datum ungültig ist oder in keiner Woche liegt. */
function dayColumnsAt(plan: Plan, date: IsoDate): readonly Column[] | null {
  const week = weekOfDate(plan, date);
  return week === null ? null : dayColumns(plan, week.id, weekdayOf(date));
}

/** Planungs- und Nebenspalten in Anzeigereihenfolge. */
function placeableIds(columns: readonly Column[]): readonly Id[] {
  return columns.filter((c) => c.kind === 'planning' || c.kind === 'secondary').map((c) => c.id);
}

/** Auswahl ohne Doppel in Eingabereihenfolge; leer → emptySelection, unbekannt → notFound (erste). */
function selection(plan: Plan, ids: readonly Id[]): readonly Entry[] {
  if (ids.length === 0) {
    throw new CommandError('emptySelection', {
      cause: 'Es ist kein Eintrag gewählt.',
      nextStep: 'Mindestens einen Eintrag wählen.',
    });
  }
  return [...new Set(ids)].map((id) => requireEntry(plan, id));
}

/** Einzelbeschriftung mit dem Eintrag aus `plan` (falls vorhanden), sonst «‹n› Einträge ‹Verb›» (1c). */
function selectionLabel(plan: Plan, entries: readonly Entry[], verb: string): string {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only === undefined) return `${entries.length} Einträge ${verb}`;
  const current = Object.hasOwn(plan.entries, only.id) ? plan.entries[only.id] : undefined;
  return entryLabel(plan, current ?? only, verb);
}

/** Titel verlinken (R-5.3-11): Plan vor dem Befehl, Datum nach dem Befehl; ungültiges Datum → unverändert. */
function linkTitle(plan: Plan, date: IsoDate, title: RichText): RichText {
  return isIsoDate(date) ? linkBesoRefs(plan, date, title) : title;
}

function inLegend(plan: Plan, id: Id | null): id is Id {
  return id !== null && plan.legend.some((c) => c.id === id);
}

/** Rückfall-Kategorie (V-03-1): erste nicht neutrale der Legende, sonst die erste; leere Legende → ''. */
function fallbackCategory(plan: Plan): Id {
  return (plan.legend.find((c) => !c.neutral) ?? plan.legend[0])?.id ?? '';
}

/** Zuletzt verwendete Kategorie, falls in der Legende, sonst Rückfall (R-4.7-12; V-03-1, V-03-3). */
function lastUsedOrFallback(plan: Plan): Id {
  return inLegend(plan, plan.lastUsedCategoryId) ? plan.lastUsedCategoryId : fallbackCategory(plan);
}

/**
 * Standard-Kategorie eines Blocks: linke Spalte mit Standard-Kategorie (R-4.7-11, F-08), sonst die zuletzt
 * verwendete, sonst «Ltg Kp», sonst der Rückfall V-03-1 (R-4.7-12; V-03-1 für Blöcke revidiert nach Entscheid
 * Auftraggeber 19.10.2026 «15: ja», UX-H-14, F-LAYOUT2).
 */
function blockCategory(plan: Plan, date: IsoDate, columns: ColumnSelection): Id {
  const own = resolveColumns(columns, dayColumnsAt(plan, date) ?? []).find((c) =>
    inLegend(plan, c.defaultCategoryId),
  );
  if (own?.defaultCategoryId != null) return own.defaultCategoryId;
  if (inLegend(plan, plan.lastUsedCategoryId)) return plan.lastUsedCategoryId;
  return plan.legend.find((c) => c.name === 'Ltg Kp')?.id ?? fallbackCategory(plan);
}

/** Kategorie eines Rapports (R-4.6-18, F-09; V-03-2): Rapportliste, sonst «Ltg Kp», sonst Rückfall. */
function rapportCategory(plan: Plan, code: string): Id {
  const trimmed = code.trim();
  const listed = plan.rapportCodes.find((r) => r.code === trimmed);
  if (listed !== undefined) return listed.categoryId;
  return plan.legend.find((c) => c.name === 'Ltg Kp')?.id ?? fallbackCategory(plan);
}

// ---------------------------------------------------------------------------------------------------------
// Erfassen
// ---------------------------------------------------------------------------------------------------------

interface DraftBase {
  readonly status?: EntryStatus;
  readonly internalNote?: string;
}

function baseFields(d: DraftBase, id: Id, seq: number) {
  return {
    id,
    createdSeq: seq,
    status: d.status ?? 'confirmed',
    changed: false,
    internalNote: d.internalNote ?? '',
    removedText: [] as readonly string[],
  } as const;
}

/** Neuer Eintrag mit Standardwerten (Abschnitt 2a createEntry, Änderungsnotiz V09i). */
function buildEntry(
  plan: Plan,
  draft: EntryDraft,
  id: Id,
  seq: number,
  windowIds: readonly Id[],
): Entry {
  switch (draft.type) {
    case 'block':
      return withSubtasks(
        {
          ...baseFields(draft, id, seq),
          type: 'block',
          date: draft.date,
          time: draft.time,
          columns: draft.columns,
          title: linkTitle(plan, draft.date, draft.title ?? []),
          supplement: draft.supplement ?? '',
          ltg: draft.ltg ?? '',
          tn: draft.tn ?? '',
          tpt: draft.tpt ?? '',
          ort: draft.ort ?? '',
          tenue: draft.tenue ?? '',
          printTn: draft.printTn ?? plan.printDefaults.printTn,
          printTenue: draft.printTenue ?? plan.printDefaults.printTenue,
          categoryId: draft.categoryId ?? blockCategory(plan, draft.date, draft.columns),
          secondCategoryId: draft.secondCategoryId ?? null,
          textDirection: draft.textDirection ?? 'auto',
          openEnd: draft.openEnd ?? false,
        },
        // Teilaufgaben genau { title, ltg, ort }, Titel verknüpft; leere Liste = Feld fehlt (E1-02h §4b).
        draft.subtasks === undefined
          ? undefined
          : subtasksForBlock(plan, draft.date, draft.subtasks),
      );
    case 'querbalken':
      return {
        ...baseFields(draft, id, seq),
        type: 'querbalken',
        title: linkTitle(plan, draft.fromDate, draft.title ?? []),
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        columns: draft.columns ?? { kind: 'all' },
        categoryId: draft.categoryId ?? null,
      };
    case 'marker':
      return {
        ...baseFields(draft, id, seq),
        type: 'marker',
        date: draft.date,
        at: draft.at,
        kind: draft.kind,
        customKind: draft.customKind ?? '',
        columns: draft.columns ?? { kind: 'all' },
        asFlatBlock: draft.asFlatBlock ?? false,
      };
    case 'rapport':
      return {
        ...baseFields(draft, id, seq),
        type: 'rapport',
        date: draft.date,
        code: draft.code.trim(),
        time: draft.time,
        ort: draft.ort ?? '',
        tn: draft.tn ?? '',
        categoryId: draft.categoryId ?? rapportCategory(plan, draft.code),
        display: draft.display ?? 'rapColumn',
        displayColumns: draft.displayColumns ?? { kind: 'ids', ids: [] },
      };
    case 'beso':
      return {
        ...baseFields(draft, id, seq),
        type: 'beso',
        date: draft.date,
        title: linkTitle(plan, draft.date, draft.title ?? []),
        windows: draft.windows.map((w, i) => ({
          id: windowIds[i] ?? '',
          time: w.time,
          columnId: w.columnId ?? null,
          supplement: w.supplement ?? '',
        })),
        ltg: draft.ltg ?? '',
        tn: draft.tn ?? '',
        tpt: draft.tpt ?? '',
        ort: draft.ort ?? '',
        categoryId: draft.categoryId ?? lastUsedOrFallback(plan),
        besoNumber: null,
        numberFixed: false,
        agendaOverride: draft.agendaOverride ?? null,
      };
    case 'dayRemark':
      return {
        ...baseFields(draft, id, seq),
        type: 'dayRemark',
        date: draft.date,
        text: draft.text,
      };
    case 'multiDayRemark':
      return {
        ...baseFields(draft, id, seq),
        type: 'multiDayRemark',
        text: draft.text,
        scope: draft.scope,
        number: draft.number ?? null,
        refBoxColumnId: draft.refBoxColumnId ?? null,
      };
  }
}

/**
 * Eigenschaft `subtasks` eines Entwurfs, der kein Block ist (zur Laufzeit trotz Typ): wird übernommen, damit die
 * Prüfung des Befehls `invalidEntry` mit field 'subtasks' meldet statt sie still zu verwerfen (E1-02h §4b, R-4.6-64).
 */
function withForeignSubtasks(draft: EntryDraft, e: Entry): Entry {
  const given = draft as Readonly<Record<string, unknown>>;
  if (e.type === 'block' || !Object.hasOwn(given, 'subtasks') || given.subtasks === undefined) {
    return e;
  }
  const withField: Readonly<Record<string, unknown>> = { ...e, subtasks: given.subtasks };
  return withField as unknown as Entry;
}

/** Neuer Eintrag mit Standardwerten und Standard-Kategorie (R-4.7-11/12, R-4.6-18); Titel mit linkBesoRefs (R-5.3-11). */
export function createEntry(
  plan: Plan,
  draft: EntryDraft,
  ctx: CommandContext,
): CommandResult & { readonly entryId: Id } {
  // Erste ID des Rezepts (Abschnitt 1a Schritt 1: prefix + nextId).
  const entryId = `e${plan.nextId}`;
  const r = command(
    plan,
    '',
    (d, t) => {
      const id = t.newId('e');
      const windowIds = draft.type === 'beso' ? draft.windows.map(() => t.newId('t')) : [];
      const e = withForeignSubtasks(draft, buildEntry(plan, draft, id, t.newSeq(), windowIds));
      d.entries[id] = castDraft(clonePlain(e));
      // «Zuletzt verwendet» zählt jede Erfassung eines Blocks, auch mit Standard (V-03-4).
      if (e.type === 'block' && d.lastUsedCategoryId !== e.categoryId) {
        d.lastUsedCategoryId = e.categoryId;
      }
    },
    ctx,
  );
  return { ...r, label: entryLabel(r.plan, requireEntry(r.plan, entryId), 'erstellt'), entryId };
}

// ---------------------------------------------------------------------------------------------------------
// Ändern
// ---------------------------------------------------------------------------------------------------------

const NOT_EDITABLE: ReadonlySet<string> = new Set(['id', 'type', 'createdSeq', 'removedText']);
const NOT_EDITABLE_BESO: ReadonlySet<string> = new Set(['windows', 'besoNumber', 'numberFixed']);

function wrongEntryType(id: Id): CommandError {
  return new CommandError(
    'wrongEntryType',
    {
      cause: 'Der gewählte Eintrag hat einen anderen Typ als erwartet.',
      nextStep: 'Die Ansicht neu laden und den Eintrag erneut bearbeiten.',
    },
    { entryId: id },
  );
}

/** Zweite Kategorie entfällt, wenn die erste ihr gleich wird und keine zweite angegeben ist (2a updateEntry). */
function dropSameSecond(e: Entry, categoryId: Id | undefined, secondGiven: boolean): Entry {
  if (e.type !== 'block' || categoryId === undefined || secondGiven) return e;
  return e.secondCategoryId === categoryId ? { ...e, secondCategoryId: null } : e;
}

/** Ändert Felder eines Eintrags vom Typ `type`; Datumsänderung wie moveEntries (Spalten, Nummern). */
export function updateEntry<K extends EntryType>(
  plan: Plan,
  id: Id,
  type: K,
  changes: EntryChanges<K>,
  ctx: CommandContext,
): CommandResult {
  const e = requireEntry(plan, id);
  if (e.type !== type) throw wrongEntryType(id);
  const given = changes as Readonly<Record<string, unknown>>;
  const fields: Record<string, unknown> = { ...e };
  for (const [key, value] of Object.entries(given)) {
    if (value === undefined || NOT_EDITABLE.has(key)) continue;
    if (e.type === 'beso' && NOT_EDITABLE_BESO.has(key)) continue;
    fields[key] = value;
  }
  let next = fields as unknown as Entry;
  // Rapport-Kürzel am Rand getrimmt gespeichert (Orchestrator, Code-Review Runde 1 (b)).
  if (next.type === 'rapport' && typeof given.code === 'string') {
    next = { ...next, code: given.code.trim() };
  }
  const categoryId = typeof given.categoryId === 'string' ? given.categoryId : undefined;
  next = dropSameSecond(next, categoryId, given.secondCategoryId !== undefined);
  // Datum geändert: Spalten folgen wie beim Verschieben, ausser die Änderung nennt sie (2a updateEntry).
  const columnsGiven =
    next.type === 'rapport' ? given.displayColumns !== undefined : given.columns !== undefined;
  if ('date' in next && 'date' in e && next.date !== e.date && !columnsGiven) {
    next = carryToDate(plan, next);
  }
  if (given.title !== undefined) {
    if (next.type === 'block' || next.type === 'beso') {
      next = { ...next, title: linkTitle(plan, next.date, next.title) };
    } else if (next.type === 'querbalken') {
      next = { ...next, title: linkTitle(plan, next.fromDate, next.title) };
    }
  }
  // Teilaufgaben ersetzen die Liste: genau { title, ltg, ort }, Titel verknüpft über das Datum nach der Änderung;
  // leere Liste entfernt das Feld (E1-02h §4b, K-1, K-2, K-5, V-02h-4). Andere Typen meldet die Prüfung.
  if (next.type === 'block' && given.subtasks !== undefined) {
    next = withSubtasks(
      next,
      subtasksForBlock(plan, next.date, given.subtasks as readonly Subtask[]),
    );
  }
  const final = next;
  const r = command(
    plan,
    '',
    (d) => {
      writeEntry(d, e, final);
      // «Zuletzt verwendet» folgt jeder Kategorieänderung eines Blocks (V-03-4).
      if (
        final.type === 'block' &&
        e.type === 'block' &&
        final.categoryId !== e.categoryId &&
        d.lastUsedCategoryId !== final.categoryId
      ) {
        d.lastUsedCategoryId = final.categoryId;
      }
    },
    ctx,
  );
  return { ...r, label: selectionLabel(r.plan, [e], 'geändert') };
}

/** Kategorie (Block, Querbalken, Rapport, Beso) und Status (alle) einer Massenänderung (2a updateEntries). */
function applyBulk(e: Entry, changes: BulkChanges): Entry {
  let next: Entry = e;
  const { categoryId, status } = changes;
  if (categoryId !== undefined) {
    switch (next.type) {
      case 'block':
      case 'querbalken':
      case 'rapport':
      case 'beso':
        if (next.categoryId !== categoryId) next = { ...next, categoryId };
        break;
      default:
        break;
    }
    next = dropSameSecond(next, categoryId, false);
  }
  if (status !== undefined && next.status !== status) next = { ...next, status };
  return next;
}

/** Kategorie und/oder Status mehrerer Einträge (R-5.1-21). */
export function updateEntries(
  plan: Plan,
  ids: readonly Id[],
  changes: BulkChanges,
  ctx: CommandContext,
): CommandResult {
  const entries = selection(plan, ids);
  const updated: Entry[] = [];
  for (const e of entries) {
    const next = applyBulk(e, changes);
    if (next === e) continue;
    const error = entryError(plan, next);
    if (error !== null) throw error;
    updated.push(next);
  }
  // «Zuletzt verwendet» nur, wenn ein Block tatsächlich eine andere Kategorie erhält (V-03-4; Orchestrator,
  // Code-Review Runde 1 (a)).
  const lastUsed =
    changes.categoryId !== undefined &&
    updated.some((x) => {
      const before = plan.entries[x.id];
      return x.type === 'block' && before?.type === 'block' && x.categoryId !== before.categoryId;
    })
      ? changes.categoryId
      : null;
  const r = command(
    plan,
    '',
    (d) => {
      for (const next of updated) writeEntry(d, plan.entries[next.id], next);
      if (lastUsed !== null && d.lastUsedCategoryId !== lastUsed) d.lastUsedCategoryId = lastUsed;
    },
    ctx,
  );
  return { ...r, label: selectionLabel(r.plan, entries, 'geändert') };
}

// ---------------------------------------------------------------------------------------------------------
// Verschieben und Kopieren (Änderungsnotiz V02: Zeit, dann Tag mit Mitnehmen, dann columnShift)
// ---------------------------------------------------------------------------------------------------------

interface Move {
  readonly delta: number;
  readonly days: number;
  readonly shift: number;
}

function moveSpec(m: MoveSpec): Move {
  const value = (v: number | undefined, name: string): number => {
    const n = v ?? 0;
    if (!Number.isInteger(n)) throw new RangeError(`MoveSpec.${name} muss eine ganze Zahl sein.`);
    return n;
  };
  const delta = value(m.deltaMinutes, 'deltaMinutes');
  if (delta % 5 !== 0)
    throw new RangeError('MoveSpec.deltaMinutes muss ein Vielfaches von 5 sein.');
  return {
    delta,
    days: value(m.dayOffset, 'dayOffset'),
    shift: value(m.columnShift, 'columnShift'),
  };
}

/** Ergebnis eines Schritts: neuer Eintrag oder der Fehler dieses Eintrags (zurückgestellt bis zu seiner Prüfung). */
type Step = { readonly entry: Entry; readonly error: null } | { readonly error: CommandError };

function shiftTime<T extends TimeSpec>(t: T, d: number): T {
  switch (t.form) {
    case 'point':
      return { ...t, at: t.at + d };
    case 'range':
      return { ...t, from: t.from + d, to: t.to + d };
    case 'from':
      return { ...t, from: t.from + d };
    case 'until':
      return { ...t, to: t.to + d };
    case 'deadline':
      return t.to === undefined ? t : { ...t, to: t.to + d };
    default:
      return t;
  }
}

function invalidTime(e: Entry, field: string, delta: number): CommandError {
  return new CommandError(
    'invalidTime',
    {
      cause: `Um ${delta} Minuten verschoben läge die Zeit ausserhalb von 0000 bis 2400.`,
      nextStep: 'Weniger weit verschieben oder die Zeit des Eintrags zuerst anpassen.',
    },
    { field, entryId: e.id },
  );
}

/** Schritt 1: jede Zeitangabe um `delta` Minuten (Frist nur mit Zeit); ungültig → invalidTime. */
function shiftEntryTime(e: Entry, delta: number): Step {
  switch (e.type) {
    case 'block': {
      const time = shiftTime(e.time, delta);
      return isValidTimeSpec(time)
        ? { entry: { ...e, time }, error: null }
        : { error: invalidTime(e, 'time', delta) };
    }
    case 'rapport': {
      const time = shiftTime(e.time, delta);
      return isValidTimeSpec(time)
        ? { entry: { ...e, time }, error: null }
        : { error: invalidTime(e, 'time', delta) };
    }
    case 'marker': {
      const at = e.at + delta;
      return isMilTime(at)
        ? { entry: { ...e, at }, error: null }
        : { error: invalidTime(e, 'at', delta) };
    }
    case 'beso': {
      const windows = e.windows.map((w) => ({ ...w, time: shiftTime(w.time, delta) }));
      const bad = windows.findIndex((w) => !isValidTimeSpec(w.time));
      return bad < 0
        ? { entry: { ...e, windows }, error: null }
        : { error: invalidTime(e, `windows[${bad}].time`, delta) };
    }
    default:
      return { entry: e, error: null };
  }
}

function shiftDate(d: IsoDate, days: number): IsoDate {
  return isIsoDate(d) ? addDays(d, days) : d;
}

/** Schritt 2: Datumsfelder um `days`; Typen mit Datum nehmen ihre Spalten an den Zieltag mit. */
function shiftEntryDate(plan: Plan, e: Entry, days: number): Entry {
  switch (e.type) {
    case 'querbalken':
      return { ...e, fromDate: shiftDate(e.fromDate, days), toDate: shiftDate(e.toDate, days) };
    case 'multiDayRemark':
      return e.scope.kind === 'range'
        ? {
            ...e,
            scope: {
              kind: 'range',
              fromDate: shiftDate(e.scope.fromDate, days),
              toDate: shiftDate(e.scope.toDate, days),
            },
          }
        : e;
    default: {
      const moved: Entry = { ...e, date: shiftDate(e.date, days) };
      return carryToDate(plan, moved);
    }
  }
}

/** Spalten an die Tagesspalten des eigenen Datums mitnehmen; ausserhalb der Wochen bleiben sie. */
function carryToDate(plan: Plan, e: Entry): Entry {
  if (!('date' in e)) return e;
  const target = dayColumnsAt(plan, e.date);
  return target === null ? e : carryEntryColumns(plan, e, target);
}

function placementError(e: Entry, field: string, shift: number): CommandError {
  return new CommandError(
    'invalidPlacement',
    {
      cause: `Um ${shift} Spalten verschoben läge der Eintrag ausserhalb der Planungs- und Nebenspalten des Tages.`,
      nextStep: 'Weniger weit verschieben oder andere Spalten wählen.',
    },
    { field, entryId: e.id },
  );
}

/** Schritt 3: bekannte Spalten-IDs rücken in den Planungs- und Nebenspalten des Tages um `shift` Stellen. */
function shiftEntryColumns(plan: Plan, e: Entry, shift: number): Step {
  // Marker wirken immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026): nichts zu verschieben, die
  // gespeicherte Liste eines alten Plans bleibt unverändert.
  if (e.type !== 'block' && e.type !== 'beso') return { entry: e, error: null };
  const order = placeableIds(dayColumnsAt(plan, e.date) ?? []);
  const shifted = (id: Id): Id | null | undefined => {
    const index = order.indexOf(id);
    if (index < 0) return undefined;
    return order[index + shift] ?? null;
  };
  if (e.type === 'beso') {
    const windows = [...e.windows];
    for (const [i, w] of e.windows.entries()) {
      if (w.columnId === null) continue;
      const to = shifted(w.columnId);
      if (to === null) return { error: placementError(e, `windows[${i}].columnId`, shift) };
      if (to !== undefined) windows[i] = { ...w, columnId: to };
    }
    return { entry: { ...e, windows }, error: null };
  }
  if (e.columns.kind === 'all') return { entry: e, error: null };
  const ids: Id[] = [];
  for (const id of e.columns.ids) {
    const to = shifted(id);
    if (to === null) return { error: placementError(e, 'columns', shift) };
    ids.push(to ?? id);
  }
  return { entry: { ...e, columns: { kind: 'ids', ids } }, error: null };
}

/** Verschiebt einen Eintrag nach V02; Zeit- und Platzfehler kommen als Ergebnis zurück. */
function relocate(plan: Plan, e: Entry, m: Move): Step {
  let entry = e;
  if (m.delta !== 0) {
    const step = shiftEntryTime(entry, m.delta);
    if (step.error !== null) return step;
    entry = step.entry;
  }
  if (m.days !== 0) entry = shiftEntryDate(plan, entry, m.days);
  if (m.shift !== 0) return shiftEntryColumns(plan, entry, m.shift);
  return { entry, error: null };
}

/** Zeit, Tag und Spalten verschieben; Tageswechsel mit carryColumnSelection (R-5.1-17/18/19); Nummern Abschnitt 3 (R-5.3-04/05/06). */
export function moveEntries(
  plan: Plan,
  ids: readonly Id[],
  move: MoveSpec,
  ctx: CommandContext,
): CommandResult {
  const entries = selection(plan, ids);
  const m = moveSpec(move);
  const moved: Entry[] = [];
  // Prüfreihenfolge (Abschnitt 4): je Eintrag in Eingabereihenfolge Zeit, Platz, validateEntry, Plan-Bereich.
  for (const e of entries) {
    const step = relocate(plan, e, m);
    if (step.error !== null) throw step.error;
    if (structurallyEqual(step.entry, e)) continue;
    const error = entryError(plan, step.entry);
    if (error !== null) throw error;
    moved.push(step.entry);
  }
  const r = command(
    plan,
    '',
    (d) => {
      for (const next of moved) writeEntry(d, plan.entries[next.id], next);
    },
    ctx,
  );
  return { ...r, label: selectionLabel(r.plan, entries, 'verschoben') };
}

/** Löscht Einträge; Nummern der betroffenen Tage nach Abschnitt 3. */
export function deleteEntries(plan: Plan, ids: readonly Id[], ctx: CommandContext): CommandResult {
  const entries = selection(plan, ids);
  const r = command(
    plan,
    '',
    (d) => {
      for (const e of entries) delete d.entries[e.id];
    },
    ctx,
  );
  // Kurztext vor dem Befehl (1c).
  return { ...r, label: selectionLabel(plan, entries, 'gelöscht') };
}

/**
 * Kopie ohne Nummer und Fixierung (F-22); Teilaufgaben genau `{ title, ltg, ort }`, Titelläufe unverändert
 * (E1-02h §4b, K-2; E1-03 V09 (g)). IDs und createdSeq vergibt das Rezept.
 */
function withoutNumber(e: Entry): Entry {
  if (e.type === 'beso') return { ...e, besoNumber: null, numberFixed: false };
  if (e.type === 'block' && Array.isArray(e.subtasks)) {
    return { ...e, subtasks: e.subtasks.map(subtaskFields) };
  }
  return e;
}

/** Fügt die Kopien in Reihenfolge ein: je Kopie zuerst e, dann ihre Zeitfenster t, dann createdSeq. */
function insertCopies(
  plan: Plan,
  copies: readonly Entry[],
  ctx: CommandContext,
): CommandResult & { readonly newIds: readonly Id[] } {
  const newIds: Id[] = [];
  const r = command(
    plan,
    '',
    (d, t) => {
      for (const c of copies) {
        const id = t.newId('e');
        const copy: Entry =
          c.type === 'beso'
            ? { ...c, id, windows: c.windows.map((w) => ({ ...w, id: t.newId('t') })) }
            : { ...c, id };
        d.entries[id] = castDraft(clonePlain({ ...copy, createdSeq: t.newSeq() }));
        newIds.push(id);
      }
    },
    ctx,
  );
  return { ...r, newIds };
}

/** Kopieren, Einfügen, Duplizieren, auch zwischen Wochen (E1-13); unabhängige Kopien. */
export function copyEntries(
  plan: Plan,
  ids: readonly Id[],
  target: MoveSpec,
  ctx: CommandContext,
): CommandResult & { readonly newIds: readonly Id[] } {
  const entries = selection(plan, ids);
  const m = moveSpec(target);
  const copies: Entry[] = [];
  for (const e of entries) {
    const step = relocate(plan, e, m);
    if (step.error !== null) throw step.error;
    const copy = withoutNumber(step.entry);
    // Fehler einer Kopie nennen das Original (die Kopie entsteht nicht).
    const error = entryError(plan, copy, e.id);
    if (error !== null) throw error;
    copies.push(copy);
  }
  const r = insertCopies(plan, copies, ctx);
  return { ...r, label: selectionLabel(r.plan, entries, 'kopiert') };
}

/** «Auch an anderen Tagen»: unabhängige Kopien gleicher Zeit (F-22), ein Undo-Schritt. */
export function copyEntryToDates(
  plan: Plan,
  id: Id,
  dates: readonly IsoDate[],
  ctx: CommandContext,
): CommandResult & { readonly newIds: readonly Id[] } {
  const e = requireEntry(plan, id);
  if (!('date' in e)) {
    throw new CommandError(
      'wrongEntryType',
      {
        cause: 'Nur Einträge mit einem Datum lassen sich an andere Tage kopieren.',
        nextStep: 'Einen Block, Marker, Rapport, Beso oder eine ganztägige Bemerkung wählen.',
      },
      { entryId: id },
    );
  }
  if (dates.some((d) => !isIsoDate(d))) {
    throw new CommandError(
      'invalidDate',
      {
        cause: 'Ein gewähltes Datum ist kein gültiges Kalenderdatum.',
        nextStep: 'Die Tage erneut wählen.',
      },
      { field: 'dates' },
    );
  }
  const targets = [...new Set(dates)].filter((d) => d !== e.date).sort();
  if (targets.length === 0) {
    throw new CommandError('emptySelection', {
      cause: 'Es ist kein anderer Tag gewählt.',
      nextStep: 'Mindestens einen anderen Tag wählen.',
    });
  }
  const copies: Entry[] = [];
  for (const date of targets) {
    const copy = withoutNumber(carryToDate(plan, { ...e, date }));
    const error = entryError(plan, copy, e.id);
    if (error !== null) throw error;
    copies.push(copy);
  }
  const r = insertCopies(plan, copies, ctx);
  const original = r.plan.entries[id] ?? e;
  return {
    ...r,
    label: entryLabel(
      r.plan,
      original,
      `an ${targets.length} ${targets.length === 1 ? 'Tag' : 'Tage'} kopiert`,
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Kategorievorschlag
// ---------------------------------------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Erste Stelle von `word` als ganzes Wort in `text` (Grenze wie E1-02a P-11); −1 = nicht enthalten. */
function wordIndex(text: string, word: string): number {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'u');
  return pattern.exec(text)?.index ?? -1;
}

/** Kategorie gemäss Funktionsliste für den Ltg-Text; nur Vorschlag, wendet nichts an (R-4.7-10, E1-12). */
export function suggestCategory(plan: Plan, ltg: string): Id | null {
  const text = ltg.trim();
  if (text === '') return null;
  const exact = plan.functionList.find((f) => f.code === text);
  if (exact !== undefined) return exact.categoryId;
  let best: { readonly index: number; readonly length: number; readonly id: Id | null } | null =
    null;
  for (const f of plan.functionList) {
    if (f.code === '') continue;
    const index = wordIndex(text, f.code);
    if (index < 0) continue;
    const length = [...f.code].length;
    if (best === null || index < best.index || (index === best.index && length > best.length)) {
      best = { index, length, id: f.categoryId };
    }
  }
  return best?.id ?? null;
}

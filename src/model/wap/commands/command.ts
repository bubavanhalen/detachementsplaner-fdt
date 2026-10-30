// Befehlsform (Vertrag E1-03 Abschnitt 1; ADR-002 Punkt 7 und 8b, ADR-006).
// Jede Benutzeraktion ist genau ein Befehl mit inversen Patches und genau ein Undo-Schritt (Beschrieb 5.6 Punkt 6).

import {
  castDraft,
  current,
  type Draft,
  enablePatches,
  type Patch,
  produceWithPatches,
} from 'immer';
import { addDays, daysBetween, isIsoDate } from '../calendar';
import { resolveTitle } from '../derive/agenda';
import { markerLabel } from '../derive/marker';
import { type UserMessage, WapError } from '../errors';
import type { TemplateSet } from '../template';
import { isMilTime } from '../time';
import type { Entry, Id, IdPrefix, IsoDate, Plan, RichText, Week } from '../types';
import { validateEntry } from '../validate';
import { assignNumbers } from './numbering';

// Patches-Plugin beim Laden des Moduls (Änderungsnotiz Vertragsprüfung V05): applyPatches (Undo, E1-04) braucht es.
enablePatches();

/** Vorlagen als Parameter (AR0-18). IDs kommen aus plan.nextId (CommandTools.newId), nie aus dem Kontext. */
export interface CommandContext {
  readonly templates: TemplateSet;
}

export interface CommandResult {
  readonly plan: Plan;
  /** applyPatches(plan, patches) ergibt result.plan; applyPatches(result.plan, inversePatches) ergibt plan. */
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
  /** Anzeige im Undo, z.B. «Block «Mö Sch» verschoben» (Abschnitt 1c). */
  readonly label: string;
  /** Aufsteigend, ohne Doppel (Abschnitt 1b). */
  readonly affectedDates: readonly IsoDate[];
  /** Hinzugefügte, geänderte oder entfernte Einträge, ohne Doppel, aufsteigend (Abschnitt 1b). */
  readonly affectedEntryIds: readonly Id[];
}

/** Werkzeuge im Rezept; beide Zähler liegen im Dokument und sind damit Teil der Patches (AR0-41). */
export interface CommandTools {
  /** prefix + draft.nextId; erhöht draft.nextId um 1 (gleiche Formel wie allocateIds). */
  newId(prefix: IdPrefix): Id;
  /** Gibt draft.nextSeq zurück und erhöht ihn um 1 (createdSeq, R-4.6-40). */
  newSeq(): number;
}

/** 'auto': betroffene Tage nach Abschnitt 3 nummerieren; 'none': Nummern unverändert lassen (Import, Stand). */
export type NumberingPolicy = 'auto' | 'none';

export interface CommandOptions {
  readonly numbering?: NumberingPolicy;
}

/** Codes der Befehle dieses Pakets (Abschnitt 4). Spätere Pakete verwenden eigene Codes über den Typparameter. */
export type CommandErrorCode =
  | 'notFound'
  | 'wrongEntryType'
  | 'invalidEntry'
  | 'besoWithoutWindow'
  | 'invalidPlacement'
  | 'invalidTime'
  | 'invalidDate'
  | 'outsidePlan'
  | 'lastTimeWindow'
  | 'unknownWeek'
  | 'unknownColumnSet'
  | 'unknownColumn'
  | 'invalidColumnSet'
  | 'emptySelection'
  | 'invalidNumber'
  | 'numberTaken';

export interface CommandErrorDetails {
  /** Betroffenes Feld, z.B. 'columns', 'windows[1].time', 'besoNumber'. */
  readonly field?: string;
  /** Betroffener Eintrag (bei mehreren Einträgen der erste in Eingabereihenfolge). */
  readonly entryId?: Id;
}

/** Erwarteter Fehler eines Befehls; der Plan bleibt unverändert (Befehle sind rein). */
export class CommandError<C extends string = CommandErrorCode> extends WapError {
  declare readonly code: C;
  readonly field: string | null;
  readonly entryId: Id | null;

  constructor(
    code: C,
    userMessage: UserMessage,
    details?: CommandErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(code, userMessage, options);
    this.field = details?.field ?? null;
    this.entryId = details?.entryId ?? null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Hilfen der Befehlsform (Abschnitt 1a–1c) für die Befehlsdateien. Sie ändern einen Plan nur im Rezept.
// ---------------------------------------------------------------------------------------------------------

type Fields = Readonly<Record<string, unknown>>;

/** Strukturelle Gleichheit reiner Daten (JSON-artig): gleiche Schlüssel, gleiche Werte, Arrays in Reihenfolge. */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => structurallyEqual(x, b[i]));
  }
  const fa = a as Fields;
  const fb = b as Fields;
  const keys = Object.keys(fa);
  if (keys.length !== Object.keys(fb).length) return false;
  return keys.every((k) => Object.hasOwn(fb, k) && structurallyEqual(fa[k], fb[k]));
}

/**
 * Tiefe Kopie reiner Daten: Eingabeobjekte des Aufrufers werden nie geteilt und damit nie von immer
 * eingefroren (Orchestrator, Code-Review Runde 1 (c)).
 */
export function clonePlain<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map((x: unknown) => clonePlain(x)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = clonePlain(v);
  return out as T;
}

/**
 * Schreibt `after` in den Entwurf: neuer Eintrag oder anderer Typ → ganz; sonst nur die Felder, deren Wert
 * sich strukturell ändert (Abschnitt 1a Schritt 4). `before` ist der Eintrag im Plan vor dem Befehl.
 */
export function writeEntry(draft: Draft<Plan>, before: Entry | undefined, after: Entry): void {
  const target = Object.hasOwn(draft.entries, after.id)
    ? (draft.entries[after.id] as unknown as Record<string, unknown> | undefined)
    : undefined;
  if (before === undefined || target === undefined || before.type !== after.type) {
    draft.entries[after.id] = castDraft(clonePlain(after));
    return;
  }
  const b = before as unknown as Fields;
  const a = after as unknown as Fields;
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (!Object.hasOwn(a, key)) delete target[key];
    else if (!Object.hasOwn(b, key) || !structurallyEqual(b[key], a[key])) {
      target[key] = clonePlain(a[key]);
    }
  }
}

/** Eintrag mit der ID; fehlt er → CommandError 'notFound' (ohne Feld). */
export function requireEntry(plan: Plan, id: Id): Entry {
  const e = Object.hasOwn(plan.entries, id) ? plan.entries[id] : undefined;
  if (e === undefined) {
    throw new CommandError(
      'notFound',
      {
        cause: 'Der gewählte Eintrag ist im Plan nicht vorhanden.',
        nextStep: 'Einen vorhandenen Eintrag wählen.',
      },
      { entryId: id },
    );
  }
  return e;
}

/** Erste Woche des Plans, deren sieben Daten `date` enthalten; sonst null (auch bei ungültigem Datum). */
export function weekOfDate(plan: Plan, date: IsoDate): Week | null {
  if (!isIsoDate(date)) return null;
  for (const w of plan.weeks) {
    if (!isIsoDate(w.startDate)) continue;
    const offset = daysBetween(w.startDate, date);
    if (offset >= 0 && offset <= 6) return w;
  }
  return null;
}

/** true, wenn mindestens ein Tag von `from` bis `to` in einer Woche des Plans liegt. */
function overlapsPlan(plan: Plan, from: IsoDate, to: IsoDate): boolean {
  if (!isIsoDate(from) || !isIsoDate(to)) return false;
  return plan.weeks.some(
    (w) =>
      isIsoDate(w.startDate) &&
      daysBetween(w.startDate, to) >= 0 &&
      daysBetween(from, addDays(w.startDate, 6)) >= 0,
  );
}

const OUTSIDE_PLAN: UserMessage = {
  cause: 'Der Eintrag liegt ausserhalb der Wochen des Plans und wäre auf keiner Seite sichtbar.',
  nextStep: 'Ein Datum innerhalb der Wochen des Plans wählen oder zuerst eine Woche einfügen.',
};

/** Plan-Bereich (Abschnitt 1a Schritt 2b): Feld des Befunds oder null. */
function outsidePlanField(plan: Plan, e: Entry): string | null {
  switch (e.type) {
    case 'querbalken':
      return overlapsPlan(plan, e.fromDate, e.toDate) ? null : 'fromDate';
    case 'multiDayRemark':
      if (e.scope.kind !== 'range') return null;
      return overlapsPlan(plan, e.scope.fromDate, e.scope.toDate) ? null : 'scope';
    default:
      return weekOfDate(plan, e.date) === null ? 'date' : null;
  }
}

/**
 * Prüfung eines hinzugefügten oder geänderten Eintrags (Abschnitt 1a Schritt 2): erster Befund von
 * validateEntry, sonst Plan-Bereich; null = in Ordnung. `entryId` überschreibt die gemeldete ID (Kopien
 * melden das Original).
 */
export function entryError(plan: Plan, e: Entry, entryId: Id = e.id): CommandError | null {
  const issue = validateEntry(plan, e)[0];
  if (issue !== undefined) {
    const code =
      issue.code === 'invalidPlacement' || issue.code === 'besoWithoutWindow'
        ? issue.code
        : 'invalidEntry';
    return new CommandError(code, issue.message, { field: issue.field, entryId });
  }
  const field = outsidePlanField(plan, e);
  return field === null ? null : new CommandError('outsidePlan', OUTSIDE_PLAN, { field, entryId });
}

const TYPE_NAMES: Readonly<Record<Entry['type'], string>> = {
  block: 'Block',
  querbalken: 'Querbalken',
  marker: 'Marker',
  rapport: 'Rapport',
  beso: 'Beso',
  dayRemark: 'Ganztägige Bemerkung',
  multiDayRemark: 'Bemerkung',
};

const SHORT_TEXT_LENGTH = 40;

function plainTitle(plan: Plan, title: RichText): string {
  return resolveTitle(plan, title)
    .map((r) => r.text)
    .join('');
}

/** Kurztext K eines Eintrags (Abschnitt 1c): am Rand getrimmt, über 40 Codepunkte gekürzt mit «…». */
function shortText(plan: Plan, e: Entry): string {
  let text: string;
  switch (e.type) {
    case 'block':
    case 'querbalken':
    case 'beso':
      text = plainTitle(plan, e.title);
      break;
    case 'rapport':
      text = e.code;
      break;
    case 'marker':
      // Ungültige Zeit (z.B. beschädigter Plan): nur die Art, damit die Beschriftung nie scheitert.
      text = isMilTime(e.at) ? markerLabel(e, plan) : e.kind === 'custom' ? e.customKind : e.kind;
      break;
    case 'dayRemark':
    case 'multiDayRemark':
      text = e.text;
      break;
  }
  const points = [...text.trim()];
  return points.length > SHORT_TEXT_LENGTH
    ? `${points.slice(0, SHORT_TEXT_LENGTH).join('')}…`
    : points.join('');
}

/** «‹Typ› «‹K›» ‹Verb›», bei leerem K «‹Typ› ‹Verb›» (Abschnitt 1c). */
export function entryLabel(plan: Plan, e: Entry, verb: string): string {
  const k = shortText(plan, e);
  return k === '' ? `${TYPE_NAMES[e.type]} ${verb}` : `${TYPE_NAMES[e.type]} «${k}» ${verb}`;
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf von command (Abschnitt 1a, 1b)
// ---------------------------------------------------------------------------------------------------------

function entryOf(plan: Plan, id: Id): Entry | undefined {
  return Object.hasOwn(plan.entries, id) ? plan.entries[id] : undefined;
}

/** Hinzugefügte, geänderte und entfernte Einträge (strukturell), in Schlüsselreihenfolge. */
function changedEntryIds(before: Plan, after: Plan): readonly Id[] {
  if (before.entries === after.entries) return [];
  const out: Id[] = [];
  for (const id of Object.keys(after.entries)) {
    const a = after.entries[id];
    const b = entryOf(before, id);
    if (a !== b && !structurallyEqual(a, b)) out.push(id);
  }
  for (const id of Object.keys(before.entries)) {
    if (!Object.hasOwn(after.entries, id)) out.push(id);
  }
  return out;
}

function datesFromTo(from: IsoDate, to: IsoDate): readonly IsoDate[] {
  if (!isIsoDate(from) || !isIsoDate(to)) return [];
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

function weekDays(w: Week): readonly IsoDate[] {
  return isIsoDate(w.startDate) ? datesFromTo(w.startDate, addDays(w.startDate, 6)) : [];
}

function withNextDay(date: IsoDate, overMidnight: boolean): readonly IsoDate[] {
  if (!isIsoDate(date)) return [];
  return overMidnight ? [date, addDays(date, 1)] : [date];
}

function crossesMidnight(t: { readonly form: string; readonly to?: number }): boolean {
  return t.form === 'range' && t.to !== undefined && t.to > 1440;
}

/** Daten eines Eintrags nach Abschnitt 1b im Zustand `plan`. */
function entryDates(plan: Plan, e: Entry): readonly IsoDate[] {
  switch (e.type) {
    case 'block':
    case 'rapport':
      return withNextDay(e.date, crossesMidnight(e.time));
    case 'beso':
      return withNextDay(
        e.date,
        e.windows.some((w) => crossesMidnight(w.time)),
      );
    case 'marker':
    case 'dayRemark':
      return withNextDay(e.date, false);
    case 'querbalken':
      return datesFromTo(e.fromDate, e.toDate);
    case 'multiDayRemark': {
      const scope = e.scope;
      if (scope.kind === 'range') return datesFromTo(scope.fromDate, scope.toDate);
      if (scope.kind === 'plan') return plan.weeks.flatMap(weekDays);
      const w = plan.weeks.find((x) => x.id === scope.weekId);
      return w === undefined ? [] : weekDays(w);
    }
  }
}

/** Daten geänderter DayConfig und aller Tage, die einen geänderten Spaltensatz verwenden (Abschnitt 1b). */
function configDates(before: Plan, after: Plan, out: Set<IsoDate>): void {
  if (before.weeks !== after.weeks) {
    const beforeWeeks = new Map(before.weeks.map((w) => [w.id, w]));
    const afterWeeks = new Map(after.weeks.map((w) => [w.id, w]));
    for (const id of new Set([...beforeWeeks.keys(), ...afterWeeks.keys()])) {
      const b = beforeWeeks.get(id);
      const a = afterWeeks.get(id);
      if (b === a) continue;
      for (let i = 0; i < 7; i++) {
        if (b !== undefined && a !== undefined && structurallyEqual(b.days[i], a.days[i])) continue;
        for (const w of [b, a]) {
          if (w !== undefined && isIsoDate(w.startDate)) out.add(addDays(w.startDate, i));
        }
      }
    }
  }
  if (before.columnSets !== after.columnSets) {
    const beforeSets = new Map(before.columnSets.map((s) => [s.id, s]));
    const afterSets = new Map(after.columnSets.map((s) => [s.id, s]));
    const changed = new Set<Id>();
    for (const id of new Set([...beforeSets.keys(), ...afterSets.keys()])) {
      if (!structurallyEqual(beforeSets.get(id), afterSets.get(id))) changed.add(id);
    }
    for (const p of [before, after]) {
      for (const w of p.weeks) {
        if (!isIsoDate(w.startDate)) continue;
        w.days.forEach((d, i) => {
          if (d.columnSetId !== null && changed.has(d.columnSetId)) {
            out.add(addDays(w.startDate, i));
          }
        });
      }
    }
  }
}

/** Abschnitt 1a Schritt 3: Daten, an denen das Rezept einen Beso hinzufügt, entfernt oder ändert. */
function besoDates(before: Plan, after: Plan, changed: readonly Id[]): readonly IsoDate[] {
  const dates = new Set<IsoDate>();
  for (const id of changed) {
    for (const e of [entryOf(before, id), entryOf(after, id)]) {
      if (e?.type === 'beso' && isIsoDate(e.date)) dates.add(e.date);
    }
  }
  return [...dates].sort();
}

/**
 * Markierung «geändert» nach dem Stand (R-4.6-67, Q-026; H-UI2, SA-H-09): Gilt vor und nach dem Befehl derselbe Stand,
 * erhält jeder Beso, dessen Inhalt (ohne die Markierung selbst) sich ändert, `changed: true`. Ein neu angelegter Beso
 * wird nicht markiert (F-65 (f)), Blöcke nie automatisch; der Befehl, der den Stand setzt, setzt die Markierung zurück
 * (applyStand). Teil desselben Befehls, also mit Rückgängig zurückgenommen.
 */
function markChangedBesos(before: Plan, draft: Draft<Plan>): void {
  if (before.stand === null) return;
  const after = current(draft);
  if (!structurallyEqual(after.stand, before.stand)) return;
  for (const id of changedEntryIds(before, after)) {
    const was = entryOf(before, id);
    const now = entryOf(after, id);
    if (was?.type !== 'beso' || now?.type !== 'beso' || now.changed) continue;
    if (structurallyEqual({ ...was, changed: false }, { ...now, changed: false })) continue;
    const target = draft.entries[id];
    if (target !== undefined) target.changed = true;
  }
}

/**
 * Führt `recipe` mit immer produceWithPatches aus, prüft die hinzugefügten und geänderten Einträge
 * (validateEntry, Plan-Bereich), nummeriert die betroffenen Tage (Abschnitt 3, ausser numbering 'none')
 * und liefert Ergebnis, Patches und inverse Patches. Ohne Änderung: plan === Eingabe, Patches leer.
 */
export function command(
  plan: Plan,
  label: string,
  recipe: (draft: Draft<Plan>, tools: CommandTools) => void,
  _ctx: CommandContext,
  options?: CommandOptions,
): CommandResult {
  const numbering = options?.numbering ?? 'auto';
  const [next, patches, inversePatches] = produceWithPatches(plan, (draft) => {
    const tools: CommandTools = {
      newId(prefix) {
        const id = `${prefix}${draft.nextId}`;
        draft.nextId += 1;
        return id;
      },
      newSeq() {
        const seq = draft.nextSeq;
        draft.nextSeq += 1;
        return seq;
      },
    };
    recipe(draft, tools);
    const afterRecipe = current(draft);
    const changed = changedEntryIds(plan, afterRecipe);
    for (const id of changed) {
      const e = entryOf(afterRecipe, id);
      const error = e === undefined ? null : entryError(afterRecipe, e);
      if (error !== null) throw error;
    }
    if (numbering !== 'none') {
      for (const date of besoDates(plan, afterRecipe, changed)) {
        for (const [id, n] of assignNumbers(afterRecipe, date, 'auto')) {
          const e = draft.entries[id];
          if (e !== undefined && e.type === 'beso' && e.besoNumber !== n) e.besoNumber = n;
        }
      }
    }
    markChangedBesos(plan, draft);
  });
  if (next === plan || structurallyEqual(next, plan)) {
    return {
      plan,
      patches: [],
      inversePatches: [],
      label,
      affectedDates: [],
      affectedEntryIds: [],
    };
  }
  const affectedEntryIds = [...changedEntryIds(plan, next)].sort();
  const dates = new Set<IsoDate>();
  for (const id of affectedEntryIds) {
    const before = entryOf(plan, id);
    const after = entryOf(next, id);
    if (before !== undefined) for (const d of entryDates(plan, before)) dates.add(d);
    if (after !== undefined) for (const d of entryDates(next, after)) dates.add(d);
  }
  configDates(plan, next, dates);
  return {
    plan: next,
    patches,
    inversePatches,
    label,
    affectedDates: [...dates].sort(),
    affectedEntryIds,
  };
}

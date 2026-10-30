// Befehle für Teilaufgaben eines Blocks (Vertrag E1-02h Abschnitt 4; Gate S A1; R-4.6-66).
// Jede Aktion ist genau ein Befehl über `command` (Vertrag E1-03 Abschnitt 1a) und genau ein Undo-Schritt.
// Teilaufgaben haben keine ID; adressiert wird über die Lage (Index) in `Block.subtasks`.

import { isIsoDate } from '../calendar';
import { resolveTitle } from '../derive/agenda';
import type { Block, Id, IsoDate, Plan, RichText, Subtask } from '../types';
import { validateEntry } from '../validate';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
  requireEntry,
  writeEntry,
} from './command';
import { linkBesoRefs } from './refs';

/** Neue Teilaufgabe; fehlende Ltg bzw. fehlender Ort = '' (Q-045 (g)). */
export interface SubtaskDraft {
  readonly title: RichText;
  readonly ltg?: string;
  readonly ort?: string;
}

/** Zu ändernde Felder einer Teilaufgabe; fehlende Felder bleiben. */
export type SubtaskChanges = Partial<Subtask>;

// ---------------------------------------------------------------------------------------------------------
// Hilfen, auch für commands/entries.ts (createEntry, updateEntry, Kopien; Vertrag E1-02h Abschnitt 4b)
// ---------------------------------------------------------------------------------------------------------

/** true, wenn der Wert ein Rich Text aus Läufen mit `text` vom Typ String ist (sonst meldet validateEntry). */
function isRichText(value: unknown): value is RichText {
  return (
    Array.isArray(value) &&
    value.every(
      (run: unknown) =>
        typeof run === 'object' &&
        run !== null &&
        typeof (run as { readonly text?: unknown }).text === 'string',
    )
  );
}

/**
 * Titel einer Teilaufgabe verknüpfen (K-5, R-5.3-11): Plan vor dem Befehl, Datum des Blocks nach dem Befehl.
 * Ungültiges Datum oder ungültiger Titel → unverändert (die Prüfung des Blocks meldet den Befund).
 */
function linkSubtaskTitle(plan: Plan, date: IsoDate, title: RichText): RichText {
  return isIsoDate(date) && isRichText(title) ? linkBesoRefs(plan, date, title) : title;
}

/**
 * Teilaufgabe als genau `{ title, ltg, ort }` (Schreibregel K-2); weitere Schlüssel entfallen. Ein Element, das
 * zur Laufzeit kein Objekt ist, bleibt unverändert; die Prüfung des Blocks meldet es (Abschnitt 2b).
 */
export function subtaskFields(s: Subtask): Subtask {
  const value: unknown = s;
  if (typeof value !== 'object' || value === null) return s;
  return { title: s.title, ltg: s.ltg, ort: s.ort };
}

/**
 * Liste einer Eingabe (createEntry, updateEntry) für einen Block am Datum `date` nach dem Befehl: jede
 * Teilaufgabe genau `{ title, ltg, ort }` mit verknüpftem Titel (K-2, K-5); leere Liste → undefined = Feld
 * fehlt (K-1, V-02h-4). Ein Wert, der zur Laufzeit keine Liste ist, bleibt für die Prüfung des Blocks
 * unverändert (Abschnitt 2b: `missingField`).
 */
export function subtasksForBlock(
  plan: Plan,
  date: IsoDate,
  list: readonly Subtask[],
): readonly Subtask[] | undefined {
  const value: unknown = list;
  if (!Array.isArray(value)) return list;
  if (list.length === 0) return undefined;
  return list.map((s) => {
    const fields = subtaskFields(s);
    return fields === s ? s : { ...fields, title: linkSubtaskTitle(plan, date, fields.title) };
  });
}

/** Block mit dieser Liste; undefined oder leere Liste → ohne Feld `subtasks` (K-1, nie auf undefined gesetzt). */
export function withSubtasks(b: Block, list: readonly Subtask[] | undefined): Block {
  const { subtasks: _old, ...rest } = b;
  if (list === undefined || (Array.isArray(list) && list.length === 0)) return rest;
  return { ...rest, subtasks: list };
}

// ---------------------------------------------------------------------------------------------------------
// Prüfungen und Bezeichnung (Abschnitt 4a)
// ---------------------------------------------------------------------------------------------------------

/** Block mit der ID; fehlt → 'notFound', anderer Typ → 'wrongEntryType' (Prüfreihenfolge E1-03 §4). */
function requireBlock(plan: Plan, id: Id): Block {
  const e = requireEntry(plan, id);
  if (e.type !== 'block') {
    throw new CommandError(
      'wrongEntryType',
      {
        cause: 'Teilaufgaben gibt es nur bei Blöcken.',
        nextStep: 'Einen Block wählen und die Teilaufgabe dort erfassen.',
      },
      { entryId: id },
    );
  }
  return e;
}

/**
 * Index als ganze Zahl 0 … max, sonst RangeError (Programmfehler, wie updateColumnSet.index). max < 0 heisst:
 * der Block hat keine Teilaufgaben, es gibt keinen gültigen Index (CR-E102h-02).
 */
function checkIndex(name: string, index: number, max: number): void {
  if (max < 0) {
    throw new RangeError(`Der Block hat keine Teilaufgaben; ${name} ${index} bezeichnet keine.`);
  }
  if (!Number.isInteger(index) || index < 0 || index > max) {
    throw new RangeError(`${name} muss eine ganze Zahl von 0 bis ${max} sein.`);
  }
}

/** true, wenn das Element zur Laufzeit ein Objekt ist (ungültige Pläne im Speicher, CR-E102h-01). */
function isSubtaskObject(s: Subtask | undefined): s is Subtask {
  const value: unknown = s;
  return typeof value === 'object' && value !== null;
}

/**
 * Element `index` des Blocks ist kein Objekt: Befund der Prüfung (Abschnitt 2b, `subtasks[i]`) als
 * CommandError 'invalidEntry' (E1-03 1a Schritt 2), ohne das Element zu lesen (CR-E102h-01).
 */
function invalidElement(plan: Plan, b: Block, index: number): CommandError {
  const issues = validateEntry(plan, b);
  const found = issues.find((i) => i.field === `subtasks[${index}]`) ?? issues[0];
  const message = found?.message ?? {
    cause: `Die Teilaufgabe ${index + 1} ist ungültig.`,
    nextStep: 'Die Teilaufgabe entfernen und neu erfassen.',
  };
  return new CommandError('invalidEntry', message, {
    field: found?.field ?? `subtasks[${index}]`,
    entryId: b.id,
  });
}

const SHORT_TEXT_LENGTH = 40;

/** «Teilaufgabe «‹K›» ‹Verb›», bei leerem K «Teilaufgabe ‹Verb›» (Abschnitt 4a «Bezeichnung», E1-03 1c). */
function subtaskLabel(plan: Plan, s: Subtask | undefined, verb: string): string {
  const title = isSubtaskObject(s) && isRichText(s.title) ? s.title : [];
  const points = [
    ...resolveTitle(plan, title)
      .map((r) => r.text)
      .join('')
      .trim(),
  ];
  const k =
    points.length > SHORT_TEXT_LENGTH
      ? `${points.slice(0, SHORT_TEXT_LENGTH).join('')}…`
      : points.join('');
  return k === '' ? `Teilaufgabe ${verb}` : `Teilaufgabe «${k}» ${verb}`;
}

/** Teilaufgabe an `index` im Block `id` des Plans (für die Bezeichnung nach dem Befehl). */
function subtaskAt(plan: Plan, id: Id, index: number): Subtask | undefined {
  const e = Object.hasOwn(plan.entries, id) ? plan.entries[id] : undefined;
  return e?.type === 'block' ? e.subtasks?.[index] : undefined;
}

/** Ein Befehl: schreibt nur die geänderten Felder des Blocks; Prüfung über command (E1-03 1a Schritt 2). */
function writeBlock(plan: Plan, before: Block, after: Block, ctx: CommandContext): CommandResult {
  return command(plan, '', (d) => writeEntry(d, before, after), ctx);
}

// ---------------------------------------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------------------------------------

/**
 * Fügt eine Teilaufgabe an der Stelle `index` ein (Standard: am Ende); Ergebnis `index` = ihre Lage.
 * Block fehlt → CommandError 'notFound'; kein Block → 'wrongEntryType'; Titel leer → 'invalidEntry'
 * (field 'subtasks[<i>].title'); `index` keine ganze Zahl 0 … Anzahl → RangeError.
 */
export function addSubtask(
  plan: Plan,
  blockId: Id,
  subtask: SubtaskDraft,
  ctx: CommandContext,
  index?: number,
): CommandResult & { readonly index: number } {
  const b = requireBlock(plan, blockId);
  const list = b.subtasks ?? [];
  const at = index ?? list.length;
  checkIndex('index', at, list.length);
  // Genau { title, ltg, ort } (K-2); der Titel wird nicht getrimmt, aber verknüpft (K-5).
  const added: Subtask = {
    title: linkSubtaskTitle(plan, b.date, subtask.title),
    ltg: subtask.ltg ?? '',
    ort: subtask.ort ?? '',
  };
  const r = writeBlock(
    plan,
    b,
    withSubtasks(b, [...list.slice(0, at), added, ...list.slice(at)]),
    ctx,
  );
  return {
    ...r,
    label: subtaskLabel(r.plan, subtaskAt(r.plan, blockId, at), 'hinzugefügt'),
    index: at,
  };
}

/** Ändert die Teilaufgabe an der Stelle `index`; ohne Wertänderung ohne Wirkung (E1-03 1a Schritt 4). */
export function updateSubtask(
  plan: Plan,
  blockId: Id,
  index: number,
  changes: SubtaskChanges,
  ctx: CommandContext,
): CommandResult {
  const b = requireBlock(plan, blockId);
  const list = b.subtasks ?? [];
  checkIndex('index', index, list.length - 1);
  const element = list[index];
  if (!isSubtaskObject(element)) throw invalidElement(plan, b, index);
  const old = subtaskFields(element);
  // Nur title, ltg und ort mit einem Wert ≠ undefined; weitere Schlüssel entfallen (K-2).
  const next: Subtask = {
    title: changes.title === undefined ? old.title : linkSubtaskTitle(plan, b.date, changes.title),
    ltg: changes.ltg === undefined ? old.ltg : changes.ltg,
    ort: changes.ort === undefined ? old.ort : changes.ort,
  };
  const updated = list.map((s, i) => (i === index ? next : s));
  const r = writeBlock(plan, b, withSubtasks(b, updated), ctx);
  return { ...r, label: subtaskLabel(r.plan, subtaskAt(r.plan, blockId, index), 'geändert') };
}

/** Verschiebt die Teilaufgabe von `from` nach `to` (Lage danach); from = to ohne Wirkung. */
export function moveSubtask(
  plan: Plan,
  blockId: Id,
  from: number,
  to: number,
  ctx: CommandContext,
): CommandResult {
  const b = requireBlock(plan, blockId);
  const list = b.subtasks ?? [];
  checkIndex('from', from, list.length - 1);
  checkIndex('to', to, list.length - 1);
  // Das entnommene Element wird immer wieder eingesetzt, auch ein ungültiges (CR-E102h-01).
  const moved = [...list];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const r = writeBlock(plan, b, withSubtasks(b, moved), ctx);
  return { ...r, label: subtaskLabel(r.plan, subtaskAt(r.plan, blockId, to), 'verschoben') };
}

/** Entfernt die Teilaufgabe an der Stelle `index`; war es die letzte, fehlt danach das Feld `subtasks`. */
export function removeSubtask(
  plan: Plan,
  blockId: Id,
  index: number,
  ctx: CommandContext,
): CommandResult {
  const b = requireBlock(plan, blockId);
  const list = b.subtasks ?? [];
  checkIndex('index', index, list.length - 1);
  const remaining = list.filter((_, i) => i !== index);
  const r = writeBlock(plan, b, withSubtasks(b, remaining), ctx);
  // Kurztext vor dem Befehl (Abschnitt 4a «Bezeichnung»).
  return { ...r, label: subtaskLabel(plan, list[index], 'entfernt') };
}

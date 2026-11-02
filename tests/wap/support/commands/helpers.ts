// Testhilfen für die Befehle (Paket E1-03, Vertrag docs/wap-planer/plan/vertraege/E1-03.md).
// Prüft Befehlsergebnisse nur über den Vertrag: Reinheit (Eingabe unverändert), Patches hin und zurück
// (Abschnitt 1a Schritt 4), Wirkungslos-Regel und CommandError (Abschnitt 4). Die Pläne entstehen als
// Literale aus den Bausteinen von E1-02a (tests/wap/support/model/builders.ts), ohne Befehle aufzurufen.
// Alle Inhalte sind fiktiv.
import { applyPatches } from 'immer';
import { expect } from 'vitest';
// command.ts ruft beim Laden enablePatches() auf (Änderungsnotiz Vertragsprüfung V05); applyPatches braucht das.
import {
  type CommandContext,
  CommandError,
  type CommandErrorCode,
  type CommandResult,
} from '../../../../src/model/wap/commands/command';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type {
  Beso,
  BesoTimeWindow,
  Column,
  ColumnSet,
  ColumnWeight,
  Entry,
  Id,
  IsoDate,
  MilTime,
  Plan,
  TimeSpec,
  Weekday,
} from '../../../../src/model/wap/types';
import {
  basePlan,
  beso,
  block,
  catchError,
  col,
  roundTrip,
  setStufen,
  win,
  withEntries,
} from '../model/builders';

/** Kontext aller Befehle (Vorlagen als Parameter, AR0-18). */
export const ctx: CommandContext = { templates: builtInTemplates() };

/** Tage der Woche w26 (KVK, ab 28.09.2026) und der Woche w27 im Plan aus `basePlan`. */
export const MO = '2026-09-28';
export const DI = '2026-09-29';
export const MI = '2026-09-30';
export const DO = '2026-10-01';
export const FR = '2026-10-02';
export const SA = '2026-10-03';
export const SO = '2026-10-04';
export const MO2 = '2026-10-05';
export const DI2 = '2026-10-06';
export const MI2 = '2026-10-07';
/** Erster Tag nach der letzten Woche (w28 endet am 18.10.2026). */
export const NACH_PLAN = '2026-10-19';

/** Erster Stand des Plans (ADR-002 Punkt 6); vorher gilt `stand: null`. */
export const STAND = { date: '2026-09-20', version: 1 } as const;

/** Nummernkreise laut Beschrieb 5.3 (R-5.3-02), als unabhängiges Orakel für die Tests. */
export const KREIS: Readonly<Record<Weekday, { readonly min: number; readonly max: number }>> = {
  Mo: { min: 10, max: 19 },
  Di: { min: 20, max: 29 },
  Mi: { min: 30, max: 39 },
  Do: { min: 40, max: 49 },
  Fr: { min: 50, max: 59 },
  Sa: { min: 60, max: 69 },
  So: { min: 70, max: 79 },
};

/** Plan aus `basePlan` mit Einträgen; `nextSeq` 50, damit neue Einträge nach den vorhandenen sortieren. */
export function planMit(entries: readonly Entry[], over: Partial<Plan> = {}): Plan {
  return withEntries(basePlan({ nextSeq: 50, ...over }), entries);
}

/** Beso mit einem Zeitfenster «Zeitpunkt» `at` am Datum `date`. */
export function besoUm(
  id: Id,
  seq: number,
  date: IsoDate,
  at: MilTime,
  nr: number | null,
  over: Partial<Beso> = {},
): Beso {
  return beso(id, seq, {
    date,
    windows: [win(`t${id}`, { time: { form: 'point', at } })],
    besoNumber: nr,
    ...over,
  });
}

/** Zeitfenster mit Zeit (Kurzform für Tests). */
export function fenster(
  id: Id,
  time: TimeSpec,
  over: Partial<BesoTimeWindow> = {},
): BesoTimeWindow {
  return win(id, { time, ...over });
}

/** Block mit Spalten-IDs am Datum (Standard 0800-1200, Ltg Kp). */
export function blockIn(
  id: Id,
  seq: number,
  date: IsoDate,
  ids: readonly Id[],
): ReturnType<typeof block> {
  return block(id, seq, { date, columns: { kind: 'ids', ids: [...ids] } });
}

/** Spaltensatz «KVK Stufen» (s7) mit Standard-Kategorien je Spalten-ID. */
export function stufenMitStandard(standard: Readonly<Record<Id, Id | null>>): ColumnSet {
  const s = setStufen();
  return {
    ...s,
    columns: s.columns.map((c) =>
      c.id in standard ? { ...c, defaultCategoryId: standard[c.id] ?? null } : c,
    ),
  };
}

/** Planungs- oder Nebenspalte eines Test-Spaltensatzes (Standard: Planungsspalte, normal, ohne Kategorie). */
export interface SpalteDef {
  readonly id: Id;
  readonly name: string;
  readonly kind?: 'planning' | 'secondary';
  readonly weight?: ColumnWeight;
  readonly defaultCategoryId?: Id | null;
}

/** Spaltensatz aus Planungs- und Nebenspalten, danach Rap-Spalte `<id>-rap` und Beso-Spalte `<id>-beso`. */
export function satz(id: Id, name: string, spalten: readonly SpalteDef[]): ColumnSet {
  return {
    id,
    name,
    columns: [
      ...spalten.map(
        (s): Column =>
          col(s.id, s.name, s.kind ?? 'planning', {
            weight: s.weight ?? 'normal',
            defaultCategoryId: s.defaultCategoryId ?? null,
          }),
      ),
      col(`${id}-rap`, 'Rap', 'rap'),
      col(`${id}-beso`, 'Beso', 'beso'),
    ],
  };
}

/** Nummern aller Beso eines Datums (ID → Nummer). */
export function nummern(plan: Plan, date: IsoDate): Record<Id, number | null> {
  const out: Record<Id, number | null> = {};
  for (const e of Object.values(plan.entries)) {
    if (e.type === 'beso' && e.date === date) out[e.id] = e.besoNumber;
  }
  return out;
}

/** Nummern aller Beso des Plans (ID → Nummer). */
export function alleNummern(plan: Plan): Record<Id, number | null> {
  const out: Record<Id, number | null> = {};
  for (const e of Object.values(plan.entries)) if (e.type === 'beso') out[e.id] = e.besoNumber;
  return out;
}

/** Eintrag mit ID; scheitert mit Assertion, wenn er fehlt. */
export function eintrag(plan: Plan, id: Id): Entry {
  const e = plan.entries[id];
  expect(e, `Eintrag ${id} vorhanden`).toBeDefined();
  return e as Entry;
}

/** Beso mit ID; scheitert mit Assertion, wenn er fehlt oder kein Beso ist. */
export function besoVon(plan: Plan, id: Id): Beso {
  const e = eintrag(plan, id);
  expect(e.type).toBe('beso');
  return e as Beso;
}

/**
 * Patches hin und zurück (Vertrag Abschnitt 1a Schritt 4): applyPatches(vorher, patches) = Ergebnis,
 * applyPatches(Ergebnis, inversePatches) = vorher (strukturell).
 */
export function expectUmkehrbar(vorher: Plan, r: CommandResult): void {
  expect(applyPatches(vorher, r.patches), 'applyPatches(vorher, patches)').toEqual(r.plan);
  expect(applyPatches(r.plan, r.inversePatches), 'applyPatches(nachher, inversePatches)').toEqual(
    vorher,
  );
}

/**
 * Führt einen Befehl aus und prüft Reinheit (Eingabeplan unverändert) und Umkehrbarkeit; gibt das Ergebnis
 * zurück.
 */
export function run<R extends CommandResult>(plan: Plan, befehl: (p: Plan) => R): R {
  const vorher = roundTrip(plan);
  const r = befehl(plan);
  expect(plan, 'Eingabeplan unverändert (Befehle sind rein)').toEqual(vorher);
  expectUmkehrbar(plan, r);
  return r;
}

/** Befehl ohne Wirkung (Abschnitt 1a Schritt 4): gleicher Plan, leere Patches und leeres Betroffenes. */
export function expectKeineWirkung(plan: Plan, r: CommandResult): void {
  expect(r.plan).toBe(plan);
  expect(r.patches).toEqual([]);
  expect(r.inversePatches).toEqual([]);
  expect(r.affectedDates).toEqual([]);
  expect(r.affectedEntryIds).toEqual([]);
}

export interface ErwarteterFehler {
  readonly code: CommandErrorCode;
  readonly field?: string | null;
  readonly entryId?: Id | null;
}

/**
 * Erwarteter CommandError (Abschnitt 4): Code, Feld und Eintrag wie angegeben, Meldung mit Ursache und
 * nächstem Schritt; der Plan bleibt unverändert (Abschnitt 1a Schritt 5).
 */
export function expectCommandError(
  plan: Plan,
  befehl: (p: Plan) => unknown,
  erwartet: ErwarteterFehler,
): CommandError {
  const vorher = roundTrip(plan);
  const e = catchError(() => befehl(plan));
  expect(e).toBeInstanceOf(CommandError);
  const err = e as CommandError;
  expect(err.code).toBe(erwartet.code);
  if (erwartet.field !== undefined) expect(err.field).toBe(erwartet.field);
  if (erwartet.entryId !== undefined) expect(err.entryId).toBe(erwartet.entryId);
  expect(err.userMessage.cause.trim()).not.toBe('');
  expect(err.userMessage.nextStep.trim()).not.toBe('');
  expect(plan, 'Plan unverändert nach Fehler').toEqual(vorher);
  return err;
}

/** Programmfehler (z.B. RangeError), kein CommandError (Abschnitt 4 «Programmfehler»). */
export function expectProgrammfehler(
  plan: Plan,
  befehl: (p: Plan) => unknown,
  art: typeof RangeError,
): void {
  const e = catchError(() => befehl(plan));
  expect(e).toBeInstanceOf(art);
  expect(e).not.toBeInstanceOf(CommandError);
}

/** Titel als Rich Text mit einem Verweis-Lauf auf einen Beso (R-5.3-11). */
export function titelMitVerweis(text: string, besoId: Id, bold = false): Beso['title'] {
  return [
    { text, bold },
    { text: '', bold, besoRef: besoId },
  ];
}

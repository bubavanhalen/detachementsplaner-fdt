// Zufällige Bearbeitungsfolgen für die Eigenschaftstests der Befehle (Paket E1-03; Vertrag E1-03 Abschnitt 1a,
// 2, 3; ADR-010 §5: fester Startwert). Jede Aktion ruft genau einen Befehl über den Vertrag auf. Erwartete
// CommandError (je Aktion festgelegt) lassen den Plan unverändert; jeder andere Fehler bricht die Eigenschaft ab.
// Alle Inhalte sind fiktiv.
import fc from 'fast-check';
import { expect } from 'vitest';
import { addDays, weekdayOf } from '../../../../src/model/wap/calendar';
import {
  addTimeWindow,
  removeTimeWindow,
  setBesoNumberFixed,
  updateTimeWindow,
} from '../../../../src/model/wap/commands/beso';
import {
  CommandError,
  type CommandErrorCode,
  type CommandResult,
} from '../../../../src/model/wap/commands/command';
import {
  copyEntries,
  copyEntryToDates,
  createEntry,
  deleteEntries,
  moveEntries,
  updateEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import { sortTime } from '../../../../src/model/wap/time';
import type {
  Beso,
  EntryStatus,
  Id,
  IsoDate,
  Plan,
  TimeSpec,
} from '../../../../src/model/wap/types';
import { timeSpec } from '../arbitraries/model';
import { rt } from '../model/builders';
import { ctx, expectUmkehrbar, KREIS } from './helpers';

/** Fester Startwert der Eigenschaftstests der Befehle. */
export const COMMANDS_SEED = 20261004;
/** Läufe je Eigenschaft (begrenzt, ADR-010 §4.5 Punkt 2). */
export const COMMANDS_RUNS = 60;

/** Erster Tag der Folgen: Montag der Woche w26 im Plan aus `basePlan`; Tage 0–13 = w26 und w27. */
export const START: IsoDate = '2026-09-28';

export type Aktion =
  | { readonly k: 'neu'; readonly tag: number; readonly fenster: readonly TimeSpec[] }
  | { readonly k: 'block'; readonly tag: number }
  | { readonly k: 'schieben'; readonly wahl: number; readonly delta: number; readonly tage: number }
  | { readonly k: 'loeschen'; readonly wahl: number }
  | {
      readonly k: 'fixieren';
      readonly wahl: number;
      readonly fest: boolean;
      readonly nr: number | null;
    }
  | { readonly k: 'status'; readonly wahl: number; readonly status: EntryStatus }
  | {
      readonly k: 'zeit';
      readonly wahl: number;
      readonly fenster: number;
      readonly zeit: TimeSpec | null;
    }
  | { readonly k: 'fensterNeu'; readonly wahl: number; readonly zeit: TimeSpec }
  | { readonly k: 'fensterWeg'; readonly wahl: number; readonly fenster: number }
  | { readonly k: 'kopie'; readonly wahl: number; readonly tage: number }
  | { readonly k: 'anTage'; readonly wahl: number; readonly tage: readonly number[] }
  | { readonly k: 'datum'; readonly wahl: number; readonly tage: number }
  | { readonly k: 'titel'; readonly wahl: number };

const tag = fc.integer({ min: 0, max: 13 });
const wahl = fc.nat({ max: 1000 });
const delta = fc.integer({ min: -144, max: 144 }).map((n) => n * 5);
const tage = fc.integer({ min: -3, max: 3 });

export const neuerBeso: fc.Arbitrary<Aktion> = fc.record({
  k: fc.constant('neu' as const),
  tag,
  fenster: fc.array(timeSpec, { minLength: 1, maxLength: 3 }),
});

/** Aktionen, die nur Zeiten, Tage, Anzahl und Zeitfenster ändern (keine Fixierung, kein Streichen). */
export const verschiebeAktion: fc.Arbitrary<Aktion> = fc.oneof(
  { arbitrary: neuerBeso, weight: 3 },
  { arbitrary: fc.record({ k: fc.constant('schieben' as const), wahl, delta, tage }), weight: 4 },
  { arbitrary: fc.record({ k: fc.constant('loeschen' as const), wahl }), weight: 1 },
  {
    arbitrary: fc.record({
      k: fc.constant('zeit' as const),
      wahl,
      fenster: fc.nat({ max: 2 }),
      zeit: timeSpec,
    }),
    weight: 2,
  },
  {
    arbitrary: fc.record({ k: fc.constant('fensterNeu' as const), wahl, zeit: timeSpec }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      k: fc.constant('fensterWeg' as const),
      wahl,
      fenster: fc.nat({ max: 2 }),
    }),
    weight: 1,
  },
  { arbitrary: fc.record({ k: fc.constant('kopie' as const), wahl, tage }), weight: 1 },
  { arbitrary: fc.record({ k: fc.constant('datum' as const), wahl, tage }), weight: 1 },
  { arbitrary: fc.record({ k: fc.constant('block' as const), tag }), weight: 1 },
);

/** Alle Bearbeitungen; `fixieren` mit beliebiger Nummer (auch ausserhalb des Kreises). */
export const jedeAktion: fc.Arbitrary<Aktion> = fc.oneof(
  { arbitrary: verschiebeAktion, weight: 6 },
  {
    arbitrary: fc.record({
      k: fc.constant('fixieren' as const),
      wahl,
      fest: fc.boolean(),
      nr: fc.option(fc.integer({ min: 0, max: 80 }), { nil: null }),
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      k: fc.constant('status' as const),
      wahl,
      status: fc.constantFrom<EntryStatus>('confirmed', 'open', 'cancelled'),
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      k: fc.constant('zeit' as const),
      wahl,
      fenster: fc.nat({ max: 2 }),
      zeit: fc.constant(null),
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      k: fc.constant('anTage' as const),
      wahl,
      tage: fc.array(fc.integer({ min: -3, max: 3 }), { minLength: 1, maxLength: 3 }),
    }),
    weight: 1,
  },
  { arbitrary: fc.record({ k: fc.constant('titel' as const), wahl }), weight: 1 },
);

/**
 * Bearbeitungen ab dem Stand ohne die Ausnahmen von R-14.4-02 (Änderungsnotiz V08): kein «Tag neu
 * nummerieren», `setBesoNumberFixed` nur ohne neue Nummer.
 */
export const aktionOhneUmnummerieren: fc.Arbitrary<Aktion> = jedeAktion.map((a) =>
  a.k === 'fixieren' ? { ...a, nr: null } : a,
);

/** Beso des Plans, sortiert nach ID (deterministische Auswahl). */
export function besoListe(plan: Plan): readonly Beso[] {
  return Object.values(plan.entries)
    .filter((e): e is Beso => e.type === 'beso')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function gewaehlt(plan: Plan, n: number): Beso | null {
  const liste = besoListe(plan);
  return liste.length === 0 ? null : (liste[n % liste.length] ?? null);
}

function datum(t: number): IsoDate {
  return addDays(START, t);
}

/** Erlaubte CommandError je Aktion; sie lassen den Plan unverändert. */
const ERLAUBT: Readonly<Record<Aktion['k'], readonly CommandErrorCode[]>> = {
  neu: [],
  block: [],
  schieben: ['invalidTime', 'outsidePlan'],
  loeschen: [],
  fixieren: ['invalidNumber', 'numberTaken'],
  status: [],
  zeit: [],
  fensterNeu: [],
  fensterWeg: ['lastTimeWindow'],
  kopie: ['outsidePlan'],
  anTage: ['outsidePlan', 'emptySelection'],
  datum: ['outsidePlan'],
  titel: [],
};

function befehl(plan: Plan, a: Aktion): CommandResult | null {
  if (a.k === 'neu') {
    return createEntry(
      plan,
      {
        type: 'beso',
        date: datum(a.tag),
        title: rt('Beso'),
        windows: a.fenster.map((time) => ({ time })),
      },
      ctx,
    );
  }
  if (a.k === 'block') {
    return createEntry(
      plan,
      {
        type: 'block',
        date: datum(a.tag),
        time: { form: 'range', from: 480, to: 600 },
        columns: { kind: 'all' },
        title: rt('Ausb'),
      },
      ctx,
    );
  }
  const b = gewaehlt(plan, a.wahl);
  if (b === null) return null;
  switch (a.k) {
    case 'schieben':
      return moveEntries(plan, [b.id], { deltaMinutes: a.delta, dayOffset: a.tage }, ctx);
    case 'loeschen':
      return deleteEntries(plan, [b.id], ctx);
    case 'fixieren':
      return setBesoNumberFixed(plan, b.id, a.fest, a.fest ? a.nr : null, ctx);
    case 'status':
      return updateEntries(plan, [b.id], { status: a.status }, ctx);
    case 'zeit': {
      const w = b.windows[a.fenster % b.windows.length];
      if (w === undefined) return null;
      return updateTimeWindow(plan, b.id, w.id, { time: a.zeit }, ctx);
    }
    case 'fensterNeu':
      return addTimeWindow(plan, b.id, { time: a.zeit }, ctx);
    case 'fensterWeg': {
      const w = b.windows[a.fenster % b.windows.length];
      if (w === undefined) return null;
      return removeTimeWindow(plan, b.id, w.id, ctx);
    }
    case 'kopie':
      return copyEntries(plan, [b.id], { dayOffset: a.tage }, ctx);
    case 'anTage':
      return copyEntryToDates(
        plan,
        b.id,
        a.tage.map((t) => addDays(b.date, t)),
        ctx,
      );
    case 'datum':
      return updateEntry(plan, b.id, 'beso', { date: addDays(b.date, a.tage) }, ctx);
    case 'titel':
      return updateEntry(plan, b.id, 'beso', { title: rt(`Beso ${a.wahl}`) }, ctx);
  }
}

export interface Schritt {
  readonly vorher: Plan;
  readonly nachher: Plan;
  readonly ergebnis: CommandResult | null;
}

/**
 * Führt eine Aktion aus: Ergebnis mit geprüfter Umkehrbarkeit (Abschnitt 1a Schritt 4) oder bei erwartetem
 * CommandError der unveränderte Plan. Andere Fehler (auch «nicht implementiert») werden weitergeworfen.
 */
export function schritt(plan: Plan, a: Aktion): Schritt {
  let ergebnis: CommandResult | null;
  try {
    ergebnis = befehl(plan, a);
  } catch (e) {
    if (e instanceof CommandError && ERLAUBT[a.k].includes(e.code as CommandErrorCode)) {
      return { vorher: plan, nachher: plan, ergebnis: null };
    }
    throw e;
  }
  if (ergebnis === null) return { vorher: plan, nachher: plan, ergebnis: null };
  expectUmkehrbar(plan, ergebnis);
  return { vorher: plan, nachher: ergebnis.plan, ergebnis };
}

/** Daten aller Beso des Plans, aufsteigend. */
export function besoDaten(plan: Plan): readonly IsoDate[] {
  return [...new Set(besoListe(plan).map((b) => b.date))].sort();
}

function kleinsteSortierzeit(b: Beso): number {
  return Math.min(...b.windows.map((w) => sortTime(w.time)));
}

/** Sortierreihenfolge nach Vertrag Abschnitt 3: kleinste Sortierzeit, createdSeq, id. */
export function sortierreihenfolge(liste: readonly Beso[]): readonly Beso[] {
  return [...liste].sort(
    (a, b) =>
      kleinsteSortierzeit(a) - kleinsteSortierzeit(b) ||
      a.createdSeq - b.createdSeq ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * Orakel vor dem ersten Stand (Vertrag Abschnitt 3, F-13): gehalten sind Beso mit Nummer und Fixierung oder
 * Status gestrichen; die übrigen erhalten in Sortierreihenfolge die freien Nummern des Kreises aufsteigend,
 * reichen sie nicht, keine.
 */
export function erwartetVorStand(plan: Plan, date: IsoDate): Record<Id, number | null> {
  const kreis = KREIS[weekdayOf(date)];
  const amTag = besoListe(plan).filter((b) => b.date === date);
  const gehalten = amTag.filter(
    (b) => b.besoNumber !== null && (b.numberFixed || b.status === 'cancelled'),
  );
  const belegt = new Set(gehalten.map((b) => b.besoNumber));
  const frei: number[] = [];
  for (let n = kreis.min; n <= kreis.max; n++) if (!belegt.has(n)) frei.push(n);
  const out: Record<Id, number | null> = {};
  for (const b of gehalten) out[b.id] = b.besoNumber;
  sortierreihenfolge(amTag.filter((b) => !gehalten.includes(b))).forEach((b, i) => {
    out[b.id] = frei[i] ?? null;
  });
  return out;
}

/** Nummern der Beso eines Datums. */
export function nummernAm(plan: Plan, date: IsoDate): Record<Id, number | null> {
  const out: Record<Id, number | null> = {};
  for (const b of besoListe(plan)) if (b.date === date) out[b.id] = b.besoNumber;
  return out;
}

/** Plan.service und Schlüsselmenge bleiben (keine Aufgebotsart, AGENTS.md). */
export function expectKeineAufgebotsart(vorher: Plan, nachher: Plan): void {
  expect(nachher.service).toBe(vorher.service);
  expect(Object.keys(nachher).sort()).toEqual(Object.keys(vorher).sort());
}

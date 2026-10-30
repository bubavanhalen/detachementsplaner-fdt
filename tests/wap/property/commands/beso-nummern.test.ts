// @vitest-environment jsdom
// Eigenschaften der Beso-Nummerierung über zufällige Bearbeitungsfolgen (Vertrag E1-03 Abschnitt 1a, 3, 7;
// Änderungsnotiz V08; Beschrieb 5.3, 14.4; F-13, F-14). Fester Startwert (ADR-010 §5).

import fc from 'fast-check';
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { weekdayOf } from '../../../../src/model/wap/calendar';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import { agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import type { Plan } from '../../../../src/model/wap/types';
import { timeSpec } from '../../support/arbitraries/model';
import type { Aktion } from '../../support/commands/folgen';
import {
  aktionOhneUmnummerieren,
  besoDaten,
  besoListe,
  COMMANDS_RUNS,
  COMMANDS_SEED,
  erwartetVorStand,
  expectKeineAufgebotsart,
  jedeAktion,
  neuerBeso,
  nummernAm,
  schritt,
  sortierreihenfolge,
  verschiebeAktion,
} from '../../support/commands/folgen';
import { KREIS, STAND } from '../../support/commands/helpers';
import { basePlan } from '../../support/model/builders';

const OPTIONEN = { seed: COMMANDS_SEED, numRuns: COMMANDS_RUNS } as const;

/** Neue Beso nur am Mo und Di der ersten Woche (damit Tage mit mehr als zehn Beso vorkommen). */
const neuerBesoMoDi: fc.Arbitrary<Aktion> = fc.record({
  k: fc.constant('neu' as const),
  tag: fc.integer({ min: 0, max: 1 }),
  fenster: fc.array(timeSpec, { minLength: 1, maxLength: 2 }),
});

function ausfuehren(
  start: Plan,
  aktionen: readonly Aktion[],
  pruefe: (vorher: Plan, nachher: Plan) => void,
): Plan {
  let plan = start;
  for (const a of aktionen) {
    const s = schritt(plan, a);
    pruefe(s.vorher, s.nachher);
    plan = s.nachher;
  }
  return plan;
}

describe('Beso-Nummern vor dem ersten Stand (R-14.4-01)', () => {
  it('[R-14.4-01] zufällige Verschiebefolgen: Nummern je Tag = x0 … x(n−1) in Sortierreihenfolge ohne Lücke', () => {
    fc.assert(
      fc.property(
        fc.array(neuerBeso, { minLength: 1, maxLength: 12 }),
        fc.array(verschiebeAktion, { maxLength: 12 }),
        (anfang, folge) => {
          ausfuehren(basePlan(), [...anfang, ...folge], (_vorher, plan) => {
            for (const d of besoDaten(plan)) {
              const kreis = KREIS[weekdayOf(d)];
              const sortiert = sortierreihenfolge(besoListe(plan).filter((b) => b.date === d));
              expect(sortiert.map((b) => b.besoNumber)).toEqual(
                sortiert.map((_, i) => (i < 10 ? kreis.min + i : null)),
              );
            }
          });
        },
      ),
      OPTIONEN,
    );
  });

  it('[R-14.4-01] mit Fixierung und Streichen (F-13): nicht gehaltene Nummern = kleinste freie des Kreises in Sortierreihenfolge', () => {
    fc.assert(
      fc.property(
        fc.array(neuerBeso, { minLength: 1, maxLength: 12 }),
        fc.array(jedeAktion, { maxLength: 14 }),
        (anfang, folge) => {
          ausfuehren(basePlan(), [...anfang, ...folge], (_vorher, plan) => {
            expect(plan.stand).toBeNull();
            for (const d of besoDaten(plan)) {
              expect(nummernAm(plan, d)).toEqual(erwartetVorStand(plan, d));
            }
          });
        },
      ),
      OPTIONEN,
    );
  });
});

describe('Beso-Nummern ab dem ersten Stand (R-14.4-02)', () => {
  it('[R-14.4-02] zufällige Bearbeitungsfolgen ohne «Tag neu nummerieren»: jede Nummer ≠ null bleibt; neue nur im Kreis', () => {
    fc.assert(
      fc.property(
        fc.array(neuerBeso, { minLength: 1, maxLength: 12 }),
        fc.array(aktionOhneUmnummerieren, { maxLength: 14 }),
        (anfang, folge) => {
          const vorStand = ausfuehren(basePlan(), anfang, () => {});
          ausfuehren({ ...vorStand, stand: STAND }, folge, (vorher, nachher) => {
            const alt = new Map(besoListe(vorher).map((b) => [b.id, b.besoNumber]));
            for (const b of besoListe(nachher)) {
              const war = alt.get(b.id);
              if (war !== undefined && war !== null) {
                expect(b.besoNumber, `Beso ${b.id}`).toBe(war);
              } else if (b.besoNumber !== null) {
                const kreis = KREIS[weekdayOf(b.date)];
                expect(b.besoNumber).toBeGreaterThanOrEqual(kreis.min);
                expect(b.besoNumber).toBeLessThanOrEqual(kreis.max);
              }
            }
          });
        },
      ),
      OPTIONEN,
    );
  });

  it('[R-14.4-02] (1a Schritt 4, AR0-41) Undo und Redo über ganze Folgen stellen Plan, Nummern, nextId und nextSeq exakt her', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(neuerBeso, { minLength: 1, maxLength: 8 }),
        fc.array(jedeAktion, { maxLength: 12 }),
        (mitStand, anfang, folge) => {
          const vorStand = ausfuehren(basePlan(), anfang, () => {});
          const start: Plan = mitStand ? { ...vorStand, stand: STAND } : vorStand;
          const ergebnisse: CommandResult[] = [];
          let plan = start;
          for (const a of folge) {
            const s = schritt(plan, a);
            if (s.ergebnis !== null) ergebnisse.push(s.ergebnis);
            plan = s.nachher;
          }
          let zurueck = plan;
          for (const r of [...ergebnisse].reverse())
            zurueck = applyPatches(zurueck, r.inversePatches);
          expect(zurueck).toEqual(start);
          let vor = start;
          for (const r of ergebnisse) vor = applyPatches(vor, r.patches);
          expect(vor).toEqual(plan);
        },
      ),
      OPTIONEN,
    );
  });
});

describe('Beso und Terminzeile als Einheit (R-5.3-01)', () => {
  it('[R-5.3-01] zufällige Bearbeitungsfolgen: je Tag Nummern der Beso = Nummern der Terminzeilen; keine Nummer ohne Text; vor dem Stand null nur bei mehr als zehn Beso', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(neuerBesoMoDi, { minLength: 1, maxLength: 24 }),
        fc.array(jedeAktion, { maxLength: 12 }),
        (mitStand, anfang, folge) => {
          const pruefe = (vorher: Plan, plan: Plan): void => {
            expectKeineAufgebotsart(vorher, plan);
            for (const e of Object.values(plan.entries)) {
              if (e.type === 'beso') expect(e.windows.length).toBeGreaterThanOrEqual(1);
              else expect('besoNumber' in e).toBe(false);
            }
            for (const d of besoDaten(plan)) {
              const amTag = besoListe(plan).filter((b) => b.date === d);
              const zeilen = agendaLinesForDate(plan, d).filter((l) =>
                amTag.some((b) => b.id === l.entryId),
              );
              expect(zeilen.map((l) => l.entryId).sort()).toEqual(amTag.map((b) => b.id).sort());
              const nummern = (xs: readonly (number | null)[]) =>
                [...xs].sort((x, y) => (x ?? -1) - (y ?? -1));
              expect(nummern(zeilen.map((l) => l.number))).toEqual(
                nummern(amTag.map((b) => b.besoNumber)),
              );
              // Text gehört zum Beso: beginnt mit seiner Nummer (bzw. «–») und enthält seinen Titel
              for (const l of zeilen) {
                const b = amTag.find((x) => x.id === l.entryId);
                const text = l.text.map((r) => r.text).join('');
                expect(text.startsWith(`${l.number ?? '–'} `)).toBe(true);
                expect(text).toContain(b?.title.map((r) => r.text).join('') ?? '');
              }
              // Vor dem Stand nur bei mehr als zehn Beso (F-14); ab dem Stand gilt das erst mit V-03-8/V-03-9
              // und ist durch einen eigenen Unit-Test belegt (TR-E103-03).
              if (plan.stand === null && amTag.some((b) => b.besoNumber === null))
                expect(amTag.length).toBeGreaterThan(10);
            }
          };
          const vorStand = ausfuehren(basePlan(), anfang, pruefe);
          ausfuehren(mitStand ? { ...vorStand, stand: STAND } : vorStand, folge, pruefe);
        },
      ),
      OPTIONEN,
    );
  });
});

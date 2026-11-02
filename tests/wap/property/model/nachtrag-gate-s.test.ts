// @vitest-environment jsdom
// Eigenschaften der Teilaufgaben über zufällige Folgen von Teilaufgaben-Befehlen (Vertrag E1-02h Abschnitt 1c
// K-1, K-2, 4a, 9; Plan Etappe 1 Notiz Gate S / I2 1.2 «Property: Rundreise über JSON; Befehl ∘ Inverse =
// Identität»; R-4.6-63, R-4.6-66). Fester Startwert (ADR-010 §5); Plan und Inhalte fiktiv.
import fc from 'fast-check';
import { applyPatches, type Patch } from 'immer';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../../../src/model/wap/calendar';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { validateEntry } from '../../../../src/model/wap/validate';
import { roundTrip } from '../../support/model/builders';
import {
  FOLGE_BLOECKE,
  schluessel,
  TEILAUFGABEN_RUNS,
  TEILAUFGABEN_SEED,
  teilaufgabenAktion,
  teilaufgabenPlan,
  teilaufgabenSchritt,
} from '../../support/model/teilaufgaben';

const OPTIONEN = { seed: TEILAUFGABEN_SEED, numRuns: TEILAUFGABEN_RUNS } as const;

const folge = fc.array(teilaufgabenAktion, { minLength: 1, maxLength: 15 });

/** Blöcke des Plans aus FOLGE_BLOECKE. */
function bloecke(plan: Plan): readonly Block[] {
  return FOLGE_BLOECKE.map((id) => plan.entries[id]).filter(
    (e): e is Block => e !== undefined && e.type === 'block',
  );
}

/** Erwartete betroffene Tage eines Blocks (Abschnitt 4a «Ergebnis», E1-03 1b). */
function erwarteteTage(b: Block): readonly string[] {
  return b.time.form === 'range' && b.time.to > 1440 ? [b.date, addDays(b.date, 1)] : [b.date];
}

describe('Teilaufgaben über zufällige Befehlsfolgen', () => {
  it('[R-4.6-63] Rundreise über JSON: nach jedem Teilaufgaben-Befehl ist JSON.parse(JSON.stringify(plan)) strukturell gleich; jeder Block mit Teilaufgaben gültig, Liste nie leer, je genau title, ltg, ort', () => {
    fc.assert(
      fc.property(folge, (aktionen) => {
        let plan = teilaufgabenPlan();
        for (const a of aktionen) {
          plan = teilaufgabenSchritt(plan, a).result.plan;
          expect(roundTrip(plan)).toStrictEqual(plan);
          expect(plan.schemaVersion).toBe(1);
          for (const b of bloecke(plan)) {
            if (!Object.hasOwn(b, 'subtasks')) continue;
            expect(b.subtasks?.length ?? 0).toBeGreaterThan(0);
            expect(validateEntry(plan, b)).toEqual([]);
            for (const s of b.subtasks ?? [])
              expect(schluessel(s)).toEqual(['ltg', 'ort', 'title']);
          }
        }
      }),
      OPTIONEN,
    );
  });

  it('[R-4.6-66] Befehl ∘ Inverse = Identität: nach jedem Schritt Patches hin und zurück, betroffen genau der Block (oder nichts ohne Wirkung); alle inversePatches rückwärts ergeben den Ausgangsplan', () => {
    fc.assert(
      fc.property(folge, (aktionen) => {
        const start = teilaufgabenPlan();
        let plan = start;
        const inverse: (readonly Patch[])[] = [];
        for (const a of aktionen) {
          const { vorher, blockId, result } = teilaufgabenSchritt(plan, a);
          expect(applyPatches(vorher, result.patches)).toStrictEqual(result.plan);
          expect(applyPatches(result.plan, result.inversePatches)).toStrictEqual(vorher);
          if (result.plan === vorher) {
            expect(result.patches).toEqual([]);
            expect(result.affectedEntryIds).toEqual([]);
            expect(result.affectedDates).toEqual([]);
          } else {
            expect(result.affectedEntryIds).toEqual([blockId]);
            const b = result.plan.entries[blockId];
            expect(b?.type).toBe('block');
            expect(result.affectedDates).toEqual(erwarteteTage(b as Block));
            expect(result.plan.nextId).toBe(vorher.nextId);
            expect(result.plan.nextSeq).toBe(vorher.nextSeq);
          }
          inverse.push(result.inversePatches);
          plan = result.plan;
        }
        let zurueck = plan;
        for (const p of [...inverse].reverse()) zurueck = applyPatches(zurueck, p);
        expect(zurueck).toStrictEqual(start);
      }),
      OPTIONEN,
    );
  });
});

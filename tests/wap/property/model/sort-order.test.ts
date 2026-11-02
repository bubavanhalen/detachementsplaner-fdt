// @vitest-environment jsdom
// Sortierung der Einträge (Vertrag E1-02a Abschnitt 3 time.ts, 8 P-5; Beschrieb 4.6 «Sortierzeit»).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compareEntries, sortTime } from '../../../../src/model/wap/time';
import {
  entriesWithAnyTime,
  entriesWithEqualSortTime,
  MODEL_RUNS,
  MODEL_SEED,
} from '../../support/arbitraries/model';
import { roundTrip } from '../../support/model/builders';

describe('Sortierung nach Sortierzeit und Erfassung', () => {
  it('[R-4.6-40] gleiche Sortierzeit: Reihenfolge = Erfassungsreihenfolge, auch nach Speichern und Laden (JSON-Rundlauf)', () => {
    expect(
      compareEntries(
        { time: { form: 'point', at: 600 }, createdSeq: 1 },
        { time: { form: 'range', from: 600, to: 660 }, createdSeq: 2 },
      ),
    ).toBeLessThan(0);
    fc.assert(
      fc.property(entriesWithEqualSortTime, (entries) => {
        const expected = [...entries].map((e) => e.createdSeq).sort((a, b) => a - b);
        expect([...entries].sort(compareEntries).map((e) => e.createdSeq)).toEqual(expected);
        expect(
          roundTrip(entries)
            .sort(compareEntries)
            .map((e) => e.createdSeq),
        ).toEqual(expected);
      }),
      { seed: MODEL_SEED, numRuns: MODEL_RUNS },
    );
  });

  it('[R-4.6-40] beliebige Zeiten: sortiert nach Sortierzeit, bei Gleichstand nach Erfassung; Vergleich antisymmetrisch', () => {
    expect(
      compareEntries(
        { time: { form: 'until', to: 720 }, createdSeq: 1 },
        { time: { form: 'point', at: 690 }, createdSeq: 2 },
      ),
    ).toBeGreaterThan(0);
    fc.assert(
      fc.property(entriesWithAnyTime, (entries) => {
        const sorted = [...entries].sort(compareEntries);
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1];
          const b = sorted[i];
          if (a === undefined || b === undefined) continue;
          const ta = sortTime(a.time);
          const tb = sortTime(b.time);
          expect(ta <= tb).toBe(true);
          if (ta === tb) expect(a.createdSeq).toBeLessThan(b.createdSeq);
          expect(Math.sign(compareEntries(a, b))).toBe(-Math.sign(compareEntries(b, a)));
        }
      }),
      { seed: MODEL_SEED, numRuns: MODEL_RUNS },
    );
  });
});

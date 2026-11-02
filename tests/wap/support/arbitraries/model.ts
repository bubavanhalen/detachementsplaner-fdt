// Arbitraries für Property-Tests des Datenmodells (Paket E1-02a; ADR-010 §5: fester Startwert).
import fc from 'fast-check';
import type { MilTime, TimeSpec } from '../../../../src/model/wap/types';

/** Fester Startwert aller Property-Tests des Modells. */
export const MODEL_SEED = 20260928;

/** Läufe je Eigenschaft (begrenzt, ADR-010 §4.5 Punkt 2). */
export const MODEL_RUNS = 300;

/** Militärzeit auf dem 5-Minuten-Raster zwischen `min` und `max` (je inklusive, Vielfache von 5). */
export function milTime(min: MilTime = 0, max: MilTime = 1440): fc.Arbitrary<MilTime> {
  return fc.integer({ min: Math.ceil(min / 5), max: Math.floor(max / 5) }).map((n) => n * 5);
}

/**
 * Zeitform mit vorgegebener Sortierzeit `t` (Vertrag P-5: point → at, range/from → from,
 * until → to, deadline → to). `t` liegt zwischen 5 und 1435.
 */
export function timeSpecWithSortTime(t: MilTime): fc.Arbitrary<TimeSpec> {
  return fc.oneof(
    fc.constant<TimeSpec>({ form: 'point', at: t }),
    milTime(t + 5, t + 1440).map<TimeSpec>((to) => ({ form: 'range', from: t, to })),
    fc.constant<TimeSpec>({ form: 'from', from: t }),
    fc.constant<TimeSpec>({ form: 'until', to: t }),
    fc.constant<TimeSpec>({ form: 'deadline', to: t }),
  );
}

/** Beliebige gültige Zeitform. */
export const timeSpec: fc.Arbitrary<TimeSpec> = milTime(5, 1435).chain((t) =>
  fc.oneof(timeSpecWithSortTime(t), fc.constant<TimeSpec>({ form: 'deadline' })),
);

export interface SortableEntry {
  readonly time: TimeSpec;
  readonly createdSeq: number;
}

/**
 * 2 bis 25 Einträge mit derselben Sortierzeit und paarweise verschiedener Erfassungsnummer,
 * in zufälliger Reihenfolge.
 */
export const entriesWithEqualSortTime: fc.Arbitrary<SortableEntry[]> = milTime(5, 1435).chain((t) =>
  fc
    .uniqueArray(fc.integer({ min: 1, max: 100_000 }), { minLength: 2, maxLength: 25 })
    .chain((seqs) =>
      fc.tuple(
        ...seqs.map((seq) => timeSpecWithSortTime(t).map((time) => ({ time, createdSeq: seq }))),
      ),
    ),
);

/** Einträge mit beliebigen Zeiten und paarweise verschiedener Erfassungsnummer. */
export const entriesWithAnyTime: fc.Arbitrary<SortableEntry[]> = fc
  .uniqueArray(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 30 })
  .chain((seqs) =>
    fc.tuple(...seqs.map((seq) => timeSpec.map((time) => ({ time, createdSeq: seq })))),
  );

// Beso-Nummerierung, rein (Vertrag E1-03 Abschnitt 3; Beschrieb 5.3; F-13, F-14, F-52).

import { weekdayOf } from '../calendar';
import { sortTime } from '../time';
import type { Beso, Id, IsoDate, Plan, Weekday } from '../types';

export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

/** 'auto': Regel des Planzustands (vor bzw. ab dem ersten Stand); 'renumber': «Tag neu nummerieren». */
export type NumberingMode = 'auto' | 'renumber';

const RANGES: Readonly<Record<Weekday, NumberRange>> = {
  Mo: { min: 10, max: 19 },
  Di: { min: 20, max: 29 },
  Mi: { min: 30, max: 39 },
  Do: { min: 40, max: 49 },
  Fr: { min: 50, max: 59 },
  Sa: { min: 60, max: 69 },
  So: { min: 70, max: 79 },
};

/** Mo 10–19, Di 20–29, Mi 30–39, Do 40–49, Fr 50–59, Sa 60–69, So 70–79 (R-5.3-02). */
export function numberRange(weekday: Weekday): NumberRange {
  if (!Object.hasOwn(RANGES, weekday)) {
    throw new RangeError(`numberRange: unbekannter Wochentag «${String(weekday)}».`);
  }
  const r = RANGES[weekday];
  return { min: r.min, max: r.max };
}

/** Kleinste Sortierzeit über alle Zeitfenster (Abschnitt 3). */
function earliest(b: Beso): number {
  return Math.min(...b.windows.map((w) => sortTime(w.time)));
}

/** Sortierreihenfolge: kleinste Sortierzeit, dann createdSeq, dann id nach UTF-16-Codeeinheiten. */
function compareBeso(a: Beso, b: Beso): number {
  // Ohne Zeitfenster: Sortierzeit unendlich, untereinander zeitgleich (Orchestrator f) – kein Infinity − Infinity.
  const ta = earliest(a);
  const tb = earliest(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (a.createdSeq !== b.createdSeq) return a.createdSeq - b.createdSeq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Nummer jedes Beso mit date = Datum nach Abschnitt 3; null nur bei vollem Nummernkreis (F-14).
 * Die Zuordnung steht in Sortierreihenfolge. Ungültiges Datum → ModelError 'invalidDate'.
 */
export function assignNumbers(
  plan: Plan,
  date: IsoDate,
  mode: NumberingMode = 'auto',
): ReadonlyMap<Id, number | null> {
  const range = numberRange(weekdayOf(date));
  const besos = Object.values(plan.entries)
    .filter((e): e is Beso => e.type === 'beso' && e.date === date)
    .sort(compareBeso);
  // Ab dem ersten Stand (nur 'auto') ist jede vorhandene Nummer gehalten (R-5.3-06); sonst nur fixierte und
  // gestrichene (R-5.3-05, R-5.3-09).
  const allKept = mode === 'auto' && plan.stand !== null;
  const keepsNumber = (b: Beso): boolean =>
    b.besoNumber !== null && (allKept || b.numberFixed || b.status === 'cancelled');
  const taken = new Set<number>();
  for (const b of besos) {
    const n = b.besoNumber;
    if (n !== null && keepsNumber(b) && n >= range.min && n <= range.max) taken.add(n);
  }
  const isFree = (n: number): boolean => !taken.has(n);
  const free: number[] = [];
  for (let n = range.min; n <= range.max; n++) if (isFree(n)) free.push(n);

  const out = new Map<Id, number | null>();
  let highest = Math.max(range.min - 1, ...taken);
  let nextFree = 0;
  for (const b of besos) {
    if (keepsNumber(b)) {
      out.set(b.id, b.besoNumber);
      continue;
    }
    if (!allKept) {
      // Vor dem Stand und «Tag neu nummerieren»: freie Nummern aufsteigend (R-5.3-03, F-13).
      out.set(b.id, free[nextFree] ?? null);
      nextFree += 1;
      continue;
    }
    // Ab dem Stand: kleinste freie Nummer über der höchsten belegten, sonst die kleinste freie (R-5.3-07).
    let n: number | null = null;
    for (let k = highest + 1; k <= range.max && n === null; k++) if (isFree(k)) n = k;
    for (let k = range.min; k <= range.max && n === null; k++) if (isFree(k)) n = k;
    if (n !== null) {
      taken.add(n);
      highest = Math.max(highest, n);
    }
    out.set(b.id, n);
  }
  return out;
}

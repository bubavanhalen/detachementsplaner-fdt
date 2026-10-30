// Einträge eines Datums (Vertrag E1-02a Abschnitt 3 und 8 P-11; R-4.5-10 Fortsetzung über Mitternacht).

import { addDays } from '../calendar';
import type { Entry, IsoDate, Plan, TimeSpec } from '../types';

/** true, wenn die Zeit über Mitternacht in den Folgetag reicht (Ende nach 2400). */
function crossesMidnight(t: TimeSpec): boolean {
  return t.form === 'range' && t.to > 1440;
}

/** Eintrag des Vortags, der am Datum fortgesetzt wird (Block, Rapport, Beso). */
function continuesFrom(e: Entry, previous: IsoDate): boolean {
  switch (e.type) {
    case 'block':
    case 'rapport':
      return e.date === previous && crossesMidnight(e.time);
    case 'beso':
      return e.date === previous && e.windows.some((w) => crossesMidnight(w.time));
    default:
      return false;
  }
}

function isOnDate(e: Entry, date: IsoDate, previous: IsoDate): boolean {
  switch (e.type) {
    case 'querbalken':
      return e.fromDate <= date && date <= e.toDate;
    case 'multiDayRemark':
      return false;
    default:
      return e.date === date || continuesFrom(e, previous);
  }
}

/** Einträge des Datums, Querbalken über das Datum und Fortsetzungen vom Vortag; nach createdSeq. */
export function entriesOnDate(plan: Plan, date: IsoDate): readonly Entry[] {
  const previous = addDays(date, -1);
  return Object.values(plan.entries)
    .filter((e) => isOnDate(e, date, previous))
    .sort((a, b) => a.createdSeq - b.createdSeq);
}

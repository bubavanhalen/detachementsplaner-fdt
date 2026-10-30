// Bemerkungen einer Woche (Vertrag E1-02a Abschnitt 3 und 8 P-11; R-4.1-14, R-4.2-07 bis R-4.2-10, F-38).

import { addDays } from '../calendar';
import type { Id, MultiDayRemark, Plan, Week } from '../types';
import { requireWeek } from './columns';

function appliesTo(r: MultiDayRemark, week: Week, lastDay: string): boolean {
  switch (r.scope.kind) {
    case 'plan':
      return true;
    case 'week':
      return r.scope.weekId === week.id;
    case 'range':
      return r.scope.fromDate <= lastDay && r.scope.toDate >= week.startDate;
  }
}

/** Plan-, Wochen- und Zeitraum-Bemerkungen der Woche ohne ausgeblendete; nach number (null zuletzt), dann createdSeq. */
export function remarksForWeek(plan: Plan, weekId: Id): readonly MultiDayRemark[] {
  const week = requireWeek(plan, weekId);
  const lastDay = addDays(week.startDate, 6);
  const hidden = new Set(week.hiddenRemarkIds);
  return Object.values(plan.entries)
    .filter(
      (e): e is MultiDayRemark =>
        e.type === 'multiDayRemark' && !hidden.has(e.id) && appliesTo(e, week, lastDay),
    )
    .sort((a, b) => {
      if (a.number !== b.number) {
        if (a.number === null) return 1;
        if (b.number === null) return -1;
        return a.number - b.number;
      }
      return a.createdSeq - b.createdSeq;
    });
}

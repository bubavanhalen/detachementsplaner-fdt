// Verweise auf Beso-Nummern in Titeln (Vertrag E1-03 Abschnitt 2e; Beschrieb 5.3; R-5.3-11, R-5.3-12).

import { addDays, isIsoDate } from '../calendar';
import { modelError } from '../errors';
import type { Id, IsoDate, Plan, RichText, TextRun } from '../types';
import { weekOfDate } from './command';

const REF = /\((0|[1-9]\d*)\)/g;

/**
 * «(21)» → Lauf mit besoRef, wenn genau ein Beso der Woche von `date` die Nummer 21 trägt; rein (V-03-7).
 * Datum ausserhalb der Wochen → Titel unverändert; ungültiges Datum → ModelError 'invalidDate'.
 */
export function linkBesoRefs(plan: Plan, date: IsoDate, title: RichText): RichText {
  if (!isIsoDate(date)) throw modelError('invalidDate');
  const week = weekOfDate(plan, date);
  if (week === null) return title;
  const first = week.startDate;
  const last = addDays(first, 6);
  // Nummer → Beso-ID; null, wenn mehrere Beso der Woche dieselbe Nummer tragen (nur eindeutige verlinken).
  const byNumber = new Map<number, Id | null>();
  for (const e of Object.values(plan.entries)) {
    if (e.type !== 'beso' || e.besoNumber === null || e.date < first || e.date > last) continue;
    byNumber.set(e.besoNumber, byNumber.has(e.besoNumber) ? null : e.id);
  }
  const out: TextRun[] = [];
  const pushText = (text: string, bold: boolean): void => {
    if (text !== '') out.push({ text, bold });
  };
  for (const run of title) {
    if (run.besoRef !== undefined) {
      out.push(run);
      continue;
    }
    let rest = 0;
    for (const match of run.text.matchAll(REF)) {
      const id = byNumber.get(Number(match[1]));
      if (id === undefined || id === null) continue;
      pushText(run.text.slice(rest, match.index), run.bold);
      out.push({ text: '', bold: run.bold, besoRef: id });
      rest = match.index + match[0].length;
    }
    pushText(run.text.slice(rest), run.bold);
  }
  return out;
}

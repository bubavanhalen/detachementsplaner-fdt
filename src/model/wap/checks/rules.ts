// Regeln P1, P16, P17 (Beschrieb 7; Vertrag E1-06 Abschnitt 2 mit Änderungsnotizen E1-03 und E1-05;
// UI-Richtlinie 12 «Katalog»; R-7-10, R-7-12, R-7-13). Rein.

import { weekdayOf } from '../calendar';
import { numberRange } from '../commands/numbering';
import type { Entry, Id, IsoDate, Plan } from '../types';
import {
  columnName,
  columnsOn,
  dayOf,
  dayText,
  entryDate,
  entryMinute,
  entryTitle,
  placeOf,
  querbalkenDays,
  weekOf,
} from './entryFacts';
import { type Finding, RULE_SEVERITY, type RuleId } from './types';

/** Befund ohne Quittierung; die Quittierung setzt runChecks. */
export type RawFinding = Omit<Finding, 'acknowledged' | 'acknowledgement'>;

function finding(
  rule: RuleId,
  weekId: Id,
  e: Entry,
  date: IsoDate | null,
  detail: string,
  plan: Plan,
  cause: string,
  nextStep: string,
): RawFinding {
  const minute = entryMinute(e);
  return {
    key: `${rule}|${weekId}|${e.id}|${detail}`,
    rule,
    severity: RULE_SEVERITY[rule],
    weekId,
    date,
    entryId: e.id,
    region: 'block',
    sortMinute: minute,
    place: placeOf(date, minute),
    title: entryTitle(plan, e),
    message: { cause, nextStep },
  };
}

/** Spalten-IDs, die ein Eintrag verwendet (Spaltenauswahl, Rapport-Anzeige, Beso-Zeitfenster). */
function usedColumnIds(e: Entry): readonly Id[] {
  switch (e.type) {
    case 'block':
    case 'querbalken':
      return e.columns.kind === 'ids' ? e.columns.ids : [];
    // Marker wirken über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026): keine fehlende Spalte (P1).
    case 'marker':
      return [];
    case 'rapport':
      return e.display !== 'rapColumn' && e.displayColumns.kind === 'ids'
        ? e.displayColumns.ids
        : [];
    case 'beso':
      return e.windows.map((w) => w.columnId).filter((c): c is Id => c !== null);
    default:
      return [];
  }
}

/** P1 (Fehler): Eintrag in einer Spalte, die es an diesem Tag nicht gibt (R-7-10; R-5.1-18, R-5.2-09). */
export function checkP1(plan: Plan): RawFinding[] {
  const out: RawFinding[] = [];
  for (const e of Object.values(plan.entries)) {
    const used = usedColumnIds(e);
    if (used.length === 0) continue;
    const dates = e.type === 'querbalken' ? querbalkenDays(e.fromDate, e.toDate) : [entryDate(e)];
    for (const date of dates) {
      if (date === null) continue;
      const week = weekOf(plan, date);
      if (week === null) continue;
      const present = new Set(columnsOn(plan, date).map((c) => c.id));
      const missing = [...new Set(used.filter((id) => !present.has(id)))].sort();
      if (missing.length === 0) continue;
      const names = missing.map((id) => columnName(plan, id));
      const known = names.filter((n): n is string => n !== null);
      const title = entryTitle(plan, e);
      const which =
        known.length === 0
          ? 'Die Spalte gibt es in keinem Spaltensatz mehr'
          : `${known.length === 1 ? 'Spalte' : 'Spalten'} ${known.join(', ')} ${known.length === 1 ? 'fehlt' : 'fehlen'} im Spaltensatz vom ${dayText(date)}`;
      out.push(
        finding(
          'P1',
          week.id,
          e,
          date,
          `${date}|${missing.join(',')}`,
          plan,
          `«${title}» liegt in einer Spalte, die es an diesem Tag nicht mehr gibt. ${which}.`,
          'Spalte wählen (S) oder den Spaltensatz des Tages anpassen.',
        ),
      );
      // Querbalken: ein Befund am ersten betroffenen Tag genügt.
      if (e.type === 'querbalken') break;
    }
  }
  return out;
}

/** P16 (Fehler): Eintrag an einem ausgeblendeten Tag (R-7-12). Querbalken und mehrtägige Bemerkungen ausgenommen. */
export function checkP16(plan: Plan): RawFinding[] {
  const out: RawFinding[] = [];
  for (const e of Object.values(plan.entries)) {
    if (e.type === 'querbalken' || e.type === 'multiDayRemark') continue;
    const d = dayOf(plan, e.date);
    if (d === null || d.day.display !== 'hidden') continue;
    out.push(
      finding(
        'P16',
        d.week.id,
        e,
        e.date,
        e.date,
        plan,
        `«${entryTitle(plan, e)}» liegt am ${dayText(e.date)}, der ausgeblendet ist. Im PDF erscheint der Eintrag nicht.`,
        'Tag wieder einblenden oder den Eintrag verschieben.',
      ),
    );
  }
  return out;
}

/**
 * P17 (Fehler): Beso ohne Nummer (R-7-13; F-14, F-64). Die Ursache nennt den vollen Nummernkreis nur, wenn alle
 * Nummern des Tages vergeben sind; sonst fehlt die Nummer trotz freier Nummern (z.B. aus einer Plan-Datei, HT-02).
 */
export function checkP17(plan: Plan): RawFinding[] {
  const out: RawFinding[] = [];
  const counts = new Map<IsoDate, number>();
  const taken = new Map<IsoDate, Set<number>>();
  for (const e of Object.values(plan.entries)) {
    if (e.type !== 'beso') continue;
    counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
    if (e.besoNumber !== null)
      taken.set(e.date, (taken.get(e.date) ?? new Set()).add(e.besoNumber));
  }
  for (const e of Object.values(plan.entries)) {
    if (e.type !== 'beso' || e.besoNumber !== null) continue;
    const week = weekOf(plan, e.date);
    if (week === null) continue;
    const range = numberRange(weekdayOf(e.date));
    const n = counts.get(e.date) ?? 0;
    const used = taken.get(e.date) ?? new Set<number>();
    let free = 0;
    for (let k = range.min; k <= range.max; k++) if (!used.has(k)) free += 1;
    const span = `${String(range.min)}–${String(range.max)}`;
    const title = entryTitle(plan, e);
    out.push(
      free === 0
        ? finding(
            'P17',
            week.id,
            e,
            e.date,
            e.date,
            plan,
            `Am ${dayText(e.date)} sind ${String(n)} Beso erfasst; der Nummernkreis ${span} ist voll. «${title}» hat keine Nummer («–»).`,
            'Beso zusammenlegen, auf einen anderen Tag verschieben oder als Block erfassen.',
          )
        : finding(
            'P17',
            week.id,
            e,
            e.date,
            e.date,
            plan,
            `«${title}» hat keine Nummer («–»), obwohl im Nummernkreis ${span} am ${dayText(e.date)} noch ${String(free)} ${free === 1 ? 'Nummer' : 'Nummern'} frei ${free === 1 ? 'ist' : 'sind'}.`,
            `Den ${dayText(e.date)} neu nummerieren («Tag neu nummerieren …» am Tageskopf oder am Beso); der Beso erhält dann eine freie Nummer.`,
          ),
    );
  }
  return out;
}

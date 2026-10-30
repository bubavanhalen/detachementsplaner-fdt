// F-DOKU: fiktive Pläne für den Beleg R-6-39 (interne Notizen beim Sichern). Ohne Layout-Schicht, damit der Node-
// Lader von Playwright sie laden kann. Nur fiktive Daten.

import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { setDayNote } from '../../../../src/model/wap/commands/settings';
import type { Plan } from '../../../../src/model/wap/types';
import { block, CTX, kpPlan } from '../../../wap/support/i5/plan';

function named(plan: Plan, id: string, name: string): Plan {
  return { ...plan, id, exerciseName: name, service: 'FDT 2099' };
}

/** Block mit interner Notiz am Eintrag. */
export function planNotizEintrag(): Plan {
  const b = block(kpPlan(1), 'Wache Süd');
  const plan = updateEntry(b.plan, b.id, 'block', { internalNote: 'Fiktive Notiz' }, CTX).plan;
  return named(plan, 'fdoku-notiz-eintrag', 'Notiz Eintrag Übungsplan');
}

/** Block ohne Notiz, interne Notiz nur am Dienstag. */
export function planNotizTag(): Plan {
  const b = block(kpPlan(1), 'Wache Nord');
  const week = b.plan.weeks[0];
  if (week === undefined) throw new Error('Woche fehlt');
  const plan = setDayNote(b.plan, week.id, 'Di', 'Fiktive Tagesnotiz', CTX).plan;
  return named(plan, 'fdoku-notiz-tag', 'Notiz Tag Übungsplan');
}

/** Block ohne jede Notiz. */
export function planOhneNotiz(): Plan {
  return named(block(kpPlan(1), 'Wache West').plan, 'fdoku-ohne-notiz', 'Ohne Notiz Übungsplan');
}

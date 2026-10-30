// F-FIX Runde 2 (FD-02, R-4.6-61; übernommen aus F-DOKU): fiktiver Plan mit verknüpften Teilblöcken.
// Ohne Layout-Schicht, damit der Node-Lader von Playwright ihn laden kann. Nur fiktive Daten.
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';

function named(plan: Plan, id: string, name: string): Plan {
  return { ...plan, id, exerciseName: name, service: 'FDT 2099' };
}

/** Block «Doppelposten» Mo 0800-1000 in «Kp Kdt» und «Zfhr» (nicht benachbart: verknüpfte Teilblöcke, R-4.6-60). */
export function planTeilbloecke(): Plan {
  let plan = kpPlan(1);
  const planning = (plan.columnSets[0]?.columns ?? []).filter((c) => c.kind === 'planning');
  const [a, , c] = planning;
  if (a === undefined || c === undefined) throw new Error('Spalten fehlen');
  plan = add(plan, {
    type: 'block',
    date: MO,
    time: { form: 'range', from: 480, to: 600 },
    columns: { kind: 'ids', ids: [a.id, c.id] },
    title: [{ text: 'Doppelposten', bold: true }],
  }).plan;
  return named(plan, 'ffix-teilbloecke', 'Teilblöcke Übungsplan');
}

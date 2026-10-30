// F-UX1: fiktive Pläne für die Abläufe «PDF dieser Woche mit Befunden» und «Stand nicht rückgängig» (Entscheide
// des Auftraggebers vom 19.10.2026 «6: ja», «Stand: ja»). Ohne Layout-Schicht (Node-Lader von Playwright).
// Nur fiktive Daten.
import type { Plan } from '../../../../src/model/wap/types';
import { block, kpPlan } from '../../../wap/support/i5/plan';

/** Eine Woche (KVK); Block «Fremdspalte» am Mo in einer Spalte des Satzes «KVK Mi–Fr» (gibt es am Mo nicht: P1). */
export function planP1(): Plan {
  const base = kpPlan(1);
  const foreign = base.columnSets[1]?.columns.find((c) => c.kind === 'planning')?.id;
  if (foreign === undefined) throw new Error('Spaltensatz «KVK Mi–Fr» fehlt');
  const plan = block(base, 'Fremdspalte', { columns: { kind: 'ids', ids: [foreign] } }).plan;
  return { ...plan, id: 'fux1-e2e-p1', exerciseName: 'P1 Übungsplan', service: 'FDT 2099' };
}

/** Eine Woche ohne Befund mit drei Blöcken am Mo und Di (Spaltensatz «KVK Stufen»). */
export function planOhneBefund(): Plan {
  let plan = kpPlan(1);
  plan = block(plan, 'Ausbildung Nord').plan;
  plan = block(plan, 'Ausbildung Ost', { date: '2026-09-29' }).plan;
  plan = block(plan, 'Ausbildung Süd', {
    date: '2026-09-29',
    time: { form: 'range', from: 780, to: 900 },
  }).plan;
  return { ...plan, id: 'fux1-e2e-stand', exerciseName: 'Stand Übungsplan', service: 'FDT 2099' };
}

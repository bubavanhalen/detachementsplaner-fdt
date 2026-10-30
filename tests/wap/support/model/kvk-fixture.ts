// Lädt die pseudonymisierte KVK-Fixture (Vertrag E1-02a Abschnitt 6). Reine Daten im Format `Plan`.
import type { Plan } from '../../../../src/model/wap/types';
import kvk from '../../fixtures/durchstich/kvk.plan.json';

/** Frische tiefe Kopie je Aufruf, damit kein Test die Daten eines anderen verändert. */
export function loadKvkPlan(): Plan {
  return JSON.parse(JSON.stringify(kvk)) as Plan;
}

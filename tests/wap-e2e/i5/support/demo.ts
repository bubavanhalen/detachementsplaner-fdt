// I5: Demopläne wie I3 (pseudonymisierte KVK-Daten, fiktive FDT-Wochen, Belastungstest) mit eigenen Kennungen.
import type { Plan } from '../../../../src/model/wap/types';
import { createI3DemoPlans } from '../../i3/support/demo';

export function createI5DemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI3DemoPlans();
  if (realistic === undefined || stress === undefined) return createI3DemoPlans();
  return [
    { ...realistic, id: 'i5-demo-realistisch' },
    { ...stress, id: 'i5-demo-belastung' },
  ];
}

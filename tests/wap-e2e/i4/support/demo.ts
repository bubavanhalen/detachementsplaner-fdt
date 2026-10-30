// I4: Demopläne wie I2b/I2c (pseudonymisierte KVK-Daten, fiktive FDT-Wochen), mit eigenen Kennungen, damit der
// Zwischenstand I4 neben früheren Zwischenständen im selben lokalen Speicher liegen kann.
import type { Plan } from '../../../../src/model/wap/types';
import { createI2bDemoPlans } from '../../i2b/support/demo';

export function createI4DemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI2bDemoPlans();
  if (realistic === undefined || stress === undefined) return createI2bDemoPlans();
  return [
    { ...realistic, id: 'i4-demo-realistisch' },
    { ...stress, id: 'i4-demo-belastung' },
  ];
}

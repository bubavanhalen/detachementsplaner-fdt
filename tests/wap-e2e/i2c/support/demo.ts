// I2b-B: Demopläne wie I2b-A (pseudonymisierte KVK-Daten, fiktive FDT-Wochen und Einträge aller Typen), mit
// eigenen Kennungen, damit der Zwischenstand I2c neben I2b im selben lokalen Speicher liegen kann.
import type { Plan } from '../../../../src/model/wap/types';
import { createI2bDemoPlans } from '../../i2b/support/demo';

export function createI2cDemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI2bDemoPlans();
  if (realistic === undefined || stress === undefined) return createI2bDemoPlans();
  return [
    { ...realistic, id: 'i2c-demo-realistisch' },
    { ...stress, id: 'i2c-demo-belastung' },
  ];
}

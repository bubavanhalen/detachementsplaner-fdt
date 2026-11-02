// I3: Demopläne wie I2b/I2c (pseudonymisierte KVK-Daten, fiktive FDT-Wochen, Einträge aller Typen) mit eigenen
// Kennungen und einer fiktiven Personenliste für die Auswahl von Ltg und Tn.
import type { Plan } from '../../../../src/model/wap/types';
import { createI2bDemoPlans } from '../../i2b/support/demo';

const PERSONEN = [
  { id: 'r9001', grad: 'Hptm', name: 'Muster', vorname: 'Anna', funktion: 'Kp Kdt' },
  { id: 'r9002', grad: 'Lt', name: 'Beispiel', vorname: 'Ben', funktion: 'Zfhr' },
  { id: 'r9003', grad: 'Wm', name: 'Probe', vorname: 'Cla', funktion: 'Einh Fw' },
] as const;

export function createI3DemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI2bDemoPlans();
  if (realistic === undefined || stress === undefined) return createI2bDemoPlans();
  return [
    { ...realistic, id: 'i3-demo-realistisch', persons: [...realistic.persons, ...PERSONEN] },
    { ...stress, id: 'i3-demo-belastung' },
  ];
}

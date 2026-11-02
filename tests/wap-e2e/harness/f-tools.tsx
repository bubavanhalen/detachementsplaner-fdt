// Paket F-TOOLS: Einstieg der Bildschirm-Golden-Kernzustände (R-H-21, R-H-20; ADR-010 §7.3). Die Anwendung mit
// zwei Demoplänen: «Realistisch» = pseudonymisierte KVK-Fixture (E1-02a), «Belastungstest» = synthetischer Plan
// mit festem Startwert (E1-02a). Nur fiktive bzw. pseudonymisierte Daten; kein Testcode im Produkt.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import type { Plan } from '../../../src/model/wap/types';
import { loadKvkPlan } from '../../wap/support/model/kvk-fixture';
import { syntheticPlan } from '../../wap/support/synthetic-plan';

const demoPlans: readonly Plan[] = [
  { ...loadKvkPlan(), id: 'f-tools-demo-realistisch' },
  { ...syntheticPlan(), id: 'f-tools-demo-belastung' },
];

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<I2Application demoPlans={demoPlans} />);

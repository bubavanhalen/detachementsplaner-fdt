// Leistungseinträge F-DOKU (Beschrieb 11; R-11-11; Befund HT-08, Entscheid «Hauptthread-Zeit je Bild aus der
// Ablaufverfolgung + keine Aufgabe > 50 ms»): Raster der ersten Woche des synthetischen Plans (4 Wochen, 1000 Einträge,
// tests/wap/support/synthetic-plan.ts) für das Ziehen. Die Messung selbst (Ablaufverfolgung über CDP) macht der Test
// tests/wap-perf/f-doku/ziehen.perf.ts; run() misst nichts. Nur fiktive Daten.
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { I2GridEditor } from '../../../../src/components/wap/i2/GridEditor';
import { syntheticPlan } from '../../../wap/support/synthetic-plan';
import { registerPerfEntries } from '../harness';

registerPerfEntries([
  {
    name: 'fDokuZiehenBildzeit',
    anforderung: 'R-11-11',
    budgetMs: 16.7,
    async prepare(seed) {
      const plan = syntheticPlan(seed);
      document.querySelector('#wap-perf-ziehen')?.remove();
      const host = document.createElement('div');
      host.id = 'wap-perf-ziehen';
      host.style.cssText = 'width:1600px;height:1000px;position:relative';
      document.body.append(host);
      const root = createRoot(host);
      flushSync(() =>
        root.render(
          createElement(I2GridEditor, {
            plan,
            weekId: plan.weeks[0]?.id ?? '',
            readOnly: false,
            onCommand: async () => {},
          }),
        ),
      );
      return null;
    },
    async run() {},
  },
]);

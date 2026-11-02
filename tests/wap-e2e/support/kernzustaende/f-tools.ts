// Paket F-TOOLS: Bildschirm-Golden-Kernzustände (R-H-21 Registry, R-H-20; Prompt §7 «Bildschirm-Regression der
// Kernzustände», ADR-010 §7.3; Vertrag E1-01c §2.2). Daten: pseudonymisierte KVK-Fixture und synthetischer Plan
// (tests/wap-e2e/harness/f-tools.tsx). Baselines entstehen mit dem Baseline-Befehl des Orchestrators
// (node scripts/wap-gate/e2e.mjs --project chromium-visual --baselines F-TOOLS) nach visual-qa; Status
// «vorläufig» bis zur Freigabe des Auftraggebers an Gate B.
import { expect, type Page } from '@playwright/test';
import type { Kernzustand } from '../kernzustand';

const EINSTIEG = '/tests/wap-e2e/harness/f-tools.html';

async function raster(page: Page): Promise<void> {
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
}

export const kernzustaende: readonly Kernzustand[] = [
  {
    id: 'f-tools-kvk-woche',
    paket: 'F-TOOLS',
    beschreibung: 'Standardansicht: KVK-Woche (pseudonymisierte Fixture) im Wochenraster',
    async herstellen(page) {
      await page.goto(EINSTIEG);
      await raster(page);
    },
  },
  {
    id: 'f-tools-belastung-woche',
    paket: 'F-TOOLS',
    beschreibung:
      'Belastungstest: erste Woche des synthetischen Plans (Startwert 20260928) im Wochenraster',
    async herstellen(page) {
      await page.goto(EINSTIEG);
      await raster(page);
      await page
        .getByRole('combobox', { name: 'Demoplan', exact: true })
        .selectOption({ label: 'Belastungstest' });
      await raster(page);
    },
  },
];

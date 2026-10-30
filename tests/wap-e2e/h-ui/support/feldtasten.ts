// H-UI, Befund UX-H-13 (ux-critic Härtung Runde 1; Entscheid Orchestrator 14.10.2026): Im frisch mit E geöffneten,
// ganz markierten Titel des Seitenfelds sind Buchstaben Text (sie überschreiben den Titel); Feldsprünge im Seitenfeld
// nur mit Tab bzw. Alt+Buchstabe (Z, T, S, K, L, O). Die Kürzelübersicht nennt das so. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { block, kpPlan } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planEins() {
  const plan = block(kpPlan(1), 'Alpha').plan;
  return { ...plan, id: 'hui-e2e-feldtasten', exerciseName: 'Feldtasten Übungsplan' };
}

function panel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Seitenfeld', exact: true });
}

export function registerFeldtastenTests(url: () => string): void {
  test('[R-5.1-12][R-11-07] H-UI UX-H-13: nach E sind Buchstaben Text im Titel; Alt+Z/T/S/K/L/O springen zum Feld; Kürzelübersicht nennt es', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'feldtasten.wap.json', planFile(planEins()));
    await wapPage.getByRole('button', { name: /^Block Alpha / }).click();
    await wapPage.keyboard.press('e');
    const title = panel(wapPage).getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    // Buchstaben sind Text: der markierte Titel wird überschrieben.
    await wapPage.keyboard.type('Zug');
    await expect(title).toHaveValue('Zug');
    // Alt+Buchstabe springt zum Feld (und übernimmt den Titel beim Verlassen).
    await wapPage.keyboard.press('Alt+z');
    await expect(panel(wapPage).getByRole('textbox', { name: 'Zeit', exact: true })).toBeFocused();
    await expect(wapPage.getByRole('button', { name: /^Block Zug / })).toBeVisible();
    await wapPage.keyboard.press('Alt+o');
    await expect(panel(wapPage).getByRole('textbox', { name: 'Ort', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Alt+l');
    await expect(panel(wapPage).getByRole('combobox', { name: 'Ltg', exact: true })).toBeFocused();
    // Alt+Buchstabe tippt kein Zeichen.
    await expect(panel(wapPage).getByRole('combobox', { name: 'Ltg', exact: true })).toHaveValue(
      '',
    );
    // Kürzelübersicht.
    await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
    await expect(dialog).toContainText('Alt+Z / T / S / K / L / O im Seitenfeld');
    await expect(dialog).toContainText('Buchstaben sind Text');
  });
}

// H-UI, Befund UX-H-01 (ux-critic Härtung Runde 1; UI-Richtlinie 6 «Übernahme»; Beschrieb 5.6, Prompt §6): Eine
// Feldänderung im Seitenfeld wird bei Tab, Fokusverlust und Auswahlwechsel übernommen (ein Undo-Schritt, sofort
// gespeichert); ein ungültiger Wert bleibt sichtbar markiert und wird nie still verworfen oder einem anderen Eintrag
// zugeschrieben. Abläufe über Rolle und Name. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { block, column, kpPlan } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planZweiBloecke() {
  let plan = block(kpPlan(1), 'Alpha').plan;
  plan = block(plan, 'Bravo', { columns: { kind: 'ids', ids: [column(plan, 2).id] } }).plan;
  return { ...plan, id: 'hui-e2e-seitenfeld', exerciseName: 'Seitenfeld Übungsplan' };
}

function blockNamed(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

function panelTitle(page: Page): Locator {
  return page
    .getByRole('complementary', { name: 'Seitenfeld', exact: true })
    .getByRole('textbox', { name: 'Titel', exact: true });
}

async function openTitle(page: Page, title: string): Promise<void> {
  await blockNamed(page, title).click();
  await page.keyboard.press('e');
  await expect(panelTitle(page)).toBeFocused();
}

export function registerSeitenfeldTests(url: () => string): void {
  test('[R-5.1-12][R-5.6-01] H-UI UX-H-01: Titel im Seitenfeld, Tab, anderer Block: die Änderung ist übernommen, ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'seitenfeld.wap.json', planFile(planZweiBloecke()));
    await openTitle(wapPage, 'Alpha');
    await wapPage.keyboard.type('Alpha geändert');
    await wapPage.keyboard.press('Tab');
    await blockNamed(wapPage, 'Bravo').click();
    await expect(blockNamed(wapPage, 'Alpha geändert')).toBeVisible();
    await expect(panelTitle(wapPage)).toHaveValue('Bravo');
    await blockNamed(wapPage, 'Alpha geändert').click();
    await expect(panelTitle(wapPage)).toHaveValue('Alpha geändert');
    // Ein Undo-Schritt stellt den alten Titel her.
    await wapPage.getByRole('button', { name: /^Rückgängig/ }).click();
    await expect(blockNamed(wapPage, 'Alpha')).toBeVisible();
    await expect(blockNamed(wapPage, 'Alpha geändert')).toHaveCount(0);
  });

  test('[R-5.1-12][R-5.6-01] H-UI UX-H-01: Titel im Seitenfeld, direkt anderer Block (ohne Tab): übernommen; der andere Block behält seinen Titel', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'seitenfeld.wap.json', planFile(planZweiBloecke()));
    await openTitle(wapPage, 'Alpha');
    await wapPage.keyboard.type('Alpha Nord');
    await blockNamed(wapPage, 'Bravo').click();
    await expect(blockNamed(wapPage, 'Alpha Nord')).toBeVisible();
    await expect(blockNamed(wapPage, 'Bravo')).toBeVisible();
    await expect(panelTitle(wapPage)).toHaveValue('Bravo');
    // Zusatz: Fokusverlust ins Raster übernimmt ebenfalls.
    const zusatz = wapPage
      .getByRole('complementary', { name: 'Seitenfeld', exact: true })
      .getByRole('textbox', { name: 'Zusatz', exact: true });
    await zusatz.fill('mit Ablösung');
    await blockNamed(wapPage, 'Alpha Nord').click();
    await blockNamed(wapPage, 'Bravo').click();
    await expect(zusatz).toHaveValue('mit Ablösung');
  });

  test('[R-5.1-12][R-5.7-03] H-UI UX-H-01: ungültiger Titel im Seitenfeld bleibt markiert; beim Auswahlwechsel sichtbare Meldung, nichts still verworfen oder dem anderen Block zugeschrieben', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'seitenfeld.wap.json', planFile(planZweiBloecke()));
    await openTitle(wapPage, 'Alpha');
    await wapPage.keyboard.type('Alpha ✓');
    await wapPage.keyboard.press('Tab');
    await expect(panelTitle(wapPage)).toHaveAttribute('aria-invalid', 'true');
    await blockNamed(wapPage, 'Bravo').click();
    await expect(panelTitle(wapPage)).toHaveValue('Bravo');
    await expect(blockNamed(wapPage, 'Alpha')).toBeVisible();
    await expect(blockNamed(wapPage, 'Bravo')).toBeVisible();
    const alert = wapPage
      .getByRole('complementary', { name: 'Seitenfeld', exact: true })
      .getByRole('alert');
    await expect(alert).toContainText('«Titel» von «Alpha» nicht übernommen');
    await expect(alert).toContainText('Ein Zeichen kann im PDF nicht dargestellt werden');
  });
}

// H-TESTS (Härtung, SA-H-12): Sprung aus dem Importbericht zur Stelle in einer anderen Woche – Woche gewechselt,
// Stelle im Raster sichtbar und nicht vom Bericht verdeckt, Eintrag gewählt; der Bericht bleibt offen (Beschrieb 8.2
// Regel 8; R-8.2-21; UI-Richtlinie 2.2 «Sprünge aus Befundliste oder Importbericht lassen den Tab offen», SA-08;
// Test-Einwand TE-HUI2-02). Fiktive Arbeitsmappe aus dem Testbaukasten, lokal über die Dateiauswahl gelesen.
import { expect, type Page } from '@playwright/test';
import { block, bold, buildKpWorkbook, emptyWeek } from '../../wap/fixtures/import/kp-workbook';
import { activateButton } from '../i2/support/ablauf';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';

/** Zwei Wochen; nur in Woche 2 liegt am Fr spät eine Form in der Beso-Spalte (Bericht «Nebenspalte angelegt»). */
function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [block(0, [0, 2], '0800', '1000', [[bold('Ausbildung Woche eins')]])],
      }),
      emptyWeek({
        sheet: 'Wo 2',
        title: 'Inf Fik Kp 99/9 Arbeitsplan Woche 2',
        monday: '2099-10-12',
        shapes: [
          block(1, [0, 1], '0800', '0900', [[bold('Ausbildung Woche zwei')]]),
          block(4, [4, 4], '2000', '2200', [[bold('Nachtwache Det')]]),
        ],
      }),
    ]),
  );
}

async function importWorkbook(page: Page): Promise<void> {
  await page.goto(URL);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Excel-WAP importieren', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type="file"][aria-label="Excel-WAP importieren"]').setInputFiles({
    name: 'fiktiv-zwei-wochen.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
}

/** Liegt die Mitte des Elements im sichtbaren Bereich des Rasters? */
async function imSichtbarenRaster(page: Page, name: RegExp): Promise<boolean> {
  return page.getByRole('button', { name }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const scroller = el.closest('.i2-grid-scroll') ?? document.documentElement;
    const s = scroller.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + Math.min(r.height, 20) / 2;
    return (
      cx >= Math.max(0, s.left) &&
      cx <= Math.min(innerWidth, s.right) &&
      cy >= Math.max(0, s.top) &&
      cy <= Math.min(innerHeight, s.bottom)
    );
  });
}

/** Liegt an der Mitte des Elements kein anderes Element darüber (z.B. der offene Bericht)? */
async function nichtVerdeckt(page: Page, name: RegExp): Promise<boolean> {
  return page.getByRole('button', { name }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height, 20) / 2);
    return hit !== null && el.contains(hit);
  });
}

test('[R-8.2-21] Klick auf einen Berichtseintrag der anderen Woche: Woche gewechselt, Stelle im Raster sichtbar und nicht verdeckt, Eintrag gewählt; der Bericht bleibt offen', async ({
  wapPage,
}) => {
  await importWorkbook(wapPage);
  const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-zwei-wochen.xlsx»' });
  await expect(report).toBeVisible();
  // Vor dem Sprung ist Woche 1 gewählt.
  await activateButton(report.getByRole('button', { name: 'Dialog schliessen' }));
  const tab1 = wapPage.getByRole('tab', { name: /^Wo ?1$/ });
  const tab2 = wapPage.getByRole('tab', { name: /^Wo ?2$/ });
  await tab1.click();
  await expect(tab1).toHaveAttribute('aria-selected', 'true');
  await expect(wapPage.getByRole('button', { name: /^Block Nachtwache Det / })).toHaveCount(0);
  await activateButton(wapPage.getByRole('button', { name: 'Importbericht', exact: true }));
  await expect(report).toBeVisible();
  const sprung = report.getByRole('button', { name: /^Zur Stelle: Nebenspalte angelegt/ });
  await expect(sprung).toHaveCount(1);
  await sprung.click();
  // UI-Richtlinie 2.2: der Sprung lässt den Bericht offen (SA-08: keine Rückkehr nötig).
  await expect(report).toBeVisible();
  await expect(tab2).toHaveAttribute('aria-selected', 'true');
  const ziel = wapPage.getByRole('button', { name: /^Block Nachtwache Det / });
  await expect(ziel).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => imSichtbarenRaster(wapPage, /^Block Nachtwache Det /)).toBe(true);
  await expect.poll(() => nichtVerdeckt(wapPage, /^Block Nachtwache Det /)).toBe(true);
});

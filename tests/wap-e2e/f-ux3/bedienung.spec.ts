// F-UX3 Punkt 4 (Nacharbeit SA-34 Schlussbericht, lokal .qa/e1-ab/sa34-final.md): UX-AB-F-01 – bei offenem
// Importbericht bleibt der Fokus nach einem Wochenwechsel aus der Liste in der Zelle, Tippen ersetzt den Inhalt;
// UX-AB-F-04 – Esc schliesst das Aufklappfeld «Spalten …». Nur im Entwicklungsserver (Import mit Worker); fiktive
// Arbeitsmappe.
import { expect, type Page } from '@playwright/test';
import { block, bold, buildKpWorkbook, emptyWeek } from '../../wap/fixtures/import/kp-workbook';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';

function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({ shapes: [block(0, [0, 0], '0800', '0900', [[bold('Antreten Eins')]])] }),
      emptyWeek({
        sheet: 'Wo 2',
        title: 'Inf Fik Kp 99/9 Arbeitsplan Woche 2',
        monday: '2099-10-12',
        shapes: [block(1, [0, 0], '1000', '1100', [[bold('Theorie Zwei')]])],
      }),
    ]),
  );
}

async function importieren(page: Page): Promise<void> {
  await page.goto(URL);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Excel-WAP importieren', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type="file"][aria-label="Excel-WAP importieren"]').setInputFiles({
    name: 'fiktiv-ux3.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
  await expect(page.getByRole('dialog', { name: 'Importbericht «fiktiv-ux3.xlsx»' })).toBeVisible();
}

test('[R-6-15][R-11-07] F-UX3 UX-AB-F-01: offener Importbericht – Klick auf eine Zelle einer anderen Woche lässt den Fokus in der Zelle, Tippen ersetzt den Inhalt', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
  const grid = wapPage.getByRole('grid', { name: /^Einträge / });
  await wapPage.getByRole('radio', { name: 'Ganzer Plan' }).check();
  const headers = (await grid.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
  const zelle = grid
    .locator('tbody tr')
    .filter({ hasText: 'Theorie Zwei' })
    .getByRole('gridcell')
    .nth(headers.indexOf('Titel'));
  await zelle.click();
  await wapPage.waitForTimeout(1200);
  await expect(zelle).toBeFocused();
  await wapPage.keyboard.type('Neu');
  await expect(grid.getByRole('textbox', { name: 'Titel', exact: true })).toHaveValue('Neu');
  await wapPage.keyboard.press('Escape');
});

test('[R-6-13] F-UX3 UX-AB-F-04: Esc schliesst das Aufklappfeld «Spalten …» der Liste (auf dem Knopf und im Feld)', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
  const knopf = wapPage.getByRole('button', { name: 'Spalten …', exact: true });
  await knopf.click();
  const feld = wapPage.getByRole('checkbox', { name: 'Teilaufgaben' });
  await expect(feld).toBeVisible();
  await knopf.press('Escape');
  await expect(feld).toBeHidden();
  await knopf.click();
  await feld.focus();
  await wapPage.keyboard.press('Escape');
  await expect(feld).toBeHidden();
  await expect(knopf).toBeFocused();
});

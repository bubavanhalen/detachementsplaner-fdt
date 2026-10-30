// H-UI2, Befund UX-H-10 (UI-Richtlinie 2.2 «Sprünge aus … Importbericht lassen den Tab offen», 9 «Bedienung wie
// Befundliste», 13.4; R-8.2-21): «Zur Stelle» mit der Maus oder der Leertaste lässt den Importbericht offen, wählt den
// Eintrag im Raster und hakt die Meldung als «angesehen» ab; Enter springt und setzt den Fokus auf den Eintrag (der
// Bericht schliesst). Wieder geöffnet, steht der Fokus auf der nächsten Meldung. Nur im Entwicklungsserver (Excel-Import
// mit Worker); fiktive Arbeitsmappe aus dem Testbaukasten.
import { expect, type Page } from '@playwright/test';
import {
  besoBox,
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  normal,
} from '../../wap/fixtures/import/kp-workbook';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';

function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [
          block(1, [0, 0], '0802', '1000', [[bold('Ausbildung Alpha')], [normal('Zfhr (Wiese)')]]),
          block(2, [4, 4], '0800', '1200', [[bold('Munition Det')]]),
          block(3, [1, 1], '1300', '1500', [[bold('Fahrschule Bravo')]]),
          besoBox(0, 4, '0800', 10),
        ],
        agenda: [
          { day: 0, paragraphs: [[normal('10 0830-0900: Kontrolle Fahrzeuge, Ltg: Einh Fw.')]] },
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
    name: 'fiktiv-wap.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
}

test('[R-11-07] H-UI2 UX-H-10: «Zur Stelle» mit Maus oder Leertaste lässt den Importbericht offen und wählt den Eintrag; Enter springt mit Fokus; wieder geöffnet steht der Fokus auf der nächsten Meldung', async ({
  wapPage,
}) => {
  await importWorkbook(wapPage);
  const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-wap.xlsx»' });
  await expect(report).toBeVisible();
  const jumps = report.getByRole('button', { name: /^Zur Stelle: / });
  expect(await jumps.count()).toBeGreaterThan(1);
  // Maus: Bericht bleibt offen, der Eintrag ist gewählt, die Meldung «angesehen».
  const first = jumps.first();
  await first.click();
  await expect(report).toBeVisible();
  await expect(first).toBeFocused();
  await expect(wapPage.locator('.i2-grid-entry.is-selected')).toHaveCount(1);
  await expect(report.getByText('angesehen').first()).toBeVisible();
  // Leertaste auf der zweiten Meldung: ebenso, der Fokus bleibt im Bericht.
  const second = jumps.nth(1);
  await second.focus();
  await wapPage.keyboard.press(' ');
  await expect(report).toBeVisible();
  await expect(second).toBeFocused();
  await expect(report.getByText('angesehen')).toHaveCount(2);
  // Enter: springt und setzt den Fokus auf den Eintrag; der Bericht schliesst.
  await wapPage.keyboard.press('Enter');
  await expect(report).not.toBeVisible();
  await expect
    .poll(() => wapPage.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''))
    .toMatch(/^(Block|Beso|Rapport) /);
  // Wieder öffnen: Fokus auf der nächsten Meldung, die angesehenen bleiben abgehakt.
  await wapPage.getByRole('button', { name: 'Importbericht', exact: true }).click();
  await expect(report).toBeVisible();
  if ((await jumps.count()) > 2) await expect(jumps.nth(2)).toBeFocused();
  await expect(report.getByText('angesehen')).toHaveCount(2);
});

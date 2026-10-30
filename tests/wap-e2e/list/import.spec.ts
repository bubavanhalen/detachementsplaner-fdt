// I4 (E1-08, E1-15): Excel-WAP importieren im Erststart, Importbericht mit Sprung, Nacharbeit in der Liste,
// Rückgängig des Imports (Beschrieb 5.7, 8.2 Regel 8–10, 6 «Listenansicht»). Fiktive Arbeitsmappe aus dem
// Testbaukasten; die Datei wird über die Dateiauswahl lokal gelesen.
import { expect, type Page } from '@playwright/test';
import {
  besoBox,
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  normal,
} from '../../wap/fixtures/import/kp-workbook';
import { activateButton } from '../i2/support/ablauf';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';

function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [
          block(0, [0, 2], '0900', '1700', [
            [bold('Fassen Material')],
            [normal('Four')],
            [],
            [bold('Fassen Fahrzeuge')],
            [normal('Lt Fiktiv (Halle)')],
          ]),
          block(1, [0, 0], '0802', '1000', [[bold('Ausbildung Alpha')], [normal('Zfhr (Wiese)')]]),
          block(2, [4, 4], '0800', '1200', [[bold('Munition Det')]]),
          besoBox(0, 4, '0800', 10),
        ],
        agenda: [
          { day: 0, paragraphs: [[normal('10 0830-0900: Kontrolle Fahrzeuge, Ltg: Einh Fw.')]] },
        ],
        remarks: ['Fiktive Bemerkung'],
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

test.describe('Excel-WAP importieren', () => {
  test('[R-5.6-05][R-8.2-20] Erststart: Import, Bericht mit Bilanz und Sprung zur Stelle, Undo des Imports', async ({
    wapPage,
    a11y,
  }) => {
    await importWorkbook(wapPage);
    const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-wap.xlsx»' });
    await expect(report).toBeVisible();
    expect((await a11y(report)).verstoesse.map((v) => v.id)).toEqual([]);
    const balance = report.getByRole('table', { name: 'Formen je Blatt' });
    const cells = await balance.locator('tbody tr').first().locator('td').allInnerTexts();
    const [, gelesen, zugeordnet, nicht] = cells.map((c) => Number(c));
    expect(gelesen).toBe((zugeordnet ?? 0) + (nicht ?? 0));
    // Nebenspalte «Det» für die Form in der Beso-Spalte; Sprung zum Block.
    await expect(report.getByRole('heading', { name: /Nebenspalte angelegt/ })).toBeVisible();
    await activateButton(report.getByRole('button', { name: /^Zur Stelle: Nebenspalte angelegt/ }));
    await expect(report).not.toBeVisible();
    await expect(wapPage.getByRole('button', { name: /^Block Munition Det / })).toBeFocused();
    // Bericht wieder öffnen, schliessen; dann den Import rückgängig machen.
    await activateButton(wapPage.getByRole('button', { name: 'Importbericht', exact: true }));
    await expect(report).toBeVisible();
    await activateButton(report.getByRole('button', { name: 'Dialog schliessen' }));
    await wapPage
      .getByRole('table', { name: 'Wochenraster', exact: true })
      .click({ position: { x: 5, y: 5 } });
    await wapPage.keyboard.press('Control+z');
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: 'Importbericht', exact: true })).toHaveCount(
      0,
    );
  });

  test('[R-6-42][R-6-13] Nacharbeit in der Liste: Teilaufgaben einblenden, importierte Einträge genau einmal', async ({
    wapPage,
  }) => {
    await importWorkbook(wapPage);
    const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-wap.xlsx»' });
    await activateButton(report.getByRole('button', { name: 'Dialog schliessen' }));
    await activateButton(wapPage.getByRole('button', { name: 'Liste', exact: true }));
    const grid = wapPage.getByRole('grid', { name: 'Einträge Wo1' });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('columnheader', { name: 'Teilaufgaben' })).toHaveCount(0);
    await activateButton(wapPage.getByRole('button', { name: 'Spalten …' }));
    await wapPage.getByRole('checkbox', { name: 'Teilaufgaben' }).check();
    const row = grid.locator('tbody').getByRole('row').filter({ hasText: 'Fassen Material' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Fassen Fahrzeuge – Lt Fiktiv (Halle)');
    const titles = await grid.locator('tbody tr').allInnerTexts();
    expect(titles.filter((t) => t.includes('Ausbildung Alpha'))).toHaveLength(1);
    expect(titles.filter((t) => t.includes('Kontrolle Fahrzeuge'))).toHaveLength(1);
  });
});

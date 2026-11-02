// F-UX2 Runde 7 mit Excel-Import (Nacharbeit SA-34; UI-Richtlinie 2.2, 9; Beschrieb 8.2 Regel 12): «Zur Stelle» bei
// einer verdeckten Form zeigt einen Geist an der Originallage mit ihrem Text (UX-AB-07); Seitenfeld und Importbericht
// stehen untereinander, keiner verdeckt den anderen (UX-AB-11); die Personenliste des geöffneten Plans gilt für die
// Zerlegung (Name in Klammern → Ltg). Nur im Entwicklungsserver (Import mit Worker); fiktive Arbeitsmappe und Daten.
import { expect, type Page } from '@playwright/test';
import {
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  normal,
} from '../../wap/fixtures/import/kp-workbook';
import { kpPlan } from '../../wap/support/i5/plan';
import { openPlanFile } from '../i5/support/ablauf';
import { planFile } from '../i5/support/plaene';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';

function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [
          // «Verdeckt fiktiv» liegt ganz unter «Decke Bravo» (spätere Form oben).
          block(2, [1, 1], '0800', '0900', [[bold('Verdeckt fiktiv')]]),
          block(2, [1, 1], '0730', '0930', [[bold('Decke Bravo')]]),
          block(0, [0, 0], '1000', '1100', [[bold('Ausbildung Alpha')], [normal('(Beispiel)')]]),
        ],
      }),
    ]),
  );
}

async function importWorkbook(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: 'Excel-WAP importieren', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type="file"][aria-label="Excel-WAP importieren"]').setInputFiles({
    name: 'fiktiv-r7.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
  await expect(page.getByRole('dialog', { name: 'Importbericht «fiktiv-r7.xlsx»' })).toBeVisible();
}

test('[R-8.2-21] F-UX2 UX-AB-07: «Zur Stelle» bei einer verdeckten Form zeigt den Geist an der Originallage mit ihrem Text; der Zellzeiger steht dort', async ({
  wapPage,
}) => {
  await wapPage.goto(URL);
  await wapPage.reload();
  await importWorkbook(wapPage);
  const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-r7.xlsx»' });
  await expect(report.getByRole('list', { name: 'Nicht übernommener Text' })).toContainText(
    'Verdeckt fiktiv',
  );
  await report.getByRole('button', { name: /^Zur Stelle: Verdeckte Formen/ }).click();
  const geist = wapPage.getByRole('note', { name: /^Nicht übernommene Form 0800–0900/ });
  await expect(geist).toBeVisible();
  await expect(geist).toContainText('Verdeckt fiktiv');
  await expect(wapPage.locator('.i2-grid-cursor')).toHaveAccessibleName(/^Mi .* 0800/);
});

test('[R-8.2-21][R-11-07] F-UX2 UX-AB-11: Seitenfeld und Importbericht offen – untereinander, der Bericht ganz sichtbar', async ({
  wapPage,
}) => {
  // Übliche Bildschirmbreite eines Laptops (beide Bereiche nebeneinander hätten keinen Platz).
  await wapPage.setViewportSize({ width: 1280, height: 900 });
  await wapPage.goto(URL);
  await wapPage.reload();
  await importWorkbook(wapPage);
  await wapPage.getByRole('button', { name: /^Block Ausbildung Alpha / }).click();
  await wapPage.keyboard.press('e');
  const panel = wapPage.getByRole('complementary', { name: 'Seitenfeld' });
  await expect(panel).toBeVisible();
  const report = wapPage.getByRole('dialog', { name: 'Importbericht «fiktiv-r7.xlsx»' });
  await expect(report).toBeVisible();
  const r = await report.boundingBox();
  const p = await panel.boundingBox();
  const vw = wapPage.viewportSize()?.width ?? 0;
  if (r === null || p === null) throw new Error('Bereich fehlt');
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(vw + 0.5);
  // Keine Überdeckung: Seitenfeld über dem Bericht.
  const overlapX = Math.min(r.x + r.width, p.x + p.width) - Math.max(r.x, p.x);
  const overlapY = Math.min(r.y + r.height, p.y + p.height) - Math.max(r.y, p.y);
  expect(overlapX <= 0.5 || overlapY <= 0.5).toBe(true);
  // Inhalt des Berichts nicht seitlich abgeschnitten (keine waagrechte Rollleiste im Bericht).
  const breite = await report.evaluate((e) => {
    const body = e.querySelector<HTMLElement>('.wap-import-report') ?? e;
    return {
      scroll: Math.max(e.scrollWidth, body.scrollWidth),
      client: Math.min(e.clientWidth, body.clientWidth + 24),
    };
  });
  expect(breite.scroll).toBeLessThanOrEqual(breite.client + 1);
});

test('[R-8.2-12] F-UX2 Regel 12: Excel-Import mit offenem Plan – ein Name aus dessen Personenliste in Klammern wird Ltg, nicht Ort', async ({
  wapPage,
}) => {
  await wapPage.goto(URL);
  await wapPage.reload();
  const plan = {
    ...kpPlan(1),
    id: 'fux2-personen',
    exerciseName: 'Personen Übungsplan',
    service: 'FDT 2099',
    persons: [{ id: 'p1', grad: 'Lt', name: 'Beispiel', vorname: 'Ben', funktion: 'Zfhr' }],
  };
  await openPlanFile(wapPage, 'R7Personen.wap.json', planFile(plan));
  await importWorkbook(wapPage);
  await wapPage.getByRole('button', { name: /^Block Ausbildung Alpha / }).click();
  await wapPage.keyboard.press('e');
  const panel = wapPage.getByRole('complementary', { name: 'Seitenfeld' });
  await expect(
    panel
      .getByRole('combobox', { name: /^Ltg/ })
      .or(panel.getByRole('textbox', { name: /^Ltg/ }))
      .first(),
  ).toHaveValue('Beispiel');
  await expect(panel.getByRole('textbox', { name: /^Ort/ }).first()).toHaveValue('');
});

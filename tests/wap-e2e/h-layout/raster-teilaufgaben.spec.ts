// Paket H-LAYOUT, Befund SA-H-01 (Gate S A1 «Bildschirm»; R-10-49, R-10-47): Teilaufgaben erscheinen im Raster des
// Editors, gezeichnet aus der Layout-Schicht (Titel fett, Ltg/Ort normal), und verschwinden mit Undo wieder. Projekt
// edge, Harness I3 im Entwicklungsserver; nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { createPlan } from '../i2/support/ablauf';
import { block, drawBlock } from '../i2b/support/handhabung';
import { panel } from '../i3/support/ablauf';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i3.html#leer';

/** Gezeichnete Zeilen eines Eintrags im Raster: Text und Schnitt (aus der Layout-Schicht, I2b-A). */
async function zeilen(entry: Locator): Promise<{ text: string; bold: boolean }[]> {
  return entry.locator('xpath=..').evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.i2-grid-line')].map((z) => {
      const teile = [...z.querySelectorAll<HTMLElement>('span')].filter(
        (s) => s.children.length === 0,
      );
      const quelle = teile.length > 0 ? teile : [z];
      return {
        text: z.textContent ?? '',
        bold: quelle.every((s) => Number(getComputedStyle(s).fontWeight) >= 600),
      };
    }),
  );
}

async function seitenfeld(page: Page): Promise<Locator> {
  const p = panel(page);
  if (!(await p.isVisible()))
    await page.getByRole('button', { name: 'Seitenfeld', exact: true }).click();
  await expect(p).toBeVisible();
  return p;
}

async function feld(p: Locator, name: string, wert: string): Promise<void> {
  const f = p.getByRole('textbox', { name, exact: true });
  await f.click();
  await f.fill(wert);
  await f.press('Enter');
}

test('[R-10-49][R-10-47] Raster: Teilaufgabe im Seitenfeld hinzugefügt → im Block gezeichnet (Titel fett, «Ltg (Ort)» normal); Undo entfernt sie wieder', async ({
  wapPage,
}) => {
  await createPlan(wapPage, URL, 'Teilaufgaben Raster');
  await drawBlock(wapPage, 'Lauf', 480, 840);
  await block(wapPage, 'Lauf').click();
  const p = await seitenfeld(wapPage);
  await p.getByRole('button', { name: 'Teilaufgabe hinzufügen', exact: true }).click();
  const grid = p.getByRole('grid', { name: 'Teilaufgaben' });
  await feld(grid, 'Titel Teilaufgabe 1', 'Karte');
  await feld(grid, 'Ort Teilaufgabe 1', 'Wald');
  await expect
    .poll(async () => (await zeilen(block(wapPage, 'Lauf'))).map((z) => z.text))
    .toEqual(['Lauf', 'Karte', '(Wald)']);
  const z = await zeilen(block(wapPage, 'Lauf'));
  expect(z.find((x) => x.text === 'Karte')?.bold).toBe(true);
  expect(z.find((x) => x.text === '(Wald)')?.bold).toBe(false);
  await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect
    .poll(async () => (await zeilen(block(wapPage, 'Lauf'))).map((x) => x.text))
    .toEqual(['Lauf']);
});

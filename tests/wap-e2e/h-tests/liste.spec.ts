// H-TESTS (Härtung, TR-H-08): Listenansicht – Reihenfolge je Spalte auf- und absteigend wirklich geprüft (nicht nur
// aria-sort), Filtertreffer enthalten den Suchtext und nur diese Zeilen bleiben (Beschrieb 6 «Listenansicht»;
// Vertrag E1-15 §1; R-6-14). Demopläne der I4-Harness (pseudonymisierte KVK-Daten, fiktive FDT-Wochen).
import { expect, type Locator, type Page } from '@playwright/test';
import { activateButton } from '../i2/support/ablauf';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i4.html';
const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const cmp = (a: string, b: string) => a.localeCompare(b, 'de-CH', { numeric: true });

async function openList(page: Page): Promise<Locator> {
  await page.goto(URL);
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
  await activateButton(page.getByRole('button', { name: 'Liste', exact: true }));
  const grid = page.getByRole('grid', { name: /^Einträge / });
  await expect(grid).toBeVisible();
  return grid;
}

const dataRows = (grid: Locator) => grid.locator('tbody').getByRole('row');

/** Zelltexte aller Zeilen, je Zeile ein Array in Spaltenreihenfolge. */
async function table(grid: Locator): Promise<string[][]> {
  return dataRows(grid).evaluateAll((rows) =>
    rows.map((r) => [...r.children].map((c) => (c as HTMLElement).innerText.trim())),
  );
}

async function headers(grid: Locator): Promise<string[]> {
  return (await grid.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
}

async function sortBy(grid: Locator, name: string, dir: 'ascending' | 'descending') {
  const header = grid.getByRole('columnheader', { name: new RegExp(`^${name}$`) });
  for (let i = 0; i < 3; i++) {
    if ((await header.getAttribute('aria-sort')) === dir) break;
    await header.getByRole('button').click();
  }
  await expect(header).toHaveAttribute('aria-sort', dir);
}

const sorted = (rows: string[][]) => rows.map((r) => r.join('\t')).sort();

test.describe('H-TESTS Listenansicht', () => {
  test('[R-6-14] Sortieren nach jeder Spalte: aufsteigend und absteigend in der Reihenfolge der Spalte, dieselben Zeilen', async ({
    wapPage,
  }) => {
    const grid = await openList(wapPage);
    const namen = await headers(grid);
    const before = await table(grid);
    expect(before.length).toBeGreaterThan(20);
    for (const name of ['Typ', 'Titel', 'Spalten', 'Ltg', 'Ort', 'Nr', 'Kategorie', 'Status']) {
      const i = namen.indexOf(name);
      expect(i, name).toBeGreaterThanOrEqual(0);
      await sortBy(grid, name, 'ascending');
      const auf = await table(grid);
      expect(sorted(auf), `${name}: dieselben Zeilen`).toEqual(sorted(before));
      const spalteAuf = auf.map((r) => r[i] ?? '');
      for (let k = 1; k < spalteAuf.length; k++)
        expect(
          cmp(spalteAuf[k - 1] ?? '', spalteAuf[k] ?? ''),
          `${name} aufsteigend, Zeile ${String(k)}`,
        ).toBeLessThanOrEqual(0);
      // Diese Spalten haben in der Demowoche verschiedene Werte: die Sortierung ändert die Reihenfolge wirklich.
      if (['Typ', 'Titel', 'Spalten', 'Ltg', 'Ort', 'Nr'].includes(name))
        expect(new Set(spalteAuf).size, `${name}: verschiedene Werte`).toBeGreaterThan(2);
      await sortBy(grid, name, 'descending');
      const ab = await table(grid);
      const spalteAb = ab.map((r) => r[i] ?? '');
      for (let k = 1; k < spalteAb.length; k++)
        expect(
          cmp(spalteAb[k - 1] ?? '', spalteAb[k] ?? ''),
          `${name} absteigend, Zeile ${String(k)}`,
        ).toBeGreaterThanOrEqual(0);
      expect(spalteAb).toEqual([...spalteAuf].reverse());
    }
    // Tag und Zeit: zeitliche Reihenfolge (Tag, Sortierzeit); absteigend genau umgekehrt.
    const tag = namen.indexOf('Tag');
    for (const name of ['Tag', 'Zeit']) {
      await sortBy(grid, name, 'ascending');
      const auf = await table(grid);
      // Mehrtägige Bemerkungen haben keinen Tag und stehen am Ende.
      const alleTage = auf.map((r) => TAGE.indexOf((r[tag] ?? '').slice(0, 2)));
      const ohne = alleTage.indexOf(-1);
      if (ohne >= 0) expect(alleTage.slice(ohne).every((t) => t === -1)).toBe(true);
      const tage = ohne >= 0 ? alleTage.slice(0, ohne) : alleTage;
      for (let k = 1; k < tage.length; k++)
        expect(
          tage[k - 1] ?? 0,
          `${name} aufsteigend: Tag in Zeile ${String(k)}`,
        ).toBeLessThanOrEqual(tage[k] ?? 0);
      expect(new Set(tage).size).toBeGreaterThan(1);
      await sortBy(grid, name, 'descending');
      expect(await table(grid)).toEqual([...auf].reverse());
    }
  });

  test('[R-6-14] Filter nach Text: genau die Zeilen mit dem Suchtext (ohne Gross/Klein) bleiben, jede enthält ihn; leerer Filter zeigt wieder alle', async ({
    wapPage,
  }) => {
    const grid = await openList(wapPage);
    const namen = await headers(grid);
    const alle = await table(grid);
    const ltg = namen.indexOf('Ltg');
    const ltgWert = alle.map((r) => r[ltg] ?? '').find((v) => v.length >= 3) ?? '';
    expect(ltgWert.length).toBeGreaterThanOrEqual(3);
    const filter = wapPage.getByRole('searchbox', { name: 'Filter' });
    for (const suchtext of ['mie', ltgWert.toUpperCase()]) {
      const needle = suchtext.toLowerCase();
      const soll = alle.filter((r) => r.join(' ').toLowerCase().includes(needle));
      expect(soll.length, `Treffer für «${suchtext}»`).toBeGreaterThan(0);
      expect(soll.length).toBeLessThan(alle.length);
      await filter.fill(suchtext);
      await expect.poll(() => dataRows(grid).count()).toBe(soll.length);
      const ist = await table(grid);
      for (const r of ist) expect(r.join(' ').toLowerCase()).toContain(needle);
      expect(sorted(ist)).toEqual(sorted(soll));
      await expect(
        wapPage.getByRole('status').filter({ hasText: /von \d+ Einträgen/ }),
      ).toContainText(`${String(soll.length)} von ${String(alle.length)}`);
    }
    await filter.fill('');
    await expect.poll(() => dataRows(grid).count()).toBe(alle.length);
  });
});

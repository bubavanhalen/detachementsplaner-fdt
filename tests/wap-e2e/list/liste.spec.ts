// I4 (E1-15): Listenansicht über Rolle und Name (Beschrieb 6 «Listenansicht»; Vertrag E1-15 §1, §2;
// R-6-13 bis R-6-15, R-6-42, R-4-01). Demopläne mit pseudonymisierten bzw. fiktiven Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { readPdf } from '../../wap/support/pdf/read';
import { activateButton } from '../i2/support/ablauf';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i4.html';

async function openList(page: Page): Promise<Locator> {
  await page.goto(URL);
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
  await activateButton(page.getByRole('button', { name: 'Liste', exact: true }));
  const grid = page.getByRole('grid', { name: /^Einträge / });
  await expect(grid).toBeVisible();
  return grid;
}

const dataRows = (grid: Locator) => grid.locator('tbody').getByRole('row');
const columnIndex = async (grid: Locator, name: string): Promise<number> => {
  const headers = await grid.getByRole('columnheader').allInnerTexts();
  return headers.findIndex((h) => h.trim() === name);
};
async function columnTexts(grid: Locator, name: string): Promise<string[]> {
  const i = await columnIndex(grid, name);
  return dataRows(grid).evaluateAll(
    (rows, index) =>
      rows.map((r) => (r.children[index] as HTMLElement | undefined)?.innerText.trim() ?? ''),
    i,
  );
}

test.describe('Listenansicht', () => {
  test('[R-6-13] jeder Eintrag der Woche genau einmal mit Tag, Zeit, Titel, Spalten, Ltg, Ort, Nr', async ({
    wapPage,
  }) => {
    const grid = await openList(wapPage);
    const headers = (await grid.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    for (const name of [
      'Tag',
      'Zeit',
      'Titel',
      'Spalten',
      'Ltg',
      'Ort',
      'Nr',
      'Kategorie',
      'Status',
    ])
      expect(headers).toContain(name);
    const rows = await dataRows(grid).count();
    expect(rows).toBeGreaterThan(20);
    // Gleich viele Zeilen wie die Liste meldet; der Umfang «Ganzer Plan» hat mindestens so viele.
    await expect(
      wapPage.getByRole('status').filter({ hasText: /von \d+ Einträgen/ }),
    ).toContainText(`${String(rows)} von ${String(rows)}`);
    const blocks = await wapPage.getByRole('button', { name: /^Block / }).count();
    const typen = await columnTexts(grid, 'Typ');
    expect(typen.filter((t) => t === 'Block').length).toBe(blocks);
    await wapPage.getByRole('radio', { name: 'Ganzer Plan' }).check();
    await expect(wapPage.getByRole('grid', { name: 'Einträge ganzer Plan' })).toBeVisible();
    expect(
      await dataRows(wapPage.getByRole('grid', { name: 'Einträge ganzer Plan' })).count(),
    ).toBeGreaterThanOrEqual(rows);
  });

  test('[R-6-14] sortieren nach jeder Spalte auf- und absteigend; Filter reduziert die Zeilen', async ({
    wapPage,
  }) => {
    const grid = await openList(wapPage);
    const titel = grid.getByRole('columnheader', { name: 'Titel' });
    await titel.getByRole('button').click();
    await expect(titel).toHaveAttribute('aria-sort', 'ascending');
    const auf = await columnTexts(grid, 'Titel');
    expect(auf).toEqual([...auf].sort((a, b) => a.localeCompare(b, 'de-CH', { numeric: true })));
    await titel.getByRole('button').press('Enter');
    await expect(titel).toHaveAttribute('aria-sort', 'descending');
    const ab = await columnTexts(grid, 'Titel');
    expect(ab).toEqual(
      [...auf].reverse().sort((a, b) => b.localeCompare(a, 'de-CH', { numeric: true })),
    );
    for (const name of [
      'Tag',
      'Zeit',
      'Typ',
      'Spalten',
      'Ltg',
      'Ort',
      'Nr',
      'Kategorie',
      'Status',
    ]) {
      const header = grid.getByRole('columnheader', { name: new RegExp(`^${name}$`) });
      await header.getByRole('button').click();
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await header.getByRole('button').click();
      await expect(header).toHaveAttribute('aria-sort', 'descending');
    }
    const before = await dataRows(grid).count();
    await wapPage.getByRole('searchbox', { name: 'Filter' }).fill('MiE');
    await expect.poll(() => dataRows(grid).count()).toBeLessThan(before);
    for (const row of await columnTexts(grid, 'Titel')) expect(row.length).toBeGreaterThan(0);
    await wapPage.getByRole('searchbox', { name: 'Filter' }).fill('xyz-kein-treffer');
    await expect(wapPage.getByRole('region', { name: 'Keine Einträge' })).toContainText(
      'Kein Eintrag passt',
    );
    await activateButton(wapPage.getByRole('button', { name: 'Filter löschen' }));
    await expect.poll(() => dataRows(grid).count()).toBe(before);
  });

  test('[R-6-15][R-4-01] Zelle wie in Excel bearbeiten: Pfeile, Enter, Tab, F2, Esc; Raster, Liste und PDF folgen; Undo', async ({
    wapPage,
  }) => {
    const grid = await openList(wapPage);
    const titleCol = await columnIndex(grid, 'Titel');
    const ortCol = await columnIndex(grid, 'Ort');
    const typen = await columnTexts(grid, 'Typ');
    const zeiten = await columnTexts(grid, 'Zeit');
    // Längster Block der Woche: dort hat der Ort im Raster und im PDF Platz.
    const dauer = (z: string) => {
      const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(z);
      return m === null ? 0 : Number(m[3]) * 60 + Number(m[4]) - Number(m[1]) * 60 - Number(m[2]);
    };
    const row =
      typen
        .map((t, i) => ({ i, d: t === 'Block' ? dauer(zeiten[i] ?? '') : -1 }))
        .sort((a, b) => b.d - a.d)[0]?.i ?? -1;
    expect(row).toBeGreaterThanOrEqual(0);
    const cell = (r: number, c: number) => dataRows(grid).nth(r).getByRole('gridcell').nth(c);
    // Zellzeiger mit Klick setzen, dann nur Tastatur.
    await cell(row, titleCol).click();
    await expect(cell(row, titleCol)).toBeFocused();
    await wapPage.keyboard.press('ArrowRight');
    await wapPage.keyboard.press('ArrowLeft');
    await expect(cell(row, titleCol)).toBeFocused();
    // Tippen ersetzt den Wert, Enter übernimmt und geht eine Zeile tiefer.
    await wapPage.keyboard.type('Xylo');
    await expect(grid.getByRole('textbox', { name: 'Titel' })).toHaveValue('Xylo');
    await wapPage.keyboard.press('Enter');
    await expect(cell(row + 1, titleCol)).toBeFocused();
    await expect(wapPage.getByRole('button', { name: /^Block Xylo / })).toBeVisible();
    await expect(cell(row, titleCol)).toHaveText('Xylo');
    // Ort: F2 bearbeitet, Tab übernimmt und geht nach rechts.
    await cell(row, ortCol).click();
    await wapPage.keyboard.press('F2');
    const ort = grid.getByRole('textbox', { name: 'Ort' });
    await ort.fill('Listenhalle');
    await wapPage.keyboard.press('Tab');
    await expect(cell(row, ortCol + 1)).toBeFocused();
    await expect(cell(row, ortCol)).toHaveText('Listenhalle');
    // Raster folgt sofort: Detail beim Überfahren des Blocks nennt den neuen Ort.
    await wapPage.getByRole('button', { name: /^Block Xylo / }).hover();
    await expect(wapPage.getByRole('tooltip', { name: 'Details zum Eintrag' })).toContainText(
      'Listenhalle',
    );
    // Esc verwirft.
    await cell(row, ortCol).click();
    await wapPage.keyboard.press('F2');
    await ort.fill('Verworfen');
    await wapPage.keyboard.press('Escape');
    await expect(cell(row, ortCol)).toHaveText('Listenhalle');
    // PDF der Woche folgt ohne weitere Aktion (R-4-01).
    const pending = wapPage.waitForEvent('download');
    await activateButton(wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }));
    // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): zuerst die Befunde der Woche, dann der Export.
    await activateButton(
      wapPage
        .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
        .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ }),
    );
    const path = await (await pending).path();
    expect(path).not.toBeNull();
    const info = await readPdf(new Uint8Array(readFileSync(path ?? '')));
    expect(info.texts.map((t) => t.text)).toContain('Xylo');
    // Rückgängig über die App (Ctrl+Z ausserhalb eines Eingabefelds): Ort wieder wie vorher.
    await cell(row, 0).click();
    await wapPage.keyboard.press('Control+z');
    await expect(cell(row, ortCol)).not.toHaveText('Listenhalle');
  });

  test('[R-6-16] Export … speichert die Liste als CSV im Format der Soll-Listen', async ({
    wapPage,
  }) => {
    await openList(wapPage);
    const pending = wapPage.waitForEvent('download');
    await activateButton(wapPage.getByRole('button', { name: 'Export …' }));
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/_Liste_\d{4}-\d{2}-\d{2}\.csv$/);
    const text = readFileSync((await download.path()) ?? '', 'utf8');
    expect(text.split('\n')[0]).toBe(
      'Woche;Tag;Typ;Titel;Zeitform;von;bis;Spalten;Kategorie;Ltg;Ort;Nr;Status;Bemerkung',
    );
  });

  test('[R-6-13] Barrierefreiheit: Liste ohne axe-Verstösse, sichtbarer Fokus im Zellzeiger', async ({
    wapPage,
    a11y,
    focusVisible,
  }) => {
    const grid = await openList(wapPage);
    const result = await a11y(wapPage.getByRole('region', { name: 'Listenansicht' }));
    expect(result.verstoesse.map((v) => v.id)).toEqual([]);
    const first = grid.getByRole('gridcell').first();
    await first.click();
    await wapPage.keyboard.press('ArrowRight');
    const focused = grid.getByRole('gridcell').nth(1);
    await expect(focused).toBeFocused();
    expect((await focusVisible(focused)).sichtbar).toBe(true);
  });
});

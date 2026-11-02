// F-UX2 Runde 7 (Nacharbeit SA-34, Bericht lokal unter .qa/e1-ab/sa34-nacharbeit.md; UI-Richtlinie 7, Beschrieb 4.6,
// 5.1, 6; R-6-13 bis -15): Listenansicht – die Auswahl wandert ins Raster, «Im Raster zeigen» springt zum Eintrag
// (auch zur Terminzeile), Ctrl+Entf löscht den Eintrag, Entf/Rücktaste leeren die Zelle, ein neuer Beso-Titel ist nicht
// fett, «geändert» ist nicht als Status wählbar, ein Startzeichen über eine Tottaste geht nicht verloren. Fiktive
// Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { columnsOf } from './plaene';

const DI = '2026-09-29';

/** Mo «Wache Nord» (Zfhr, Halle), Di «Theorie Bravo», Mo Bemerkung, Mo Beso ohne Titel. */
function planListe(): Plan {
  let plan = kpPlan(1);
  const [kdt] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined) throw new Error('Spalte fehlt');
  plan = add(plan, {
    type: 'block',
    date: MO,
    time: { form: 'range', from: 480, to: 600 },
    columns: { kind: 'ids', ids: [kdt.id] },
    title: [{ text: 'Wache Nord', bold: true }],
    ltg: 'Zfhr',
    ort: 'Halle',
  }).plan;
  plan = add(plan, {
    type: 'block',
    date: DI,
    time: { form: 'range', from: 600, to: 660 },
    columns: { kind: 'all' },
    title: [{ text: 'Theorie Bravo', bold: true }],
  }).plan;
  plan = add(plan, { type: 'dayRemark', date: MO, text: 'Tenue Ausgang' }).plan;
  plan = add(plan, {
    type: 'beso',
    date: MO,
    title: [],
    windows: [{ time: { form: 'range', from: 900, to: 930 } }],
  }).plan;
  return { ...plan, id: 'fux2-liste', exerciseName: 'Liste Übungsplan', service: 'FDT 2099' };
}

async function liste(page: Page, base: string): Promise<Locator> {
  await startWith(page, `${base}#leer`, 'R7Liste.wap.json', planFile(planListe()));
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  const grid = page.getByRole('grid', { name: /^Einträge / });
  await expect(grid).toBeVisible();
  return grid;
}

async function spalte(grid: Locator, name: string): Promise<number> {
  const headers = (await grid.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
  return headers.indexOf(name);
}

/** Zelle der Zeile mit `titel` in der Spalte `name`. */
async function zelle(grid: Locator, titel: string, name: string): Promise<Locator> {
  const i = await spalte(grid, name);
  return grid.locator('tbody tr').filter({ hasText: titel }).first().getByRole('gridcell').nth(i);
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

export function registerRunde7Tests(url: () => string): void {
  test('[R-6-14][R-6-15] F-UX2 UX-AB-02: die Auswahl wandert von der Liste ins Raster; «Im Raster zeigen» setzt den Fokus auf den Eintrag bzw. die Terminzeile', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    await (await zelle(grid, 'Theorie Bravo', 'Titel')).click();
    await expect(block(wapPage, 'Theorie Bravo')).toHaveAttribute('aria-pressed', 'true');
    await expect(await zelle(grid, 'Theorie Bravo', 'Titel')).toBeFocused();
    await wapPage.getByRole('button', { name: 'Im Raster zeigen', exact: true }).click();
    await expect(block(wapPage, 'Theorie Bravo')).toBeFocused();
    // Ganztägige Bemerkung: Sprung zur Terminzeile.
    await (await zelle(grid, 'Tenue Ausgang', 'Titel')).click();
    await wapPage.getByRole('button', { name: 'Im Raster zeigen', exact: true }).click();
    await expect(wapPage.getByRole('button', { name: /^Terminzeile Tenue Ausgang/ })).toBeFocused();
  });

  test('[R-6-15] F-UX2 UX-AB-02: Ctrl+Entf in der Zeile löscht den Eintrag, mit «Rückgängig»; Entf in Typ/Tag nur Hinweis', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    await (await zelle(grid, 'Tenue Ausgang', 'Ort')).click();
    await wapPage.keyboard.press('Control+Delete');
    await expect(grid.locator('tbody tr').filter({ hasText: 'Tenue Ausgang' })).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: /^Terminzeile Tenue Ausgang/ })).toHaveCount(
      0,
    );
    await expect(wapPage.getByRole('status', { name: 'Meldung', exact: true })).toContainText(
      'gelöscht',
    );
    // Entf in Typ/Tag löscht nicht (nur ein Hinweis; CR-5-05, Koordinator 20.10.2026); Ctrl+Entf löscht.
    await (await zelle(grid, 'Theorie Bravo', 'Typ')).click();
    await wapPage.keyboard.press('Delete');
    await expect(wapPage.locator('.wap-list')).toContainText('Ctrl+Entf löscht den Eintrag');
    await expect(block(wapPage, 'Theorie Bravo')).toHaveCount(1);
    await wapPage.keyboard.press('Control+Delete');
    await expect(block(wapPage, 'Theorie Bravo')).toHaveCount(0);
    await wapPage.keyboard.press('Control+z');
    await expect(block(wapPage, 'Theorie Bravo')).toHaveCount(1);
  });

  test('[R-6-15] F-UX2 UX-AB-03: Entf bzw. Rücktaste leeren die Zelle (eine Taste, ein Rückgängig-Schritt)', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    const ort = await zelle(grid, 'Wache Nord', 'Ort');
    await ort.click();
    await wapPage.keyboard.press('Delete');
    await expect(ort).toHaveText('');
    await expect(ort).toBeFocused();
    const ltg = await zelle(grid, 'Wache Nord', 'Ltg');
    await ltg.click();
    await wapPage.keyboard.press('Backspace');
    await expect(ltg).toHaveText('');
    await expect(block(wapPage, 'Wache Nord')).not.toHaveAccessibleName(/Halle|Zfhr/);
  });

  test('[R-5.1-23][R-6-15] F-UX2 UX-AB-04/-05: neuer Beso-Titel aus der Liste ist nicht fett; «geändert» ist kein wählbarer Status', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    const titel = grid
      .locator('tbody tr')
      .filter({ hasText: 'Beso' })
      .first()
      .getByRole('gridcell')
      .nth(await spalte(grid, 'Titel'));
    await titel.click();
    await wapPage.keyboard.type('Kontrolle Fahrzeuge');
    await wapPage.keyboard.press('Enter');
    const zeile = wapPage.getByRole('button', { name: /^Terminzeile .*Kontrolle Fahrzeuge/ });
    await expect(zeile).toHaveCount(1);
    const gewichte = await zeile
      .locator('.i2-grid-line, .i2-grid-line span')
      .evaluateAll((els) =>
        els
          .filter((e) => (e.textContent ?? '').includes('Kontrolle'))
          .map((e) => getComputedStyle(e).fontWeight),
      );
    expect(gewichte.length).toBeGreaterThan(0);
    for (const w of gewichte) expect(Number(w)).toBeLessThan(600);
    const status = await zelle(grid, 'Wache Nord', 'Status');
    await status.click();
    await wapPage.keyboard.press('F2');
    const auswahl = grid.getByRole('combobox', { name: 'Status', exact: true });
    await expect(auswahl).toBeVisible();
    expect(await auswahl.locator('option').allTextContents()).toEqual([
      'bestätigt',
      'offen',
      'gestrichen',
    ]);
  });

  test('[R-6-15][R-11-07] F-UX2 UX-AB-10: Tippen ersetzt die Zelle auch mit einer Tottaste (CH-Tastatur): das erste Zeichen bleibt', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    const titel = await zelle(grid, 'Wache Nord', 'Titel');
    await titel.click();
    const cdp = await wapPage.context().newCDPSession(wapPage);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Dead',
      code: 'BracketLeft',
      windowsVirtualKeyCode: 186,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Dead',
      code: 'BracketLeft',
      windowsVirtualKeyCode: 186,
    });
    await wapPage.keyboard.insertText('Ü');
    await wapPage.keyboard.type('bung');
    await wapPage.keyboard.press('Enter');
    await expect(await zelle(grid, 'Übung', 'Titel')).toHaveText('Übung');
  });

  test('[R-4.6-25][R-6-15] F-UX2 UX-AB-15: Beso ohne Leitungskategorie – «keine» in der Liste wählbar, Zelle leer', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    const kategorie = grid
      .locator('tbody tr')
      .filter({ hasText: 'Beso' })
      .first()
      .getByRole('gridcell')
      .nth(await spalte(grid, 'Kategorie'));
    await expect(kategorie).not.toHaveText('');
    await kategorie.click();
    await wapPage.keyboard.press('F2');
    const auswahl = grid.getByRole('combobox', { name: 'Kategorie', exact: true });
    await expect(auswahl.locator('option').first()).toHaveText('keine');
    await auswahl.selectOption({ label: 'keine' });
    await auswahl.press('Enter');
    await expect(kategorie).toHaveText('');
  });

  test('[R-4.6-13][R-11-07] F-UX2 UX-AB-18: «Neuer Eintrag … → Marker …» zeigt den Tag und lässt ihn ändern', async ({
    wapPage,
  }) => {
    await liste(wapPage, url());
    await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
    await wapPage
      .getByRole('button', { name: /^Neuer Eintrag …/ })
      .first()
      .click();
    await wapPage
      .getByRole('menu', { name: 'Leere Fläche' })
      .getByRole('menuitem', { name: /^Marker/ })
      .click();
    const d = wapPage.getByRole('dialog', { name: 'Neuer Marker', exact: true });
    const tag = d.getByRole('textbox', { name: 'Tag', exact: true });
    await expect(tag).toHaveValue(/\d{2}\.\d{2}\.2026/);
    await tag.fill('29.09.2026');
    await d.getByRole('textbox', { name: 'Zeitpunkt', exact: true }).fill('1330');
    await d.getByRole('button', { name: 'Marker anlegen', exact: true }).click();
    await expect(wapPage.getByRole('button', { name: /^Marker AV 1330 · Di$/ })).toBeVisible();
  });

  test('[R-4.8-01][R-5.1-06] F-UX2 UX-AB-19: gemeinsame Terminspalte Sa+So – Doppelklick in der Hälfte des So legt die Bemerkung am So an', async ({
    wapPage,
  }) => {
    const grid = await liste(wapPage, url());
    // Liste schliessen: das Raster hat dann Platz (Terminbereich im Bild).
    await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
    const sa = wapPage.getByRole('cell', { name: 'Terminbereich Sa 03.10.2026', exact: true });
    await sa.scrollIntoViewIfNeeded();
    const b = await sa.boundingBox();
    if (b === null) throw new Error('Terminbereich fehlt');
    await wapPage.mouse.dblclick(b.x + b.width * 0.8, b.y + Math.min(b.height - 8, 60));
    const text = wapPage.getByRole('textbox', { name: 'Text der Bemerkung', exact: true });
    await expect(text).toBeFocused();
    await text.fill('Ruhetag fiktiv');
    await text.press('Enter');
    await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
    await expect(grid.locator('tbody tr').filter({ hasText: 'Ruhetag fiktiv' })).toContainText(
      'So 04.10.',
    );
  });
}

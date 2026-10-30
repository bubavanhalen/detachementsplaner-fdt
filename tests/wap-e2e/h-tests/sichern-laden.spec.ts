// H-TESTS (Härtung, TR-H-11): Der ganze Plan lässt sich als Datei sichern und laden – Sichern, lokalen Speicher leeren
// (IndexedDB und localStorage des Ursprungs), Plan-Datei öffnen → Plan inklusive Stände gleich, verglichen über die
// Listenansicht und die PDF (Beschrieb 5.5, 5.6; R-5.5-07). Fiktive Daten der I5-Harness.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { readPdf } from '../../wap/support/pdf/read';
import { activateButton } from '../i2/support/ablauf';
import { planFile, planNummernStand } from '../i5/support/plaene';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i5.html#leer';

async function download(page: Page, act: () => Promise<void>): Promise<Buffer> {
  const pending = page.waitForEvent('download');
  await act();
  const path = await (await pending).path();
  if (path === null) throw new Error('Datei fehlt.');
  return readFileSync(path);
}

async function openPlanFile(page: Page, name: string, bytes: Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
}

/** Zelltexte der Listenansicht «Ganzer Plan»; danach zurück zum Raster. */
async function listeGanzerPlan(page: Page): Promise<string[][]> {
  await activateButton(page.getByRole('button', { name: 'Liste', exact: true }));
  await page.getByRole('radio', { name: 'Ganzer Plan' }).check();
  const grid = page.getByRole('grid', { name: 'Einträge ganzer Plan' });
  await expect(grid).toBeVisible();
  const rows = await grid
    .locator('tbody')
    .getByRole('row')
    .evaluateAll((rs) =>
      rs.map((r) => [...r.children].map((c) => (c as HTMLElement).innerText.trim())),
    );
  const liste = page.getByRole('button', { name: 'Liste', exact: true });
  await activateButton(liste);
  await expect(liste).toHaveAttribute('aria-pressed', 'false');
  return rows;
}

/** PDF über den Export-Dialog: Arbeitsfassung (null) oder ein gespeicherter Stand (Name des Optionsfelds). */
async function pdf(page: Page, stand: string | null): Promise<Buffer> {
  return download(page, async () => {
    await page.getByRole('button', { name: 'PDF …', exact: true }).click();
    const d = page.getByRole('dialog', { name: 'PDF-Export', exact: true });
    await expect(d).toBeVisible();
    if (stand !== null) await d.getByRole('radio', { name: stand, exact: true }).check();
    await d.getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ }).click();
  });
}

async function pdfTexte(bytes: Buffer): Promise<string[]> {
  return (await readPdf(new Uint8Array(bytes))).texts.map((t) => t.text);
}

/** Leert IndexedDB, localStorage und sessionStorage des Ursprungs, ohne dass die App offen ist. */
async function speicherLeeren(page: Page): Promise<void> {
  await page.goto('/@vite/client');
  const rest = await page.evaluate(async () => {
    for (const db of await indexedDB.databases()) {
      const name = db.name;
      if (name === undefined) continue;
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(new Error('Löschen gescheitert'));
        r.onblocked = () => reject(new Error('Löschen blockiert'));
      });
    }
    localStorage.clear();
    sessionStorage.clear();
    return { dbs: (await indexedDB.databases()).length, ls: localStorage.length };
  });
  expect(rest).toEqual({ dbs: 0, ls: 0 });
}

test('[R-5.5-07] Sichern, lokalen Speicher leeren, Laden: Plan inklusive Stände gleich (Listenansicht und PDF der Arbeitsfassung und des Stands)', async ({
  wapPage,
  clockAt,
}) => {
  await clockAt('2026-10-14T09:00:00+02:00');
  await wapPage.goto(URL);
  await wapPage.reload();
  await openPlanFile(wapPage, 'Stand.wap.json', planFile(planNummernStand().plan));
  // Einen gespeicherten Stand mit PDF anlegen.
  await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
  const dialog = wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
  await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
  await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toBeVisible();
  const listeVorher = await listeGanzerPlan(wapPage);
  expect(listeVorher.length).toBeGreaterThan(5);
  const standVorher = await pdf(wapPage, 'Stand V2 vom 14.10.2026');
  const arbeitVorher = await pdf(wapPage, null);

  // Sichern.
  const datei = await download(wapPage, async () => {
    await activateButton(wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }));
  });
  expect(datei.byteLength).toBeGreaterThan(1000);

  // Lokalen Speicher leeren: die App startet danach ohne Plan.
  await speicherLeeren(wapPage);
  await wapPage.goto(URL);
  await expect(
    wapPage.getByRole('button', { name: 'Neuer Plan aus Vorlage', exact: true }),
  ).toBeVisible();
  await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toHaveCount(0);

  // Laden.
  await openPlanFile(wapPage, 'Gesichert.wap.json', datei);
  await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toBeVisible();
  expect(await listeGanzerPlan(wapPage)).toEqual(listeVorher);
  // Der gespeicherte Stand kommt mit der Datei: gleiches PDF Byte für Byte.
  const standNachher = await pdf(wapPage, 'Stand V2 vom 14.10.2026');
  expect(standNachher.equals(standVorher)).toBe(true);
  // Arbeitsfassung: gleicher Inhalt im PDF.
  const arbeitNachher = await pdf(wapPage, null);
  expect(await pdfTexte(arbeitNachher)).toEqual(await pdfTexte(arbeitVorher));
});

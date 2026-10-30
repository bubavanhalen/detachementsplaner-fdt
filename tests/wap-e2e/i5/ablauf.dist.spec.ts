// I5 in der Einzeldatei (file://, offline): dieselben Abläufe wie im Entwicklungsserver, dazu der Offline-Ablauf
// 14.13 (öffnen, bearbeiten, PDF, Datei sichern) mit gesperrtem Netz nach Browser-Neustart. Nur fiktive Daten.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { parsePlanFile } from '../../../src/io/wap-plan/planFile';
import { readPdf } from '../../wap/support/pdf/read';
import { createBlockWithKeyboard, createPlan } from '../i2/support/ablauf';
import { einzeldateiUrl, offlinePersistent, test } from '../support/fixtures';
import { counter, registerI5Tests } from './support/ablauf';

registerI5Tests(() => einzeldateiUrl('i5'));

test('[R-14.13-01][R-11-02] I5 D4: offline nach Browser-Neustart (Netz gesperrt): Plan öffnen, bearbeiten, PDF erzeugen, Plan-Datei sichern; keine Netzanfrage', async () => {
  // F-FLAKY (FL-03): keine Zeitanforderung; zwei Browserstarts, PDF und Plan-Datei, zusammen 5–7 s, unter Rechnerlast
  // über 30 s – Zeitlimit als Schutz vor Hängern statt der Vorgabe 30 s.
  test.setTimeout(120_000);
  const dir = join(mkdtempSync(join(tmpdir(), 'wap-i5-offline-')), 'profil');
  const offline = await offlinePersistent({ userDataDir: dir });
  try {
    const url = einzeldateiUrl('i5');
    let page = await offline.context.newPage();
    await createPlan(page, `${url}#leer`, 'Offline Übungsplan');
    await createBlockWithKeyboard(page, 'Vor Neustart');
    const context = await offline.restart();
    page = await context.newPage();
    await page.goto(`${url}#leer`);
    // Öffnen: der lokal gespeicherte Plan erscheint wieder.
    await expect(page.getByRole('button', { name: /^Block Vor Neustart / })).toBeVisible();
    // Bearbeiten.
    await createBlockWithKeyboard(page, 'Nach Neustart');
    await expect(counter(page)).toBeVisible();
    // PDF erzeugen.
    const pendingPdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
    // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): zuerst die Befunde der Woche, dann der Export.
    await page
      .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
      .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
      .click();
    const pdf = await pendingPdf;
    const pdfPath = await pdf.path();
    if (pdfPath === null) throw new Error('PDF fehlt.');
    const info = await readPdf(new Uint8Array(readFileSync(pdfPath)));
    expect(info.pages.length).toBe(1);
    expect(info.fonts.every((f) => f.embedded)).toBe(true);
    // Plan-Datei sichern.
    const pendingFile = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const file = await pendingFile;
    expect(file.suggestedFilename()).toMatch(/\.wap\.json$/);
    const filePath = await file.path();
    if (filePath === null) throw new Error('Plan-Datei fehlt.');
    const saved = parsePlanFile(new Uint8Array(readFileSync(filePath)));
    const titles = Object.values(saved.plan.entries).flatMap((e) =>
      e.type === 'block' ? [e.title.map((r) => r.text).join('')] : [],
    );
    expect(titles.sort()).toEqual(['Nach Neustart', 'Vor Neustart']);
    expect(offline.abgebrochen).toEqual([]);
  } finally {
    await offline.close();
  }
});

// F-UX2 P1 (Entscheid «Bildschirm: ja» 19.10.2026; CR-H-U-02/-03; Beschrieb 5, R-5-01, R-5-02): Im Editor-Raster
// zeigt jeder Eintrag bei 50 %, 100 %, 200 % und «Einpassen» dieselben Zeilen (Umbrüche), und jede Zeile steht so im
// PDF derselben Woche. «Einpassen» zeigt die ganze Woche ohne Rollen. Zoom per Maus (Knöpfe) und Tastatur. Fiktive
// Daten.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { readPdf } from '../../../wap/support/pdf/read';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planDicht } from './plaene';

/** Zeilen je Eintrag im Raster (vorberechnete Zeilen der Layout-Schicht, `.i2-grid-line`). */
async function rasterZeilen(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const out: Record<string, string[]> = {};
    for (const hit of document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit[data-entry-id]')) {
      const entry = hit.parentElement;
      if (entry === null) continue;
      const key = `${hit.dataset.entryId ?? ''}:${hit.dataset.windowId ?? ''}`;
      out[key] = [...entry.querySelectorAll<HTMLElement>('.i2-grid-line')].map(
        (l) => l.textContent ?? '',
      );
    }
    return out;
  });
}

async function zoomStufe(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(text);
}

export function registerParitaetTests(url: () => string): void {
  test('[R-5-01][R-5-02] F-UX2 P1: Editor-Raster = PDF – gleiche Zeilen bei 50 %, 100 %, 200 % und Einpassen, jede Zeile wie im PDF; Einpassen ohne Rollen (Maus und Tastatur)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Dicht.wap.json', planFile(planDicht()));
    await zoomStufe(wapPage, '100 %');
    const z100 = await rasterZeilen(wapPage);
    expect(Object.keys(z100).length).toBeGreaterThan(100);
    // Maus: zweimal verkleinern = 50 %.
    const kleiner = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    await kleiner.click();
    await kleiner.click();
    await zoomStufe(wapPage, '50 %');
    expect(await rasterZeilen(wapPage)).toEqual(z100);
    // Tastatur im Raster: «+» sechsmal = 200 %.
    await wapPage.locator('.i2-grid-cursor').focus();
    for (let i = 0; i < 6; i++) await wapPage.keyboard.press('+');
    await zoomStufe(wapPage, '200 %');
    expect(await rasterZeilen(wapPage)).toEqual(z100);
    // Einpassen (Taste 0): ganze Woche sichtbar, gleiche Zeilen.
    await wapPage.keyboard.press('0');
    await expect(wapPage.getByRole('button', { name: 'Einpassen', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await rasterZeilen(wapPage)).toEqual(z100);
    const rollen = await wapPage.locator('.i2-grid-scroll').evaluate((n) => ({
      x: n.scrollWidth - n.clientWidth,
      y: n.scrollHeight - n.clientHeight,
    }));
    expect(rollen.x, 'Einpassen: keine waagrechte Rollleiste').toBeLessThanOrEqual(1);
    expect(rollen.y, 'Einpassen: keine senkrechte Rollleiste').toBeLessThanOrEqual(1);
    // Jede Zeile des Rasters steht im PDF derselben Woche (gleicher Text, gleiche Umbrüche).
    const pending = wapPage.waitForEvent('download');
    await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
    // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): zuerst die Befunde der Woche, dann der Export.
    await wapPage
      .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
      .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
      .click();
    const pfad = await (await pending).path();
    if (pfad === null) throw new Error('PDF fehlt.');
    const pdf = await readPdf(new Uint8Array(readFileSync(pfad)));
    const vorrat = new Map<string, number>();
    for (const t of pdf.texts) vorrat.set(t.text, (vorrat.get(t.text) ?? 0) + 1);
    const fehlt: string[] = [];
    for (const zeilen of Object.values(z100))
      for (const z of zeilen) {
        const n = vorrat.get(z) ?? 0;
        if (n === 0) fehlt.push(z);
        else vorrat.set(z, n - 1);
      }
    expect(fehlt, 'Rasterzeilen, die im PDF fehlen').toEqual([]);
    // Fenster kleiner: Einpassen passt neu ein, Umbrüche bleiben.
    await wapPage.setViewportSize({ width: 1200, height: 800 });
    await expect
      .poll(() =>
        wapPage
          .locator('.i2-grid-scroll')
          .evaluate(
            (n) => n.scrollWidth - n.clientWidth <= 1 && n.scrollHeight - n.clientHeight <= 1,
          ),
      )
      .toBe(true);
    expect(await rasterZeilen(wapPage)).toEqual(z100);
  });
}

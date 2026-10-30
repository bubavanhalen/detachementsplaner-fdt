// Paket F-TOOLS4 (Koordinator 26.10.2026, Befund FT3-02): die echte Suite-Seite #/wap aus src/App.tsx mit
// src/pages/WapPage.tsx (samt Excel-Import-Werk), im Entwicklungsserver (Abdeckung von src/pages) und in der gebauten
// Suite-Einzeldatei (wie npm run build). Ablauf über die Oberfläche: Erststart «Excel-WAP importieren», fiktive
// Arbeitsmappe aus dem Testbaukasten über die Dateiauswahl, Importbericht, Block im Raster, «PDF dieser Woche».
// Netzanfragen ausserhalb der App und Konsolenfehler macht die Vorrichtung wapPage rot; der Test prüft die
// Anfragen zusätzlich selbst. Nur fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator } from '@playwright/test';
import {
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  normal,
} from '../../../wap/fixtures/import/kp-workbook';
import { test } from '../../support/fixtures';

const DATEI = 'fiktiv-suite-wap.xlsx';

/** Fiktive Kp-Arbeitsmappe: eine Woche, ein Block am Montag. */
function arbeitsmappe(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [
          block(0, [0, 0], '0800', '1000', [[bold('Ausbildung Suite')], [normal('Zfhr (Wiese)')]]),
        ],
      }),
    ]),
  );
}

/** Exportknopf des Dialogs «PDF dieser Woche» (mit oder ohne offene Befunde). */
function exportKnopf(dialog: Locator): Locator {
  return dialog.getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ });
}

/**
 * @param url Adresse der Suite mit der Route #/wap
 * @param art «entwicklungsserver»: Anfragen nur an den eigenen Server; «einzeldatei»: keine HTTP-/WebSocket-Anfrage
 */
export function registerSuiteImportTests(
  url: () => string,
  art: 'entwicklungsserver' | 'einzeldatei',
): void {
  test(`[R-5.7-01] F-TOOLS4 Suite-Seite #/wap (${art}): Excel-WAP importieren über die Oberfläche, Importbericht, Block im Raster, PDF dieser Woche; keine Anfrage ausserhalb der App, keine Konsolenfehler`, async ({
    wapPage,
    requests,
    port,
  }) => {
    await wapPage.goto(url());
    // Die Suite zeigt die Route /wap (WapPage) mit dem Erststart des WAP-Planers.
    const knopf = wapPage.getByRole('button', { name: 'Excel-WAP importieren', exact: true });
    await expect(knopf).toBeEnabled();
    const auswahl = wapPage.waitForEvent('filechooser');
    await knopf.click();
    await (await auswahl).setFiles({
      name: DATEI,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: arbeitsmappe(),
    });
    const bericht = wapPage.getByRole('dialog', { name: `Importbericht «${DATEI}»` });
    await expect(bericht).toBeVisible();
    await expect(bericht.getByRole('table', { name: 'Formen je Blatt' })).toBeVisible();
    await bericht.getByRole('button', { name: 'Dialog schliessen' }).click();
    await expect(bericht).toBeHidden();
    await expect(wapPage.getByRole('button', { name: /^Block Ausbildung Suite / })).toBeVisible();
    // PDF dieser Woche: Datei mit PDF-Kopf.
    await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'PDF dieser Woche', exact: true });
    await expect(dialog).toBeVisible();
    const herunter = wapPage.waitForEvent('download');
    await exportKnopf(dialog).click();
    const datei = await (await herunter).path();
    expect(datei).not.toBeNull();
    expect(
      readFileSync(datei ?? '')
        .subarray(0, 5)
        .toString('latin1'),
    ).toBe('%PDF-');
    await expect(dialog).toBeHidden();
    // Anfragen: im Entwicklungsserver nur an 127.0.0.1:<port>, in der Einzeldatei keine über das Netz.
    const netz = requests.filter((u) => /^(https?|wss?):/i.test(u));
    const fremd =
      art === 'einzeldatei'
        ? netz
        : netz.filter((u) => {
            const a = new URL(u);
            return a.hostname !== '127.0.0.1' || a.port !== String(port);
          });
    expect(fremd).toEqual([]);
  });
}

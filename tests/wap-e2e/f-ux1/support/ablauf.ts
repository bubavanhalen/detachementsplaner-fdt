// F-UX1 (Schlussrunde vor Gate B; Entscheide des Auftraggebers vom 19.10.2026 «6: ja», «Stand: ja»):
// - TE-I5-01: «PDF dieser Woche» und Ctrl+P zeigen vorher die Befunde der Woche und verlangen bei «Fehler» eine
//   Bestätigung (Beschrieb 7; R-7-04, R-7-05); ohne Befund startet Enter im Dialog den Export.
// - TR-H-06: R-7-04/R-7-05 über die echte Oberfläche: früherer Stand mit offenem P1 ohne Befundliste und ohne
//   Bestätigung; quittierter Fehler eingeklappt sichtbar, Export ohne Bestätigung.
// - Stand: Ein gesetzter Stand lässt sich nicht per Undo zurücknehmen (ADR-006, Änderungsnotiz F-UX1); Stände und
//   ihre PDF bleiben beim Verwerfen eines Redo-Zweigs erhalten; nach Wiederherstellen ist die Version eindeutig.
// Abläufe über Rolle und Name mit Maus und Tastatur im Entwicklungsserver und in der Einzeldatei. Nur fiktive Daten.
import { readFileSync } from 'node:fs';
import { type Download, expect, type Locator, type Page } from '@playwright/test';
import { createPlan } from '../../i2/support/ablauf';
import { counter, findingsPanel, startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planOhneBefund, planP1 } from './plaene';

async function download(
  page: Page,
  act: () => Promise<void>,
): Promise<{ d: Download; bytes: Buffer }> {
  const pending = page.waitForEvent('download');
  await act();
  const d = await pending;
  const path = await d.path();
  if (path === null) throw new Error('Datei fehlt.');
  return { d, bytes: readFileSync(path) };
}

function weekPdfDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'PDF dieser Woche', exact: true });
}

function pdfDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'PDF-Export', exact: true });
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

/** Meldung «Ein gesetzter Stand lässt sich nicht rückgängig machen …» (Entscheid «Stand: ja»). */
function grenze(page: Page): Locator {
  return page
    .getByRole('alert')
    .filter({ hasText: 'Ein gesetzter Stand lässt sich nicht rückgängig machen' });
}

function meldung(page: Page): Locator {
  return page.getByRole('status', { name: 'Meldung' });
}

/** Zählt Downloads ab jetzt (für «Abbrechen erzeugt keine Datei»). */
function zaehleDownloads(page: Page): () => number {
  let n = 0;
  page.on('download', () => {
    n++;
  });
  return () => n;
}

async function quittieren(page: Page, muster: RegExp, grund: string): Promise<void> {
  await page.keyboard.press('Control+.');
  const panel = findingsPanel(page);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: muster }).click();
  const dialog = page.getByRole('dialog', { name: 'Befund quittieren', exact: true });
  await dialog.getByRole('textbox', { name: 'Grund (optional)' }).fill(grund);
  await dialog.getByRole('textbox', { name: 'Grund (optional)' }).press('Enter');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+.');
  await expect(panel).toBeHidden();
}

async function standSetzen(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
  await expect(dialog.getByRole('list', { name: 'Folgen des Stands' })).toContainText(
    'lässt sich danach nicht rückgängig machen',
  );
  await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Gespeichertes PDF eines Stands über «PDF …» (Fassung = Stand); liefert die Bytes. */
async function standPdf(page: Page, stand: string): Promise<Buffer> {
  const pdf = await download(page, async () => {
    await page.getByRole('button', { name: 'PDF …', exact: true }).click();
    const d = pdfDialog(page);
    await d.getByRole('radio', { name: stand, exact: true }).check();
    await d.getByRole('button', { name: 'Exportieren', exact: true }).click();
  });
  return pdf.bytes;
}

export function registerFUx1Tests(url: () => string): void {
  test('[R-7-04][R-7-05][R-1-03] F-UX1 TE-I5-01: «PDF dieser Woche» und Ctrl+P zeigen vorher P1 der Woche; Fehler verlangen «Trotzdem exportieren», Enter auf «Abbrechen» erzeugt keine Datei', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'P1.wap.json', planFile(planP1()));
    await expect(counter(wapPage)).toHaveAccessibleName(/^1 offener Befund: 1 Fehler/);
    const downloads = zaehleDownloads(wapPage);
    // Maus: Knopf «PDF dieser Woche».
    await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
    let d = weekPdfDialog(wapPage);
    await expect(d).toBeVisible();
    const list = d.getByRole('list', { name: 'Offene Befunde in KVK', exact: true });
    await expect(list).toContainText('P1');
    await expect(list).toContainText('Fremdspalte');
    await expect(d.getByRole('alert')).toContainText('Das PDF würde Regelverstösse enthalten');
    await expect(d.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
    await expect(d.getByRole('button', { name: 'Exportieren', exact: true })).toHaveCount(0);
    await wapPage.keyboard.press('Enter');
    await expect(d).toBeHidden();
    expect(downloads()).toBe(0);
    // Tastatur: Ctrl+P öffnet denselben Dialog, Esc schliesst ohne Datei.
    await wapPage.keyboard.press('Control+p');
    d = weekPdfDialog(wapPage);
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Escape');
    await expect(d).toBeHidden();
    expect(downloads()).toBe(0);
    // Bestätigt: «Trotzdem exportieren» erzeugt das PDF der Arbeitsfassung.
    await wapPage.keyboard.press('Control+p');
    const pdf = await download(wapPage, () =>
      weekPdfDialog(wapPage)
        .getByRole('button', { name: 'Trotzdem exportieren', exact: true })
        .click(),
    );
    expect(pdf.d.suggestedFilename()).toBe('WAP_FDT_2099_KVK_Entwurf.pdf');
    expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    await expect(weekPdfDialog(wapPage)).toBeHidden();
    await expect(meldung(wapPage)).toContainText('PDF «WAP_FDT_2099_KVK_Entwurf.pdf» erstellt');
  });

  test('[R-7-04][R-7-05] F-UX1 TR-H-06: quittierter Fehler erscheint in «PDF dieser Woche» und «PDF …» eingeklappt, der Export verlangt keine Bestätigung (Enter exportiert)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'P1.wap.json', planFile(planP1()));
    await quittieren(wapPage, /^P1 «Fremdspalte».* quittieren …$/, 'Absprache Zfhr');
    await expect(counter(wapPage)).toHaveAccessibleName(/^0 offene Befunde/);
    for (const oeffnen of [
      async () => {
        await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
        return weekPdfDialog(wapPage);
      },
      async () => {
        await wapPage.getByRole('button', { name: 'PDF …', exact: true }).click();
        return pdfDialog(wapPage);
      },
    ]) {
      const d = await oeffnen();
      await expect(d).toBeVisible();
      await expect(d).toContainText('Keine offenen Befunde.');
      await expect(d.getByRole('alert')).toHaveCount(0);
      await expect(
        d.getByRole('button', { name: 'Trotzdem exportieren', exact: true }),
      ).toHaveCount(0);
      // Eingeklappt: Zusammenfassung sichtbar, Inhalt erst nach dem Aufklappen.
      const zusammenfassung = d.getByText('Quittiert (1)', { exact: true });
      await expect(zusammenfassung).toBeVisible();
      const quittiert = d.getByRole('list', { name: 'Quittierte Befunde', exact: true });
      await expect(quittiert).toBeHidden();
      await zusammenfassung.click();
      await expect(quittiert).toContainText('P1');
      await expect(quittiert).toContainText('Fremdspalte');
      const exportieren = d.getByRole('button', { name: 'Exportieren', exact: true });
      await exportieren.focus();
      const pdf = await download(wapPage, () => wapPage.keyboard.press('Enter'));
      expect(pdf.d.suggestedFilename()).toBe('WAP_FDT_2099_KVK_Entwurf.pdf');
      await expect(d).toBeHidden();
    }
  });

  test('[R-7-04][R-7-05][R-5.5-06] F-UX1 TR-H-06: früherer Stand mit offenem P1 wird ohne Befundliste und ohne Bestätigung ausgegeben; die Arbeitsfassung verlangt die Bestätigung', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    await startWith(wapPage, `${url()}#leer`, 'P1.wap.json', planFile(planP1()));
    await standSetzen(wapPage);
    await expect(meldung(wapPage)).toContainText('Stand V1 vom 14.10.2026 gesetzt');
    await expect(counter(wapPage)).toHaveAccessibleName(/^1 offener Befund: 1 Fehler/);
    await wapPage.getByRole('button', { name: 'PDF …', exact: true }).click();
    const d = pdfDialog(wapPage);
    // Arbeitsfassung: Befundliste und Bestätigung.
    await expect(d.getByRole('list', { name: 'Offene Befunde in KVK', exact: true })).toContainText(
      'P1',
    );
    await expect(d.getByRole('alert')).toContainText('Das PDF würde Regelverstösse enthalten');
    await expect(
      d.getByRole('button', { name: 'Trotzdem exportieren', exact: true }),
    ).toBeVisible();
    // Früherer Stand: keine Befundliste, keine Bestätigung, Anfangsfokus beim Export.
    await d.getByRole('radio', { name: 'Stand V1 vom 14.10.2026', exact: true }).check();
    await expect(d.getByRole('heading', { name: /^Befunde in/ })).toHaveCount(0);
    await expect(d.getByRole('list', { name: /^Offene Befunde/ })).toHaveCount(0);
    await expect(d.getByRole('alert')).toHaveCount(0);
    await expect(d.getByRole('button', { name: 'Trotzdem exportieren', exact: true })).toHaveCount(
      0,
    );
    await expect(d.getByRole('button', { name: 'Exportieren', exact: true })).toBeFocused();
    const pdf = await download(wapPage, () => wapPage.keyboard.press('Enter'));
    expect(pdf.d.suggestedFilename()).toBe('WAP_FDT_2099_KVK_Stand_2026-10-14.pdf');
    await expect(d).toBeHidden();
  });

  test('[R-7-04] F-UX1 TE-I5-01: ohne Befund zeigt Ctrl+P «Keine offenen Befunde.», «Exportieren» hat den Fokus und Enter startet den Export', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Kürzel Übungsplan');
    await expect(counter(wapPage)).toHaveAccessibleName(/^0 offene Befunde/);
    await wapPage.keyboard.press('Control+p');
    const d = weekPdfDialog(wapPage);
    await expect(d).toBeVisible();
    await expect(d).toContainText('Keine offenen Befunde.');
    await expect(d.getByRole('alert')).toHaveCount(0);
    await expect(d.getByRole('button', { name: 'Exportieren', exact: true })).toBeFocused();
    const pdf = await download(wapPage, () => wapPage.keyboard.press('Enter'));
    expect(pdf.d.suggestedFilename()).toBe('WAP_Kürzel_Übungsplan_KVK_Entwurf.pdf');
    await expect(d).toBeHidden();
    await expect(meldung(wapPage)).toContainText(
      'PDF «WAP_Kürzel_Übungsplan_KVK_Entwurf.pdf» erstellt',
    );
  });

  test('[R-5.5-04][R-5.6-14] F-UX1 Stand: ein gesetzter Stand lässt sich nicht per Undo zurücknehmen (Meldung, auch nach Neuladen); Änderungen danach bleiben rückgängig machbar; Verwerfen des Redo-Zweigs lässt Stand und PDF unverändert', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    await startWith(wapPage, `${url()}#leer`, 'Stand.wap.json', planFile(planOhneBefund()));
    // Änderung vor dem Stand.
    await block(wapPage, 'Ausbildung Nord').click();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Ausbildung Nord')).toHaveCount(0);
    await standSetzen(wapPage);
    await expect(meldung(wapPage)).toContainText('Stand V1 vom 14.10.2026 gesetzt');
    await expect(wapPage.getByText('Stand 14.10.2026 · V1')).toBeVisible();
    // Die Meldung zum Stand bietet kein «Rückgängig»; der Knopf «Rückgängig» ist an der Grenze gesperrt.
    await expect(meldung(wapPage).getByRole('button', { name: /rückgängig machen$/ })).toHaveCount(
      0,
    );
    await expect(wapPage.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
    const vorher = await standPdf(wapPage, 'Stand V1 vom 14.10.2026');
    // Ctrl+Z an der Grenze: Meldung mit Ursache und nächstem Schritt; Stand und Änderung davor bleiben.
    await block(wapPage, 'Ausbildung Ost').click();
    await wapPage.keyboard.press('Control+z');
    const alert = grenze(wapPage);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Wiederherstellungspunkte');
    await expect(wapPage.getByText('Stand 14.10.2026 · V1')).toBeVisible();
    await expect(block(wapPage, 'Ausbildung Nord')).toHaveCount(0);
    // Änderung nach dem Stand: rückgängig machbar, danach wieder die Grenze.
    await block(wapPage, 'Ausbildung Ost').click();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Ausbildung Ost')).toHaveCount(0);
    await wapPage.keyboard.press('Control+z');
    await expect(block(wapPage, 'Ausbildung Ost')).toBeVisible();
    // Neue Änderung verwirft den Redo-Zweig; der Stand bleibt sichtbar und bytegleich.
    await block(wapPage, 'Ausbildung Süd').click();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Ausbildung Süd')).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: 'Wiederholen', exact: true })).toBeDisabled();
    expect((await standPdf(wapPage, 'Stand V1 vom 14.10.2026')).equals(vorher)).toBe(true);
    // Nach Neuladen: ein Schritt rückgängig, dann die Grenze.
    await wapPage.reload();
    await expect(wapPage.getByText('Stand 14.10.2026 · V1')).toBeVisible();
    await block(wapPage, 'Ausbildung Ost').click();
    await wapPage.keyboard.press('Control+z');
    await expect(block(wapPage, 'Ausbildung Süd')).toBeVisible();
    await wapPage.keyboard.press('Control+z');
    await expect(grenze(wapPage)).toBeVisible();
    await expect(wapPage.getByText('Stand 14.10.2026 · V1')).toBeVisible();
    expect((await standPdf(wapPage, 'Stand V1 vom 14.10.2026')).equals(vorher)).toBe(true);
  });

  test('[R-5.5-03][R-5.6-09] F-UX1 Stand: nach Wiederherstellen «vor Stand V1» schlägt «Neuen Stand setzen» die nächste freie Version V2 vor und lehnt V1 ab; beide Stände bleiben ausgebbar', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    await startWith(wapPage, `${url()}#leer`, 'Stand.wap.json', planFile(planOhneBefund()));
    await standSetzen(wapPage);
    await expect(wapPage.getByText('Stand 14.10.2026 · V1')).toBeVisible();
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    const punkte = wapPage.getByRole('dialog', { name: 'Wiederherstellungspunkte', exact: true });
    await punkte
      .getByRole('button', { name: /^Wiederherstellen: vor Stand V1/ })
      .first()
      .click();
    await expect(punkte).toBeHidden();
    await expect(wapPage.getByText('Noch kein Stand')).toBeVisible();
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
    const version = dialog.getByRole('spinbutton', { name: 'Version', exact: true });
    await expect(version).toHaveValue('2');
    await expect(dialog.getByRole('list', { name: 'Frühere Stände' })).toContainText(
      'Stand V1 vom 14.10.2026',
    );
    await version.fill('1');
    await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(
      'Die Version muss eine ganze Zahl ab 2 sein',
    );
    await version.fill('2');
    await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toBeVisible();
    const v1 = await standPdf(wapPage, 'Stand V1 vom 14.10.2026');
    const v2 = await standPdf(wapPage, 'Stand V2 vom 14.10.2026');
    expect(v1.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(v2.equals(v1)).toBe(false);
  });
}

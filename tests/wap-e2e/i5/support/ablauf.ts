// I5 «Stand, Prüfregeln, Layout-Ergänzungen, Abläufe, Querschnitt» (D1–D5): Abläufe über Rolle und Name mit Maus
// und Tastatur im Entwicklungsserver und in der Einzeldatei. Nur fiktive Daten.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type Download, expect, type Locator, type Page } from '@playwright/test';
import { type PdfInfo, readPdf } from '../../../wap/support/pdf/read';
import { createBlockWithKeyboard, createPlan } from '../../i2/support/ablauf';
import { test } from '../../support/fixtures';
import {
  planErgaenzungen,
  planExport,
  planFiktiv,
  planFile,
  planNummernStand,
  planOhneSpaltensatz,
  planZehnBeso,
} from './plaene';

const ROT = { r: 192, g: 0, b: 0 };

export function counter(page: Page): Locator {
  return page.getByRole('button', { name: /^\d+ offener? Befunde?:/ });
}

export function findingsPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Befunde', exact: true });
}

export async function openPlanFile(page: Page, name: string, bytes: Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
}

/** App leer laden (eigene Datenbank je Test: neuer Browserkontext) und eine Plan-Datei öffnen. */
export async function startWith(
  page: Page,
  url: string,
  name: string,
  bytes: Buffer,
): Promise<void> {
  await page.goto(url);
  await page.reload();
  await openPlanFile(page, name, bytes);
}

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

async function pdfInfo(bytes: Buffer): Promise<PdfInfo> {
  return readPdf(new Uint8Array(bytes));
}

/**
 * «PDF dieser Woche»: zuerst der Dialog mit den Befunden der Woche, dann der Export (TE-I5-01 entschieden,
 * Auftraggeber 19.10.2026 «6: ja»).
 */
async function pdfDieserWoche(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
    .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
    .click();
}

function pdfDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'PDF-Export', exact: true });
}

async function openPdfDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'PDF …', exact: true }).click();
  const d = pdfDialog(page);
  await expect(d).toBeVisible();
  return d;
}

/** Beso nach Nummer (null = beliebig) und Titel. */
function beso(page: Page, n: string | null, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Beso ${n ?? '[^ ]+'} ${title} `) });
}

/** Neuen Beso am Mo 1800 über den Zellzeiger und «Neuer Eintrag …» (Tastatur, B). */
async function addBesoByKeyboard(page: Page, title: string): Promise<void> {
  await page
    .getByRole('button', { name: /^Mo 28\.09\. 0800 / })
    .first()
    .focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('PageDown');
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: /^Beso/ }).click();
  const field = page.getByRole('textbox', { name: 'Termintext', exact: true });
  await expect(field).toBeFocused();
  await field.fill(title);
  await field.press('Enter');
}

export function registerI5Tests(url: () => string): void {
  test('[R-7-01][R-7-02][R-7-03] I5 D1: Befund entsteht und vergeht ohne weitere Aktion, Zähler, Sprung zur Stelle wechselt die Woche und wählt den Eintrag', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Befund.wap.json', planFile(planZehnBeso()));
    await expect(counter(wapPage)).toHaveAccessibleName(/^0 offene Befunde: 0 Fehler/);
    await expect(counter(wapPage)).toContainText('Keine Befunde');
    await addBesoByKeyboard(wapPage, 'Zusatzvisite');
    // Der elfte Beso hat keine Nummer: P17 sofort im Zähler (R-7-01, R-7-02).
    await expect(counter(wapPage)).toHaveAccessibleName(
      /^1 offener Befund: 1 Fehler, 0 Warnungen, 0 Hinweise/,
    );
    await wapPage.getByRole('tab', { name: 'Wo 1' }).click();
    await expect(wapPage.getByRole('tab', { name: 'Wo 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await counter(wapPage).click();
    const panel = findingsPanel(wapPage);
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Ganzer Plan', exact: true }).click();
    await expect(panel).toContainText('P17');
    await expect(panel).toContainText('Nummernkreis 10–19 ist voll');
    await expect(panel).toContainText('Nächster Schritt');
    await panel.getByRole('button', { name: /^Zur Stelle: P17 «Zusatzvisite»/ }).click();
    await expect(wapPage.getByRole('tab', { name: 'KVK' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const entry = beso(wapPage, '–', 'Zusatzvisite');
    await expect(entry).toBeFocused();
    await expect(entry).toHaveAttribute('aria-pressed', 'true');
    // Prüfmarke nur am Bildschirm (Kreis «!»).
    await expect(entry.locator('xpath=..').locator('.i2-grid-finding.is-error')).toHaveCount(1);
    // Rückgängig behebt den Befund ohne weitere Aktion.
    await wapPage.keyboard.press('Control+z');
    await expect(counter(wapPage)).toHaveAccessibleName(/^0 offene Befunde/);
    await expect(panel).toContainText('Keine offenen Befunde');
  });

  test('[R-7-34] I5 D1: Befund quittieren (Grund), verschwindet aus dem Zähler, bleibt unter «Quittiert», Aufheben und Ctrl+Z holen ihn zurück', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Export.wap.json', planFile(planExport()));
    await expect(counter(wapPage)).toHaveAccessibleName(/^\d+ offene Befunde: \d+ Fehler/);
    const before = Number(
      /^(\d+)/.exec((await counter(wapPage).getAttribute('aria-label')) ?? '')?.[1],
    );
    // Tastatur: Ctrl+. öffnet die Liste.
    await wapPage.keyboard.press('Control+.');
    const panel = findingsPanel(wapPage);
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^P16 «Sonntagswache».* quittieren …$/ }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Befund quittieren', exact: true });
    await dialog.getByRole('textbox', { name: 'Grund (optional)' }).fill('Absprache Kp Kdt');
    await dialog.getByRole('textbox', { name: 'Grund (optional)' }).press('Enter');
    await expect(dialog).toBeHidden();
    await expect(counter(wapPage)).toHaveAccessibleName(
      new RegExp(`^${String(before - 1)} offene`),
    );
    await panel.getByText(/^Quittiert \(1\)$/).click();
    await expect(panel.getByRole('list', { name: /^Quittierte Befunde/ })).toContainText(
      'Absprache Kp Kdt',
    );
    await wapPage.keyboard.press('Control+z');
    await expect(counter(wapPage)).toHaveAccessibleName(new RegExp(`^${String(before)} offene`));
  });

  test('[R-1-03][R-1-07][R-1-08][R-7-04][R-7-05] I5 D2: PDF-Export zeigt vorher P8, P16, P17 der Woche; Fehler verlangen «Trotzdem exportieren», Abbrechen erzeugt keine Datei; ohne Befund keine Zwischenfrage', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Export.wap.json', planFile(planExport()));
    let d = await openPdfDialog(wapPage);
    const list = d.getByRole('list', { name: /^Offene Befunde in KVK/ });
    await expect(list).toContainText('P8');
    await expect(list).toContainText('P16');
    await expect(list).toContainText('P17');
    await expect(d.getByRole('alert')).toContainText('Das PDF würde Regelverstösse enthalten');
    // Anfangsfokus auf «Abbrechen»; Abbrechen erzeugt keine Datei.
    await expect(d.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
    let downloads = 0;
    wapPage.on('download', () => {
      downloads++;
    });
    await wapPage.keyboard.press('Enter');
    await expect(d).toBeHidden();
    expect(downloads).toBe(0);
    d = await openPdfDialog(wapPage);
    const pdf = await download(wapPage, () =>
      d.getByRole('button', { name: 'Trotzdem exportieren', exact: true }).click(),
    );
    expect(pdf.d.suggestedFilename()).toBe('WAP_FDT_2099_KVK_Entwurf.pdf');
    expect((await pdfInfo(pdf.bytes)).pages.length).toBeGreaterThan(0);
    // Wo 2 ohne Befund: keine Zwischenfrage, «Exportieren» mit Anfangsfokus.
    await wapPage.getByRole('tab', { name: 'Wo 1' }).click();
    d = await openPdfDialog(wapPage);
    await expect(d).toContainText('Keine offenen Befunde.');
    await expect(d.getByRole('button', { name: 'Exportieren', exact: true })).toBeFocused();
    const second = await download(wapPage, () => wapPage.keyboard.press('Enter'));
    expect(second.d.suggestedFilename()).toBe('WAP_FDT_2099_Wo1_Entwurf.pdf');
  });

  test('[R-5.5-01][R-5.5-02] I5 D2: PDF pro Woche und für den ganzen Plan (eine Seite je Woche plus Fortsetzung), Vorschau vor dem ersten Stand und mit Befunden', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', planFile(planZehnBeso()));
    const d = await openPdfDialog(wapPage);
    await d.getByRole('button', { name: 'Vorschau', exact: true }).click();
    const preview = d.getByRole('region', { name: 'Vorschau KVK' });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Visite 1');
    await d.getByRole('radio', { name: 'Ganzer Plan', exact: true }).check();
    const plan = await download(wapPage, () =>
      d.getByRole('button', { name: 'Exportieren', exact: true }).click(),
    );
    expect(plan.d.suggestedFilename()).toBe('WAP_FDT_2099_Plan_Entwurf.pdf');
    expect((await pdfInfo(plan.bytes)).pages).toHaveLength(2);
    const week = await download(wapPage, async () => {
      const again = await openPdfDialog(wapPage);
      await again.getByRole('button', { name: 'Exportieren', exact: true }).click();
    });
    expect((await pdfInfo(week.bytes)).pages).toHaveLength(1);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText('erstellt');
  });

  test('[R-5.5-08][R-4.6-33] I5 D2: «Neuen Stand setzen» nennt die Folgen (Nr 12 neu vergeben, gestrichener Eintrag entfernt), setzt den Stand; früherer Stand als identisches PDF, A3 und Status dort gesperrt', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    const { plan } = planNummernStand();
    await startWith(wapPage, `${url()}#leer`, 'Stand.wap.json', planFile(plan));
    await expect(wapPage.getByText('Stand 20.09.2026 · V1')).toBeVisible();
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
    await expect(dialog.getByRole('textbox', { name: 'Datum', exact: true })).toBeFocused();
    await expect(dialog.getByRole('textbox', { name: 'Datum', exact: true })).toHaveValue(
      '14.10.2026',
    );
    await expect(dialog.getByRole('spinbutton', { name: 'Version', exact: true })).toHaveValue('2');
    const folgen = dialog.getByRole('list', { name: 'Folgen des Stands' });
    await expect(folgen).toContainText('Nr 12 neu vergeben: Nachzügler');
    await expect(folgen).toContainText(
      '1 gestrichener Eintrag wird aus der Arbeitsfassung entfernt',
    );
    await expect(folgen).toContainText('vor Stand V2');
    await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      'Stand V2 vom 14.10.2026 gesetzt',
    );
    await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toBeVisible();
    await expect(beso(wapPage, '12', 'Nachzügler')).toBeVisible();
    await expect(counter(wapPage)).toHaveAccessibleName(/^0 offene Befunde/);
    // Vor dem Stand entstand ein Wiederherstellungspunkt (Beschrieb 5.6 Pkt 2).
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    await expect(
      wapPage
        .getByRole('dialog', { name: 'Wiederherstellungspunkte', exact: true })
        .getByRole('table'),
    ).toContainText('vor Stand V2');
    await wapPage.keyboard.press('Escape');
    // Früherer Stand: gespeicherte Fassung, A3 und Status gesperrt; zweimal gleiche Bytes, auch nach Änderungen.
    const first = await download(wapPage, async () => {
      const d = await openPdfDialog(wapPage);
      await d.getByRole('radio', { name: 'Stand V2 vom 14.10.2026', exact: true }).check();
      await expect(d.getByRole('checkbox', { name: 'A3', exact: true })).toBeDisabled();
      await expect(
        d.getByRole('checkbox', { name: 'Status rot darstellen', exact: true }),
      ).toBeDisabled();
      await expect(d).toContainText('Für frühere Stände gibt es nur die gespeicherte Fassung');
      await expect(d.getByRole('list', { name: /^Offene Befunde/ })).toHaveCount(0);
      await d.getByRole('button', { name: 'Exportieren', exact: true }).click();
    });
    expect(first.d.suggestedFilename()).toBe('WAP_FDT_2099_KVK_Stand_2026-10-14.pdf');
    await beso(wapPage, '12', 'Nachzügler').click();
    await wapPage.keyboard.press('Delete');
    await expect(beso(wapPage, '12', 'Nachzügler')).toHaveCount(0);
    const again = await download(wapPage, async () => {
      const d = await openPdfDialog(wapPage);
      await expect(d).toContainText('Seit Stand V2 wurden');
      await d.getByRole('radio', { name: 'Stand V2 vom 14.10.2026', exact: true }).check();
      await d.getByRole('button', { name: 'Exportieren', exact: true }).click();
    });
    expect(again.bytes.equals(first.bytes)).toBe(true);
    // «Änderungen markieren» in der Arbeitsfassung: geänderte Einträge rot.
    const marked = await download(wapPage, async () => {
      const d = await openPdfDialog(wapPage);
      await d.getByRole('checkbox', { name: /^Änderungen markieren/ }).check();
      await d.getByRole('checkbox', { name: 'Status rot darstellen', exact: true }).uncheck();
      await d.getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ }).click();
    });
    expect(
      (await pdfInfo(marked.bytes)).texts.some((t) => t.color.r === ROT.r && t.color.g === 0),
    ).toBe(false);
    // Ein gesetzter Stand lässt sich nicht rückgängig machen (Auftraggeber 19.10.2026 «Stand: ja»): Ctrl+Z nimmt
    // die Änderung danach zurück; an der Grenze erscheint die Meldung, der Stand bleibt.
    await wapPage.keyboard.press('Control+z');
    await expect(beso(wapPage, '12', 'Nachzügler')).toBeVisible();
    await wapPage.keyboard.press('Control+z');
    await expect(
      wapPage
        .getByRole('alert')
        .filter({ hasText: 'Ein gesetzter Stand lässt sich nicht rückgängig machen' }),
    ).toBeVisible();
    await expect(wapPage.getByText('Stand 14.10.2026 · V2')).toBeVisible();
  });

  test('[R-4.7-03][R-4.7-13][R-4.6-15] I5 D3: Parität Bildschirm/PDF – gemeinsame Leitung diagonal in beiden Farben, offenes Ende gewellt, Marker als flacher Block auch im Raster', async ({
    wapPage,
  }) => {
    await startWith(
      wapPage,
      `${url()}#leer`,
      'Ergaenzungen.wap.json',
      planFile(planErgaenzungen()),
    );
    const shared = wapPage.getByRole('button', { name: /^Block Gemeinsam / }).locator('xpath=..');
    const colors = await shared.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('.i2-grid-shape')]
        .filter((s) => s.style.clipPath.startsWith('polygon'))
        .map((s) => getComputedStyle(s).backgroundColor),
    );
    expect(colors.sort()).toEqual(['rgb(253, 234, 218)', 'rgb(255, 255, 153)']);
    const wave = wapPage.getByRole('button', { name: /^Block Offen bis / }).locator('xpath=..');
    expect(
      await wave.evaluate((el) =>
        [...el.querySelectorAll('path')].some((p) => /C /.test(p.getAttribute('d') ?? '')),
      ),
    ).toBe(true);
    const marker = wapPage
      .getByRole('button', { name: /^Marker HV 1500 · Mo$/ })
      .locator('xpath=..');
    expect(
      await marker.evaluate(
        (el) => el.matches('[data-flaeche]') || el.querySelector('[data-flaeche]') !== null,
      ),
    ).toBe(true);
    expect(
      await marker.evaluate(
        (el) => el.querySelectorAll('.i2-grid-shape:not([data-flaeche])').length,
      ),
    ).toBe(0);
    const pdf = await download(wapPage, () => pdfDieserWoche(wapPage));
    const info = await pdfInfo(pdf.bytes);
    const fills = info.strokes
      .filter((x) => x.kind === 'path' && x.fill !== null)
      .map((x) => x.fill);
    expect(fills.some((f) => f?.r === 253 && f.g === 234)).toBe(true);
    expect(fills.some((f) => f?.r === 255 && f.g === 255 && f.b === 153)).toBe(true);
  });

  test('[R-5.7-01] I5 D4: Erststart bietet genau «Neuer Plan aus Vorlage», «Plan-Datei öffnen», «Excel-WAP importieren», per Tastatur erreichbar (Tab, Kürzel N)', async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    const start = wapPage.getByRole('region', { name: 'Ein neuer Wochenplan' });
    const cards = start.getByRole('button');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAccessibleName('Neuer Plan aus Vorlage (N)');
    await expect(cards.nth(1)).toHaveAccessibleName('Plan-Datei öffnen (O)');
    await expect(cards.nth(2)).toHaveAccessibleName('Excel-WAP importieren (I)');
    await expect(cards.nth(0)).toBeFocused();
    await wapPage.keyboard.press('Tab');
    await expect(cards.nth(1)).toBeFocused();
    await wapPage.keyboard.press('Tab');
    await expect(cards.nth(2)).toBeFocused();
    await wapPage.keyboard.press('n');
    await expect(
      wapPage.getByRole('dialog', { name: 'Neuer Plan aus Vorlage', exact: true }),
    ).toBeVisible();
    await wapPage.keyboard.press('Escape');
    await cards.nth(2).focus();
    await wapPage.keyboard.press('Enter');
    // Ohne Import im Einstieg ein Hinweis mit Ursache und nächstem Schritt, sonst die Dateiauswahl.
    const hint = wapPage.getByRole('dialog', { name: 'Excel-WAP importieren', exact: true });
    if (await hint.isVisible()) {
      await expect(hint).toContainText('Nächster Schritt');
      await wapPage.keyboard.press('Escape');
    }
  });

  test('[R-5.7-02] I5 D4: leere Woche zeigt den nächsten Schritt: ohne Spaltensatz «Spaltensatz wählen …» (wählt die Tage, öffnet das Seitenfeld), mit Spaltensatz «Einträge ins Raster ziehen»', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Leer.wap.json', planFile(planOhneSpaltensatz()));
    const note = wapPage.getByRole('note', { name: 'Nächster Schritt' });
    await expect(note).toContainText('KVK ist noch leer');
    await expect(note).toContainText('Spaltensatz wählen');
    await note
      .getByRole('button', { name: /^Spaltensatz für Mo, Di, Mi, Do, Fr, Sa, So wählen …$/ })
      .click();
    await expect(wapPage.getByRole('complementary', { name: 'Seitenfeld' })).toBeVisible();
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', planFile(planZehnBeso()));
    await wapPage.getByRole('tab', { name: 'Wo 1' }).click();
    await expect(wapPage.getByRole('note', { name: 'Nächster Schritt' })).toHaveCount(0);
  });

  test('[R-5.6-09] I5 D4: Wiederherstellungspunkte mit Zeitpunkt, Grund und Umfang; Wiederherstellen stellt den Zustand her und ist selbst rückgängig machbar', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', planFile(planZehnBeso()));
    await beso(wapPage, '10', 'Visite 1').click();
    await wapPage.keyboard.press('Delete');
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Wiederherstellungspunkte', exact: true });
    const table = dialog.getByRole('table');
    await expect(table).toContainText('täglich');
    await expect(table).toContainText('11 Einträge');
    await dialog
      .getByRole('button', { name: /^Wiederherstellen: täglich/ })
      .first()
      .click();
    await expect(dialog).toBeHidden();
    await expect(beso(wapPage, '10', 'Visite 1')).toBeVisible();
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      'wiederhergestellt',
    );
    await wapPage.keyboard.press('Control+z');
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    await expect(dialog.getByRole('table')).toContainText('vor Wiederherstellung');
  });

  test('[R-5.6-03][R-5.6-10] I5 D4: «letzte Datei-Sicherung noch nie / vor 2 Tagen»; Erinnerung beim Schliessen nur nach mehr als einem Arbeitstag mit ungesicherten Änderungen', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-12T09:00:00+02:00');
    await createPlan(wapPage, `${url()}#leer`, 'Sicherung Übungsplan');
    await expect(wapPage.getByText(/letzte Datei-Sicherung noch nie/)).toBeVisible();
    await createBlockWithKeyboard(wapPage, 'Sicherungsblock');
    const remind = () =>
      wapPage.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
    await download(wapPage, () =>
      wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click(),
    );
    await expect(wapPage.getByText(/letzte Datei-Sicherung heute/)).toBeVisible();
    await clockAt('2026-10-12T09:05:00+02:00');
    await wapPage.getByRole('button', { name: /^Block Sicherungsblock / }).click();
    await wapPage.keyboard.press('Delete');
    await expect(wapPage.getByRole('button', { name: /^Block Sicherungsblock / })).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Speicher', exact: true })).toContainText(
      'Gespeichert',
    );
    expect(await remind()).toBe(false);
    await clockAt('2026-10-14T10:00:00+02:00');
    await wapPage.keyboard.press('?');
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByText(/letzte Datei-Sicherung vor 2 Tagen/)).toBeVisible();
    expect(await remind()).toBe(true);
    await download(wapPage, () => wapPage.keyboard.press('Control+s'));
    await expect(wapPage.getByText(/letzte Datei-Sicherung heute/)).toBeVisible();
    expect(await remind()).toBe(false);
  });

  test('[R-5.6-11][R-5.6-12] I5 D4: deutliche Warnung bei nicht dauerhaftem und bei vollem Speicher (simuliert), mit nächstem Schritt; Hinweis für die Sitzung schliessbar', async ({
    wapPage,
  }) => {
    await wapPage.addInitScript(() => {
      const s = navigator.storage;
      Object.defineProperty(s, 'persisted', { value: async () => false });
      Object.defineProperty(s, 'persist', { value: async () => false });
      Object.defineProperty(s, 'estimate', { value: async () => ({ usage: 930, quota: 1000 }) });
    });
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', planFile(planZehnBeso()));
    const persist = wapPage.getByRole('status', { name: 'Speicherhinweis' });
    await expect(persist).toContainText('Speicher nicht dauerhaft');
    await expect(persist).toContainText('Plan-Datei regelmässig sichern');
    const full = wapPage.getByRole('status', { name: 'Speicher fast voll' });
    await expect(full).toContainText('93 %');
    await expect(full).toContainText('Jetzt die Plan-Datei sichern');
    await full.getByRole('button', { name: 'Speicher verwalten …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Wiederherstellungspunkte', exact: true });
    await expect(dialog).toContainText('nein – der Browser darf die Pläne bei Platzmangel löschen');
    await expect(dialog).toContainText('93 % des lokalen Speichers');
    await wapPage.keyboard.press('Escape');
    await persist.getByRole('button', { name: 'Hinweis schliessen', exact: true }).click();
    await expect(persist).toHaveCount(0);
    await wapPage.reload();
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
    await expect(wapPage.getByRole('status', { name: 'Speicher fast voll' })).toBeVisible();
    await expect(wapPage.getByRole('status', { name: 'Speicherhinweis' })).toHaveCount(0);
  });

  test('[R-5.6-13][R-5.7-04] I5 D4: Öffnen überschreibt nie still (Behalten, Als Kopie öffnen); defekte und neuere Plan-Datei werden mit Ursache und nächstem Schritt abgelehnt, nichts bricht still ab', async ({
    wapPage,
  }) => {
    const bytes = planFile(planZehnBeso());
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', bytes);
    await beso(wapPage, '10', 'Visite 1').click();
    await wapPage.keyboard.press('Delete');
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    const chooser = wapPage.waitForEvent('filechooser');
    await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
    await (await chooser).setFiles({
      name: 'Zehn.wap.json',
      mimeType: 'application/json',
      buffer: bytes,
    });
    const ask = wapPage.getByRole('dialog', { name: /^Plan (als Kopie öffnen|-Datei öffnen)$/ });
    await expect(
      ask.getByRole('button', { name: 'Lokalen Stand behalten', exact: true }),
    ).toBeVisible();
    await expect(
      ask.getByRole('button', { name: 'Durch Datei ersetzen', exact: true }),
    ).toBeVisible();
    await ask.getByRole('button', { name: 'Lokalen Stand behalten', exact: true }).click();
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    // Neuere Formatversion: abgelehnt mit Hinweis, lokaler Plan unverändert.
    const newer = JSON.parse(bytes.toString('utf8')) as { version: number };
    newer.version = 999;
    const c2 = wapPage.waitForEvent('filechooser');
    await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
    await (await c2).setFiles({
      name: 'Neuer.wap.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(newer)),
    });
    const alert = wapPage.getByRole('alert');
    await expect(alert).toContainText(/neueren Version|neuere Version/);
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
    const c3 = wapPage.waitForEvent('filechooser');
    await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
    await (await c3).setFiles({
      name: 'Defekt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{'),
    });
    await expect(wapPage.getByRole('alert')).toContainText(/Datei/);
    await expect(beso(wapPage, null, 'Visite 2')).toBeVisible();
  });

  test('[R-L-07][R-5.5-04] I5 D2/D5: «Neuen Stand setzen» sperrt die Bearbeitung (modaler Fortschritt), «Abbrechen» schreibt nichts, die vorher gespeicherte Änderung überlebt; gewöhnlicher PDF-Export sperrt nicht', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer-gate`, 'Zehn.wap.json', planFile(planZehnBeso()));
    // Vorher gespeicherte Änderung.
    await beso(wapPage, '10', 'Visite 1').click();
    await wapPage.keyboard.press('Delete');
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Speicher', exact: true })).toContainText(
      'Gespeichert',
    );
    // Gewöhnlicher PDF-Export: kein modaler Fortschritt.
    await download(wapPage, () => pdfDieserWoche(wapPage));
    await expect(wapPage.getByRole('dialog')).toHaveCount(0);
    const setStand = async () => {
      await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
      await wapPage
        .getByRole('dialog', { name: 'Neuen Stand setzen', exact: true })
        .getByRole('button', { name: 'Stand setzen', exact: true })
        .click();
    };
    await setStand();
    const progress = wapPage.getByRole('dialog', { name: 'Stand wird gesetzt …', exact: true });
    await expect(progress).toBeVisible();
    await expect
      .poll(() => wapPage.evaluate(() => window.__wapTestGate?.waiting() ?? 0))
      .toBeGreaterThan(0);
    await expect(progress.getByRole('status')).toContainText('Schritt 2 von 3');
    await expect(progress.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
    // Eingaben wirken nicht: Raster und Rückgängig liegen unter dem modalen Dialog.
    await wapPage.keyboard.press('Control+z');
    await beso(wapPage, null, 'Visite 2')
      .click({ force: true, timeout: 2000 })
      .catch(() => undefined);
    await wapPage.keyboard.press('Delete');
    await expect(beso(wapPage, null, 'Visite 2')).toHaveCount(1);
    await progress.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(progress).toBeHidden();
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      'Stand nicht gesetzt: abgebrochen.',
    );
    await expect(wapPage.getByText('Noch kein Stand')).toBeVisible();
    await wapPage.reload();
    await expect(beso(wapPage, null, 'Visite 2')).toBeVisible();
    await expect(beso(wapPage, '10', 'Visite 1')).toHaveCount(0);
    await expect(wapPage.getByText('Noch kein Stand')).toBeVisible();
    // Zweiter Versuch: Rendern freigeben, Stand wird vollständig gesetzt.
    await setStand();
    await expect(progress).toBeVisible();
    await wapPage.evaluate(() => window.__wapTestGate?.open());
    await expect(progress).toBeHidden();
    await expect(wapPage.getByText(/^Stand \d{2}\.\d{2}\.\d{4} · V1$/)).toBeVisible();
    await expect(beso(wapPage, null, 'Visite 2')).toBeVisible();
  });

  test('[R-11-07][R-11-08] I5 D5: alle neuen Befehle per Tastatur (Ctrl+., F8, Stand, PDF-Export, Wiederherstellungspunkte) mit sichtbarem Fokus', async ({
    wapPage,
    focusVisible,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Export.wap.json', planFile(planExport()));
    await wapPage
      .getByRole('button', { name: /^Mo 28\.09\. 0800 / })
      .first()
      .focus();
    await wapPage.keyboard.press('F8');
    const focused = wapPage.locator(':focus');
    await expect(focused).toHaveAttribute('aria-pressed', 'true');
    await wapPage.keyboard.press('Control+.');
    const panel = findingsPanel(wapPage);
    await expect(panel).toBeVisible();
    const jump = panel.getByRole('button', { name: /^Zur Stelle:/ }).first();
    await jump.focus();
    await wapPage.keyboard.press('ArrowDown');
    await expect(panel.getByRole('button', { name: /^Zur Stelle:/ }).nth(1)).toBeFocused();
    for (const name of ['Neuen Stand setzen …', 'PDF …', 'Wiederherstellungspunkte …']) {
      const b = wapPage.getByRole('button', { name, exact: true });
      const f = await focusVisible(b);
      expect(f.sichtbar, name).toBe(true);
      expect(f.kontrast, name).toBeGreaterThanOrEqual(3);
      await b.focus();
      await wapPage.keyboard.press('Enter');
      await expect(wapPage.getByRole('dialog')).toBeVisible();
      await wapPage.keyboard.press('Escape');
      await expect(wapPage.getByRole('dialog')).toHaveCount(0);
    }
    const f = await focusVisible(jump);
    expect(f.sichtbar).toBe(true);
  });

  test('[R-11-09][R-11-08] I5 D5: Barrierefreiheit der Kernzustände (axe, keine Verstösse serious/critical, Kontrast ≥ 4,5:1)', async ({
    wapPage,
    a11y,
  }) => {
    // F-FLAKY (FL-03): keine Zeitanforderung; axe-Prüfung mehrerer Kernzustände, zusammen 5–16 s, unter Rechnerlast über
    // 30 s – Zeitlimit als Schutz vor Hängern statt der Vorgabe 30 s.
    test.setTimeout(120_000);
    const pruefe = async (zustand: string) => {
      const r = await a11y();
      const schwer = r.verstoesse.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(schwer, `${zustand}: ${JSON.stringify(schwer)}`).toEqual([]);
    };
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    await expect(wapPage.getByRole('region', { name: 'Ein neuer Wochenplan' })).toBeVisible();
    await pruefe('Erststart');
    await openPlanFile(wapPage, 'Export.wap.json', planFile(planExport()));
    await pruefe('Woche mit Einträgen und Befunden');
    await wapPage.keyboard.press('Control+.');
    await expect(findingsPanel(wapPage)).toBeVisible();
    await pruefe('Befundliste');
    await openPdfDialog(wapPage);
    await pruefe('PDF-Export mit Fehlern');
    await wapPage.keyboard.press('Escape');
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    await expect(
      wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true }),
    ).toBeVisible();
    await pruefe('Neuen Stand setzen');
    await wapPage.keyboard.press('Escape');
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    await expect(wapPage.getByRole('table')).toBeVisible();
    await pruefe('Wiederherstellungspunkte');
  });

  test('[R-2-01][R-11-06][R-9-01][R-11-03] I5 D5: sichtbare Texte nach Glossar (keine verbotenen Synonyme), Schweizer Schreibweise ohne «ß», Zeiten militärisch; ohne Detachementsplaner nutzbar, keine Netzanfragen', async ({
    wapPage,
    requests,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Export.wap.json', planFile(planExport()));
    const texte: string[] = [];
    const sammle = async () => texte.push(await wapPage.locator('body').innerText());
    await sammle();
    await wapPage.keyboard.press('Control+.');
    await expect(findingsPanel(wapPage)).toBeVisible();
    await findingsPanel(wapPage).getByRole('button', { name: 'Ganzer Plan', exact: true }).click();
    await sammle();
    await openPdfDialog(wapPage);
    await sammle();
    await wapPage.keyboard.press('Escape');
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    await expect(
      wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true }),
    ).toBeVisible();
    await sammle();
    await wapPage.keyboard.press('Escape');
    await wapPage.getByRole('button', { name: 'Wiederherstellungspunkte …', exact: true }).click();
    await expect(wapPage.getByRole('table')).toBeVisible();
    await sammle();
    await wapPage.keyboard.press('Escape');
    const alles = texte.join('\n');
    expect(alles).not.toContain('ß');
    for (const verboten of [
      'Backup',
      'Snapshot',
      'Validierung',
      'Issue',
      'Undo',
      'Kalender',
      'Projektdatei',
      'Release',
      'storniert',
      'Spaltenvorlage',
    ])
      expect(alles, verboten).not.toContain(verboten);
    // Zeiten militärisch: kein «hh:mm» ausser der Speicheranzeige «Gespeichert hh:mm».
    const doppelpunkt = alles
      .split('\n')
      .filter((z) => /\b\d{1,2}:\d{2}\b/.test(z) && !/Gespeichert \d{2}:\d{2}/.test(z));
    expect(doppelpunkt).toEqual([]);
    // Ohne Detachementsplaner-Daten: Eintrag, PDF und Plan-Datei gelingen.
    await download(wapPage, () => pdfDieserWoche(wapPage));
    await download(wapPage, () => wapPage.keyboard.press('Control+s'));
    expect(
      requests.every((r) =>
        /^(http:\/\/127\.0\.0\.1:\d+\/|file:|data:|blob:|ws:\/\/127\.0\.0\.1:)/.test(r),
      ),
    ).toBe(true);
  });

  test('[R-3-02] I5 D5: fiktive Einheit, eigene Legende und Motto erscheinen im PDF; im Code keine fest hinterlegten Einheiten', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Fiktiv.wap.json', planFile(planFiktiv()));
    const pdf = await download(wapPage, () => pdfDieserWoche(wapPage));
    const text = (await pdfInfo(pdf.bytes)).texts.map((t) => t.text).join(' ');
    expect(text).toContain('Fikt Kp 77/9');
    expect(text).toContain('IMMER WEITER');
    for (const fremd of ['61/4', 'PICASSO', 'TRAGEN']) expect(text).not.toContain(fremd);
    const treffer: string[] = [];
    const gehe = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) gehe(p);
        else if (/\.(ts|tsx)$/.test(n) && !/template|fixture/i.test(p)) {
          const s = readFileSync(p, 'utf8');
          for (const fremd of ['61/4', 'PICASSO', 'TRAGEN'])
            if (s.includes(fremd)) treffer.push(fremd);
        }
      }
    };
    gehe(join(process.cwd(), 'src', 'components', 'wap'));
    gehe(join(process.cwd(), 'src', 'model', 'wap'));
    expect(treffer).toEqual([]);
  });

  test('[R-11-10] I5 D5: Lesen auf dem Tablet = PDF: Seite im Querformat, Text durchsuchbar, Schrift eingebettet (vektoriell, zoombar)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zehn.wap.json', planFile(planZehnBeso()));
    const pdf = await download(wapPage, () => pdfDieserWoche(wapPage));
    const info = await pdfInfo(pdf.bytes);
    const page = info.pages[0];
    expect(page && page.widthPt > page.heightPt).toBe(true);
    expect(info.texts.some((t) => t.text.includes('Visite 1'))).toBe(true);
    expect(info.fonts.length).toBeGreaterThan(0);
    expect(info.fonts.every((f) => f.embedded && f.toUnicode)).toBe(true);
    expect(info.images).toBe(0);
  });
}

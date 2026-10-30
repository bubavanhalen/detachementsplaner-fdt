// F-UX6 (Nacharbeit Gate B, lokal .qa/e1-ab/sa34-gateb.md; Auftrag Koordinator 29.10.2026): Listenansicht.
// - UX-AB-G-16: zügiges Tippen in eine gewählte Zelle verliert kein Zeichen (auch AltGr); danach wirken →,
//   Rücktaste und Enter; nach einem abgelehnten Wert gehen Tasten in den offenen Editor statt verloren.
// - UX-AB-G-12: Klick auf eine Zelle einer anderen Woche bei offenem Importbericht – Fokus in der Zelle, die folgende
//   Eingabe kommt an (auch beim Zurückwechseln und in der Zeit-Spalte).
// - UX-AB-G-01: Spalten-Zelle mit mehreren Spalten («Rap, ‹Spalte›»); eine unbekannte Spalte wird mit Ursache und
//   nächstem Schritt abgelehnt statt still eine andere zu wählen.
// Nur im Entwicklungsserver (Import mit Worker); fiktive Arbeitsmappe.
import { expect, type Locator, type Page } from '@playwright/test';
import { block, bold, buildKpWorkbook, emptyWeek } from '../../wap/fixtures/import/kp-workbook';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/list/support/import.html';
const RAP = 3;
const KDO = 0;

function workbook(): Buffer {
  return Buffer.from(
    buildKpWorkbook([
      emptyWeek({
        shapes: [
          block(0, [KDO, KDO], '0800', '0900', [[bold('Antreten Eins')]]),
          // Rapport in Rap- und Planungsspalte mit verschiedener Zeit (verdeckt): zwei Rapporte (UX-AB-F-06).
          block(0, [RAP, RAP], '2000', '2200', [[bold('KR')]]),
          block(0, [KDO, KDO], '2000', '2200', [[bold('KR')]]),
          block(0, [KDO, KDO], '2130', '2300', [[bold('Nachtübung')]]),
        ],
      }),
      emptyWeek({
        sheet: 'Wo 2',
        title: 'Inf Fik Kp 99/9 Arbeitsplan Woche 2',
        monday: '2099-10-12',
        shapes: [block(1, [KDO, KDO], '1000', '1100', [[bold('Theorie Zwei')]])],
      }),
    ]),
  );
}

async function importieren(page: Page): Promise<void> {
  await page.goto(URL);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Excel-WAP importieren', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type="file"][aria-label="Excel-WAP importieren"]').setInputFiles({
    name: 'fiktiv-ux6.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
  await expect(page.getByRole('dialog', { name: 'Importbericht «fiktiv-ux6.xlsx»' })).toBeVisible();
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
}

/** Langsamer Rechner (CPU gedrosselt): das Öffnen des Editors bzw. der Wochenwechsel dauert länger als ein Tastenabstand. */
async function langsam(page: Page, rate = 6): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
}

/**
 * Ein Zeichen mit Tastendruck wie auf der CH-Tastatur (keydown mit `key` und Text), auch Umlaute und Akzente; Playwright
 * kennt dafür keine Taste und fügte sie sonst ohne Tastendruck als Text ein.
 */
async function taste(page: Page, ch: string, delay: number): Promise<void> {
  if (/^[ -~]$/.test(ch)) {
    await page.keyboard.press(ch, { delay });
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: ch,
    text: ch,
    unmodifiedText: ch,
  });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  await cdp.detach();
  if (delay > 0) await page.waitForTimeout(delay);
}

const grid = (page: Page) => page.getByRole('grid', { name: /^Einträge / });

async function zelle(page: Page, zeile: string, spalte: string, nr = 0): Promise<Locator> {
  const headers = (await grid(page).getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
  const i = headers.findIndex((h) => h === spalte || h.startsWith(`${spalte} `));
  if (i < 0) throw new Error(`Spalte ${spalte} fehlt`);
  return grid(page)
    .locator('tbody tr')
    .filter({ hasText: zeile })
    .nth(nr)
    .getByRole('gridcell')
    .nth(i);
}

test('[R-6-15][R-11-07] F-UX6 UX-AB-G-16: zügiges Tippen in eine gewählte Zelle verliert kein Zeichen (0, 5, 10 ms je Zeichen); danach wirken →, Rücktaste und Enter', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  await langsam(wapPage);
  // Auch Umlaute und Akzente am Anfang (je Zeichen ein Tastendruck wie auf der CH-Tastatur; `keyboard.type` fügte
  // Zeichen ausserhalb der US-Tastatur ohne Tastendruck als Text ein – das kommt auf einer Zelle nie an).
  for (const [delay, text] of [
    [0, 'Hptm Muster Null'],
    [5, 'Oblt Fünf Fünf'],
    [10, 'Lt Zehn Zehn'],
    [15, 'Übung Örtli'],
    [0, 'é-Test Zürich'],
  ] as const) {
    const ltg = await zelle(wapPage, 'Antreten Eins', 'Ltg');
    await ltg.click();
    await expect(ltg).toBeFocused();
    for (const ch of text) await taste(wapPage, ch, delay);
    await wapPage.keyboard.press('Enter');
    await expect(await zelle(wapPage, 'Antreten Eins', 'Ltg')).toHaveText(text);
  }
  // AltGr-Zeichen (Windows meldet Ctrl+Alt, z.B. «@» auf der CH-Tastatur) beginnen die Bearbeitung.
  const ltgAt = await zelle(wapPage, 'Antreten Eins', 'Ltg');
  await ltgAt.click();
  await wapPage.keyboard.down('Control');
  await wapPage.keyboard.down('Alt');
  await wapPage.keyboard.press('@');
  await wapPage.keyboard.up('Alt');
  await wapPage.keyboard.up('Control');
  await wapPage.keyboard.type('Raum', { delay: 0 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Antreten Eins', 'Ltg')).toHaveText('@Raum');
  // Nach dem Übernehmen: → zur Ort-Zelle, tippen, Enter; Rücktaste leert, Enter wirkt sofort.
  const ltg = await zelle(wapPage, 'Antreten Eins', 'Ltg');
  await ltg.click();
  await wapPage.keyboard.press('ArrowRight');
  const ort = await zelle(wapPage, 'Antreten Eins', 'Ort');
  await expect(ort).toBeFocused();
  await wapPage.keyboard.type('Halle Nord', { delay: 0 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Antreten Eins', 'Ort')).toHaveText('Halle Nord');
  const ort2 = await zelle(wapPage, 'Antreten Eins', 'Ort');
  await ort2.click();
  await wapPage.keyboard.press('Backspace');
  await expect(await zelle(wapPage, 'Antreten Eins', 'Ort')).toHaveText('');
  await expect(wapPage.getByRole('textbox', { name: 'Ort', exact: true })).toHaveCount(0);
});

test('[R-6-15][R-5.7-04] F-UX6 UX-AB-G-16: bleibt nach einem ungültigen Wert der Editor mit Meldung offen, gehen Tasten nach einem Klick auf eine andere Zelle in den Editor statt still verloren; Esc verwirft, danach wirkt Tippen auf der Zelle', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  const zeit = await zelle(wapPage, 'Antreten Eins', 'Zeit');
  await zeit.click();
  await wapPage.keyboard.type('xyz', { delay: 5 });
  await wapPage.keyboard.press('Enter');
  await expect(wapPage.getByRole('alert').first()).toBeVisible();
  const feld = wapPage.getByRole('textbox', { name: 'Zeit', exact: true });
  await expect(feld).toBeFocused();
  // Klick auf eine andere Zelle und weiter tippen: die Zeichen landen im offenen Editor.
  await (await zelle(wapPage, 'Antreten Eins', 'Ltg')).click();
  await wapPage.keyboard.type('Q', { delay: 5 });
  await expect(feld).toHaveValue(/Q$/);
  await expect(feld).toBeFocused();
  await wapPage.keyboard.press('Escape');
  await expect(feld).toHaveCount(0);
  const ltg = await zelle(wapPage, 'Antreten Eins', 'Ltg');
  await ltg.click();
  await wapPage.keyboard.type('Wm Nach Esc', { delay: 0 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Antreten Eins', 'Ltg')).toHaveText('Wm Nach Esc');
});

test('[R-6-15][R-11-07] F-UX6 UX-AB-G-12: offener Importbericht – Klick auf eine Zelle einer anderen Woche (hin und zurück, auch Zeit) lässt den Fokus in der Zelle, die Eingabe kommt an', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  await wapPage.getByRole('radio', { name: 'Ganzer Plan' }).check();
  await langsam(wapPage);
  const zeit = await zelle(wapPage, 'Theorie Zwei', 'Zeit');
  await zeit.click();
  await expect(zeit).toBeFocused();
  await wapPage.keyboard.type('1015-1130', { delay: 5 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Theorie Zwei', 'Zeit')).toHaveText('1015-1130');
  // Zurück in die erste Woche.
  const titel = await zelle(wapPage, 'Antreten Eins', 'Titel');
  await titel.click();
  await expect(titel).toBeFocused();
  await wapPage.keyboard.type('Antreten Neu', { delay: 5 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Antreten Neu', 'Titel')).toHaveText('Antreten Neu');
  // Und wieder hinüber, sofort tippen (ohne Warten).
  const t2 = await zelle(wapPage, 'Theorie Zwei', 'Titel');
  await t2.click();
  await wapPage.keyboard.type('Theorie Drei', { delay: 0 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'Theorie Drei', 'Titel')).toHaveText('Theorie Drei');
});

test('[R-6-15] F-UX6 UX-AB-G-01: Spalten-Zelle – «Rap, Kdo» setzt mehrere Spalten; eine unbekannte Spalte wird mit Ursache und nächstem Schritt abgelehnt', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  // Der Rapport in der Rap-Spalte (der zweite steht in «Kdo»).
  let nr = 0;
  while ((await (await zelle(wapPage, 'KR', 'Spalten', nr)).innerText()).trim() !== 'Rap') nr++;
  const spalten = await zelle(wapPage, 'KR', 'Spalten', nr);
  await expect(spalten).toHaveText('Rap');
  await spalten.click();
  await wapPage.keyboard.press('F2');
  const feld = wapPage.getByRole('combobox', { name: 'Spalten', exact: true });
  await expect(feld).toBeFocused();
  await wapPage.keyboard.press('End');
  await wapPage.keyboard.type(', Kdo', { delay: 5 });
  await wapPage.keyboard.press('Enter');
  await expect(await zelle(wapPage, 'KR', 'Spalten', nr)).toHaveText('Rap, Kdo');
  // Unbekannte Spalte: Meldung, nichts still geändert.
  const s2 = await zelle(wapPage, 'KR', 'Spalten', nr);
  await s2.click();
  await wapPage.keyboard.press('F2');
  await wapPage.keyboard.press('End');
  await wapPage.keyboard.type(', Xyz', { delay: 5 });
  await wapPage.keyboard.press('Enter');
  await expect(wapPage.getByRole('alert').filter({ hasText: 'Xyz' })).toContainText(
    'Die Spalte «Xyz» gibt es an diesem Tag nicht.',
  );
  await wapPage.keyboard.press('Escape');
  await expect(await zelle(wapPage, 'KR', 'Spalten', nr)).toHaveText('Rap, Kdo');
});

test('[R-6-15] F-UX6 Enter wie Excel (Entscheid Auftraggeber 29.10.2026): Enter auf der Zelle eine Zeile tiefer, Shift+Enter höher; F2 bzw. Tippen bearbeitet; im Editor übernimmt Enter und geht tiefer, Shift+Enter übernimmt und geht höher', async ({
  wapPage,
}) => {
  await importieren(wapPage);
  const kopf = (await grid(wapPage).getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
  const titel = kopf.indexOf('Titel');
  const zeilen = grid(wapPage).locator('tbody tr');
  const z = (r: number) => zeilen.nth(r).getByRole('gridcell').nth(titel);
  await z(0).click();
  await wapPage.keyboard.press('Enter');
  await expect(z(1)).toBeFocused();
  await expect(grid(wapPage).getByRole('textbox')).toHaveCount(0);
  await wapPage.keyboard.press('Shift+Enter');
  await expect(z(0)).toBeFocused();
  // F2 bearbeitet; Enter übernimmt und geht tiefer.
  await wapPage.keyboard.press('F2');
  const feld = grid(wapPage).getByRole('textbox', { name: 'Titel', exact: true });
  await expect(feld).toBeFocused();
  await feld.fill('Erste Zeile neu');
  await wapPage.keyboard.press('Enter');
  await expect(z(0)).toHaveText('Erste Zeile neu');
  await expect(z(1)).toBeFocused();
  // Tippen bearbeitet; Shift+Enter übernimmt und geht höher.
  const vorher = (await z(1).innerText()).trim();
  await wapPage.keyboard.type('Zweite neu', { delay: 5 });
  await wapPage.keyboard.press('Shift+Enter');
  await expect(z(0)).toBeFocused();
  await expect(z(1)).toHaveText('Zweite neu');
  expect(vorher).not.toBe('Zweite neu');
});

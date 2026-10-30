// I3 «Alle Eintragstypen im Editor, Seitenfeld, Einstellungen» (C1–C4): Abläufe über Rolle und Name mit Maus und
// Tastatur im Entwicklungsserver und in der Einzeldatei. Nur fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile, serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { updateTimeWindow } from '../../../../src/model/wap/commands/beso';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { xlsxMitZusatz } from '../../../wap/support/i3/personen';
import { CTX, kpPlan } from '../../../wap/support/i3/plan';
import { type PdfInfo, readPdf } from '../../../wap/support/pdf/read';
import { createPlan } from '../../i2/support/ablauf';
import { area, block, box, drawBlock, MINUTE } from '../../i2b/support/handhabung';
import { test } from '../../support/fixtures';

const FROM = 240;

export function panel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Seitenfeld' });
}

export function cursor(page: Page): Locator {
  return page.getByRole('table', { name: 'Wochenraster', exact: true }).locator('.i2-grid-cursor');
}

async function openPanel(page: Page): Promise<Locator> {
  const p = panel(page);
  if (!(await p.isVisible()))
    await page.getByRole('button', { name: 'Seitenfeld', exact: true }).click();
  await expect(p).toBeVisible();
  return p;
}

/** Feld im Seitenfeld ausfüllen und mit Enter übernehmen. */
async function setField(
  p: Locator,
  name: string,
  value: string,
  role: 'textbox' | 'combobox' = 'textbox',
) {
  const field = p.getByRole(role, { name, exact: true });
  await field.click();
  await field.fill(value);
  await field.press('Enter');
}

async function pdfOf(page: Page): Promise<{ info: PdfInfo; name: string }> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
  // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): zuerst die Befunde der Woche, dann der Export.
  await page
    .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
    .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
    .click();
  const download = await pending;
  const path = await download.path();
  if (path === null) throw new Error('PDF fehlt.');
  return {
    info: await readPdf(new Uint8Array(readFileSync(path))),
    name: download.suggestedFilename(),
  };
}

async function planFileOf(page: Page): Promise<Buffer> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (path === null) throw new Error('Plan-Datei fehlt.');
  return readFileSync(path);
}

async function undoButton(page: Page): Promise<void> {
  const b = page.getByRole('button', { name: 'Rückgängig', exact: true });
  await expect(b).toBeEnabled();
  await b.click();
}

/** Farben und Schnitt der gezeichneten Läufe eines Eintrags (Layout-Schicht am Bildschirm). */
async function runsOf(entry: Locator): Promise<{ text: string; bold: boolean; color: string }[]> {
  return entry.locator('xpath=..').evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.i2-grid-line, .i2-grid-line > span')]
      .filter((s) => s.children.length === 0)
      .map((s) => {
        const cs = getComputedStyle(s);
        return { text: s.textContent ?? '', bold: Number(cs.fontWeight) >= 600, color: cs.color };
      }),
  );
}

const RED = 'rgb(192, 0, 0)';

/** Doppelklick in eine Sonderspalte (Rap/Beso) bei einer Zeit. */
async function dblclickColumn(page: Page, name: string, minutes: number): Promise<void> {
  const b = await box(page.getByRole('button', { name, exact: true }));
  await page.mouse.dblclick(b.x + b.width / 2, b.y + (minutes - FROM) * MINUTE + 2);
}

/** Ziehen von–bis in einer Fläche (y aus Minuten). */
async function dragIn(page: Page, target: Locator, from: number, to: number, toTarget?: Locator) {
  const a = await box(target);
  const b = toTarget === undefined ? a : await box(toTarget);
  await page.mouse.move(a.x + a.width / 2, a.y + (from - FROM) * MINUTE + 1);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + (to - FROM) * MINUTE - 1, { steps: 8 });
  await page.mouse.up();
}

/** Fiktiver Plan mit Stand und verschobenem Beso, als Plan-Datei (für «Tag neu nummerieren»). */
function planWithStand(): Buffer {
  let plan: Plan = { ...kpPlan(2), id: 'i3-e2e-stand', exerciseName: 'Nummern Übungsplan' };
  const ids: string[] = [];
  for (const [at, title] of [
    [420, 'Erste Visite'],
    [450, 'Zweite Visite'],
    [480, 'Dritte Visite'],
  ] as const) {
    const r = createEntry(
      plan,
      {
        type: 'beso',
        date: '2026-09-28',
        title: [{ text: title, bold: false }],
        windows: [{ time: { form: 'point', at } }],
      },
      CTX,
    );
    plan = r.plan;
    ids.push(r.entryId);
  }
  plan = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
  const third = ids[2] as string;
  const w = (plan.entries[third] as Beso).windows[0]?.id ?? '';
  plan = updateTimeWindow(plan, third, w, { time: { form: 'point', at: 360 } }, CTX).plan;
  return Buffer.from(
    serializePlanFile(
      { plan, revision: 1, modifiedAt: '2026-10-14T08:00:00.000Z', stands: [] },
      { now: () => new Date('2026-10-14T08:00:00Z') },
    ),
  );
}

export function registerI3Tests(url: () => string): void {
  let consoleMessages: string[] = [];
  test.beforeEach(({ wapPage }) => {
    consoleMessages = [];
    wapPage.on('console', (message) => {
      const source = message.location().url;
      const vite = message.type() === 'debug' && /\/@vite\/client(?:\?|$)/.test(source);
      const react =
        message.type() === 'info' &&
        source.startsWith('http://127.0.0.1:') &&
        /React DevTools/.test(message.text());
      if (!vite && !react) consoleMessages.push(message.type());
    });
  });
  test.afterEach(() => {
    expect(consoleMessages, 'Die App schreibt keine Konsolenmeldungen.').toEqual([]);
  });

  test('[R-5.1-12][R-5.1-23] I3 C1 Seitenfeld Block (Maus): alle Felder, Änderung sofort im Raster, Titel teilweise fett per Knopf und Ctrl+B, je ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Seitenfeld Übungsplan');
    await drawBlock(wapPage, 'AVOR Fahne', 480, 600);
    await block(wapPage, 'AVOR Fahne').click();
    const p = await openPanel(wapPage);
    await expect(p).toContainText('Block');
    await expect(p.getByRole('textbox', { name: 'Titel', exact: true })).toHaveValue('AVOR Fahne');
    for (const [role, name] of [
      ['textbox', 'Zusatz'],
      ['combobox', 'Tag'],
      ['textbox', 'Zeit'],
      ['combobox', 'Spalten'],
      ['combobox', 'Kategorie'],
      ['combobox', 'Gemeinsame Leitung (zweite Kategorie)'],
      ['combobox', 'Ltg'],
      ['textbox', 'Ort'],
      ['combobox', 'Tn'],
      ['checkbox', 'Tn drucken'],
      ['textbox', 'Tpt'],
      ['textbox', 'Tenue'],
      ['checkbox', 'Tenue drucken'],
      ['radiogroup', 'Status'],
      ['radiogroup', 'Textrichtung'],
      ['checkbox', 'Offenes Ende'],
      ['button', 'Teilaufgabe hinzufügen'],
      ['textbox', 'Interne Notiz'],
    ] as const)
      await expect(p.getByRole(role, { name, exact: true }), name).toBeVisible();
    // Zusatz und Ort: sofort im Raster (Layout-Schicht) und als Undo-Schritt.
    await setField(p, 'Zusatz', 'Zusatz Muster');
    await expect
      .poll(async () => (await runsOf(block(wapPage, 'AVOR Fahne'))).map((r) => r.text).join(' '))
      .toContain('Zusatz Muster');
    await setField(p, 'Zeit', '0900-1130');
    await expect(block(wapPage, 'AVOR Fahne')).toHaveAccessibleName(/0900-1130/);
    await undoButton(wapPage);
    await expect(block(wapPage, 'AVOR Fahne')).toHaveAccessibleName(/0800-1000/);
    // Teil fett (R-5.1-23): «AVOR» markieren, Knopf «Fett» → normal (alles war fett), erneut → fett.
    const title = p.getByRole('textbox', { name: 'Titel', exact: true });
    await title.click();
    await title.press('End');
    for (let i = 0; i < 'Fahne'.length; i++) await title.press('Shift+ArrowLeft');
    await p.getByRole('button', { name: 'Fett (Ctrl+B)', exact: true }).click();
    await title.press('Enter');
    await expect
      .poll(async () =>
        (await runsOf(block(wapPage, 'AVOR Fahne')))
          .filter((r) => r.text.includes('Fahne'))
          .every((r) => !r.bold),
      )
      .toBe(true);
    expect(
      (await runsOf(block(wapPage, 'AVOR Fahne')))
        .filter((r) => r.text.includes('AVOR'))
        .every((r) => r.bold),
    ).toBe(true);
    await expect(p.locator('.wap-panel-preview strong').first()).toHaveText(/AVOR/);
    // Direktbearbeitung: Ctrl+B macht «Fahne» wieder fett.
    await block(wapPage, 'AVOR Fahne').dblclick();
    const inline = wapPage
      .getByRole('group', { name: 'Direktbearbeitung Block' })
      .getByRole('textbox', { name: 'Titel', exact: true });
    await expect(inline).toBeFocused();
    await inline.press('End');
    for (let i = 0; i < 'Fahne'.length; i++) await inline.press('Shift+ArrowLeft');
    await inline.press('Control+b');
    await inline.press('Enter');
    await expect
      .poll(async () =>
        (await runsOf(block(wapPage, 'AVOR Fahne')))
          .filter((r) => /AVOR|Fahne/.test(r.text))
          .every((r) => r.bold),
      )
      .toBe(true);
    // Status offen → Titel rot am Bildschirm (wie im PDF).
    await p.getByRole('radio', { name: 'offen', exact: true }).click();
    await expect
      .poll(async () => (await runsOf(block(wapPage, 'AVOR Fahne'))).some((r) => r.color === RED))
      .toBe(true);
    await undoButton(wapPage);
    await expect
      .poll(async () => (await runsOf(block(wapPage, 'AVOR Fahne'))).some((r) => r.color === RED))
      .toBe(false);
  });

  test('[R-5.1-12] I3 C1 Seitenfeld nur Tastatur: E öffnet mit dem Titel, Felder per Tab, Esc zurück zum Eintrag, X streicht, Feldsprung O', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Tastatur Seitenfeld');
    await expect(cursor(wapPage)).toBeFocused();
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.type('Tastaturblock');
    await wapPage.keyboard.press('Enter');
    const b = block(wapPage, 'Tastaturblock');
    await expect(b).toBeFocused();
    await wapPage.keyboard.press('e');
    const p = panel(wapPage);
    await expect(p.getByRole('textbox', { name: 'Titel', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Tab');
    await wapPage.keyboard.press('Tab');
    await expect(p.getByRole('textbox', { name: 'Zusatz', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Zusatz per Tastatur');
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.press('Escape');
    await expect(b).toBeFocused();
    // Feldsprung O bei offenem Seitenfeld.
    await wapPage.keyboard.press('o');
    await expect(p.getByRole('textbox', { name: 'Ort', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Halle');
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.press('Escape');
    await expect(b).toBeFocused();
    // X streicht (Status gestrichen), Meldung mit Rückgängig; Seitenfeld zeigt den Status.
    await wapPage.keyboard.press('x');
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText('gestrichen');
    await expect(p.getByRole('radio', { name: 'gestrichen', exact: true })).toBeChecked();
    await wapPage.keyboard.press('x');
    await expect(p.getByRole('radio', { name: 'bestätigt', exact: true })).toBeChecked();
    // Status per Segment mit Pfeilen.
    await wapPage.keyboard.press('e');
    const status = p.getByRole('radio', { name: 'bestätigt', exact: true });
    await status.focus();
    await wapPage.keyboard.press('ArrowRight');
    await expect(p.getByRole('radio', { name: 'offen', exact: true })).toBeChecked();
    await wapPage.keyboard.press('Escape');
    await expect(b).toBeFocused();
    await wapPage.keyboard.press('Control+z');
    await expect(p.getByRole('radio', { name: 'bestätigt', exact: true })).toBeChecked();
    // Ort bleibt erhalten (Seitenfeld zeigt den Plan).
    await expect(p.getByRole('textbox', { name: 'Ort', exact: true })).toHaveValue('Halle');
  });

  test('[R-5.1-25][R-6-41] I3 C1 Teilaufgaben im Seitenfeld (Maus und Tastatur): hinzufügen, bearbeiten, verschieben, entfernen; Detail beim Überfahren; Undo nach Neuladen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Teilaufgaben Übungsplan');
    await drawBlock(wapPage, 'Postenlauf', 480, 720);
    await block(wapPage, 'Postenlauf').click();
    const p = await openPanel(wapPage);
    await p.getByRole('button', { name: 'Teilaufgabe hinzufügen', exact: true }).click();
    const grid = p.getByRole('grid', { name: 'Teilaufgaben' });
    await expect(grid).toBeVisible();
    await setField(grid, 'Titel Teilaufgabe 1', 'Karte');
    // Tastatur: Knopf per Fokus und Enter, Felder tippen.
    const add = p.getByRole('button', { name: 'Teilaufgabe hinzufügen', exact: true });
    await add.focus();
    await wapPage.keyboard.press('Enter');
    const second = grid.getByRole('textbox', { name: 'Titel Teilaufgabe 2', exact: true });
    await second.focus();
    await wapPage.keyboard.press('Control+a');
    await wapPage.keyboard.type('Kompass');
    await wapPage.keyboard.press('Enter');
    await setField(grid, 'Ort Teilaufgabe 2', 'Wald', 'textbox');
    await grid.getByRole('button', { name: 'Teilaufgabe 2 nach oben', exact: true }).click();
    await expect(
      grid.getByRole('textbox', { name: 'Titel Teilaufgabe 1', exact: true }),
    ).toHaveValue('Kompass');
    // Detail beim Überfahren zeigt die Teilaufgaben in Reihenfolge (R-6-41).
    await block(wapPage, 'Postenlauf').hover();
    const card = wapPage.getByRole('tooltip', { name: 'Details zum Eintrag' });
    await expect(card).toContainText('Teilaufgaben: Kompass (Wald); Karte');
    await grid.getByRole('button', { name: 'Teilaufgabe 2 entfernen', exact: true }).click();
    await expect(
      grid.getByRole('textbox', { name: 'Titel Teilaufgabe 2', exact: true }),
    ).toHaveCount(0);
    // Undo auch nach Neuladen.
    await wapPage.reload();
    await expect(block(wapPage, 'Postenlauf')).toBeVisible();
    await undoButton(wapPage);
    await block(wapPage, 'Postenlauf').click();
    const p2 = await openPanel(wapPage);
    await expect(
      p2
        .getByRole('grid', { name: 'Teilaufgaben' })
        .getByRole('textbox', { name: 'Titel Teilaufgabe 2', exact: true }),
    ).toHaveValue('Karte');
  });

  test('[R-4.6-13][R-5.1-12] I3 C1/C2 Marker, Querbalken, ganztägige Bemerkung per Kontextmenü (Shift+F10) und Zellzeiger; Marker-Beschriftung aus der Art, nicht frei', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Typen Übungsplan');
    const c = cursor(wapPage);
    await expect(c).toBeFocused();
    // Marker am Zellzeiger (Mo 0800): Menü, M, Art HV.
    await wapPage.keyboard.press('Shift+F10');
    const menu = wapPage.getByRole('menu', { name: 'Leere Fläche' });
    await expect(menu).toBeVisible();
    await wapPage.keyboard.press('m');
    const md = wapPage.getByRole('dialog', { name: 'Neuer Marker', exact: true });
    await md.getByRole('combobox', { name: 'Art', exact: true }).selectOption('HV');
    await md.getByRole('textbox', { name: 'Zeitpunkt', exact: true }).fill('1330');
    await md.getByRole('button', { name: 'Marker anlegen', exact: true }).click();
    const marker = wapPage.getByRole('button', { name: /^Marker HV 1330 · Mo$/ });
    await expect(marker).toBeVisible();
    await marker.click();
    const p = await openPanel(wapPage);
    await expect(p.getByRole('status', { name: 'Beschriftung des Markers' })).toHaveText('HV');
    await expect(p.getByRole('textbox', { name: /Beschriftung/ })).toHaveCount(0);
    await p.getByRole('radio', { name: 'ABV', exact: true }).click();
    await expect(p.getByRole('status', { name: 'Beschriftung des Markers' })).toHaveText(
      'ABV 1330',
    );
    // Querbalken per Rechtsklick auf leere Fläche (Mo) und Menü.
    const mo = await box(area(wapPage, 'Mo'));
    await wapPage.mouse.click(mo.x + 5, mo.y + (600 - FROM) * MINUTE, { button: 'right' });
    await wapPage
      .getByRole('menu', { name: 'Leere Fläche' })
      .getByRole('menuitem', { name: /Querbalken/ })
      .click();
    const qd = wapPage.getByRole('dialog', { name: 'Neuer Querbalken', exact: true });
    await expect(qd.getByRole('textbox', { name: 'Titel', exact: true })).toBeFocused();
    await wapPage.keyboard.type('OLMA');
    await qd.getByRole('textbox', { name: 'Datum bis', exact: true }).fill('08.10.2026');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Querbalken OLMA Mo–Do · Mo$/ }),
    ).toBeVisible();
    // Ganztägige Bemerkung über das Menü (G) am Zellzeiger.
    await c.focus();
    await wapPage.keyboard.press('Shift+F10');
    await wapPage.keyboard.press('g');
    const rd = wapPage.getByRole('dialog', { name: 'Ganztägige Bemerkung', exact: true });
    await expect(rd.getByRole('textbox', { name: 'Text', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Ausgang ab 1700');
    await wapPage.keyboard.press('Enter');
    const line = wapPage.getByRole('button', { name: 'Terminzeile Ausgang ab 1700' });
    await expect(line).toBeVisible();
    await expect(line).toBeFocused();
    await expect(p.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue(
      'Ausgang ab 1700',
    );
  });

  test('[R-5.1-24][R-4.7-16] I3 C2 Ziehen in Rap-, Beso-Spalte und Band; unbekanntes Rapportkürzel zur Aufnahme vorgeschlagen; Anzeige «auch in Spalten» im Raster', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Ziehen Übungsplan');
    await dragIn(
      wapPage,
      wapPage.getByRole('button', { name: 'Rap-Spalte Mo', exact: true }),
      780,
      840,
    );
    await expect(wapPage.getByRole('textbox', { name: 'Kürzel', exact: true })).toBeFocused();
    await wapPage.keyboard.type('XY9');
    await wapPage.keyboard.press('Enter');
    const rap = wapPage.getByRole('button', { name: /^Rapport XY9 1300-1400 · Mo$/ });
    await expect(rap).toBeVisible();
    await dragIn(
      wapPage,
      wapPage.getByRole('button', { name: 'Beso-Spalte Mo', exact: true }),
      540,
      600,
    );
    await expect(wapPage.getByRole('textbox', { name: 'Termintext', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Visite');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Visite 0900-1000 · Mo$/ }),
    ).toBeVisible();
    // Band über 0500: von Do bis So (eingepasst, damit die ganze Woche sichtbar ist).
    await wapPage.getByRole('button', { name: 'Einpassen' }).click();
    await dragIn(wapPage, area(wapPage, 'Do'), 250, 252, area(wapPage, 'So'));
    const qd = wapPage.getByRole('dialog', { name: 'Neuer Querbalken', exact: true });
    await expect(qd.getByRole('textbox', { name: 'Datum von', exact: true })).toHaveValue(
      '01.10.2026',
    );
    await expect(qd.getByRole('textbox', { name: 'Datum bis', exact: true })).toHaveValue(
      '04.10.2026',
    );
    await wapPage.keyboard.type('OLMA');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Querbalken OLMA Do–So · Do$/ }),
    ).toBeVisible();
    await wapPage.getByRole('button', { name: 'Einpassen' }).click();
    // Unbekanntes Kürzel: Vorschlag im Seitenfeld; ein Block mit unbekanntem Wort ergibt keinen Vorschlag.
    await rap.click();
    const p = await openPanel(wapPage);
    const proposal = p.getByRole('group', { name: 'Unbekanntes Kürzel' });
    await expect(proposal).toContainText('«XY9» steht nicht in der Abkürzungsliste');
    await proposal
      .getByRole('button', { name: '«XY9» in Abkürzungsliste aufnehmen', exact: true })
      .click();
    await expect(proposal).toHaveCount(0);
    await drawBlock(wapPage, 'QQZ unbekannt', 480, 540);
    await block(wapPage, 'QQZ unbekannt').click();
    await expect(p.getByRole('group', { name: 'Unbekanntes Kürzel' })).toHaveCount(0);
    // Kürzelliste: Rapport aus der Liste wählbar; Anzeige auch in Spalten.
    await rap.click();
    await p.getByRole('radio', { name: 'auch in Spalten', exact: true }).click();
    await expect(
      wapPage.getByRole('button', { name: /^Rapport XY9 1300-1400 · Mo · in Spalten$/ }),
    ).toBeVisible();
    await expect(rap).toBeVisible();
    await p.getByRole('radio', { name: 'nur in Spalten', exact: true }).click();
    await expect(wapPage.getByRole('button', { name: /^Rapport XY9 1300-1400 · Mo$/ })).toHaveCount(
      0,
    );
    await expect(
      wapPage.getByRole('button', { name: /^Rapport XY9 1300-1400 · Mo · in Spalten$/ }),
    ).toBeVisible();
  });

  test('[R-5.1-12] I3 C2 Beso im Seitenfeld und Terminbereich: Klick wählt, Doppelklick bearbeitet den Termintext, Zeitfenster, Nummer fixieren, Freitext', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Beso Übungsplan');
    await dblclickColumn(wapPage, 'Beso-Spalte Mo', 600);
    await wapPage.keyboard.type('Arztvisite');
    await wapPage.keyboard.press('Enter');
    const line = wapPage.getByRole('button', { name: /^Terminzeile 10 1000-1030: Arztvisite\./ });
    await expect(line).toBeVisible();
    await line.click();
    await expect(line).toHaveAttribute('aria-pressed', 'true');
    const p = await openPanel(wapPage);
    await expect(p).toContainText('10 · laufend');
    await p.getByRole('button', { name: 'Nummer fixieren', exact: true }).click();
    await expect(p).toContainText('10 · fixiert');
    await p.getByRole('button', { name: 'Zeitfenster hinzufügen', exact: true }).click();
    await setField(p, 'Zeit 2', '1400-1430');
    await setField(p, 'Zusatz 2', 'Zug 1');
    await expect(
      wapPage.getByRole('button', { name: /^Beso 10 Arztvisite 1400-1430 · Mo$/ }),
    ).toBeVisible();
    await expect(
      wapPage.getByRole('button', {
        name: /^Terminzeile 10 Arztvisite: 1000-1030, 1400-1430 Zug 1\./,
      }),
    ).toBeVisible();
    // Doppelklick auf die Terminzeile bearbeitet den Termintext (Titel).
    await wapPage.getByRole('button', { name: /^Terminzeile 10 Arztvisite/ }).dblclick();
    const edit = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(edit).toBeFocused();
    await edit.fill('Sanitätsvisite');
    await edit.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 10 Sanitätsvisite/ }),
    ).toBeFocused();
    // Freitext übersteuert die Terminzeile; die Nummer steht davor.
    await p.getByRole('radio', { name: 'Freitext', exact: true }).click();
    await setField(p, 'Freitext der Terminzeile', 'Visite nach Absprache');
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 10 Visite nach Absprache/ }),
    ).toBeVisible();
    // Status offen → Terminzeile rot.
    await p.getByRole('radio', { name: 'offen', exact: true }).click();
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 10 Visite nach Absprache.*, offen$/ }),
    ).toBeVisible();
    const color = await wapPage
      .getByRole('button', { name: /^Terminzeile 10 Visite/ })
      .locator('span')
      .first()
      .evaluate((s) => getComputedStyle(s).color);
    expect(color).toBe(RED);
  });

  test('[R-5.3-08] I3 C2 «Tag neu nummerieren» ab dem Stand: Vorschau alt → neu, Abbrechen ändert nichts, Bestätigen nummeriert nach Sortierzeit (Maus und Tastatur)', async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    const chooser = wapPage.waitForEvent('filechooser');
    await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
    await (await chooser).setFiles({
      name: 'Nummern.wap.json',
      mimeType: 'application/json',
      buffer: planWithStand(),
    });
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 10 0700: Erste Visite/ }),
    ).toBeVisible();
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 12 0600: Dritte Visite/ }),
    ).toBeVisible();
    // Rechtsklick auf den Tageskopf → Menü → Dialog mit Vorschau; Abbrechen.
    const head = wapPage.getByRole('button', { name: 'Tag Mo 28.09.2026', exact: true });
    await head.click({ button: 'right' });
    await wapPage.getByRole('menuitem', { name: 'Tag neu nummerieren …' }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Tag neu nummerieren', exact: true });
    const table = dialog.getByRole('table', { name: 'Vorschau alt → neu' });
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table).toContainText('Dritte Visite1210');
    await expect(dialog.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 12 0600: Dritte Visite/ }),
    ).toBeVisible();
    // Tastatur: Tageskopf über den Spaltenkopf, Shift+F10, Taste U, Bestätigen.
    await cursor(wapPage).focus();
    await wapPage.keyboard.press('Home');
    await wapPage.keyboard.press('ArrowUp');
    await wapPage.keyboard.press('ArrowUp');
    await expect(head).toBeFocused();
    await wapPage.keyboard.press('Shift+F10');
    await wapPage.keyboard.press('u');
    await dialog.getByRole('button', { name: 'Neu nummerieren', exact: true }).focus();
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 10 0600: Dritte Visite/ }),
    ).toBeVisible();
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 11 0700: Erste Visite/ }),
    ).toBeVisible();
    await undoButton(wapPage);
    await expect(
      wapPage.getByRole('button', { name: /^Terminzeile 12 0600: Dritte Visite/ }),
    ).toBeVisible();
  });

  test('[R-4.7-10][R-4.1-10] I3 C1/C4 Ltg aus Personen- und Funktionsliste mit Vorschlag, Kategorie-Vorschlag gemäss Funktionsliste nur per Aktion', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Ltg Übungsplan');
    // Person von Hand erfassen (Plan-Einstellungen, Personenliste).
    await wapPage.getByRole('button', { name: 'Plan-Einstellungen …', exact: true }).click();
    const s = wapPage.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true });
    await s.getByRole('tab', { name: 'Personenliste', exact: true }).click();
    const form = s.getByRole('form', { name: 'Person von Hand erfassen' });
    await form.getByRole('textbox', { name: 'Grad (neu)', exact: true }).fill('Lt');
    await form.getByRole('textbox', { name: 'Name (neu)', exact: true }).fill('Beispiel');
    await form.getByRole('textbox', { name: 'Vorname (neu)', exact: true }).fill('Ben');
    await form.getByRole('textbox', { name: 'Funktion (neu)', exact: true }).fill('Zfhr');
    await form.getByRole('button', { name: 'Person hinzufügen', exact: true }).click();
    await expect(
      s
        .getByRole('table', { name: 'Personenliste' })
        .getByRole('textbox', { name: 'Name Person 1', exact: true }),
    ).toHaveValue('Beispiel');
    await s.getByRole('button', { name: 'Dialog schliessen', exact: true }).click();
    await drawBlock(wapPage, 'Gefechtsausbildung', 480, 600);
    await block(wapPage, 'Gefechtsausbildung').click();
    const p = await openPanel(wapPage);
    const category = p.getByRole('combobox', { name: 'Kategorie', exact: true });
    const before = await category.inputValue();
    const ltg = p.getByRole('combobox', { name: 'Ltg', exact: true });
    await ltg.click();
    await ltg.pressSequentially('Bei');
    const options = p.getByRole('listbox', { name: 'Vorschläge Ltg' }).getByRole('option');
    await expect(options.first()).toContainText('Lt Beispiel Ben (Zfhr)');
    await ltg.press('ArrowDown');
    await ltg.press('Enter');
    await expect(ltg).toHaveValue('Lt Beispiel');
    // Funktion Zfhr: Vorschlag sichtbar, Kategorie unverändert ohne Aktion.
    await ltg.fill('Zfhr');
    await ltg.press('Enter');
    const proposal = p.getByRole('group', { name: 'Vorschlag Kategorie' });
    await expect(proposal).toContainText('Kategorie «Ltg Zfhr»');
    await expect(category).toHaveValue(before);
    // Per Tastatur übernehmen.
    await proposal
      .getByRole('button', { name: 'Kategorie «Ltg Zfhr» übernehmen', exact: true })
      .focus();
    await wapPage.keyboard.press('Enter');
    await expect(category).not.toHaveValue(before);
    await expect(category.locator('option:checked')).toHaveText('Ltg Zfhr');
    await expect(proposal).toHaveCount(0);
    // Tn aus der Personenliste.
    const tn = p.getByRole('combobox', { name: 'Tn', exact: true });
    await tn.click();
    await tn.pressSequentially('Beis');
    await p.getByRole('listbox', { name: 'Vorschläge Tn' }).getByRole('option').first().click();
    await expect(tn).toHaveValue('Lt Beispiel');
  });

  test('[R-4.1-11][R-4.1-10] I3 C4 Personenliste aus Datei: nur Grad, Name, Vorname, Funktion; AHV, Telefon, Adresse erscheinen nirgends (Seite, Plan-Datei)', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Personen Übungsplan');
    await wapPage.getByRole('button', { name: 'Plan-Einstellungen …', exact: true }).click();
    const s = wapPage.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true });
    // Tastatur: Tabs mit Pfeilen.
    await s.getByRole('tab', { name: 'Plan', exact: true }).focus();
    for (let i = 0; i < 4; i++) await wapPage.keyboard.press('ArrowRight');
    await expect(s.getByRole('tab', { name: 'Personenliste', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const csv = [
      'AHV-Nr;Grad;Name;Telefon;Vorname;Adresse;Funktion',
      'PRUEFWERT-AHV-EINS;Lt;Muster;PRUEFWERT-TELEFON-EINS;Anna;PRUEFWERT-ADRESSE-EINS;Zfhr',
      'PRUEFWERT-AHV-ZWEI;Wm;Probe;PRUEFWERT-TELEFON-ZWEI;Ben;PRUEFWERT-ADRESSE-ZWEI;Einh Fw',
    ].join('\r\n');
    await s
      .getByLabel('Personenliste aus Datei einlesen')
      .setInputFiles({ name: 'personen.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(s.getByRole('status', { name: 'Ergebnis' })).toContainText('2 Personen gelesen');
    await expect(s.getByRole('status', { name: 'Ergebnis' })).toContainText(
      '3 weitere Spalten nicht übernommen',
    );
    const table = s.getByRole('table', { name: 'Personenliste' });
    await expect(table.getByRole('textbox', { name: 'Name Person 2', exact: true })).toHaveValue(
      'Probe',
    );
    // Excel (.xlsx, erstes Blatt) ersetzt die Liste; Zusatzspalten und zweites Blatt werden nicht gelesen.
    await s.getByRole('combobox', { name: 'Beim Einlesen', exact: true }).selectOption('replace');
    await s.getByLabel('Personenliste aus Datei einlesen').setInputFiles({
      name: 'personen.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(xlsxMitZusatz()),
    });
    await expect(s.getByRole('status', { name: 'Ergebnis' })).toContainText(
      '«personen.xlsx»: 2 Personen gelesen',
    );
    await expect(table.getByRole('textbox', { name: 'Name Person 1', exact: true })).toHaveValue(
      'Muster',
    );
    await expect(table.getByRole('textbox', { name: 'Vorname Person 1', exact: true })).toHaveValue(
      'Beispiel',
    );
    await expect(table.getByRole('textbox', { name: /^Name Person/ })).toHaveCount(2);
    // Datei ohne Kopfzeile: Meldung nennt die fehlenden Spalten, nichts geändert.
    await s.getByLabel('Personenliste aus Datei einlesen').setInputFiles({
      name: 'falsch.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Lt;Muster;Anna;Zfhr'),
    });
    await expect(s.getByRole('alert')).toContainText('fehlt in der ersten Zeile');
    await expect(table.getByRole('textbox', { name: /^Name Person/ })).toHaveCount(2);
    const html = await wapPage.content();
    expect(html.includes('PRUEFWERT'), 'Seite ohne verworfene Werte').toBe(false);
    await s.getByRole('button', { name: 'Dialog schliessen', exact: true }).click();
    const file = await planFileOf(wapPage);
    expect(file.includes('PRUEFWERT'), 'Plan-Datei ohne verworfene Werte').toBe(false);
    expect(
      parsePlanFile(new Uint8Array(file)).plan.persons.map(
        (x) => `${x.grad} ${x.name} ${x.vorname} ${x.funktion}`,
      ),
    ).toEqual(['Lt Muster Beispiel Zfhr', 'Wm Probe Test Einh Fw']);
    const stored = await wapPage.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(
      stored.includes('PRUEFWERT'),
      'lokaler Speicher (localStorage) ohne verworfene Werte',
    ).toBe(false);
  });

  test('[R-4.7-22] I3 C3 Plan-Einstellungen: Bedeutung eines Kürzels per Maus und Tastatur, Seitenleiste im PDF folgt, Undo auch nach Neuladen; Einheit und Kommandant', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Kürzel Übungsplan');
    await dblclickColumn(wapPage, 'Rap-Spalte Mo', 780);
    await wapPage.keyboard.type('KR');
    await wapPage.keyboard.press('Enter');
    await wapPage.getByRole('button', { name: 'Plan-Einstellungen …', exact: true }).click();
    const s = wapPage.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true });
    await setField(s, 'Einheit', 'Inf Ustü Kp 99/4');
    await s.getByRole('tab', { name: 'Kommandant und Bilder', exact: true }).click();
    await setField(s, 'Grad', 'Hptm');
    await setField(s, 'Name', 'Muster');
    await s.getByRole('tab', { name: 'Kürzelliste', exact: true }).click();
    // Maus. Fiktiver Testtext statt des Vorlagenwerts «Kompanierapport» (Gate B 28.10.2026 Nr 39, KR 29.10.2026).
    await setField(s, 'Bedeutung KR', 'Kaderrapport Übung');
    // Tastatur: AR1.
    const ar1 = s.getByRole('textbox', { name: 'Bedeutung AR1', exact: true });
    await ar1.focus();
    await wapPage.keyboard.press('Control+a');
    await wapPage.keyboard.type('Arbeitsrapport eins');
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.press('Escape');
    await expect(s).toHaveCount(0);
    const { info } = await pdfOf(wapPage);
    const text = info.texts.map((t) => t.text).join(' ');
    expect(text).toContain('Kaderrapport Übung');
    expect(text).not.toContain('Kompanierapport');
    expect(text).toContain('Inf Ustü Kp 99/4');
    // Undo nach Neuladen: erst AR1, dann KR zurück.
    await wapPage.reload();
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
    await undoButton(wapPage);
    await undoButton(wapPage);
    await wapPage.getByRole('button', { name: 'Plan-Einstellungen …', exact: true }).click();
    await s.getByRole('tab', { name: 'Kürzelliste', exact: true }).click();
    await expect(s.getByRole('textbox', { name: 'Bedeutung KR', exact: true })).toHaveValue('');
    await s.getByRole('button', { name: 'Dialog schliessen', exact: true }).click();
    const again = await pdfOf(wapPage);
    const textAgain = again.info.texts.map((t) => t.text).join(' ');
    expect(textAgain).not.toContain('Kaderrapport Übung');
    // Ohne Planfeld wieder die Bedeutung aus der Vorlage.
    expect(textAgain).toContain('Kompanierapport');
  });

  test('[R-5.2-02][R-5.2-03][R-5.2-04][R-5.2-05][R-5.2-06] I3 C3 Wochenbefehle: einfügen mit Vorschau der Folgewochen, duplizieren, umbenennen (Kopf und Dateiname), löschen, wiederherstellen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Wochen Übungsplan');
    const tabs = wapPage.getByRole('tablist', { name: 'Wochen' });
    await tabs.getByRole('tab', { name: 'Wo 1' }).click();
    await drawBlock(wapPage, 'Wochenblock', 480, 600);
    const commands = wapPage.getByRole('button', { name: 'Wochenbefehle', exact: true });
    // Einfügen nach Wo 1: Wo 1 + 7 Tage; Folgewochen nur mit Bestätigung.
    await commands.click();
    await wapPage.getByRole('menuitem', { name: 'Woche danach einfügen …' }).click();
    const insert = wapPage.getByRole('dialog', { name: 'Woche danach einfügen', exact: true });
    await expect(insert).toContainText('12.10.2026');
    await expect(
      insert.getByRole('list', { name: 'Vorschau verschobene Folgewochen' }),
    ).toContainText('12.10.2026 → 19.10.2026');
    const confirm = insert.getByRole('button', { name: 'Einfügen', exact: true });
    await expect(confirm).toBeDisabled();
    await insert.getByRole('checkbox', { name: /Folgewochen um eine Woche verschieben/ }).check();
    await confirm.click();
    const fresh = tabs.getByRole('tab', { name: 'Wo 4' });
    await expect(fresh).toHaveAttribute('aria-selected', 'true');
    await expect(fresh).toHaveAttribute('title', /12\.10\.2026/);
    await expect(tabs.getByRole('tab')).toHaveText(['KVK', 'Wo 1', 'Wo 4', 'Wo 2', 'Wo 3']);
    // Duplizieren (Tastatur): Wo 1 mit Block; Kopie enthält den Block.
    await tabs.getByRole('tab', { name: 'Wo 1' }).click();
    await commands.focus();
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.press('d');
    const dup = wapPage.getByRole('dialog', { name: 'Woche duplizieren', exact: true });
    await dup.getByRole('checkbox', { name: /Folgewochen/ }).check();
    await dup.getByRole('button', { name: 'Duplizieren', exact: true }).click();
    await expect(block(wapPage, 'Wochenblock')).toBeVisible();
    await expect(tabs.getByRole('tab', { selected: true })).toHaveAttribute(
      'title',
      /12\.10\.2026/,
    );
    // Umbenennen: Kopf und Dateiname folgen.
    await commands.click();
    await wapPage.getByRole('menuitem', { name: 'Woche umbenennen …' }).click();
    const rename = wapPage.getByRole('dialog', { name: 'Woche umbenennen', exact: true });
    await rename
      .getByRole('textbox', { name: 'Bezeichnung', exact: true })
      .fill('FDT Woche Muster');
    await rename.getByRole('textbox', { name: 'Kurzname', exact: true }).fill('WoM');
    await rename.getByRole('button', { name: 'Umbenennen', exact: true }).click();
    await expect(tabs.getByRole('tab', { name: 'WoM' })).toHaveAttribute('aria-selected', 'true');
    const { info, name } = await pdfOf(wapPage);
    expect(name).toContain('_WoM_');
    expect(info.texts.map((t) => t.text).join(' ')).toContain('FDT Woche Muster');
    // Löschen und wiederherstellen.
    await commands.click();
    await wapPage.getByRole('menuitem', { name: 'Woche «FDT Woche Muster» löschen' }).click();
    await expect(tabs.getByRole('tab', { name: 'WoM' })).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText('WoM gelöscht');
    await commands.click();
    await wapPage.getByRole('menuitem', { name: 'Gelöschte Wochen (1) …' }).click();
    await wapPage
      .getByRole('button', { name: '«FDT Woche Muster» wiederherstellen', exact: true })
      .click();
    await expect(tabs.getByRole('tab', { name: 'WoM' })).toHaveAttribute('aria-selected', 'true');
    await expect(block(wapPage, 'Wochenblock')).toHaveAccessibleName(
      'Block Wochenblock 0800-1000 · Mo',
    );
  });

  test('[R-5.2-07][R-5.2-10] I3 C3 Tage: Spaltensatz für Mo–Fr auf einmal (ein Undo-Schritt), Wochenende kompakt und ausgeblendet, per Maus und Tastatur', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Tage Übungsplan');
    // Ausgangslage nach der Vorlage (R-4.9-19): Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So kompakt.
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Mö' })).toHaveCount(3);
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Kp Kdt' })).toHaveCount(2);
    await wapPage.getByRole('button', { name: 'Tag Mo 28.09.2026', exact: true }).click();
    await wapPage
      .getByRole('button', { name: 'Tag Fr 02.10.2026', exact: true })
      .click({ modifiers: ['Shift'] });
    const p = await openPanel(wapPage);
    await expect(p).toContainText('5 Tage');
    await p
      .getByRole('combobox', { name: 'Spaltensatz', exact: true })
      .selectOption({ label: 'KVK Mi–Fr' });
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Mö' })).toHaveCount(5);
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Kp Kdt' })).toHaveCount(0);
    await undoButton(wapPage);
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Mö' })).toHaveCount(3);
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Kp Kdt' })).toHaveCount(2);
    // Tastatur: Tageskopf Sa über Spaltenkopf, D → Darstellung, Pfeil → kompakt.
    const sa = wapPage.getByRole('button', { name: 'Tag Sa 03.10.2026', exact: true });
    const saBody = wapPage.locator('.i2-grid-day-body[data-day="2026-10-03"]');
    const kompakt = (await box(saBody)).width;
    await sa.focus();
    await wapPage.keyboard.press('d');
    const display = p.getByRole('radiogroup', { name: 'Darstellung' });
    await expect(display.getByRole('radio', { name: 'kompakt', exact: true })).toBeFocused();
    await wapPage.keyboard.press('ArrowLeft');
    await expect(display.getByRole('radio', { name: 'voll', exact: true })).toBeChecked();
    await expect.poll(async () => (await box(saBody)).width).toBeGreaterThan(kompakt);
    const before = (await box(saBody)).width;
    await wapPage.keyboard.press('ArrowRight');
    await expect(display.getByRole('radio', { name: 'kompakt', exact: true })).toBeChecked();
    await expect.poll(async () => (await box(saBody)).width).toBeLessThan(before);
    // So per Maus ausgeblendet.
    await wapPage.getByRole('button', { name: 'Tag So 04.10.2026', exact: true }).click();
    await display.getByRole('radio', { name: 'ausgeblendet', exact: true }).click();
    await expect(
      wapPage.getByRole('button', { name: 'Tag So 04.10.2026', exact: true }),
    ).toHaveCount(0);
    // Wieder einblenden über das Seitenfeld «Woche» (nichts gewählt).
    await wapPage.keyboard.press('Escape');
    await cursor(wapPage).focus();
    await wapPage.keyboard.press('Escape');
    await p.getByRole('button', { name: 'So 04.10.2026 einblenden', exact: true }).click();
    await expect(
      wapPage.getByRole('button', { name: 'Tag So 04.10.2026', exact: true }),
    ).toBeVisible();
  });

  test('[R-5.1-20][R-5.1-21] I3 Mehrfachauswahl: Shift-Rahmen, Ctrl- und Shift-Klick; gemeinsam verschieben, umfärben (Seitenfeld), löschen – je ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Auswahl Übungsplan');
    await drawBlock(wapPage, 'Eins', 480, 540);
    await drawBlock(wapPage, 'Zwei', 600, 660);
    await drawBlock(wapPage, 'Drei', 720, 780);
    const a = await box(area(wapPage, 'Mo'));
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.move(a.x + 2, a.y + (470 - FROM) * MINUTE);
    await wapPage.mouse.down();
    await wapPage.mouse.move(a.x + a.width - 2, a.y + (790 - FROM) * MINUTE, { steps: 6 });
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Shift');
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('3 Einträge gewählt');
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(3);
    // Ctrl-Klick nimmt heraus, Shift-Klick wählt den Bereich.
    await block(wapPage, 'Zwei').click({ modifiers: ['Control'] });
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('2 Einträge gewählt');
    await block(wapPage, 'Eins').click();
    await block(wapPage, 'Drei').click({ modifiers: ['Shift'] });
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('3 Einträge gewählt');
    // Umfärben über das Seitenfeld (gemeinsame Felder).
    const p = await openPanel(wapPage);
    await expect(p).toContainText('3 Einträge gewählt');
    await p
      .getByRole('combobox', { name: 'Kategorie', exact: true })
      .selectOption({ label: 'Extern' });
    await expect(wapPage.getByRole('button', { name: 'Rückgängig', exact: true })).toHaveAttribute(
      'title',
      /3 Einträge/,
    );
    // Gemeinsam verschieben (eine Stunde), ein Undo-Schritt.
    const eins = await box(block(wapPage, 'Eins'));
    await wapPage.mouse.move(eins.x + eins.width / 2, eins.y + eins.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(eins.x + eins.width / 2, eins.y + eins.height / 2 + 60 * MINUTE, {
      steps: 8,
    });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1300-1400/);
    await undoButton(wapPage);
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1200-1300/);
    await expect(block(wapPage, 'Eins')).toHaveAccessibleName(/0800-0900/);
    // Löschen der Auswahl (Ctrl+A wählt den Tag): ein Undo-Schritt stellt alle drei her.
    await block(wapPage, 'Eins').focus();
    await wapPage.keyboard.press('Control+a');
    await p.getByRole('button', { name: '3 Einträge löschen', exact: true }).click();
    await expect(wapPage.getByRole('button', { name: /^Block (Eins|Zwei|Drei) / })).toHaveCount(0);
    await undoButton(wapPage);
    await expect(wapPage.getByRole('button', { name: /^Block (Eins|Zwei|Drei) / })).toHaveCount(3);
  });

  test('[R-5.1-22][R-6-01] I3 Kopieren zwischen Wochen, Duplizieren anschliessend, «Auch an anderen Tagen» Di–Fr als ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Kopieren Übungsplan');
    await drawBlock(wapPage, 'Kopierblock', 480, 600);
    const b = block(wapPage, 'Kopierblock');
    await b.click();
    await wapPage.keyboard.press('Control+c');
    await wapPage.keyboard.press('Alt+PageDown');
    await expect(wapPage.getByRole('tab', { name: 'Wo 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await cursor(wapPage).focus();
    await wapPage.keyboard.press('Control+v');
    await expect(block(wapPage, 'Kopierblock')).toHaveAccessibleName(
      'Block Kopierblock 0800-1000 · Mo',
    );
    // Duplizieren: Beginn = Ende des Originals, gleiche Spalten, Kopie gewählt.
    await block(wapPage, 'Kopierblock').focus();
    await wapPage.keyboard.press('Control+d');
    await expect(
      wapPage.getByRole('button', { name: 'Block Kopierblock 1000-1200 · Mo' }),
    ).toBeFocused();
    await expect(
      wapPage.getByRole('button', { name: 'Block Kopierblock 1000-1200 · Mo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Auch an anderen Tagen: Di–Fr per Tastatur (Ziffern 2–5), ein Undo-Schritt.
    await wapPage.getByRole('button', { name: 'Block Kopierblock 0800-1000 · Mo' }).focus();
    await wapPage.keyboard.press('a');
    const other = wapPage.getByRole('dialog', { name: 'Auch an anderen Tagen', exact: true });
    for (const k of ['2', '3', '4', '5']) await wapPage.keyboard.press(k);
    await wapPage.keyboard.press('Enter');
    await expect(other).toHaveCount(0);
    for (const day of ['Di', 'Mi', 'Do', 'Fr'])
      await expect(
        wapPage.getByRole('button', { name: `Block Kopierblock 0800-1000 · ${day}` }),
      ).toBeVisible();
    await undoButton(wapPage);
    await expect(
      wapPage.getByRole('button', { name: /^Block Kopierblock 0800-1000 · (Di|Mi|Do|Fr)$/ }),
    ).toHaveCount(0);
  });

  test('[R-6-06] I3 Detail beim Überfahren und bei Tastaturfokus: Ltg, Tn, Tpt, Ort, Termintext und Notiz ohne Klick', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Detail Übungsplan');
    await drawBlock(wapPage, 'Detailblock', 480, 600);
    await block(wapPage, 'Detailblock').click();
    const p = await openPanel(wapPage);
    await setField(p, 'Ltg', 'Zfhr', 'combobox');
    await setField(p, 'Tn', 'Zug 1', 'combobox');
    await setField(p, 'Tpt', 'Kaserne');
    await setField(p, 'Ort', 'Halle');
    const note = p.getByRole('textbox', { name: 'Interne Notiz', exact: true });
    await note.fill('Notiz Muster');
    await note.blur();
    await p.getByRole('button', { name: 'Seitenfeld schliessen', exact: true }).click();
    await block(wapPage, 'Detailblock').hover();
    const card = wapPage.getByRole('tooltip', { name: 'Details zum Eintrag' });
    for (const t of ['Ltg: Zfhr', 'Tn: Zug 1', 'Tpt: Kaserne', 'Ort: Halle', 'Notiz: Notiz Muster'])
      await expect(card).toContainText(t);
    await wapPage.mouse.move(5, 5);
    await expect(card).toHaveCount(0);
    await dblclickColumn(wapPage, 'Beso-Spalte Mo', 840);
    await wapPage.keyboard.type('Materialfassung');
    await wapPage.keyboard.press('Enter');
    const beso = wapPage.getByRole('button', { name: /^Beso \S+ Materialfassung / });
    await expect(beso).toBeFocused();
    // Tastaturfokus zeigt dieselbe Karte (nach 800 ms).
    await expect(card).toContainText('Terminzeile: 10 1400-1430: Materialfassung.');
  });
}

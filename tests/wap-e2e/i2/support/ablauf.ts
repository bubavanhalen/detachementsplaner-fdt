// AE-005 Pflichtabläufe: dieselben Rollen und Namen im Entwicklungsserver und in der Einzeldatei.
import { readFileSync } from 'node:fs';
import { type Download, expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import { type PdfTextRun, readPdf } from '../../../wap/support/pdf/read';
import { test } from '../../support/fixtures';

export async function activateButton(button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.press('Enter');
}

export async function createPlan(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url);
  // Auch bei einem Wechsel nur des Hashes wird der datenfreie Einstieg frisch geladen.
  await page.reload();
  const create = page.getByRole('button', { name: 'Neuer Plan aus Vorlage', exact: true });
  await activateButton(create);
  const dialog = page.getByRole('dialog', { name: 'Neuer Plan aus Vorlage', exact: true });
  await dialog.getByRole('textbox', { name: 'Planname', exact: true }).fill(name);
  await dialog
    .getByRole('combobox', { name: 'Vorlage', exact: true })
    .selectOption({ label: 'Kp' });
  await dialog.getByRole('textbox', { name: 'Startdatum', exact: true }).fill('2026-09-28');
  await dialog.getByRole('spinbutton', { name: 'Anzahl Wochen', exact: true }).fill('4');
  await activateButton(dialog.getByRole('button', { name: 'Anlegen', exact: true }));
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
}

export async function createBlockWithKeyboard(page: Page, title: string): Promise<void> {
  await activateButton(page.getByRole('button', { name: 'Neuer Block', exact: true }));
  await page.getByRole('combobox', { name: 'Tag', exact: true }).press('Home');
  await typeIn(page.getByRole('textbox', { name: 'Beginn', exact: true }), '0800');
  await typeIn(page.getByRole('textbox', { name: 'Ende', exact: true }), '0900');
  await typeIn(page.getByRole('textbox', { name: 'Titel', exact: true }), title);
  await page.getByRole('textbox', { name: 'Titel', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: new RegExp(`^Block ${title} `) })).toBeVisible();
}

async function typeIn(field: Locator, value: string): Promise<void> {
  await expect(field).toBeEnabled();
  await field.press('Control+a');
  await field.pressSequentially(value);
}

async function bounds(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, 'Die bedienbare Fläche hat sichtbare Grenzen.').not.toBeNull();
  if (box === null) throw new Error('Bedienfläche fehlt.');
  return box;
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fileDownload(page: Page): Promise<{ download: Download; bytes: Buffer }> {
  const pending = page.waitForEvent('download');
  await activateButton(page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }));
  const download = await pending;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (path === null) throw new Error('Lokale Sicherung fehlt.');
  return { download, bytes: readFileSync(path) };
}

async function openLocalFile(page: Page, name: string, bytes: Buffer): Promise<void> {
  const open = page.getByRole('button', { name: 'Plan-Datei öffnen', exact: true });
  const chooser = page.waitForEvent('filechooser');
  await activateButton(open);
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: bytes });
}

function lineCenter(run: PdfTextRun): number {
  return run.rotation === 0
    ? run.x + run.width / 2
    : run.baselineY + (run.rotation === 90 ? -run.width / 2 : run.width / 2);
}

function lineAdvance(previous: PdfTextRun, current: PdfTextRun): number {
  return previous.rotation === 0
    ? current.baselineY - previous.baselineY
    : previous.rotation === 90
      ? current.x - previous.x
      : previous.x - current.x;
}

/** Verbindet nur benachbarte, räumlich ausgerichtete Zeilen, auch bei senkrechter Schrift. */
function normalizedPdfText(texts: readonly PdfTextRun[]): string {
  const parts: string[] = [];
  let previous: PdfTextRun | undefined;
  for (const current of texts) {
    const continues =
      previous?.text.endsWith('-') &&
      /^\p{Ll}/u.test(current.text) &&
      current.page === previous.page &&
      current.fontName === previous.fontName &&
      current.sizePt === previous.sizePt &&
      current.rotation === previous.rotation &&
      (Math.abs(lineCenter(current) - lineCenter(previous)) <= 0.5 ||
        (current.rotation === 0 && Math.abs(current.x - previous.x) <= 0.5)) &&
      lineAdvance(previous, current) > 0 &&
      lineAdvance(previous, current) <= previous.sizePt * 2;
    if (continues) {
      parts[parts.length - 1] = `${parts[parts.length - 1]?.slice(0, -1) ?? ''}${current.text}`;
    } else {
      parts.push(current.text);
    }
    previous = current;
  }
  return parts.join(' ');
}

export function registerI2Tests(url: () => string): void {
  let consoleMessages: string[] = [];
  test.beforeEach(({ wapPage }) => {
    consoleMessages = [];
    wapPage.on('console', (message) => {
      // Nur die eigenen lokalen Entwicklungsservermeldungen sind ausserhalb der Produktapp.
      const source = message.location().url;
      const vite =
        message.type() === 'debug' &&
        /\/@vite\/client(?:\?|$)/.test(source) &&
        ['[vite] connecting...', '[vite] connected.', '[vite] connected from window'].includes(
          message.text(),
        );
      // Exakter console.info-Banner aus react-dom-client.development.js; niemals unter file:.
      const react =
        message.type() === 'info' &&
        source.startsWith('http://127.0.0.1:') &&
        /^(?:%c)?Download the React DevTools for a better development experience: https:\/\/react\.dev\/link\/react-devtools(?: font-weight:bold)?$/.test(
          message.text(),
        );
      if (!vite && !react) {
        consoleMessages.push(message.type());
      }
    });
  });
  test.afterEach(() => {
    expect(consoleMessages, 'Die App schreibt keine Konsolenmeldungen.').toEqual([]);
  });

  test('[R-5.7-05][R-5.2-01][R-11-01] AE-005: realistischer Demoplan ist Standard, Belastungstest ist zweite Auswahl; eigener Plan aus Vorlage und Wochenwahl', async ({
    wapPage,
  }) => {
    await wapPage.goto(url());
    const demo = wapPage.getByRole('combobox', { name: 'Demoplan', exact: true });
    await expect(demo.getByRole('option')).toHaveText(['Realistisch', 'Belastungstest']);
    await expect(demo.getByRole('option', { name: 'Realistisch', exact: true })).toHaveJSProperty(
      'selected',
      true,
    );
    const week = wapPage.getByRole('combobox', { name: 'Woche', exact: true });
    await expect(week.getByRole('option')).toHaveCount(2);
    await week.selectOption({ index: 1 });
    await expect(week).not.toHaveValue(
      (await week.getByRole('option').first().getAttribute('value')) ?? '',
    );
    await demo.selectOption({ label: 'Belastungstest' });
    await expect(
      demo.getByRole('option', { name: 'Belastungstest', exact: true }),
    ).toHaveJSProperty('selected', true);
    await createPlan(wapPage, `${url()}#leer`, 'Eigener Übungsplan');
    await expect(wapPage.getByRole('combobox', { name: 'Demoplan', exact: true })).toHaveCount(0);
    await expect(
      wapPage.getByRole('combobox', { name: 'Woche', exact: true }).getByRole('option'),
    ).toHaveText(['KVK KW 40', 'Wo 1 KW 41', 'Wo 2 KW 42', 'Wo 3 KW 43']);
    await wapPage.getByRole('combobox', { name: 'Woche', exact: true }).selectOption({ index: 2 });
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
  });

  test('[R-5.1-01][R-5.1-02][R-5.1-03][R-5.1-08][R-5.1-10][R-5.1-11][R-5.1-14][R-5.1-15][R-5.1-16] AE-005: Maus erfasst und betitelt, verschiebt über Tag und Spalte, ändert Grösse auf 15 Minuten und löscht', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Maus Übungsplan');
    const area = wapPage.getByRole('button', { name: /^Leere Fläche Mo / }).first();
    const a = await bounds(area);
    const x = a.x + a.width / 2;
    const y = a.y + (480 - 240) * 0.8;
    await wapPage.mouse.click(x, y);
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(0);
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveCount(0);
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 30 * 0.8, { steps: 5 });
    await expect(
      wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }),
    ).toContainText('0800-0830');
    await wapPage.mouse.up();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    await wapPage.keyboard.type('Mausblock');
    await wapPage.keyboard.press('Enter');
    await expect(block(wapPage, 'Mausblock')).toHaveAccessibleName(/0800-0830/);
    const initialHeight = (await bounds(block(wapPage, 'Mausblock'))).height;
    expect(
      Math.abs(initialHeight - 24),
      '30 Minuten entsprechen 24 px, ohne künstliche Mindesthöhe.',
    ).toBeLessThanOrEqual(1);
    await block(wapPage, 'Mausblock').dblclick();
    await title.fill('Verworfen');
    await title.press('Escape');
    await expect(block(wapPage, 'Mausblock')).toBeVisible();
    await block(wapPage, 'Mausblock').dblclick();
    await title.fill('Mausblock neu');
    await title.press('Enter');
    const before = await bounds(block(wapPage, 'Mausblock neu'));
    const secondColumn = await bounds(
      wapPage.getByRole('button', { name: /^Leere Fläche Mo / }).nth(1),
    );
    await wapPage.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(
      secondColumn.x + secondColumn.width / 2,
      before.y + before.height / 2 + 22 * 0.8,
      { steps: 5 },
    );
    await expect(
      wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }),
    ).toContainText(/08(15|30)-0(845|900)/);
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Mausblock neu')).toHaveAccessibleName(/0815-0845|0830-0900/);
    expect(
      Math.abs((await bounds(block(wapPage, 'Mausblock neu'))).x - secondColumn.x),
    ).toBeLessThan(4);
    const currentName = (await block(wapPage, 'Mausblock neu').getAttribute('aria-label')) ?? '';
    await block(wapPage, 'Mausblock neu').click();
    const handle = wapPage.getByRole('button', { name: 'Ende ändern', exact: true });
    const h = await bounds(handle);
    await wapPage.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 22 * 0.8, { steps: 5 });
    await expect(
      wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }),
    ).toBeVisible();
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Mausblock neu')).not.toHaveAccessibleName(currentName);
    await expect(block(wapPage, 'Mausblock neu')).toHaveAccessibleName(
      /(0815|0830)-(0900|0915|0930)/,
    );
    const source = await bounds(block(wapPage, 'Mausblock neu'));
    const resizedTime = (
      (await block(wapPage, 'Mausblock neu').getAttribute('aria-label')) ?? ''
    ).match(/(\d{4})-(\d{4})/);
    expect(resizedTime).not.toBeNull();
    if (resizedTime === null) throw new Error('Die sichtbare Zeit des Blocks fehlt.');
    const minutes = (value: string): number =>
      Math.floor(Number(value) / 100) * 60 + (Number(value) % 100);
    const resizedDuration = minutes(resizedTime[2] ?? '') - minutes(resizedTime[1] ?? '');
    expect(resizedDuration).toBeGreaterThan(30);
    expect(source.height).toBeGreaterThan(initialHeight);
    expect(
      Math.abs(source.height - resizedDuration * 0.8),
      'Die neue Rahmenhöhe folgt der angezeigten Dauer.',
    ).toBeLessThanOrEqual(1);
    const target = await bounds(wapPage.getByRole('button', { name: /^Leere Fläche Di / }).first());
    await wapPage.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(target.x + target.width / 2, source.y + source.height / 2, {
      steps: 10,
    });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Mausblock neu')).toHaveAccessibleName(/Di/);
    await block(wapPage, 'Mausblock neu').click();
    await wapPage.getByRole('button', { name: 'Block löschen', exact: true }).click();
    await expect(block(wapPage, 'Mausblock neu')).toHaveCount(0);
  });

  test('[R-5.2-01][R-5.6-01][R-5.6-16] AE-005: eigener Plan direkt in der Demoseite bleibt nach Neuladen geöffnet; Rückgängig und Wiederholen bleiben erhalten', async ({
    wapPage,
  }) => {
    // Genau der ausgelieferte Einstieg: Demoplans bleiben während der eigenen Planung verfügbar.
    await createPlan(wapPage, url(), 'Eigener Plan in der Demoseite');
    await expect(wapPage.getByRole('combobox', { name: 'Demoplan', exact: true })).toBeVisible();
    const plans = wapPage.getByRole('combobox', { name: 'Plan', exact: true });
    await expect(
      plans.getByRole('option', { name: /Eigener Plan in der Demoseite/ }),
    ).toHaveJSProperty('selected', true);
    const selectedPlan = await plans.inputValue();
    await createBlockWithKeyboard(wapPage, 'Eigener Demoseitenblock');
    await expect(wapPage.getByRole('status', { name: 'Speicher', exact: true })).toContainText(
      /^gespeichert \d{2}:\d{2}$/i,
    );
    await wapPage.reload();
    await expect(plans).toHaveValue(selectedPlan);
    await expect(block(wapPage, 'Eigener Demoseitenblock')).toBeVisible();
    await activateButton(wapPage.getByRole('button', { name: 'Rückgängig', exact: true }));
    await expect(block(wapPage, 'Eigener Demoseitenblock')).toHaveCount(0);
    await wapPage.reload();
    await expect(plans).toHaveValue(selectedPlan);
    await activateButton(wapPage.getByRole('button', { name: 'Wiederholen', exact: true }));
    await expect(block(wapPage, 'Eigener Demoseitenblock')).toHaveAccessibleName(/0800-0900/);
  });

  test('[R-5.6-01][R-5.6-02][R-5.6-16][R-5.1-10][R-5.1-11] AE-005: Tastatur erfasst, verschiebt, ändert Grösse und löscht; Titel-Undo bleibt im Feld, Plan-Undo und Redo bleiben nach Neuladen', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-09T14:32:00+02:00');
    await createPlan(wapPage, `${url()}#leer`, 'Tastatur Übungsplan');
    await createBlockWithKeyboard(wapPage, 'Tastaturblock');
    await expect(wapPage.getByRole('status', { name: 'Speicher', exact: true })).toContainText(
      /^gespeichert 14:32$/i,
    );
    await block(wapPage, 'Tastaturblock').press('F2');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.press('End');
    await title.pressSequentially(' Zusatz');
    await title.press('Control+z');
    await expect(title).toBeFocused();
    await expect(title).toHaveValue('Tastaturblock');
    await expect(block(wapPage, 'Tastaturblock')).toHaveCount(1);
    await title.press('Escape');
    await activateButton(block(wapPage, 'Tastaturblock'));
    await activateButton(wapPage.getByRole('button', { name: 'Block bearbeiten', exact: true }));
    await wapPage.getByRole('combobox', { name: 'Tag', exact: true }).press('Home');
    await wapPage.getByRole('combobox', { name: 'Tag', exact: true }).press('ArrowDown');
    await typeIn(wapPage.getByRole('textbox', { name: 'Beginn', exact: true }), '0815');
    await typeIn(wapPage.getByRole('textbox', { name: 'Ende', exact: true }), '0945');
    await wapPage.getByRole('textbox', { name: 'Ende', exact: true }).press('Enter');
    await expect(block(wapPage, 'Tastaturblock')).toHaveAccessibleName(
      /Di.*0815-0945|0815-0945.*Di/,
    );
    await wapPage.reload();
    await expect(block(wapPage, 'Tastaturblock')).toHaveAccessibleName(/0815-0945/);
    await expect(wapPage.getByRole('button', { name: 'Rückgängig', exact: true })).toBeEnabled();
    await block(wapPage, 'Tastaturblock').press('Control+z');
    await expect(block(wapPage, 'Tastaturblock')).toHaveAccessibleName(
      /Mo.*0800-0900|0800-0900.*Mo/,
    );
    await expect(wapPage.getByRole('button', { name: 'Wiederholen', exact: true })).toBeEnabled();
    await block(wapPage, 'Tastaturblock').press('Control+y');
    await expect(block(wapPage, 'Tastaturblock')).toHaveAccessibleName(/0815-0945/);
    await expect(wapPage.getByRole('button', { name: 'Neuer Block', exact: true })).toBeEnabled();
    await block(wapPage, 'Tastaturblock').press('Delete');
    await expect(block(wapPage, 'Tastaturblock')).toHaveCount(0);
    await wapPage.reload();
    await activateButton(wapPage.getByRole('button', { name: 'Rückgängig', exact: true }));
    await expect(block(wapPage, 'Tastaturblock')).toHaveAccessibleName(/0815-0945/);
    await activateButton(wapPage.getByRole('button', { name: 'Wiederholen', exact: true }));
    await expect(block(wapPage, 'Tastaturblock')).toHaveCount(0);
  });

  test('[R-5.5-07][R-5.7-03][R-10-02][R-10-05] AE-005: lokale Datei sichern und bei Kollision als Kopie öffnen, Original erhalten, defekte Datei verständlich ablehnen, PDF dieser Woche enthält den erfassten Titel', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Datei Übungsplan');
    await createBlockWithKeyboard(wapPage, 'Dateiblock');
    const saved = await fileDownload(wapPage);
    const original = parsePlanFile(new Uint8Array(saved.bytes));
    expect(Object.values(original.plan.entries).some((entry) => entry.type === 'block')).toBe(true);
    await block(wapPage, 'Dateiblock').press('F2');
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).fill('Lokal neuer');
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).press('Enter');
    await openLocalFile(wapPage, saved.download.suggestedFilename(), saved.bytes);
    const dialog = wapPage.getByRole('dialog', { name: 'Plan als Kopie öffnen', exact: true });
    await expect(dialog).toBeVisible();
    await expect(block(wapPage, 'Lokal neuer')).toBeVisible();
    await activateButton(dialog.getByRole('button', { name: 'Als Kopie öffnen', exact: true }));
    await expect(block(wapPage, 'Dateiblock')).toBeVisible();
    const copy = parsePlanFile(new Uint8Array((await fileDownload(wapPage)).bytes));
    expect(copy.planId).not.toBe(original.planId);
    const plans = wapPage.getByRole('combobox', { name: 'Plan', exact: true });
    await plans.selectOption(original.planId);
    await expect(block(wapPage, 'Lokal neuer')).toBeVisible();
    await plans.selectOption(copy.planId);
    await openLocalFile(wapPage, 'Defekte-Plan-Datei.json', Buffer.from('{ungueltig'));
    await expect(wapPage.getByRole('alert')).toContainText(/Datei/);
    await expect(wapPage.getByRole('alert')).toContainText(/prüfen|wählen|öffnen|versuchen/i);
    await expect(block(wapPage, 'Dateiblock')).toBeVisible();
    const pendingPdf = wapPage.waitForEvent('download');
    await activateButton(wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }));
    // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): zuerst die Befunde der Woche, dann der Export.
    await activateButton(
      wapPage
        .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
        .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ }),
    );
    const pdf = await pendingPdf;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    const path = await pdf.path();
    expect(path).not.toBeNull();
    if (path === null) throw new Error('Wochen-PDF fehlt.');
    const info = await readPdf(new Uint8Array(readFileSync(path)));
    expect(info.pages).toHaveLength(1);
    const titleLines = info.texts
      .filter((item) => item.text === 'Datei-' || item.text === 'block')
      .map(({ text, x, baselineY, width, sizePt, rotation }) => ({
        text,
        x,
        baselineY,
        width,
        sizePt,
        rotation,
      }));
    expect(
      normalizedPdfText(info.texts),
      `Lage der fiktiven Titelzeilen: ${JSON.stringify(titleLines)}`,
    ).toContain('Dateiblock');
    expect(info.fonts.length).toBeGreaterThan(0);
    expect(info.fonts.every((font) => font.embedded && font.toUnicode)).toBe(true);
  });
}

// H-UI, Befunde CR-H-U-05, CR-H-U-06 und CR-H-U-10 (UI-Richtlinie 5.4, 5.5; Beschrieb 5.1): Direktbearbeitung mit
// einem Zeichen ohne Glyphe bleibt offen, Fett-Teile im Beso-Titel bleiben beim Bearbeiten erhalten, Ctrl beim
// Loslassen legt eine Kopie ab. Abläufe über Rolle und Name im Entwicklungsserver und in der Einzeldatei. Nur fiktive
// Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { add, block, kpPlan, MO } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

/** Wo 1: Block «Wache Nord» Mo 0800-1000 und Beso «Arztvisite» Mo 1000-1030 mit fettem Anfang «Arzt». */
function planEditor(): Plan {
  let plan = block(kpPlan(1), 'Wache Nord').plan;
  plan = add(plan, {
    type: 'beso',
    date: MO,
    title: [
      { text: 'Arzt', bold: true },
      { text: 'visite', bold: false },
    ],
    windows: [{ time: { form: 'range', from: 600, to: 630 } }],
  }).plan;
  return { ...plan, id: 'hui-e2e-editor', exerciseName: 'Editor Übungsplan', service: 'FDT 2099' };
}

function blockNamed(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Element ohne Lage.');
  return box;
}

async function savedPlan(page: Page): Promise<Plan> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
  const path = await (await pending).path();
  if (path === null) throw new Error('Plan-Datei fehlt.');
  return parsePlanFile(new Uint8Array(readFileSync(path))).plan;
}

function besoOf(plan: Plan): Beso {
  const b = Object.values(plan.entries).find((e): e is Beso => e.type === 'beso');
  if (b === undefined) throw new Error('Beso fehlt.');
  return b;
}

export function registerEditorTests(url: () => string): void {
  test('[R-5.1-10][R-5.7-03] H-UI CR-H-U-05: Klick ausserhalb mit einem Zeichen ohne Glyphe übernimmt nicht und verwirft nicht: Feld rot, Meldung, Eingabe bleibt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'editor.wap.json', planFile(planEditor()));
    await blockNamed(wapPage, 'Wache Nord').dblclick();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    await title.fill('Wache Nord ✓');
    await wapPage.getByRole('heading', { name: 'WAP-Planer', level: 1 }).click();
    // Die Bearbeitung bleibt offen, nichts ist übernommen oder verworfen.
    await expect(title).toBeVisible();
    await expect(title).toHaveValue('Wache Nord ✓');
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(title).toBeFocused();
    const alert = wapPage
      .getByRole('group', { name: 'Direktbearbeitung Block', exact: true })
      .getByRole('alert');
    await expect(alert).toContainText('Ein Zeichen kann im PDF nicht dargestellt werden');
    await expect(alert).toContainText('ersetzen');
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveCount(1);
    // Korrigiert und übernommen.
    await title.fill('Wache Nord Süd');
    await title.press('Enter');
    await expect(blockNamed(wapPage, 'Wache Nord Süd')).toBeVisible();
  });

  test('[R-5.1-10][R-5.7-03] H-UI CR-H-U-05: Tab nach dem letzten Feld mit ungültigem Zeichen im Ort bleibt im Feld; gültige Felder gehen nicht verloren', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'editor.wap.json', planFile(planEditor()));
    await blockNamed(wapPage, 'Wache Nord').dblclick();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.fill('Wache Ost');
    await title.press('Tab');
    await wapPage.getByRole('textbox', { name: 'Zusatz', exact: true }).fill('mit Ablösung');
    await wapPage.getByRole('textbox', { name: 'Zusatz', exact: true }).press('Tab');
    await wapPage.getByRole('textbox', { name: 'Ltg', exact: true }).press('Tab');
    const ort = wapPage.getByRole('textbox', { name: 'Ort', exact: true });
    await expect(ort).toBeFocused();
    await ort.fill('Halle ✓');
    await ort.press('Tab');
    await expect(ort).toBeFocused();
    await expect(ort).toHaveAttribute('aria-invalid', 'true');
    await expect(ort).toHaveValue('Halle ✓');
    await expect(title).toHaveValue('Wache Ost');
    await expect(wapPage.getByRole('textbox', { name: 'Zusatz', exact: true })).toHaveValue(
      'mit Ablösung',
    );
    await ort.fill('Halle 2');
    await ort.press('Enter');
    await expect(blockNamed(wapPage, 'Wache Ost')).toBeVisible();
  });

  test('[R-5.1-23] H-UI CR-H-U-06: Beso-Titel per Doppelklick und im Terminbereich bearbeitet: fette Teile bleiben erhalten', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'editor.wap.json', planFile(planEditor()));
    // Doppelklick auf das Kästchen: Termintext direkt im Raster.
    await wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1000-1030 · Mo$/ }).dblclick();
    const text = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(text).toHaveValue('Arztvisite');
    await text.press('End');
    await text.pressSequentially(' Nord');
    await text.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite Nord 1000-1030 · Mo$/ }),
    ).toBeVisible();
    let beso = besoOf(await savedPlan(wapPage));
    expect(beso.title).toEqual([
      { text: 'Arzt', bold: true },
      { text: 'visite Nord', bold: false },
    ]);
    // Im Terminbereich (Doppelklick auf die Terminzeile).
    await wapPage
      .getByRole('button', { name: /^Terminzeile \S+ 1000-1030: Arztvisite Nord/ })
      .dblclick();
    const line = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(line).toHaveValue('Arztvisite Nord');
    await line.fill('Arztvisite Süd');
    await line.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite Süd 1000-1030 · Mo$/ }),
    ).toBeVisible();
    beso = besoOf(await savedPlan(wapPage));
    expect(beso.title).toEqual([
      { text: 'Arzt', bold: true },
      { text: 'visite Süd', bold: false },
    ]);
  });

  test('[R-5.1-15][R-5.1-14] H-UI CR-H-U-10: Ctrl beim Loslassen legt eine Kopie ab, das Zeitschild zeigt «Kopie»; ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'editor.wap.json', planFile(planEditor()));
    const source = await bounds(blockNamed(wapPage, 'Wache Nord'));
    const target = await bounds(wapPage.getByRole('button', { name: /^Leere Fläche Di / }).first());
    const label = wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true });
    await wapPage.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(target.x + target.width / 2, source.y + source.height / 2, {
      steps: 10,
    });
    await expect(label).toBeVisible();
    await expect(label).not.toContainText('Kopie');
    // Ctrl während des Ziehens: das Zeitschild sagt es vorab an; ohne Ctrl wieder nicht.
    await wapPage.keyboard.down('Control');
    await expect(label).toContainText('Kopie');
    await wapPage.keyboard.up('Control');
    await expect(label).not.toContainText('Kopie');
    await wapPage.keyboard.down('Control');
    await expect(label).toContainText('Kopie');
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Control');
    // Original bleibt am Mo, die Kopie liegt am Di.
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveCount(2);
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Nord 0800-1000 · Mo$/ }),
    ).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Nord 0800-1000 · Di$/ }),
    ).toHaveCount(1);
    // Ein Undo-Schritt entfernt die Kopie; das Original bleibt unverändert.
    await wapPage.getByRole('button', { name: /^Rückgängig/ }).click();
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Nord 0800-1000 · Mo$/ }),
    ).toHaveCount(1);
    // Ohne Ctrl verschiebt dieselbe Geste wie bisher.
    await wapPage.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(target.x + target.width / 2, source.y + source.height / 2, {
      steps: 10,
    });
    await wapPage.mouse.up();
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Nord 0800-1000 · Di$/ }),
    ).toHaveCount(1);
  });
}

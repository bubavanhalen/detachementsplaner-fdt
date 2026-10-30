// H-UI2, Befund UX-H-03 (UI-Richtlinie 2.2; I2b-A A5; Beschrieb 11 «Mindestgrösse 1366 × 768»): Kopf- und
// Werkzeugleiste ragen bei 1366 × 768 nie aus dem Fenster, sind zusammen höchstens 100 px hoch, und jeder Befehl ist
// sichtbar erreichbar – als Knopf in der Leiste, im Planmenü oder im Menü «Mehr …» (Maus und Tastatur). Die Befehle
// der Auswahl stehen in der Statuszeile. Abläufe über Rolle und Name. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planLeisten } from './plaene';

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (b === null) throw new Error('Element ohne Lage.');
  return b;
}

function startsWith(name: string): RegExp {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

/**
 * Breiten der Leisten und der Seite: keine ragt aus dem Fenster. Nach dem Laden der Schrift und einer Änderung misst die
 * Leiste im nächsten Bild neu; geprüft wird der ruhende Zustand (höchstens 2 s).
 */
export async function fitsWindow(page: Page): Promise<void> {
  await expect(async () => {
    await barsFit(page);
  }).toPass({ timeout: 2000 });
}

async function barsFit(page: Page): Promise<void> {
  const m = await page.evaluate(() => {
    const bars = [...document.querySelectorAll<HTMLElement>('.wap-i2-toolbar, .i2-grid-tools')];
    return {
      bars: bars.map((b) => ({
        sw: b.scrollWidth,
        cw: b.clientWidth,
        right: b.getBoundingClientRect().right,
      })),
      page: document.documentElement.scrollWidth,
      width: window.innerWidth,
    };
  });
  expect(m.bars.length, 'Kopf- und Werkzeugleiste').toBe(2);
  for (const b of m.bars) {
    expect(b.sw, 'Inhalt der Leiste breiter als die Leiste').toBeLessThanOrEqual(b.cw + 1);
    expect(b.right, 'Leiste ragt aus dem Fenster').toBeLessThanOrEqual(m.width + 0.5);
  }
  expect(m.page, 'Seite breiter als das Fenster').toBeLessThanOrEqual(m.width);
}

/** Knopf sichtbar und ganz im Fenster? */
export async function visibleInWindow(page: Page, button: Locator): Promise<boolean> {
  if ((await button.count()) !== 1 || !(await button.isVisible())) return false;
  const b = await box(button);
  const width = page.viewportSize()?.width ?? 0;
  return b.x >= 0 && b.x + b.width <= width + 0.5;
}

/** Befehl sichtbar als Knopf oder als Eintrag im Menü (Planmenü bzw. «Mehr …»); öffnet und schliesst das Menü. */
async function reachable(page: Page, name: string, menu: Locator, label: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  if (await visibleInWindow(page, button)) return;
  await menu.click();
  const list = page.getByRole('menu', { name: label, exact: true });
  await expect(list, `«${name}»: weder Knopf noch Menü`).toBeVisible();
  await expect(
    list
      .getByRole('menuitem', { name: startsWith(name) })
      .or(list.getByRole('menuitemcheckbox', { name: startsWith(name) })),
    `«${name}» im Menü «${label}»`,
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
}

function shownIds(tools: Locator): Promise<string[]> {
  return tools.evaluate((t) =>
    [...t.querySelectorAll<HTMLElement>(':scope > [data-bar-id]')]
      .filter((e) => !e.hidden)
      .map((e) => e.dataset.barId ?? ''),
  );
}

export function registerLeistenTests(url: () => string): void {
  test('[R-5.7-05][R-11-07] H-UI2 UX-H-03: bei 1366 × 768 ragen Kopf- und Werkzeugleiste nicht aus dem Fenster, höchstens 100 px; jeder Befehl sichtbar erreichbar (Leiste, Planmenü, «Mehr …»)', async ({
    wapPage,
  }) => {
    await wapPage.setViewportSize({ width: 1366, height: 768 });
    await startWith(wapPage, `${url()}#leer`, 'Leisten.wap.json', planFile(planLeisten()));
    await fitsWindow(wapPage);
    expect(
      (await box(wapPage.locator('.i2-grid-scroll'))).y,
      'Kopf und Werkzeugleiste',
    ).toBeLessThanOrEqual(100);
    const planMenu = wapPage.getByRole('button', { name: 'Planmenü', exact: true });
    await expect(planMenu).toBeVisible();
    for (const name of [
      'Neuer Plan aus Vorlage',
      'Plan-Datei öffnen',
      'Plan-Einstellungen …',
      'Wiederherstellungspunkte …',
    ])
      await reachable(wapPage, name, planMenu, 'Planmenü');
    for (const name of [
      'Plan-Datei sichern',
      'Tastenkürzel',
      'Rückgängig',
      'Wiederholen',
      'PDF …',
      'Einpassen',
    ])
      expect(
        await visibleInWindow(wapPage, wapPage.getByRole('button', { name, exact: true })),
        name,
      ).toBe(true);
    const more = wapPage
      .getByRole('toolbar', { name: 'Woche und Raster', exact: true })
      .getByRole('button', { name: 'Mehr …', exact: true });
    for (const name of [
      'Neuen Stand setzen …',
      'PDF dieser Woche',
      'Liste',
      'Seitenfeld',
      'Neuer Block',
    ])
      await reachable(wapPage, name, more, 'Weitere Befehle');
    // Planmenü per Tastatur: Enter öffnet, der erste Eintrag hat den Fokus, Enter führt aus.
    await planMenu.focus();
    await wapPage.keyboard.press('Enter');
    const menu = wapPage.getByRole('menu', { name: 'Planmenü', exact: true });
    await expect(menu.getByRole('menuitem', { name: 'Plan-Einstellungen …' })).toBeFocused();
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true }),
    ).toBeVisible();
    await wapPage.keyboard.press('Escape');
    // Ein ausgewichener Befehl wirkt aus «Mehr …»: Liste ein.
    const liste = wapPage.getByRole('button', { name: 'Liste', exact: true });
    if (await visibleInWindow(wapPage, liste)) await liste.click();
    else {
      await more.click();
      await wapPage
        .getByRole('menu', { name: 'Weitere Befehle', exact: true })
        .getByRole('menuitemcheckbox', { name: /^Liste/ })
        .click();
    }
    await expect(wapPage.getByRole('grid', { name: /^Einträge / })).toBeVisible();
    await fitsWindow(wapPage);
  });

  test('[R-5.7-05][R-11-07] H-UI2 UX-H-03: mit gewähltem Block bleiben die Leisten im Fenster; «Block löschen», «Block bearbeiten», «Kategorie» stehen sichtbar in der Statuszeile, die Werkzeugleiste springt nicht', async ({
    wapPage,
  }) => {
    await wapPage.setViewportSize({ width: 1366, height: 768 });
    await startWith(wapPage, `${url()}#leer`, 'Leisten.wap.json', planFile(planLeisten()));
    const tools = wapPage.getByRole('toolbar', { name: 'Woche und Raster', exact: true });
    const before = await shownIds(tools);
    await wapPage.getByRole('button', { name: /^Block Wache Nord / }).click();
    await fitsWindow(wapPage);
    const selection = wapPage.getByRole('toolbar', { name: 'Auswahl', exact: true });
    for (const name of ['Block löschen', 'Block bearbeiten'])
      expect(
        await visibleInWindow(wapPage, selection.getByRole('button', { name, exact: true })),
        name,
      ).toBe(true);
    await expect(selection.getByRole('combobox', { name: 'Kategorie', exact: true })).toBeVisible();
    expect(await shownIds(tools), 'Werkzeugleiste unverändert beim Wählen').toEqual(before);
    await selection.getByRole('button', { name: 'Block löschen', exact: true }).click();
    await expect(wapPage.getByRole('button', { name: /^Block Wache Nord / })).toHaveCount(0);
  });

  test('[R-5.7-05] H-UI2 UX-H-03: auch in der Demo (Realistisch und Belastungstest) bei 1366 × 768 und 1600 × 900 keine Leiste breiter als das Fenster', async ({
    wapPage,
  }) => {
    for (const [width, height] of [
      [1366, 768],
      [1600, 900],
    ] as const) {
      await wapPage.setViewportSize({ width, height });
      await wapPage.goto(url());
      await wapPage.reload();
      await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
      await fitsWindow(wapPage);
      await wapPage
        .getByRole('combobox', { name: 'Demoplan', exact: true })
        .selectOption({ index: 1 });
      await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
      await fitsWindow(wapPage);
    }
  });
}

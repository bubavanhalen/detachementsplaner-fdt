// H-UI, Befunde CR-H-U-07 und CR-H-U-08: der WAP-Planer in der ganzen Suite (UI-Richtlinie 2.1, 13.2, 18 S-1 bis S-3;
// ADR-001 «Tastatur»). Abläufe über Rolle und Name im Entwicklungsserver und in der Einzeldatei. Verbindlich: Auf /wap
// lösen Suite-Undo, Suite-Redo und die Suite-JSON-Sicherung nie aus – mit Fokus auf body, im Raster, in einem Textfeld
// und bei offenem Dialog; Suite-Projekt unverändert, kein Suite-Download. Nur fiktive Daten.
import { expect, type Page } from '@playwright/test';
import { createBlockWithKeyboard, createPlan } from '../../i2/support/ablauf';
import { test } from '../../support/fixtures';

declare global {
  interface Window {
    __suiteProject?: () => string;
  }
}

async function suiteState(page: Page): Promise<string> {
  return page.evaluate(() => window.__suiteProject?.() ?? '');
}

/** Fokus auf body (auch wenn die Route nach Undo/Redo den Fokus noch einmal setzt). */
async function blurAll(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        return document.activeElement === document.body;
      }),
    )
    .toBe(true);
}

/** Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z und Ctrl+S nacheinander. */
async function suiteKeys(page: Page): Promise<void> {
  for (const k of ['Control+z', 'Control+y', 'Control+Shift+z', 'Control+s'])
    await page.keyboard.press(k);
}

function sidebar(page: Page) {
  return page.getByRole('complementary', { name: 'Seitenleiste', exact: true });
}

export function registerSuiteTests(url: () => string): void {
  test('[R-11-07] H-UI S-1/S-2: Alt+9 öffnet den WAP-Planer mit eingeklappter Seitenleiste und eigener Kopfleiste; Palette und Rückweg', async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#/persons`);
    await expect(wapPage.locator('header.topbar')).toHaveCount(1);
    await blurAll(wapPage);
    await wapPage.keyboard.press('Alt+9');
    await expect(wapPage).toHaveURL(/#\/wap$/);
    await expect(wapPage.getByRole('heading', { name: 'WAP-Planer', level: 1 })).toHaveCount(1);
    // Eigene Kopfleiste der Route statt Suite-Topbar; Darstellung und Tastenkürzel in der Kopfleiste der Route.
    await expect(wapPage.locator('header.topbar')).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: 'Darstellung', exact: true })).toBeVisible();
    await expect(wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true })).toHaveCount(1);
    // Seitenleiste eingeklappt (Vorgabe der Route); Ctrl+B klappt aus und wieder ein.
    const toggle = sidebar(wapPage).getByRole('button', {
      name: /^Seitenleiste (aus|ein)klappen$/,
    });
    await expect(toggle).toHaveAccessibleName('Seitenleiste ausklappen');
    await blurAll(wapPage);
    await wapPage.keyboard.press('Control+b');
    await expect(toggle).toHaveAccessibleName('Seitenleiste einklappen');
    await wapPage.keyboard.press('Control+b');
    await expect(toggle).toHaveAccessibleName('Seitenleiste ausklappen');
    // Die gespeicherte Einstellung der Suite bleibt: auf einer anderen Route ausgeklappt.
    await wapPage.keyboard.press('Alt+5');
    await expect(wapPage).toHaveURL(/#\/persons$/);
    await expect(toggle).toHaveAccessibleName('Seitenleiste einklappen');
    await expect(wapPage.locator('header.topbar')).toHaveCount(1);
    // Befehlspalette: Gruppe «WAP-Planer».
    await blurAll(wapPage);
    await wapPage.keyboard.press('Control+k');
    const palette = wapPage.getByRole('dialog', { name: 'Befehle und Suche', exact: true });
    await expect(palette).toBeVisible();
    await palette.getByRole('combobox').fill('WAP');
    await expect(palette.getByRole('option', { name: /WAP-Planer öffnen/ })).toBeVisible();
    await wapPage.keyboard.press('Enter');
    await expect(wapPage).toHaveURL(/#\/wap$/);
    await expect(toggle).toHaveAccessibleName('Seitenleiste ausklappen');
    // «?» öffnet auf /wap die Übersicht des WAP-Planers, nicht die der Suite.
    await blurAll(wapPage);
    await wapPage.keyboard.press('?');
    await expect(
      wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true }),
    ).toBeVisible();
    await expect(wapPage.getByRole('dialog', { name: 'Tastenkürzel', exact: true })).toHaveCount(0);
  });

  test('[R-11-07] H-UI S-3: Suite-Undo, -Redo und -JSON-Sicherung lösen auf /wap nie aus (Fokus auf body, im Raster, im Textfeld, bei offenem Dialog)', async ({
    wapPage,
  }) => {
    const downloads: string[] = [];
    wapPage.on('download', (d) => downloads.push(d.suggestedFilename()));
    await createPlan(wapPage, `${url()}#/wap`, 'Übungsplan Suite');
    const before = await suiteState(wapPage);
    expect(before).toContain('Übung Bravo');
    await createBlockWithKeyboard(wapPage, 'Probe');
    const probe = wapPage.getByRole('button', { name: /^Block Probe / });

    // Fokus auf body: Ctrl+Z/Ctrl+Y wirken auf die WAP-Historie (Delegat), nie auf die Suite.
    await blurAll(wapPage);
    await wapPage.keyboard.press('Control+z');
    await expect(probe).toHaveCount(0);
    await wapPage.keyboard.press('Control+y');
    await expect(probe).toBeVisible();
    await blurAll(wapPage);
    await suiteKeys(wapPage);
    await expect.poll(() => downloads.length).toBeGreaterThan(0);
    expect(await suiteState(wapPage)).toBe(before);

    // Im Raster (Zellzeiger).
    await wapPage.locator('[aria-roledescription="Zellzeiger"]').focus();
    await suiteKeys(wapPage);
    expect(await suiteState(wapPage)).toBe(before);

    // In einem Textfeld: natives Rückgängig; Ctrl+B klappt die Seitenleiste nicht.
    await wapPage.getByRole('button', { name: 'Neuer Block', exact: true }).click();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.fill('Entwurf');
    await title.focus();
    await suiteKeys(wapPage);
    await wapPage.keyboard.press('Control+b');
    await expect(
      sidebar(wapPage).getByRole('button', { name: 'Seitenleiste ausklappen', exact: true }),
    ).toBeVisible();
    await title.press('Escape');
    expect(await suiteState(wapPage)).toBe(before);

    // Bei offenem Dialog.
    await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
    await expect(dialog).toBeVisible();
    await suiteKeys(wapPage);
    await wapPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Suite-Projekt unverändert, keine Suite-JSON-Sicherung (nur Plan-Dateien des WAP-Planers).
    expect(await suiteState(wapPage)).toBe(before);
    expect(downloads.every((name) => name.endsWith('.wap.json'))).toBe(true);
    await expect(probe).toBeVisible();
  });
}

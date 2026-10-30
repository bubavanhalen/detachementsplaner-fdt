// H-TESTS (Härtung, TR-H-09, SA-H-12): Leitplanke Suite-Kürzel mit eigener ID – auf /wap lösen Suite-Undo,
// Suite-Redo und die Suite-JSON-Sicherung nie aus (Fokus auf body, im Raster, in einem Textfeld, bei offenem Dialog;
// Suite-Projekt unverändert, kein Suite-Download); auf anderen Routen wirken die Suite-Kürzel unverändert (Prompt §5.6;
// ADR-001 «Tastatur»; UI-Richtlinie 18 S-3; R-L-06). Ganze Suite in der Harness `h-ui`, nur fiktive Daten.
import { expect, type Page } from '@playwright/test';
import { createBlockWithKeyboard, createPlan } from '../i2/support/ablauf';
import { test } from '../support/fixtures';

declare global {
  interface Window {
    __suiteProject?: () => string;
  }
}

const URL = '/tests/wap-e2e/harness/h-ui.html';

async function suiteState(page: Page): Promise<string> {
  return page.evaluate(() => window.__suiteProject?.() ?? '');
}

async function suiteName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const p = JSON.parse(window.__suiteProject?.() ?? '{}') as { name?: string };
    return p.name ?? '';
  });
}

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

async function suiteKeys(page: Page): Promise<void> {
  for (const k of ['Control+z', 'Control+y', 'Control+Shift+z', 'Control+s'])
    await page.keyboard.press(k);
}

test('[R-L-06] Auf /wap lösen Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z und Ctrl+S keine Suite-Aktion aus (body, Raster, Textfeld, Dialog); auf einer anderen Route wirken sie unverändert', async ({
  wapPage,
}) => {
  const downloads: string[] = [];
  wapPage.on('download', (d) => downloads.push(d.suggestedFilename()));
  await createPlan(wapPage, `${URL}#/wap`, 'Übungsplan Leitplanke');
  await createBlockWithKeyboard(wapPage, 'Probe');
  const before = await suiteState(wapPage);
  expect(await suiteName(wapPage)).toBe('Übung Bravo');

  // Fokus auf body.
  await blurAll(wapPage);
  await suiteKeys(wapPage);
  expect(await suiteState(wapPage)).toBe(before);
  // Im Raster (Zellzeiger).
  await wapPage.locator('[aria-roledescription="Zellzeiger"]').focus();
  await suiteKeys(wapPage);
  expect(await suiteState(wapPage)).toBe(before);
  // In einem Textfeld.
  await wapPage.getByRole('button', { name: 'Neuer Block', exact: true }).click();
  const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
  await title.fill('Entwurf');
  await title.focus();
  await suiteKeys(wapPage);
  await title.press('Escape');
  expect(await suiteState(wapPage)).toBe(before);
  // Bei offenem Dialog.
  await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
  const dialog = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
  await expect(dialog).toBeVisible();
  await suiteKeys(wapPage);
  await wapPage.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await suiteState(wapPage)).toBe(before);
  // Auf /wap entstehen nur Plan-Dateien des WAP-Planers, keine Suite-JSON.
  await expect.poll(() => downloads.length).toBeGreaterThan(0);
  expect(downloads.every((n) => n.endsWith('.wap.json'))).toBe(true);

  // Andere Route: Suite-Undo, -Redo und -Sicherung wirken.
  await blurAll(wapPage);
  await wapPage.keyboard.press('Alt+5');
  await expect(wapPage).toHaveURL(/#\/persons$/);
  await blurAll(wapPage);
  await wapPage.keyboard.press('Control+z');
  await expect.poll(() => suiteName(wapPage)).toBe('Übung Alpha');
  await wapPage.keyboard.press('Control+y');
  await expect.poll(() => suiteName(wapPage)).toBe('Übung Bravo');
  await wapPage.keyboard.press('Control+Shift+z');
  await expect.poll(() => suiteName(wapPage)).toBe('Übung Charlie');
  const vorher = downloads.length;
  await wapPage.keyboard.press('Control+s');
  await expect.poll(() => downloads.length).toBe(vorher + 1);
  expect(downloads.at(-1)?.endsWith('.wap.json')).toBe(false);
  expect(downloads.at(-1)).toMatch(/\.json$/);
});

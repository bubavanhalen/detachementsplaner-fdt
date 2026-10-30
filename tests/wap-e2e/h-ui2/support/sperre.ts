// H-UI2, Befunde SA-H-06 und SA-H-19 (R-5.6-18, R-L-07; UI-Richtlinie 10 «einzige Ausnahme vom Esc-Verhalten», 11.2):
// Sperrdialoge schliessen nie per Esc – auch ohne Nutzeraktivierung (Chromium weist `cancel` dann nicht ab) und bei
// mehrfachem Esc kurz nacheinander. Vor dem Schreiben wirkt Esc genau einmal wie «Abbrechen»; ein gewöhnlicher Dialog
// schliesst mit Esc und meldet das der Anwendung. Abläufe über Rolle und Name. Nur fiktive Texte.
import { expect, type Page } from '@playwright/test';
import { test } from '../../support/fixtures';

async function escMehrfach(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await page.keyboard.press('Escape');
}

export function registerSperreTests(url: (art: string) => string): void {
  test('[R-L-07] H-UI2 SA-H-06: «Sicherung vor dem Update» schliesst nie per Esc – ohne Nutzeraktivierung, einmal, mehrfach und nach einem Klick', async ({
    wapPage,
  }) => {
    await wapPage.goto(url('sicherung'));
    const dialog = wapPage.getByRole('dialog', { name: 'Sicherung vor dem Update', exact: true });
    await expect(dialog).toBeVisible();
    // Ohne vorherige Nutzeraktivierung.
    await escMehrfach(wapPage, 1);
    await wapPage.waitForTimeout(150);
    await expect(dialog).toBeVisible();
    await escMehrfach(wapPage, 6);
    await wapPage.waitForTimeout(300);
    await expect(dialog).toBeVisible();
    // Nach einem Klick in den Dialog (Nutzeraktivierung) ebenso.
    await dialog.getByRole('heading', { name: 'Sicherung vor dem Update' }).click();
    await escMehrfach(wapPage, 3);
    await wapPage.waitForTimeout(300);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Dialog schliessen' })).toHaveCount(0);
    await expect(wapPage.locator('main')).toHaveAttribute('data-geschlossen', '0');
    // Nur der Entscheid schliesst.
    await dialog.getByRole('button', { name: 'Plan-Dateien sichern und fortfahren' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('[R-L-07] H-UI2 SA-H-19: Fortschritt im Schritt «Schreiben» schliesst nie per Esc, auch mehrfach und ohne Nutzeraktivierung; «Abbrechen» bleibt gesperrt', async ({
    wapPage,
  }) => {
    await wapPage.goto(url('schreiben'));
    const dialog = wapPage.getByRole('dialog', { name: 'Stand wird gesetzt …', exact: true });
    await expect(dialog).toBeVisible();
    await escMehrfach(wapPage, 1);
    await wapPage.waitForTimeout(150);
    await expect(dialog).toBeVisible();
    await escMehrfach(wapPage, 6);
    await wapPage.waitForTimeout(300);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    await expect(wapPage.locator('main')).toHaveAttribute('data-abgebrochen', '0');
  });

  test('[R-L-07] H-UI2 SA-H-19: vor dem Schreiben wirkt Esc genau einmal wie «Abbrechen», auch ohne Nutzeraktivierung', async ({
    wapPage,
  }) => {
    await wapPage.goto(url('lesen'));
    const dialog = wapPage.getByRole('dialog', { name: 'Stand wird gesetzt …', exact: true });
    await expect(dialog).toBeVisible();
    await escMehrfach(wapPage, 3);
    await expect(dialog).toHaveCount(0);
    await expect(wapPage.locator('main')).toHaveAttribute('data-abgebrochen', '1');
  });

  test('[R-11-07] H-UI2 SA-H-19: ein gewöhnlicher Dialog schliesst mit Esc, auch ohne Nutzeraktivierung, und die Anwendung erfährt es', async ({
    wapPage,
  }) => {
    await wapPage.goto(url('normal'));
    const dialog = wapPage.getByRole('dialog', { name: 'Gewöhnlicher Dialog', exact: true });
    await expect(dialog).toBeVisible();
    await escMehrfach(wapPage, 2);
    await expect(dialog).toHaveCount(0);
    await expect(wapPage.locator('main')).toHaveAttribute('data-offen', 'false');
    await expect(wapPage.locator('main')).toHaveAttribute('data-geschlossen', '1');
  });
}

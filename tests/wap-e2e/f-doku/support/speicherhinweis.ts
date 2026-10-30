// F-DOKU, Befund SA-2-01: Beleg für R-L-09 unter der eigenen ID (bisher nur unter [R-11-07] in H-UI2). Kriterium
// (Katalog; UI-Richtlinie 11.6; Vertrag E1-11 §2b): Unter file:// (Projekt edge-dist) ist der Hinweis zum gemeinsamen
// Speicher am festgelegten Ort – letzter Abschnitt `region` «Gemeinsamer Browserspeicher» der Übersicht «?» – mit
// Rolle und Name erreichbar, per Maus und per Tastatur; Text in Deutsch (Schweiz) mit Ursache und Empfehlung.
// Gegentest ausserhalb von file://: kein Abschnitt. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../../support/fixtures';

function uebersicht(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
}

/** Die Abschnitte der Übersicht in ihrer Reihenfolge (Namen der Regionen). */
async function abschnitte(dialog: Locator): Promise<string[]> {
  return dialog.locator('section').evaluateAll((els) =>
    els.map((el) => {
      const id = el.getAttribute('aria-labelledby') ?? '';
      return document.getElementById(id)?.textContent?.trim() ?? '';
    }),
  );
}

async function pruefeHinweis(dialog: Locator): Promise<void> {
  const region = dialog.getByRole('region', { name: 'Gemeinsamer Browserspeicher', exact: true });
  await expect(region).toBeVisible();
  const namen = await abschnitte(dialog);
  expect(namen.at(-1), 'letzter Abschnitt der Übersicht').toBe('Gemeinsamer Browserspeicher');
  // Ursache: alle lokal geöffneten HTML-Dateien desselben Profils teilen den Speicher.
  await expect(region).toContainText('alle lokal geöffneten HTML-Dateien');
  await expect(region).toContainText('gemeinsam');
  // Empfehlung: im selben Edge-Profil keine fremden HTML-Dateien öffnen.
  await expect(region).toContainText('Im selben Edge-Profil');
  await expect(region).toContainText('keine fremden HTML-Dateien öffnen');
  // Deutsch (Schweiz): «ss» statt «ß».
  expect(await region.textContent()).not.toContain('ß');
}

export function registerSpeicherhinweisTests(url: () => string, local: boolean): void {
  if (local) {
    test('[R-L-09] file://: Übersicht «?» per Maus (Knopf «Tastenkürzel») – letzter Abschnitt «Gemeinsamer Browserspeicher» mit Ursache und Empfehlung', async ({
      wapPage,
    }) => {
      await wapPage.goto(`${url()}#leer`);
      await wapPage.reload();
      await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
      const d = uebersicht(wapPage);
      await expect(d).toBeVisible();
      await pruefeHinweis(d);
      await wapPage.keyboard.press('Escape');
      await expect(d).toHaveCount(0);
    });

    test('[R-L-09] file://: per Tastatur – Taste «?» öffnet die Übersicht mit dem Abschnitt; Erststart-Knopf per Tab und Enter fokussiert seine Überschrift', async ({
      wapPage,
    }) => {
      await wapPage.goto(`${url()}#leer`);
      await wapPage.reload();
      const start = wapPage.getByRole('region', { name: 'Ein neuer Wochenplan' });
      await expect(start).toBeVisible();
      await wapPage.keyboard.press('?');
      const d = uebersicht(wapPage);
      await expect(d).toBeVisible();
      await pruefeHinweis(d);
      await wapPage.keyboard.press('Escape');
      await expect(d).toHaveCount(0);
      const knopf = wapPage.getByRole('button', {
        name: 'Hinweis zum gemeinsamen Speicher …',
        exact: true,
      });
      await start.getByRole('button').nth(2).focus();
      await wapPage.keyboard.press('Tab');
      await expect(knopf).toBeFocused();
      await wapPage.keyboard.press('Enter');
      await expect(
        uebersicht(wapPage).getByRole('heading', { name: 'Gemeinsamer Browserspeicher' }),
      ).toBeFocused();
      await pruefeHinweis(uebersicht(wapPage));
    });
    return;
  }
  test('[R-L-09] Gegentest ausserhalb von file://: die Übersicht «?» hat keinen Abschnitt «Gemeinsamer Browserspeicher», der Erststart keinen Knopf', async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    await expect(wapPage.getByRole('region', { name: 'Ein neuer Wochenplan' })).toBeVisible();
    await expect(
      wapPage.getByRole('button', { name: 'Hinweis zum gemeinsamen Speicher …', exact: true }),
    ).toHaveCount(0);
    await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
    const d = uebersicht(wapPage);
    await expect(d).toBeVisible();
    await expect(
      d.getByRole('region', { name: 'Gemeinsamer Browserspeicher', exact: true }),
    ).toHaveCount(0);
  });
}

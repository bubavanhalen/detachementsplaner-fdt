// H-UI2, Befunde UX-H-08 und SA-H-11 (UI-Richtlinie 1 Leitsatz 4, 11.3, 11.6, 13.1; R-11-07, R-L-09, R-5.6-03):
// Seltene Befehle per Tastatur über die Befehlspalette (Ctrl+K) in den eigenständigen Einstiegen und in der
// Einzeldatei; die Speicheranzeige ist bedienbar und öffnet Wiederherstellungspunkte, Dauerhaftigkeit und Belegung;
// der Hinweis zum gemeinsamen Speicher ist unter file:// im Erststart und in der Palette erreichbar, sonst nicht.
// Abläufe über Rolle und Name. Nur fiktive Daten.
import { expect, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planLeisten } from './plaene';

function palette(page: Page) {
  return page.getByRole('dialog', { name: 'Befehle des WAP-Planers', exact: true });
}

async function openPalette(page: Page) {
  await page.keyboard.press('Control+k');
  const p = palette(page);
  await expect(p).toBeVisible();
  await expect(p.getByRole('combobox', { name: 'Befehl suchen', exact: true })).toBeFocused();
  return p;
}

export function registerPaletteTests(url: () => string, local: boolean): void {
  test('[R-11-07] H-UI2 UX-H-08: Ctrl+K öffnet die Befehlspalette mit den Befehlen von Kopfleiste, Werkzeugleiste und Raster; Suche, Enter führt aus, Esc schliesst und gibt den Fokus zurück', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Palette.wap.json', planFile(planLeisten()));
    const cell = wapPage.getByRole('button', { name: /^Mo 28\.09\. 0800 / }).first();
    await cell.focus();
    let p = await openPalette(wapPage);
    for (const name of [
      'Plan-Datei sichern',
      'Plan-Datei öffnen …',
      'Plan-Einstellungen …',
      'Wiederherstellungspunkte …',
      'Neuen Stand setzen …',
      'PDF-Export …',
      'PDF dieser Woche',
      'Liste einblenden',
      'Befundliste ein/aus',
      'Nächste Woche',
      'Gehe zu …',
      'Zoom vergrössern',
      'Ganze Woche einpassen',
      'Tastenkürzel anzeigen',
    ])
      await expect(p.getByRole('option', { name: new RegExp(`^${name}`) })).toHaveCount(1);
    // Esc schliesst, der Fokus kehrt in das Raster zurück.
    await wapPage.keyboard.press('Escape');
    await expect(p).toHaveCount(0);
    await expect(cell).toBeFocused();
    // Suche «sichern», Enter: Plan-Datei wird gesichert.
    p = await openPalette(wapPage);
    await wapPage.keyboard.type('sichern');
    await expect(p.getByRole('option', { selected: true })).toHaveAccessibleName(
      /^Plan-Datei sichern/,
    );
    const download = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(/\.wap\.json$/);
    await expect(p).toHaveCount(0);
    // Pfeil ↓ wählt; «Neuen Stand setzen …» öffnet den Dialog.
    p = await openPalette(wapPage);
    await wapPage.keyboard.type('stand');
    await expect(p.getByRole('option', { selected: true })).toHaveAccessibleName(
      /^Neuen Stand setzen/,
    );
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true }),
    ).toBeVisible();
    await wapPage.keyboard.press('Escape');
    // Raster-Befehl über die Palette: Zoom.
    const zoom = wapPage.getByRole('status', { name: 'Zoomstufe', exact: true });
    const before = await zoom.innerText();
    p = await openPalette(wapPage);
    await wapPage.keyboard.type('vergrössern');
    await wapPage.keyboard.press('Enter');
    await expect(zoom).not.toHaveText(before);
    // Ohne Treffer: Meldung mit nächstem Schritt.
    p = await openPalette(wapPage);
    await wapPage.keyboard.type('xyzq');
    await expect(p).toContainText('Kein Befehl gefunden');
    await wapPage.keyboard.press('Escape');
  });

  test('[R-5.6-03][R-11-07] H-UI2 UX-H-08: die Speicheranzeige ist ein Knopf: Enter öffnet Wiederherstellungspunkte mit Dauerhaftigkeit und Belegung, Esc gibt den Fokus zurück', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    await startWith(wapPage, `${url()}#leer`, 'Speicher.wap.json', planFile(planLeisten()));
    const anzeige = wapPage.getByRole('button', {
      name: /^Speicheranzeige: letzte Datei-Sicherung vor 2 Tagen/,
    });
    await expect(anzeige).toBeVisible();
    await expect(anzeige).toContainText('letzte Datei-Sicherung vor 2 Tagen');
    await anzeige.focus();
    await wapPage.keyboard.press('Enter');
    const dialog = wapPage.getByRole('dialog', { name: 'Wiederherstellungspunkte', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Dauerhaft gespeichert');
    await expect(dialog).toContainText('Belegung');
    await wapPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(anzeige).toBeFocused();
    // Nach der Sicherung nennt die Anzeige «heute».
    const download = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Control+s');
    await download;
    await expect(
      wapPage.getByRole('button', { name: /^Speicheranzeige: letzte Datei-Sicherung heute/ }),
    ).toBeVisible();
  });

  test(`[R-11-07] H-UI2 SA-H-11: Hinweis zum gemeinsamen Speicher ${local ? 'unter file:// im Erststart (nach den drei Karten) und in der Palette; öffnet die Übersicht beim Abschnitt' : 'fehlt ausserhalb von file:// im Erststart und in der Palette'}`, async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    const start = wapPage.getByRole('region', { name: 'Ein neuer Wochenplan' });
    await expect(start).toBeVisible();
    const hint = wapPage.getByRole('button', {
      name: 'Hinweis zum gemeinsamen Speicher …',
      exact: true,
    });
    if (!local) {
      await expect(hint).toHaveCount(0);
      await startWith(wapPage, `${url()}#leer`, 'Hinweis.wap.json', planFile(planLeisten()));
      const p = await openPalette(wapPage);
      await wapPage.keyboard.type('gemeinsam');
      await expect(p.getByRole('option')).toHaveCount(0);
      await wapPage.keyboard.press('Escape');
      return;
    }
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('aria-haspopup', 'dialog');
    // Tab-Stopp nach den drei Karten; Anfangsfokus bleibt auf der ersten Karte.
    const cards = start.getByRole('button');
    await expect(cards.nth(0)).toBeFocused();
    await cards.nth(2).focus();
    await wapPage.keyboard.press('Tab');
    await expect(hint).toBeFocused();
    await wapPage.keyboard.press('Enter');
    const help = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
    const section = help.getByRole('region', { name: 'Gemeinsamer Browserspeicher', exact: true });
    await expect(section).toBeVisible();
    await expect(
      section.getByRole('heading', { name: 'Gemeinsamer Browserspeicher' }),
    ).toBeFocused();
    await expect(section).toContainText('keine fremden HTML-Dateien öffnen');
    await section.getByText('Details', { exact: true }).click();
    await expect(section).toContainText('kein Fehler des Plans');
    await wapPage.keyboard.press('Escape');
    await expect(hint).toBeFocused();
    // Mit geöffnetem Plan: Palette.
    await startWith(wapPage, `${url()}#leer`, 'Hinweis.wap.json', planFile(planLeisten()));
    const p = await openPalette(wapPage);
    await wapPage.keyboard.type('gemeinsam');
    await expect(p.getByRole('option', { selected: true })).toHaveAccessibleName(
      'Hinweis zum gemeinsamen Speicher',
    );
    await wapPage.keyboard.press('Enter');
    await expect(help.getByRole('heading', { name: 'Gemeinsamer Browserspeicher' })).toBeFocused();
  });
}

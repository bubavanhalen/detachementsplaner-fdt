// F-UX2 P6 (Rückmeldung N1 vom 19.10.2026: «Man kann Zugspalten resp. Det-Spalten ändern, aber nicht hinzufügen oder
// entfernen»; Beschrieb 4.4, 5.2; Gestaltung raster-bedienung-v2 §7): Spaltenkopf-Menü (Rechtsklick, Shift+F10) und
// Tasten (Einfg, Shift+Einfg, Entf): links/rechts einfügen, umbenennen, entfernen; Rückfrage «Nur dieser Tag / Alle
// Tage mit diesem Spaltensatz»; Entfernen löscht nichts, die Einträge tragen P1; Rückgängig. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planEinfach } from './plaene';

function kopf(page: Page, tag: string): Locator {
  return page.locator('th.i2-grid-day-head').filter({ hasText: tag });
}

async function spalten(page: Page, tag: string): Promise<string[]> {
  return kopf(page, tag)
    .getByRole('button', { name: /^Spaltenkopf / })
    .evaluateAll((els) =>
      els.map((e) => (e.getAttribute('aria-label') ?? '').slice('Spaltenkopf '.length)),
    );
}

export function registerSpaltenTests(url: () => string): void {
  test('[R-5.2-08][R-5.2-09] F-UX2 P6: Spalte per Spaltenkopf-Menü rechts einfügen (nur dieser Tag) und gleich benennen; per Entf entfernen – Einträge bleiben mit P1; Rückgängig (Maus und Tastatur)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Spalten.wap.json', planFile(planEinfach()));
    const vorher = await spalten(wapPage, 'Mo 28.09.2026');
    expect(vorher.slice(0, 3)).toEqual(['Kp Kdt', 'Stv', 'Zfhr']);
    // Maus: Rechtsklick auf «Stv» → «Spalte rechts einfügen» → «Nur dieser Tag».
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Stv', exact: true })
      .click({ button: 'right' });
    await wapPage.getByRole('menuitem', { name: /Spalte rechts einfügen/ }).click();
    const frage = wapPage.getByRole('dialog', { name: 'Spalte rechts einfügen', exact: true });
    await expect(frage).toBeVisible();
    await frage.getByRole('button', { name: 'Nur dieser Tag', exact: true }).click();
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Neue Spalte');
    await name.fill('Zug 3');
    await name.press('Enter');
    await expect
      .poll(() => spalten(wapPage, 'Mo 28.09.2026'))
      .toEqual(['Kp Kdt', 'Stv', 'Zug 3', ...vorher.slice(2)]);
    expect(await spalten(wapPage, 'Di 29.09.2026')).toEqual(vorher);
    const blöcke = wapPage.getByRole('button', { name: /^Block (?!löschen|bearbeiten)/ });
    const anzahl = await blöcke.count();
    // Tastatur: Spaltenkopf «Stv» am Mo, Entf; der Tag hat jetzt einen eigenen Spaltensatz (keine Rückfrage).
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Stv', exact: true })
      .focus();
    await wapPage.keyboard.press('Delete');
    await expect.poll(() => spalten(wapPage, 'Mo 28.09.2026')).not.toContain('Stv');
    await expect(
      wapPage.getByText(/Spalte «Stv» entfernt · \d+ Einträge tragen Befund P1/),
    ).toBeVisible();
    // Nichts gelöscht: gleich viele Blöcke, «Nachbar» trägt die P1-Marke.
    await expect(blöcke).toHaveCount(anzahl);
    await expect(
      wapPage.getByRole('button', { name: /^Block Nachbar / }).locator('xpath=..'),
    ).toHaveClass(/i2-grid-p1/);
    // Rückgängig: Spalte zurück, Marke weg.
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect.poll(() => spalten(wapPage, 'Mo 28.09.2026')).toContain('Stv');
    await expect(
      wapPage.getByRole('button', { name: /^Block Nachbar / }).locator('xpath=..'),
    ).not.toHaveClass(/i2-grid-p1/);
    // Shift+F10 auf dem Kopf öffnet das Menü; Rap-Spalte ist nicht entfernbar.
    await kopf(wapPage, 'Di 29.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Rap', exact: true })
      .focus();
    await wapPage.keyboard.press('Shift+F10');
    await expect(wapPage.getByRole('menuitem', { name: /Spalte entfernen/ })).toBeDisabled();
    await wapPage.keyboard.press('Escape');
    // Shift+Einfg am Mi «Kdo», «Alle Tage mit diesem Spaltensatz»: neue Spalte ganz links an Mi, Do und Fr, Name per Esc unverändert.
    await kopf(wapPage, 'Mi 30.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Kdo', exact: true })
      .focus();
    await wapPage.keyboard.press('Shift+Insert');
    await wapPage
      .getByRole('dialog', { name: 'Spalte links einfügen', exact: true })
      .getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true })
      .click();
    await expect(wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Escape');
    await expect.poll(async () => (await spalten(wapPage, 'Mi 30.09.2026'))[0]).toBe('Neue Spalte');
    expect((await spalten(wapPage, 'Fr 02.10.2026'))[0]).toBe('Neue Spalte');
  });
}

// F-DOKU, Befund SA-2-08 / TR-2-06: Belege der neuen Katalog-IDs zu den Zusatzpunkten des Auftraggebers vom
// 19.10.2026 (N1, N2, N5; Gestaltung `docs/wap-planer/ui/raster-bedienung-v2.md` §4, §5, §7), umgesetzt in F-UX2:
// R-5.1-28 Auffüllen per Doppelklick auf die Blockkante, Ctrl+Shift+↑/↓ und Kontextmenü; R-5.1-29 Direktbearbeitung im
// Block; R-5.2-11 Spaltenkopf-Menü und Tasten; R-5.2-12 Rückfrage «Nur dieser Tag / Alle Tage mit diesem Spaltensatz».
// Entwicklungsserver, Abläufe über Rolle und Name (die Zeilen der Layout-Schicht und der Tageskopf über ihre
// Klassen, wie in F-UX2). Plan «planEinfach» aus F-UX2: Mo Wache Nord 0800-1000 (Kp Kdt), Nachbar 0900-0930 (Stv),
// Wache Süd 1100-1230 (fünf Spalten), Gemeinsam 1300-1400 (Kp Kdt, Stv), Sanitätsdienst 1500-1700 (Stv). Nur fiktive
// Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { planEinfach } from '../f-ux2/support/plaene';
import { startWith } from '../i5/support/ablauf';
import { planFile } from '../i5/support/plaene';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i5.html#leer';
const MO = 'Mo 28.09.2026';

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function flaeche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

/** Text der gezeichneten Zeilen eines Eintrags (Layout-Schicht). */
async function zeilen(entry: Locator): Promise<string> {
  return entry
    .locator('xpath=..')
    .evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('.i2-grid-line')]
        .map((l) => l.textContent ?? '')
        .join(' '),
    );
}

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

function spaltenkopf(page: Page, tag: string, name: string): Locator {
  return kopf(page, tag).getByRole('button', { name: `Spaltenkopf ${name}`, exact: true });
}

function rueckgaengig(page: Page): Locator {
  return page.getByRole('button', { name: 'Rückgängig', exact: true });
}

test.describe('F-DOKU R-5.1-28: Auffüllen bis zum Nachbarblock', () => {
  test('[R-5.1-28] Doppelklick auf die untere Kante füllt bis zum Beginn des folgenden Blocks mit gemeinsamer Spalte, auf die obere bis zum Rasterbeginn unter dem Band; je ein Undo-Schritt (Maus)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'Auffuellen.wap.json', planFile(planEinfach()));
    const nord = await flaeche(block(wapPage, 'Wache Nord'));
    await wapPage.mouse.dblclick(nord.x + nord.width / 2, nord.y + nord.height - 2);
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1100/);
    const n2 = await flaeche(block(wapPage, 'Wache Nord'));
    await wapPage.mouse.dblclick(n2.x + n2.width / 2, n2.y + 2);
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0500-1100/);
    // Der Nachbar in der anderen Spalte (Nachbar, Stv) bleibt unverändert.
    await expect(block(wapPage, 'Nachbar')).toHaveAccessibleName(/0900-0930/);
    await rueckgaengig(wapPage).click();
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1100/);
    await rueckgaengig(wapPage).click();
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1000/);
  });

  test('[R-5.1-28] Tastatur: Ctrl+Shift+↑ füllt bis zum Ende des vorangehenden, Ctrl+Shift+↓ bis zum Beginn des folgenden Blocks; Kontextmenü «Nach oben auffüllen»; Fokus bleibt am Block', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'AuffuellenTasten.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Gemeinsam').focus();
    await wapPage.keyboard.press('Control+Shift+ArrowUp');
    await expect(block(wapPage, 'Gemeinsam')).toHaveAccessibleName(/1230-1400/);
    await expect(block(wapPage, 'Gemeinsam')).toBeFocused();
    await wapPage.keyboard.press('Control+Shift+ArrowDown');
    await expect(block(wapPage, 'Gemeinsam')).toHaveAccessibleName(/1230-1500/);
    await rueckgaengig(wapPage).click();
    await expect(block(wapPage, 'Gemeinsam')).toHaveAccessibleName(/1230-1400/);
    // Kontextmenü: «Nachbar» (Stv) hat keinen Block davor in Stv → Rasterbeginn 0500.
    await block(wapPage, 'Nachbar').focus();
    await wapPage.keyboard.press('Shift+F10');
    await wapPage.getByRole('menuitem', { name: /Nach oben auffüllen/ }).click();
    await expect(block(wapPage, 'Nachbar')).toHaveAccessibleName(/0500-0930/);
  });
});

test.describe('F-DOKU R-5.1-29: Direktbearbeitung im Block', () => {
  test('[R-5.1-29] Doppelklick: kein sichtbares Eingabefeld, Titel und Zusatz erscheinen beim Tippen live in den Zeilen des Blocks, Tab wechselt das Feld, Enter übernimmt als ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'Direkt.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Nord').dblclick();
    const editor = wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true });
    const titel = editor.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(titel).toBeFocused();
    for (const name of ['Titel', 'Zusatz', 'Ltg', 'Ort'])
      expect(
        await editor
          .getByRole('textbox', { name, exact: true })
          .evaluate((i) => getComputedStyle(i).opacity),
        name,
      ).toBe('0');
    await titel.press('End');
    await titel.pressSequentially(' Ost');
    await expect.poll(() => zeilen(block(wapPage, 'Wache Nord'))).toContain('Ost');
    await titel.press('Tab');
    const zusatz = editor.getByRole('textbox', { name: 'Zusatz', exact: true });
    await expect(zusatz).toBeFocused();
    await zusatz.pressSequentially('Kurs fiktiv');
    await expect.poll(() => zeilen(block(wapPage, 'Wache Nord'))).toContain('Kurs fiktiv');
    await zusatz.press('Enter');
    await expect(block(wapPage, 'Wache Nord Ost')).toBeFocused();
    await expect(editor).toHaveCount(0);
    // Ein Undo-Schritt nimmt Titel und Zusatz zusammen zurück.
    await rueckgaengig(wapPage).click();
    await expect(block(wapPage, 'Wache Nord')).toBeVisible();
    await expect(block(wapPage, 'Wache Nord Ost')).toHaveCount(0);
    expect(await zeilen(block(wapPage, 'Wache Nord'))).not.toContain('Kurs fiktiv');
  });

  test('[R-5.1-29] F2 und Esc: Esc verwirft ohne Undo-Schritt; ein Klick daneben übernimmt (nur Tastatur bzw. Maus)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'DirektEsc.wap.json', planFile(planEinfach()));
    const undoVorher = await rueckgaengig(wapPage).getAttribute('title');
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('F2');
    const titel = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(titel).toBeFocused();
    await titel.press('End');
    await titel.pressSequentially(' weg');
    await expect.poll(() => zeilen(block(wapPage, 'Wache Süd'))).toContain('weg');
    await titel.press('Escape');
    await expect(block(wapPage, 'Wache Süd')).toBeFocused();
    expect(await zeilen(block(wapPage, 'Wache Süd'))).not.toContain('weg');
    expect(await rueckgaengig(wapPage).getAttribute('title'), 'kein Undo-Schritt').toBe(undoVorher);
    // Klick daneben (leere Fläche unter dem Block) übernimmt.
    await block(wapPage, 'Wache Süd').dblclick();
    await titel.press('End');
    await titel.pressSequentially(' Ost');
    const sued = await flaeche(block(wapPage, 'Wache Süd'));
    await wapPage.mouse.click(sued.x + sued.width / 2, sued.y + sued.height + 120);
    await expect(block(wapPage, 'Wache Süd Ost')).toBeVisible();
  });
});

test.describe('F-DOKU R-5.2-11 / R-5.2-12: Spaltenkopf-Menü, Tasten und Rückfrage', () => {
  test('[R-5.2-11] Shift+F10 auf dem Spaltenkopf öffnet das Menü mit «Spalte links einfügen» (Shift+Einfg), «Spalte rechts einfügen» (Einfg), «Umbenennen» (F2), «Spalte entfernen» (Entf); Rechtsklick ebenso; Esc schliesst', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'Menue.wap.json', planFile(planEinfach()));
    await spaltenkopf(wapPage, MO, 'Stv').focus();
    await wapPage.keyboard.press('Shift+F10');
    const items = wapPage.getByRole('menuitem');
    await expect(items).toHaveCount(4);
    const namen = await items.evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    expect(namen).toEqual([
      expect.stringMatching(/^Spalte links einfügen\s*Shift\+Einfg$/),
      expect.stringMatching(/^Spalte rechts einfügen\s*Einfg$/),
      expect.stringMatching(/^Umbenennen\s*F2$/),
      expect.stringMatching(/^Spalte entfernen\s*Entf$/),
    ]);
    await wapPage.keyboard.press('Escape');
    await expect(items).toHaveCount(0);
    await spaltenkopf(wapPage, MO, 'Stv').click({ button: 'right' });
    await expect(wapPage.getByRole('menuitem')).toHaveCount(4);
    await wapPage.keyboard.press('Escape');
  });

  test('[R-5.2-11][R-5.2-12] Einfg mit Rückfrage «Nur dieser Tag» → neue Spalte «Neue Spalte» rechts, Umbenennen sofort; danach ohne Rückfrage: Shift+Einfg links, F2 umbenennen, Entf entfernen; nur dieser Tag geändert', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'Tasten.wap.json', planFile(planEinfach()));
    const vorher = await spalten(wapPage, MO);
    const di = await spalten(wapPage, 'Di 29.09.2026');
    expect(vorher.slice(0, 3)).toEqual(['Kp Kdt', 'Stv', 'Zfhr']);
    // Einfg: Spaltensatz an Mo und Di verwendet → Rückfrage.
    await spaltenkopf(wapPage, MO, 'Stv').focus();
    await wapPage.keyboard.press('Insert');
    const frage = wapPage.getByRole('dialog', { name: 'Spalte rechts einfügen', exact: true });
    await expect(frage).toBeVisible();
    await expect(frage.getByRole('button', { name: 'Nur dieser Tag', exact: true })).toBeVisible();
    await expect(
      frage.getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true }),
    ).toBeVisible();
    await frage.getByRole('button', { name: 'Nur dieser Tag', exact: true }).click();
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Neue Spalte');
    await name.fill('Zug 3');
    await name.press('Enter');
    await expect
      .poll(() => spalten(wapPage, MO))
      .toEqual(['Kp Kdt', 'Stv', 'Zug 3', ...vorher.slice(2)]);
    expect(await spalten(wapPage, 'Di 29.09.2026'), 'Di unverändert').toEqual(di);
    // Shift+Einfg: Mo hat jetzt einen eigenen Spaltensatz → keine Rückfrage, neue Spalte links von «Kp Kdt».
    await spaltenkopf(wapPage, MO, 'Kp Kdt').focus();
    await wapPage.keyboard.press('Shift+Insert');
    await expect(wapPage.getByRole('dialog', { name: 'Spalte links einfügen' })).toHaveCount(0);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Neue Spalte');
    await name.press('Enter');
    await expect.poll(async () => (await spalten(wapPage, MO))[0]).toBe('Neue Spalte');
    // F2: umbenennen.
    await spaltenkopf(wapPage, MO, 'Neue Spalte').focus();
    await wapPage.keyboard.press('F2');
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Neue Spalte');
    await name.fill('Zug 0');
    await name.press('Enter');
    await expect.poll(async () => (await spalten(wapPage, MO))[0]).toBe('Zug 0');
    // Entf: entfernen.
    await spaltenkopf(wapPage, MO, 'Zug 0').focus();
    await wapPage.keyboard.press('Delete');
    await expect.poll(() => spalten(wapPage, MO)).not.toContain('Zug 0');
    expect(await spalten(wapPage, 'Di 29.09.2026')).toEqual(di);
  });

  test('[R-5.2-12] Rückfrage «Alle Tage mit diesem Spaltensatz» → Änderung an allen Tagen des Spaltensatzes (Mi–Fr), nicht an anderen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'AlleTage.wap.json', planFile(planEinfach()));
    const mo = await spalten(wapPage, MO);
    await spaltenkopf(wapPage, 'Mi 30.09.2026', 'Kdo').focus();
    await wapPage.keyboard.press('Shift+Insert');
    await wapPage
      .getByRole('dialog', { name: 'Spalte links einfügen', exact: true })
      .getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true })
      .click();
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true });
    await expect(name).toBeFocused();
    // Name unverändert lassen (Esc); das Umbenennen danach fragt erneut nach dem Geltungsbereich (Befund FD-04).
    await name.press('Escape');
    for (const tag of ['Mi 30.09.2026', 'Do 01.10.2026', 'Fr 02.10.2026'])
      await expect.poll(async () => (await spalten(wapPage, tag))[0], tag).toBe('Neue Spalte');
    expect(await spalten(wapPage, MO), 'Mo (anderer Spaltensatz) unverändert').toEqual(mo);
  });
});

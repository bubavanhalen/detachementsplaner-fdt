// H-UI2, Befunde UX-H-06, UX-H-09, SA-H-20 und SA-H-22 (UI-Richtlinie 4.1, 5.1, 5.9, 13.3, 13.4; R-11-07): Shift+→/←
// auf den Tagesköpfen erweitert einen Bereich ab dem Anker; Z wirkt am Beso (Seitenfeld, Feld «Zeit 1»); nach
// «Zeitfenster hinzufügen» und «Teilaufgabe hinzufügen» liegt der Fokus im neuen Feld; Zoom per Ctrl+Plus/Minus/0 im
// Raster und Ctrl+Mausrad über dem Papier. Abläufe über Rolle und Name, Maus und Tastatur. Nur fiktive Daten.
import { expect, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planBeso } from './plaene';

const TAGE = ['Mo 28.09.2026', 'Di 29.09.2026', 'Mi 30.09.2026', 'Do 01.10.2026', 'Fr 02.10.2026'];

function tag(page: Page, i: number) {
  return page.getByRole('button', { name: `Tag ${TAGE[i] ?? ''}`, exact: true });
}

async function gewaehlt(page: Page): Promise<boolean[]> {
  const out: boolean[] = [];
  for (let i = 0; i < TAGE.length; i++)
    out.push((await tag(page, i).getAttribute('aria-pressed')) === 'true');
  return out;
}

function panel(page: Page) {
  return page.getByRole('complementary', { name: 'Seitenfeld', exact: true });
}

export function registerTastaturTests(url: () => string): void {
  test('[R-11-07] H-UI2 UX-H-06: Tagesköpfe – Shift+→/← erweitert bzw. verkleinert den Bereich ab dem Anker, Shift-Klick bildet den Bereich vom Anker', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Tage.wap.json', planFile(planBeso()));
    await tag(wapPage, 0).focus();
    for (let i = 0; i < 3; i++) await wapPage.keyboard.press('Shift+ArrowRight');
    await expect(tag(wapPage, 3)).toBeFocused();
    expect(await gewaehlt(wapPage)).toEqual([true, true, true, true, false]);
    await wapPage.keyboard.press('Shift+ArrowLeft');
    expect(await gewaehlt(wapPage)).toEqual([true, true, true, false, false]);
    await expect(tag(wapPage, 2)).toBeFocused();
    // Pfeil ohne Shift bewegt nur den Fokus; die Auswahl bleibt.
    await wapPage.keyboard.press('ArrowRight');
    await expect(tag(wapPage, 3)).toBeFocused();
    expect(await gewaehlt(wapPage)).toEqual([true, true, true, false, false]);
    // Leertaste wählt nur diesen Tag (neuer Anker), Shift+← erweitert nach links.
    await wapPage.keyboard.press(' ');
    expect(await gewaehlt(wapPage)).toEqual([false, false, false, true, false]);
    await wapPage.keyboard.press('Shift+ArrowLeft');
    await wapPage.keyboard.press('Shift+ArrowLeft');
    expect(await gewaehlt(wapPage)).toEqual([false, true, true, true, false]);
    // Maus: Klick setzt den Anker, Shift-Klick den Bereich.
    await tag(wapPage, 1).click();
    await tag(wapPage, 4).click({ modifiers: ['Shift'] });
    expect(await gewaehlt(wapPage)).toEqual([false, true, true, true, true]);
    await tag(wapPage, 2).click({ modifiers: ['Shift'] });
    expect(await gewaehlt(wapPage)).toEqual([false, true, true, false, false]);
  });

  test('[R-11-07] H-UI2 UX-H-09: Z am gewählten Beso öffnet das Seitenfeld im Feld «Zeit 1»; nach «Zeitfenster hinzufügen» liegt der Fokus im neuen Zeitfeld (Maus und Tastatur)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Beso.wap.json', planFile(planBeso()));
    const beso = wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1000-1030 · Mo/ });
    await beso.click();
    await expect(beso).toBeFocused();
    await wapPage.keyboard.press('z');
    const zeit1 = panel(wapPage).getByRole('textbox', { name: 'Zeit 1', exact: true });
    await expect(zeit1).toBeFocused();
    await expect(zeit1).toHaveValue('1000-1030');
    // Maus: Zeitfenster hinzufügen → Fokus in «Zeit 2».
    await panel(wapPage)
      .getByRole('button', { name: 'Zeitfenster hinzufügen', exact: true })
      .click();
    const zeit2 = panel(wapPage).getByRole('textbox', { name: 'Zeit 2', exact: true });
    await expect(zeit2).toBeFocused();
    await wapPage.keyboard.type('1400-1430');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1400-1430 · Mo/ }),
    ).toHaveCount(1);
    // Tastatur: Fokus auf den Knopf, Enter → Fokus in «Zeit 3».
    const add = panel(wapPage).getByRole('button', { name: 'Zeitfenster hinzufügen', exact: true });
    await add.focus();
    await wapPage.keyboard.press('Enter');
    await expect(
      panel(wapPage).getByRole('textbox', { name: 'Zeit 3', exact: true }),
    ).toBeFocused();
  });

  test('[R-11-07] H-UI2 SA-H-20: nach «Teilaufgabe hinzufügen» liegt der Fokus im neuen Titelfeld (Maus und Tastatur)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Teil.wap.json', planFile(planBeso()));
    await wapPage.getByRole('button', { name: /^Block Wache Nord / }).click();
    await wapPage.keyboard.press('e');
    const add = panel(wapPage).getByRole('button', { name: 'Teilaufgabe hinzufügen', exact: true });
    await add.click();
    const t1 = panel(wapPage).getByRole('textbox', { name: 'Titel Teilaufgabe 1', exact: true });
    await expect(t1).toBeFocused();
    await wapPage.keyboard.type('Material fassen');
    await wapPage.keyboard.press('Enter');
    await add.focus();
    await wapPage.keyboard.press('Enter');
    await expect(
      panel(wapPage).getByRole('textbox', { name: 'Titel Teilaufgabe 2', exact: true }),
    ).toBeFocused();
    await expect(t1).toHaveValue('Material fassen');
  });

  test('[R-11-07] H-UI2 SA-H-22: Zoom per Tastatur im Raster (Ctrl+Plus, Ctrl+Minus, Ctrl+0) und mit Ctrl+Mausrad über dem Papier', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zoom.wap.json', planFile(planBeso()));
    const zoom = wapPage.getByRole('status', { name: 'Zoomstufe', exact: true });
    const fit = wapPage.getByRole('button', { name: 'Einpassen', exact: true });
    if ((await fit.getAttribute('aria-pressed')) === 'true') await fit.click();
    await expect(zoom).toHaveText('100 %');
    await wapPage
      .getByRole('button', { name: /^Mo 28\.09\. 0800 / })
      .first()
      .focus();
    await wapPage.keyboard.press('Control+=');
    await expect(zoom).toHaveText('125 %');
    await wapPage.keyboard.press('Control++');
    await expect(zoom).toHaveText('150 %');
    await wapPage.keyboard.press('Control+-');
    await expect(zoom).toHaveText('125 %');
    await wapPage.keyboard.press('Control+0');
    await expect(fit).toHaveAttribute('aria-pressed', 'true');
    await fit.click();
    await expect(zoom).toHaveText('100 %');
    // Ctrl+Mausrad über dem Papier: hinauf vergrössert, hinunter verkleinert; der Zeiger bleibt über derselben Stelle.
    const scroller = wapPage.locator('.i2-grid-scroll');
    const area = await scroller.boundingBox();
    if (area === null) throw new Error('Raster ohne Lage.');
    await wapPage.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
    await wapPage.keyboard.down('Control');
    await wapPage.mouse.wheel(0, -120);
    await wapPage.keyboard.up('Control');
    await expect(zoom).toHaveText('125 %');
    await wapPage.keyboard.down('Control');
    await wapPage.mouse.wheel(0, 120);
    await wapPage.mouse.wheel(0, 120);
    await wapPage.keyboard.up('Control');
    await expect(zoom).toHaveText('75 %');
    // Ohne Ctrl rollt das Mausrad nur.
    await wapPage.mouse.wheel(0, 200);
    await expect(zoom).toHaveText('75 %');
  });
}

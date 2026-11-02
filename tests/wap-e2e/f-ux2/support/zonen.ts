// F-UX2 P4 und P5 (Rückmeldung N4, N5 vom 19.10.2026; Gestaltung raster-bedienung-v2 §2, §3, §5; UI-Richtlinie 5.5):
// Mauszeiger je Zone, Hervorhebung des Eintrags, den ein Drücken trifft (auch Beso-Kästchen über einem Block), Grösse
// an der oberen/unteren Kante, Spaltenspanne an der Seite des gewählten Blocks; Doppelklick auf die obere/untere Kante
// füllt bis zum Nachbarblock auf (Ctrl+Shift+↑/↓, Kontextmenü), je ein Undo-Schritt. Maus und Tastatur. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planEinfach } from './plaene';

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

async function zeiger(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px ?? 0, py ?? 0)?.closest<HTMLElement>('[data-day]');
      const hover = document.querySelector<HTMLElement>('.i2-grid-hover');
      const r = hover?.getBoundingClientRect();
      return {
        cursor: el === null || el === undefined ? '' : getComputedStyle(el).cursor,
        zone: hover?.style.display === 'block' ? (hover.dataset.zone ?? '') : '',
        hover:
          r === undefined || hover?.style.display !== 'block'
            ? null
            : { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    },
    [x, y],
  );
}

export function registerZonenTests(url: () => string): void {
  test('[R-5.1-14] F-UX2 P4: Mauszeiger und Hervorhebung je Zone – Körper, obere/untere Kante, seitlich an jedem Block (F-UX3), leere Fläche, Rap-Spalte; Ziehen an der Kante ändert Beginn bzw. Ende', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zonen.wap.json', planFile(planEinfach()));
    const süd = await fläche(block(wapPage, 'Wache Süd'));
    const mitte = await zeiger(wapPage, süd.x + süd.width / 2, süd.y + süd.height / 2);
    expect(mitte.cursor).toBe('grab');
    expect(mitte.zone).toBe('body');
    expect(mitte.hover).not.toBeNull();
    expect(Math.abs((mitte.hover?.w ?? 0) - süd.width)).toBeLessThan(1.5);
    expect((await zeiger(wapPage, süd.x + süd.width / 2, süd.y + 3)).cursor).toBe('ns-resize');
    expect((await zeiger(wapPage, süd.x + süd.width / 2, süd.y + 3)).zone).toBe('start');
    expect((await zeiger(wapPage, süd.x + süd.width / 2, süd.y + süd.height - 3)).zone).toBe('end');
    // Seitlich: an jedem Block, gewählt oder nicht (Auftrag Koordinator 21.10.2026, F-UX3: Zonen ohne vorheriges
    // Wählen; vorher erst am gewählten Block).
    expect((await zeiger(wapPage, süd.x + 2, süd.y + süd.height / 2)).cursor).toBe('ew-resize');
    await wapPage.mouse.click(süd.x + süd.width / 2, süd.y + süd.height / 2);
    await expect(block(wapPage, 'Wache Süd')).toHaveAttribute('aria-pressed', 'true');
    expect((await zeiger(wapPage, süd.x + 2, süd.y + süd.height / 2)).cursor).toBe('ew-resize');
    // Leere Fläche und Rap-Spalte.
    expect((await zeiger(wapPage, süd.x + süd.width / 2, süd.y - 60)).cursor).toBe('crosshair');
    const rap = await wapPage
      .getByRole('button', { name: 'Rap-Spalte Mo', exact: true })
      .boundingBox();
    if (rap === null) throw new Error('Rap-Spalte fehlt');
    const leer = await zeiger(wapPage, rap.x + rap.width / 2, rap.y + 300);
    expect(leer.cursor).toBe('cell');
    expect(leer.hover).toBeNull();
    // Untere Kante 15 Min nach unten ziehen: Ende 1230 → 1245; obere Kante 15 Min nach oben: Beginn 1100 → 1045.
    await wapPage.mouse.move(süd.x + süd.width / 2, süd.y + süd.height - 3);
    await wapPage.mouse.down();
    await wapPage.mouse.move(süd.x + süd.width / 2, süd.y + süd.height - 3 + 12, { steps: 4 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Wache Süd')).toHaveAccessibleName(/1100-1245/);
    const s2 = await fläche(block(wapPage, 'Wache Süd'));
    await wapPage.mouse.move(s2.x + s2.width / 2, s2.y + 3);
    await wapPage.mouse.down();
    await wapPage.mouse.move(s2.x + s2.width / 2, s2.y + 3 - 12, { steps: 4 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Wache Süd')).toHaveAccessibleName(/1045-1245/);
  });

  test('[R-5.1-14] F-UX2 P5: Doppelklick auf die untere bzw. obere Kante füllt bis zum Nachbarblock bzw. Rasterbeginn auf; Ctrl+Shift+↑/↓ und Kontextmenü; je ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Auffuellen.wap.json', planFile(planEinfach()));
    const nord = await fläche(block(wapPage, 'Wache Nord'));
    // Unten: bis «Wache Süd» (1100), die dieselbe Spalte belegt.
    await wapPage.mouse.dblclick(nord.x + nord.width / 2, nord.y + nord.height - 2);
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1100/);
    // Oben: kein Block davor → Rasterbeginn unter dem Band (0500).
    const n2 = await fläche(block(wapPage, 'Wache Nord'));
    await wapPage.mouse.dblclick(n2.x + n2.width / 2, n2.y + 2);
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0500-1100/);
    // Ein Undo-Schritt je Auffüllen.
    const undo = wapPage.getByRole('button', { name: 'Rückgängig', exact: true });
    await undo.click();
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1100/);
    await undo.click();
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1000/);
    // Tastatur: «Gemeinsam» (1300-1400) nach oben bis «Wache Süd» (1230), nach unten bis «Sanitätsdienst» (1500).
    await block(wapPage, 'Gemeinsam').focus();
    await wapPage.keyboard.press('Control+Shift+ArrowUp');
    await expect(block(wapPage, 'Gemeinsam')).toHaveAccessibleName(/1230-1400/);
    await expect(block(wapPage, 'Gemeinsam')).toBeFocused();
    await wapPage.keyboard.press('Control+Shift+ArrowDown');
    await expect(block(wapPage, 'Gemeinsam')).toHaveAccessibleName(/1230-1500/);
    // Kontextmenü (Shift+F10): «Nach unten auffüllen» am «Nachbar» (0900-0930) bis «Wache Süd» (1100).
    await block(wapPage, 'Nachbar').focus();
    await wapPage.keyboard.press('Shift+F10');
    await wapPage.getByRole('menuitem', { name: /Nach unten auffüllen/ }).click();
    await expect(block(wapPage, 'Nachbar')).toHaveAccessibleName(/0900-1100/);
    // Schon bündig: Meldung, keine Änderung.
    await block(wapPage, 'Nachbar').focus();
    await wapPage.keyboard.press('Control+Shift+ArrowDown');
    await expect(
      wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }),
    ).toContainText('schon an');
  });
}

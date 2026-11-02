// F-FIX Runde 2, Befund FD-02 (übernommen aus F-DOKU, trace `--mode fast`: R-4.6-61 ohne Test; SA-H-17): Verknüpfte
// Teilblöcke werden gemeinsam bearbeitet.
// Kriterium (Katalog): Titeländerung oder Verschieben an einem Teilblock wirkt auf beide. Ein Block in den nicht
// benachbarten Spalten «Kp Kdt» und «Zfhr» (R-4.6-60, ADR-002 Punkt 5: ein Eintrag mit zwei Teilstücken) wird am
// rechten Teilblock umbenannt (Tastatur) und verschoben (Maus); beide Teilblöcke zeigen danach den neuen Titel bzw.
// liegen eine Stunde später. Das Erfassen solcher Blöcke im Seitenfeld (nur zusammenhängende Spalten) ist nicht Teil
// dieses Kriteriums (Befund SA-H-17). Beim Verschieben bleiben die Teilblöcke getrennt, auch nach dem Neuladen (FD-02).
// Gezeichnete Zeilen mit Trennstrich am Zeilenende werden für den Titelvergleich zusammengefügt. Entwicklungsserver;
// nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../i5/support/ablauf';
import { planFile } from '../i5/support/plaene';
import { test } from '../support/fixtures';
import { planTeilbloecke } from './support/plaene';

const URL = '/tests/wap-e2e/harness/i5.html#leer';

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

/** Seitenlage und Text der Teilstücke (gezeichnete Flächen) eines Eintrags, links nach rechts. */
async function teile(entry: Locator): Promise<{ x: number; y: number; w: number; h: number }[]> {
  return entry.locator('xpath=..').evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('[data-flaeche]')]
      .map((s) => {
        const r = s.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      })
      .sort((a, b) => a.x - b.x),
  );
}

/** Texte der gezeichneten Zeilen je Teilstück (nach der x-Lage der Zeile). */
async function texteJeTeil(entry: Locator): Promise<string[]> {
  const flaechen = await teile(entry);
  const zeilen = await entry.locator('xpath=..').evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.i2-grid-line')].map((l) => {
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width / 2, text: l.textContent ?? '' };
    }),
  );
  return flaechen.map((f) =>
    zeilen
      .filter((z) => z.x >= f.x - 1 && z.x <= f.x + f.w + 1)
      .map((z) => z.text)
      .join(' ')
      // Silbentrennung der Layout-Schicht («Doppelpos-» / «ten») für den Vergleich aufheben.
      .replace(/(\p{L})- (\p{L})/gu, '$1$2'),
  );
}

test('[R-4.6-61] Ausgang: ein Block in zwei nicht benachbarten Spalten ist ein Eintrag mit zwei Teilblöcken, jeder mit dem Titel', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'Teilbloecke.wap.json', planFile(planTeilbloecke()));
  const b = block(wapPage, 'Doppelposten');
  await expect(b).toHaveCount(1);
  const t = await teile(b);
  expect(t).toHaveLength(2);
  expect((t[1]?.x ?? 0) - ((t[0]?.x ?? 0) + (t[0]?.w ?? 0)), 'Lücke (Spalte Stv)').toBeGreaterThan(
    10,
  );
  expect(await texteJeTeil(b)).toEqual([
    expect.stringContaining('Doppelposten'),
    expect.stringContaining('Doppelposten'),
  ]);
});

test('[R-4.6-61] Titeländerung am rechten Teilblock (Klick, F2, Enter) wirkt auf beide Teilblöcke; ein Undo-Schritt', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'TeilbloeckeTitel.wap.json', planFile(planTeilbloecke()));
  const b = block(wapPage, 'Doppelposten');
  const [, rechts] = await teile(b);
  if (rechts === undefined) throw new Error('rechter Teilblock fehlt');
  await wapPage.mouse.click(rechts.x + rechts.w / 2, rechts.y + rechts.h / 2);
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  await wapPage.keyboard.press('F2');
  const titel = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
  await expect(titel).toBeFocused();
  await titel.press('End');
  await titel.pressSequentially(' Nord');
  await titel.press('Enter');
  const neu = block(wapPage, 'Doppelposten Nord');
  await expect(neu).toHaveCount(1);
  await expect
    .poll(() => texteJeTeil(neu))
    .toEqual([expect.stringContaining('Nord'), expect.stringContaining('Nord')]);
  await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(block(wapPage, 'Doppelposten')).toBeVisible();
  await expect
    .poll(async () => (await texteJeTeil(block(wapPage, 'Doppelposten'))).join(' '))
    .not.toContain('Nord');
});

test('[R-4.6-61] Verschieben am rechten Teilblock (Maus, eine Stunde nach unten) verschiebt beide Teilblöcke; sie bleiben getrennt, auch nach dem Neuladen', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'TeilbloeckeZiehen.wap.json', planFile(planTeilbloecke()));
  const b = block(wapPage, 'Doppelposten');
  const [links, rechts] = await teile(b);
  if (links === undefined || rechts === undefined) throw new Error('Teilblöcke fehlen');
  const proMinute = rechts.h / 120;
  const x = rechts.x + rechts.w / 2;
  const y = rechts.y + rechts.h / 2;
  await wapPage.mouse.move(x, y);
  await wapPage.mouse.down();
  await wapPage.mouse.move(x, y + 60 * proMinute, { steps: 8 });
  await wapPage.mouse.up();
  await expect(b).toHaveAccessibleName(/0900-1100/);
  // Beide Teilblöcke eine Stunde tiefer (Toleranz 1,5 px für Rundung der Bildschirmlage).
  const tiefer = 60 * proMinute;
  await expect
    .poll(async () => (await teile(b)).map((t) => Math.abs(t.y - links.y - tiefer) < 1.5))
    .toEqual([true, true]);
  // Spalten unverändert: beide Teilblöcke an ihrer x-Lage.
  const nachher = await teile(b);
  expect(Math.abs((nachher[0]?.x ?? 0) - links.x)).toBeLessThan(1.5);
  expect(Math.abs((nachher[1]?.x ?? 0) - rechts.x)).toBeLessThan(1.5);
  // Nach dem Neuladen bleiben die Teilblöcke getrennt (FD-02): zwei Flächen an den alten x-Lagen.
  await wapPage.reload();
  const geladen = block(wapPage, 'Doppelposten');
  await expect(geladen).toHaveAccessibleName(/0900-1100/);
  await expect.poll(async () => (await teile(geladen)).length).toBe(2);
  const lage = await teile(geladen);
  expect(Math.abs((lage[0]?.x ?? 0) - links.x)).toBeLessThan(1.5);
  expect(Math.abs((lage[1]?.x ?? 0) - rechts.x)).toBeLessThan(1.5);
});

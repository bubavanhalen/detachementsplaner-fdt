// F-UX2 P2 (Rückmeldung N2 vom 19.10.2026: «am besten ist wenn der Text direkt im Block editierbar wird anstelle von
// einem InputBlock»; Beschrieb 5.1; UI-Richtlinie 5.4; ADR-004 Leitplanke 2): Kein sichtbares Eingabefeld über dem
// Block. Der Block zeigt live den Text der Layout-Schicht mit Schreibmarke und Markierung; Klick in den Text setzt die
// Marke, Shift+Pfeile markieren, Ctrl+B fett, IME und Umlaute, Kopieren/Einfügen, Ctrl+Z innerhalb der Bearbeitung,
// Enter übernimmt als ein Undo-Schritt, Esc verwirft. Maus und Tastatur. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planEinfach } from './plaene';

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

/** Text der gezeichneten Zeilen eines Eintrags (Layout-Schicht), mit Schnitt je Lauf. */
async function zeilen(entry: Locator): Promise<{ text: string; bold: boolean[] }[]> {
  return entry.locator('xpath=..').evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.i2-grid-line')].map((l) => {
      const leaves = [l, ...l.querySelectorAll<HTMLElement>('span')].filter(
        (s) => s.children.length === 0 && (s.textContent ?? '') !== '',
      );
      return {
        text: l.textContent ?? '',
        bold: leaves.map((s) => Number(getComputedStyle(s).fontWeight) >= 700),
      };
    }),
  );
}

/** Schreibmarke im Block (sichtbar, 1–3 px breit) relativ zur letzten Zeile mit `text`. */
async function marke(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('.i2-grid-inline-caret');
    const r = c?.getBoundingClientRect();
    return r === undefined ? null : { x: r.left, y: r.top, w: r.width, h: r.height };
  });
}

async function zeilenBox(entry: Locator, text: string) {
  return entry.locator('xpath=..').evaluate((el, t) => {
    const line = [...el.querySelectorAll<HTMLElement>('.i2-grid-line')].find((l) =>
      (l.textContent ?? '').includes(t),
    );
    const r = line?.getBoundingClientRect();
    return r === undefined ? null : { x: r.left, y: r.top, right: r.right, bottom: r.bottom };
  }, text);
}

export function registerDirektTests(url: () => string): void {
  test('[R-5.1-08][R-5.1-10][R-5.1-11] F-UX2 P2: Doppelklick bearbeitet den Text im Block – kein sichtbares Eingabefeld, Text und Schreibmarke live aus der Layout-Schicht, Klick setzt die Marke, Enter = ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Direkt.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Nord').dblclick();
    const editor = wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true });
    const title = editor.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    // Kein sichtbares Eingabefeld: die Felder sind durchsichtig und ohne eigene Schrift.
    for (const name of ['Titel', 'Zusatz', 'Ltg', 'Ort'])
      expect(
        await editor
          .getByRole('textbox', { name, exact: true })
          .evaluate((i) => getComputedStyle(i).opacity),
        name,
      ).toBe('0');
    await title.press('End');
    await title.pressSequentially(' Ost');
    // Live im Block: die Zeilen kommen aus der Layout-Schicht (Umbruch wie im PDF), Name bleibt bis Enter.
    await expect
      .poll(async () => (await zeilen(block(wapPage, 'Wache Nord'))).map((z) => z.text).join(' '))
      .toContain('Ost');
    const m = await marke(wapPage);
    const ost = await zeilenBox(block(wapPage, 'Wache Nord'), 'Ost');
    expect(m, 'Schreibmarke im Block').not.toBeNull();
    expect(ost).not.toBeNull();
    if (m === null || ost === null) return;
    // Schmal in Schreibrichtung (waagrechte oder gedrehte Zeile), am Ende des Textes in der Zeile.
    expect(Math.min(m.w, m.h)).toBeLessThanOrEqual(3);
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    expect(cx).toBeGreaterThanOrEqual(ost.x - 3);
    expect(cx).toBeLessThanOrEqual(ost.right + 3);
    expect(cy).toBeGreaterThanOrEqual(ost.y - 3);
    expect(cy).toBeLessThanOrEqual(ost.bottom + 3);
    const amEnde = Math.min(
      Math.abs(cx - ost.right),
      Math.abs(cy - ost.y),
      Math.abs(cy - ost.bottom),
    );
    expect(amEnde, 'Marke am Ende des Textes').toBeLessThan(3);
    // Maus: Klick vor das erste Zeichen setzt die Marke an den Anfang.
    const erste = await zeilenBox(block(wapPage, 'Wache Nord'), 'Wache');
    if (erste === null) throw new Error('Zeile fehlt');
    const senkrecht = erste.bottom - erste.y > erste.right - erste.x;
    // Waagrecht: links neben dem ersten Zeichen; senkrecht (von unten nach oben): unten.
    if (senkrecht) await wapPage.mouse.click((erste.x + erste.right) / 2, erste.bottom - 1);
    else await wapPage.mouse.click(erste.x + 1, (erste.y + erste.bottom) / 2);
    await expect(title).toBeFocused();
    expect(await title.evaluate((i) => (i as HTMLInputElement).selectionStart)).toBe(0);
    // Tastatur: Shift+End markiert alles; die Markierung liegt im Block.
    await title.press('Shift+End');
    await expect(wapPage.locator('.i2-grid-inline-mark').first()).toBeVisible();
    await title.press('End');
    await title.press('Enter');
    await expect(block(wapPage, 'Wache Nord Ost')).toBeFocused();
    // Ein Undo-Schritt nimmt die ganze Bearbeitung zurück.
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(block(wapPage, 'Wache Nord')).toBeVisible();
    await expect(block(wapPage, 'Wache Nord Ost')).toHaveCount(0);
  });

  test('[R-5.1-13][R-5.1-23] F-UX2 P2: Ctrl+B fett, Umlaute und IME, Kopieren/Einfügen und Ctrl+Z in der Bearbeitung; Esc verwirft (nur Tastatur)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Direkt.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('F2');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    // Umlaute und Zusammensetzen per IME (Komposition, dann Übernahme).
    await title.press('End');
    await title.pressSequentially(' für ');
    const cdp = await wapPage.context().newCDPSession(wapPage);
    await cdp.send('Input.imeSetComposition', { text: 'Ü', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.insertText', { text: 'Übung' });
    await expect(title).toHaveValue('Wache Süd für Übung');
    await expect
      .poll(async () => (await zeilen(block(wapPage, 'Wache Süd'))).map((z) => z.text).join(' '))
      .toContain('Übung');
    // Ctrl+B macht «Übung» normal (neue Titel sind ganz fett).
    for (let i = 0; i < 'Übung'.length; i++) await title.press('Shift+ArrowLeft');
    await title.press('Control+b');
    await expect
      .poll(async () =>
        (await zeilen(block(wapPage, 'Wache Süd')))
          .filter((z) => z.text.includes('Übung'))
          .flatMap((z) => z.bold),
      )
      .toContain(false);
    // Kopieren und Einfügen von Text innerhalb des Feldes.
    await title.press('Control+c');
    await title.press('End');
    await title.press('Control+v');
    await expect(title).toHaveValue('Wache Süd für ÜbungÜbung');
    // Ctrl+Z nimmt das Einfügen zurück, die Bearbeitung bleibt offen.
    await title.press('Control+z');
    await expect(title).toHaveValue('Wache Süd für Übung');
    await expect(title).toBeFocused();
    // Esc verwirft alles: Titel wie vorher, ganz fett.
    await title.press('Escape');
    await expect(block(wapPage, 'Wache Süd')).toBeFocused();
    expect((await zeilen(block(wapPage, 'Wache Süd'))).flatMap((z) => z.bold)).not.toContain(false);
    expect((await zeilen(block(wapPage, 'Wache Süd'))).map((z) => z.text).join(' ')).not.toContain(
      'Übung',
    );
  });

  test('[R-5.1-02][R-5.1-03] F-UX2 P2: neuer Block per Ziehen – der Titel erscheint beim Tippen im neuen Block (Vorschau der Layout-Schicht), Tab zum Zusatz zeigt ihn als zweite Zeile', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Direkt.wap.json', planFile(planEinfach()));
    const area = wapPage.getByRole('button', { name: 'Leere Fläche Mo Uof', exact: true });
    const a = await area.boundingBox();
    if (a === null) throw new Error('Fläche fehlt');
    const y = (min: number) => a.y + (min - 240) * 0.8;
    await wapPage.mouse.move(a.x + a.width / 2, y(540) + 1);
    await wapPage.mouse.down();
    await wapPage.mouse.move(a.x + a.width / 2, y(660) - 1, { steps: 6 });
    await wapPage.mouse.up();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    await wapPage.keyboard.type('Nachtübung');
    const vorschau = () =>
      wapPage.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '.i2-grid-entry[aria-hidden="true"] .i2-grid-line',
          ),
        ].map((l) => l.textContent ?? ''),
      );
    await expect.poll(async () => (await vorschau()).join(' ')).toContain('Nacht');
    await wapPage.keyboard.press('Tab');
    await expect(wapPage.getByRole('textbox', { name: 'Zusatz', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Gelände');
    await expect.poll(async () => (await vorschau()).join(' ')).toContain('Gelände');
    await wapPage.keyboard.press('Enter');
    await expect(block(wapPage, 'Nachtübung')).toBeVisible();
    await expect(block(wapPage, 'Nachtübung')).toHaveAccessibleName(/0900-1100/);
  });
}

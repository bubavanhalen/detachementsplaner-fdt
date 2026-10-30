// F-UX3 Zusatz zu Runde 5 (Bedienungsprüfung ux-critic F-UX3, Auftrag Koordinator 23.10.2026): Text des angehobenen
// Blocks beim Kantenzug wie im Ruhezustand (UX-FUX3-01); Kante hält ohne Taste am Tagesende mit Hinweis (UX-FUX3-02);
// Shift-Mitschieben am Tagesende mit Hinweis (UX-FUX3-03); Klick in die untere Kantenzone während der
// Direktbearbeitung setzt die Schreibmarke (UX-FUX3-04); gegriffene Pille verdeckt den Nachbarn nicht, Plakette ≥ 11 px
// (UX-FUX3-05); Greif-Versatz beim Einrasten der Kante (UX-FUX3-06). Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

const MINUTE = 0.8;

/**
 * Mo in Kdt: Anna 0800–0900, Text 1000–1200 (mit Zusatz), Alpha 1300–1400, Bravo 1400–1500 (gemeinsame Kante),
 * Spät 2100–2200, Nacht 2330–2400.
 */
function planZusatz5(): Plan {
  let plan = kpPlan(1);
  const [kdt] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined) throw new Error('Spalten fehlen');
  const block = (from: number, to: number, title: string, supplement = '') => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids', ids: [kdt.id] } as const,
    title: [{ text: title, bold: true }],
    supplement,
  });
  plan = add(plan, block(480, 540, 'Anna')).plan;
  plan = add(plan, block(600, 720, 'Text', 'Zweite Zeile')).plan;
  plan = add(plan, block(780, 840, 'Alpha')).plan;
  plan = add(plan, block(840, 900, 'Bravo')).plan;
  plan = add(plan, block(1260, 1320, 'Spät')).plan;
  plan = add(plan, block(1410, 1440, 'Nacht')).plan;
  return { ...plan, id: 'fux3-zusatz5', exerciseName: 'Zusatz 5 Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

const schild = (page: Page) =>
  page.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true });
const badge = (page: Page) => schild(page).locator('.i2-grid-mode');

async function zoom50(page: Page): Promise<void> {
  const klein = page.getByRole('button', { name: 'Verkleinern', exact: true });
  await klein.click();
  await klein.click();
  await expect(page.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText('50 %');
}

interface Zeile {
  readonly text: string;
  readonly font: string;
  readonly x: number;
  readonly y: number;
}

/** Sichtbare Zeilen (Text, Schriftgrösse, Lage auf dem Bildschirm) unter `root`. */
function zeilenVon(page: Page, selector: string): Promise<Zeile[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (root === null) return [];
    return [...root.querySelectorAll<HTMLElement>('.i2-grid-line')]
      .filter((l) => l.getClientRects().length > 0 && getComputedStyle(l).visibility !== 'hidden')
      .map((l) => {
        const r = l.getBoundingClientRect();
        return {
          text: l.textContent ?? '',
          font: getComputedStyle(l).fontSize,
          x: Math.round(r.left * 2) / 2,
          y: Math.round(r.top * 2) / 2,
        };
      });
  }, selector);
}

function gleich(a: readonly Zeile[], b: readonly Zeile[]): boolean {
  return (
    a.length === b.length &&
    a.every((z, i) => {
      const o = b[i];
      return (
        o !== undefined &&
        o.text === z.text &&
        o.font === z.font &&
        Math.abs(o.x - z.x) <= 1 &&
        Math.abs(o.y - z.y) <= 1
      );
    })
  );
}

export function registerZusatz5Tests(url: () => string): void {
  test('[R-5.1-14] F-UX3 UX-FUX3-01: beim Kantenzug zeigt der angehobene Block den Text wie im Ruhezustand (gleiche Schrift, Lage und Zeilen), oben wie unten', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Text.wap.json', planFile(planZusatz5()));
    const entry = block(wapPage, 'Text');
    const id = await entry.getAttribute('data-entry-id');
    const sel = `[data-entry-id="${id ?? ''}"]`;
    const ruhe = await wapPage.evaluate(
      (s) => document.querySelector(s)?.parentElement?.dataset.viewKey ?? '',
      sel,
    );
    const vorher = await zeilenVon(wapPage, `[data-view-key="${ruhe}"]`);
    expect(vorher.length, JSON.stringify(vorher)).toBeGreaterThanOrEqual(2);
    expect(vorher.map((z) => z.text).join(' ')).toContain('Zweite Zeile');
    const b = await fläche(entry);
    const x = b.x + b.width / 2;
    for (const [y0, dy] of [
      [b.y + b.height - 3, 30 * MINUTE],
      [b.y + b.height - 3, -30 * MINUTE],
      [b.y + 3, -30 * MINUTE],
    ] as const) {
      await wapPage.mouse.move(x, y0);
      await wapPage.mouse.down();
      await wapPage.mouse.move(x, y0 + Math.sign(dy) * 5, { steps: 2 });
      await wapPage.mouse.move(x, y0 + dy, { steps: 4 });
      await expect(wapPage.locator('.i2-grid-lift')).toBeVisible();
      // Text in einer eigenen Ebene, nicht gestreckt und ohne Ersatztext: Zeilen wie im Ruhezustand.
      await expect
        .poll(
          async () => {
            return gleich(vorher, await zeilenVon(wapPage, '.i2-grid-lift .i2-lift-tx'));
          },
          { timeout: 2000, message: 'Zeilen im angehobenen Block wie im Ruhezustand' },
        )
        .toBe(true);
      await wapPage.keyboard.press('Escape');
      await wapPage.mouse.up();
      await expect(entry).toHaveAccessibleName(/1000-1200/);
    }
  });

  test('[R-5.1-14] F-UX3 UX-FUX3-02: die Unterkante hält ohne Taste (und mit Alt) bei 2400 an wie mit Shift, Hinweis im Zeitschild; nichts reicht in den Folgetag', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Ende.wap.json', planFile(planZusatz5()));
    await zoom50(wapPage);
    // Nacht aus dem Weg (Spät hat unten freie Bahn bis Tagesende).
    await block(wapPage, 'Nacht').focus();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Nacht')).toHaveCount(0);
    const s = await fläche(block(wapPage, 'Spät'));
    const tag = await wapPage.locator(`[data-day="${MO}"]`).first().boundingBox();
    if (tag === null) throw new Error('Tag fehlt');
    const x = s.x + s.width / 2;
    const unten = Math.min(1000 - 5, tag.y + tag.height + 80);
    // Mit Alt (nach dem Greifen gedrückt): gleiche Grenze.
    await wapPage.mouse.move(x, s.y + s.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, s.y + s.height + 4, { steps: 2 });
    await wapPage.keyboard.down('Alt');
    await wapPage.mouse.move(x, unten, { steps: 8 });
    await expect(schild(wapPage)).toContainText('2100-2400');
    await expect(badge(wapPage)).toHaveText(
      'Alt · Tagesende 2400 · über Mitternacht: Zeit eingeben (Z)',
    );
    await wapPage.keyboard.up('Alt');
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
    // Ohne Taste.
    await wapPage.mouse.move(x, s.y + s.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, s.y + s.height + 4, { steps: 2 });
    await wapPage.mouse.move(x, unten, { steps: 8 });
    await expect(schild(wapPage)).toContainText('2100-2400');
    await expect(badge(wapPage)).toHaveText('Tagesende 2400 · über Mitternacht: Zeit eingeben (Z)');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Spät')).toHaveAccessibleName(/2100-2400/);
    await expect(wapPage.getByRole('alert')).toHaveCount(0);
  });

  test('[R-5.1-14] F-UX3 UX-FUX3-03: Shift-Mitschieben an der Kante hält am Tagesende mit Hinweis', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Shift.wap.json', planFile(planZusatz5()));
    await zoom50(wapPage);
    const s = await fläche(block(wapPage, 'Spät'));
    const x = s.x + s.width / 2;
    await wapPage.mouse.move(x, s.y + s.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, s.y + s.height + 4, { steps: 2 });
    await wapPage.keyboard.down('Shift');
    // +90 Min: Nacht (2330–2400) kann nicht weiter, die Kante hält an.
    await wapPage.mouse.move(x, s.y + s.height - 2 + 90 * 0.4, { steps: 6 });
    await expect(badge(wapPage)).toHaveText(
      '⇧ Shift · Folgende reichen über Tagesende · Alt = parallel',
    );
    await expect(schild(wapPage)).toContainText('2100-2200');
    await wapPage.keyboard.up('Shift');
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
  });

  test('[R-5.1-08][R-5.1-14] F-UX3 UX-FUX3-04: in der Direktbearbeitung beendet ein Klick in die untere Kantenzone die Bearbeitung nicht, er setzt die Schreibmarke', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Direkt.wap.json', planFile(planZusatz5()));
    const b = await fläche(block(wapPage, 'Text'));
    await block(wapPage, 'Text').focus();
    await wapPage.keyboard.press('F2');
    const editor = wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true });
    const title = editor.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    await title.press('Home');
    for (const dy of [b.height - 5, 4]) {
      await wapPage.mouse.click(b.x + b.width / 2, b.y + dy);
      await expect(editor).toBeVisible();
      await expect
        .poll(() =>
          editor.evaluate(
            (e) =>
              document.activeElement?.tagName === 'INPUT' && e.contains(document.activeElement),
          ),
        )
        .toBe(true);
    }
    await wapPage.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
  });

  test('[R-5.1-14] F-UX3 UX-FUX3-05: an der Grenze verdeckt die gegriffene Pille den auf 15 Min geschrumpften Nachbarn nicht; Plakette mindestens 11 px', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Griff.wap.json', planFile(planZusatz5()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + a.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + a.height + 4, { steps: 2 });
    await wapPage.mouse.move(x, a.y + a.height - 2 + 75 * MINUTE, { steps: 6 });
    await expect(badge(wapPage)).toHaveText('Nachbar mind. 15 Min · Shift = mitschieben');
    const nachbar = block(wapPage, 'Bravo').locator('xpath=..');
    const tag = nachbar.locator('.i2-grid-tag');
    await expect(tag).toHaveText('−45 Min');
    expect(
      Number.parseFloat(await tag.evaluate((e) => getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(11);
    const überdeckt = async () => {
      const g = await wapPage
        .locator('.i2-grid-grip[data-grip="end"] .i2-grip-in svg')
        .first()
        .boundingBox();
      const n = await nachbar.boundingBox();
      if (g === null || n === null) return -1;
      const h = Math.min(g.y + g.height, n.y + n.height) - Math.max(g.y, n.y);
      const w = Math.min(g.x + g.width, n.x + n.width) - Math.max(g.x, n.x);
      return h > 0 && w > 0 ? Math.round(h * 10) / 10 : 0;
    };
    // Höchstens Rundung auf Gerätepixel (≤ 1 px); vorher verdeckte die Pille den Nachbarn ganz.
    await expect.poll(überdeckt, { timeout: 2000 }).toBeLessThanOrEqual(1);
    expect(await überdeckt()).toBeGreaterThanOrEqual(0);
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
  });

  test('[R-5.1-14] F-UX3 UX-FUX3-06: bei 50 % ergibt eine einige px innen gegriffene Kante −30 bzw. +30 Min genau diese Differenz (Greif-Versatz nicht gerundet)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Z5Versatz.wap.json', planFile(planZusatz5()));
    await zoom50(wapPage);
    // 4 px innen = 10 Min neben der Kante: absolut gerundet ergäbe −30 Min 0815 statt 0830.
    const a = await fläche(block(wapPage, 'Anna'));
    const x = a.x + a.width / 2;
    const y = a.y + a.height - 4;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y - 5, { steps: 2 });
    await wapPage.mouse.move(x, y - 30 * 0.4, { steps: 4 });
    await expect(schild(wapPage)).toContainText('0800-0830');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Anna')).toHaveAccessibleName(/0800-0830/);
    // Oberkante ebenso: 4 px innen, +30 Min (absolut gerundet ergäbe 1045).
    const t = await fläche(block(wapPage, 'Text'));
    const xo = t.x + t.width / 2;
    const yo = t.y + 4;
    await wapPage.mouse.move(xo, yo);
    await wapPage.mouse.down();
    await wapPage.mouse.move(xo, yo + 5, { steps: 2 });
    await wapPage.mouse.move(xo, yo + 30 * 0.4, { steps: 4 });
    await expect(schild(wapPage)).toContainText('1030-1200');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Text')).toHaveAccessibleName(/1030-1200/);
  });
}

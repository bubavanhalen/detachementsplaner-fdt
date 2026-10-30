// I2b-A «Handhabung» (A1–A8): Abläufe über Rolle und Name mit Maus und Tastatur, nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { createPlan } from '../../i2/support/ablauf';
import { test } from '../../support/fixtures';

export const MINUTE = 0.8;
const FROM = 240;

export function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

export async function box(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await locator.boundingBox();
  expect(b, 'Die Fläche ist sichtbar.').not.toBeNull();
  if (b === null) throw new Error('Fläche fehlt.');
  return b;
}

export function area(page: Page, day: string, index = 0): Locator {
  return page.getByRole('button', { name: new RegExp(`^Leere Fläche ${day} `) }).nth(index);
}

/** y-Koordinate einer Zeit (Minuten) in einer leeren Fläche bei 100 %. */
export async function yAt(page: Page, minutes: number, day = 'Mo'): Promise<number> {
  return (await box(area(page, day))).y + (minutes - FROM) * MINUTE;
}

/** Block per Ziehen erfassen und Titel tippen (A2). */
export async function drawBlock(
  page: Page,
  title: string,
  from: number,
  to: number,
  { day = 'Mo', column = 0 }: { day?: string; column?: number } = {},
): Promise<void> {
  const a = await box(area(page, day, column));
  const x = a.x + a.width / 2;
  // Entscheid Auftraggeber 21.10.2026 Varianten 1a–5a: die Griffe des überfahrenen Blocks ragen über seine Kante; wer
  // direkt unter einem Block ein neues Rechteck aufzieht, kommt von ausserhalb (Zeiger zuerst über den Tageskopf).
  await page.mouse.move(x, a.y - 30);
  await page.mouse.move(x, a.y + (from - FROM) * MINUTE + 1);
  await page.mouse.down();
  await page.mouse.move(x, a.y + (to - FROM) * MINUTE - 1, { steps: 6 });
  await page.mouse.up();
  const field = page.getByRole('textbox', { name: 'Titel', exact: true });
  await expect(field).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(block(page, title)).toBeVisible();
}

export async function dragBy(
  page: Page,
  locator: Locator,
  dx: number,
  dy: number,
  options: { at?: 'center' | 'top' | 'lower'; steps?: number; modifier?: 'Shift' | 'Alt' } = {},
): Promise<void> {
  const b = await box(locator);
  const x = b.x + b.width / 2;
  const y =
    options.at === 'top'
      ? b.y + Math.min(10, b.height / 2)
      : options.at === 'lower'
        ? b.y + b.height - 10
        : b.y + b.height / 2;
  // Entscheid Auftraggeber 21.10.2026 Varianten 1a–5a (3a): Shift beim Drücken zieht einen Auswahlrahmen; «Folgende
  // mitschieben» gilt für Shift während des Ziehens – Shift erst nach dem Beginn der Geste drücken.
  if (options.modifier === 'Alt') await page.keyboard.down('Alt');
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (options.modifier === 'Shift') {
    await page.mouse.move(x + dx / 4, y + dy / 4, { steps: 2 });
    await page.keyboard.down('Shift');
  }
  await page.mouse.move(x + dx, y + dy, { steps: options.steps ?? 8 });
  await page.mouse.up();
  if (options.modifier) await page.keyboard.up(options.modifier);
}

export function registerI2bTests(url: () => string): void {
  let consoleMessages: string[] = [];
  test.beforeEach(({ wapPage }) => {
    consoleMessages = [];
    wapPage.on('console', (message) => {
      const source = message.location().url;
      const vite = message.type() === 'debug' && /\/@vite\/client(?:\?|$)/.test(source);
      const react =
        message.type() === 'info' &&
        source.startsWith('http://127.0.0.1:') &&
        /React DevTools/.test(message.text());
      if (!vite && !react) consoleMessages.push(message.type());
    });
  });
  test.afterEach(() => {
    expect(consoleMessages, 'Die App schreibt keine Konsolenmeldungen.').toEqual([]);
  });

  test('[R-5.1-01][R-5.1-08] I2b A1: Klick wählt und fokussiert genau diesen Eintrag; Entf löscht ihn mit Rückgängig, Fokus auf den nächsten; leere Fläche hebt auf', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Auswahl Übungsplan');
    await drawBlock(wapPage, 'Alpha', 480, 540);
    await drawBlock(wapPage, 'Bravo', 600, 660);
    await block(wapPage, 'Alpha').click();
    await expect(block(wapPage, 'Alpha')).toBeFocused();
    await expect(block(wapPage, 'Alpha')).toHaveAttribute('aria-pressed', 'true');
    await expect(block(wapPage, 'Bravo')).toHaveAttribute('aria-pressed', 'false');
    // Mausklick auf Bravo, dann Entf: nie der zuvor fokussierte Eintrag (ux B1).
    await block(wapPage, 'Bravo').click();
    await expect(block(wapPage, 'Bravo')).toBeFocused();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Bravo')).toHaveCount(0);
    await expect(block(wapPage, 'Alpha')).toBeVisible();
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '«Bravo» gelöscht',
    );
    await expect(block(wapPage, 'Alpha')).toBeFocused();
    await wapPage.getByRole('button', { name: 'Löschen rückgängig machen' }).click();
    await expect(block(wapPage, 'Bravo')).toBeVisible();
    await block(wapPage, 'Alpha').click();
    const empty = await box(area(wapPage, 'Mo', 3));
    await wapPage.mouse.click(empty.x + empty.width / 2, empty.y + 300);
    await expect(block(wapPage, 'Alpha')).toHaveAttribute('aria-pressed', 'false');
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(2);
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveCount(0);
    // Tastatur: Fokus wählt aus, F2 bearbeitet, Esc schliesst.
    await block(wapPage, 'Alpha').focus();
    await expect(block(wapPage, 'Alpha')).toHaveAttribute('aria-pressed', 'true');
    await wapPage.keyboard.press('F2');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Escape');
    await expect(block(wapPage, 'Alpha')).toBeFocused();
  });

  test('[R-5.1-02][R-5.1-03][R-5.1-08][R-5.1-10][R-5.1-11] I2b A2: Titel direkt im Block; Tab durch Zusatz, Ltg, Ort; Tippen überschreibt; Klick ausserhalb übernimmt; Ziehen schliesst offene Bearbeitung', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Direkt Übungsplan');
    const grid = wapPage.getByRole('table', { name: 'Wochenraster', exact: true });
    const before = await box(grid);
    const a = await box(area(wapPage, 'Mo'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + (540 - FROM) * MINUTE + 1);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + (600 - FROM) * MINUTE - 1, { steps: 6 });
    await wapPage.mouse.up();
    const editor = wapPage.getByRole('group', { name: 'Direktbearbeitung Block' });
    const title = editor.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    const field = await box(title);
    expect(Math.abs(field.y - (a.y + (540 - FROM) * MINUTE))).toBeLessThan(4);
    expect((await box(grid)).y, 'Das Raster verschiebt sich nicht.').toBe(before.y);
    await wapPage.keyboard.type('Material');
    await wapPage.keyboard.press('Tab');
    await expect(editor.getByRole('textbox', { name: 'Zusatz' })).toBeFocused();
    await wapPage.keyboard.type('Zeughaus');
    await wapPage.keyboard.press('Tab');
    await expect(editor.getByRole('textbox', { name: 'Ltg' })).toBeFocused();
    await wapPage.keyboard.type('Zfhr');
    await wapPage.keyboard.press('Tab');
    await expect(editor.getByRole('textbox', { name: 'Ort' })).toBeFocused();
    await wapPage.keyboard.type('Halle');
    await wapPage.keyboard.press('Tab');
    await expect(editor).toHaveCount(0);
    await expect(block(wapPage, 'Material')).toHaveAccessibleName(/0900-1000/);
    await block(wapPage, 'Material').press('F2');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveValue(
      'Material',
    );
    await expect(wapPage.getByRole('textbox', { name: 'Zusatz' })).toHaveValue('Zeughaus');
    await expect(wapPage.getByRole('textbox', { name: 'Ort' })).toHaveValue('Halle');
    await wapPage.keyboard.press('Escape');
    // Tippen auf einen gewählten Block startet die Bearbeitung und überschreibt (wie Excel).
    await block(wapPage, 'Material').click();
    await wapPage.keyboard.type('Neu');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveValue('Neu');
    await wapPage.keyboard.press('Enter');
    await expect(block(wapPage, 'Neu')).toBeVisible();
    // Klick ausserhalb übernimmt und schliesst.
    await block(wapPage, 'Neu').dblclick();
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).fill('Aussen');
    const empty = await box(area(wapPage, 'Mo', 4));
    await wapPage.mouse.click(empty.x + 5, empty.y + 400);
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveCount(0);
    await expect(block(wapPage, 'Aussen')).toBeVisible();
    // Ziehen ist jederzeit möglich: die offene Bearbeitung wird vorher übernommen.
    await block(wapPage, 'Aussen').dblclick();
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).fill('Gezogen');
    await dragBy(wapPage, block(wapPage, 'Aussen'), 0, 60 * MINUTE, { at: 'lower' });
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveCount(0);
    await expect(block(wapPage, 'Gezogen')).toHaveAccessibleName(/1000-1100/);
    // Esc verwirft einen frisch aufgezogenen Entwurf ohne Spur.
    await wapPage.mouse.move(x, a.y + (720 - FROM) * MINUTE + 1);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + (780 - FROM) * MINUTE - 1, { steps: 4 });
    await wapPage.mouse.up();
    await wapPage.keyboard.type('Verworfen');
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(1);
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveCount(0);
  });

  test('[R-5.1-14][R-5.1-15] I2b A3: Zeitschild am Zeiger, Block steht nach dem Loslassen sofort am Ziel, Esc bricht unabhängig vom Fokus ab, ohne Animation bei reduzierter Bewegung', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Ziehen Übungsplan');
    await drawBlock(wapPage, 'Ziehblock', 480, 540);
    const start = await box(block(wapPage, 'Ziehblock'));
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 60 * MINUTE, { steps: 8 });
    const label = wapPage.getByRole('status', { name: 'Zeiten beim Ziehen' });
    await expect(label).toHaveText(/^Mo 28\.09\. · 0900-1000 · Kp Kdt/);
    const near = await box(label);
    expect(Math.abs(near.x - x)).toBeLessThan(60);
    expect(Math.abs(near.y - (y + 60 * MINUTE))).toBeLessThan(60);
    await wapPage.mouse.up();
    const target = await block(wapPage, 'Ziehblock').evaluate((e) => e.getBoundingClientRect().y);
    expect(Math.abs(target - (start.y + 60 * MINUTE)), 'Kein Zurückspringen.').toBeLessThan(2);
    await expect(block(wapPage, 'Ziehblock')).toHaveAccessibleName(/0900-1000/);
    // Esc während des Ziehens bricht ab, auch wenn der Fokus nicht im Raster liegt.
    const moved = await box(block(wapPage, 'Ziehblock'));
    await wapPage.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(moved.x + moved.width / 2, moved.y + 200, { steps: 6 });
    await wapPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Ziehblock')).toHaveAccessibleName(/0900-1000/);
    await expect(label).not.toHaveText(/·.*·/);
    await wapPage.emulateMedia({ reducedMotion: 'reduce' });
    await wapPage.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(moved.x + moved.width / 2, moved.y + 100, { steps: 4 });
    const transition = await wapPage
      .locator('.i2-grid-ghost')
      .evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(transition.split(',').every((d) => Number.parseFloat(d) === 0)).toBe(true);
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
  });

  test('[R-5.1-14][R-5.1-16] I2b A4: Ziehen nahe am Rand scrollt das Raster stetig; Verschieben über mehrere Tage', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Rand Übungsplan');
    await drawBlock(wapPage, 'Randblock', 480, 540);
    const scroller = wapPage.locator('.i2-grid-scroll');
    const frame = await box(scroller);
    const b = await box(block(wapPage, 'Randblock'));
    await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(frame.x + frame.width - 12, b.y + b.height / 2, { steps: 10 });
    const first = await scroller.evaluate((e) => e.scrollLeft);
    await wapPage.waitForTimeout(400);
    const later = await scroller.evaluate((e) => e.scrollLeft);
    expect(later, 'Das Raster scrollt nach rechts.').toBeGreaterThan(first + 50);
    await wapPage.waitForTimeout(800);
    await wapPage.mouse.move(frame.x + frame.width - 70, b.y + b.height / 2, { steps: 2 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Randblock')).not.toHaveAccessibleName(/· Mo$/);
    await expect(block(wapPage, 'Randblock')).toHaveAccessibleName(/0800-0900 · (Mi|Do|Fr|Sa|So)$/);
    // Senkrecht: unten am Rand scrollt die Zeit.
    await scroller.evaluate((e) => {
      e.scrollTop = 0;
    });
    const c = await box(block(wapPage, 'Randblock'));
    await wapPage.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(c.x + c.width / 2, frame.y + frame.height - 8, { steps: 8 });
    await wapPage.waitForTimeout(500);
    expect(await scroller.evaluate((e) => e.scrollTop)).toBeGreaterThan(20);
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
  });

  test('[R-5.7-05] I2b A5: Kopf und Werkzeugleiste höchstens 100 px, nur das Raster scrollt, Köpfe und Zeitachse bleiben, Einpassen zeigt die ganze Woche, Detailkarte am Eintrag', async ({
    wapPage,
  }) => {
    for (const [width, height] of [
      [1366, 768],
      [1600, 900],
    ] as const) {
      await wapPage.setViewportSize({ width, height });
      await wapPage.goto(url());
      await wapPage.reload();
      await wapPage
        .getByRole('combobox', { name: 'Woche', exact: true })
        .selectOption({ index: 1 });
      const scroller = wapPage.locator('.i2-grid-scroll');
      expect(
        (await box(scroller)).y,
        `${width}×${height}: Kopf und Werkzeugleiste`,
      ).toBeLessThanOrEqual(100);
      expect(
        await wapPage.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
        'Die Seite selbst scrollt nicht.',
      ).toBeLessThanOrEqual(0);
      await scroller.evaluate((e) => {
        e.scrollTop = 300;
        e.scrollLeft = 400;
      });
      const head = await box(wapPage.locator('.i2-grid-day-head').nth(2));
      const frame = await box(scroller);
      expect(Math.abs(head.y - frame.y)).toBeLessThan(3);
      const axis = await box(wapPage.locator('.i2-grid-axis-head'));
      expect(Math.abs(axis.x - frame.x)).toBeLessThan(3);
      await wapPage.getByRole('button', { name: 'Einpassen' }).click();
      const fit = await scroller.evaluate((e) => ({
        w: e.scrollWidth - e.clientWidth,
        h: e.scrollHeight - e.clientHeight,
      }));
      expect(fit.w, 'Mo–So passen in die Breite.').toBeLessThanOrEqual(1);
      expect(fit.h, 'Der ganze Tag passt in die Höhe.').toBeLessThanOrEqual(1);
      await expect(
        wapPage.getByRole('table', { name: 'Wochenraster' }).locator('.i2-grid-day'),
      ).toHaveCount(7);
      await wapPage.getByRole('button', { name: 'Einpassen' }).click();
    }
    const target = wapPage.getByRole('button', { name: /^Block / }).first();
    await wapPage.locator('.i2-grid-scroll').evaluate((e) => {
      e.scrollTop = 0;
      e.scrollLeft = 0;
    });
    await target.hover();
    const card = wapPage.getByRole('tooltip', { name: 'Details zum Eintrag' });
    await expect(card).toBeVisible();
    const c = await box(card);
    const t = await box(target);
    const view = wapPage.viewportSize() ?? { width: 0, height: 0 };
    expect(
      c.x >= 0 && c.y >= 0 && c.x + c.width <= view.width && c.y + c.height <= view.height,
    ).toBe(true);
    expect(Math.min(Math.abs(c.x - (t.x + t.width)), Math.abs(c.x + c.width - t.x))).toBeLessThan(
      14,
    );
  });

  test('[R-5.1-14][R-5.3-03][R-5.3-04] I2b A6: Rapport, Beso, Marker und Querbalken lassen sich verschieben; Rapport ändert die Grösse; Rückgängig', async ({
    wapPage,
  }) => {
    await wapPage.goto(url());
    await wapPage.reload();
    await wapPage.getByRole('combobox', { name: 'Woche', exact: true }).selectOption({ index: 1 });
    const rapport = wapPage.getByRole('button', { name: /^Rapport KR 1800-1830/ });
    await rapport.scrollIntoViewIfNeeded();
    await dragBy(wapPage, rapport, 0, 30 * MINUTE);
    await expect(
      wapPage.getByRole('button', { name: /^Rapport KR 1830-1900 · Mo$/ }),
    ).toBeVisible();
    await wapPage.getByRole('button', { name: /^Rapport KR 1830-1900/ }).click();
    const end = wapPage.getByRole('button', { name: 'Ende ändern', exact: true });
    await dragBy(wapPage, end, 0, 30 * MINUTE);
    await expect(
      wapPage.getByRole('button', { name: /^Rapport KR 1830-1930 · Mo$/ }),
    ).toBeVisible();
    const beso = wapPage.getByRole('button', { name: /^Beso \S+ Materialfassung 1730-1800/ });
    await dragBy(wapPage, beso, 0, -60 * MINUTE);
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Materialfassung 1630-1700 · Mo$/ }),
    ).toBeVisible();
    const marker = wapPage.getByRole('button', { name: /^Marker AV 2200/ });
    await marker.scrollIntoViewIfNeeded();
    await dragBy(wapPage, marker, 0, -30 * MINUTE);
    await expect(wapPage.getByRole('button', { name: /^Marker AV 2130 · Mo$/ })).toBeVisible();
    const scroller = wapPage.locator('.i2-grid-scroll');
    await scroller.evaluate((e) => {
      e.scrollTop = 0;
      e.scrollLeft = 0;
    });
    const bar = wapPage.getByRole('button', {
      name: /^Querbalken Schiessausbildung Gruppe Mo–Mi · Mo$/,
    });
    const day = await box(wapPage.locator('.i2-grid-day').first());
    await dragBy(wapPage, bar, day.width, 0);
    await expect(
      wapPage.getByRole('button', { name: /^Querbalken Schiessausbildung Gruppe Di–Do · Di$/ }),
    ).toBeVisible();
    await activateUndo(wapPage);
    await expect(
      wapPage.getByRole('button', { name: /^Querbalken Schiessausbildung Gruppe Mo–Mi · Mo$/ }),
    ).toBeVisible();
  });

  test('[R-5.1-14][R-5.6-16] I2b A7: angrenzende Kante, Shift-Kaskade, Alt ohne Anpassung, Vorschau beim Ziehen und ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Nachbarn Übungsplan');
    await drawBlock(wapPage, 'Erster', 480, 540);
    await drawBlock(wapPage, 'Zweiter', 540, 600);
    await drawBlock(wapPage, 'Dritter', 600, 660);
    await block(wapPage, 'Erster').click();
    const handle = wapPage.getByRole('button', { name: 'Ende ändern', exact: true });
    const h = await box(handle);
    await wapPage.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 30 * MINUTE, { steps: 6 });
    await expect(wapPage.getByRole('status', { name: 'Zeiten beim Ziehen' })).toContainText(
      '0800-0930 · Kp Kdt · 1 angepasst',
    );
    await expect(wapPage.locator('.i2-grid-entry.is-adjusting')).toHaveCount(1);
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Erster')).toHaveAccessibleName(/0800-0930/);
    await expect(block(wapPage, 'Zweiter')).toHaveAccessibleName(/0930-1000/);
    await expect(block(wapPage, 'Dritter')).toHaveAccessibleName(/1000-1100/);
    await activateUndo(wapPage);
    await expect(block(wapPage, 'Erster')).toHaveAccessibleName(/0800-0900/);
    await expect(block(wapPage, 'Zweiter')).toHaveAccessibleName(/0900-1000/);
    // Shift: alle folgenden Blöcke rücken um die Differenz, Dauer bleibt.
    await block(wapPage, 'Erster').click();
    await dragBy(
      wapPage,
      wapPage.getByRole('button', { name: 'Ende ändern', exact: true }),
      0,
      30 * MINUTE,
      {
        modifier: 'Shift',
      },
    );
    await expect(block(wapPage, 'Erster')).toHaveAccessibleName(/0800-0930/);
    await expect(block(wapPage, 'Zweiter')).toHaveAccessibleName(/0930-1030/);
    await expect(block(wapPage, 'Dritter')).toHaveAccessibleName(/1030-1130/);
    await activateUndo(wapPage);
    await expect(block(wapPage, 'Dritter')).toHaveAccessibleName(/1000-1100/);
    // Alt: keine Anpassung (parallel).
    await block(wapPage, 'Erster').click();
    await dragBy(
      wapPage,
      wapPage.getByRole('button', { name: 'Ende ändern', exact: true }),
      0,
      30 * MINUTE,
      {
        modifier: 'Alt',
      },
    );
    await expect(block(wapPage, 'Erster')).toHaveAccessibleName(/0800-0930/);
    await expect(block(wapPage, 'Zweiter')).toHaveAccessibleName(/0900-1000/);
    // Verschieben in belegten Bereich kürzt den überdeckten Nachbarn.
    await activateUndo(wapPage);
    await dragBy(wapPage, block(wapPage, 'Dritter'), 0, -30 * MINUTE);
    await expect(block(wapPage, 'Dritter')).toHaveAccessibleName(/0930-1030/);
    await expect(block(wapPage, 'Zweiter')).toHaveAccessibleName(/0900-0930/);
  });

  test('[R-4.4-13][R-5.2-08] I2b A8: Spaltenkopf direkt umbenennen (nur dieser Tag), Breite per Spaltengrenze auf schmal/normal/breit, Tagesbreite bleibt, Rückgängig', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Spalten Übungsplan');
    const head = wapPage.getByRole('button', { name: 'Spaltenkopf Stv' }).first();
    await head.dblclick();
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname' });
    await expect(name).toBeFocused();
    await name.fill('Stv Zug');
    await name.press('Enter');
    const dialog = wapPage.getByRole('dialog', { name: 'Spalte «Stv» umbenennen' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Nur dieser Tag' }).click();
    await expect(
      wapPage.getByRole('button', { name: 'Leere Fläche Mo Stv Zug', exact: true }),
    ).toBeVisible();
    await expect(
      wapPage.getByRole('button', { name: 'Leere Fläche Di Stv', exact: true }),
    ).toBeVisible();
    await activateUndo(wapPage);
    await expect(
      wapPage.getByRole('button', { name: 'Leere Fläche Mo Stv', exact: true }),
    ).toBeVisible();
    // Esc verwirft das Umbenennen.
    await wapPage.getByRole('button', { name: 'Spaltenkopf Zfhr' }).first().press('F2');
    await wapPage.getByRole('textbox', { name: 'Spaltenname' }).fill('Verworfen');
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Zfhr' }).first()).toBeVisible();
    // Breite: Grenze ziehen rastet auf breit; alle Tage mit dem Spaltensatz; Tagesbreite bleibt.
    const dayWidth = (await box(wapPage.locator('.i2-grid-day-body').first())).width;
    const separator = wapPage.getByRole('separator', { name: 'Breite von «Kp Kdt»' }).first();
    await expect(separator).toHaveAttribute('aria-valuetext', 'normal');
    const before = await box(area(wapPage, 'Mo', 0));
    const s = await box(separator);
    await wapPage.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(s.x + s.width / 2 + before.width * 0.6, s.y + s.height / 2, {
      steps: 6,
    });
    expect((await box(area(wapPage, 'Mo', 0))).width, 'Vorschau beim Ziehen').toBeGreaterThan(
      before.width * 1.2,
    );
    await wapPage.mouse.up();
    const ask = wapPage.getByRole('dialog', { name: 'Breite von «Kp Kdt» ändern' });
    await ask.getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz' }).click();
    await expect(separator).toHaveAttribute('aria-valuetext', 'breit');
    await expect(
      wapPage.getByRole('separator', { name: 'Breite von «Kp Kdt»' }).nth(1),
    ).toHaveAttribute('aria-valuetext', 'breit');
    expect((await box(wapPage.locator('.i2-grid-day-body').first())).width).toBe(dayWidth);
    await separator.focus();
    await wapPage.keyboard.press('ArrowLeft');
    await wapPage
      .getByRole('dialog', { name: 'Breite von «Kp Kdt» ändern' })
      .getByRole('button', { name: 'Nur dieser Tag' })
      .click();
    await expect(separator).toHaveAttribute('aria-valuetext', 'normal');
    await activateUndo(wapPage);
    await expect(separator).toHaveAttribute('aria-valuetext', 'breit');
  });
}

export async function activateUndo(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Rückgängig', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

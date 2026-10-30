// H-UI, Befund UX-H-02 (ux-critic Härtung Runde 1; Beschrieb 11, UI-Richtlinie 15 G-7 a «Route auch auf dem Tablet
// bedienbar»): Auf Touch rollt Wischen über dem Raster, es verschiebt nichts und öffnet keine Bearbeitung; Tippen wählt;
// Ändern nur nach Langdruck. Maus und Stift unverändert. E2E mit Touch-Emulation (CDP-Touch-Ereignisse). Nur fiktive
// Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { block, kpPlan } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planTouch() {
  const plan = block(kpPlan(1), 'Wache Nord').plan;
  return { ...plan, id: 'hui-e2e-touch', exerciseName: 'Touch Übungsplan' };
}

function blockNamed(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const b = await locator.boundingBox();
  if (b === null) throw new Error('Element ohne Lage.');
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
}

async function scrollPos(page: Page): Promise<[number, number]> {
  return page.getByRole('table', { name: 'Wochenraster', exact: true }).evaluate((t) => {
    const s = t.closest('.i2-grid-scroll');
    return [s?.scrollLeft ?? 0, s?.scrollTop ?? 0] as [number, number];
  });
}

/** Ein Finger: Berühren, in Schritten bewegen, loslassen (CDP, wie ein Touchscreen). */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  delta: { x: number; y: number },
  holdMs = 0,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (delta.x * i) / steps, y: from.y + (delta.y * i) / steps }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

export function registerTouchTests(url: () => string): void {
  test('[R-11-10][R-5.1-01] H-UI UX-H-02: Wischen über Einträgen und leeren Flächen rollt das Raster, ändert nichts und öffnet keine Bearbeitung', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'touch.wap.json', planFile(planTouch()));
    const before = await blockNamed(wapPage, 'Wache Nord').getAttribute('aria-label');
    // Wischen auf dem Block (nach links oben): rollt, verschiebt ihn nicht.
    const start = await center(blockNamed(wapPage, 'Wache Nord'));
    const s0 = await scrollPos(wapPage);
    await swipe(wapPage, start, { x: -240, y: -180 });
    await expect.poll(() => scrollPos(wapPage)).not.toEqual(s0);
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveAttribute('aria-label', before ?? '');
    // Wischen auf leerer Fläche: kein neuer Block, keine Direktbearbeitung.
    const empty = await center(wapPage.getByRole('button', { name: /^Leere Fläche Di / }).first());
    const s1 = await scrollPos(wapPage);
    await swipe(wapPage, empty, { x: 0, y: -200 });
    await expect.poll(() => scrollPos(wapPage)).not.toEqual(s1);
    await expect(wapPage.getByRole('group', { name: /^Direktbearbeitung/ })).toHaveCount(0);
    await expect(
      wapPage.getByRole('button', { name: /^Block (?!löschen|bearbeiten)/ }),
    ).toHaveCount(1);
    await expect(blockNamed(wapPage, 'Wache Nord')).toHaveAttribute('aria-label', before ?? '');
  });

  test('[R-11-10][R-5.1-14] H-UI UX-H-02: Tippen wählt den Block; Ändern erst nach Langdruck (dann Ziehen verschiebt)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'touch.wap.json', planFile(planTouch()));
    const wache = blockNamed(wapPage, 'Wache Nord');
    await wache.tap();
    await expect(wache).toBeFocused();
    await expect(wapPage.getByRole('button', { name: 'Ende ändern', exact: true })).toBeVisible();
    // Langdruck und Ziehen zum Dienstag verschiebt.
    const from = await center(wache);
    const to = await center(wapPage.getByRole('button', { name: /^Leere Fläche Di / }).first());
    await swipe(wapPage, from, { x: to.x - from.x, y: 0 }, 700);
    await expect(wapPage.getByRole('button', { name: /^Block Wache Nord .*· Di$/ })).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Block (?!löschen|bearbeiten)/ }),
    ).toHaveCount(1);
  });

  test('[R-11-10][R-5.1-14] H-UI UX-H-02: mit der Maus unverändert: Ziehen verschiebt sofort', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'touch.wap.json', planFile(planTouch()));
    const from = await center(blockNamed(wapPage, 'Wache Nord'));
    const to = await center(wapPage.getByRole('button', { name: /^Leere Fläche Di / }).first());
    await wapPage.mouse.move(from.x, from.y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(to.x, from.y, { steps: 10 });
    await wapPage.mouse.up();
    await expect(wapPage.getByRole('button', { name: /^Block Wache Nord .*· Di$/ })).toHaveCount(1);
  });
}

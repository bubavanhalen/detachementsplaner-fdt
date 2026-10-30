// F-UX2 Runde 5 (ux-critic Runde 3, Stand 79bf4d5; Bericht lokal unter .qa/haertung/ux-critic-3.md): UX-3-01 äusserer
// Griff am schmalen gewählten Block über dem Nachbarn (Klick und Zug gehen an den Nachbarn), UX-3-02 Block, dem zwei
// Spalten fehlen (in einer Spalte gezeichnet, ← / → und Ziehen beheben P1), UX-3-03 Ctrl+. bei offener Befundliste
// springt zur nächsten Meldung, Esc schliesst. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { columnsOf } from './plaene';

/** Mo: «Anton» in Kp Kdt und «Berta» in Stv (nebeneinander), «Eins» in Stv und «Zwei» in Zfhr später am Tag. */
function planNachbarn(): Plan {
  let plan = kpPlan(1);
  const p = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  const [kdt, stv, zfhr] = p;
  if (kdt === undefined || stv === undefined || zfhr === undefined)
    throw new Error('Spalten fehlen');
  const block = (from: number, to: number, id: string, title: string) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids' as const, ids: [id] },
    title: [{ text: title, bold: true }],
  });
  plan = add(plan, block(480, 600, kdt.id, 'Anton')).plan;
  plan = add(plan, block(480, 600, stv.id, 'Berta')).plan;
  plan = add(plan, block(720, 840, stv.id, 'Eins')).plan;
  plan = add(plan, block(900, 1020, zfhr.id, 'Zwei')).plan;
  return { ...plan, id: 'fux2-nachbarn', exerciseName: 'Nachbarn Übungsplan', service: 'FDT 2099' };
}

function kopf(page: Page): Locator {
  return page.locator('th.i2-grid-day-head').filter({ hasText: 'Mo 28.09.2026' });
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

async function kopfBox(page: Page, spalte: string) {
  const b = await kopf(page)
    .getByRole('button', { name: `Spaltenkopf ${spalte}`, exact: true })
    .locator('xpath=..')
    .boundingBox();
  if (b === null) throw new Error('Kopf fehlt');
  return b;
}

/** Stv und danach Zfhr am Mo entfernen («nur dieser Tag»; der zweite Schritt betrifft den eigenen Satz des Mo). */
async function zweiSpaltenEntfernen(page: Page): Promise<void> {
  await kopf(page).getByRole('button', { name: 'Spaltenkopf Stv', exact: true }).focus();
  await page.keyboard.press('Delete');
  await page
    .getByRole('dialog', { name: 'Spalte «Stv» entfernen', exact: true })
    .getByRole('button', { name: 'Nur dieser Tag', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await kopf(page).getByRole('button', { name: 'Spaltenkopf Zfhr', exact: true }).focus();
  await page.keyboard.press('Delete');
  const frage = page.getByRole('dialog', { name: 'Spalte «Zfhr» entfernen', exact: true });
  if ((await frage.count()) > 0)
    await frage.getByRole('button', { name: 'Nur dieser Tag', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    kopf(page).getByRole('button', { name: 'Spaltenkopf Zfhr', exact: true }),
  ).toHaveCount(0);
}

export function registerRunde5Tests(url: () => string): void {
  test('[R-5.1-26] F-UX2 UX-3-01: bei 50 % gehen Klick und Zug 2 px im anliegenden Nachbarn an ihn, nicht an den Griff des gewählten schmalen Blocks', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Nachbar.wap.json', planFile(planNachbarn()));
    const k = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    await k.click();
    await k.click();
    await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
      '50 %',
    );
    const anton = await fläche(block(wapPage, 'Anton'));
    expect(anton.width).toBeLessThan(24);
    await wapPage.mouse.click(anton.x + anton.width / 2, anton.y + anton.height / 2);
    await expect(block(wapPage, 'Anton')).toHaveAttribute('aria-pressed', 'true');
    const berta = await fläche(block(wapPage, 'Berta'));
    const x = berta.x + 2;
    const y = berta.y + berta.height / 2;
    await wapPage.mouse.move(x, y);
    await expect
      .poll(() =>
        wapPage.locator(`td[data-day="${MO}"]`).evaluate((e) => getComputedStyle(e).cursor),
      )
      .not.toBe('ew-resize');
    // Zug eine Stunde nach unten: Berta wird verschoben, Anton bleibt schmal.
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 30, { steps: 6 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Berta')).not.toHaveAccessibleName(/0800-1000/);
    expect((await fläche(block(wapPage, 'Anton'))).width).toBeLessThan(anton.width + 1.5);
  });

  test('[R-5.2-09][R-11-07] F-UX2 UX-3-02: Block, dem zwei Spalten fehlen, steht in einer Spalte; → behebt P1', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Zwei.wap.json', planFile(planNachbarn()));
    const spalte = (await kopfBox(wapPage, 'Kp Kdt')).width;
    await zweiSpaltenEntfernen(wapPage);
    const zwei = block(wapPage, 'Zwei').locator('xpath=..');
    await expect(zwei).toHaveClass(/i2-grid-p1/);
    // Gezeichnet in einer Spalte (frühere relative Lage), nicht über die ganze Planungsbreite.
    expect((await fläche(block(wapPage, 'Zwei'))).width).toBeLessThan(spalte * 1.5);
    await block(wapPage, 'Zwei').focus();
    await wapPage.keyboard.press('ArrowRight');
    await expect(zwei).not.toHaveClass(/i2-grid-p1/);
    await expect(block(wapPage, 'Zwei')).toBeFocused();
  });

  test('[R-5.2-09][R-5.1-14] F-UX2 UX-3-02: Block, dem zwei Spalten fehlen, per Ziehen in «Trp» – P1 behoben', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Zug.wap.json', planFile(planNachbarn()));
    await zweiSpaltenEntfernen(wapPage);
    const zwei = block(wapPage, 'Zwei').locator('xpath=..');
    await expect(zwei).toHaveClass(/i2-grid-p1/);
    const b = await fläche(block(wapPage, 'Zwei'));
    const trp = await kopfBox(wapPage, 'Trp');
    await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(trp.x + trp.width / 2, b.y + b.height / 2, { steps: 8 });
    await wapPage.mouse.up();
    await expect(zwei).not.toHaveClass(/i2-grid-p1/);
    const n = await fläche(block(wapPage, 'Zwei'));
    expect(Math.abs(n.x - trp.x)).toBeLessThan(2);
  });

  test('[R-7-10][R-11-07] F-UX2 UX-3-03: nach «Zur Stelle» springt Ctrl+. zur nächsten offenen Meldung, die Liste bleibt offen; Esc schliesst sie', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Liste.wap.json', planFile(planNachbarn()));
    await zweiSpaltenEntfernen(wapPage);
    await block(wapPage, 'Anton').focus();
    await wapPage.keyboard.press('Control+.');
    const liste = wapPage.getByRole('complementary', { name: 'Befunde', exact: true });
    await expect(liste).toBeVisible();
    const sprünge = liste.getByRole('button', { name: /^Zur Stelle: P1 / });
    await expect(sprünge).toHaveCount(3);
    await expect(sprünge.nth(0)).toBeFocused();
    await wapPage.keyboard.press('Enter');
    await expect(liste.locator(':focus')).toHaveCount(0);
    await wapPage.keyboard.press('Control+.');
    await expect(liste).toBeVisible();
    await expect(sprünge.nth(1)).toBeFocused();
    await wapPage.keyboard.press('Escape');
    await expect(liste).toBeHidden();
  });
}

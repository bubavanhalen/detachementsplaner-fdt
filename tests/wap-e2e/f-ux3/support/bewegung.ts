// F-UX3 (Rückmeldung des Auftraggebers vom 21.10.2026; Gestaltung docs/wap-planer/ui/bewegung-v1.md): Auffüllen per
// Doppelklick auf die Kante bzw. Ctrl+Shift+↓ hält am ABV an; Ziehen und Kante auf eigener Ebene (angehobener Block
// und Vorschaurahmen nur über transform, Grösse einmal je Geste); Shift/Alt als Zustand, der beim Drücken und
// Loslassen sofort umschaltet (Zeitschild `data-mode`, Ansage «Ziehmodus»). Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planBewegung(): Plan {
  let plan = kpPlan(1);
  const [kdt, stv] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined || stv === undefined) throw new Error('Spalten fehlen');
  const block = (from: number, to: number, id: string, title: string) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids' as const, ids: [id] },
    title: [{ text: title, bold: true }],
  });
  plan = add(plan, block(600, 660, kdt.id, 'Wache Nord')).plan;
  plan = add(plan, block(600, 660, stv.id, 'Wache Süd')).plan;
  plan = add(plan, block(780, 840, stv.id, 'Folgeblock')).plan;
  plan = add(plan, {
    type: 'marker',
    date: MO,
    at: 1320,
    kind: 'ABV',
    customKind: '',
    columns: { kind: 'all' },
  }).plan;
  return { ...plan, id: 'fux3-bewegung', exerciseName: 'Bewegung Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

const lift = (page: Page) =>
  page.locator('.i2-grid-lift').evaluate((e) => {
    const s = (e as HTMLElement).style;
    // Entscheid Auftraggeber 21.10.2026 Varianten 1a–5a: Grösse nur über scale der Fläche mit getrennten Kanten.
    const f = e.querySelector<HTMLElement>('.i2-lift-f')?.style.transform ?? '';
    return { w: s.width, h: s.height, t: s.transform, f, left: s.left, top: s.top };
  });

export function registerBewegungTests(url: () => string): void {
  test('[R-5.1-28] F-UX3: Doppelklick auf die untere Kante füllt bis zum ABV (nicht bis zum Rasterende)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Fuellen.wap.json', planFile(planBewegung()));
    const b = await fläche(block(wapPage, 'Wache Nord'));
    await wapPage.mouse.dblclick(b.x + b.width / 2, b.y + b.height - 3);
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/1000-2200/);
  });

  test('[R-5.1-28] F-UX3: Ctrl+Shift+↓ füllt bis zum nächsten Block bzw. ABV', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Taste.wap.json', planFile(planBewegung()));
    await block(wapPage, 'Folgeblock').focus();
    await wapPage.keyboard.press('Control+Shift+ArrowDown');
    await expect(block(wapPage, 'Folgeblock')).toHaveAccessibleName(/1300-2200/);
  });

  test('[R-5.1-14] F-UX3: Verschieben und Kante – angehobener Block und Vorschaurahmen nur über transform; Shift/Alt schalten beim Drücken und Loslassen sofort um', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Ebene.wap.json', planFile(planBewegung()));
    const b = await fläche(block(wapPage, 'Wache Süd'));
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 20, { steps: 4 });
    await expect(wapPage.locator('.i2-grid-lift')).toBeVisible();
    const a = await lift(wapPage);
    await wapPage.mouse.move(x, y + 60, { steps: 4 });
    await expect.poll(async () => (await lift(wapPage)).t).not.toBe(a.t);
    const c = await lift(wapPage);
    expect([c.w, c.h, c.left, c.top]).toEqual([a.w, a.h, a.left, a.top]);
    expect(c.t).toMatch(/^translate3d\(/);
    const ghost = wapPage.locator('.i2-grid-ghost');
    await expect(ghost).toHaveCount(1);
    expect(
      await ghost.evaluate((e) => [(e as HTMLElement).style.left, (e as HTMLElement).style.top]),
    ).toEqual(['', '']);
    // Zusatztasten ohne Mausbewegung: sofort umschalten.
    const zeitschild = wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true });
    const modus = wapPage.getByRole('status', { name: 'Ziehmodus', exact: true });
    await wapPage.keyboard.down('Shift');
    await expect(zeitschild).toHaveAttribute('data-mode', 'shift');
    await expect(modus).toContainText('Shift');
    await wapPage.keyboard.up('Shift');
    await expect(zeitschild).toHaveAttribute('data-mode', 'adjust');
    await wapPage.keyboard.down('Alt');
    await expect(zeitschild).toHaveAttribute('data-mode', 'none');
    await expect(modus).toContainText('Alt');
    await wapPage.keyboard.up('Alt');
    await expect(zeitschild).toHaveAttribute('data-mode', 'adjust');
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
    // Kante unten: Grösse des angehobenen Blocks bleibt, transform skaliert.
    const n = await fläche(block(wapPage, 'Wache Nord'));
    await wapPage.mouse.click(n.x + n.width / 2, n.y + n.height / 2);
    await wapPage.mouse.move(n.x + n.width / 2, n.y + n.height - 3);
    await wapPage.mouse.down();
    await wapPage.mouse.move(n.x + n.width / 2, n.y + n.height + 20, { steps: 4 });
    const e1 = await lift(wapPage);
    await wapPage.mouse.move(n.x + n.width / 2, n.y + n.height + 60, { steps: 4 });
    await expect.poll(async () => (await lift(wapPage)).f).not.toBe(e1.f);
    const e2 = await lift(wapPage);
    expect([e2.w, e2.h]).toEqual([e1.w, e1.h]);
    expect(e2.t).toMatch(/^translate3d\(/);
    expect(e2.f).toMatch(/scale\(/);
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Wache Nord')).not.toHaveAccessibleName(/1000-1100/);
  });
}

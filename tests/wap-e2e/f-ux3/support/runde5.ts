// F-UX3 Runde 5 (Code-Review F-UX3; Auftrag Koordinator 23.10.2026): am Tagesende hält die Vorschau an und nennt
// Ursache und nächsten Schritt, das Ablegen gelingt ohne Fehlermeldung (CR-F3-01); verschiebt sich das Raster ohne
// Zoomwechsel, gilt die Hervorhebung unter dem ruhenden Zeiger neu (CR-F3-05). Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

/** X 1200–1300, A 2310–2330, C 2330–2400 in Kdt. */
function planRunde5(): Plan {
  let plan = kpPlan(1);
  const [kdt] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined) throw new Error('Spalten fehlen');
  const block = (from: number, to: number, title: string) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids', ids: [kdt.id] } as const,
    title: [{ text: title, bold: true }],
  });
  plan = add(plan, block(720, 780, 'Xray')).plan;
  plan = add(plan, block(1390, 1410, 'Abend')).plan;
  plan = add(plan, block(1410, 1440, 'Nacht')).plan;
  return { ...plan, id: 'fux3-runde5', exerciseName: 'Runde 5 Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

const badge = (page: Page) =>
  page.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }).locator('.i2-grid-mode');

export function registerRunde5Tests(url: () => string): void {
  test('[R-5.1-14] F-UX3 Runde 5 (CR-F3-01): am Tagesende hält die Vorschau an (Hinweis mit Ursache und Weg), Ablegen ohne Fehler, nichts über 2400', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Abend.wap.json', planFile(planRunde5()));
    const klein = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    await klein.click();
    await klein.click();
    await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
      '50 %',
    );
    const x = await fläche(block(wapPage, 'Xray'));
    const n = await fläche(block(wapPage, 'Nacht'));
    const px = x.x + x.width / 2;
    await wapPage.mouse.move(px, x.y + x.height / 2);
    await wapPage.mouse.down();
    // Ziel um 2330: Abend und Nacht hätten keinen Platz mehr vor 2400.
    await wapPage.mouse.move(px, n.y + n.height / 2, { steps: 10 });
    await expect(badge(wapPage)).toHaveText('Folgende reichen über Tagesende · Alt = parallel');
    await wapPage.mouse.up();
    await expect(wapPage.getByRole('alert')).toHaveCount(0);
    await expect(block(wapPage, 'Xray')).not.toHaveAccessibleName(/1200-1300/);
    for (const t of ['Xray', 'Abend', 'Nacht']) {
      const name = (await block(wapPage, t).getAttribute('aria-label')) ?? '';
      const m = / (\d{4})-(\d{4}) /.exec(name);
      expect(m, name).not.toBeNull();
      expect(Number(m?.[1] ?? 9999), name).toBeLessThan(2400);
      expect(Number(m?.[2] ?? 9999), name).toBeLessThanOrEqual(2400);
    }
  });

  test('[R-5.1-14] F-UX3 Runde 5 (CR-F3-05): verschiebt sich das Raster ohne Zoomwechsel, gilt die Hervorhebung unter dem ruhenden Zeiger neu', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R5Lage.wap.json', planFile(planRunde5()));
    const x = await fläche(block(wapPage, 'Xray'));
    await wapPage.mouse.move(x.x + x.width / 2, x.y + x.height / 2);
    const hover = () =>
      block(wapPage, 'Xray')
        .locator('xpath=..')
        .evaluate((e) => (e as HTMLElement).dataset.hover ?? '');
    await expect.poll(hover).toBe('body');
    // Über dem Planer erscheint eine Leiste (fiktiv): das Raster rutscht 80 px nach unten, der Zeiger bleibt.
    await wapPage.evaluate(() => {
      const bar = document.createElement('div');
      bar.style.height = '80px';
      bar.dataset.testLeiste = '';
      document.body.prepend(bar);
    });
    await expect.poll(hover).toBe('');
    // Eine kleine Bewegung trifft nach der neuen Lage (nicht nach der alten).
    await wapPage.mouse.move(x.x + x.width / 2 + 1, x.y + x.height / 2);
    await expect.poll(hover).toBe('');
    const x2 = await fläche(block(wapPage, 'Xray'));
    await wapPage.mouse.move(x2.x + x2.width / 2, x2.y + x2.height / 2);
    await expect.poll(hover).toBe('body');
  });
}

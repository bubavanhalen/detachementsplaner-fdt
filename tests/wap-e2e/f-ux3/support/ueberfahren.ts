// F-UX3 (Rückmeldung Auftraggeber 21.10.2026 «ich mag nicht, dass ich einen Block zuerst anwählen muss, bevor ich ihn
// manipulieren kann»; Auftrag Koordinator 21.10.2026): Kanten- und Körperzonen für jeden Block beim Überfahren,
// Mauszeiger je Zone, Zustand «über» mit Ereignis (`data-hover`, `i2-hover`), Ziehen der seitlichen Kante ohne
// vorheriges Wählen; ein Klick ohne Bewegung wählt weiterhin. Leistung: keine Layoutabfrage und kein Stilschreiben je
// Mausbewegung innerhalb derselben Zone. Fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planUeberfahren(): Plan {
  let plan = kpPlan(1);
  const [kdt] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined) throw new Error('Spalten fehlen');
  plan = add(plan, {
    type: 'block',
    date: MO,
    time: { form: 'range', from: 600, to: 660 },
    columns: { kind: 'ids', ids: [kdt.id] },
    title: [{ text: 'Solo', bold: true }],
  }).plan;
  return {
    ...plan,
    id: 'fux3-ueberfahren',
    exerciseName: 'Überfahren Übungsplan',
    service: 'FDT 2099',
  };
}

function solo(page: Page): Locator {
  return page.getByRole('button', { name: /^Block Solo / });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

const tagMo = (page: Page) => page.locator('.i2-grid-day-body').first();
const cursorOf = (page: Page) => tagMo(page).evaluate((e) => (e as HTMLElement).style.cursor);
const hoverOf = (entry: Locator) =>
  entry.locator('xpath=..').evaluate((e) => (e as HTMLElement).dataset.hover ?? '');

export function registerUeberfahrenTests(url: () => string): void {
  test('[R-5.1-27] F-UX3: Überfahren eines nicht gewählten Blocks – Zone je Kante mit Mauszeiger, data-hover und Ereignis i2-hover', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Hover.wap.json', planFile(planUeberfahren()));
    await expect(solo(wapPage)).toHaveAttribute('aria-pressed', 'false');
    await wapPage.locator('.i2-grid-content').evaluate((e) => {
      const log: string[] = [];
      (window as unknown as { hoverLog: string[] }).hoverLog = log;
      e.addEventListener('i2-hover', (ev) => {
        const d = (ev as CustomEvent<{ zone: string } | null>).detail;
        log.push(d === null ? 'leer' : d.zone);
      });
    });
    const b = await fläche(solo(wapPage));
    const y = b.y + b.height / 2;
    await wapPage.mouse.move(b.x + b.width / 2, y);
    await expect.poll(() => cursorOf(wapPage)).toBe('grab');
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('body');
    await wapPage.mouse.move(b.x + b.width - 2, y);
    await expect.poll(() => cursorOf(wapPage)).toBe('ew-resize');
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('right');
    await wapPage.mouse.move(b.x + 2, y);
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('left');
    await wapPage.mouse.move(b.x + b.width / 2, b.y + 2);
    await expect.poll(() => cursorOf(wapPage)).toBe('ns-resize');
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('start');
    // Weg vom Block: Zustand leer, Attribut entfernt.
    await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height + 60);
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('');
    const log = await wapPage.evaluate(
      () => (window as unknown as { hoverLog: string[] }).hoverLog,
    );
    expect(log).toEqual(['body', 'right', 'left', 'start', 'leer']);
    // Weiterhin nicht gewählt: das Überfahren wählt nicht. Ein Klick ohne Bewegung wählt (Tastatur, Mehrfachauswahl
    // und Direktbearbeitung bleiben).
    await expect(solo(wapPage)).toHaveAttribute('aria-pressed', 'false');
    await wapPage.mouse.click(b.x + b.width / 2, y);
    await expect(solo(wapPage)).toHaveAttribute('aria-pressed', 'true');
    await expect(solo(wapPage)).toBeFocused();
  });

  test('[R-5.1-14] F-UX3: seitliche Kante eines nicht gewählten Blocks ziehen – Block über zwei Spalten, ohne vorheriges Wählen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Seite.wap.json', planFile(planUeberfahren()));
    const b = await fläche(solo(wapPage));
    await expect(solo(wapPage)).toHaveAttribute('aria-pressed', 'false');
    const y = b.y + b.height / 2;
    await wapPage.mouse.move(b.x + b.width - 2, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(b.x + b.width * 1.6, y, { steps: 6 });
    await wapPage.mouse.up();
    await expect
      .poll(async () => (await fläche(solo(wapPage))).width)
      .toBeGreaterThan(b.width * 1.5);
    await expect(solo(wapPage)).toHaveAccessibleName(/1000-1100/);
    const pending = wapPage.waitForEvent('download');
    await wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
    const path = await (await pending).path();
    if (path === null) throw new Error('Plan-Datei fehlt.');
    const plan = parsePlanFile(new Uint8Array(readFileSync(path))).plan;
    const gespeichert = Object.values(plan.entries).find(
      (e): e is Block => e.type === 'block' && e.title[0]?.text === 'Solo',
    );
    expect(gespeichert?.columns).toMatchObject({ kind: 'ids' });
    expect(gespeichert?.columns.kind === 'ids' ? gespeichert.columns.ids.length : 0).toBe(2);
  });

  test('[R-11-11] F-UX3: Überfahren innerhalb derselben Zone – keine Layoutabfrage und kein Stilschreiben je Mausbewegung', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Takt.wap.json', planFile(planUeberfahren()));
    const b = await fläche(solo(wapPage));
    const y = b.y + b.height / 2;
    await wapPage.mouse.move(b.x + b.width / 2 - 6, y);
    await expect.poll(() => hoverOf(solo(wapPage))).toBe('body');
    await wapPage.evaluate(() => {
      const w = window as unknown as { rects: number; styles: number };
      w.rects = 0;
      w.styles = 0;
      const orig = Element.prototype.getBoundingClientRect;
      // Gezählt werden die Lageabfragen des Rasters und der Tage (die Hervorhebung braucht sonst keine).
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.matches('.i2-grid-content, .i2-grid-day-body, .i2-grid-scroll')) w.rects++;
        return orig.call(this);
      };
      const node = document.querySelector('.i2-grid-hover');
      if (node !== null)
        new MutationObserver((m) => {
          w.styles += m.length;
        }).observe(node, { attributes: true, attributeFilter: ['style', 'data-zone'] });
    });
    for (let i = 0; i < 12; i++) await wapPage.mouse.move(b.x + b.width / 2 - 6 + i, y + (i % 3));
    // Zwei Bilder abwarten, damit ein ausstehendes Bild ausgewertet ist.
    await wapPage.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    const zahlen = await wapPage.evaluate(() => {
      const w = window as unknown as { rects: number; styles: number };
      return { rects: w.rects, styles: w.styles };
    });
    expect(zahlen).toEqual({ rects: 0, styles: 0 });
    expect(await hoverOf(solo(wapPage))).toBe('body');
  });
}

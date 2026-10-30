// H-UI, Befund UX-H-05 (ux-critic Härtung Runde 1; Beschrieb 5.2 P1, UI-Richtlinie 5.5, 5.6 F-48): Ein Eintrag mit
// einer Spalte, die es am Tag nicht gibt (gezeichnet an der gleichen relativen Lage, Befund P1), lässt sich wie jeder
// andere in eine andere Spalte ziehen; danach trägt er Spalten des Tages. Nur fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { block, kpPlan } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

/** Block am Mo mit der ersten Planungsspalte des Satzes «KVK Mi–Fr» (gibt es am Mo nicht: P1). */
function planP1(): { plan: Plan; moColumns: readonly string[]; foreign: string } {
  const base = kpPlan(1);
  const mid = base.columnSets[1];
  const mo = base.columnSets[0];
  const foreign = mid?.columns.find((c) => c.kind === 'planning')?.id;
  if (foreign === undefined || mo === undefined) throw new Error('Spaltensätze fehlen');
  const plan = block(base, 'Fremdspalte', { columns: { kind: 'ids', ids: [foreign] } }).plan;
  return {
    plan: { ...plan, id: 'hui-e2e-p1', exerciseName: 'P1 Übungsplan' },
    moColumns: mo.columns.map((c) => c.id),
    foreign,
  };
}

function blockNamed(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function savedPlan(page: Page): Promise<Plan> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
  const path = await (await pending).path();
  if (path === null) throw new Error('Plan-Datei fehlt.');
  return parsePlanFile(new Uint8Array(readFileSync(path))).plan;
}

export function registerP1Tests(url: () => string): void {
  test('[R-5.1-14][R-5.1-17] H-UI UX-H-05: Eintrag mit fehlender Spalte (P1) in eine andere Spalte ziehen: er bleibt dort und trägt Spalten des Tages', async ({
    wapPage,
  }) => {
    const { plan, moColumns, foreign } = planP1();
    await startWith(wapPage, url(), 'p1.wap.json', planFile(plan));
    const b = blockNamed(wapPage, 'Fremdspalte');
    const box = await b.boundingBox();
    if (box === null) throw new Error('Block ohne Lage.');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x + box.width * 1.5, y, { steps: 8 });
    await wapPage.mouse.up();
    await expect
      .poll(async () => {
        const after = await b.boundingBox();
        return (after?.x ?? box.x) - box.x;
      })
      .toBeGreaterThan(box.width / 2);
    const saved = Object.values((await savedPlan(wapPage)).entries).find(
      (e): e is Block => e.type === 'block',
    );
    expect(saved?.columns.kind).toBe('ids');
    const ids = saved?.columns.kind === 'ids' ? saved.columns.ids : [];
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(foreign);
    for (const id of ids) expect(moColumns).toContain(id);
  });
}

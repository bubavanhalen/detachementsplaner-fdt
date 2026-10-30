// F-UX3 (Entscheid Auftraggeber 21.10.2026 «Marker sollen per se immer über alle Det-Spalten gehen»): Marker gelten
// immer über alle Planungsspalten des Tags. Anlegen per Menü (M), Rechtsklick und Dialog speichert «alle»; ein
// Marker eines alten Plans mit Einzelspalte wird über alle Spalten gezeichnet; Seitenfeld und Liste zeigen «alle»
// ohne Spaltenwahl. Fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import type { Marker, Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

const MINUTE = 0.8;
const FROM = 240;

/** Bezug HV 0600 über alle Spalten und ein alter Marker ABV 1900 mit gespeicherter Einzelspalte (Stv). */
function planMarker(): Plan {
  let plan = kpPlan(1);
  const [, stv] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (stv === undefined) throw new Error('Spalten fehlen');
  const marker = (at: number, kind: 'HV' | 'ABV') =>
    ({
      type: 'marker',
      date: MO,
      at,
      kind,
      customKind: '',
      columns: { kind: 'all' },
    }) as const;
  plan = add(plan, marker(360, 'HV')).plan;
  const r = add(plan, marker(1140, 'ABV'));
  const alt = r.plan.entries[r.id] as Marker;
  plan = {
    ...r.plan,
    entries: { ...r.plan.entries, [r.id]: { ...alt, columns: { kind: 'ids', ids: [stv.id] } } },
  };
  return { ...plan, id: 'fux3-marker', exerciseName: 'Marker Übungsplan', service: 'FDT 2099' };
}

function markerButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Marker ${name} · Mo$`) });
}

async function breite(l: Locator): Promise<{ x: number; w: number }> {
  const b = await l.boundingBox();
  if (b === null) throw new Error('Marker fehlt');
  return { x: b.x, w: b.width };
}

/** Bildschirm: gleiche Lage und Breite wie der Bezug HV 0600 über alle Spalten. */
async function überAlle(page: Page, name: string): Promise<void> {
  const bezug = await breite(markerButton(page, 'HV 0600'));
  const m = await breite(markerButton(page, name));
  expect(Math.abs(m.x - bezug.x)).toBeLessThan(1);
  expect(Math.abs(m.w - bezug.w)).toBeLessThan(1);
}

async function gespeicherteSpalten(page: Page): Promise<Record<string, unknown>> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
  const path = await (await pending).path();
  if (path === null) throw new Error('Plan-Datei fehlt.');
  const plan = parsePlanFile(new Uint8Array(readFileSync(path))).plan;
  const out: Record<string, unknown> = {};
  for (const e of Object.values(plan.entries))
    if (e.type === 'marker') out[`${e.kind} ${String(e.at)}`] = e.columns;
  return out;
}

/** Mitte der zweiten Planungsspalte (Stv) am Mo bei `minutes` (leere Fläche je Spalte). */
async function stvPunkt(page: Page, minutes: number): Promise<{ x: number; y: number }> {
  const b = await page
    .getByRole('button', { name: /^Leere Fläche Mo / })
    .nth(1)
    .boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return { x: b.x + b.width / 2, y: b.y + (minutes - FROM) * MINUTE };
}

export function registerMarkerTests(url: () => string): void {
  test('[R-4.6-15] F-UX3: Marker per Rechtsklick in einer Spalte und M gilt über alle Planungsspalten (gespeichert «alle»)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Marker.wap.json', planFile(planMarker()));
    const p = await stvPunkt(wapPage, 840);
    await wapPage.mouse.click(p.x, p.y, { button: 'right' });
    await expect(wapPage.getByRole('menu', { name: 'Leere Fläche' })).toBeVisible();
    await wapPage.keyboard.press('m');
    const d = wapPage.getByRole('dialog', { name: 'Neuer Marker', exact: true });
    await expect(d).toContainText('Der Marker gilt über alle Planungsspalten des Tags.');
    await d.getByRole('combobox', { name: 'Art', exact: true }).selectOption('AV');
    await d.getByRole('textbox', { name: 'Zeitpunkt', exact: true }).fill('1400');
    await d.getByRole('button', { name: 'Marker anlegen', exact: true }).click();
    await expect(markerButton(wapPage, 'AV 1400')).toBeVisible();
    await überAlle(wapPage, 'AV 1400');
    expect((await gespeicherteSpalten(wapPage))['AV 840']).toEqual({ kind: 'all' });
  });

  test('[R-4.6-15] F-UX3: Marker eines alten Plans mit Einzelspalte wird über alle Planungsspalten gezeichnet; die Datei behält die Liste', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Alt.wap.json', planFile(planMarker()));
    await expect(markerButton(wapPage, 'ABV 1900')).toBeVisible();
    await überAlle(wapPage, 'ABV 1900');
    expect((await gespeicherteSpalten(wapPage))['ABV 1140']).toMatchObject({ kind: 'ids' });
  });

  test('[R-4.6-15] F-UX3: Seitenfeld eines Markers ohne Spaltenwahl, mit Hinweis «alle Planungsspalten»', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Feld.wap.json', planFile(planMarker()));
    await markerButton(wapPage, 'ABV 1900').click();
    const seitenfeld = wapPage.getByRole('complementary', { name: 'Seitenfeld' });
    if (!(await seitenfeld.isVisible()))
      await wapPage.getByRole('button', { name: 'Seitenfeld', exact: true }).click();
    await expect(seitenfeld).toBeVisible();
    await expect(seitenfeld.getByRole('status', { name: 'Beschriftung des Markers' })).toHaveText(
      'ABV 1900',
    );
    await expect(seitenfeld.getByRole('combobox', { name: /^Spalten/ })).toHaveCount(0);
    await expect(seitenfeld).toContainText('Spalten: alle Planungsspalten');
  });

  test('[R-4.6-15] F-UX3: Liste zeigt für Marker «alle» (nicht änderbar, mit Hinweis), auch bei gespeicherter Einzelspalte', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'X3Liste.wap.json', planFile(planMarker()));
    await wapPage.getByRole('button', { name: 'Liste', exact: true }).click();
    const grid = wapPage.getByRole('grid', { name: /^Einträge / });
    await expect(grid).toBeVisible();
    const headers = (await grid.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    const i = headers.indexOf('Spalten');
    expect(i).toBeGreaterThanOrEqual(0);
    const zelle = grid
      .locator('tbody tr')
      .filter({ hasText: 'ABV' })
      .first()
      .getByRole('gridcell')
      .nth(i);
    await expect(zelle).toHaveText('alle');
    await expect(zelle).toHaveAttribute('aria-readonly', 'true');
    await expect(zelle).toHaveAttribute('title', /immer über alle Planungsspalten/);
  });
}

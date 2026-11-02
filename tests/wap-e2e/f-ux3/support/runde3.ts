// F-UX3 Runde 3 (Entscheid Auftraggeber 21.10.2026 «1: a / 2: a / 3: a / 4: a / 5: a»; Gestaltung bewegung-v1,
// endgültig): Variante B (rastend mit Gleiten, ≤ 200 ms) mit dem Shift/Alt-Aufleuchten aus C; freie Kante dockt an,
// darüber nur mit Alt; Shift beim Drücken = Auswahlrahmen; Shift schiebt alle Folgeblöcke bis Tagesende; Griffe als
// Pille an den Kanten des überfahrenen Blocks und am Marker. Beim Loslassen zählen Zeigerlage und Tasten des
// Loslassens; keine Layout-Lesung während der Geste; keine Ebenen auf Vorrat. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

const MINUTE = 0.8;

function planRunde3(): Plan {
  let plan = kpPlan(1);
  const [kdt] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined) throw new Error('Spalten fehlen');
  const block = (from: number, to: number, title: string, all = false) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: all ? ({ kind: 'all' } as const) : ({ kind: 'ids', ids: [kdt.id] } as const),
    title: [{ text: title, bold: true }],
  });
  plan = add(plan, block(360, 420, 'Breit', true)).plan;
  plan = add(plan, block(600, 660, 'Alpha')).plan;
  plan = add(plan, block(720, 780, 'Bravo')).plan;
  plan = add(plan, block(840, 900, 'Charlie')).plan;
  plan = add(plan, {
    type: 'marker',
    date: MO,
    at: 1320,
    kind: 'ABV',
    customKind: '',
    columns: { kind: 'all' },
  }).plan;
  return { ...plan, id: 'fux3-runde3', exerciseName: 'Runde 3 Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

const grip = (page: Page, zone: string) => page.locator(`.i2-grid-grip[data-grip="${zone}"]`);
const badge = (page: Page) =>
  page.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }).locator('.i2-grid-mode');

export function registerRunde3Tests(url: () => string): void {
  test('[R-5.1-14] F-UX3 Runde 3 (5a): Griffe als Pille an den Kanten des überfahrenen Blocks; Kante gefüllt; Marker-Zeitgriff mit Band', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Griffe.wap.json', planFile(planRunde3()));
    const b = await fläche(block(wapPage, 'Breit'));
    expect(b.width).toBeGreaterThan(80);
    await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    // Oben, unten und seitlich eingeblendet (Breite ≥ 60 px, Höhe ≥ 30 px); oben/unten rechts (Breite ≥ 80 px).
    for (const z of ['start', 'end', 'left', 'right'])
      await expect(grip(wapPage, z)).toHaveClass(/is-on/);
    await expect(grip(wapPage, 'marker')).not.toHaveClass(/is-on/);
    await expect(grip(wapPage, 'end').locator('svg')).toHaveCount(2);
    // Nach dem Einblenden (140 ms aus 80 %): 34 × 16 px.
    const svg = grip(wapPage, 'end').locator('svg').first();
    await expect.poll(async () => Math.round((await svg.boundingBox())?.width ?? 0)).toBe(34);
    const g = await svg.boundingBox();
    if (g === null) throw new Error('Griff fehlt');
    expect(Math.round(g.height)).toBe(16);
    expect(g.x + g.width / 2).toBeGreaterThan(b.x + b.width - 30);
    // Kante überfahren: Griff gefüllt (heiss), Mauszeiger ns-resize.
    await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height - 2);
    await expect(grip(wapPage, 'end')).toHaveClass(/is-hot/);
    await expect(grip(wapPage, 'start')).not.toHaveClass(/is-hot/);
    // Griff über der Kante hinaus greifen (ohne vorher zu wählen): Ende ändert sich.
    await wapPage.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 3);
    await expect(grip(wapPage, 'end')).toHaveClass(/is-hot/);
    await wapPage.mouse.down();
    await wapPage.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 3 + 30 * MINUTE, { steps: 5 });
    await expect(grip(wapPage, 'end')).toHaveClass(/is-grab/);
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Breit')).toHaveAccessibleName(/0600-0730/);
    // Marker: Band und Zeitgriff mitten auf der Linie.
    const marker = wapPage.getByRole('button', { name: /^Marker ABV 2200 · Mo$/ });
    await marker.scrollIntoViewIfNeeded();
    const m = await marker.boundingBox();
    if (m === null) throw new Error('Marker fehlt');
    // Die Linie liegt oben im Marker (darunter das Beschriftungsfeld, mittig über den Spalten).
    await wapPage.mouse.move(m.x + 30, m.y + 1.5);
    await expect(wapPage.locator('.i2-grid-hover')).toHaveAttribute('data-kind', 'marker');
    await expect(grip(wapPage, 'marker')).toHaveClass(/is-on/);
    await expect(grip(wapPage, 'end')).not.toHaveClass(/is-on/);
  });

  test('[R-5.1-14] F-UX3 Runde 3 (1a): angehobener Block rastet ein, Original als Umriss; nur der gezogene Block hat eine eigene Ebene; keine Layout-Lesung während der Geste', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Heben.wap.json', planFile(planRunde3()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    const y = a.y + a.height / 2;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 5, { steps: 2 });
    await expect(wapPage.locator('.i2-grid-lift')).toBeVisible();
    const liftY = () =>
      wapPage.locator('.i2-grid-lift').evaluate((e) => {
        const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec((e as HTMLElement).style.transform);
        return m === null ? Number.NaN : Number(m[2]);
      });
    const y0 = await liftY();
    // Die Auswahlleiste (Drücken wählt) misst sich einmal beim Erscheinen; danach zählen die Lageabfragen der Geste.
    await expect(wapPage.getByRole('toolbar', { name: 'Auswahl' })).toBeVisible();
    for (let i = 0; i < 3; i++)
      await wapPage.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );
    // Ab hier: Lageabfragen zählen (keine während der Geste).
    await wapPage.evaluate(() => {
      const w = window as unknown as { rects: number };
      w.rects = 0;
      const orig = Element.prototype.getBoundingClientRect;
      // Gezählt: alles ausser der Auswahlleiste (misst sich nach dem Wählen beim Drücken einmal selbst, ResizeObserver).
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.closest('[role="toolbar"]') === null) w.rects++;
        return orig.call(this);
      };
    });
    // 23 px ≈ 29 Min: eingerastet auf 30 Min (24 px), nicht pixelgenau am Zeiger.
    await wapPage.mouse.move(x, y + 23, { steps: 6 });
    await expect(wapPage.getByRole('status', { name: 'Zeiten beim Ziehen' })).toContainText(
      '1030-1130',
    );
    // Eingerastet: genau 30 Min (24 px) tiefer als zu Beginn.
    expect((await liftY()) - y0).toBeCloseTo(30 * MINUTE, 1);
    const start = await block(wapPage, 'Alpha')
      .locator('xpath=..')
      .evaluate((e) => ({
        top: Number.parseFloat((e as HTMLElement).style.top),
        willChange: getComputedStyle(e).willChange,
        outline: getComputedStyle(e).outlineStyle,
        opacity: getComputedStyle(e).opacity,
      }));
    // Original als Umriss (45 %, gestrichelt), ohne eigene Ebene; keine Ebenen auf Vorrat an anderen Blöcken.
    expect(start.opacity).toBe('0.45');
    expect(start.outline).toBe('dashed');
    expect(start.willChange).toBe('auto');
    expect(
      await block(wapPage, 'Bravo')
        .locator('xpath=..')
        .evaluate((e) => getComputedStyle(e).willChange),
    ).toBe('auto');
    expect(
      await wapPage.locator('.i2-grid-lift').evaluate((e) => getComputedStyle(e).willChange),
    ).toBe('transform');
    // Leuchtrahmen und Schatten am angehobenen Block.
    await expect(wapPage.locator('.i2-grid-lift .i2-lift-gl')).toHaveCount(1);
    const rects = await wapPage.evaluate(() => (window as unknown as { rects: number }).rects);
    expect(rects).toBe(0);
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1030-1130/);
  });

  test('[R-5.1-14] F-UX3 Runde 3 (2a): freie Kante dockt am nächsten Block an («dockt an», Nachbar markiert); mit Alt darüber', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Andocken.wap.json', planFile(planRunde3()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + a.height - 2);
    await wapPage.mouse.down();
    // Bis 1200 (Bravo beginnt 1200): dockt an. Entscheid Auftraggeber 21.10.2026 (Shift alle darunter, ohne Taste
    // nie überlappen): darüber hinaus schrumpft Bravo (Runde 4), deshalb hier genau bis zum Beginn.
    await wapPage.mouse.move(x, a.y + a.height - 2 + 60 * MINUTE, { steps: 8 });
    await expect(badge(wapPage)).toHaveText('dockt an «Bravo» · Alt = darüber');
    await expect(block(wapPage, 'Bravo').locator('xpath=..')).toHaveClass(/is-follow/);
    await expect(block(wapPage, 'Bravo').locator('xpath=..').locator('.i2-grid-tag')).toHaveText(
      'dockt an',
    );
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1200/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1200-1300/);
    // Mit Alt (während des Ziehens) läuft die Kante darüber.
    const a2 = await fläche(block(wapPage, 'Alpha'));
    await wapPage.mouse.move(x, a2.y + a2.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a2.y + a2.height + 4, { steps: 3 });
    await wapPage.keyboard.down('Alt');
    await wapPage.mouse.move(x, a2.y + a2.height - 2 + 30 * MINUTE, { steps: 4 });
    await expect(badge(wapPage)).toHaveText('Alt · parallel, ohne Anpassung');
    await expect(wapPage.locator('.i2-grid-scroll')).toHaveAttribute('data-mode', 'none');
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Alt');
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1230/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1200-1300/);
  });

  test('[R-5.1-14] F-UX3 Runde 3 (1a, 4a): Shift während des Ziehens leuchtet auf (Rahmen, Plakette mit Anzahl, Nachbarn mit «+»), schiebt bis Tagesende; Loslassen ohne Shift passt an', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Shift.wap.json', planFile(planRunde3()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + a.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + a.height + 4, { steps: 3 });
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.move(x, a.y + a.height - 2 + 30 * MINUTE, { steps: 4 });
    await expect(badge(wapPage)).toHaveText('⇧ Shift · Folgende mitschieben · 2 Blöcke');
    await expect(badge(wapPage)).toHaveAttribute('data-mode', 'shift');
    await expect(wapPage.locator('.i2-grid-scroll')).toHaveAttribute('data-mode', 'shift');
    await expect(wapPage.locator('.i2-grid-lift')).toHaveAttribute('data-mode', 'shift');
    for (const t of ['Bravo', 'Charlie']) {
      await expect(block(wapPage, t).locator('xpath=..')).toHaveClass(/is-shift-follow/);
      await expect(block(wapPage, t).locator('xpath=..').locator('.i2-grid-tag')).toHaveText(
        '+30 Min',
      );
    }
    // Shift kurz vor dem Loslassen lösen: es gilt der Zustand beim Loslassen (anpassen; Bravo liegt nicht an, also
    // nur Alpha länger), nicht das letzte Bild.
    await wapPage.keyboard.up('Shift');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1130/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1200-1300/);
    await expect(block(wapPage, 'Charlie')).toHaveAccessibleName(/1400-1500/);
    await expect(wapPage.locator('.i2-grid-scroll')).not.toHaveAttribute('data-mode', /./);
  });

  // Entscheid Auftraggeber 21.10.2026 (Shift alle darunter, ohne Taste nie überlappen), Präzisierung 3a durch den
  // Koordinator: Shift beim Drücken auf leerer Fläche = Auswahlrahmen; auf einem Block schiebt Ziehen mit Shift mit.
  test('[R-5.1-20] F-UX3 Runde 3 (3a): Shift beim Drücken auf leerer Fläche zieht einen Auswahlrahmen über die Blöcke, die Blöcke bleiben', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Rahmen.wap.json', planFile(planRunde3()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const c = await fläche(block(wapPage, 'Charlie'));
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.move(a.x + a.width + 10, a.y + a.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 6 });
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Shift');
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1100/);
    for (const t of ['Alpha', 'Bravo', 'Charlie'])
      await expect(block(wapPage, t)).toHaveAttribute('aria-pressed', 'true');
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('3 Einträge gewählt');
  });

  test('[R-5.1-14] F-UX3 Runde 3: Bewegung reduzieren – keine Übergänge am angehobenen Block, an Griffen und Plakette', async ({
    wapPage,
  }) => {
    await wapPage.emulateMedia({ reducedMotion: 'reduce' });
    await startWith(wapPage, `${url()}#leer`, 'R3Ruhig.wap.json', planFile(planRunde3()));
    const a = await fläche(block(wapPage, 'Alpha'));
    await wapPage.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await expect(grip(wapPage, 'end')).toHaveClass(/is-on/);
    const dauer = (sel: string) =>
      wapPage
        .locator(sel)
        .first()
        .evaluate((e) =>
          getComputedStyle(e)
            .transitionDuration.split(',')
            .every((d) => Number.parseFloat(d) === 0),
        );
    expect(await dauer('.i2-grid-grip[data-grip="end"] .i2-grip-in')).toBe(true);
    await wapPage.mouse.down();
    await wapPage.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 30, { steps: 4 });
    expect(await dauer('.i2-grid-lift')).toBe(true);
    expect(await dauer('.i2-grid-lift .i2-lift-f')).toBe(true);
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1100/);
  });
}

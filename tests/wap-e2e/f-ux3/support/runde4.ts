// F-UX3 Runde 4 (Rückmeldung Auftraggeber 21.10.2026 zu e1598a3: «when selecting shift or alt it takes to loong …
// with shift, it only moves items that are equal width, but it should move all items below. And with normal drag, it
// should not overlap, or with alt … there must be an way to just grow one item and the connected ones shrink»):
// Shift/Alt wirken und zeigen sich im selben Bild wie keydown/keyup; Shift schiebt alle Einträge darunter mit
// überschneidenden Spalten (transitiv, auch Beso-Kästchen; Marker bleiben); ohne Taste nie überlappen (gemeinsame
// Kante, Andocken und Schrumpfen, Verdrängen beim Verschieben); nur Alt überlappt. Fiktive Daten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { columnsOf } from '../../f-ux2/support/plaene';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

// F-FLAKY3: läuft exklusiv im Projekt edge-zeit (playwright.wap.config.ts), nach allen
// übrigen Tests und mit einem Worker, damit kein paralleler Worker die Messung belastet.
const ZEITKRITISCH = { tag: '@zeitkritisch' };

const MINUTE = 0.8;

/**
 * Mo: Alpha 1000–1100 (Kdt), Bravo 1200–1300 (Kdt), Breit 1400–1500 (Kdt + Stv), Delta 1530–1600 (Stv), Echo
 * 1000–1100 (Zfhr, unbeteiligt), Beso «Visite» 1600 in Kdt, Marker ABV 2200.
 */
function planRunde4(): Plan {
  let plan = kpPlan(1);
  const [kdt, stv, zfhr] = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  if (kdt === undefined || stv === undefined || zfhr === undefined)
    throw new Error('Spalten fehlen');
  const block = (from: number, to: number, title: string, ids: string[]) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids', ids } as const,
    title: [{ text: title, bold: true }],
  });
  plan = add(plan, block(600, 660, 'Alpha', [kdt.id])).plan;
  plan = add(plan, block(720, 780, 'Bravo', [kdt.id])).plan;
  plan = add(plan, block(840, 900, 'Breit', [kdt.id, stv.id])).plan;
  plan = add(plan, block(930, 960, 'Delta', [stv.id])).plan;
  plan = add(plan, block(600, 660, 'Echo', [zfhr.id])).plan;
  plan = add(plan, {
    type: 'beso',
    date: MO,
    title: [{ text: 'Visite', bold: false }],
    windows: [{ time: { form: 'point', at: 960 }, columnId: kdt.id }],
  }).plan;
  plan = add(plan, {
    type: 'marker',
    date: MO,
    at: 1320,
    kind: 'ABV',
    customKind: '',
    columns: { kind: 'all' },
  }).plan;
  return { ...plan, id: 'fux3-runde4', exerciseName: 'Runde 4 Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

/**
 * F-FLAKY2 (FL2-05): Fläche erst lesen, wenn sie in zwei aufeinanderfolgenden Bildern gleich ist. Nach dem Loslassen
 * gleiten Nachbarn noch (Übergang 110–140 ms); unter Last las der Test sonst die alte Lage und griff den Block in der
 * Mitte statt an der Kante (Verschieben statt Grösse ändern).
 */
async function ruhigeFläche(entry: Locator) {
  let vorher = await fläche(entry);
  await expect
    .poll(async () => {
      await entry
        .page()
        .evaluate(
          () =>
            new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        );
      const jetzt = await fläche(entry);
      const gleich =
        Math.abs(jetzt.x - vorher.x) < 0.5 &&
        Math.abs(jetzt.y - vorher.y) < 0.5 &&
        Math.abs(jetzt.width - vorher.width) < 0.5 &&
        Math.abs(jetzt.height - vorher.height) < 0.5;
      vorher = jetzt;
      return gleich;
    })
    .toBe(true);
  return vorher;
}

const badge = (page: Page) =>
  page.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }).locator('.i2-grid-mode');

/**
 * Zeit vom keydown/keyup bis zur Anzeige im Bild (ms): Rahmen um das Raster (`data-mode` der Rollfläche), Plakette
 * am Zeitschild und Markierung des Nachbarn (Klasse) – je bis zum ersten Bild nach der Änderung (requestAnimationFrame
 * nach der Mutation). Zusätzlich die Zahl der Bilder zwischen Taste und Anzeige.
 */
async function messeTaste(
  page: Page,
  taste: 'Shift' | 'Alt',
  richtung: 'down' | 'up',
  nachbar: string,
  klasse: RegExp,
): Promise<{ rahmen: number; plakette: number; nachbar: number; bilder: number; bild1: number }> {
  await page.evaluate(
    ({ taste, richtung, nachbar, klasse }) => {
      interface R4 {
        t0: number;
        rahmen: number;
        plakette: number;
        nachbar: number;
        bilder: number;
        bild1: number;
      }
      const w = window as unknown as { __r4?: R4 };
      const r: R4 = { t0: -1, rahmen: -1, plakette: -1, nachbar: -1, bilder: 0, bild1: -1 };
      w.__r4 = r;
      const art = richtung === 'down' ? 'keydown' : 'keyup';
      const scroll = document.querySelector('.i2-grid-scroll');
      const status = document.querySelector('[aria-label="Zeiten beim Ziehen"]');
      const n = [...document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit')].find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(`Block ${nachbar} `),
      )?.parentElement;
      const re = new RegExp(klasse);
      // Zeitpunkt des ersten Bildes nach der Änderung (absolut); die Taste zählt ab ihrem Zeitstempel, weil die
      // Anwendung das Ereignis vor diesem Beobachter erhält (Beobachter und Bildzähler laufen ab der ersten Änderung).
      let läuft = false;
      // F-FLAKY2: Zeitstempel des Bildes (Argument von requestAnimationFrame), nicht die Uhr im Rückruf; bild1 ist der
      // Beginn des ersten Bildes nach der Taste.
      const zählen = (ts: number) => {
        if (r.bild1 < 0) r.bild1 = ts;
        r.bilder++;
        if (r.rahmen < 0 || r.plakette < 0 || r.nachbar < 0) requestAnimationFrame(zählen);
      };
      const beginne = () => {
        if (läuft) return;
        läuft = true;
        requestAnimationFrame(zählen);
      };
      const frame = (key: 'rahmen' | 'plakette' | 'nachbar') => {
        beginne();
        requestAnimationFrame((ts) => {
          if (r[key] < 0) r[key] = ts;
        });
      };
      window.addEventListener(
        art,
        (e) => {
          if ((e as KeyboardEvent).key !== taste || r.t0 >= 0) return;
          r.t0 = e.timeStamp;
          beginne();
        },
        { capture: true },
      );
      const soll = richtung === 'down' ? (taste === 'Shift' ? 'shift' : 'none') : 'adjust';
      const alt = taste === 'Shift' ? 'shift' : 'none';
      const lesen = () => {
        const mode = scroll?.getAttribute('data-mode') ?? '';
        if (mode === soll || (richtung === 'up' && mode === '')) frame('rahmen');
        const bm = status?.querySelector('.i2-grid-mode')?.getAttribute('data-mode') ?? '';
        if (richtung === 'down' ? bm === soll : bm !== alt) frame('plakette');
        const has = n !== undefined && n !== null && re.test(n.className);
        if (richtung === 'down' ? has : !has) frame('nachbar');
      };
      const o = new MutationObserver(lesen);
      if (scroll) o.observe(scroll, { attributes: true, attributeFilter: ['data-mode'] });
      if (status) o.observe(status, { childList: true, subtree: true, attributes: true });
      if (n) o.observe(n, { attributes: true, attributeFilter: ['class'] });
    },
    { taste, richtung, nachbar, klasse: klasse.source },
  );
  if (richtung === 'down') await page.keyboard.down(taste);
  else await page.keyboard.up(taste);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = (
          window as unknown as {
            __r4: { t0: number; rahmen: number; plakette: number; nachbar: number };
          }
        ).__r4;
        return r.t0 >= 0 && r.rahmen >= 0 && r.plakette >= 0 && r.nachbar >= 0;
      }),
    )
    .toBe(true);
  return page.evaluate(() => {
    const r = (
      window as unknown as {
        __r4: {
          t0: number;
          rahmen: number;
          plakette: number;
          nachbar: number;
          bilder: number;
          bild1: number;
        };
      }
    ).__r4;
    const f = (v: number) => Math.round((v - r.t0) * 10) / 10;
    return {
      rahmen: f(r.rahmen),
      plakette: f(r.plakette),
      nachbar: f(r.nachbar),
      bilder: r.bilder,
      bild1: f(r.bild1),
    };
  });
}

/** Bildabstand der Seite (Median), um «≤ 1 Bild» zu prüfen. */
async function bildabstand(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((done) => {
        const t: number[] = [];
        const step = (now: number) => {
          t.push(now);
          if (t.length < 12) requestAnimationFrame(step);
          else {
            const d = t.slice(1).map((v, i) => v - (t[i] ?? v));
            d.sort((a, b) => a - b);
            done(d[Math.floor(d.length / 2)] ?? 16.7);
          }
        };
        requestAnimationFrame(step);
      }),
  );
}

export const MESSUNG: { werte: Record<string, unknown> } = { werte: {} };

export function registerRunde4Tests(url: () => string): void {
  test(
    '[R-5.1-14] F-UX3 Runde 4: Shift und Alt wirken und zeigen sich im selben Bild wie keydown/keyup (≤ 1 Bild), ohne Mausbewegung',
    ZEITKRITISCH,
    async ({ wapPage }) => {
      await startWith(wapPage, `${url()}#leer`, 'R4Taste.wap.json', planFile(planRunde4()));
      const bild = await bildabstand(wapPage);
      const a = await fläche(block(wapPage, 'Alpha'));
      const x = a.x + a.width / 2;
      await wapPage.mouse.move(x, a.y + a.height - 2);
      await wapPage.mouse.down();
      await wapPage.mouse.move(x, a.y + a.height + 4, { steps: 2 });
      await wapPage.mouse.move(x, a.y + a.height - 2 + 30 * MINUTE, { steps: 3 });
      await expect(wapPage.locator('.i2-grid-lift')).toBeVisible();
      const shiftDown = await messeTaste(wapPage, 'Shift', 'down', 'Bravo', /is-shift-follow/);
      await expect(badge(wapPage)).toHaveAttribute('data-mode', 'shift');
      // Wirkung im selben Bild: der Nachbar steht sofort an der neuen Lage (kein Gleiten beim Moduswechsel).
      expect(
        await block(wapPage, 'Bravo')
          .locator('xpath=..')
          .evaluate((e) => (e as HTMLElement).style.transform),
      ).toBe('');
      const shiftUp = await messeTaste(wapPage, 'Shift', 'up', 'Bravo', /is-shift-follow/);
      const altDown = await messeTaste(wapPage, 'Alt', 'down', 'Alpha', /is-parallel/);
      await expect(badge(wapPage)).toHaveAttribute('data-mode', 'none');
      const altUp = await messeTaste(wapPage, 'Alt', 'up', 'Alpha', /is-parallel/);
      MESSUNG.werte = { bildMs: Math.round(bild * 10) / 10, shiftDown, shiftUp, altDown, altUp };
      // Messwerte (nur synthetisch) für den Bericht: test-results/wap/f-ux3-taste-<projekt>.json.
      mkdirSync(join(process.cwd(), 'test-results/wap'), { recursive: true });
      writeFileSync(
        join(process.cwd(), `test-results/wap/f-ux3-taste-${test.info().project.name}.json`),
        `${JSON.stringify(MESSUNG.werte, null, 2)}
`,
      );
      await wapPage.keyboard.press('Escape');
      await wapPage.mouse.up();
      // Höchstens ein Bild bis zur Anzeige (Rahmen, Plakette, Nachbar), auch beim Loslassen der Taste.
      // F-FLAKY2 (FL2-01): Bildbezug über die Zeitstempel von requestAnimationFrame: Rahmen, Plakette und Nachbar stehen
      // im ersten Bild nach der Taste (gleicher Bildbeginn bild1). Der frühere Vergleich mit 1,6 × dem vorab gemessenen
      // Bildabstand hing vom Bildtakt der Anzeige ab (Remotedesktop 32 Hz, ohne Last abweichend vom Takt beim Ziehen).
      for (const m of [shiftDown, shiftUp, altDown, altUp]) {
        expect(m.bilder, JSON.stringify(m)).toBeLessThanOrEqual(2);
        // bild1 kann vor dem Zeitstempel der Taste liegen (Tastenereignisse kommen innerhalb eines begonnenen Bildes).
        expect(m.bilder, JSON.stringify(m)).toBeGreaterThanOrEqual(1);
        expect(Math.max(m.rahmen, m.plakette, m.nachbar), JSON.stringify(m)).toBeLessThanOrEqual(
          m.bild1,
        );
      }
      // Keine Einblend-Animation beim Moduswechsel: Plakette ohne Animation, Farbübergang höchstens 50 ms.
      const anim = await wapPage.evaluate(() => {
        const probe = document.createElement('span');
        probe.className = 'i2-grid-mode is-shift';
        document.body.append(probe);
        const s = getComputedStyle(probe);
        const r = { animation: s.animationName, dauer: s.transitionDuration };
        probe.remove();
        return r;
      });
      expect(anim.animation).toBe('none');
      expect(anim.dauer.split(',').every((d) => Number.parseFloat(d) <= 0.05)).toBe(true);
    },
  );

  test('[R-5.1-14] F-UX3 Runde 4: Shift während des Ziehens eines Blocks, auch schon vor der ersten Bewegung gehalten, schiebt sofort mit; Fokuswechsel löst Shift', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Vorher.wap.json', planFile(planRunde4()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    // Taste vor dem Greifen gedrückt, Drücken auf dem Block: Klick ohne Ziehen wählt (Bereich), Ziehen schiebt mit.
    await wapPage.mouse.move(x, a.y + a.height / 2);
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + a.height / 2 + 90 * MINUTE, { steps: 5 });
    await expect(badge(wapPage)).toHaveAttribute('data-mode', 'shift');
    await expect(block(wapPage, 'Bravo').locator('xpath=..')).toHaveClass(/is-shift-follow/);
    // Fokuswechsel (Fenster verliert den Fokus): die Taste gilt als losgelassen.
    await wapPage.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(badge(wapPage)).not.toHaveAttribute('data-mode', 'shift');
    await wapPage.keyboard.up('Shift');
    await wapPage.keyboard.press('Escape');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1100/);
  });

  test('[R-5.1-14] F-UX3 Runde 4: Shift schiebt alle Einträge darunter mit überschneidenden Spalten (transitiv, Beso-Kästchen mit), Marker und Unbeteiligte bleiben', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Alle.wap.json', planFile(planRunde4()));
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + a.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + a.height + 4, { steps: 2 });
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.move(x, a.y + a.height - 2 + 60 * MINUTE, { steps: 4 });
    await expect(badge(wapPage)).toHaveText('⇧ Shift · Folgende mitschieben · 4 Einträge');
    for (const t of ['Bravo', 'Breit', 'Delta'])
      await expect(block(wapPage, t).locator('xpath=..').locator('.i2-grid-tag')).toHaveText(
        '+1 h',
      );
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Shift');
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1200/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1300-1400/);
    await expect(block(wapPage, 'Breit')).toHaveAccessibleName(/1500-1600/);
    await expect(block(wapPage, 'Delta')).toHaveAccessibleName(/1630-1700/);
    await expect(block(wapPage, 'Echo')).toHaveAccessibleName(/1000-1100/);
    await expect(wapPage.getByRole('button', { name: /^Beso .*Visite.*1700/ })).toHaveCount(1);
    await expect(wapPage.getByRole('button', { name: /^Marker ABV 2200 · Mo$/ })).toHaveCount(1);
    // Ein Undo-Schritt.
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(block(wapPage, 'Delta')).toHaveAccessibleName(/1530-1600/);
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1100/);
  });

  test('[R-5.1-14] F-UX3 Runde 4: ohne Taste nie überlappen – gemeinsame Kante schrumpft den Nachbarn (Hinweis an der Grenze), Andocken und weiter schrumpfen, Verschieben verdrängt; nur Alt überlappt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Nie.wap.json', planFile(planRunde4()));
    // (b) Freie Kante bis Bravo: dockt an, weiter: Bravo schrumpft («−30 Min»).
    const a = await fläche(block(wapPage, 'Alpha'));
    const x = a.x + a.width / 2;
    await wapPage.mouse.move(x, a.y + a.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a.y + a.height - 2 + 60 * MINUTE, { steps: 5 });
    await expect(badge(wapPage)).toHaveText('dockt an «Bravo» · Alt = darüber');
    await wapPage.mouse.move(x, a.y + a.height - 2 + 90 * MINUTE, { steps: 3 });
    await expect(block(wapPage, 'Bravo').locator('xpath=..').locator('.i2-grid-tag')).toHaveText(
      '−30 Min',
    );
    await expect(badge(wapPage)).toHaveText('«Bravo» schrumpft · −30 Min');
    // (a) An der Grenze (Bravo 15 Min) hält die Kante an mit Hinweis.
    await wapPage.mouse.move(x, a.y + a.height - 2 + 150 * MINUTE, { steps: 4 });
    await expect(badge(wapPage)).toHaveText('Nachbar mind. 15 Min · Shift = mitschieben');
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1245/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1245-1300/);
    // Gemeinsame Kante zurück: Alpha schrumpft, Bravo wächst mit.
    const a2 = await ruhigeFläche(block(wapPage, 'Alpha'));
    await wapPage.mouse.move(x, a2.y + a2.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, a2.y + a2.height - 2 - 45 * MINUTE, { steps: 4 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1000-1200/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1200-1300/);
    // (c) Verschieben ohne Taste: Alpha (2 h) ganz über Bravo → Bravo rückt darunter, nie parallel.
    const a3 = await ruhigeFläche(block(wapPage, 'Alpha'));
    await wapPage.mouse.move(a3.x + a3.width / 2, a3.y + a3.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(a3.x + a3.width / 2, a3.y + a3.height / 2 + 60 * MINUTE, { steps: 6 });
    await expect(block(wapPage, 'Bravo').locator('xpath=..').locator('.i2-grid-tag')).toHaveText(
      'rückt +1 h',
    );
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Alpha')).toHaveAccessibleName(/1100-1300/);
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1300-1400/);
    // (d) Nur Alt überlappt.
    const b2 = await ruhigeFläche(block(wapPage, 'Bravo'));
    await wapPage.mouse.move(b2.x + b2.width / 2, b2.y + b2.height - 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(b2.x + b2.width / 2, b2.y + b2.height + 4, { steps: 2 });
    await wapPage.keyboard.down('Alt');
    await wapPage.mouse.move(b2.x + b2.width / 2, b2.y + b2.height - 2 + 30 * MINUTE, { steps: 3 });
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Alt');
    await expect(block(wapPage, 'Bravo')).toHaveAccessibleName(/1300-1430/);
    await expect(block(wapPage, 'Breit')).toHaveAccessibleName(/1400-1500/);
  });
}

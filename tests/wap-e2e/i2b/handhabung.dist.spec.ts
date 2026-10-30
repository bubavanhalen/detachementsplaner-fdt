// I2b-A in der Einzeldatei (file://, offline): dieselben Abläufe wie im Entwicklungsserver und die
// Leistungsmessung A3 (Beschrieb 11: Ziehen folgt der Maus ohne sichtbare Verzögerung).
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { einzeldateiUrl, test } from '../support/fixtures';
import { registerI2bTests } from './support/handhabung';

// F-FLAKY3: läuft exklusiv im Projekt edge-zeit (playwright.wap.config.ts), nach allen
// übrigen Tests und mit einem Worker, damit kein paralleler Worker die Messung belastet.
const ZEITKRITISCH = { tag: '@zeitkritisch' };

registerI2bTests(() => einzeldateiUrl('i2b'));

const BUDGET_MS = 16.7;

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly ts: number;
  readonly dur?: number;
  readonly pid: number;
  readonly tid: number;
  readonly args?: { readonly name?: string; readonly data?: { readonly type?: string } };
}

function p95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? Number.NaN;
}

/**
 * Hauptthread-Zeit je gezeichnetem Bild: Summe der Aufgaben des Renderers zwischen zwei Bildanfängen (R-11-11), gezählt
 * für die Bilder, in denen eine Zeigerbewegung verarbeitet wird (F-FLAKY2, FL2-03). Bilder ohne Eingabe sind leer; ihre
 * Zahl hängt vom Bildtakt der Anzeige ab (Remotedesktop 32 Hz, kopflos 30 Hz bis rund 100 Hz) und verdünnte das p95
 * je nach Takt (gemessen 9–25 ms bei gleichem Ablauf). Je Zeigerbewegung (60, Abstand ≥ 16 ms) genau ein Bild.
 */
function busyPerFrame(events: readonly TraceEvent[]): number[] {
  const names = new Map<string, string>();
  for (const e of events)
    if (e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args?.name ?? '');
  const main = (e: TraceEvent) => names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain';
  const starts = events
    .filter((e) => e.name === 'AnimationFrame' && e.ph === 'b' && main(e))
    .map((e) => e.ts)
    .sort((a, b) => a - b);
  const tasks = events.filter(
    (e) => e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && main(e),
  );
  const eingaben = events
    .filter(
      (e) =>
        e.name === 'EventDispatch' &&
        main(e) &&
        (e.args?.data?.type === 'pointermove' || e.args?.data?.type === 'mousemove'),
    )
    .map((e) => e.ts);
  const out: number[] = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const a = starts[i] ?? 0;
    const b = starts[i + 1] ?? 0;
    if (!eingaben.some((t) => t >= a && t < b)) continue;
    let busy = 0;
    for (const t of tasks)
      busy += Math.max(0, Math.min(b, t.ts + (t.dur ?? 0)) - Math.max(a, t.ts));
    out.push(busy / 1000);
  }
  return out;
}

async function measuredDrag(page: Page, demo: string): Promise<number[]> {
  await page.goto(einzeldateiUrl('i2b'));
  await page.reload();
  if (demo !== 'Realistisch')
    await page
      .getByRole('combobox', { name: 'Demoplan', exact: true })
      .selectOption({ label: demo });
  await page.getByRole('combobox', { name: 'Woche', exact: true }).selectOption({ index: 1 });
  const factor = (
    JSON.parse(readFileSync('docs/wap-planer/perf/drosselung.json', 'utf8')) as { faktor: number }
  ).faktor;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: factor });
  const browser = page.context().browser();
  if (browser === null) throw new Error('Browser für die Messung fehlt.');
  const target = page.getByRole('button', { name: /^Block / }).nth(3);
  await expect(target).toBeVisible();
  const b = await target.boundingBox();
  if (b === null) throw new Error('Block fehlt.');
  const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await browser.startTracing(page, {
    categories: ['devtools.timeline', 'toplevel', 'disabled-by-default-devtools.timeline.frame'],
  });
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(from.x + 5 * i, from.y + 2.5 * i);
    await page.waitForTimeout(16);
  }
  const trace = await browser.stopTracing();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return busyPerFrame((JSON.parse(trace.toString()) as { traceEvents: TraceEvent[] }).traceEvents);
}

test(
  '[R-5.1-14] I2b A3: Ziehen mit gedrosselter CPU (Faktor aus perf/drosselung.json) – p95 Bildzeit höchstens 16,7 ms',
  ZEITKRITISCH,
  async ({ wapPage }) => {
    for (const demo of ['Realistisch', 'Belastungstest']) {
      const frames = await measuredDrag(wapPage, demo);
      expect(frames.length, `${demo}: gemessene Bilder`).toBeGreaterThan(20);
      expect(p95(frames), `${demo}: p95 Hauptthread-Zeit je Bild (ms)`).toBeLessThanOrEqual(
        BUDGET_MS,
      );
    }
  },
);

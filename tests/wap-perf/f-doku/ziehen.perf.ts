// F-DOKU (Befund HT-08, R-11-11; Entscheid Orchestrator «Hauptthread-Zeit je Bild aus der Ablaufverfolgung + keine
// Aufgabe > 50 ms», PROGRESS Pakettabelle H-TESTS): Ziehen im Raster des synthetischen Plans (4 Wochen, 1000 Einträge,
// Startwert 20260928) während 2 s, gedrosselt nach docs/wap-planer/perf/drosselung.json. Gemessen wird nicht der
// Abstand aufeinanderfolgender requestAnimationFrame (der misst die Bildwiederholrate des Fensters, HT-08), sondern
// aus der Ablaufverfolgung des Browsers (CDP Tracing) die Zeit, die der Hauptthread je Bild arbeitet: Summe der
// obersten Aufgaben (RunTask) des Hauptthreads im Zeitraum zwischen zwei Bildbeginnen (BeginMainThreadFrame). Budget
// (budgets.json, Prompt §7): p95 dieser Zeit ≤ 16,7 ms und keine Aufgabe > 50 ms. Nur fiktive Daten.
import { expect, type Page, test } from '@playwright/test';
import { messeImBrowser, perfHarnessUrl, recordMetric, withThrottle } from '../support/perf';

interface TraceEvent {
  readonly name: string;
  readonly cat: string;
  readonly ph: string;
  readonly ts: number;
  readonly dur?: number;
  readonly pid: number;
  readonly tid: number;
  readonly args?: { readonly name?: string };
}

/** Zieht einen Block des Rasters 2 s lang auf und ab und bricht danach mit Esc ab (Plan unverändert). */
async function ziehen(page: Page): Promise<void> {
  const ziel = page
    .locator('#wap-perf-ziehen')
    .getByRole('button', { name: /^Block / })
    .first();
  await expect(ziel).toBeVisible();
  const b = await ziel.boundingBox();
  if (b === null) throw new Error('Block ohne Fläche');
  const x = b.x + b.width / 2;
  const y = b.y + Math.min(b.height / 2, 10);
  await page.mouse.move(x, y);
  await page.mouse.down();
  const beginn = Date.now();
  let k = 0;
  while (Date.now() - beginn < 2000) {
    k++;
    await page.mouse.move(x, y + 4 * ((k % 30) - 15));
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
}

/** Ablaufverfolgung während `fn` (Kategorien der Zeitachse und der Bilder). */
async function verfolge(page: Page, fn: () => Promise<void>): Promise<TraceEvent[]> {
  const cdp = await page.context().newCDPSession(page);
  const events: TraceEvent[] = [];
  cdp.on('Tracing.dataCollected', (d) => {
    events.push(...(d.value as unknown as TraceEvent[]));
  });
  const fertig = new Promise<void>((res) => {
    cdp.once('Tracing.tracingComplete', () => res());
  });
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: [
        'toplevel',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        '__metadata',
      ],
    },
  });
  try {
    await fn();
  } finally {
    await cdp.send('Tracing.end');
    await fertig;
    await cdp.detach();
  }
  return events;
}

// Oberste Aufgabe des Hauptthreads: «RunTask» der Zeitachse. Chromium schreibt dieselbe Aufgabe zusätzlich als
// «ThreadControllerImpl::RunTask» (Kategorie toplevel); sie wird nicht gezählt, und überlappende Aufgaben werden je
// Bild vereinigt, damit nichts doppelt zählt.
const istAufgabe = (e: TraceEvent) =>
  e.ph === 'X' && typeof e.dur === 'number' && e.name === 'RunTask';

/** Länge der Vereinigung der Intervalle [von, bis) in µs. */
function vereinigt(intervalle: [number, number][]): number {
  const s = [...intervalle].sort((x, y) => x[0] - y[0]);
  let summe = 0;
  let ende = Number.NEGATIVE_INFINITY;
  for (const [von, bis] of s) {
    const a = Math.max(von, ende);
    if (bis > a) summe += bis - a;
    ende = Math.max(ende, bis);
  }
  return summe;
}

/**
 * Hauptthread der Seite: der Thread «CrRendererMain» mit den meisten Bildbeginnen. Je Bild die Zeit, in der eine
 * oberste Aufgabe läuft, im Zeitraum [Bildbeginn, nächster Bildbeginn); dazu die längste Aufgabe des Hauptthreads.
 */
function auswerten(events: readonly TraceEvent[]): {
  bilder: number;
  p95HauptthreadMs: number;
  laengsteAufgabeMs: number;
} {
  const haupt = events
    .filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
    .map((e) => `${String(e.pid)}:${String(e.tid)}`);
  const key = (e: TraceEvent) => `${String(e.pid)}:${String(e.tid)}`;
  let bestes = '';
  let anzahl = -1;
  for (const t of new Set(haupt)) {
    const n = events.filter((e) => e.name === 'BeginMainThreadFrame' && key(e) === t).length;
    if (n > anzahl) {
      anzahl = n;
      bestes = t;
    }
  }
  const beginne = events
    .filter((e) => e.name === 'BeginMainThreadFrame' && key(e) === bestes)
    .map((e) => e.ts)
    .sort((a, b) => a - b);
  if (beginne.length < 11)
    throw new Error(`Ablaufverfolgung: zu wenige Bilder (${String(beginne.length)})`);
  const aufgaben = events.filter((e) => istAufgabe(e) && key(e) === bestes);
  const jeBild: number[] = [];
  for (let i = 0; i + 1 < beginne.length; i++) {
    const a = beginne[i] as number;
    const b = beginne[i + 1] as number;
    const teile: [number, number][] = [];
    for (const t of aufgaben) {
      const von = Math.max(a, t.ts);
      const bis = Math.min(b, t.ts + (t.dur ?? 0));
      if (bis > von) teile.push([von, bis]);
    }
    jeBild.push(vereinigt(teile) / 1000);
  }
  jeBild.sort((x, y) => x - y);
  const p95 = jeBild[Math.ceil(jeBild.length * 0.95) - 1] ?? 0;
  const laengste = aufgaben.reduce((m, t) => Math.max(m, (t.dur ?? 0) / 1000), 0);
  return {
    bilder: jeBild.length,
    p95HauptthreadMs: Math.round(p95 * 100) / 100,
    laengsteAufgabeMs: Math.round(laengste * 100) / 100,
  };
}

test('[R-11-11] F-DOKU: Ziehen im Plan mit 1000 Einträgen während 2 s – p95 der Hauptthread-Zeit je Bild (Ablaufverfolgung) höchstens 16,7 ms und keine Aufgabe über 50 ms (gedrosselt)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto(perfHarnessUrl());
  await messeImBrowser(page, 'fDokuZiehenBildzeit');
  // Aufwärmen ohne Messung, dann ein verfolgter Durchgang von 2 s.
  await withThrottle(page, () => ziehen(page));
  const r = await withThrottle(page, async () =>
    auswerten(await verfolge(page, () => ziehen(page))),
  );
  recordMetric('fDokuZiehenBildzeit', 'R-11-11', r.p95HauptthreadMs, 16.7);
  recordMetric('fDokuZiehenAufgabe', 'R-11-11', r.laengsteAufgabeMs, 50);
  expect(r.bilder, 'Bilder in 2 s').toBeGreaterThanOrEqual(10);
  expect(r.p95HauptthreadMs, 'p95 Hauptthread-Zeit je Bild').toBeLessThanOrEqual(16.7);
  expect(r.laengsteAufgabeMs, 'längste Aufgabe des Hauptthreads').toBeLessThanOrEqual(50);
});

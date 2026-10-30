// F-UX3 (Entwurf, Auftrag Koordinator 21.10.2026: Ziehen und Kante «extrem performant»): Messung im Raster des
// synthetischen Plans (Szene von F-DOKU, 1000 Einträge) – Verschieben und Kante unten je 2 s, ungedrosselt und
// gedrosselt (docs/wap-planer/perf/drosselung.json). Aus der Ablaufverfolgung (CDP Tracing) die Hauptthread-Zeit je
// Bild (Summe der obersten Aufgaben zwischen zwei Bildbeginnen) und die längste Aufgabe; dazu Eingabe-zu-Bild: Zeit vom
// Zeigerereignis bis zum nächsten Bildbeginn (requestAnimationFrame) im Browser. Ziele: p95 ungedrosselt ≤ 8 ms,
// gedrosselt ≤ 16,7 ms, keine Aufgabe > 50 ms, Eingabe-zu-Bild p95 ≤ 1 Bild (gemessener Bildabstand). Entwurf: schreibt die Werte nach
// test-results/wap/f-ux3-bewegung.json und prüft die Ziele; nur auf ruhigem Rechner aussagekräftig. Fiktive Daten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { messeImBrowser, perfHarnessUrl, withThrottle } from '../support/perf';

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly ts: number;
  readonly dur?: number;
  readonly pid: number;
  readonly tid: number;
  readonly args?: { readonly name?: string };
}

type Art = 'verschieben' | 'kante';

interface Messung {
  readonly bilder: number;
  readonly p95: number;
  readonly laengste: number;
}

/** Zieht 2 s lang auf und ab (Mitte: verschieben, 3 px über der Unterkante: Kante) und bricht mit Esc ab. */
async function ziehen(page: Page, art: Art): Promise<void> {
  const ziel = page
    .locator('#wap-perf-ziehen')
    .getByRole('button', { name: /^Block / })
    .first();
  await expect(ziel).toBeVisible();
  const b = await ziel.boundingBox();
  if (b === null) throw new Error('Block ohne Fläche');
  const x = b.x + b.width / 2;
  const y = art === 'verschieben' ? b.y + Math.min(b.height / 2, 10) : b.y + b.height - 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const beginn = Date.now();
  let k = 0;
  while (Date.now() - beginn < 2000) {
    k++;
    await page.mouse.move(x, y + 4 * ((k % 30) - (art === 'verschieben' ? 15 : 0)));
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
}

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

function auswerten(events: readonly TraceEvent[]): Messung {
  const key = (e: TraceEvent) => `${String(e.pid)}:${String(e.tid)}`;
  const haupt = new Set(
    events
      .filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map(key),
  );
  let bestes = '';
  let anzahl = -1;
  for (const t of haupt) {
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
  const aufgaben = events.filter(
    (e) => e.ph === 'X' && typeof e.dur === 'number' && e.name === 'RunTask' && key(e) === bestes,
  );
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
    p95: Math.round(p95 * 100) / 100,
    laengste: Math.round(laengste * 100) / 100,
  };
}

/**
 * Eingabe-zu-Bild im Browser: je Zeigerereignis die Zeit, bis das Zeitschild am Zeiger die neue Lage trägt (Änderung seines
 * `transform`, beobachtet mit MutationObserver) – also bis die Lage für das nächste Bild geschrieben ist; p95 in ms.
 */
async function eingabeZuBild(
  page: Page,
  fn: () => Promise<void>,
): Promise<{ ms: number; bildMs: number; bilder: number }> {
  await page.evaluate(() => {
    const w = window as typeof window & {
      __ux3?: number[];
      __ux3offen?: number | null;
      __ux3an?: boolean;
      __ux3bild?: number[];
      __ux3lauf?: boolean;
    };
    w.__ux3 = [];
    w.__ux3offen = null;
    // Bildabstand während der Messung (Mittelwert der rAF-Abstände; die Seite zeichnet nur bei Änderungen).
    w.__ux3bild = [];
    w.__ux3lauf = true;
    let vorher = -1;
    const takt = (t: number) => {
      if (vorher >= 0) w.__ux3bild?.push(t - vorher);
      vorher = t;
      if (w.__ux3lauf === true) requestAnimationFrame(takt);
    };
    requestAnimationFrame(takt);
    if (w.__ux3an === true) return;
    w.__ux3an = true;
    window.addEventListener(
      'pointermove',
      (e) => {
        if (w.__ux3offen === null || w.__ux3offen === undefined) w.__ux3offen = e.timeStamp;
      },
      { capture: true, passive: true },
    );
    // Runde 3 (Variante B): der angehobene Block rastet ein und ändert seine Lage nur bei einem Rasterwechsel; je Bild
    // folgt das Zeitschild dem Zeiger – es zeigt, wann die Eingabe im Bild ist.
    const lift = document.querySelector('.i2-grid-time-status');
    if (lift === null) return;
    new MutationObserver(() => {
      const t0 = w.__ux3offen;
      if (t0 === null || t0 === undefined) return;
      w.__ux3?.push(performance.now() - t0);
      w.__ux3offen = null;
    }).observe(lift, { attributes: true, attributeFilter: ['style'] });
  });
  await fn();
  const { werte, bild } = await page.evaluate(() => {
    const w = window as typeof window & {
      __ux3?: number[];
      __ux3bild?: number[];
      __ux3lauf?: boolean;
    };
    w.__ux3lauf = false;
    return { werte: w.__ux3 ?? [], bild: w.__ux3bild ?? [] };
  });
  const s = [...werte].sort((a, b) => a - b);
  const b = [...bild].sort((x, y) => x - y);
  const ms = s[Math.ceil(s.length * 0.95) - 1] ?? 0;
  const bildMs = b[Math.floor(b.length / 2)] ?? 16.7;
  return {
    ms: Math.round(ms * 100) / 100,
    bildMs: Math.round(bildMs * 100) / 100,
    bilder: Math.round((ms / bildMs) * 100) / 100,
  };
}

test('[R-5.1-14][R-11-11] F-UX3 (Entwurf): Verschieben und Kante – Hauptthread je Bild, längste Aufgabe, Eingabe-zu-Bild, ungedrosselt und gedrosselt', async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto(perfHarnessUrl());
  await messeImBrowser(page, 'fDokuZiehenBildzeit');
  const ergebnis: Record<
    Art,
    {
      ungedrosselt: Messung;
      gedrosselt: Messung;
      eingabeZuBild: { ms: number; bildMs: number; bilder: number };
    }
  > = {} as never;
  for (const art of ['verschieben', 'kante'] as const) {
    await ziehen(page, art);
    const frei = auswerten(await verfolge(page, () => ziehen(page, art)));
    const latenz = await eingabeZuBild(page, () => ziehen(page, art));
    const gedrosselt = await withThrottle(page, async () => {
      await ziehen(page, art);
      return auswerten(await verfolge(page, () => ziehen(page, art)));
    });
    ergebnis[art] = { ungedrosselt: frei, gedrosselt, eingabeZuBild: latenz };
  }
  const ziel = join(process.cwd(), 'test-results/wap');
  mkdirSync(ziel, { recursive: true });
  writeFileSync(join(ziel, 'f-ux3-bewegung.json'), `${JSON.stringify(ergebnis, null, 2)}\n`);
  for (const art of ['verschieben', 'kante'] as const) {
    const r = ergebnis[art];
    expect(r.ungedrosselt.bilder, `${art}: Bilder`).toBeGreaterThanOrEqual(10);
    expect(r.ungedrosselt.p95, `${art}: p95 ungedrosselt`).toBeLessThanOrEqual(8);
    expect(r.gedrosselt.p95, `${art}: p95 gedrosselt`).toBeLessThanOrEqual(16.7);
    expect(
      Math.max(r.ungedrosselt.laengste, r.gedrosselt.laengste),
      `${art}: längste Aufgabe`,
    ).toBeLessThanOrEqual(50);
    // Eingabe-zu-Bild ≤ 1 Bild: p95 der Zeit bis zur geschriebenen Lage höchstens ein Bildabstand.
    expect(r.eingabeZuBild.bilder, `${art}: Eingabe-zu-Bild in Bildern`).toBeLessThanOrEqual(1);
  }
});

/**
 * Überfahren (F-UX3 Stufe 3, Leistungsbudget auch für Hover): 2 s lang ohne Drücken über das Raster der Szene, quer
 * über Tage und Blöcke (Wechsel von Eintrag und Zone, dazwischen Bewegungen in derselben Zone).
 */
async function ueberfahren(page: Page): Promise<void> {
  const flaeche = await page.locator('#wap-perf-ziehen').boundingBox();
  if (flaeche === null) throw new Error('Szene ohne Fläche');
  const y0 = flaeche.y + Math.min(200, flaeche.height / 3);
  const beginn = Date.now();
  let k = 0;
  while (Date.now() - beginn < 2000) {
    k++;
    const x = flaeche.x + 40 + ((k * 7) % Math.max(1, flaeche.width - 80));
    await page.mouse.move(x, y0 + 3 * (k % 40));
  }
}

test('[R-11-11] F-UX3 (Entwurf): Überfahren ohne Drücken – Hauptthread je Bild und längste Aufgabe, ungedrosselt und gedrosselt', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto(perfHarnessUrl());
  await messeImBrowser(page, 'fDokuZiehenBildzeit');
  await ueberfahren(page);
  const frei = auswerten(await verfolge(page, () => ueberfahren(page)));
  const gedrosselt = await withThrottle(page, async () => {
    await ueberfahren(page);
    return auswerten(await verfolge(page, () => ueberfahren(page)));
  });
  const ziel = join(process.cwd(), 'test-results/wap');
  mkdirSync(ziel, { recursive: true });
  writeFileSync(
    join(ziel, 'f-ux3-ueberfahren.json'),
    `${JSON.stringify({ ungedrosselt: frei, gedrosselt }, null, 2)}\n`,
  );
  expect(frei.bilder, 'Bilder').toBeGreaterThanOrEqual(10);
  expect(frei.p95, 'p95 ungedrosselt').toBeLessThanOrEqual(8);
  expect(gedrosselt.p95, 'p95 gedrosselt').toBeLessThanOrEqual(16.7);
  expect(Math.max(frei.laengste, gedrosselt.laengste), 'längste Aufgabe').toBeLessThanOrEqual(50);
});

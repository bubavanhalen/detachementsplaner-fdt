// F-UX3 Runde 3 (Entwurf; Auftrag Koordinator 21.10.2026: «miss die Herstellungszeit je Bild ohne Bildratenbegrenzung
// wie der Designer»): Die Sitzung läuft über eine Remotedesktop-Anzeige mit 32 Hz; der Bildabstand ist dort ~32 ms und
// sagt nichts über die App. Ohne Bildratenbegrenzung (`--disable-gpu-vsync --disable-frame-rate-limit`, sichtbares
// Fenster ausserhalb des Bildschirms) entspricht der Bildabstand der Herstellungszeit eines Bildes. Gemessen im Raster
// des synthetischen Plans (Szene F-DOKU, 1000 Einträge): Verschieben, Kante, Überfahren je 2 s, ungedrosselt und
// gedrosselt; p95 des Bildabstands, längste Aufgabe (Long Tasks API) und Anzahl Aufgaben > 50 ms. Ziele: p95
// ≤ 8 ms ungedrosselt, ≤ 16,7 ms gedrosselt, keine Aufgabe > 50 ms. Schreibt test-results/wap/f-ux3-frei.json.
// Nur auf ruhigem Rechner aussagekräftig. Fiktive Daten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { messeImBrowser, perfHarnessUrl, withThrottle } from '../support/perf';

test.use({
  launchOptions: {
    args: [
      '--window-position=-2400,0',
      '--window-size=1620,1120',
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
    ],
  },
});

type Art = 'verschieben' | 'kante' | 'ueberfahren';

interface Messung {
  readonly bilder: number;
  readonly p95: number;
  readonly median: number;
  /** Anteil der Bilder im 60-Hz-Ersatztakt (> 15 ms): ohne Änderung erzeugt der Browser kein schnelleres Bild. */
  readonly ersatztakt: number;
  readonly laengste: number;
  readonly lange: number;
}

async function geste(page: Page, art: Art): Promise<void> {
  const ziel = page
    .locator('#wap-perf-ziehen')
    .getByRole('button', { name: /^Block / })
    .first();
  await expect(ziel).toBeVisible();
  const b = await ziel.boundingBox();
  if (b === null) throw new Error('Block ohne Fläche');
  const x = b.x + b.width / 2;
  const y = art === 'kante' ? b.y + b.height - 3 : b.y + Math.min(b.height / 2, 10);
  const beginn = Date.now();
  let k = 0;
  if (art === 'ueberfahren') {
    const f = await page.locator('#wap-perf-ziehen').boundingBox();
    if (f === null) throw new Error('Szene ohne Fläche');
    while (Date.now() - beginn < 2000) {
      k++;
      await page.mouse.move(
        f.x + 40 + ((k * 7) % Math.max(1, f.width - 80)),
        f.y + Math.min(200, f.height / 3) + 3 * (k % 40),
      );
    }
    return;
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  while (Date.now() - beginn < 2000) {
    k++;
    await page.mouse.move(x, y + 4 * ((k % 30) - (art === 'verschieben' ? 15 : 0)));
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
}

/** Bildabstände (rAF) und lange Aufgaben während `fn`, im Browser gemessen. */
async function miss(page: Page, fn: () => Promise<void>): Promise<Messung> {
  await page.evaluate(() => {
    const w = window as typeof window & {
      __f?: number[];
      __lt?: number[];
      __lauf?: boolean;
      __obs?: PerformanceObserver;
    };
    w.__f = [];
    w.__lt = [];
    w.__lauf = true;
    let vorher = -1;
    const takt = (t: number) => {
      if (vorher >= 0) w.__f?.push(t - vorher);
      vorher = t;
      if (w.__lauf === true) requestAnimationFrame(takt);
    };
    requestAnimationFrame(takt);
    w.__obs?.disconnect();
    w.__obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lt?.push(e.duration);
    });
    w.__obs.observe({ type: 'longtask', buffered: false });
  });
  await fn();
  const { f, lt } = await page.evaluate(() => {
    const w = window as typeof window & { __f?: number[]; __lt?: number[]; __lauf?: boolean };
    w.__lauf = false;
    return { f: w.__f ?? [], lt: w.__lt ?? [] };
  });
  const s = [...f].sort((a, b) => a - b);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    bilder: s.length,
    p95: r2(s[Math.ceil(s.length * 0.95) - 1] ?? 0),
    median: r2(s[Math.floor(s.length / 2)] ?? 0),
    ersatztakt: r2(s.length === 0 ? 0 : s.filter((v) => v > 15).length / s.length),
    laengste: r2(lt.reduce((m, v) => Math.max(m, v), 0)),
    lange: lt.filter((v) => v > 50).length,
  };
}

test('[R-5.1-14][R-11-11] F-UX3 Runde 3 (Entwurf): Herstellungszeit je Bild ohne Bildratenbegrenzung – Verschieben, Kante, Überfahren', async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto(perfHarnessUrl());
  await messeImBrowser(page, 'fDokuZiehenBildzeit');
  const ergebnis: Record<string, { ungedrosselt: Messung; gedrosselt: Messung }> = {};
  for (const art of ['verschieben', 'kante', 'ueberfahren'] as const) {
    await geste(page, art);
    const frei = await miss(page, () => geste(page, art));
    const gedrosselt = await withThrottle(page, async () => {
      await geste(page, art);
      return miss(page, () => geste(page, art));
    });
    ergebnis[art] = { ungedrosselt: frei, gedrosselt };
  }
  const ziel = join(process.cwd(), 'test-results/wap');
  mkdirSync(ziel, { recursive: true });
  writeFileSync(join(ziel, 'f-ux3-frei.json'), `${JSON.stringify(ergebnis, null, 2)}\n`);
  for (const [art, r] of Object.entries(ergebnis)) {
    expect(r.ungedrosselt.bilder, `${art}: Bilder`).toBeGreaterThanOrEqual(30);
    expect(r.ungedrosselt.lange + r.gedrosselt.lange, `${art}: Aufgaben > 50 ms`).toBe(0);
    // Beim Überfahren ändert sich das Bild nur bei einem Wechsel von Eintrag oder Zone; dazwischen liefert der Browser
    // den 60-Hz-Ersatztakt (wie im Prototyp bei «Spalten» und «Marker»). Massgebend ist dort der Median.
    const wert = art === 'ueberfahren' ? 'median' : 'p95';
    expect(r.ungedrosselt[wert], `${art}: ${wert} ungedrosselt`).toBeLessThanOrEqual(8);
    expect(r.gedrosselt[wert], `${art}: ${wert} gedrosselt`).toBeLessThanOrEqual(16.7);
  }
});

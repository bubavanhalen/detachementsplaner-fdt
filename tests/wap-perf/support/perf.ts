// Leistungs-Hilfen (Paket E1-01c, R-H-22, ADR-010 §8).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2 «Leistung» (Grundlage E1-01 §4, §6, §9 Nr 2).
// CDP-Drosselung, Messungen aus dem Browser und atomare Messdatei mit den gesperrten Budgets.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { ANFORDERUNG, NAME, pruefeBudget, pruefeBudgets } from './budgets.mjs';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Setzt die CPU-Drosselung (Faktor aus drosselung.json, sonst Fehler), führt fn aus, hebt sie wieder auf. */
export async function withThrottle<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  let faktor: number;
  try {
    const d = JSON.parse(
      readFileSync(join(process.cwd(), 'docs/wap-planer/perf/drosselung.json'), 'utf8'),
    );
    if (
      d.status !== 'festgelegt' ||
      typeof d.faktor !== 'number' ||
      !Number.isFinite(d.faktor) ||
      d.faktor < 1
    )
      throw new Error();
    faktor = d.faktor;
  } catch {
    throw new Error('Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)');
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: faktor });
    return await fn();
  } finally {
    try {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    } finally {
      await cdp.detach();
    }
  }
}

/** Ein Aufwärmlauf (verworfen), dann fünf Läufe; Median über die fünf. */
export async function medianOf5(
  run: () => Promise<number>,
): Promise<{ median: number; laeufe: number[] }> {
  const laeufe: number[] = [];
  for (let i = 0; i < 6; i++) {
    const wert = await run();
    if (!Number.isFinite(wert)) throw new Error('medianOf5: ungültiger Messwert');
    if (i > 0) laeufe.push(wert);
  }
  return { median: [...laeufe].sort((a, b) => a - b)[2] as number, laeufe };
}

/** Schreibt bzw. ergänzt <cwd>/test-results/wap/perf.json (Format Vertrag E1-01 §9 Nr 2). */
export function recordMetric(
  name: string,
  anforderung: string,
  medianMs: number,
  budgetMs: number,
): void {
  if (
    !NAME.test(name) ||
    !ANFORDERUNG.test(anforderung) ||
    !Number.isFinite(medianMs) ||
    medianMs < 0 ||
    !Number.isFinite(budgetMs) ||
    budgetMs <= 0
  )
    throw new Error(`Leistungseintrag ungültig: ${name}`);
  pruefeBudget(
    pruefeBudgets(
      JSON.parse(readFileSync(join(WURZEL, 'docs/wap-planer/perf/budgets.json'), 'utf8')),
    ),
    name,
    anforderung,
    budgetMs,
  );
  const datei = join(process.cwd(), 'test-results/wap/perf.json');
  const daten = existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : { messwerte: {} };
  if (
    typeof daten.messwerte !== 'object' ||
    daten.messwerte === null ||
    Array.isArray(daten.messwerte)
  )
    throw new Error('perf.json ungültig');
  daten.messwerte[name] = { medianMs, budgetMs, anforderung };
  mkdirSync(dirname(datei), { recursive: true });
  const temp = `${datei}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(daten, null, 2)}\n`, 'utf8');
  renameSync(temp, datei);
}

/** Bildzeiten während drag(); p95 der Bildzeiten und längste Aufgabe (Long Tasks) in ms. */
export async function dragFrameStats(
  page: Page,
  drag: () => Promise<void>,
  dauerMs: 2000,
): Promise<{ p95FrameMs: number; laengsteAufgabeMs: number }> {
  await page.evaluate(() => {
    const zustand = {
      bilder: [] as number[],
      aufgabe: 0,
      beginn: performance.now(),
      zuletzt: null as number | null,
      aktiv: true,
      observer: null as PerformanceObserver | null,
    };
    (globalThis as typeof globalThis & { __wapDrag?: typeof zustand }).__wapDrag = zustand;
    const bild = (zeit: number) => {
      if (!zustand.aktiv) return;
      if (zustand.zuletzt !== null) zustand.bilder.push(zeit - zustand.zuletzt);
      zustand.zuletzt = zeit;
      requestAnimationFrame(bild);
    };
    zustand.observer = new PerformanceObserver((liste) => {
      for (const e of liste.getEntries()) zustand.aufgabe = Math.max(zustand.aufgabe, e.duration);
    });
    zustand.observer.observe({ type: 'longtask', buffered: false });
    requestAnimationFrame(bild);
  });
  try {
    await drag();
    return await page.evaluate(async (dauer) => {
      const z = (
        globalThis as typeof globalThis & {
          __wapDrag?: {
            bilder: number[];
            aufgabe: number;
            beginn: number;
            aktiv: boolean;
            observer: PerformanceObserver;
          };
        }
      ).__wapDrag;
      if (!z) throw new Error('dragFrameStats: zu wenige Bilder (0)');
      await new Promise((r) => setTimeout(r, Math.max(0, dauer - (performance.now() - z.beginn))));
      z.aktiv = false;
      for (const e of z.observer.takeRecords()) z.aufgabe = Math.max(z.aufgabe, e.duration);
      z.observer.disconnect();
      if (z.bilder.length < 10)
        throw new Error(`dragFrameStats: zu wenige Bilder (${z.bilder.length})`);
      z.bilder.sort((a, b) => a - b);
      return {
        p95FrameMs: Math.round((z.bilder[Math.ceil(z.bilder.length * 0.95) - 1] ?? 0) * 100) / 100,
        laengsteAufgabeMs: z.aufgabe,
      };
    }, dauerMs);
  } finally {
    await page.evaluate(() => {
      const g = globalThis as typeof globalThis & {
        __wapDrag?: { aktiv: boolean; observer: PerformanceObserver };
      };
      if (g.__wapDrag) {
        g.__wapDrag.aktiv = false;
        g.__wapDrag.observer.disconnect();
        delete g.__wapDrag;
      }
    });
  }
}

/** file://-URL der gebauten Leistungs-Harness test-results/wap/perf-harness/index.html; wirft, wenn sie fehlt. */
export function perfHarnessUrl(): string {
  const datei = join(WURZEL, 'test-results/wap/perf-harness/index.html');
  if (!existsSync(datei))
    throw new Error(
      'Leistungs-Harness fehlt: test-results/wap/perf-harness/index.html. Nächster Schritt: npm run wap:test:perf',
    );
  return pathToFileURL(datei).href;
}

/** Misst einen Harness-Eintrag in der geladenen Harness-Seite (Startwert 20260928); Dauer in ms. */
export async function messeImBrowser(page: Page, name: string): Promise<number> {
  try {
    await page.waitForFunction(
      () => ['bereit', 'fehler'].includes(document.documentElement.dataset.wapPerf ?? ''),
      undefined,
      { timeout: 10_000 },
    );
  } catch {
    throw new Error('Leistungs-Harness nicht bereit');
  }
  const ergebnis = await page.evaluate(async (n) => {
    if (document.documentElement.dataset.wapPerf === 'fehler')
      return { fehler: 'Leistungs-Harness: Eintragsdatei fehlerhaft' };
    try {
      const bridge = (
        globalThis as typeof globalThis & {
          __wapPerf?: { messe(name: string, seed: number): Promise<number> };
        }
      ).__wapPerf;
      if (!bridge) return { fehler: 'Leistungs-Harness nicht bereit' };
      return { wert: await bridge.messe(n, 20260928) };
    } catch (e) {
      return { fehler: e instanceof Error ? e.message : String(e) };
    }
  }, name);
  if ('fehler' in ergebnis) throw new Error(ergebnis.fehler);
  return ergebnis.wert;
}

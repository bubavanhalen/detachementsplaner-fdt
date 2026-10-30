// @vitest-environment node
// F-IMPORT2 (R-11-17, Beschrieb 11 «Import einer Referenzdatei unter 15 s»; Befund HT-05; Entscheid des
// Orchestrators vom 19.10.2026: Messung im Entwicklungsserver statt in der Einzeldatei der Leistungs-Harness).
// Die echte Kp-Mappe wird lokal in den Entwicklungsserver dieses Worktrees geladen und über die Dateiauswahl der
// Seite /wap importiert (ganzer Ablauf runImport mit Stand und Speichern bis zum Importbericht, ADR-008
// «Leistung»), CPU gedrosselt nach docs/wap-planer/perf/drosselung.json; ein Aufwärmlauf, dann Median aus fünf
// Läufen (ADR-010 §8), je Lauf ein frischer Browserkontext ohne gespeicherte Daten. Die Mappe verlässt den
// Rechner nicht: Server und Browser laufen auf 127.0.0.1, jede andere Anfrage macht den Test rot. Meldungen
// nur mit Zahlen (agent-regeln 3).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const DIR = process.env.WAP_REFERENCE_DIR ?? '';
const XLSX = join(DIR, '01_02_WAP_FDT_2026.xlsx');
const BUDGET_MS = 15_000;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let server: ViteDevServer | null = null;
let browser: Browser | null = null;
let cache = '';
let base = '';

/** Drosselungsfaktor aus der gesperrten Messvorgabe; ohne festgelegten Faktor ist der Test rot. */
function factor(): number {
  const d: unknown = JSON.parse(
    readFileSync(join(ROOT, 'docs/wap-planer/perf/drosselung.json'), 'utf8'),
  );
  const f = typeof d === 'object' && d !== null && 'faktor' in d && 'status' in d ? d : null;
  if (f === null || f.status !== 'festgelegt' || typeof f.faktor !== 'number' || f.faktor < 1)
    throw new Error('Drosselungsfaktor nicht festgelegt');
  return f.faktor;
}

beforeAll(async () => {
  expect(existsSync(XLSX), 'Referenzmappe vorhanden (WAP_REFERENCE_DIR)').toBe(true);
  cache = mkdtempSync(join(tmpdir(), 'wap-importdauer-'));
  server = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    cacheDir: cache,
    logLevel: 'silent',
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error('Entwicklungsserver ohne Adresse');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch({ headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache !== '') rmSync(cache, { recursive: true, force: true });
});

/** Ein Import in einem frischen Kontext; Dauer von der Dateiwahl bis zum sichtbaren Importbericht. */
async function oneRun(bytes: Buffer, rate: number, fremd: string[]): Promise<number> {
  if (browser === null) throw new Error('Browser fehlt');
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    serviceWorkers: 'block',
  });
  try {
    const page: Page = await context.newPage();
    const origin = new URL(base).origin;
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'))
        fremd.push(new URL(u).protocol);
    });
    await page.goto(`${base}/#/wap`);
    const button = page.getByRole('button', { name: 'Excel-WAP importieren', exact: true });
    await button.waitFor({ state: 'visible', timeout: 60_000 });
    const input = page.locator('input[type="file"][aria-label="Excel-WAP importieren"]');
    const report = page.getByRole('heading', { name: 'Importbericht «referenz.xlsx»' });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    try {
      const start = performance.now();
      await input.setInputFiles({ name: 'referenz.xlsx', mimeType: XLSX_MIME, buffer: bytes });
      await report.waitFor({ state: 'visible', timeout: 120_000 });
      return performance.now() - start;
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
    }
  } finally {
    await context.close();
  }
}

it('[R-11-17] Import der Kp-Referenzmappe höchstens 15 s (Median aus fünf Läufen nach einem Aufwärmlauf, gedrosselt, Entwicklungsserver, ohne Netzanfragen)', async () => {
  const bytes = readFileSync(XLSX);
  const rate = factor();
  const fremd: string[] = [];
  const laeufe: number[] = [];
  for (let i = 0; i < 6; i++) {
    const ms = await oneRun(bytes, rate, fremd);
    if (i > 0) laeufe.push(Math.round(ms));
  }
  const median = [...laeufe].sort((a, b) => a - b)[2] ?? Number.POSITIVE_INFINITY;
  expect(fremd, 'Anfragen ausserhalb des lokalen Entwicklungsservers').toEqual([]);
  expect(
    median,
    `Import gedrosselt ×${String(rate)}: Läufe ${laeufe.join(', ')} ms`,
  ).toBeLessThanOrEqual(BUDGET_MS);
}, 600_000);

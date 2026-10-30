// Playwright-Konfiguration der WAP-E2E-Tests (Paket E1-01b, R-H-11, R-H-18, R-H-27; ADR-010 §3.2 V4,
// §3.4 «keine Wiederholung», §10). Start nur über npm run wap:test:e2e (scripts/wap-gate/e2e.mjs): Der
// Läufer setzt WAP_E2E_PORT (freier Port) und startet mit --workers=2.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 «playwright.wap.config.ts», Notiz Runde 2 Nr 2, 9 und
// Änderungsnotiz Code-Review Runde 1 Nr 2 (Vite mit tests/wap-e2e/support/vite-e2e.config.ts).
// Projekte: edge (Kanal msedge, Vite-Entwicklungsserver) und edge-dist (Einzeldateien unter
// test-results/wap/einzeldatei/, file://). E1-01c ergänzt Projekte. Ohne WAP_E2E_PORT (z.B. --list in F9)
// entfallen webServer und baseURL.
import type { PlaywrightTestConfig } from '@playwright/test';
import { pruefeNode } from './scripts/wap-gate/lib/vitest-pruefung.mjs';

// Node-Prüfung beim Laden (R-H-27, F-001): bricht unter einer falschen Node-Version mit Hinweis ab.
pruefeNode();

const portWert = process.env.WAP_E2E_PORT ?? '';
const port = /^\d+$/.test(portWert) ? Number(portWert) : null;
const bericht = process.env.WAP_PLAYWRIGHT_BERICHT ?? 'test-results/wap/playwright.json';
if (
  !bericht.startsWith('test-results/wap/') ||
  !bericht.endsWith('.json') ||
  bericht.includes('..') ||
  bericht.includes('\\') ||
  !/^test-results\/wap\/[A-Za-z0-9_./-]+\.json$/.test(bericht)
)
  throw new Error('WAP_PLAYWRIGHT_BERICHT ungültig');

/** Gemeinsame Browser-Einstellungen beider Edge-Projekte (Gate-0-Entscheid E4 b: funktionale E2E in Edge). */
const edge = {
  browserName: 'chromium',
  channel: 'msedge',
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
} as const;

/** Markierung der zeitkritischen E2E-Tests (Bildzeit, Bildtakt, Autoscroll; F-FLAKY3). */
const ZEITKRITISCH = /@zeitkritisch/;

const config: PlaywrightTestConfig = {
  testDir: 'tests/wap-e2e',
  // F-FLAKY (FL-04): lädt jede Harness-Seite des Entwicklungsservers einmal vor dem ersten Test (ohne Port: entfällt).
  globalSetup: './tests/wap-e2e/support/aufwaermen.ts',
  retries: 0,
  updateSnapshots: 'none',
  expect: { toHaveScreenshot: { threshold: 0 } },
  forbidOnly: true,
  workers: 2,
  fullyParallel: false,
  outputDir: 'test-results/wap/playwright-ausgabe',
  reporter: [['json', { outputFile: bericht }]],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  },
  projects: [
    // F-FLAKY3: zeitkritische Tests (Markierung @zeitkritisch) laufen exklusiv. Der Auftakt hat keine Tests; edge und
    // edge-dist hängen von ihm ab, und sein «teardown» edge-zeit läuft erst, wenn beide fertig sind – anders als bei
    // «dependencies» auch dann, wenn dort Tests rot sind. edge-zeit nutzt einen Worker, damit kein paralleler Worker die
    // CPU während der Messung belastet (Einzeldatei-Tests öffnen file://, die übrigen die baseURL).
    {
      name: 'zeit-auftakt',
      retries: 0,
      testMatch: /(?!)/,
      teardown: 'edge-zeit',
    },
    {
      name: 'edge',
      retries: 0,
      testMatch: /\.spec\.ts$/,
      testIgnore: [/\.dist\.spec\.ts$/, /\.visual\.spec\.ts$/],
      grepInvert: ZEITKRITISCH,
      dependencies: ['zeit-auftakt'],
      use: { ...edge, ...(port === null ? {} : { baseURL: `http://127.0.0.1:${String(port)}` }) },
    },
    {
      name: 'edge-dist',
      retries: 0,
      testMatch: /\.dist\.spec\.ts$/,
      grepInvert: ZEITKRITISCH,
      dependencies: ['zeit-auftakt'],
      use: { ...edge },
    },
    {
      name: 'edge-zeit',
      retries: 0,
      testMatch: /\.spec\.ts$/,
      testIgnore: /\.visual\.spec\.ts$/,
      grep: ZEITKRITISCH,
      workers: 1,
      use: { ...edge, ...(port === null ? {} : { baseURL: `http://127.0.0.1:${String(port)}` }) },
    },
    {
      name: 'chromium-visual',
      retries: 0,
      testMatch: /\.visual\.spec\.ts$/,
      snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
      use: {
        browserName: 'chromium',
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 1,
        ...(port === null ? {} : { baseURL: `http://127.0.0.1:${String(port)}` }),
      },
    },
    {
      name: 'perf',
      retries: 0,
      testDir: 'tests/wap-perf',
      testMatch: /\.perf\.ts$/,
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 1,
      },
    },
  ],
  ...(port === null
    ? {}
    : {
        webServer: {
          // Server-Hülle mit eigenem Vite-Cache je Lauf (WAP_VITE_CACHE_DIR; Vertrag E1-01b Notiz Code-Review
          // Runde 1 Nr 2 und Änderungsnotiz Stabilität Nr 4). runE2e startet die Hülle selbst und meldet ihre
          // Bereitschaft per IPC; Playwright findet den Server bereit vor (reuseExistingServer, auch mit CI) und
          // startet oder beendet nichts. Nur bei direktem Aufruf von Playwright startet es die Hülle als Rückfall.
          command: `node scripts/wap-gate/lib/vite-server.mjs --config tests/wap-e2e/support/vite-e2e.config.ts --port ${String(port)} --strictPort --host 127.0.0.1`,
          url: `http://127.0.0.1:${String(port)}/@vite/client`,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      }),
};

export default config;

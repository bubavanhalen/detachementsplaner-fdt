// Playwright-Konfiguration ab E1-01b (ADR-010 §3.2 V4, §3.4 «keine Wiederholung»; Vertrag E1-01 AE-001 §3
// Restteil «Playwright-Konfiguration ohne Wiederholung, Node-Prüfung» [R-H-11][R-H-18][R-H-27]):
// playwright.wap.config.ts mit retries 0 (auch je Projekt), forbidOnly, 2 Workern, JSON-Bericht, Projekten
// edge (msedge) und edge-dist, Testauswahl je Projekt, webServer und baseURL nur mit WAP_E2E_PORT.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 «playwright.wap.config.ts» (E1-01c ergänzt Projekte,
// deshalb nur «enthält»). Übernommen aus config-spaeter.gate.entwurf.ts, Teil E1-01b (Vertrag E1-01b §3).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  WT,
  writeText,
} from './support/umgebung';
import { playwrightTests } from './support/vertrag-b';

afterEach(aufraeumen);

type Objekt = Record<string, unknown>;

const KONFIG = 'playwright.wap.config.ts';

/** Lädt playwright.wap.config.ts frisch (die Datei liest WAP_E2E_PORT beim Laden). */
async function ladeKonfig(port: string | undefined): Promise<Objekt> {
  const datei = join(WT, KONFIG);
  expect(existsSync(datei), `Konfiguration fehlt: ${KONFIG}`).toBe(true);
  vi.stubEnv('WAP_E2E_PORT', port);
  vi.resetModules();
  const mod = (await import(pathToFileURL(datei).href)) as { default: unknown };
  return mod.default as Objekt;
}

function projekte(k: Objekt): Objekt[] {
  return (Array.isArray(k.projects) ? k.projects : []) as Objekt[];
}

function projekt(k: Objekt, name: string): Objekt {
  const p = projekte(k).find((x) => x.name === name);
  expect(p, `Projekt ${name} fehlt`).toBeDefined();
  return p as Objekt;
}

/** Wirksame use-Optionen eines Projekts (global, vom Projekt überschrieben). */
function wirksam(k: Objekt, p: Objekt): Objekt {
  return { ...((k.use ?? {}) as Objekt), ...((p.use ?? {}) as Objekt) };
}

describe('playwright.wap.config.ts: statische Werte', () => {
  it('[R-H-11][R-H-18][R-H-27] retries 0 global und in jedem Projekt, forbidOnly true, workers 2, testDir tests/wap-e2e', async () => {
    const k = await ladeKonfig(undefined);
    expect(k.retries).toBe(0);
    expect(k.forbidOnly).toBe(true);
    expect(k.workers).toBe(2);
    expect(resolve(WT, String(k.testDir))).toBe(join(WT, 'tests', 'wap-e2e'));
    expect(projekte(k).length).toBeGreaterThan(0);
    for (const p of projekte(k)) expect(p.retries ?? 0, String(p.name)).toBe(0);
  });

  it('[R-H-11][R-H-18][R-H-27] JSON-Bericht nach test-results/wap/playwright.json; outputDir test-results/wap/playwright-ausgabe; trace, screenshot, video ausdrücklich off', async () => {
    const k = await ladeKonfig(undefined);
    const reporter = (Array.isArray(k.reporter) ? k.reporter : []) as unknown[];
    const json = reporter.find((r) => Array.isArray(r) && r[0] === 'json') as
      | [string, { outputFile?: string }]
      | undefined;
    expect(json, 'JSON-Reporter fehlt').toBeDefined();
    expect(resolve(WT, json?.[1]?.outputFile ?? '')).toBe(
      join(WT, 'test-results', 'wap', 'playwright.json'),
    );
    // Notiz Runde 2 Nr 2: Playwright leert nur diesen Ordner; Berichte und PDF unter test-results/wap bleiben.
    expect(resolve(WT, String(k.outputDir ?? ''))).toBe(
      join(WT, 'test-results', 'wap', 'playwright-ausgabe'),
    );
    for (const p of projekte(k)) {
      expect(p.outputDir ?? null, `${String(p.name)}: eigenes outputDir`).toBeNull();
    }
    // Notiz Runde 2 Nr 9 e: ausdrücklich 'off', nicht der Standard von Playwright.
    for (const p of projekte(k)) {
      const w = wirksam(k, p);
      for (const o of ['trace', 'screenshot', 'video'] as const) {
        expect(w[o], `${String(p.name)}: ${o}`).toBe('off');
      }
    }
  });

  it('[R-H-11][R-H-18][R-H-27] Projekte edge und edge-dist: Kanal msedge, 1600×1000, Skalierung 1, de-CH, Europe/Zurich', async () => {
    const k = await ladeKonfig(undefined);
    for (const name of ['edge', 'edge-dist']) {
      const w = wirksam(k, projekt(k, name));
      expect(w.channel, name).toBe('msedge');
      expect(w.viewport, name).toEqual({ width: 1600, height: 1000 });
      expect(w.deviceScaleFactor, name).toBe(1);
      expect(w.locale, name).toBe('de-CH');
      expect(w.timezoneId, name).toBe('Europe/Zurich');
    }
  });

  it('[R-H-11][R-H-18][R-H-27] ohne WAP_E2E_PORT: kein webServer, keine baseURL', async () => {
    const k = await ladeKonfig(undefined);
    expect(k.webServer ?? null).toBeNull();
    for (const p of projekte(k)) {
      expect(wirksam(k, p).baseURL ?? null, String(p.name)).toBeNull();
    }
  });

  it('[R-H-11][R-H-18][R-H-27] mit WAP_E2E_PORT: webServer-Befehl startet Vite mit --strictPort --host 127.0.0.1 auf dem Port; edge mit baseURL http://127.0.0.1:<port>, edge-dist ohne baseURL', async () => {
    const k = await ladeKonfig('43219');
    const ws = (Array.isArray(k.webServer) ? k.webServer[0] : k.webServer) as Objekt | undefined;
    expect(ws, 'webServer fehlt').toBeDefined();
    const befehl = String(ws?.command ?? '');
    expect(befehl).toMatch(/vite/);
    expect(befehl).toContain('43219');
    // Notiz Runde 2 Nr 9 d: ausdrücklich im Befehl, nicht über vite.config.ts (Suite-Datei).
    expect(befehl.split(/\s+/)).toContain('--strictPort');
    expect(befehl).toMatch(/--host[\s=]127\.0\.0\.1(?![\d.])/);
    expect(
      ws?.port === 43219 || String(ws?.url ?? '').includes(':43219'),
      'webServer ohne Port',
    ).toBe(true);
    expect(wirksam(k, projekt(k, 'edge')).baseURL).toBe('http://127.0.0.1:43219');
    expect(wirksam(k, projekt(k, 'edge-dist')).baseURL ?? null).toBeNull();
  });
});

describe('playwright.wap.config.ts: Testauswahl je Projekt (Liste von Playwright)', () => {
  it(
    '[R-H-11][R-H-18][R-H-27] edge: *.spec.ts ohne *.dist.spec.ts und *.visual.spec.ts; edge-dist: nur *.dist.spec.ts',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      expect(existsSync(join(k.root, KONFIG)), `Konfiguration fehlt: ${KONFIG}`).toBe(true);
      const probe = (n: string) =>
        `import { expect, test } from '@playwright/test';\n\ntest('[R-H-11] ${n}', () => {\n  expect(1).toBe(1);\n});\n`;
      writeText(k.root, 'tests/wap-e2e/zz-auswahl.spec.ts', probe('auswahl normal'));
      writeText(k.root, 'tests/wap-e2e/zz-auswahl.dist.spec.ts', probe('auswahl dist'));
      writeText(k.root, 'tests/wap-e2e/zz-auswahl.visual.spec.ts', probe('auswahl visual'));
      const liste = join(sb.base, 'liste.json');
      const r = lauf(
        process.execPath,
        [
          join(k.root, 'node_modules', '@playwright', 'test', 'cli.js'),
          'test',
          '-c',
          KONFIG,
          '--list',
          '--reporter=json',
          '--project=edge',
          '--project=edge-dist',
        ],
        { cwd: k.root, env: { ...sb.env, PLAYWRIGHT_JSON_OUTPUT_NAME: liste }, timeout: MITTEL },
      );
      expect(r.status, r.out).toBe(0);
      const tests = playwrightTests(liste);
      const projekteVon = (titel: string) =>
        tests
          .filter((t) => t.titel.endsWith(titel))
          .map((t) => t.projekt)
          .sort();
      expect(projekteVon('auswahl normal')).toEqual(['edge']);
      expect(projekteVon('auswahl dist')).toEqual(['edge-dist']);
      expect(projekteVon('auswahl visual')).toEqual([]);
    },
    MITTEL,
  );
});

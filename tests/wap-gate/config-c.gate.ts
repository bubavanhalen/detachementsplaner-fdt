// Playwright-Konfiguration ab E1-01c (ADR-010 §3.2 V6/V7, §3.4 «keine Wiederholung», §7.3, §8; Entscheid E4 b):
// Projekte chromium-visual (Bildschirm-Regression) und perf (Leistung) im Playwright-Chromium, global
// updateSnapshots 'none', retries 0 in jedem Projekt, Bericht über WAP_PLAYWRIGHT_BERICHT (nur relativ unter
// test-results/wap/, Endung .json).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.1 «playwright.wap.config.ts», §3 (config-c.gate.ts).
// Die Konfiguration wird je Fall frisch geladen (sie liest WAP_E2E_PORT und WAP_PLAYWRIGHT_BERICHT beim Laden);
// die Testauswahl prüft die Liste von Playwright in einem Klon (ohne Browser). Nur fiktive Spezifikationen.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  MITTEL,
  neueSandbox,
  WT,
  writeText,
} from './support/umgebung';
import { playwrightListe } from './support/vertrag-c';

afterEach(aufraeumen);

type Objekt = Record<string, unknown>;

const KONFIG = 'playwright.wap.config.ts';
const KONFIG_URL = pathToFileURL(join(WT, KONFIG)).href;

/** Lädt playwright.wap.config.ts frisch mit den angegebenen Umgebungswerten. */
async function ladeKonfig(env: { port?: string; bericht?: string } = {}): Promise<Objekt> {
  expect(existsSync(join(WT, KONFIG)), `Konfiguration fehlt: ${KONFIG}`).toBe(true);
  vi.stubEnv('WAP_E2E_PORT', env.port);
  vi.stubEnv('WAP_PLAYWRIGHT_BERICHT', env.bericht);
  vi.resetModules();
  const mod = (await import(KONFIG_URL)) as { default: unknown };
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

/** Prüft ein testMatch (RegExp, Glob-Text oder Liste) gegen einen Dateinamen, wie Playwright es auswertet. */
function trifft(muster: unknown, datei: string): boolean {
  const liste = Array.isArray(muster) ? muster : [muster];
  return liste.some((m) => (m instanceof RegExp ? m.test(datei) : false));
}

/** Pfad des JSON-Berichts aus der Konfiguration (absolut, relativ zum Worktree aufgelöst). */
function berichtPfad(k: Objekt): string {
  const reporter = (Array.isArray(k.reporter) ? k.reporter : []) as unknown[];
  const json = reporter.find((r) => Array.isArray(r) && r[0] === 'json') as
    | [string, { outputFile?: string }]
    | undefined;
  expect(json, 'JSON-Reporter fehlt').toBeDefined();
  return resolve(WT, json?.[1]?.outputFile ?? '');
}

describe('playwright.wap.config.ts: Projekt chromium-visual (R-H-21)', () => {
  it('[R-H-21][R-H-18] chromium-visual: Playwright-Chromium ohne channel, 1600×1000, Skalierung 1, testMatch *.visual.spec.ts, snapshotPathTemplate {testDir}/__screenshots__/{projectName}/{arg}{ext}', async () => {
    const k = await ladeKonfig();
    const p = projekt(k, 'chromium-visual');
    const w = wirksam(k, p);
    expect(w.browserName ?? 'chromium').toBe('chromium');
    expect(w.channel ?? null, 'kein Kanal (Playwright-Chromium, E4 b)').toBeNull();
    expect(w.viewport).toEqual({ width: 1600, height: 1000 });
    expect(w.deviceScaleFactor).toBe(1);
    expect(trifft(p.testMatch, 'tests/wap-e2e/kernzustaende.visual.spec.ts')).toBe(true);
    expect(trifft(p.testMatch, 'tests/wap-e2e/render/page-view.spec.ts')).toBe(false);
    expect(trifft(p.testMatch, 'tests/wap-perf/x.perf.ts')).toBe(false);
    const vorlage = p.snapshotPathTemplate ?? k.snapshotPathTemplate;
    expect(vorlage).toBe('{testDir}/__screenshots__/{projectName}/{arg}{ext}');
    expect(resolve(WT, String(p.testDir ?? k.testDir))).toBe(join(WT, 'tests', 'wap-e2e'));
  });

  it('[R-H-21][R-H-18] chromium-visual: baseURL wie edge (mit WAP_E2E_PORT http://127.0.0.1:<port>, ohne keine)', async () => {
    const mit = await ladeKonfig({ port: '43231' });
    expect(wirksam(mit, projekt(mit, 'chromium-visual')).baseURL).toBe('http://127.0.0.1:43231');
    expect(wirksam(mit, projekt(mit, 'chromium-visual')).baseURL).toBe(
      wirksam(mit, projekt(mit, 'edge')).baseURL,
    );
    const ohne = await ladeKonfig();
    expect(wirksam(ohne, projekt(ohne, 'chromium-visual')).baseURL ?? null).toBeNull();
  });

  it("[R-H-21][R-H-18] global updateSnapshots 'none' (fehlende Baseline rot, nichts geschrieben), kein Projekt überschreibt es", async () => {
    const k = await ladeKonfig();
    expect(k.updateSnapshots).toBe('none');
    for (const p of projekte(k)) {
      expect(p.updateSnapshots ?? 'none', String(p.name)).toBe('none');
    }
    projekt(k, 'chromium-visual');
  });
});

describe('playwright.wap.config.ts: Projekt perf (R-H-22)', () => {
  it('[R-H-22][R-H-18] perf: testDir tests/wap-perf, testMatch *.perf.ts, Playwright-Chromium ohne channel, sichtbares Fenster (headless false), 1600×1000, Skalierung 1', async () => {
    const k = await ladeKonfig();
    const p = projekt(k, 'perf');
    const w = wirksam(k, p);
    expect(resolve(WT, String(p.testDir ?? ''))).toBe(join(WT, 'tests', 'wap-perf'));
    expect(trifft(p.testMatch, 'tests/wap-perf/zz.perf.ts')).toBe(true);
    expect(trifft(p.testMatch, 'tests/wap-perf/harness/harness.ts')).toBe(false);
    expect(trifft(p.testMatch, 'tests/wap-perf/zz.spec.ts')).toBe(false);
    expect(w.browserName ?? 'chromium').toBe('chromium');
    expect(w.channel ?? null).toBeNull();
    expect(w.headless).toBe(false);
    expect(w.viewport).toEqual({ width: 1600, height: 1000 });
    expect(w.deviceScaleFactor).toBe(1);
  });

  it('[R-H-21][R-H-22][R-H-18] retries 0 in jedem Projekt, auch chromium-visual und perf', async () => {
    const k = await ladeKonfig();
    expect(k.retries).toBe(0);
    const namen = projekte(k).map((p) => String(p.name));
    expect(namen).toEqual(expect.arrayContaining(['edge', 'edge-dist', 'chromium-visual', 'perf']));
    for (const p of projekte(k)) expect(p.retries ?? k.retries, String(p.name)).toBe(0);
  });
});

describe('playwright.wap.config.ts: WAP_PLAYWRIGHT_BERICHT (§2.1)', () => {
  it('[R-H-21][R-H-22][R-H-18] ohne Variable test-results/wap/playwright.json; mit test-results/wap/playwright-visual.json bzw. playwright-perf.json schreibt der JSON-Reporter dorthin', async () => {
    const ohne = await ladeKonfig();
    expect(berichtPfad(ohne)).toBe(join(WT, 'test-results', 'wap', 'playwright.json'));
    for (const name of ['playwright-visual.json', 'playwright-perf.json']) {
      const k = await ladeKonfig({ bericht: `test-results/wap/${name}` });
      expect(berichtPfad(k), name).toBe(join(WT, 'test-results', 'wap', name));
    }
  });

  it.each([
    ['ausserhalb von test-results/wap', 'test-results/playwright-visual.json'],
    ['mit .. innerhalb', 'test-results/wap/../playwright-visual.json'],
    ['mit .. am Anfang', '../test-results/wap/playwright-visual.json'],
    ['absolut', join(WT, 'test-results', 'wap', 'playwright-visual.json')],
    ['falsche Endung', 'test-results/wap/playwright-visual.txt'],
  ])(
    '[R-H-21][R-H-22][R-H-18] WAP_PLAYWRIGHT_BERICHT %s → Laden scheitert «WAP_PLAYWRIGHT_BERICHT ungültig»',
    async (_f, wert) => {
      expect(existsSync(join(WT, KONFIG)), `Konfiguration fehlt: ${KONFIG}`).toBe(true);
      vi.stubEnv('WAP_E2E_PORT', undefined);
      vi.stubEnv('WAP_PLAYWRIGHT_BERICHT', wert);
      vi.resetModules();
      let fehler: unknown = null;
      try {
        await import(KONFIG_URL);
      } catch (e) {
        fehler = e;
      }
      expect(fehler, 'Konfiguration lädt trotz ungültigem Wert').toBeInstanceOf(Error);
      expect((fehler as Error).message).toContain('WAP_PLAYWRIGHT_BERICHT ungültig');
    },
  );
});

describe('playwright.wap.config.ts: Testauswahl der neuen Projekte (Liste von Playwright)', () => {
  it(
    '[R-H-21][R-H-22][R-H-18] chromium-visual nur *.visual.spec.ts unter tests/wap-e2e; perf nur *.perf.ts unter tests/wap-perf; edge nimmt keine von beiden',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      expect(existsSync(join(k.root, KONFIG)), `Konfiguration fehlt: ${KONFIG}`).toBe(true);
      const probe = (n: string) =>
        `import { expect, test } from '@playwright/test';\n\ntest('[R-H-21] ${n}', () => {\n  expect(1).toBe(1);\n});\n`;
      writeText(k.root, 'tests/wap-e2e/zz-auswahl.spec.ts', probe('auswahl normal'));
      writeText(k.root, 'tests/wap-e2e/zz-auswahl.visual.spec.ts', probe('auswahl visual'));
      writeText(k.root, 'tests/wap-perf/zz-auswahl.perf.ts', probe('auswahl perf'));
      writeText(k.root, 'tests/wap-perf/zz-auswahl.spec.ts', probe('auswahl perf-ordner spec'));
      const l = playwrightListe(
        sb,
        k.root,
        ['-c', KONFIG, '--project=edge', '--project=chromium-visual', '--project=perf'],
        'auswahl',
      );
      expect(l.status, l.out.slice(0, 1500)).toBe(0);
      const projekteVon = (titel: string) =>
        l.tests
          .filter((t) => t.titel.endsWith(titel))
          .map((t) => t.projekt)
          .sort();
      expect(projekteVon('auswahl normal')).toEqual(['edge']);
      expect(projekteVon('auswahl visual')).toEqual(['chromium-visual']);
      expect(projekteVon('auswahl perf')).toEqual(['perf']);
      expect(projekteVon('auswahl perf-ordner spec')).toEqual([]);
    },
    MITTEL,
  );
});

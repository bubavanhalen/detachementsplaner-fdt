// Vite-Konfiguration der E2E (Nachtrag-Test N16 nach Code-Review Runde 1, CR-E101b-03; R-H-11):
// tests/wap-e2e/support/vite-e2e.config.ts übernimmt vite.config.ts der Suite und setzt nur cacheDir aus
// WAP_VITE_CACHE_DIR (eigener Cache je Lauf statt des gemeinsamen node_modules/.vite); ohne Variable wirft
// sie. Der webServer von playwright.wap.config.ts startet Vite mit dieser Konfiguration.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 2 und Nr 8.
// Liest nur Konfigurationen dieses Checkouts; der Cache-Pfad liegt in einer Sandbox und wird nicht angelegt.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ResolvedConfig, resolveConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aufraeumen, neueSandbox, prozessUmgebung, WT } from './support/umgebung';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const DATEI = 'tests/wap-e2e/support/vite-e2e.config.ts';

/** Pfad der E2E-Konfiguration; fehlt sie → Assertion (rot), kein Ladefehler. */
function konfigDatei(): string {
  const datei = join(WT, ...DATEI.split('/'));
  expect(existsSync(datei), `Konfiguration fehlt: ${DATEI}`).toBe(true);
  return datei;
}

/** Aufgelöste Vite-Konfiguration für den Entwicklungsserver (wie die CLI «vite --config …»). */
function loese(configFile: string): Promise<ResolvedConfig> {
  return resolveConfig({ root: WT, configFile, logLevel: 'silent' }, 'serve');
}

describe('vite-e2e.config.ts (N16)', () => {
  it('[R-H-11] N16 die Datei existiert; mit WAP_VITE_CACHE_DIR ist cacheDir dieser Wert, Plugins und server sind dieselben wie in vite.config.ts der Suite', async () => {
    const datei = konfigDatei();
    const sb = neueSandbox();
    const cache = join(sb.base, 'vite-cache', `lauf-${String(process.pid)}-probe`);
    vi.stubEnv('WAP_VITE_CACHE_DIR', cache);
    const e2e = await loese(datei);
    const suite = await loese(join(WT, 'vite.config.ts'));
    expect(resolve(e2e.cacheDir).toLowerCase()).toBe(resolve(cache).toLowerCase());
    expect(resolve(suite.cacheDir).toLowerCase()).not.toBe(resolve(cache).toLowerCase());
    expect(e2e.plugins.map((p) => p.name)).toEqual(suite.plugins.map((p) => p.name));
    expect(e2e.plugins.map((p) => p.name).some((n) => n.includes('react'))).toBe(true);
    expect(JSON.parse(JSON.stringify(e2e.server))).toEqual(
      JSON.parse(JSON.stringify(suite.server)),
    );
    expect(e2e.server.host).toBe('127.0.0.1');
    expect(e2e.server.strictPort).toBe(true);
    expect(e2e.base).toBe(suite.base);
  });

  it('[R-H-11] N16 ohne WAP_VITE_CACHE_DIR → Fehler «WAP_VITE_CACHE_DIR fehlt: E2E nur über npm run wap:test:e2e»', async () => {
    const datei = konfigDatei();
    vi.stubEnv('WAP_VITE_CACHE_DIR', undefined);
    await expect(loese(datei)).rejects.toThrow(
      'WAP_VITE_CACHE_DIR fehlt: E2E nur über npm run wap:test:e2e',
    );
  });

  it('[R-H-11] N16 webServer.command von playwright.wap.config.ts enthält --config tests/wap-e2e/support/vite-e2e.config.ts', async () => {
    const datei = join(WT, 'playwright.wap.config.ts');
    expect(existsSync(datei), 'Konfiguration fehlt: playwright.wap.config.ts').toBe(true);
    vi.stubEnv('WAP_E2E_PORT', '43221');
    vi.resetModules();
    const mod = (await import(pathToFileURL(datei).href)) as {
      default: { webServer?: { command?: string } | { command?: string }[] };
    };
    const ws = mod.default.webServer;
    const erster = Array.isArray(ws) ? ws[0] : ws;
    expect(erster, 'webServer fehlt').toBeDefined();
    const befehl = String(erster?.command ?? '');
    expect(befehl).toMatch(/--config[\s=]tests\/wap-e2e\/support\/vite-e2e\.config\.ts(?!\S)/);
    expect(befehl).toContain('43221');
  });
});

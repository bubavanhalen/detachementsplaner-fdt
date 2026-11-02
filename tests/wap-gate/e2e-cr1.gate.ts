// Läufer runE2e nach Code-Review Runde 1 (Nachtrag-Tests N13–N15; CR-E101b-03, -04, -05; R-H-11): Ein alter
// Bericht wird als erste Handlung gelöscht; Variablen, die Bericht oder Verhalten von Playwright an der
// Konfiguration vorbei ändern (PLAYWRIGHT_* ausser PLAYWRIGHT_BROWSERS_PATH, PW_*, PWDEBUG), entfernt runE2e
// ohne Beachtung von Gross/Klein; jeder Lauf hat einen eigenen Vite-Cache (WAP_VITE_CACHE_DIR) unter
// test-results/wap/vite-cache/, der danach entfernt ist, und räumt verwaiste Cache-Ordner auf.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 2–4 und Nr 8.
// Synthetische Repos mit eigener Playwright-Konfiguration; die Probe-Tests brauchen keinen Browser.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { totePid, wartenderProzess } from './support/last';
import {
  aufraeumen,
  commitAlles,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { e2e } from './support/vertrag';
import { e2eRepo, playwrightTests } from './support/vertrag-b';
import { leseUmgebungsMarke, umgebungsProbeSpec } from './support/vertrag-b-cr1';

afterEach(aufraeumen);

const BERICHT = 'test-results/wap/playwright.json';
const ALTER_BERICHT = '{"suites":[],"fiktiv":"Bericht eines früheren Laufs"}\n';

/** Synthetisches Repo mit der Umgebungsprobe; liefert Wurzel und Pfad der Marke. */
function probeRepo(sb: Sandbox, gruen = true): { root: string; marke: string } {
  prozessUmgebung(sb);
  const marke = join(sb.base, 'marke.json');
  const root = e2eRepo(sb, { name: 'e2e-cr1' });
  writeText(root, 'tests/wap-e2e/probe.spec.ts', umgebungsProbeSpec(marke, gruen));
  commitAlles(sb, root, 'Probe CR1');
  return { root, marke };
}

describe('runE2e: alter Bericht (N13, CR-E101b-04)', () => {
  it(
    '[R-H-11] N13 ein alter playwright.json ist nach fehlender Konfiguration bzw. fehlendem @playwright/test entfernt',
    async () => {
      const { runE2e } = await e2e();
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const ohneKonfig = e2eRepo(sb, { konfig: null, name: 'ohne-konfig' });
      const alt1 = writeText(ohneKonfig, BERICHT, ALTER_BERICHT);
      const r1 = await runE2e({ cwd: ohneKonfig, project: 'edge' });
      expect(r1.ok).toBe(false);
      expect(r1.ursache ?? '').toContain('playwright.wap.config.ts');
      expect(existsSync(alt1), 'alter Bericht liegt nach fehlender Konfiguration noch').toBe(false);

      const ohneWerkzeug = e2eRepo(sb, { mitNodeModules: false, name: 'ohne-werkzeug' });
      const alt2 = writeText(ohneWerkzeug, BERICHT, ALTER_BERICHT);
      const r2 = await runE2e({ cwd: ohneWerkzeug, project: 'edge' });
      expect(r2.ok).toBe(false);
      expect(r2.ursache ?? '').toContain('@playwright/test');
      expect(existsSync(alt2), 'alter Bericht liegt nach fehlendem Werkzeug noch').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] N13 ein alter playwright.json ist nach rotem Harness-Bau entfernt (Playwright startet nicht)',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = e2eRepo(sb, { name: 'harness-rot' });
      writeText(root, 'tests/wap-e2e/harness/kaputt.tsx', 'export const = ;\n');
      const alt = writeText(root, BERICHT, ALTER_BERICHT);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('kaputt');
      expect(existsSync(alt), 'alter Bericht liegt nach rotem Harness-Bau noch').toBe(false);
    },
    MITTEL,
  );
});

describe('runE2e: Umgebung von Playwright (N14, CR-E101b-05)', () => {
  it(
    '[R-H-11] N14 PLAYWRIGHT_JSON_OUTPUT_FILE (klein geschrieben), _DIR und _NAME leiten den Bericht nicht um; PWDEBUG und PW_TEST_FIKTIV fehlen im Probe-Test; PLAYWRIGHT_BROWSERS_PATH bleibt',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = probeRepo(sb);
      const umgeleitet = join(sb.base, 'umgeleitet');
      const browser = join(sb.base, 'browser-fiktiv');
      vi.stubEnv('playwright_json_output_file', join(umgeleitet, 'datei.json'));
      vi.stubEnv('PLAYWRIGHT_JSON_OUTPUT_DIR', join(umgeleitet, 'ordner'));
      vi.stubEnv('PLAYWRIGHT_JSON_OUTPUT_NAME', 'name.json');
      vi.stubEnv('PWDEBUG', 'console');
      vi.stubEnv('PW_TEST_FIKTIV', '1');
      vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', browser);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(umgeleitet), 'Bericht wurde umgeleitet').toBe(false);
      const tests = playwrightTests(join(root, ...BERICHT.split('/')));
      expect(tests.map((t) => `${t.projekt}: ${t.status}`)).toEqual(['edge: passed']);
      const m = leseUmgebungsMarke(marke);
      const namen = m.schluessel.map((k) => k.toUpperCase());
      for (const v of [
        'PWDEBUG',
        'PW_TEST_FIKTIV',
        'PLAYWRIGHT_JSON_OUTPUT_FILE',
        'PLAYWRIGHT_JSON_OUTPUT_DIR',
        'PLAYWRIGHT_JSON_OUTPUT_NAME',
      ]) {
        expect(namen, `${v} im Probe-Test`).not.toContain(v);
      }
      expect(m.browsersPath).toBe(browser);
    },
    MITTEL,
  );
});

describe('runE2e: Vite-Cache je Lauf (N15, CR-E101b-03)', () => {
  const muster = () => new RegExp(`^lauf-${String(process.pid)}-.+`);

  it(
    '[R-H-11] N15 WAP_VITE_CACHE_DIR zeigt im Probe-Test auf <cwd>/test-results/wap/vite-cache/lauf-<pid>-…, der Ordner ist danach weg; ein Ordner mit toter PID wird entfernt, einer mit lebender PID bleibt',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = probeRepo(sb);
      const cacheOrdner = join(root, 'test-results', 'wap', 'vite-cache');
      const tot = join(cacheOrdner, `lauf-${String(totePid())}-alt001`);
      writeText(tot, 'deps/fiktiv.js', '// fiktiver Cache-Eintrag\n');
      const lebend = wartenderProzess();
      try {
        expect(lebend.pid, 'Test-Aufbau: lebender Prozess ohne PID').toBeGreaterThan(0);
        const lebt = join(cacheOrdner, `lauf-${String(lebend.pid)}-lebt01`);
        mkdirSync(lebt, { recursive: true });
        const { runE2e } = await e2e();
        const r = await runE2e({ cwd: root, project: 'edge' });
        expect(r.ok, schrittText(r)).toBe(true);
        const m = leseUmgebungsMarke(marke);
        expect(m.viteCache, 'WAP_VITE_CACHE_DIR fehlt im Probe-Test').not.toBeNull();
        const cache = resolve(m.viteCache ?? '');
        expect(dirname(cache).toLowerCase()).toBe(cacheOrdner.toLowerCase());
        expect(basename(cache)).toMatch(muster());
        expect(existsSync(cache), 'Cache-Ordner des Laufs blieb liegen').toBe(false);
        expect(existsSync(tot), 'Ordner mit toter PID blieb liegen').toBe(false);
        expect(existsSync(lebt), 'Ordner mit lebender PID wurde entfernt').toBe(true);
        expect(readdirSync(cacheOrdner)).toEqual([basename(lebt)]);
      } finally {
        lebend.kill();
      }
    },
    MITTEL,
  );

  it(
    '[R-H-11] N15 auch nach einem roten Lauf ist der Cache-Ordner des Laufs entfernt',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = probeRepo(sb, false);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok).toBe(false);
      const m = leseUmgebungsMarke(marke);
      expect(m.viteCache, 'WAP_VITE_CACHE_DIR fehlt im Probe-Test').not.toBeNull();
      const cache = resolve(m.viteCache ?? '');
      expect(basename(cache)).toMatch(muster());
      expect(existsSync(cache), 'Cache-Ordner des roten Laufs blieb liegen').toBe(false);
    },
    MITTEL,
  );
});

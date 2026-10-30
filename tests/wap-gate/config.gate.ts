// Testkonfigurationen (ADR-010 §3.4, §4.5; Änderungsnotiz AE-001 §2): keine automatischen Wiederholungen,
// feste Workerzahl (4; Selbsttest-Teil 1 mit fileParallelism: false) und globalSetup in allen WAP-
// Konfigurationen ausser der Harness-Konfiguration (Befund E1-01-17); Trennung von der Suite-CI
// (Testliste der Suite-Konfiguration enthält genau die erlaubten WAP-Muster; *.entwurf.ts erfasst keine
// Konfiguration, Vertrag AE-001 §3).
// E1-01-min: Golden-, Playwright- und Stryker-Konfiguration kommen mit E1-01b, -d, -e (Entwurf
// config-spaeter.gate.entwurf.ts).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3, §9 Nr 17 und Änderungsnotiz AE-001 §2.
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  WT,
  writeText,
} from './support/umgebung';

afterEach(aufraeumen);

async function ladeKonfig(rel: string): Promise<Record<string, unknown>> {
  const datei = join(WT, rel);
  expect(existsSync(datei), `Konfiguration fehlt: ${rel}`).toBe(true);
  const mod = (await import(pathToFileURL(datei).href)) as { default: unknown };
  const roh =
    typeof mod.default === 'function' ? await (mod.default as () => unknown)() : mod.default;
  return roh as Record<string, unknown>;
}

function test(konfig: Record<string, unknown>): Record<string, unknown> {
  return (konfig.test ?? {}) as Record<string, unknown>;
}

function setupListe(konfig: Record<string, unknown>): string[] {
  const setup = test(konfig).globalSetup;
  if (typeof setup === 'string') return [setup];
  if (Array.isArray(setup)) return setup.filter((x): x is string => typeof x === 'string');
  return [];
}

/** WAP-Vitest-Konfigurationen von E1-01-min ausser der gesperrten Harness-Konfiguration. */
const KONFIGS_MIN: Array<[string, string, number]> = [
  ['vitest.wap.config.ts', 'tests/wap/**/*.test.ts', 4],
  ['vitest.wap-reference.config.ts', 'tests/wap/reference/**/*.ref.ts', 4],
  ['vitest.wap-gate.config.ts', 'tests/wap-gate/**/*.gate.ts', 4],
  ['vitest.wap-selbsttest.config.ts', 'tests/wap-gate/**/*.selbsttest.ts', 1],
];

describe('keine automatischen Wiederholungen und feste Workerzahl (ADR-010 §3.4, AE-001 §2)', () => {
  it('[R-H-18] alle WAP-Vitest-Konfigurationen von E1-01-min vorhanden mit retry 0 (oder nicht gesetzt = 0), auch die Harness-Konfiguration', async () => {
    for (const rel of [...KONFIGS_MIN.map(([r]) => r), 'vitest.wap-harness.config.ts']) {
      const k = await ladeKonfig(rel);
      expect(test(k).retry ?? 0, rel).toBe(0);
    }
  });

  it.each(KONFIGS_MIN.filter(([, , w]) => w === 4))(
    '[R-H-18] %s (Muster %s): maxWorkers %i',
    async (rel, _muster, worker) => {
      const k = await ladeKonfig(rel);
      expect(test(k).maxWorkers, rel).toBe(worker);
    },
  );

  it.each(KONFIGS_MIN)(
    '[R-H-27][R-H-28] %s: include %s und globalSetup (Node-Prüfung) gesetzt',
    async (rel, muster) => {
      const k = await ladeKonfig(rel);
      expect(test(k).include).toEqual([muster]);
      expect(setupListe(k).length, `${rel} ohne globalSetup`).toBeGreaterThan(0);
    },
  );

  // Ein Test für die ganze Selbsttest-Konfiguration: Das Gerüst aus Schritt 2 erfüllt maxWorkers und
  // fileParallelism schon; vollständig ist sie erst mit dem globalSetup (Vertrag AE-001 §2, Schritt 7).
  it('[R-H-18][R-H-27] vitest.wap-selbsttest.config.ts gemäss Vertrag: maxWorkers 1, fileParallelism false (nur eine Datei gleichzeitig), globalSetup scripts/wap-gate/vitest-setup.mjs (Sperre, F0-last, Node-Prüfung) und die Datei existiert', async () => {
    const k = await ladeKonfig('vitest.wap-selbsttest.config.ts');
    expect(test(k).maxWorkers).toBe(1);
    expect(test(k).fileParallelism).toBe(false);
    const setup = setupListe(k).map((s) => s.replace(/\\/g, '/'));
    expect(setup.some((s) => s.endsWith('scripts/wap-gate/vitest-setup.mjs'))).toBe(true);
    expect(existsSync(join(WT, 'scripts', 'wap-gate', 'vitest-setup.mjs'))).toBe(true);
  });
});

describe('Trennung von der Suite-CI (ADR-010 §4.5)', () => {
  it(
    '[R-H-28] Testliste der Suite-Konfiguration enthält von den WAP-Tests genau tests/wap/**/*.test.ts; Referenz, Golden, E2E, Leistung, Schleusen, Selbsttest-Teil, Harness und *.entwurf.ts nie; jede WAP-Konfiguration listet nur ihr Muster',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      const leer = "import { it } from 'vitest';\n\nit('[R-H-28] probe', () => {});\n";
      const erlaubt = [
        'tests/wap/unit/zz-probe.test.ts',
        'tests/wap/property/zz-probe.test.ts',
        'tests/wap/integration/zz-probe.test.ts',
        'tests/wap/pdf/zz-probe.test.ts',
        'tests/wap/sonstiges/zz-probe.test.ts',
      ];
      const gateProbe = 'tests/wap-gate/zz-probe.gate.ts';
      const selbsttestProbe = 'tests/wap-gate/zz-probe.selbsttest.ts';
      const entwuerfe = [
        'tests/wap/unit/zz-probe.entwurf.ts',
        'tests/wap/unit/zz-probe.test.entwurf.ts',
        'tests/wap-gate/zz-probe.gate.entwurf.ts',
        'tests/wap-gate/zz-probe.selbsttest.entwurf.ts',
      ];
      const verboten = [
        'tests/wap/reference/zz-probe.ref.ts',
        'tests/wap/golden/zz-probe.golden.ts',
        'tests/wap-e2e/zz-probe.spec.ts',
        'tests/wap-e2e/zz-probe.visual.spec.ts',
        'tests/wap-perf/zz-probe.perf.ts',
        gateProbe,
        selbsttestProbe,
        'tests/wap-harness/zz-probe.harness.ts',
        ...entwuerfe,
      ];
      for (const rel of [...erlaubt, ...verboten])
        writeText(k.root, rel, `// @vitest-environment node\n${leer}`);
      for (const rel of KONFIGS_MIN.map(([r]) => r)) {
        expect(existsSync(join(k.root, rel)), `${rel} fehlt`).toBe(true);
      }
      const vitest = join(k.root, 'node_modules', 'vitest', 'vitest.mjs');
      const liste = (konfig: string): string[] => {
        const r = lauf(process.execPath, [vitest, 'list', '--filesOnly', '--json', '-c', konfig], {
          cwd: k.root,
          env: { ...sb.env, VITEST_MAX_WORKERS: '4' },
          timeout: MITTEL,
        });
        expect(r.status, r.stderr).toBe(0);
        const daten = JSON.parse(r.stdout.slice(r.stdout.indexOf('['))) as Array<{ file: string }>;
        return daten.map((d) => relative(k.root, d.file).replace(/\\/g, '/')).sort();
      };
      const suite = liste('vitest.config.ts').filter((p) => /^tests\/wap(-[^/]+)?\//.test(p));
      const wap = liste('vitest.wap.config.ts');
      for (const rel of erlaubt) expect(suite).toContain(rel);
      for (const rel of verboten) expect(suite).not.toContain(rel);
      expect(suite.every((p) => p.startsWith('tests/wap/') && p.endsWith('.test.ts'))).toBe(true);
      expect(wap).toEqual(suite);
      // Die Selbsttest-Konfiguration wird hier nicht gelistet: ihr globalSetup belegt die Sperre und
      // prüft auf fremde Prozesse (AE-001 §2); ihr Muster prüft der statische Test oben.
      const gateListe = liste('vitest.wap-gate.config.ts');
      expect(gateListe).toContain(gateProbe);
      expect(gateListe).not.toContain(selbsttestProbe);
      for (const e of entwuerfe) {
        expect(gateListe, e).not.toContain(e);
        expect(wap, e).not.toContain(e);
      }
      expect(gateListe.every((p) => !p.endsWith('.entwurf.ts'))).toBe(true);
    },
    MITTEL,
  );
});

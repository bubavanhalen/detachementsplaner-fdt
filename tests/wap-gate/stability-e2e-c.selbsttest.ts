// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Stabilitätslauf mit E2E-Teil (ADR-010 §3.4; R-H-21, R-H-18).
// Nach den Vitest-Profilen läuft E2E mit --repeat-each=3 (funktionale Projekte) und, wenn die Konfiguration es
// nennt, chromium-visual ebenso; nur mit Profil «normal» und vorhandener playwright.wap.config.ts, nie perf.
// Jede Wiederholung mit Status ≠ passed ist «flatternd» mit Testnamen; Kernzustände ohne Baseline sind rot mit
// eigener Ursache «Baseline fehlt».
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.1 «stability.mjs» (CR-E101c-V03), §3; übernommen aus dem
// Entwurf stability-e2e.selbsttest.entwurf.ts. Synthetisches Repo wie stability.selbsttest.ts, Probe-Tests ohne
// Browser (Wiederholung über testInfo.repeatEachIndex). Nur fiktive Inhalte.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import {
  aufraeumen,
  commitAlles,
  LANG,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { type ProjektName, pwKonfigC, stabilityC } from './support/vertrag-c';

afterEach(aufraeumen);

interface Probe {
  /** Repo-Pfad der Spezifikation. */
  pfad: string;
  titel: string;
  /** Wiederholung (0-basiert), in der der Test scheitert; 'baseline' = fehlende Baseline; null = nie. */
  scheitert: number | 'baseline' | null;
  /** Protokoll der Ausführungen (eine Zeile je Ausführung). */
  log: string;
}

function probeSpec(p: Probe): string {
  const koerper =
    p.scheitert === 'baseline'
      ? ["  expect('fiktiv').toMatchSnapshot('zz-ohne-baseline.txt');"]
      : [
          ...(p.scheitert === null
            ? []
            : [
                `  if (testInfo.repeatEachIndex === ${String(p.scheitert)}) throw new Error('flatternd: Wiederholung ' + String(testInfo.repeatEachIndex));`,
              ]),
          '  expect(1).toBe(1);',
        ];
  return [
    "import { appendFileSync } from 'node:fs';",
    "import { expect, test } from '@playwright/test';",
    '',
    `test(${JSON.stringify(p.titel)}, async ({}, testInfo) => {`,
    `  appendFileSync(${JSON.stringify(p.log)}, String(testInfo.repeatEachIndex) + '\\n');`,
    ...koerper,
    '});',
    '',
  ].join('\n');
}

/** Synthetisches Repo wie stability.selbsttest.ts (Suite und WAP-Vitest stabil) plus Playwright-Teil. */
function repo(sb: Sandbox, projekte: ProjektName[] | null, proben: Probe[]): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'stabil-e2e');
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'stabil-e2e', private: true, type: 'module', scripts: { test: 'vitest run' } }, null, 2)}\n`,
  );
  writeText(
    root,
    'vitest.config.ts',
    "export default { test: { include: ['tests/suite/**/*.test.ts'], environment: 'node' } };\n",
  );
  writeText(
    root,
    'vitest.wap.config.ts',
    "export default { test: { include: ['tests/wap/**/*.test.ts'], environment: 'node', retry: 0 } };\n",
  );
  writeText(
    root,
    'tests/wap/unit/stabil.test.ts',
    "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-1-01] stabil wap', () => {\n  expect(1).toBe(1);\n});\n",
  );
  writeText(
    root,
    'tests/suite/stabil.test.ts',
    "import { expect, it } from 'vitest';\n\nit('suite stabil', () => {\n  expect(1).toBe(1);\n});\n",
  );
  if (projekte !== null) writeText(root, 'playwright.wap.config.ts', pwKonfigC(projekte));
  for (const p of proben) writeText(root, p.pfad, probeSpec(p));
  nodeModules(root);
  commitAlles(sb, root, 'Stabilität mit E2E');
  return root;
}

/** Ausführungen laut Protokoll (Wiederholungsindizes, sortiert); fehlt es → keine Ausführung. */
function ausfuehrungen(log: string): number[] {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter((z) => z !== '')
    .map(Number)
    .sort((a, b) => a - b);
}

function flatternd(details: unknown): string[] {
  const d = (typeof details === 'object' && details !== null ? details : {}) as {
    flatternd?: unknown;
  };
  return Array.isArray(d.flatternd) ? d.flatternd.map(String) : [];
}

describe('runStability: E2E --repeat-each=3 (E1-01c)', () => {
  it(
    '[R-H-21][R-H-18] absichtlich flatternder E2E-Test (scheitert nur in der zweiten Wiederholung) → rot mit Testnamen',
    async () => {
      const sb = neueSandbox();
      const log = join(sb.base, 'e2e-flattert.txt');
      const root = repo(
        sb,
        ['edge'],
        [
          {
            pfad: 'tests/wap-e2e/stabil.spec.ts',
            titel: '[R-1-01] flatternd e2e',
            scheitert: 1,
            log,
          },
        ],
      );
      const { runStability } = await stabilityC();
      const r = await runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });
      expect(ausfuehrungen(log), 'E2E nicht dreimal ausgeführt').toEqual([0, 1, 2]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('flatternd e2e');
      expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
    },
    LANG,
  );

  it(
    '[R-H-21][R-H-18] stabiler E2E-Test → grün; drei Ausführungen; ohne chromium-visual in der Konfiguration kein zweiter Lauf; Projekt perf läuft nie im Stabilitätslauf (TR-E101c-08 b)',
    async () => {
      const sb = neueSandbox();
      const log = join(sb.base, 'e2e-stabil.txt');
      const logVisual = join(sb.base, 'visual-nie.txt');
      const logPerf = join(sb.base, 'perf-nie.txt');
      const root = repo(
        sb,
        ['edge', 'perf'],
        [
          {
            pfad: 'tests/wap-e2e/stabil.spec.ts',
            titel: '[R-1-01] stabil e2e',
            scheitert: null,
            log,
          },
          {
            pfad: 'tests/wap-e2e/stabil.visual.spec.ts',
            titel: '[R-1-01] visual ohne Projekt',
            scheitert: null,
            log: logVisual,
          },
          {
            pfad: 'tests/wap-perf/stabil.perf.ts',
            titel: '[R-1-01] perf nie im Stabilitätslauf',
            scheitert: null,
            log: logPerf,
          },
        ],
      );
      const { runStability } = await stabilityC();
      const r = await runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });
      expect(ausfuehrungen(log), 'E2E nicht dreimal ausgeführt').toEqual([0, 1, 2]);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(ausfuehrungen(logVisual)).toEqual([]);
      expect(ausfuehrungen(logPerf), 'perf im Stabilitätslauf ausgeführt').toEqual([]);
    },
    LANG,
  );

  it(
    '[R-H-21][R-H-18] flatternder Test im Projekt chromium-visual (zweite Wiederholung) → rot mit Testnamen; funktionaler Test stabil',
    async () => {
      const sb = neueSandbox();
      const logEdge = join(sb.base, 'edge.txt');
      const logVisual = join(sb.base, 'visual.txt');
      const root = repo(
        sb,
        ['edge', 'chromium-visual'],
        [
          {
            pfad: 'tests/wap-e2e/stabil.spec.ts',
            titel: '[R-1-01] stabil e2e',
            scheitert: null,
            log: logEdge,
          },
          {
            pfad: 'tests/wap-e2e/flattert.visual.spec.ts',
            titel: '[R-1-01] flatternd visual',
            scheitert: 1,
            log: logVisual,
          },
        ],
      );
      const { runStability } = await stabilityC();
      const r = await runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });
      expect(ausfuehrungen(logEdge)).toEqual([0, 1, 2]);
      expect(ausfuehrungen(logVisual), 'chromium-visual nicht dreimal ausgeführt').toEqual([
        0, 1, 2,
      ]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('flatternd visual');
      expect(schrittText(r)).not.toContain('stabil e2e');
    },
    LANG,
  );

  it(
    '[R-H-21][R-H-18] Kernzustand ohne Baseline im Projekt chromium-visual → rot mit eigener Ursache «Baseline fehlt», nicht als flatternd gemeldet',
    async () => {
      const sb = neueSandbox();
      const logVisual = join(sb.base, 'visual-baseline.txt');
      const root = repo(
        sb,
        ['edge', 'chromium-visual'],
        [
          {
            pfad: 'tests/wap-e2e/ohne-baseline.visual.spec.ts',
            titel: '[R-1-01] ohne Baseline',
            scheitert: 'baseline',
            log: logVisual,
          },
        ],
      );
      const { runStability } = await stabilityC();
      const r = await runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });
      expect(ausfuehrungen(logVisual), 'chromium-visual nicht ausgeführt').toEqual([0, 1, 2]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('Baseline fehlt');
      expect(flatternd(r.details).some((n) => n.includes('ohne Baseline'))).toBe(false);
      expect(
        existsSync(join(root, 'tests', 'wap-e2e', '__screenshots__')),
        'Baseline geschrieben',
      ).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-21][R-H-18] profile [grenzlast] → kein E2E; profile [normal] mit derselben Konfiguration → E2E dreimal (CR-E101c-V03)',
    async () => {
      const sb = neueSandbox();
      const log = join(sb.base, 'e2e-profil.txt');
      const root = repo(
        sb,
        ['edge'],
        [
          {
            pfad: 'tests/wap-e2e/stabil.spec.ts',
            titel: '[R-1-01] stabil e2e',
            scheitert: null,
            log,
          },
        ],
      );
      const { runStability } = await stabilityC();
      const g = await runStability({ cwd: root, last: testLast(sb).last, profile: ['grenzlast'] });
      expect(g.ok, schrittText(g)).toBe(true);
      expect(ausfuehrungen(log), 'E2E im Profil grenzlast').toEqual([]);
      const n = await runStability({
        cwd: root,
        last: testLast(sb, { name: 'common-2' }).last,
        profile: ['normal'],
      });
      expect(n.ok, schrittText(n)).toBe(true);
      expect(ausfuehrungen(log)).toEqual([0, 1, 2]);
    },
    LANG,
  );

  it(
    '[R-H-18] Mini-Repo ohne playwright.wap.config.ts → wie bisher grün, kein Playwright-Start',
    async () => {
      const sb = neueSandbox();
      const log = join(sb.base, 'e2e-ohne-konfig.txt');
      const root = repo(sb, null, [
        {
          pfad: 'tests/wap-e2e/stabil.spec.ts',
          titel: '[R-1-01] ohne Konfiguration',
          scheitert: null,
          log,
        },
      ]);
      const { runStability } = await stabilityC();
      const r = await runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(ausfuehrungen(log)).toEqual([]);
    },
    LANG,
  );
});

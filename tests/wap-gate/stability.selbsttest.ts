// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): startet ganze Testläufe in einem synthetischen Repo.
// Stabilitätslauf (ADR-010 §3.4 und Änderungsnotiz AE-001 §2 «Stabilitätslauf (R-H-18)»): Suite-`npm test`
// und WAP-Vitest je 3 × «normal» und 3 × «Grenzlast»; jede Abweichung zwischen den Läufen → rot
// (flatternder Test, blockierend); Kindläufe mit fester Workerzahl (VITEST_MAX_WORKERS=4, agent-regeln 5).
// E2E-Wiederholung kommt mit E1-01c (Entwurf stability-e2e.selbsttest.entwurf.ts).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (runStability) und Änderungsnotiz AE-001 §2
// (`last` als Funktionsparameter: temporäres commonDir, keine fremden Prozesse, CPU-Last 0).
// Synthetisches Repo mit eigenen Minimal-Konfigurationen und absichtlich flatternden Tests (Zähler-Datei).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sperrPfad, testLast } from './support/last';
import {
  aufraeumen,
  commitAlles,
  LANG,
  neueSandbox,
  neuesRepo,
  node,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { stability } from './support/vertrag';

afterEach(aufraeumen);

/**
 * Testkörper: zählt seine Aufrufe in einer Datei, protokolliert VITEST_MAX_WORKERS und scheitert beim
 * n-ten Aufruf (n = 0 → nie).
 */
function koerper(zaehler: string, protokoll: string, scheitertBei: number): string {
  return [
    `  const datei = ${JSON.stringify(zaehler)};`,
    "  const n = existsSync(datei) ? Number(readFileSync(datei, 'utf8')) + 1 : 1;",
    '  writeFileSync(datei, String(n));',
    `  appendFileSync(${JSON.stringify(protokoll)}, String(process.env.VITEST_MAX_WORKERS) + '\\n');`,
    `  if (n === ${String(scheitertBei)}) throw new Error('flatternd: Lauf ' + String(n));`,
    '  expect(n).toBeGreaterThan(0);',
  ].join('\n');
}

interface Stabil {
  root: string;
  wapZaehler: string;
  suiteZaehler: string;
  wapProtokoll: string;
  suiteProtokoll: string;
}

function repo(sb: Sandbox, wapScheitertBei: number, suiteScheitertBei: number): Stabil {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'stabil');
  const s: Stabil = {
    root,
    wapZaehler: join(sb.base, 'zaehler-wap.txt'),
    suiteZaehler: join(sb.base, 'zaehler-suite.txt'),
    wapProtokoll: join(sb.base, 'worker-wap.txt'),
    suiteProtokoll: join(sb.base, 'worker-suite.txt'),
  };
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'stabil', private: true, type: 'module', scripts: { test: 'vitest run' } }, null, 2)}\n`,
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
  const kopf =
    "import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';\nimport { expect, it } from 'vitest';\n\n";
  writeText(
    root,
    'tests/wap/unit/stabil.test.ts',
    `// @vitest-environment node\n${kopf}it('[R-1-01] stabil wap', () => {\n${koerper(s.wapZaehler, s.wapProtokoll, wapScheitertBei)}\n});\n`,
  );
  writeText(
    root,
    'tests/suite/stabil.test.ts',
    `${kopf}it('suite stabil', () => {\n${koerper(s.suiteZaehler, s.suiteProtokoll, suiteScheitertBei)}\n});\n`,
  );
  nodeModules(root);
  commitAlles(sb, root, 'Stabilität');
  return s;
}

function zeilen(datei: string): string[] {
  if (!existsSync(datei)) return [];
  return readFileSync(datei, 'utf8')
    .split('\n')
    .filter((z) => z !== '');
}

describe('runStability (E1-01-min: Suite-npm test und WAP-Vitest)', () => {
  it(
    '[R-H-18] stabile Tests: je 3 × normal und 3 × Grenzlast (Suite 6, WAP 6 Läufe), jeder Kindlauf mit VITEST_MAX_WORKERS=4 → grün; Sperre danach frei',
    async () => {
      const sb = neueSandbox();
      const s = repo(sb, 0, 0);
      const t = testLast(sb);
      const { runStability } = await stability();
      const r = await runStability({ cwd: s.root, last: t.last });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(readFileSync(s.wapZaehler, 'utf8')).toBe('6');
      expect(readFileSync(s.suiteZaehler, 'utf8')).toBe('6');
      expect(zeilen(s.wapProtokoll)).toEqual(['4', '4', '4', '4', '4', '4']);
      expect(zeilen(s.suiteProtokoll)).toEqual(['4', '4', '4', '4', '4', '4']);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-18] profile [normal] (Vertrag AE-001 §4 Nr 3): je 3 Läufe Suite und WAP, alle mit VITEST_MAX_WORKERS=4 → grün',
    async () => {
      const sb = neueSandbox();
      const s = repo(sb, 0, 0);
      const { runStability } = await stability();
      const r = await runStability({ cwd: s.root, last: testLast(sb).last, profile: ['normal'] });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(readFileSync(s.wapZaehler, 'utf8')).toBe('3');
      expect(readFileSync(s.suiteZaehler, 'utf8')).toBe('3');
      expect(zeilen(s.wapProtokoll)).toEqual(['4', '4', '4']);
      expect(zeilen(s.suiteProtokoll)).toEqual(['4', '4', '4']);
    },
    LANG,
  );

  it(
    '[R-H-18] profile [grenzlast]: flatternder Suite-Test im zweiten seiner drei Läufe → rot mit Testnamen',
    async () => {
      const sb = neueSandbox();
      const s = repo(sb, 0, 2);
      const { runStability } = await stability();
      const r = await runStability({
        cwd: s.root,
        last: testLast(sb).last,
        profile: ['grenzlast'],
      });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('suite stabil');
    },
    LANG,
  );

  it(
    '[R-H-18] absichtlich flatternder WAP-Vitest-Test (scheitert nur im zweiten Lauf) → rot mit Testnamen',
    async () => {
      const sb = neueSandbox();
      const s = repo(sb, 2, 0);
      const { runStability } = await stability();
      const r = await runStability({ cwd: s.root, last: testLast(sb).last });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('stabil wap');
      expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
    },
    LANG,
  );

  it(
    '[R-H-18] absichtlich flatternder Suite-Test (scheitert nur im fünften seiner sechs Läufe) → rot mit Testnamen',
    async () => {
      const sb = neueSandbox();
      const s = repo(sb, 0, 5);
      const { runStability } = await stability();
      const r = await runStability({ cwd: s.root, last: testLast(sb).last });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('suite stabil');
    },
    LANG,
  );
});

describe('stability.mjs als CLI (TR-E101-12; Vertrag AE-001 §2 «Die CLI führt immer beide Profile aus»)', () => {
  it(
    '[R-H-18] CLI im synthetischen Repo (cwd = dessen Wurzel, ohne WAP_GATE_SPERRE): beide Profile, je 6 Läufe Suite und WAP, Exit 0; die Sperre entsteht nur unter dessen .git/wap-gate und ist danach frei',
    () => {
      const sb = neueSandbox();
      const s = repo(sb, 0, 0);
      const env: NodeJS.ProcessEnv = { ...sb.env };
      delete env.WAP_GATE_SPERRE;
      delete env.VITEST_MAX_WORKERS;
      const r = node(join(WT, 'scripts', 'wap-gate', 'stability.mjs'), [], {
        cwd: s.root,
        env,
        timeout: LANG,
      });
      expect(r.status).toBe(0);
      expect(readFileSync(s.wapZaehler, 'utf8')).toBe('6');
      expect(readFileSync(s.suiteZaehler, 'utf8')).toBe('6');
      expect(zeilen(s.wapProtokoll)).toEqual(['4', '4', '4', '4', '4', '4']);
      expect(existsSync(join(s.root, '.git', 'wap-gate', 'sperre.json'))).toBe(false);
    },
    LANG,
  );
});

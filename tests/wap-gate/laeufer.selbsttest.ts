// Nachträge nach dem Code-Review E1-01-min Runde 1 (.qa/e1-01/code-reviewer-min-1.md; Entscheide FINDINGS
// CR-E101-01, -02, -03, -04, -08, E1-01-22): Läufer-Ergebnis und Exit-Code in F8, V1, V1a, V10 und V9
// (Bericht vor dem Lauf gelöscht, Exit ≠ 0 rot bzw. in der Rot-Phase nur mit erklärendem rotem Paket-Test),
// übersprungene Tests, Dauer der Schritte, Stabilitätslauf mit übersprungenen Suite-Tests, F2-referenz ohne
// reference-lock.json, V3-Bericht ohne Meldungstexte.
// Läufe in synthetischen Mini-Repos; der Vitest-Läufer ist dort eine Fälschung unter node_modules/vitest/
// (Verhalten aus einer Begleitdatei), ausser beim Stabilitätslauf und V3 (echtes Vitest über Verknüpfung).
// Jeder direkte Aufruf speist `last` ein (Vertrag AE-001 §2). Selbsttest-Teil (Vertrag §9 Nr 17).
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { MINI_ANHANG, MINI_REFERENCE_LOCK, miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  git,
  kopiereAusWt,
  LANG,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  WT,
  wort,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate, type Schritt, schrittMit, stability } from './support/vertrag';

afterEach(aufraeumen);

/** Verhalten des gefälschten Vitest-Läufers. */
interface Verhalten {
  exit: number;
  /** Bericht, den der Läufer an --outputFile.json schreibt (null: keiner). */
  bericht: unknown | null;
  dauerMs?: number;
  ausgabe?: string;
}

const FAELSCHUNG = [
  "import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
  "import { dirname, join, resolve } from 'node:path';",
  "import { fileURLToPath } from 'node:url';",
  'const hier = dirname(fileURLToPath(import.meta.url));',
  "const v = JSON.parse(readFileSync(join(hier, 'verhalten.json'), 'utf8'));",
  "appendFileSync(join(hier, 'aufrufe.log'), process.argv.slice(2).join('|') + '\\n');",
  "const arg = process.argv.find((a) => a.startsWith('--outputFile.json='));",
  "const ziel = arg === undefined ? null : resolve(process.cwd(), arg.slice('--outputFile.json='.length));",
  'await new Promise((r) => setTimeout(r, v.dauerMs ?? 0));',
  'if (ziel !== null && v.bericht !== null) {',
  '  mkdirSync(dirname(ziel), { recursive: true });',
  '  writeFileSync(ziel, JSON.stringify(v.bericht));',
  '}',
  "if (typeof v.ausgabe === 'string') process.stdout.write(v.ausgabe);",
  'process.exit(v.exit);',
  '',
].join('\n');

/** Legt den gefälschten Läufer node_modules/vitest/vitest.mjs (eigener Ordner, keine Verknüpfung) an. */
function faelschung(root: string, v: Verhalten): void {
  writeText(root, 'node_modules/vitest/vitest.mjs', FAELSCHUNG);
  writeText(root, 'node_modules/vitest/package.json', '{ "name": "vitest", "type": "module" }\n');
  writeText(root, 'node_modules/vitest/verhalten.json', `${JSON.stringify(v)}\n`);
}

/** Vitest-JSON-Bericht (Form wie der JSON-Reporter). */
function bericht(
  root: string,
  tests: { title: string; status: string; failureMessages?: string[] }[],
): unknown {
  return {
    numTotalTests: tests.length,
    testResults: [
      {
        name: join(root, 'tests', 'wap', 'unit', 'x.test.ts'),
        status: tests.some((t) => t.status === 'failed') ? 'failed' : 'passed',
        message: '',
        assertionResults: tests.map((t) => ({
          ancestorTitles: [],
          fullName: t.title,
          title: t.title,
          status: t.status,
          failureMessages: t.failureMessages ?? [],
        })),
      },
    ],
  };
}

const GRUEN = (root: string) => bericht(root, [{ title: '[R-1-01] grün', status: 'passed' }]);

/** Mini-Repo (fiktive Referenz-Sperre kommt aus miniRepo, TR-E101-202) mit WAP-Vitest-Konfiguration. */
function mini(sb: Sandbox, zweig = 'wap-planer'): string {
  prozessUmgebung(sb);
  const root = miniRepo(sb, 'mini', 'wap-planer');
  writeText(
    root,
    'vitest.wap.config.ts',
    "export default { test: { include: ['tests/wap/**/*.test.ts'], retry: 0 } };\n",
  );
  commitAlles(sb, root, 'Konfiguration');
  if (zweig !== 'wap-planer') git(sb, root, 'checkout', '-q', '-b', zweig);
  return root;
}

/** Laufendes Paket P9 in der Rot-Phase (Kästchen 7 offen), ID R-9-99 im Plan (ADR-010 §3.3). */
function rotPhase(sb: Sandbox, root: string): void {
  writeText(
    root,
    'docs/wap-planer/pakete/P9.md',
    '# Paket P9 – fiktiv\n\n- Etappe: 1\n- Anforderungen: R-9-99\n\n- [x] 6 Test-Freeze\n- [ ] 7 Umsetzung\n',
  );
  writeText(
    root,
    'docs/wap-planer/plan/etappe-1.md',
    '# Plan (fiktiv)\n\n## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)\n\n| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |\n| R-9-99 | P9 | Unit | – | – |\n',
  );
  commitAlles(sb, root, 'Paket P9');
}

function f8(e: GateErgebnis): Schritt {
  const s = schrittMit(e, 'F8');
  expect(s, 'Schritt F8 fehlt').toBeDefined();
  return s as Schritt;
}

function schritteMit(e: GateErgebnis, nummer: string): Schritt[] {
  const re = new RegExp(`^${nummer}(?![0-9a-z])`, 'i');
  return e.schritte.filter((s) => re.test(s.id));
}

async function schnell(sb: Sandbox, root: string, preCommit = false): Promise<GateErgebnis> {
  const { runGate } = await gate();
  return runGate('fast', {
    cwd: root,
    last: testLast(sb).last,
    ...(preCommit ? { preCommit } : {}),
  });
}

describe('CR-E101-01: F8 bewertet Bericht und Exit-Code des Läufers', () => {
  it(
    '[R-H-10][R-H-12] (A) alter grüner Bericht liegt da, Läufer endet mit Exit 1 ohne Bericht → F8 rot; der alte Bericht wurde vor dem Lauf gelöscht',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      writeText(root, 'test-results/wap/vitest.json', JSON.stringify(GRUEN(root)));
      faelschung(root, { exit: 1, bericht: null });
      const e = await schnell(sb, root);
      expect(f8(e).ok).toBe(false);
      expect(existsSync(join(root, 'test-results', 'wap', 'vitest.json'))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-10][R-H-12] (B) grüner Bericht mit Exit 0 → F8 grün; derselbe grüne Bericht mit Exit 1 (unbehandelter Fehler) → F8 rot',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      faelschung(root, { exit: 0, bericht: GRUEN(root) });
      expect(f8(await schnell(sb, root)).ok).toBe(true);
      faelschung(root, { exit: 1, bericht: GRUEN(root) });
      const rot = f8(await schnell(sb, root));
      expect(rot.ok).toBe(false);
      expect((rot.ursache ?? '').length).toBeGreaterThan(0);
    },
    LANG,
  );

  it(
    '[R-H-10] --pre-commit: alter grüner Bericht, Läufer Exit 1 ohne Bericht → F8 rot',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      writeText(root, 'test-results/wap/vitest.json', JSON.stringify(GRUEN(root)));
      faelschung(root, { exit: 1, bericht: null });
      expect(f8(await schnell(sb, root, true)).ok).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-12] Rot-Phase: Exit 1 erklärt durch einen fachlich roten Paket-Test → F8 grün; Exit 1 ohne roten Paket-Test (nur fremde grüne Tests) → F8 rot',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, 'wap/p9');
      rotPhase(sb, root);
      faelschung(root, {
        exit: 1,
        bericht: bericht(root, [
          {
            title: '[R-9-99] paket rot',
            status: 'failed',
            failureMessages: ['AssertionError: expected 1 to be 2'],
          },
          { title: '[R-1-01] fremd grün', status: 'passed' },
        ]),
      });
      const erklaert = f8(await schnell(sb, root));
      expect(erklaert.ok, schrittText(erklaert)).toBe(true);
      faelschung(root, { exit: 1, bericht: GRUEN(root) });
      expect(f8(await schnell(sb, root)).ok).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-12] Rot-Phase: roter Paket-Test, aber der Läufer meldet einen unbehandelten Fehler (Exit 1) → F8 rot',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, 'wap/p9');
      rotPhase(sb, root);
      faelschung(root, {
        exit: 1,
        bericht: bericht(root, [
          {
            title: '[R-9-99] paket rot',
            status: 'failed',
            failureMessages: ['AssertionError: expected 1 to be 2'],
          },
        ]),
        ausgabe:
          '\n⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯\n\nVitest caught 1 unhandled error during the test run.\nError: fiktiver Absturz\n',
      });
      expect(f8(await schnell(sb, root)).ok).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-15][R-H-12][R-H-28] volle Schleuse: alte grüne Berichte von V1, V1a, V3 und suite.json liegen da, jeder Läufer endet mit Exit 1 ohne Bericht → V1 und V1a rot, kein grünes V10-wap-anteil aus dem alten suite.json, V9 meldet fehlende Pflichtberichte',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const pkg = JSON.parse(readText(root, 'package.json')) as Record<string, unknown>;
      writeText(
        root,
        'package.json',
        `${JSON.stringify({ ...pkg, scripts: { test: 'node node_modules/vitest/vitest.mjs run' } }, null, 2)}\n`,
      );
      for (const konfig of [
        'vitest.wap-gate.config.ts',
        'vitest.wap-harness.config.ts',
        'vitest.wap-selbsttest.config.ts',
      ]) {
        writeText(root, konfig, 'export default { test: { retry: 0 } };\n');
      }
      commitAlles(sb, root, 'Konfigurationen, npm test');
      const alt = JSON.stringify(GRUEN(root));
      const berichte = [
        'vitest.json',
        'vitest-tz-utc.json',
        'vitest-tz-new-york.json',
        'vitest-gate.json',
        'vitest-harness.json',
        'vitest-selbsttest.json',
        'vitest-reference.json',
        'suite.json',
      ];
      for (const b of berichte) writeText(root, `test-results/wap/${b}`, alt);
      faelschung(root, { exit: 1, bericht: null });
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v1 = schritteMit(e, 'V1');
      expect(v1.length).toBeGreaterThan(0);
      expect(v1.some((s) => !s.ok)).toBe(true);
      const v1a = schritteMit(e, 'V1a');
      expect(v1a.length).toBeGreaterThan(0);
      expect(v1a.every((s) => !s.ok)).toBe(true);
      expect(e.schritte.filter((s) => /^V10-wap/i.test(s.id) && s.ok)).toEqual([]);
      const suite = join(root, 'test-results', 'wap', 'suite.json');
      expect(existsSync(suite) && readFileSync(suite, 'utf8') === alt).toBe(false);
      const v9 = schritteMit(e, 'V9')
        .filter((s) => !s.ok)
        .map((s) => schrittText(s))
        .join('\n');
      expect(v9).toMatch(/test-results\/wap\/vitest[a-z-]*\.json/);
    },
    LANG,
  );
});

describe('CR-E101-02: übersprungene Tests ausserhalb der Rot-Ausnahme', () => {
  it.each([['skipped'], ['pending'], [wort('to', 'do')]])(
    '[R-H-10][R-H-13] Bericht mit einem Test im Status %s (z.B. Laufzeit-Skip ctx.skip()), Exit 0 → F8 rot mit dem Testnamen',
    async (status) => {
      const sb = neueSandbox();
      const root = mini(sb);
      faelschung(root, {
        exit: 0,
        bericht: bericht(root, [
          { title: '[R-1-01] grün', status: 'passed' },
          { title: '[R-1-01] zur Laufzeit übersprungen', status },
        ]),
      });
      const s = f8(await schnell(sb, root));
      expect(s.ok).toBe(false);
      expect(schrittText(s)).toContain('zur Laufzeit übersprungen');
    },
    LANG,
  );
});

describe('CR-E101-04: Dauer eines Schritts = Laufzeit des Läufers + Auswertung', () => {
  it(
    '[R-H-10] Läufer braucht 1500 ms → F8.ms ≥ 1500',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      faelschung(root, { exit: 0, bericht: GRUEN(root), dauerMs: 1_500 });
      const s = f8(await schnell(sb, root));
      expect(s.ms).toBeGreaterThanOrEqual(1_500);
    },
    LANG,
  );
});

describe('CR-E101-08: F2-referenz läuft immer', () => {
  it(
    '[R-14-03] docs/wap-planer/reference-lock.json fehlt → F2-referenz rot mit Ursache, Abbruch nach F2',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'ohne-ref', 'wap-planer');
      // miniRepo legt eine fiktive Referenz-Sperre an; hier wird sie ausdrücklich entfernt (TR-E101-202).
      rmSync(join(root, ...MINI_REFERENCE_LOCK.split('/')));
      commitAlles(sb, root, 'Ohne Referenz-Sperre');
      const e = await schnell(sb, root);
      const ref = e.schritte.find((s) => s.id === 'F2-referenz');
      expect(ref, 'F2-referenz fehlt').toBeDefined();
      expect(ref?.ok).toBe(false);
      expect(schrittText(ref ?? {})).toContain('reference-lock.json');
      expect(schrittMit(e, 'F3')).toBeUndefined();
    },
    LANG,
  );
});

describe('CR-E101-03: Stabilitätslauf mit übersprungenen Tests', () => {
  /** Synthetisches Repo mit Suite- und WAP-Konfiguration (echtes Vitest über Verknüpfung). */
  function stabil(sb: Sandbox, suite: string, wap: string): string {
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'stabil-skip');
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
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs';\nimport { expect, it } from 'vitest';\n\n";
    writeText(root, 'tests/suite/s.test.ts', `${kopf}${suite}`);
    writeText(root, 'tests/wap/unit/w.test.ts', `// @vitest-environment node\n${kopf}${wap}`);
    nodeModules(root);
    commitAlles(sb, root, 'Stabilität');
    return root;
  }

  const GUT_SUITE = "it('suite gut', () => {\n  expect(1).toBe(1);\n});\n";
  const GUT_WAP = "it('[R-1-01] wap gut', () => {\n  expect(1).toBe(1);\n});\n";
  const IMMER_SKIP = (name: string) => `it.skip(${JSON.stringify(name)}, () => {});\n`;

  it(
    '[R-H-18] durchgehend übersprungener Suite-Test (gleicher Status in allen Läufen) → grün; derselbe Skip im WAP-Teil → rot; Statuswechsel zwischen Läufen → rot; durchgehend failed → rot',
    async () => {
      const { runStability } = await stability();
      const lauf = async (sb: Sandbox, root: string) =>
        runStability({ cwd: root, last: testLast(sb).last, profile: ['normal'] });

      const sbA = neueSandbox();
      const a = await lauf(
        sbA,
        stabil(sbA, GUT_SUITE + IMMER_SKIP('suite immer übersprungen'), GUT_WAP),
      );
      expect(a.ok, schrittText(a)).toBe(true);

      const sbB = neueSandbox();
      const b = await lauf(
        sbB,
        stabil(sbB, GUT_SUITE, GUT_WAP + IMMER_SKIP('[R-1-01] wap übersprungen')),
      );
      expect(b.ok).toBe(false);
      expect(schrittText(b)).toContain('wap übersprungen');

      const sbC = neueSandbox();
      const zaehler = join(sbC.base, 'zaehler-wechsel.txt');
      const wechsel = [
        "it('suite wechselt', (ctx) => {",
        `  const datei = ${JSON.stringify(zaehler)};`,
        "  const n = existsSync(datei) ? Number(readFileSync(datei, 'utf8')) + 1 : 1;",
        '  writeFileSync(datei, String(n));',
        '  if (n === 2) ctx.skip();',
        '  expect(n).toBeGreaterThan(0);',
        '});',
        '',
      ].join('\n');
      const c = await lauf(sbC, stabil(sbC, GUT_SUITE + wechsel, GUT_WAP));
      expect(c.ok).toBe(false);
      expect(schrittText(c)).toContain('suite wechselt');

      const sbD = neueSandbox();
      const immerRot = "it('suite immer rot', () => {\n  expect(1).toBe(2);\n});\n";
      const d = await lauf(sbD, stabil(sbD, GUT_SUITE + immerRot, GUT_WAP));
      expect(d.ok).toBe(false);
      expect(schrittText(d)).toContain('suite immer rot');
    },
    LANG,
  );
});

describe('E1-01-22: V3-Bericht und Ausgabe ohne Meldungstexte roter Referenztests', () => {
  it(
    '[R-H-24][R-H-28] roter Referenztest mit fiktivem Text in der Fehlermeldung → V3 rot; weder test-results/wap/vitest-reference.json noch das Ergebnis der Schleuse enthalten den Text',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const merkmal = ['Zellinhalt', 'Fiktiv', 'Q7'].join('-');
      kopiereAusWt(root, 'vitest.wap-reference.config.ts');
      cpSync(join(WT, 'scripts', 'wap-gate'), join(root, 'scripts', 'wap-gate'), {
        recursive: true,
      });
      writeText(
        root,
        'tests/wap/reference/required-files.json',
        `${JSON.stringify({ version: 1, dateien: [MINI_ANHANG] }, null, 2)}\n`,
      );
      writeText(
        root,
        'tests/wap/reference/zz.ref.ts',
        `// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-1-01] referenz rot', () => {\n  expect(${JSON.stringify(merkmal)}).toBe('anders');\n});\n`,
      );
      nodeModules(root);
      commitAlles(sb, root, 'Referenztest');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v3 = schritteMit(e, 'V3');
      expect(v3.length).toBeGreaterThan(0);
      expect(v3.some((s) => !s.ok)).toBe(true);
      const bericht3 = join(root, 'test-results', 'wap', 'vitest-reference.json');
      expect(existsSync(bericht3), 'V3-Bericht fehlt').toBe(true);
      const text3 = readFileSync(bericht3, 'utf8');
      expect(text3.includes(merkmal), 'Meldungstext im V3-Bericht').toBe(false);
      // Der Bericht ist nicht leer: Testname, Status und Anzahl bleiben (Entscheid E1-01-22, TR-E101-206).
      const d3 = JSON.parse(text3) as {
        testResults?: { assertionResults?: { title?: string; status?: string }[] }[];
      };
      const tests3 = (d3.testResults ?? []).flatMap((f) => f.assertionResults ?? []);
      expect(tests3.length).toBe(1);
      expect(tests3[0]?.title ?? '').toContain('[R-1-01] referenz rot');
      expect(tests3[0]?.status).toBe('failed');
      expect(JSON.stringify(e).includes(merkmal), 'Meldungstext im Ergebnis der Schleuse').toBe(
        false,
      );
    },
    LANG,
  );
});

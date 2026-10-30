// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Fälle unverändert aus der gleichnamigen .gate.ts
// verschoben, weil sie ganze Schleusen, Browser, Stryker oder einen Build starten.

// Mutationstests (ADR-010 §6.3): Stryker mit Vitest-Läufer, Schwelle break 80, Berichte unter
// test-results/wap/stryker/; Beispielmodul unter 80 % → rot, gut getestet → grün.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 (stryker.wap.conf.mjs).
// Synthetisches Repo mit der Stryker-Konfiguration des Pakets (Kopie), eigener Minimal-Vitest-
// Konfiguration und einem fiktiven Beispielmodul in der Mutations-Pfadmenge.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  kopiereAusWt,
  LANG,
  lauf,
  neueSandbox,
  neuesRepo,
  nodeModules,
  type Sandbox,
  WT,
  writeText,
} from './support/umgebung';

afterEach(aufraeumen);

const MODUL = [
  'export function einstufen(n: number): string {',
  '  if (n < 0) {',
  "    return 'negativ';",
  '  }',
  '  if (n === 0) {',
  "    return 'null';",
  '  }',
  '  if (n > 100) {',
  "    return 'gross';",
  '  }',
  "  return 'positiv';",
  '}',
  '',
  'export function summe(a: number, b: number): number {',
  '  return a + b;',
  '}',
  '',
].join('\n');

// F-TOOLS3 (FT3-04): Importpfad von tests/wap/unit/model/ aus vier Ebenen hoch; mit drei Ebenen fand der Test das
// Modul nicht, «stark» deckte keinen Mutanten, und «schwach» war aus diesem Grund rot statt wegen des Tests.
const KOPF =
  "// @vitest-environment node\nimport { expect, it } from 'vitest';\nimport { einstufen, summe } from '../../../../src/model/wap/beispiel';\n\n";

const SCHWACH = `${KOPF}it('[R-1-01] schwach', () => {\n  expect(typeof einstufen(5)).toBe('string');\n  expect(typeof summe(1, 1)).toBe('number');\n});\n`;

const STARK = `${KOPF}it('[R-1-01] stark', () => {\n  expect(einstufen(-1)).toBe('negativ');\n  expect(einstufen(0)).toBe('null');\n  expect(einstufen(1)).toBe('positiv');\n  expect(einstufen(100)).toBe('positiv');\n  expect(einstufen(101)).toBe('gross');\n  expect(summe(2, 3)).toBe(5);\n});\n`;

function repo(sb: Sandbox, test: string): string {
  const root = neuesRepo(sb, 'mutation');
  kopiereAusWt(root, 'stryker.wap.conf.mjs');
  kopiereAusWt(root, 'vitest.wap-stryker.config.ts');
  kopiereAusWt(root, 'scripts/wap-gate/stryker-vitest-wap.mjs');
  for (const rel of ['tsconfig.json', 'tsconfig.wap.json']) {
    if (existsSync(join(WT, rel))) kopiereAusWt(root, rel);
  }
  writeText(
    root,
    'vitest.wap.config.ts',
    "export default { test: { include: ['tests/wap/**/*.test.ts'], environment: 'node', retry: 0 } };\n",
  );
  writeText(root, 'src/model/wap/beispiel.ts', MODUL);
  writeText(root, 'tests/wap/unit/model/beispiel.test.ts', test);
  nodeModules(root);
  commitAlles(sb, root, 'Mutation');
  return root;
}

function stryker(sb: Sandbox, root: string) {
  return lauf(
    process.execPath,
    [
      join(root, 'node_modules', '@stryker-mutator', 'core', 'bin', 'stryker.js'),
      'run',
      'stryker.wap.conf.mjs',
    ],
    { cwd: root, env: sb.env, timeout: LANG },
  );
}

function berichte(root: string): string[] {
  const dir = join(root, 'test-results', 'wap', 'stryker');
  if (!existsSync(dir)) return [];
  const alle = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? alle(p) : [p];
    });
  return alle(dir);
}

describe('Stryker mit stryker.wap.conf.mjs', () => {
  it(
    '[R-H-17] Beispielmodul mit schwachem Test (Mutationsscore unter 80 %) → Stryker rot (break 80); Bericht unter test-results/wap/stryker/',
    () => {
      const sb = neueSandbox();
      const root = repo(sb, SCHWACH);
      const r = stryker(sb, root);
      expect(r.status, r.out).not.toBe(0);
      expect(r.out).toMatch(/break|threshold|Schwelle/i);
      expect(berichte(root).length).toBeGreaterThan(0);
    },
    LANG,
  );

  it(
    '[R-H-17] Beispielmodul mit Grenzwert-Tests (alle Mutanten getötet) → Stryker grün',
    () => {
      const sb = neueSandbox();
      const root = repo(sb, STARK);
      const r = stryker(sb, root);
      expect(r.status, r.out).toBe(0);
      expect(berichte(root).length).toBeGreaterThan(0);
    },
    LANG,
  );
});

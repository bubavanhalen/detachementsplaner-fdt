// Rückverfolgbarkeit V9 ab E1-01b (ADR-010 §5, Änderungsnotiz AE-001 §1 V9 «E1-01b und c: zusätzlich
// playwright.json»; R-H-11, R-H-15): Nennt die Playwright-Liste (F9) Tests, ist test-results/wap/playwright.json
// im vollen Modus Pflicht (fehlt → rot mit Pfad) und belegt die IDs seiner Tests. Ohne Playwright-Tests bleibt
// der Bericht freiwillig (eingefrorener Fall in trace.gate.ts).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §1 (V9), E1-01 §9 Nr 10. Synthetisches Repo mit
// eigenem Katalog, Plan-Anhang und Paket-Checklisten; nur fiktive IDs und Tests.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  LANG,
  lauf,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { traceModul } from './support/vertrag';

afterEach(aufraeumen);

const KOPF_KATALOG =
  '| ID | Stelle | Wortlaut | Et. | Prüfart | Abnahmekriterium | Beispiel (FDT 2026) |\n| --- | --- | --- | --- | --- | --- | --- |';
const KOPF_PLAN =
  '| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |';

const E2E_ID = 'R-9-08';

const EINTRAEGE = [
  { id: 'R-9-01', paket: 'E1-91', testart: 'Unit' },
  { id: E2E_ID, paket: 'E1-91', testart: 'Integration' },
  { id: 'R-9-02', paket: 'E1-92', testart: 'Unit' },
];

function katalog(): string {
  const zeilen = EINTRAEGE.map(
    (e) =>
      `| ${e.id} | 9 Test | Fiktive Anforderung ${e.id}. | 1 | ${e.testart} | Fiktives Kriterium | – |`,
  );
  return `# Anforderungskatalog (fiktiv)\n\n## 9 Test\n\n${KOPF_KATALOG}\n${zeilen.join('\n')}\n`;
}

function plan(): string {
  return [
    '# Etappenplan 1 (fiktiv)',
    '',
    '## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)',
    '',
    KOPF_PLAN,
    ...EINTRAEGE.map((e) => `| ${e.id} | ${e.paket} | ${e.testart} | – | – |`),
    '',
    '## Anhang B – Vorgeschlagene Werkzeug- und Leitplanken-IDs (Etappe 1)',
    '',
    KOPF_PLAN,
    '',
    '## Anhang C – Zählungen',
    '',
    'Keine.',
    '',
  ].join('\n');
}

function paketDatei(name: string, ids: string[], eingefroren: boolean): string {
  const x = eingefroren ? 'x' : ' ';
  return [
    `# Paket ${name} – fiktiv`,
    '',
    '- Etappe: 1',
    `- Anforderungen: ${ids.join(', ')}`,
    '',
    '- [x] 1 Paket-Worktree angelegt und installiert',
    '- [x] 2 Schnittstellenvertrag und Stubs',
    '- [x] 3 Tests',
    '- [x] 4 Test-Review',
    '- [x] 5 Rot-Nachweis',
    `- [${x}] 6 Test-Freeze: Commit mit Tests, Stubs, Vertrag, test-lock.json`,
    `- [${x}] 7 Umsetzung`,
    '- [ ] 13 Integration',
    '',
  ].join('\n');
}

const UNIT = (namen: string[]) =>
  `// @vitest-environment node\nimport { expect, it } from 'vitest';\n\n${namen
    .map((n) => `it(${JSON.stringify(n)}, () => {\n  expect(1).toBe(1);\n});\n`)
    .join('\n')}`;

const KONFIG = (include: string) =>
  `export default {\n  test: { include: [${JSON.stringify(include)}], environment: 'node', retry: 0 },\n};\n`;

/** Synthetisches Repo auf wap/e1-92; E1-91 eingefroren mit einer Unit- und einer Playwright-ID. */
function traceRepo(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'trace-b', 'wap/e1-92');
  writeText(root, 'docs/wap-planer/requirements.md', katalog());
  writeText(root, 'docs/wap-planer/plan/etappe-1.md', plan());
  writeText(root, 'docs/wap-planer/pakete/E1-91.md', paketDatei('E1-91', ['R-9-01', E2E_ID], true));
  writeText(root, 'docs/wap-planer/pakete/E1-92.md', paketDatei('E1-92', ['R-9-02'], false));
  writeText(root, 'vitest.wap.config.ts', KONFIG('tests/wap/**/*.test.ts'));
  writeText(root, 'vitest.wap-reference.config.ts', KONFIG('tests/wap/reference/**/*.ref.ts'));
  writeText(root, 'vitest.wap-golden.config.ts', KONFIG('tests/wap/golden/**/*.golden.ts'));
  writeText(root, 'vitest.wap-gate.config.ts', KONFIG('tests/wap-gate/**/*.gate.ts'));
  writeText(root, 'vitest.wap-selbsttest.config.ts', KONFIG('tests/wap-gate/**/*.selbsttest.ts'));
  writeText(root, 'vitest.wap-harness.config.ts', KONFIG('tests/wap-harness/**/*.harness.ts'));
  writeText(
    root,
    'playwright.wap.config.ts',
    [
      'export default {',
      "  testDir: 'tests/wap-e2e',",
      "  testMatch: '**/*.spec.ts',",
      '  retries: 0,',
      '  forbidOnly: true,',
      "  outputDir: 'test-results/wap/playwright-ausgabe',",
      "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
      '};',
      '',
    ].join('\n'),
  );
  writeText(root, 'tests/wap/unit/e1-91.test.ts', UNIT(['[R-9-01] eingefroren belegt']));
  writeText(root, 'tests/wap/unit/e1-92.test.ts', UNIT(['[R-9-02] laufendes Paket']));
  writeText(
    root,
    'tests/wap-e2e/probe.spec.ts',
    [
      "import { expect, test } from '@playwright/test';",
      '',
      `test('[${E2E_ID}] Ende-zu-Ende fiktiv', () => {`,
      '  expect(1).toBe(1);',
      '});',
      '',
    ].join('\n'),
  );
  nodeModules(root);
  commitAlles(sb, root, 'Trace-Projekt mit Playwright-Test');
  return root;
}

/** Vitest-Berichte von V1, V1a und V3 (wie die Schleuse) im synthetischen Repo. */
function vitestBerichte(sb: Sandbox, root: string): void {
  for (const [konfig, datei] of [
    ['vitest.wap.config.ts', 'vitest.json'],
    ['vitest.wap-gate.config.ts', 'vitest-gate.json'],
    ['vitest.wap-harness.config.ts', 'vitest-harness.json'],
    ['vitest.wap-selbsttest.config.ts', 'vitest-selbsttest.json'],
    ['vitest.wap-reference.config.ts', 'vitest-reference.json'],
  ] as const) {
    const rel = `test-results/wap/${datei}`;
    lauf(
      process.execPath,
      [
        join(root, 'node_modules', 'vitest', 'vitest.mjs'),
        'run',
        '-c',
        konfig,
        '--passWithNoTests',
        '--reporter=json',
        `--outputFile=${rel}`,
      ],
      { cwd: root, env: { ...sb.env, VITEST_MAX_WORKERS: '4' }, timeout: LANG },
    );
    expect(existsSync(join(root, ...rel.split('/'))), `Test-Aufbau: ${rel} fehlt`).toBe(true);
  }
}

describe('trace voll: playwright.json Pflicht, sobald die Playwright-Liste Tests nennt', () => {
  it(
    '[R-H-11][R-H-15] Playwright-Liste mit einem Test, alle Vitest-Berichte vorhanden, playwright.json fehlt → rot mit Pfad',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      vitestBerichte(sb, root);
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'full' });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('test-results/wap/playwright.json');
    },
    LANG,
  );

  it(
    '[R-H-11][R-H-15] dazu playwright.json aus einem echten Playwright-Lauf → grün, Playwright-ID belegt',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      const pw = lauf(
        process.execPath,
        [
          join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
          'test',
          '-c',
          'playwright.wap.config.ts',
        ],
        { cwd: root, env: sb.env, timeout: LANG },
      );
      expect(pw.status, pw.out).toBe(0);
      expect(existsSync(join(root, 'test-results', 'wap', 'playwright.json'))).toBe(true);
      vitestBerichte(sb, root);
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'full' });
      expect(r.ok, schrittText(r)).toBe(true);
      const zeile = r.matrix.ids.find((x) => x.id === E2E_ID);
      expect(zeile?.status).toBe('belegt');
      expect(zeile?.tests.some((t) => t.includes('Ende-zu-Ende fiktiv'))).toBe(true);
    },
    LANG,
  );
});

// Rückverfolgbarkeit V9 ab E1-01c (ADR-010 §5, Änderungsnotiz AE-001 §1 V9; R-H-15, R-H-21, R-H-22): Ein
// Pflichtbericht je Projektgruppe gilt nur, wenn die Playwright-Liste dort Tests nennt – funktionale Projekte
// → test-results/wap/playwright.json, chromium-visual → playwright-visual.json, perf → playwright-perf.json.
// Fehlt ein Pflichtbericht → rot mit Pfad; vorhandene Berichte belegen die IDs ihrer Tests.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.1 «trace.mjs (V9)», §3 (trace-c.gate.ts).
// Synthetisches Repo mit eigenem Katalog, Plan-Anhang und Paket-Checklisten (Muster trace-b.gate.ts); die
// Playwright-Berichte stammen aus echten Läufen ohne Browser. Nur fiktive IDs und Tests.
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
import { pwKonfigC } from './support/vertrag-c';

afterEach(aufraeumen);

const KOPF_KATALOG =
  '| ID | Stelle | Wortlaut | Et. | Prüfart | Abnahmekriterium | Beispiel (FDT 2026) |\n| --- | --- | --- | --- | --- | --- | --- |';
const KOPF_PLAN =
  '| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |';

interface Eintrag {
  id: string;
  paket: string;
  testart: string;
}

const BASIS: Eintrag[] = [
  { id: 'R-9-01', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-9-08', paket: 'E1-91', testart: 'Integration' },
  { id: 'R-9-02', paket: 'E1-92', testart: 'Unit' },
];
const VISUAL: Eintrag = { id: 'R-9-21', paket: 'E1-91', testart: 'E2E' };
const PERF: Eintrag = { id: 'R-9-22', paket: 'E1-91', testart: 'Integration-Leistung' };

function katalog(eintraege: Eintrag[]): string {
  const zeilen = eintraege.map(
    (e) =>
      `| ${e.id} | 9 Test | Fiktive Anforderung ${e.id}. | 1 | ${e.testart} | Fiktives Kriterium | – |`,
  );
  return `# Anforderungskatalog (fiktiv)\n\n## 9 Test\n\n${KOPF_KATALOG}\n${zeilen.join('\n')}\n`;
}

function plan(eintraege: Eintrag[]): string {
  return [
    '# Etappenplan 1 (fiktiv)',
    '',
    '## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)',
    '',
    KOPF_PLAN,
    ...eintraege.map((e) => `| ${e.id} | ${e.paket} | ${e.testart} | – | – |`),
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

const SPEC = (titel: string) =>
  [
    "import { expect, test } from '@playwright/test';",
    '',
    `test(${JSON.stringify(titel)}, () => {`,
    '  expect(1).toBe(1);',
    '});',
    '',
  ].join('\n');

/** Katalog, Plan und Checklisten für die angegebenen Einträge (E1-91 eingefroren, laufendes Paket E1-92). */
function schreibeKatalog(root: string, eintraege: Eintrag[]): void {
  writeText(root, 'docs/wap-planer/requirements.md', katalog(eintraege));
  writeText(root, 'docs/wap-planer/plan/etappe-1.md', plan(eintraege));
  const ids = (p: string) => eintraege.filter((e) => e.paket === p).map((e) => e.id);
  writeText(root, 'docs/wap-planer/pakete/E1-91.md', paketDatei('E1-91', ids('E1-91'), true));
  writeText(root, 'docs/wap-planer/pakete/E1-92.md', paketDatei('E1-92', ids('E1-92'), false));
}

/** Synthetisches Repo auf wap/e1-92 mit Projekten edge, chromium-visual und perf; nur funktionale Tests. */
function traceRepo(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'trace-c', 'wap/e1-92');
  schreibeKatalog(root, BASIS);
  writeText(root, 'vitest.wap.config.ts', KONFIG('tests/wap/**/*.test.ts'));
  writeText(root, 'vitest.wap-reference.config.ts', KONFIG('tests/wap/reference/**/*.ref.ts'));
  writeText(root, 'vitest.wap-golden.config.ts', KONFIG('tests/wap/golden/**/*.golden.ts'));
  writeText(root, 'vitest.wap-gate.config.ts', KONFIG('tests/wap-gate/**/*.gate.ts'));
  writeText(root, 'vitest.wap-selbsttest.config.ts', KONFIG('tests/wap-gate/**/*.selbsttest.ts'));
  writeText(root, 'vitest.wap-harness.config.ts', KONFIG('tests/wap-harness/**/*.harness.ts'));
  writeText(root, 'playwright.wap.config.ts', pwKonfigC(['edge', 'chromium-visual', 'perf']));
  writeText(root, 'tests/wap/unit/e1-91.test.ts', UNIT(['[R-9-01] eingefroren belegt']));
  writeText(root, 'tests/wap/unit/e1-92.test.ts', UNIT(['[R-9-02] laufendes Paket']));
  writeText(root, 'tests/wap-e2e/probe.spec.ts', SPEC('[R-9-08] Ende-zu-Ende fiktiv'));
  nodeModules(root);
  commitAlles(sb, root, 'Trace-Projekt E1-01c');
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

/** Playwright-Lauf eines Projekts (ohne Browser) mit Bericht nach `bericht` (WAP_PLAYWRIGHT_BERICHT). */
function playwrightBericht(sb: Sandbox, root: string, projekt: string, bericht: string): void {
  const r = lauf(
    process.execPath,
    [
      join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '-c',
      'playwright.wap.config.ts',
      '--project',
      projekt,
    ],
    { cwd: root, env: { ...sb.env, WAP_PLAYWRIGHT_BERICHT: bericht }, timeout: LANG },
  );
  expect(r.status, `Test-Aufbau: Playwright ${projekt}`).toBe(0);
  expect(existsSync(join(root, ...bericht.split('/'))), `Test-Aufbau: ${bericht} fehlt`).toBe(true);
}

async function traceVoll(root: string) {
  const { trace } = await traceModul();
  return trace({ cwd: root, modus: 'full' });
}

describe('trace voll: Pflichtbericht je Projektgruppe nur bei Tests im Projekt', () => {
  it(
    '[R-H-21][R-H-15] nur funktionale Tests → nur playwright.json Pflicht (grün ohne playwright-visual.json); mit einem Test in chromium-visual ohne playwright-visual.json → rot mit Pfad; mit Bericht → grün, ID belegt',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      vitestBerichte(sb, root);
      playwrightBericht(sb, root, 'edge', 'test-results/wap/playwright.json');
      const nurFunktional = await traceVoll(root);
      expect(nurFunktional.ok, schrittText(nurFunktional)).toBe(true);

      schreibeKatalog(root, [...BASIS, VISUAL]);
      writeText(
        root,
        'tests/wap-e2e/probe.visual.spec.ts',
        SPEC(`[${VISUAL.id}] Kernzustand fiktiv`),
      );
      commitAlles(sb, root, 'Test in chromium-visual');
      const ohne = await traceVoll(root);
      expect(ohne.ok).toBe(false);
      expect(schrittText(ohne)).toContain('test-results/wap/playwright-visual.json');
      expect(schrittText(ohne)).not.toContain('test-results/wap/playwright-perf.json');

      playwrightBericht(sb, root, 'chromium-visual', 'test-results/wap/playwright-visual.json');
      const mit = await traceVoll(root);
      expect(mit.ok, schrittText(mit)).toBe(true);
      const zeile = mit.matrix.ids.find((x) => x.id === VISUAL.id);
      expect(zeile?.status).toBe('belegt');
      expect(zeile?.tests.some((t) => t.includes('Kernzustand fiktiv'))).toBe(true);
    },
    LANG,
  );

  it(
    '[R-H-22][R-H-15] mit einem Test im Projekt perf ohne playwright-perf.json → rot mit Pfad; mit Bericht → grün, ID belegt; ohne Test in perf keine Pflicht',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      vitestBerichte(sb, root);
      playwrightBericht(sb, root, 'edge', 'test-results/wap/playwright.json');
      const nurFunktional = await traceVoll(root);
      expect(nurFunktional.ok, schrittText(nurFunktional)).toBe(true);

      schreibeKatalog(root, [...BASIS, PERF]);
      writeText(root, 'tests/wap-perf/probe.perf.ts', SPEC(`[${PERF.id}] Leistung fiktiv`));
      commitAlles(sb, root, 'Test im Projekt perf');
      const ohne = await traceVoll(root);
      expect(ohne.ok).toBe(false);
      expect(schrittText(ohne)).toContain('test-results/wap/playwright-perf.json');
      expect(schrittText(ohne)).not.toContain('test-results/wap/playwright-visual.json');

      playwrightBericht(sb, root, 'perf', 'test-results/wap/playwright-perf.json');
      const mit = await traceVoll(root);
      expect(mit.ok, schrittText(mit)).toBe(true);
      const zeile = mit.matrix.ids.find((x) => x.id === PERF.id);
      expect(zeile?.status).toBe('belegt');
      expect(zeile?.tests.some((t) => t.includes('Leistung fiktiv'))).toBe(true);
    },
    LANG,
  );
});

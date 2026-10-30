// Rückverfolgbarkeit F9/V9 (ADR-010 §5): Matrix Anforderung → Tests; rot bei Test ohne ID, unbekannter
// ID, ID eines nicht eingefrorenen fremden Pakets, ID eines eingefrorenen Pakets ohne Test am passenden
// Testort, fehlendem positivem/negativem Test je Prüfregel und abweichender Paketliste.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (trace), §4 (req), §9 Nr 10 und Änderungsnotiz
// AE-001 §2, §3 (IDs aus *.selbsttest.ts, Pflichtberichte von E1-01-min, *.entwurf.ts ohne Testliste).
// Synthetisches Repo mit eigenem Katalog, Plan-Anhang, Paket-Checklisten und Testkonfigurationen.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { req } from '../wap/support/common/ids';
import {
  aufraeumen,
  commitAlles,
  lauf,
  MITTEL,
  neueSandbox,
  neuesRepo,
  node,
  nodeModules,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { traceModul } from './support/vertrag';

afterEach(aufraeumen);

const KOPF_KATALOG =
  '| ID | Stelle | Wortlaut | Et. | Prüfart | Abnahmekriterium | Beispiel (FDT 2026) |\n| --- | --- | --- | --- | --- | --- | --- |';
const KOPF_PLAN =
  '| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |';

interface Eintrag {
  id: string;
  paket: string;
  testart: string;
  etappe?: number;
  verweis?: string;
}

const EINTRAEGE: Eintrag[] = [
  { id: 'R-9-01', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-9-03', paket: 'E1-91', testart: 'Auftraggeber' },
  { id: 'R-9-04', paket: 'E1-91', testart: 'Verweis', verweis: 'R-9-01' },
  { id: 'R-7-10', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-7-11', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-7-12', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-7-13', paket: 'E1-91', testart: 'Unit' },
  { id: 'R-9-02', paket: 'E1-92', testart: 'Unit' },
  { id: 'R-9-06', paket: 'E1-93', testart: 'Unit' },
];

function katalog(eintraege: Eintrag[]): string {
  const zeilen = eintraege.map(
    (e) =>
      `| ${e.id} | 9 Test | Fiktive Anforderung ${e.id}. | ${String(e.etappe ?? 1)} | ${e.testart} | Fiktives Kriterium | – |`,
  );
  zeilen.push(
    '| R-9-05 | 9 Test | Fiktive Anforderung der Etappe 2. | 2 | Unit | Fiktives Kriterium | – |',
  );
  return `# Anforderungskatalog (fiktiv)\n\n## 9 Test\n\n${KOPF_KATALOG}\n${zeilen.join('\n')}\n`;
}

function plan(eintraege: Eintrag[]): string {
  const zeilen = eintraege.map(
    (e) => `| ${e.id} | ${e.paket} | ${e.testart} | ${e.verweis ?? '–'} | – |`,
  );
  return [
    '# Etappenplan 1 (fiktiv)',
    '',
    '## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)',
    '',
    KOPF_PLAN,
    ...zeilen,
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
  return [
    `# Paket ${name} – fiktiv`,
    '',
    '- Etappe: 1',
    `- Anforderungen: ${ids.join(', ')}`,
    '',
    `- [x] 1 Paket-Worktree angelegt und installiert`,
    `- [x] 2 Schnittstellenvertrag und Stubs`,
    `- [x] 3 Tests`,
    `- [x] 4 Test-Review`,
    `- [x] 5 Rot-Nachweis`,
    `- [${eingefroren ? 'x' : ' '}] 6 Test-Freeze: Commit mit Tests, Stubs, Vertrag, test-lock.json`,
    `- [${eingefroren ? 'x' : ' '}] 7 Umsetzung`,
    '- [ ] 13 Integration',
    '',
  ].join('\n');
}

const UNIT_KOPF = "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\n";

function unitTest(namen: string[]): string {
  return `${UNIT_KOPF}${namen.map((n) => `it(${JSON.stringify(n)}, () => {\n  expect(1).toBe(1);\n});\n`).join('\n')}`;
}

const KONFIG = (include: string) =>
  `export default {\n  test: { include: [${JSON.stringify(include)}], environment: 'node', retry: 0 },\n};\n`;

/** Synthetisches Repo auf Zweig wap/e1-92 (laufendes Paket), E1-91 eingefroren, E1-93 nicht. */
function traceRepo(sb: Sandbox, eintraege: Eintrag[] = EINTRAEGE): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'trace', 'wap/e1-92');
  writeText(root, 'docs/wap-planer/requirements.md', katalog(eintraege));
  writeText(root, 'docs/wap-planer/plan/etappe-1.md', plan(eintraege));
  writeText(
    root,
    'docs/wap-planer/pakete/E1-91.md',
    paketDatei(
      'E1-91',
      ['R-9-01', 'R-9-03', 'R-9-04', 'R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'],
      true,
    ),
  );
  writeText(root, 'docs/wap-planer/pakete/E1-92.md', paketDatei('E1-92', ['R-9-02'], false));
  writeText(root, 'docs/wap-planer/pakete/E1-93.md', paketDatei('E1-93', ['R-9-06'], false));
  writeText(root, 'vitest.wap.config.ts', KONFIG('tests/wap/**/*.test.ts'));
  writeText(root, 'vitest.wap-reference.config.ts', KONFIG('tests/wap/reference/**/*.ref.ts'));
  writeText(root, 'vitest.wap-golden.config.ts', KONFIG('tests/wap/golden/**/*.golden.ts'));
  writeText(root, 'vitest.wap-gate.config.ts', KONFIG('tests/wap-gate/**/*.gate.ts'));
  writeText(root, 'vitest.wap-selbsttest.config.ts', KONFIG('tests/wap-gate/**/*.selbsttest.ts'));
  writeText(root, 'vitest.wap-harness.config.ts', KONFIG('tests/wap-harness/**/*.harness.ts'));
  writeText(
    root,
    'playwright.wap.config.ts',
    "export default { testDir: 'tests', testMatch: ['wap-e2e/**/*.spec.ts', 'wap-perf/**/*.perf.ts'], retries: 0, forbidOnly: true };\n",
  );
  const regeln = ['R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'].flatMap((id) => [
    `[${id}] Regel (positiv)`,
    `[${id}] Regel (negativ)`,
  ]);
  writeText(
    root,
    'tests/wap/unit/e1-91.test.ts',
    unitTest(['[R-9-01] eingefroren belegt', ...regeln]),
  );
  writeText(root, 'tests/wap/unit/e1-92.test.ts', unitTest(['[R-9-02] laufendes Paket']));
  nodeModules(root);
  commitAlles(sb, root, 'Trace-Projekt');
  return root;
}

async function spur(root: string, modus: 'fast' | 'full' = 'fast') {
  const { trace } = await traceModul();
  return trace({ cwd: root, modus });
}

describe('trace fast: grüner Stand und Matrix', () => {
  it(
    '[R-H-15] alle Regeln erfüllt → grün; Matrix mit Status belegt, auftraggeber, verweis und den Testnamen',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      const r = await spur(root);
      expect(r.ok).toBe(true);
      const zeile = (id: string) => r.matrix.ids.find((x) => x.id === id);
      expect(zeile('R-9-01')?.status).toBe('belegt');
      expect(zeile('R-9-01')?.paket).toBe('E1-91');
      expect(zeile('R-9-01')?.testart).toBe('Unit');
      expect(zeile('R-9-01')?.tests.some((t) => t.includes('[R-9-01] eingefroren belegt'))).toBe(
        true,
      );
      expect(zeile('R-9-03')?.status).toBe('auftraggeber');
      expect(zeile('R-9-04')?.status).toBe('verweis');
      expect(zeile('R-7-10')?.tests.length).toBe(2);
    },
    MITTEL,
  );
});

describe('trace fast: je Regel ein Verstoss → rot', () => {
  it.each([
    [
      'Test ohne ID (S5)',
      (root: string) =>
        writeText(root, 'tests/wap/unit/ohne.test.ts', unitTest(['ohne jede Kennung'])),
      'ohne jede Kennung',
    ],
    [
      'unbekannte ID',
      (root: string) =>
        writeText(root, 'tests/wap/unit/unbekannt.test.ts', unitTest(['[R-9-77] unbekannt'])),
      'R-9-77',
    ],
    [
      'ID eines nicht eingefrorenen fremden Pakets',
      (root: string) =>
        writeText(root, 'tests/wap/unit/fremd.test.ts', unitTest(['[R-9-06] künftiges Paket'])),
      'R-9-06',
    ],
    [
      'ID einer späteren Etappe',
      (root: string) =>
        writeText(root, 'tests/wap/unit/spaeter.test.ts', unitTest(['[R-9-05] Etappe 2'])),
      'R-9-05',
    ],
    [
      'ID eines eingefrorenen Pakets ohne Test',
      (root: string) => {
        const regeln = ['R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'].flatMap((id) => [
          `[${id}] Regel (positiv)`,
          `[${id}] Regel (negativ)`,
        ]);
        writeText(root, 'tests/wap/unit/e1-91.test.ts', unitTest(regeln));
      },
      'R-9-01',
    ],
    [
      'Test am falschen Testort (Unit-ID nur unter integration)',
      (root: string) => {
        const regeln = ['R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'].flatMap((id) => [
          `[${id}] Regel (positiv)`,
          `[${id}] Regel (negativ)`,
        ]);
        writeText(root, 'tests/wap/unit/e1-91.test.ts', unitTest(regeln));
        writeText(root, 'tests/wap/integration/ort.test.ts', unitTest(['[R-9-01] falscher Ort']));
      },
      'R-9-01',
    ],
    [
      'Prüfregel ohne negativen Test',
      (root: string) => {
        const regeln = ['R-7-11', 'R-7-12', 'R-7-13'].flatMap((id) => [
          `[${id}] Regel (positiv)`,
          `[${id}] Regel (negativ)`,
        ]);
        writeText(
          root,
          'tests/wap/unit/e1-91.test.ts',
          unitTest(['[R-9-01] eingefroren belegt', '[R-7-10] Regel (positiv)', ...regeln]),
        );
      },
      'R-7-10',
    ],
    [
      'Paket-Checkliste nennt eine andere ID-Menge als der Plan',
      (root: string) =>
        writeText(
          root,
          'docs/wap-planer/pakete/E1-91.md',
          paketDatei('E1-91', ['R-9-01', 'R-9-03', 'R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'], true),
        ),
      'E1-91',
    ],
    [
      'Zuordnungstabelle nennt eine ID doppelt',
      (root: string) =>
        writeText(
          root,
          'docs/wap-planer/plan/etappe-1.md',
          plan([...EINTRAEGE, { id: 'R-9-01', paket: 'E1-92', testart: 'Unit' }]),
        ),
      'R-9-01',
    ],
  ])(
    '[R-H-15] %s → rot mit Nennung',
    async (_name, verstoss, nennung) => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      verstoss(root);
      commitAlles(sb, root, 'Verstoss');
      const r = await spur(root);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(nennung);
    },
    MITTEL,
  );

  it(
    '[R-H-15] fehlende Paket-Checkliste bzw. fehlender Plan-Anhang → rot mit Ursache',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      rmSync(join(root, 'docs', 'wap-planer', 'pakete', 'E1-91.md'));
      commitAlles(sb, root, 'Ohne Checkliste');
      const ohne = await spur(root);
      expect(ohne.ok).toBe(false);
      expect(schrittText(ohne)).toContain('E1-91');
      writeText(root, 'docs/wap-planer/pakete/E1-91.md', paketDatei('E1-91', ['R-9-01'], true));
      rmSync(join(root, 'docs', 'wap-planer', 'plan', 'etappe-1.md'));
      commitAlles(sb, root, 'Ohne Plan');
      const ohnePlan = await spur(root);
      expect(ohnePlan.ok).toBe(false);
      expect(schrittText(ohnePlan)).toContain('etappe-1.md');
    },
    MITTEL,
  );

  it(
    '[R-H-15] Test mit ID des laufenden Pakets und Test einer eingefrorenen Paket-ID an zusätzlicher Stelle → grün',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      writeText(root, 'tests/wap/unit/zusatz.test.ts', unitTest(['[R-9-02][R-9-01] beide Pakete']));
      commitAlles(sb, root, 'Zusatz');
      const r = await spur(root);
      expect(r.ok).toBe(true);
    },
    MITTEL,
  );
});

describe('trace.mjs als CLI', () => {
  it(
    '[R-H-15] --mode fast --out <datei> schreibt die Matrix (Markdown) mit IDs und Testnamen, Exit 0; mit Test ohne ID Exit 1',
    () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      const out = join(sb.base, 'matrix.md');
      const cli = join(WT, 'scripts', 'wap-gate', 'trace.mjs');
      const gruen = node(cli, ['--mode', 'fast', '--out', out], { cwd: root, env: sb.env });
      expect(gruen.status).toBe(0);
      expect(existsSync(out)).toBe(true);
      const md = readFileSync(out, 'utf8');
      expect(md).toContain('R-9-01');
      expect(md).toContain('eingefroren belegt');
      writeText(root, 'tests/wap/unit/ohne.test.ts', unitTest(['ohne jede Kennung']));
      commitAlles(sb, root, 'Ohne ID');
      const rot = node(cli, ['--mode', 'fast'], { cwd: root, env: sb.env });
      expect(rot.status).toBe(1);
      expect(rot.out).toContain('ohne jede Kennung');
      expect(readText(root, 'docs/wap-planer/plan/etappe-1.md')).toContain('R-9-01');
    },
    MITTEL,
  );
});

describe('req() (Vertrag §4)', () => {
  it('[R-H-15] req() setzt die IDs in eckigen Klammern vor den Namen und lehnt Namen ohne gültige ID ab', () => {
    expect(req('R-4.6-03', 'Beispiel')).toBe('[R-4.6-03] Beispiel');
    expect(req(['R-4.6-03', 'R-4.6-04'], 'Beispiel')).toBe('[R-4.6-03][R-4.6-04] Beispiel');
    expect(req('R-H-10', 'Schleuse')).toBe('[R-H-10] Schleuse');
    expect(() => req([], 'ohne')).toThrow();
    expect(() => req('', 'leer')).toThrow();
    expect(() => req('X-1', 'falsch')).toThrow();
  });
});

describe('trace: Paket-Checkliste mit Bereichen, Zuordnung, Testnamen nur aus Testlisten (Vertrag §9 Nr 10)', () => {
  function anforderungen(root: string, zeile: string): void {
    const text = paketDatei('E1-91', [], true).replace(
      '- Anforderungen: ',
      `- Anforderungen: ${zeile}`,
    );
    writeText(root, 'docs/wap-planer/pakete/E1-91.md', text);
  }

  it(
    '[R-H-15] Anforderungen mit Bereichen «bis», Strichpunkt und Klammerinhalt → entfaltet gleich Anhang A, grün',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      anforderungen(
        root,
        'R-9-01, R-9-03 bis R-9-04 (Verweis und Auftraggeber); R-7-10 bis R-7-13',
      );
      commitAlles(sb, root, 'Bereiche');
      expect((await spur(root)).ok).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-15] Bereich mit einer ID, die nicht im Katalog steht (R-7-14) → rot mit dieser ID',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      anforderungen(root, 'R-9-01, R-9-03, R-9-04, R-7-10 bis R-7-14');
      commitAlles(sb, root, 'Bereich zu weit');
      const r = await spur(root);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('R-7-14');
    },
    MITTEL,
  );

  it(
    '[R-H-15] Paketdatei des laufenden Pakets fehlt (Zweig wap/e1-92 ohne E1-92.md) → rot',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      rmSync(join(root, 'docs', 'wap-planer', 'pakete', 'E1-92.md'));
      commitAlles(sb, root, 'Ohne eigene Checkliste');
      const r = await spur(root);
      expect(r.ok).toBe(false);
      expect(schrittText(r).toLowerCase()).toContain('e1-92');
    },
    MITTEL,
  );

  it(
    '[R-H-15] Testkörper mit Zeichenkette, die wie ein Test ohne ID aussieht → nicht gewertet, grün',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      const name = ['ohne', 'jede', 'Kennung'].join(' ');
      writeText(
        root,
        'tests/wap/unit/zeichenkette.test.ts',
        `${UNIT_KOPF}it('[R-9-02] erzeugt eine Spezifikation', () => {\n  const spez = ${JSON.stringify(`it('${name}', () => {});`)};\n  expect(spez.length).toBeGreaterThan(0);\n});\n`,
      );
      commitAlles(sb, root, 'Zeichenkette');
      expect((await spur(root)).ok).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-15] voller Modus: fehlender Bericht → rot mit dessen Pfad',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      const { trace } = await traceModul();
      const r = await trace({
        cwd: root,
        modus: 'full',
        berichte: ['test-results/wap/vitest.json'],
      });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('test-results/wap/vitest.json');
    },
    MITTEL,
  );
});

describe('trace: Selbsttest-Teil und Entwürfe (Befund E1-01-18; Vertrag AE-001 §2, §3; ADR-010 Notiz AE-001 §1 V9)', () => {
  const NUR_SELBSTTEST = 'R-9-07';

  /** traceRepo mit einer Integration-Gate-ID des eingefrorenen Pakets E1-91, belegt nur in *.selbsttest.ts. */
  function selbsttestRepo(sb: Sandbox, mitTest: boolean): string {
    const root = traceRepo(sb, [
      ...EINTRAEGE,
      { id: NUR_SELBSTTEST, paket: 'E1-91', testart: 'Integration-Gate' },
    ]);
    writeText(
      root,
      'docs/wap-planer/pakete/E1-91.md',
      paketDatei(
        'E1-91',
        ['R-9-01', 'R-9-03', 'R-9-04', 'R-7-10', 'R-7-11', 'R-7-12', 'R-7-13', NUR_SELBSTTEST],
        true,
      ),
    );
    if (mitTest) {
      writeText(
        root,
        'tests/wap-gate/e1-91.selbsttest.ts',
        unitTest([`[${NUR_SELBSTTEST}] nur im Selbsttest-Teil`]),
      );
    }
    commitAlles(sb, root, 'Selbsttest-ID');
    return root;
  }

  /** JSON-Bericht einer Konfiguration im synthetischen Repo (wie V1/V1a/V3), relativ zu root. */
  function bericht(sb: Sandbox, root: string, konfig: string, datei: string): string {
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
      { cwd: root, env: { ...sb.env, VITEST_MAX_WORKERS: '4' }, timeout: MITTEL },
    );
    expect(existsSync(join(root, ...rel.split('/'))), `Test-Aufbau: ${rel} fehlt`).toBe(true);
    return rel;
  }

  it(
    '[R-H-15] fast: ID nur in einer *.selbsttest.ts → belegt (Testliste der Selbsttest-Konfiguration), Matrix nennt den Test',
    async () => {
      const sb = neueSandbox();
      const root = selbsttestRepo(sb, true);
      const r = await spur(root);
      expect(r.ok, schrittText(r)).toBe(true);
      const zeile = r.matrix.ids.find((x) => x.id === NUR_SELBSTTEST);
      expect(zeile?.status).toBe('belegt');
      expect(zeile?.tests.some((t) => t.includes('nur im Selbsttest-Teil'))).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-15] fast: dieselbe ID ohne Test (Selbsttest-Datei fehlt) → rot mit der ID',
    async () => {
      const sb = neueSandbox();
      const root = selbsttestRepo(sb, false);
      const r = await spur(root);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(NUR_SELBSTTEST);
    },
    MITTEL,
  );

  it(
    '[R-H-15] voll mit Berichten von V1, V1a (gate, harness, selbsttest) und V3: ID nur im Bericht vitest-selbsttest.json → belegt',
    async () => {
      const sb = neueSandbox();
      const root = selbsttestRepo(sb, true);
      const berichte = [
        bericht(sb, root, 'vitest.wap.config.ts', 'vitest.json'),
        bericht(sb, root, 'vitest.wap-gate.config.ts', 'vitest-gate.json'),
        bericht(sb, root, 'vitest.wap-harness.config.ts', 'vitest-harness.json'),
        bericht(sb, root, 'vitest.wap-selbsttest.config.ts', 'vitest-selbsttest.json'),
        bericht(sb, root, 'vitest.wap-reference.config.ts', 'vitest-reference.json'),
      ];
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'full', berichte });
      expect(r.ok, schrittText(r)).toBe(true);
      const zeile = r.matrix.ids.find((x) => x.id === NUR_SELBSTTEST);
      expect(zeile?.status).toBe('belegt');
    },
    MITTEL,
  );

  it(
    '[R-H-15] voll ohne Angabe von berichte: vitest-selbsttest.json fehlt (übrige Pflichtberichte von E1-01-min vorhanden) → rot mit dessen Pfad',
    async () => {
      const sb = neueSandbox();
      const root = selbsttestRepo(sb, true);
      bericht(sb, root, 'vitest.wap.config.ts', 'vitest.json');
      bericht(sb, root, 'vitest.wap-gate.config.ts', 'vitest-gate.json');
      bericht(sb, root, 'vitest.wap-harness.config.ts', 'vitest-harness.json');
      bericht(sb, root, 'vitest.wap-reference.config.ts', 'vitest-reference.json');
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'full' });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('test-results/wap/vitest-selbsttest.json');
    },
    MITTEL,
  );

  it(
    '[R-H-15] voll ohne Angabe von berichte, alle Pflichtberichte von E1-01-min vorhanden (vitest, -gate, -harness, -selbsttest, -reference; ADR-010 Notiz AE-001 §1 V9) → grün, ID nur im Selbsttest-Bericht belegt',
    async () => {
      const sb = neueSandbox();
      const root = selbsttestRepo(sb, true);
      bericht(sb, root, 'vitest.wap.config.ts', 'vitest.json');
      bericht(sb, root, 'vitest.wap-gate.config.ts', 'vitest-gate.json');
      bericht(sb, root, 'vitest.wap-harness.config.ts', 'vitest-harness.json');
      bericht(sb, root, 'vitest.wap-selbsttest.config.ts', 'vitest-selbsttest.json');
      bericht(sb, root, 'vitest.wap-reference.config.ts', 'vitest-reference.json');
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'full' });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.matrix.ids.find((x) => x.id === NUR_SELBSTTEST)?.status).toBe('belegt');
    },
    MITTEL,
  );

  it(
    '[R-H-15] Entwurfsdateien (*.entwurf.ts) mit Tests ohne ID oder mit fremder ID → nicht gewertet, grün',
    async () => {
      const sb = neueSandbox();
      const root = traceRepo(sb);
      writeText(
        root,
        'tests/wap/unit/zz.test.entwurf.ts',
        unitTest([['ohne', 'Kennung', 'im', 'Entwurf'].join(' '), '[R-9-06] künftiges Paket']),
      );
      writeText(
        root,
        'tests/wap-gate/zz.gate.entwurf.ts',
        unitTest([['ohne', 'Kennung', 'im', 'Entwurf'].join(' ')]),
      );
      commitAlles(sb, root, 'Entwürfe');
      const r = await spur(root);
      expect(r.ok, schrittText(r)).toBe(true);
    },
    MITTEL,
  );
});

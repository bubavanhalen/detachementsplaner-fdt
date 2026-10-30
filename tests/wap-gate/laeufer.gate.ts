// Nachträge nach dem Code-Review E1-01-min Runde 1 (.qa/e1-01/code-reviewer-min-1.md; Entscheide FINDINGS
// CR-E101-02, -05, -06, -07, -09, -11, -12, E1-01-21): Läufer-Status in der Rot-Phase, Merkwörter in
// Zeichenketten, Suite-Allowlist, strenge Typprüfung der H0-Skripte, test.extend in der Rückverfolgbarkeit,
// Ignorier-Regeln unter tests/wap/reference, Schachtelung der Sperre, V11-deep über Suite-Berichte.
// Teile mit ganzen Schleusenläufen stehen in laeufer.selbsttest.ts. Nur fiktive Daten; verbotene Wörter,
// Telefonnummern und Namen werden zur Laufzeit gebildet.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { belegeImKind, leseSperre, ohneFehler, sperrPfad, testLast } from './support/last';
import {
  aufraeumen,
  commitAlles,
  git,
  KURZ,
  kopiereAusWt,
  MITTEL,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  sha256Lf,
  WT,
  wort,
  writeText,
} from './support/umgebung';
import {
  forbidden,
  lastModul,
  privacyDeep,
  redPhase,
  suiteBoundary,
  traceModul,
  typecheck,
} from './support/vertrag';

afterEach(aufraeumen);

/** Fiktive Schweizer Telefonnummer, zur Laufzeit gebildet (nie als Literal im Quelltext). */
function telefon(): string {
  return ['04', '4 000 00 ', '00'].join('');
}

/** Vitest-JSON-Bericht (Form wie der JSON-Reporter) mit einer Datei und den angegebenen Tests. */
function bericht(
  datei: string,
  tests: { title: string; status: string; failureMessages?: string[] }[],
): string {
  return JSON.stringify({
    numTotalTests: tests.length,
    testResults: [
      {
        name: datei,
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
  });
}

describe('CR-E101-02: Status ≠ passed ausserhalb der Rot-Ausnahme ist rot (classifyRedPhase)', () => {
  it.each([['skipped'], ['pending'], [wort('to', 'do')]])(
    '[R-H-12][R-H-13] Rot-Phase: Paket-Test fachlich rot, fremder Test mit Status %s (z.B. Laufzeit-Skip ctx.skip()) → rot mit dem fremden Test',
    async (status) => {
      const sb = neueSandbox();
      const pfad = writeText(
        sb.base,
        'bericht.json',
        bericht(join(sb.base, 'tests', 'wap', 'unit', 'x.test.ts'), [
          {
            title: '[R-9-99] paket rot',
            status: 'failed',
            failureMessages: ['AssertionError: expected 1 to be 2'],
          },
          { title: '[R-1-01] fremd übersprungen', status },
        ]),
      );
      const { classifyRedPhase } = await redPhase();
      const r = classifyRedPhase({
        berichte: [pfad],
        paket: 'p9',
        paketIds: ['R-9-99'],
        stubNamen: [],
      });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('fremd übersprungen');
    },
  );
});

describe('CR-E101-05: Merkwörter auch in Zeichenketten und Vorlagen (scanForbidden)', () => {
  function repo(sb: Sandbox, dateien: Record<string, string>): string {
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'merkwort');
    for (const [rel, inhalt] of Object.entries(dateien)) writeText(root, rel, inhalt);
    commitAlles(sb, root, 'Dateien');
    return root;
  }

  it.each([
    [
      'Zeichenkette im Modell',
      'src/model/wap/z.ts',
      `export const hinweis = '${wort('TO', 'DO')} später';\n`,
    ],
    [
      'Vorlage im Modell',
      'src/model/wap/v.ts',
      `export const t = \`${wort('FIX', 'ME')} \${1}\`;\n`,
    ],
    [
      'Zeichenkette in einer Komponente',
      'src/components/wap/K.tsx',
      `export const k = "${wort('HA', 'CK')}";\n`,
    ],
    [
      'Zeichenkette in einem Schleusen-Skript',
      'scripts/wap-gate/zz.mjs',
      `export const s = '${wort('X', 'XX')} offen';\n`,
    ],
  ])('[R-H-13] Merkwort in %s → F4 rot mit Pfad', async (_name, pfad, inhalt) => {
    const sb = neueSandbox();
    const root = repo(sb, { [pfad]: inhalt });
    const { scanForbidden } = await forbidden();
    const r = await scanForbidden({ cwd: root });
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain(pfad);
  });

  it('[R-H-13] Bezeichner-Ausnahme nur für die Konstante in tests/wap-gate/forbidden.gate.ts: dort grün, dieselbe Zeile in einer anderen Schleusen-Testdatei rot', async () => {
    const zeile = `const ${wort('TO', 'DO')} = ['a', 'b'].join('');\nexport const x = ${wort('TO', 'DO')};\n`;
    const sb = neueSandbox();
    const nurAusnahme = repo(sb, { 'tests/wap-gate/forbidden.gate.ts': zeile });
    const { scanForbidden } = await forbidden();
    const gruen = await scanForbidden({ cwd: nurAusnahme });
    expect(gruen.ok, schrittText(gruen)).toBe(true);
    const sb2 = neueSandbox();
    const andere = repo(sb2, { 'tests/wap-gate/andere.gate.ts': zeile });
    const rot = await scanForbidden({ cwd: andere });
    expect(rot.ok).toBe(false);
    expect(schrittText(rot)).toContain('tests/wap-gate/andere.gate.ts');
  });

  it('[R-H-13] Merkwort nur in einem Regex-Literal (Entscheid TR-E101-204 a: Regex-Literale nicht geprüft) → F4 grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb, {
      'src/model/wap/r.ts': `export const erkennt = (s: string): boolean => /${wort('TO', 'DO')}|offen/i.test(s);\n`,
    });
    const { scanForbidden } = await forbidden();
    const r = await scanForbidden({ cwd: root });
    expect(r.ok, schrittText(r)).toBe(true);
  });
});

describe('CR-E101-06: Suite-Allowlist eng gefasst (checkSuiteBoundary, scripts/wap-gate/suite-allowlist.json)', () => {
  it('[R-H-30] Änderung an AGENTS.md, .claude/settings.json und .claude/agents/x.md → grün; an .claude/andere.txt → rot mit Pfad', async () => {
    const aufbau = (sb: Sandbox): { root: string; basis: string } => {
      prozessUmgebung(sb);
      const root = neuesRepo(sb, 'allowlist', 'main');
      kopiereAusWt(root, 'scripts/wap-gate/suite-allowlist.json');
      writeText(root, 'AGENTS.md', '# Regeln (fiktiv)\n');
      writeText(root, '.claude/settings.json', '{}\n');
      writeText(root, '.claude/agents/x.md', '# Agent x (fiktiv)\n');
      writeText(root, '.claude/andere.txt', 'fiktiv\n');
      const basis = commitAlles(sb, root, 'Suite');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      return { root, basis };
    };
    const { checkSuiteBoundary } = await suiteBoundary();
    const sb = neueSandbox();
    const a = aufbau(sb);
    writeText(a.root, 'AGENTS.md', '# Regeln (fiktiv)\n\nNachtrag.\n');
    writeText(a.root, '.claude/settings.json', '{ "x": 1 }\n');
    writeText(a.root, '.claude/agents/x.md', '# Agent x (fiktiv)\n\nNachtrag.\n');
    commitAlles(sb, a.root, 'Freigegebene Änderungen');
    const gruen = await checkSuiteBoundary({ cwd: a.root, basis: a.basis });
    expect(gruen.ok, schrittText(gruen)).toBe(true);
    const sb2 = neueSandbox();
    const b = aufbau(sb2);
    writeText(b.root, '.claude/andere.txt', 'geändert\n');
    commitAlles(sb2, b.root, 'Nicht freigegeben');
    const rot = await checkSuiteBoundary({ cwd: b.root, basis: b.basis });
    expect(rot.ok).toBe(false);
    expect(schrittText(rot)).toContain('.claude/andere.txt');
  });
});

describe('CR-E101-07: strenge Typprüfung erfasst scripts/wap/** (checkTypes)', () => {
  const H0 = 'scripts/wap/zz-h0.mjs';
  const FEHLER = '/** @type {number} */\nexport const zahl = "drei";\n';

  function repo(sb: Sandbox, inhalt: string, gesperrt: string): string {
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'h0-typen');
    kopiereAusWt(root, 'tsconfig.json');
    kopiereAusWt(root, 'tsconfig.wap.json');
    nodeModules(root);
    const alt = 'export const alt = 1;\n';
    writeText(root, 'src/io/xlsx-drawing/zip.ts', alt);
    writeText(
      root,
      'scripts/wap-gate/legacy-modules.json',
      `${JSON.stringify({ version: 1, dateien: [{ pfad: 'src/io/xlsx-drawing/zip.ts', sha256: sha256Lf(alt) }] }, null, 2)}\n`,
    );
    writeText(root, H0, inhalt);
    writeText(
      root,
      'docs/wap-planer/test-lock.json',
      `${JSON.stringify({ version: 1, files: { [H0]: sha256Lf(gesperrt) } }, null, 2)}\n`,
    );
    commitAlles(sb, root, 'H0-Datei');
    return root;
  }

  it(
    '[R-H-14] gesperrte H0-Datei mit Typfehler und unverändertem SHA-256 → grün, verworfen nennt sie',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb, FEHLER, FEHLER);
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.verworfen.map((v) => v.datei)).toContain(H0);
    },
    MITTEL,
  );

  it(
    '[R-H-14] dieselbe H0-Datei geändert (SHA-256 weicht von test-lock.json ab) → rot mit der Datei',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb, `${FEHLER}// geändert\n`, FEHLER);
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(H0);
    },
    MITTEL,
  );
});

describe('CR-E101-09: test.extend-Einträge im schnellen Modus der Rückverfolgbarkeit', () => {
  const KOPF_KATALOG =
    '| ID | Stelle | Wortlaut | Et. | Prüfart | Abnahmekriterium | Beispiel (FDT 2026) |\n| --- | --- | --- | --- | --- | --- | --- |';
  const KOPF_PLAN =
    '| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |';

  function paket(name: string, ids: string[], eingefroren: boolean): string {
    return [
      `# Paket ${name} – fiktiv`,
      '',
      '- Etappe: 1',
      `- Anforderungen: ${ids.join(', ')}`,
      '',
      `- [${eingefroren ? 'x' : ' '}] 6 Test-Freeze`,
      `- [${eingefroren ? 'x' : ' '}] 7 Umsetzung`,
      '',
    ].join('\n');
  }

  function repo(sb: Sandbox, testName: string): string {
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'trace-extend', 'wap/e1-92');
    const zeilen: [string, string][] = [
      ['R-9-01', 'E1-91'],
      ['R-9-02', 'E1-92'],
      ['R-9-06', 'E1-93'],
    ];
    writeText(
      root,
      'docs/wap-planer/requirements.md',
      `# Katalog (fiktiv)\n\n${KOPF_KATALOG}\n${zeilen.map(([id]) => `| ${id} | 9 | Fiktiv ${id}. | 1 | Unit | Fiktiv | – |`).join('\n')}\n`,
    );
    writeText(
      root,
      'docs/wap-planer/plan/etappe-1.md',
      `# Plan (fiktiv)\n\n## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)\n\n${KOPF_PLAN}\n${zeilen.map(([id, p]) => `| ${id} | ${p} | Unit | – | – |`).join('\n')}\n\n## Anhang B – Vorgeschlagene Werkzeug- und Leitplanken-IDs (Etappe 1)\n\n${KOPF_PLAN}\n\n## Anhang C – Zählungen\n\nKeine.\n`,
    );
    writeText(root, 'docs/wap-planer/pakete/E1-91.md', paket('E1-91', ['R-9-01'], true));
    writeText(root, 'docs/wap-planer/pakete/E1-92.md', paket('E1-92', ['R-9-02'], false));
    writeText(root, 'docs/wap-planer/pakete/E1-93.md', paket('E1-93', ['R-9-06'], false));
    const konfig = (inc: string) =>
      `export default { test: { include: [${JSON.stringify(inc)}], environment: 'node', retry: 0 } };\n`;
    writeText(root, 'vitest.wap.config.ts', konfig('tests/wap/**/*.test.ts'));
    writeText(root, 'vitest.wap-reference.config.ts', konfig('tests/wap/reference/**/*.ref.ts'));
    writeText(root, 'vitest.wap-gate.config.ts', konfig('tests/wap-gate/**/*.gate.ts'));
    writeText(root, 'vitest.wap-selbsttest.config.ts', konfig('tests/wap-gate/**/*.selbsttest.ts'));
    writeText(root, 'vitest.wap-harness.config.ts', konfig('tests/wap-harness/**/*.harness.ts'));
    const kopf = "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\n";
    writeText(
      root,
      'tests/wap/unit/basis.test.ts',
      `${kopf}it('[R-9-01] eingefroren belegt', () => {\n  expect(1).toBe(1);\n});\nit('[R-9-02] laufendes Paket', () => {\n  expect(1).toBe(1);\n});\n`,
    );
    writeText(
      root,
      'tests/wap/unit/extend.test.ts',
      // Ein gewöhnlicher Test daneben hält die Datei für die statische Liste lesbar; der test.extend-Test
      // fällt dort heraus (CR-E101-09) und muss trotzdem gewertet werden.
      `${kopf}it('[R-9-02] gewöhnlicher Test daneben', () => {\n  expect(1).toBe(1);\n});\n\nconst t = it.extend<{ wert: number }>({\n  wert: async ({ task: _t }, use) => {\n    await use(1);\n  },\n});\n\nt(${JSON.stringify(testName)}, ({ wert }) => {\n  expect(wert).toBe(1);\n});\n`,
    );
    nodeModules(root);
    commitAlles(sb, root, 'Trace mit test.extend');
    return root;
  }

  it.each([
    ['unbekannter ID', '[R-9-77] über extend', 'R-9-77'],
    ['ID eines nicht eingefrorenen fremden Pakets', '[R-9-06] über extend', 'R-9-06'],
  ])(
    '[R-H-15] test.extend-Test mit %s → rot mit der ID',
    async (_name, testName, id) => {
      const sb = neueSandbox();
      const root = repo(sb, testName);
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'fast' });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(id);
    },
    MITTEL,
  );

  it(
    '[R-H-15] test.extend-Test mit ID des laufenden Pakets → grün, und die Matrix führt ihn bei dieser ID (TR-E101-205)',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb, '[R-9-02] über extend');
      const { trace } = await traceModul();
      const r = await trace({ cwd: root, modus: 'fast' });
      expect(r.ok, schrittText(r)).toBe(true);
      const zeile = r.matrix.ids.find((x) => x.id === 'R-9-02');
      expect(zeile?.tests.some((t) => t.includes('über extend'))).toBe(true);
    },
    MITTEL,
  );
});

describe('CR-E101-11: Ignorier-Regeln unter tests/wap/reference (.gitignore)', () => {
  function ignoriert(pfad: string): boolean {
    const r = spawnSync('git', ['-C', WT, 'check-ignore', '-q', '--no-index', pfad], {
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(r.status === 0 || r.status === 1, `git check-ignore: ${r.stderr}`).toBe(true);
    return r.status === 0;
  }

  it('[R-H-24] tests/wap/reference/x.pdf, x.json und unter/x.xlsx sind ignoriert; *.ref.ts und required-files.json nicht', () => {
    for (const p of [
      'tests/wap/reference/x.pdf',
      'tests/wap/reference/x.json',
      'tests/wap/reference/unter/x.xlsx',
    ]) {
      expect(ignoriert(p), `${p} nicht ignoriert`).toBe(true);
    }
    for (const p of [
      'tests/wap/reference/a.ref.ts',
      'tests/wap/reference/unter/b.ref.ts',
      'tests/wap/reference/required-files.json',
    ]) {
      expect(ignoriert(p), `${p} ignoriert`).toBe(false);
    }
  });
});

describe('CR-E101-12: Schachtelung nur über wap-gate/sperre.json und einen Schleusen-/Vitest-Halter', () => {
  it(
    '[R-H-18] WAP_GATE_SPERRE zeigt auf eine Kopie der Sperrdatei, die nicht auf wap-gate/sperre.json endet → nicht geschachtelt, rot',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { belegeSperre } = await lastModul();
      const halter = await belegeSperre({ modus: 'full', worktree: WT, last: t.last });
      expect(halter.ok).toBe(true);
      if (!halter.ok) return;
      try {
        const kopie = join(sb.base, 'andere', 'kopie.json');
        mkdirSync(join(sb.base, 'andere'), { recursive: true });
        copyFileSync(sperrPfad(t.commonDir), kopie);
        const env = `${kopie}#${leseSperre(t.commonDir).token}`;
        const kind = ohneFehler(belegeImKind(sb, t.commonDir, env));
        expect(kind.ok).toBe(false);
      } finally {
        await halter.freigeben();
      }
    },
    KURZ,
  );

  it(
    '[R-H-18] gültiges WAP_GATE_SPERRE, Halter ist Vorfahr, aber ein gewöhnlicher Node-Prozess (kein Schleusen- oder Vitest-Prozess) → nicht geschachtelt, rot',
    () => {
      const sb = neueSandbox();
      // Ordner ohne «gate», «vitest», «selftest», «stability» im Pfad, damit die Kommandozeile des Halters
      // kein Schleusen-Merkmal enthält.
      const dir = mkdtempSync(join(tmpdir(), 'wap-kette-'));
      try {
        // Vorbedingung (TR-E101-208): Der Pfad trägt kein Prozessmerkmal einer Schleuse oder eines Läufers.
        expect(
          /gate|vitest|selftest|stability|stryker|playwright/i.test(dir),
          'Test-Aufbau: Halterpfad enthält ein Schleusen-Merkmal',
        ).toBe(false);
        const common = join(dir, 'common');
        mkdirSync(common, { recursive: true });
        const url = pathToFileURL(join(WT, 'scripts', 'wap-gate', 'last.mjs')).href;
        const kind = join(dir, 'kind.mjs');
        writeFileSync(
          kind,
          [
            `import { belegeSperre } from ${JSON.stringify(url)};`,
            'try {',
            `  const r = await belegeSperre({ modus: 'fast', worktree: ${JSON.stringify(WT)}, env: process.env, last: { commonDir: ${JSON.stringify(common)} } });`,
            '  if (r.ok) await r.freigeben();',
            "  process.stdout.write(JSON.stringify({ ok: r.ok, geschachtelt: r.ok ? r.geschachtelt : null }) + '\\n');",
            '} catch (e) {',
            "  process.stdout.write(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }) + '\\n');",
            '}',
            '',
          ].join('\n'),
        );
        const halter = join(dir, 'halter.mjs');
        writeFileSync(
          halter,
          [
            "import { spawnSync } from 'node:child_process';",
            `import { belegeSperre } from ${JSON.stringify(url)};`,
            'try {',
            `  const h = await belegeSperre({ modus: 'full', worktree: ${JSON.stringify(WT)}, env: {}, last: { commonDir: ${JSON.stringify(common)} } });`,
            "  if (!h.ok) { process.stdout.write(JSON.stringify({ fehler: 'Halter ohne Sperre' }) + '\\n'); process.exit(0); }",
            `  const k = spawnSync(process.execPath, [${JSON.stringify(kind)}], { env: { ...process.env, WAP_GATE_SPERRE: h.envWert }, encoding: 'utf8', windowsHide: true });`,
            '  await h.freigeben();',
            "  process.stdout.write((k.stdout ?? '').trim() + '\\n');",
            '} catch (e) {',
            "  process.stdout.write(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }) + '\\n');",
            '}',
            '',
          ].join('\n'),
        );
        const env: NodeJS.ProcessEnv = { ...sb.env };
        delete env.WAP_GATE_SPERRE;
        const r = spawnSync(process.execPath, [halter], {
          cwd: dir,
          env,
          encoding: 'utf8',
          timeout: 120_000,
          windowsHide: true,
        });
        const zeile = r.stdout.split(/\r?\n/).find((z) => z.startsWith('{'));
        expect(zeile, `Halter ohne Ergebnis (Exit ${String(r.status)})`).toBeDefined();
        const e = ohneFehler(
          JSON.parse(zeile as string) as { ok?: boolean; geschachtelt?: boolean; fehler?: string },
        );
        expect(e.ok, 'Kind wurde trotz gewöhnlichem Halter als geschachtelt angenommen').toBe(
          false,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    },
    KURZ,
  );
});

describe('E1-01-21: V11-deep über Suite-Berichte und WAP-Artefakte (deepPrivacyScan, Pfad-Modus)', () => {
  it('[R-H-24] Telefonnummer-Muster in test-results/wap/suite.json (Suite-Bericht, fiktiv) → nicht gewertet; dasselbe in einem WAP-Artefakt → rot, Nummer maskiert', async () => {
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'tief-suite');
    const nummer = telefon();
    writeText(
      root,
      'test-results/wap/suite.json',
      bericht(join(root, 'tests', 'kontakt.test.ts'), [
        { title: `Kontakt ${nummer} wird exportiert`, status: 'passed' },
      ]),
    );
    const { deepPrivacyScan } = await privacyDeep();
    const nurSuite = await deepPrivacyScan({
      cwd: root,
      pfade: [join(root, 'test-results', 'wap')],
    });
    expect(nurSuite.ok, schrittText(nurSuite)).toBe(true);
    writeText(root, 'test-results/wap/artefakt/zz-plan.json', `{ "notiz": "Rückruf ${nummer}" }\n`);
    const mitArtefakt = await deepPrivacyScan({
      cwd: root,
      pfade: [join(root, 'test-results', 'wap')],
    });
    expect(mitArtefakt.ok).toBe(false);
    const text = schrittText(mitArtefakt);
    expect(text).toContain('zz-plan.json');
    expect(text).not.toContain('suite.json');
    expect(
      text.replace(/\s/g, '').includes(nummer.replace(/\s/g, '')),
      'Nummer nicht maskiert',
    ).toBe(false);
    expect(readText(root, 'test-results/wap/suite.json')).toContain('Kontakt');
  });

  it('[R-H-24] Gegenprobe (TR-E101-203): dieselbe Nummer in test-results/wap/vitest-reference.json (WAP-Bericht) → rot, Pfad genannt, maskiert; suite.json nicht genannt', async () => {
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'tief-referenz');
    const nummer = telefon();
    const inhalt = (titel: string) =>
      bericht(join(root, 'tests', 'x.test.ts'), [{ title: titel, status: 'passed' }]);
    writeText(root, 'test-results/wap/suite.json', inhalt(`Kontakt ${nummer} wird exportiert`));
    writeText(
      root,
      'test-results/wap/vitest-reference.json',
      inhalt(`[R-1-01] Referenzzeile ${nummer}`),
    );
    const { deepPrivacyScan } = await privacyDeep();
    const r = await deepPrivacyScan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
    expect(r.ok).toBe(false);
    const text = schrittText(r);
    expect(text).toContain('vitest-reference.json');
    expect(text).not.toContain('suite.json');
    expect(
      text.replace(/\s/g, '').includes(nummer.replace(/\s/g, '')),
      'Nummer nicht maskiert',
    ).toBe(false);
  });
});

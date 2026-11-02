// H0-Ergänzung A-1: pre-commit.mjs ruft die schnelle Schleuse auf, sobald scripts/wap-gate/gate.mjs in
// test-lock.json gesperrt ist – R-H-10 («läuft vor jedem Commit auf WAP-Zweigen»), R-H-08.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1a (A-1, Fälle 1–10), §1 (--pre-commit, F0).
// Sandbox wie commit-hook.harness.ts; scripts/wap-gate/gate.mjs ist eine Fälschung, die Argumente,
// cwd, eigenen Pfad und das Vorhandensein von GIT_INDEX_FILE protokolliert und mit festem Code endet.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  appendProtokoll,
  cleanupSandboxes,
  createSandbox,
  git,
  gitRaw,
  initRepo,
  installScripts,
  LOCK_PATH,
  lockFiles,
  protokollZeile,
  readLock,
  runScript,
  type Sandbox,
  SLOW,
  sha256Lf,
  writeLock,
  writeText,
} from './helpers';

afterEach(cleanupSandboxes);

const AHV = ['75', '6.4821.9036.57'].join('');
const GATE = 'scripts/wap-gate/gate.mjs';

interface Aufruf {
  args: string[];
  cwd: string;
  index: boolean;
  skript: string;
}

/** Fälschung der schnellen Schleuse: protokolliert jeden Aufruf in `log` und endet mit `exit`. */
function faelschung(log: string, exit: number): string {
  return [
    "import { appendFileSync } from 'node:fs';",
    "import { fileURLToPath } from 'node:url';",
    '',
    'appendFileSync(',
    `  ${JSON.stringify(log)},`,
    '  `${JSON.stringify({',
    '    args: process.argv.slice(2),',
    '    cwd: process.cwd(),',
    '    index: process.env.GIT_INDEX_FILE !== undefined,',
    '    skript: fileURLToPath(import.meta.url),',
    '  })}\\n`,',
    ');',
    `process.exit(${String(exit)});`,
    '',
  ].join('\n');
}

function aufrufe(log: string): Aufruf[] {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter((z) => z !== '')
    .map((z) => JSON.parse(z) as Aufruf);
}

function gleicherPfad(a: string, b: string): boolean {
  return realpathSync.native(a).toLowerCase() === realpathSync.native(b).toLowerCase();
}

/**
 * Repo mit versionierter Sperre: tests/a.test.ts immer gesperrt, die Fälschung unter
 * scripts/wap-gate/gate.mjs versioniert und – falls `gesperrt` – ebenfalls in test-lock.json.
 * Committet vor der Installation des Hooks (wie im echten Ablauf), danach install-hooks.
 */
function setup(
  sb: Sandbox,
  opts: { branch?: string; exit?: number; gesperrt?: boolean; inhalt?: string } = {},
): { root: string; log: string } {
  const root = initRepo(sb, 'haupt', { branch: opts.branch ?? 'wap-planer' });
  const log = join(sb.base, 'gate-aufrufe.log');
  const inhalt = opts.inhalt ?? faelschung(log, opts.exit ?? 0);
  const dateien: Record<string, string> = { 'tests/a.test.ts': 'export const a = 1;\n' };
  if (opts.gesperrt ?? true) {
    dateien[GATE] = inhalt;
    lockFiles(root, dateien);
  } else {
    lockFiles(root, dateien);
    writeText(root, GATE, inhalt);
  }
  git(sb, root, 'add', 'tests/a.test.ts', GATE, LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  const r = runScript(sb, root, 'install-hooks.mjs', []);
  expect(r.status).toBe(0);
  return { root, log };
}

function tryCommit(sb: Sandbox, root: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    writeText(root, rel, content);
    git(sb, root, 'add', rel);
  }
  const before = git(sb, root, 'rev-parse', 'HEAD');
  const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
  const after = git(sb, root, 'rev-parse', 'HEAD');
  return { r, committed: before !== after };
}

describe('pre-commit.mjs ruft die schnelle Schleuse auf (H0-Ergänzung A-1)', () => {
  it(
    '[R-H-10][R-H-08] (1) Eintrag gesperrt, Schleuse Exit 0 → Commit gelingt; genau ein Aufruf mit fast --pre-commit, cwd = Worktree-Wurzel, GIT_INDEX_FILE gesetzt',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 0 });
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status, r.out).toBe(0);
      expect(committed).toBe(true);
      const a = aufrufe(log);
      expect(a).toHaveLength(1);
      expect(a[0]?.args).toEqual(['fast', '--pre-commit']);
      expect(gleicherPfad(a[0]?.cwd ?? '', root)).toBe(true);
      expect(a[0]?.index).toBe(true);
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (2) Schleuse Exit 1 → Commit abgebrochen, HEAD unverändert, Meldung «Schnelle Schleuse rot»',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 1 });
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
      expect(r.out).toContain('Schnelle Schleuse rot');
      expect(aufrufe(log)).toHaveLength(1);
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (3) gate.mjs vorhanden, aber nicht gesperrt → Commit gelingt, kein Aufruf, Meldung «noch nicht eingerichtet»',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 1, gesperrt: false });
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status, r.out).toBe(0);
      expect(committed).toBe(true);
      expect(aufrufe(log)).toEqual([]);
      expect(r.out).toContain('Schnelle Schleuse noch nicht eingerichtet');
    },
    SLOW,
  );

  it(
    '[R-H-08] (4) Eintrag gesperrt, Datei gelöscht und Löschung gestagt → Commit abgebrochen (Lock-Prüfung «fehlt»), kein Aufruf',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 0 });
      git(sb, root, 'rm', '-q', GATE);
      const before = git(sb, root, 'rev-parse', 'HEAD');
      const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Löschung');
      expect(r.status).not.toBe(0);
      expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(before);
      expect(r.out).toContain('fehlt');
      expect(aufrufe(log)).toEqual([]);
    },
    SLOW,
  );

  it(
    '[R-H-08] (5) Eintrag gesperrt, Datenschutz-Treffer gestagt → Commit abgebrochen, kein Aufruf',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 0 });
      const { r, committed } = tryCommit(sb, root, {
        'docs/wap-planer/unsauber.md': `AHV ${AHV}\n`,
      });
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
      expect(r.out).not.toContain(AHV);
      expect(aufrufe(log)).toEqual([]);
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (6) Merge-Commit (pre-merge-commit) mit Schleuse Exit 1 → Merge abgebrochen',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 1 });
      git(sb, root, 'checkout', '-q', '-b', 'thema');
      writeText(root, 'docs/thema.md', 'Thema\n');
      git(sb, root, 'add', 'docs/thema.md');
      // Commit auf thema: Zweig ausserhalb wap-planer/wap/* → Shim prüft nicht.
      git(sb, root, 'commit', '-q', '-m', 'Thema');
      git(sb, root, 'checkout', '-q', 'wap-planer');
      const vorMerge = aufrufe(log).length;
      const before = git(sb, root, 'rev-parse', 'HEAD');
      const r = gitRaw(sb, root, 'merge', '--no-ff', '-q', '-m', 'Integration', 'thema');
      const after = git(sb, root, 'rev-parse', 'HEAD');
      expect(r.status).not.toBe(0);
      expect(after).toBe(before);
      expect(aufrufe(log).length).toBe(vorMerge + 1);
      expect(r.out).toContain('Schnelle Schleuse rot');
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (7) Paket-Worktree wap/x: aufgerufen wird die gate.mjs dieses Worktrees, nicht die des Haupt-Checkouts',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 0 });
      const wt = addWorktree(sb, root, join(sb.base, 'wt', 'x'), 'wap/x');
      installScripts(wt);
      const { r, committed } = tryCommit(sb, wt, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status, r.out).toBe(0);
      expect(committed).toBe(true);
      const a = aufrufe(log);
      expect(a).toHaveLength(1);
      expect(gleicherPfad(a[0]?.skript ?? '', join(wt, ...GATE.split('/')))).toBe(true);
      expect(gleicherPfad(a[0]?.cwd ?? '', wt)).toBe(true);
    },
    SLOW,
  );

  it(
    '[R-H-08] (8) Zweig ausserhalb wap-planer/wap/* mit gesperrtem Eintrag → kein Aufruf, Commit gelingt',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { branch: 'feature/x', exit: 1 });
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status, r.out).toBe(0);
      expect(committed).toBe(true);
      expect(aufrufe(log)).toEqual([]);
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (9) gesperrte gate.mjs mit Syntaxfehler → Commit abgebrochen (fail-closed)',
    () => {
      const sb = createSandbox();
      const { root } = setup(sb, { inhalt: 'export const = ;\n' });
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
      expect(r.out).toContain('Schnelle Schleuse rot');
    },
    SLOW,
  );

  it(
    '[R-H-10][R-H-08] (10) Eintrag nur im gestagten test-lock.json (mit Protokollzeile) → Schleuse aktiv',
    () => {
      const sb = createSandbox();
      const { root, log } = setup(sb, { exit: 0, gesperrt: false });
      const lock = readLock(root);
      writeLock(root, {
        ...lock.files,
        [GATE]: sha256Lf(readFileSync(join(root, ...GATE.split('/')))),
      });
      appendProtokoll(root, protokollZeile([GATE], 'Aufnahme'));
      git(sb, root, 'add', LOCK_PATH, 'docs/wap-planer/FINDINGS.md');
      const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(r.status, r.out).toBe(0);
      expect(committed).toBe(true);
      const a = aufrufe(log);
      expect(a).toHaveLength(1);
      expect(a[0]?.args).toEqual(['fast', '--pre-commit']);
    },
    SLOW,
  );
});

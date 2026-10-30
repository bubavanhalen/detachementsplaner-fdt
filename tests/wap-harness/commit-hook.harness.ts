// Commit-Hook: scripts/wap/pre-commit.mjs und scripts/wap/install-hooks.mjs – R-H-08.
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte» Punkt 6, P9, P12, P14, P16, P21, P25, P27, P28, P35, P37, P38, P38a, P42, P42a, P42b, P42c, P42d, P39e, P43, P43d, P43f.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  ALTE_PROTOKOLLZEILE_NR,
  ANHANG_ABSCHNITT,
  addWorktree,
  appendFindingsText,
  appendProtokoll,
  CHILD_TIMEOUT,
  cleanupSandboxes,
  createSandbox,
  EINRUECKUNG_KEIN_TITEL,
  ersetzeZeile,
  expectAusserhalbMeldung,
  expectProtokollMeldung,
  FINDINGS_PATH,
  fuegeVorZeileEin,
  git,
  gitRaw,
  H3_BLOCK_VOR_TITEL,
  initRepo,
  insertInBefundTabelle,
  installScripts,
  kommentarBisDanach,
  kommentarVorTitelGeschlossen,
  LOCK_PATH,
  listFiles,
  lockFiles,
  PROTOKOLL_KOPF,
  PROTOKOLL_TITEL,
  PROTOKOLL_TRENN,
  protokollZeile,
  type RunResult,
  readText,
  runScript,
  type Sandbox,
  SLOW,
  sha256Lf,
  TITEL_EBENEN,
  TITEL_H3,
  titelEingerueckt,
  UNTERABSCHNITT_MIT_KOMMENTAR,
  UNTERABSCHNITT_MIT_TABELLE,
  umformenFindings,
  VERGLEICHSSTAND_VERSTOESSE,
  VERSCHLEIERUNG,
  VERSTOSS_MIT_DANACH,
  vertauscheZeilen,
  writeLock,
  writeText,
  ZUSATZ_ABSATZ,
  ZWEITE_TABELLE,
  ZWEITER_TITEL_MIT_BLOCK,
  zeilenNr,
} from './helpers';

afterEach(cleanupSandboxes);

const AHV = ['75', '6.4821.9036.57'].join('');

function hookFile(sb: Sandbox, root: string, name = 'pre-commit'): string {
  const common = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  return join(common, 'hooks', name);
}

function install(sb: Sandbox, scriptRoot: string, cwd = scriptRoot): RunResult {
  return runScript(sb, scriptRoot, 'install-hooks.mjs', [], { cwd });
}

/**
 * Repo mit versionierter gesperrter Datei und versionierter test-lock.json (committet vor der
 * Installation des Hooks, wie im echten Ablauf; P14/P21 setzen versionierte Sperren voraus).
 */
function setup(sb: Sandbox, branch = 'wap-planer'): string {
  const root = initRepo(sb, 'haupt', { branch });
  lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
  git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  const r = install(sb, root);
  expect(r.status).toBe(0);
  return root;
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

describe('pre-commit.mjs direkt', () => {
  it('[R-H-08] besteht bei sauberem gestagtem Stand und intakter Sperre', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'docs/sauber.md', 'Hptm Muster A\n');
    git(sb, root, 'add', 'docs/sauber.md');
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
  }, 60_000);

  it('[R-H-08][R-H-07] scheitert bei einem Datenschutz-Treffer im gestagten Stand', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'docs/wap-planer/unsauber.md', `AHV ${AHV}\n`);
    git(sb, root, 'add', 'docs/wap-planer/unsauber.md');
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).not.toContain(AHV);
  }, 60_000);

  it('[R-H-08][R-H-05] scheitert bei einer geänderten gesperrten Datei', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);
});

describe('Commit-Hook auf WAP-Zweigen', () => {
  it.each(['wap-planer', 'wap/x'])(
    '[R-H-08] Commit auf %s mit Datenschutz-Verstoss scheitert',
    (branch) => {
      const sb = createSandbox();
      const root = setup(sb, branch);
      const { r, committed } = tryCommit(sb, root, {
        'docs/wap-planer/unsauber.md': `AHV ${AHV}\n`,
      });
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    60_000,
  );

  it.each(['wap-planer', 'wap/x'])(
    '[R-H-08] Commit auf %s mit geänderter gesperrter Datei scheitert',
    (branch) => {
      const sb = createSandbox();
      const root = setup(sb, branch);
      const { r, committed } = tryCommit(sb, root, { 'tests/a.test.ts': 'export const a = 9;\n' });
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    60_000,
  );

  it('[R-H-08] Commit auf wap-planer ohne Verstoss läuft durch', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const { r, committed } = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);

  it(
    '[R-H-08][R-H-03] Commit in einem Paket-Worktree wap/x mit Verstoss scheitert (Hook im gemeinsamen Git-Verzeichnis)',
    () => {
      const sb = createSandbox();
      const main = setup(sb);
      const wt = addWorktree(sb, main, join(sb.base, 'wt', 'x'), 'wap/x');
      installScripts(wt);
      // Der Worktree übernimmt die versionierte test-lock.json aus dem Sperrstand-Commit.
      expect(existsSync(join(wt, ...LOCK_PATH.split('/')))).toBe(true);
      const bad = tryCommit(sb, wt, { 'docs/wap-planer/unsauber.md': `AHV ${AHV}\n` });
      expect(bad.r.status).not.toBe(0);
      expect(bad.committed).toBe(false);
      git(sb, wt, 'rm', '-q', '--cached', 'docs/wap-planer/unsauber.md');
      const ok = tryCommit(sb, wt, { 'docs/sauber.md': 'Hptm Muster A\n' });
      expect(ok.r.status).toBe(0);
      expect(ok.committed).toBe(true);
    },
    SLOW,
  );

  it('[R-H-08] Shim lässt den Commit durch, wenn scripts/wap/pre-commit.mjs im Worktree fehlt', () => {
    const sb = createSandbox();
    const root = setup(sb);
    rmSync(join(root, 'scripts', 'wap', 'pre-commit.mjs'));
    const { r, committed } = tryCommit(sb, root, { 'docs/wap-planer/unsauber.md': `AHV ${AHV}\n` });
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);
});

describe('Commit-Hook: übrige Suite unberührt', () => {
  it.each(['main', 'feature/x', 'wap-planer-alt', 'wapx', 'feature/wap/x'])(
    '[R-H-08] Commit auf %s mit Datenschutz-Treffer und geänderter Sperrdatei läuft durch',
    (branch) => {
      const sb = createSandbox();
      const root = setup(sb, branch);
      const { r, committed } = tryCommit(sb, root, {
        'docs/wap-planer/unsauber.md': `AHV ${AHV}\n`,
        'tests/a.test.ts': 'export const a = 9;\n',
      });
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    60_000,
  );
});

describe('install-hooks.mjs', () => {
  it(
    '[R-H-08] installiert den Hook im gemeinsamen Git-Verzeichnis, auch wenn aus einem Worktree aufgerufen',
    () => {
      const sb = createSandbox();
      const main = initRepo(sb, 'haupt');
      const wt = addWorktree(sb, main, join(sb.base, 'wt', 'x'), 'wap/x');
      installScripts(wt);
      const r = install(sb, wt);
      expect(r.status).toBe(0);
      expect(existsSync(join(main, '.git', 'hooks', 'pre-commit'))).toBe(true);
      expect(existsSync(join(main, '.git', 'hooks', 'pre-merge-commit'))).toBe(true);
    },
    SLOW,
  );

  it('[R-H-08] überschreibt einen fremden pre-commit-Hook nicht (Exit 1, Inhalt unverändert)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const file = hookFile(sb, root);
    const fremd = '#!/bin/sh\n# fremder Hook eines anderen Werkzeugs\nexit 0\n';
    writeFileSync(file, fremd);
    const r = install(sb, root);
    expect(r.status).toBe(1);
    expect(r.out.trim().length).toBeGreaterThan(0);
    expect(readFileSync(file, 'utf8')).toBe(fremd);
    // P12 atomar: der andere Hook wird ebenfalls nicht angelegt.
    expect(existsSync(hookFile(sb, root, 'pre-merge-commit'))).toBe(false);
  }, 60_000);

  it('[R-H-08] aktualisiert den eigenen Hook (erkannt an der Kennzeile)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    expect(install(sb, root).status).toBe(0);
    const file = hookFile(sb, root);
    const frisch = readFileSync(file, 'utf8');
    writeFileSync(file, `${frisch}\n# veralteter Zusatz\n`);
    const r = install(sb, root);
    expect(r.status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(frisch);
  }, 60_000);

  it('[R-H-08] installiert denselben Shim zusätzlich als pre-merge-commit (P9)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    expect(install(sb, root).status).toBe(0);
    const preCommit = hookFile(sb, root);
    const preMerge = hookFile(sb, root, 'pre-merge-commit');
    expect(existsSync(preMerge)).toBe(true);
    expect(readFileSync(preMerge, 'utf8')).toBe(readFileSync(preCommit, 'utf8'));
  }, 60_000);

  it('[R-H-08] überschreibt einen fremden pre-merge-commit-Hook nicht (Exit 1, Inhalt unverändert, P12)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const file = hookFile(sb, root, 'pre-merge-commit');
    const fremd = '#!/bin/sh\n# fremder Merge-Hook eines anderen Werkzeugs\nexit 0\n';
    writeFileSync(file, fremd);
    const r = install(sb, root);
    expect(r.status).toBe(1);
    expect(r.out.trim().length).toBeGreaterThan(0);
    expect(readFileSync(file, 'utf8')).toBe(fremd);
    // P12 atomar: der andere Hook wird ebenfalls nicht angelegt.
    expect(existsSync(hookFile(sb, root))).toBe(false);
  }, 60_000);

  it('[R-H-08] ändert bei fremdem pre-merge-commit auch den eigenen pre-commit nicht (P12 atomar)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    expect(install(sb, root).status).toBe(0);
    const preCommit = hookFile(sb, root);
    const preMerge = hookFile(sb, root, 'pre-merge-commit');
    const eigenGeaendert = Buffer.concat([
      readFileSync(preCommit),
      Buffer.from('\n# veralteter Zusatz\n'),
    ]);
    writeFileSync(preCommit, eigenGeaendert);
    const fremd = '#!/bin/sh\n# fremder Merge-Hook eines anderen Werkzeugs\nexit 0\n';
    writeFileSync(preMerge, fremd);
    const r = install(sb, root);
    expect(r.status).toBe(1);
    expect(readFileSync(preCommit).equals(eigenGeaendert)).toBe(true);
    expect(readFileSync(preMerge, 'utf8')).toBe(fremd);
  }, 60_000);

  it('[R-H-08] aktualisiert den eigenen pre-merge-commit-Hook (erkannt an der Kennzeile)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    expect(install(sb, root).status).toBe(0);
    const file = hookFile(sb, root, 'pre-merge-commit');
    const frisch = readFileSync(file, 'utf8');
    writeFileSync(file, `${frisch}\n# veralteter Zusatz\n`);
    expect(install(sb, root).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(frisch);
  }, 60_000);
});

describe('Merge-Commits und gestagter Stand gesperrter Pfade (P9)', () => {
  /** Zweig «thema» (kein WAP-Zweig) mit Verstoss, dann Merge zurück in den Ausgangszweig. */
  function mergeWithViolation(sb: Sandbox, branch: string) {
    const root = setup(sb, branch);
    git(sb, root, 'checkout', '-q', '-b', 'thema');
    const aufThema = tryCommit(sb, root, { 'docs/wap-planer/unsauber.md': `AHV ${AHV}\n` });
    expect(aufThema.committed).toBe(true);
    git(sb, root, 'checkout', '-q', branch);
    const sauber = tryCommit(sb, root, { 'docs/sauber.md': 'Hptm Muster A\n' });
    expect(sauber.committed).toBe(true);
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'merge', '--no-ff', '-q', '-m', 'Integration', 'thema');
    const after = git(sb, root, 'rev-parse', 'HEAD');
    return { r, merged: before !== after };
  }

  it(
    '[R-H-08] konfliktfreier Merge mit Datenschutz-Verstoss nach wap-planer scheitert',
    () => {
      const sb = createSandbox();
      const { r, merged } = mergeWithViolation(sb, 'wap-planer');
      expect(r.status).not.toBe(0);
      expect(merged).toBe(false);
    },
    SLOW,
  );

  it(
    '[R-H-08] konfliktfreier Merge mit Datenschutz-Verstoss nach main läuft durch',
    () => {
      const sb = createSandbox();
      const { r, merged } = mergeWithViolation(sb, 'main');
      expect(r.status).toBe(0);
      expect(merged).toBe(true);
    },
    SLOW,
  );

  it('[R-H-08][R-H-05] pre-commit.mjs erkennt eine gestagte Änderung an einer gesperrten Datei trotz zurückgesetztem Arbeitsbaum', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 7;\n');
    git(sb, root, 'add', 'tests/a.test.ts');
    // Arbeitsbaum wieder auf den gesperrten Stand: lock-check allein sähe nichts.
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\n');
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const commit = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    expect(commit.status).not.toBe(0);
    expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(before);
  }, 60_000);

  it('[R-H-08][R-H-05] pre-commit.mjs besteht, wenn der gestagte Stand der gesperrten Datei dem Lock entspricht (CRLF gestagt)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\r\n');
    git(sb, root, 'add', 'tests/a.test.ts');
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
  }, 60_000);
});

describe('Nachgeführte test-lock.json braucht Protokoll (P14, CR-H0S-02)', () => {
  function stage(sb: Sandbox, root: string, ...paths: string[]): void {
    git(sb, root, 'add', ...paths);
  }

  function commitStaged(sb: Sandbox, root: string) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it('[R-H-08][R-H-05][R-H-04] gesperrte Datei samt per Befehl nachgeführtem Hash ohne Protokoll: Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 0; // abgeschwächt\n');
    writeLock(root, { 'tests/a.test.ts': sha256Lf('export const a = 0; // abgeschwächt\n') });
    stage(sb, root, 'tests/a.test.ts', LOCK_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('tests/a.test.ts');
    const { r, committed } = commitStaged(sb, root);
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] Nachführung über lock-update mit gestagter Protokollzeile: Commit läuft durch', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Test-Einwand angenommen',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    stage(sb, root, 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const { r, committed } = commitStaged(sb, root);
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);

  it('[R-H-08] Protokollzeile nur im Arbeitsbaum, FINDINGS.md nicht gestagt: Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Test-Einwand angenommen',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    stage(sb, root, 'tests/a.test.ts', LOCK_PATH);
    const { r, committed } = commitStaged(sb, root);
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08] Protokollzeile nennt einen anderen Pfad: Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 3;\n');
    writeLock(root, { 'tests/a.test.ts': sha256Lf('export const a = 3;\n') });
    const findings = readText(root, FINDINGS_PATH);
    writeText(
      root,
      FINDINGS_PATH,
      `${findings}| 01.10.2026 | abc1234 | tests/anderer.test.ts | Nachführung: falscher Pfad | – |\n`,
    );
    stage(sb, root, 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('tests/a.test.ts');
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08] per Befehl entfernte Sperre ohne Protokoll: Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeLock(root, {});
    stage(sb, root, LOCK_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('tests/a.test.ts');
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] neue Sperre über lock-update --add mit Protokoll: Commit läuft durch; ohne Protokoll nicht', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/b.test.ts', 'export const b = 1;\n');
    // Ohne Protokoll: von Hand gesperrt.
    writeLock(root, {
      'tests/a.test.ts': sha256Lf('export const a = 1;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 1;\n'),
    });
    stage(sb, root, 'tests/b.test.ts', LOCK_PATH);
    expect(commitStaged(sb, root).committed).toBe(false);
    // Mit Protokoll: über lock-update.
    git(sb, root, 'reset', '-q');
    git(sb, root, 'checkout', '-q', '--', LOCK_PATH);
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Neue Tests eingefroren',
      '--add',
      'tests/b.test.ts',
    ]);
    expect(u.status).toBe(0);
    stage(sb, root, 'tests/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    const ok = commitStaged(sb, root);
    expect(ok.r.status).toBe(0);
    expect(ok.committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] erste test-lock.json (fehlt in HEAD): mit Protokoll läuft der Commit, ohne scheitert er', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\n');
    git(sb, root, 'add', 'tests/a.test.ts');
    git(sb, root, 'commit', '-q', '-m', 'Test ohne Sperre');
    expect(install(sb, root).status).toBe(0);
    // Ohne Protokoll.
    writeLock(root, { 'tests/a.test.ts': sha256Lf('export const a = 1;\n') });
    stage(sb, root, LOCK_PATH);
    expect(commitStaged(sb, root).committed).toBe(false);
    // Mit Protokoll.
    git(sb, root, 'rm', '-q', '--cached', LOCK_PATH);
    rmSync(join(root, ...LOCK_PATH.split('/')));
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Erste Sperrung',
      '--add',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    stage(sb, root, LOCK_PATH, FINDINGS_PATH);
    const ok = commitStaged(sb, root);
    expect(ok.r.status).toBe(0);
    expect(ok.committed).toBe(true);
  }, 60_000);
});

describe('Losgelöster HEAD und Rebase (P16, CR-H0S-04 a)', () => {
  /** Hält einen interaktiven Rebase beim ersten Commit an (edit), ohne Editor. */
  function rebaseEditStop(sb: Sandbox, root: string): void {
    const seq = writeText(
      sb.base,
      'sequenz-editor.mjs',
      [
        "import { readFileSync, writeFileSync } from 'node:fs';",
        'const f = process.argv[2];',
        "writeFileSync(f, readFileSync(f, 'utf8').replace(/^pick /gm, 'edit '));",
        '',
      ].join('\n'),
    );
    const editor = `"${process.execPath.replace(/\\/g, '/')}" "${seq.replace(/\\/g, '/')}"`;
    const r = spawnSync('git', ['rebase', '-i', 'HEAD~1'], {
      cwd: root,
      env: { ...sb.env, GIT_SEQUENCE_EDITOR: editor },
      encoding: 'utf8',
      timeout: CHILD_TIMEOUT,
    });
    if (r.status !== 0) throw new Error(`Test-Aufbau: Rebase scheiterte: ${r.stderr}`);
    const gitDir = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-dir');
    if (!existsSync(join(gitDir, 'rebase-merge', 'head-name'))) {
      throw new Error('Test-Aufbau: Rebase hält nicht an');
    }
  }

  function commitWithViolation(sb: Sandbox, root: string) {
    return tryCommit(sb, root, { 'docs/wap-planer/unsauber.md': `AHV ${AHV}\n` });
  }

  it(
    '[R-H-08] während eines Rebase von wap/x (losgelöster HEAD) scheitert ein Commit mit Verstoss',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      expect(tryCommit(sb, root, { 'docs/c1.md': 'Erster Stand\n' }).committed).toBe(true);
      rebaseEditStop(sb, root);
      expect(gitRaw(sb, root, 'symbolic-ref', '-q', 'HEAD').status).not.toBe(0);
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    SLOW,
  );

  it(
    '[R-H-08] während eines Rebase von feature/y (kein WAP-Zweig) läuft ein Commit mit Verstoss durch',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      git(sb, root, 'checkout', '-q', '-b', 'feature/y');
      expect(tryCommit(sb, root, { 'docs/c1.md': 'Erster Stand\n' }).committed).toBe(true);
      rebaseEditStop(sb, root);
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    SLOW,
  );

  it(
    '[R-H-08] Rebase eines losgelösten HEAD (head-name ohne refs/heads/) in einem WAP-Worktree: Commit mit Verstoss scheitert (P28)',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      git(sb, root, 'checkout', '-q', '--detach');
      expect(tryCommit(sb, root, { 'docs/c1.md': 'Erster Stand\n' }).committed).toBe(true);
      rebaseEditStop(sb, root);
      const gitDir = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-dir');
      const headName = readFileSync(join(gitDir, 'rebase-merge', 'head-name'), 'utf8').trim();
      expect(headName.startsWith('refs/heads/')).toBe(false);
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    SLOW,
  );

  it(
    '[R-H-08] Rebase eines losgelösten HEAD ohne test-lock.json: Commit mit Verstoss läuft durch (P28, Gegenprobe)',
    () => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt', { branch: 'main' });
      expect(install(sb, root).status).toBe(0);
      git(sb, root, 'checkout', '-q', '--detach');
      expect(tryCommit(sb, root, { 'docs/c1.md': 'Erster Stand\n' }).committed).toBe(true);
      rebaseEditStop(sb, root);
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    SLOW,
  );

  /**
   * Rebase im apply-Modus mit Konflikt-Halt (rebase-apply/head-name, TR-H0-31). Der Konflikt wird
   * aufgelöst und gestagt; danach folgt der Commit-Versuch mit Verstoss.
   */
  function rebaseApplyStop(sb: Sandbox, root: string, zweig: string | null): void {
    // zweig === null: losgelöster HEAD (rebase-apply/head-name ohne refs/heads/, P28).
    if (zweig === null) git(sb, root, 'checkout', '-q', '--detach');
    else git(sb, root, 'checkout', '-q', '-b', zweig);
    expect(tryCommit(sb, root, { 'docs/k.md': 'Stand des Zweigs\n' }).committed).toBe(true);
    const spitze = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    expect(tryCommit(sb, root, { 'docs/k.md': 'Stand der Basis\n' }).committed).toBe(true);
    if (zweig === null) git(sb, root, 'checkout', '-q', '--detach', spitze);
    else git(sb, root, 'checkout', '-q', zweig);
    const r = gitRaw(sb, root, 'rebase', '--apply', 'wap-planer');
    if (r.status === 0) throw new Error('Test-Aufbau: Rebase ohne Konflikt-Halt');
    const gitDir = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-dir');
    if (!existsSync(join(gitDir, 'rebase-apply', 'head-name'))) {
      throw new Error('Test-Aufbau: rebase-apply/head-name fehlt');
    }
    writeText(root, 'docs/k.md', 'Aufgelöst\n');
    git(sb, root, 'add', 'docs/k.md');
  }

  it(
    '[R-H-08] während eines Rebase im apply-Modus von wap/x (rebase-apply/head-name) scheitert ein Commit mit Verstoss',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      rebaseApplyStop(sb, root, 'wap/x');
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    SLOW,
  );

  it(
    '[R-H-08] Rebase im apply-Modus eines losgelösten HEAD in einem WAP-Worktree: Commit mit Verstoss scheitert (P28)',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      rebaseApplyStop(sb, root, null);
      const gitDir = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-dir');
      const headName = readFileSync(join(gitDir, 'rebase-apply', 'head-name'), 'utf8').trim();
      expect(headName.startsWith('refs/heads/')).toBe(false);
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    SLOW,
  );

  it(
    '[R-H-08] während eines Rebase im apply-Modus von feature/y läuft ein Commit mit Verstoss durch',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      rebaseApplyStop(sb, root, 'feature/y');
      const { r, committed } = commitWithViolation(sb, root);
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    SLOW,
  );

  it('[R-H-08] losgelöster HEAD ohne Rebase in einem WAP-Worktree (test-lock.json und pre-commit.mjs vorhanden): Commit mit Verstoss scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    git(sb, root, 'checkout', '-q', '--detach');
    const { r, committed } = commitWithViolation(sb, root);
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08] losgelöster HEAD ohne test-lock.json: Commit mit Verstoss läuft durch', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt', { branch: 'main' });
    expect(install(sb, root).status).toBe(0);
    git(sb, root, 'checkout', '-q', '--detach');
    const { r, committed } = commitWithViolation(sb, root);
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);
});

describe('Gesperrter Eintrag nicht im Index auflösbar (P21, CR-H0S-10)', () => {
  it('[R-H-08][R-H-05] Eintrag in anderer Schreibweise als im Index: pre-commit.mjs scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    // Sperrdatei im Arbeitsbaum mit abweichender Schreibweise (Windows: Datei existiert trotzdem).
    writeLock(root, { 'TESTS/A.test.ts': sha256Lf('export const a = 1;\n') });
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('TESTS/A.test.ts');
  }, 60_000);

  it('[R-H-08][R-H-05] gesperrte, aber nicht versionierte Datei: pre-commit.mjs scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    lockFiles(root, {
      'tests/a.test.ts': 'export const a = 1;\n',
      'tests/unversioniert.test.ts': 'export const u = 1;\n',
    });
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/unversioniert.test.ts');
  }, 60_000);
});

describe('install-hooks: Hook-Pfad ist ein Verzeichnis (P25, CR-H0S-16)', () => {
  it.each([
    ['pre-commit', 'pre-merge-commit'],
    ['pre-merge-commit', 'pre-commit'],
  ])(
    '[R-H-08] %s als Verzeichnis gilt als fremd: Exit 1, deutsche Meldung ohne Stacktrace, anderer Hook nicht angelegt',
    (ordner, anderer) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      mkdirSync(hookFile(sb, root, ordner));
      const r = install(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).not.toMatch(/EISDIR|\n\s+at /);
      expect(r.out).toMatch(/Hook/);
      expect(existsSync(hookFile(sb, root, anderer))).toBe(false);
    },
    60_000,
  );
});

describe('install-hooks: transaktional (P25 wie P15, TR-H0-27)', () => {
  it.each([
    ['pre-merge-commit', 'pre-commit'],
    ['pre-commit', 'pre-merge-commit'],
  ])(
    '[R-H-08] %s schreibgeschützt: Exit 1, beide eigenen Hooks byteweise unverändert, keine *.wap-tmp',
    (geschuetzt, anderer) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      expect(install(sb, root).status).toBe(0);
      const fileGeschuetzt = hookFile(sb, root, geschuetzt);
      const fileAnderer = hookFile(sb, root, anderer);
      // Beide eigenen Hooks weichen vom frischen Stand ab, damit beide neu geschrieben würden.
      writeFileSync(fileGeschuetzt, `${readFileSync(fileGeschuetzt, 'utf8')}\n# alt geschützt\n`);
      writeFileSync(fileAnderer, `${readFileSync(fileAnderer, 'utf8')}\n# alt anderer\n`);
      const vorherGeschuetzt = readFileSync(fileGeschuetzt);
      const vorherAnderer = readFileSync(fileAnderer);
      chmodSync(fileGeschuetzt, 0o444);
      try {
        const r = install(sb, root);
        expect(r.status).toBe(1);
        expect(readFileSync(fileGeschuetzt).equals(vorherGeschuetzt)).toBe(true);
        expect(readFileSync(fileAnderer).equals(vorherAnderer)).toBe(true);
        const hooksDir = join(fileGeschuetzt, '..');
        expect(listFiles(hooksDir).filter((f) => f.endsWith('.wap-tmp'))).toEqual([]);
      } finally {
        chmodSync(fileGeschuetzt, 0o644);
      }
    },
    60_000,
  );
});

describe('P14: Protokollzeilen nennen genau die abweichenden Pfade (TR-H0-26)', () => {
  /** Zwei versionierte gesperrte Dateien, Hook installiert. */
  function setupZwei(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, {
      'tests/a.test.ts': 'export const a = 1;\n',
      'tests/b.test.ts': 'export const b = 1;\n',
    });
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/b.test.ts', LOCK_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    expect(install(sb, root).status).toBe(0);
    return root;
  }

  function nachfuehrenUndStagen(sb: Sandbox, root: string, ...pfade: string[]): void {
    const files: Record<string, string> = {
      'tests/a.test.ts': sha256Lf('export const a = 1;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 1;\n'),
    };
    for (const p of pfade) {
      const inhalt = `export const x = '${p}-neu';\n`;
      writeText(root, p, inhalt);
      files[p] = sha256Lf(inhalt);
    }
    writeLock(root, files);
    git(sb, root, 'add', ...pfade, LOCK_PATH, FINDINGS_PATH);
  }

  it('[R-H-08][R-H-05] Protokollzeile nennt mehr Pfade als abweichen: pre-commit.mjs scheitert', () => {
    const sb = createSandbox();
    const root = setupZwei(sb);
    // Kontrolle (P14): ohne Änderung besteht pre-commit.mjs.
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    appendProtokoll(root, protokollZeile(['tests/a.test.ts', 'tests/b.test.ts']));
    nachfuehrenUndStagen(sb, root, 'tests/a.test.ts');
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
  }, 60_000);

  it('[R-H-08][R-H-05] richtige Zeile in der Befund-Tabelle statt im Protokoll: pre-commit.mjs scheitert', () => {
    const sb = createSandbox();
    const root = setupZwei(sb);
    insertInBefundTabelle(root, protokollZeile(['tests/a.test.ts']));
    nachfuehrenUndStagen(sb, root, 'tests/a.test.ts');
    const r = runScript(sb, root, 'pre-commit.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-08][R-H-05] zwei neue Zeilen nennen zusammen genau die zwei abweichenden Pfade: Commit läuft durch', () => {
    const sb = createSandbox();
    const root = setupZwei(sb);
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']), protokollZeile(['tests/b.test.ts']));
    nachfuehrenUndStagen(sb, root, 'tests/a.test.ts', 'tests/b.test.ts');
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Nachführung');
    expect(r.status).toBe(0);
    expect(git(sb, root, 'rev-parse', 'HEAD')).not.toBe(before);
  }, 60_000);
});

describe('P27: Protokoll nur anhängbar (CR-H0S-18)', () => {
  const MELDUNG = 'Protokollzeile geändert oder entfernt';

  /** Gesperrte Datei per Befehl abschwächen und den Hash in test-lock.json nachführen. */
  function abschwaechen(root: string): void {
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
  }

  function commitStaged(sb: Sandbox, root: string) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it('[R-H-08][R-H-05][R-H-06] alte Protokollzeile umgeschrieben statt angehängt: pre-commit.mjs Exit 1, Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain(MELDUNG);
    expectProtokollMeldung(direkt.out, ALTE_PROTOKOLLZEILE_NR);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] alte Protokollzeile gelöscht (ohne Lock-Änderung): pre-commit.mjs Exit 1 mit Zeilennummer (P34a), Commit scheitert', () => {
    const sb = createSandbox();
    const root = setup(sb);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, null);
    git(sb, root, 'add', FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain(MELDUNG);
    expectProtokollMeldung(direkt.out, ALTE_PROTOKOLLZEILE_NR);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] neue Zeile vor die alte gestellt statt angehängt: pre-commit.mjs Exit 1', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    fuegeVorZeileEin(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain(MELDUNG);
    expectProtokollMeldung(direkt.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  /**
   * Repo mit versionierter Sperre und zusätzlichen, im HEAD committeten Protokollzeilen
   * (hinter ALTE_PROTOKOLLZEILE angehängt); Hook installiert.
   */
  function setupMitProtokoll(sb: Sandbox, ...zeilen: string[]): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    appendProtokoll(root, ...zeilen);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit Protokoll');
    expect(install(sb, root).status).toBe(0);
    return root;
  }

  const ZWEITE_ALTE = protokollZeile(['tests/a.test.ts'], 'Aufnahme');

  it('[R-H-08][R-H-06] zwei alte Protokollzeilen vertauscht: pre-commit.mjs Exit 1 (Reihenfolge, TR-H0-35)', () => {
    const sb = createSandbox();
    const root = setupMitProtokoll(sb, ZWEITE_ALTE);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    vertauscheZeilen(root, ALTE_PROTOKOLLZEILE, ZWEITE_ALTE);
    git(sb, root, 'add', FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expectProtokollMeldung(direkt.out, ALTE_PROTOKOLLZEILE_NR);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] neue Zeile zwischen zwei alte gestellt: pre-commit.mjs Exit 1 (TR-H0-35)', () => {
    const sb = createSandbox();
    const root = setupMitProtokoll(sb, ZWEITE_ALTE);
    abschwaechen(root);
    fuegeVorZeileEin(root, ZWEITE_ALTE, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expectProtokollMeldung(direkt.out, ALTE_PROTOKOLLZEILE_NR + 1);
  }, 60_000);

  it('[R-H-08][R-H-06] zwei alte Zeilen unverändert, eine neue angehängt: Commit läuft durch (TR-H0-35, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setupMitProtokoll(sb, ZWEITE_ALTE);
    abschwaechen(root);
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-05][R-H-06] alte «Aufnahme»-Zeile nennt den Pfad schon, keine neue Zeile: pre-commit.mjs Exit 1 (TR-H0-36)', () => {
    const sb = createSandbox();
    const root = setupMitProtokoll(sb, ZWEITE_ALTE);
    abschwaechen(root);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('tests/a.test.ts');
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] angehängte Zeile nach unveränderter alter Zeile: Commit läuft durch', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    const { r, committed } = commitStaged(sb, root);
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);

  it('[R-H-08] Änderung nur in der Befund-Tabelle (Protokoll unverändert): Commit läuft durch', () => {
    const sb = createSandbox();
    const root = setup(sb);
    insertInBefundTabelle(root, '| F-001 | test | niedrig | R-H-06 | x | offen | – | – |');
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] lose Protokollzeile nach einem Absatz im Protokollabschnitt: pre-commit.mjs Exit 1 mit Zeilennummer, Commit scheitert (P37, Angriff A8)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\nEin Absatz zum Protokoll.\n${lose}\n`);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expectAusserhalbMeldung(direkt.out, zeilenNr(root, lose));
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] lose Protokollzeile nur durch eine Leerzeile abgetrennt: pre-commit.mjs Exit 1 mit Zeilennummer, Commit scheitert (P37, TR-H0-53)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\n${lose}\n`);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expectAusserhalbMeldung(direkt.out, zeilenNr(root, lose));
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] zweite Tabelle im Protokollabschnitt: pre-commit.mjs Exit 1 mit Zeilennummer (P37)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\nAbsatz.\n\n| Kopf | Wert |\n| --- | --- |\n| x | y |\n');
    git(sb, root, 'add', FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expectAusserhalbMeldung(direkt.out, zeilenNr(root, '| Kopf | Wert |'));
  }, 60_000);

  it('[R-H-08][R-H-06] Absatz ohne |-Zeilen im Protokollabschnitt: Commit läuft durch (P37, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\nHinweis: Das Protokoll ist nur anhängbar.\n');
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] zweite Titelzeile vorn mit Kopie und Anhang, Original gefälscht: pre-commit.mjs Exit 1, Commit scheitert (P38, Angriff A9)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Gefälscht'));
    const kopie = [
      PROTOKOLL_TITEL,
      '',
      PROTOKOLL_KOPF,
      PROTOKOLL_TRENN,
      ALTE_PROTOKOLLZEILE,
      protokollZeile(['tests/a.test.ts']),
      '',
    ].join('\n');
    fuegeVorZeileEin(root, PROTOKOLL_TITEL, kopie);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] Protokoll in HTML-Kommentar verborgen und neue Tabelle angehängt: pre-commit.mjs Exit 1, Commit scheitert (P38, Angriff A10)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    abschwaechen(root);
    fuegeVorZeileEin(root, PROTOKOLL_KOPF, '<!--');
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, `${ALTE_PROTOKOLLZEILE}\n-->`);
    appendFindingsText(
      root,
      `\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${ALTE_PROTOKOLLZEILE}\n${protokollZeile(['tests/a.test.ts'])}\n`,
    );
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] HTML-Kommentar ausserhalb des Protokollabschnitts: Commit läuft durch (P38, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    fuegeVorZeileEin(root, PROTOKOLL_TITEL, '<!-- Hinweis zum Befundregister -->\n');
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] einzelner HTML-Kommentar im Protokollabschnitt: pre-commit.mjs Exit 1, Commit scheitert (P38, TR-H0-49)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\n<!-- Notiz -->\n');
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] zweite Titelzeile ohne sonstige Änderung: pre-commit.mjs Exit 1, Commit scheitert (P38, TR-H0-49)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, `\n${PROTOKOLL_TITEL}\n\nLeer.\n`);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] späterer Abschnitt «## Anhang» mit Tabelle und HTML-Kommentar: Commit läuft durch (P38a, TR-H0-46)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, ANHANG_ABSCHNITT);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it.each([
    ['|-Zeilen', UNTERABSCHNITT_MIT_TABELLE],
    ['HTML-Kommentar', UNTERABSCHNITT_MIT_KOMMENTAR],
  ])(
    '[R-H-08][R-H-06] ###-Unterüberschrift beendet den Protokollabschnitt nicht: %s darunter → pre-commit.mjs Exit 1 (P38a, Gegenprobe)',
    (_label, text) => {
      const sb = createSandbox();
      const root = setup(sb);
      appendFindingsText(root, text);
      git(sb, root, 'add', FINDINGS_PATH);
      expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
      expect(commitStaged(sb, root).committed).toBe(false);
    },
    60_000,
  );
});

describe('P35: Suite-Dateien ausserhalb der WAP-Pfadmenge blockieren den Commit nicht', () => {
  const TELEFON = ['07', '9 483 26 15'].join('');

  it(
    '[R-H-08][R-H-07] Merge einer Suite-Testdatei mit fiktiver Nummer nach wap-planer läuft durch (P35)',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      git(sb, root, 'checkout', '-q', '-b', 'thema');
      expect(
        tryCommit(sb, root, { 'tests/io.test.ts': `export const tel = '${TELEFON}';\n` }).committed,
      ).toBe(true);
      git(sb, root, 'checkout', '-q', 'wap-planer');
      expect(
        tryCommit(sb, root, { 'docs/wap-planer/sauber.md': 'Hptm Muster A\n' }).committed,
      ).toBe(true);
      const before = git(sb, root, 'rev-parse', 'HEAD');
      const r = gitRaw(sb, root, 'merge', '--no-ff', '-q', '-m', 'Integration', 'thema');
      expect(r.status).toBe(0);
      expect(git(sb, root, 'rev-parse', 'HEAD')).not.toBe(before);
    },
    SLOW,
  );

  it(
    '[R-H-08][R-H-07] dieselbe Nummer in einer Datei der WAP-Pfadmenge blockiert den Merge (P35, Gegenprobe)',
    () => {
      const sb = createSandbox();
      const root = setup(sb);
      git(sb, root, 'checkout', '-q', '-b', 'thema');
      expect(
        tryCommit(sb, root, { 'tests/wap/io.test.ts': `export const tel = '${TELEFON}';\n` })
          .committed,
      ).toBe(true);
      git(sb, root, 'checkout', '-q', 'wap-planer');
      expect(
        tryCommit(sb, root, { 'docs/wap-planer/sauber.md': 'Hptm Muster A\n' }).committed,
      ).toBe(true);
      const before = git(sb, root, 'rev-parse', 'HEAD');
      const r = gitRaw(sb, root, 'merge', '--no-ff', '-q', '-m', 'Integration', 'thema');
      expect(r.status).not.toBe(0);
      expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(before);
    },
    SLOW,
  );
});

describe('P42: Verstoss im Vergleichsstand (CR-H0S-29)', () => {
  /** HEAD verstösst gegen P37/P38 (angehängter Text); Hook erst danach installiert. */
  function setupHeadUngueltig(sb: Sandbox, verstoss = ZWEITE_TABELLE): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    appendFindingsText(root, verstoss);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit Verstoss im Protokollabschnitt');
    expect(install(sb, root).status).toBe(0);
    return root;
  }

  function reparieren(root: string, verstoss = ZWEITE_TABELLE): void {
    const text = readText(root, FINDINGS_PATH);
    expect(text.endsWith(verstoss)).toBe(true);
    writeText(root, FINDINGS_PATH, text.slice(0, text.length - verstoss.length));
  }

  function commitStaged(sb: Sandbox, root: string) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it.each(VERGLEICHSSTAND_VERSTOESSE)(
    '[R-H-08][R-H-06] unabhängiger Commit bei Verstoss im HEAD (%s), Sperrdatei unverändert: läuft durch, Hinweis (P42, P42a, Angriff B11)',
    (_label, verstoss, p37Hinweis) => {
      const sb = createSandbox();
      const root = setupHeadUngueltig(sb, verstoss);
      writeText(root, 'docs/wap-planer/notiz.md', 'Notiz\n');
      git(sb, root, 'add', 'docs/wap-planer/notiz.md');
      const direkt = runScript(sb, root, 'pre-commit.mjs', []);
      expect(direkt.status).toBe(0);
      if (p37Hinweis) expect(direkt.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
      const { r, committed } = commitStaged(sb, root);
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    60_000,
  );

  it.each(VERGLEICHSSTAND_VERSTOESSE)(
    '[R-H-08][R-H-06] Reparatur-Commit bei Verstoss im HEAD (%s): läuft durch, Hinweis auf den Vergleichsstand (P42, Angriff B10)',
    (_label, verstoss, p37Hinweis) => {
      const sb = createSandbox();
      const root = setupHeadUngueltig(sb, verstoss);
      reparieren(root, verstoss);
      git(sb, root, 'add', FINDINGS_PATH);
      const direkt = runScript(sb, root, 'pre-commit.mjs', []);
      expect(direkt.status).toBe(0);
      if (p37Hinweis) expect(direkt.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
      const { r, committed } = commitStaged(sb, root);
      expect(r.status).toBe(0);
      expect(committed).toBe(true);
    },
    60_000,
  );

  it('[R-H-08][R-H-06] Abschnitt unverändert, nur Zeilenenden auf CRLF umgestellt, Sperrdatei unverändert: läuft durch (P42a, TR-H0-62 d)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb);
    const text = readText(root, FINDINGS_PATH);
    writeText(root, FINDINGS_PATH, text.replace(/\n/g, '\r\n'));
    git(sb, root, 'add', FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it.each([
    ['weitere |-Zeile an der zweiten Tabelle (P37)', '| z | w |\n'],
    ['HTML-Kommentar im Abschnitt (P38)', '\n<!-- Notiz -->\n'],
  ])(
    '[R-H-08][R-H-06] Verstoss im HEAD und zusätzlicher neuer Verstoss (%s), Sperrdatei unverändert: Exit 1, kein Commit (P42a, TR-H0-58)',
    (_label, neu) => {
      const sb = createSandbox();
      const root = setupHeadUngueltig(sb);
      appendFindingsText(root, neu);
      git(sb, root, 'add', FINDINGS_PATH);
      expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
      const { r, committed } = commitStaged(sb, root);
      expect(r.status).not.toBe(0);
      expect(committed).toBe(false);
    },
    60_000,
  );

  it('[R-H-08][R-H-06] Verstoss im HEAD, Abschnitt nur um einen Textabsatz ergänzt (kein neuer Verstoss), Sperrdatei unverändert: Exit 1, kein Commit (P42c)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb);
    appendFindingsText(root, ZUSATZ_ABSATZ);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    const { r, committed } = commitStaged(sb, root);
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] doppelter Titel im HEAD, Sperrdatei geändert, Zeile an den Block nach dem ersten Titel angehängt: läuft durch (P42b a, TR-H0-67)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb, ZWEITER_TITEL_MIT_BLOCK);
    reparieren(root, ZWEITER_TITEL_MIT_BLOCK);
    writeText(root, 'tests/a.test.ts', 'export const a = 3;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Nachgeführt',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] doppelter Titel im HEAD, Sperrdatei geändert, alte Zeile des ersten Blocks umgeschrieben: Exit 1, kein Commit (P42b a, TR-H0-67)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb, ZWEITER_TITEL_MIT_BLOCK);
    reparieren(root, ZWEITER_TITEL_MIT_BLOCK);
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('Protokollzeile geändert oder entfernt');
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] Verstoss im HEAD, Sperrdatei geändert, neuer Stand weiterhin ungültig: Exit 1, kein Commit (P42b b, TR-H0-58)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb);
    const inhalt = "export const a = 'neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
    // Korrekte Protokollzeile direkt im P37-Block, die zweite Tabelle bleibt stehen.
    ersetzeZeile(
      root,
      ALTE_PROTOKOLLZEILE,
      `${ALTE_PROTOKOLLZEILE}\n${protokollZeile(['tests/a.test.ts'])}`,
    );
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] Vergleichsstand ungültig, Sperrdatei geändert, Zeile korrekt an den P37-Block angehängt: läuft durch, Hinweis (P42)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb);
    reparieren(root);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Nachgeführt',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(0);
    expect(direkt.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
    expect(commitStaged(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] Vergleichsstand ungültig, Sperrdatei geändert, alte Zeile des P37-Blocks umgeschrieben: Exit 1 (P42)', () => {
    const sb = createSandbox();
    const root = setupHeadUngueltig(sb);
    reparieren(root);
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('Protokollzeile geändert oder entfernt');
    expect(commitStaged(sb, root).committed).toBe(false);
  }, 60_000);
});

describe('P43: Verschleierung des Protokollabschnitts im Commit (CR-H0S-30)', () => {
  it.each(VERSCHLEIERUNG)(
    '[R-H-08][R-H-06] %s: pre-commit.mjs Exit 1, Commit scheitert (P43)',
    (_label, umformen) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, umformen);
      git(sb, root, 'add', FINDINGS_PATH);
      expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
      const before = git(sb, root, 'rev-parse', 'HEAD');
      expect(gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch').status).not.toBe(0);
      expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(before);
    },
    60_000,
  );

  it('[R-H-08][R-H-06] mehrzeiliger Kommentar vor dem Titel, vor dem Titel geschlossen: Commit läuft durch (P43 a, Gegenprobe, TR-H0-65)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    umformenFindings(root, kommentarVorTitelGeschlossen);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    const before = git(sb, root, 'rev-parse', 'HEAD');
    expect(gitRaw(sb, root, 'commit', '-q', '-m', 'Kommentar').status).toBe(0);
    expect(git(sb, root, 'rev-parse', 'HEAD')).not.toBe(before);
  }, 60_000);
});

describe('P42d und P43d im Commit (CR-H0S-34)', () => {
  /** HEAD mit P37-Verstoss und folgendem `## Danach`-Abschnitt; Hook danach installiert. */
  function setupHeadMitDanach(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    appendFindingsText(root, VERSTOSS_MIT_DANACH);
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit Verstoss und Folgeabschnitt');
    expect(install(sb, root).status).toBe(0);
    return root;
  }

  function versuch(sb: Sandbox, root: string) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it('[R-H-08][R-H-06] HEAD mit Verstoss «ausserhalb», neu offener Kommentar vor dem Titel bis in den nächsten ##-Abschnitt, Sperrdatei unverändert: Exit 1, kein Commit (P42d, Angriff C1)', () => {
    const sb = createSandbox();
    const root = setupHeadMitDanach(sb);
    umformenFindings(root, kommentarBisDanach);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    const { r, committed } = versuch(sb, root);
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-06] HEAD mit Verstoss «ausserhalb» und Folgeabschnitt, Abschnitt unverändert, Sperrdatei unverändert: läuft durch (P42d, Gegenprobe B11)', () => {
    const sb = createSandbox();
    const root = setupHeadMitDanach(sb);
    writeText(root, 'docs/wap-planer/notiz.md', 'Notiz\n');
    git(sb, root, 'add', 'docs/wap-planer/notiz.md');
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(versuch(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] HEAD mit Verstoss «ausserhalb», neu ein gleichlautender ###-Titel im Abschnitt «## Danach» (andere Fehlerart), Sperrdatei unverändert: Exit 1, kein Commit (P42d, TR-H0-76)', () => {
    const sb = createSandbox();
    const root = setupHeadMitDanach(sb);
    appendFindingsText(root, `\n${TITEL_H3}\n`);
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
    expect(versuch(sb, root).committed).toBe(false);
  }, 60_000);

  it.each(TITEL_EBENEN)(
    '[R-H-08][R-H-06] %s: pre-commit.mjs Exit 1, kein Commit (P43d)',
    (_label, umformen) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, umformen);
      git(sb, root, 'add', FINDINGS_PATH);
      expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
      expect(versuch(sb, root).committed).toBe(false);
    },
    60_000,
  );

  it('[R-H-08][R-H-06] genau ein ##-Titel, Abschnitt korrekt: pre-commit.mjs Exit 0 (P43d, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\nHinweis unter dem Protokoll.\n');
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(versuch(sb, root).committed).toBe(true);
  }, 60_000);
});

describe('P43f und P42b (a) präzisiert im Commit', () => {
  function versuch(sb: Sandbox, root: string) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-08][R-H-06] einzige Titelzeile mit %s eingerückt: pre-commit.mjs Exit 1, kein Commit (P43f)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, titelEingerueckt(einrueckung));
      git(sb, root, 'add', FINDINGS_PATH);
      expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(1);
      expect(versuch(sb, root).committed).toBe(false);
    },
    60_000,
  );

  it('[R-H-08][R-H-06] Titelzeile mit 3 Leerzeichen eingerückt: Commit läuft durch (P43f, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    umformenFindings(root, titelEingerueckt('   '));
    git(sb, root, 'add', FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    expect(versuch(sb, root).committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-06] K6: HEAD mit ###-Block vor dem ##-Titel, Sperrdatei geändert, Zeile b des ##-Blocks umgeschrieben: Exit 1, kein Commit (P42b a präzisiert)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    umformenFindings(root, (t) =>
      t.replace(PROTOKOLL_TITEL, `${H3_BLOCK_VOR_TITEL}${PROTOKOLL_TITEL}`),
    );
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit ###-Block');
    expect(install(sb, root).status).toBe(0);
    umformenFindings(root, (t) => t.replace(H3_BLOCK_VOR_TITEL, ''));
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    const direkt = runScript(sb, root, 'pre-commit.mjs', []);
    expect(direkt.status).toBe(1);
    expect(direkt.out).toContain('Protokollzeile geändert oder entfernt');
    expect(versuch(sb, root).committed).toBe(false);
  }, 60_000);
});

describe('K6-Gegenprobe und Teil-Commit mit GIT_INDEX_FILE (P42b a präzisiert, P39e; TR-H0-84 c, -87)', () => {
  function versuch(sb: Sandbox, root: string, ...args: string[]) {
    const before = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch', ...args);
    return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== before };
  }

  it('[R-H-08][R-H-06] K6: HEAD mit ###-Block vor dem ##-Titel, Sperrdatei geändert, Zeile b unverändert, neue Zeile angehängt: Commit läuft durch (P42b a präzisiert, Gegenprobe, TR-H0-87)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    umformenFindings(root, (t) =>
      t.replace(PROTOKOLL_TITEL, `${H3_BLOCK_VOR_TITEL}${PROTOKOLL_TITEL}`),
    );
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit ###-Block');
    expect(install(sb, root).status).toBe(0);
    umformenFindings(root, (t) => t.replace(H3_BLOCK_VOR_TITEL, ''));
    const inhalt = "export const a = 'neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    writeLock(root, { 'tests/a.test.ts': sha256Lf(inhalt) });
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH, FINDINGS_PATH);
    expect(runScript(sb, root, 'pre-commit.mjs', []).status).toBe(0);
    const { r, committed } = versuch(sb, root);
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-07] Teil-Commit «git commit -- docs/wap-planer/p.md» mit Telefonnummer nur im Arbeitsbaum (nicht gestagt): kein Commit (P39e, GIT_INDEX_FILE, TR-H0-84 c)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    expect(tryCommit(sb, root, { 'docs/wap-planer/p.md': 'Hptm Muster A\n' }).committed).toBe(true);
    writeText(root, 'docs/wap-planer/p.md', `Kontakt ${['07', '9 483 26 15'].join('')}\n`);
    const { r, committed } = versuch(sb, root, '--', 'docs/wap-planer/p.md');
    expect(r.status).not.toBe(0);
    expect(committed).toBe(false);
  }, 60_000);

  it('[R-H-08][R-H-07] Teil-Commit «git commit -- docs/wap-planer/p.md» mit sauberem Inhalt: Commit läuft durch (P39e, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    expect(tryCommit(sb, root, { 'docs/wap-planer/p.md': 'Hptm Muster A\n' }).committed).toBe(true);
    writeText(root, 'docs/wap-planer/p.md', 'Hptm Muster B\n');
    const { r, committed } = versuch(sb, root, '--', 'docs/wap-planer/p.md');
    expect(r.status).toBe(0);
    expect(committed).toBe(true);
  }, 60_000);
});

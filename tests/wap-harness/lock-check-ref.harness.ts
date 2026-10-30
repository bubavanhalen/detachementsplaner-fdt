// Lock-Prüfung aus git-Objekten: scripts/wap/lock-check.mjs --root <verz> --ref <ref> [--gegen <basis>] – R-H-05.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P47 (mit P44 a und d, P45),
// dazu P1, P27, P42. Arbeitsbaum, Index-Flags und sparse checkout dürfen nicht wirken.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  ALTE_PROTOKOLLZEILE_NR,
  addWorktree,
  appendFindingsText,
  appendProtokoll,
  cleanupSandboxes,
  ersetzeZeile,
  expectProtokollMeldung,
  FINDINGS_PATH,
  FINDINGS_TEMPLATE,
  git,
  initRepo,
  LOCK_PATH,
  lockFiles,
  protokollZeile,
  type RunResult,
  readLock,
  readText,
  runScript,
  type Sandbox,
  sha256Lf,
  writeLock,
  writeText,
  ZWEITE_TABELLE,
} from './helpers';
import { blobAus, commitDateien, commonDir, fileUrl, sandbox } from './helpers-objekte';

afterEach(cleanupSandboxes);

const A = 'tests/a.test.ts';
const B = 'tests/unter/b.test.ts';
const A_INHALT = 'export const a = 1;\n';
const B_INHALT = 'export const b = [1, 2];\n';
const ABGESCHWAECHT = 'export const a = 0; // abgeschwächt\n';

/** Versionierter Sperrstand mit zwei gesperrten Dateien auf wap-planer. */
function sperrstand(sb: Sandbox): string {
  const root = initRepo(sb, 'haupt');
  lockFiles(root, { [A]: A_INHALT, [B]: B_INHALT });
  git(sb, root, 'add', A, B, LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  return root;
}

function check(
  sb: Sandbox,
  scriptRoot: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
  return runScript(sb, scriptRoot, 'lock-check.mjs', args, {
    cwd: options.cwd ?? scriptRoot,
    env: options.env,
  });
}

function ref(sb: Sandbox, root: string, r: string, ...weitere: string[]): RunResult {
  return check(sb, root, ['--root', root, '--ref', r, ...weitere]);
}

/** Paket-Worktree auf wap/p; der Arbeits-Checkout bleibt auf wap-planer. */
function paket(sb: Sandbox, root: string): string {
  return addWorktree(sb, root, join(sb.base, 'wt', 'p'), 'wap/p');
}

describe('lock-check --root --ref: Hashes aus Blobs des Stands <ref> (P47)', () => {
  it('[R-H-05] unveränderter Sperrstand → --ref HEAD Exit 0, «Lock-Prüfung: 2 Dateien in Ordnung»', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const r = ref(sb, root, 'HEAD');
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 2 Dateien in Ordnung');
  }, 60_000);

  it('[R-H-05] gesperrte Datei im Ref geändert, per skip-worktree im Arbeitsbaum sauber (bisheriger Modus Exit 0) → --ref HEAD Exit 1, «geändert» mit Pfad', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    commitDateien(sb, root, { [A]: ABGESCHWAECHT }, 'abgeschwächt');
    git(sb, root, 'update-index', '--skip-worktree', A);
    writeText(root, A, A_INHALT);
    expect(check(sb, root, ['--root', root]).status).toBe(0);
    const r = ref(sb, root, 'HEAD');
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain(A);
  }, 60_000);

  it('[R-H-05] aus dem Arbeits-Checkout auf den Paket-Zweig: gesperrte Datei in wap/p geändert → --ref wap/p Exit 1, «geändert» mit Pfad', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const wt = paket(sb, root);
    commitDateien(sb, wt, { [A]: ABGESCHWAECHT }, 'abgeschwächt');
    const r = ref(sb, root, 'wap/p');
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain(A);
  }, 60_000);

  it('[R-H-05] gesperrte Datei in wap/p entfernt → --ref wap/p Exit 1, «fehlt» mit Pfad', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const wt = paket(sb, root);
    git(sb, wt, 'rm', '-q', B);
    git(sb, wt, 'commit', '-q', '--no-verify', '-m', 'entfernt');
    const r = ref(sb, root, 'wap/p');
    expect(r.status).toBe(1);
    expect(r.out).toContain('fehlt');
    expect(r.out).toContain(B);
  }, 60_000);

  it('[R-H-05] Ref mit nachgeführter test-lock.json und passender Datei, Arbeitsbaum mit alter test-lock.json → --ref HEAD Exit 0 (Sperrdatei aus <ref>)', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const alt = readLock(root);
    lockFiles(root, { [A]: ABGESCHWAECHT, [B]: B_INHALT });
    git(sb, root, 'add', A, LOCK_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'nachgeführt');
    writeLock(root, alt.files);
    expect(check(sb, root, ['--root', root]).status).toBe(1);
    expect(ref(sb, root, 'HEAD').status).toBe(0);
  }, 60_000);

  it('[R-H-05] sparse checkout ohne tests/: Sperrdateien fehlen auf dem Datenträger, Ref unverändert → --ref HEAD Exit 0', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    git(sb, root, 'sparse-checkout', 'set', '--no-cone', '/docs/', '/README.md');
    expect(check(sb, root, ['--root', root]).status).toBe(1);
    expect(ref(sb, root, 'HEAD').status).toBe(0);
  }, 60_000);

  it('[R-H-05] P1: gesperrte Datei im Blob mit CRLF, Hash über LF → --ref HEAD Exit 0', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { [A]: 'export const a = 1;\r\nexport const c = 3;\r\n' });
    git(sb, root, 'add', A, LOCK_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand CRLF');
    expect(ref(sb, root, 'HEAD').status).toBe(0);
  }, 60_000);

  it('[R-H-05] P45: gesperrte Datei im Ref geändert, Ersatzobjekt zeigt den alten Blob → --ref HEAD Exit 1, «geändert» mit Pfad', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const alt = git(sb, root, 'rev-parse', `HEAD:${A}`);
    commitDateien(sb, root, { [A]: ABGESCHWAECHT }, 'abgeschwächt');
    git(sb, root, 'replace', git(sb, root, 'rev-parse', `HEAD:${A}`), alt);
    writeText(root, A, A_INHALT);
    git(sb, root, 'update-index', '--skip-worktree', A);
    const r = ref(sb, root, 'HEAD');
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain(A);
  }, 60_000);

  it('[R-H-05] P45: unveränderter Ref, Ersatzobjekt zeigt einen geänderten Blob → --ref HEAD Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    git(
      sb,
      root,
      'replace',
      git(sb, root, 'rev-parse', `HEAD:${A}`),
      blobAus(sb, root, ABGESCHWAECHT),
    );
    expect(ref(sb, root, 'HEAD').status).toBe(0);
  }, 60_000);
});

describe('lock-check --root --ref: Wurzel, Ref und Umgebung (P47 mit P44 a, d)', () => {
  const FALSCH: Array<[string, (sb: Sandbox, root: string) => string[]]> = [
    ['--ref ohne --root', () => ['--ref', 'HEAD']],
    [
      '--root ist ein Unterordner der Wurzel',
      (_sb, root) => ['--root', join(root, 'docs'), '--ref', 'HEAD'],
    ],
    ['unbekannter Ref', (_sb, root) => ['--root', root, '--ref', 'nichtda']],
    [
      'unbekannte Basis bei --gegen',
      (_sb, root) => ['--root', root, '--ref', 'HEAD', '--gegen', 'nichtda'],
    ],
  ];

  it.each(FALSCH)(
    '[R-H-05] %s → Exit 1; derselbe unveränderte Stand mit gültigem Aufruf → Exit 0',
    (_label, args) => {
      const sb = sandbox();
      const root = sperrstand(sb);
      expect(ref(sb, root, 'HEAD', '--gegen', 'HEAD').status).toBe(0);
      expect(check(sb, root, args(sb, root)).status).toBe(1);
    },
    60_000,
  );

  it.each(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'])(
    '[R-H-05] %s auf ein Köder-Repo mit unverändertem Sperrstand gesetzt, gesperrte Datei im Ref von --root geändert → --ref HEAD Exit 1, «geändert» wie ohne Variable',
    (name) => {
      const sb = sandbox();
      const root = sperrstand(sb);
      commitDateien(sb, root, { [A]: ABGESCHWAECHT }, 'abgeschwächt');
      const koeder = join(sb.base, 'koeder');
      git(sb, sb.base, 'clone', '-q', '--no-hardlinks', root, 'koeder');
      git(sb, koeder, 'reset', '-q', '--hard', 'HEAD~1');
      const wert =
        name === 'GIT_DIR'
          ? join(koeder, '.git')
          : name === 'GIT_WORK_TREE'
            ? koeder
            : join(koeder, '.git', 'index');
      const r = check(sb, root, ['--root', root, '--ref', 'HEAD'], {
        env: { ...sb.env, [name]: wert },
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain('geändert');
      expect(r.out).toContain(A);
    },
    60_000,
  );
});

describe('lock-check --root --ref --gegen: P27/P42 aus Objekten (P47)', () => {
  /** Im Paket-Worktree: gesperrte Datei ändern, test-lock.json nachführen, FINDINGS anpassen, committen. */
  function paketNachfuehrung(sb: Sandbox, root: string, anpassen: (wt: string) => void): void {
    const wt = paket(sb, root);
    writeText(wt, A, ABGESCHWAECHT);
    const lock = readLock(wt);
    lock.files[A] = sha256Lf(ABGESCHWAECHT);
    writeLock(wt, lock.files);
    anpassen(wt);
    git(sb, wt, 'add', A, LOCK_PATH, FINDINGS_PATH);
    git(sb, wt, 'commit', '-q', '--no-verify', '-m', 'Nachführung');
  }

  it('[R-H-05] im Ref korrekt angehängte Protokollzeile für die nachgeführte Datei → --ref wap/p --gegen wap-planer Exit 0', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    paketNachfuehrung(sb, root, (wt) => appendProtokoll(wt, protokollZeile([A])));
    const r = ref(sb, root, 'wap/p', '--gegen', 'wap-planer');
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05] im Ref umgeschriebene alte Protokollzeile → --ref wap/p --gegen wap-planer Exit 1, «Protokollzeile geändert oder entfernt» mit Zeilennummer', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    paketNachfuehrung(sb, root, (wt) => {
      ersetzeZeile(
        wt,
        ALTE_PROTOKOLLZEILE,
        ALTE_PROTOKOLLZEILE.replace('Startbestand', 'umgeschrieben'),
      );
      appendProtokoll(wt, protokollZeile([A]));
    });
    const r = ref(sb, root, 'wap/p', '--gegen', 'wap-planer');
    expect(r.status).toBe(1);
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  it('[R-H-05] im Ref nachgeführte test-lock.json ohne Protokollzeile → --ref wap/p --gegen wap-planer Exit 1 mit Pfad', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    paketNachfuehrung(sb, root, () => undefined);
    const r = ref(sb, root, 'wap/p', '--gegen', 'wap-planer');
    expect(r.status).toBe(1);
    expect(r.out).toContain(A);
  }, 60_000);

  it('[R-H-05] Arbeitsbaum mit umgeschriebener Protokollzeile und unprotokollierter Nachführung, Ref unverändert → --ref HEAD --gegen HEAD Exit 0 (Arbeitsbaum wirkt nicht)', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    ersetzeZeile(
      root,
      ALTE_PROTOKOLLZEILE,
      ALTE_PROTOKOLLZEILE.replace('Startbestand', 'umgeschrieben'),
    );
    lockFiles(root, { [A]: ABGESCHWAECHT, [B]: B_INHALT });
    expect(check(sb, root, ['--root', root, '--gegen', 'HEAD']).status).toBe(1);
    expect(ref(sb, root, 'HEAD', '--gegen', 'HEAD').status).toBe(0);
  }, 60_000);
});

describe('lock-check --root --ref: grafts und flaches Repo → Exit 1 (P47a)', () => {
  it('[R-H-05] <git-common-dir>/info/grafts vorhanden → --ref HEAD Exit 1; derselbe unveränderte Stand ohne grafts → Exit 0', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    expect(ref(sb, root, 'HEAD').status).toBe(0);
    writeText(commonDir(sb, root), 'info/grafts', `${git(sb, root, 'rev-parse', 'HEAD')}\n`);
    expect(ref(sb, root, 'HEAD').status).toBe(1);
  }, 60_000);

  it('[R-H-05] flacher Klon (--depth 1) des Sperrstands → --ref HEAD Exit 1; vollständiger Klon desselben Repos → Exit 0', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    git(sb, sb.base, 'clone', '-q', fileUrl(root), 'voll');
    git(sb, sb.base, 'clone', '-q', '--depth', '1', fileUrl(root), 'flach');
    const voll = join(sb.base, 'voll');
    const flach = join(sb.base, 'flach');
    expect(git(sb, flach, 'rev-parse', '--is-shallow-repository')).toBe('true');
    expect(check(sb, root, ['--root', voll, '--ref', 'HEAD']).status).toBe(0);
    expect(check(sb, root, ['--root', flach, '--ref', 'HEAD']).status).toBe(1);
  }, 60_000);
});

describe('lock-check --root --ref: Umgebung GIT_OBJECT_DIRECTORY (P47, P44 d; TR-H0-100)', () => {
  it('[R-H-05] GIT_OBJECT_DIRECTORY auf die Objekte eines fremden Köder-Repos, gesperrte Datei im Ref geändert → --ref HEAD Exit 1, «geändert» wie ohne Variable', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    commitDateien(sb, root, { [A]: ABGESCHWAECHT }, 'abgeschwächt');
    const koeder = initRepo(sb, 'koeder');
    const r = check(sb, root, ['--root', root, '--ref', 'HEAD'], {
      env: { ...sb.env, GIT_OBJECT_DIRECTORY: join(koeder, '.git', 'objects') },
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain(A);
  }, 60_000);

  it('[R-H-05] GIT_OBJECT_DIRECTORY auf die Objekte eines fremden Köder-Repos, Ref unverändert → --ref HEAD Exit 0 wie ohne Variable (Gegenprobe)', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    const koeder = initRepo(sb, 'koeder');
    const r = check(sb, root, ['--root', root, '--ref', 'HEAD'], {
      env: { ...sb.env, GIT_OBJECT_DIRECTORY: join(koeder, '.git', 'objects') },
    });
    expect(r.status).toBe(0);
  }, 60_000);
});

describe('lock-check --root --ref --gegen: ungültiger Vergleichsstand (P42 aus Objekten; TR-H0-109)', () => {
  /** Vergleichsstand wap-planer mit zweiter Tabelle im Protokollabschnitt (P37-Verstoss). */
  function basisMitZweiterTabelle(sb: Sandbox): string {
    const root = sperrstand(sb);
    appendFindingsText(root, ZWEITE_TABELLE);
    git(sb, root, 'add', FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Verstoss im Vergleichsstand');
    return root;
  }

  it('[R-H-05] Vergleichsstand mit zweiter Tabelle, Ref mit unverändertem Lock und gleichem Protokollabschnitt → --ref wap/p --gegen wap-planer Exit 0 (P42/P42a)', () => {
    const sb = sandbox();
    const root = basisMitZweiterTabelle(sb);
    const wt = paket(sb, root);
    commitDateien(sb, wt, { 'docs/wap-planer/x.md': 'Hptm Muster A\n' }, 'unabhängig');
    expect(ref(sb, root, 'wap/p', '--gegen', 'wap-planer').status).toBe(0);
  }, 60_000);

  it('[R-H-05] Vergleichsstand mit zweiter Tabelle, Ref mit geändertem Lock und weiterhin ungültigem Protokollabschnitt → --ref wap/p --gegen wap-planer Exit 1 (P42b b); vor der Nachführung Exit 0', () => {
    const sb = sandbox();
    const root = basisMitZweiterTabelle(sb);
    const wt = paket(sb, root);
    expect(ref(sb, root, 'wap/p', '--gegen', 'wap-planer').status).toBe(0);
    lockFiles(wt, { [A]: ABGESCHWAECHT, [B]: B_INHALT });
    // TR-H0-111: Die Protokollzeile steht in der Protokoll-Tabelle direkt nach der alten Zeile (vor
    // ZWEITE_TABELLE). Sie protokolliert die Nachführung korrekt; Exit 1 entsteht nur aus P42b (b).
    ersetzeZeile(wt, ALTE_PROTOKOLLZEILE, `${ALTE_PROTOKOLLZEILE}\n${protokollZeile([A])}`);
    expect(readText(wt, FINDINGS_PATH).indexOf(protokollZeile([A]))).toBeLessThan(
      readText(wt, FINDINGS_PATH).indexOf('| x | y |'),
    );
    git(sb, wt, 'add', A, LOCK_PATH, FINDINGS_PATH);
    git(sb, wt, 'commit', '-q', '--no-verify', '-m', 'Nachführung');
    expect(ref(sb, root, 'wap/p', '--gegen', 'wap-planer').status).toBe(1);
  }, 60_000);

  it('[R-H-05] Vergleichsstand mit zweiter Tabelle, Ref mit geändertem Lock, zweite Tabelle entfernt und Zeile korrekt angehängt (neuer Stand gültig) → --ref wap/p --gegen wap-planer Exit 0 (P42, TR-H0-111)', () => {
    const sb = sandbox();
    const root = basisMitZweiterTabelle(sb);
    const wt = paket(sb, root);
    lockFiles(wt, { [A]: ABGESCHWAECHT, [B]: B_INHALT });
    writeText(wt, FINDINGS_PATH, FINDINGS_TEMPLATE);
    appendProtokoll(wt, protokollZeile([A]));
    git(sb, wt, 'add', A, LOCK_PATH, FINDINGS_PATH);
    git(sb, wt, 'commit', '-q', '--no-verify', '-m', 'Nachführung, Verstoss behoben');
    expect(ref(sb, root, 'wap/p', '--gegen', 'wap-planer').status).toBe(0);
  }, 60_000);
});

// Ersetzungsobjekte (git replace) wirken in keinem Harness-Skript – R-H-07, R-H-08, R-H-05.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P45 (Probe T2 aus
// .qa/h0/eskalation-1/probe-staged.sh); betrifft privacy-scan --staged, pre-commit.mjs (P9, P14) und
// lock-check --gegen. Verbotene Muster zur Laufzeit zusammengesetzt; nur fiktive Daten.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  ALTE_PROTOKOLLZEILE_NR,
  appendProtokoll,
  cleanupSandboxes,
  ersetzeZeile,
  expectProtokollMeldung,
  FINDINGS_PATH,
  FINDINGS_TEMPLATE,
  git,
  gitRaw,
  initRepo,
  LOCK_PATH,
  lockFiles,
  protokollZeile,
  runScript,
  type Sandbox,
  sha256Lf,
  writeLock,
  writeText,
} from './helpers';
import {
  ART_TELEFON,
  blobAus,
  expectBefund,
  expectMasked,
  sandbox,
  scanObjekte,
  TELEFON,
} from './helpers-objekte';

afterEach(cleanupSandboxes);

const P = 'docs/wap-planer/p.md';
const GESPERRT = 'tests/a.test.ts';
const ORIGINAL = 'export const a = 1;\n';
const ABGESCHWAECHT = 'export const a = 0; // abgeschwächt\n';

/** Ersetzt das Objekt `alt` durch `neu` (refs/replace). */
function ersetze(sb: Sandbox, root: string, alt: string, neu: string): void {
  git(sb, root, 'replace', alt, neu);
}

describe('privacy-scan --staged: git replace wirkt nicht (P45)', () => {
  it('[R-H-07] gestagter Blob mit Telefonnummer, per git replace durch einen sauberen ersetzt → --staged Exit 1, Befund «<pfad>:1:», maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, P, `Kontakt ${TELEFON}\n`);
    git(sb, root, 'add', P);
    ersetze(sb, root, git(sb, root, 'rev-parse', `:${P}`), blobAus(sb, root, 'sauber\n'));
    const r = scanObjekte(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] sauberer gestagter Blob, per git replace durch einen mit Telefonnummer ersetzt → --staged Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, P, 'Hptm Muster A\n');
    git(sb, root, 'add', P);
    ersetze(
      sb,
      root,
      git(sb, root, 'rev-parse', `:${P}`),
      blobAus(sb, root, `Kontakt ${TELEFON}\n`),
    );
    expect(scanObjekte(sb, root, ['--staged']).status).toBe(0);
  }, 60_000);
});

describe('Commit-Hook: git replace wirkt nicht (P45, P9)', () => {
  /** Repo mit versionierter Sperre und installiertem Hook (wie commit-hook.harness.ts). */
  function setup(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { [GESPERRT]: ORIGINAL });
    git(sb, root, 'add', GESPERRT, LOCK_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
    return root;
  }

  function commitVersuch(sb: Sandbox, root: string): { status: number | null; committed: boolean } {
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return { status: r.status, committed: git(sb, root, 'rev-parse', 'HEAD') !== vorher };
  }

  it('[R-H-08][R-H-07] gestagter Blob mit Telefonnummer, per git replace als sauber gezeigt → Commit scheitert, HEAD unverändert', () => {
    const sb = sandbox();
    const root = setup(sb);
    writeText(root, P, `Kontakt ${TELEFON}\n`);
    git(sb, root, 'add', P);
    ersetze(sb, root, git(sb, root, 'rev-parse', `:${P}`), blobAus(sb, root, 'sauber\n'));
    const v = commitVersuch(sb, root);
    expect(v.committed).toBe(false);
    expect(v.status).not.toBe(0);
  }, 60_000);

  it('[R-H-08][R-H-07] sauberer gestagter Blob, per git replace als Blob mit Telefonnummer gezeigt → Commit gelingt (Gegenprobe)', () => {
    const sb = sandbox();
    const root = setup(sb);
    writeText(root, P, 'Hptm Muster A\n');
    git(sb, root, 'add', P);
    ersetze(
      sb,
      root,
      git(sb, root, 'rev-parse', `:${P}`),
      blobAus(sb, root, `Kontakt ${TELEFON}\n`),
    );
    const v = commitVersuch(sb, root);
    expect(v.status).toBe(0);
    expect(v.committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-05] gestagte geänderte gesperrte Datei, per git replace als unverändert gezeigt, Arbeitsbaum unverändert → Commit scheitert (P9), HEAD unverändert', () => {
    const sb = sandbox();
    const root = setup(sb);
    writeText(root, GESPERRT, ABGESCHWAECHT);
    git(sb, root, 'add', GESPERRT);
    ersetze(
      sb,
      root,
      git(sb, root, 'rev-parse', `:${GESPERRT}`),
      git(sb, root, 'rev-parse', `HEAD:${GESPERRT}`),
    );
    writeText(root, GESPERRT, ORIGINAL);
    const v = commitVersuch(sb, root);
    expect(v.committed).toBe(false);
    expect(v.status).not.toBe(0);
  }, 60_000);

  it('[R-H-08][R-H-05] unveränderte gesperrte Datei, per git replace als geändert gezeigt, sauberer Commit einer anderen Datei → Commit gelingt (Gegenprobe)', () => {
    const sb = sandbox();
    const root = setup(sb);
    ersetze(
      sb,
      root,
      git(sb, root, 'rev-parse', `HEAD:${GESPERRT}`),
      blobAus(sb, root, ABGESCHWAECHT),
    );
    writeText(root, 'docs/wap-planer/sauber.md', 'Hptm Muster A\n');
    git(sb, root, 'add', 'docs/wap-planer/sauber.md');
    const v = commitVersuch(sb, root);
    expect(v.status).toBe(0);
    expect(v.committed).toBe(true);
  }, 60_000);

  it('[R-H-08][R-H-05] P14: gesperrte Datei und test-lock.json konsistent geändert und gestagt, ohne Protokollzeile; Ersatzobjekt zeigt HEAD:test-lock.json als die gestagte → Commit scheitert, HEAD unverändert (TR-H0-101)', () => {
    const sb = sandbox();
    const root = setup(sb);
    lockFiles(root, { [GESPERRT]: ABGESCHWAECHT });
    git(sb, root, 'add', GESPERRT, LOCK_PATH);
    ersetze(
      sb,
      root,
      git(sb, root, 'rev-parse', `HEAD:${LOCK_PATH}`),
      git(sb, root, 'rev-parse', `:${LOCK_PATH}`),
    );
    const v = commitVersuch(sb, root);
    expect(v.committed).toBe(false);
    expect(v.status).not.toBe(0);
  }, 60_000);

  it('[R-H-08][R-H-05] P14: dieselbe Änderung mit korrekter Protokollzeile; Ersatzobjekt zeigt einen abweichenden HEAD-Lock (zusätzlicher Eintrag) → Commit gelingt (Gegenprobe, TR-H0-101)', () => {
    const sb = sandbox();
    const root = setup(sb);
    lockFiles(root, { [GESPERRT]: ABGESCHWAECHT });
    appendProtokoll(root, protokollZeile([GESPERRT]));
    git(sb, root, 'add', GESPERRT, LOCK_PATH, FINDINGS_PATH);
    const falsch = `${JSON.stringify(
      { version: 1, files: { [GESPERRT]: sha256Lf(ORIGINAL), 'tests/z.test.ts': sha256Lf('z\n') } },
      null,
      2,
    )}\n`;
    ersetze(sb, root, git(sb, root, 'rev-parse', `HEAD:${LOCK_PATH}`), blobAus(sb, root, falsch));
    const v = commitVersuch(sb, root);
    expect(v.status).toBe(0);
    expect(v.committed).toBe(true);
  }, 60_000);
});

describe('lock-check --gegen: git replace wirkt nicht (P45)', () => {
  /** Versionierter Sperrstand; gibt den Commit des Vergleichsstands zurück. */
  function sperrstand(sb: Sandbox): { root: string; ref: string } {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { [GESPERRT]: ORIGINAL });
    git(sb, root, 'add', GESPERRT, LOCK_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it('[R-H-05] gesperrte Datei geändert und test-lock.json ohne Protokoll nachgeführt; Ersatzobjekt zeigt die test-lock.json des Vergleichsstands als neue → --gegen Exit 1 mit Pfad', () => {
    const sb = sandbox();
    const { root, ref } = sperrstand(sb);
    lockFiles(root, { [GESPERRT]: ABGESCHWAECHT });
    const neu = git(sb, root, 'hash-object', '-w', LOCK_PATH);
    ersetze(sb, root, git(sb, root, 'rev-parse', `${ref}:${LOCK_PATH}`), neu);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(GESPERRT);
  }, 60_000);

  it('[R-H-05] nichts geändert; Ersatzobjekt zeigt im Vergleichsstand eine abweichende test-lock.json → --gegen Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const { root, ref } = sperrstand(sb);
    const falsch = `${JSON.stringify({ version: 1, files: { [GESPERRT]: sha256Lf(ABGESCHWAECHT) } }, null, 2)}\n`;
    ersetze(sb, root, git(sb, root, 'rev-parse', `${ref}:${LOCK_PATH}`), blobAus(sb, root, falsch));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05] Kontrolle des Aufbaus: dieselbe Nachführung ohne Ersatzobjekt → --gegen Exit 1 mit Pfad', () => {
    const sb = sandbox();
    const { root, ref } = sperrstand(sb);
    writeLock(root, { [GESPERRT]: sha256Lf(ABGESCHWAECHT) });
    writeText(root, GESPERRT, ABGESCHWAECHT);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(GESPERRT);
  }, 60_000);

  it('[R-H-05] P27: alte Protokollzeile im Arbeitsbaum umgeschrieben, Lock nachgeführt und protokolliert; Ersatzobjekt zeigt <ref>:FINDINGS.md mit der umgeschriebenen Zeile → --gegen Exit 1 «Protokollzeile geändert oder entfernt» (TR-H0-101)', () => {
    const sb = sandbox();
    const { root, ref } = sperrstand(sb);
    ersetzeZeile(
      root,
      ALTE_PROTOKOLLZEILE,
      ALTE_PROTOKOLLZEILE.replace('Startbestand', 'umgeschrieben'),
    );
    const umgeschrieben = git(sb, root, 'hash-object', '-w', FINDINGS_PATH);
    lockFiles(root, { [GESPERRT]: ABGESCHWAECHT });
    appendProtokoll(root, protokollZeile([GESPERRT]));
    ersetze(sb, root, git(sb, root, 'rev-parse', `${ref}:${FINDINGS_PATH}`), umgeschrieben);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  it('[R-H-05] P27: korrekt angehängte Protokollzeile; Ersatzobjekt zeigt <ref>:FINDINGS.md mit gefälschter alter Zeile → --gegen Exit 0 (Gegenprobe, TR-H0-101)', () => {
    const sb = sandbox();
    const { root, ref } = sperrstand(sb);
    lockFiles(root, { [GESPERRT]: ABGESCHWAECHT });
    appendProtokoll(root, protokollZeile([GESPERRT]));
    const gefaelscht = blobAus(sb, root, FINDINGS_TEMPLATE.replace('Startbestand', 'gefälscht'));
    ersetze(sb, root, git(sb, root, 'rev-parse', `${ref}:${FINDINGS_PATH}`), gefaelscht);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);
});

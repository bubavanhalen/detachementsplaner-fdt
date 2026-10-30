// Lock-Prüfung scripts/wap/lock-check.mjs – R-H-05 (und R-H-08 für WAP-Zweige).
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte» Punkte 1 und 3, P1, P9, P14, P27, P31, P34, P37, P38, P38a, P42, P42a, P42b, P42c, P42d, P43, P43d, P43e, P43f, P43g.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  ALTE_PROTOKOLLZEILE_NR,
  ANHANG_ABSCHNITT,
  ANHANG_H1_ABSCHNITT,
  addWorktree,
  appendFindingsText,
  appendProtokoll,
  cleanupSandboxes,
  createSandbox,
  EINRUECKUNG_KEIN_TITEL,
  eingerueckterH3Titel,
  ersetzeZeile,
  expectAusserhalbMeldung,
  expectProtokollMeldung,
  FINDINGS_PATH,
  fuegeVorZeileEin,
  git,
  H3_BLOCK_VOR_TITEL,
  initRepo,
  insertInBefundTabelle,
  kommentarBisDanach,
  kommentarVorTitelGeschlossen,
  LOCK_PATH,
  langeLeerraumZeilen,
  langeTitelZeile,
  lockFiles,
  PROTOKOLL_KOPF,
  PROTOKOLL_TITEL,
  PROTOKOLL_TRENN,
  protokollZeile,
  readLock,
  readText,
  runScript,
  type Sandbox,
  SLOW,
  scheinblockVorTitel,
  sha256Lf,
  TITEL_EBENEN,
  TITEL_H3,
  titelEingerueckt,
  UEBERSCHRIFT_EINGERUECKT_GUELTIG,
  UNTERABSCHNITT_MIT_KOMMENTAR,
  UNTERABSCHNITT_MIT_TABELLE,
  umformenFindings,
  VERGLEICHSSTAND_VERSTOESSE,
  VERSCHLEIERUNG,
  VERSTOSS_MIT_DANACH,
  vertauscheZeilen,
  vieleTitel,
  weiteresMitTabelle,
  writeLock,
  writeText,
  ZUSATZ_ABSATZ,
  ZWEITE_TABELLE,
  ZWEITER_TITEL_MIT_BLOCK,
  zeilenNr,
} from './helpers';

afterEach(cleanupSandboxes);

function setup(sb: Sandbox, branch = 'wap-planer'): string {
  const root = initRepo(sb, 'haupt', { branch });
  lockFiles(root, {
    'tests/a.test.ts': 'export const a = 1;\n',
    'tests/unter/b.test.ts': 'export const b = [1, 2];\n',
  });
  return root;
}

describe('lock-check', () => {
  it('[R-H-05] meldet «Lock-Prüfung: N Dateien in Ordnung» und Exit 0, wenn alle Hashes stimmen', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 2 Dateien in Ordnung');
  }, 60_000);

  it('[R-H-05] meldet eine per Befehl geänderte gesperrte Datei als «geändert» mit Pfad und Exit 1', () => {
    const sb = createSandbox();
    const root = setup(sb);
    // Änderung ausserhalb von Edit/Write, direkt im Dateisystem.
    writeText(root, 'tests/unter/b.test.ts', 'export const b = [1, 2, 3];\n');
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain('tests/unter/b.test.ts');
    expect(r.out).not.toContain('Dateien in Ordnung');
  }, 60_000);

  it('[R-H-05] erkennt schon ein einzelnes zusätzliches Zeichen', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\n ');
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-05] meldet eine gelöschte gesperrte Datei als «fehlt» mit Pfad und Exit 1', () => {
    const sb = createSandbox();
    const root = setup(sb);
    rmSync(join(root, 'tests', 'a.test.ts'));
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('fehlt');
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-05] meldet jede Abweichung, nicht nur die erste', () => {
    const sb = createSandbox();
    const root = setup(sb);
    rmSync(join(root, 'tests', 'a.test.ts'));
    writeText(root, 'tests/unter/b.test.ts', 'anders\n');
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
    expect(r.out).toContain('tests/unter/b.test.ts');
    expect(r.out).toContain('fehlt');
    expect(r.out).toContain('geändert');
  }, 60_000);

  it('[R-H-05] normalisiert Zeilenenden: CRLF im Arbeitsbaum gegen LF-Hash ist in Ordnung', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const lf = 'zeile 1\nzeile 2\n';
    writeText(root, 'tests/crlf.test.ts', lf.replace(/\n/g, '\r\n'));
    writeLock(root, { 'tests/crlf.test.ts': sha256Lf(lf) });
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Lock-Prüfung: 1 Datei(en)? in Ordnung/);
  }, 60_000);

  it('[R-H-05] erkennt Inhaltsänderungen auch in Dateien mit CRLF', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'tests/crlf.test.ts', 'zeile 1\r\nzeile 2\r\n');
    writeLock(root, { 'tests/crlf.test.ts': sha256Lf('zeile 1\nzeile 3\n') });
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
  }, 60_000);

  it('[R-H-05] prüft ohne --root den Worktree des aktuellen Verzeichnisses, auch aus einem Unterordner', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const r = runScript(sb, root, 'lock-check.mjs', [], { cwd: join(root, 'tests', 'unter') });
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 2 Dateien in Ordnung');
  }, 60_000);

  it('[R-H-05] prüft mit --root das genannte Verzeichnis unabhängig vom aktuellen Verzeichnis', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const andere = initRepo(sb, 'andere');
    writeText(root, 'tests/a.test.ts', 'geändert\n');
    const r = runScript(sb, root, 'lock-check.mjs', ['--root', root], { cwd: andere });
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it(
    '[R-H-05][R-H-03] prüft in einem Paket-Worktree dessen eigenes test-lock.json',
    () => {
      const sb = createSandbox();
      const main = setup(sb);
      const wt = addWorktree(sb, main, join(sb.base, 'wt', 'paket'), 'wap/paket');
      lockFiles(wt, { 'tests/nur-im-wt.test.ts': 'export const w = 1;\n' });
      const ok = runScript(sb, main, 'lock-check.mjs', [], { cwd: wt });
      expect(ok.status).toBe(0);
      expect(ok.out).toMatch(/Lock-Prüfung: 1 Datei(en)? in Ordnung/);
      writeText(wt, 'tests/nur-im-wt.test.ts', 'export const w = 2;\n');
      const bad = runScript(sb, main, 'lock-check.mjs', [], { cwd: wt });
      expect(bad.status).toBe(1);
      expect(bad.out).toContain('tests/nur-im-wt.test.ts');
      // Der Haupt-Checkout bleibt davon unberührt.
      const mainOk = runScript(sb, main, 'lock-check.mjs', [], { cwd: main });
      expect(mainOk.status).toBe(0);
    },
    SLOW,
  );

  it.each(['wap-planer', 'wap/paket'])(
    '[R-H-05][R-H-08] scheitert auf dem WAP-Zweig %s, wenn test-lock.json fehlt',
    (branch) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt', { branch });
      const r = runScript(sb, root, 'lock-check.mjs', []);
      expect(r.status).toBe(1);
      expect(r.out).not.toContain('in Ordnung');
    },
    60_000,
  );

  it.each(['main', 'feature/x'])(
    '[R-H-05][R-H-08] besteht auf dem Nicht-WAP-Zweig %s ohne test-lock.json (übrige Suite unberührt)',
    (branch) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt', { branch });
      const r = runScript(sb, root, 'lock-check.mjs', []);
      expect(r.status).toBe(0);
    },
    60_000,
  );

  it('[R-H-05] hasht Binärdateien über Rohbytes: geändertes Byte 0xFE -> 0xFF wird erkannt', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    // Enthält 0x00, 0xFE (ungültiges UTF-8) und 0x0D 0x0A.
    const bild = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0xfe, 0x0d, 0x0a, 0x1a, 0x0a, 0xfe, 0x01,
    ]);
    lockFiles(root, { 'tests/golden/bild.png': bild });
    const ok = runScript(sb, root, 'lock-check.mjs', []);
    expect(ok.status).toBe(0);
    const geaendert = Buffer.from(bild);
    geaendert[5] = 0xff;
    writeText(root, 'tests/golden/bild.png', geaendert);
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain('tests/golden/bild.png');
  }, 60_000);

  it('[R-H-05] ein einzelnes 0x0D ohne folgendes 0x0A wird nicht wegnormalisiert', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/golden/cr.bin': Buffer.from([0x41, 0x42]) });
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    // Ein einzelnes CR ist eine echte Änderung (nur CR LF wird zu LF).
    writeText(root, 'tests/golden/cr.bin', Buffer.from([0x41, 0x0d, 0x42]));
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
  }, 60_000);

  it('[R-H-05] scheitert bei ungültigem JSON in test-lock.json', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, LOCK_PATH, '{ "version": 1, "files": ');
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).not.toContain('in Ordnung');
  }, 60_000);

  it('[R-H-04][R-H-05] erkennt Änderungen an gesperrten Harness-Skripten und an der Hook-Konfiguration', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, {
      'scripts/wap/guard-edit-kopie.mjs': '// gesperrt\n',
      '.claude/settings.json': '{ "hooks": {} }\n',
    });
    writeText(root, 'scripts/wap/guard-edit-kopie.mjs', '// umgangen\n');
    writeText(root, '.claude/settings.json', '{}\n');
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('scripts/wap/guard-edit-kopie.mjs');
    expect(r.out).toContain('.claude/settings.json');
  }, 60_000);

  it('[R-H-05] meldet bei leerer Sperrliste «Lock-Prüfung: 0 Dateien in Ordnung»', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeLock(root, {});
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 0 Dateien in Ordnung');
  }, 60_000);
});

describe('lock-check --gegen <ref> (P14, CR-H0S-02)', () => {
  /**
   * Sperrstand committet; liefert Repo und Commit als Referenz. Optional zusätzliche, mitcommittete
   * Protokollzeilen (hinter ALTE_PROTOKOLLZEILE) und ein anderer Zweig.
   */
  function committed(
    sb: Sandbox,
    zeilen: string[] = [],
    branch = 'wap-planer',
  ): { root: string; ref: string } {
    const root = setup(sb, branch);
    if (zeilen.length > 0) appendProtokoll(root, ...zeilen);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it('[R-H-05][R-H-04] erkennt eine gesperrte Datei samt per Befehl nachgeführter test-lock.json ohne Protokoll', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 0; // abgeschwächt\n');
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf('export const a = 0; // abgeschwächt\n');
    writeLock(root, lock.files);
    // Ohne --gegen besteht die Prüfung (Hashes stimmen mit der Sperrdatei überein) …
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    // … mit --gegen nicht.
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-05] erkennt eine per Befehl entfernte Sperre ohne Protokoll', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    const lock = readLock(root);
    delete lock.files['tests/unter/b.test.ts'];
    writeLock(root, lock.files);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/unter/b.test.ts');
  }, 60_000);

  it('[R-H-05][R-H-06] besteht mit --gegen, wenn die Änderung über lock-update protokolliert ist', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Test-Einwand angenommen',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05] --gegen ohne Änderung an test-lock.json besteht', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 2 Dateien in Ordnung');
  }, 60_000);

  it('[R-H-05] --gegen mit Protokollzeile für einen anderen Pfad scheitert', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 3;\n');
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf('export const a = 3;\n');
    writeLock(root, lock.files);
    const findings = readText(root, FINDINGS_PATH);
    writeText(
      root,
      FINDINGS_PATH,
      `${findings}| 01.10.2026 | abc1234 | tests/unter/b.test.ts | Nachführung: falscher Pfad | – |\n`,
    );
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  /** Führt die Hashes der genannten Dateien per Befehl nach (neuer Inhalt). */
  function nachfuehren(root: string, ...pfade: string[]): void {
    const lock = readLock(root);
    for (const p of pfade) {
      const inhalt = `export const x = '${p}-neu';\n`;
      writeText(root, p, inhalt);
      lock.files[p] = sha256Lf(inhalt);
    }
    writeLock(root, lock.files);
  }

  it('[R-H-05] --gegen: Protokollzeile nennt mehr Pfade als abweichen → scheitert (P14 «genau»)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    // Kontrolle (P14): ohne Änderung besteht --gegen; damit ist --gegen nachweislich verstanden.
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    nachfuehren(root, 'tests/a.test.ts');
    appendProtokoll(root, protokollZeile(['tests/a.test.ts', 'tests/unter/b.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05] --gegen: richtige Zeile, aber in der Befund-Tabelle statt im Protokoll → scheitert', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehren(root, 'tests/a.test.ts');
    insertInBefundTabelle(root, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-05] --gegen: zwei neue Zeilen nennen zusammen genau die zwei abweichenden Pfade → besteht', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehren(root, 'tests/a.test.ts', 'tests/unter/b.test.ts');
    appendProtokoll(
      root,
      protokollZeile(['tests/a.test.ts']),
      protokollZeile(['tests/unter/b.test.ts']),
    );
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: alte Protokollzeile umgeschrieben statt angehängt → Exit 1 «Protokollzeile geändert oder entfernt» (P27)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    nachfuehren(root, 'tests/a.test.ts');
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: alte Protokollzeile gelöscht (ohne Lock-Änderung) → Exit 1 mit Zeilennummer (P27, P34a)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, null);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  const ZWEITE_ALTE = protokollZeile(['tests/a.test.ts'], 'Aufnahme');

  it('[R-H-05][R-H-06] --gegen: zwei alte Protokollzeilen vertauscht → Exit 1 (Reihenfolge, TR-H0-35)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb, [ZWEITE_ALTE]);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    vertauscheZeilen(root, ALTE_PROTOKOLLZEILE, ZWEITE_ALTE);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR);
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: neue Zeile zwischen zwei alte gestellt → Exit 1 (TR-H0-35)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb, [ZWEITE_ALTE]);
    nachfuehren(root, 'tests/a.test.ts');
    fuegeVorZeileEin(root, ZWEITE_ALTE, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectProtokollMeldung(r.out, ALTE_PROTOKOLLZEILE_NR + 1);
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: zwei alte Zeilen unverändert, eine neue angehängt → besteht (TR-H0-35, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb, [ZWEITE_ALTE]);
    nachfuehren(root, 'tests/a.test.ts');
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: alte «Aufnahme»-Zeile nennt den Pfad schon, keine neue Zeile → Exit 1 (TR-H0-36)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb, [ZWEITE_ALTE]);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    nachfuehren(root, 'tests/a.test.ts');
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  it('[R-H-05][R-H-06] --gegen: alte Zeile unverändert, neue angehängt → besteht (P27, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehren(root, 'tests/a.test.ts');
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    expect(readText(root, FINDINGS_PATH)).toContain(ALTE_PROTOKOLLZEILE);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-08] --gegen auf WAP-Zweig ohne test-lock.json → Exit 1, auch mit protokollierter Entsperrung aller Pfade (P31)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    rmSync(join(root, ...LOCK_PATH.split('/')));
    appendProtokoll(
      root,
      protokollZeile(['tests/a.test.ts', 'tests/unter/b.test.ts'], 'Entsperrung'),
    );
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).not.toContain('in Ordnung');
    // Hinweis auf die fehlende Sperrdatei (P31).
    expect(r.out).toContain('test-lock.json');
  }, 60_000);

  it('[R-H-05][R-H-08] --gegen auf WAP-Zweig ohne test-lock.json und ohne Protokoll → Exit 1, Abgleich meldet die Pfade (P31, TR-H0-37)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    rmSync(join(root, ...LOCK_PATH.split('/')));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('test-lock.json');
    expect(r.out).toContain('tests/a.test.ts');
    expect(r.out).toContain('tests/unter/b.test.ts');
  }, 60_000);

  it('[R-H-05][R-H-08] --gegen auf Nicht-WAP-Zweig ohne test-lock.json → Exit 0 (P34b)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb, [], 'main');
    rmSync(join(root, ...LOCK_PATH.split('/')));
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);
});

describe('lock-check --gegen: Abgrenzung des Protokolls (P37, P38; CR-H0S-24, -25)', () => {
  function committed(sb: Sandbox): { root: string; ref: string } {
    const root = setup(sb);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  function nachfuehrenA(root: string): void {
    const inhalt = "export const x = 'a-neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
  }

  it('[R-H-05][R-H-06] lose Protokollzeile nach einem Absatz im Protokollabschnitt → Exit 1 mit Zeilennummer (P37, Angriff A8)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehrenA(root);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\nEin Absatz zum Protokoll.\n${lose}\n`);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectAusserhalbMeldung(r.out, zeilenNr(root, lose));
  }, 60_000);

  it('[R-H-05][R-H-06] lose Protokollzeile nur durch eine Leerzeile abgetrennt → Exit 1 mit Zeilennummer (P37, TR-H0-53)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehrenA(root);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\n${lose}\n`);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectAusserhalbMeldung(r.out, zeilenNr(root, lose));
  }, 60_000);

  it('[R-H-05][R-H-06] zweite Tabelle im Protokollabschnitt → Exit 1 mit Zeilennummer (P37)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    appendFindingsText(root, '\nAbsatz.\n\n| Kopf | Wert |\n| --- | --- |\n| x | y |\n');
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expectAusserhalbMeldung(r.out, zeilenNr(root, '| Kopf | Wert |'));
  }, 60_000);

  it('[R-H-05][R-H-06] Absatz ohne |-Zeilen nach der Protokoll-Tabelle → besteht (P37, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    appendFindingsText(root, '\nHinweis: Das Protokoll ist nur anhängbar.\n');
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] zweite Titelzeile vorn mit Kopie und Anhang, Original gefälscht → Exit 1 (P38, Angriff A9)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehrenA(root);
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
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] zweite Titelzeile ohne sonstige Änderung → Exit 1 (P38)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    appendFindingsText(root, `\n${PROTOKOLL_TITEL}\n\nLeer.\n`);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] Protokoll in HTML-Kommentar verborgen und neue Tabelle angehängt → Exit 1 (P38, Angriff A10)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    nachfuehrenA(root);
    fuegeVorZeileEin(root, PROTOKOLL_KOPF, '<!--');
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, `${ALTE_PROTOKOLLZEILE}\n-->`);
    appendFindingsText(
      root,
      `\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${ALTE_PROTOKOLLZEILE}\n${protokollZeile(['tests/a.test.ts'])}\n`,
    );
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] einzelner HTML-Kommentar im Protokollabschnitt → Exit 1 (P38)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    appendFindingsText(root, '\n<!-- Notiz -->\n');
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] HTML-Kommentar ausserhalb des Protokollabschnitts → besteht (P38, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    fuegeVorZeileEin(root, PROTOKOLL_TITEL, '<!-- Hinweis zum Befundregister -->\n');
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] späterer Abschnitt «## Anhang» mit Tabelle und HTML-Kommentar → besteht (P38a, TR-H0-46)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    appendFindingsText(root, ANHANG_ABSCHNITT);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] späterer Abschnitt «# Anhang» (Ebene #) mit Tabelle und HTML-Kommentar → besteht (P38a, TR-H0-55)', () => {
    const sb = createSandbox();
    const { root, ref } = committed(sb);
    appendFindingsText(root, ANHANG_H1_ABSCHNITT);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it.each([
    ['|-Zeilen', UNTERABSCHNITT_MIT_TABELLE],
    ['HTML-Kommentar', UNTERABSCHNITT_MIT_KOMMENTAR],
  ])(
    '[R-H-05][R-H-06] ###-Unterüberschrift beendet den Protokollabschnitt nicht: %s darunter → Exit 1 (P38a, Gegenprobe)',
    (_label, text) => {
      const sb = createSandbox();
      const { root, ref } = committed(sb);
      appendFindingsText(root, text);
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(1);
    },
    60_000,
  );

  it.each(VERSCHLEIERUNG)(
    '[R-H-05][R-H-06] %s → Exit 1 (P43)',
    (_label, umformen) => {
      const sb = createSandbox();
      const { root, ref } = committed(sb);
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
      umformenFindings(root, umformen);
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(1);
    },
    60_000,
  );
});

describe('lock-check --gegen: Verstoss im Vergleichsstand (P42, CR-H0S-29)', () => {
  /** Referenz-Commit, dessen Protokollabschnitt gegen P37/P38 verstösst (angehängter Text). */
  function refUngueltig(sb: Sandbox, verstoss = ZWEITE_TABELLE): { root: string; ref: string } {
    const root = setup(sb);
    appendFindingsText(root, verstoss);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit Verstoss im Protokollabschnitt');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  function reparieren(root: string, verstoss = ZWEITE_TABELLE): void {
    const text = readText(root, FINDINGS_PATH);
    expect(text.endsWith(verstoss)).toBe(true);
    writeText(root, FINDINGS_PATH, text.slice(0, text.length - verstoss.length));
  }

  it.each(VERGLEICHSSTAND_VERSTOESSE)(
    '[R-H-05][R-H-06] Vergleichsstand ungültig (%s), Arbeitsbaum repariert, Sperrdatei unverändert → Exit 0 mit Hinweis (P42, Angriff B15)',
    (_label, verstoss, p37Hinweis) => {
      const sb = createSandbox();
      const { root, ref } = refUngueltig(sb, verstoss);
      reparieren(root, verstoss);
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(0);
      if (p37Hinweis) expect(r.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
    },
    60_000,
  );

  it.each(VERGLEICHSSTAND_VERSTOESSE)(
    '[R-H-05][R-H-06] Vergleichsstand ungültig (%s), Abschnitt unverändert, Sperrdatei unverändert → Exit 0 mit Hinweis (P42a, Angriff B11, TR-H0-62 b)',
    (_label, verstoss, p37Hinweis) => {
      const sb = createSandbox();
      const { root, ref } = refUngueltig(sb, verstoss);
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(0);
      if (p37Hinweis) expect(r.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
    },
    60_000,
  );

  it('[R-H-05][R-H-06] Abschnitt unverändert, nur Zeilenenden auf CRLF umgestellt → Exit 0 (P42a, TR-H0-62 d)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb);
    writeText(root, FINDINGS_PATH, readText(root, FINDINGS_PATH).replace(/\n/g, '\r\n'));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
  }, 60_000);

  it.each([
    ['weitere |-Zeile an der zweiten Tabelle (P37)', '| z | w |\n'],
    ['HTML-Kommentar im Abschnitt (P38)', '\n<!-- Notiz -->\n'],
  ])(
    '[R-H-05][R-H-06] Vergleichsstand ungültig und zusätzlicher neuer Verstoss (%s), Sperrdatei unverändert → Exit 1 (P42a, TR-H0-58)',
    (_label, neu) => {
      const sb = createSandbox();
      const { root, ref } = refUngueltig(sb);
      appendFindingsText(root, neu);
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(1);
    },
    60_000,
  );

  it('[R-H-05][R-H-06] Vergleichsstand ungültig, Sperrdatei geändert, neuer Stand weiterhin ungültig → Exit 1 (P42b b, TR-H0-58)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb);
    const inhalt = "export const x = 'a-neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
    ersetzeZeile(
      root,
      ALTE_PROTOKOLLZEILE,
      `${ALTE_PROTOKOLLZEILE}\n${protokollZeile(['tests/a.test.ts'])}`,
    );
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] Vergleichsstand ungültig, Sperrdatei geändert, Zeile korrekt angehängt → Exit 0 mit Hinweis (P42)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb);
    reparieren(root);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Nachgeführt',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Zeile ausserhalb der Protokoll-Tabelle');
  }, 60_000);

  it('[R-H-05][R-H-06] Vergleichsstand ungültig, Sperrdatei geändert, alte Zeile des P37-Blocks umgeschrieben → Exit 1 (P42)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb);
    reparieren(root);
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
  }, 60_000);

  it('[R-H-05][R-H-06] Vergleichsstand ungültig, Abschnitt nur um einen Textabsatz ergänzt (kein neuer Verstoss), Sperrdatei unverändert → Exit 1 (P42c)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb);
    appendFindingsText(root, ZUSATZ_ABSATZ);
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] doppelter Titel im Vergleichsstand, Sperrdatei geändert, Zeile an den Block nach dem ersten Titel angehängt → Exit 0 (P42b a)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb, ZWEITER_TITEL_MIT_BLOCK);
    reparieren(root, ZWEITER_TITEL_MIT_BLOCK);
    writeText(root, 'tests/a.test.ts', 'export const a = 3;\n');
    const u = runScript(sb, root, 'lock-update.mjs', [
      '--grund',
      'Nachgeführt',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(u.status).toBe(0);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] doppelter Titel im Vergleichsstand, Sperrdatei geändert, alte Zeile des ersten Blocks umgeschrieben → Exit 1 (P42b a)', () => {
    const sb = createSandbox();
    const { root, ref } = refUngueltig(sb, ZWEITER_TITEL_MIT_BLOCK);
    reparieren(root, ZWEITER_TITEL_MIT_BLOCK);
    const inhalt = 'export const a = 0; // abgeschwächt\n';
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
  }, 60_000);

  it('[R-H-05][R-H-06] mehrzeiliger Kommentar vor dem Titel, vor dem Titel geschlossen → Exit 0 (P43 a, Gegenprobe, TR-H0-65)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    const ref = git(sb, root, 'rev-parse', 'HEAD');
    umformenFindings(root, kommentarVorTitelGeschlossen);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);
});

describe('lock-check --gegen: P42d, P43d, P43e (CR-H0S-34, -37)', () => {
  function committedMit(sb: Sandbox, zusatz = ''): { root: string; ref: string } {
    const root = setup(sb);
    if (zusatz !== '') appendFindingsText(root, zusatz);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it('[R-H-05][R-H-06] Referenz mit Verstoss «ausserhalb», neu offener Kommentar vor dem Titel bis in den nächsten ##-Abschnitt → Exit 1 (P42d, Angriff C1)', () => {
    const sb = createSandbox();
    const { root, ref } = committedMit(sb, VERSTOSS_MIT_DANACH);
    umformenFindings(root, kommentarBisDanach);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] Referenz mit Verstoss «ausserhalb» und Folgeabschnitt, Abschnitt unverändert → Exit 0 (P42d, Gegenprobe B11)', () => {
    const sb = createSandbox();
    const { root, ref } = committedMit(sb, VERSTOSS_MIT_DANACH);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] Referenz mit Verstoss «ausserhalb», neu ein gleichlautender ###-Titel im Abschnitt «## Danach» (andere Fehlerart) → Exit 1 (P42d, TR-H0-76)', () => {
    const sb = createSandbox();
    const { root, ref } = committedMit(sb, VERSTOSS_MIT_DANACH);
    appendFindingsText(root, `\n${TITEL_H3}\n`);
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
  }, 60_000);

  it.each(TITEL_EBENEN)(
    '[R-H-05][R-H-06] %s → Exit 1 (P43d)',
    (_label, umformen) => {
      const sb = createSandbox();
      const { root, ref } = committedMit(sb);
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
      umformenFindings(root, umformen);
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-05][R-H-06] genau ein ##-Titel, Abschnitt korrekt → Exit 0 (P43d, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = committedMit(sb);
    appendFindingsText(root, '\nHinweis unter dem Protokoll.\n');
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);

  it('[R-H-05][R-H-06] FINDINGS.md mit 10000 Titelzeilen (ca. 3 MB) wird in unter 5 s mit Exit 1 abgewiesen (P43e)', () => {
    const sb = createSandbox();
    const { root, ref } = committedMit(sb);
    const text = vieleTitel(10_000);
    expect(text.length).toBeGreaterThan(3_000_000);
    writeText(root, FINDINGS_PATH, text);
    const start = performance.now();
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    const dauer = performance.now() - start;
    expect(r.status).toBe(1);
    // Schwelle laut Vertrag: 5 s für den ganzen Aufruf (inkl. Prozessstart und git).
    expect(dauer).toBeLessThan(5_000);
  }, 60_000);
});

describe('lock-check --gegen: P43f, P43g, P42b (a) präzisiert (CR-H0S-40)', () => {
  function stand(sb: Sandbox, vorher?: (t: string) => string): { root: string; ref: string } {
    const root = setup(sb);
    if (vorher) umformenFindings(root, vorher);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-05][R-H-06] einzige Titelzeile mit %s eingerückt ist keine Überschrift → Exit 1 (P43f)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const { root, ref } = stand(sb);
      umformenFindings(root, titelEingerueckt(einrueckung));
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-05][R-H-06] Titelzeile mit 3 Leerzeichen eingerückt bleibt Überschrift → Exit 0 (P43f, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = stand(sb);
    umformenFindings(root, titelEingerueckt('   '));
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);

  it.each([
    ['eine ATX-Zeile mit 200000 Leerzeichen', 1, 200_000],
    ['1000 ATX-Zeilen mit je 5000 Leerzeichen', 1000, 5000],
  ])(
    '[R-H-05][R-H-06] gültiges Protokoll, danach %s: Beurteilung in unter 5 s, Exit 0 (P43g)',
    (_label, anzahl, laenge) => {
      const sb = createSandbox();
      const { root, ref } = stand(sb);
      appendFindingsText(root, langeLeerraumZeilen(anzahl, laenge));
      const start = performance.now();
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      const dauer = performance.now() - start;
      expect(r.status).toBe(0);
      // Schwelle laut Vertrag: 5 s für den ganzen Aufruf (inkl. Prozessstart und git).
      expect(dauer).toBeLessThan(5_000);
    },
    60_000,
  );

  /** K6: Vergleichsstand mit ###-Block (Zeile a) vor dem massgebenden ##-Block (Zeile b = alte Zeile). */
  function k6(sb: Sandbox): { root: string; ref: string } {
    const { root, ref } = stand(sb, (t) =>
      t.replace(PROTOKOLL_TITEL, `${H3_BLOCK_VOR_TITEL}${PROTOKOLL_TITEL}`),
    );
    // Neuer Stand: ###-Block entfernt (gültig), Sperrdatei geändert.
    umformenFindings(root, (t) => t.replace(H3_BLOCK_VOR_TITEL, ''));
    const inhalt = "export const x = 'a-neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
    return { root, ref };
  }

  it('[R-H-05][R-H-06] K6: Zeile b des massgebenden ##-Blocks umgeschrieben, Sperrdatei geändert → Exit 1 «Protokollzeile geändert oder entfernt» (P42b a präzisiert)', () => {
    const sb = createSandbox();
    const { root, ref } = k6(sb);
    ersetzeZeile(root, ALTE_PROTOKOLLZEILE, protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'));
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
  }, 60_000);

  it('[R-H-05][R-H-06] K6: Zeile b unverändert, neue Zeile an den ##-Block angehängt, Sperrdatei geändert → Exit 0 (P42b a präzisiert, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = k6(sb);
    appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);
});

describe('lock-check --gegen: P43f für alle Ebenen und das Abschnittsende, P43g mit Titeltext (TR-H0-85, -86)', () => {
  function stand(sb: Sandbox): { root: string; ref: string } {
    const root = setup(sb);
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    return { root, ref: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-05][R-H-06] gültiger ##-Titel plus gleichlautende ###-Zeile mit %s eingerückt (keine Überschrift) → Exit 0 (P43f, TR-H0-85 a)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const { root, ref } = stand(sb);
      appendFindingsText(root, eingerueckterH3Titel(einrueckung));
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    },
    60_000,
  );

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-05][R-H-06] «## Weiteres» mit %s eingerückt beendet den Protokollabschnitt nicht: |-Zeile danach → Exit 1 (P43f, P37, TR-H0-85 b)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const { root, ref } = stand(sb);
      appendFindingsText(root, weiteresMitTabelle(einrueckung));
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-05][R-H-06] «## Weiteres» ohne Einrückung beendet den Protokollabschnitt: |-Zeile danach → Exit 0 (P43f, P38a, Gegenprobe)', () => {
    const sb = createSandbox();
    const { root, ref } = stand(sb);
    appendFindingsText(root, weiteresMitTabelle(''));
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
  }, 60_000);

  it.each(UEBERSCHRIFT_EINGERUECKT_GUELTIG)(
    '[R-H-05][R-H-06] %s eingerückt ist Überschrift und beendet den Protokollabschnitt: |-Zeile danach → Exit 0 (P43f, P38a, TR-H0-91 a)',
    (_label, einrueckung, rauten) => {
      const sb = createSandbox();
      const { root, ref } = stand(sb);
      appendFindingsText(root, weiteresMitTabelle(einrueckung, rauten));
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-05][R-H-06] gültiger ##-Titel plus gleichlautende ###-Titelzeile mit 3 Leerzeichen eingerückt (zählt mit) → Exit 1 (P43f, P43d, TR-H0-91 b)', () => {
    const sb = createSandbox();
    const { root, ref } = stand(sb);
    appendFindingsText(root, eingerueckterH3Titel('   '));
    expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(1);
  }, 60_000);

  it('[R-H-05][R-H-06] gültiges Protokoll, danach eine ATX-Zeile mit Titeltext und 200000 Leerzeichen: Beurteilung in unter 5 s, Exit 0 (P43g, TR-H0-86)', () => {
    const sb = createSandbox();
    const { root, ref } = stand(sb);
    appendFindingsText(root, langeTitelZeile(200_000));
    const start = performance.now();
    const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
    const dauer = performance.now() - start;
    expect(r.status).toBe(0);
    expect(dauer).toBeLessThan(5_000);
  }, 60_000);
});

describe('lock-check --gegen: eingerückter Schein-Titel mit Block im Vergleichsstand (P42b a präzisiert, P43f, TR-H0-96)', () => {
  function vergleichsstand(sb: Sandbox, einrueckung: string): { root: string; ref: string } {
    const root = setup(sb);
    umformenFindings(root, (t) =>
      t.replace(PROTOKOLL_TITEL, `${scheinblockVorTitel(einrueckung)}${PROTOKOLL_TITEL}`),
    );
    git(sb, root, 'add', 'tests/a.test.ts', 'tests/unter/b.test.ts', LOCK_PATH, FINDINGS_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand mit Scheinblock');
    const ref = git(sb, root, 'rev-parse', 'HEAD');
    // Neuer Stand: Scheinblock entfernt, Sperrdatei geändert.
    umformenFindings(root, (t) => t.replace(scheinblockVorTitel(einrueckung), ''));
    const inhalt = "export const x = 'a-neu';\n";
    writeText(root, 'tests/a.test.ts', inhalt);
    const lock = readLock(root);
    lock.files['tests/a.test.ts'] = sha256Lf(inhalt);
    writeLock(root, lock.files);
    return { root, ref };
  }

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-05][R-H-06] Schein-Titel mit %s eingerückt: Zeile b des echten Blocks umgeschrieben → Exit 1 «Protokollzeile geändert oder entfernt»',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const { root, ref } = vergleichsstand(sb, einrueckung);
      ersetzeZeile(
        root,
        ALTE_PROTOKOLLZEILE,
        protokollZeile(['tests/alt.test.ts'], 'Umgeschrieben'),
      );
      appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
      const r = runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Protokollzeile geändert oder entfernt');
    },
    60_000,
  );

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-05][R-H-06] Schein-Titel mit %s eingerückt: Zeile b unverändert, neue Zeile angehängt → Exit 0 (Gegenprobe)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const { root, ref } = vergleichsstand(sb, einrueckung);
      appendProtokoll(root, protokollZeile(['tests/a.test.ts']));
      expect(runScript(sb, root, 'lock-check.mjs', ['--gegen', ref]).status).toBe(0);
    },
    60_000,
  );
});

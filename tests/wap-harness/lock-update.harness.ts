// scripts/wap/lock-update.mjs – R-H-06.
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte» Punkte 1 und 4, P1, P4–P7, P15, P21, P23, P37, P37a, P38, P38a, P43, P43d, P43f.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  ANHANG_ABSCHNITT,
  ANHANG_H1_ABSCHNITT,
  appendFindingsText,
  cleanupSandboxes,
  createSandbox,
  EINRUECKUNG_KEIN_TITEL,
  eingerueckterH3Titel,
  expectAusserhalbMeldung,
  FINDINGS_LEER_ZEILEN,
  FINDINGS_PATH,
  FINDINGS_TEMPLATE,
  git,
  initRepo,
  kommentarVorTitelGeschlossen,
  LOCK_PATH,
  listFiles,
  lockFiles,
  PROTOKOLL_TITEL,
  protokollZeile,
  type RunResult,
  readBytes,
  readLock,
  readText,
  runScript,
  type Sandbox,
  sha256Lf,
  TITEL_EBENEN,
  titelEingerueckt,
  today,
  UEBERSCHRIFT_EINGERUECKT_GUELTIG,
  UNTERABSCHNITT_MIT_KOMMENTAR,
  UNTERABSCHNITT_MIT_TABELLE,
  umformenFindings,
  VERSCHLEIERUNG,
  weiteresMitTabelle,
  writeText,
  zeilenNr,
} from './helpers';

afterEach(cleanupSandboxes);

/** Windows-Pfad mit echtem Backslash, ohne Escape-Falle im Quelltext (TR-H0-23). */
const winPfad = (...teile: string[]): string => teile.join(String.fromCharCode(92));

const ROW =
  /^\| (\d{2}\.\d{2}\.\d{4}) \| ([0-9a-f]{7,40}) \| ([^|]+?) \| ([^|:]+?): ([^|]+?) \| ([^|]+?) \|$/;

interface Row {
  date: string;
  commit: string;
  paths: string[];
  action: string;
  grund: string;
  befund: string;
}

function protocolRows(findings: string): string[] {
  const lines = findings.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## Protokoll `test-lock.json`'));
  expect(start).toBeGreaterThanOrEqual(0);
  const rows: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('| ') && !line.startsWith('| Datum') && !line.startsWith('| ---')) {
      rows.push(line);
    }
  }
  return rows;
}

function parseRow(line: string): Row {
  const m = ROW.exec(line);
  expect(m, `Protokollzeile im falschen Format: ${line}`).not.toBeNull();
  const g = m as RegExpExecArray;
  return {
    date: g[1],
    commit: g[2],
    paths: g[3].split(/,\s*/).map((p) => p.trim()),
    action: g[4].trim(),
    grund: g[5].trim(),
    befund: g[6].trim(),
  };
}

function setup(sb: Sandbox): string {
  const root = initRepo(sb, 'haupt');
  lockFiles(root, {
    'tests/a.test.ts': 'export const a = 1;\n',
    'tests/b.test.ts': 'export const b = 1;\n',
  });
  writeText(root, 'tests/neu.test.ts', 'export const n = 1;\n');
  writeText(root, 'tests/auch-neu.test.ts', 'export const m = 1;\n');
  return root;
}

/** Byteweiser Stand von test-lock.json (null = fehlt) und FINDINGS.md. */
function snapshot(root: string): { lock: string | null; findings: string } {
  const lockFile = join(root, ...LOCK_PATH.split('/'));
  return {
    lock: existsSync(lockFile) ? readBytes(root, LOCK_PATH).toString('hex') : null,
    findings: readBytes(root, FINDINGS_PATH).toString('hex'),
  };
}

function update(sb: Sandbox, root: string, args: string[]): RunResult {
  return runScript(sb, root, 'lock-update.mjs', args, { cwd: root });
}

/** Führt lock-update aus und liefert die neue Protokollzeile samt erwartetem Datum. */
function updateWithRow(sb: Sandbox, root: string, args: string[]): { r: RunResult; row: Row } {
  const before = readText(root, FINDINGS_PATH);
  const dayBefore = today();
  const r = update(sb, root, args);
  const dayAfter = today();
  expect(r.status).toBe(0);
  const after = readText(root, FINDINGS_PATH);
  const oldRows = protocolRows(before);
  const newRows = protocolRows(after);
  expect(newRows).toHaveLength(oldRows.length + 1);
  expect(newRows.slice(0, oldRows.length)).toEqual(oldRows);
  const row = parseRow(newRows[newRows.length - 1]);
  expect([dayBefore, dayAfter]).toContain(row.date);
  const head = git(sb, root, 'rev-parse', 'HEAD');
  expect(head.startsWith(row.commit)).toBe(true);
  return { r, row };
}

describe('lock-update: Grund ist Pflicht', () => {
  it.each([
    ['ohne --grund', ['--add', 'tests/neu.test.ts']],
    ['mit leerem --grund', ['--grund', '', '--add', 'tests/neu.test.ts']],
    ['mit --grund nur aus Leerzeichen', ['--grund', '   ', '--add', 'tests/neu.test.ts']],
    ['mit --grund ohne Wert', ['--add', 'tests/neu.test.ts', '--grund']],
  ])(
    '[R-H-06] %s: Exit 1, test-lock.json und FINDINGS.md unverändert',
    (_label, args) => {
      const sb = createSandbox();
      const root = setup(sb);
      const before = snapshot(root);
      const r = update(sb, root, args);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] ohne Aktion (nur --grund): Exit 1 ohne Änderung', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Nur ein Grund']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);
});

describe('lock-update: Aktionen', () => {
  it('[R-H-06] --add sperrt neue Dateien mit SHA-256 (LF-normalisiert), sortiert, Pfad mit /', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const crlf = 'zeile 1\r\nzeile 2\r\n';
    writeText(root, 'docs/crlf.md', crlf);
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Neue Tests eingefroren',
      '--add',
      'tests/neu.test.ts',
      'docs/crlf.md',
    ]);
    const lock = readLock(root);
    expect(lock.version).toBe(1);
    expect(lock.files).toEqual({
      'docs/crlf.md': sha256Lf('zeile 1\nzeile 2\n'),
      'tests/a.test.ts': sha256Lf('export const a = 1;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 1;\n'),
      'tests/neu.test.ts': sha256Lf('export const n = 1;\n'),
    });
    const keys = Object.keys(lock.files);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(row.paths)).toEqual(new Set(['tests/neu.test.ts', 'docs/crlf.md']));
    expect(row.grund).toBe('Neue Tests eingefroren');
    expect(row.action).toBe('Aufnahme');
    expect(row.befund).toBe('–');
  }, 60_000);

  it('[R-H-06] --add normalisiert Backslash-Pfade zu / relativ zur Worktree-Wurzel', () => {
    const sb = createSandbox();
    const root = setup(sb);
    updateWithRow(sb, root, ['--grund', 'Pfad mit Backslash', '--add', 'tests\\neu.test.ts']);
    const keys = Object.keys(readLock(root).files);
    expect(keys).toContain('tests/neu.test.ts');
    expect(keys.some((k) => k.includes('\\'))).toBe(false);
  }, 60_000);

  it('[R-H-06] --add einer nicht existierenden Datei scheitert mit Exit 1 ohne Änderung', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const before = snapshot(root);
    const r = update(sb, root, [
      '--grund',
      'Tippfehler',
      '--add',
      'tests/neu.test.ts',
      'tests/gibt-es-nicht.test.ts',
    ]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/gibt-es-nicht.test.ts');
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('[R-H-06] --remove entsperrt nur die genannte Datei und protokolliert sie', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Test verschoben',
      '--befund',
      'F-007',
      '--remove',
      'tests/a.test.ts',
    ]);
    expect(readLock(root).files).toEqual({
      'tests/b.test.ts': sha256Lf('export const b = 1;\n'),
    });
    expect(row.paths).toEqual(['tests/a.test.ts']);
    expect(row.action).toBe('Entsperrung');
    expect(row.grund).toBe('Test verschoben');
    expect(row.befund).toBe('F-007');
  }, 60_000);

  it('[R-H-06] --refresh übernimmt den aktuellen Hash nur der genannten gesperrten Datei', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    writeText(root, 'tests/b.test.ts', 'export const b = 2;\n');
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Test-Einwand angenommen',
      '--befund',
      'F-012',
      '--refresh',
      'tests/a.test.ts',
    ]);
    expect(readLock(root).files).toEqual({
      'tests/a.test.ts': sha256Lf('export const a = 2;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 1;\n'),
    });
    expect(row.paths).toEqual(['tests/a.test.ts']);
    expect(row.action).toBe('Nachführung');
    expect(row.befund).toBe('F-012');
  }, 60_000);

  it('[R-H-06] --refresh-all übernimmt die aktuellen Hashes aller gesperrten Dateien', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 3;\r\n');
    writeText(root, 'tests/b.test.ts', 'export const b = 3;\n');
    const { row } = updateWithRow(sb, root, ['--grund', 'Alle neu eingefroren', '--refresh-all']);
    expect(readLock(root).files).toEqual({
      'tests/a.test.ts': sha256Lf('export const a = 3;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 3;\n'),
    });
    expect(row.action).toBe('Nachführung alle');
    expect(row.grund).toBe('Alle neu eingefroren');
    expect(new Set(row.paths)).toEqual(new Set(['tests/a.test.ts', 'tests/b.test.ts']));
  }, 60_000);

  it('[R-H-06][R-H-05] nach --refresh besteht die Lock-Prüfung wieder', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/a.test.ts', 'export const a = 4;\n');
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(1);
    updateWithRow(sb, root, ['--grund', 'Nachgeführt', '--refresh', 'tests/a.test.ts']);
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Lock-Prüfung: 2 Dateien in Ordnung');
  }, 60_000);
});

describe('lock-update: Protokoll in FINDINGS.md', () => {
  it('[R-H-06] hängt eine Zeile «| dd.mm.yyyy | <HEAD kurz> | <pfade> | <Aktion>: <Grund> | <Befund> |» an', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'README.md', '# Testrepo\n\nZweiter Stand.\n');
    git(sb, root, 'add', 'README.md');
    git(sb, root, 'commit', '-q', '-m', 'Zweiter Stand');
    const before = readText(root, FINDINGS_PATH);
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Fixture korrigiert',
      '--add',
      'tests/neu.test.ts',
      'tests/auch-neu.test.ts',
    ]);
    expect(row.date).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(row.commit.length).toBeLessThan(40);
    expect(new Set(row.paths)).toEqual(new Set(['tests/neu.test.ts', 'tests/auch-neu.test.ts']));
    // Bisheriger Inhalt bleibt unverändert erhalten.
    expect(readText(root, FINDINGS_PATH).startsWith(before)).toBe(true);
    // P6: LF-Datei bleibt LF (keine CRLF-Zeilen angehängt).
    expect(readText(root, FINDINGS_PATH)).not.toContain('\r');
  }, 60_000);

  it('[R-H-06] hängt die Zeile an die Protokoll-Tabelle an, auch wenn danach ein weiterer Abschnitt folgt', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, FINDINGS_PATH, `${FINDINGS_TEMPLATE}\n## Anhang\n\nText nach der Tabelle.\n`);
    updateWithRow(sb, root, ['--grund', 'Mit Anhang', '--add', 'tests/neu.test.ts']);
    const lines = readText(root, FINDINGS_PATH).split(/\r?\n/);
    const oldRow = lines.findIndex((l) => l.startsWith('| 01.09.2026 | abc1234 |'));
    expect(oldRow).toBeGreaterThanOrEqual(0);
    expect(ROW.test(lines[oldRow + 1])).toBe(true);
    expect(lines[oldRow + 1]).toContain('Mit Anhang');
    expect(lines.indexOf('## Anhang')).toBeGreaterThan(oldRow + 1);
    expect(lines).toContain('Text nach der Tabelle.');
  }, 60_000);
});

describe('lock-update: Fehlerfälle ohne jede Änderung (P5)', () => {
  it.each([
    [
      '--grund mit senkrechtem Strich',
      ['--grund', 'Teil A | Teil B', '--add', 'tests/neu.test.ts'],
    ],
    ['--grund mit Zeilenumbruch', ['--grund', 'Zeile 1\nZeile 2', '--add', 'tests/neu.test.ts']],
    ['--grund mit CR', ['--grund', 'Zeile 1\rZeile 2', '--add', 'tests/neu.test.ts']],
    [
      '--befund mit senkrechtem Strich',
      ['--grund', 'Gültig', '--befund', 'F-1 | F-2', '--add', 'tests/neu.test.ts'],
    ],
    [
      '--befund mit Zeilenumbruch',
      ['--grund', 'Gültig', '--befund', 'F-1\nF-2', '--add', 'tests/neu.test.ts'],
    ],
  ])(
    '[R-H-06] %s: Exit 1 ohne Änderung',
    (_label, args) => {
      const sb = createSandbox();
      const root = setup(sb);
      const before = snapshot(root);
      const r = update(sb, root, args);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it.each([
    ['--remove', 'tests/neu.test.ts'],
    ['--refresh', 'tests/neu.test.ts'],
    ['--remove', 'tests/gibt-es-nicht.test.ts'],
  ])(
    '[R-H-06] %s auf den nicht gesperrten Pfad %s: Exit 1 ohne Änderung, Meldung nennt den Pfad',
    (action, path) => {
      const sb = createSandbox();
      const root = setup(sb);
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Tippfehler', action, 'tests/a.test.ts', path]);
      expect(r.status).toBe(1);
      expect(r.out).toContain(path);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] --add auf ein Verzeichnis: Exit 1 ohne Änderung', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Ganzer Ordner', '--add', 'tests']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('[R-H-06] --add auf eine Datei ausserhalb des Worktrees: Exit 1 ohne Änderung', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const fremd = writeText(sb.base, 'ausserhalb/fremd.test.ts', 'export const x = 1;\n');
    const before = snapshot(root);
    const absolut = update(sb, root, ['--grund', 'Fremd', '--add', fremd]);
    expect(absolut.status).toBe(1);
    const relativ = update(sb, root, ['--grund', 'Fremd', '--add', '../ausserhalb/fremd.test.ts']);
    expect(relativ.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('[R-H-06] fehlender Abschnitt «Protokoll test-lock.json» in FINDINGS.md: Exit 1 ohne Änderung', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(
      root,
      FINDINGS_PATH,
      '# WAP-Planer – Befundregister\n\n| ID | Stufe |\n| --- | --- |\n',
    );
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Ohne Protokoll', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it.each([
    ['--remove', ['--remove', 'tests/a.test.ts']],
    ['--refresh', ['--refresh', 'tests/a.test.ts']],
    ['--refresh-all', ['--refresh-all']],
  ])(
    '[R-H-06] %s ohne vorhandene test-lock.json: Exit 1 ohne Änderung',
    (_label, args) => {
      const sb = createSandbox();
      const root = setup(sb);
      rmSync(join(root, ...LOCK_PATH.split('/')));
      const before = snapshot(root);
      expect(before.lock).toBeNull();
      const r = update(sb, root, ['--grund', 'Ohne Lock', ...args]);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );
});

describe('lock-update: erste Sperrung, Binärdateien, --refresh-all (P1, P6, P7)', () => {
  it('[R-H-06] --add legt eine fehlende test-lock.json an und protokolliert die Aufnahme', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'scripts/wap/platzhalter.mjs', '// Platzhalter im Temp-Repo\n');
    writeText(root, '.claude/settings.json', '{ "hooks": {} }\n');
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Erste Sperrung nach Merge',
      '--add',
      'scripts/wap/platzhalter.mjs',
      '.claude/settings.json',
    ]);
    const lock = readLock(root);
    expect(lock).toEqual({
      version: 1,
      files: {
        '.claude/settings.json': sha256Lf('{ "hooks": {} }\n'),
        'scripts/wap/platzhalter.mjs': sha256Lf('// Platzhalter im Temp-Repo\n'),
      },
    });
    expect(Object.keys(lock.files)).toEqual([
      '.claude/settings.json',
      'scripts/wap/platzhalter.mjs',
    ]);
    expect(row.action).toBe('Aufnahme');
    expect(new Set(row.paths)).toEqual(
      new Set(['scripts/wap/platzhalter.mjs', '.claude/settings.json']),
    );
  }, 60_000);

  it('[R-H-06][R-H-05] --add einer Binärdatei hasht die Rohbytes (nur CR LF -> LF)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const bild = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0xfe, 0x0d, 0x0a, 0x1a, 0x0a, 0xfe, 0x0d,
    ]);
    writeText(root, 'tests/golden/bild.png', bild);
    updateWithRow(sb, root, ['--grund', 'Golden-Bild', '--add', 'tests/golden/bild.png']);
    // Unabhängig gebildeter Soll-Hash: Rohbytes, nur das Paar 0D 0A wird zu 0A.
    const erwartet = createHash('sha256')
      .update(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xfe, 0x0a, 0x1a, 0x0a, 0xfe, 0x0d]))
      .digest('hex');
    expect(readLock(root).files['tests/golden/bild.png']).toBe(erwartet);
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    const geaendert = Buffer.from(bild);
    geaendert[5] = 0xff;
    writeText(root, 'tests/golden/bild.png', geaendert);
    const r = runScript(sb, root, 'lock-check.mjs', []);
    expect(r.status).toBe(1);
    expect(r.out).toContain('geändert');
    expect(r.out).toContain('tests/golden/bild.png');
  }, 60_000);

  it('[R-H-06] --refresh-all protokolliert nur Pfade mit geändertem Hash', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/b.test.ts', 'export const b = 5;\n');
    const { row } = updateWithRow(sb, root, ['--grund', 'Nur b geändert', '--refresh-all']);
    expect(row.paths).toEqual(['tests/b.test.ts']);
    expect(row.action).toBe('Nachführung alle');
    expect(readLock(root).files).toEqual({
      'tests/a.test.ts': sha256Lf('export const a = 1;\n'),
      'tests/b.test.ts': sha256Lf('export const b = 5;\n'),
    });
  }, 60_000);

  it('[R-H-06] --refresh-all ohne geänderte Datei: Exit 1 ohne Eintrag', () => {
    const sb = createSandbox();
    const root = setup(sb);
    // Nur Zeilenenden geändert: gilt nach Normalisierung nicht als Änderung.
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\r\n');
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Nichts zu tun', '--refresh-all']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);
});

describe('lock-update: echte FINDINGS.md-Form (P6)', () => {
  it('[R-H-06] leere Protokoll-Tabelle mit CRLF: Zeile direkt nach deren Trennzeile, CRLF bleibt, Rest byteweise gleich', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const beforeText = FINDINGS_LEER_ZEILEN.join('\r\n');
    writeText(root, FINDINGS_PATH, beforeText);
    const { row } = updateWithRow(sb, root, [
      '--grund',
      'Erste Zeile',
      '--befund',
      'F-001',
      '--add',
      'tests/neu.test.ts',
    ]);
    expect(row.befund).toBe('F-001');
    const afterText = readText(root, FINDINGS_PATH);
    // Keine gemischten Zeilenenden: jedes CR und LF gehört zu einem CRLF.
    expect(afterText.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const beforeLines = beforeText.split('\r\n');
    const afterLines = afterText.split('\r\n');
    const protokoll = beforeLines.indexOf('## Protokoll `test-lock.json`');
    const trennzeile = beforeLines.indexOf('| --- | --- | --- | --- | --- |', protokoll);
    expect(trennzeile).toBeGreaterThan(protokoll);
    expect(afterLines).toHaveLength(beforeLines.length + 1);
    expect(afterLines.slice(0, trennzeile + 1)).toEqual(beforeLines.slice(0, trennzeile + 1));
    expect(ROW.test(afterLines[trennzeile + 1])).toBe(true);
    expect(afterLines.slice(trennzeile + 2)).toEqual(beforeLines.slice(trennzeile + 1));
    // Die leere Befund-Tabelle darüber bleibt leer.
    const befundTrenn = beforeLines.indexOf('| --- | --- | --- | --- | --- | --- | --- | --- |');
    expect(afterLines[befundTrenn + 1]).toBe('');
  }, 60_000);
});

describe('lock-update: transaktional (P15, CR-H0S-03)', () => {
  function tmpReste(root: string): string[] {
    return listFiles(root).filter((f) => f.endsWith('.wap-tmp'));
  }

  it.each([
    ['FINDINGS.md', FINDINGS_PATH],
    ['test-lock.json', LOCK_PATH],
  ])(
    '[R-H-06] %s schreibgeschützt: Exit 1, beide Dateien byteweise unverändert, keine *.wap-tmp, Meldung «keine Änderung vorgenommen»',
    (_label, geschuetzt) => {
      const sb = createSandbox();
      const root = setup(sb);
      const datei = join(root, ...geschuetzt.split('/'));
      const before = snapshot(root);
      chmodSync(datei, 0o444);
      try {
        const r = update(sb, root, ['--grund', 'Schreibschutz', '--add', 'tests/neu.test.ts']);
        expect(r.status).toBe(1);
        expect(r.out).toContain('keine Änderung vorgenommen');
        expect(snapshot(root)).toEqual(before);
        expect(tmpReste(root)).toEqual([]);
      } finally {
        chmodSync(datei, 0o644);
      }
    },
    60_000,
  );

  it('[R-H-06] ohne Schreibschutz hinterlässt lock-update keine *.wap-tmp', () => {
    const sb = createSandbox();
    const root = setup(sb);
    updateWithRow(sb, root, ['--grund', 'Normalfall', '--add', 'tests/neu.test.ts']);
    expect(tmpReste(root)).toEqual([]);
  }, 60_000);
});

describe('lock-update: Schreibweise und Selbstsperre (P21, P23)', () => {
  it('[R-H-06] --add speichert die tatsächliche Schreibweise der Datei, nicht die des Arguments', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'tests/Gemischt.Test.ts', 'export const g = 1;\n');
    updateWithRow(sb, root, ['--grund', 'Schreibweise', '--add', 'TESTS/gemischt.test.TS']);
    const keys = Object.keys(readLock(root).files);
    expect(keys).toContain('tests/Gemischt.Test.ts');
    expect(keys).not.toContain('TESTS/gemischt.test.TS');
  }, 60_000);

  it('[R-H-06] --add übernimmt die Schreibweise von git ls-files für eine versionierte Datei', () => {
    const sb = createSandbox();
    const root = setup(sb);
    writeText(root, 'docs/Versioniert.md', 'Inhalt\n');
    git(sb, root, 'add', 'docs/Versioniert.md');
    git(sb, root, 'commit', '-q', '-m', 'Versioniert');
    const arg = winPfad('DOCS', 'versioniert.MD');
    expect(arg.charCodeAt(4)).toBe(92);
    updateWithRow(sb, root, ['--grund', 'Versioniert', '--add', arg]);
    expect(Object.keys(readLock(root).files)).toContain('docs/Versioniert.md');
  }, 60_000);

  it.each([
    ['exakt', 'docs/wap-planer/test-lock.json'],
    ['andere Schreibweise mit Backslash', winPfad('DOCS', 'Wap-Planer', 'Test-Lock.JSON')],
    ['andere Schreibweise mit Schrägstrich', 'Docs/WAP-planer/TEST-LOCK.json'],
  ])(
    '[R-H-06][R-H-04] --add der Sperrdatei selbst (%s) wird mit Exit 1 ohne Änderung abgewiesen',
    (_label, pfad) => {
      const sb = createSandbox();
      const root = setup(sb);
      // Vorbedingung: der Pfad existiert, P5 («nicht existierende Datei») ist als Ursache ausgeschlossen.
      expect(existsSync(join(root, pfad))).toBe(true);
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Selbstsperre', '--add', pfad]);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
      expect(r.out).toMatch(/test-lock\.json/i);
    },
    60_000,
  );
});

describe('lock-update: Abgrenzung des Protokolls (P37, P38; CR-H0S-24, -25)', () => {
  it('[R-H-06] zweite Tabelle im Protokollabschnitt: Exit 1 mit Zeilennummer, beide Dateien bytegleich (P37a, Angriff R1)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\nAbsatz.\n\n| Kopf | Wert |\n| --- | --- |\n| x | y |\n');
    writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Nachgeführt', '--refresh', 'tests/a.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
    expectAusserhalbMeldung(r.out, zeilenNr(root, '| Kopf | Wert |'));
  }, 60_000);

  it('[R-H-06] lose |-Zeile nach einem Absatz im Protokollabschnitt: Exit 1 mit Zeilennummer, beide Dateien bytegleich (P37a, Angriff A8)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\nEin Absatz zum Protokoll.\n${lose}\n`);
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Neu', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
    expectAusserhalbMeldung(r.out, zeilenNr(root, lose));
  }, 60_000);

  it('[R-H-06] lose |-Zeile nur durch eine Leerzeile abgetrennt: Exit 1 mit Zeilennummer, beide Dateien bytegleich (P37a, TR-H0-53)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const lose = protokollZeile(['tests/a.test.ts']);
    appendFindingsText(root, `\n${lose}\n`);
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Neu', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
    expectAusserhalbMeldung(r.out, zeilenNr(root, lose));
  }, 60_000);

  it('[R-H-06] Absatz ohne |-Zeilen nach der Protokoll-Tabelle: lock-update fügt direkt nach dem Block ein (P37a, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\nHinweis: Das Protokoll ist nur anhängbar.\n');
    const vorher = readText(root, FINDINGS_PATH).split('\n');
    const r = update(sb, root, ['--grund', 'Mit Absatz', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(0);
    const nachher = readText(root, FINDINGS_PATH).split('\n');
    const alt = nachher.indexOf(ALTE_PROTOKOLLZEILE);
    expect(ROW.test(nachher[alt + 1])).toBe(true);
    expect(nachher[alt + 1]).toContain('Mit Absatz');
    expect([...nachher.slice(0, alt + 1), ...nachher.slice(alt + 2)]).toEqual(vorher);
  }, 60_000);

  it('[R-H-06] zweite Titelzeile «Protokoll test-lock.json»: Exit 1 ohne Änderung (P38, Angriff A9)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, `\n${PROTOKOLL_TITEL}\n\nZweiter Abschnitt.\n`);
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Doppelt', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('[R-H-06] HTML-Kommentar im Protokollabschnitt: Exit 1 ohne Änderung (P38, Angriff A10)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, '\n<!-- Notiz -->\n');
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Kommentar', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('[R-H-06] HTML-Kommentar ausserhalb des Protokollabschnitts: lock-update läuft (P38, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    const lines = readText(root, FINDINGS_PATH).split('\n');
    lines.splice(lines.indexOf(PROTOKOLL_TITEL), 0, '<!-- Hinweis zum Befundregister -->', '');
    writeText(root, FINDINGS_PATH, lines.join('\n'));
    updateWithRow(sb, root, ['--grund', 'Mit Kommentar oben', '--add', 'tests/neu.test.ts']);
  }, 60_000);

  it('[R-H-06] späterer Abschnitt «## Anhang» mit Tabelle und HTML-Kommentar: regulärer Eintrag direkt nach dem Protokoll-Block (P38a, TR-H0-46)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, ANHANG_ABSCHNITT);
    const vorher = readText(root, FINDINGS_PATH).split('\n');
    const r = update(sb, root, ['--grund', 'Mit Anhang', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(0);
    const nachher = readText(root, FINDINGS_PATH).split('\n');
    const alt = nachher.indexOf(ALTE_PROTOKOLLZEILE);
    expect(ROW.test(nachher[alt + 1])).toBe(true);
    expect(nachher[alt + 1]).toContain('Mit Anhang');
    expect([...nachher.slice(0, alt + 1), ...nachher.slice(alt + 2)]).toEqual(vorher);
  }, 60_000);

  it.each([
    ['|-Zeilen', UNTERABSCHNITT_MIT_TABELLE],
    ['HTML-Kommentar', UNTERABSCHNITT_MIT_KOMMENTAR],
  ])(
    '[R-H-06] ###-Unterüberschrift beendet den Protokollabschnitt nicht: %s darunter → Exit 1 ohne Änderung (P38a, Gegenprobe)',
    (_label, text) => {
      const sb = createSandbox();
      const root = setup(sb);
      appendFindingsText(root, text);
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Unterabschnitt', '--add', 'tests/neu.test.ts']);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] späterer Abschnitt «# Anhang» (Ebene #) mit Tabelle und HTML-Kommentar: regulärer Eintrag direkt nach dem Protokoll-Block (P38a, TR-H0-55)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, ANHANG_H1_ABSCHNITT);
    const vorher = readText(root, FINDINGS_PATH).split('\n');
    const r = update(sb, root, ['--grund', 'Mit H1-Anhang', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(0);
    const nachher = readText(root, FINDINGS_PATH).split('\n');
    const alt = nachher.indexOf(ALTE_PROTOKOLLZEILE);
    expect(ROW.test(nachher[alt + 1])).toBe(true);
    expect(nachher[alt + 1]).toContain('Mit H1-Anhang');
    expect([...nachher.slice(0, alt + 1), ...nachher.slice(alt + 2)]).toEqual(vorher);
  }, 60_000);
});

describe('lock-update: Verschleierung und Kommentar-Anfang (P43, CR-H0S-30, -31)', () => {
  it.each(VERSCHLEIERUNG)(
    '[R-H-06] %s: Exit 1, beide Dateien bytegleich (P43)',
    (_label, umformen) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, umformen);
      writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Nachgeführt', '--refresh', 'tests/a.test.ts']);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] mehrzeiliger Kommentar vor dem Titel, vor dem Titel geschlossen: regulärer Eintrag (P43 a, Gegenprobe, TR-H0-65)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    umformenFindings(root, kommentarVorTitelGeschlossen);
    updateWithRow(sb, root, ['--grund', 'Mit Kommentar oben', '--add', 'tests/neu.test.ts']);
  }, 60_000);

  it.each([
    ['--grund mit Kommentar-Anfang', ['--grund', 'x <!-- y', '--add', 'tests/neu.test.ts']],
    [
      '--befund mit Kommentar-Anfang',
      ['--grund', 'Gültig', '--befund', 'F-1 <!--', '--add', 'tests/neu.test.ts'],
    ],
  ])(
    '[R-H-06] %s: Exit 1, beide Dateien bytegleich (P43, Angriff B19)',
    (_label, args) => {
      const sb = createSandbox();
      const root = setup(sb);
      const before = snapshot(root);
      const r = update(sb, root, args);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );
});

describe('lock-update: Titel nur als ## gültig (P43d)', () => {
  it.each(TITEL_EBENEN)(
    '[R-H-06] %s: Exit 1, beide Dateien bytegleich (P43d)',
    (_label, umformen) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, umformen);
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Titelebene', '--add', 'tests/neu.test.ts']);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );
});

describe('lock-update: eingerückte Titelzeile (P43f)', () => {
  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-06] einzige Titelzeile mit %s eingerückt: Exit 1, beide Dateien bytegleich (P43f)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const root = setup(sb);
      umformenFindings(root, titelEingerueckt(einrueckung));
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Einrückung', '--add', 'tests/neu.test.ts']);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] Titelzeile mit 3 Leerzeichen eingerückt: regulärer Eintrag (P43f, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    umformenFindings(root, titelEingerueckt('   '));
    const vorher = readText(root, FINDINGS_PATH).split('\n');
    const r = update(sb, root, ['--grund', 'Drei Leerzeichen', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(0);
    const nachher = readText(root, FINDINGS_PATH).split('\n');
    const alt = nachher.indexOf(ALTE_PROTOKOLLZEILE);
    expect(ROW.test(nachher[alt + 1])).toBe(true);
    expect(nachher[alt + 1]).toContain('Drei Leerzeichen');
    expect([...nachher.slice(0, alt + 1), ...nachher.slice(alt + 2)]).toEqual(vorher);
  }, 60_000);
});

describe('lock-update: P43f für alle Ebenen und das Abschnittsende (TR-H0-85)', () => {
  function eintragDirektNachBlock(sb: Sandbox, root: string, grund: string): void {
    const vorher = readText(root, FINDINGS_PATH).split('\n');
    const r = update(sb, root, ['--grund', grund, '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(0);
    const nachher = readText(root, FINDINGS_PATH).split('\n');
    const alt = nachher.indexOf(ALTE_PROTOKOLLZEILE);
    expect(ROW.test(nachher[alt + 1])).toBe(true);
    expect(nachher[alt + 1]).toContain(grund);
    expect([...nachher.slice(0, alt + 1), ...nachher.slice(alt + 2)]).toEqual(vorher);
  }

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-06] gültiger ##-Titel plus gleichlautende ###-Zeile mit %s eingerückt: regulärer Eintrag (P43f, TR-H0-85 a)',
    (label, einrueckung) => {
      const sb = createSandbox();
      const root = setup(sb);
      appendFindingsText(root, eingerueckterH3Titel(einrueckung));
      eintragDirektNachBlock(sb, root, `Eingerückt ${label}`);
    },
    60_000,
  );

  it.each(EINRUECKUNG_KEIN_TITEL)(
    '[R-H-06] «## Weiteres» mit %s eingerückt, |-Zeile danach: Exit 1, beide Dateien bytegleich (P43f, P37a, TR-H0-85 b)',
    (_label, einrueckung) => {
      const sb = createSandbox();
      const root = setup(sb);
      appendFindingsText(root, weiteresMitTabelle(einrueckung));
      const before = snapshot(root);
      const r = update(sb, root, ['--grund', 'Weiteres', '--add', 'tests/neu.test.ts']);
      expect(r.status).toBe(1);
      expect(snapshot(root)).toEqual(before);
    },
    60_000,
  );

  it('[R-H-06] «## Weiteres» ohne Einrückung, |-Zeile danach: regulärer Eintrag (P43f, P38a, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, weiteresMitTabelle(''));
    eintragDirektNachBlock(sb, root, 'Weiteres ohne Einrückung');
  }, 60_000);

  it.each(UEBERSCHRIFT_EINGERUECKT_GUELTIG)(
    '[R-H-06] %s eingerückt ist Überschrift, |-Zeile danach: regulärer Eintrag (P43f, P38a, TR-H0-91 a)',
    (label, einrueckung, rauten) => {
      const sb = createSandbox();
      const root = setup(sb);
      appendFindingsText(root, weiteresMitTabelle(einrueckung, rauten));
      eintragDirektNachBlock(sb, root, `Eingerückt ${label.length}`);
    },
    60_000,
  );

  it('[R-H-06] gültiger ##-Titel plus gleichlautende ###-Titelzeile mit 3 Leerzeichen eingerückt: Exit 1, beide Dateien bytegleich (P43f, P43d, TR-H0-91 b)', () => {
    const sb = createSandbox();
    const root = setup(sb);
    appendFindingsText(root, eingerueckterH3Titel('   '));
    const before = snapshot(root);
    const r = update(sb, root, ['--grund', 'Drei Leerzeichen', '--add', 'tests/neu.test.ts']);
    expect(r.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);
});

// V10 Python-Prüfung vor `npm run test:oracle` (Entscheid E10 a, AR0-87, AR0-97, AR0-101, AR0-102).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (pythonProbe, checkPython, oracleUmgebung), §6c
// Fälle (1)–(10); Fall (1) mit runGate('full') steht in gate-full.selbsttest.ts.
// Gefälschte Interpreter sind echte .exe (fake.cs, csc.exe); env enthält nur den Fälschungsordner.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  aufrufe,
  ERWARTETE_PROBE,
  type Faelschungen,
  fakeEnv,
  lege,
  PROBE_SHA256,
  uebersetzeFaelschung,
} from './support/python-fake';
import { aufraeumen, KURZ, lauf, NODE_DIR, neueSandbox, sha256 } from './support/umgebung';
import { pythonCheck } from './support/vertrag';

let f: Faelschungen;

beforeAll(() => {
  f = uebersetzeFaelschung();
});

afterAll(() => {
  rmSync(f.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

afterEach(aufraeumen);

/** Neuer, leerer Ordner unter dem Fälschungsordner. */
let zaehler = 0;
function ordner(name: string): string {
  zaehler += 1;
  const p = join(f.dir, `${String(zaehler)}-${name}`);
  mkdirSync(p, { recursive: true });
  return p;
}

function kandidat(
  geprueft: { quelle: string; version: string | null; grund: string }[],
  quelle: string,
) {
  return geprueft.find((g) => g.quelle === quelle);
}

describe('checkPython: Auswahl und Rot (§6c)', () => {
  it(
    '[R-H-28] (1) nur `python` 2.7.18, `py` und `python3` fehlen, WAP_PYTHON nicht gesetzt → rot mit Ursache und nächstem Schritt',
    async () => {
      const a = ordner('a');
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a) });
      expect(r.ok).toBe(false);
      expect(r.wahl).toBeNull();
      expect(r.ursache ?? '').toContain('Python 3 nicht gefunden');
      expect(r.ursache ?? '').toContain('2.7.18');
      expect(r.naechsterSchritt ?? '').toContain('E10 a');
      expect(r.naechsterSchritt ?? '').toContain('WAP_PYTHON');
      expect(kandidat(r.geprueft, 'py -3')?.grund).toBe('fehlt');
      expect(kandidat(r.geprueft, 'python3')?.grund).toBe('fehlt');
      expect(kandidat(r.geprueft, 'python')).toEqual({
        quelle: 'python',
        version: '2.7.18',
        grund: 'version<3',
      });
    },
    KURZ,
  );

  it(
    '[R-H-28] (2) `python3` endet mit Exit 9009, `python` 2.7 → rot, geprueft python3: exit, python: version<3 in dieser Reihenfolge',
    async () => {
      const a = ordner('a');
      lege(f, a, 'python3', { exit: 9009 });
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a) });
      expect(r.ok).toBe(false);
      const quellen = r.geprueft.map((g) => g.quelle);
      expect(quellen.indexOf('python3')).toBeGreaterThanOrEqual(0);
      expect(quellen.indexOf('python3')).toBeLessThan(quellen.indexOf('python'));
      expect(kandidat(r.geprueft, 'python3')?.grund).toBe('exit');
      expect(kandidat(r.geprueft, 'python')).toEqual({
        quelle: 'python',
        version: '2.7.18',
        grund: 'version<3',
      });
    },
    KURZ,
  );

  it(
    '[R-H-28] (3) `py -3` meldet 3.13.0, Ordner von sys.executable mit `python` 3.13.0, `python` im PATH 2.7 → grün, Wahl py -3; npm run unter oracleUmgebung meldet «Python 3.13.0»',
    async () => {
      const a = ordner('launcher');
      const b = ordner('py313');
      const exe313 = join(b, 'python.exe');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: exe313 });
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      const logB = lege(f, b, 'python', { version: '3 13 0', exe: exe313 });
      const { checkPython, oracleUmgebung } = await pythonCheck();
      const env = fakeEnv(a);
      const r = await checkPython({ cwd: a, env });
      expect(r.ok).toBe(true);
      expect(r.wahl).toEqual({
        quelle: 'py -3',
        ausfuehrbar: exe313,
        verzeichnis: b,
        version: '3.13.0',
      });
      expect(aufrufe(logPy).some((z) => z.startsWith('-3|-c|'))).toBe(true);
      // Zweiter Start von `python` unter oracleUmgebung(env, wahl.verzeichnis) (Vertrag §2).
      expect(aufrufe(logB).some((z) => z.startsWith('-c|'))).toBe(true);

      // npm run -s v mit "v": "python --version" unter der V10-Umgebung (Probe AR0-101).
      const projekt = ordner('npmprojekt');
      writeFileSync(
        join(projekt, 'package.json'),
        `${JSON.stringify({ name: 'v10-probe', private: true, scripts: { v: 'python --version' } }, null, 2)}\n`,
      );
      const npmCli = join(NODE_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js');
      const basis = fakeEnv(a, {
        ComSpec: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
      });
      const mit = lauf(process.execPath, [npmCli, 'run', '-s', 'v'], {
        cwd: projekt,
        env: { ...oracleUmgebung(basis, b), npm_config_offline: 'true' },
        timeout: KURZ,
      });
      expect(mit.status).toBe(0);
      expect(mit.stdout.trim()).toBe('Python 3.13.0');
      const ohne = lauf(process.execPath, [npmCli, 'run', '-s', 'v'], {
        cwd: projekt,
        env: { ...basis, npm_config_offline: 'true' },
        timeout: KURZ,
      });
      expect(ohne.out).not.toContain('3.13.0');
      expect(ohne.stderr).toContain('Python 2.7.18');
    },
    KURZ,
  );

  it(
    '[R-H-28] (4) wie (3), aber der Ordner von sys.executable enthält kein `python` → rot «`python` im Ordner … fehlt oder ist nicht Python 3»',
    async () => {
      const a = ordner('launcher');
      const leer = ordner('ohne-python');
      lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: join(leer, 'python.exe') });
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a) });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('im Ordner');
      expect(r.ursache ?? '').toContain('fehlt oder ist nicht Python 3');
    },
    KURZ,
  );

  it(
    '[R-H-28] (5) WAP_PYTHON zeigt auf ein gefälschtes 2.7, `py -3` meldet 3.13 → rot ohne Rückfall',
    async () => {
      const a = ordner('launcher');
      const d = ordner('wap-python');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: join(a, 'python.exe') });
      lege(f, d, 'python', { version: '2 7 18', exe: join(d, 'python.exe') });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({
        cwd: a,
        env: fakeEnv(a, { WAP_PYTHON: join(d, 'python.exe') }),
      });
      expect(r.ok).toBe(false);
      expect(r.wahl).toBeNull();
      expect(kandidat(r.geprueft, 'WAP_PYTHON')).toEqual({
        quelle: 'WAP_PYTHON',
        version: '2.7.18',
        grund: 'version<3',
      });
      expect(aufrufe(logPy)).toEqual([]);
      expect(r.geprueft.map((g) => g.quelle)).not.toContain('py -3');
    },
    KURZ,
  );

  it(
    '[R-H-28] (6) WAP_PYTHON zeigt auf eine fehlende Datei → rot, kein Rückfall',
    async () => {
      const a = ordner('launcher');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: join(a, 'python.exe') });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({
        cwd: a,
        env: fakeEnv(a, { WAP_PYTHON: join(a, 'gibt-es-nicht', 'python.exe') }),
      });
      expect(r.ok).toBe(false);
      expect(r.wahl).toBeNull();
      expect(kandidat(r.geprueft, 'WAP_PYTHON')?.grund).toBe('fehlt');
      expect(aufrufe(logPy)).toEqual([]);
    },
    KURZ,
  );

  it(
    '[R-H-28] WAP_PYTHON als absoluter Pfad mit / auf ein gefälschtes 3.13 → grün, Wahl WAP_PYTHON (positiver Fall)',
    async () => {
      const a = ordner('launcher');
      const d = ordner('wap-python');
      const exe = join(d, 'python.exe');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: join(a, 'x.exe') });
      lege(f, d, 'python', { version: '3 13 0', exe });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({
        cwd: a,
        env: fakeEnv(a, { WAP_PYTHON: exe.replace(/\\/g, '/') }),
      });
      expect(r.ok).toBe(true);
      expect(r.wahl?.quelle).toBe('WAP_PYTHON');
      expect(r.wahl?.version).toBe('3.13.0');
      expect(r.wahl?.verzeichnis).toBe(d);
      expect(aufrufe(logPy)).toEqual([]);
    },
    KURZ,
  );

  it(
    '[R-H-28] (8) nur `python.cmd` im Fälschungsordner, kein .exe → rot, python: fehlt, nächster Schritt nennt WAP_PYTHON',
    async () => {
      const a = ordner('nur-cmd');
      writeFileSync(join(a, 'python.cmd'), '@echo Python 3.13.0\r\n');
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a) });
      expect(r.ok).toBe(false);
      expect(kandidat(r.geprueft, 'python')?.grund).toBe('fehlt');
      expect(r.naechsterSchritt ?? '').toContain('WAP_PYTHON');
    },
    KURZ,
  );

  it.each([['py3\\python.exe'], ['C:python.exe'], ['\\x\\python.exe']])(
    '[R-H-28] (9) WAP_PYTHON = relativer Pfad «%s», daneben `py -3` 3.13 → rot «WAP_PYTHON ist kein absoluter Pfad», keine Fälschung gestartet',
    async (relativ) => {
      const a = ordner('launcher');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: join(a, 'python.exe') });
      const logPython = lege(f, a, 'python', { version: '3 13 0', exe: join(a, 'python.exe') });
      mkdirSync(join(a, 'py3'), { recursive: true });
      lege(f, join(a, 'py3'), 'python', { version: '3 13 0', exe: join(a, 'py3', 'python.exe') });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a, { WAP_PYTHON: relativ }) });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('WAP_PYTHON ist kein absoluter Pfad');
      expect(kandidat(r.geprueft, 'WAP_PYTHON')?.grund).toBe('fehlt');
      expect(aufrufe(logPy)).toEqual([]);
      expect(aufrufe(logPython)).toEqual([]);
      expect(aufrufe(join(a, 'py3', 'python.log'))).toEqual([]);
    },
    KURZ,
  );

  it(
    '[R-H-28] Probe mit Exit 0, aber nicht lesbarer Ausgabe (keine Versionszeile) → grund exit',
    async () => {
      const a = ordner('a');
      // Version «x y z»: die Fälschung antwortet mit Exit 0 und «x y z\r\n…», nicht lesbar.
      lege(f, a, 'python', { version: 'x y z', exe: 'C:\\Kaputt\\python.exe' });
      const { checkPython } = await pythonCheck();
      const r = await checkPython({ cwd: a, env: fakeEnv(a) });
      expect(r.ok).toBe(false);
      expect(kandidat(r.geprueft, 'python')?.grund).toBe('exit');
    },
    KURZ,
  );
});

describe('pythonProbe (§6c Fall 7, AR0-102)', () => {
  it('[R-H-28] (7) Probe-Befehl ohne Zeilenumbruch, zweimal Backslash-n, nur ASCII, 128 Zeichen, SHA-256 und ohne nur-Python-3-Syntax', async () => {
    const { pythonProbe } = await pythonCheck();
    const p = pythonProbe();
    // (a) kein echter Zeilenumbruch
    expect(/[\r\n]/.test(p)).toBe(false);
    // (b) Backslash + n genau zweimal
    expect(p.split('\\n').length - 1).toBe(2);
    // (c) nur ASCII 0x20–0x7E
    expect(/^[\x20-\x7e]*$/.test(p)).toBe(true);
    // (d) bytegenau
    expect(p.length).toBe(128);
    expect(sha256(p)).toBe(PROBE_SHA256);
    expect(p).toBe(ERWARTETE_PROBE);
    // (e) keine nur unter Python 3 gültige Syntax
    expect(p).not.toContain('print(');
    expect(p).not.toContain('(*');
    expect(p).not.toContain(', *');
    expect(p).not.toMatch(/\bf'|\bf"/);
    expect(p).not.toContain(':=');
    expect(p).toContain('sys.stdout.write');
    expect(p).toContain("' % (");
  });
});

describe('oracleUmgebung (§6c Fall 10)', () => {
  it('[R-H-28] (10) Schlüssel Path = A;B → genau ein Schlüssel PATH = <verzeichnis>;A;B, übrige Schlüssel unverändert, Eingabe unverändert', async () => {
    const { oracleUmgebung } = await pythonCheck();
    const ein = { Path: `A${delimiter}B`, X: '1', SystemRoot: 'C:\\Windows' };
    const kopie = JSON.parse(JSON.stringify(ein)) as typeof ein;
    const aus = oracleUmgebung(ein, 'C:\\Py3');
    expect(Object.keys(aus).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['PATH']);
    expect(aus.PATH).toBe(`C:\\Py3${delimiter}A${delimiter}B`);
    expect(aus.X).toBe('1');
    expect(aus.SystemRoot).toBe('C:\\Windows');
    expect(Object.keys(aus).sort()).toEqual(['PATH', 'SystemRoot', 'X']);
    expect(ein).toEqual(kopie);
  });

  it('[R-H-28] (10) Path und PATH zugleich → genau ein PATH mit dem Wert des ersten Schlüssels nach Object.keys', async () => {
    const { oracleUmgebung } = await pythonCheck();
    const ein: Record<string, string | undefined> = { Path: `A${delimiter}B`, PATH: 'C' };
    const aus = oracleUmgebung(ein, 'V');
    expect(Object.keys(aus).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['PATH']);
    expect(aus.PATH).toBe(`V${delimiter}A${delimiter}B`);
    const umgekehrt = oracleUmgebung({ PATH: 'C', Path: `A${delimiter}B` }, 'V');
    expect(umgekehrt.PATH).toBe(`V${delimiter}C`);
  });

  it('[R-H-28] (10) ohne PATH-Schlüssel bzw. mit leerem Wert → PATH = <verzeichnis>; Einträge mit undefined entfallen', async () => {
    const { oracleUmgebung } = await pythonCheck();
    const ohne = oracleUmgebung({ X: '1', Y: undefined }, 'V');
    expect(ohne).toEqual({ X: '1', PATH: 'V' });
    const leer = oracleUmgebung({ path: '' }, 'V');
    expect(leer).toEqual({ PATH: 'V' });
  });
});

describe('checkPython ohne Kandidaten', () => {
  it('[R-H-28] env ohne jeden Kandidaten → rot, alle Kandidaten fehlt, keine Ausnahme', async () => {
    const sb = neueSandbox();
    const leer = join(sb.base, 'leer');
    mkdirSync(leer);
    const { checkPython } = await pythonCheck();
    const r = await checkPython({ cwd: leer, env: fakeEnv(leer) });
    expect(r.ok).toBe(false);
    expect(r.wahl).toBeNull();
    for (const q of ['py -3', 'python3', 'python']) {
      expect(kandidat(r.geprueft, q)?.grund).toBe('fehlt');
    }
    expect(r.ursache ?? '').toContain('Python 3 nicht gefunden');
  });
});

describe('checkPython: PATH nur im Kindprozess (Vertrag E1-01, Änderungsnotiz AE-001 §1)', () => {
  it(
    '[R-H-28] Wahl über `py -3` lässt die übergebene Umgebung und process.env.PATH unverändert; nur oracleUmgebung liefert den Ordner vorne',
    async () => {
      const a = ordner('launcher');
      const b = ordner('py313');
      const exe313 = join(b, 'python.exe');
      lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: exe313 });
      lege(f, b, 'python', { version: '3 13 0', exe: exe313 });
      const { checkPython, oracleUmgebung } = await pythonCheck();
      const env = fakeEnv(a);
      const vorher = JSON.stringify(env);
      const pfadVorher = process.env.PATH;
      const r = await checkPython({ cwd: a, env });
      expect(r.ok).toBe(true);
      expect(r.wahl?.quelle).toBe('py -3');
      expect(JSON.stringify(env)).toBe(vorher);
      expect(process.env.PATH).toBe(pfadVorher);
      const kind = oracleUmgebung(env, b);
      expect(kind.PATH?.split(delimiter)[0]).toBe(b);
      expect(JSON.stringify(env)).toBe(vorher);
    },
    KURZ,
  );
});

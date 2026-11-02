// Gefälschte Python-Interpreter als echte Windows-Programme (Vertrag E1-01 §6c, AR0-101).
// Übersetzt tests/wap-gate/fixtures/python-fake/fake.cs einmal je Testdatei mit csc.exe des
// .NET Framework 4.x; fehlt csc.exe oder scheitert die Übersetzung, wirft die Hilfe (Test rot, nie
// übersprungen).
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256, WT } from './umgebung';

/**
 * Erwarteter Probe-Befehl: Wortlaut aus Vertrag §2 als eigene Konstante der Testhilfe (nicht der
 * Rückgabewert von pythonProbe(); so erkennen die Fälschungen auch eine falsche Konstante).
 */
export const ERWARTETE_PROBE = String.raw`import sys; sys.stdout.write('%d %d %d\n%s\n' % (sys.version_info[0], sys.version_info[1], sys.version_info[2], sys.executable))`;
export const PROBE_SHA256 = '0585f6c7a1ea95689fe60773b3022b821f6a32e0f69f523d460de3142695e68c';

export interface Faelschungen {
  /** Ordner mit fake.exe, probe.txt und den Protokollen. */
  dir: string;
  exe: string;
  probeDatei: string;
}

/** Übersetzt fake.cs; wirft «csc.exe fehlt oder Übersetzung gescheitert: <Exit>». */
export function uebersetzeFaelschung(): Faelschungen {
  if (sha256(ERWARTETE_PROBE) !== PROBE_SHA256) {
    throw new Error('Testhilfe: ERWARTETE_PROBE weicht vom Wortlaut des Vertrags ab');
  }
  const dir = mkdtempSync(join(tmpdir(), 'wap-pyfake-'));
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const csc = join(systemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const quelle = join(WT, 'tests', 'wap-gate', 'fixtures', 'python-fake', 'fake.cs');
  const exe = join(dir, 'fake.exe');
  if (!existsSync(csc))
    throw new Error('csc.exe fehlt oder Übersetzung gescheitert: csc.exe fehlt');
  const r = spawnSync(csc, ['-nologo', `-out:${exe}`, quelle], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0 || !existsSync(exe)) {
    throw new Error(`csc.exe fehlt oder Übersetzung gescheitert: ${String(r.status)}`);
  }
  const probeDatei = join(dir, 'probe.txt');
  writeFileSync(probeDatei, ERWARTETE_PROBE);
  return { dir, exe, probeDatei };
}

export interface FakeOptionen {
  /** «3 13 0» */
  version?: string;
  exe?: string;
  vor?: string;
  exit?: number;
}

/**
 * Legt eine Kopie der Fälschung als <ordner>/<name>.exe an (name z.B. «python», «python3», «py»)
 * mit Begleitdatei; gibt den Pfad der Protokolldatei zurück (jeder Aufruf eine Zeile).
 */
export function lege(f: Faelschungen, ordner: string, name: string, o: FakeOptionen): string {
  mkdirSync(ordner, { recursive: true });
  copyFileSync(f.exe, join(ordner, `${name}.exe`));
  const log = join(ordner, `${name}.log`);
  const zeilen = [`probe=${f.probeDatei}`, `log=${log}`];
  if (o.version !== undefined) zeilen.push(`version=${o.version}`);
  if (o.exe !== undefined) zeilen.push(`exe=${o.exe}`);
  if (o.vor !== undefined) zeilen.push(`vor=${o.vor}`);
  if (o.exit !== undefined) zeilen.push(`exit=${String(o.exit)}`);
  writeFileSync(join(ordner, `${name}.fake.txt`), `${zeilen.join('\n')}\n`);
  return log;
}

/** Protokollierte Aufrufe einer Fälschung (Argumente mit | getrennt; leer, wenn nie gestartet). */
export function aufrufe(log: string): string[] {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter((z) => z !== '');
}

/** Umgebung nur mit dem Fälschungsordner im PATH (plus SystemRoot), nie das echte Python. */
export function fakeEnv(pfad: string, extra: Record<string, string> = {}): Record<string, string> {
  return { PATH: pfad, SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', ...extra };
}

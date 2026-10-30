// V10 Python-Prüfung vor npm run test:oracle (Entscheid E10 a, R-H-28, ADR-010 §3.2 V10, AR0-87,
// AR0-97, AR0-101, AR0-102).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (`pythonProbe`, `checkPython`,
// `oracleUmgebung`) und §6c. Die Konstante PYTHON_PROBE (Wortlaut im Vertrag, bytegenau) wird nur über
// pythonProbe() exportiert (_konventionen.md §1).
// Aufruf: node scripts/wap-gate/python-check.mjs
import { spawnSync } from 'node:child_process';
import { delimiter, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { hinweis, ok, rot } from './lib/out.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {import('./lib/types.mjs').PythonWahl} PythonWahl */
/** @typedef {import('./lib/types.mjs').PythonKandidat} PythonKandidat */

const PYTHON_PROBE = String.raw`import sys; sys.stdout.write('%d %d %d\n%s\n' % (sys.version_info[0], sys.version_info[1], sys.version_info[2], sys.executable))`;

/** Kandidaten nach WAP_PYTHON in fester Reihenfolge (Vertrag §2). */
const KANDIDATEN = /** @type {const} */ ([
  { quelle: 'py -3', befehl: 'py', vor: ['-3'] },
  { quelle: 'python3', befehl: 'python3', vor: [] },
  { quelle: 'python', befehl: 'python', vor: [] },
]);

const NAECHSTER_SCHRITT =
  'Python 3 als Benutzerinstallation einrichten (Entscheid E10 a; der Launcher `py` macht die Wahl ' +
  'unabhängig von der PATH-Reihenfolge) oder WAP_PYTHON auf python.exe von Python 3 setzen';

/**
 * Liefert den Probe-Befehl PYTHON_PROBE (Argument nach `-c`), bytegenau gemäss Vertrag §2.
 * @returns {string}
 */
export function pythonProbe() {
  return PYTHON_PROBE;
}

/**
 * Umgebung ohne Einträge mit Wert undefined.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
function ohneLeere(env) {
  /** @type {Record<string, string>} */
  const aus = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) aus[k] = v;
  return aus;
}

/**
 * Startet einen Kandidaten mit dem Probe-Befehl (ohne Shell, ohne eigene PATH-Suche; AR0-101).
 * @param {string} befehl
 * @param {string[]} vor
 * @param {Record<string, string>} env
 * @returns {{ grund: 'fehlt' | 'exit' | 'version<3' | 'ok'; version: string | null; major: number | null; exe: string | null; exit: number | null }}
 */
function probiere(befehl, vor, env) {
  const r = spawnSync(befehl, [...vor, '-c', PYTHON_PROBE], {
    env,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 10_000,
  });
  const leer = { version: null, major: null, exe: null, exit: null };
  if (r.error !== undefined) {
    const code = /** @type {NodeJS.ErrnoException} */ (r.error).code;
    return { ...leer, grund: code === 'ENOENT' ? 'fehlt' : 'exit' };
  }
  if (r.status !== 0 || r.signal !== null) return { ...leer, grund: 'exit', exit: r.status };
  const zeilen = (r.stdout ?? '').split(/\r?\n/);
  const m = /^(\d+) (\d+) (\d+)$/.exec(zeilen[0] ?? '');
  const exe = (zeilen[1] ?? '').trim();
  if (m === null || exe === '') return { ...leer, grund: 'exit', exit: 0 };
  const major = Number(m[1]);
  const version = `${m[1]}.${m[2]}.${m[3]}`;
  return { grund: major < 3 ? 'version<3' : 'ok', version, major, exe, exit: 0 };
}

/**
 * Absoluter Windows-Pfad (Laufwerk mit «:\» bzw. «:/» oder UNC «\\»), Vertrag §2.
 * @param {string} p
 * @returns {boolean}
 */
function absolut(p) {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');
}

/**
 * Text eines geprüften Kandidaten für die Ursache.
 * @param {PythonKandidat & { exit?: number | null }} k
 * @returns {string}
 */
function kandidatText(k) {
  if (k.grund === 'fehlt') return `${k.quelle} fehlt`;
  if (k.grund === 'version<3') return `${k.quelle} ${k.version ?? ''}`;
  if (k.grund === 'exit') {
    return k.exit === null || k.exit === undefined || k.exit === 0
      ? `${k.quelle} nicht lesbar`
      : `${k.quelle} Exit ${String(k.exit)}`;
  }
  return `${k.quelle} ${k.version ?? ''}`;
}

/**
 * Wählt den Interpreter (WAP_PYTHON → py -3 → python3 → python), verlangt Hauptversion ≥ 3 und prüft
 * `python` ein zweites Mal unter oracleUmgebung(env, wahl.verzeichnis). Start jedes Kandidaten per
 * spawnSync ohne Shell und ohne eigene PATH-Suche (AR0-101).
 * @param {{ cwd: string; env?: Record<string, string | undefined> }} opts
 * @returns {Promise<Schritt & { wahl: PythonWahl | null; geprueft: PythonKandidat[] }>}
 */
export async function checkPython(opts) {
  const beginn = Date.now();
  const env = ohneLeere(opts.env ?? process.env);
  /** @type {PythonKandidat[]} */
  const geprueft = [];
  /** @type {(PythonKandidat & { exit: number | null })[]} */
  const texte = [];
  /**
   * @param {string} ursache
   * @returns {Schritt & { wahl: PythonWahl | null; geprueft: PythonKandidat[] }}
   */
  const rotSchritt = (ursache) => ({
    id: 'V10-python',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt: NAECHSTER_SCHRITT,
    wahl: null,
    geprueft,
  });
  /** @type {{ quelle: PythonWahl['quelle']; version: string; major: number; exe: string } | null} */
  let gewaehlt = null;
  const wapPython = env.WAP_PYTHON;
  if (wapPython !== undefined && wapPython !== '') {
    if (!absolut(wapPython)) {
      geprueft.push({ quelle: 'WAP_PYTHON', version: null, grund: 'fehlt' });
      return rotSchritt('WAP_PYTHON ist kein absoluter Pfad');
    }
    const p = probiere(wapPython, [], env);
    geprueft.push({ quelle: 'WAP_PYTHON', version: p.version, grund: p.grund });
    texte.push({ quelle: 'WAP_PYTHON', version: p.version, grund: p.grund, exit: p.exit });
    if (p.grund === 'ok' && p.version !== null && p.major !== null && p.exe !== null) {
      gewaehlt = { quelle: 'WAP_PYTHON', version: p.version, major: p.major, exe: p.exe };
    }
  } else {
    for (const k of KANDIDATEN) {
      const p = probiere(k.befehl, [...k.vor], env);
      geprueft.push({ quelle: k.quelle, version: p.version, grund: p.grund });
      texte.push({ quelle: k.quelle, version: p.version, grund: p.grund, exit: p.exit });
      if (p.grund === 'ok' && p.version !== null && p.major !== null && p.exe !== null) {
        gewaehlt = { quelle: k.quelle, version: p.version, major: p.major, exe: p.exe };
        break;
      }
    }
  }
  if (gewaehlt === null) {
    const liste = [
      ...(wapPython === undefined || wapPython === '' ? ['WAP_PYTHON –'] : []),
      ...texte.map(kandidatText),
    ];
    return rotSchritt(`Python 3 nicht gefunden (geprüft: ${liste.join(', ')})`);
  }
  const verzeichnis = dirname(gewaehlt.exe);
  const zweit = probiere('python', [], oracleUmgebung(env, verzeichnis));
  if (zweit.grund !== 'ok' || zweit.major !== gewaehlt.major) {
    return rotSchritt(
      `\`python\` im Ordner ${zeigePfad(verzeichnis)} fehlt oder ist nicht Python 3 (test:oracle ruft «python» auf)`,
    );
  }
  return {
    id: 'V10-python',
    ok: true,
    ms: Date.now() - beginn,
    details: { quelle: gewaehlt.quelle, version: gewaehlt.version },
    wahl: {
      quelle: gewaehlt.quelle,
      ausfuehrbar: gewaehlt.exe,
      verzeichnis,
      version: gewaehlt.version,
    },
    geprueft,
  };
}

/**
 * Umgebung für npm run test:oracle: Kopie von env ohne alle Schlüssel, die ohne Beachtung von
 * Gross/Klein «PATH» lauten, plus genau ein Schlüssel PATH = verzeichnis + Trennzeichen + bisheriger
 * Wert (Wert des ersten solchen Schlüssels nach Object.keys; fehlt er oder ist er leer: nur
 * verzeichnis). Einträge mit Wert undefined entfallen. Rein, ändert env nicht.
 * @param {Record<string, string | undefined>} env
 * @param {string} verzeichnis
 * @returns {Record<string, string>}
 */
export function oracleUmgebung(env, verzeichnis) {
  /** @type {Record<string, string>} */
  const aus = {};
  /** @type {string | undefined} */
  let bisher;
  let gefunden = false;
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (k.toUpperCase() === 'PATH') {
      if (!gefunden) {
        gefunden = true;
        bisher = v;
      }
      continue;
    }
    if (v !== undefined) aus[k] = v;
  }
  aus.PATH =
    bisher === undefined || bisher === '' ? verzeichnis : `${verzeichnis}${delimiter}${bisher}`;
  return aus;
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await checkPython({ cwd: process.cwd() });
  for (const k of s.geprueft)
    hinweis(`geprüft: ${k.quelle} (${k.grund}${k.version ? `, ${k.version}` : ''})`);
  if (s.ok) {
    hinweis(`gewählt: ${s.wahl?.quelle ?? ''} ${s.wahl?.version ?? ''}`);
    ok(s.id, s.ms);
  } else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
  process.exitCode = s.ok ? 0 : 1;
}

// Kindprozesse und Umgebung der Schleusen-Skripte (Paket E1-01, ADR-010 §3; Vertrag E1-01 §9 Nr 16 und
// Änderungsnotiz AE-001 §2). Nur Node-Standardbibliothek. Läufe sind asynchron, damit die
// Wiederholungsprüfung auf fremde Prozesse (F0-last) während langer Schritte laufen kann.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Höchstens so viele Bytes je Ausgabestrom werden behalten (Schutz vor Speicherüberlauf). */
const MAX_AUSGABE = 64 * 1024 * 1024;

/**
 * @typedef {object} Lauf
 * @property {number | null} status
 * @property {string | null} signal
 * @property {string} stdout
 * @property {string} stderr
 * @property {string | null} fehler Startfehler (z.B. ENOENT) oder Zeitüberschreitung
 * @property {number} ms
 */

/**
 * Kopie der Umgebung ohne Einträge mit Wert undefined, ohne NODE_ENV, ohne Schlüssel mit Präfix VITEST
 * oder __VITEST und ohne GIT_* (Vertrag §9 Nr 16). Ändert die Eingabe nicht.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function bereinigt(env) {
  /** @type {Record<string, string>} */
  const aus = {};
  for (const [key, wert] of Object.entries(env)) {
    if (wert === undefined) continue;
    const k = key.toUpperCase();
    if (
      k === 'NODE_ENV' ||
      k.startsWith('GIT_') ||
      k.startsWith('VITEST') ||
      k.startsWith('__VITEST')
    ) {
      continue;
    }
    aus[key] = wert;
  }
  return aus;
}

/**
 * Beendet einen Prozess samt Kindern (Windows: taskkill /T /F).
 * @param {number | undefined} pid
 */
function beendeBaum(pid) {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Prozess bereits beendet.
  }
}

/**
 * Startet einen Prozess ohne Shell und sammelt die Ausgabe.
 * @param {string} befehl
 * @param {string[]} args
 * @param {{ cwd: string; env: Record<string, string>; timeoutMs?: number; input?: string }} opts
 * @returns {Promise<Lauf>}
 */
export function starte(befehl, args, opts) {
  const beginn = Date.now();
  return new Promise((resolve) => {
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    let outLaenge = 0;
    let errLaenge = 0;
    /** @type {string | null} */
    let fehler = null;
    let fertig = false;
    const kind = spawn(befehl, args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const zeit =
      opts.timeoutMs === undefined
        ? null
        : setTimeout(() => {
            fehler = `Zeitlimit von ${String(Math.round((opts.timeoutMs ?? 0) / 1000))} s überschritten`;
            beendeBaum(kind.pid);
          }, opts.timeoutMs);
    kind.stdout.on('data', (/** @type {Buffer} */ d) => {
      if (outLaenge < MAX_AUSGABE) out.push(d);
      outLaenge += d.length;
    });
    kind.stderr.on('data', (/** @type {Buffer} */ d) => {
      if (errLaenge < MAX_AUSGABE) err.push(d);
      errLaenge += d.length;
    });
    const ende = (/** @type {number | null} */ status, /** @type {string | null} */ signal) => {
      if (fertig) return;
      fertig = true;
      if (zeit !== null) clearTimeout(zeit);
      resolve({
        status,
        signal,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        fehler,
        ms: Date.now() - beginn,
      });
    };
    kind.on('error', (e) => {
      const code = /** @type {NodeJS.ErrnoException} */ (e).code;
      fehler = code ?? e.message;
      ende(null, null);
    });
    kind.on('close', (status, signal) => ende(status, signal));
    kind.stdin.on('error', () => {
      // Kind hat stdin geschlossen; ohne Bedeutung.
    });
    kind.stdin.end(opts.input ?? '');
  });
}

/**
 * Startet ein Node-Skript mit dem laufenden Node (process.execPath).
 * @param {string} skript
 * @param {string[]} args
 * @param {{ cwd: string; env: Record<string, string>; timeoutMs?: number; input?: string }} opts
 * @returns {Promise<Lauf>}
 */
export function starteNode(skript, args, opts) {
  return starte(process.execPath, [skript, ...args], opts);
}

/** Pfade der Werkzeuge im node_modules eines Repos (relativ zur Wurzel). */
export const WERKZEUG = {
  vitest: 'node_modules/vitest/vitest.mjs',
  tsc: 'node_modules/typescript/bin/tsc',
  biome: 'node_modules/@biomejs/biome/bin/biome',
  playwright: 'node_modules/@playwright/test/cli.js',
};

/**
 * Absoluter Pfad eines Werkzeugs im Repo; null, wenn es fehlt.
 * @param {string} root
 * @param {keyof typeof WERKZEUG} name
 * @returns {string | null}
 */
export function werkzeug(root, name) {
  const pfad = join(root, ...WERKZEUG[name].split('/'));
  return existsSync(pfad) ? pfad : null;
}

/**
 * npm-cli.js neben dem laufenden Node (npm wird ohne Shell gestartet); null, wenn es fehlt.
 * @returns {string | null}
 */
export function npmCli() {
  const pfad = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return existsSync(pfad) ? pfad : null;
}

/**
 * Kürzt eine Liste für eine Ursache auf höchstens `max` Einträge (Vertrag §9 Nr 8).
 * @param {string[]} eintraege
 * @param {number} [max]
 * @returns {string}
 */
export function kurzeListe(eintraege, max = 20) {
  if (eintraege.length <= max) return eintraege.join(', ');
  return `${eintraege.slice(0, max).join(', ')} … und ${String(eintraege.length - max)} weitere`;
}

/**
 * Entfernt ANSI-Farbcodes aus einer Ausgabe.
 * @param {string} text
 * @returns {string}
 */
export function ohneFarben(text) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI-Steuerfolgen beginnen mit ESC (0x1B).
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

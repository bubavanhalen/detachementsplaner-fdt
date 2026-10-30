// Temporäre Ordner der Schleuse mit Prozesskennung und Aufräumen verwaister Ordner (Paket E1-01b, R-H-11,
// R-H-24; Befund E1-01-24: V3 räumt beim Start verwaiste `wap-v3-*` auf).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 und Notiz Runde 2 Nr 9 (a), (b).
// Entfernt werden nur Ordner mit dem Präfix: `<praefix><pid>-…`, wenn der Prozess nicht mehr lebt, und die
// alte Form ohne PID ab `altMs`. Fehler zählen, ohne Wurf; es gibt keine Ausgabe (nur Anzahlen im Ergebnis).
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Standardalter der alten Form ohne PID (1 h). */
const ALT_MS = 60 * 60 * 1000;

/**
 * Lebt der Prozess? `kill(pid, 0)` gelingt oder meldet EPERM (Prozess eines anderen Benutzers).
 * @param {number} pid
 * @returns {boolean}
 */
function prozessLebt(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return /** @type {NodeJS.ErrnoException} */ (e).code === 'EPERM';
  }
}

/**
 * Legt `<tmpDir>/<praefix><pid>-XXXXXX` an und liefert den absoluten Pfad.
 * @param {string} praefix
 * @param {string} [tmpDir]
 * @returns {string}
 */
export function eigenerTempOrdner(praefix, tmpDir) {
  return mkdtempSync(join(tmpDir ?? tmpdir(), `${praefix}${String(process.pid)}-`));
}

/**
 * Entfernt verwaiste Ordner mit `praefix` in `tmpDir`; meldet nur Anzahlen.
 * @param {{ praefix: string; tmpDir?: string; lebt?: (pid: number) => boolean; jetztMs?: number; altMs?: number }} opts
 * @returns {{ entfernt: number; behalten: number; fehler: number }}
 */
export function raeumeVerwaisteTemp(opts) {
  const ordner = opts.tmpDir ?? tmpdir();
  const lebt = opts.lebt ?? prozessLebt;
  const jetzt = opts.jetztMs ?? Date.now();
  const altMs = opts.altMs ?? ALT_MS;
  const ergebnis = { entfernt: 0, behalten: 0, fehler: 0 };
  /** @type {import('node:fs').Dirent[]} */
  let eintraege;
  try {
    eintraege = readdirSync(ordner, { withFileTypes: true });
  } catch {
    return ergebnis;
  }
  for (const e of eintraege) {
    if (!e.isDirectory() || !e.name.startsWith(opts.praefix)) continue;
    const pfad = join(ordner, e.name);
    const pid = /^(\d+)-/.exec(e.name.slice(opts.praefix.length));
    let verwaist;
    try {
      verwaist =
        pid === null ? jetzt - statSync(pfad).mtimeMs >= altMs : !lebt(Number(pid[1] ?? '0'));
    } catch {
      ergebnis.fehler += 1;
      continue;
    }
    if (!verwaist) {
      ergebnis.behalten += 1;
      continue;
    }
    try {
      rmSync(pfad, { recursive: true, force: true });
      ergebnis.entfernt += 1;
    } catch {
      ergebnis.fehler += 1;
    }
  }
  return ergebnis;
}

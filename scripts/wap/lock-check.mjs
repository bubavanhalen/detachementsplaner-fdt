// Lock-Prüfung per SHA-256-Abgleich aller Einträge von test-lock.json (Paket H0, R-H-05, R-H-08).
// Vertrag: docs/wap-planer/pakete/H0.md, Klauseln 1 und 3, P1, P9, P14, P16, P44h, P44m, P45, P47,
// P47a–P47g.
// Aufruf: node scripts/wap/lock-check.mjs [--root <verzeichnis>] [--gegen <ref>]
//         node scripts/wap/lock-check.mjs --root <verzeichnis> --ref <ref> [--gegen <basis>]
// --ref: Nachweis aus git-Objekten des Stands <ref> (P47); Arbeitsbaum und Index wirken nicht.
// --gegen: Jede Abweichung der Sperrdatei gegenüber <ref> muss im Protokoll von FINDINGS.md durch
// neue Zeilen belegt sein, die genau die abweichenden Pfade nennen (P14). Refs werden eindeutig
// aufgelöst (P44h). Jede Meldung mit Pfad oder Aufrufargument läuft über zeigePfad (P47d–P47g).
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  baumEintraege,
  bereinigeGitUmgebung,
  blobInhalte,
  currentBranch,
  FINDINGS_REL,
  fehler,
  gitBlob,
  info,
  isWapBranch,
  kollisionen,
  LOCK_REL,
  loeseRef,
  objektWurzel,
  parseLock,
  protokollPruefung,
  readLock,
  relInside,
  sha256Lf,
  worktreeOf,
  zeigePfad,
} from './lib/common.mjs';

const AUFRUF =
  'Aufruf: node scripts/wap/lock-check.mjs [--root <verzeichnis>] [--gegen <ref>] | ' +
  '--root <verzeichnis> --ref <ref> [--gegen <basis>]';

/**
 * Prüft alle Einträge gegen den Arbeitsbaum und liefert die Abweichungen.
 * @param {string} root
 * @param {Record<string, string>} files
 * @returns {string[]}
 */
function abweichungen(root, files) {
  /** @type {string[]} */
  const out = [];
  for (const [rel, hash] of Object.entries(files)) {
    const anzeige = zeigePfad(rel);
    const abs = resolve(root, ...rel.split('/'));
    if (relInside(root, abs) === null) {
      out.push(`ungültig: ${anzeige} (liegt ausserhalb des Worktrees)`);
      continue;
    }
    let bytes;
    try {
      if (!statSync(abs).isFile()) {
        out.push(`fehlt: ${anzeige} (keine Datei)`);
        continue;
      }
      bytes = readFileSync(abs);
    } catch {
      out.push(`fehlt: ${anzeige}`);
      continue;
    }
    if (sha256Lf(bytes) !== hash) out.push(`geändert: ${anzeige}`);
  }
  return out;
}

/**
 * Sperrdatei eines Stands aus git-Objekten; fehlt sie, null.
 * @param {string} root
 * @param {string} commit Objekt-ID
 * @returns {{ files: Record<string, string> } | { grund: string } | null}
 */
function lockAusObjekt(root, commit) {
  const bytes = gitBlob(root, `${commit}:${LOCK_REL}`);
  if (bytes === null) return null;
  const lock = parseLock(bytes.toString('utf8'));
  return lock.kind === 'ok' ? { files: lock.files } : { grund: lock.grund };
}

/**
 * P14 für den Arbeitsbaum gegenüber <ref>. P44h präzisiert: <ref> wird eindeutig aufgelöst; danach
 * wird nur noch über die Objekt-ID gelesen.
 * @param {string} root
 * @param {string} ref
 * @param {Record<string, string>} neuLock
 * @returns {{ fehler: string[], hinweise: string[] }}
 */
function gegenRef(root, ref, neuLock) {
  const aufgeloest = loeseRef(root, ref);
  if (!aufgeloest.ok) return { fehler: [aufgeloest.grund], hinweise: [] };
  const id = aufgeloest.id;
  const altLock = lockAusObjekt(root, id);
  if (altLock !== null && 'grund' in altLock) {
    return { fehler: [`${LOCK_REL} im Vergleichsstand: ${altLock.grund}`], hinweise: [] };
  }
  const altFindings = gitBlob(root, `${id}:${FINDINGS_REL}`)?.toString('utf8') ?? '';
  let neuFindings = '';
  try {
    neuFindings = readFileSync(join(root, ...FINDINGS_REL.split('/')), 'utf8');
  } catch {
    neuFindings = '';
  }
  const ziel = loeseRef(root, 'HEAD');
  return protokollPruefung(
    altLock?.files ?? {},
    neuLock,
    altFindings,
    neuFindings,
    ziel.ok ? { root, modus: 'arbeitsbaum', basis: aufgeloest, ziel } : undefined,
  );
}

/**
 * P47, P47a: `--root <verz> --ref <ref> [--gegen <basis>]` – Hashes, Sperrdatei und FINDINGS.md aus
 * git-Objekten des Stands <ref>; Arbeitsbaum, Index-Flags und sparse checkout wirken nicht.
 * Umgebung wie P44 d (alle GIT_* entfernt, keine Ersetzungsobjekte, keine grafts, kein flaches Repo).
 * @param {string} rootAngabe
 * @param {string} ref
 * @param {string | null} gegen
 */
function refModus(rootAngabe, ref, gegen) {
  bereinigeGitUmgebung();
  const wurzel = objektWurzel(rootAngabe);
  if (!wurzel.ok) {
    fehler(`Lock-Prüfung abgebrochen: ${wurzel.grund}.`);
    return 1;
  }
  const root = wurzel.root;
  const refAnzeige = zeigePfad(ref);
  const gegenAnzeige = gegen === null ? '' : zeigePfad(gegen);
  // P44h, P44m: Ref eindeutig und nur als Zweigname, exakter voller Name oder Objekt-ID.
  const aufgeloest = loeseRef(root, ref, { streng: true });
  if (!aufgeloest.ok) {
    fehler(`Lock-Prüfung abgebrochen: ${aufgeloest.grund}.`);
    return 1;
  }
  const commit = aufgeloest.id;
  /** @type {string | null} */
  let basis = null;
  let basisRef = null;
  if (gegen !== null) {
    const b = loeseRef(root, gegen);
    if (!b.ok) {
      fehler(`Lock-Prüfung abgebrochen: Basis: ${b.grund}.`);
      return 1;
    }
    basis = b.id;
    basisRef = b;
  }

  const lock = lockAusObjekt(root, commit);
  /** @type {string[]} */
  const probleme = [];
  if (lock === null) {
    // P44h: WAP-Zweig nach dem aufgelösten vollen Namen (refs/heads/wap-planer, refs/heads/wap/*).
    const voll = aufgeloest.voll ?? '';
    const zweig = voll.startsWith('refs/heads/') ? voll.slice('refs/heads/'.length) : '';
    if (!isWapBranch(zweig)) {
      // P34b sinngemäss: Stand ausserhalb der WAP-Zweige ohne Sperrdatei – nichts zu prüfen.
      info(`Lock-Prüfung: keine ${LOCK_REL} in ${refAnzeige} (kein WAP-Zweig), nichts zu prüfen.`);
      return 0;
    }
    // P31 sinngemäss: auf einem WAP-Zweig ist eine fehlende Sperrdatei ein Verstoss.
    probleme.push(`fehlt: ${LOCK_REL} im Stand ${refAnzeige} des WAP-Zweigs ${zeigePfad(zweig)}`);
  } else if ('grund' in lock) {
    fehler(`Lock-Prüfung gescheitert: ${lock.grund} (Stand ${refAnzeige}).`);
    return 1;
  }
  /** @type {Record<string, string>} */
  const files = lock !== null && 'files' in lock ? lock.files : {};

  const eintraege = baumEintraege(root, commit);
  if (eintraege === null) {
    fehler(`Lock-Prüfung abgebrochen: Baum von ${refAnzeige} nicht lesbar.`);
    return 1;
  }
  // P47b, P47c: Gross/Klein-Kollision eines Baumeintrags mit einem geschützten Pfad (P47d: Pfad
  // maskiert bzw. in Escape-Form).
  for (const k of kollisionen(
    eintraege.map((e) => e.pfad),
    Object.keys(files),
  )) {
    probleme.push(
      `Kollision: ${zeigePfad(k)} (gleicht einem gesperrten Pfad ohne Beachtung von Gross/Klein)`,
    );
  }
  /** @type {Map<string, { mode: string, oid: string }>} */
  const imBaum = new Map(eintraege.map((e) => [e.pfad, { mode: e.mode, oid: e.oid }]));
  const gesucht = Object.keys(files)
    .map((p) => imBaum.get(p))
    .filter((e) => e !== undefined && e.mode !== '160000')
    .map((e) => /** @type {{ oid: string }} */ (e).oid);
  const inhalte = blobInhalte(root, gesucht);
  if (inhalte === null) {
    fehler('Lock-Prüfung abgebrochen: Objekte nicht lesbar (git cat-file).');
    return 1;
  }
  for (const [rel, hash] of Object.entries(files)) {
    const e = imBaum.get(rel);
    const bytes = e === undefined || e.mode === '160000' ? undefined : inhalte.get(e.oid);
    if (bytes === undefined) probleme.push(`fehlt: ${zeigePfad(rel)} (im Stand ${refAnzeige})`);
    else if (sha256Lf(bytes) !== hash) {
      probleme.push(`geändert: ${zeigePfad(rel)} (im Stand ${refAnzeige})`);
    }
  }

  if (basis !== null) {
    const altLock = lockAusObjekt(root, basis);
    if (altLock !== null && 'grund' in altLock) {
      probleme.push(`${LOCK_REL} in ${gegenAnzeige}: ${altLock.grund}`);
    } else {
      const altFindings = gitBlob(root, `${basis}:${FINDINGS_REL}`)?.toString('utf8') ?? '';
      const neuFindings = gitBlob(root, `${commit}:${FINDINGS_REL}`)?.toString('utf8') ?? '';
      const ergebnis = protokollPruefung(altLock?.files ?? {}, files, altFindings, neuFindings, {
        root,
        modus: 'objekt',
        basis: basisRef,
        ziel: aufgeloest,
      });
      // P42: Verstösse im Vergleichsstand sind Hinweise, keine Blockade.
      for (const h of ergebnis.hinweise) {
        info(`Lock-Prüfung: ${refAnzeige} gegen ${gegenAnzeige}: ${h}`);
      }
      for (const p of ergebnis.fehler) probleme.push(`${refAnzeige} gegen ${gegenAnzeige}: ${p}`);
    }
  }
  if (probleme.length > 0) {
    for (const p of probleme) fehler(`Lock-Prüfung: ${p}`);
    fehler(
      `Lock-Prüfung gescheitert: ${probleme.length} Abweichung(en) im Stand ${refAnzeige}. ` +
        'Gesperrte Dateien auf den eingefrorenen Stand zurückführen; Änderungen an Sperren nur ' +
        'über lock-update mit Protokoll.',
    );
    return 1;
  }
  const n = Object.keys(files).length;
  info(`Lock-Prüfung: ${n} ${n === 1 ? 'Datei' : 'Dateien'} in Ordnung`);
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  let start = process.cwd();
  /** @type {string | null} */
  let rootAngabe = null;
  /** @type {string | null} */
  let gegen = null;
  /** @type {string | null} */
  let ref = null;
  for (let i = 0; i < args.length; i += 2) {
    const wert = args[i + 1];
    if (wert === undefined || wert === '' || wert.startsWith('--')) {
      fehler(
        `Lock-Prüfung: ${zeigePfad(/** @type {string} i<args.length im unmittelbar umgebenden for. */ (args[i]))} ohne Wert. ${AUFRUF}`,
      );
      return 1;
    }
    if (args[i] === '--root') {
      start = resolve(wert);
      rootAngabe = wert;
    } else if (args[i] === '--gegen') gegen = wert;
    else if (args[i] === '--ref') ref = wert;
    else {
      fehler(
        `Lock-Prüfung: unbekanntes Argument «${zeigePfad(/** @type {string} i<args.length im unmittelbar umgebenden for. */ (args[i]))}». ${AUFRUF}`,
      );
      return 1;
    }
  }
  if (ref !== null) {
    if (rootAngabe === null) {
      fehler(`Lock-Prüfung: --ref verlangt --root (P47). ${AUFRUF}`);
      return 1;
    }
    return refModus(rootAngabe, ref, gegen);
  }
  const wt = worktreeOf(start);
  if (wt.kind === 'fehler') {
    fehler(
      `Lock-Prüfung abgebrochen: ${wt.grund}. Prüfe die git-Installation und rufe erneut auf.`,
    );
    return 1;
  }
  if (gegen !== null && wt.kind !== 'ok') {
    fehler('Lock-Prüfung: --gegen verlangt ein git-Worktree.');
    return 1;
  }
  const root = wt.kind === 'ok' ? wt.root : start;
  const branch = wt.kind === 'ok' ? currentBranch(root) : '';

  const lock = readLock(root);
  /** @type {string[]} */
  const probleme = [];
  if (lock.kind === 'fehlt') {
    if (!isWapBranch(branch)) {
      // P9, P34b: Nicht-WAP-Zweig ohne Sperrdatei – auch mit --gegen nichts zu prüfen.
      info(`Lock-Prüfung: keine ${LOCK_REL} (kein WAP-Zweig), nichts zu prüfen.`);
      return 0;
    }
    // P31: auf einem WAP-Zweig immer ein Verstoss, auch mit --gegen.
    probleme.push(
      `fehlt: ${LOCK_REL} auf dem WAP-Zweig ${zeigePfad(branch)}; der Orchestrator legt sie mit ` +
        '«node scripts/wap/lock-update.mjs --grund … --add …» an',
    );
  }
  if (lock.kind === 'ungueltig') {
    fehler(
      `Lock-Prüfung gescheitert: ${lock.grund}. Stelle die Datei aus dem letzten Commit wieder her.`,
    );
    return 1;
  }
  /** @type {Record<string, string>} */
  const files = lock.kind === 'ok' ? lock.files : {};

  probleme.push(...abweichungen(root, files));
  if (gegen !== null) {
    const gegenAnzeige = zeigePfad(gegen);
    const ergebnis = gegenRef(root, gegen, files);
    // P42: Verstösse im Vergleichsstand sind Hinweise, keine Blockade.
    for (const h of ergebnis.hinweise) info(`Lock-Prüfung: gegen ${gegenAnzeige}: ${h}`);
    for (const p of ergebnis.fehler) probleme.push(`gegen ${gegenAnzeige}: ${p}`);
  }
  if (probleme.length > 0) {
    for (const p of probleme) fehler(`Lock-Prüfung: ${p}`);
    fehler(
      `Lock-Prüfung gescheitert: ${probleme.length} Abweichung(en). Gesperrte Dateien auf den ` +
        'eingefrorenen Stand zurückführen; Änderungen an Sperren nur über lock-update mit Protokoll.',
    );
    return 1;
  }
  const n = Object.keys(files).length;
  info(`Lock-Prüfung: ${n} ${n === 1 ? 'Datei' : 'Dateien'} in Ordnung`);
  return 0;
}

process.exitCode = main();

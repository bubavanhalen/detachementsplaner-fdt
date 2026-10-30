// Aktualisiert test-lock.json mit Grund und Protokolleintrag in FINDINGS.md (Paket H0, R-H-06).
// Vertrag: docs/wap-planer/pakete/H0.md, Klauseln 1 und 4, P1, P4–P7, P15, P21, P23.
// Aufruf: node scripts/wap/lock-update.mjs --grund "<Text>" [--befund <ID>]
//         (--add <pfad>… | --remove <pfad>… | --refresh <pfad>… | --refresh-all)
// Nur der Orchestrator führt dieses Skript aus (Regel, nicht technisch erzwungen).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FINDINGS_REL,
  fehler,
  info,
  LOCK_REL,
  protokollAbschnitt,
  readLock,
  realPath,
  relInside,
  runGit,
  serializeLock,
  sha256Lf,
  TransaktionsFehler,
  worktreeOf,
  writeTransaktion,
  zeigePfad,
} from './lib/common.mjs';

const AKTIONEN = /** @type {const} */ ({
  '--add': 'Aufnahme',
  '--remove': 'Entsperrung',
  '--refresh': 'Nachführung',
  '--refresh-all': 'Nachführung alle',
});

const AUFRUF =
  'Aufruf: node scripts/wap/lock-update.mjs --grund "<Text>" [--befund <ID>] ' +
  '(--add <pfad>… | --remove <pfad>… | --refresh <pfad>… | --refresh-all)';

class Abbruch extends Error {}

/** Abbruch, nach dem nicht alle Dateien auf dem Ausgangsstand sind (P33). */
class Teilzustand extends Error {}

/** @param {string} text */
function abbruch(text) {
  throw new Abbruch(text);
}

/**
 * @param {string[]} argv
 * @returns {{ grund: string, befund: string | null, aktion: keyof typeof AKTIONEN, pfade: string[] }}
 */
function parseArgs(argv) {
  /** @type {string | null} */
  let grund = null;
  /** @type {string | null} */
  let befund = null;
  /** @type {keyof typeof AKTIONEN | null} */
  let aktion = null;
  /** @type {string[]} */
  const pfade = [];
  const istOption = (/** @type {string | undefined} */ a) =>
    a === '--grund' || a === '--befund' || (a !== undefined && a in AKTIONEN);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--grund' || a === '--befund') {
      const wert = argv[i + 1];
      if (wert === undefined || istOption(wert)) abbruch(`${a} ohne Wert. ${AUFRUF}`);
      if (a === '--grund') {
        if (grund !== null) abbruch('--grund ist mehrfach angegeben.');
        grund = /** @type {string} */ (wert);
      } else {
        if (befund !== null) abbruch('--befund ist mehrfach angegeben.');
        befund = /** @type {string} */ (wert);
      }
      i++;
      continue;
    }
    if (a in AKTIONEN) {
      if (aktion !== null) abbruch(`Nur eine Aktion je Aufruf erlaubt. ${AUFRUF}`);
      aktion = /** @type {keyof typeof AKTIONEN} */ (a);
      while (i + 1 < argv.length && !istOption(argv[i + 1])) {
        pfade.push(argv[i + 1]);
        i++;
      }
      continue;
    }
    // P47f b: ein Aufrufargument ist eine Meldungsstelle mit Pfad.
    abbruch(`Unbekanntes Argument «${zeigePfad(a.split('\\').join('/'))}». ${AUFRUF}`);
  }
  if (grund === null || grund.trim() === '') {
    abbruch(`--grund fehlt oder ist leer; ohne Grund wird nichts geändert. ${AUFRUF}`);
  }
  // P5, P43 c: weder «|», Zeilenumbruch noch Kommentar-Anfang «<!--» (Protokolltabelle).
  const VERBOTEN = /[|\r\n]|<!--/;
  if (VERBOTEN.test(/** @type {string} */ (grund))) {
    abbruch('--grund darf weder «|», «<!--» noch Zeilenumbrüche enthalten (Protokolltabelle).');
  }
  if (befund !== null && (befund.trim() === '' || VERBOTEN.test(befund))) {
    abbruch('--befund darf nicht leer sein und weder «|», «<!--» noch Zeilenumbrüche enthalten.');
  }
  if (aktion === null) abbruch(`Keine Aktion angegeben. ${AUFRUF}`);
  if (aktion === '--refresh-all' && pfade.length > 0) {
    abbruch('--refresh-all nimmt keine Pfade entgegen.');
  }
  if (aktion !== '--refresh-all' && pfade.length === 0) abbruch(`${aktion} ohne Pfad. ${AUFRUF}`);
  return {
    grund: /** @type {string} */ (grund).trim(),
    befund: befund === null ? null : befund.trim(),
    aktion: /** @type {keyof typeof AKTIONEN} */ (aktion),
    pfade,
  };
}

/**
 * Pfad relativ zur Worktree-Wurzel mit `/`.
 * @param {string} root
 * @param {string} cwd
 * @param {string} arg
 */
function toRel(root, cwd, arg) {
  const normiert = arg.split('\\').join('/');
  const abs = resolve(cwd, normiert);
  const rel = relInside(root, abs);
  // P47d–P47g: Aufrufargumente und Pfade nur maskiert bzw. in Escape-Form, relativ mit `/`.
  if (rel === null) {
    abbruch(`${zeigePfad(normiert)} liegt ausserhalb des Worktrees ${zeigePfad(root)}.`);
  }
  if (/** @type {string} */ (rel).includes('|')) {
    abbruch(`${zeigePfad(normiert)}: «|» im Pfad ist nicht erlaubt.`);
  }
  return /** @type {string} */ (rel);
}

/**
 * P21: Schreibweise für einen neu gesperrten Pfad – die von `git ls-files`, sonst die tatsächliche
 * Schreibweise im Dateisystem. P23: die Sperrdatei selbst wird abgewiesen.
 * @param {string} root
 * @param {string} rel
 * @param {Map<string, string>} versioniert Kleinschreibung -> Schreibweise laut git ls-files
 */
function schreibweise(root, rel, versioniert) {
  const git = versioniert.get(rel.toLowerCase());
  const echt = git ?? relInside(root, realPath(join(root, ...rel.split('/'))));
  if (echt === null) abbruch(`${zeigePfad(rel)} liegt ausserhalb des Worktrees.`);
  if (/** @type {string} */ (echt).toLowerCase() === LOCK_REL) {
    abbruch(`${LOCK_REL} kann sich nicht selbst sperren; sie ist immer gesperrt (P2).`);
  }
  return /** @type {string} */ (echt);
}

/**
 * Versionierte Pfade des Worktrees (Kleinschreibung -> Schreibweise laut git ls-files).
 * @param {string} root
 */
function versioniertePfade(root) {
  /** @type {Map<string, string>} */
  const map = new Map();
  const r = runGit(['ls-files', '-z'], { cwd: root });
  if (r.status !== 0) return map;
  for (const p of r.stdout.split('\0')) if (p !== '') map.set(p.toLowerCase(), p);
  return map;
}

/**
 * Hash einer Datei im Worktree; bricht ab, wenn sie fehlt oder keine Datei ist.
 * @param {string} root
 * @param {string} rel
 */
function hashOf(root, rel) {
  const abs = join(root, ...rel.split('/'));
  let st;
  try {
    st = statSync(abs);
  } catch {
    return abbruch(`${zeigePfad(rel)} existiert nicht.`);
  }
  if (!st.isFile()) {
    return abbruch(`${zeigePfad(rel)} ist keine Datei (nur einzelne Dateien, keine Ordner).`);
  }
  return sha256Lf(readFileSync(abs));
}

/**
 * Sucht einen gesperrten Schlüssel (exakt, sonst ohne Beachtung von Gross/Klein).
 * @param {Record<string, string>} files
 * @param {string} rel
 */
function findKey(files, rel) {
  if (rel in files) return rel;
  const lower = rel.toLowerCase();
  return Object.keys(files).find((k) => k.toLowerCase() === lower) ?? null;
}

/**
 * Fügt die Protokollzeile direkt nach der letzten Zeile des Protokoll-Blocks ein (P6). Abgrenzung
 * wie in den Prüfungen (P37, P38, P38a); jeder Verstoss bricht ohne Änderung ab (P37a).
 * @param {string} text
 * @param {string} zeile
 */
function insertRow(text, zeile) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  if (eol === '\r\n' && /(^|[^\r])\n/.test(text)) {
    abbruch(`${FINDINGS_REL} hat gemischte Zeilenenden (CRLF und LF); zuerst vereinheitlichen.`);
  }
  const abschnitt = protokollAbschnitt(text);
  if (!abschnitt.ok) {
    abbruch(`${abschnitt.meldung} – Protokollabschnitt bereinigen und erneut aufrufen`);
  }
  const lines = text.split(eol);
  lines.splice(/** @type {{ ende: number }} */ (abschnitt).ende + 1, 0, zeile);
  return lines.join(eol);
}

function heute() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function main() {
  const { grund, befund, aktion, pfade } = parseArgs(process.argv.slice(2));
  const cwd = realPath(process.cwd());
  const wt = worktreeOf(cwd);
  if (wt.kind !== 'ok')
    abbruch('Kein git-Worktree im aktuellen Verzeichnis; im Worktree aufrufen.');
  const root = /** @type {{ root: string }} */ (wt).root;

  const head = runGit(['-C', root, 'rev-parse', '--short', 'HEAD']);
  const kurz = head.status === 0 ? head.stdout.trim() : '';
  if (!/^[0-9a-f]{7,40}$/.test(kurz))
    abbruch('HEAD nicht bestimmbar; zuerst einen Commit anlegen.');

  const lockFile = join(root, ...LOCK_REL.split('/'));
  const lock = readLock(root);
  if (lock.kind === 'ungueltig')
    abbruch(`${lock.grund}. Zuerst aus dem letzten Commit wiederherstellen.`);
  if (lock.kind === 'fehlt' && aktion !== '--add') {
    abbruch(`${LOCK_REL} fehlt; ${aktion} ist nur mit vorhandener Sperrdatei möglich.`);
  }
  /** @type {Record<string, string>} */
  const files = lock.kind === 'ok' ? { ...lock.files } : {};

  /** @type {string[]} */
  const protokoll = [];
  if (aktion === '--add') {
    const versioniert = versioniertePfade(root);
    for (const arg of pfade) {
      const argRel = toRel(root, cwd, arg);
      if (argRel.toLowerCase() === LOCK_REL) {
        abbruch(`${LOCK_REL} kann sich nicht selbst sperren; sie ist immer gesperrt (P2).`);
      }
      const hash = hashOf(root, argRel);
      const rel = schreibweise(root, argRel, versioniert);
      const alt = findKey(files, rel);
      if (alt !== null) delete files[alt];
      files[rel] = hash;
      protokoll.push(rel);
    }
  } else if (aktion === '--remove' || aktion === '--refresh') {
    for (const arg of pfade) {
      const rel = toRel(root, cwd, arg);
      const key = findKey(files, rel);
      if (key === null) abbruch(`${zeigePfad(rel)} ist nicht gesperrt; ${aktion} nicht möglich.`);
      const k = /** @type {string} */ (key);
      if (aktion === '--remove') delete files[k];
      else files[k] = hashOf(root, k);
      protokoll.push(k);
    }
  } else {
    for (const key of Object.keys(files).sort()) {
      const hash = hashOf(root, key);
      if (hash !== files[key]) {
        files[key] = hash;
        protokoll.push(key);
      }
    }
    if (protokoll.length === 0) {
      abbruch(
        'Keine gesperrte Datei hat sich geändert; nichts nachzuführen, kein Protokolleintrag.',
      );
    }
  }

  const findingsFile = join(root, ...FINDINGS_REL.split('/'));
  if (!existsSync(findingsFile)) abbruch(`${FINDINGS_REL} fehlt; Protokoll nicht möglich.`);
  const zeile = `| ${heute()} | ${kurz} | ${[...new Set(protokoll)].join(', ')} | ${AKTIONEN[aktion]}: ${grund} | ${befund ?? '–'} |`;
  const neuFindings = insertRow(readFileSync(findingsFile, 'utf8'), zeile);

  try {
    writeTransaktion([
      { file: lockFile, content: serializeLock(files) },
      { file: findingsFile, content: neuFindings },
    ]);
  } catch (e) {
    const offen = e instanceof TransaktionsFehler ? e.nichtZurueckgesetzt : [];
    const reste = e instanceof TransaktionsFehler ? e.tmpReste : [];
    if (!(e instanceof TransaktionsFehler) || offen.length > 0 || reste.length > 0) {
      // P33: Rücksetzung selbst gescheitert (oder Zustand unbekannt) – tatsächlichen Stand melden.
      const anzeige = (/** @type {string} */ f) =>
        zeigePfad((relInside(root, f) ?? f).split('\\').join('/'));
      let stand = `Zustand von ${LOCK_REL} und ${FINDINGS_REL} unbekannt. `;
      if (e instanceof TransaktionsFehler) {
        stand =
          offen.length > 0
            ? `Rücksetzung gescheitert – NICHT auf dem Ausgangsstand: ${offen.map(anzeige).join(', ')}. `
            : '';
      }
      if (reste.length > 0) {
        stand += `Zwischendateien nicht entfernt: ${reste.map(anzeige).join(', ')}. `;
      }
      throw new Teilzustand(
        `${stand}Mit «git diff» prüfen und ${LOCK_REL} sowie ${FINDINGS_REL} aus dem letzten ` +
          'Commit wiederherstellen, dann erneut aufrufen.',
      );
    }
    abbruch(
      `${LOCK_REL} oder ${FINDINGS_REL} liess sich nicht schreiben (Schreibschutz oder gesperrt); ` +
        'beide Dateien sind auf dem Ausgangsstand. Schreibrechte prüfen und erneut aufrufen.',
    );
  }
  info(
    `lock-update: ${AKTIONEN[aktion]} für ${protokoll.length} Pfad(e) eingetragen und protokolliert.`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  if (e instanceof Teilzustand) {
    fehler(`lock-update abgebrochen, Dateien möglicherweise geändert: ${e.message}`);
    process.exitCode = 1;
  } else if (e instanceof Abbruch) {
    fehler(`lock-update abgebrochen, keine Änderung vorgenommen: ${e.message}`);
    process.exitCode = 1;
  } else {
    fehler(
      'lock-update abgebrochen, keine Änderung vorgenommen: unerwarteter Fehler beim Lesen. ' +
        'Dateien und Rechte prüfen und erneut aufrufen.',
    );
    process.exitCode = 1;
  }
}

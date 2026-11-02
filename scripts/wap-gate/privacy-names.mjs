// V11 Namensprüfung aller versionierten Textdateien (Gate-0-Entscheid 11 b, R-H-34, ADR-010 §3.2 V11).
// Aufruf: node scripts/wap-gate/privacy-names.mjs --root <verz> (--baum <ref> | --commits <basis>..<ref>)
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `scanNames`, §6b. Nur aus git-Objekten; Ausgabe
// nur maskiert (Commit-Kürzel, Pfad über zeigePfad, Anzahl), nie der Name.
import { pathToFileURL } from 'node:url';
import {
  baumEintraege,
  blobInhalte,
  loeseRef,
  objektWurzel,
  runGit,
  zeigePfad,
} from '../wap/lib/common.mjs';
import { ladeSperrliste, namensSchluessel } from '../wap/lib/muster.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ commit: string | null; pfad: string; anzahl: number }} Treffer */
/** @typedef {Schritt & { geprueft: number; nichtText: number; treffer: Treffer[] }} NamenErgebnis */
/** @typedef {{ mode: string; oid: string; pfad: string }} Eintrag */
/** @typedef {{ schluessel: string; re: RegExp }} Name */

const POSITIVLISTE_REL = 'scripts/wap/privacy-allow.txt';
/** Namenseintrag der Positivliste (H0 P36): `<Name>@<pfad>`, Pfad mit mindestens einem «/». */
const NAMENSEINTRAG = /^([^@\s](?:[^@]*[^@\s])?)@([^@\s]*\/[^@\s]*)$/;
const NAECHSTER_TREFFER =
  'Namen entfernen bzw. pseudonymisieren (gleicher Name → gleiches Pseudonym, Grad bleibt); Treffer in ' +
  'Zwischencommits vor dem Merge bereinigen (Orchestrator); Freigaben nur über <Name>@<pfad> in ' +
  'scripts/wap/privacy-allow.txt';

/**
 * Text einer Datei: UTF-16 mit BOM, sonst UTF-8; null bei Binärdateien (NUL-Byte), wie H0 P18.
 * @param {Buffer} bytes
 * @returns {string | null}
 */
function dekodiere(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const le = Buffer.from(bytes.subarray(2, 2 + ((bytes.length - 2) & ~1)));
    le.swap16();
    return le.toString('utf16le');
  }
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Freigaben je Pfad aus dem Text der Positivliste.
 * @param {string | null} text
 * @returns {Map<string, Set<string>>}
 */
function freigaben(text) {
  /** @type {Map<string, Set<string>>} */
  const out = new Map();
  if (text === null) return out;
  for (const roh of text.split(/\r?\n/)) {
    const m = NAMENSEINTRAG.exec(roh.trim().normalize('NFC'));
    if (m === null || m[1] === undefined || m[2] === undefined) continue;
    const pfad = m[2].toLowerCase();
    const set = out.get(pfad) ?? new Set();
    set.add(namensSchluessel(m[1]));
    out.set(pfad, set);
  }
  return out;
}

/**
 * Zählt die Namen der Sperrliste in einem Text (ohne Freigaben).
 * @param {string} pfad
 * @param {string} text
 * @param {Name[]} namen
 * @param {Map<string, Set<string>>} frei
 * @returns {number}
 */
function zaehle(pfad, text, namen, frei) {
  const fuerDatei = frei.get(pfad.toLowerCase());
  const istListe = pfad.toLowerCase() === POSITIVLISTE_REL;
  /** @type {Set<string>} */
  const eigene = new Set();
  if (istListe) for (const s of freigaben(text).values()) for (const n of s) eigene.add(n);
  let anzahl = 0;
  for (const roh of text.split(/\r?\n/)) {
    const zeile = roh.normalize('NFC');
    const eintrag = istListe && NAMENSEINTRAG.test(zeile.trim());
    for (const { schluessel, re } of namen) {
      if (fuerDatei?.has(schluessel)) continue;
      if (eintrag && eigene.has(schluessel)) continue;
      anzahl += (zeile.match(new RegExp(re.source, re.flags)) ?? []).length;
    }
  }
  return anzahl;
}

/**
 * Hinzugefügte oder geänderte Einträge eines Commits gegenüber jedem Elternteil (wie H0 P44).
 * @param {string} root
 * @param {string} commit
 * @returns {Eintrag[] | null}
 */
function commitEintraege(root, commit) {
  const kopf = runGit(['-C', root, 'rev-list', '--parents', '-n', '1', commit]);
  if (kopf.status !== 0) return null;
  const eltern = kopf.stdout.trim().split(/\s+/).slice(1);
  if (eltern.length === 0) {
    const alle = baumEintraege(root, commit);
    return alle === null ? null : alle.map((e) => ({ mode: e.mode, oid: e.oid, pfad: e.pfad }));
  }
  /** @type {Map<string, Eintrag>} */
  const out = new Map();
  for (const p of eltern) {
    const d = runGit(['-C', root, 'diff-tree', '-r', '-z', '--no-renames', '--raw', p, commit]);
    if (d.status !== 0) return null;
    const teile = d.stdout.split('\0');
    for (let i = 0; i + 1 < teile.length; i += 2) {
      const meta = teile[i] ?? '';
      const pfad = teile[i + 1] ?? '';
      const m = /^:(\d+) (\d+) [0-9a-f]+ ([0-9a-f]+) ([A-Z])/.exec(meta);
      if (m === null || m[4] === 'D') continue;
      const e = { mode: m[2] ?? '', oid: m[3] ?? '', pfad };
      out.set(`${e.pfad}\0${e.oid}`, e);
    }
  }
  return [...out.values()];
}

/**
 * Prüft Einträge eines Stands bzw. Commits; Fehler (Gitlink, fehlende Objekte) als Text.
 * @param {string} root
 * @param {Eintrag[]} eintraege
 * @param {string | null} commit Kürzel oder null (Baum)
 * @param {Name[]} namen
 * @param {Map<string, Set<string>>} frei
 * @param {{ geprueft: number; nichtText: number; treffer: Treffer[] }} stand
 * @returns {string | null}
 */
function pruefe(root, eintraege, commit, namen, frei, stand) {
  const gitlink = eintraege.find((e) => e.mode === '160000');
  if (gitlink !== undefined) return `Untermodul nicht prüfbar: ${zeigePfad(gitlink.pfad)}`;
  const blobs = eintraege.filter((e) => e.mode !== '040000');
  const inhalte = blobInhalte(
    root,
    blobs.map((e) => e.oid),
  );
  if (inhalte === null) return 'Objekte nicht lesbar (git cat-file gescheitert)';
  for (const e of blobs) {
    const bytes = inhalte.get(e.oid);
    if (bytes === undefined) return 'Objekte nicht lesbar (Blob fehlt)';
    const text = dekodiere(bytes);
    if (text === null) {
      stand.nichtText += 1;
      continue;
    }
    stand.geprueft += 1;
    const anzahl = zaehle(e.pfad, text, namen, frei);
    if (anzahl > 0) stand.treffer.push({ commit, pfad: e.pfad, anzahl });
  }
  return null;
}

/**
 * Positivliste in einem Stand (Blob `scripts/wap/privacy-allow.txt`), sonst keine Freigaben.
 * @param {string} root
 * @param {string} commit
 * @returns {Map<string, Set<string>>}
 */
function freigabenIn(root, commit) {
  const r = runGit(['-C', root, 'show', `${commit}:${POSITIVLISTE_REL}`]);
  return freigaben(r.status === 0 ? dekodiere(r.raw) : null);
}

/**
 * Kern der Prüfung (synchron, damit die bereinigte Umgebung nur für diese Aufrufe gilt).
 * @param {{ root: string; baum?: string; commits?: string }} opts
 * @param {number} beginn
 * @returns {NamenErgebnis}
 */
function pruefeSynchron(opts, beginn) {
  /** @type {{ geprueft: number; nichtText: number; treffer: Treffer[] }} */
  const stand = { geprueft: 0, nichtText: 0, treffer: [] };
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {NamenErgebnis}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'V11-namen',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    ...stand,
  });
  if ((opts.baum === undefined) === (opts.commits === undefined)) {
    return rotSchritt(
      'genau eines von baum oder commits angeben',
      '--baum <ref> oder --commits <basis>..<ref>',
    );
  }
  const liste = ladeSperrliste();
  if (!liste.ok)
    return rotSchritt(liste.grund, 'Sperrliste lokal bereitstellen (WAP_REFERENCE_DIR)');
  const wurzel = objektWurzel(opts.root);
  if (!wurzel.ok)
    return rotSchritt(wurzel.grund, '--root auf die Wurzel eines vollständigen Repos setzen');
  const root = wurzel.root;
  if (opts.baum !== undefined) {
    const ref = loeseRef(root, opts.baum);
    if (!ref.ok) return rotSchritt(ref.grund, 'gültigen Ref angeben');
    const alle = baumEintraege(root, ref.id);
    if (alle === null)
      return rotSchritt('Baum nicht lesbar (git ls-tree gescheitert)', 'Repo prüfen');
    const eintraege = alle.map((e) => ({ mode: e.mode, oid: e.oid, pfad: e.pfad }));
    const fehler = pruefe(root, eintraege, null, liste.namen, freigabenIn(root, ref.id), stand);
    if (fehler !== null) return rotSchritt(fehler, 'Untermodul bzw. Repo-Zustand klären');
  } else {
    const teile = (opts.commits ?? '').split('..');
    if (teile.length !== 2 || teile[0] === '' || teile[1] === '') {
      return rotSchritt('Bereich ist nicht in der Form <basis>..<ref>', 'Bereich korrigieren');
    }
    const a = loeseRef(root, teile[0] ?? '');
    const b = loeseRef(root, teile[1] ?? '');
    if (!a.ok) return rotSchritt(a.grund, 'gültige Basis angeben');
    if (!b.ok) return rotSchritt(b.grund, 'gültigen Ref angeben');
    const rl = runGit(['-C', root, 'rev-list', `${a.id}..${b.id}`]);
    if (rl.status !== 0)
      return rotSchritt('Bereich nicht lesbar (git rev-list gescheitert)', 'Bereich prüfen');
    for (const commit of rl.stdout.split('\n').filter((z) => z !== '')) {
      const eintraege = commitEintraege(root, commit);
      if (eintraege === null)
        return rotSchritt('Commit nicht lesbar (git diff-tree gescheitert)', 'Repo prüfen');
      const fehler = pruefe(
        root,
        eintraege,
        commit.slice(0, 12),
        liste.namen,
        freigabenIn(root, commit),
        stand,
      );
      if (fehler !== null) return rotSchritt(fehler, 'Untermodul bzw. Repo-Zustand klären');
    }
  }
  if (stand.treffer.length === 0) {
    return { id: 'V11-namen', ok: true, ms: Date.now() - beginn, ...stand };
  }
  return rotSchritt(
    `Namen aus der Sperrliste in ${String(stand.treffer.length)} Dateien: ${kurzeListe(
      stand.treffer.map(
        (t) =>
          `${t.commit === null ? '' : `${t.commit} `}${zeigePfad(t.pfad)} (${String(t.anzahl)})`,
      ),
    )}`,
    NAECHSTER_TREFFER,
  );
}

/**
 * Genau einer von baum/commits. Nur Funde der Art «Name aus der Sperrliste»; Ausgabe nur maskiert
 * (Commit-Kürzel, Pfad über zeigePfad, Anzahl), nie der Name. Fehlerfälle siehe Vertrag §2.
 * @param {{ root: string; baum?: string; commits?: string }} opts
 * @returns {Promise<NamenErgebnis>}
 */
export async function scanNames(opts) {
  const beginn = Date.now();
  // Alle GIT_*-Variablen des Aufrufers wirken nicht (H0 P44f, P45); nur für diesen synchronen Teil.
  /** @type {[string, string | undefined][]} */
  const gesichert = Object.keys(process.env)
    .filter((k) => k.toUpperCase().startsWith('GIT_'))
    .map((k) => [k, process.env[k]]);
  for (const [k] of gesichert) delete process.env[k];
  try {
    return pruefeSynchron(opts, beginn);
  } finally {
    for (const [k, v] of gesichert) if (v !== undefined) process.env[k] = v;
  }
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  /** @type {Record<string, string>} */
  const werte = {};
  let gueltig = args.length % 2 === 0;
  for (let i = 0; i + 1 < args.length; i += 2) {
    const name = args[i] ?? '';
    const wert = args[i + 1] ?? '';
    if (!['--root', '--baum', '--commits'].includes(name) || name in werte) gueltig = false;
    werte[name] = wert;
  }
  const root = werte['--root'];
  if (!gueltig || root === undefined) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/privacy-names.mjs --root <verz> (--baum <ref> | --commits <basis>..<ref>)',
    );
    process.exitCode = 1;
  } else {
    const s = await scanNames({
      root,
      ...(werte['--baum'] === undefined ? {} : { baum: werte['--baum'] }),
      ...(werte['--commits'] === undefined ? {} : { commits: werte['--commits'] }),
    });
    for (const t of s.treffer) {
      hinweis(
        `Treffer: ${t.commit === null ? '' : `${t.commit} `}${zeigePfad(t.pfad)}: ${String(t.anzahl)}`,
      );
    }
    hinweis(`Geprüft: ${String(s.geprueft)} Textdateien, ${String(s.nichtText)} nicht Text.`);
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

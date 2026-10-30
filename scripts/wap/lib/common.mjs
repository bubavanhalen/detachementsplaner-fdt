// Gemeinsame Hilfen der Harness-Skripte des WAP-Planers (Paket H0).
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte», P1–P25.
// Nur Node-Standardbibliothek und git. Meldungen Deutsch; nie Personendaten im Klartext.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { zeigePfad } from './muster.mjs';

export { escapePfad, zeigePfad } from './muster.mjs';

/** Pfad der Sperrdatei relativ zur Worktree-Wurzel (Klausel 1). */
export const LOCK_REL = 'docs/wap-planer/test-lock.json';

/** Protokoll der Sperrdatei in FINDINGS.md (Klausel 4). */
export const FINDINGS_REL = 'docs/wap-planer/FINDINGS.md';

/** Überschrift des Protokollabschnitts in FINDINGS.md (Klausel 4, P6). */
export const PROTOKOLL_TITEL = '## Protokoll `test-lock.json`';

/**
 * Führt git aus. Liefert nie eine Ausnahme; `error` ist gesetzt, wenn git nicht startet.
 * Ersetzungsobjekte (`git replace`) wirken in keinem Aufruf (P45: GIT_NO_REPLACE_OBJECTS=1).
 * @param {string[]} args
 * @param {{ cwd?: string, english?: boolean, eigeneWurzel?: boolean, input?: string, nurRoh?: boolean }} [options]
 *   eigeneWurzel: ohne GIT_DIR, GIT_WORK_TREE und GIT_COMMON_DIR des Aufrufers (P39e);
 *   GIT_INDEX_FILE bleibt erhalten; input: Eingabe auf stdin; nurRoh: stdout nur als Buffer
 *   (`stdout` bleibt leer; für grosse Objekte, P44l)
 * @returns {{ status: number | null, stdout: string, stderr: string, raw: Buffer, error: Error | undefined }}
 */
export function runGit(args, options = {}) {
  const env = { ...process.env };
  if (options.eigeneWurzel) {
    for (const key of Object.keys(env)) {
      const k = key.toUpperCase();
      if (k === 'GIT_DIR' || k === 'GIT_WORK_TREE' || k === 'GIT_COMMON_DIR') delete env[key];
    }
  }
  if (options.english) {
    // Fehlermeldungen unabhängig von der Spracheinstellung (P3: «not a git repository»).
    env.LC_ALL = 'C';
    env.LANGUAGE = 'C';
  }
  env.GIT_NO_REPLACE_OBJECTS = '1';
  const r = spawnSync('git', args, {
    cwd: options.cwd,
    env,
    input: options.input === undefined ? undefined : Buffer.from(options.input, 'utf8'),
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  const raw = r.stdout ?? Buffer.alloc(0);
  return {
    status: r.status,
    stdout: options.nurRoh ? '' : raw.toString('utf8'),
    stderr: (r.stderr ?? Buffer.alloc(0)).toString('utf8'),
    raw,
    error: r.error,
  };
}

/**
 * Worktree-Wurzel eines Verzeichnisses.
 * @param {string} dir
 * @returns {{ kind: 'ok', root: string } | { kind: 'kein-repo' } | { kind: 'fehler', grund: string }}
 */
export function worktreeOf(dir) {
  // P39e: die Wurzel folgt aus dem Ordner, nicht aus GIT_DIR usw. des Aufrufers.
  const r = runGit(['-C', dir, 'rev-parse', '--show-toplevel'], {
    english: true,
    eigeneWurzel: true,
  });
  if (r.error) return { kind: 'fehler', grund: 'git ist nicht aufrufbar' };
  if (r.status === 0) {
    const top = r.stdout.trim();
    if (top === '') return { kind: 'fehler', grund: 'git lieferte keine Worktree-Wurzel' };
    return { kind: 'ok', root: realPath(top) };
  }
  // Nur die Meldung «not a git repository (or any …)» heisst «kein Repo». «not a git repository:
  // <pfad>» (z.B. `gitdir:` ins Leere) und jede andere Meldung sind Fehler (P3, P39c).
  if (/not a git repository \(or any/i.test(r.stderr)) return { kind: 'kein-repo' };
  return { kind: 'fehler', grund: 'git rev-parse scheiterte' };
}

/**
 * Umgebung der Objekt-Modi (P44 d, P44f 2, P47): alle Variablen mit Präfix `GIT_` des Aufrufers
 * werden entfernt; danach setzt `runGit` selbst GIT_NO_REPLACE_OBJECTS=1.
 */
export function bereinigeGitUmgebung() {
  for (const key of Object.keys(process.env)) {
    if (key.toUpperCase().startsWith('GIT_')) delete process.env[key];
  }
}

/**
 * Bestätigt `--root` als Worktree-Wurzel und prüft den Repo-Zustand für Nachweise aus Objekten
 * (P44 a, d; P47, P47a): `rev-parse --show-toplevel` gleich dem nativ aufgelösten Ordner, keine
 * `info/grafts`, kein flaches Repo.
 * @param {string} angabe
 * @returns {{ ok: true, root: string } | { ok: false, grund: string }}
 */
export function objektWurzel(angabe) {
  const abs = resolve(angabe);
  if (!existsSync(abs)) return { ok: false, grund: '--root existiert nicht' };
  const real = realPath(abs);
  const wt = worktreeOf(real);
  if (wt.kind !== 'ok' || relative(wt.root, real) !== '') {
    return { ok: false, grund: '--root ist keine von git bestätigte Worktree-Wurzel' };
  }
  const common = runGit(['-C', wt.root, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (common.status !== 0 || common.stdout.trim() === '') {
    return { ok: false, grund: 'git-common-dir nicht bestimmbar' };
  }
  if (existsSync(join(common.stdout.trim(), 'info', 'grafts'))) {
    return { ok: false, grund: 'info/grafts vorhanden (Verlauf nicht verlässlich)' };
  }
  const flach = runGit(['-C', wt.root, 'rev-parse', '--is-shallow-repository']);
  if (flach.status !== 0 || flach.stdout.trim() !== 'false') {
    return { ok: false, grund: 'flaches Repo (Verlauf unvollständig)' };
  }
  return { ok: true, root: wt.root };
}

/**
 * Prüft einen Ref auf einen Commit (bzw. Baum) und liefert die Objekt-ID; null bei ungültigem Ref.
 * @param {string} root
 * @param {string} ref
 * @param {'commit' | 'tree'} [typ]
 */
export function objektId(root, ref, typ = 'commit') {
  if (ref === '' || ref.startsWith('-')) return null;
  const r = runGit(['-C', root, 'rev-parse', '--verify', '--quiet', `${ref}^{${typ}}`]);
  const id = r.stdout.trim();
  return r.status === 0 && /^[0-9a-f]{40,64}$/.test(id) ? id : null;
}

/**
 * Löst einen übergebenen Ref eindeutig zu einem Commit auf (P44h, P44i):
 * - eine volle Objekt-ID oder ein voller Ref-Name (`refs/…`) gilt wörtlich;
 * - existiert `refs/heads/<name>`, gilt nur dieser Zweig (ein gleichnamiger Tag oder `refs/<name>`
 *   überdeckt ihn nicht);
 * - sonst muss der Name genau einen der Kandidaten `refs/<n>`, `refs/tags/<n>`, `refs/remotes/<n>`,
 *   `refs/remotes/<n>/HEAD` treffen, sonst «mehrdeutig»;
 * - `HEAD` sowie Ausdrücke mit `~`/`^` werden über ihren Anfang nach denselben Regeln aufgelöst.
 * `voll` ist der aufgelöste volle Ref-Name (null bei Objekt-ID), massgebend für den WAP-Zweig.
 * Ein voller Ref-Name gilt nur, wenn er in genau dieser Schreibweise existiert (P44m).
 * @param {string} root
 * @param {string} angabe
 * @param {{ streng?: boolean }} [optionen] streng: keine Ausdrücke mit `~`, `^`, `@` (P44m, `--ref`)
 * @returns {{ ok: true, id: string, voll: string | null } | { ok: false, grund: string }}
 */
export function loeseRef(root, angabe, optionen = {}) {
  const zeige = zeigePfad(angabe);
  if (angabe === '' || angabe.startsWith('-') || /[\s:]/.test(angabe)) {
    return { ok: false, grund: `Ref «${zeige}» ist ungültig` };
  }
  // P44m: nur Zweigname, exakter voller Ref-Name oder Objekt-ID – keine Ausdrücke mit ~, ^, @.
  if (optionen.streng && /[~^@]/.test(angabe)) {
    return {
      ok: false,
      grund: `Ref «${zeige}» ist ein Ausdruck (~, ^, @); nur Zweigname, voller Ref-Name oder Objekt-ID`,
    };
  }
  const m = /^([^~^]+)([~^].*)?$/.exec(angabe);
  if (m === null) return { ok: false, grund: `Ref «${zeige}» ist ungültig` };
  const name = /** @type {string} Pflichtcapture im zuvor erfolgreich geprüften Regex. */ (m[1]);
  const zusatz = m[2] ?? '';
  /** @type {string | null} */
  let voll = null;
  /** @type {string} */
  let basis;
  /** @type {Set<string> | null} */
  let alleRefs = null;
  const alle = () => {
    if (alleRefs === null) {
      const liste = runGit(['-C', root, 'for-each-ref', '--format=%(refname)']);
      alleRefs =
        liste.status === 0 ? new Set(liste.stdout.split('\n').filter((z) => z !== '')) : null;
    }
    return alleRefs;
  };
  if (/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(name)) {
    basis = name;
  } else if (name === 'HEAD') {
    const s = runGit(['-C', root, 'symbolic-ref', '-q', 'HEAD']);
    voll = s.status === 0 ? s.stdout.trim() : null;
    basis = 'HEAD';
  } else if (name.startsWith('refs/')) {
    // P44m: ein voller Ref-Name gilt nur in genau dieser Schreibweise.
    const refs = alle();
    if (refs === null) return { ok: false, grund: 'Refs nicht lesbar (git for-each-ref)' };
    if (!refs.has(name)) return { ok: false, grund: `Ref «${zeige}» existiert nicht` };
    voll = name;
    basis = name;
  } else {
    const refs = alle();
    if (refs === null) return { ok: false, grund: 'Refs nicht lesbar (git for-each-ref)' };
    if (refs.has(`refs/heads/${name}`)) {
      voll = `refs/heads/${name}`;
    } else {
      const kandidaten = [
        `refs/${name}`,
        `refs/tags/${name}`,
        `refs/remotes/${name}`,
        `refs/remotes/${name}/HEAD`,
      ].filter((k) => refs.has(k));
      if (kandidaten.length > 1) {
        return { ok: false, grund: `Ref «${zeige}» ist mehrdeutig (${kandidaten.length} Refs)` };
      }
      if (kandidaten.length === 1)
        voll = /** @type {string} Zugriff ausschliesslich im length===1-Zweig. */ (kandidaten[0]);
      else if (!/^[0-9a-f]{4,64}$/.test(name)) {
        return { ok: false, grund: `Ref «${zeige}» ist unbekannt` };
      }
    }
    basis = voll ?? name;
  }
  const id = objektId(root, `${basis}${zusatz}`);
  if (id === null) return { ok: false, grund: `Ref «${zeige}» ist kein Commit` };
  return { ok: true, id, voll: zusatz === '' ? voll : null };
}

/**
 * Gross/Klein-Kollisionen mit geschützten Pfaden (P47b, P47c, P9a): Ein Eintrag (oder einer seiner
 * Verzeichnisteile) gleicht einem geschützten Pfad oder einem seiner Verzeichnisteile ohne Beachtung
 * von Gross/Klein, aber nicht genau. Geschützt sind die gesperrten Pfade sowie test-lock.json und
 * FINDINGS.md.
 * @param {Iterable<string>} eintraege Pfade des Baums bzw. Index
 * @param {Iterable<string>} gesperrt
 * @returns {string[]} kollidierende Einträge (sortiert)
 */
export function kollisionen(eintraege, gesperrt) {
  /** @type {Map<string, Set<string>>} */
  const geschuetzt = new Map();
  const merke = (/** @type {string} */ p) => {
    const teile = p.split('/');
    for (let i = 1; i <= teile.length; i++) {
      const pre = teile.slice(0, i).join('/');
      const k = pre.toLowerCase();
      const set = geschuetzt.get(k) ?? new Set();
      set.add(pre);
      geschuetzt.set(k, set);
    }
  };
  for (const p of gesperrt) merke(p);
  merke(LOCK_REL);
  merke(FINDINGS_REL);
  const out = new Set();
  for (const e of eintraege) {
    const teile = e.split('/');
    for (let i = 1; i <= teile.length; i++) {
      const pre = teile.slice(0, i).join('/');
      const set = geschuetzt.get(pre.toLowerCase());
      if (set !== undefined && !set.has(pre)) {
        out.add(e);
        break;
      }
    }
  }
  return [...out].sort();
}

/**
 * Einträge eines Baums (`ls-tree -r -z`).
 * @param {string} root
 * @param {string} ref
 * @returns {Array<{ mode: string, typ: string, oid: string, pfad: string }> | null}
 */
export function baumEintraege(root, ref) {
  const r = runGit(['-C', root, 'ls-tree', '-r', '-z', '--full-tree', ref]);
  if (r.status !== 0) return null;
  /** @type {Array<{ mode: string, typ: string, oid: string, pfad: string }>} */
  const out = [];
  for (const satz of r.stdout.split('\0')) {
    if (satz === '') continue;
    const tab = satz.indexOf('\t');
    const [mode, typ, oid] =
      /** @type {[string, string, string]} Drei Kopfwerte des erfolgreichen git-ls-tree-Formats. */ (
        satz.slice(0, tab).split(' ')
      );
    out.push({ mode, typ, oid, pfad: satz.slice(tab + 1) });
  }
  return out;
}

/**
 * Rohinhalte von Blobs per `cat-file --batch` (ohne textconv und Filter, P44 c).
 * @param {string} root
 * @param {string[]} oids
 * @returns {Map<string, Buffer> | null} null, wenn git scheitert oder ein Objekt fehlt
 */
export function blobInhalte(root, oids) {
  /** @type {Map<string, Buffer>} */
  const out = new Map();
  const eindeutig = [...new Set(oids)];
  if (eindeutig.length === 0) return out;
  const groessen = blobGroessen(root, eindeutig);
  if (groessen === null) return null;
  // P44l: in Stapeln laden (je höchstens 256 MiB), Ausgabe nie als Zeichenkette (Längengrenze).
  const STAPEL = 256 * 1024 * 1024;
  /** @type {string[][]} */
  const stapel = [[]];
  let summe = 0;
  for (const oid of eindeutig) {
    const g = groessen.get(oid) ?? 0;
    if (
      summe + g > STAPEL &&
      /** @type {string[]} Initial [[]]; nur weitere Stapel hinzufügen, nie entfernen. */ (
        stapel[stapel.length - 1]
      ).length > 0
    ) {
      stapel.push([]);
      summe = 0;
    }
    /** @type {string[]} Initial [[]]; nur weitere Stapel hinzufügen, nie entfernen. */ (
      stapel[stapel.length - 1]
    ).push(oid);
    summe += g;
  }
  for (const teil of stapel) {
    const r = runGit(['-C', root, 'cat-file', '--batch'], {
      input: `${teil.join('\n')}\n`,
      nurRoh: true,
    });
    if (r.status !== 0) return null;
    const buf = r.raw;
    let pos = 0;
    for (const oid of teil) {
      const nl = buf.indexOf(0x0a, pos);
      if (nl < 0) return null;
      const kopf = buf.subarray(pos, nl).toString('utf8').split(' ');
      if (kopf.length !== 3 || kopf[1] !== 'blob' || kopf[0] !== oid) return null;
      const groesse = Number(kopf[2]);
      out.set(oid, buf.subarray(nl + 1, nl + 1 + groesse));
      pos = nl + 1 + groesse + 1;
    }
  }
  return out;
}

/**
 * Grössen von Blobs per `cat-file --batch-check` (ohne Inhalte zu laden, P44l).
 * @param {string} root
 * @param {string[]} oids
 * @returns {Map<string, number> | null} null, wenn git scheitert oder ein Objekt fehlt bzw. kein Blob ist
 */
export function blobGroessen(root, oids) {
  /** @type {Map<string, number>} */
  const out = new Map();
  const eindeutig = [...new Set(oids)];
  if (eindeutig.length === 0) return out;
  const r = runGit(['-C', root, 'cat-file', '--batch-check'], {
    input: `${eindeutig.join('\n')}\n`,
  });
  if (r.status !== 0) return null;
  const zeilen = r.stdout.split('\n');
  for (const [i, oid] of eindeutig.entries()) {
    const kopf = (zeilen[i] ?? '').split(' ');
    if (kopf.length !== 3 || kopf[1] !== 'blob' || kopf[0] !== oid) return null;
    out.set(oid, Number(kopf[2]));
  }
  return out;
}

/**
 * Tatsächlicher Pfad (Gross/Klein, Kurznamen, Verknüpfungen) eines existierenden Pfads,
 * sonst der aufgelöste Pfad unverändert.
 * @param {string} p
 */
export function realPath(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return resolve(p);
  }
}

/**
 * Aktueller Zweig. Bei losgelöstem HEAD der Zweig eines laufenden Rebase (P16), aber nur, wenn
 * `head-name` mit `refs/heads/` beginnt (P28; z.B. «detached HEAD» zählt nicht); sonst leer.
 * @param {string} root
 */
export function currentBranch(root) {
  const r = runGit(['-C', root, 'symbolic-ref', '--short', '-q', 'HEAD']);
  if (r.status === 0 && r.stdout.trim() !== '') return r.stdout.trim();
  const gd = runGit(['-C', root, 'rev-parse', '--path-format=absolute', '--git-dir']);
  if (gd.status !== 0) return '';
  const gitDir = gd.stdout.trim();
  for (const sub of ['rebase-merge', 'rebase-apply']) {
    const file = join(gitDir, sub, 'head-name');
    if (!existsSync(file)) continue;
    let wert = '';
    try {
      wert = readFileSync(file, 'utf8').trim();
    } catch {
      return '';
    }
    return wert.startsWith('refs/heads/') ? wert.slice('refs/heads/'.length) : '';
  }
  return '';
}

/**
 * Zweigfilter nach H0 P9 und AE-004 §3: `wap-planer`, `wap-codex` oder Präfix `wap/`.
 * @param {string} branch
 */
export function isWapBranch(branch) {
  return branch === 'wap-planer' || branch === 'wap-codex' || branch.startsWith('wap/');
}

/**
 * SHA-256 über die Rohbytes; einzige Normalisierung 0x0D 0x0A -> 0x0A (Klausel 1, P1).
 * @param {Buffer} bytes
 */
export function sha256Lf(bytes) {
  const out = Buffer.allocUnsafe(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) continue;
    out[n++] = /** @type {number} i<bytes.length im unmittelbar umgebenden for. */ (bytes[i]);
  }
  return createHash('sha256').update(out.subarray(0, n)).digest('hex');
}

/**
 * Pfad relativ zur Worktree-Wurzel mit `/`; null, wenn ausserhalb.
 * @param {string} root
 * @param {string} abs
 */
export function relInside(root, abs) {
  const rel = relative(root, abs);
  if (rel === '' || isAbsolute(rel)) return null;
  const norm = rel.split('\\').join('/');
  if (norm === '..' || norm.startsWith('../')) return null;
  return norm;
}

/**
 * Prüft den Inhalt einer test-lock.json.
 * @param {string} text
 * @returns {{ kind: 'ungueltig', grund: string } | { kind: 'ok', files: Record<string, string> }}
 */
export function parseLock(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'ungueltig', grund: `${LOCK_REL} ist kein gültiges JSON` };
  }
  if (data === null || typeof data !== 'object' || data.version !== 1) {
    return { kind: 'ungueltig', grund: `${LOCK_REL}: «version» muss 1 sein` };
  }
  const files = data.files;
  if (files === null || typeof files !== 'object' || Array.isArray(files)) {
    return { kind: 'ungueltig', grund: `${LOCK_REL}: «files» fehlt oder ist kein Objekt` };
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(files)) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
      return { kind: 'ungueltig', grund: `${LOCK_REL}: ungültiger Hash für ${zeigePfad(key)}` };
    }
    out[key] = value;
  }
  return { kind: 'ok', files: out };
}

/**
 * Liest test-lock.json einer Worktree-Wurzel.
 * @param {string} root
 * @returns {{ kind: 'fehlt' } | { kind: 'ungueltig', grund: string } | { kind: 'ok', files: Record<string, string> }}
 */
export function readLock(root) {
  const file = join(root, ...LOCK_REL.split('/'));
  if (!existsSync(file)) return { kind: 'fehlt' };
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { kind: 'ungueltig', grund: `${LOCK_REL} ist nicht lesbar` };
  }
  return parseLock(text);
}

/**
 * Inhalt einer Datei in einem git-Stand (`<ref>:<pfad>` bzw. `:<pfad>` für den Index).
 * @param {string} root
 * @param {string} spec
 * @returns {Buffer | null} null, wenn der Pfad in diesem Stand fehlt
 */
export function gitBlob(root, spec) {
  const r = runGit(['show', spec], { cwd: root });
  return r.status === 0 ? r.raw : null;
}

/**
 * Serialisiert test-lock.json im Vertragsformat mit sortierten Einträgen (Klausel 1).
 * @param {Record<string, string>} files
 */
export function serializeLock(files) {
  /** @type {Record<string, string>} */
  const sorted = {};
  for (const key of Object.keys(files).sort())
    sorted[key] = /** @type {string} key stammt unmittelbar aus Object.keys(files). */ (files[key]);
  return `${JSON.stringify({ version: 1, files: sorted }, null, 2)}\n`;
}

/** Text der Titelzeile ohne Markdown-Präfix. */
const TITEL_TEXT = PROTOKOLL_TITEL.replace(/^#+\s*/, '');

/**
 * @typedef {{ text: string, nr: number }} Protokollzeile
 * @typedef {'fehlt' | 'titel-mehrfach' | 'kommentar-offen' | 'kommentar' | 'tabelle-fehlt' | 'ausserhalb'} Fehlerart
 * @typedef {{ art: Fehlerart, meldung: string }} Protokollfehler
 * @typedef {{ fehler: Protokollfehler[], rows: Protokollzeile[], ende: number, abschnitt: string[] }} Protokollanalyse
 * @typedef {{ ok: true, rows: Protokollzeile[], ende: number } | { ok: false, meldung: string }} Protokollabschnitt
 */

/**
 * @typedef {{ zeile: number, danach: number, ebene2: boolean, kommentarOffen: boolean }} Titel
 */

/**
 * Titelzeilen «Protokoll `test-lock.json`» in einem einzigen Durchgang (P38, P43 b, P43 d, P43 e):
 * Zeichen der Kategorie Cf werden entfernt; gezählt werden ATX-Überschriften jeder Ebene und
 * Setext-Überschriften (Zeile, gefolgt von `===` oder `---`); `ebene2` markiert die allein
 * massgebende ATX-Überschrift der Ebene `##`. Im selben Durchgang wird der Kommentarzustand
 * geführt: `kommentarOffen` heisst, vor dieser Titelzeile ist ein `<!--` ohne folgendes `-->` offen.
 * @param {string[]} lines
 * @returns {Titel[]}
 */
function titelZeilen(lines) {
  /** @type {Titel[]} */
  const out = [];
  let offen = false;
  for (let i = 0; i < lines.length; i++) {
    const atx = ueberschrift(
      /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (lines[i]),
    );
    if (atx !== null && atx.text === TITEL_TEXT) {
      out.push({ zeile: i, danach: i + 1, ebene2: atx.ebene === 2, kommentarOffen: offen });
    } else if (
      atx === null &&
      setextText(
        /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (lines[i]),
      ) === TITEL_TEXT &&
      i + 1 < lines.length &&
      istUnterstrich(
        /** @type {string} Unmittelbar vorher i+1<lines.length geprüft. */ (lines[i + 1]),
      )
    ) {
      out.push({ zeile: i, danach: i + 2, ebene2: false, kommentarOffen: offen });
    }
    // Kommentarzustand nach dieser Zeile (HTML-Kommentare sind nicht verschachtelt).
    const zeile = /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (
      lines[i]
    );
    let pos = 0;
    for (;;) {
      if (offen) {
        const zu = zeile.indexOf('-->', pos);
        if (zu < 0) break;
        offen = false;
        pos = zu + 3;
      } else {
        const auf = zeile.indexOf('<!--', pos);
        if (auf < 0) break;
        offen = true;
        pos = auf + 4;
      }
    }
  }
  return out;
}

/**
 * Index der ersten Überschrift der Ebene `#` oder `##` ab `von` (Ende des Abschnitts, P38a).
 * @param {string[]} lines
 * @param {number} von
 */
function abschnittsEnde(lines, von) {
  for (let i = von; i < lines.length; i++) {
    const u = ueberschrift(
      /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (lines[i]),
    );
    if (u !== null && u.ebene <= 2) return i;
  }
  return lines.length;
}

/** @param {string} c */
function istLeer(c) {
  return c === ' ' || c === '\t';
}

/**
 * Anzahl führender Leerzeichen; -1 bei Tabulator in der Einrückung (P43f: keine Überschrift).
 * @param {string} s
 */
function einrueckung(s) {
  let i = 0;
  while (i < s.length && s[i] === ' ') i++;
  return s[i] === '\t' ? -1 : i;
}

/**
 * ATX-Überschrift nach CommonMark, linear in der Zeilenlänge (P43f, P43g): höchstens 3 Leerzeichen
 * Einrückung, 1–6 `#`, danach Leerraum oder Zeilenende; schliessende `#` werden ohne Backtracking
 * entfernt. Zeichen der Kategorie Cf werden vorher entfernt (P43 b).
 * @param {string} zeile
 * @returns {{ ebene: number, text: string } | null}
 */
function ueberschrift(zeile) {
  const s = zeile.replace(/\p{Cf}/gu, '');
  const ein = einrueckung(s);
  if (ein < 0 || ein > 3) return null;
  let j = ein;
  while (j < s.length && s[j] === '#') j++;
  const ebene = j - ein;
  if (ebene < 1 || ebene > 6) return null;
  if (
    j < s.length &&
    !istLeer(/** @type {string} j<s.length im linken Kurzschlussoperand. */ (s[j]))
  )
    return null;
  let a = j;
  while (
    a < s.length &&
    istLeer(/** @type {string} a<s.length im linken Kurzschlussoperand. */ (s[a]))
  )
    a++;
  let e = s.length;
  while (e > a && istLeer(/** @type {string} e>a>=0 und e<=s.length. */ (s[e - 1]))) e--;
  let h = e;
  while (h > a && s[h - 1] === '#') h--;
  if (
    h < e &&
    (h === a || istLeer(/** @type {string} Nur nach h!==a, also h>a>=0. */ (s[h - 1])))
  ) {
    e = h;
    while (e > a && istLeer(/** @type {string} e>a>=0 und e<=s.length. */ (s[e - 1]))) e--;
  }
  return { ebene, text: s.slice(a, e) };
}

/**
 * Text einer möglichen Setext-Überschriftszeile (höchstens 3 Leerzeichen Einrückung, P43f).
 * @param {string} zeile
 * @returns {string | null}
 */
function setextText(zeile) {
  const s = zeile.replace(/\p{Cf}/gu, '');
  const ein = einrueckung(s);
  if (ein < 0 || ein > 3) return null;
  return s.trim();
}

/**
 * Setext-Unterstreichung `===` bzw. `---` (höchstens 3 Leerzeichen Einrückung), linear.
 * @param {string} zeile
 */
function istUnterstrich(zeile) {
  const s = zeile.replace(/\p{Cf}/gu, '');
  const ein = einrueckung(s);
  if (ein < 0 || ein > 3) return false;
  const zeichen = s[ein];
  if (zeichen !== '=' && zeichen !== '-') return false;
  let i = ein;
  while (i < s.length && s[i] === zeichen) i++;
  while (
    i < s.length &&
    istLeer(/** @type {string} i<s.length im linken Kurzschlussoperand. */ (s[i]))
  )
    i++;
  return i === s.length;
}

/**
 * Analysiert den Protokollabschnitt in FINDINGS.md (P37, P38, P38a, P42b, P43) und liefert die
 * Verstösse strukturiert (P42):
 * - genau eine Titelzeile (Cf entfernt, Setext mitgezählt);
 * - an keiner Titelzeile ein offener HTML-Kommentar (P43 a), im Abschnitt kein `<!--`;
 * - der Abschnitt reicht bis vor die nächste Überschrift der Ebene `#` oder `##` bzw. ans Dateiende;
 * - die Tabelle ist der Block aus Kopf-, Trenn- und unmittelbar folgenden `|`-Zeilen direkt nach
 *   dem (ersten) Titel; jede weitere `|`-Zeile im Abschnitt ist ein Verstoss.
 * `rows` und `ende` stammen aus dem Block nach der ersten Titelzeile, auch wenn Verstösse bestehen
 * (P42, P42b a). `abschnitt` sind die Zeilen vom ersten Titel bis zum Ende des letzten
 * Titelabschnitts (Vergleich P42a). Zeilennummern ab 1 (P34a).
 * @param {string} text Inhalt von FINDINGS.md
 * @returns {Protokollanalyse}
 */
export function analysiereProtokoll(text) {
  const lines = text.split(/\r?\n/);
  const titel = titelZeilen(lines);
  /** @type {Protokollfehler[]} */
  const fehler = [];
  // P43 d: massgebend ist nur eine ATX-Überschrift der Ebene `##`.
  const massgebend = titel.find((t) => t.ebene2);
  if (massgebend === undefined) {
    fehler.push({
      art: 'fehlt',
      meldung:
        titel.length === 0
          ? `Abschnitt «${TITEL_TEXT}» fehlt in ${FINDINGS_REL}`
          : `Abschnitt «${TITEL_TEXT}» fehlt in ${FINDINGS_REL}: keine Überschrift der Ebene ## ` +
            `(Titel in anderer Form auf Zeile ${(/** @type {Titel} Nichtleere Titelliste durch length-Zweig oder gefundenen massgebenden Titel. */ (titel[0])).zeile + 1})`,
    });
    return { fehler, rows: [], ende: -1, abschnitt: [] };
  }
  if (titel.length > 1) {
    const liste = titel.slice(0, 5).map((t) => t.zeile + 1);
    fehler.push({
      art: 'titel-mehrfach',
      meldung:
        `${FINDINGS_REL} enthält ${titel.length} Titelzeilen «${TITEL_TEXT}» ` +
        `(Zeilen ${liste.join(', ')}${titel.length > 5 ? ', …' : ''}); erlaubt ist genau eine`,
    });
  }
  const offenAn = titel.find((t) => t.kommentarOffen);
  if (offenAn !== undefined) {
    fehler.push({
      art: 'kommentar-offen',
      meldung: `HTML-Kommentar an der Titelzeile offen: ${FINDINGS_REL} Zeile ${offenAn.zeile + 1}`,
    });
  }
  const erster = massgebend;
  const schluss = abschnittsEnde(lines, erster.danach);
  for (let i = erster.danach; i < schluss; i++) {
    if (
      /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (
        lines[i]
      ).includes('<!--')
    ) {
      fehler.push({
        art: 'kommentar',
        meldung: `HTML-Kommentar im Protokollabschnitt: ${FINDINGS_REL} Zeile ${i + 1} (nicht erlaubt)`,
      });
      break;
    }
  }
  const vonZeile = Math.min(
    /** @type {Titel} Nichtleere Titelliste durch length-Zweig oder gefundenen massgebenden Titel. */ (
      titel[0]
    ).zeile,
    erster.zeile,
  );
  const letzter = /** @type {Titel} massgebender Titel existiert, daher Liste nichtleer. */ (
    titel[titel.length - 1]
  );
  const abschnitt = lines.slice(vonZeile, abschnittsEnde(lines, Math.max(letzter.danach, schluss)));

  let kopf = erster.danach;
  while (
    kopf < schluss &&
    /** @type {string} kopf<schluss<=lines.length oder vorheriger Abbruch kopf+1>=schluss. */ (
      lines[kopf]
    ).trim() === ''
  )
    kopf++;
  if (
    kopf + 1 >= schluss ||
    !(
      /** @type {string} kopf<schluss<=lines.length oder vorheriger Abbruch kopf+1>=schluss. */ (
        lines[kopf]
      ).startsWith('|')
    ) ||
    !/^\|\s*:?-{3,}/.test(
      /** @type {string} Nur nach negativem kopf+1>=schluss-Kurzschlussoperand. */ (
        lines[kopf + 1]
      ),
    )
  ) {
    fehler.push({
      art: 'tabelle-fehlt',
      meldung: `Protokoll-Tabelle fehlt direkt unter «${TITEL_TEXT}» in ${FINDINGS_REL}`,
    });
    return { fehler, rows: [], ende: -1, abschnitt };
  }
  /** @type {Protokollzeile[]} */
  const rows = [];
  let ende = kopf + 1;
  while (
    ende + 1 < schluss &&
    /** @type {string} ende+1<schluss im linken Kurzschlussoperand. */ (lines[ende + 1]).startsWith(
      '|',
    )
  ) {
    ende++;
    rows.push({
      text: /** @type {string} Gerade im zuvor gebundenen while erhöht; ende<schluss. */ (
        lines[ende]
      ).trimEnd(),
      nr: ende + 1,
    });
  }
  for (let i = ende + 1; i < schluss; i++) {
    if (
      /** @type {string} i innerhalb der umgebenden begrenzten Zeilenschleife. */ (lines[i])
        .trimStart()
        .startsWith('|')
    ) {
      fehler.push({
        art: 'ausserhalb',
        meldung: `Zeile ausserhalb der Protokoll-Tabelle: ${FINDINGS_REL} Zeile ${i + 1}`,
      });
      break;
    }
  }
  return { fehler, rows, ende, abschnitt };
}

/**
 * Strenge Abgrenzung für `lock-update` (P37a, P38): gültig nur ohne jeden Verstoss.
 * @param {string} text Inhalt von FINDINGS.md
 * @returns {Protokollabschnitt}
 */
export function protokollAbschnitt(text) {
  const a = analysiereProtokoll(text);
  if (a.fehler.length > 0)
    return {
      ok: false,
      meldung: /** @type {Protokollfehler} Ausschliesslich im fehler.length>0-Zweig. */ (
        a.fehler[0]
      ).meldung,
    };
  return { ok: true, rows: a.rows, ende: a.ende };
}

/**
 * Pfade aus der Spalte «Pfade» einer Protokollzeile.
 * @param {string} row
 */
export function pfadeAusZeile(row) {
  const cells = row.split('|');
  const spalte = cells[3] ?? '';
  return spalte
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '' && p !== '–');
}

/**
 * Pfade, deren Sperre sich zwischen zwei Ständen unterscheidet (neu, entfernt, Hash geändert).
 * @param {Record<string, string>} alt
 * @param {Record<string, string>} neu
 */
export function lockAbweichungen(alt, neu) {
  const out = new Set();
  for (const [k, v] of Object.entries(neu)) if (alt[k] !== v) out.add(k);
  for (const k of Object.keys(alt)) if (!(k in neu)) out.add(k);
  return [...out].sort();
}

/**
 * P27, P14, P42–P42c: Das Protokoll ist nur anhängbar – alle alten Zeilen stehen unverändert und
 * in gleicher Reihenfolge am Anfang der Tabelle. Jede Abweichung der Sperrdatei gegenüber dem
 * Vergleichsstand muss durch angehängte Zeilen belegt sein, die zusammen genau die abweichenden
 * Pfade nennen.
 *
 * Verstösst der Vergleichsstand gegen P37/P38, ist das nur ein Hinweis (P42). Als alte Zeilen gilt
 * dann der Block nach seiner ersten Titelzeile (P42b a). Der neue Stand muss gültig sein, ausser
 * die Sperrdatei ist unverändert und der Protokollabschnitt inhaltlich gleich wie im
 * Vergleichsstand (P42a); ein geänderter Lock verlangt immer einen gültigen neuen Stand (P42b b,
 * P42c). Die Unterscheidung erfolgt über die strukturierten Fehlerarten.
 * @param {Record<string, string>} altLock
 * @param {Record<string, string>} neuLock
 * @param {string} altFindings
 * @param {string} neuFindings
 * @param {unknown} [kontext] Frisch gebundener lock-check-Vergleich; kein Kontext im Commit-Hook.
 * @returns {{ fehler: string[], hinweise: string[] }}
 */
export function protokollPruefung(altLock, neuLock, altFindings, neuFindings, kontext) {
  const abweichend = lockAbweichungen(altLock, neuLock);
  const lockGeaendert = abweichend.length > 0;
  const altAnalyse = altFindings === '' ? null : analysiereProtokoll(altFindings);
  // Ein fehlender Abschnitt im Vergleichsstand bedeutet nur «keine alten Zeilen».
  const altVerstoesse = (altAnalyse?.fehler ?? []).filter((f) => f.art !== 'fehlt');
  /** @type {string[]} */
  const hinweise = altVerstoesse.map((f) => `Hinweis zum Vergleichsstand: ${f.meldung}`);
  const alt = altAnalyse?.rows ?? [];

  /** @type {Protokollzeile[]} */
  let neu = [];
  if (neuFindings !== '' || alt.length > 0 || lockGeaendert) {
    const n = analysiereProtokoll(neuFindings);
    if (n.fehler.length > 0) {
      const gleich =
        altAnalyse !== null &&
        altVerstoesse.length > 0 &&
        n.abschnitt.length === altAnalyse.abschnitt.length &&
        n.abschnitt.every((z, i) => z === altAnalyse.abschnitt[i]);
      // P42d: jede Fehlerart des neuen Stands muss schon im Vergleichsstand vorkommen.
      const nurBekannte = n.fehler.every((f) => altVerstoesse.some((a) => a.art === f.art));
      if (!lockGeaendert && gleich && nurBekannte) {
        // P42a: bestehender Verstoss, im neuen Stand inhaltlich unverändert.
        return { fehler: [], hinweise };
      }
      return { fehler: n.fehler.map((f) => f.meldung), hinweise };
    }
    neu = n.rows;
  }
  /** @type {string[]} */
  const meldungen = [];
  const bruch = alt.findIndex((row, i) => neu[i]?.text !== row.text);
  const folge = bestaetigteRueckmergeFolge(altLock, neuLock, altFindings, neuFindings, kontext);
  const rueckmerge = folge?.gueltig === true;
  if (folge?.gueltig === false) {
    meldungen.push(
      `Protokollzeile geändert oder entfernt: ${FINDINGS_REL} ` +
        '(bestehende Paket-/Mergefolge unverändert lassen)' +
        (folge.pfade.length === 0 ? '' : `: ${folge.pfade.map(zeigePfad).join(', ')}`),
    );
  }
  if (bruch >= 0 && !rueckmerge) {
    meldungen.push(
      `Protokollzeile geändert oder entfernt: ${FINDINGS_REL} Zeile ${/** @type {Protokollzeile} bruch ist nichtnegativer findIndex derselben unveränderten Liste. */ (alt[bruch]).nr} ` +
        '(das Protokoll ist nur anhängbar; alte Zeilen unverändert lassen)',
    );
  }
  // Ohne Abweichung der Sperrdatei verlangt P14 nichts.
  if (!lockGeaendert) return { fehler: meldungen, hinweise };
  const genannt = new Set();
  // Pflichtprüfung nur über die angehängten Zeilen (P27).
  const neueZeilen = rueckmerge
    ? neueVorkommen(
        alt.map((r) => r.text),
        neu.map((r) => r.text),
      )
    : neu.slice(bruch >= 0 ? neu.length : alt.length).map((r) => r.text);
  for (const row of neueZeilen) {
    for (const p of pfadeAusZeile(row)) genannt.add(p);
  }
  for (const p of abweichend) {
    if (!genannt.has(p)) meldungen.push(`nicht protokolliert: ${zeigePfad(p)}`);
  }
  for (const p of [...genannt].sort()) {
    if (!abweichend.includes(p)) {
      meldungen.push(`protokolliert, aber ohne Abweichung: ${zeigePfad(p)}`);
    }
  }
  return { fehler: meldungen, hinweise };
}

/** @param {string[]} alt @param {string[]} neu */
function neueVorkommen(alt, neu) {
  /** @type {Map<string, number>} */
  const rest = new Map();
  for (const row of alt) rest.set(row, (rest.get(row) ?? 0) + 1);
  return neu.filter((row) => {
    const n = rest.get(row) ?? 0;
    if (n === 0) return true;
    rest.set(row, n - 1);
    return false;
  });
}

/** @param {string[]} alt @param {string[]} neu */
function istPraefix(alt, neu) {
  return alt.every((row, i) => neu[i] === row);
}

/** @param {string[]} alt @param {string[]} neu */
function istTeilfolge(alt, neu) {
  let i = 0;
  for (const row of neu) if (row === alt[i]) i++;
  return i === alt.length;
}

/**
 * Ausschliesslich lock-check kann mit frisch gebundenem Kontext einen echten Rückmerge
 * nachweisen. Fehler hier gewähren keine Ausnahme; der öffentliche Vergleich bleibt strikt.
 * @param {Record<string, string>} altLock
 * @param {Record<string, string>} neuLock
 * @param {string} altFindings
 * @param {string} neuFindings
 * @param {unknown} kontext
 * @returns {{gueltig: true} | {gueltig: false, pfade: string[]} | null}
 */
function bestaetigteRueckmergeFolge(altLock, neuLock, altFindings, neuFindings, kontext) {
  let integrationsankerBestaetigt = false;
  try {
    if (kontext === null || typeof kontext !== 'object') return null;
    const k =
      /** @type {{root?: unknown, modus?: unknown, basis?: {id?: unknown, voll?: unknown}, ziel?: {id?: unknown, voll?: unknown}}} */ (
        kontext
      );
    if (
      typeof k.root !== 'string' ||
      (k.modus !== 'arbeitsbaum' && k.modus !== 'objekt') ||
      typeof k.basis?.id !== 'string' ||
      typeof k.ziel?.id !== 'string' ||
      typeof k.ziel.voll !== 'string' ||
      !/^refs\/heads\/wap\/.+/.test(k.ziel.voll) ||
      !(k.basis.voll === null || typeof k.basis.voll === 'string')
    )
      return null;
    const basisId = k.basis.id;
    const basisRef = k.basis.voll;
    const zielId = k.ziel.id;
    const zielRef = k.ziel.voll;
    const root = realPath(k.root);
    // Keine fremde GIT_* Umgebung darf die Wurzel, Objekte oder Historie ersetzen.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')),
    );
    env.GIT_NO_REPLACE_OBJECTS = '1';
    const git = (/** @type {string[]} */ args) => {
      const r = spawnSync('git', ['-C', root, ...args], {
        env,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 1024,
        windowsHide: true,
      });
      return r.status === 0 ? r.stdout : null;
    };
    const top = git(['rev-parse', '--show-toplevel']);
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (
      top === null ||
      relative(root, realPath(top.trim())) !== '' ||
      common === null ||
      !existsSync(realPath(common.trim())) ||
      existsSync(join(common.trim(), 'info', 'grafts')) ||
      git(['rev-parse', '--is-shallow-repository'])?.trim() !== 'false'
    )
      return null;
    const id = (/** @type {string} */ ref) => {
      if (ref.startsWith('-') || /[\s:]/.test(ref)) return null;
      const r = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])?.trim();
      return r !== undefined && /^[0-9a-f]{40,64}$/.test(r) ? r : null;
    };
    const refs = new Set((git(['for-each-ref', '--format=%(refname)']) ?? '').split('\n'));
    if (!refs.has(zielRef) || id(zielRef) !== zielId || id(zielId) !== zielId) return null;
    if (id(basisId) !== basisId) return null;
    if (basisRef !== null && (!refs.has(basisRef) || id(basisRef) !== basisId)) return null;
    if (
      k.modus === 'arbeitsbaum' &&
      (git(['symbolic-ref', '-q', 'HEAD'])?.trim() !== zielRef || id('HEAD') !== zielId)
    )
      return null;
    const blob = (/** @type {string} */ commit, /** @type {string} */ path) => {
      const text = git(['show', `${commit}:${path}`]);
      if (text !== null) return text;
      // Ein wirklich fehlender Pfad darf wie bisher leer sein; ein Git-/Objektfehler
      // ist keine leere Protokollfolge und gewährt keine Ausnahme.
      const entry = git(['ls-tree', '-z', commit, '--', path]);
      if (entry === null || entry !== '') throw new Error('Objektnachweis nicht prüfbar');
      return null;
    };
    const gleichLock = (
      /** @type {string | null} */ text,
      /** @type {Record<string,string>} */ lock,
    ) => {
      if (text === null) return Object.keys(lock).length === 0;
      const parsed = parseLock(text);
      return parsed.kind === 'ok' && lockAbweichungen(parsed.files, lock).length === 0;
    };
    if (
      !gleichLock(blob(basisId, LOCK_REL), altLock) ||
      (blob(basisId, FINDINGS_REL) ?? '') !== altFindings
    )
      return null;
    const neuLockText =
      k.modus === 'objekt' ? blob(zielId, LOCK_REL) : readFileSync(join(root, LOCK_REL), 'utf8');
    const neuText =
      k.modus === 'objekt'
        ? blob(zielId, FINDINGS_REL)
        : readFileSync(join(root, FINDINGS_REL), 'utf8');
    if (!gleichLock(neuLockText, neuLock) || (neuText ?? '') !== neuFindings) return null;
    const ancestor = (/** @type {string} */ a, /** @type {string} */ b) =>
      git(['merge-base', '--is-ancestor', a, b]) !== null;
    const quellRefs = ['refs/heads/wap-codex', 'refs/heads/wap-planer'].filter((ref) =>
      refs.has(ref),
    );
    const tips = quellRefs.map((ref) => id(ref)).filter((v) => v !== null);
    const quellen = tips.filter((tip) => ancestor(basisId, tip));
    if (quellen.length === 0) return null;
    const graph = git(['rev-list', '--first-parent', '--parents', zielId]);
    if (graph === null) return null;
    const commits = graph
      .trim()
      .split('\n')
      .map((row) => row.split(' '));
    // Ein zweiter Rückmerge kann den früheren zweiten Elternteil als Mergebasis haben.
    // Als Prüfanker dient ein vorheriger echter Rückmerge, dessen gemeinsamer Stand
    // auf der Paket-Elternlinie liegt; alle folgenden Commits werden dennoch geprüft.
    let bis = -1;
    for (const c of commits) {
      const primary = c[1];
      const incoming = c[2];
      if (
        c.length !== 3 ||
        primary === undefined ||
        incoming === undefined ||
        !quellen.some((tip) => ancestor(incoming, tip)) ||
        ancestor(primary, incoming)
      )
        continue;
      const gemeinsam = git(['merge-base', '--all', primary, incoming])?.trim().split('\n');
      if (gemeinsam === undefined) return null;
      if (gemeinsam.length !== 1) continue;
      const candidate = commits.findIndex((row) => row[0] === gemeinsam[0]);
      if (candidate >= 0) {
        bis = candidate;
        break;
      }
    }
    if (bis < 0) return null;
    integrationsankerBestaetigt = true;
    /** @type {Map<string, string[]>} */
    const cache = new Map();
    /** @param {string} commit @returns {string[] | null} */
    const rows = (commit) => {
      const saved = cache.get(commit);
      if (saved !== undefined) return saved;
      const text = blob(commit, FINDINGS_REL);
      if (text === null) {
        cache.set(commit, []);
        return [];
      }
      const analysed = analysiereProtokoll(text);
      // P42 schützt auch bei historisch ungültiger Syntax den ersten analysierten Block.
      const result = analysed.rows.map((row) => row.text);
      cache.set(commit, result);
      return result;
    };
    /** @param {string} commit @returns {Record<string,string> | null} */
    const lockAt = (commit) => {
      const text = blob(commit, LOCK_REL);
      if (text === null) return {};
      const parsed = parseLock(text);
      return parsed.kind === 'ok' ? parsed.files : null;
    };
    /** @param {string[]} before @param {string[]} after */
    const verletzt = (before, after) => ({
      gueltig: /** @type {false} */ (false),
      pfade: [
        ...new Set(
          [...neueVorkommen(before, after), ...neueVorkommen(after, before)].flatMap(pfadeAusZeile),
        ),
      ].sort(),
    });
    /** @param {string[]} before @param {string[]} after */
    const verdoppelt = (before, after) =>
      neueVorkommen(before, after).some((row) => before.includes(row));
    for (const c of commits.slice(0, bis).reverse()) {
      if (c.length < 2) return null;
      const child = c[0];
      const primary = c[1];
      const secondary = c[2];
      if (child === undefined || primary === undefined) return null;
      const before = rows(primary);
      const after = rows(child);
      if (before === null || after === null) return null;
      if (c.length === 2 || c.length > 3) {
        // Weitere Eltern eröffnen keine Ausnahme vom geschützten Primärpräfix.
        if (!istPraefix(before, after) || verdoppelt(before, after)) return verletzt(before, after);
      } else {
        if (secondary === undefined) return null;
        const incoming = rows(secondary);
        if (incoming === null) return null;
        if (!istTeilfolge(before, after) || !istTeilfolge(incoming, after))
          return verletzt([...before, ...incoming], after);
        if (!tips.some((tip) => ancestor(secondary, tip)) && !istPraefix(before, after))
          return verletzt(before, after);
        const bases = git(['merge-base', '--all', primary, secondary])?.trim().split('\n');
        if (bases === undefined) return verletzt(before, after);
        if (bases.length !== 1) {
          // Ohne eindeutige Mergebasis bleibt nur die strikte primäre Paketfolge.
          if (!istPraefix(before, after) || verdoppelt(before, after))
            return verletzt(before, after);
          continue;
        }
        const base = bases[0];
        if (base === undefined) return null;
        const shared = rows(base);
        if (shared === null) return null;
        const union = [...before, ...neueVorkommen(shared, incoming)];
        if (neueVorkommen(after, union).length > 0 || verdoppelt(union, after))
          return verletzt(union, after);
        const extras = neueVorkommen(union, after);
        if (extras.length > 0) {
          const a = lockAt(primary);
          const b = lockAt(secondary);
          const n = lockAt(child);
          if (a === null || b === null || n === null) return verletzt(union, after);
          const neuePfade = new Set(extras.flatMap(pfadeAusZeile));
          for (const p of neuePfade) if (n[p] === a[p]) return verletzt(union, after);
        }
      }
    }
    const headRows = rows(zielId);
    const targetRows = analysiereProtokoll(neuFindings).rows.map((row) => row.text);
    const basisRows = analysiereProtokoll(altFindings).rows.map((row) => row.text);
    if (headRows === null) return null;
    if (!istPraefix(headRows, targetRows) || verdoppelt(headRows, targetRows))
      return verletzt(headRows, targetRows);
    if (!istTeilfolge(basisRows, targetRows)) return verletzt(basisRows, targetRows);
    // Refs dürfen während des Nachweises nicht unbemerkt auf andere Objekte wechseln.
    if (
      id(zielRef) !== zielId ||
      (basisRef !== null && id(basisRef) !== basisId) ||
      quellRefs.some((ref, i) => id(ref) !== tips[i])
    )
      return null;
    return { gueltig: true };
  } catch {
    // Ein gebundener historischer Lesefehler darf die Paketfolge nicht neutralisieren.
    return integrationsankerBestaetigt ? { gueltig: false, pfade: [] } : null;
  }
}

/**
 * Fehler einer gescheiterten Transaktion. `nichtZurueckgesetzt` nennt Dateien, die nach dem
 * Fehler nicht auf den Ausgangsstand zurückgesetzt werden konnten, `tmpReste` Zwischendateien,
 * die nicht entfernt werden konnten (P33). Beide leer = alles auf dem Ausgangsstand.
 */
export class TransaktionsFehler extends Error {
  /**
   * @param {string[]} nichtZurueckgesetzt
   * @param {string[]} tmpReste
   */
  constructor(nichtZurueckgesetzt, tmpReste) {
    super('Transaktion gescheitert');
    this.nichtZurueckgesetzt = nichtZurueckgesetzt;
    this.tmpReste = tmpReste;
  }
}

/**
 * Ersetzt mehrere Dateien gemeinsam (P15, P25): zuerst alle Zwischendateien schreiben, dann
 * ersetzen. Scheitert ein Schritt, werden alle Dateien byteweise auf den Ausgangsstand
 * zurückgesetzt und alle Zwischendateien entfernt; danach folgt ein `TransaktionsFehler`, der
 * ehrlich nennt, was nicht zurückgesetzt bzw. entfernt werden konnte (P33).
 * @param {Array<{ file: string, content: string | Buffer, mode?: number }>} ziele
 */
export function writeTransaktion(ziele) {
  const stempel = `${process.pid}-${Date.now()}`;
  const plan = ziele.map((z, i) => ({
    ...z,
    tmp: join(dirname(z.file), `.${basename(z.file)}.${stempel}-${i}.wap-tmp`),
    alt: existsSync(z.file) ? readFileSync(z.file) : null,
    ersetzt: false,
  }));
  let gescheitert = false;
  try {
    for (const p of plan) {
      writeFileSync(p.tmp, p.content, p.mode === undefined ? undefined : { mode: p.mode });
    }
    for (const p of plan) {
      renameSync(p.tmp, p.file);
      p.ersetzt = true;
    }
  } catch {
    gescheitert = true;
  }
  /** @type {string[]} */
  const nichtZurueckgesetzt = [];
  if (gescheitert) {
    for (const p of plan) {
      if (!p.ersetzt) continue;
      try {
        if (p.alt === null) unlinkSync(p.file);
        else writeFileSync(p.file, p.alt);
      } catch {
        nichtZurueckgesetzt.push(p.file);
      }
    }
  }
  /** @type {string[]} */
  const tmpReste = [];
  for (const p of plan) {
    try {
      rmSync(p.tmp, { force: true });
    } catch {
      tmpReste.push(p.tmp);
    }
  }
  if (gescheitert) throw new TransaktionsFehler(nichtZurueckgesetzt, tmpReste);
}

/**
 * Meldung auf stderr (Fehler, Verstösse).
 * @param {string} text
 */
export function fehler(text) {
  process.stderr.write(`${text}\n`);
}

/**
 * Meldung auf stdout (Erfolg).
 * @param {string} text
 */
export function info(text) {
  process.stdout.write(`${text}\n`);
}

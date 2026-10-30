// F6 Typprüfung (R-H-14, ADR-010 §4.2, E12 c, AR0-44, AR0-54).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkTypes`, §6a.
// Suite-Prüfung: `tsc --noEmit -p tsconfig.json`, jede Meldung zählt. WAP-Prüfung:
// `tsc --noEmit -p tsconfig.wap.json`; gewertet werden nur Meldungen zu Dateien der WAP-Pfadmenge (die
// «include»-Muster von tsconfig.wap.json), ausser zu unveränderten Altmodulen aus legacy-modules.json.
// Folgezeilen einer Meldung (eingerückt) gehören zur vorangehenden Meldung (AR0-54).
// Aufruf: node scripts/wap-gate/typecheck.mjs [--root <verzeichnis>]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLock, sha256Lf, zeigePfad } from '../wap/lib/common.mjs';
import { testUmgebung } from './last.mjs';
import { LEGACY_REL, ladeLegacyListe, legacyUnchanged } from './lib/legacy.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe, starteNode, werkzeug } from './lib/prozess.mjs';
import { musterRegex } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ datei: string | null; code: string; text: string }} Meldung */

/**
 * Zerlegt die Ausgabe von `tsc --pretty false` in Meldungen.
 * @param {string} ausgabe
 * @returns {Meldung[]}
 */
export function meldungen(ausgabe) {
  /** @type {Meldung[]} */
  const out = [];
  for (const zeile of ausgabe.split(/\r?\n/)) {
    if (zeile.trim() === '') continue;
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(zeile);
    if (m !== null) {
      out.push({ datei: (m[1] ?? '').replace(/\\/g, '/'), code: m[4] ?? '', text: m[5] ?? '' });
      continue;
    }
    const g = /^error (TS\d+): (.*)$/.exec(zeile);
    if (g !== null) {
      out.push({ datei: null, code: g[1] ?? '', text: g[2] ?? '' });
      continue;
    }
    const letzte = out.at(-1);
    if (/^\s/.test(zeile) && letzte !== undefined) letzte.text += ` ${zeile.trim()}`;
    else out.push({ datei: null, code: '', text: zeile.trim() });
  }
  return out;
}

/**
 * Führt tsc für eine Konfiguration aus.
 * @param {string} root
 * @param {string} tsc
 * @param {string} konfig
 * @returns {Promise<{ meldungen: Meldung[]; fehler: string | null }>}
 */
async function tscLauf(root, tsc, konfig) {
  const r = await starteNode(tsc, ['--noEmit', '-p', konfig, '--pretty', 'false'], {
    cwd: root,
    env: testUmgebung(process.env, 'sonst'),
    timeoutMs: 600_000,
  });
  if (r.fehler !== null) return { meldungen: [], fehler: `tsc ${konfig}: ${r.fehler}` };
  const liste = meldungen(`${r.stdout}\n${r.stderr}`);
  if (r.status !== 0 && liste.length === 0) {
    return {
      meldungen: [],
      fehler: `tsc ${konfig} endete mit Exit ${String(r.status)} ohne Meldung`,
    };
  }
  return { meldungen: liste, fehler: null };
}

/**
 * Führt beide tsc-Läufe aus; wertet WAP-Meldungen nur für Dateien der WAP-Pfadmenge und verwirft Meldungen zu
 * Dateien aus legacy-modules.json, solange deren SHA-256 (LF) dem eingefrorenen Wert entspricht.
 * Fehlt die Liste oder ist sie unlesbar → roter Schritt mit Ursache.
 * @param {{ cwd: string }} opts
 * @returns {Promise<Schritt & { verworfen: { datei: string; anzahl: number }[] }>}
 */
export async function checkTypes(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt & { verworfen: { datei: string; anzahl: number }[] }}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F6-typen',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    verworfen: [],
  });
  const liste = ladeLegacyListe(join(root, ...LEGACY_REL.split('/')));
  if (!liste.ok) {
    return rotSchritt(liste.grund, `${LEGACY_REL} wiederherstellen (gesperrt, Entscheid E12 c)`);
  }
  const tsc = werkzeug(root, 'tsc');
  if (tsc === null) {
    return rotSchritt('TypeScript fehlt in node_modules', '«npm ci» ausführen und erneut starten');
  }
  for (const k of ['tsconfig.json', 'tsconfig.wap.json']) {
    if (!existsSync(join(root, k))) return rotSchritt(`${k} fehlt`, `${k} wiederherstellen`);
  }
  /** @type {RegExp[]} */
  let pfadmenge;
  try {
    const wap = /** @type {{ include?: unknown }} */ (
      JSON.parse(readFileSync(join(root, 'tsconfig.wap.json'), 'utf8'))
    );
    if (!Array.isArray(wap.include)) throw new Error('include fehlt');
    pfadmenge = wap.include.filter((x) => typeof x === 'string').map((x) => musterRegex(x));
  } catch {
    return rotSchritt(
      'tsconfig.wap.json ist ungültig (Feld «include»)',
      'tsconfig.wap.json korrigieren',
    );
  }
  const unveraendert = new Set(
    (await legacyUnchanged({ cwd: root })).filter((e) => e.unveraendert).map((e) => e.pfad),
  );
  // Gesperrte H0-Skripte unter scripts/wap/ (CR-E101-07): solange ihr SHA-256 (LF) dem Eintrag in
  // test-lock.json entspricht, gelten sie wie Altmodule; eine Änderung macht sie streng.
  const lock = readLock(root);
  if (lock.kind === 'ok') {
    for (const [pfad, hash] of Object.entries(lock.files)) {
      if (!pfad.startsWith('scripts/wap/')) continue;
      const abs = join(root, ...pfad.split('/'));
      if (existsSync(abs) && sha256Lf(readFileSync(abs)) === hash) unveraendert.add(pfad);
    }
  }
  const [suite, wap] = await Promise.all([
    tscLauf(root, tsc, 'tsconfig.json'),
    tscLauf(root, tsc, 'tsconfig.wap.json'),
  ]);
  if (suite.fehler !== null || wap.fehler !== null) {
    return rotSchritt(
      [suite.fehler, wap.fehler].filter((x) => x !== null).join('; '),
      'TypeScript-Installation prüfen («npm ci») und erneut starten',
    );
  }
  /** @type {Map<string, number>} */
  const verworfen = new Map();
  /** @type {Meldung[]} */
  const gewertet = [...suite.meldungen.map((m) => ({ ...m, text: `Suite: ${m.text}` }))];
  for (const m of wap.meldungen) {
    if (m.datei === null) {
      // TS18003: keine Eingabedateien – nichts zu prüfen.
      if (m.code !== 'TS18003') gewertet.push(m);
      continue;
    }
    const datei = m.datei;
    if (!pfadmenge.some((re) => re.test(datei))) continue;
    if (unveraendert.has(datei)) {
      verworfen.set(datei, (verworfen.get(datei) ?? 0) + 1);
      continue;
    }
    gewertet.push(m);
  }
  const verworfenListe = [...verworfen].map(([datei, anzahl]) => ({ datei, anzahl }));
  if (gewertet.length === 0) {
    return { id: 'F6-typen', ok: true, ms: Date.now() - beginn, verworfen: verworfenListe };
  }
  /** @type {Map<string, number>} */
  const jeDatei = new Map();
  for (const m of gewertet) {
    const k = m.datei ?? '(ohne Datei)';
    jeDatei.set(k, (jeDatei.get(k) ?? 0) + 1);
  }
  return {
    id: 'F6-typen',
    ok: false,
    ms: Date.now() - beginn,
    ursache: `${String(gewertet.length)} Typfehler in ${kurzeListe(
      [...jeDatei].map(([d, n]) => `${zeigePfad(d)} (${String(n)})`),
    )}`,
    naechsterSchritt: 'Typfehler beheben («npx tsc --noEmit -p tsconfig.wap.json --pretty false»)',
    details: { meldungen: gewertet.map((m) => ({ datei: m.datei, code: m.code })) },
    verworfen: verworfenListe,
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  if ((i >= 0 && args[i + 1] === undefined) || args.length > (i >= 0 ? 2 : 0)) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/typecheck.mjs [--root <verzeichnis>]');
    process.exitCode = 1;
  } else {
    const s = await checkTypes({ cwd: resolve(i >= 0 ? (args[i + 1] ?? '.') : '.') });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

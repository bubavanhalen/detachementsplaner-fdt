// Lizenztext eines gebündelten npm-Pakets (Prompt §7 Lizenzprüfung, ADR-010 §9, R-H-11, R-H-23, Q-031):
// die eigene LICENSE* des Pakets oder, nur ohne sie, ein geprüfter Eintrag der Ersatzliste
// tools/wap/licenses/npm-ersatz.json. Genutzt von scripts/wap-gate/einzeldatei.mjs (buildEinzeldatei),
// tools/build-offline.mjs und der Lizenzprüfung (checkBundledLicenses).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Lizenzen ohne LICENSE-Datei» Nr 2–4, 8.
// Meldungen nennen Pfade nur repo-relativ und nie Textinhalte. Die Funktion wirft nie.
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

/**
 * @typedef {{ ok: true; quelle: 'paket' | 'ersatz'; datei: string; text: string }
 *   | { ok: false; art: 'fehlt' | 'ersatz' | 'liste'; fehler: string }} NpmLizenzErgebnis
 */

/**
 * @typedef {object} ErsatzEintrag
 * @property {string} paket
 * @property {string} version
 * @property {string} lizenz
 * @property {string} datei
 * @property {string} herkunft
 * @property {string} entscheid
 */

/** Lizenzdatei eines npm-Pakets (wie scripts/wap-gate/einzeldatei.mjs). */
const NPM_LIZENZ = /^licen[sc]e(?:\..*)?$/i;

/** Repo-relativer Pfad der Ersatzliste (Notiz Nr 3 b). */
export const ERSATZ_LISTE = 'tools/wap/licenses/npm-ersatz.json';

/** Ordner der Ersatztexte, repo-relativ. */
const ERSATZ_ORDNER = 'tools/wap/licenses';

/** Erlaubter Ort eines Ersatztexts (Notiz Nr 3 c). */
const ERSATZ_DATEI = /^tools\/wap\/licenses\/[a-z0-9][a-z0-9._-]*\.txt$/;

/** Lizenzen, für die ein Ersatztext zulässig ist (Notiz Nr 3 c, ADR-010 §9); nur einzelne SPDX-IDs. */
const ERLAUBT = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD']);

/** Felder eines Eintrags (Notiz Nr 3 b). */
const FELDER = /** @type {const} */ ([
  'paket',
  'version',
  'lizenz',
  'datei',
  'herkunft',
  'entscheid',
]);

/** Meldung bei ungültiger Liste (Notiz Nr 4). */
const LISTE_UNGUELTIG = `Ersatz-Lizenzliste ungültig: ${ERSATZ_LISTE}`;

/**
 * @param {string} paket
 * @returns {NpmLizenzErgebnis}
 */
function fehlt(paket) {
  return { ok: false, art: 'fehlt', fehler: `Lizenzdatei fehlt: ${paket}` };
}

/**
 * @param {string} fehler
 * @returns {NpmLizenzErgebnis}
 */
function ersatzRot(fehler) {
  return { ok: false, art: 'ersatz', fehler };
}

/**
 * Pfad relativ zu `basis` mit «/».
 * @param {string} basis
 * @param {string} pfad
 * @returns {string}
 */
function relativMitSchraegstrich(basis, pfad) {
  return relative(basis, pfad).split(sep).join('/');
}

/**
 * Echter Pfad; null, wenn er nicht auflösbar ist.
 * @param {string} pfad
 * @returns {string | null}
 */
function echt(pfad) {
  try {
    return realpathSync.native(pfad);
  } catch {
    return null;
  }
}

/**
 * Liegt `pfad` unter `ordner` (nicht gleich, nicht darüber)?
 * @param {string} pfad
 * @param {string} ordner
 * @returns {boolean}
 */
function liegtIn(pfad, ordner) {
  const rel = relative(ordner, pfad);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Text einer Datei; null bei Lesefehler.
 * @param {string} datei
 * @returns {string | null}
 */
function lies(datei) {
  try {
    return readFileSync(datei, 'utf8');
  } catch {
    return null;
  }
}

/**
 * JSON-Objekt (kein Array, nicht null)?
 * @param {unknown} wert
 * @returns {wert is Record<string, unknown>}
 */
function istObjekt(wert) {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

/**
 * Eigene Lizenzdatei des Pakets (alphabetisch erste nach NPM_LIZENZ); null, wenn keine.
 * @param {string} ordner
 * @returns {string | null}
 */
function eigeneLizenz(ordner) {
  try {
    const name = readdirSync(ordner)
      .sort()
      .find((d) => NPM_LIZENZ.test(d));
    return name === undefined ? null : join(ordner, name);
  } catch {
    return null;
  }
}

/**
 * Liest und prüft die Ersatzliste (Notiz Nr 3 b). `null` = keine Liste vorhanden.
 * @param {string} cwd
 * @returns {{ gueltig: true; eintraege: ErsatzEintrag[] } | { gueltig: false } | null}
 */
function ersatzliste(cwd) {
  const datei = join(cwd, ...ERSATZ_LISTE.split('/'));
  /** @type {string} */
  let roh;
  try {
    roh = readFileSync(datei, 'utf8');
  } catch (e) {
    const code = istObjekt(e) ? e.code : undefined;
    return code === 'ENOENT' ? null : { gueltig: false };
  }
  /** @type {unknown} */
  let wurzel;
  try {
    wurzel = JSON.parse(roh);
  } catch {
    return { gueltig: false };
  }
  if (!istObjekt(wurzel) || wurzel.version !== 1 || !Array.isArray(wurzel.ersatz)) {
    return { gueltig: false };
  }
  /** @type {ErsatzEintrag[]} */
  const eintraege = [];
  const pakete = new Set();
  for (const e of /** @type {unknown[]} */ (wurzel.ersatz)) {
    if (!istObjekt(e)) return { gueltig: false };
    for (const feld of FELDER) {
      const wert = e[feld];
      if (typeof wert !== 'string' || wert.length === 0) return { gueltig: false };
    }
    const eintrag = /** @type {ErsatzEintrag} */ (
      Object.fromEntries(FELDER.map((feld) => [feld, e[feld]]))
    );
    if (pakete.has(eintrag.paket)) return { gueltig: false };
    pakete.add(eintrag.paket);
    eintraege.push(eintrag);
  }
  return { gueltig: true, eintraege };
}

/**
 * Prüft den Eintrag gegen package.json und liest den Ersatztext (Notiz Nr 3 c).
 * @param {string} cwd
 * @param {string} paket
 * @param {string} ordner
 * @param {ErsatzEintrag} eintrag
 * @returns {NpmLizenzErgebnis}
 */
function ersatz(cwd, paket, ordner, eintrag) {
  const pjRoh = lies(join(ordner, 'package.json'));
  /** @type {unknown} */
  let pj = null;
  if (pjRoh !== null) {
    try {
      pj = JSON.parse(pjRoh.replace(/^﻿/, ''));
    } catch {
      pj = null;
    }
  }
  const pkg = istObjekt(pj) ? pj : {};
  const lizenz = typeof pkg.license === 'string' ? pkg.license : null;
  if (lizenz === null || !ERLAUBT.has(lizenz) || 'licenses' in pkg) {
    const anzeige = lizenz ?? 'ohne Angabe';
    const zusatz = lizenz !== null && 'licenses' in pkg ? ', Feld licenses' : '';
    return ersatzRot(`Lizenz nicht erlaubt für Ersatztext: ${paket} (${anzeige}${zusatz})`);
  }
  if (lizenz !== eintrag.lizenz) {
    return ersatzRot(
      `Ersatz-Lizenz passt nicht: ${paket} (package.json ${lizenz}, Eintrag ${eintrag.lizenz})`,
    );
  }
  const installiert = typeof pkg.version === 'string' ? pkg.version : 'ohne Angabe';
  if (installiert !== eintrag.version) {
    return ersatzRot(
      `Ersatz-Lizenz für andere Version: ${paket} (installiert ${installiert}, Eintrag ${eintrag.version})`,
    );
  }
  const textFehlt = ersatzRot(`Ersatz-Lizenztext fehlt: ${paket}`);
  if (!ERSATZ_DATEI.test(eintrag.datei)) return textFehlt;
  const basis = echt(join(cwd, ...ERSATZ_ORDNER.split('/')));
  const datei = echt(join(cwd, ...eintrag.datei.split('/')));
  if (basis === null || datei === null || !liegtIn(datei, basis)) return textFehlt;
  try {
    if (!statSync(datei).isFile()) return textFehlt;
  } catch {
    return textFehlt;
  }
  const text = lies(datei);
  if (text === null || text.trim().length === 0) return textFehlt;
  if (!text.includes(eintrag.herkunft)) {
    return ersatzRot(`Ersatz-Lizenztext ohne Herkunftsvermerk: ${paket}`);
  }
  return { ok: true, quelle: 'ersatz', datei: eintrag.datei, text };
}

/**
 * Lizenztext eines gebündelten npm-Pakets (Notiz Nr 2, 3). Reihenfolge: (a) eigene LICENSE* in `ordner`,
 * dann wird die Liste nicht gelesen; (b) sonst ein Eintrag der Ersatzliste unter `cwd`; (c) der Eintrag gilt
 * nur mit erlaubter, passender Lizenz, gleicher Version und Ersatztext unter tools/wap/licenses/ mit
 * Herkunftsvermerk. `datei` ist relativ zu `cwd` mit «/». Wirft nie; ein Lesefehler ergibt `ok: false`.
 * @param {{ cwd: string; paket: string; ordner: string }} opts
 * @returns {NpmLizenzErgebnis}
 */
export function npmLizenz(opts) {
  const paket = String(opts?.paket);
  try {
    const { cwd, ordner } = opts;
    const eigene = eigeneLizenz(ordner);
    if (eigene !== null) {
      const text = lies(eigene);
      if (text === null) return fehlt(paket);
      return { ok: true, quelle: 'paket', datei: relativMitSchraegstrich(cwd, eigene), text };
    }
    const liste = ersatzliste(cwd);
    if (liste === null) return fehlt(paket);
    if (!liste.gueltig) return { ok: false, art: 'liste', fehler: LISTE_UNGUELTIG };
    const eintrag = liste.eintraege.find((e) => e.paket === paket);
    if (eintrag === undefined) return fehlt(paket);
    return ersatz(cwd, paket, ordner, eintrag);
  } catch {
    return fehlt(paket);
  }
}

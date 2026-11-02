// F4 Verbotene Muster (R-H-13, R-H-28, R-H-29; ADR-010 §4.1, §4.5; Befund E1-01-01).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `scanForbidden`, §3 (Altmodule ohne Ausnahme),
// §9 Nr 14 (Option `dateien`).
// Aufruf: node scripts/wap-gate/forbidden.mjs [--root <verzeichnis>] [<datei> …]
// Die Muster werden teils zur Laufzeit gebildet, damit diese Datei sich selbst nicht trifft.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { zeileVon, zerlege } from './lib/quelltext.mjs';
import { arbeitsbaumDateien, passt, WAP_PFADMENGE, WAP_SKRIPTE } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ pfad: string; zeile: number; regel: string }} Befund */
/** @typedef {{ pfad: string; zeile: number; art: string }} Ausnahme */

/** Geltungsbereich (ADR-010 §4.1): WAP-Pfadmenge und Skripte (F-003). */
const GELTUNGSBEREICH = [...WAP_PFADMENGE, ...WAP_SKRIPTE];

/** Dateien mit Quelltext (JS/TS und die C#-Fälschung). */
const QUELLTEXT = /\.(?:[cm]?[jt]sx?|cs)$/i;

const w = (/** @type {string[]} */ ...t) => t.join('');

/**
 * Merkwörter als ganzes Wort, Gross/Klein egal: in Kommentaren, Zeichenketten, Vorlagen und
 * Bezeichnern, nicht in Regex-Literalen (Entscheid TR-E101-204 a).
 */
const MERKWORT = new RegExp(
  `\\b(?:${[w('TO', 'DO'), w('FIX', 'ME'), w('XX', 'X'), w('HA', 'CK')].join('|')})\\b`,
  'i',
);
const TS_AUS = new RegExp(`@ts-(?:${w('ign', 'ore')}|${w('no', 'check')})\\b`);
const TS_ERWARTET = new RegExp(`@ts-${w('expect', '-error')}\\b(.*)`);
const LINT_AUS = new RegExp(`${w('biome', '-ignore')}[\\w-]*([^\\n]*)`);
const MUTANT_AUS = new RegExp(`${w('Stryker', ' disable')}\\b([^\\n]*)`);
const TYP_OFFEN = new RegExp(`(?<![\\w$.])${w('an', 'y')}(?![\\w$])(?!\\s*:)`);
const JSDOC_OFFEN = new RegExp(`\\{[^{}]*(?<![\\w$.])${w('an', 'y')}(?![\\w$])[^{}]*\\}`);
const KONSOLE = new RegExp(`\\b${w('con', 'sole')}\\s*\\.`);
const UEBERSPRUNGEN = new RegExp(
  `\\b(?:it|test|describe|suite|bench)\\b(?:\\s*\\.\\s*[A-Za-z]+)*\\s*\\.\\s*(?:${[
    w('on', 'ly'),
    w('sk', 'ip'),
    w('to', 'do'),
    w('fa', 'ils'),
    w('sk', 'ipIf'),
    w('run', 'If'),
    w('fix', 'me'),
    w('fa', 'il'),
  ].join('|')})\\b`,
);
/** Reinheit des Modells (Leitplanke 2, R-L-02). */
const UNREIN = [
  new RegExp(
    `\\b(?:${[w('docu', 'ment'), w('win', 'dow'), w('navi', 'gator'), w('local', 'Storage'), w('indexed', 'DB'), w('fet', 'ch'), w('XMLHttp', 'Request')].join('|')})\\b`,
  ),
  new RegExp(`\\bMath\\s*\\.\\s*${w('ran', 'dom')}\\b`),
  new RegExp(`\\bDate\\s*\\.\\s*${w('no', 'w')}\\b`),
  /\bnew\s+Date\s*\(\s*\)/,
  new RegExp(`\\bperformance\\s*\\.\\s*${w('no', 'w')}\\b`),
];
/** Netzzugriffe (R-11-03). */
const NETZ_CODE = new RegExp(
  `\\b(?:${[w('fet', 'ch'), w('XMLHttp', 'Request'), w('Web', 'Socket'), w('Event', 'Source'), w('send', 'Beacon'), w('import', 'Scripts')].join('|')})\\b`,
);
const URL_MUSTER = /\b(https?|wss?|ftp):\/\/([^\s'"`/\\]+)/gi;
/**
 * XML-Namensräume sind Bezeichner, keine Netzadressen (Befund E1-01-01, OOXML in src/io/wap-import/):
 * nur `http://` auf diese Hosts.
 */
const NAMENSRAUM_HOSTS = new Set([
  'schemas.openxmlformats.org',
  'schemas.microsoft.com',
  'www.w3.org',
  'purl.org',
  'ns.adobe.com',
]);
const KOPFZEILE = /^\/\/ @vitest-environment (?:node|jsdom)\s*$/;
const ABSOLUTER_PFAD = /^(?:[A-Za-z]:[\\/]|\\\\\\\\|\/(?:Users|home|tmp|var|etc|mnt)\/)/;
const BACKSLASH_PFAD = /[\w.-]\\\\[\w.-]/;
const PLATTFORM = new RegExp(`\\bprocess\\s*\\.\\s*${w('plat', 'form')}\\b`);
const SYSTEMSCHRIFT_CSS = new RegExp(`\\b${w('loc', 'al')}\\(`);
const SYSTEMSCHRIFT_JS = new RegExp(`\\bdocument\\s*\\.\\s*fonts\\s*\\.\\s*${w('che', 'ck')}\\b`);

/**
 * Einzige Ausnahme der Merkwort-Regel für Bezeichner (Entscheid TR-E101-204 a, CR-E101-05): die gesperrte
 * Testdatei der Musterprüfung hält das Wort als Konstante, um ihre Verstösse zur Laufzeit zu bilden.
 * Kommentare, Zeichenketten und Vorlagen dieser Datei bleiben geprüft; Regex-Literale prüft F4 nirgends.
 */
const BEZEICHNER_AUSNAHME = new Set(['tests/wap-gate/forbidden.gate.ts']);

/** Mindestlänge einer Begründung (ADR-010 §4.1). */
const MIN_BEGRUENDUNG = 15;

/**
 * Begründung nach dem ersten Doppelpunkt (Lint- und Mutations-Ausnahmen).
 * @param {string} rest
 * @returns {string}
 */
function begruendung(rest) {
  const i = rest.indexOf(':');
  return i < 0
    ? ''
    : rest
        .slice(i + 1)
        .replace(/\*\/\s*$/, '')
        .trim();
}

/**
 * Prüft eine Datei; liefert Befunde und Ausnahmen.
 * @param {string} rel
 * @param {string} text
 * @returns {{ befunde: Befund[]; ausnahmen: Ausnahme[] }}
 */
export function pruefeDatei(rel, text) {
  /** @type {Befund[]} */
  const befunde = [];
  /** @type {Ausnahme[]} */
  const ausnahmen = [];
  const istTest = rel.startsWith('tests/');
  const istProdukt = rel.startsWith('src/');
  const istTs = /\.(?:[cm]?tsx?)$/i.test(rel);
  const konsoleVerboten =
    istProdukt || (rel.startsWith('scripts/wap-gate/') && rel !== 'scripts/wap-gate/lib/out.mjs');
  const istModell = /^src\/model\/wap\//i.test(rel);
  const istNetzbereich = /^src\/(?:[^/]+\/)*wap[^/]*\//i.test(rel);
  const istSuiteTest = /^tests\/wap\/.+\.test\.tsx?$/i.test(rel);
  const melde = (/** @type {number} */ stelle, /** @type {string} */ regel) => {
    befunde.push({ pfad: rel, zeile: zeileVon(text, stelle), regel });
  };

  if (istSuiteTest && !KOPFZEILE.test(text.split(/\r?\n/)[0] ?? '')) {
    melde(0, 'Kopfzeile «// @vitest-environment node|jsdom» fehlt');
  }

  for (const teil of zerlege(text)) {
    if (teil.art === 'kommentar') {
      if (MERKWORT.test(teil.text)) melde(teil.start, 'Merkwort im Kommentar');
      if (TS_AUS.test(teil.text)) melde(teil.start, 'Abschalten der Typprüfung');
      const erwartet = TS_ERWARTET.exec(teil.text);
      if (erwartet !== null) {
        const grund = (erwartet[1] ?? '').replace(/\*\/\s*$/, '').trim();
        if (!istTest) melde(teil.start, 'erwarteter Typfehler ausserhalb von Tests');
        else if (grund.length < MIN_BEGRUENDUNG) {
          melde(teil.start, 'erwarteter Typfehler ohne Begründung (≥ 15 Zeichen)');
        } else
          ausnahmen.push({
            pfad: rel,
            zeile: zeileVon(text, teil.start),
            art: 'Typfehler erwartet',
          });
      }
      for (const [muster, art] of /** @type {[RegExp, string][]} */ ([
        [LINT_AUS, 'Lint-Ausnahme'],
        [MUTANT_AUS, 'Mutations-Ausnahme'],
      ])) {
        const m = muster.exec(teil.text);
        if (m === null) continue;
        if (begruendung(m[1] ?? '').length < MIN_BEGRUENDUNG) {
          melde(teil.start, `${art} ohne Begründung (≥ 15 Zeichen nach dem Doppelpunkt)`);
        } else ausnahmen.push({ pfad: rel, zeile: zeileVon(text, teil.start), art });
      }
      if (!istTs && teil.text.startsWith('/**') && JSDOC_OFFEN.test(teil.text)) {
        melde(teil.start, 'offener Typ in JSDoc');
      }
      continue;
    }
    if (teil.art === 'zeichenkette' || teil.art === 'vorlage') {
      const inhalt = teil.art === 'zeichenkette' ? teil.text.slice(1, -1) : teil.text;
      if (MERKWORT.test(inhalt)) melde(teil.start, 'Merkwort in Zeichenkette oder Vorlage');
      if (istNetzbereich) {
        for (const m of inhalt.matchAll(URL_MUSTER)) {
          const host = (m[2] ?? '').toLowerCase().replace(/:\d+$/, '');
          if ((m[1] ?? '').toLowerCase() === 'http' && NAMENSRAUM_HOSTS.has(host)) continue;
          melde(teil.start, 'entfernte URL');
        }
      }
      if (istSuiteTest) {
        if (teil.art === 'zeichenkette' && ABSOLUTER_PFAD.test(inhalt)) {
          melde(teil.start, 'absoluter Pfad');
        }
        if (BACKSLASH_PFAD.test(inhalt)) melde(teil.start, 'Backslash im Pfad');
        if (SYSTEMSCHRIFT_CSS.test(inhalt)) melde(teil.start, 'Systemschrift');
      }
      continue;
    }
    if (teil.art !== 'code') continue;
    const code = teil.text;
    /**
     * @param {RegExp} re
     * @param {string} regel
     */
    const suche = (re, regel) => {
      const m = re.exec(code);
      if (m !== null) melde(teil.start + m.index, regel);
    };
    if (!BEZEICHNER_AUSNAHME.has(rel)) suche(MERKWORT, 'Merkwort als Bezeichner');
    if (istTs) suche(TYP_OFFEN, 'offener Typ');
    if (konsoleVerboten) suche(KONSOLE, 'Konsolenausgabe');
    if (istTest) suche(UEBERSPRUNGEN, 'übersprungener oder fokussierter Test');
    if (istModell) for (const re of UNREIN) suche(re, 'Reinheit des Modells');
    if (istNetzbereich) suche(NETZ_CODE, 'Netzzugriff');
    if (istSuiteTest) {
      suche(PLATTFORM, 'Plattformabhängigkeit');
      suche(SYSTEMSCHRIFT_JS, 'Systemschrift');
    }
  }
  return { befunde, ausnahmen };
}

/**
 * Prüft die WAP-Pfadmenge sowie die Skript- und Werkzeugordner (Muster in ADR-010 §4.1) auf die verbotenen Muster.
 * Mit `dateien` nur diese Dateien (repo-relativ, «/»), davon nur jene im Geltungsbereich.
 * @param {{ cwd: string; dateien?: string[] }} opts
 * @returns {Promise<Schritt>}
 */
export async function scanForbidden(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /** @type {string[]} */
  let liste;
  let ausserhalb = 0;
  /** @type {string[]} */
  const fehlend = [];
  if (opts.dateien === undefined) {
    const alle = arbeitsbaumDateien(root);
    if (alle === null) {
      return {
        id: 'F4-muster',
        ok: false,
        ms: Date.now() - beginn,
        ursache: 'Dateiliste nicht lesbar (git ls-files gescheitert)',
        naechsterSchritt: 'Schleuse in einem git-Worktree starten',
      };
    }
    liste = alle.filter((p) => passt(p, GELTUNGSBEREICH));
  } else {
    liste = [];
    for (const roh of opts.dateien) {
      const rel = roh.replace(/\\/g, '/').replace(/^\.\//, '');
      if (!passt(rel, GELTUNGSBEREICH)) {
        ausserhalb += 1;
        continue;
      }
      const abs = join(root, ...rel.split('/'));
      if (!existsSync(abs) || !statSync(abs).isFile()) fehlend.push(rel);
      else liste.push(rel);
    }
  }
  /** @type {Befund[]} */
  const befunde = [];
  /** @type {Ausnahme[]} */
  const ausnahmen = [];
  let geprueft = 0;
  for (const rel of liste) {
    if (!QUELLTEXT.test(rel)) continue;
    const text = readFileSync(join(root, ...rel.split('/')), 'utf8');
    const r = pruefeDatei(rel, text);
    befunde.push(...r.befunde);
    ausnahmen.push(...r.ausnahmen);
    geprueft += 1;
  }
  const details = { befunde, ausnahmen, geprueft, ausserhalb };
  if (fehlend.length === 0 && befunde.length === 0) {
    return { id: 'F4-muster', ok: true, ms: Date.now() - beginn, details };
  }
  /** @type {Map<string, Set<string>>} */
  const jeDatei = new Map();
  for (const b of befunde) {
    const regeln = jeDatei.get(b.pfad) ?? new Set();
    regeln.add(b.regel);
    jeDatei.set(b.pfad, regeln);
  }
  const teile = [];
  if (fehlend.length > 0)
    teile.push(`Datei fehlt: ${kurzeListe(fehlend.map((p) => zeigePfad(p)))}`);
  if (jeDatei.size > 0) {
    teile.push(
      `verbotene Muster in ${String(jeDatei.size)} Dateien: ${kurzeListe(
        [...jeDatei].map(([p, r]) => `${zeigePfad(p)} (${[...r].join(', ')})`),
      )}`,
    );
  }
  return {
    id: 'F4-muster',
    ok: false,
    ms: Date.now() - beginn,
    ursache: teile.join('; '),
    naechsterSchritt:
      'Muster entfernen; Ausnahmen nur mit Begründung von mindestens 15 Zeichen (ADR-010 §4.1)',
    details,
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  if (i >= 0 && args[i + 1] === undefined) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/forbidden.mjs [--root <verzeichnis>] [<datei> …]');
    process.exitCode = 1;
  } else {
    const root = resolve(i >= 0 ? (args[i + 1] ?? '.') : '.');
    const dateien = args.filter((_a, k) => i < 0 || (k !== i && k !== i + 1));
    const s = await scanForbidden({ cwd: root, ...(dateien.length > 0 ? { dateien } : {}) });
    const details = /** @type {{ ausnahmen?: Ausnahme[] }} */ (s.details ?? {});
    for (const a of details.ausnahmen ?? []) {
      hinweis(`Ausnahme: ${zeigePfad(a.pfad)}:${String(a.zeile)} (${a.art})`);
    }
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

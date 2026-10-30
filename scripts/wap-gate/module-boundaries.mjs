// F7 Modulgrenzen (R-H-29, ADR-001, ADR-010 §4.4, Leitplanke 2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkModuleBoundaries`, §6 (suite-allowlist.json).
// Aufruf: node scripts/wap-gate/module-boundaries.mjs [--root <verzeichnis>]
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { zerlege } from './lib/quelltext.mjs';
import { arbeitsbaumDateien } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ spec: string; typ: boolean }} Import */
/**
 * @typedef {'modell' | 'layout' | 'checks' | 'xlsx' | 'import' | 'persons' | 'plan' | 'pdf' | 'fonts' | 'ui' | 'suite' | 'andere'} Modul
 */

const ALLOWLIST_REL = 'scripts/wap-gate/suite-allowlist.json';
const ENDUNGEN = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '/index.ts', '/index.tsx'];
const QUELLTEXT = /\.(?:[cm]?[jt]sx?)$/i;
const LAYOUT_TYPEN = /^src\/model\/wap\/layout\/text\/types(?:\.ts)?$/;

/**
 * Modul eines repo-relativen Pfads (ADR-010 §4.4).
 * @param {string} rel
 * @returns {Modul}
 */
export function modulVon(rel) {
  if (/^src\/model\/wap\/layout\//.test(rel)) return 'layout';
  if (/^src\/model\/wap\/checks\//.test(rel)) return 'checks';
  if (/^src\/model\/wap\//.test(rel)) return 'modell';
  if (/^src\/io\/xlsx-drawing\//.test(rel)) return 'xlsx';
  if (/^src\/io\/wap-import\//.test(rel)) return 'import';
  if (/^src\/io\/wap-persons\//.test(rel)) return 'persons';
  if (/^src\/io\/wap-plan\//.test(rel)) return 'plan';
  if (/^src\/io\/wap-pdf\//.test(rel)) return 'pdf';
  if (/^src\/assets\/wap-fonts\//.test(rel)) return 'fonts';
  if (/^src\/components\/wap\//.test(rel) || /^src\/pages\/WapPage(?:\.tsx)?$/.test(rel))
    return 'ui';
  if (rel.startsWith('src/')) return 'suite';
  return 'andere';
}

const WAP_MODULE = new Set([
  'modell',
  'layout',
  'checks',
  'xlsx',
  'import',
  'persons',
  'plan',
  'pdf',
  'fonts',
  'ui',
]);
const MODELL_GESAMT = new Set(['modell', 'layout', 'checks']);

/**
 * Importe einer Datei (statisch, dynamisch, Weiterexporte, require; mit Kennzeichen «nur Typ»).
 * @param {string} text
 * @returns {Import[]}
 */
export function importe(text) {
  const teile = zerlege(text);
  // Nur Code bleibt stehen; alles andere wird durch Leerzeichen gleicher Länge ersetzt.
  const code = teile
    .map((t) => (t.art === 'code' ? t.text : t.text.replace(/[^\n]/g, ' ')))
    .join('');
  /** @type {Import[]} */
  const out = [];
  for (const t of teile) {
    if (t.art !== 'zeichenkette') continue;
    const vor = code.slice(0, t.start);
    const spec = t.text.slice(1, -1);
    if (/\bfrom\s*$/.test(vor)) {
      const kopf = [...vor.matchAll(/\b(?:import|export)\b/g)].at(-1);
      const anweisung = kopf === undefined ? '' : vor.slice(kopf.index);
      out.push({ spec, typ: /^(?:import|export)\s+type\b/.test(anweisung) });
    } else if (/(?:^|[^.\w$])import\s*$/.test(vor) || /\bimport\s*\(\s*$/.test(vor)) {
      out.push({ spec, typ: false });
    } else if (/\brequire\s*\(\s*$/.test(vor)) {
      out.push({ spec, typ: false });
    }
  }
  return out;
}

/**
 * Löst einen relativen Import zu einem repo-relativen Pfad auf (mit üblichen Endungen).
 * @param {string} root
 * @param {string} von
 * @param {string} spec
 * @returns {string}
 */
function loese(root, von, spec) {
  const ohneZusatz = spec.replace(/[?#].*$/, '');
  const ziel = posix.normalize(posix.join(posix.dirname(von), ohneZusatz));
  for (const e of ENDUNGEN) {
    const kandidat = `${ziel}${e}`;
    if (existsSync(join(root, ...kandidat.split('/')))) return kandidat;
  }
  return ziel;
}

/**
 * Paketname eines Bezeichners (mit Scope, ohne Unterpfad).
 * @param {string} spec
 * @returns {string}
 */
function paketName(spec) {
  const teile = spec.split('/');
  return spec.startsWith('@') ? teile.slice(0, 2).join('/') : (teile[0] ?? spec);
}

/**
 * Ist der Import zulässig (ADR-010 §4.4)?
 * @param {Modul} quelle
 * @param {{ paket: string } | { rel: string; modul: Modul }} ziel
 * @param {boolean} typ
 * @param {Set<string>} freigegeben Suite-Bausteine für die Oberfläche
 * @returns {boolean}
 */
function erlaubt(quelle, ziel, typ, freigegeben) {
  if ('paket' in ziel) {
    const p = ziel.paket;
    switch (quelle) {
      case 'modell':
        return p === 'immer';
      case 'layout':
        return p === 'hyphen';
      case 'xlsx':
        return p === 'fflate';
      case 'pdf':
        return p === 'pdf-lib' || p === 'fontkit';
      case 'ui':
        return p === 'react' || p === 'react-dom';
      case 'suite':
      case 'andere':
        return true;
      default:
        return false;
    }
  }
  const m = ziel.modul;
  if (m === quelle) return true;
  switch (quelle) {
    case 'modell':
      return typ && LAYOUT_TYPEN.test(ziel.rel);
    case 'layout':
      return m === 'modell';
    case 'checks':
      return m === 'modell' || (m === 'layout' && typ);
    case 'xlsx':
      return false;
    case 'import':
    case 'persons':
      return m === 'xlsx' || MODELL_GESAMT.has(m);
    case 'plan':
      return MODELL_GESAMT.has(m);
    case 'pdf':
      return MODELL_GESAMT.has(m) || m === 'fonts';
    case 'fonts':
      return typ && LAYOUT_TYPEN.test(ziel.rel);
    case 'ui':
      return WAP_MODULE.has(m) || freigegeben.has(ziel.rel);
    case 'suite':
      return !WAP_MODULE.has(m) || m === 'xlsx' || /^src\/pages\/WapPage(?:\.tsx)?$/.test(ziel.rel);
    default:
      return true;
  }
}

/**
 * Liest alle statischen und dynamischen Importe (auch import type) und prüft sie gegen ADR-010 §4.4.
 * @param {{ cwd: string }} opts
 * @returns {Promise<Schritt>}
 */
export async function checkModuleBoundaries(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const allowlist = join(root, ...ALLOWLIST_REL.split('/'));
  /** @type {Set<string>} */
  let freigegeben;
  try {
    const d = /** @type {{ importe?: unknown }} */ (JSON.parse(readFileSync(allowlist, 'utf8')));
    if (!Array.isArray(d.importe)) throw new Error('importe fehlt');
    freigegeben = new Set(d.importe.filter((x) => typeof x === 'string'));
  } catch {
    return {
      id: 'F7-module',
      ok: false,
      ms: Date.now() - beginn,
      ursache: `${ALLOWLIST_REL} fehlt oder ist ungültig (Feld «importe»)`,
      naechsterSchritt: 'Liste der freigegebenen Suite-Bausteine anlegen bzw. korrigieren',
    };
  }
  const dateien = arbeitsbaumDateien(root);
  if (dateien === null) {
    return {
      id: 'F7-module',
      ok: false,
      ms: Date.now() - beginn,
      ursache: 'Dateiliste nicht lesbar (git ls-files gescheitert)',
      naechsterSchritt: 'Schleuse in einem git-Worktree starten',
    };
  }
  /** @type {{ pfad: string; ziel: string }[]} */
  const verstoesse = [];
  for (const rel of dateien) {
    if (!rel.startsWith('src/') || !QUELLTEXT.test(rel)) continue;
    const quelle = modulVon(rel);
    const text = readFileSync(join(root, ...rel.split('/')), 'utf8');
    for (const imp of importe(text)) {
      const relativ = imp.spec.startsWith('.');
      /** @type {{ paket: string } | { rel: string; modul: Modul }} */
      const ziel = relativ
        ? (() => {
            const z = loese(root, rel, imp.spec);
            return { rel: z, modul: modulVon(z) };
          })()
        : { paket: paketName(imp.spec) };
      if (!erlaubt(quelle, ziel, imp.typ, freigegeben)) {
        verstoesse.push({ pfad: rel, ziel: 'paket' in ziel ? ziel.paket : ziel.rel });
      }
    }
  }
  if (verstoesse.length === 0) {
    return { id: 'F7-module', ok: true, ms: Date.now() - beginn };
  }
  return {
    id: 'F7-module',
    ok: false,
    ms: Date.now() - beginn,
    ursache: `Importe gegen die Modulgrenzen (ADR-010 §4.4): ${kurzeListe(
      verstoesse.map((v) => `${zeigePfad(v.pfad)} → ${zeigePfad(v.ziel)}`),
    )}`,
    naechsterSchritt:
      'Import entfernen oder über das zulässige Modul führen (ADR-001, ADR-010 §4.4); neue Suite-Bausteine nur über suite-allowlist.json',
    details: { verstoesse },
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  if ((i >= 0 && args[i + 1] === undefined) || args.length > (i >= 0 ? 2 : 0)) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/module-boundaries.mjs [--root <verzeichnis>]');
    process.exitCode = 1;
  } else {
    const s = await checkModuleBoundaries({ cwd: resolve(i >= 0 ? (args[i + 1] ?? '.') : '.') });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

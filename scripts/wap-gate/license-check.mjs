// F10 Lizenzprüfung und V10-lizenztexte (R-H-23, ADR-010 §9; Paket F-TOOLS, Auftraggeber 19.10.2026 «7: ja»).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkLicenses, checkBundledLicenses), §6d, §9 Nr 9.
// Kriterium 1 (F10): jedes Paket aus package-lock.json, das gegenüber dem Vergleichsstand neu ist oder seine
// Version geändert hat, und jeder Eintrag von scripts/wap-gate/license-assets.json trägt eine zulässige Lizenz
// (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD; Schriften zusätzlich OFL-1.1; SPDX-Ausdrücke mit OR
// zulässig, wenn eine Alternative zulässig ist) oder eine passende Ausnahme mit Gate-Entscheid (Q-019, E3).
// Kriterium 2 (V10-lizenztexte): Die Einzeldatei (dist/index.html und dist/offline.html) enthält die Lizenztexte
// aller gebündelten Laufzeit-Abhängigkeiten (Modulgraph über Vite, unabhängig vom Lizenzteil des Build-Skripts)
// und aller gebündelten Assets.
// Aufruf: node scripts/wap-gate/license-check.mjs [--root <dir>] [--basis <ref>] [--gebuendelt]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { npmLizenz } from '../../tools/wap/npm-lizenz.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { git, mergeBasis } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

/** Gesperrte Liste der Nicht-npm-Bestandteile und Ausnahmen (ADR-010 §9), repo-relativ. */
export const ASSETS_REL = 'scripts/wap-gate/license-assets.json';

/** Zulässige Lizenzen für npm-Pakete (Prompt §7, ADR-010 §9). */
export const ZULAESSIG = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
]);

/** Zusätzlich für Schriften (Assets). */
const SCHRIFT = new Set(['OFL-1.1']);

/** Lizenzdatei eines npm-Pakets (Vertrag §2 b). */
const NPM_LIZENZ = /^licen[sc]e(?:\..*)?$/i;

/** Name der Anwendung im Lizenzblock (Vertrag §2 a). */
const APP_NAME = 'WK Util Suite';

/** Felder einer Ausnahme (Vertrag §9 Nr 9). */
const AUSNAHME_FELDER = /** @type {const} */ ([
  'paket',
  'version',
  'lizenz',
  'nurEntwicklung',
  'datum',
  'entscheid',
]);

/**
 * @typedef {{ paket: string; version: string; lizenz: string; nurEntwicklung: boolean; datum: string; entscheid: string }} Ausnahme
 * @typedef {{ name: string; lizenz: string; dateien: string[]; lizenztext: string }} Asset
 */

/**
 * Wertet einen SPDX-Ausdruck aus: zulässig, wenn die Verknüpfung (OR: eine, AND: alle) zulässiger IDs gilt.
 * Unbekannte Form (z.B. WITH, LicenseRef-…, leere Angabe) gilt als unzulässig (fail-closed).
 * @param {string} ausdruck
 * @param {Set<string>} erlaubt
 * @returns {boolean}
 */
export function spdxZulaessig(ausdruck, erlaubt) {
  const teile = ausdruck.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  /** @returns {boolean | null} */
  const primaer = () => {
    const t = teile[i];
    if (t === undefined) return null;
    if (t === '(') {
      i++;
      const w = oder();
      if (teile[i] !== ')') return null;
      i++;
      return w;
    }
    if (t === ')' || /^(?:AND|OR|WITH)$/i.test(t)) return null;
    i++;
    if (teile[i] !== undefined && /^WITH$/i.test(teile[i] ?? '')) return null;
    return erlaubt.has(t);
  };
  /** @returns {boolean | null} */
  const und = () => {
    let w = primaer();
    while (w !== null && teile[i] !== undefined && /^AND$/i.test(teile[i] ?? '')) {
      i++;
      const r = primaer();
      if (r === null) return null;
      w = w && r;
    }
    return w;
  };
  /** @returns {boolean | null} */
  function oder() {
    let w = und();
    while (w !== null && teile[i] !== undefined && /^OR$/i.test(teile[i] ?? '')) {
      i++;
      const r = und();
      if (r === null) return null;
      w = w || r;
    }
    return w;
  }
  const ergebnis = oder();
  return ergebnis === true && i === teile.length;
}

/**
 * Liest license-assets.json.
 * @param {string} root
 * @returns {{ ok: true; assets: Asset[]; ausnahmen: Ausnahme[] } | { ok: false; grund: string }}
 */
export function ladeAssets(root) {
  const datei = join(root, ...ASSETS_REL.split('/'));
  if (!existsSync(datei)) return { ok: false, grund: `${ASSETS_REL} fehlt` };
  /** @type {unknown} */
  let d;
  try {
    d = JSON.parse(readFileSync(datei, 'utf8'));
  } catch {
    return { ok: false, grund: `${ASSETS_REL} ist kein gültiges JSON` };
  }
  const o = /** @type {Record<string, unknown>} */ (d ?? {});
  if (o.version !== 1 || !Array.isArray(o.assets) || !Array.isArray(o.ausnahmen)) {
    return { ok: false, grund: `${ASSETS_REL} ungültig (version 1, assets, ausnahmen)` };
  }
  /** @type {Asset[]} */
  const assets = [];
  for (const a of o.assets) {
    const e = /** @type {Record<string, unknown>} */ (a ?? {});
    if (
      typeof e.name !== 'string' ||
      e.name === '' ||
      typeof e.lizenz !== 'string' ||
      !Array.isArray(e.dateien) ||
      !e.dateien.every((x) => typeof x === 'string' && x !== '') ||
      typeof e.lizenztext !== 'string' ||
      e.lizenztext === ''
    ) {
      return { ok: false, grund: `${ASSETS_REL}: ungültiger Asset-Eintrag` };
    }
    assets.push({
      name: e.name,
      lizenz: e.lizenz,
      dateien: /** @type {string[]} */ (e.dateien),
      lizenztext: e.lizenztext,
    });
  }
  /** @type {Ausnahme[]} */
  const ausnahmen = [];
  for (const a of o.ausnahmen) {
    const e = /** @type {Record<string, unknown>} */ (a ?? {});
    const gueltig =
      AUSNAHME_FELDER.every((f) => f in e) &&
      typeof e.paket === 'string' &&
      e.paket !== '' &&
      typeof e.version === 'string' &&
      e.version !== '' &&
      typeof e.lizenz === 'string' &&
      e.lizenz !== '' &&
      typeof e.nurEntwicklung === 'boolean' &&
      typeof e.datum === 'string' &&
      /^\d{2}\.\d{2}\.\d{4}$/.test(e.datum) &&
      typeof e.entscheid === 'string' &&
      e.entscheid.trim() !== '';
    if (!gueltig) {
      return {
        ok: false,
        grund: `${ASSETS_REL}: ungültige Ausnahme (Pflichtfelder ${AUSNAHME_FELDER.join(', ')})`,
      };
    }
    ausnahmen.push(/** @type {Ausnahme} */ (/** @type {unknown} */ (e)));
  }
  return { ok: true, assets, ausnahmen };
}

/**
 * Paketname aus einem Schlüssel von package-lock.json bzw. einer Modul-ID (Teil nach dem letzten
 * /node_modules/, bei @scope zwei Segmente).
 * @param {string} pfad
 * @returns {string | null}
 */
export function paketName(pfad) {
  const p = pfad.replace(/\\/g, '/');
  const i = p.lastIndexOf('node_modules/');
  if (i < 0) return null;
  const rest = p.slice(i + 'node_modules/'.length).split('/');
  const erstes = rest[0] ?? '';
  if (erstes === '') return null;
  if (erstes.startsWith('@')) return rest[1] ? `${erstes}/${rest[1]}` : null;
  return erstes;
}

/**
 * Lizenz eines Pakets: Feld license im package-lock, sonst aus der installierten package.json.
 * @param {string} root
 * @param {string} schluessel
 * @param {Record<string, unknown>} eintrag
 * @returns {string | null}
 */
function lizenzVon(root, schluessel, eintrag) {
  if (typeof eintrag.license === 'string' && eintrag.license !== '') return eintrag.license;
  const pj = join(root, ...schluessel.split('/'), 'package.json');
  if (!existsSync(pj)) return null;
  try {
    const d = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pj, 'utf8')));
    if (typeof d.license === 'string' && d.license !== '') return d.license;
    if (d.license !== null && typeof d.license === 'object') {
      const t = /** @type {Record<string, unknown>} */ (d.license).type;
      if (typeof t === 'string') return t;
    }
    if (Array.isArray(d.licenses)) {
      const typen = d.licenses
        .map((x) =>
          x !== null && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x).type : x,
        )
        .filter((x) => typeof x === 'string');
      if (typen.length > 0) return `(${typen.join(' OR ')})`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * package-lock.json-Pakete: Schlüssel → Eintrag.
 * @param {string} text
 * @returns {Map<string, Record<string, unknown>> | null}
 */
function lockPakete(text) {
  try {
    const d = /** @type {Record<string, unknown>} */ (JSON.parse(text));
    const p = d.packages;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return null;
    return new Map(
      Object.entries(/** @type {Record<string, Record<string, unknown>>} */ (p)).filter(([k]) =>
        k.includes('node_modules/'),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * Bewertet alle gegenüber basis neuen oder geänderten Pakete aus package-lock.json und license-assets.json.
 * @param {{ cwd: string; basis: string }} opts
 * @returns {Promise<import('./lib/types.mjs').Schritt>}
 */
export async function checkLicenses(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F10-lizenzen',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  const lockDatei = join(root, 'package-lock.json');
  if (!existsSync(lockDatei))
    return rotSchritt(
      'package-lock.json fehlt',
      '«npm install» ausführen und package-lock.json versionieren',
    );
  const neu = lockPakete(readFileSync(lockDatei, 'utf8'));
  if (neu === null)
    return rotSchritt('package-lock.json ist ungültig', 'package-lock.json neu erzeugen');
  const assets = ladeAssets(root);
  if (!assets.ok)
    return rotSchritt(
      assets.grund,
      `${ASSETS_REL} wiederherstellen (gesperrt, Änderung nur per lock-update)`,
    );
  const alt = git(root, ['show', `${opts.basis}:package-lock.json`]);
  /** @type {Map<string, Record<string, unknown>>} */
  let altPakete = new Map();
  if (alt.status === 0) {
    const a = lockPakete(alt.stdout);
    if (a === null)
      return rotSchritt(
        'package-lock.json des Vergleichsstands ist ungültig',
        'Vergleichsstand prüfen',
      );
    altPakete = a;
  } else if (git(root, ['cat-file', '-e', `${opts.basis}^{commit}`]).status !== 0) {
    return rotSchritt(
      `Vergleichsstand ${opts.basis} nicht lesbar`,
      'Zweig main bereitstellen und erneut starten',
    );
  }

  /** @type {string[]} */
  const befunde = [];
  /** @type {string[]} */
  const bewertet = [];
  /** @type {string[]} */
  const bestand = [];
  /** @type {string[]} */
  const mitAusnahme = [];
  for (const [schluessel, e] of [...neu.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const name = paketName(schluessel);
    if (name === null) continue;
    const version = typeof e.version === 'string' ? e.version : '';
    const vorher = altPakete.get(schluessel);
    const kennung = `${name}@${version || '?'}`;
    if (vorher !== undefined && vorher.version === e.version) {
      bestand.push(kennung);
      continue;
    }
    bewertet.push(kennung);
    const lizenz = lizenzVon(root, schluessel, e);
    if (lizenz !== null && spdxZulaessig(lizenz, ZULAESSIG)) continue;
    const ausnahme = assets.ausnahmen.find(
      (x) => x.paket === name && x.version === version && x.lizenz === lizenz,
    );
    if (ausnahme === undefined) {
      befunde.push(`${kennung} (${lizenz ?? 'ohne Lizenzangabe'})`);
      continue;
    }
    if (ausnahme.nurEntwicklung && e.dev !== true) {
      befunde.push(`${kennung}: Ausnahme nur für Entwicklung, Paket ist Laufzeit-Abhängigkeit`);
      continue;
    }
    mitAusnahme.push(`${kennung} (${lizenz}, ${ausnahme.entscheid})`);
  }
  for (const a of assets.assets) {
    if (!spdxZulaessig(a.lizenz, new Set([...ZULAESSIG, ...SCHRIFT]))) {
      befunde.push(`Asset ${a.name} (${a.lizenz})`);
    }
  }
  const details = { bewertet: bewertet.length, bestand: bestand.length, mitAusnahme, befunde };
  if (befunde.length === 0)
    return { id: 'F10-lizenzen', ok: true, ms: Date.now() - beginn, details };
  return {
    ...rotSchritt(
      `${String(befunde.length)} unzulässige Lizenz(en): ${kurzeListe(befunde)}`,
      'Abhängigkeit ersetzen oder entfernen; eine Ausnahme nur mit Gate-Entscheid in license-assets.json (per lock-update)',
    ),
    details,
  };
}

/**
 * Text normalisiert: CRLF → LF, Leerraum am Zeilenende entfernt, führende und abschliessende Leerzeilen weg.
 * @param {string} t
 * @returns {string}
 */
function normalisiert(t) {
  return t
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((z) => z.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/**
 * Inhalte aller <template id="application-licenses"><pre>…</pre></template> einer Datei.
 * @param {string} html
 * @returns {string[]}
 */
function lizenzBloecke(html) {
  const re = /<template id="application-licenses"><pre>([\s\S]*?)<\/pre><\/template>/g;
  return [...html.matchAll(re)].map((m) => m[1] ?? '');
}

/**
 * Modul-IDs des Produktions-Bundles (Einstieg, Plugins und Format wie tools/build-offline.mjs).
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function modulGraph(root) {
  const vite = /** @type {{ build: (c: unknown) => Promise<unknown> }} */ (
    await import(pathToFileURL(join(root, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
  );
  const reactMod = /** @type {{ default: () => unknown }} */ (
    await import(
      pathToFileURL(join(root, 'node_modules', '@vitejs', 'plugin-react', 'dist', 'index.js')).href
    )
  );
  const ergebnis = await vite.build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [reactMod.default()],
    build: {
      write: false,
      lib: { entry: join(root, 'src', 'main.tsx'), name: 'WKUtilSuite', formats: ['iife'] },
    },
  });
  const ausgaben = (Array.isArray(ergebnis) ? ergebnis : [ergebnis]).flatMap(
    (b) =>
      /** @type {{ output: { type: string; modules?: Record<string, unknown> }[] }} */ (b).output,
  );
  return ausgaben.flatMap((o) => (o.type === 'chunk' ? Object.keys(o.modules ?? {}) : []));
}

/**
 * Alphabetisch erste Lizenzdatei eines Paketordners (Vertrag §2 b).
 * @param {string} ordner
 * @returns {string | null}
 */
function eigeneLizenzdatei(ordner) {
  try {
    const n = readdirSync(ordner)
      .sort()
      .find((d) => NPM_LIZENZ.test(d) && statSync(join(ordner, d)).isFile());
    return n === undefined ? null : join(ordner, n);
  } catch {
    return null;
  }
}

/**
 * V10 «V10-lizenztexte» (R-H-23 Kriterium 2): Der Build (dist/index.html und dist/offline.html, Abschnitt
 * application-licenses) enthält die Lizenztexte aller gebündelten Laufzeit-Abhängigkeiten (Modulgraph über
 * Vite) und aller gebündelten Einträge aus license-assets.json. modulIds nur für Tests (ersetzt den Vite-Lauf).
 * @param {{ cwd: string; distDir?: string; modulIds?: string[] }} opts
 * @returns {Promise<import('./lib/types.mjs').Schritt & { erwartet: { name: string; quelle: 'app' | 'npm' | 'asset'; lizenzdatei: string }[]; fehlend: string[] }>}
 */
export async function checkBundledLicenses(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const distDir = resolve(opts.distDir ?? join(root, 'dist'));
  /** @type {{ name: string; quelle: 'app' | 'npm' | 'asset'; lizenzdatei: string }[]} */
  const erwartet = [];
  /** @type {string[]} */
  const fehlend = [];
  const naechster =
    'tools/build-offline.mjs um den Lizenztext ergänzen bzw. license-assets.json per lock-update nachführen, dann npm run build';
  /**
   * @param {string} ursache
   * @param {string} [naechsterSchritt]
   */
  const rotSchritt = (ursache, naechsterSchritt = naechster) => ({
    id: 'V10-lizenztexte',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    erwartet,
    fehlend,
  });
  const assets = ladeAssets(root);
  if (!assets.ok) return rotSchritt(assets.grund);
  /** @type {string[]} */
  let module;
  try {
    module = opts.modulIds ?? (await modulGraph(root));
  } catch {
    return rotSchritt('Vite-Lauf für den Modulgraphen gescheitert', 'npm run build prüfen');
  }
  const ohneZusatz = module.map((m) => m.replace(/\?.*$/, '').replace(/\\/g, '/').toLowerCase());

  /** @type {Map<string, string>} name → normalisierter Text */
  const texte = new Map();
  /** @type {string[]} */
  const probleme = [];
  const appDatei = join(root, 'LICENSE');
  erwartet.push({ name: APP_NAME, quelle: 'app', lizenzdatei: appDatei });
  if (existsSync(appDatei)) texte.set(APP_NAME, normalisiert(readFileSync(appDatei, 'utf8')));
  else probleme.push(`Lizenzdatei fehlt: LICENSE`);
  const npm = [...new Set(module.map(paketName).filter((n) => n !== null))].sort();
  for (const name of npm) {
    const ordner = join(root, 'node_modules', ...name.split('/'));
    const eigene = eigeneLizenzdatei(ordner);
    if (eigene !== null) {
      erwartet.push({ name, quelle: 'npm', lizenzdatei: eigene });
      texte.set(name, normalisiert(readFileSync(eigene, 'utf8')));
      continue;
    }
    // Ohne eigene Lizenzdatei nur ein geprüfter Eintrag der Ersatzliste (Q-031, tools/wap/npm-lizenz.mjs).
    const ersatz = npmLizenz({ cwd: root, paket: name, ordner });
    if (ersatz.ok && ersatz.quelle === 'ersatz') {
      erwartet.push({ name, quelle: 'npm', lizenzdatei: join(root, ...ersatz.datei.split('/')) });
      texte.set(name, normalisiert(ersatz.text));
    } else {
      probleme.push(`Lizenzdatei fehlt im Paket ${name}`);
    }
  }
  for (const a of assets.assets) {
    const gebuendelt = a.dateien.some((d) => {
      const abs = join(root, ...d.split('/'));
      const imGraph = ohneZusatz.includes(abs.replace(/\\/g, '/').toLowerCase());
      return imGraph || (!d.split('/').includes('node_modules') && existsSync(abs));
    });
    if (!gebuendelt) continue;
    const datei = join(root, ...a.lizenztext.split('/'));
    erwartet.push({ name: a.name, quelle: 'asset', lizenzdatei: datei });
    if (existsSync(datei)) texte.set(a.name, normalisiert(readFileSync(datei, 'utf8')));
    else probleme.push(`Lizenztext fehlt für ${a.name}: ${a.lizenztext}`);
  }
  erwartet.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));

  /** @type {string[]} */
  const inhalte = [];
  for (const datei of ['index.html', 'offline.html']) {
    const p = join(distDir, datei);
    if (!existsSync(p)) return rotSchritt(`${datei} fehlt im Build`, 'zuerst npm run build');
    const bloecke = lizenzBloecke(readFileSync(p, 'utf8'));
    if (bloecke.length !== 1) {
      return rotSchritt(
        `${datei}: Lizenzabschnitt <template id="application-licenses"> ${bloecke.length === 0 ? 'fehlt' : 'mehrfach'}`,
      );
    }
    inhalte.push(bloecke[0] ?? '');
  }
  if (inhalte[0] !== inhalte[1])
    return rotSchritt('Lizenzabschnitt in index.html und offline.html verschieden');
  const vorhanden = normalisiert(
    (inhalte[0] ?? '').replaceAll('&lt;', '<').replaceAll('&amp;', '&'),
  );
  for (const e of erwartet) {
    const t = texte.get(e.name);
    if (t === undefined) {
      if (!fehlend.includes(e.name)) fehlend.push(e.name);
      continue;
    }
    if (!`\n${vorhanden}\n`.includes(`\n${e.name}\n${t}\n`)) fehlend.push(e.name);
  }
  fehlend.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  if (fehlend.length === 0 && probleme.length === 0) {
    return {
      id: 'V10-lizenztexte',
      ok: true,
      ms: Date.now() - beginn,
      erwartet,
      fehlend,
      details: { erwartet: erwartet.length },
    };
  }
  const teile = [
    ...probleme,
    ...(fehlend.length > 0
      ? [
          `${String(fehlend.length)} Lizenztext(e) fehlen oder sind verändert: ${kurzeListe(fehlend)}`,
        ]
      : []),
  ];
  return rotSchritt(teile.join('; '));
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(wert('--root') ?? '.');
  if (args.includes('--gebuendelt')) {
    const s = await checkBundledLicenses({ cwd: root });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    hinweis(`Erwartete Lizenztexte: ${s.erwartet.map((e) => e.name).join(', ')}`);
    process.exitCode = s.ok ? 0 : 1;
  } else {
    const basis = wert('--basis') ?? mergeBasis(root, 'main', 'HEAD');
    if (basis === null || basis === undefined) {
      fehlerMeldung(
        'Vergleichsstand nicht bestimmbar (git merge-base main HEAD); --basis <ref> angeben',
      );
      process.exitCode = 1;
    } else {
      const s = await checkLicenses({ cwd: root, basis });
      if (s.ok) ok(s.id, s.ms);
      else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
      const d = /** @type {{ bewertet?: number; bestand?: number; mitAusnahme?: string[] }} */ (
        s.details ?? {}
      );
      hinweis(
        `Bewertet: ${String(d.bewertet ?? 0)} neue oder geänderte Pakete; Suite-Bestand (nicht bewertet): ${String(d.bestand ?? 0)}`,
      );
      for (const a of d.mitAusnahme ?? []) hinweis(`Ausnahme: ${a}`);
      process.exitCode = s.ok ? 0 : 1;
    }
  }
}

// Build-Hilfe für datenfreie Einzeldateien (Paket E1-01b, R-H-11; AE-001 §3 Zwischenstand; ADR-010 §3.2 V4
// Projekt edge-dist). Baut einen Einstieg (.tsx/.ts) zu einer HTML-Datei mit genau einem Inline-Skript,
// Inline-Stilen, Lizenzhinweisen und derselben CSP wie tools/build-offline.mjs.
// Aufruf: node scripts/wap-gate/einzeldatei.mjs --entry <pfad> --out <datei> --titel <text>
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2, Notiz Runde 2 Nr 6, 7, Änderungsnotiz Code-Review
// Runde 1 Nr 1 und «Ergänzung nach Test-Review CR1» Nr 1, 2. Vite wird erst beim Bau geladen (die Schleuse
// importiert dieses Modul über e2e.mjs auch ohne Bau). Geschrieben wird nur, wenn alle Prüfungen grün sind;
// sonst bleibt eine vorhandene Ausgabe unverändert.
// Datenschutz (AGENTS.md): Neben den gebündelten Modulen prüft der Bau (1) jeden Verweis aus Stilen
// (url(), image-set()) und Skripten (new URL(…, import.meta.url)) über das Plugin wap-einzeldatei-verweise,
// (2) jeden Dateilesezugriff des Prozesses während des Baus (Lese-Schutz) und (3) jede data:-URI der fertigen
// Seite auf bekannte Herkunft. Meldungen nennen nie Inhalte und Pfade nur repo-relativ.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { npmLizenz } from '../../tools/wap/npm-lizenz.mjs';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

const ID = 'einzeldatei';

const w = (/** @type {string[]} */ ...t) => t.join('');

/** Konsolen-API (zur Laufzeit gebildet, F4-Regel «Konsolenausgabe» in scripts/wap-gate/). */
const KONSOLE = w('con', 'sole');

/** Methoden, die die Suite per define entfernt (tools/build-offline.mjs). */
const KONSOLEN_METHODEN = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'table',
  'dir',
  'dirxml',
  'assert',
];

/** Ordner, aus denen nie ein Modul gebündelt wird (relativ zu cwd). */
const VERBOTENE_ORDNER = ['reference/', '.qa/', 'fixtures-private/', 'test-results/'];

/** Nur der synthetische Plan darf in versionierte Ausgaben (Plan-Notiz AE-001). */
const DURCHSTICH = 'tests/wap/fixtures/durchstich/';

/**
 * Workspace-Markierungen, die Vite 8.3.0 in Vorfahren-Ordnern von root liest bzw. auf Existenz prüft
 * (searchForWorkspaceRoot; Änderungsnotiz Lese-Schutz Workspace-Markierungen Nr 1, 2). Kleinschreibung.
 */
const WORKSPACE_MARKIERUNGEN = new Set([
  'package.json',
  'deno.json',
  'deno.jsonc',
  'pnpm-workspace.yaml',
  'lerna.json',
]);

/** Ergänzung des nächsten Schritts bei npm-Lizenzbefunden (Notiz Lizenzen ohne LICENSE-Datei Nr 5). */
const NAECHSTER_SCHRITT_ERSATZ =
  'npm-Paket ohne LICENSE*: Eintrag in tools/wap/licenses/npm-ersatz.json nur mit Entscheid';

/** Lizenzdatei neben einem Asset-Modul unter src/assets/. */
const ASSET_LIZENZ = /^(?:OFL\.txt|LICENSE.*)$/i;

// Muster von Vite 8.3.0 (Notiz CR1 Nr 1, Ergänzung Nr 1): Stil-Kennung (CSS_LANGS_RE), url() (cssUrlRE),
// image-set() (cssImageSetRE), new URL(…, import.meta.url) (assetImportMetaUrlRE), nicht verarbeitete
// Funktionen in image-set() (cssNotProcessedRE).
const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const CSS_URL_RE =
  /(?<!@import\s+)(?<=^|[^\w\-\u0080-￿])url\((\s*('[^']+'|"[^"]+")\s*|(?:\\.|[^'")\\])+)\)/g;
const CSS_IMAGE_SET_RE = /(?<=image-set\()((?:[\w-]{1,256}\([^)]*\)|[^)])*)(?=\))/g;
const CSS_NICHT_VERARBEITET_RE = /(?:gradient|element|cross-fade|image)\(/;
const IMPORT_META_URL_RE =
  /\bnew\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*(?:,\s*)?\)/g;

/** Skript-Kennung (Pfad ohne Abfrage). */
const SKRIPT_RE = /\.(?:[mc]?js|jsx|[mc]?ts|tsx)$/;

/** Worker über die Abfrage bzw. über einen Aufruf (Ergänzung Nr 1 «Worker»). */
const WORKER_ABFRAGE_RE = /[?&](?:worker|sharedworker)\b/;
const WORKER_AUFRUF_RE = /\bnew\s+(?:Shared)?Worker\s*\(/;

/** Stil mit «@import» oder «composes … from» (fail closed, Notiz CR1 Nr 1). */
const STIL_IMPORT_RE = /@import\b|\bcomposes\s*:[^;{}]*\bfrom\b/i;

/** Funktionen von fs bzw. fs/promises, die der Lese-Schutz während des Baus protokolliert (Ergänzung Nr 2). */
const FS_LESEN = [
  'readFile',
  'readFileSync',
  'createReadStream',
  'open',
  'openSync',
  'openAsBlob',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
];
const FSP_LESEN = ['readFile', 'open', 'copyFile', 'cp'];

/** CommonJS-Objekt von fs (dasselbe Objekt wie der ESM-Standardexport; fs.promises = fs/promises). */
const FS = /** @type {Record<string, unknown> & { promises: Record<string, unknown> }} */ (
  /** @type {unknown} */ (createRequire(import.meta.url)('node:fs'))
);

/**
 * CSP der Suite, gelesen aus `<cwd>/tools/build-offline.mjs` (einzige Quelle); wirft, wenn nicht auffindbar.
 * Verbunden werden die Zeichenketten zwischen «const csp = [» und «].join('; ')».
 * @param {string} cwd
 * @returns {string}
 */
export function suiteCsp(cwd) {
  const datei = join(resolve(cwd), 'tools', 'build-offline.mjs');
  const text = existsSync(datei) ? readFileSync(datei, 'utf8') : '';
  const m = /const\s+csp\s*=\s*\[([\s\S]*?)\]\s*\.join\(\s*(['"]); \2\s*\)/.exec(text);
  /** @type {string[]} */
  const teile = [];
  for (const z of (m?.[1] ?? '').matchAll(/(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    teile.push((z[2] ?? '').replace(/\\(.)/g, '$1'));
  }
  if (m === null || teile.length === 0) {
    throw new Error(
      "CSP der Suite nicht gefunden: tools/build-offline.mjs enthält keinen Abschnitt «const csp = [ … ].join('; ')»",
    );
  }
  return teile.join('; ');
}

/**
 * Entschlüsselt die einfachen HTML-Entitäten eines Attributwerts.
 * @param {string} wert
 * @returns {string}
 */
function entitaeten(wert) {
  return wert
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * @typedef {object} Tag
 * @property {string} name klein geschrieben
 * @property {Map<string, string>} attribute Namen klein geschrieben
 * @property {string} inhalt Rohtext bei script und style, sonst leer
 */

/**
 * Zerlegt HTML in Start-Tags (mit Attributen); Inhalte von script und style bleiben Rohtext, Kommentare
 * entfallen. Reicht für die Freigabeprüfung erzeugter Einzeldateien (wie tools/verify-release.mjs).
 * @param {string} html
 * @returns {Tag[]}
 */
function tags(html) {
  /** @type {Tag[]} */
  const aus = [];
  const attribut = /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      const ende = html.indexOf('-->', lt + 4);
      i = ende < 0 ? html.length : ende + 3;
      continue;
    }
    const kopf = /^<([A-Za-z][A-Za-z0-9-]*)/.exec(html.slice(lt, lt + 80));
    if (kopf === null) {
      i = lt + 1;
      continue;
    }
    const name = (kopf[1] ?? '').toLowerCase();
    /** @type {Map<string, string>} */
    const attribute = new Map();
    let j = lt + kopf[0].length;
    while (j < html.length) {
      while (j < html.length && /\s|\//.test(html[j] ?? '')) j += 1;
      if (html[j] === '>' || j >= html.length) break;
      attribut.lastIndex = j;
      const a = attribut.exec(html);
      if (a === null || a[0] === '') {
        j += 1;
        continue;
      }
      const schluessel = (a[1] ?? '').toLowerCase();
      if (!attribute.has(schluessel))
        attribute.set(schluessel, entitaeten(a[2] ?? a[3] ?? a[4] ?? ''));
      j = attribut.lastIndex;
    }
    j = Math.min(j + 1, html.length);
    let inhalt = '';
    if (name === 'script' || name === 'style') {
      const schluss = new RegExp(`</${name}`, 'ig');
      schluss.lastIndex = j;
      const s = schluss.exec(html);
      const ende = s === null ? html.length : s.index;
      inhalt = html.slice(j, ende);
      j = ende;
    }
    aus.push({ name, attribute, inhalt });
    i = j;
  }
  return aus;
}

/**
 * Freigaberegeln der fertigen Einzeldatei (Vertrag E1-01b, Notiz Runde 2 Nr 6; Regeln von
 * tools/verify-release.mjs); rein, liefert die Befunde in fester Reihenfolge (leer = freigegeben).
 * @param {string} html
 * @param {string} csp erwartete CSP (suiteCsp)
 * @returns {string[]}
 */
export function pruefeEinzeldatei(html, csp) {
  /** @type {string[]} */
  const befunde = [];
  const alle = tags(html);
  const meta = alle.find(
    (t) =>
      t.name === 'meta' &&
      (t.attribute.get('http-equiv') ?? '').toLowerCase() === 'content-security-policy',
  );
  if (meta === undefined) befunde.push('CSP-Meta fehlt');
  else if (meta.attribute.get('content') !== csp)
    befunde.push('CSP weicht von der CSP der Suite ab');
  const wurzel = alle.find((t) => t.name === 'html');
  if (wurzel?.attribute.get('data-offline') !== 'true') {
    befunde.push('data-offline ist nicht «true»');
  }
  const skripte = alle.filter((t) => t.name === 'script');
  if (skripte.length !== 1) {
    befunde.push(`nicht genau ein Skript (${String(skripte.length)})`);
  }
  if (skripte.some((t) => t.attribute.has('src'))) befunde.push('Skript mit src');
  const extern = alle.filter(
    (t) =>
      t.attribute.has('src') ||
      (t.name === 'link' && t.attribute.has('href')) ||
      t.name === 'iframe' ||
      t.name === 'object' ||
      t.name === 'embed',
  );
  if (extern.length > 0) {
    befunde.push(
      `externe Laufzeit-Ressource ([src], link[href], iframe, object, embed): ${String(extern.length)}`,
    );
  }
  if (/<script[^>]*type=["']?module/i.test(html)) befunde.push('Skript mit type="module"');
  if (/sourceMappingURL=/.test(html)) befunde.push('sourceMappingURL enthalten');
  const konsole = new RegExp(`\\b${KONSOLE}\\s*(?:\\.|\\[)`);
  if (skripte.some((t) => konsole.test(t.inhalt))) {
    befunde.push(`Konsolen-API im Skript (${KONSOLE}. bzw. ${KONSOLE}[)`);
  }
  const stile = alle.filter((t) => t.name === 'style').map((t) => t.inhalt);
  if (stile.some((s) => /@import/i.test(s))) befunde.push('@import im Stil');
  if (stile.some((s) => /url\(\s*["']?\s*https?:/i.test(s))) befunde.push('url(http…) im Stil');
  const lizenz = alle.some(
    (t) => t.name === 'template' && t.attribute.get('id') === 'application-licenses',
  );
  if (!lizenz) befunde.push('Lizenzblock <template id="application-licenses"> fehlt');
  return befunde;
}

/**
 * Liegt `pfad` in `ordner` (beide absolut, gleiche Schreibweise)?
 * @param {string} pfad
 * @param {string} ordner
 * @returns {boolean}
 */
function liegtIn(pfad, ordner) {
  const rel = relative(ordner, pfad);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Pfad relativ zu `basis` mit «/».
 * @param {string} basis
 * @param {string} pfad
 * @returns {string}
 */
function rel(basis, pfad) {
  return relative(basis, pfad).split(sep).join('/');
}

/**
 * Echter Pfad (Verknüpfungen aufgelöst); null, wenn er nicht besteht.
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
 * @typedef {object} Modul
 * @property {string} anzeige repo-relativ; Pakete als «node_modules/<Teil nach dem letzten /node_modules/>»
 * @property {string | null} paket npm-Paketname
 * @property {string | null} paketOrdner echter Ordner des Pakets
 * @property {string | null} relCwd echter Pfad relativ zu cwd (null ausserhalb von cwd)
 * @property {string} pfad echter absoluter Pfad
 */

/**
 * Ordnet ein gebündeltes Modul ein (echte Pfade, Notiz Runde 2 Nr 7); null, wenn es weder unter cwd noch
 * unter dem (echten) node_modules von cwd liegt.
 * @param {string} echterPfad
 * @param {string} cwdEcht
 * @param {string | null} nmEcht
 * @returns {Modul | null}
 */
function einordnen(echterPfad, cwdEcht, nmEcht) {
  const imRepo = liegtIn(echterPfad, cwdEcht);
  const imNm = nmEcht !== null && liegtIn(echterPfad, nmEcht);
  if (!imRepo && !imNm) return null;
  const relCwd = imRepo ? rel(cwdEcht, echterPfad) : null;
  // Basis: cwd bzw. bei einem verknüpften node_modules dessen echter Ordner (wie «node_modules/…»).
  const basis = imRepo ? cwdEcht : /** @type {string} */ (nmEcht);
  const relativ = imRepo ? (relCwd ?? '') : `node_modules/${rel(basis, echterPfad)}`;
  const schraeg = `/${relativ}`;
  const letzter = schraeg.lastIndexOf('/node_modules/');
  if (letzter < 0) {
    return { anzeige: relativ, paket: null, paketOrdner: null, relCwd, pfad: echterPfad };
  }
  const teil = schraeg.slice(letzter + '/node_modules/'.length);
  const stuecke = teil.split('/');
  const name = stuecke[0]?.startsWith('@') ? stuecke.slice(0, 2).join('/') : (stuecke[0] ?? '');
  const vorPaket = schraeg.slice(1, letzter + '/node_modules'.length).split('/');
  const paketOrdner = imRepo
    ? join(cwdEcht, ...vorPaket, ...name.split('/'))
    : join(basis, ...vorPaket.slice(1), ...name.split('/'));
  return { anzeige: `node_modules/${teil}`, paket: name, paketOrdner, relCwd, pfad: echterPfad };
}

/**
 * Echter Pfad auch für eine fehlende Datei: der echte Pfad des tiefsten vorhandenen Vorfahren, dazu der Rest
 * (so führt auch eine fehlende Datei hinter einer Verknüpfung in ihren wirklichen Ordner).
 * @param {string} pfad absolut
 * @returns {{ pfad: string; vorhanden: boolean }}
 */
function echtOderLexikalisch(pfad) {
  const e = echt(pfad);
  if (e !== null) return { pfad: e, vorhanden: true };
  /** @type {string[]} */
  const rest = [];
  let ordner = pfad;
  for (;;) {
    const oben = dirname(ordner);
    rest.unshift(basename(ordner));
    if (oben === ordner) return { pfad, vorhanden: false };
    const eo = echt(oben);
    if (eo !== null) return { pfad: join(eo, ...rest), vorhanden: false };
    ordner = oben;
  }
}

/**
 * Echte Vorfahren-Ordner (ohne den Ordner selbst, bis zur Laufwerkswurzel) von `realpath(cwd)` und
 * `resolve(cwd)`, in Kleinschreibung (Änderungsnotiz Lese-Schutz Workspace-Markierungen Nr 2). Für jeden
 * lexikalischen Vorfahren von `resolve(cwd)` zählt auch sein echter Pfad.
 * @param {string[]} startOrdner
 * @returns {Set<string>}
 */
function vorfahrenOrdner(startOrdner) {
  /** @type {Set<string>} */
  const vorfahren = new Set();
  for (const start of startOrdner) {
    let ordner = start;
    for (;;) {
      const oben = dirname(ordner);
      if (oben === ordner) break;
      vorfahren.add(oben.toLowerCase());
      const obenEcht = echt(oben);
      if (obenEcht !== null) vorfahren.add(obenEcht.toLowerCase());
      ordner = oben;
    }
  }
  return vorfahren;
}

/**
 * Lese-Schutz (Ergänzung nach Test-Review CR1 Nr 2): bewertet die beim Bau gelesenen Pfade. Erlaubt sind
 * Pfade unter realpath(cwd) ausser den verbotenen Ordnern, unter realpath(cwd/node_modules) und unter
 * `werkzeugNodeModules` (node_modules, aus dem Vite geladen wird). Fehlende Pfade zählen nur in verbotenen
 * Ordnern. Meldungen ohne Inhalt; Pfade repo-relativ, ausserhalb der Wurzeln ohne Pfad. Zusätzlich
 * zulässig, aber nie in `zulaessig` (keine Quelle): Workspace-Markierungen direkt in einem echten
 * Vorfahren-Ordner von realpath(cwd) bzw. resolve(cwd), Gross/Klein egal (Änderungsnotiz Lese-Schutz
 * Workspace-Markierungen Nr 2, 3; Orchestrator-Zeile a).
 * @param {string[]} pfade absolut oder relativ zu process.cwd()
 * @param {{ cwd: string; werkzeugNodeModules: string; versioniert: boolean }} opts
 * @returns {{ befunde: string[]; zulaessig: string[] }}
 */
export function pruefeLesezugriffe(pfade, opts) {
  const cwd = resolve(opts.cwd);
  const cwdEcht = echt(cwd) ?? cwd;
  const nmEcht = echt(join(cwd, 'node_modules'));
  const werkzeug = echt(resolve(opts.werkzeugNodeModules)) ?? resolve(opts.werkzeugNodeModules);
  const vorfahren = vorfahrenOrdner([cwdEcht, cwd]);
  /** @type {Set<string>} */
  const befunde = new Set();
  /** @type {Set<string>} */
  const zulaessig = new Set();
  for (const roh of new Set(pfade.map((p) => resolve(p)))) {
    const { pfad, vorhanden } = echtOderLexikalisch(roh);
    /** @type {string | null} */
    let relCwd = null;
    for (const basis of [cwdEcht, cwd]) {
      if (relCwd === null && liegtIn(pfad, basis)) relCwd = rel(basis, pfad);
    }
    const ordner =
      relCwd === null ? undefined : VERBOTENE_ORDNER.find((o) => relCwd?.startsWith(o));
    if (relCwd !== null && ordner !== undefined) {
      befunde.add(`Datei unter ${ordner} beim Bau gelesen: ${zeigePfad(relCwd)}`);
      continue;
    }
    if (!vorhanden) continue;
    if (
      relCwd === null &&
      WORKSPACE_MARKIERUNGEN.has(basename(pfad).toLowerCase()) &&
      vorfahren.has(dirname(pfad).toLowerCase())
    ) {
      continue;
    }
    const imNm = nmEcht !== null && liegtIn(pfad, nmEcht);
    if (!imNm && !liegtIn(pfad, werkzeug) && relCwd === null) {
      befunde.add('Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen');
      continue;
    }
    if (!imNm && opts.versioniert && relCwd?.startsWith(DURCHSTICH)) {
      befunde.add(`Durchstich-Datei beim Bau gelesen: ${zeigePfad(relCwd)}`);
      continue;
    }
    let datei = false;
    try {
      datei = statSync(pfad).isFile();
    } catch {
      datei = false;
    }
    if (datei) zulaessig.add(pfad);
  }
  return { befunde: [...befunde], zulaessig: [...zulaessig] };
}

/**
 * Ende des Inhalts einer data:-URI je nach dem Zeichen davor (Anführungszeichen, Klammer, sonst Leerraum).
 * @param {string} vor
 * @returns {RegExp}
 */
function dataEnde(vor) {
  if (vor === '"') return /(?<!\\)"/;
  if (vor === "'") return /(?<!\\)'/;
  if (vor === '`') return /(?<!\\)`|\$\{/;
  return /[\s"'`)\]}<>]/;
}

/**
 * Prüft die data:-URIs eines Skript- bzw. Stiltexts der fertigen Seite (Ergänzung nach Test-Review CR1
 * Nr 2): jede data:-URI direkt nach einem Anführungszeichen, «(», «,», «=» oder Leerraum, mit Medientyp
 * typ/untertyp (oder ohne) und nicht leerem Inhalt. Zulässig ist sie, wenn der SHA-256 (hex, klein) des
 * dekodierten Inhalts in `zulaessig.sha256` steht oder ihr Inhaltstext wörtlich in einem Quelltext steht.
 * Befunde ohne Inhalt: «data:-URI unbekannter Herkunft: <medientyp|ohne>, <n> Bytes».
 * @param {string} text
 * @param {{ sha256: ReadonlySet<string>; quelltexte: readonly string[] }} zulaessig
 * @returns {string[]}
 */
export function pruefeDataUris(text, zulaessig) {
  /** @type {string[]} */
  const befunde = [];
  const kopf =
    /(?<=(["'`(,=\s]))data:([a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9!#$&^_.+-]+)?((?:;[a-z0-9!#$&^_.+-]+=[^;,"'`()\s]*)*)(;base64)?,/gi;
  for (const m of text.matchAll(kopf)) {
    const start = (m.index ?? 0) + m[0].length;
    const rest = text.slice(start);
    const ende = dataEnde(m[1] ?? '').exec(rest);
    const inhalt = ende === null ? rest : rest.slice(0, ende.index);
    if (inhalt === '') continue;
    const base64 = m[4] !== undefined;
    /** @type {Buffer} */
    let bytes;
    /** @type {string | null} */
    let klartext = null;
    if (base64) {
      bytes = Buffer.from(inhalt.replace(/\s+/g, ''), 'base64');
    } else {
      try {
        klartext = decodeURIComponent(inhalt);
      } catch {
        klartext = null;
      }
      bytes = Buffer.from(klartext ?? inhalt, 'utf8');
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    const bekannt =
      zulaessig.sha256.has(hash) ||
      zulaessig.quelltexte.some(
        (q) => q.includes(inhalt) || (klartext !== null && klartext !== '' && q.includes(klartext)),
      );
    if (!bekannt) {
      befunde.push(
        `data:-URI unbekannter Herkunft: ${m[2] === undefined ? 'ohne' : m[2]}, ${String(bytes.length)} Bytes`,
      );
    }
  }
  return befunde;
}

/**
 * Normalform, in der Vite 8.3.0 eine SVG-Datei als data:-URI einbettet (svgToDataURL; Orchestrator-Zeile
 * TR-E101b-19); null, wenn Vite sie als Base64 einbettet (dann gilt der SHA-256 der Datei).
 * @param {Buffer} inhalt
 * @returns {string | null} dekodierter Inhalt der Normalform
 */
function svgNormalform(inhalt) {
  const text = inhalt.toString();
  if (
    text.includes('<text') ||
    text.includes('<foreignObject') ||
    /"[^"']*'[^"]*"|'[^'"]*"[^']*'/.test(text)
  ) {
    return null;
  }
  const kodiert = text
    .trim()
    .replaceAll(/>\s+</g, '><')
    .replaceAll('"', "'")
    .replaceAll('%', '%25')
    .replaceAll('#', '%23')
    .replaceAll('<', '%3c')
    .replaceAll('>', '%3e')
    .replaceAll(/\s+/g, '%20');
  try {
    return decodeURIComponent(kodiert);
  } catch {
    return null;
  }
}

/**
 * @typedef {object} RohVerweis
 * @property {'verweis' | 'nicht-relativ' | 'dynamisch' | 'nicht-auffindbar' | 'stil-import' | 'worker'} art
 * @property {string} importeur absoluter Pfad der Datei mit dem Verweis bzw. der Kennung
 * @property {string} [ziel] aufgelöster absoluter Pfad (nur bei «verweis»)
 */

/**
 * Wertet einen Verweis aus Stil oder Skript aus (Notiz CR1 Nr 1 «Auflösung»; Ergänzung Nr 1) und legt das
 * Rohergebnis ab; liest keine Datei.
 * @param {string} roh Verweis, ggf. in Anführungszeichen
 * @param {string} importeur
 * @param {boolean} stil
 * @param {RohVerweis[]} liste
 */
function verweis(roh, importeur, stil, liste) {
  let s = roh.trim();
  const q = s[0];
  if ((q === '"' || q === "'" || q === '`') && s.length >= 2 && s.endsWith(q)) s = s.slice(1, -1);
  // Wie Vite (doUrlReplace): in Stilen maskierte Zeichen ohne «\».
  if (stil) s = s.replace(/\\(\W)/g, '$1');
  s = s.trim();
  if (/^data:/i.test(s) || s.startsWith('#')) return;
  if (s.includes('${')) {
    liste.push({ art: 'dynamisch', importeur });
    return;
  }
  if (!s.startsWith('./') && !s.startsWith('../')) {
    liste.push({ art: 'nicht-relativ', importeur });
    return;
  }
  const ohneAbfrage = s.split(/[?#]/)[0] ?? '';
  let dekodiert;
  try {
    dekodiert = decodeURI(ohneAbfrage);
  } catch {
    liste.push({ art: 'nicht-auffindbar', importeur });
    return;
  }
  liste.push({ art: 'verweis', importeur, ziel: resolve(dirname(importeur), dekodiert) });
}

/**
 * Kandidaten in image-set() wie Vite (parseSrcset): Zeichenketten und nackte Angaben; url() erfasst bereits
 * die url()-Suche, Funktionen wie gradient() verarbeitet Vite nicht.
 * @param {string} inhalt
 * @returns {string[]}
 */
function imageSetKandidaten(inhalt) {
  const kandidat =
    /(?:^|\s|(?<=,))(?<url>[\w-]+\([^)]*\)|"[^"]*"|'[^']*'|[^,]\S*[^,])\s*(?:\s(?<descriptor>[\w.][^,]+))?(?:,|$)/g;
  const normal = inhalt
    .trim()
    .replace(/(?: |\\t|\\n|\\f|\\r)+/g, ' ')
    .replace(/,\s+/, ', ')
    .replaceAll(/\s+/g, ' ');
  /** @type {string[]} */
  const aus = [];
  for (const m of normal.matchAll(kandidat)) {
    const url = (m.groups?.url ?? '').trim();
    if (url === '') continue;
    if (/^url\(/i.test(url) || CSS_NICHT_VERARBEITET_RE.test(url)) continue;
    aus.push(url);
  }
  return aus;
}

/**
 * Plugin wap-einzeldatei-verweise (Notiz CR1 Nr 1, Ergänzung Nr 1): sammelt in `transform` (enforce pre) die
 * Verweise jeder Kennung ausser «\0…», nicht absoluten Kennungen und der Abfrage raw; wirft nicht und liest
 * keine Datei. Die Auswertung folgt nach dem Bau.
 * @param {RohVerweis[]} liste
 * @returns {import('vite').Plugin}
 */
function verweisPlugin(liste) {
  return {
    name: 'wap-einzeldatei-verweise',
    enforce: 'pre',
    transform(code, id) {
      if (id.startsWith('\0')) return null;
      const frage = id.indexOf('?');
      const pfad = frage < 0 ? id : id.slice(0, frage);
      const abfrage = frage < 0 ? '' : id.slice(frage + 1);
      if (!isAbsolute(pfad)) return null;
      if (WORKER_ABFRAGE_RE.test(id)) liste.push({ art: 'worker', importeur: pfad });
      if (/(?:^|&)raw(?:[&=]|$)/.test(abfrage)) return null;
      if (CSS_LANGS_RE.test(id)) {
        const text = code.replace(/\/\*[\s\S]*?\*\//g, '');
        if (STIL_IMPORT_RE.test(text)) liste.push({ art: 'stil-import', importeur: pfad });
        for (const m of text.matchAll(CSS_URL_RE)) verweis(m[1] ?? '', pfad, true, liste);
        for (const m of text.matchAll(CSS_IMAGE_SET_RE)) {
          for (const k of imageSetKandidaten(m[1] ?? '')) verweis(k, pfad, true, liste);
        }
      } else if (SKRIPT_RE.test(pfad)) {
        for (const m of code.matchAll(IMPORT_META_URL_RE)) verweis(m[1] ?? '', pfad, false, liste);
        if (WORKER_AUFRUF_RE.test(code)) liste.push({ art: 'worker', importeur: pfad });
      }
      return null;
    },
  };
}

/**
 * Pfad aus dem ersten Argument einer fs-Funktion (Zeichenkette, Buffer, file:-URL); sonst null.
 * @param {unknown} a
 * @returns {string | null}
 */
function pfadVon(a) {
  try {
    if (typeof a === 'string') return resolve(a);
    if (Buffer.isBuffer(a)) return resolve(a.toString('utf8'));
    if (a instanceof URL) return a.protocol === 'file:' ? resolve(fileURLToPath(a)) : null;
  } catch {
    return null;
  }
  return null;
}

/**
 * Führt `fn` mit Protokoll aller Dateilesezugriffe des Prozesses aus (Ergänzung Nr 2 «Protokoll»): ersetzt
 * die Lesefunktionen von fs und fs/promises, gleicht die ESM-Exporte an und stellt im finally die Originale
 * wieder her.
 * @template T
 * @param {string[]} protokoll
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function mitLeseprotokoll(protokoll, fn) {
  /** @type {[Record<string, unknown>, string, unknown][]} */
  const originale = [];
  /**
   * @param {Record<string, unknown>} ziel
   * @param {string} name
   */
  const ersetze = (ziel, name) => {
    const original = ziel[name];
    if (typeof original !== 'function') return;
    originale.push([ziel, name, original]);
    /**
     * @this {unknown}
     * @param {unknown[]} args
     * @returns {unknown}
     */
    const ersatz = function (...args) {
      const p = pfadVon(args[0]);
      if (p !== null) protokoll.push(p);
      return Reflect.apply(original, this, args);
    };
    ziel[name] = ersatz;
  };
  try {
    for (const n of FS_LESEN) ersetze(FS, n);
    for (const n of FSP_LESEN) ersetze(FS.promises, n);
    syncBuiltinESMExports();
    return await fn();
  } finally {
    for (const [ziel, name, original] of originale.reverse()) ziel[name] = original;
    syncBuiltinESMExports();
  }
}

/**
 * Echter node_modules-Ordner, aus dem Vite geladen wird (Ergänzung Nr 2, `werkzeugNodeModules`); ist Vite
 * nicht auffindbar (der Bau ist dann ohnehin rot), das node_modules von `cwd`.
 * @param {string} cwd
 * @returns {string}
 */
function werkzeugNodeModules(cwd) {
  try {
    const datei = fileURLToPath(import.meta.resolve('vite'));
    const e = echt(datei) ?? datei;
    const teile = e.split(sep);
    const i = teile.lastIndexOf('node_modules');
    return i < 0 ? dirname(e) : teile.slice(0, i + 1).join(sep);
  } catch {
    return join(cwd, 'node_modules');
  }
}

/** Bauten im selben Prozess laufen nacheinander (Protokoll gilt für den ganzen Prozess). */
/** @type {Promise<void>} */
let warteschlange = Promise.resolve();

/**
 * Lizenzdatei in `ordner` nach Muster; null, wenn keine.
 * @param {string} ordner
 * @param {RegExp} muster
 * @returns {string | null}
 */
function lizenzIn(ordner, muster) {
  try {
    const datei = readdirSync(ordner)
      .sort()
      .find((d) => muster.test(d));
    return datei === undefined ? null : join(ordner, datei);
  } catch {
    return null;
  }
}

/**
 * Text für HTML (Inhalt eines Elements).
 * @param {string} text
 * @returns {string}
 */
function html(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Wert für ein HTML-Attribut in doppelten Anführungszeichen.
 * @param {string} text
 * @returns {string}
 */
function attributWert(text) {
  return html(text).replaceAll('"', '&quot;');
}

/**
 * Baut die Einzeldatei; schreibt `outFile` nur, wenn alle Prüfungen grün sind. Bauten im selben Prozess
 * laufen nacheinander (Lese-Schutz, Ergänzung nach Test-Review CR1 Nr 2).
 * @param {{ cwd: string; entry: string; outFile: string; titel: string }} opts
 * @returns {Promise<Schritt & { module: string[]; bytes: number }>}
 */
export function buildEinzeldatei(opts) {
  const lauf = warteschlange.then(() => baue(opts));
  warteschlange = lauf.then(
    () => undefined,
    () => undefined,
  );
  return lauf;
}

/**
 * @typedef {{ type: string; fileName: string; code?: string; source?: unknown; moduleIds?: string[]; modules?: Record<string, unknown> }} Ausgabe
 */

/**
 * @param {{ cwd: string; entry: string; outFile: string; titel: string }} opts
 * @returns {Promise<Schritt & { module: string[]; bytes: number }>}
 */
async function baue(opts) {
  const beginn = Date.now();
  const cwd = resolve(opts.cwd);
  const entry = resolve(cwd, opts.entry);
  const outFile = resolve(cwd, opts.outFile);
  /** @type {string[]} */
  let module = [];
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt & { module: string[]; bytes: number }}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: ID,
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    module,
    bytes: 0,
  });
  const cwdEcht = echt(cwd);
  if (cwdEcht === null) return rotSchritt(`Arbeitsordner fehlt: ${zeigePfad(cwd)}`, 'cwd prüfen');
  const entryEcht = echt(entry);
  if (entryEcht === null) {
    return rotSchritt(
      `Einstieg fehlt: ${zeigePfad(rel(cwd, entry))}`,
      'Pfad des Einstiegs (--entry) prüfen',
    );
  }
  if (!liegtIn(entry, cwd) || !liegtIn(entryEcht, cwdEcht)) {
    return rotSchritt(
      'Einstieg liegt ausserhalb des Arbeitsordners',
      'Einstieg innerhalb des Repos anlegen (z.B. tests/wap-e2e/harness/<name>.tsx)',
    );
  }
  if (extname(outFile) !== '.html') {
    return rotSchritt(
      `Ausgabe ist keine .html-Datei: ${zeigePfad(rel(cwd, outFile))}`,
      'Ausgabe mit Endung .html wählen (z.B. test-results/wap/einzeldatei/<name>.html)',
    );
  }
  const dist = join(cwd, 'dist');
  if (liegtIn(outFile, dist) || outFile === dist) {
    return rotSchritt(
      'Ausgabe unter dist/ (Ordner der ausgelieferten Suite)',
      'Ausgabe ausserhalb von dist/ wählen (z.B. test-results/wap/einzeldatei/)',
    );
  }
  let csp;
  try {
    csp = suiteCsp(cwd);
  } catch (e) {
    return rotSchritt(
      e instanceof Error ? e.message : String(e),
      'tools/build-offline.mjs der Suite bereitstellen',
    );
  }
  const appLizenz = join(cwd, 'LICENSE');
  if (!existsSync(appLizenz)) {
    return rotSchritt('Lizenzdatei fehlt: LICENSE der Anwendung', 'LICENSE im Repo bereitstellen');
  }

  // Bau mit Plugin wap-einzeldatei-verweise und Lese-Schutz. Während des Baus wird nichts formatiert und
  // keine Datei gelesen (zeigePfad liest die Sperrliste): ausgewertet wird erst danach.
  /** @type {RohVerweis[]} */
  const rohVerweise = [];
  /** @type {string[]} */
  const gelesen = [];
  /** @type {Ausgabe[]} */
  let ausgaben = [];
  /** @type {string | null} */
  let baufehler = null;
  try {
    const [{ build }, { default: react }] = await Promise.all([
      import('vite'),
      import('@vitejs/plugin-react'),
    ]);
    // Immer Produktionsmodus, unabhängig vom geerbten NODE_ENV (Orchestrator-Zeile 05.10.2026, V1a: sonst
    // bündelt Vite jsxDEV mit der Produktions-React-Bibliothek). NODE_ENV wird danach exakt
    // wiederhergestellt, auch wenn es vorher nicht gesetzt war (Orchestrator-Zeile c).
    const nodeEnvVorher = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    /** @type {unknown} */
    let roh;
    try {
      roh = await mitLeseprotokoll(gelesen, () =>
        build({
          mode: 'production',
          configFile: false,
          root: cwd,
          base: './',
          logLevel: 'silent',
          clearScreen: false,
          publicDir: false,
          envDir: false,
          plugins: [verweisPlugin(rohVerweise), react()],
          css: { postcss: { plugins: [] } },
          define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
            ...Object.fromEntries(KONSOLEN_METHODEN.map((m) => [`${KONSOLE}.${m}`, '(() => {})'])),
          },
          build: {
            write: false,
            sourcemap: false,
            cssCodeSplit: false,
            assetsInlineLimit: Number.MAX_SAFE_INTEGER,
            rolldownOptions: {
              output: { minify: { compress: { dropConsole: true } } },
            },
            lib: { entry, name: 'WapEinzeldatei', formats: ['iife'] },
          },
        }),
      );
    } finally {
      if (nodeEnvVorher === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
      else process.env.NODE_ENV = nodeEnvVorher;
    }
    const ergebnisse = /** @type {{ output: Ausgabe[] }[]} */ (
      /** @type {unknown} */ (Array.isArray(roh) ? roh : [roh])
    );
    ausgaben = ergebnisse.flatMap((r) => (Array.isArray(r.output) ? r.output : []));
  } catch (e) {
    const grund = e instanceof Error ? (e.message.split(/\r?\n/)[0] ?? '').slice(0, 300) : '';
    baufehler = grund || 'ohne Meldung';
  }
  const skripte = ausgaben.filter((o) => o.type === 'chunk');
  const stile = ausgaben.filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'));
  const versioniert = liegtIn(outFile, cwd) && !liegtIn(outFile, join(cwd, 'test-results'));
  const nmEcht = echt(join(cwd, 'node_modules'));

  /**
   * Anzeige einer Datei mit Verweis (repo-relativ; ausserhalb des Arbeitsordners ohne Pfad).
   * @param {string} pfad
   * @returns {string}
   */
  const anzeige = (pfad) => {
    const m = einordnen(echt(pfad) ?? resolve(pfad), cwdEcht, nmEcht);
    return m === null ? '(Datei ausserhalb des Arbeitsordners)' : zeigePfad(m.anzeige);
  };

  // (1) Plugin: Verweise wie Module (Notiz Runde 2 Nr 7), fail closed für nicht prüfbare Formen.
  /** @type {Modul[]} */
  const eingeordnet = [];
  /** @type {string[]} */
  const pluginBefunde = [];
  /** @type {Set<string>} zulässige Ziele von Verweisen (echte Pfade) */
  const verweisDateien = new Set();
  for (const v of rohVerweise) {
    if (v.art === 'nicht-relativ')
      pluginBefunde.push(`Verweis nicht relativ: ${anzeige(v.importeur)}`);
    else if (v.art === 'dynamisch')
      pluginBefunde.push(`Verweis dynamisch: ${anzeige(v.importeur)}`);
    else if (v.art === 'nicht-auffindbar') {
      pluginBefunde.push(`Verweis nicht auffindbar: ${anzeige(v.importeur)}`);
    } else if (v.art === 'stil-import') {
      pluginBefunde.push(`@import oder composes in Stil nicht erlaubt: ${anzeige(v.importeur)}`);
    } else if (v.art === 'worker') {
      pluginBefunde.push(`Worker in Einzeldatei nicht erlaubt: ${anzeige(v.importeur)}`);
    } else {
      const e = echt(v.ziel ?? '');
      if (e === null) {
        pluginBefunde.push(`Verweis nicht auffindbar: ${anzeige(v.importeur)}`);
        continue;
      }
      const m = einordnen(e, cwdEcht, nmEcht);
      if (m === null) {
        pluginBefunde.push(`Verweis ausserhalb des Arbeitsordners: ${anzeige(v.importeur)}`);
        continue;
      }
      const ordner =
        m.relCwd === null ? undefined : VERBOTENE_ORDNER.find((o) => m.relCwd?.startsWith(o));
      if (m.relCwd !== null && ordner !== undefined) {
        pluginBefunde.push(`Verweis unter ${ordner}: ${zeigePfad(m.relCwd)}`);
      } else if (versioniert && m.relCwd?.startsWith(DURCHSTICH)) {
        pluginBefunde.push(`Durchstich-Verweis in versionierter Ausgabe: ${zeigePfad(m.relCwd)}`);
      } else {
        eingeordnet.push(m);
        verweisDateien.add(m.pfad);
      }
    }
  }
  pluginBefunde.sort();

  // (2) Module: echte Pfade, nur innerhalb von cwd oder seinem node_modules (Notiz Runde 2 Nr 7).
  /** @type {string[]} */
  const modulBefunde = [];
  /** @type {Set<string>} */
  const modulDateien = new Set();
  for (const skript of skripte) {
    for (const id of skript.moduleIds ?? Object.keys(skript.modules ?? {})) {
      const sauber = id.split('?')[0] ?? '';
      if (sauber.startsWith('\0') || !isAbsolute(sauber)) continue;
      const e = echt(sauber);
      if (e === null) {
        modulBefunde.push('Modul nicht auffindbar');
        continue;
      }
      const m = einordnen(e, cwdEcht, nmEcht);
      if (m === null) {
        modulBefunde.push('Modul ausserhalb des Arbeitsordners');
        continue;
      }
      const ordner =
        m.relCwd === null ? undefined : VERBOTENE_ORDNER.find((o) => m.relCwd?.startsWith(o));
      if (m.relCwd !== null && ordner !== undefined) {
        modulBefunde.push(`Modul unter ${ordner}: ${zeigePfad(m.relCwd)}`);
      } else if (versioniert && m.relCwd?.startsWith(DURCHSTICH)) {
        modulBefunde.push(`Durchstich-Modul in versionierter Ausgabe: ${zeigePfad(m.relCwd)}`);
      } else {
        modulDateien.add(m.pfad);
      }
      eingeordnet.push(m);
    }
  }
  module = [...new Set(eingeordnet.map((m) => m.anzeige))].sort();

  // (3) Lese-Schutz: jeder Dateilesezugriff des Prozesses während des Baus.
  const lese = pruefeLesezugriffe(gelesen, {
    cwd,
    werkzeugNodeModules: werkzeugNodeModules(cwd),
    versioniert,
  });

  // (4) data:-URIs der fertigen Seite: bekannt über den SHA-256 zulässiger Dateien (SVG auch in der
  // Normalform von Vite) oder wörtlich im Quelltext zulässiger Module.
  const zulaessigeDateien = new Set([...lese.zulaessig, ...modulDateien, ...verweisDateien]);
  /** @type {Set<string>} */
  const sha256 = new Set();
  /** @type {string[]} */
  const quelltexte = [];
  for (const datei of zulaessigeDateien) {
    /** @type {Buffer} */
    let inhalt;
    try {
      inhalt = readFileSync(datei);
    } catch {
      continue;
    }
    sha256.add(createHash('sha256').update(inhalt).digest('hex'));
    if (datei.toLowerCase().endsWith('.svg')) {
      const normal = svgNormalform(inhalt);
      if (normal !== null) {
        sha256.add(createHash('sha256').update(Buffer.from(normal, 'utf8')).digest('hex'));
      }
    }
    if (modulDateien.has(datei)) quelltexte.push(inhalt.toString('utf8'));
  }
  const seitenText = [
    ...skripte.map((s) => s.code ?? ''),
    ...ausgaben
      .filter((o) => o.type === 'asset' && typeof o.source === 'string')
      .map((o) => String(o.source)),
  ].join('\n');
  const dataBefunde = pruefeDataUris(seitenText, { sha256, quelltexte });

  const verstoesse = [
    ...new Set([...pluginBefunde, ...modulBefunde, ...lese.befunde, ...dataBefunde]),
  ];
  if (verstoesse.length > 0) {
    return rotSchritt(
      `Unzulässige Module: ${kurzeListe(verstoesse)}`,
      'Nur Module und Verweise aus dem Repo bündeln (nie reference/, .qa/, fixtures-private/, test-results/; keine @import, Worker oder nicht relativen Verweise); Durchstich-Fixtures nur in Ausgaben unter test-results/',
    );
  }
  if (baufehler !== null) {
    return rotSchritt(
      `Vite-Bau gescheitert: ${baufehler}`,
      'Einstieg und seine Module reparieren (Syntax, Importe)',
    );
  }
  const skript = skripte[0];
  if (
    skripte.length !== 1 ||
    skript === undefined ||
    ausgaben.length !== skripte.length + stile.length
  ) {
    return rotSchritt(
      'Bau ergibt nicht genau ein Skript und Stile (weitere Ausgabedateien)',
      'Assets einbetten bzw. dynamische Importe entfernen',
    );
  }

  // Lizenzblock: App, gebündelte npm-Pakete, Lizenzen neben Asset-Dateien unter src/assets/ (Module,
  // Verweise und beim Bau gelesene Dateien). npm-Pakete über npmLizenz: eigene LICENSE* oder geprüfter
  // Eintrag der Ersatzliste (Notiz Lizenzen ohne LICENSE-Datei Nr 5).
  const hinweise = [`WK Util Suite\n${readFileSync(appLizenz, 'utf8')}`];
  /** @type {string[]} */
  const fehlend = [];
  /** @type {string[]} */
  const ersatzBefunde = [];
  let npmBefund = false;
  /** @type {Map<string, string>} */
  const pakete = new Map();
  for (const m of eingeordnet) {
    if (m.paket !== null && m.paketOrdner !== null && !pakete.has(m.paket)) {
      pakete.set(m.paket, m.paketOrdner);
    }
  }
  for (const [name, ordner] of [...pakete].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const lizenz = npmLizenz({ cwd, paket: name, ordner });
    if (lizenz.ok) {
      hinweise.push(`${name}\n${lizenz.text}`);
      continue;
    }
    npmBefund = true;
    if (lizenz.art === 'fehlt') fehlend.push(name);
    else if (lizenz.art === 'ersatz' || !ersatzBefunde.includes(lizenz.fehler)) {
      ersatzBefunde.push(lizenz.fehler);
    }
  }
  const gelesenUnterAssets = lese.zulaessig
    .filter((p) => liegtIn(p, cwdEcht) && !ASSET_LIZENZ.test(basename(p)))
    .map((p) => rel(cwdEcht, p))
    .filter((r) => r.startsWith('src/assets/'));
  const assetOrdner = [
    ...new Set(
      [
        ...eingeordnet.map((m) => m.relCwd ?? '').filter((r) => r.startsWith('src/assets/')),
        ...gelesenUnterAssets,
      ].map((r) => dirname(r)),
    ),
  ].sort();
  for (const ordner of assetOrdner) {
    const datei = lizenzIn(join(cwd, ...ordner.split('/')), ASSET_LIZENZ);
    if (datei === null) fehlend.push(zeigePfad(ordner));
    else hinweise.push(`${ordner}\n${readFileSync(datei, 'utf8')}`);
  }
  if (fehlend.length > 0 || ersatzBefunde.length > 0) {
    const schritt =
      'Lizenzdatei ergänzen (npm-Paket: LICENSE*, Asset unter src/assets/: OFL.txt bzw. LICENSE* daneben)';
    return rotSchritt(
      [
        ...(fehlend.length > 0 ? [`Lizenzdatei fehlt: ${kurzeListe(fehlend)}`] : []),
        ...ersatzBefunde,
      ].join('; '),
      npmBefund ? `${schritt}; ${NAECHSTER_SCHRITT_ERSATZ}` : schritt,
    );
  }

  const code = (skript.code ?? '').replace(/<\/script/gi, '<\\/script');
  const css = stile
    .map((s) => String(s.source ?? ''))
    .join('\n')
    .replace(/<\/style/gi, '<\\/style');
  const seite = [
    '<!doctype html>',
    '<html lang="de-CH" data-offline="true">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <meta name="referrer" content="no-referrer" />',
    `    <meta http-equiv="Content-Security-Policy" content="${attributWert(csp)}" />`,
    `    <title>${html(opts.titel)}</title>`,
    `    <style>${css}</style>`,
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    `    <script>${code}</script>`,
    `    <template id="application-licenses"><pre>${html(hinweise.join('\n\n'))}</pre></template>`,
    '  </body>',
    '</html>',
    '',
  ].join('\n');
  const befunde = pruefeEinzeldatei(seite, csp);
  if (befunde.length > 0) {
    return rotSchritt(
      `Freigaberegeln verletzt: ${kurzeListe(befunde)}`,
      'Einstieg so ändern, dass die Einzeldatei die Regeln von tools/verify-release.mjs erfüllt',
    );
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, seite);
  return {
    id: ID,
    ok: true,
    ms: Date.now() - beginn,
    module,
    bytes: Buffer.byteLength(seite, 'utf8'),
  };
}

// CLI: Aufruf als Skript (Vertrag E1-01 §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ name) => {
    const i = args.indexOf(name);
    const v = i >= 0 ? args[i + 1] : undefined;
    return v === undefined || v.startsWith('--') ? undefined : v;
  };
  const entry = wert('--entry');
  const out = wert('--out');
  const titel = wert('--titel');
  if (entry === undefined || out === undefined || titel === undefined || args.length !== 6) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/einzeldatei.mjs --entry <pfad> --out <datei.html> --titel <text>',
    );
    process.exitCode = 1;
  } else {
    const cwd = process.cwd();
    const s = await buildEinzeldatei({ cwd, entry, outFile: out, titel });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

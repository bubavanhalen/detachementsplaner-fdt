// Rückverfolgbarkeit F9/V9 (R-H-15, ADR-010 §5 und Änderungsnotiz AE-001 §1 V9).
// Aufruf: node scripts/wap-gate/trace.mjs --mode fast | full [--etappen-abschluss <N>] [--out <datei>]
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `trace`, §9 Nr 10 und Änderungsnotiz AE-001 §2,
// §3, §4 Nr 5. Testnamen kommen nur aus den Listen der Läufer (schnell: `vitest list --json` je
// Konfiguration, statisch, ohne globalSetup; `playwright test --list`) bzw. aus den JSON-Berichten (voll).
// «Statisch bestimmbar» (AE-001 §4 Nr 5) ist ein Name aus einem Literal oder einer Vorlage ohne Ausdruck;
// Einträge mit berechnetem Namen prüft erst der volle Modus über die Berichte.
// Ab E1-01b (Vertrag E1-01b §1): Im vollen Modus ist test-results/wap/playwright.json Pflicht, sobald die
// Playwright-Liste Tests nennt; ohne Playwright-Tests bleibt der Bericht freiwillig.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { testUmgebung } from './last.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe, starteNode, werkzeug } from './lib/prozess.mjs';
import { musterRegex, pakete, zweigVon } from './lib/repo.mjs';
import { idsIn, leseBericht } from './red-phase.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ suites?: PwSuite[]; specs?: { tests?: { projectName?: string }[] }[] }} PwSuite */
/** @typedef {import('./lib/types.mjs').TraceMatrix} TraceMatrix */
/** @typedef {import('./lib/types.mjs').TraceEintrag} TraceEintrag */
/** @typedef {{ name: string; datei: string; statisch: 'literal' | 'dynamisch' }} Test */
/** @typedef {{ id: string; paket: string; testart: string; verweis: string[]; etappe: number; ausPlan: boolean }} Zuordnung */

const KATALOG_REL = 'docs/wap-planer/requirements.md';

/** Ordner der Schleusen-Skripte. */
const GATE_DIR = dirname(fileURLToPath(import.meta.url));

/** WAP-Vitest-Konfigurationen (ADR-010 §4.5); fehlende werden übergangen. */
const VITEST_KONFIGS = [
  'vitest.wap.config.ts',
  'vitest.wap-reference.config.ts',
  'vitest.wap-golden.config.ts',
  'vitest.wap-gate.config.ts',
  'vitest.wap-selbsttest.config.ts',
  'vitest.wap-harness.config.ts',
];

/** Pflichtberichte des vollen Modus in E1-01-min (ADR-010 Änderungsnotiz AE-001 §1 V9). */
export const PFLICHTBERICHTE = [
  'test-results/wap/vitest.json',
  'test-results/wap/vitest-gate.json',
  'test-results/wap/vitest-harness.json',
  'test-results/wap/vitest-selbsttest.json',
  'test-results/wap/vitest-reference.json',
];

/** Bericht von V5-golden; im vollen Modus eingelesen, wenn vorhanden (F-TOOLS; V5-golden ist ohne Bericht rot). */
export const GOLDEN_BERICHT = 'test-results/wap/vitest-golden.json';

/** Bericht von V4 (Playwright); Pflicht im vollen Modus, sobald die Playwright-Liste Tests nennt (E1-01b). */
const PLAYWRIGHT_BERICHT = 'test-results/wap/playwright.json';

/** Zulässige Testorte je Testart (ADR-010 §5 Regel 4). */
const TESTORTE = /** @type {Record<string, string[]>} */ ({
  Unit: ['tests/wap/unit/**'],
  Property: ['tests/wap/property/**'],
  Integration: ['tests/wap/integration/**', 'tests/wap/reference/**', 'tests/wap-e2e/**'],
  'Integration-Gate': ['tests/wap-gate/**', 'tests/wap-harness/**'],
  'Integration-Referenz': ['tests/wap/reference/**'],
  'Integration-Leistung': ['tests/wap-perf/**'],
  E2E: ['tests/wap-e2e/**'],
  PDF: ['tests/wap/pdf/**', 'tests/wap/reference/**', 'tests/wap-e2e/**'],
});

/** Prüfregeln je Etappe (ADR-010 §5 Regel 5, R-14.7-01). */
const PRUEFREGELN = /** @type {Record<number, string[]>} */ ({
  1: ['R-7-10', 'R-7-11', 'R-7-12', 'R-7-13'],
});

/**
 * Umgebung der Kindprozesse (Listen der Läufer): bereinigt, feste Workerzahl, ohne WAP_PDF_ARTEFAKTE (die
 * Variable gilt nur im ersten V1-Lauf und in V4, Vertrag E1-01b §2 «pdfArtefakt»).
 * @param {'vitest' | 'playwright'} art
 * @returns {Record<string, string>}
 */
function kindUmgebung(art) {
  const env = testUmgebung(process.env, art);
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === 'WAP_PDF_ARTEFAKTE') delete env[key];
  }
  return env;
}

const TEST_FUNKTIONEN = new Set(['it', 'test', 'describe', 'suite', 'bench']);
const PLATZHALTER = /%[sdifjoOc#%]|\$[A-Za-z_#]/;

/**
 * Zellen einer Markdown-Tabellenzeile.
 * @param {string} zeile
 * @returns {string[]}
 */
function zellen(zeile) {
  return zeile
    .split('|')
    .slice(1, -1)
    .map((z) => z.trim());
}

/**
 * Katalog: ID → Etappe und Prüfart.
 * @param {string} text
 * @returns {Map<string, { etappe: number; pruefart: string }>}
 */
function leseKatalog(text) {
  /** @type {Map<string, { etappe: number; pruefart: string }>} */
  const out = new Map();
  for (const zeile of text.split(/\r?\n/)) {
    if (!/^\| R-/.test(zeile)) continue;
    const z = zellen(zeile);
    const id = z[0] ?? '';
    let k = 3;
    if (!/^\d+$/.test(z[k] ?? '')) k = z.findIndex((c, i) => i >= 3 && /^\d+$/.test(c));
    if (k < 0) continue;
    out.set(id, { etappe: Number(z[k]), pruefart: z[k + 1] ?? '' });
  }
  return out;
}

/**
 * Zeilen der Anhänge A und B eines Etappenplans.
 * @param {string} text
 * @returns {{ id: string; paket: string; testart: string; verweis: string }[]}
 */
function lesePlan(text) {
  /** @type {{ id: string; paket: string; testart: string; verweis: string }[]} */
  const out = [];
  let drin = false;
  for (const zeile of text.split(/\r?\n/)) {
    if (/^## /.test(zeile)) {
      drin = /^## Anhang [AB]\b/.test(zeile);
      continue;
    }
    if (!drin || !/^\| R-/.test(zeile)) continue;
    const z = zellen(zeile);
    out.push({ id: z[0] ?? '', paket: z[1] ?? '', testart: z[2] ?? '', verweis: z[3] ?? '' });
  }
  return out;
}

/**
 * IDs eines Pakets aus den Anhängen A/B aller Etappenpläne (ohne Beachtung von Gross/Klein).
 * @param {string} root
 * @param {string} paket
 * @returns {string[]}
 */
export function paketIdsAusPlan(root, paket) {
  return planZeilen(root)
    .filter((z) => z.paket.toLowerCase() === paket.toLowerCase())
    .map((z) => z.id);
}

/**
 * Alle Zeilen der Anhänge A/B aller Etappenpläne.
 * @param {string} root
 * @returns {{ id: string; paket: string; testart: string; verweis: string }[]}
 */
export function planZeilen(root) {
  const dir = join(root, 'docs', 'wap-planer', 'plan');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((x) => /^etappe-\d+\.md$/.test(x))
    .flatMap((d) => lesePlan(readFileSync(join(dir, d), 'utf8')));
}

/**
 * Liste von IDs aus «Verweis auf» (Komma, Strichpunkt, «bis»-Bereiche).
 * @param {string} text
 * @returns {string[]}
 */
function verweisIds(text) {
  return [...text.matchAll(/R-[A-Z0-9]+(?:\.[0-9]+)*-[0-9]+/g)].map((m) => m[0]);
}

/**
 * Entfaltet die Zeile «- Anforderungen: …» (Vertrag §9 Nr 10).
 * @param {string} zeile
 * @returns {{ ids: string[]; fehler: string[] }}
 */
export function entfalteAnforderungen(zeile) {
  /** @type {string[]} */
  const ids = [];
  /** @type {string[]} */
  const fehler = [];
  const ohneKlammern = zeile.replace(/\([^)]*\)/g, ' ');
  for (const roh of ohneKlammern.split(/[,;]/)) {
    const teil = roh.trim();
    if (teil === '') continue;
    if (/^R-[A-Z0-9]+(?:\.[0-9]+)*-[0-9]+$/.test(teil)) {
      ids.push(teil);
      continue;
    }
    const b =
      /^(R-[A-Z0-9]+(?:\.[0-9]+)*)-([0-9]+)\s+bis\s+(R-[A-Z0-9]+(?:\.[0-9]+)*)-([0-9]+)$/.exec(
        teil,
      );
    if (b !== null && b[1] === b[3] && Number(b[2]) <= Number(b[4])) {
      const breite = (b[2] ?? '').length;
      for (let n = Number(b[2]); n <= Number(b[4]); n++) {
        ids.push(`${b[1]}-${String(n).padStart(breite, '0')}`);
      }
      continue;
    }
    fehler.push(teil);
  }
  return { ids, fehler };
}

/**
 * Ist ein Eintrag aus `vitest list` statisch bestimmbar (Literal bzw. Vorlage ohne Ausdruck)?
 * @param {string} text Quelltext der Datei
 * @param {number} zeile 1-basiert
 * @param {number} spalte 1-basiert
 * @returns {'literal' | 'dynamisch' | 'kein-test'}
 */
export function bestimmbarkeit(text, zeile, spalte) {
  let stelle = 0;
  for (let z = 1; z < zeile; z++) {
    const nl = text.indexOf('\n', stelle);
    if (nl < 0) return 'dynamisch';
    stelle = nl + 1;
  }
  const rest = text.slice(stelle + spalte - 1);
  /** @type {string} */
  let argument;
  if (rest.startsWith('(')) argument = rest.slice(1);
  else {
    const m = /^([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/.exec(rest);
    if (m === null || !TEST_FUNKTIONEN.has(m[1] ?? '')) return 'kein-test';
    argument = rest.slice(m[0].length);
  }
  argument = argument.trimStart();
  const c = argument[0];
  if (c === "'" || c === '"') return 'literal';
  if (c === '`') {
    const ende = argument.indexOf('`', 1);
    return ende > 0 && !argument.slice(1, ende).includes('${') ? 'literal' : 'dynamisch';
  }
  return 'dynamisch';
}

/**
 * Repo-relativer Pfad mit «/».
 * @param {string} root
 * @param {string} datei
 * @returns {string}
 */
function rel(root, datei) {
  const abs = isAbsolute(datei) ? datei : resolve(root, datei);
  return relative(root, abs).split(sep).join('/');
}

/**
 * Statische Testliste einer Vitest-Konfiguration.
 * @param {string} root
 * @param {string} vitest
 * @param {string} konfig
 * @returns {Promise<{ tests: Test[]; fehler: string | null; projekte?: string[] }>}
 */
async function vitestListe(root, vitest, konfig) {
  const r = await starteNode(vitest, ['list', '--json', '-c', konfig], {
    cwd: root,
    env: kindUmgebung('vitest'),
    timeoutMs: 300_000,
  });
  const start = r.stdout.indexOf('[');
  /** @type {unknown} */
  let daten;
  try {
    daten = JSON.parse(start < 0 ? '' : r.stdout.slice(start));
  } catch {
    return { tests: [], fehler: `Testliste von ${konfig} nicht lesbar (Exit ${String(r.status)})` };
  }
  if (!Array.isArray(daten) || r.status !== 0) {
    return { tests: [], fehler: `Testliste von ${konfig} nicht lesbar (Exit ${String(r.status)})` };
  }
  /** @type {Map<string, string>} */
  const quellen = new Map();
  /** @type {Set<string>} */
  const bekannt = new Set();
  /** @type {Test[]} */
  const tests = [];
  for (const e of /** @type {{ name?: unknown; file?: unknown; location?: { line?: unknown; column?: unknown } }[]} */ (
    daten
  )) {
    const name = typeof e.name === 'string' ? e.name : '';
    const datei = typeof e.file === 'string' ? e.file : '';
    let art = /** @type {'literal' | 'dynamisch' | 'kein-test'} */ ('literal');
    if (typeof e.location?.line === 'number' && typeof e.location.column === 'number') {
      let text = quellen.get(datei);
      if (text === undefined) {
        text = existsSync(datei) ? readFileSync(datei, 'utf8') : '';
        quellen.set(datei, text);
      }
      art = bestimmbarkeit(text, e.location.line, e.location.column);
    }
    bekannt.add(`${rel(root, datei)}\0${name}`);
    if (art === 'kein-test') continue;
    tests.push({ name, datei: rel(root, datei), statisch: art });
  }
  // Ergänzung (CR-E101-09): Die statische Liste übergeht Tests über abgeleitete Testfunktionen
  // (`const t = it.extend(…)`). Vitest sammelt die Tests deshalb zusätzlich, ohne sie auszuführen und
  // ohne globalSetup (keine Sperre, kein F0-last); Einträge, die statisch fehlen, kommen hinzu.
  // Die Referenz-Konfiguration wird nicht gesammelt (CR-E101-203): Sammeln führt Modulcode der *.ref.ts
  // aus, berechnete Namen könnten Referenzinhalte in Meldungen tragen; V9 deckt sie über den Bericht ab.
  if (konfig === 'vitest.wap-reference.config.ts') return { tests, fehler: null };
  const knoten = join(root, 'node_modules', 'vitest', 'dist', 'node.js');
  if (!existsSync(knoten)) {
    return { tests, fehler: `Tests von ${konfig} nicht sammelbar (vitest/dist/node.js fehlt)` };
  }
  const ausgabe = join(root, 'test-results', 'wap', `.gesammelt-${konfig}.json`);
  mkdirSync(dirname(ausgabe), { recursive: true });
  rmSync(ausgabe, { force: true });
  // Hängerschutz, keine Zeitanforderung (GB-TOOLS3-02, Koordinator 29.10.2026; gleiche Logik wie FL-01): das
  // Sammeln dauerte auf dem Entwicklungsrechner zeitweise 380 s bei 3 % CPU (vermutlich Leerlauf-Drosselung der
  // Remotedesktop-Sitzung), vorher 300 s.
  const s = await starteNode(join(GATE_DIR, 'lib', 'sammle-tests.mjs'), [knoten, konfig, ausgabe], {
    cwd: root,
    env: kindUmgebung('vitest'),
    timeoutMs: 900_000,
  });
  if (s.status !== 0 || !existsSync(ausgabe)) {
    rmSync(ausgabe, { force: true });
    return {
      tests,
      fehler: `Tests von ${konfig} nicht sammelbar (Exit ${String(s.status)}; Import- oder Syntaxfehler?)`,
    };
  }
  try {
    const gesammelt = /** @type {{ name?: unknown; file?: unknown }[]} */ (
      JSON.parse(readFileSync(ausgabe, 'utf8'))
    );
    for (const e of gesammelt) {
      if (typeof e.name !== 'string' || typeof e.file !== 'string') continue;
      const datei = rel(root, e.file);
      if (bekannt.has(`${datei}\0${e.name}`)) continue;
      bekannt.add(`${datei}\0${e.name}`);
      tests.push({ name: e.name, datei, statisch: 'literal' });
    }
  } catch {
    return { tests, fehler: `gesammelte Testliste von ${konfig} nicht lesbar` };
  } finally {
    rmSync(ausgabe, { force: true });
  }
  return { tests, fehler: null };
}

/**
 * Testliste der Playwright-Konfiguration (ohne Ausführung).
 * @param {string} root
 * @returns {Promise<{ tests: Test[]; fehler: string | null; projekte?: string[] }>}
 */
async function playwrightListe(root) {
  const pw = werkzeug(root, 'playwright');
  if (pw === null) return { tests: [], fehler: '@playwright/test fehlt in node_modules' };
  const r = await starteNode(
    pw,
    ['test', '--list', '--reporter=json', '-c', 'playwright.wap.config.ts', '--pass-with-no-tests'],
    { cwd: root, env: kindUmgebung('playwright'), timeoutMs: 300_000 },
  );
  const start = r.stdout.indexOf('{');
  try {
    const ziel = join(root, 'test-results', 'wap', '.playwright-liste.json');
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, start < 0 ? '' : r.stdout.slice(start));
    const bericht = leseBericht(ziel);
    const daten = JSON.parse(readFileSync(ziel, 'utf8'));
    /** @type {Set<string>} */
    const projekte = new Set();
    const gehe = (/** @type {PwSuite} */ s) => {
      for (const spec of s.specs ?? [])
        for (const t of spec.tests ?? []) projekte.add(t.projectName ?? '');
      for (const kind of s.suites ?? []) gehe(kind);
    };
    for (const s of daten.suites ?? []) gehe(s);
    return {
      projekte: [...projekte],
      tests: bericht.tests.map((t) => ({
        name: t.name,
        datei: rel(root, t.datei),
        statisch: 'literal',
      })),
      fehler: null,
    };
  } catch {
    return {
      tests: [],
      fehler: `Testliste von playwright.wap.config.ts nicht lesbar (Exit ${String(r.status)})`,
    };
  }
}

/**
 * Erzeugt die Matrix Anforderung → Tests und prüft die Regeln aus ADR-010 §5.
 * @param {{ cwd: string; modus: 'fast' | 'full'; etappenAbschluss?: number; out?: string; berichte?: string[] }} opts
 * @returns {Promise<Schritt & { matrix: TraceMatrix }>}
 */
export async function trace(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const id = opts.modus === 'fast' ? 'F9-trace' : 'V9-trace';
  /** @type {string[]} */
  const befunde = [];
  /** @type {TraceMatrix} */
  const matrix = { ids: [], zahlen: {} };
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt & { matrix: TraceMatrix }}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id,
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    matrix,
  });

  const katalogDatei = join(root, ...KATALOG_REL.split('/'));
  // Ein fehlender Katalog ist ein Befund; die übrigen Prüfungen (z.B. fehlende Berichte) laufen weiter.
  if (!existsSync(katalogDatei)) befunde.push(`${KATALOG_REL} fehlt`);
  const katalog = existsSync(katalogDatei)
    ? leseKatalog(readFileSync(katalogDatei, 'utf8'))
    : new Map();
  const zweig = zweigVon(root);
  const paket = zweig.startsWith('wap/') ? zweig.slice(4).toLowerCase() : null;
  const alle = pakete(root);
  const paketDatei = (/** @type {string} */ name) =>
    alle.filter((p) => p.name.toLowerCase() === name.toLowerCase());

  // Zuordnung aus den Etappenplänen (Anhang A/B).
  /** @type {Map<string, Zuordnung>} */
  const zuordnung = new Map();
  const planDir = join(root, 'docs', 'wap-planer', 'plan');
  /** @type {Set<number>} */
  const benoetigt = new Set();
  for (const p of alle) {
    const relevant = p.eingefroren || (paket !== null && p.name.toLowerCase() === paket);
    if (relevant && p.etappe !== null && p.etappe >= 1) benoetigt.add(p.etappe);
  }
  if (opts.etappenAbschluss !== undefined)
    for (let n = 1; n <= opts.etappenAbschluss; n++) benoetigt.add(n);
  const planDateien = existsSync(planDir)
    ? readdirSync(planDir).filter((d) => /^etappe-\d+\.md$/.test(d))
    : [];
  for (const n of [...benoetigt].sort((a, b) => a - b)) {
    if (!planDateien.includes(`etappe-${String(n)}.md`))
      befunde.push(`plan/etappe-${String(n)}.md fehlt`);
  }
  for (const d of planDateien) {
    const etappe = Number(/\d+/.exec(d)?.[0]);
    for (const z of lesePlan(readFileSync(join(planDir, d), 'utf8'))) {
      if (zuordnung.has(z.id)) {
        befunde.push(`Zuordnung nennt ${z.id} doppelt`);
        continue;
      }
      zuordnung.set(z.id, {
        id: z.id,
        paket: z.paket,
        testart: z.testart,
        verweis: verweisIds(z.verweis),
        etappe,
        ausPlan: true,
      });
    }
  }

  // Laufendes und eingefrorene Pakete: Checkliste gleich Plan (Regel 6).
  if (paket !== null) {
    const treffer = paketDatei(paket);
    if (treffer.length !== 1) {
      befunde.push(
        `Paket-Checkliste für ${paket} ${treffer.length === 0 ? 'fehlt' : 'mehrdeutig'}`,
      );
    }
  }
  /** @type {Set<string>} eingefroren oder laufend (klein) */
  const zulaessig = new Set();
  if (paket !== null) zulaessig.add(paket);
  for (const p of alle) {
    const laufend = paket !== null && p.name.toLowerCase() === paket;
    if (!p.eingefroren && !laufend) continue;
    zulaessig.add(p.name.toLowerCase());
    if (p.anforderungen === null) {
      befunde.push(`${p.name}: Zeile «- Anforderungen:» fehlt`);
      continue;
    }
    const { ids, fehler } = entfalteAnforderungen(p.anforderungen);
    for (const f of fehler) befunde.push(`${p.name}: Anforderung nicht lesbar «${f}»`);
    for (const i of ids)
      if (!katalog.has(i)) befunde.push(`${p.name}: ${i} steht nicht im Katalog`);
    if (p.etappe === null || p.etappe < 1) {
      for (const i of ids) {
        if (!zuordnung.has(i) && katalog.has(i)) {
          zuordnung.set(i, {
            id: i,
            paket: p.name,
            testart: katalog.get(i)?.pruefart ?? '',
            verweis: [],
            etappe: p.etappe ?? 0,
            ausPlan: false,
          });
        }
      }
      continue;
    }
    const soll = new Set(
      [...zuordnung.values()]
        .filter((z) => z.ausPlan && z.paket.toLowerCase() === p.name.toLowerCase())
        .map((z) => z.id),
    );
    const ist = new Set(ids);
    if (soll.size !== ist.size || [...soll].some((i) => !ist.has(i))) {
      befunde.push(`${p.name}: Anforderungen der Checkliste weichen von Anhang A/B ab`);
    }
  }

  // Tests.
  /** @type {Test[]} */
  const tests = [];
  if (opts.modus === 'fast') {
    const vitest = werkzeug(root, 'vitest');
    const konfigs = VITEST_KONFIGS.filter((k) => existsSync(join(root, k)));
    if (konfigs.length > 0 && vitest === null) befunde.push('vitest fehlt in node_modules');
    // Nacheinander (CR-E101-202): jede Liste startet höchstens einen Vitest mit der festen Workerzahl.
    /** @type {{ tests: Test[]; fehler: string | null }[]} */
    const listen = [];
    if (vitest !== null) for (const k of konfigs) listen.push(await vitestListe(root, vitest, k));
    if (existsSync(join(root, 'playwright.wap.config.ts')))
      listen.push(await playwrightListe(root));
    for (const l of listen) {
      if (l.fehler !== null) befunde.push(l.fehler);
      tests.push(...l.tests);
    }
  } else {
    /** @type {string[]} */
    let berichte = opts.berichte ?? [...PFLICHTBERICHTE];
    // Golden-Bericht (V5-golden): eingelesen, wenn vorhanden; sein Fehlen macht V5-golden rot (F-TOOLS),
    // die eingefrorenen Pflichtberichte von E1-01-min bleiben unverändert.
    if (opts.berichte === undefined && existsSync(join(root, ...GOLDEN_BERICHT.split('/')))) {
      berichte = [...berichte, GOLDEN_BERICHT];
    }
    // Ab E1-01b (AE-001 §1 V9, Vertrag E1-01b §1): Nennt die Playwright-Liste Tests, ist ihr Bericht Pflicht.
    if (opts.berichte === undefined && existsSync(join(root, 'playwright.wap.config.ts'))) {
      const liste = await playwrightListe(root);
      if (liste.fehler !== null) befunde.push(liste.fehler);
      else {
        const pfade = new Set(
          (liste.projekte ?? []).map((p) =>
            p === 'perf'
              ? 'test-results/wap/playwright-perf.json'
              : p === 'chromium-visual'
                ? 'test-results/wap/playwright-visual.json'
                : PLAYWRIGHT_BERICHT,
          ),
        );
        berichte = [...berichte, ...pfade];
      }
    }
    for (const b of berichte) {
      const abs = isAbsolute(b) ? b : join(root, ...b.split('/'));
      const anzeige = rel(root, abs);
      if (!existsSync(abs)) {
        befunde.push(`Bericht fehlt: ${anzeige}`);
        continue;
      }
      try {
        for (const t of leseBericht(abs).tests) {
          tests.push({ name: t.name, datei: rel(root, t.datei), statisch: 'literal' });
        }
      } catch {
        befunde.push(`Bericht nicht lesbar: ${anzeige}`);
      }
    }
  }

  /** @type {Map<string, { name: string; datei: string }[]>} */
  const testsJeId = new Map();
  /** @type {string[]} */
  const ohneId = [];
  for (const t of tests) {
    const ids = idsIn(t.name);
    if (ids.length === 0) {
      if (t.statisch === 'literal' && !PLATZHALTER.test(t.name)) ohneId.push(t.name);
      continue;
    }
    for (const i of ids) {
      if (!katalog.has(i)) {
        befunde.push(`unbekannte ID ${i} in «${t.name}»`);
        continue;
      }
      const z = zuordnung.get(i);
      if (z === undefined) {
        befunde.push(
          `ID ${i} ist keinem Paket der laufenden oder früheren Etappen zugeordnet («${t.name}»)`,
        );
        continue;
      }
      if (!zulaessig.has(z.paket.toLowerCase())) {
        const datei = paketDatei(z.paket).length === 0 ? ', Checkliste fehlt' : '';
        befunde.push(
          `ID ${i} gehört zum nicht eingefrorenen Paket ${z.paket}${datei} («${t.name}»)`,
        );
        continue;
      }
      const liste = testsJeId.get(i) ?? [];
      liste.push({ name: t.name, datei: t.datei });
      testsJeId.set(i, liste);
    }
  }
  for (const n of ohneId) befunde.push(`Test ohne ID: ${n}`);

  // Umfang und Belegung (Regeln 3, 4, 4a, 5).
  /** @type {Set<string>} */
  const eingefroren = new Set(alle.filter((p) => p.eingefroren).map((p) => p.name.toLowerCase()));
  /**
   * @param {Zuordnung} z
   * @returns {boolean}
   */
  const imUmfang = (z) => {
    if (!z.ausPlan) return false;
    if (opts.etappenAbschluss !== undefined && z.etappe <= opts.etappenAbschluss) return true;
    const p = z.paket.toLowerCase();
    return eingefroren.has(p) || (opts.modus === 'full' && paket !== null && p === paket);
  };
  /**
   * @param {string} i
   * @param {string} testart
   * @returns {string[]}
   */
  const belegendeTests = (i, testart) => {
    const orte = (TESTORTE[testart] ?? []).map((m) => musterRegex(m));
    return (testsJeId.get(i) ?? [])
      .filter((t) => orte.some((re) => re.test(t.datei)))
      .map((t) => t.name);
  };
  /** @type {Map<string, TraceEintrag['status']>} */
  const status = new Map();
  for (const z of zuordnung.values()) {
    if (z.testart === 'Verweis') status.set(z.id, 'verweis');
    else if (z.testart === 'Auftraggeber') status.set(z.id, 'auftraggeber');
    else status.set(z.id, belegendeTests(z.id, z.testart).length > 0 ? 'belegt' : 'offen');
  }
  for (const z of zuordnung.values()) {
    if (!imUmfang(z)) continue;
    if (z.testart !== 'Verweis' && z.testart !== 'Auftraggeber' && status.get(z.id) === 'offen') {
      befunde.push(`ID ${z.id} (${z.paket}, ${z.testart}) ohne Test am passenden Ort`);
    }
    for (const ziel of z.verweis) {
      const zz = zuordnung.get(ziel);
      if (zz === undefined || zz.etappe > z.etappe) continue;
      const s = status.get(ziel);
      if (s === 'offen') befunde.push(`Verweis von ${z.id} auf ${ziel}: Ziel ohne Test`);
    }
    if (z.testart === 'Auftraggeber' && opts.etappenAbschluss !== undefined) {
      const bericht = join(root, 'docs', 'wap-planer', 'abnahme', `etappe-${String(z.etappe)}.md`);
      const text = existsSync(bericht) ? readFileSync(bericht, 'utf8') : '';
      const teilB = text.split(/^#+ .*\(b\).*$/m)[1] ?? '';
      if (!teilB.includes(z.id)) befunde.push(`${z.id} fehlt im Abnahmebericht, Teil (b)`);
    }
  }
  for (const [etappe, regeln] of Object.entries(PRUEFREGELN)) {
    for (const r of regeln) {
      const z = zuordnung.get(r);
      if (z === undefined || z.etappe !== Number(etappe) || !imUmfang(z)) continue;
      const namen = testsJeId.get(r) ?? [];
      if (
        !namen.some((t) => t.name.includes('(positiv)')) ||
        !namen.some((t) => t.name.includes('(negativ)'))
      ) {
        befunde.push(`Prüfregel ${r} ohne Test «(positiv)» und «(negativ)»`);
      }
    }
  }

  for (const z of zuordnung.values()) {
    const s = status.get(z.id) ?? 'offen';
    const liste = (testsJeId.get(z.id) ?? []).map((t) => t.name);
    matrix.ids.push({ id: z.id, paket: z.paket, testart: z.testart, tests: liste, status: s });
  }
  matrix.zahlen = {
    anforderungen: matrix.ids.length,
    tests: tests.length,
    belegt: matrix.ids.filter((e) => e.status === 'belegt').length,
    offen: matrix.ids.filter((e) => e.status === 'offen').length,
    verweis: matrix.ids.filter((e) => e.status === 'verweis').length,
    auftraggeber: matrix.ids.filter((e) => e.status === 'auftraggeber').length,
  };

  if (opts.out !== undefined) {
    const zeilen = [
      '# Rückverfolgbarkeit (Matrix Anforderung → Tests)',
      '',
      `Modus: ${opts.modus}; Zweig: ${zweig || '–'}; ${Object.entries(matrix.zahlen)
        .map(([k, v]) => `${k} ${String(v)}`)
        .join(', ')}`,
      '',
      '| ID | Paket | Testart | Status | Tests |',
      '| --- | --- | --- | --- | --- |',
      ...matrix.ids.map(
        (e) =>
          `| ${e.id} | ${e.paket} | ${e.testart} | ${e.status} | ${e.tests.map((t) => t.replace(/\|/g, '\\|')).join('<br>')} |`,
      ),
      '',
    ];
    mkdirSync(dirname(resolve(opts.out)), { recursive: true });
    writeFileSync(resolve(opts.out), zeilen.join('\n'));
  }

  if (befunde.length === 0) return { id, ok: true, ms: Date.now() - beginn, matrix };
  return {
    ...rotSchritt(
      `${String(befunde.length)} Befunde der Rückverfolgbarkeit: ${kurzeListe(befunde)}`,
      'Testnamen mit gültigen IDs des laufenden oder eingefrorener Pakete versehen bzw. fehlende Tests ergänzen (ADR-010 §5)',
    ),
    details: { befunde },
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const modus = wert('--mode');
  const etappe = wert('--etappen-abschluss');
  if ((modus !== 'fast' && modus !== 'full') || (etappe !== undefined && !/^\d+$/.test(etappe))) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/trace.mjs --mode fast | full [--etappen-abschluss <N>] [--out <datei>] [--root <verzeichnis>]',
    );
    process.exitCode = 1;
  } else {
    const out = wert('--out');
    const s = await trace({
      cwd: resolve(wert('--root') ?? '.'),
      modus,
      ...(etappe === undefined ? {} : { etappenAbschluss: Number(etappe) }),
      ...(out === undefined ? {} : { out }),
    });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}

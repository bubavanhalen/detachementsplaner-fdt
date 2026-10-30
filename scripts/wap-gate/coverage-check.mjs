// V2 Abdeckung (R-H-16, ADR-010 §6.2); Altmodule nur ausgenommen, solange SHA-256 = legacy-modules.json.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkCoverage`, §9 Nr 3; Paket F-TOOLS (Auftraggeber
// 19.10.2026 «7: ja»). Zweigabdeckung je Pfadmenge und je Modulordner (Ordner der Datei) gegen die gesperrten
// Schwellen scripts/wap-gate/coverage-schwellen.json; mehrere Istanbul-Datensätze (Vitest, später E2E) werden
// je Zweigort summiert. `messeAbdeckung` startet Vitest mit V8-Abdeckung (Konfiguration vitest.wap.config.ts)
// und schreibt den Bericht unter test-results/wap/coverage/ (bericht.md, bericht.json).
// Aufruf: node scripts/wap-gate/coverage-check.mjs [--root <dir>] [--istanbul <datei>…] [--out <ordner>]
//         ohne --istanbul: Messlauf (Vitest mit Abdeckung), dann Prüfung.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256Lf } from '../wap/lib/common.mjs';
import { testUmgebung } from './last.mjs';
import { LEGACY_REL, ladeLegacyListe } from './lib/legacy.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe, starte, werkzeug } from './lib/prozess.mjs';
import { musterRegex } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {import('./lib/types.mjs').CoverageSchwellen} CoverageSchwellen */

/** Gesperrte Schwellen (ADR-010 §6.2), repo-relativ. */
export const SCHWELLEN_REL = 'scripts/wap-gate/coverage-schwellen.json';

/** Ablage des Messlaufs und des Berichts (nicht versioniert). */
export const ABDECKUNG_ORDNER = 'test-results/wap/coverage';

/** Istanbul-Datensatz des Vitest-Laufs (Reporter «json» von @vitest/coverage-v8). */
export const VITEST_ISTANBUL = `${ABDECKUNG_ORDNER}/vitest/coverage-final.json`;

/**
 * Zweiter Messlauf (F-TOOLS3, FT3-03): Gate-Tests, die WAP-Werkzeuge unter `tools/wap/**` im eigenen Prozess
 * aufrufen. Die Werkzeuge gehören zur Pfadmenge «übriger WAP-Code» (ADR-010 §6.2), ihre Tests liegen aber in der
 * Gate-Konfiguration (z.B. `npm-lizenz.gate.ts` für `tools/wap/npm-lizenz.mjs`) und fehlten deshalb im
 * Messlauf von `vitest.wap.config.ts`. Gemessen werden nur die Werkzeugdateien; der Datensatz wird wie der
 * E2E-Anteil je Zweigort zusammengeführt. Schwellen und Pfadmengen bleiben unverändert.
 * Seit Gate B 28.10.2026 (Entscheid 34c) gehört `tools/wap/**` zu keiner Pfadmenge; der Lauf entfällt dann
 * (messeWerkzeuge), der Mechanismus bleibt für eine spätere Aufnahme erhalten.
 */
export const WERKZEUG_MESSUNG = /** @type {const} */ ({
  konfig: 'vitest.wap-gate.config.ts',
  tests: ['tests/wap-gate/npm-lizenz.gate.ts'],
  muster: 'tools/wap/**',
  ordner: `${ABDECKUNG_ORDNER}/werkzeuge`,
});

/** Istanbul-Datensatz des Werkzeug-Messlaufs. */
export const WERKZEUG_ISTANBUL = `${WERKZEUG_MESSUNG.ordner}/coverage-final.json`;

/** Zeitgrenze je Test im Messlauf: die V8-Instrumentierung verlangsamt; V1 wertet die Tests (30 s). */
const MESS_TEST_TIMEOUT_MS = 30_000;

/**
 * Zweigzähler einer Datei (Istanbul: b[id] = Treffer je Zweigort).
 * @typedef {{ b: Map<string, number[]> }} DateiZweige
 */

/**
 * Liest die Schwellen-Datei.
 * @param {string} datei
 * @returns {{ ok: true; schwellen: CoverageSchwellen } | { ok: false; grund: string }}
 */
export function ladeSchwellen(datei) {
  if (!existsSync(datei)) return { ok: false, grund: `${SCHWELLEN_REL} fehlt` };
  /** @type {unknown} */
  let d;
  try {
    d = JSON.parse(readFileSync(datei, 'utf8'));
  } catch {
    return { ok: false, grund: `${SCHWELLEN_REL} ist kein gültiges JSON` };
  }
  const o = /** @type {Record<string, unknown>} */ (d ?? {});
  const mengen = Array.isArray(o.mengen) ? o.mengen : null;
  const gueltig =
    mengen !== null &&
    mengen.length > 0 &&
    mengen.every((m) => {
      const e = /** @type {Record<string, unknown>} */ (m ?? {});
      return (
        typeof e.name === 'string' &&
        Array.isArray(e.muster) &&
        e.muster.length > 0 &&
        e.muster.every((x) => typeof x === 'string') &&
        typeof e.zweige === 'number' &&
        e.zweige > 0 &&
        e.zweige <= 100
      );
    }) &&
    o.jeModul === true &&
    Array.isArray(o.ausnahmen) &&
    o.ausnahmen.every((x) => typeof x === 'string');
  if (!gueltig)
    return { ok: false, grund: `${SCHWELLEN_REL} ist ungültig (mengen, jeModul, ausnahmen)` };
  return { ok: true, schwellen: /** @type {CoverageSchwellen} */ (/** @type {unknown} */ (o)) };
}

/**
 * Repo-relativer Pfad mit «/»; null, wenn ausserhalb von root.
 * @param {string} root
 * @param {string} pfad
 * @returns {string | null}
 */
function repoRelativ(root, pfad) {
  const p = pfad.replace(/\\/g, '/');
  if (!isAbsolute(pfad) && !/^[A-Za-z]:\//.test(p)) {
    const r = p.replace(/^\.\//, '');
    return r.split('/').includes('..') ? null : r;
  }
  const rel = relative(root, pfad);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

/**
 * Führt Istanbul-Datensätze zusammen (Summe je Zweigort).
 * @param {string} root
 * @param {string[]} dateien
 * @returns {{ ok: true; daten: Map<string, DateiZweige> } | { ok: false; grund: string }}
 */
function zusammenfuehren(root, dateien) {
  /** @type {Map<string, DateiZweige>} */
  const daten = new Map();
  if (dateien.length === 0) return { ok: false, grund: 'kein Istanbul-Datensatz angegeben' };
  for (const datei of dateien) {
    if (!existsSync(datei)) {
      return { ok: false, grund: `Istanbul-Datensatz fehlt: ${repoRelativ(root, datei) ?? datei}` };
    }
    /** @type {unknown} */
    let roh;
    try {
      roh = JSON.parse(readFileSync(datei, 'utf8'));
    } catch {
      return {
        ok: false,
        grund: `Istanbul-Datensatz ungültig: ${repoRelativ(root, datei) ?? datei}`,
      };
    }
    if (roh === null || typeof roh !== 'object' || Array.isArray(roh)) {
      return {
        ok: false,
        grund: `Istanbul-Datensatz ungültig: ${repoRelativ(root, datei) ?? datei}`,
      };
    }
    for (const [schluessel, wert] of Object.entries(roh)) {
      const e = /** @type {Record<string, unknown>} */ (wert ?? {});
      const pfad = typeof e.path === 'string' ? e.path : schluessel;
      const rel = repoRelativ(root, pfad);
      if (rel === null) continue;
      const b = e.b;
      if (b === null || typeof b !== 'object' || Array.isArray(b)) {
        return { ok: false, grund: `Istanbul-Eintrag ohne Zweigzähler: ${rel}` };
      }
      const ziel = daten.get(rel) ?? { b: new Map() };
      // Zusammenführung je Zweigort über seine Lage (Beginn Zeile:Spalte), nicht über die Zweig-ID: Vitest
      // (@vitest/coverage-v8) und die E2E-Umrechnung (monocart) nummerieren und benennen Zweige verschieden
      // (FT-A-02). Gleiche Lagen innerhalb eines Datensatzes werden in ihrer Reihenfolge durchgezählt.
      const karte =
        /** @type {Record<string, { locations?: { start?: { line?: number; column?: number } }[] }>} */ (
          e.branchMap !== null && typeof e.branchMap === 'object' ? e.branchMap : {}
        );
      /** @type {Map<string, number>} */
      const vorkommen = new Map();
      for (const [id, treffer] of Object.entries(/** @type {Record<string, unknown>} */ (b))) {
        if (!Array.isArray(treffer) || treffer.some((t) => typeof t !== 'number')) {
          return { ok: false, grund: `Istanbul-Eintrag mit ungültigem Zweig: ${rel}` };
        }
        const orte = karte[id]?.locations ?? [];
        treffer.forEach((n, i) => {
          const s = orte[i]?.start;
          const lage =
            s !== undefined && typeof s.line === 'number' && typeof s.column === 'number'
              ? `${String(s.line)}:${String(s.column)}`
              : `id${id}#${String(i)}`;
          const k = vorkommen.get(lage) ?? 0;
          vorkommen.set(lage, k + 1);
          const schl = `${lage}#${String(k)}`;
          ziel.b.set(schl, [(ziel.b.get(schl)?.[0] ?? 0) + n]);
        });
      }
      daten.set(rel, ziel);
    }
  }
  return { ok: true, daten };
}

/**
 * Gedeckte und gesamte Zweigorte einer Datei.
 * @param {DateiZweige} d
 * @returns {{ gedeckt: number; gesamt: number }}
 */
function zaehle(d) {
  let gedeckt = 0;
  let gesamt = 0;
  for (const t of d.b.values()) {
    gesamt += t.length;
    gedeckt += t.filter((n) => n > 0).length;
  }
  return { gedeckt, gesamt };
}

/**
 * Prozent mit einer Nachkommastelle (nur Anzeige; die Prüfung rechnet ganzzahlig).
 * @param {number} gedeckt
 * @param {number} gesamt
 * @returns {number}
 */
function prozent(gedeckt, gesamt) {
  return gesamt === 0 ? 100 : Math.floor((gedeckt * 1000) / gesamt) / 10;
}

/**
 * Prüft die zusammengeführte Zweigabdeckung je Pfadmenge und je Modul gegen die Schwellen.
 * @param {{ cwd: string; istanbulDateien: string[]; schwellen: CoverageSchwellen; legacyListe?: string }} opts
 * @returns {Schritt}
 */
export function checkCoverage(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'V2-abdeckung',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  const liste = ladeLegacyListe(opts.legacyListe ?? join(root, ...LEGACY_REL.split('/')));
  if (!liste.ok) return rotSchritt(liste.grund, `${LEGACY_REL} wiederherstellen (gesperrt)`);
  const z = zusammenfuehren(
    root,
    opts.istanbulDateien.map((d) => resolve(d)),
  );
  if (!z.ok)
    return rotSchritt(z.grund, 'Messlauf wiederholen (npm run wap:test mit Abdeckung, V2)');

  const ausnahmen = opts.schwellen.ausnahmen.map((m) => musterRegex(m));
  const mengen = opts.schwellen.mengen.map((m) => ({
    ...m,
    res: m.muster.map((x) => musterRegex(x)),
  }));
  /** @type {string[]} */
  const ausgenommen = [];
  for (const e of liste.dateien) {
    const abs = join(root, ...e.pfad.split('/'));
    if (z.daten.has(e.pfad) && existsSync(abs) && sha256Lf(readFileSync(abs)) === e.sha256) {
      ausgenommen.push(e.pfad);
    }
  }
  /** @type {Map<string, { gedeckt: number; gesamt: number; dateien: number }>} */
  const jeMenge = new Map(mengen.map((m) => [m.name, { gedeckt: 0, gesamt: 0, dateien: 0 }]));
  /** @type {Map<string, { menge: string; schwelle: number; gedeckt: number; gesamt: number }>} */
  const jeModul = new Map();
  /** @type {{ datei: string; menge: string; gedeckt: number; gesamt: number; prozent: number }[]} */
  const jeDatei = [];
  let typAusnahmen = 0;
  for (const [rel, d] of [...z.daten.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (ausgenommen.includes(rel)) continue;
    const c = zaehle(d);
    // Ausnahmen gelten nur für reine Typdateien ohne ausführbaren Code (ADR-010 §6.2): eine Datei des
    // Musters mit Zweigorten wird gewertet.
    if (c.gesamt === 0 && ausnahmen.some((re) => re.test(rel))) {
      typAusnahmen += 1;
      continue;
    }
    const menge = mengen.find((m) => m.res.some((re) => re.test(rel)));
    if (menge === undefined) continue;
    const m = jeMenge.get(menge.name);
    if (m !== undefined) {
      m.gedeckt += c.gedeckt;
      m.gesamt += c.gesamt;
      m.dateien += 1;
    }
    const modul = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '.';
    const mod = jeModul.get(modul) ?? {
      menge: menge.name,
      schwelle: menge.zweige,
      gedeckt: 0,
      gesamt: 0,
    };
    mod.gedeckt += c.gedeckt;
    mod.gesamt += c.gesamt;
    jeModul.set(modul, mod);
    jeDatei.push({ datei: rel, menge: menge.name, ...c, prozent: prozent(c.gedeckt, c.gesamt) });
  }
  /** @param {number} g @param {number} t @param {number} s */
  const erfuellt = (g, t, s) => t === 0 || g * 100 >= s * t;
  const mengenErgebnis = mengen.map((m) => {
    const w = jeMenge.get(m.name) ?? { gedeckt: 0, gesamt: 0, dateien: 0 };
    return {
      name: m.name,
      schwelle: m.zweige,
      ...w,
      prozent: prozent(w.gedeckt, w.gesamt),
      ok: erfuellt(w.gedeckt, w.gesamt, m.zweige),
    };
  });
  const modulErgebnis = [...jeModul.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([modul, w]) => ({
      modul,
      ...w,
      prozent: prozent(w.gedeckt, w.gesamt),
      ok: erfuellt(w.gedeckt, w.gesamt, w.schwelle),
    }));
  const unter = [
    ...mengenErgebnis
      .filter((m) => !m.ok)
      .map((m) => `Pfadmenge ${m.name} (${String(m.prozent)} % < ${String(m.schwelle)} %)`),
    ...modulErgebnis
      .filter((m) => !m.ok)
      .map((m) => `${m.modul} (${String(m.prozent)} % < ${String(m.schwelle)} %)`),
  ];
  const details = {
    mengen: mengenErgebnis,
    module: modulErgebnis,
    dateien: jeDatei,
    unterSchwelle: unter,
    ausgenommen,
    typAusnahmen,
  };
  if (unter.length === 0) return { id: 'V2-abdeckung', ok: true, ms: Date.now() - beginn, details };
  return {
    ...rotSchritt(
      `Zweigabdeckung unter der Schwelle (${String(unter.length)}): ${kurzeListe(unter)}`,
      'Tests für die genannten Module ergänzen (ADR-010 §6.2); Schwellen nur mit Zustimmung des Auftraggebers ändern',
    ),
    details,
  };
}

/**
 * Bericht (Markdown und JSON) eines Prüfergebnisses.
 * @param {Schritt} s
 * @param {string} ordner absoluter Pfad
 * @param {{ testsRot?: number; commit?: string | null }} [zusatz]
 * @returns {void}
 */
export function schreibeBericht(s, ordner, zusatz = {}) {
  mkdirSync(ordner, { recursive: true });
  const d =
    /** @type {{ mengen?: Array<Record<string, unknown>>; module?: Array<Record<string, unknown>>; ausgenommen?: string[] }} */ (
      s.details ?? {}
    );
  const zeilen = [
    '# Zweigabdeckung (V2, ADR-010 §6.2)',
    '',
    `Ergebnis: ${s.ok ? 'grün' : 'rot'}${s.ursache === undefined ? '' : ` – ${s.ursache}`}`,
    ...(zusatz.commit ? [`Stand: ${zusatz.commit}`] : []),
    ...(zusatz.testsRot !== undefined
      ? [`Rote Tests im Messlauf (nur Hinweis, Wertung in V1): ${String(zusatz.testsRot)}`]
      : []),
    '',
    '| Pfadmenge | Schwelle | gedeckt / gesamt | Prozent | Ergebnis |',
    '| --- | --- | --- | --- | --- |',
    ...(d.mengen ?? []).map(
      (m) =>
        `| ${String(m.name)} | ${String(m.schwelle)} % | ${String(m.gedeckt)} / ${String(m.gesamt)} | ${String(m.prozent)} % | ${m.ok ? 'ok' : 'unter Schwelle'} |`,
    ),
    '',
    '| Modulordner | Pfadmenge | Schwelle | gedeckt / gesamt | Prozent | Ergebnis |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(d.module ?? []).map(
      (m) =>
        `| ${String(m.modul)} | ${String(m.menge)} | ${String(m.schwelle)} % | ${String(m.gedeckt)} / ${String(m.gesamt)} | ${String(m.prozent)} % | ${m.ok ? 'ok' : 'unter Schwelle'} |`,
    ),
    '',
    `Ausgenommene Altmodule (SHA-256 unverändert): ${(d.ausgenommen ?? []).join(', ') || '–'}`,
    '',
  ];
  writeFileSync(join(ordner, 'bericht.md'), zeilen.join('\n'));
  writeFileSync(join(ordner, 'bericht.json'), `${JSON.stringify({ ...s, ...zusatz }, null, 2)}\n`);
}

/**
 * Werkzeug-Messlauf (WERKZEUG_MESSUNG, FT3-03): die gelisteten Gate-Tests mit V8-Abdeckung nur für
 * `tools/wap/**`. Fehlen Konfiguration oder Tests (Mini-Repos der Schleusen-Tests), gibt es keinen Datensatz
 * (`datei: null`); scheitert der Lauf ohne Datensatz, ist das Ergebnis rot. Rote Tests zählen wie im
 * Hauptlauf nicht (Wertung in V1a).
 * @param {{ cwd: string; env?: Record<string, string> }} opts
 * @returns {Promise<{ ok: true; datei: string | null } | { ok: false; ursache: string; naechsterSchritt: string }>}
 */
export async function messeWerkzeuge(opts) {
  const root = resolve(opts.cwd);
  rmSync(join(root, ...WERKZEUG_MESSUNG.ordner.split('/')), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  const tests = WERKZEUG_MESSUNG.tests.filter((t) => existsSync(join(root, ...t.split('/'))));
  if (tests.length === 0 || !existsSync(join(root, WERKZEUG_MESSUNG.konfig))) {
    return { ok: true, datei: null };
  }
  // Gate B 28.10.2026, Entscheid 34c: Gehört das Werkzeugmuster zu keiner Pfadmenge der gesperrten Schwellen,
  // wird nichts gewertet und der Lauf entfällt (ohne Schwellendatei, z.B. im Mini-Repo, läuft er weiter).
  const sw = ladeSchwellen(join(root, ...SCHWELLEN_REL.split('/')));
  if (sw.ok && !sw.schwellen.mengen.some((m) => m.muster.includes(WERKZEUG_MESSUNG.muster))) {
    return { ok: true, datei: null };
  }
  const naechsterSchritt = `Werkzeugtests prüfen: npx vitest run -c ${WERKZEUG_MESSUNG.konfig} ${tests.join(' ')} --coverage.enabled=true`;
  const vitest = werkzeug(root, 'vitest');
  if (vitest === null)
    return { ok: false, ursache: 'vitest fehlt in node_modules', naechsterSchritt };
  const env = opts.env ?? testUmgebung(process.env, 'vitest');
  const lauf = await starte(
    process.execPath,
    [
      vitest,
      'run',
      '-c',
      WERKZEUG_MESSUNG.konfig,
      ...tests,
      `--testTimeout=${String(MESS_TEST_TIMEOUT_MS)}`,
      '--coverage.enabled=true',
      '--coverage.provider=v8',
      `--coverage.include=${WERKZEUG_MESSUNG.muster}`,
      '--coverage.reporter=json',
      `--coverage.reportsDirectory=${WERKZEUG_MESSUNG.ordner}`,
    ],
    { cwd: root, env, timeoutMs: 600_000 },
  );
  const datei = join(root, ...WERKZEUG_ISTANBUL.split('/'));
  if (lauf.fehler !== null || !existsSync(datei)) {
    return {
      ok: false,
      ursache: `Werkzeug-Messlauf ohne Abdeckungsdaten (Exit ${String(lauf.status)}${lauf.fehler === null ? '' : `, ${lauf.fehler}`})`,
      naechsterSchritt,
    };
  }
  return { ok: true, datei };
}

/**
 * Messlauf und Prüfung: Vitest (vitest.wap.config.ts) mit V8-Abdeckung, dann checkCoverage; schreibt den
 * Bericht unter test-results/wap/coverage/. Rote Tests im Messlauf werden nur gezählt (Wertung in V1).
 * @param {{ cwd: string; env?: Record<string, string>; zusaetzlich?: string[] }} opts zusaetzlich: weitere
 *   Istanbul-Datensätze (z.B. E2E), repo-relativ oder absolut
 * @returns {Promise<Schritt>}
 */
export async function messeAbdeckung(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const s = ladeSchwellen(join(root, ...SCHWELLEN_REL.split('/')));
  /** @param {string} ursache @param {string} naechster @returns {Schritt} */
  const rotSchritt = (ursache, naechster) => ({
    id: 'V2-abdeckung',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt: naechster,
  });
  if (!s.ok) return rotSchritt(s.grund, `${SCHWELLEN_REL} wiederherstellen (gesperrt)`);
  const vitest = werkzeug(root, 'vitest');
  if (vitest === null) return rotSchritt('vitest fehlt in node_modules', '«npm ci» ausführen');
  const ordner = join(root, ...ABDECKUNG_ORDNER.split('/'));
  // Nur den eigenen Vitest-Datensatz leeren; der E2E-Anteil (coverage-e2e.mjs) liegt daneben unter e2e/.
  rmSync(join(ordner, 'vitest'), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  const bericht = `${ABDECKUNG_ORDNER}/vitest.json`;
  const env = opts.env ?? testUmgebung(process.env, 'vitest');
  for (const key of Object.keys(env))
    if (key.toUpperCase() === 'WAP_PDF_ARTEFAKTE') delete env[key];
  const lauf = await starte(
    process.execPath,
    [
      vitest,
      'run',
      '-c',
      'vitest.wap.config.ts',
      '--reporter=json',
      `--outputFile=${bericht}`,
      `--testTimeout=${String(MESS_TEST_TIMEOUT_MS)}`,
      '--coverage.enabled=true',
    ],
    { cwd: root, env, timeoutMs: 3_600_000 },
  );
  const istanbul = join(root, ...VITEST_ISTANBUL.split('/'));
  if (lauf.fehler !== null || !existsSync(istanbul)) {
    return rotSchritt(
      `Messlauf ohne Abdeckungsdaten (Exit ${String(lauf.status)}${lauf.fehler === null ? '' : `, ${lauf.fehler}`})`,
      'Vitest mit Abdeckung prüfen: npx vitest run -c vitest.wap.config.ts --coverage.enabled=true',
    );
  }
  /** @type {number | undefined} */
  let testsRot;
  try {
    const b = /** @type {{ numFailedTests?: number }} */ (
      JSON.parse(readFileSync(join(root, ...bericht.split('/')), 'utf8'))
    );
    testsRot = b.numFailedTests;
  } catch {
    testsRot = undefined;
  }
  // Werkzeug-Messlauf (FT3-03); ohne Datensatz rot statt still ohne Werkzeugtests gemessen.
  const werkzeugLauf = await messeWerkzeuge({ cwd: root, env });
  if (!werkzeugLauf.ok) return rotSchritt(werkzeugLauf.ursache, werkzeugLauf.naechsterSchritt);
  const werkzeugDaten = werkzeugLauf.datei === null ? [] : [werkzeugLauf.datei];
  const weitere = (opts.zusaetzlich ?? []).map((d) =>
    isAbsolute(d) ? d : join(root, ...d.split('/')),
  );
  const ergebnis = checkCoverage({
    cwd: root,
    istanbulDateien: [istanbul, ...werkzeugDaten, ...weitere],
    schwellen: s.schwellen,
  });
  const mitZeit = { ...ergebnis, ms: Date.now() - beginn };
  schreibeBericht(mitZeit, ordner, testsRot === undefined ? {} : { testsRot });
  return mitZeit;
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  /** @type {string[]} */
  const istanbul = [];
  /** @type {string | undefined} */
  let out;
  let root = '.';
  let fehler = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const wert = args[i + 1];
    if ((a === '--istanbul' || a === '--out' || a === '--root') && wert !== undefined) {
      if (a === '--istanbul') istanbul.push(wert);
      else if (a === '--out') out = wert;
      else root = wert;
      i++;
    } else fehler = true;
  }
  if (fehler) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/coverage-check.mjs [--root <dir>] [--istanbul <datei>…] [--out <ordner>]',
    );
    process.exitCode = 1;
  } else {
    const cwd = resolve(root);
    /** @type {Schritt} */
    let s;
    if (istanbul.length === 0) s = await messeAbdeckung({ cwd });
    else {
      const sw = ladeSchwellen(join(cwd, ...SCHWELLEN_REL.split('/')));
      s = sw.ok
        ? checkCoverage({
            cwd,
            istanbulDateien: istanbul.map((d) => resolve(d)),
            schwellen: sw.schwellen,
          })
        : {
            id: 'V2-abdeckung',
            ok: false,
            ms: 0,
            ursache: sw.grund,
            naechsterSchritt: 'Schwellen wiederherstellen',
          };
      schreibeBericht(s, resolve(out ?? join(cwd, ...ABDECKUNG_ORDNER.split('/'))));
    }
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    hinweis(`Bericht: ${out ?? ABDECKUNG_ORDNER}/bericht.md`);
    process.exitCode = s.ok ? 0 : 1;
  }
}

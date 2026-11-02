// Schnelle und volle Schleuse (Paket E1-01-min, ADR-010 §3 und Änderungsnotiz AE-001; R-H-10, R-H-12,
// R-H-24, R-H-28, R-H-34, R-H-36, R-H-37).
// Aufruf: node scripts/wap-gate/gate.mjs fast | full [--etappen-abschluss <N>] [--warten] [--root <worktree>]
//         node scripts/wap-gate/gate.mjs fast --pre-commit (nur intern, Vertrag §1, H0-Ergänzung A-1)
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1, §2, §9 Nr 8, 14, 16, 17 und Änderungsnotiz AE-001.
// E1-01-min: schnelle Schleuse F1–F9, volle Schleuse zusätzlich V1, V1a (mit Selbsttest-Teil), V3, V9,
// V10 (test:oracle über checkPython) und V11. E1-01b (Vertrag E1-01b §1, R-H-11, R-H-19): V4-e2e
// (Playwright in Edge über e2e.mjs) und V5-ebene2 (PDF-Ebene 2 über pdf-artefakte.mjs), Reihenfolge
// V3 < V4 < V5-ebene2 < V9; WAP_PDF_ARTEFAKTE nur im ersten V1-Lauf (Ordner vorher geleert) und in V4;
// V3 räumt verwaiste wap-v3-* auf (E1-01-24). E1-01c ergänzt V6-visual und V7-perf/-vergleich mit
// getrennten Berichten. Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja», R-H-16, R-H-17, R-H-20, R-H-23):
// F10 Lizenzen (schnell und voll), V2 Abdeckung, V5-golden (Golden-Bilder Ebene 3), V8 Mutationstests und
// V10-lizenztexte direkt nach V10-build.
// Reihenfolge (AE-001 §2, §4 Nr 2): F1 → F0-sperre → F0-last; --pre-commit beginnt mit F0-arbeitsbaum
// und prüft nur die Sperre.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { writeTransaktion, zeigePfad } from '../wap/lib/common.mjs';
import { ladeSchwellen, messeAbdeckung, SCHWELLEN_REL } from './coverage-check.mjs';
import { E2E_ISTANBUL, messeE2eAbdeckung } from './coverage-e2e.mjs';
import { PLAYWRIGHT_BERICHT, runE2e } from './e2e.mjs';
import { scanForbidden } from './forbidden.mjs';
import {
  belegeSperre,
  fremdeProzesse,
  lastRegeln,
  pruefeFremdlast,
  pruefeSperreFrei,
  systemQuelle,
  testUmgebung,
} from './last.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe, npmCli, ohneFarben, starte, starteNode, werkzeug } from './lib/prozess.mjs';
import {
  commitVon,
  gemeinsamesGitVerzeichnis,
  git,
  mergeBasis,
  pakete,
  wurzel,
  zweigVon,
} from './lib/repo.mjs';
import { eigenerTempOrdner, raeumeVerwaisteTemp } from './lib/temp.mjs';
import { checkBundledLicenses, checkLicenses } from './license-check.mjs';
import { checkLockCoverage } from './lock-coverage.mjs';
import { checkModuleBoundaries } from './module-boundaries.mjs';
import { runMutation } from './mutation.mjs';
import { checkNode } from './node-check.mjs';
import { checkPdfArtefakte } from './pdf-artefakte.mjs';
import { comparePerf } from './perf-compare.mjs';
import { deepPrivacyScan } from './privacy-deep.mjs';
import { scanNames } from './privacy-names.mjs';
import { checkPython, oracleUmgebung } from './python-check.mjs';
import { classifyRedPhase, idsIn, leseBericht } from './red-phase.mjs';
import {
  checkReferenceLock,
  REFERENCE_LOCK_REL,
  standardReferenzOrdner,
} from './reference-lock.mjs';
import { checkSuiteBoundary } from './suite-boundary.mjs';
import { checkSuiteWorker } from './suite-worker.mjs';
import { GOLDEN_BERICHT, PFLICHTBERICHTE, paketIdsAusPlan, trace } from './trace.mjs';
import { checkTypes } from './typecheck.mjs';
import { pruefeReferenzen } from './vitest-reference-setup.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {import('./lib/types.mjs').GateErgebnis} GateErgebnis */
/** @typedef {import('./last.mjs').Last} Last */

/**
 * Kontext eines Laufs der Schritte (nach F1, Sperre und F0-last).
 * @typedef {object} Kontext
 * @property {string} root
 * @property {string} zweig
 * @property {string | null} paket
 * @property {boolean} preCommit
 * @property {number} [etappenAbschluss]
 * @property {string | undefined} sperre Wert von WAP_GATE_SPERRE für Kindprozesse
 * @property {(s: Schritt) => void} melde
 * @property {string[]} [nur] nur diese Schrittnummern (Selbsttest), z.B. ['V3']
 */

/** Ordner der Schleusen-Skripte und Wurzel des Checkouts, aus dem sie geladen sind. */
const GATE_DIR = dirname(fileURLToPath(import.meta.url));
const H0_DIR = join(GATE_DIR, '..', 'wap');

/** Bericht des Suite-npm test (V10-wap-anteil; für V11-deep ein Suite-Bericht, E1-01-21). */
const SUITE_BERICHT = 'test-results/wap/suite.json';

/** Zeitlimits der Kindprozesse. */
const ZEIT = { kurz: 600_000, lang: 3_600_000, sehrLang: 7_200_000 };

/** Ablage der erzeugten PDF für V5-ebene2 (Vertrag E1-01b §2 «pdfArtefakt»). */
const PDF_ORDNER = 'test-results/wap/pdf';

/**
 * Umgebung eines Kindprozesses: bereinigt (§9 Nr 16), feste Workerzahl, WAP_GATE_SPERRE des Laufs, ohne
 * WAP_PDF_ARTEFAKTE (die Variable setzt nur der erste V1-Lauf bzw. V4, Vertrag E1-01b §2).
 * @param {Kontext} k
 * @param {'vitest' | 'selbsttest' | 'stryker' | 'playwright' | 'sonst'} art
 * @returns {Record<string, string>}
 */
function kindEnv(k, art) {
  const env = testUmgebung(process.env, art);
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === 'WAP_PDF_ARTEFAKTE') delete env[key];
  }
  if (k.sperre !== undefined) env.WAP_GATE_SPERRE = k.sperre;
  return env;
}

/**
 * Letzte Zeilen einer Ausgabe für eine Ursache (ohne Farben, gekürzt).
 * @param {string} text
 * @param {number} [n]
 * @returns {string}
 */
function auszug(text, n = 5) {
  return ohneFarben(text)
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z !== '')
    .slice(-n)
    .join(' | ')
    .slice(0, 1_000);
}

/**
 * Schritt aus einem Lauf eines Node-Skripts (Exit 0 = grün).
 * @param {string} id
 * @param {import('./lib/prozess.mjs').Lauf} r
 * @param {string} ursache
 * @param {string} naechsterSchritt
 * @returns {Schritt}
 */
function ausLauf(id, r, ursache, naechsterSchritt) {
  if (r.status === 0 && r.fehler === null) return { id, ok: true, ms: r.ms };
  const grund = r.fehler ?? auszug(`${r.stdout}\n${r.stderr}`);
  return {
    id,
    ok: false,
    ms: r.ms,
    ursache: `${ursache}: ${grund || `Exit ${String(r.status)}`}`,
    naechsterSchritt,
  };
}

/**
 * Inhalte von «nicht implementiert»-Stubs aus dem Vertrag des Pakets (Abschnitte «Stub-Namen»).
 * @param {string} root
 * @param {string} paket
 * @returns {string[]}
 */
function stubNamen(root, paket) {
  const dir = join(root, 'docs', 'wap-planer', 'plan', 'vertraege');
  if (!existsSync(dir)) return [];
  const datei = readdirSync(dir).find((d) => d.toLowerCase() === `${paket.toLowerCase()}.md`);
  if (datei === undefined) return [];
  /** @type {Set<string>} */
  const namen = new Set();
  let ebene = 0;
  for (const zeile of readFileSync(join(dir, datei), 'utf8').split(/\r?\n/)) {
    const kopf = /^(#+)\s/.exec(zeile);
    if (kopf !== null) {
      const tiefe = (kopf[1] ?? '').length;
      if (/Stub-Namen/.test(zeile)) ebene = tiefe;
      else if (ebene > 0 && tiefe <= ebene) ebene = 0;
    }
    if (ebene === 0 && !/Stub-Namen/.test(zeile)) continue;
    for (const m of zeile.matchAll(/`([a-z][\w]*(?:\.[\w]+)+)`/g)) namen.add(m[1] ?? '');
  }
  return [...namen];
}

/**
 * Bewertet einen Vitest-Bericht: Rot-Phase (Kästchen 7 des laufenden Pakets offen) oder alles grün.
 * @param {Kontext} k
 * @param {string} id
 * @param {string} bericht absoluter Pfad
 * @returns {Schritt}
 */
function bewerte(k, id, bericht) {
  const beginn = Date.now();
  const p =
    k.paket === null ? undefined : pakete(k.root).find((x) => x.name.toLowerCase() === k.paket);
  if (p !== undefined && !p.umgesetzt) {
    const s = classifyRedPhase({
      berichte: [bericht],
      paket: p.name,
      paketIds: paketIdsAusPlan(k.root, p.name),
      stubNamen: stubNamen(k.root, p.name),
    });
    return { ...s, id };
  }
  if (!existsSync(bericht)) {
    return {
      id,
      ok: false,
      ms: Date.now() - beginn,
      ursache: `Bericht fehlt: ${zeigePfad(bericht)} (Läufer abgestürzt)`,
      naechsterSchritt: 'Ausgabe des Testlaufs prüfen',
    };
  }
  /** @type {string[]} */
  const rote = [];
  try {
    const b = leseBericht(bericht);
    for (const f of b.dateiFehler)
      rote.push(`Fehler beim Laden oder im Aufbau: ${zeigePfad(f.datei)}`);
    for (const t of b.tests) {
      if (t.status === 'failed' || t.status === 'timedOut') rote.push(t.name);
      else if (t.status !== 'passed') rote.push(`${t.name} (${t.status})`);
    }
  } catch {
    rote.push(`Bericht nicht lesbar: ${zeigePfad(bericht)}`);
  }
  if (rote.length === 0) return { id, ok: true, ms: Date.now() - beginn };
  return {
    id,
    ok: false,
    ms: Date.now() - beginn,
    ursache: `${String(rote.length)} rote Tests: ${kurzeListe(rote)}`,
    naechsterSchritt:
      'Tests reparieren; auf wap-planer und nach der Umsetzung müssen alle Tests grün sein',
    details: { rote },
  };
}

/**
 * Bewertet einen Vitest-Lauf: Start, Zeitlimit, unbehandelte Fehler, Bericht und Exit-Code
 * (CR-E101-01, -02, -04). Ausserhalb der Rot-Phase ist jeder Exit ≠ 0 rot; in der Rot-Phase nur ein
 * Exit ≠ 0, den ein fachlich roter Test des Pakets erklärt. Dauer = Laufzeit des Läufers + Auswertung.
 * @param {Kontext} k
 * @param {string} id
 * @param {{ lauf: import('./lib/prozess.mjs').Lauf | null; bericht: string }} v
 * @returns {Schritt}
 */
function bewerteLauf(k, id, v) {
  const beginn = Date.now();
  const lauf = v.lauf;
  const dauer = () => (lauf?.ms ?? 0) + (Date.now() - beginn);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id,
    ok: false,
    ms: dauer(),
    ursache,
    naechsterSchritt,
  });
  if (lauf === null)
    return rotSchritt('Läufer nicht gestartet', 'Konfiguration bzw. «npm ci» herstellen');
  if (lauf.fehler !== null) {
    return rotSchritt(
      `Testlauf nicht beendet: ${lauf.fehler}`,
      'hängenden Test bzw. Startfehler beheben',
    );
  }
  const exit = `Exit ${String(lauf.status)}`;
  if (
    /\bUnhandled Errors?\b|\bunhandled errors? during\b/i.test(
      ohneFarben(`${lauf.stdout}\n${lauf.stderr}`),
    )
  ) {
    return rotSchritt(
      `Läufer meldet unbehandelte Fehler (${exit})`,
      'unbehandelte Fehler beheben (Ausgabe des Testlaufs); sie sind nie fachlich rot (ADR-010 §3.3)',
    );
  }
  if (!existsSync(v.bericht)) {
    return rotSchritt(
      `Bericht fehlt: ${berichtAnzeige(k.root, v.bericht)} (Läufer ${exit})`,
      'Ausgabe des Testlaufs prüfen; ohne Bericht kein Ergebnis',
    );
  }
  const s = bewerte(k, id, v.bericht);
  if (!s.ok) return { ...s, ms: dauer() };
  if (lauf.status !== 0) {
    const p =
      k.paket === null ? undefined : pakete(k.root).find((x) => x.name.toLowerCase() === k.paket);
    const ids = p !== undefined && !p.umgesetzt ? new Set(paketIdsAusPlan(k.root, p.name)) : null;
    const erklaert =
      ids !== null &&
      leseBericht(v.bericht).tests.some(
        (t) => t.status === 'failed' && idsIn(t.name).some((i) => ids.has(i)),
      );
    if (!erklaert) {
      return rotSchritt(
        `Läufer endete mit ${exit}, ohne dass ein roter Test des Pakets ihn erklärt`,
        'Ausgabe des Testlaufs prüfen (Absturz, Fehler ausserhalb der Tests)',
      );
    }
  }
  return { ...s, ms: dauer() };
}

/**
 * Anzeige eines Berichtspfads: repo-relativ, ausserhalb des Worktrees nur «Rohbericht (temporär)».
 * @param {string} root
 * @param {string} bericht
 * @returns {string}
 */
function berichtAnzeige(root, bericht) {
  const rel = relative(root, bericht).split(sep).join('/');
  return rel.startsWith('..') || isAbsolute(rel) ? 'Rohbericht (temporär)' : zeigePfad(rel);
}

/**
 * Führt eine Vitest-Konfiguration aus und schreibt den JSON-Bericht.
 * @param {Kontext} k
 * @param {string} konfig
 * @param {string} berichtRel
 * @param {{ art?: 'vitest' | 'selbsttest'; tz?: string; leerErlaubt?: boolean; timeoutMs?: number; env?: Record<string, string> }} [o]
 * @returns {Promise<{ lauf: import('./lib/prozess.mjs').Lauf | null; bericht: string; fehlt: string | null }>}
 */
async function vitestLauf(k, konfig, berichtRel, o = {}) {
  const bericht = isAbsolute(berichtRel) ? berichtRel : join(k.root, ...berichtRel.split('/'));
  // Ein alter Bericht darf nie als Ergebnis dieses Laufs gelten (CR-E101-01).
  rmSync(bericht, { force: true });
  const vitest = werkzeug(k.root, 'vitest');
  if (vitest === null) return { lauf: null, bericht, fehlt: 'vitest fehlt in node_modules' };
  if (!existsSync(join(k.root, konfig))) return { lauf: null, bericht, fehlt: `${konfig} fehlt` };
  mkdirSync(dirname(bericht), { recursive: true });
  const env = kindEnv(k, o.art ?? 'vitest');
  if (o.tz !== undefined) env.TZ = o.tz;
  Object.assign(env, o.env ?? {});
  const lauf = await starteNode(
    vitest,
    [
      'run',
      '-c',
      konfig,
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${berichtRel}`,
      ...(o.leerErlaubt ? ['--passWithNoTests'] : []),
    ],
    { cwd: k.root, env, timeoutMs: o.timeoutMs ?? ZEIT.lang },
  );
  return { lauf, bericht, fehlt: null };
}

/** R-H-36: ausschliesslich die vom Auftraggeber benannten Selbsttest-Eingaben.
 * @param {string} pfad
 * @returns {boolean}
 */
function selbsttestEingabe(pfad) {
  return (
    /^(?:scripts\/(?:wap-gate|wap)|tests\/(?:wap-gate|wap-harness))\//i.test(pfad) ||
    /(?:^|\/)(?:vitest|playwright|gate)(?:\.[^/]*)?\.config\.[^/]+$/i.test(pfad) ||
    pfad === 'package.json'
  );
}

/** Kritische Änderungen gegen den Commit und neue kritische Dateien verhindern den Commitbeleg.
 * @param {string} root
 * @param {string} commit
 * @returns {boolean}
 */
function selbsttestEingabenGleich(root, commit) {
  const diff = git(root, ['diff', '--name-only', '-z', '--no-renames', commit, '--']);
  const neue = git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  return (
    diff.status === 0 &&
    neue.status === 0 &&
    ![...diff.stdout.split('\0'), ...neue.stdout.split('\0')].some(selbsttestEingabe)
  );
}

/** @param {unknown} wert
 * @returns {Record<string, unknown> | null}
 */
function selbsttestObjekt(wert) {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert)
    ? /** @type {Record<string, unknown>} */ (wert)
    : null;
}

/** Vollständiger grüner Vitest-Beleg; Suitezahlen zählen auch Describe-Gruppen, nicht nur Dateien.
 * @param {unknown} daten
 * @returns {boolean}
 */
function selbsttestBerichtGruen(daten) {
  const b = selbsttestObjekt(daten);
  if (
    b === null ||
    b.success !== true ||
    typeof b.numTotalTests !== 'number' ||
    !Number.isSafeInteger(b.numTotalTests) ||
    b.numTotalTests <= 0 ||
    b.numPassedTests !== b.numTotalTests ||
    typeof b.numTotalTestSuites !== 'number' ||
    !Number.isSafeInteger(b.numTotalTestSuites) ||
    b.numTotalTestSuites <= 0 ||
    b.numPassedTestSuites !== b.numTotalTestSuites ||
    b.numFailedTests !== 0 ||
    b.numPendingTests !== 0 ||
    b.numFailedTestSuites !== 0 ||
    b.numPendingTestSuites !== 0 ||
    (b.numTodoTests !== undefined && b.numTodoTests !== 0) ||
    (b.numRuntimeErrorTestSuites !== undefined && b.numRuntimeErrorTestSuites !== 0) ||
    (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length !== 0)) ||
    !Array.isArray(b.testResults) ||
    b.testResults.length === 0
  )
    return false;
  let anzahl = 0;
  for (const datei of b.testResults) {
    const f = selbsttestObjekt(datei);
    if (
      f === null ||
      f.status !== 'passed' ||
      typeof f.name !== 'string' ||
      f.name === '' ||
      typeof f.message !== 'string' ||
      f.message.trim() !== '' ||
      !Array.isArray(f.assertionResults)
    )
      return false;
    for (const assertion of f.assertionResults) {
      const a = selbsttestObjekt(assertion);
      if (
        a === null ||
        a.status !== 'passed' ||
        !Array.isArray(a.failureMessages) ||
        a.failureMessages.length !== 0
      )
        return false;
      anzahl++;
    }
  }
  return anzahl === b.numTotalTests;
}

/** Nur der Selbsttest darf den gemeinsamen lokalen Commitbeleg erzeugen oder wiederverwenden.
 * @param {Kontext} k
 * @param {string} konfig
 * @param {string} berichtRel
 * @returns {Promise<Schritt>}
 */
async function selbsttestSchritt(k, konfig, berichtRel) {
  const beginn = Date.now();
  const id = 'V1a-selbsttest';
  const gitDir = gemeinsamesGitVerzeichnis(k.root);
  const belegPfad = gitDir === null ? null : join(gitDir, 'wap-gate', 'v1a-selbsttest-gruen.json');
  const berichtPfad = join(k.root, ...berichtRel.split('/'));
  if (k.etappenAbschluss === undefined && belegPfad !== null) {
    try {
      const beleg = selbsttestObjekt(JSON.parse(readFileSync(belegPfad, 'utf8')));
      if (
        beleg !== null &&
        beleg.version === 1 &&
        beleg.art === id &&
        beleg.exit === 0 &&
        typeof beleg.commit === 'string' &&
        /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(beleg.commit) &&
        commitVon(k.root, beleg.commit) === beleg.commit &&
        typeof beleg.berichtRaw === 'string' &&
        createHash('sha256').update(beleg.berichtRaw).digest('hex') === beleg.berichtSha256 &&
        isDeepStrictEqual(JSON.parse(beleg.berichtRaw), beleg.bericht) &&
        selbsttestBerichtGruen(beleg.bericht) &&
        selbsttestEingabenGleich(k.root, beleg.commit)
      ) {
        const status = `WIEDERVERWENDET ${beleg.commit}`;
        const queue = join(k.root, 'docs', 'wap-planer', 'claude-review-warteschlange.md');
        const vorher = readFileSync(queue);
        mkdirSync(dirname(berichtPfad), { recursive: true });
        writeTransaktion([
          { file: berichtPfad, content: Buffer.from(beleg.berichtRaw, 'utf8') },
          { file: queue, content: Buffer.concat([vorher, Buffer.from(`\n${status}\n`)]) },
        ]);
        return { id, ok: true, ms: Date.now() - beginn, details: { status } };
      }
    } catch {
      // Ohne gültigen Beleg und gemeinsam geschriebenen Bericht/Queue immer wirklich prüfen.
    }
  }
  const commit = commitVon(k.root, 'HEAD');
  const eingabenGebunden = commit !== null && selbsttestEingabenGleich(k.root, commit);
  const v = await vitestLauf(k, konfig, berichtRel, {
    art: 'selbsttest',
    timeoutMs: ZEIT.sehrLang,
  });
  const s =
    v.fehlt !== null
      ? { id, ok: false, ms: 0, ursache: v.fehlt, naechsterSchritt: 'Konfiguration herstellen' }
      : bewerteLauf(k, id, v);
  if (
    s.ok &&
    v.lauf !== null &&
    v.lauf.status === 0 &&
    v.lauf.signal === null &&
    v.lauf.fehler === null &&
    eingabenGebunden &&
    commit !== null &&
    belegPfad !== null &&
    commitVon(k.root, 'HEAD') === commit &&
    selbsttestEingabenGleich(k.root, commit)
  ) {
    try {
      const berichtRaw = readFileSync(v.bericht, 'utf8');
      const bericht = /** @type {unknown} */ (JSON.parse(berichtRaw));
      if (selbsttestBerichtGruen(bericht)) {
        mkdirSync(dirname(belegPfad), { recursive: true });
        writeTransaktion([
          {
            file: belegPfad,
            content: `${JSON.stringify({
              version: 1,
              art: id,
              commit,
              exit: 0,
              bericht,
              berichtRaw,
              berichtSha256: createHash('sha256').update(berichtRaw).digest('hex'),
            })}\n`,
          },
        ]);
      }
    } catch {
      // Ein nicht speicherbarer Beleg ändert den tatsächlichen grünen Lauf nicht; nächstes Mal neu.
    }
  }
  return s;
}

/**
 * npm-Skript ohne Shell starten (npm-cli.js neben dem laufenden Node).
 * @param {Kontext} k
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<import('./lib/prozess.mjs').Lauf | null>}
 */
async function npm(k, args, env) {
  const cli = npmCli();
  if (cli === null) return null;
  return starte(process.execPath, [cli, ...args], { cwd: k.root, env, timeoutMs: ZEIT.lang });
}

/**
 * Status je Test eines Berichts (für den Vergleich der Zeitzonen und den Stabilitätslauf).
 * @param {string} bericht
 * @returns {Map<string, string> | null}
 */
export function statusJeTest(bericht) {
  if (!existsSync(bericht)) return null;
  try {
    const b = leseBericht(bericht);
    const m = new Map(b.tests.map((t) => [`${t.datei} > ${t.name}`, t.status]));
    for (const f of b.dateiFehler) m.set(`${f.datei} > (Laden)`, 'failed');
    return m;
  } catch {
    return null;
  }
}

/**
 * Vergleichsstand für Lock-Prüfung und Datenschutz über Commits (ADR-010 §3.2): auf wap/<paket> die
 * Merge-Basis mit wap-planer, auf wap-planer der erste Elternteil.
 * @param {string} root
 * @param {string} zweig
 * @returns {string | null}
 */
function vergleichsstand(root, zweig) {
  if (zweig === 'wap-planer') return commitVon(root, 'HEAD^1');
  return mergeBasis(root, 'HEAD', 'wap-planer');
}

/**
 * Führt die Schritte ab F2 aus (nach F1, Sperre und F0-last; im Selbsttest auch einzeln über `nur`).
 * @param {'fast' | 'full'} modus
 * @param {Kontext} k
 * @returns {Promise<void>}
 */
export async function schleusenSchritte(modus, k) {
  const soll = (/** @type {string} */ nr) => k.nur === undefined || k.nur.includes(nr);
  const env = kindEnv(k, 'sonst');
  const basis = modus === 'full' ? vergleichsstand(k.root, k.zweig) : null;

  // F2 Lock-Prüfung (H0) und Sperre der bestätigten Anhänge; rot → sofortiger Abbruch.
  if (!k.preCommit && soll('F2')) {
    /** @type {Schritt[]} */
    const f2 = [];
    const lock = await starteNode(join(H0_DIR, 'lock-check.mjs'), ['--root', k.root], {
      cwd: k.root,
      env,
      timeoutMs: ZEIT.kurz,
    });
    f2.push(
      ausLauf(
        'F2-lock',
        lock,
        'Lock-Prüfung gescheitert',
        'gesperrte Dateien wiederherstellen; Änderungen nur über lock-update mit Grund (Orchestrator)',
      ),
    );
    if (modus === 'full') {
      if (basis === null) {
        f2.push({
          id: 'F2-gegen',
          ok: false,
          ms: 0,
          ursache: 'Vergleichsstand nicht bestimmbar (Merge-Basis mit wap-planer bzw. HEAD^1)',
          naechsterSchritt: 'Zweig wap-planer bereitstellen und erneut starten',
        });
      } else {
        const gegen = await starteNode(
          join(H0_DIR, 'lock-check.mjs'),
          ['--root', k.root, '--gegen', basis],
          { cwd: k.root, env, timeoutMs: ZEIT.kurz },
        );
        f2.push(
          ausLauf(
            'F2-gegen',
            gegen,
            'Sperrdatei gegenüber dem Vergleichsstand ohne Protokoll geändert',
            'Änderungen an test-lock.json nur über lock-update',
          ),
        );
        if (k.zweig !== '') {
          const ref = await starteNode(
            join(H0_DIR, 'lock-check.mjs'),
            ['--root', k.root, '--ref', k.zweig, '--gegen', basis],
            { cwd: k.root, env, timeoutMs: ZEIT.kurz },
          );
          f2.push(
            ausLauf(
              'F2-ref',
              ref,
              'Lock-Prüfung aus Objekten gescheitert',
              'gesperrte Dateien im Zweig wiederherstellen',
            ),
          );
        }
      }
    }
    // Die Sperre der bestätigten Anhänge läuft immer; fehlt reference-lock.json, ist F2 rot (CR-E101-08).
    const refOrdner = standardReferenzOrdner(k.root);
    f2.push(
      refOrdner === null
        ? {
            id: 'F2-referenz',
            ok: false,
            ms: 0,
            ursache: `Referenzordner nicht bestimmbar (${REFERENCE_LOCK_REL} nicht prüfbar)`,
            naechsterSchritt: 'WAP_REFERENCE_DIR setzen',
          }
        : await checkReferenceLock({ cwd: k.root, referenceDir: refOrdner }),
    );
    for (const s of f2) k.melde(s);
    if (f2.some((s) => !s.ok)) return;
  }

  // F3 Datenschutz-Scan (H0) und Inhalte von Containern.
  if (soll('F3')) {
    if (!k.preCommit) {
      const scan = await starteNode(join(H0_DIR, 'privacy-scan.mjs'), ['--staged'], {
        cwd: k.root,
        env,
        timeoutMs: ZEIT.kurz,
      });
      k.melde(
        ausLauf(
          'F3-scan',
          scan,
          'Datenschutz-Scan mit Befund',
          'Personendaten aus den gestagten Dateien entfernen',
        ),
      );
    }
    k.melde(await deepPrivacyScan({ cwd: k.root, staged: true }));
  }

  // F4 Verbotene Muster.
  if (soll('F4')) k.melde(await scanForbidden({ cwd: k.root }));

  // F5 Lint (Biome).
  if (soll('F5')) k.melde(await biomeSchritt(k, env));

  // F6 Typprüfung.
  if (soll('F6')) {
    const t = await checkTypes({ cwd: k.root });
    k.melde({
      ...t,
      details: { ...(typeof t.details === 'object' ? t.details : {}), verworfen: t.verworfen },
    });
  }

  // F7 Grenzen.
  if (soll('F7')) {
    k.melde(await checkModuleBoundaries({ cwd: k.root }));
    const mainBasis = mergeBasis(k.root, 'main', 'HEAD');
    k.melde(
      mainBasis === null
        ? {
            id: 'F7-suite',
            ok: false,
            ms: 0,
            ursache: 'Vergleichsstand fehlt: Merge-Basis mit main nicht bestimmbar',
            naechsterSchritt:
              'Zweig main bereitstellen (git merge-base main HEAD) und erneut starten',
          }
        : await checkSuiteBoundary({ cwd: k.root, basis: mainBasis }),
    );
    k.melde(await checkLockCoverage({ cwd: k.root }));
    // R-H-37 (Q-021): Suite-Konfiguration mit höchstens 4 Workern.
    k.melde(await checkSuiteWorker({ cwd: k.root }));
  }

  // F8 WAP-Vitest (Rot-Phase).
  if (soll('F8')) {
    const v = await vitestLauf(k, 'vitest.wap.config.ts', 'test-results/wap/vitest.json', {
      leerErlaubt: true,
    });
    k.melde(
      v.fehlt !== null
        ? {
            id: 'F8-vitest',
            ok: false,
            ms: 0,
            ursache: v.fehlt,
            naechsterSchritt: 'Konfiguration bzw. «npm ci» herstellen',
          }
        : bewerteLauf(k, 'F8-vitest', v),
    );
  }

  // F9 Rückverfolgbarkeit, statischer Teil.
  if (soll('F9')) k.melde(await trace({ cwd: k.root, modus: 'fast' }));

  // F10 Lizenzen (R-H-23 Kriterium 1, ADR-010 §9): neue oder geänderte Pakete gegenüber main.
  if (soll('F10')) {
    const mainBasis = mergeBasis(k.root, 'main', 'HEAD');
    k.melde(
      mainBasis === null
        ? {
            id: 'F10-lizenzen',
            ok: false,
            ms: 0,
            ursache: 'Vergleichsstand fehlt: Merge-Basis mit main nicht bestimmbar',
            naechsterSchritt:
              'Zweig main bereitstellen (git merge-base main HEAD) und erneut starten',
          }
        : await checkLicenses({ cwd: k.root, basis: mainBasis }),
    );
  }

  if (modus === 'fast') return;

  // Alte Berichte der vollen Schleuse gelten nie als Ergebnis dieses Laufs (CR-E101-01).
  for (const b of [
    ...PFLICHTBERICHTE,
    PLAYWRIGHT_BERICHT,
    'test-results/wap/vitest-tz-utc.json',
    'test-results/wap/vitest-tz-new-york.json',
    SUITE_BERICHT,
    GOLDEN_BERICHT,
  ]) {
    rmSync(join(k.root, ...b.split('/')), { force: true });
  }

  // V1 WAP-Vitest in drei Zeitzonen. Nur der erste Lauf legt erzeugte PDF für V5-ebene2 ab; der Ordner
  // wird davor geleert (Vertrag E1-01b §2 «pdfArtefakt»).
  if (soll('V1')) {
    const pdfOrdner = join(k.root, ...PDF_ORDNER.split('/'));
    rmSync(pdfOrdner, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    /** @type {Map<string, string>[]} */
    const staende = [];
    /** @type {Schritt | null} */
    let erster = null;
    for (const [tz, datei] of /** @type {[string | undefined, string][]} */ ([
      [undefined, 'test-results/wap/vitest.json'],
      ['UTC', 'test-results/wap/vitest-tz-utc.json'],
      ['America/New_York', 'test-results/wap/vitest-tz-new-york.json'],
    ])) {
      const v = await vitestLauf(k, 'vitest.wap.config.ts', datei, {
        leerErlaubt: true,
        ...(tz === undefined ? { env: { WAP_PDF_ARTEFAKTE: pdfOrdner } } : { tz }),
      });
      if (v.fehlt !== null) {
        erster = {
          id: 'V1-vitest',
          ok: false,
          ms: 0,
          ursache: v.fehlt,
          naechsterSchritt: 'Konfiguration herstellen',
        };
        break;
      }
      const s = bewerteLauf(k, 'V1-vitest', v);
      if (erster === null || (erster.ok && !s.ok)) {
        erster =
          s.ursache === undefined
            ? s
            : { ...s, ursache: `${tz ?? 'lokale Zeitzone'}: ${s.ursache}` };
      }
      staende.push(statusJeTest(v.bericht) ?? new Map());
    }
    if (erster !== null) k.melde(erster);
    if (staende.length === 3) {
      const [a, b, c] = staende;
      const abweichend = [
        ...new Set([...(a?.keys() ?? []), ...(b?.keys() ?? []), ...(c?.keys() ?? [])]),
      ].filter((n) => a?.get(n) !== b?.get(n) || a?.get(n) !== c?.get(n));
      k.melde(
        abweichend.length === 0
          ? { id: 'V1-zeitzonen', ok: true, ms: 0 }
          : {
              id: 'V1-zeitzonen',
              ok: false,
              ms: 0,
              ursache: `Ergebnis hängt von der Zeitzone ab: ${kurzeListe(abweichend)}`,
              naechsterSchritt: 'Zeitzonenabhängigkeit im Test bzw. im Code beheben (ADR-010 §4.5)',
            },
      );
    }
  }

  // V1a: Gate/Harness immer echt; nur Selbsttest nach R-H-36 / Auftraggeber 08.10.2026 wiederverwendbar
  // (wiederhergestellt aus E1-01i 387ac7d, F-TOOLS Runde 2).
  if (soll('V1a')) {
    for (const [
      id,
      konfig,
      bericht,
      art,
    ] of /** @type {[string, string, string, 'vitest' | 'selbsttest'][]} */ ([
      ['V1a-gate', 'vitest.wap-gate.config.ts', 'test-results/wap/vitest-gate.json', 'vitest'],
      [
        'V1a-harness',
        'vitest.wap-harness.config.ts',
        'test-results/wap/vitest-harness.json',
        'vitest',
      ],
      [
        'V1a-selbsttest',
        'vitest.wap-selbsttest.config.ts',
        'test-results/wap/vitest-selbsttest.json',
        'selbsttest',
      ],
    ])) {
      if (id === 'V1a-selbsttest') {
        k.melde(await selbsttestSchritt(k, konfig, bericht));
        continue;
      }
      const v = await vitestLauf(k, konfig, bericht, { art, timeoutMs: ZEIT.sehrLang });
      k.melde(
        v.fehlt !== null
          ? { id, ok: false, ms: 0, ursache: v.fehlt, naechsterSchritt: 'Konfiguration herstellen' }
          : bewerteLauf(k, id, v),
      );
    }
  }

  // V2 Abdeckung (R-H-16, ADR-010 §6): Vitest mit V8-Abdeckung, Schwellen je Pfadmenge und Modul.
  // FT-A-02: zuerst der E2E-Anteil (Projekt edge, eigener Lauf mit V8-Abdeckung), dann Vitest; beide
  // Datensätze zusammengeführt für alle Pfadmengen (R-H-16 «Vitest und E2E zusammengeführt»).
  if (soll('V2')) {
    const sw = ladeSchwellen(join(k.root, ...SCHWELLEN_REL.split('/')));
    const e2e = sw.ok
      ? await messeE2eAbdeckung({
          cwd: k.root,
          muster: sw.schwellen.mengen.flatMap((m) => m.muster),
        })
      : null;
    if (e2e !== null) k.melde(e2e);
    k.melde(
      await messeAbdeckung({
        cwd: k.root,
        env: kindEnv(k, 'vitest'),
        zusaetzlich: e2e?.ok ? [E2E_ISTANBUL] : [],
      }),
    );
  }

  // V3 Referenztests (test:reference).
  if (soll('V3')) k.melde(await referenzSchritt(k));

  // V4 End-to-End in Edge (Vertrag E1-01b §2 «runE2e»); in der Rot-Phase wird der Bericht wie V1 gewertet.
  if (soll('V4')) k.melde(await e2eSchritt(k));

  // V5 Ebene 2: erzeugte PDF aus V1 und V4 (Mindestschriftgrösse, eingebettete Schriften).
  if (soll('V5')) {
    k.melde(await checkPdfArtefakte({ cwd: k.root }));
    k.melde(await goldenSchritt(k));
  }

  if (soll('V6')) {
    const { port: _port, ...r } = await runE2e({ cwd: k.root, project: 'chromium-visual' });
    const d =
      /** @type {{ fehlendeBaselines?: string[]; bericht?: string; exit?: number | null; laeuferFehler?: boolean }} */ (
        r.details ?? {}
      );
    if ((d.fehlendeBaselines?.length ?? 0) > 0) {
      let nurFehlendeBaselines = false;
      if (d.bericht && d.exit === 1 && d.laeuferFehler !== true) {
        const b = leseBericht(join(k.root, d.bericht));
        nurFehlendeBaselines =
          b.dateiFehler.length === 0 &&
          b.tests.filter((t) => t.status !== 'passed').length === d.fehlendeBaselines?.length;
      }
      const fehlend = `Baseline fehlt: ${String(d.fehlendeBaselines?.length)} Kernzustände (Schritt 8)`;
      k.melde({
        ...r,
        ok: false,
        ursache: nurFehlendeBaselines
          ? fehlend
          : `${fehlend}; ${r.ursache ?? 'weitere Bildfehler'}`,
        naechsterSchritt: nurFehlendeBaselines
          ? 'Baseline-Aufnahme durch den Orchestrator'
          : 'Baseline-Aufnahme durch den Orchestrator; übrige Fehler im Bericht test-results/wap/playwright-visual.json beheben',
      });
    } else k.melde(r);
  }
  if (soll('V7')) {
    const r = await e2eSchritt(k, 'perf');
    k.melde(r);
    const d = /** @type {{ tests?: number }} */ (r.details ?? {});
    k.melde(
      comparePerf({
        messungen: (d.tests ?? 0) > 0 ? join(k.root, 'test-results/wap/perf.json') : null,
        baseline: join(k.root, 'docs/wap-planer/perf/perf-baseline.json'),
        drosselung: join(k.root, 'docs/wap-planer/perf/drosselung.json'),
        budgets: join(k.root, 'docs/wap-planer/perf/budgets.json'),
        regel: 'prozent10oder2ms',
      }),
    );
  }

  // V8 Mutationstests (R-H-17, ADR-010 §6.3): inkrementell über die geänderten Dateien der Pfadmenge,
  // mit --etappen-abschluss über die ganze Pfadmenge.
  if (soll('V8')) {
    k.melde(
      await runMutation({
        cwd: k.root,
        basis,
        alle: k.etappenAbschluss !== undefined,
        env: kindEnv(k, 'stryker'),
      }),
    );
  }

  // V9 Rückverfolgbarkeit, vollständig.
  if (soll('V9')) {
    k.melde(
      await trace({
        cwd: k.root,
        modus: 'full',
        ...(k.etappenAbschluss === undefined ? {} : { etappenAbschluss: k.etappenAbschluss }),
      }),
    );
  }

  // V10 Suite-Regression mit test:oracle über checkPython.
  if (soll('V10')) await suiteRegression(k);

  // V11 Datenschutz über Stand, Commits und erzeugte Artefakte.
  if (soll('V11')) await datenschutzVoll(k, basis, env);
}

/**
 * V5-golden (R-H-20, ADR-010 §7.3): Golden-Tests mit fixierter Render-Kette; rot bei abweichendem Bild,
 * fehlender Baseline (Aufnahme ausstehend) oder geänderter Render-Kette (Grund, nicht Pixelfehler).
 * @param {Kontext} k
 * @returns {Promise<Schritt>}
 */
async function goldenSchritt(k) {
  const v = await vitestLauf(k, 'vitest.wap-golden.config.ts', GOLDEN_BERICHT, {
    timeoutMs: ZEIT.lang,
  });
  if (v.fehlt !== null) {
    return {
      id: 'V5-golden',
      ok: false,
      ms: 0,
      ursache: v.fehlt,
      naechsterSchritt: 'Golden-Konfiguration bzw. «npm ci» herstellen',
    };
  }
  const ausgabe = ohneFarben(`${v.lauf?.stdout ?? ''}\n${v.lauf?.stderr ?? ''}`);
  const kette = /Render-Kette geändert: [^\n]*/.exec(ausgabe);
  if (kette !== null) {
    return {
      id: 'V5-golden',
      ok: false,
      ms: v.lauf?.ms ?? 0,
      ursache: kette[0].slice(0, 600),
      naechsterSchritt:
        'Render-Kette gemäss tests/wap/golden/render-chain.json herstellen (npm ci) oder Kette und Baselines per lock-update nachführen (eigener Commit, Gate B)',
    };
  }
  const geprueft = bewerteLauf(k, 'V5-golden', v);
  if (geprueft.ok || !existsSync(v.bericht)) return geprueft;
  const rote = leseBericht(v.bericht).tests.filter((t) => t.status !== 'passed');
  // Erste Zeile der Meldung je rotem Golden-Test (Bildname und Art der Abweichung, nie Bildinhalte).
  const meldungen = rote.map((t) =>
    ohneFarben(t.fehler[0] ?? '')
      .split(/\r?\n/)[0]
      ?.replace(/^AssertionError: /, '')
      .slice(0, 300),
  );
  const s = {
    ...geprueft,
    details: {
      ...(typeof geprueft.details === 'object' ? geprueft.details : {}),
      meldungen,
    },
  };
  const fehlend = rote.filter((t) => t.fehler.some((f) => f.includes('Baseline fehlt:')));
  if (fehlend.length === 0) {
    return {
      ...s,
      naechsterSchritt:
        'Abweichung prüfen (Vorher/Nachher/Differenz unter test-results/wap/golden/diff/); gewollte Änderung als neue Baseline aufnehmen (npm run wap:golden:aufnahme, visual-qa, lock-update)',
    };
  }
  return {
    ...s,
    ursache: `Baseline fehlt: ${String(fehlend.length)} Golden-Bilder (Aufnahme ausstehend); ${s.ursache ?? ''}`,
    naechsterSchritt:
      'Golden-Kandidaten aufnehmen: npm run wap:golden:aufnahme -- --grund «…», visual-qa, lock-update (Prompt §5.2 Schritt 8)',
  };
}

/**
 * F5: `biome check .` (Suite-Regeln plus WAP-Überschreibungen).
 * @param {Kontext} k
 * @param {Record<string, string>} env
 * @returns {Promise<Schritt>}
 */
async function biomeSchritt(k, env) {
  const biome = werkzeug(k.root, 'biome');
  if (biome === null) {
    return {
      id: 'F5-lint',
      ok: false,
      ms: 0,
      ursache: 'Biome fehlt in node_modules',
      naechsterSchritt: '«npm ci» ausführen',
    };
  }
  const r = await starteNode(biome, ['check', '.', '--reporter=github', '--max-diagnostics=none'], {
    cwd: k.root,
    env,
    timeoutMs: ZEIT.kurz,
  });
  if (r.status === 0 && r.fehler === null) return { id: 'F5-lint', ok: true, ms: r.ms };
  /** @type {Set<string>} */
  const dateien = new Set();
  for (const m of r.stdout.matchAll(/^::error [^\n]*?file=([^,\n]+)/gm)) {
    const pfad = decodeURIComponent((m[1] ?? '').replace(/%(?![0-9A-Fa-f]{2})/g, '%25')).replace(
      /\\/g,
      '/',
    );
    const wurzelPfad = k.root.replace(/\\/g, '/');
    dateien.add(
      pfad.toLowerCase().startsWith(`${wurzelPfad.toLowerCase()}/`)
        ? pfad.slice(wurzelPfad.length + 1)
        : pfad,
    );
  }
  return {
    id: 'F5-lint',
    ok: false,
    ms: r.ms,
    ursache:
      dateien.size > 0
        ? `Biome meldet Fehler in ${String(dateien.size)} Dateien: ${kurzeListe([...dateien].map((p) => zeigePfad(p)))}`
        : `Biome endete mit Exit ${String(r.status)}: ${r.fehler ?? auszug(`${r.stdout}\n${r.stderr}`)}`,
    naechsterSchritt:
      '«npx biome check .» ausführen und die Befunde beheben (Formatierung: «npx biome format --write <datei>»)',
  };
}

/**
 * V4: E2E über runE2e. In der Rot-Phase des laufenden Pakets (Kästchen 7 offen) wird der Bericht wie V1
 * gewertet (ADR-010 §3.3, Vertrag E1-01b §2 und Notiz Runde 2 Nr 8): Tests mit einer ID des Pakets müssen
 * fachlich rot sein, alle übrigen grün; ein Exit ≠ 0 muss ein fachlich roter Test des Pakets erklären.
 * Fehlen Konfiguration, Werkzeug, Bau oder Bericht, bleibt der Schritt rot.
 * @param {Kontext} k
 * @param {string} [project]
 * @returns {Promise<Schritt>}
 */
async function e2eSchritt(k, project) {
  const { port: _port, ...r } = await runE2e({
    cwd: k.root,
    ...(project === undefined ? {} : { project }),
  });
  const p =
    k.paket === null ? undefined : pakete(k.root).find((x) => x.name.toLowerCase() === k.paket);
  if (p === undefined || p.umgesetzt) return r;
  const d = /** @type {{ bericht?: unknown; exit?: unknown; gestartet?: unknown }} */ (
    typeof r.details === 'object' && r.details !== null ? r.details : {}
  );
  if (typeof d.bericht !== 'string' || d.gestartet !== true) return r;
  const bericht = join(k.root, ...d.bericht.split('/'));
  const s = bewerte(k, r.id, bericht);
  if (!s.ok) return { ...s, ms: r.ms, details: r.details };
  if (d.exit !== 0) {
    const ids = new Set(paketIdsAusPlan(k.root, p.name));
    const erklaert = leseBericht(bericht).tests.some(
      (t) => t.status === 'failed' && idsIn(t.name).some((i) => ids.has(i)),
    );
    if (!erklaert) {
      return {
        id: r.id,
        ok: false,
        ms: r.ms,
        ursache: `Playwright endete mit Exit ${String(d.exit)}, ohne dass ein roter Test des Pakets ihn erklärt`,
        naechsterSchritt: 'Ausgabe des E2E-Laufs prüfen (Absturz, Fehler ausserhalb der Tests)',
        details: r.details,
      };
    }
  }
  return { ...s, ms: r.ms, details: r.details };
}

/**
 * V3: test:reference mit WAP_REFERENCE_DIR; fehlende Referenzdatei → rot (nie «skip»). Räumt zuerst
 * verwaiste temporäre Ordner früherer Läufe auf (E1-01-24) und meldet ihre Anzahl in details.verwaistEntfernt.
 * @param {Kontext} k
 * @returns {Promise<Schritt>}
 */
async function referenzSchritt(k) {
  const verwaist = raeumeVerwaisteTemp({ praefix: 'wap-v3-' });
  const s = await referenzLauf(k);
  const details = typeof s.details === 'object' && s.details !== null ? s.details : {};
  return { ...s, details: { ...details, verwaistEntfernt: verwaist.entfernt } };
}

/**
 * V3 ohne Aufräumen (siehe referenzSchritt).
 * @param {Kontext} k
 * @returns {Promise<Schritt>}
 */
async function referenzLauf(k) {
  // Ohne Referenztests startet Vitest keinen globalSetup; die Dateien werden deshalb hier mit derselben
  // Prüfung wie im globalSetup kontrolliert (fehlende Referenz = rot, nie «skip», Prompt §5.6).
  const gesetzt = process.env.WAP_REFERENCE_DIR;
  const refDir =
    gesetzt !== undefined && gesetzt.trim() !== '' ? gesetzt : standardReferenzOrdner(k.root);
  if (existsSync(join(k.root, 'vitest.wap-reference.config.ts'))) {
    try {
      pruefeReferenzen({ ...process.env, WAP_REFERENCE_DIR: refDir ?? '' }, k.root);
    } catch (e) {
      return {
        id: 'V3-referenz',
        ok: false,
        ms: 0,
        ursache: `test:reference gescheitert: ${e instanceof Error ? e.message.split('. Nächster Schritt')[0] : String(e)}`,
        naechsterSchritt:
          'Referenzdateien unter WAP_REFERENCE_DIR bereitstellen (nie überspringen, Prompt §5.6)',
      };
    }
  }
  // Rohbericht mit Meldungstexten nur in einem eigenen temporären Ordner ausserhalb des Worktrees
  // (E1-01-22, AGENTS.md): Fehlermeldungen von Referenztests könnten echte Zellinhalte enthalten. In den
  // Worktree kommt nur der bereinigte Bericht (Testname, Status, Anzahl); der Rohbericht wird nach dem
  // Bewerten gelöscht, auch bei Abbruch. Die Ausgabe des Kind-Vitest wird nicht durchgereicht.
  const ziel = join(k.root, 'test-results', 'wap', 'vitest-reference.json');
  rmSync(ziel, { force: true });
  const tmp = eigenerTempOrdner('wap-v3-');
  /** @type {Schritt} */
  let s;
  /** @type {{ lauf: import('./lib/prozess.mjs').Lauf | null; bericht: string; fehlt: string | null }} */
  let v;
  try {
    v = await vitestLauf(k, 'vitest.wap-reference.config.ts', join(tmp, 'roh.json'), {
      leerErlaubt: true,
      ...(refDir === null ? {} : { env: { WAP_REFERENCE_DIR: refDir } }),
    });
    if (v.fehlt !== null) {
      return {
        id: 'V3-referenz',
        ok: false,
        ms: 0,
        ursache: v.fehlt,
        naechsterSchritt: 'Konfiguration herstellen',
      };
    }
    s = bewerteLauf(k, 'V3-referenz', v);
    ohneMeldungen(v.bericht, ziel);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  if (s.ok) return s;
  const text = ohneFarben(`${v.lauf?.stdout ?? ''}\n${v.lauf?.stderr ?? ''}`);
  const grund = /Referenzdatei fehlt/.test(text)
    ? 'Referenzdatei fehlt'
    : /WAP_REFERENCE_DIR/.test(text)
      ? 'WAP_REFERENCE_DIR fehlt oder ist ungültig'
      : 'Referenztests rot';
  return {
    ...s,
    ursache: `test:reference gescheitert: ${grund}; ${s.ursache ?? ''}`,
    naechsterSchritt:
      'Referenzdateien unter WAP_REFERENCE_DIR bereitstellen bzw. rote Referenztests beheben («npm run test:reference»)',
  };
}

/**
 * Schreibt einen Vitest-Bericht ohne Meldungstexte nach `ziel` (E1-01-22); Testnamen, Status und
 * Anzahlen bleiben. Fehlt der Rohbericht oder ist er nicht lesbar, entsteht kein Bericht.
 * @param {string} roh
 * @param {string} ziel
 * @returns {void}
 */
function ohneMeldungen(roh, ziel) {
  rmSync(ziel, { force: true });
  if (!existsSync(roh)) return;
  /**
   * Nur die genannten Felder übernehmen (Positivliste, CR-E101-204).
   * @param {Record<string, unknown>} quelle
   * @param {string[]} felder
   * @returns {Record<string, unknown>}
   */
  const nur = (quelle, felder) =>
    Object.fromEntries(felder.filter((f) => f in quelle).map((f) => [f, quelle[f]]));
  try {
    const d = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(roh, 'utf8')));
    /** @type {Record<string, unknown>} */
    const aus = {};
    // Gesamtzahlen und Zeiten (nur Zahlen und Wahrheitswerte).
    for (const [f, wert] of Object.entries(d)) {
      if (
        (f.startsWith('num') || f === 'startTime' || f === 'success') &&
        typeof wert !== 'object'
      ) {
        aus[f] = wert;
      }
    }
    const dateien = Array.isArray(d.testResults) ? d.testResults : [];
    aus.testResults = dateien.map((roheDatei) => {
      const datei = /** @type {Record<string, unknown>} */ (roheDatei ?? {});
      const tests = Array.isArray(datei.assertionResults) ? datei.assertionResults : [];
      return {
        ...nur(datei, ['name', 'status', 'startTime', 'endTime']),
        assertionResults: tests.map((t) =>
          nur(/** @type {Record<string, unknown>} */ (t ?? {}), [
            'ancestorTitles',
            'title',
            'fullName',
            'status',
            'duration',
            'location',
          ]),
        ),
      };
    });
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, JSON.stringify(aus));
  } catch {
    // Nicht lesbar: kein Bericht im Worktree (V9 meldet ihn als fehlend).
    rmSync(ziel, { force: true });
  }
}

/**
 * V10: npm run check (aufgeteilt, mit Messung des WAP-Anteils), build, check:release, Python, test:oracle.
 * @param {Kontext} k
 * @returns {Promise<void>}
 */
async function suiteRegression(k) {
  const env = kindEnv(k, 'vitest');
  const suiteBericht = SUITE_BERICHT;
  rmSync(join(k.root, ...suiteBericht.split('/')), { force: true });
  /** @type {string[]} */
  const rot = [];
  let ms = 0;
  for (const args of [
    ['run', 'typecheck'],
    ['run', 'lint'],
    ['test', '--', '--reporter=default', '--reporter=json', `--outputFile.json=${suiteBericht}`],
  ]) {
    const r = await npm(k, args, env);
    if (r === null) {
      rot.push('npm-cli.js fehlt neben dem laufenden Node');
      break;
    }
    ms += r.ms;
    if (r.status !== 0 || r.fehler !== null)
      rot.push(
        `npm ${args.slice(0, 2).join(' ')}: ${r.fehler ?? auszug(`${r.stdout}\n${r.stderr}`, 3)}`,
      );
  }
  k.melde(
    rot.length === 0
      ? { id: 'V10-check', ok: true, ms }
      : {
          id: 'V10-check',
          ok: false,
          ms,
          ursache: rot.join('; '),
          naechsterSchritt:
            'Suite-Regression beheben («npm run check»); die Suite bleibt grün (Prompt §5.6)',
        },
  );
  const bericht = join(k.root, ...suiteBericht.split('/'));
  if (existsSync(bericht)) {
    let wapMs = 0;
    try {
      const d =
        /** @type {{ testResults?: { name?: string; startTime?: number; endTime?: number }[] }} */ (
          JSON.parse(readFileSync(bericht, 'utf8'))
        );
      for (const f of d.testResults ?? []) {
        if (/[\\/]tests[\\/]wap[\\/]/.test(f.name ?? ''))
          wapMs += Math.max(0, (f.endTime ?? 0) - (f.startTime ?? 0));
      }
      k.melde(
        wapMs <= 60_000
          ? { id: 'V10-wap-anteil', ok: true, ms: 0, details: { wapMs } }
          : {
              id: 'V10-wap-anteil',
              ok: false,
              ms: 0,
              ursache: `WAP-Anteil im Suite-npm test ${String(Math.round(wapMs / 1000))} s über 60 s`,
              naechsterSchritt:
                'Property-Tests begrenzen bzw. langsame WAP-Tests beschleunigen (ADR-010 §4.5)',
            },
      );
    } catch {
      k.melde({
        id: 'V10-wap-anteil',
        ok: false,
        ms: 0,
        ursache: 'Suite-Bericht nicht lesbar',
        naechsterSchritt: '«npm test» prüfen',
      });
    }
  } else {
    k.melde({
      id: 'V10-wap-anteil',
      ok: false,
      ms: 0,
      ursache: `Suite-Bericht ${SUITE_BERICHT} fehlt (npm test ohne Bericht)`,
      naechsterSchritt: '«npm test» prüfen; ohne Bericht keine Messung des WAP-Anteils',
    });
  }
  for (const [id, args, text] of /** @type {[string, string[], string][]} */ ([
    ['V10-build', ['run', 'build'], 'npm run build gescheitert'],
    ['V10-release', ['run', 'check:release'], 'npm run check:release gescheitert'],
  ])) {
    const r = await npm(k, args, kindEnv(k, 'sonst'));
    k.melde(
      r === null
        ? {
            id,
            ok: false,
            ms: 0,
            ursache: 'npm-cli.js fehlt neben dem laufenden Node',
            naechsterSchritt: 'Node-Installation prüfen',
          }
        : ausLauf(id, r, text, 'Suite-Regression beheben (Prompt §5.6)'),
    );
    // V10-lizenztexte (R-H-23 Kriterium 2) unmittelbar nach dem Build (Vertrag E1-01 §2).
    if (id === 'V10-build') {
      const { erwartet: _erwartet, fehlend, ...s } = await checkBundledLicenses({ cwd: k.root });
      k.melde({ ...s, details: { ...(typeof s.details === 'object' ? s.details : {}), fehlend } });
    }
  }
  const python = await checkPython({ cwd: k.root, env: process.env });
  k.melde(python);
  if (!python.ok || python.wahl === null) return;
  const r = await npm(
    k,
    ['run', 'test:oracle'],
    oracleUmgebung(kindEnv(k, 'sonst'), python.wahl.verzeichnis),
  );
  k.melde(
    r === null
      ? {
          id: 'V10-oracle',
          ok: false,
          ms: 0,
          ursache: 'npm-cli.js fehlt neben dem laufenden Node',
          naechsterSchritt: 'Node-Installation prüfen',
        }
      : ausLauf(
          'V10-oracle',
          r,
          'npm run test:oracle gescheitert',
          'PISA-Orakel-Tests prüfen («npm run test:oracle» mit Python 3)',
        ),
  );
}

/**
 * V11: Datenschutz über Stand und Commits (H0, Objekt-Modi), Namensprüfung (R-H-34) und erzeugte
 * Artefakte unter test-results/wap.
 * @param {Kontext} k
 * @param {string | null} basis
 * @param {Record<string, string>} env
 * @returns {Promise<void>}
 */
async function datenschutzVoll(k, basis, env) {
  const scan = join(H0_DIR, 'privacy-scan.mjs');
  const baum = await starteNode(scan, ['--root', k.root, '--baum', 'HEAD'], {
    cwd: k.root,
    env,
    timeoutMs: ZEIT.kurz,
  });
  k.melde(
    ausLauf(
      'V11-baum',
      baum,
      'Datenschutz-Scan über den Stand mit Befund',
      'Personendaten entfernen bzw. pseudonymisieren',
    ),
  );
  if (basis === null) {
    k.melde({
      id: 'V11-commits',
      ok: false,
      ms: 0,
      ursache: 'Vergleichsstand nicht bestimmbar (Merge-Basis mit wap-planer bzw. HEAD^1)',
      naechsterSchritt: 'Zweig wap-planer bereitstellen und erneut starten',
    });
  } else {
    const commits = await starteNode(scan, ['--root', k.root, '--commits', `${basis}..HEAD`], {
      cwd: k.root,
      env,
      timeoutMs: ZEIT.kurz,
    });
    k.melde(
      ausLauf(
        'V11-commits',
        commits,
        'Datenschutz-Scan über die Commits mit Befund',
        'Verlauf vor dem Merge bereinigen (Orchestrator)',
      ),
    );
  }
  const namenBaum = await scanNames({ root: k.root, baum: 'HEAD' });
  k.melde({ ...namenBaum, id: 'V11-namen-baum' });
  if (basis !== null) {
    const namenCommits = await scanNames({ root: k.root, commits: `${basis}..HEAD` });
    k.melde({ ...namenCommits, id: 'V11-namen-commits' });
  }
  if (k.etappenAbschluss !== undefined) {
    const main = mergeBasis(k.root, 'main', 'HEAD');
    k.melde(
      main === null
        ? {
            id: 'V11-namen-main',
            ok: false,
            ms: 0,
            ursache: 'Merge-Basis mit main nicht bestimmbar',
            naechsterSchritt: 'Zweig main bereitstellen',
          }
        : {
            ...(await scanNames({ root: k.root, commits: `${main}..HEAD` })),
            id: 'V11-namen-main',
          },
    );
  }
  const artefakte = join(k.root, 'test-results', 'wap');
  mkdirSync(artefakte, { recursive: true });
  k.melde(await deepPrivacyScan({ cwd: k.root, pfade: [artefakte] }));
}

/**
 * F0-arbeitsbaum (--pre-commit): der Commit enthält den Index, die Schleuse prüft den Arbeitsbaum.
 * @param {string} root
 * @returns {Schritt}
 */
function arbeitsbaumSchritt(root) {
  const beginn = Date.now();
  const diff = git(root, ['diff', '--name-only', '-z'], { mitIndex: true });
  const neu = git(root, ['ls-files', '--others', '--exclude-standard', '-z'], { mitIndex: true });
  if (diff.status !== 0 || neu.status !== 0) {
    return {
      id: 'F0-arbeitsbaum',
      ok: false,
      ms: Date.now() - beginn,
      ursache: 'Arbeitsbaum nicht lesbar (git diff gescheitert)',
      naechsterSchritt: 'git-Zustand prüfen, dann erneut committen',
    };
  }
  const geaendert = diff.stdout.split('\0').filter((p) => p !== '');
  const unversioniert = neu.stdout.split('\0').filter((p) => p !== '');
  const n = geaendert.length + unversioniert.length;
  if (n === 0) return { id: 'F0-arbeitsbaum', ok: true, ms: Date.now() - beginn };
  return {
    id: 'F0-arbeitsbaum',
    ok: false,
    ms: Date.now() - beginn,
    ursache: `${String(n)} Dateien weichen vom Index ab (nicht gestagt: ${String(geaendert.length)}, nicht versioniert: ${String(unversioniert.length)}): ${kurzeListe(
      [...geaendert, ...unversioniert].map((p) => zeigePfad(p)),
    )}`,
    naechsterSchritt: 'Änderungen stagen oder zurücknehmen, dann erneut committen',
  };
}

/**
 * Führt die Schritte der schnellen (F1–F9) bzw. vollen Schleuse (zusätzlich V1, V1a, V3, V4-e2e,
 * V5-ebene2, V9–V11) aus.
 * Node-, Sperr-, Last- und Lock-Prüfung brechen sofort ab; sonst laufen alle unabhängigen Schritte.
 * @param {'fast' | 'full'} modus
 * @param {{ cwd: string; preCommit?: boolean; etappenAbschluss?: number; warten?: boolean; last?: Last; melde?: (s: Schritt) => void }} opts
 * @returns {Promise<GateErgebnis>}
 */
export async function runGate(modus, opts) {
  const root = wurzel(resolve(opts.cwd)) ?? resolve(opts.cwd);
  const zweig = zweigVon(root);
  const paket = zweig.startsWith('wap/') ? zweig.slice(4).toLowerCase() : null;
  /** @type {GateErgebnis} */
  const ergebnis = { modus, zweig, paket, schritte: [], ok: false };
  const melde = (/** @type {Schritt} */ s) => {
    ergebnis.schritte.push(s);
    opts.melde?.(s);
  };
  const preCommit = modus === 'fast' && opts.preCommit === true;
  const last = opts.last ?? {};

  if (preCommit) melde(arbeitsbaumSchritt(root));
  const f1 = checkNode({ packageJson: join(root, 'package.json'), nvmrc: join(root, '.nvmrc') });
  melde(f1);
  if (!f1.ok) return abschluss(ergebnis, root);

  /** @type {string | undefined} */
  let sperre;
  /** @type {() => Promise<void>} */
  let freigeben = async () => {};
  let geschachtelt = true;
  if (preCommit) {
    const s = await pruefeSperreFrei({ worktree: root, env: process.env, last });
    melde(s);
    if (!s.ok) return abschluss(ergebnis, root);
    sperre = process.env.WAP_GATE_SPERRE;
  } else {
    const s = await belegeSperre({
      modus,
      worktree: root,
      env: process.env,
      last,
      ...(opts.warten ? { warteMin: 30 } : {}),
    });
    if (!s.ok) {
      melde(s.schritt);
      return abschluss(ergebnis, root);
    }
    melde({ id: 'F0-sperre', ok: true, ms: 0, details: { geschachtelt: s.geschachtelt } });
    sperre = s.envWert;
    freigeben = s.freigeben;
    geschachtelt = s.geschachtelt;
    if (!geschachtelt) {
      const l = await pruefeFremdlast({ eigenePid: process.pid, last });
      melde(l);
      if (!l.ok) {
        await freigeben();
        return abschluss(ergebnis, root);
      }
    }
  }

  // Wiederholungsprüfung auf fremde Prozesse in `full` (AE-001 §2, §4 Nr 4, 7).
  /** @type {Set<number>} */
  const spaeteFremde = new Set();
  const quelle = last.quelle ?? systemQuelle;
  let laeuft = false;
  const pruefe = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      for (const pid of fremdeProzesse(await quelle.prozesse(), process.pid)) spaeteFremde.add(pid);
    } catch {
      spaeteFremde.add(-1);
    } finally {
      laeuft = false;
    }
  };
  const mitWiederholung = modus === 'full' && !geschachtelt;
  const takt = mitWiederholung
    ? setInterval(() => {
        void pruefe();
      }, last.pruefIntervallMs ?? lastRegeln().fremdPruefungMs)
    : null;
  try {
    await schleusenSchritte(modus, {
      root,
      zweig,
      paket,
      preCommit,
      ...(opts.etappenAbschluss === undefined ? {} : { etappenAbschluss: opts.etappenAbschluss }),
      sperre,
      melde,
    });
    if (mitWiederholung) {
      while (laeuft) await new Promise((r) => setTimeout(r, 50));
      await pruefe();
      if (spaeteFremde.size > 0) {
        const pids = [...spaeteFremde].filter((p) => p > 0);
        melde({
          id: 'F0-last',
          ok: false,
          ms: 0,
          ursache: spaeteFremde.has(-1)
            ? 'Prozessliste während des Laufs nicht lesbar'
            : `während des Laufs ${String(pids.length)} fremde Test-, Build- oder Browserprozesse (PID ${pids.join(', ')})`,
          naechsterSchritt:
            'Ergebnis verwerfen und den Beleglauf ohne parallele Läufe wiederholen (agent-regeln 5)',
          details: { fremd: pids },
        });
      }
    }
  } finally {
    if (takt !== null) clearInterval(takt);
    await freigeben();
  }
  return abschluss(ergebnis, root);
}

/**
 * Setzt das Gesamtergebnis und schreibt das Protokoll test-results/wap/gate-<modus>-<zeit>.json.
 * @param {GateErgebnis} e
 * @param {string} root
 * @returns {GateErgebnis}
 */
function abschluss(e, root) {
  e.ok = e.schritte.length > 0 && e.schritte.every((s) => s.ok);
  try {
    const dir = join(root, 'test-results', 'wap');
    mkdirSync(dir, { recursive: true });
    const zeit = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(dir, `gate-${e.modus}-${zeit}.json`), `${JSON.stringify(e, null, 2)}\n`);
  } catch {
    // Protokoll ist nur Beleg; ein nicht schreibbares Protokoll ändert das Ergebnis nicht.
  }
  return e;
}

/**
 * Ausgabe eines Schritts auf der Konsole (CLI).
 * @param {Schritt} s
 */
function zeige(s) {
  if (s.ok) {
    const d = selbsttestObjekt(s.details);
    const status = s.id === 'V1a-selbsttest' && typeof d?.status === 'string' ? d.status : null;
    ok(status === null ? s.id : `${s.id} ${status}`, s.ms);
  } else rot(s.id, s.ursache ?? 'ohne Ursache', s.naechsterSchritt ?? 'Schritt prüfen');
}

// CLI: Aufruf als Skript (Vertrag §1, §2).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const modus = args[0];
  const wert = (/** @type {string} */ name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const etappe = wert('--etappen-abschluss');
  const bekannt = new Set(['--pre-commit', '--warten', '--etappen-abschluss', '--root']);
  const unbekannt = args
    .slice(1)
    .filter((a, i, l) =>
      a.startsWith('--')
        ? !bekannt.has(a)
        : !['--etappen-abschluss', '--root'].includes(l[i - 1] ?? ''),
    );
  if (
    (modus !== 'fast' && modus !== 'full') ||
    unbekannt.length > 0 ||
    (etappe !== undefined && !/^\d+$/.test(etappe)) ||
    (args.includes('--pre-commit') && modus !== 'fast')
  ) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/gate.mjs fast | full [--etappen-abschluss <N>] [--warten] [--root <worktree>]',
    );
    process.exitCode = 1;
  } else {
    const e = await runGate(modus, {
      cwd: resolve(wert('--root') ?? '.'),
      preCommit: args.includes('--pre-commit'),
      warten: args.includes('--warten'),
      ...(etappe === undefined ? {} : { etappenAbschluss: Number(etappe) }),
      melde: zeige,
    });
    const f4 = e.schritte.find((s) => s.id === 'F4-muster');
    const f4Details = f4?.details;
    const ausnahmen =
      typeof f4Details === 'object' &&
      f4Details !== null &&
      'ausnahmen' in f4Details &&
      Array.isArray(f4Details.ausnahmen)
        ? /** @type {{ pfad: string; zeile: number; art: string }[]} */ (f4Details.ausnahmen)
        : [];
    if (modus === 'full') {
      for (const a of ausnahmen)
        hinweis(`Ausnahme: ${zeigePfad(a.pfad)}:${String(a.zeile)} (${a.art})`);
    }
    const rote = e.schritte.filter((s) => !s.ok).length;
    hinweis(
      e.ok
        ? `Schleuse ${modus}: grün (${String(e.schritte.length)} Schritte).`
        : `Schleuse ${modus}: rot (${String(rote)} von ${String(e.schritte.length)} Schritten rot).`,
    );
    process.exitCode = e.ok ? 0 : 1;
  }
}

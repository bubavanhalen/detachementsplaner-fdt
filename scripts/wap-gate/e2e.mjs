// E2E-Läufer (Paket E1-01b, R-H-11; ADR-010 §3.2 V4, §10 «Ports und Parallelität»).
// Aufruf: node scripts/wap-gate/e2e.mjs [--project <name>]   (npm run wap:test:e2e)
//         --project chromium-visual --baselines <paket> [--geaendert --grund <text>]
// E1-01c §2.1/§2.2: Baseline- und perf-CLI belegen die Sperre; getrennte Berichte
// playwright-visual.json und playwright-perf.json. Baseline-Erfolg verlangt einen Lauf ohne Läuferfehler.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 und E1-01b.md §2 «runE2e», Notiz Runde 2 Nr 2, 8.
// Ablauf: Konfiguration und @playwright/test prüfen (fehlt etwas: rot, ohne Start); für edge-dist bzw.
// ohne Projekt test-results/wap/einzeldatei/ leeren und jede tests/wap-e2e/harness/*.tsx dorthin bauen
// (roter Bau: rot, ohne Start). Funktionale Projekte und chromium-visual nutzen einen freien Port und
// --workers=2; perf läuft ohne Server mit einem Worker. Funktionale Berichte: playwright.json;
// visual/perf wie oben. Grün verlangt Exit 0 mit Bericht, ausser dem Baseline-Sonderfall nach §2.2.
// Berichte und PDF früherer Schritte unter test-results/wap bleiben erhalten.
// Änderungsnotiz Code-Review Runde 1 Nr 2–4: Ein alter Bericht wird als erste Handlung gelöscht; Variablen,
// die Bericht oder Verhalten von Playwright an der Konfiguration vorbei ändern, werden entfernt; jeder Lauf
// erhält einen eigenen Vite-Cache (WAP_VITE_CACHE_DIR) unter test-results/wap/vite-cache/, der danach
// entfernt wird (verwaiste Ordner früherer Läufe räumt der nächste Lauf auf).
// Änderungsnotiz Stabilität Nr 1–5: Kein Prozess der E2E-Kette fragt einen Port ab, der geschlossen sein
// könnte. Besteht tests/wap-e2e/support/vite-e2e.config.ts, startet runE2e die Server-Hülle
// lib/vite-server.mjs selbst (ohne Shell, mit IPC), wartet höchstens 60 s auf { bereit: true } und beendet
// sie danach per IPC «ende», als Rückfall per taskkill /T /F; ob der Port danach frei ist, prüft nur listen.
// Playwright findet den Server bereit vor (reuseExistingServer). exitBeschreibung macht Exit-Codes lesbar.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { buildEinzeldatei } from './einzeldatei.mjs';
import { belegeSperre, pruefeFremdlast, testUmgebung } from './last.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe, ohneFarben, starteNode, werkzeug } from './lib/prozess.mjs';
import { git } from './lib/repo.mjs';
import { eigenerTempOrdner, raeumeVerwaisteTemp } from './lib/temp.mjs';
import { comparePerf } from './perf-compare.mjs';
import { buildPerfHarness } from './perf-harness.mjs';
import { leseBericht } from './red-phase.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ suites?: PwSuite[]; specs?: { tests?: { projectName?: string; results?: { status?: string }[] }[]; title?: string }[]; title?: string }} PwSuite */

const KONFIG = 'playwright.wap.config.ts';
export const PLAYWRIGHT_BERICHT = 'test-results/wap/playwright.json';
const EINZELDATEI_ORDNER = 'test-results/wap/einzeldatei';
const HARNESS_ORDNER = 'tests/wap-e2e/harness';

/** Zeitlimit des Playwright-Laufs. */
const ZEIT_MS = 3_600_000;

/** Ordner der Vite-Caches je Lauf (Notiz CR1 Nr 2) und Präfix eines Laufs. */
const VITE_CACHE_ORDNER = 'test-results/wap/vite-cache';
const VITE_CACHE_PRAEFIX = 'lauf-';

/** Vite-Konfiguration der E2E (Notiz CR1 Nr 2); ihr Vorhandensein schaltet die Server-Hülle ein. */
const VITE_E2E_KONFIG = 'tests/wap-e2e/support/vite-e2e.config.ts';

/** Server-Hülle neben diesem Skript (Notiz Stabilität Nr 2). */
const HUELLE = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'vite-server.mjs');

/** Fristen der Server-Hülle (Notiz Stabilität Nr 3). */
const BEREIT_MS = 60_000;
const ENDE_MS = 10_000;

/** Bekannte Windows-Ausnahmen (Notiz Stabilität Nr 5). */
const WINDOWS_AUSNAHMEN = new Map([
  [0xc0000409, 'Prozessabbruch STATUS_STACK_BUFFER_OVERRUN'],
  [0xc0000005, 'Zugriffsverletzung'],
  [0xc00000fd, 'Stapelüberlauf'],
  [0xc000013a, 'abgebrochen'],
]);

/**
 * Lesbarer Exit eines Prozesses (Notiz Stabilität Nr 5): Windows-Ausnahmen ab 0xC0000000 mit Hex-Code und
 * Bedeutung, ein Signal als «Signal <s>», sonst die Zahl.
 * @param {number | null} status
 * @param {string | null} signal
 * @returns {string}
 */
export function exitBeschreibung(status, signal) {
  if (status === null) return signal === null ? 'unbekannt' : `Signal ${signal}`;
  if (status >= 0xc0000000 && status <= 0xffffffff) {
    const hex = `0x${status.toString(16).toUpperCase().padStart(8, '0')}`;
    return `${String(status)} (${hex}, ${WINDOWS_AUSNAHMEN.get(status) ?? 'Windows-Ausnahme'})`;
  }
  return String(status);
}

/**
 * @typedef {object} ServerLauf
 * @property {import('node:child_process').ChildProcess} kind
 * @property {number} beginn
 * @property {string[]} stderr letzte Zeilen der Fehlerausgabe
 * @property {boolean} stderrZu Fehlerausgabe vollständig gelesen
 * @property {'ipc' | 'taskkill' | 'offen' | 'selbst' | null} ende
 * @property {number | null} endeMs
 */

/**
 * Ist der Prozess beendet?
 * @param {import('node:child_process').ChildProcess} kind
 * @returns {boolean}
 */
function beendet(kind) {
  return kind.exitCode !== null || kind.signalCode !== null;
}

/**
 * Wartet höchstens `ms` auf das Ende des Prozesses; liefert, ob er beendet ist.
 * @param {import('node:child_process').ChildProcess} kind
 * @param {number} ms
 * @returns {Promise<boolean>}
 */
function warteAufEnde(kind, ms) {
  if (beendet(kind)) return Promise.resolve(true);
  return new Promise((aufloesen) => {
    const zeit = setTimeout(() => {
      kind.off('exit', fertig);
      aufloesen(beendet(kind));
    }, ms);
    function fertig() {
      clearTimeout(zeit);
      aufloesen(true);
    }
    kind.once('exit', fertig);
  });
}

/**
 * Startet die Server-Hülle ohne Shell mit IPC (Notiz Stabilität Nr 3 «Start»).
 * @param {string} root
 * @param {Record<string, string>} env
 * @param {number} port
 * @returns {ServerLauf}
 */
function starteServer(root, env, port) {
  const kind = spawn(
    process.execPath,
    [
      HUELLE,
      '--config',
      VITE_E2E_KONFIG,
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: root, env, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  /** @type {ServerLauf} */
  const lauf = { kind, beginn: Date.now(), stderr: [], stderrZu: false, ende: null, endeMs: null };
  let rest = '';
  kind.stderr?.on('data', (/** @type {Buffer} */ d) => {
    const zeilen = (rest + d.toString('utf8')).split(/\r?\n/);
    rest = zeilen.pop() ?? '';
    lauf.stderr.push(...zeilen.map((z) => z.trim()).filter((z) => z !== ''));
    if (lauf.stderr.length > 20) lauf.stderr.splice(0, lauf.stderr.length - 20);
  });
  kind.stderr?.on('end', () => {
    if (rest.trim() !== '') lauf.stderr.push(rest.trim());
    rest = '';
    lauf.stderrZu = true;
  });
  // Ein Fehler beim Start (z.B. node nicht startbar) zeigt sich als exit; kein unbehandeltes Ereignis.
  kind.on('error', () => undefined);
  return lauf;
}

/**
 * Wartet höchstens 60 s auf { bereit: true }, ohne den Port abzufragen.
 * @param {ServerLauf} s
 * @returns {Promise<'bereit' | 'exit' | 'zeit'>}
 */
function warteBereit(s) {
  if (beendet(s.kind)) return Promise.resolve('exit');
  return new Promise((aufloesen) => {
    /** @param {'bereit' | 'exit' | 'zeit'} wie */
    const fertig = (wie) => {
      clearTimeout(zeit);
      s.kind.off('message', nachricht);
      s.kind.off('exit', ende);
      aufloesen(wie);
    };
    const zeit = setTimeout(() => fertig('zeit'), BEREIT_MS);
    /** @param {unknown} m */
    const nachricht = (m) => {
      if (typeof m === 'object' && m !== null && /** @type {{ bereit?: unknown }} */ (m).bereit) {
        fertig('bereit');
      }
    };
    const ende = () => fertig('exit');
    s.kind.on('message', nachricht);
    s.kind.once('exit', ende);
  });
}

/**
 * Beendet die Hülle (Notiz Stabilität Nr 3 «Ende»): IPC «ende» und bis 10 s warten; sonst, solange sie lebt,
 * taskkill /T /F ohne Shell und erneut bis 10 s warten. Endete sie schon selbst: «selbst».
 * @param {ServerLauf} s
 * @returns {Promise<void>}
 */
async function beendeServer(s) {
  if (s.ende !== null) return;
  if (beendet(s.kind)) {
    s.ende = 'selbst';
  } else {
    try {
      if (s.kind.connected) s.kind.send('ende');
    } catch {
      // Kanal schon zu: der Rückfall unten greift
    }
    if (await warteAufEnde(s.kind, ENDE_MS)) {
      s.ende = 'ipc';
    } else {
      if (!beendet(s.kind) && s.kind.pid !== undefined) {
        spawnSync('taskkill.exe', ['/pid', String(s.kind.pid), '/T', '/F'], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore',
          timeout: 30_000,
        });
      }
      s.ende = (await warteAufEnde(s.kind, ENDE_MS)) ? 'taskkill' : 'offen';
    }
  }
  s.endeMs = Date.now();
  if (s.kind.connected) s.kind.disconnect();
}

/**
 * Ist der Port auf 127.0.0.1 frei? Nur per listen, nie per connect (Notiz Stabilität Nr 1).
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function portFrei(port) {
  return new Promise((aufloesen) => {
    const server = createServer();
    server.once('error', () => aufloesen(false));
    server.listen(port, '127.0.0.1', () => server.close(() => aufloesen(true)));
  });
}

/**
 * Wartet höchstens `ms`, bis die Fehlerausgabe der beendeten Hülle vollständig gelesen ist.
 * @param {ServerLauf} s
 * @param {number} ms
 * @returns {Promise<void>}
 */
async function warteFehlerausgabe(s, ms) {
  const ende = Date.now() + ms;
  while (!s.stderrZu && s.kind.stderr !== null && Date.now() < ende) {
    await new Promise((aufloesen) => setTimeout(aufloesen, 20));
  }
}

/**
 * Letzte Fehlerzeile der Hülle ohne absolute Pfade.
 * @param {ServerLauf} s
 * @returns {string}
 */
function letzteZeile(s) {
  const z = s.stderr.at(-1) ?? '';
  return ohneFarben(z)
    .replace(/[A-Za-z]:[\\/][^\s'"]*/g, '<Pfad>')
    .slice(0, 300);
}

/**
 * Umgebung für Playwright ohne Variablen, die Bericht oder Verhalten an der Konfiguration vorbei ändern
 * (Notiz CR1 Nr 4): PLAYWRIGHT_* ausser PLAYWRIGHT_BROWSERS_PATH, PW_* und PWDEBUG, ohne Beachtung von
 * Gross/Klein.
 * @param {Record<string, string>} env
 * @returns {Record<string, string>}
 */
function ohnePlaywrightSteuerung(env) {
  /** @type {Record<string, string>} */
  const aus = {};
  for (const [name, wert] of Object.entries(env)) {
    const k = name.toUpperCase();
    const steuernd =
      (k.startsWith('PLAYWRIGHT_') && k !== 'PLAYWRIGHT_BROWSERS_PATH') ||
      k.startsWith('PW_') ||
      k === 'PWDEBUG';
    if (!steuernd) aus[name] = wert;
  }
  return aus;
}

/**
 * Freier TCP-Port auf 127.0.0.1.
 * @returns {Promise<number>}
 */
function freierPort() {
  return new Promise((aufloesen, ablehnen) => {
    const server = createServer();
    server.once('error', ablehnen);
    server.listen(0, '127.0.0.1', () => {
      const adresse = server.address();
      const port = typeof adresse === 'object' && adresse !== null ? adresse.port : 0;
      server.close(() => aufloesen(port));
    });
  });
}

/**
 * Leert den Ordner der Einzeldateien und baut jede Harness-Datei dorthin; null = alle grün.
 * @param {string} root
 * @returns {Promise<{ ursache: string; naechsterSchritt: string } | null>}
 */
async function baueHarness(root) {
  const ziel = join(root, ...EINZELDATEI_ORDNER.split('/'));
  rmSync(ziel, { recursive: true, force: true });
  mkdirSync(ziel, { recursive: true });
  const ordner = join(root, ...HARNESS_ORDNER.split('/'));
  const einstiege = existsSync(ordner)
    ? readdirSync(ordner, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
        .map((e) => e.name)
        .sort()
    : [];
  /** @type {string[]} */
  const rote = [];
  for (const datei of einstiege) {
    const name = datei.slice(0, -'.tsx'.length);
    const s = await buildEinzeldatei({
      cwd: root,
      entry: join(ordner, datei),
      outFile: join(ziel, `${name}.html`),
      titel: name,
    });
    if (!s.ok) rote.push(`${zeigePfad(`${HARNESS_ORDNER}/${datei}`)} (${s.ursache ?? 'rot'})`);
  }
  if (rote.length === 0) return null;
  return {
    ursache: `Bau der Harness-Einzeldateien gescheitert: ${kurzeListe(rote)}`,
    naechsterSchritt:
      'Harness-Einstieg reparieren («npm run wap:einzeldatei» für einen einzelnen Bau)',
  };
}

/**
 * Wählt einen freien Port, setzt WAP_E2E_PORT und startet playwright test -c playwright.wap.config.ts.
 * `details`: { bericht (repo-relativ, sofern vorhanden), exit, gestartet } für die Rot-Phase der Schleuse.
 * @param {{ cwd: string; project?: string; repeatEach?: number }} opts
 * @returns {Promise<Schritt & { port: number }>}
 */
export async function runE2e(opts) {
  return e2eLauf(opts);
}

/** @param {{ cwd: string; project?: string; repeatEach?: number }} opts @param {string[]} [extra] */
async function e2eLauf(opts, extra = []) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const projekt = opts.project === undefined || opts.project === '' ? null : opts.project;
  const ID =
    projekt === 'perf' ? 'V7-perf' : projekt === 'chromium-visual' ? 'V6-visual' : 'V4-e2e';
  const berichtRel =
    projekt === 'perf'
      ? 'test-results/wap/playwright-perf.json'
      : projekt === 'chromium-visual'
        ? 'test-results/wap/playwright-visual.json'
        : PLAYWRIGHT_BERICHT;
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @param {number} port
   * @param {unknown} [details]
   * @returns {Schritt & { port: number }}
   */
  const rotSchritt = (ursache, naechsterSchritt, port, details) => ({
    id: ID,
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    port,
    ...(details === undefined ? {} : { details }),
  });
  // Ein alter Bericht gilt nie als Ergebnis dieses Laufs: erste Handlung, vor allen Prüfungen (CR1 Nr 3).
  const bericht = join(root, ...berichtRel.split('/'));
  rmSync(bericht, { force: true });
  if (
    opts.repeatEach !== undefined &&
    (!Number.isInteger(opts.repeatEach) || opts.repeatEach < 2 || opts.repeatEach > 10)
  )
    return rotSchritt('repeatEach ungültig', 'Ganzzahl von 2 bis 10 verwenden', 0);
  if (projekt === 'perf' && opts.repeatEach !== undefined)
    return rotSchritt(
      'Wiederholung im Projekt perf nicht zulässig',
      'Leistungsprojekt ohne Wiederholung starten',
      0,
    );
  if (!existsSync(join(root, KONFIG))) {
    return rotSchritt(
      `${KONFIG} fehlt`,
      'Playwright-Konfiguration des WAP-Planers bereitstellen',
      0,
    );
  }
  const playwright = werkzeug(root, 'playwright');
  if (playwright === null) {
    return rotSchritt(
      '@playwright/test fehlt in node_modules',
      '«npm ci» ausführen (@playwright/test gemäss package.json)',
      0,
    );
  }
  const env = ohnePlaywrightSteuerung(testUmgebung(process.env, 'playwright'));
  for (const key of Object.keys(env))
    if (['WAP_PLAYWRIGHT_BERICHT', 'WAP_E2E_PORT'].includes(key.toUpperCase())) delete env[key];
  env.WAP_PLAYWRIGHT_BERICHT = berichtRel;
  if (projekt === 'perf' || projekt === 'chromium-visual') {
    const pfad = spawnSync(
      process.execPath,
      ['-e', 'process.stdout.write(require("@playwright/test").chromium.executablePath())'],
      { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 30_000 },
    );
    if (pfad.status !== 0 || !existsSync(pfad.stdout.trim()))
      return rotSchritt(
        'Playwright-Chromium fehlt: npx playwright install chromium (Orchestrator)',
        'Orchestrator installiert den festgelegten Chromium',
        0,
      );
  }
  /** @type {string[]} */
  let projektArgs = projekt === null ? [] : ['--project', projekt];
  if (projekt === null) {
    const liste = await starteNode(
      playwright,
      ['test', '-c', KONFIG, '--list', '--reporter=json', '--pass-with-no-tests'],
      { cwd: root, env, timeoutMs: ZEIT_MS },
    );
    try {
      if (liste.status !== 0) throw new Error();
      const daten = JSON.parse(liste.stdout.slice(liste.stdout.indexOf('{')));
      /** @type {string[]} */
      const namen = (daten.config?.projects ?? []).map(
        (/** @type {{ name: string }} */ p) => p.name,
      );
      if (namen.some((n) => n === 'perf' || n === 'chromium-visual'))
        projektArgs = namen
          .filter((n) => n !== 'perf' && n !== 'chromium-visual')
          .flatMap((n) => ['--project', n]);
      if (
        namen.length > 0 &&
        projektArgs.length === 0 &&
        namen.every((n) => n === 'perf' || n === 'chromium-visual')
      ) {
        // Ohne funktionales Projekt darf V4 weder die Bild- noch die Leistungstests starten.
        // Der immer scheiternde reguläre Ausdruck wählt deshalb bewusst keine Tests aus.
        projektArgs = ['--grep', '(?!)'];
      }
    } catch {
      return rotSchritt('Playwright-Testliste nicht lesbar', 'Konfiguration prüfen', 0);
    }
  }
  if (projekt === 'perf') {
    rmSync(join(root, 'test-results/wap/perf.json'), { force: true });
    const bau = await buildPerfHarness({
      cwd: root,
      outDir: join(root, 'test-results/wap/perf-harness'),
    });
    if (!bau.ok)
      return rotSchritt(
        bau.ursache ?? 'Bau der Leistungs-Harness rot',
        bau.naechsterSchritt ?? 'Harness prüfen',
        0,
      );
  }
  if (projekt === null || projekt === 'edge-dist' || projekt === 'chromium-visual') {
    const bau = await baueHarness(root);
    if (bau !== null) return rotSchritt(bau.ursache, bau.naechsterSchritt, 0);
  }
  const port = projekt === 'perf' ? 0 : await freierPort();
  // Eigener Vite-Cache je Lauf (CR1 Nr 2): zuerst verwaiste Ordner früherer Läufe aufräumen.
  const cacheBasis = join(root, ...VITE_CACHE_ORDNER.split('/'));
  raeumeVerwaisteTemp({ praefix: VITE_CACHE_PRAEFIX, tmpDir: cacheBasis });
  mkdirSync(cacheBasis, { recursive: true });
  const cache = eigenerTempOrdner(VITE_CACHE_PRAEFIX, cacheBasis);
  if (projekt !== 'perf') env.WAP_E2E_PORT = String(port);
  env.WAP_PDF_ARTEFAKTE = join(root, 'test-results', 'wap', 'pdf');
  env.WAP_VITE_CACHE_DIR = cache;
  /** @type {Awaited<ReturnType<typeof starteNode>> | null} */
  let lauf = null;
  /** @type {ServerLauf | null} */
  let server = null;
  /** @type {'bereit' | 'exit' | 'zeit' | null} */
  let bereitschaft = null;
  let portBelegt = false;
  try {
    // Server-Hülle (Notiz Stabilität Nr 3) für jedes Projekt, sofern die E2E-Konfiguration besteht.
    if (projekt !== 'perf' && existsSync(join(root, ...VITE_E2E_KONFIG.split('/')))) {
      server = starteServer(root, env, port);
      bereitschaft = await warteBereit(server);
    }
    if (bereitschaft === null || bereitschaft === 'bereit') {
      lauf = await starteNode(
        playwright,
        [
          'test',
          '-c',
          KONFIG,
          projekt === 'perf' ? '--workers=1' : '--workers=2',
          '--pass-with-no-tests',
          ...projektArgs,
          ...(opts.repeatEach === undefined ? [] : [`--repeat-each=${String(opts.repeatEach)}`]),
          ...extra,
        ],
        { cwd: root, env, timeoutMs: ZEIT_MS },
      );
    }
  } finally {
    // Zuerst den Server beenden (er hält den Cache), dann den Port nur per listen prüfen.
    if (server !== null) {
      await beendeServer(server);
      await warteFehlerausgabe(server, 2_000);
      portBelegt = !(await portFrei(port));
    }
    // Auch nach einem roten Lauf; scheitert das Entfernen, räumt der nächste Lauf den Ordner auf.
    try {
      rmSync(cache, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // bewusst ohne Fehler (CR1 Nr 2): der Lauf bleibt gültig
    }
  }
  const serverDetails =
    server === null
      ? {}
      : {
          server: {
            pid: server.kind.pid ?? null,
            port,
            ende: server.ende ?? 'offen',
            ms: (server.endeMs ?? Date.now()) - server.beginn,
          },
        };
  if (server !== null && bereitschaft !== 'bereit') {
    const zeile = letzteZeile(server);
    const exit = beendet(server.kind)
      ? exitBeschreibung(server.kind.exitCode, server.kind.signalCode)
      : 'keiner (Prozess läuft noch)';
    const zusatz =
      bereitschaft === 'zeit'
        ? `keine Bereitschaft innert ${String(BEREIT_MS / 1000)} s${zeile === '' ? '' : `, ${zeile}`}`
        : zeile;
    return rotSchritt(
      `Vite-Server nicht bereit: Exit ${exit}${zusatz === '' ? '' : `; ${zusatz}`}`,
      `${VITE_E2E_KONFIG} prüfen (lädt sie ohne Fehler?) und «npm run wap:test:e2e» erneut starten`,
      port,
      { bericht: null, exit: null, gestartet: false, ...serverDetails },
    );
  }
  if (lauf === null) {
    return rotSchritt(
      'Playwright nicht gestartet',
      '«npm run wap:test:e2e» erneut starten',
      port,
      serverDetails,
    );
  }
  const vorhanden = existsSync(bericht);
  let tests = 0;
  let berichtLesbar = false;
  /** @type {string[]} */
  let fehlendeBaselines = [];
  try {
    const b = leseBericht(bericht);
    berichtLesbar = true;
    tests = b.tests.length;
    if (projekt === 'chromium-visual')
      fehlendeBaselines = b.tests
        .filter(
          (t) =>
            t.status === 'failed' &&
            t.fehler.length === 1 &&
            ohneFarben(t.fehler[0] ?? '').startsWith("Error: A snapshot doesn't exist at "),
        )
        .map((t) => t.name);
  } catch {
    /* Fehlender oder ungültiger Bericht wird unten rot. */
  }
  const details = {
    bericht: vorhanden ? berichtRel : null,
    exit: lauf.status,
    gestartet: lauf.fehler === null,
    tests,
    ...(projekt === 'chromium-visual' ? { fehlendeBaselines } : {}),
    ...serverDetails,
  };
  if (portBelegt) {
    return rotSchritt(
      `Port ${String(port)} nach dem Lauf belegt (Vite-Server nicht beendet)`,
      'verbliebenen Vite-Server-Prozess beenden (Task-Manager: node.exe mit vite-server.mjs) und erneut starten',
      port,
      { ...details, laeuferFehler: true },
    );
  }
  const auszug = ohneFarben(`${lauf.stdout}\n${lauf.stderr}`)
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z !== '')
    .slice(-3)
    .join(' | ')
    .slice(0, 500);
  if (lauf.fehler !== null) {
    return rotSchritt(
      `Playwright nicht beendet: ${lauf.fehler}`,
      'hängenden Test bzw. Startfehler beheben',
      port,
      { ...details, laeuferFehler: true },
    );
  }
  if (!vorhanden) {
    return rotSchritt(
      `Bericht fehlt: ${berichtRel} (Playwright Exit ${exitBeschreibung(lauf.status, lauf.signal)}: ${auszug || 'ohne Ausgabe'})`,
      `JSON-Reporter in ${KONFIG} prüfen; ohne Bericht kein Ergebnis`,
      port,
      details,
    );
  }
  if (!berichtLesbar)
    return rotSchritt(`Bericht nicht lesbar: ${berichtRel}`, 'JSON-Reporter prüfen', port, details);
  if (lauf.status !== 0) {
    /** @type {string[]} */
    let rote = [];
    try {
      const b = leseBericht(bericht);
      rote = [
        ...b.dateiFehler.map(() => 'Fehler beim Laden oder im Aufbau'),
        ...b.tests.filter((t) => t.status !== 'passed').map((t) => `${t.name} (${t.status})`),
      ];
    } catch {
      rote = ['Bericht nicht lesbar'];
    }
    return rotSchritt(
      rote.length > 0
        ? `${String(rote.length)} rote E2E-Tests: ${kurzeListe(rote)}`
        : `Playwright endete mit Exit ${exitBeschreibung(lauf.status, lauf.signal)}: ${auszug || 'ohne Ausgabe'}`,
      `E2E-Tests reparieren («npm run ${projekt === 'perf' ? 'wap:test:perf' : projekt === 'chromium-visual' ? 'wap:test:visual' : 'wap:test:e2e'}»; Bericht ${berichtRel})`,
      port,
      details,
    );
  }
  return { id: ID, ok: true, ms: Date.now() - beginn, port, details };
}

// CLI: Aufruf als Skript (Vertrag E1-01 §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  /** @type {Awaited<ReturnType<typeof belegeSperre>> | undefined} */
  let sperre;
  try {
    /** @type {Record<string, string>} */
    const werte = {};
    let geaendert = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i] ?? '';
      if (a === '--geaendert') {
        geaendert = true;
        continue;
      }
      if (
        !['--project', '--baselines', '--grund'].includes(a) ||
        !args[i + 1] ||
        args[i + 1]?.startsWith('--') ||
        werte[a] !== undefined
      )
        throw new Error(
          'Aufruf: node scripts/wap-gate/e2e.mjs [--project <name>] [--baselines <Paket> [--geaendert --grund <Text>]]',
        );
      werte[a] = args[++i] ?? '';
    }
    const projekt = werte['--project'],
      paket = werte['--baselines'],
      grund = werte['--grund'];
    if (paket !== undefined && projekt !== 'chromium-visual')
      throw new Error('--baselines verlangt --project chromium-visual');
    if ((geaendert || grund !== undefined) && (paket === undefined || !geaendert || !grund?.trim()))
      throw new Error('--geaendert verlangt --baselines und --grund <Text>');
    const root = process.cwd();
    if (paket !== undefined || projekt === 'perf') {
      sperre = await belegeSperre({
        modus: paket !== undefined ? 'baselines' : 'perf',
        worktree: root,
        env: process.env,
      });
      if (!sperre.ok) throw new Error(sperre.schritt.ursache ?? 'Sperre belegt');
      if (!sperre.geschachtelt) {
        const last = await pruefeFremdlast({ eigenePid: process.pid });
        if (!last.ok) throw new Error(last.ursache ?? 'Fremdlast');
      }
      process.env.WAP_GATE_SPERRE = sperre.envWert;
    }
    /** @type {string[]} */
    let extra = [];
    const bilder = join(root, 'tests/wap-e2e/__screenshots__/chromium-visual');
    /** @type {Map<string, Buffer>} */
    const vorher = new Map();
    if (paket !== undefined) {
      const muster = `\\(${[...paket].map((c) => (/[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}\\)$`;
      const pw = werkzeug(root, 'playwright');
      if (pw === null) throw new Error('@playwright/test fehlt');
      const liste = await starteNode(
        pw,
        [
          'test',
          '-c',
          KONFIG,
          '--project',
          'chromium-visual',
          '--grep',
          muster,
          '--list',
          '--reporter=json',
          '--pass-with-no-tests',
        ],
        {
          cwd: root,
          env: ohnePlaywrightSteuerung(testUmgebung(process.env, 'playwright')),
          timeoutMs: ZEIT_MS,
        },
      );
      if (liste.status !== 0) throw new Error('Kernzustand-Testliste nicht lesbar');
      const daten = JSON.parse(liste.stdout.slice(liste.stdout.indexOf('{')));
      let anzahl = 0;
      const zaehle = (/** @type {PwSuite} */ s) => {
        for (const spec of s.specs ?? []) anzahl += spec.tests?.length ?? 0;
        for (const kind of s.suites ?? []) zaehle(kind);
      };
      for (const s of daten.suites ?? []) zaehle(s);
      if (anzahl === 0) throw new Error(`keine Kernzustände für ${paket}`);
      if (existsSync(bilder))
        for (const n of readdirSync(bilder)) vorher.set(n, readFileSync(join(bilder, n)));
      extra = [`--update-snapshots=${geaendert ? 'changed' : 'missing'}`, '--grep', muster];
    }
    const s = await e2eLauf(
      { cwd: root, ...(projekt === undefined ? {} : { project: projekt }) },
      extra,
    );
    let erfolgreich = s.ok;
    if (paket !== undefined) {
      const d = /** @type {{ bericht?: string; exit?: number | null; laeuferFehler?: boolean }} */ (
        s.details ?? {}
      );
      if (d.bericht) {
        const b = leseBericht(join(root, d.bericht));
        erfolgreich =
          d.laeuferFehler !== true &&
          (s.ok || (d.exit === 1 && b.tests.some((t) => t.status === 'failed'))) &&
          b.dateiFehler.length === 0 &&
          b.tests.length > 0 &&
          b.tests.every(
            (t) =>
              t.status === 'passed' ||
              (t.status === 'failed' &&
                t.fehler.length === 1 &&
                ohneFarben(t.fehler[0] ?? '').startsWith("Error: A snapshot doesn't exist at ")),
          );
      }
      if (existsSync(bilder))
        for (const n of readdirSync(bilder))
          if (!vorher.get(n)?.equals(readFileSync(join(bilder, n))))
            hinweis(relative(root, join(bilder, n)).replaceAll('\\', '/'));
      if (geaendert && erfolgreich) {
        const g = git(root, ['rev-parse', '--git-common-dir']);
        if (g.status !== 0) throw new Error('Git-Verzeichnis nicht bestimmbar');
        const log = join(resolve(root, g.stdout.trim()), 'wap-gate/protokoll.log');
        mkdirSync(dirname(log), { recursive: true });
        appendFileSync(
          log,
          `${new Date().toISOString()} Baseline ${paket.replace(/[\r\n]/g, ' ')}: ${grund?.replace(/[\r\n]/g, ' ')}\n`,
        );
      }
    }
    if (erfolgreich) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    if (projekt === 'perf') {
      const d = /** @type {{ tests?: number }} */ (s.details ?? {});
      const v = comparePerf({
        messungen: (d.tests ?? 0) > 0 ? join(root, 'test-results/wap/perf.json') : null,
        baseline: join(root, 'docs/wap-planer/perf/perf-baseline.json'),
        drosselung: join(root, 'docs/wap-planer/perf/drosselung.json'),
        budgets: join(root, 'docs/wap-planer/perf/budgets.json'),
        regel: 'prozent10oder2ms',
      });
      if (v.ok) ok(v.id, v.ms);
      else rot(v.id, v.ursache ?? '', v.naechsterSchritt ?? '');
      erfolgreich = erfolgreich && v.ok;
    }
    process.exitCode = erfolgreich ? 0 : 1;
  } catch (e) {
    fehlerMeldung(e instanceof Error ? e.message : 'E2E-Aufruf gescheitert');
    process.exitCode = 1;
  } finally {
    if (sperre?.ok) await sperre.freigeben();
  }
}

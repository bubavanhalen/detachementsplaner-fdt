// Hilfen der Gate-Tests von E1-01c Runde 2 (Code-Review Runde 1, CR-E101c-02 und CR-E101c-04; R-H-25, R-H-21).
// Eigene Datei, weil vertrag.ts, umgebung.ts und vertrag-c.ts gesperrt sind.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.4, §2.2 «Baseline-Befehl» und Orchestrator-Zeile
// «Code-Review Runde 1, CR-E101c-01..05».
// - Pfadprüfung der Offline-Hilfe in einem eigenen Node-Prozess: Alle Funktionen von node:fs und
//   node:fs/promises sind dort umhüllt. Ein Aufruf mit einem Netz- oder Langpfad (beginnt mit zwei «\» bzw.
//   «/», z.B. \\host\freigabe, //host/freigabe, \\?\C:\…) wird nur gezählt und nie an das Dateisystem
//   weitergegeben; es gibt also nie eine Namensauflösung. Der Browserstart ist eine Attrappe. Eine
//   Endlosschleife beendet die Zeitgrenze des Kindprozesses.
// - Baseline-Befehl im synthetischen Repo: geschachtelte Sperre (Halter = dieser Testprozess, damit die
//   Fremdlast der laufenden Schleuse nicht zählt), fiktiver Kernzustand ohne Browser und eine fiktive
//   Vite-Konfiguration, deren Hilfsprozess den Port nach dem Ende des Servers weiter hält.
// Nur fiktive Pfade, Hosts und Texte.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { schreibeSperre } from './last';
import { type Sandbox, WT, writeText } from './umgebung';

// ---------------------------------------------------------------------------------------------------------
// CR-E101c-02: Pfadprüfung von offlinePersistent (Vertrag §2.4)

/** Vertragsmeldung der Pfadprüfung (§2.4). */
export const OFFLINE_MELDUNG =
  'offlinePersistent: userDataDir muss neu und unter dem Temp-Ordner oder test-results liegen';

/** Meldung der Start-Attrappe im Kindprozess (kein echter Browserstart). */
export const START_ATTRAPPE = 'Start-Attrappe (fiktiv)';

/** Zeitgrenze des Kindprozesses (Laden der Fixtures und Prüfung) in ms. */
export const KIND_FRIST_MS = 20_000;

/** Pfad der Fixtures-Datei des Pakets. */
export const FIXTURES = join(WT, 'tests', 'wap-e2e', 'support', 'fixtures.ts');

/**
 * Skript des Kindprozesses. Argumente: Pfad von fixtures.ts, userDataDir. Ausgabe je Zeile JSON (synchron
 * geschrieben, bleibt auch nach einem Abbruch durch die Zeitgrenze erhalten):
 * { zugriff } je Netz-/Langpfad-Zugriff (höchstens 5 Zeilen), { bereit } nach dem Laden der Fixtures,
 * { ende, meldung, ms, starts, zugriffe } nach dem Aufruf, { fehler } bei einem Fehler des Aufbaus.
 */
const KIND_SKRIPT = String.raw`// Kindprozess der Gate-Tests E1-01c Runde 2 (CR-E101c-02); nur fiktive Pfade.
import fs from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';

const [fixturesPfad, userDataDir] = process.argv.slice(2);
const schreibeSync = fs.writeSync;
const zeile = (o) => schreibeSync(1, JSON.stringify(o) + '\n');
const NETZ = /^[\\/]{2}/;
const istNetz = (a) =>
  typeof a === 'string'
    ? NETZ.test(a)
    : a instanceof URL
      ? a.protocol === 'file:' && a.host !== ''
      : Buffer.isBuffer(a)
        ? NETZ.test(a.toString('utf8'))
        : false;
const GRENZE = 100;
let zugriffe = 0;
let still = false;
const fehler = () => Object.assign(new Error('ENOENT (Attrappe: Netz- oder Langpfad)'), { code: 'ENOENT' });
function melde(name) {
  zugriffe++;
  if (!still && zugriffe <= 5) zeile({ zugriff: name });
  // Bricht eine Endlosschleife über Netzpfade ab (die Zeitgrenze bleibt der Rückfall).
  if (zugriffe >= GRENZE) throw fehler();
}
function huelle(orig, name, art) {
  const neu = function (...args) {
    if (args.some(istNetz)) {
      melde(name);
      if (name === 'existsSync') return false;
      if (art === 'promises') return Promise.reject(fehler());
      const cb = args[args.length - 1];
      if (typeof cb === 'function') {
        process.nextTick(() => (name === 'exists' ? cb(false) : cb(fehler())));
        return undefined;
      }
      throw fehler();
    }
    return orig.apply(this, args);
  };
  for (const k of Object.keys(orig)) {
    const v = orig[k];
    neu[k] = typeof v === 'function' ? huelle(v, name + '.' + k, art) : v;
  }
  return neu;
}
function patche(ziel, art) {
  for (const name of Object.keys(ziel)) {
    const v = ziel[name];
    if (typeof v !== 'function' || /^[A-Z_]/.test(name)) continue;
    try {
      ziel[name] = huelle(v, name, art);
    } catch {
      // nicht beschreibbar: bleibt unverändert (die Selbstprüfung unten deckt existsSync und realpathSync)
    }
  }
}
try {
  patche(fs, 'sync');
  patche(fs.promises, 'promises');
  syncBuiltinESMExports();
  // Selbstprüfung der Attrappe über die ESM-Bindung, wie fixtures.ts sie verwendet.
  const esm = await import('node:fs');
  still = true;
  const probe = esm.existsSync('\\\\fiktiv-selbstpruefung\\freigabe\\x');
  let realpathGezaehlt = false;
  try {
    esm.realpathSync.native('\\\\fiktiv-selbstpruefung\\freigabe\\x');
  } catch {
    realpathGezaehlt = zugriffe === 2;
  }
  still = false;
  if (probe !== false || !realpathGezaehlt) throw new Error('Attrappe für node:fs wirkt nicht');
  zugriffe = 0;
  const pw = createRequire(fixturesPfad)('@playwright/test');
  let starts = 0;
  pw.chromium.launchPersistentContext = async () => {
    starts++;
    throw new Error('Start-Attrappe (fiktiv)');
  };
  const { offlinePersistent } = await import(pathToFileURL(fixturesPfad).href);
  zeile({ bereit: true });
  const t0 = performance.now();
  let meldung = null;
  try {
    await offlinePersistent({ userDataDir });
  } catch (e) {
    meldung = e instanceof Error ? e.message : String(e);
  }
  zeile({ ende: true, meldung, ms: Math.round(performance.now() - t0), starts, zugriffe });
  process.exit(0);
} catch (e) {
  zeile({ fehler: e instanceof Error ? e.message : String(e) });
  process.exit(2);
}
`;

export interface OfflineKindErgebnis {
  /** fixtures.ts geladen, Aufruf begonnen. */
  bereit: boolean;
  /** Aufruf beendet (sonst Zeitgrenze, z.B. Endlosschleife). */
  ende: boolean;
  /** Meldung des Fehlers von offlinePersistent; null = kein Fehler. */
  meldung: string | null;
  /** Dauer des Aufrufs in ms. */
  ms: number | null;
  /** Aufrufe der Start-Attrappe. */
  starts: number | null;
  /** Namen der fs-Funktionen, die mit einem Netz- oder Langpfad aufgerufen wurden (höchstens 5). */
  zugriffe: string[];
  /** Fehler des Aufbaus im Kindprozess. */
  fehler: string | null;
  /** Kindprozess durch die Zeitgrenze beendet. */
  zeitgrenze: boolean;
}

/** Ruft offlinePersistent({ userDataDir }) im Kindprozess auf (Attrappen siehe Dateikopf). */
export function offlineImKind(sb: Sandbox, userDataDir: string): OfflineKindErgebnis {
  const skript = join(sb.base, 'offline-pfad-kind.mjs');
  if (!existsSync(skript)) writeText(sb.base, 'offline-pfad-kind.mjs', KIND_SKRIPT);
  const r = spawnSync(process.execPath, [skript, FIXTURES, userDataDir], {
    cwd: sb.base,
    env: sb.env,
    encoding: 'utf8',
    timeout: KIND_FRIST_MS,
    windowsHide: true,
  });
  const aus: OfflineKindErgebnis = {
    bereit: false,
    ende: false,
    meldung: null,
    ms: null,
    starts: null,
    zugriffe: [],
    fehler: null,
    zeitgrenze: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT',
  };
  for (const z of (r.stdout ?? '').split(/\r?\n/)) {
    if (!z.startsWith('{')) continue;
    const d = JSON.parse(z) as Record<string, unknown>;
    if (typeof d.zugriff === 'string') aus.zugriffe.push(d.zugriff);
    if (d.bereit === true) aus.bereit = true;
    if (typeof d.fehler === 'string') aus.fehler = d.fehler;
    if (d.ende === true) {
      aus.ende = true;
      aus.meldung = typeof d.meldung === 'string' ? d.meldung : null;
      aus.ms = typeof d.ms === 'number' ? d.ms : null;
      aus.starts = typeof d.starts === 'number' ? d.starts : null;
    }
  }
  return aus;
}

/** Aufbau des Kindprozesses: fixtures.ts geladen, kein Aufbaufehler (sonst Assertion mit Grund). */
export function erwarteKindBereit(e: OfflineKindErgebnis): void {
  expect(e.fehler, 'Test-Aufbau: Fehler im Kindprozess').toBeNull();
  expect(e.bereit, 'Test-Aufbau: fixtures.ts im Kindprozess nicht geladen').toBe(true);
}

/**
 * Freier Laufwerksbuchstabe (Z bis D) ohne Datenträger, ohne gemerkte Netzlaufwerk-Zuordnung
 * (HKCU\Network) und ohne Zuordnung der Sitzung, auch eine getrennte (`net use`, listet nur den lokalen
 * Stand); null, wenn keiner frei ist. Die Prüfung greift nur lokal zu (TR-E101c-R2-07).
 */
export function freierLaufwerksbuchstabe(): string | null {
  const reg = spawnSync('reg.exe', ['query', 'HKCU\\Network'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  const netUse = spawnSync('net.exe', ['use'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  expect(netUse.status, 'Test-Aufbau: «net use» nicht lesbar').toBe(0);
  const gemerkt = new Set([
    ...(reg.stdout ?? '')
      .split(/\r?\n/)
      .map((z) => /\\Network\\([A-Za-z])\s*$/i.exec(z.trim())?.[1]?.toUpperCase()),
    ...(netUse.stdout ?? '')
      .split(/\r?\n/)
      .map((z) => /(?:^|\s)([A-Za-z]):\s+\\\\/.exec(z)?.[1]?.toUpperCase()),
  ]);
  for (const b of 'ZYXWVUTSRQPONMLKJIHGFED') {
    if (gemerkt.has(b)) continue;
    if (!existsSync(`${b}:\\`)) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// CR-E101c-04: Baseline-Befehl (Vertrag §2.2)

/**
 * Geschachtelte Sperre des synthetischen Repos: Halter ist dieser Testprozess (Vitest, Vorfahr des
 * CLI-Prozesses). Liefert den Wert für WAP_GATE_SPERRE. Damit entfällt pruefeFremdlast (Nachtrag Nr 2).
 */
export function geschachtelteSperre(root: string): string {
  const token = randomBytes(16).toString('hex');
  const pfad = schreibeSperre(join(root, '.git'), {
    pid: process.pid,
    erstellt: new Date(Date.now() - Math.ceil(process.uptime() * 1000)).toISOString(),
    modus: 'full',
    worktree: root,
    start: new Date().toISOString(),
    token,
  });
  return `${pfad}#${token}`;
}

/**
 * Zeitgrenze je CLI-Aufruf in ms (normal 2–6 s). Ein Test ruft die CLI höchstens zweimal auf; zwei
 * Aufrufe passen mit Aufbau in die Testfrist MITTEL = 300 s (TR-E101c-R2-07).
 */
export const CLI_FRIST_MS = 120_000;

/** Ruft die CLI scripts/wap-gate/e2e.mjs im synthetischen Repo unter der geschachtelten Sperre auf. */
export function baselineCli(
  sb: Sandbox,
  root: string,
  args: string[],
  sperre: string,
): { status: number | null; out: string } {
  const env: NodeJS.ProcessEnv = { ...sb.env, WAP_GATE_SPERRE: sperre };
  const r = spawnSync(process.execPath, [join(WT, 'scripts', 'wap-gate', 'e2e.mjs'), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: CLI_FRIST_MS,
    windowsHide: true,
  });
  expect(r.status, 'CLI ohne Exit-Code (Zeitlimit oder Signal)').not.toBeNull();
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Fiktiver Kernzustand ohne Browser: hängt je Lauf eine Zeile an `marke` an; rot (eigene Meldung, kein
 * Snapshot-Fehler), solange die Datei `rotSchalter` existiert.
 */
export function kernzustandProbe(titel: string, marke: string, rotSchalter: string): string {
  return [
    "import { appendFileSync, existsSync } from 'node:fs';",
    "import { expect, test } from '@playwright/test';",
    '',
    `test(${JSON.stringify(titel)}, async () => {`,
    `  appendFileSync(${JSON.stringify(marke)}, 'lauf\\n');`,
    `  expect(existsSync(${JSON.stringify(rotSchalter)}), 'fiktiver Fehler des Kernzustands').toBe(false);`,
    '});',
    '',
  ].join('\n');
}

/**
 * Fiktiver Kernzustand ohne Browser und ohne Baseline: hängt je Lauf eine Zeile an `marke` an und scheitert
 * nur mit der Playwright-Meldung des Schreiblaufs «A snapshot doesn't exist at …, writing actual.»
 * (Vertrag §2.2 «Erfolg», Spike §8); Pfad fiktiv, es wird kein Bild geschrieben (TR-E101c-R2-04).
 */
export function kernzustandOhneBaseline(titel: string, marke: string): string {
  return [
    "import { appendFileSync } from 'node:fs';",
    "import { test } from '@playwright/test';",
    '',
    `test(${JSON.stringify(titel)}, async () => {`,
    `  appendFileSync(${JSON.stringify(marke)}, 'lauf\\n');`,
    `  throw new Error(${JSON.stringify("A snapshot doesn't exist at fiktiv/e1-01-fiktiv.png, writing actual.")});`,
    '});',
    '',
  ].join('\n');
}

/** Anzahl Läufe laut Marke der Probe. */
export function laeufe(marke: string): number {
  if (!existsSync(marke)) return 0;
  return readFileSync(marke, 'utf8')
    .split('\n')
    .filter((z) => z.trim() === 'lauf').length;
}

/** Zeilen in <root>/.git/wap-gate/protokoll.log, die `text` enthalten. */
export function protokollZeilen(root: string, text: string): string[] {
  const log = join(root, '.git', 'wap-gate', 'protokoll.log');
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .split(/\r?\n/)
    .filter((z) => z.includes(text));
}

export interface PortHalter {
  /** Vite-Konfiguration des synthetischen Repos. */
  konfig: string;
  /** Marke der Hilfsprozesse: je Prozess eine Zeile { pid, port }, sobald er den Port hält. */
  marke: string;
  /** Datei, deren Anlegen den Hilfsprozess beendet. */
  stopp: string;
}

/**
 * Fiktive Vite-Konfiguration mit Port-Halter: Sobald der Vite-Server lauscht, startet ein Plugin einen
 * losgelösten Hilfsprozess und übergibt ihm den lauschenden Server (IPC-Handle). Der Hilfsprozess hält den
 * Port nach dem Ende des Servers weiter, bis die Stopp-Datei besteht (höchstens 120 s). So meldet runE2e
 * «Port … nach dem Lauf belegt», obwohl der Bericht vorliegt und alle Tests grün sind.
 */
export function portHalter(sb: Sandbox): PortHalter {
  const marke = join(sb.base, 'port-halter.json');
  const stopp = join(sb.base, 'port-halter.stopp');
  const halter = writeText(
    sb.base,
    'port-halter.cjs',
    [
      '// Fiktiver Port-Halter (Gate-Test E1-01c Runde 2, CR-E101c-04).',
      "const fs = require('node:fs');",
      'const [marke, stopp] = process.argv.slice(2);',
      "process.on('message', (_m, srv) => {",
      '  if (srv) {',
      "    srv.on('connection', (s) => s.destroy());",
      '    const a = srv.address();',
      "    fs.appendFileSync(marke, JSON.stringify({ pid: process.pid, port: a && typeof a === 'object' ? a.port : null }) + '\\n');",
      '  }',
      '  if (process.connected) process.disconnect();',
      '});',
      'const frist = Date.now() + 120000;',
      'setInterval(() => {',
      '  if (fs.existsSync(stopp) || Date.now() > frist) process.exit(0);',
      '}, 100);',
      '',
    ].join('\n'),
  );
  const konfig = [
    '// Fiktive Vite-Konfiguration der E2E mit Port-Halter (Gate-Test E1-01c Runde 2, CR-E101c-04).',
    "import { spawn } from 'node:child_process';",
    "const cacheDir = process.env.WAP_VITE_CACHE_DIR ?? '';",
    "if (cacheDir === '') throw new Error('WAP_VITE_CACHE_DIR fehlt (fiktiv)');",
    `const HALTER = ${JSON.stringify(halter)};`,
    `const ARGS = ${JSON.stringify([marke, stopp])};`,
    `const KIND_CWD = ${JSON.stringify(tmpdir())};`,
    'const portHalter = {',
    "  name: 'fiktiv-port-halter',",
    '  configureServer(server) {',
    '    const http = server.httpServer;',
    '    if (!http) return;',
    "    http.once('listening', () => {",
    '      const kind = spawn(process.execPath, [HALTER, ...ARGS], {',
    '        cwd: KIND_CWD,',
    '        detached: true,',
    '        windowsHide: true,',
    "        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],",
    '      });',
    "      kind.send('port', http, () => kind.unref());",
    '    });',
    '  },',
    '};',
    "export default { cacheDir, logLevel: 'silent', plugins: [portHalter] };",
    '',
  ].join('\n');
  return { konfig, marke, stopp };
}

/** Hilfsprozesse, die bisher einen Port übernommen haben (je Vite-Server einer). */
export function gehalteneHalter(h: PortHalter): { pid: number; port: number | null }[] {
  if (!existsSync(h.marke)) return [];
  return readFileSync(h.marke, 'utf8')
    .split('\n')
    .filter((z) => z.trim() !== '')
    .map((z) => JSON.parse(z) as { pid: number; port: number | null });
}

/** Lebt der Prozess `pid` noch? */
function lebt(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Beendet die Hilfsprozesse über die Stopp-Datei und wartet höchstens 10 s auf ihr Ende. */
export async function stoppeHalter(sb: Sandbox, h: PortHalter): Promise<void> {
  writeText(sb.base, 'port-halter.stopp', '');
  const pids = gehalteneHalter(h).map((x) => x.pid);
  const ende = Date.now() + 10_000;
  while (Date.now() < ende && pids.some(lebt)) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

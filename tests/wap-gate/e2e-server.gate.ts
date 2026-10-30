// Vite-Server der E2E über eine eigene Hülle mit IPC-Bereitschaft (Nachtrag-Tests S1–S6, S5b, Z3, Z4;
// Änderungsnotiz Stabilität; R-H-11): Kein Node-Prozess der E2E-Kette verbindet sich mit einem Port, der
// geschlossen sein könnte. runE2e startet scripts/wap-gate/lib/vite-server.mjs für jedes Projekt, wartet
// höchstens 60 s auf { bereit: true } (ohne Portabfrage) und beendet die Hülle danach geordnet per IPC, sonst
// per taskkill; die Hülle endet auch, wenn ihr Elternprozess wegfällt (keine Waisen). exitBeschreibung macht
// Windows-Ausnahmen in allen Ursachen mit «Exit» lesbar. Playwright findet den Server bereit vor.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Stabilität (05.10.2026, architect)»
// Nr 1–5 und Nr 7 sowie Orchestrator-Zeile vom 05.10.2026 (ende = 'selbst'); Befunde TR-E101b-21 bis -30.
// Rot-Nachweis: Jeder Test mit Hülle prüft zuerst, ob sie existiert (bzw. ob exitBeschreibung vorhanden
// ist); so startet im heutigen Stand kein Server und kein Prozess fragt einen Port ab.
// Prozesssicherheit: Hüllen werden nur über die Prozessliste mit passender Befehlszeile (Port bzw.
// Elternprozess = dieser Testprozess) beendet, nie über eine blosse PID; der Hilfsprozess nur, solange er
// nachweislich läuft; dazu ein afterEach-Aufräumen. Synthetische Repos mit fiktiver Konfiguration;
// Sperrliste fiktiv (WAP_REFERENCE_DIR).
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer, Socket } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  freierPort,
  ladeModul,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { e2e } from './support/vertrag';
import { e2eRepo } from './support/vertrag-b';

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const HUELLE_REL = 'scripts/wap-gate/lib/vite-server.mjs';
const HUELLE = join(WT, ...HUELLE_REL.split('/'));
const KONFIG_REL = 'tests/wap-e2e/support/vite-e2e.config.ts';

/** Rot-Nachweis an einer Assertion: die Hülle des Pakets fehlt heute. */
function erwarteHuelle(): void {
  expect(existsSync(HUELLE), `Server-Hülle fehlt: ${HUELLE_REL}`).toBe(true);
}

// ---------------------------------------------------------------------------------------------------------
// Prozesse (TR-E101b-26, -27)

interface Huelle {
  pid: number;
  ppid: number;
  befehl: string;
}

const POWERSHELL = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

/** Laufende Hüllen (node.exe mit vite-server.mjs in der Befehlszeile); null, wenn die Liste nicht lesbar ist. */
function huellenListe(): Huelle[] | null {
  const skript = [
    '$l = @(Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" |',
    "Where-Object { ([string]$_.CommandLine) -like '*vite-server.mjs*' } |",
    'ForEach-Object { @{ p = $_.ProcessId; q = $_.ParentProcessId; k = [string]$_.CommandLine } });',
    'ConvertTo-Json -Compress -InputObject $l',
  ].join(' ');
  const r = spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', skript], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  });
  if (r.status !== 0) return null;
  try {
    const roh = JSON.parse(r.stdout.trim() === '' ? '[]' : r.stdout) as unknown;
    const liste = (Array.isArray(roh) ? roh : [roh]) as { p: number; q: number; k: string }[];
    return liste.map((x) => ({ pid: x.p, ppid: x.q, befehl: x.k }));
  } catch {
    return null;
  }
}

/** Filter: Hülle für `port` (Befehlszeile) bzw. direktes Kind dieses Testprozesses. */
function passt(h: Huelle, f: { port?: number; kindVonTest?: boolean }): boolean {
  if (f.port !== undefined && !new RegExp(`--port\\s+${String(f.port)}(?!\\d)`).test(h.befehl)) {
    return false;
  }
  if (f.kindVonTest === true && h.ppid !== process.pid) return false;
  return true;
}

/** PIDs passender Hüllen für den Prüfteil (Assertion, wenn die Prozessliste nicht lesbar ist). */
function huellen(f: { port?: number; kindVonTest?: boolean }): number[] {
  const l = huellenListe();
  expect(l, 'Test-Aufbau: Prozessliste nicht lesbar').not.toBeNull();
  return (l ?? []).filter((h) => passt(h, f)).map((h) => h.pid);
}

/** Beendet passende Hüllen samt Kindern; nur über die frische Prozessliste, ohne Assertion (Aufräumen). */
function beendeHuellen(f: { port?: number; kindVonTest?: boolean }): void {
  for (const h of (huellenListe() ?? []).filter((x) => passt(x, f))) {
    spawnSync('taskkill.exe', ['/pid', String(h.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  }
}

/** Beendet einen Hilfsprozess nur, solange er nachweislich läuft (PID noch nicht neu vergeben). */
function beendeKind(kind: ChildProcess | undefined): void {
  if (kind !== undefined && kind.exitCode === null && kind.signalCode === null) kind.kill();
}

/**
 * Aufräumen nach jedem Test, auch wenn ein Test hängen blieb: zuerst Prozesse (Hilfsprozess, Hüllen als Kind
 * dieses Testprozesses bzw. mit dem Port des Tests), dann die Sandboxen (aufraeumen), in dieser Reihenfolge.
 */
const offen = { aktiv: false, ports: [] as number[], kinder: [] as ChildProcess[] };
afterEach(() => {
  if (offen.aktiv) {
    for (const k of offen.kinder) beendeKind(k);
    beendeHuellen({ kindVonTest: true });
    for (const p of offen.ports) beendeHuellen({ port: p });
  }
  offen.aktiv = false;
  offen.ports = [];
  offen.kinder = [];
  aufraeumen();
});

/** Läuft keine Hülle für `port` mehr? Nicht lesbare Prozessliste gilt als «läuft noch». */
function keineHuelleFuer(port: number): boolean {
  const l = huellenListe();
  return l?.every((h) => !passt(h, { port })) === true;
}

/** Ist der Port auf 127.0.0.1 frei? Nur per listen, nie per connect (Notiz Stabilität Nr 1). */
function portFrei(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = createServer();
    s.once('error', () => res(false));
    s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
  });
}

const warte = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Wartet höchstens `ms`, bis `bedingung` gilt; liefert, ob sie gilt. */
async function bis(bedingung: () => boolean, ms: number): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (bedingung()) return true;
    await warte(100);
  }
  return bedingung();
}

// ---------------------------------------------------------------------------------------------------------
// Mini-Repos und Probe-Tests

/** details.server des Schritts (Notiz Stabilität Nr 3). */
function serverDetails(
  details: unknown,
): { pid?: unknown; ende?: unknown; ms?: unknown; port?: unknown } | null {
  if (typeof details !== 'object' || details === null) return null;
  const s = (details as { server?: unknown }).server;
  return typeof s === 'object' && s !== null
    ? (s as { pid?: unknown; ende?: unknown; ms?: unknown; port?: unknown })
    : null;
}

/** Fiktive E2E-Konfiguration im Mini-Repo: eigener Cache aus WAP_VITE_CACHE_DIR, sonst Fehler. */
const FIKTIVE_KONFIG = [
  '// Fiktive Vite-Konfiguration der E2E (Schleusen-Test).',
  "const cacheDir = process.env.WAP_VITE_CACHE_DIR ?? '';",
  "if (cacheDir === '') throw new Error('WAP_VITE_CACHE_DIR fehlt (fiktiv)');",
  "export default { cacheDir, logLevel: 'silent' };",
  '',
].join('\n');

/** Fiktive Konfiguration, die beim Laden wirft (Startfehler der Hülle, S3). */
const WERFENDE_KONFIG = "throw new Error('fiktiver Konfigurationsfehler');\nexport default {};\n";

/** Fiktive Konfiguration, deren Server beim Schliessen nie fertig wird (closeBundle hängt, Z3). */
const HAENGENDES_ENDE = [
  "const cacheDir = process.env.WAP_VITE_CACHE_DIR ?? '';",
  'export default {',
  '  cacheDir,',
  "  logLevel: 'silent',",
  "  plugins: [{ name: 'fiktiv-haengt', closeBundle() { setInterval(() => {}, 60000); return new Promise(() => {}); } }],",
  '};',
  '',
].join('\n');

/** Fiktive Konfiguration, die nie fertig geladen wird (Server nie bereit, Z4). */
const NIE_BEREIT = 'setInterval(() => {}, 60000);\nexport default new Promise(() => {});\n';

/** Mini-Repo (e2eRepo, ohne webServer) mit Probe-Spezifikation und optional einer E2E-Konfiguration. */
function serverRepo(
  sb: Sandbox,
  opts: { konfig: string | null; probe: string; name: string },
): { root: string; marke: string } {
  prozessUmgebung(sb);
  const marke = join(sb.base, `${opts.name}-marke.json`);
  const root = e2eRepo(sb, { name: opts.name });
  if (opts.konfig !== null) writeText(root, KONFIG_REL, opts.konfig);
  writeText(
    root,
    'tests/wap-e2e/probe.spec.ts',
    opts.probe.replace('MARKE', JSON.stringify(marke)),
  );
  commitAlles(sb, root, 'Server-Probe');
  return { root, marke };
}

/** Probe: ein einziger HTTP-Abruf von /@vite/client auf WAP_E2E_PORT (nur bei bereitem Server erreicht). */
const PROBE_ABRUF = [
  "import { writeFileSync } from 'node:fs';",
  "import { get } from 'node:http';",
  "import { expect, test } from '@playwright/test';",
  '',
  "test('[R-1-01] Probe Vite-Server bereit', async () => {",
  "  const port = Number(process.env.WAP_E2E_PORT ?? '0');",
  '  const status = await new Promise<number>((res) => {',
  "    const r = get({ host: '127.0.0.1', port, path: '/@vite/client' }, (a) => {",
  '      a.resume();',
  "      a.on('end', () => res(a.statusCode ?? 0));",
  '    });',
  "    r.on('error', () => res(-1));",
  '  });',
  '  writeFileSync(MARKE, JSON.stringify({ port, status }));',
  '  expect(status).toBe(200);',
  '});',
  '',
].join('\n');

/** Probe: prüft nur per listen, ob auf WAP_E2E_PORT ein Server lauscht (kein Verbindungsaufbau). */
const PROBE_LISTEN = [
  "import { writeFileSync } from 'node:fs';",
  "import { createServer } from 'node:net';",
  "import { expect, test } from '@playwright/test';",
  '',
  "test('[R-1-01] Probe kein Server', async () => {",
  "  const port = Number(process.env.WAP_E2E_PORT ?? '0');",
  '  const frei = await new Promise<boolean>((res) => {',
  '    const s = createServer();',
  "    s.once('error', () => res(false));",
  "    s.listen(port, '127.0.0.1', () => s.close(() => res(true)));",
  '  });',
  '  writeFileSync(MARKE, JSON.stringify({ port, frei }));',
  '  expect(port).toBeGreaterThan(0);',
  '});',
  '',
].join('\n');

/**
 * runE2e mit Zähler für Verbindungsaufbauten im Testprozess (TR-E101b-22): jede TCP-Verbindung (http, net,
 * fetch) geht über Socket.prototype.connect; runE2e läuft in diesem Prozess.
 */
async function runE2eOhneConnect(opts: { cwd: string; project?: string }) {
  const { runE2e } = await e2e();
  const spion = vi.spyOn(Socket.prototype, 'connect');
  try {
    const r = await runE2e(opts);
    return { r, connects: spion.mock.calls.length };
  } finally {
    spion.mockRestore();
  }
}

/** Einträge lauf-* unter <root>/test-results/wap/vite-cache/ (Cache des Laufs entfernt?). */
function cacheReste(root: string): string[] {
  const ordner = join(root, 'test-results', 'wap', 'vite-cache');
  return existsSync(ordner) ? readdirSync(ordner).filter((n) => n.startsWith('lauf-')) : [];
}

// ---------------------------------------------------------------------------------------------------------

describe('runE2e mit Server-Hülle (S1–S3, Z3, Z4)', () => {
  it.each(['edge', 'edge-dist', undefined])(
    '[R-H-11] S1 Projekt %s: Probe liest /@vite/client mit 200, kein Verbindungsaufbau im Testprozess; danach Hülle beendet (ende = ipc, ms), Port frei, kein Prozess, Cache des Laufs entfernt',
    async (projekt) => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      const { root, marke } = serverRepo(sb, {
        konfig: FIKTIVE_KONFIG,
        probe: PROBE_ABRUF,
        name: 'server-s1',
      });
      const { r, connects } = await runE2eOhneConnect({
        cwd: root,
        ...(projekt === undefined ? {} : { project: projekt }),
      });
      offen.ports.push(r.port);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(marke), 'Probe-Test lief nicht').toBe(true);
      const m = JSON.parse(readFileSync(marke, 'utf8')) as { port: number; status: number };
      expect(m.port).toBe(r.port);
      expect(m.status).toBe(200);
      expect(connects, 'Verbindungsaufbau im Testprozess').toBe(0);
      const s = serverDetails(r.details);
      expect(s, 'details.server fehlt').not.toBeNull();
      expect(s?.ende).toBe('ipc');
      expect(Number.isInteger(s?.pid) && Number(s?.pid) > 0, 'details.server.pid').toBe(true);
      expect(Number.isInteger(s?.ms) && Number(s?.ms) >= 0, 'details.server.ms').toBe(true);
      expect(huellen({ kindVonTest: true }), 'Hülle nach dem Lauf').toEqual([]);
      expect(huellen({ port: r.port }), 'Hülle für den Port nach dem Lauf').toEqual([]);
      expect(await portFrei(r.port), 'Port nach dem Lauf belegt').toBe(true);
      expect(cacheReste(root), 'Cache des Laufs blieb liegen').toEqual([]);
    },
    MITTEL,
  );

  it(
    '[R-H-11] S2 ohne tests/wap-e2e/support/vite-e2e.config.ts startet kein Server: Port während des Probe-Tests frei, kein details.server, keine Hülle',
    async () => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      const { root, marke } = serverRepo(sb, {
        konfig: null,
        probe: PROBE_LISTEN,
        name: 'server-s2',
      });
      const { r } = await runE2eOhneConnect({ cwd: root, project: 'edge' });
      offen.ports.push(r.port);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(marke), 'Probe-Test lief nicht').toBe(true);
      const m = JSON.parse(readFileSync(marke, 'utf8')) as { port: number; frei: boolean };
      expect(m.port).toBe(r.port);
      expect(m.frei, 'auf WAP_E2E_PORT lauschte ein Server').toBe(true);
      expect(serverDetails(r.details)).toBeNull();
      expect(huellen({ kindVonTest: true })).toEqual([]);
    },
    MITTEL,
  );

  it(
    '[R-H-11] S3 Konfiguration, die beim Laden wirft → rot «Vite-Server nicht bereit: Exit 1» (danach «;» oder Ende), details.server.ende = selbst, Probe-Test läuft nicht, kein Verbindungsaufbau, kein Prozess bleibt',
    async () => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      const { root, marke } = serverRepo(sb, {
        konfig: WERFENDE_KONFIG,
        probe: PROBE_ABRUF,
        name: 'server-s3',
      });
      const { r, connects } = await runE2eOhneConnect({ cwd: root, project: 'edge' });
      if (r.port > 0) offen.ports.push(r.port);
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toMatch(/Vite-Server nicht bereit: Exit 1(?:;|$)/);
      expect(r.ursache ?? '', 'absoluter Pfad in der Ursache').not.toMatch(/[A-Za-z]:[\\/]/);
      expect((r.naechsterSchritt ?? '').trim().length).toBeGreaterThan(0);
      expect(existsSync(marke), 'Playwright lief trotz Startfehler').toBe(false);
      expect(connects, 'Verbindungsaufbau im Testprozess').toBe(0);
      expect(serverDetails(r.details)?.ende).toBe('selbst');
      expect(huellen({ kindVonTest: true }), 'Hülle nach dem Startfehler').toEqual([]);
      if (r.port > 0) expect(await portFrei(r.port)).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Z3 Hülle endet auf «ende» nicht (closeBundle hängt) → Rückfall taskkill: details.server.ende = taskkill, kein Prozess bleibt, Port frei',
    async () => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      const { root } = serverRepo(sb, {
        konfig: HAENGENDES_ENDE,
        probe: PROBE_ABRUF,
        name: 'server-z3',
      });
      const { r, connects } = await runE2eOhneConnect({ cwd: root, project: 'edge' });
      offen.ports.push(r.port);
      expect(serverDetails(r.details)?.ende, schrittText(r)).toBe('taskkill');
      expect(connects, 'Verbindungsaufbau im Testprozess').toBe(0);
      expect(huellen({ kindVonTest: true }), 'Hülle nach dem Rückfall').toEqual([]);
      expect(huellen({ port: r.port })).toEqual([]);
      expect(await portFrei(r.port), 'Port nach dem Lauf belegt').toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Z4 Server wird nie bereit → nach 60 s rot «Vite-Server nicht bereit: Exit …», Playwright startet nicht, kein Prozess bleibt',
    async () => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      const { root, marke } = serverRepo(sb, {
        konfig: NIE_BEREIT,
        probe: PROBE_ABRUF,
        name: 'server-z4',
      });
      const beginn = Date.now();
      const { r, connects } = await runE2eOhneConnect({ cwd: root, project: 'edge' });
      const dauer = Date.now() - beginn;
      if (r.port > 0) offen.ports.push(r.port);
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('Vite-Server nicht bereit: Exit ');
      expect(dauer, 'Zeitlimit der Bereitschaft (60 s)').toBeGreaterThanOrEqual(59_000);
      expect(dauer, 'Zeitlimit plus Beenden (höchstens 10 s + 10 s)').toBeLessThan(100_000);
      expect(existsSync(marke), 'Playwright lief ohne bereiten Server').toBe(false);
      expect(connects, 'Verbindungsaufbau im Testprozess').toBe(0);
      expect(huellen({ kindVonTest: true }), 'Hülle nach dem Zeitlimit').toEqual([]);
      if (r.port > 0) expect(await portFrei(r.port)).toBe(true);
    },
    MITTEL,
  );
});

describe('Server-Hülle ohne Elternprozess (S4)', () => {
  /**
   * Hilfsprozess: startet die Hülle losgelöst (detached, TR-E101b-21: sonst beendet das Job-Objekt von
   * libuv die Hülle mit dem Elternprozess, unabhängig von ihrem eigenen Code) mit IPC und schreibt nach
   * { bereit } deren PID und Port in die Marke.
   */
  const HILFE = [
    "import { spawn } from 'node:child_process';",
    "import { writeFileSync } from 'node:fs';",
    'const [huelle, port, marke, konfig] = process.argv.slice(2);',
    'const k = spawn(',
    '  process.execPath,',
    "  [huelle, '--config', konfig, '--port', port, '--strictPort', '--host', '127.0.0.1'],",
    "  { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, detached: true },",
    ');',
    "k.on('message', (m) => {",
    '  if (m !== null && typeof m === "object" && m.bereit === true) {',
    '    writeFileSync(marke, JSON.stringify({ huelle: k.pid, port: m.port }));',
    '  }',
    '});',
    "k.on('exit', () => process.exit(3));",
    'setInterval(() => {}, 1000);',
    '',
  ].join('\n');

  it(
    '[R-H-11] S4 die Hülle, losgelöst per IPC von einem Hilfsprozess gestartet, endet innert 10 s, wenn dieser per taskkill /F (ohne /T) endet; danach ist der Port frei',
    async () => {
      erwarteHuelle();
      offen.aktiv = true;
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = e2eRepo(sb, { name: 'server-s4' });
      writeText(root, KONFIG_REL, FIKTIVE_KONFIG);
      const hilfe = writeText(sb.base, 'hilfe.mjs', HILFE);
      const marke = join(sb.base, 'hilfe-marke.json');
      const port = await freierPort();
      offen.ports.push(port);
      const kind = spawn(process.execPath, [hilfe, HUELLE, String(port), marke, KONFIG_REL], {
        cwd: root,
        env: { ...sb.env, WAP_VITE_CACHE_DIR: join(sb.base, 'vite-cache', 'lauf-s4') },
        stdio: 'ignore',
        windowsHide: true,
      });
      offen.kinder.push(kind);
      expect(kind.pid, 'Test-Aufbau: Hilfsprozess ohne PID').toBeGreaterThan(0);
      expect(await bis(() => existsSync(marke), 60_000), 'Hülle meldete keine Bereitschaft').toBe(
        true,
      );
      const m = JSON.parse(readFileSync(marke, 'utf8')) as { huelle: number; port: number };
      expect(m.port).toBe(port);
      expect(huellen({ port }), 'Hülle läuft vor dem Ende des Hilfsprozesses').toEqual([m.huelle]);
      const k = spawnSync('taskkill.exe', ['/pid', String(kind.pid), '/F'], {
        windowsHide: true,
        encoding: 'utf8',
      });
      expect(k.status, 'Test-Aufbau: taskkill des Hilfsprozesses').toBe(0);
      expect(
        await bis(() => keineHuelleFuer(port), 10_000),
        'Hülle lebt 10 s nach dem Elternprozess',
      ).toBe(true);
      expect(await portFrei(port), 'Port nach dem Ende der Hülle belegt').toBe(true);
    },
    MITTEL,
  );
});

describe('exitBeschreibung (S5, S5b)', () => {
  interface E2eRoh {
    exitBeschreibung?: unknown;
  }

  it.each([
    [3221226505, null, '3221226505 (0xC0000409, Prozessabbruch STATUS_STACK_BUFFER_OVERRUN)'],
    [0xc0000005, null, '3221225477 (0xC0000005, Zugriffsverletzung)'],
    [0xc00000fd, null, '3221225725 (0xC00000FD, Stapelüberlauf)'],
    [0xc000013a, null, '3221225786 (0xC000013A, abgebrochen)'],
    [0xc0000135, null, '3221225781 (0xC0000135, Windows-Ausnahme)'],
    [0xc0000000, null, '3221225472 (0xC0000000, Windows-Ausnahme)'],
    [0xbfffffff, null, '3221225471'],
    [1, null, '1'],
    [0, null, '0'],
    [null, 'SIGTERM', 'Signal SIGTERM'],
  ] as const)('[R-H-11] S5 exitBeschreibung(%s, %s) → «%s»', async (status, signal, erwartet) => {
    const m = await ladeModul<E2eRoh>('scripts/wap-gate/e2e.mjs');
    expect(typeof m.exitBeschreibung, 'exitBeschreibung fehlt in e2e.mjs').toBe('function');
    const f = m.exitBeschreibung as (s: number | null, sig: string | null) => string;
    expect(f(status, signal)).toBe(erwartet);
  });

  it(
    '[R-H-11] S5b Playwright endet mit 0xC0000409 (Konfiguration ruft process.exit) → Ursache von runE2e nennt «Exit 3221226505 (0xC0000409, Prozessabbruch STATUS_STACK_BUFFER_OVERRUN)»',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = e2eRepo(sb, {
        name: 'exit-s5b',
        konfig: 'process.exit(0xC0000409);\nexport default {};\n',
      });
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain(
        'Exit 3221226505 (0xC0000409, Prozessabbruch STATUS_STACK_BUFFER_OVERRUN)',
      );
    },
    MITTEL,
  );
});

describe('playwright.wap.config.ts: webServer über die Hülle (S6)', () => {
  it('[R-H-11] S6 webServer.command startet die Hülle mit --config, Port, --strictPort und --host 127.0.0.1; reuseExistingServer true, auch mit CI=true; url unverändert', async () => {
    const datei = join(WT, 'playwright.wap.config.ts');
    expect(existsSync(datei), 'Konfiguration fehlt: playwright.wap.config.ts').toBe(true);
    vi.stubEnv('WAP_E2E_PORT', '43223');
    vi.stubEnv('CI', 'true');
    vi.resetModules();
    const mod = (await import(pathToFileURL(datei).href)) as {
      default: { webServer?: Record<string, unknown> | Record<string, unknown>[] };
    };
    const ws = mod.default.webServer;
    const w = Array.isArray(ws) ? ws[0] : ws;
    expect(w, 'webServer fehlt').toBeDefined();
    expect(String(w?.command ?? '')).toBe(
      'node scripts/wap-gate/lib/vite-server.mjs --config tests/wap-e2e/support/vite-e2e.config.ts --port 43223 --strictPort --host 127.0.0.1',
    );
    expect(w?.reuseExistingServer).toBe(true);
    expect(w?.url).toBe('http://127.0.0.1:43223/@vite/client');
  });
});

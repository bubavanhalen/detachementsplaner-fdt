// Eingespeiste Last- und Sperr-Umgebung für die Schleusen-Tests (Vertrag E1-01, Änderungsnotiz AE-001 §2):
// Die Tests der Sperre, von F0-last und jedes direkten Aufrufs von runGate, runSelftest oder runStability
// übergeben `last` mit temporärem commonDir und entfernen WAP_GATE_SPERRE; ausser den Tests von F0-last
// liefert die Prozessquelle keine fremden Prozesse und cpuBelegt = 0. Nur fiktive PIDs und Pfade.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, vi } from 'vitest';
import { miniRepo } from './mini';
import { nodeModules, type Sandbox, WT, writeText } from './umgebung';
import type { Last, Proz } from './vertrag';

/** Pfad der Sperrdatei unter einem commonDir (Vertrag AE-001 §2). */
export function sperrPfad(commonDir: string): string {
  return join(commonDir, 'wap-gate', 'sperre.json');
}

export interface TestLast {
  last: Last;
  commonDir: string;
  /** Anzahl Aufrufe der Prozessquelle und Messdauern von cpuBelegt. */
  aufrufe: { prozesse: number; cpuMs: number[] };
  /** Für jeden Aufruf von prozesse(): lag die Sperrdatei in diesem Moment vor? */
  sperreBeimAbfragen: boolean[];
}

/**
 * Last für direkte Aufrufe: temporäres commonDir (unter der Sandbox), Prozessquelle mit den angegebenen
 * Prozessen (Standard: keine) und cpuBelegt (Standard: 0). Entfernt WAP_GATE_SPERRE im Testprozess.
 */
export function testLast(
  sb: Sandbox,
  opts: {
    name?: string;
    prozesse?: Proz[];
    /** Prozesse je Aufruf (1-basiert); hat Vorrang vor `prozesse`. */
    prozesseBeiAufruf?: (n: number) => Proz[];
    cpu?: number;
    lebt?: Last['lebt'];
    pruefIntervallMs?: number;
  } = {},
): TestLast {
  vi.stubEnv('WAP_GATE_SPERRE', undefined);
  const commonDir = join(sb.base, opts.name ?? 'common');
  mkdirSync(commonDir, { recursive: true });
  const aufrufe = { prozesse: 0, cpuMs: [] as number[] };
  const sperreBeimAbfragen: boolean[] = [];
  const last: Last = {
    commonDir,
    quelle: {
      prozesse: async () => {
        aufrufe.prozesse += 1;
        sperreBeimAbfragen.push(existsSync(sperrPfad(commonDir)));
        if (opts.prozesseBeiAufruf !== undefined) return opts.prozesseBeiAufruf(aufrufe.prozesse);
        return opts.prozesse ?? [];
      },
      cpuBelegt: async (ms: number) => {
        aufrufe.cpuMs.push(ms);
        return opts.cpu ?? 0;
      },
    },
  };
  if (opts.lebt !== undefined) last.lebt = opts.lebt;
  if (opts.pruefIntervallMs !== undefined) last.pruefIntervallMs = opts.pruefIntervallMs;
  return { last, commonDir, aufrufe, sperreBeimAbfragen };
}

/** Fiktiver Prozess für die Prozessquelle. */
export function proz(
  pid: number,
  ppid: number,
  name: string,
  kommandozeile: string,
  erstellt = '2026-10-04T08:00:00.000Z',
): Proz {
  return { pid, ppid, name, kommandozeile, erstellt };
}

/** Fremder Vitest-Lauf eines anderen Agents (eigene Familie ohne Bezug zum Testprozess). */
export function fremderVitest(pid = 990_001): Proz {
  return proz(
    pid,
    990_000,
    'node.exe',
    'node C:\\fiktiv\\anderer-wt\\node_modules\\vitest\\vitest.mjs run',
  );
}

export interface Sperrinhalt {
  pid: number;
  erstellt: string;
  modus: string;
  worktree: string;
  start: string;
  token: string;
}

/** Schreibt eine Sperrdatei von Hand (Format Vertrag AE-001 §2). */
export function schreibeSperre(commonDir: string, inhalt: Sperrinhalt): string {
  const pfad = sperrPfad(commonDir);
  writeText(join(commonDir, 'wap-gate'), 'sperre.json', `${JSON.stringify(inhalt, null, 2)}\n`);
  return pfad;
}

export function leseSperre(commonDir: string): Sperrinhalt {
  return JSON.parse(readFileSync(sperrPfad(commonDir), 'utf8')) as Sperrinhalt;
}

/** Fremder, von Hand gesetzter Halter (PID fiktiv; ob er «lebt», bestimmt last.lebt im Test). */
export const FREMDER_HALTER: Sperrinhalt = {
  pid: 424_242,
  erstellt: '2026-10-04T07:59:00.000Z',
  modus: 'full',
  worktree: 'C:\\fiktiv\\wap-wt\\anderes-paket',
  start: '2026-10-04T08:00:00.000Z',
  token: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
};

/** PID eines beendeten Prozesses (kurzer Kindprozess, danach nicht mehr vorhanden). */
export function totePid(): number {
  const r = spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
  expect(r.pid, 'Test-Aufbau: kurzer Kindprozess ohne PID').toBeGreaterThan(0);
  return r.pid as number;
}

/** Lebender Kindprozess ohne Bezug zur Schleuse (wartet, bis er beendet wird). */
export function wartenderProzess(): ChildProcess {
  return spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], {
    windowsHide: true,
    stdio: 'ignore',
  });
}

/** Pfad von scripts/wap-gate/last.mjs; fehlt das Modul → Assertion (rot), kein Importfehler. */
export function lastPfad(): string {
  const datei = join(WT, 'scripts', 'wap-gate', 'last.mjs');
  expect(existsSync(datei), 'Modul des Pakets fehlt: scripts/wap-gate/last.mjs').toBe(true);
  return datei;
}

/**
 * Ruft belegeSperre in einem Kindprozess auf (echte Prozessquelle, echtes «lebt»), mit
 * WAP_GATE_SPERRE = envWert in dessen Umgebung; der Kindprozess gibt die Sperre gleich wieder frei.
 * Liefert { ok, geschachtelt, ursache } bzw. { fehler } bei einem Wurf.
 */
export function belegeImKind(
  sb: Sandbox,
  commonDir: string,
  envWert: string | undefined,
): { ok?: boolean; geschachtelt?: boolean; ursache?: string; fehler?: string } {
  const url = pathToFileURL(lastPfad()).href;
  const skript = writeText(
    sb.base,
    `kind-sperre-${String(Date.now())}.mjs`,
    [
      `import { belegeSperre } from ${JSON.stringify(url)};`,
      'try {',
      `  const r = await belegeSperre({ modus: 'fast', worktree: ${JSON.stringify(WT)}, env: process.env, last: { commonDir: ${JSON.stringify(commonDir)} } });`,
      '  if (r.ok) {',
      '    await r.freigeben();',
      "    process.stdout.write(JSON.stringify({ ok: true, geschachtelt: r.geschachtelt }) + '\\n');",
      '  } else {',
      "    process.stdout.write(JSON.stringify({ ok: false, ursache: r.schritt.ursache ?? '' }) + '\\n');",
      '  }',
      '} catch (e) {',
      "  process.stdout.write(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }) + '\\n');",
      '}',
      '',
    ].join('\n'),
  );
  const env: NodeJS.ProcessEnv = { ...sb.env };
  delete env.WAP_GATE_SPERRE;
  if (envWert !== undefined) env.WAP_GATE_SPERRE = envWert;
  const r = spawnSync(process.execPath, [skript], {
    cwd: sb.base,
    env,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  });
  const zeile = r.stdout.split(/\r?\n/).find((z) => z.startsWith('{'));
  expect(zeile, 'Kindprozess ohne Ergebnis').toBeDefined();
  return JSON.parse(zeile as string) as {
    ok?: boolean;
    geschachtelt?: boolean;
    ursache?: string;
    fehler?: string;
  };
}

/** Wirft den Fehler des Kindprozesses unverändert weiter (z.B. «nicht implementiert: …»). */
export function ohneFehler<T extends { fehler?: string }>(r: T): T {
  if (r.fehler !== undefined) throw new Error(r.fehler);
  return r;
}

/** Schreibt eine Datei nur, wenn ihr Ordner existiert (für Sperrdateien in Tests). */
export function ueberschreibe(pfad: string, inhalt: string): void {
  expect(existsSync(pfad), `Test-Aufbau: ${pfad} fehlt`).toBe(true);
  writeFileSync(pfad, inhalt);
}

export interface SetupKindErgebnis {
  ok?: boolean;
  envWert?: string;
  sperreWaehrend?: boolean;
  sperreDanach?: boolean;
  fehler?: string;
}

/**
 * Ruft den Default-Export `setup` von vitest-setup.mjs in einem Kindprozess auf, und zwar aus einer Kopie von
 * scripts/wap-gate/ in einem temporären Mini-Repo (cwd = dessen Wurzel, ohne WAP_GATE_SPERRE). So kann der
 * Aufruf weder die gemeinsame Sperre des echten Repos noch dessen Git-Verzeichnis berühren (TR-E101-01, -12).
 * Liefert das Ergebnis und die Wurzel des Mini-Repos (Prüfung <root>/.git/wap-gate).
 */
export function setupImKind(
  sb: Sandbox,
  opts: { maxWorkers: number; vitestMaxWorkers?: string; name?: string },
): { r: SetupKindErgebnis; root: string } {
  const root = miniRepo(sb, opts.name ?? 'setup-mini');
  cpSync(join(WT, 'scripts', 'wap-gate'), join(root, 'scripts', 'wap-gate'), { recursive: true });
  nodeModules(root);
  const url = pathToFileURL(join(root, 'scripts', 'wap-gate', 'vitest-setup.mjs')).href;
  const sperre = join(root, '.git', 'wap-gate', 'sperre.json');
  const skript = writeText(
    sb.base,
    `kind-setup-${String(Date.now())}.mjs`,
    [
      "import { existsSync } from 'node:fs';",
      `const mod = await import(${JSON.stringify(url)});`,
      'try {',
      `  const teardown = await mod.default({ config: { maxWorkers: ${String(opts.maxWorkers)} } });`,
      `  const sperreWaehrend = existsSync(${JSON.stringify(sperre)});`,
      '  const envWert = process.env.WAP_GATE_SPERRE;',
      '  await teardown();',
      `  const sperreDanach = existsSync(${JSON.stringify(sperre)});`,
      "  process.stdout.write(JSON.stringify({ ok: true, envWert, sperreWaehrend, sperreDanach }) + '\\n');",
      '} catch (e) {',
      "  process.stdout.write(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }) + '\\n');",
      '}',
      '',
    ].join('\n'),
  );
  const env: NodeJS.ProcessEnv = { ...sb.env };
  delete env.WAP_GATE_SPERRE;
  delete env.VITEST_MAX_WORKERS;
  if (opts.vitestMaxWorkers !== undefined) env.VITEST_MAX_WORKERS = opts.vitestMaxWorkers;
  const p = spawnSync(process.execPath, [skript], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  });
  const zeile = p.stdout.split(/\r?\n/).find((z) => z.startsWith('{'));
  expect(zeile, `Kindprozess ohne Ergebnis (Exit ${String(p.status)})`).toBeDefined();
  return { r: JSON.parse(zeile as string) as SetupKindErgebnis, root };
}

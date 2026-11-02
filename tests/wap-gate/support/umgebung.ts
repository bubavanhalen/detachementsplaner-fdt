// Gemeinsame Hilfen der Schleusen-Tests (Paket E1-01, Testart Integration-Gate, ADR-010 §3.2 V1a).
// Alle Tests arbeiten in frischen temporären Git-Repos bzw. Klonen unter os.tmpdir(), nie im
// Arbeits-Checkout; Daten sind fiktiv. Die Sperrliste ist immer eine fiktive Testliste über
// WAP_REFERENCE_DIR (nie die echte Liste unter reference/, AGENTS.md).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2, §4 (keine req()-Aufrufe beim Sammeln).
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, vi } from 'vitest';

/** Wurzel des Paket-Worktrees (wird nur gelesen). */
export const WT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Ordner des laufenden Node (24.15.0). */
export const NODE_DIR = dirname(process.execPath);

/** Zeitlimit der Kindprozesse (Werkzeuge wie tsc, Vitest, Biome). */
export const KIND_TIMEOUT = 300_000;

/** Zeitlimits je Testart. */
export const KURZ = 60_000;
export const MITTEL = 300_000;
export const LANG = 900_000;
export const SEHR_LANG = 3_600_000;

/** Fiktive Git-Identität; die E-Mail-Adresse wird zur Laufzeit zusammengesetzt. */
export const TEST_USER = 'Gate Test';
export const TEST_MAIL = ['gate', 'example.invalid'].join('@');

/** Dateiname der Sperrliste (wie H0, scripts/wap/lib/muster.mjs). */
export const SPERRLISTE = 'datenschutz-sperrliste.txt';

/** Fiktive Sperrlisten-Namen (frei erfunden, kommen in keinem echten Dokument vor). */
export const FIKTIVER_NAME = 'Zwirbelquast';
export const FIKTIVE_NAMEN = [FIKTIVER_NAME, 'Testname Beispiel'];

/** Fiktive AHV-Nummer, zur Laufzeit gebildet (nie als Literal im Quelltext). */
export function ahvNummer(): string {
  return ['75', '6.1234.5678.97'].join('');
}

/** Bildet ein verbotenes Wort zur Laufzeit (damit die Musterprüfung diesen Quelltext nicht trifft). */
export function wort(...teile: string[]): string {
  return teile.join('');
}

export interface Sandbox {
  base: string;
  /** Ordner mit der fiktiven Sperrliste (WAP_REFERENCE_DIR). */
  referenceDir: string;
  /** Umgebung für Kindprozesse: ohne GIT_*, fiktive Sperrliste, npm offline. */
  env: NodeJS.ProcessEnv;
}

const sandboxes: string[] = [];

export function neueSandbox(): Sandbox {
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wap-gate-')));
  sandboxes.push(base);
  const leer = join(base, 'leer.gitconfig');
  writeFileSync(leer, '');
  const referenceDir = join(base, 'referenz');
  mkdirSync(referenceDir);
  writeFileSync(
    join(referenceDir, SPERRLISTE),
    ['# Fiktive Sperrliste für Schleusen-Tests', '', ...FIKTIVE_NAMEN, ''].join('\n'),
  );
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    const k = key.toUpperCase();
    if (k.startsWith('GIT_') || k === 'WAP_REFERENCE_DIR' || k === 'WAP_PYTHON') continue;
    // Variablen des laufenden Vitest (NODE_ENV=test, VITEST*) gehören nicht in Kindprozesse.
    if (k === 'NODE_ENV' || k.startsWith('VITEST') || k.startsWith('__VITEST')) continue;
    env[key] = value;
  }
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = leer;
  env.WAP_REFERENCE_DIR = referenceDir;
  env.npm_config_offline = 'true';
  return { base, referenceDir, env };
}

/**
 * Setzt die Umgebung des Testprozesses für Funktionsaufrufe (Schleusen-Funktionen lesen process.env):
 * fiktive Sperrliste, npm ohne Netz, kein WAP_PYTHON aus der Umgebung des Aufrufers und kein
 * WAP_GATE_SPERRE (Vertrag E1-01, Änderungsnotiz AE-001 §2: direkte Aufrufe sind nie geschachtelt).
 */
export function prozessUmgebung(sb: Sandbox): void {
  vi.stubEnv('WAP_REFERENCE_DIR', sb.referenceDir);
  vi.stubEnv('npm_config_offline', 'true');
  vi.stubEnv('WAP_PYTHON', undefined);
  vi.stubEnv('WAP_GATE_SPERRE', undefined);
}

export function aufraeumen(): void {
  vi.unstubAllEnvs();
  // Eine Frist für alle Sandboxen dieses Aufrufs (deutlich unter hookTimeout 60 s der Gate-Konfiguration).
  const frist = Date.now() + 15_000;
  let fehler: unknown = null;
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (!dir) continue;
    try {
      entferne(dir, frist);
    } catch (e) {
      if (fehler === null) fehler = e;
    }
  }
  if (fehler !== null) throw fehler;
}

/**
 * Entfernt einen Sandbox-Ordner (Befund E1-01b-05). rmSync wiederholt unter Windows bei EPERM trotz maxRetries
 * nicht (Node 24.15.0, gemessen: Fehler nach 1 ms); kurz gehaltene Handles fremder Prozesse (z.B. Virenscanner
 * auf frisch geschriebenen Dateien) lösen sich erst nach Sekunden. Daher eine eigene, blockierende Wiederholung
 * alle 100 ms bis zur Frist; danach und bei anderen Fehlercodes wird der Fehler geworfen (Test rot).
 */
function entferne(dir: string, frist: number): void {
  const halt = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'].includes(code) || Date.now() >= frist) throw e;
      Atomics.wait(halt, 0, 0, 100);
    }
  }
}

export interface Lauf {
  status: number | null;
  stdout: string;
  stderr: string;
  out: string;
}

export function lauf(
  befehl: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeout?: number; input?: string },
): Lauf {
  const r: SpawnSyncReturns<string> = spawnSync(befehl, args, {
    cwd: opts.cwd,
    env: opts.env,
    encoding: 'utf8',
    input: opts.input ?? '',
    timeout: opts.timeout ?? KIND_TIMEOUT,
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // Scheitert der Kindprozess am Vertrags-Stub eines Schleusen-Skripts (CLI-Stub, Vertrag §5), wird genau
  // dieser Stub-Fehler im Test weitergereicht (fachlich rot, ADR-010 §3.3), statt einer Folge-Assertion.
  const stub =
    r.status !== 0 ? /nicht implementiert: ((?:gate|support)\.[A-Za-z0-9.]+)/.exec(out) : null;
  if (stub !== null) throw new Error(`nicht implementiert: ${stub[1] ?? ''}`);
  expect(
    r.status,
    `${befehl} ${args[0] ?? ''}: ohne Exit-Code (Zeitlimit oder Signal)`,
  ).not.toBeNull();
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out };
}

/** Node-Skript als Kindprozess (process.execPath). */
export function node(
  skript: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeout?: number },
): Lauf {
  return lauf(process.execPath, [skript, ...args], opts);
}

export function git(sb: Sandbox, cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, {
    cwd,
    env: sb.env,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`Test-Aufbau: git ${args.join(' ')} scheiterte: ${r.stderr}`);
  return r.stdout.trim();
}

export function writeText(root: string, rel: string, content: string | Uint8Array): string {
  const file = join(root, ...rel.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function readText(root: string, rel: string): string {
  return readFileSync(join(root, ...rel.split('/')), 'utf8');
}

/** SHA-256 hex über die Bytes nach CRLF→LF (wie H0 P1 und legacy-modules.json). */
export function sha256Lf(content: string | Uint8Array): string {
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) continue;
    out.push(bytes[i] as number);
  }
  return createHash('sha256').update(Buffer.from(out)).digest('hex');
}

export function sha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Befundregister im Format von H0 (leere Tabellen). */
export const FINDINGS_LEER = [
  '# WAP-Planer – Befundregister',
  '',
  '| ID | Quelle (Agent, Paket, Runde) | Stufe | Anforderung / Stelle | Fundstelle | Status | Begründung / Entscheid | Verifiziert durch |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '',
  '## Protokoll `test-lock.json`',
  '',
  '| Datum | Commit | Pfade | Grund | Befund-ID |',
  '| --- | --- | --- | --- | --- |',
  '',
].join('\n');

/** Frisches Git-Repo mit einem ersten Commit (README, leere Sperre, Befundregister). */
export function neuesRepo(sb: Sandbox, name: string, branch = 'wap-planer'): string {
  const root = join(sb.base, name);
  mkdirSync(root, { recursive: true });
  git(sb, root, 'init', '-q', '-b', branch);
  git(sb, root, 'config', 'user.name', TEST_USER);
  git(sb, root, 'config', 'user.email', TEST_MAIL);
  git(sb, root, 'config', 'core.autocrlf', 'false');
  git(sb, root, 'config', 'commit.gpgsign', 'false');
  writeText(root, 'README.md', '# Testrepo\n');
  writeText(root, 'docs/wap-planer/FINDINGS.md', FINDINGS_LEER);
  writeText(root, 'docs/wap-planer/test-lock.json', '{\n  "version": 1,\n  "files": {}\n}\n');
  writeText(root, '.gitignore', 'node_modules\ntest-results\n');
  git(sb, root, 'add', '-A');
  git(sb, root, 'commit', '-q', '-m', 'Start');
  return root;
}

export function commitAlles(sb: Sandbox, root: string, nachricht: string): string {
  git(sb, root, 'add', '-A');
  git(sb, root, 'commit', '-q', '--allow-empty', '-m', nachricht);
  return git(sb, root, 'rev-parse', 'HEAD');
}

/** Verzeichnis-Junction (Windows, ohne Administratorrechte). */
export function junction(link: string, ziel: string): void {
  mkdirSync(dirname(link), { recursive: true });
  const r = spawnSync('cmd', ['/c', 'mklink', '/J', link, ziel], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`Test-Aufbau: mklink /J scheiterte: ${r.stdout}${r.stderr}`);
}

/** Verknüpft node_modules des Paket-Worktrees in ein temporäres Repo (keine Installation, kein Netz). */
export function nodeModules(root: string): void {
  junction(join(root, 'node_modules'), join(WT, 'node_modules'));
}

/** Kopiert eine Datei des Paket-Worktrees an dieselbe relative Stelle; fehlt sie → Assertion (rot). */
export function kopiereAusWt(root: string, rel: string): void {
  const quelle = join(WT, ...rel.split('/'));
  expect(existsSync(quelle), `Datei des Pakets fehlt: ${rel}`).toBe(true);
  const ziel = join(root, ...rel.split('/'));
  mkdirSync(dirname(ziel), { recursive: true });
  copyFileSync(quelle, ziel);
}

/**
 * Klon des aktuellen Arbeitsstands des Paket-Worktrees (versionierte und nicht ignorierte Dateien,
 * so wie sie im Arbeitsbaum liegen) als eigenes Repo unter der Sandbox, Zweig wie im Worktree,
 * lokale Zweige main und wap-planer, ein Commit «Arbeitsstand» obenauf, node_modules verknüpft.
 * Eigenes Repo: keine Hooks des gemeinsamen Git-Verzeichnisses (kein Umgehen von Hooks nötig).
 */
export function arbeitsstandKlon(sb: Sandbox, name = 'klon'): { root: string; zweig: string } {
  const root = join(sb.base, name);
  const zweig = git(sb, WT, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(sb, sb.base, 'clone', '-q', WT, root);
  git(sb, root, 'config', 'user.name', TEST_USER);
  git(sb, root, 'config', 'user.email', TEST_MAIL);
  git(sb, root, 'config', 'core.autocrlf', 'false');
  git(sb, root, 'config', 'commit.gpgsign', 'false');
  for (const b of ['main', 'wap-planer']) {
    const vorhanden = spawnSync(
      'git',
      ['rev-parse', '--verify', '-q', `refs/remotes/origin/${b}`],
      {
        cwd: root,
        env: sb.env,
        encoding: 'utf8',
      },
    );
    if (vorhanden.status === 0 && b !== zweig) git(sb, root, 'branch', '-q', b, `origin/${b}`);
  }
  const geaendert = git(sb, WT, 'ls-files', '-z', '-m', '-o', '--exclude-standard')
    .split('\0')
    .filter((p) => p !== '');
  for (const rel of new Set(geaendert)) {
    const quelle = join(WT, ...rel.split('/'));
    if (!existsSync(quelle)) continue;
    const ziel = join(root, ...rel.split('/'));
    mkdirSync(dirname(ziel), { recursive: true });
    copyFileSync(quelle, ziel);
  }
  const geloescht = git(sb, WT, 'ls-files', '-z', '-d')
    .split('\0')
    .filter((p) => p !== '');
  for (const rel of geloescht) rmSync(join(root, ...rel.split('/')), { force: true });
  commitAlles(sb, root, 'Arbeitsstand');
  nodeModules(root);
  return { root, zweig };
}

/** Lädt ein Modul des Pakets zur Laufzeit; fehlt die Datei → Assertion (rot), kein Importfehler. */
export async function ladeModul<T>(rel: string): Promise<T> {
  const datei = join(WT, ...rel.split('/'));
  expect(existsSync(datei), `Modul des Pakets fehlt: ${rel}`).toBe(true);
  return (await import(pathToFileURL(datei).href)) as T;
}

/** Text eines Schritts für Inhaltsprüfungen (Ursache, nächster Schritt und Details). */
export function schrittText(s: {
  ursache?: string;
  naechsterSchritt?: string;
  details?: unknown;
}): string {
  return `${s.ursache ?? ''}\n${s.naechsterSchritt ?? ''}\n${JSON.stringify(s.details ?? null)}`;
}

/** Freier TCP-Port (für WAP_E2E_PORT in Kind-Läufen). */
export async function freierPort(): Promise<number> {
  const { createServer } = await import('node:net');
  return await new Promise<number>((res, rej) => {
    const srv = createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const adr = srv.address();
      const port = typeof adr === 'object' && adr !== null ? adr.port : 0;
      srv.close(() => res(port));
    });
  });
}

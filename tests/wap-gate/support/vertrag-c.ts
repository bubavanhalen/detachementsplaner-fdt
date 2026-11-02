// Typen, Lader und Hilfen der Schleusen-Tests von E1-01c (Werkzeug I2: Bildschirm-Regression, Leistung,
// Offline-Hilfe, Barrierefreiheit, Rot-Phase bei Playwright-Meldungen; R-H-21, R-H-22, R-H-25, R-H-26, R-H-35).
// Eigene Schnittstellen (comparePerf mit `messungen: string | null` und `budgets`, runE2e mit `repeatEach`,
// OfflineHilfe), weil vertrag.ts und umgebung.ts gesperrt sind (Vertrag E1-01c §3). Nur fiktive Inhalte.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2, §3.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import {
  commitAlles,
  KIND_TIMEOUT,
  ladeModul,
  neuesRepo,
  nodeModules,
  type Sandbox,
  WT,
  writeText,
} from './umgebung';
import type { Schritt } from './vertrag';
import { FIKTIVE_APP_LIZENZ, fiktivesBuildSkript } from './vertrag-b';

// ---------------------------------------------------------------------------------------------------------
// Schnittstellen (Vertrag E1-01c §2)

export type Regel = 'prozent10' | 'prozent10oder2ms';

/** scripts/wap-gate/perf-compare.mjs (Vertrag E1-01c §2.1, §2.3). */
export interface PerfCompareModulC {
  comparePerf(opts: {
    messungen: string | null;
    baseline: string;
    drosselung: string;
    budgets: string;
    regel: Regel;
  }): Schritt;
}

/** details von comparePerf (Vertrag E1-01c §2.3 Nr 8). */
export interface PerfDetails {
  faktor: number;
  messgroessen: number;
  ohneBaseline: string[];
  verbesserungen: string[];
  strom: 'Netz' | 'Akku' | 'unbekannt';
}

/** scripts/wap-gate/e2e.mjs (Vertrag E1-01c §2.1). */
export interface E2eModulC {
  runE2e(opts: {
    cwd: string;
    project?: string;
    repeatEach?: number;
  }): Promise<Schritt & { port: number }>;
}

/** scripts/wap-gate/red-phase.mjs (Vertrag E1-01 §2, E1-01c §2.6). */
export interface RedPhaseModulC {
  fachlichRot(meldung: string, stubNamen: string[]): boolean;
  classifyRedPhase(opts: {
    berichte: string[];
    paket: string;
    paketIds: string[];
    stubNamen: string[];
  }): Schritt;
}

/** scripts/wap-gate/stability.mjs mit E2E-Teil (Vertrag E1-01c §2.1 «stability.mjs»). */
export interface StabilityModulC {
  runStability(opts: {
    cwd: string;
    last?: import('./vertrag').Last;
    profile?: ('normal' | 'grenzlast')[];
  }): Promise<Schritt>;
}

/** Eintrag der Leistungs-Harness (tests/wap-perf/harness/harness.ts). */
export interface PerfEntryC {
  readonly name: string;
  readonly anforderung: string;
  readonly budgetMs: number;
  prepare(seed: number): Promise<unknown>;
  run(prepared: unknown): Promise<void>;
}

/** tests/wap-perf/harness/harness.ts (Vertrag E1-01c §2.3). */
export interface HarnessModul {
  registerPerfEntries(entries: readonly PerfEntryC[]): void;
  registrierteEintraege(): { name: string; anforderung: string; budgetMs: number }[];
  messeEintrag(name: string, seed: number): Promise<number>;
}

/** Node-Teil von tests/wap-perf/support/perf.ts (Vertrag E1-01c §2.3). */
export interface PerfSupportModul {
  medianOf5(run: () => Promise<number>): Promise<{ median: number; laeufe: number[] }>;
  recordMetric(name: string, anforderung: string, medianMs: number, budgetMs: number): void;
}

/**
 * Rückgabe von offlinePersistent (Vertrag E1-01c §2.4). Die Selbsttests verwenden sie in erzeugten
 * Spezifikationen; der Typ hält die Schnittstelle hier fest.
 */
export interface OfflineHilfe {
  readonly context: unknown;
  readonly abgebrochen: readonly string[];
  restart(): Promise<unknown>;
  close(): Promise<void>;
}

export const perfCompareC = () => ladeModul<PerfCompareModulC>('scripts/wap-gate/perf-compare.mjs');
export const e2eC = () => ladeModul<E2eModulC>('scripts/wap-gate/e2e.mjs');
export const redPhaseC = () => ladeModul<RedPhaseModulC>('scripts/wap-gate/red-phase.mjs');
export const stabilityC = () => ladeModul<StabilityModulC>('scripts/wap-gate/stability.mjs');
export const harnessModul = () => ladeModul<HarnessModul>('tests/wap-perf/harness/harness.ts');
export const perfSupport = () => ladeModul<PerfSupportModul>('tests/wap-perf/support/perf.ts');

// ---------------------------------------------------------------------------------------------------------
// Leistung: Eingabedateien (fiktiv)

/** Versionierte Budgettabelle (Schritt 3, test-engineer; nur gelesen). */
export const BUDGETS = join(WT, 'docs', 'wap-planer', 'perf', 'budgets.json');
/** Versionierte Drosselung (gesperrt; nur gelesen). */
export const DROSSELUNG = join(WT, 'docs', 'wap-planer', 'perf', 'drosselung.json');

export const DROSSEL_MELDUNG = 'Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)';

export interface Messwert {
  medianMs: number;
  budgetMs: number;
  anforderung: string;
}

/** perf-baseline.json im Schema von ADR-010 §8 (fiktive Umgebung). */
export function baselineJson(
  messwerte: Record<string, Messwert>,
  drosselung: string | number = 1.5,
): string {
  const mit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(messwerte)) {
    mit[k] = { ...v, gemessenAm: '01.10.2026', commit: 'abc1234' };
  }
  return `${JSON.stringify(
    {
      version: 1,
      protokoll: {
        drosselung,
        laeufe: 5,
        aufwaermlaeufe: 1,
        startwert: 20260928,
        plan: { wochen: 4, eintraege: 1000 },
      },
      umgebung: { browser: 'chromium (fiktiv)', node: '24.15.0', cpu: 'fiktiv', strom: 'Netz' },
      messwerte: mit,
    },
    null,
    2,
  )}\n`;
}

/** test-results/wap/perf.json (Vertrag E1-01 §9 Nr 2). */
export function messungenJson(messwerte: Record<string, Messwert>): string {
  return `${JSON.stringify({ messwerte }, null, 2)}\n`;
}

/** drosselung.json mit zusätzlichen Schlüsseln (werden nicht abgelehnt, Vertrag E1-01 §6). */
export function drosselungJson(faktor: number | null, status: 'offen' | 'festgelegt'): string {
  return `${JSON.stringify(
    {
      faktor,
      status,
      quelle: 'fiktive Testeingabe',
      messung: { dienstlaptopMedianMs: null, lokalMedianMs: null, datum: null },
      herleitung: { regel: 'zusätzlicher Schlüssel, wird nicht abgelehnt' },
    },
    null,
    2,
  )}\n`;
}

/** Budgettabelle mit beliebigen Einträgen (für Schema-Verstösse, Vertrag E1-01c §2.3 V22). */
export function budgetsJson(budgets: unknown, version: unknown = 1): string {
  return `${JSON.stringify({ version, quelle: 'fiktive Testeingabe', budgets }, null, 2)}\n`;
}

/** Einträge der versionierten Budgettabelle (gelesen, nicht geändert). */
export function versionierteBudgets(): Record<string, unknown>[] {
  const roh = JSON.parse(readFileSync(BUDGETS, 'utf8')) as { budgets: Record<string, unknown>[] };
  return roh.budgets;
}

export const PDF_WOCHE = (medianMs: number, budgetMs = 3000): Messwert => ({
  medianMs,
  budgetMs,
  anforderung: 'R-11-15',
});

export const WOCHENWECHSEL = (medianMs: number, budgetMs = 300): Messwert => ({
  medianMs,
  budgetMs,
  anforderung: 'R-11-12',
});

/** details eines comparePerf-Schritts als PerfDetails (Assertion, wenn sie fehlen). */
export function perfDetails(s: Schritt): PerfDetails {
  expect(typeof s.details === 'object' && s.details !== null, 'details fehlen').toBe(true);
  return s.details as PerfDetails;
}

// ---------------------------------------------------------------------------------------------------------
// Playwright-Berichte

/** Ergebnis eines Tests aus einem Playwright-JSON-Bericht, nur errors[].message (Format Vertrag E1-01c §8). */
export interface PwErgebnis {
  titel: string;
  projekt: string;
  status: string;
  meldungen: string[];
  wiederholung: number;
}

interface PwSuiteRoh {
  specs?: {
    title?: string;
    tests?: {
      projectName?: string;
      results?: { status?: string; retry?: number; errors?: { message?: string }[] }[];
    }[];
  }[];
  suites?: PwSuiteRoh[];
}

/** Liest einen Playwright-JSON-Bericht; fehlt er → Assertion (rot). Je Test und Wiederholung ein Eintrag. */
export function pwErgebnisse(bericht: string): PwErgebnis[] {
  expect(existsSync(bericht), `Playwright-Bericht fehlt: ${bericht}`).toBe(true);
  const daten = JSON.parse(readFileSync(bericht, 'utf8')) as { suites?: PwSuiteRoh[] };
  const out: PwErgebnis[] = [];
  const gehe = (s: PwSuiteRoh): void => {
    for (const spec of s.specs ?? []) {
      let n = 0;
      for (const t of spec.tests ?? []) {
        const r = (t.results ?? []).at(-1);
        out.push({
          titel: spec.title ?? '',
          projekt: t.projectName ?? '',
          status: r?.status ?? 'ohne Ergebnis',
          meldungen: (r?.errors ?? []).map((e) => e.message ?? ''),
          wiederholung: n,
        });
        n += 1;
      }
    }
    for (const k of s.suites ?? []) gehe(k);
  };
  for (const s of daten.suites ?? []) gehe(s);
  return out;
}

/** Ergebnis eines Tests mit `titel` (genau einer erwartet); fehlt er → Assertion. */
export function pwTest(ergebnisse: PwErgebnis[], titel: string): PwErgebnis {
  const t = ergebnisse.filter((e) => e.titel === titel);
  expect(t.length, `Test «${titel}» im Bericht`).toBe(1);
  return t[0] as PwErgebnis;
}

/** Erwartet «passed» und zeigt sonst die Meldungen (ohne Farben gekürzt). */
export function erwarteGruen(e: PwErgebnis): void {
  expect(e.status, `${e.titel}: ${kurz(e.meldungen.join('\n'))}`).toBe('passed');
}

/** Text ohne ANSI-Farben, höchstens 1500 Zeichen (Meldungen in Assertions). */
export function kurz(text: string): string {
  return text.replace(ANSI, '').slice(0, 1500);
}

/** ESC-Zeichen der ANSI-Farbcodes (zur Laufzeit gebildet). */
export const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

export interface PwLauf {
  status: number | null;
  out: string;
  bericht: string;
}

/**
 * Startet `playwright test` (CLI aus node_modules von `root`) mit JSON-Reporter in eine Datei der Sandbox.
 * Kein Abbruch bei Exit ≠ 0; die Prüfung liegt beim Test. Kindumgebung ohne WAP_E2E_PORT und ohne
 * WAP_PLAYWRIGHT_BERICHT, sofern `env` sie nicht setzt.
 */
export function playwrightLauf(
  sb: Sandbox,
  root: string,
  args: string[],
  opts: { env?: Record<string, string>; name: string; timeout?: number },
): PwLauf {
  const bericht = join(sb.base, `pw-${opts.name}.json`);
  const env: NodeJS.ProcessEnv = { ...sb.env };
  delete env.WAP_E2E_PORT;
  delete env.WAP_PLAYWRIGHT_BERICHT;
  Object.assign(env, opts.env ?? {});
  env.PLAYWRIGHT_JSON_OUTPUT_NAME = bericht;
  const r = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '--reporter=json',
      ...args,
    ],
    {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: opts.timeout ?? KIND_TIMEOUT,
      windowsHide: true,
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  expect(r.status, 'Playwright ohne Exit-Code (Zeitlimit oder Signal)').not.toBeNull();
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, bericht };
}

/**
 * Testnamen aus `playwright test --list --reporter=json` (Titel je Projekt); Liste scheitert → leere Liste.
 * `out` enthält Konsolenausgabe und Bericht (Ladefehler stehen im Bericht unter `errors`).
 */
export function playwrightListe(
  sb: Sandbox,
  root: string,
  args: string[],
  name: string,
): { status: number | null; out: string; tests: { titel: string; projekt: string }[] } {
  const l = playwrightLauf(sb, root, ['--list', ...args], { name });
  if (!existsSync(l.bericht)) return { status: l.status, out: l.out, tests: [] };
  const out = `${l.out}\n${readFileSync(l.bericht, 'utf8')}`;
  const tests = pwErgebnisse(l.bericht).map((e) => ({ titel: e.titel, projekt: e.projekt }));
  return { status: l.status, out, tests };
}

/** Pfad als Repo-Pfad mit «/» (Vergleich von Bericht- und Markenpfaden). */
export function mitSchraegstrich(p: string): string {
  return p.replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------------------------------------
// Synthetisches Repo für runE2e (E1-01c): drei Projekte, Bericht aus WAP_PLAYWRIGHT_BERICHT

/** Fiktive Vite-Konfiguration der E2E (wie e2e-server.gate.ts): eigener Cache aus WAP_VITE_CACHE_DIR. */
export const FIKTIVE_VITE_KONFIG = [
  '// Fiktive Vite-Konfiguration der E2E (Schleusen-Test E1-01c).',
  "const cacheDir = process.env.WAP_VITE_CACHE_DIR ?? '';",
  "if (cacheDir === '') throw new Error('WAP_VITE_CACHE_DIR fehlt (fiktiv)');",
  "export default { cacheDir, logLevel: 'silent' };",
  '',
].join('\n');

export type ProjektName = 'edge' | 'edge-dist' | 'chromium-visual' | 'perf';

const PROJEKT_KONFIG: Record<ProjektName, string> = {
  edge: "    { name: 'edge', testMatch: /\\.spec\\.ts$/, testIgnore: [/\\.dist\\.spec\\.ts$/, /\\.visual\\.spec\\.ts$/] },",
  'edge-dist': "    { name: 'edge-dist', testMatch: /\\.dist\\.spec\\.ts$/ },",
  'chromium-visual':
    "    { name: 'chromium-visual', testMatch: /\\.visual\\.spec\\.ts$/, use: { browserName: 'chromium' } },",
  perf: "    { name: 'perf', testDir: 'tests/wap-perf', testMatch: /\\.perf\\.ts$/, use: { browserName: 'chromium' } },",
};

/**
 * Playwright-Konfiguration des synthetischen Repos: Bericht nach WAP_PLAYWRIGHT_BERICHT (Vorgabe
 * test-results/wap/playwright.json), 2 Worker, keine Wiederholung, die genannten Projekte.
 */
export function pwKonfigC(projekte: ProjektName[]): string {
  return [
    "const bericht = process.env.WAP_PLAYWRIGHT_BERICHT ?? 'test-results/wap/playwright.json';",
    'export default {',
    "  testDir: 'tests/wap-e2e',",
    '  retries: 0,',
    '  forbidOnly: true,',
    '  workers: 2,',
    "  updateSnapshots: 'none',",
    "  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',",
    "  outputDir: 'test-results/wap/playwright-ausgabe',",
    "  reporter: [['json', { outputFile: bericht }]],",
    '  projects: [',
    ...projekte.map((p) => PROJEKT_KONFIG[p]),
    '  ],',
    '};',
    '',
  ].join('\n');
}

/** Ablageort der Probe-Spezifikation je Projekt. */
export function probePfad(projekt: ProjektName, name = 'probe'): string {
  if (projekt === 'perf') return `tests/wap-perf/${name}.perf.ts`;
  if (projekt === 'chromium-visual') return `tests/wap-e2e/${name}.visual.spec.ts`;
  if (projekt === 'edge-dist') return `tests/wap-e2e/${name}.dist.spec.ts`;
  return `tests/wap-e2e/${name}.spec.ts`;
}

/**
 * Probe ohne Browser: hängt je Ausführung eine JSON-Zeile an `marke` an (Projekt, WAP_E2E_PORT,
 * WAP_PLAYWRIGHT_BERICHT, Workerzahl, Wiederholung) und ist grün.
 */
export function probeSpecC(marke: string, titel: string): string {
  return [
    "import { appendFileSync } from 'node:fs';",
    "import { expect, test } from '@playwright/test';",
    '',
    `test(${JSON.stringify(titel)}, async ({}, testInfo) => {`,
    `  appendFileSync(${JSON.stringify(marke)}, JSON.stringify({`,
    '    projekt: testInfo.project.name,',
    "    port: process.env.WAP_E2E_PORT ?? '',",
    "    bericht: process.env.WAP_PLAYWRIGHT_BERICHT ?? '',",
    '    workers: testInfo.config.workers,',
    '    wiederholung: testInfo.repeatEachIndex,',
    "  }) + '\\n');",
    '  expect(1).toBe(1);',
    '});',
    '',
  ].join('\n');
}

export interface Marke {
  projekt: string;
  port: string;
  bericht: string;
  workers: number;
  wiederholung: number;
}

/** Zeilen der Probe-Marke; fehlt die Datei → leere Liste (keine Ausführung). */
export function leseMarken(marke: string): Marke[] {
  if (!existsSync(marke)) return [];
  return readFileSync(marke, 'utf8')
    .split('\n')
    .filter((z) => z.trim() !== '')
    .map((z) => JSON.parse(z) as Marke);
}

/** Fiktiver Einstieg der Leistungs-Harness (ohne Eintragsdateien): meldet «bereit». */
export const FIKTIVER_PERF_EINSTIEG = [
  '// Fiktiver Einstieg der Leistungs-Harness (Schleusen-Test E1-01c).',
  "document.documentElement.dataset.wapPerf = 'bereit';",
  'export {};',
  '',
].join('\n');

/**
 * Synthetisches Repo für runE2e mit den genannten Projekten, je einer Probe pro Projekt, fiktivem
 * Harness-Einstieg der Leistung und Build-Skript (Einzeldateien). Liefert Wurzel und Markenpfad.
 */
export function e2eRepoC(
  sb: Sandbox,
  opts: {
    name: string;
    projekte: ProjektName[];
    proben?: ProjektName[];
    viteKonfig?: boolean;
    perfEinstieg?: string | null;
  },
): { root: string; marke: string } {
  const root = neuesRepo(sb, opts.name);
  const marke = join(sb.base, `${opts.name}-marke.jsonl`);
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-e2e-c', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
  writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
  writeText(root, 'playwright.wap.config.ts', pwKonfigC(opts.projekte));
  for (const p of opts.proben ?? opts.projekte) {
    writeText(root, probePfad(p), probeSpecC(marke, `[R-1-01] Probe ${p}`));
  }
  if (opts.viteKonfig === true) {
    writeText(root, 'tests/wap-e2e/support/vite-e2e.config.ts', FIKTIVE_VITE_KONFIG);
  }
  const einstieg = opts.perfEinstieg === undefined ? FIKTIVER_PERF_EINSTIEG : opts.perfEinstieg;
  if (einstieg !== null) writeText(root, 'tests/wap-perf/harness/index.ts', einstieg);
  nodeModules(root);
  commitAlles(sb, root, 'E2E-Projekt E1-01c');
  return { root, marke };
}

/** details eines runE2e-Schritts (Vertrag E1-01b §2, E1-01c §2.1). */
export interface E2eDetails {
  bericht?: string | null;
  exit?: number | null;
  gestartet?: boolean;
  tests?: number;
  fehlendeBaselines?: string[];
  server?: { pid?: unknown; ende?: unknown; port?: unknown; ms?: unknown };
}

export function e2eDetails(s: Schritt): E2eDetails {
  return (typeof s.details === 'object' && s.details !== null ? s.details : {}) as E2eDetails;
}

// ---------------------------------------------------------------------------------------------------------
// Kernzustände (Registry, Vertrag E1-01c §2.2)

export interface RegistryEintrag {
  id: string;
  paket: string;
  beschreibung: string;
  uhr?: string;
  /** Körper von herstellen(page: Page) als Quelltext. */
  koerper: string;
}

/** Registry-Datei tests/wap-e2e/support/kernzustaende/<paket klein>.ts (fiktiv). */
export function registryDatei(eintraege: RegistryEintrag[]): string {
  return [
    "import { readFileSync, writeFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "import type { Page } from '@playwright/test';",
    "import type { Kernzustand } from '../kernzustand';",
    '',
    'void readFileSync;',
    'void writeFileSync;',
    'void join;',
    '',
    'export const kernzustaende: readonly Kernzustand[] = [',
    ...eintraege.map((e) =>
      [
        '  {',
        `    id: ${JSON.stringify(e.id)},`,
        `    paket: ${JSON.stringify(e.paket)},`,
        `    beschreibung: ${JSON.stringify(e.beschreibung)},`,
        ...(e.uhr === undefined ? [] : [`    uhr: ${JSON.stringify(e.uhr)},`]),
        '    herstellen: async (page: Page): Promise<void> => {',
        e.koerper,
        '    },',
        '  },',
      ].join('\n'),
    ),
    '];',
    '',
  ].join('\n');
}

/** herstellen-Körper: einfarbiges Feld 200×100 auf weissem Grund. */
export function farbfeld(farbe: string): string {
  return `      await page.setContent('<html lang="de"><head><title>Fiktiv</title></head><body style="margin:0;background:#ffffff"><div style="width:200px;height:100px;background:${farbe}"></div></body></html>');`;
}

// ---------------------------------------------------------------------------------------------------------
// Windows: Kurznamen und Edge-Prozesse

const POWERSHELL = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

function powershell(skript: string, env: Record<string, string> = {}): string {
  const r = spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', skript], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    env: { ...process.env, ...env },
  });
  expect(r.status, 'Test-Aufbau: PowerShell scheiterte').toBe(0);
  return r.stdout.trim();
}

/** 8.3-Kurzname eines bestehenden Ordners (Assertion, wenn es keinen eigenen Kurznamen gibt). */
export function kurzname(ordner: string): string {
  const kurz = powershell(
    '(New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:WAP_ZZ_ORDNER).ShortPath',
    { WAP_ZZ_ORDNER: ordner },
  );
  expect(kurz.toLowerCase(), 'Test-Aufbau: Ordner ohne eigenen 8.3-Kurznamen').not.toBe(
    ordner.toLowerCase(),
  );
  return kurz;
}

/** PIDs der Edge-Prozesse, deren Befehlszeile einen der Texte enthält (ohne Gross/Klein). */
export function edgeProzesse(texte: string[]): number[] {
  const roh = powershell(
    [
      '$l = @(Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'" |',
      'ForEach-Object { @{ p = $_.ProcessId; k = [string]$_.CommandLine } });',
      'ConvertTo-Json -Compress -InputObject $l',
    ].join(' '),
  );
  const daten = JSON.parse(roh === '' ? '[]' : roh) as unknown;
  const liste = (Array.isArray(daten) ? daten : [daten]) as { p: number; k: string }[];
  const klein = texte.map((t) => t.toLowerCase());
  return liste.filter((x) => klein.some((t) => x.k.toLowerCase().includes(t))).map((x) => x.p);
}

/**
 * Edge-Prozesse mit einem der Texte, nachgeprüft bis `fristMs` im 250-ms-Takt (TR-E101c-10 a): Ein Hilfsprozess
 * kann kurz nach `close()` nachlaufen. Liefert die zuletzt gefundenen PIDs (leer = keiner mehr).
 */
export function edgeProzesseNachFrist(texte: string[], fristMs = 5_000): number[] {
  const ende = Date.now() + fristMs;
  const halt = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    const pids = edgeProzesse(texte);
    if (pids.length === 0 || Date.now() >= ende) return pids;
    Atomics.wait(halt, 0, 0, 250);
  }
}

export interface ZaehlServer {
  port: number;
  /** Ereignisse am Server: TCP-Verbindungen, HTTP-Anfragen, Upgrade-Versuche (WebSocket). */
  zaehlung(): { verbindungen: number; anfragen: number; upgrades: number };
  beenden(): void;
}

/**
 * Lokaler Zähl-Server auf 127.0.0.1 mit freiem Port in einem eigenen Node-Prozess (TR-E101c-01): zählt jede
 * Verbindung, Anfrage und jeden Upgrade-Versuch in einer Datei der Sandbox. Eigener Prozess, damit er auch
 * antwortet, während der Testprozess auf einen Kindlauf wartet. Nur fiktive Antworten.
 */
/** Höchstlaufzeit des Zähl-Servers: Zeitlimit des Offline-Tests (LANG, 900 s) plus 60 s Reserve. */
const ZAEHL_SERVER_HOECHST_MS = 960_000;

export async function zaehlServer(sb: Sandbox): Promise<ZaehlServer> {
  const log = join(sb.base, 'zaehl-server.log');
  const portDatei = join(sb.base, 'zaehl-server.port');
  const skript = writeText(
    sb.base,
    'zaehl-server.mjs',
    [
      "import { appendFileSync, writeFileSync } from 'node:fs';",
      "import { createServer } from 'node:http';",
      `const log = ${JSON.stringify(log)};`,
      "const s = createServer((_req, res) => { appendFileSync(log, 'anfrage\\n'); res.end('erreicht'); });",
      "s.on('connection', () => appendFileSync(log, 'verbindung\\n'));",
      "s.on('upgrade', (_req, sock) => { appendFileSync(log, 'upgrade\\n'); sock.destroy(); });",
      `s.listen(0, '127.0.0.1', () => writeFileSync(${JSON.stringify(portDatei)}, String(s.address().port)));`,
      // Selbstbeendigung (TR-E101c-12): nach der Höchstlaufzeit und sobald der Testprozess nicht mehr lebt
      // (Prüfung alle 2 s über process.kill(pid, 0), ohne Netzverbindung). Kein Waisenprozess.
      `const HOECHST_MS = ${String(ZAEHL_SERVER_HOECHST_MS)};`,
      'const eltern = Number(process.argv[2]);',
      'setTimeout(() => process.exit(0), HOECHST_MS);',
      'setInterval(() => { try { process.kill(eltern, 0); } catch { process.exit(0); } }, 2000);',
      '',
    ].join('\n'),
  );
  const kind = spawn(process.execPath, [skript, String(process.pid)], {
    stdio: 'ignore',
    windowsHide: true,
  });
  const beenden = () => {
    if (kind.exitCode === null && kind.signalCode === null) kind.kill();
  };
  const ende = Date.now() + 20_000;
  let port = 0;
  while (port === 0 && Date.now() < ende) {
    if (existsSync(portDatei)) port = Number(readFileSync(portDatei, 'utf8')) || 0;
    if (port === 0) await new Promise((res) => setTimeout(res, 50));
  }
  if (port === 0) beenden();
  expect(port, 'Test-Aufbau: Zähl-Server nicht bereit').toBeGreaterThan(0);
  return {
    port,
    zaehlung: () => {
      const zeilen = existsSync(log) ? readFileSync(log, 'utf8').split('\n') : [];
      const n = (art: string) => zeilen.filter((z) => z === art).length;
      return { verbindungen: n('verbindung'), anfragen: n('anfrage'), upgrades: n('upgrade') };
    },
    beenden,
  };
}

/** Beendet Edge-Prozesse unter `ordner` (Aufräumen nach einem roten Lauf; nur gezielt per PID). */
export function beendeEdgeUnter(ordner: string): void {
  for (const pid of edgeProzesse([ordner])) {
    spawnSync('taskkill.exe', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  }
}

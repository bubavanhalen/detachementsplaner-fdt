// Läufer runE2e ab E1-01c (ADR-010 §3.2 V4/V6/V7, §8, §10; R-H-21, R-H-22): Tabelle je Projekt (Schritt-ID,
// Bericht, Worker, Server und WAP_E2E_PORT, Vorbereitung), funktionale Projekte ohne chromium-visual und perf,
// eigener Bericht je Projektgruppe über WAP_PLAYWRIGHT_BERICHT, repeatEach, fehlendes Playwright-Chromium, CLI
// mit Sperre und Baseline-Befehl ohne chromium-visual.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.1, §2.2 «Baseline-Befehl», §3 (e2e-c.gate.ts).
// Synthetische Repos mit eigener Playwright-Konfiguration (drei Projekte, Bericht aus WAP_PLAYWRIGHT_BERICHT) und
// Probe-Tests ohne Browser; der fiktive Harness-Einstieg der Leistung hat keine Eintragsdateien. Nur fiktive
// Inhalte; die Sperre des synthetischen Repos liegt unter dessen eigenem .git.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { schreibeSperre, wartenderProzess } from './support/last';
import {
  aufraeumen,
  KURZ,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { harnessEinstieg } from './support/vertrag-b';
import {
  e2eC,
  e2eDetails,
  e2eRepoC,
  leseMarken,
  mitSchraegstrich,
  type ProjektName,
} from './support/vertrag-c';

afterEach(aufraeumen);

const BERICHT = {
  funktional: 'test-results/wap/playwright.json',
  visual: 'test-results/wap/playwright-visual.json',
  perf: 'test-results/wap/playwright-perf.json',
} as const;

const DREI: ProjektName[] = ['edge', 'chromium-visual', 'perf'];

function repo(
  sb: Sandbox,
  name: string,
  opts: { projekte?: ProjektName[]; viteKonfig?: boolean; perfEinstieg?: string | null } = {},
) {
  prozessUmgebung(sb);
  return e2eRepoC(sb, {
    name,
    projekte: opts.projekte ?? DREI,
    ...(opts.viteKonfig === undefined ? {} : { viteKonfig: opts.viteKonfig }),
    ...(opts.perfEinstieg === undefined ? {} : { perfEinstieg: opts.perfEinstieg }),
  });
}

function abs(root: string, rel: string): string {
  return join(root, ...rel.split('/'));
}

describe('runE2e: Tabelle §2.1 je Projekt', () => {
  it(
    '[R-H-21][R-H-11] chromium-visual: Schritt V6-visual, Bericht playwright-visual.json, 2 Worker, Server und WAP_E2E_PORT, Einzeldateien gebaut; details.tests',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'tab-visual', { viteKonfig: true });
      writeText(root, 'tests/wap-e2e/harness/zz-probe.tsx', harnessEinstieg('Fiktive Probe'));
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(r.id).toBe('V6-visual');
      expect(r.ok, schrittText(r)).toBe(true);
      const d = e2eDetails(r);
      expect(d.bericht).toBe(BERICHT.visual);
      expect(existsSync(abs(root, BERICHT.visual))).toBe(true);
      expect(existsSync(abs(root, BERICHT.funktional)), 'Bericht von V4 geschrieben').toBe(false);
      expect(d.tests).toBe(1);
      const m = leseMarken(marke);
      expect(m.map((x) => x.projekt)).toEqual(['chromium-visual']);
      expect(m[0]?.workers).toBe(2);
      expect(m[0]?.port).toBe(String(r.port));
      expect(mitSchraegstrich(m[0]?.bericht ?? '')).toBe(BERICHT.visual);
      expect(d.server, 'Server gestartet (details.server)').toBeDefined();
      expect(
        existsSync(join(root, 'test-results', 'wap', 'einzeldatei', 'zz-probe.html')),
        'Einzeldatei nicht gebaut',
      ).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-22][R-H-11] perf: Schritt V7-perf, Bericht playwright-perf.json, 1 Worker, ohne Server und ohne WAP_E2E_PORT; perf.json vorher gelöscht, Harness nach test-results/wap/perf-harness gebaut',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'tab-perf', { viteKonfig: true });
      const altePerf = writeText(root, 'test-results/wap/perf.json', '{"messwerte":{}}\n');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'perf' });
      expect(r.id).toBe('V7-perf');
      expect(r.ok, schrittText(r)).toBe(true);
      const d = e2eDetails(r);
      expect(d.bericht).toBe(BERICHT.perf);
      expect(existsSync(abs(root, BERICHT.perf))).toBe(true);
      expect(d.tests).toBe(1);
      const m = leseMarken(marke);
      expect(m.map((x) => x.projekt)).toEqual(['perf']);
      expect(m[0]?.workers).toBe(1);
      expect(m[0]?.port, 'WAP_E2E_PORT im Projekt perf').toBe('');
      expect(mitSchraegstrich(m[0]?.bericht ?? '')).toBe(BERICHT.perf);
      expect(d.server ?? null, 'Server im Projekt perf').toBeNull();
      expect(existsSync(altePerf), 'alte perf.json nicht gelöscht').toBe(false);
      expect(
        existsSync(join(root, 'test-results', 'wap', 'perf-harness', 'index.html')),
        'Leistungs-Harness nicht gebaut',
      ).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-22][R-H-11] perf: Bau der Harness rot (Syntaxfehler im Einstieg) → rot, Playwright startet nicht, kein Bericht',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'tab-perf-rot', { perfEinstieg: 'export const = ;\n' });
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'perf' });
      expect(r.id).toBe('V7-perf');
      expect(r.ok).toBe(false);
      expect((r.ursache ?? '').length).toBeGreaterThan(0);
      expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
      expect(existsSync(abs(root, BERICHT.perf))).toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-22][R-H-11] edge: Schritt V4-e2e, Bericht playwright.json über WAP_PLAYWRIGHT_BERICHT, 2 Worker, WAP_E2E_PORT gesetzt',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'tab-edge');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.id).toBe('V4-e2e');
      expect(r.ok, schrittText(r)).toBe(true);
      expect(e2eDetails(r).bericht).toBe(BERICHT.funktional);
      expect(e2eDetails(r).tests).toBe(1);
      const m = leseMarken(marke);
      expect(m.map((x) => x.projekt)).toEqual(['edge']);
      expect(m[0]?.workers).toBe(2);
      expect(m[0]?.port).toBe(String(r.port));
      expect(mitSchraegstrich(m[0]?.bericht ?? '')).toBe(BERICHT.funktional);
    },
    MITTEL,
  );
});

describe('runE2e: funktionale Projekte (CR-E101c-V04)', () => {
  it(
    '[R-H-21][R-H-22][R-H-11] Konfiguration mit edge, chromium-visual und perf, project leer → nur edge läuft (V4-e2e)',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'nur-edge');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root });
      expect(r.id).toBe('V4-e2e');
      expect(r.ok, schrittText(r)).toBe(true);
      expect(leseMarken(marke).map((x) => x.projekt)).toEqual(['edge']);
      expect(existsSync(abs(root, BERICHT.visual))).toBe(false);
      expect(existsSync(abs(root, BERICHT.perf))).toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Konfiguration nur mit edge und edge-dist, project leer → beide laufen wie bisher (E1-01b), Bericht playwright.json',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'nur-funktional', { projekte: ['edge', 'edge-dist'] });
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(
        leseMarken(marke)
          .map((x) => x.projekt)
          .sort(),
      ).toEqual(['edge', 'edge-dist']);
      expect(existsSync(abs(root, BERICHT.funktional))).toBe(true);
    },
    MITTEL,
  );
});

describe('runE2e: Berichte je Projektgruppe (§2.1)', () => {
  it(
    '[R-H-21][R-H-22][R-H-11] Bericht von V4 bleibt nach V6 und V7 unverändert erhalten; jede Zeile löscht nur ihren eigenen Bericht',
    async () => {
      const sb = neueSandbox();
      const { root } = repo(sb, 'berichte');
      const { runE2e } = await e2eC();
      const v4 = await runE2e({ cwd: root });
      expect(v4.ok, schrittText(v4)).toBe(true);
      const vorher = readFileSync(abs(root, BERICHT.funktional), 'utf8');
      const v6 = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(v6.ok, schrittText(v6)).toBe(true);
      const v7 = await runE2e({ cwd: root, project: 'perf' });
      expect(v7.ok, schrittText(v7)).toBe(true);
      expect(existsSync(abs(root, BERICHT.funktional)), 'Bericht von V4 gelöscht').toBe(true);
      expect(readFileSync(abs(root, BERICHT.funktional), 'utf8')).toBe(vorher);
      expect(existsSync(abs(root, BERICHT.visual))).toBe(true);
      expect(existsSync(abs(root, BERICHT.perf))).toBe(true);
      // Ein alter Bericht der eigenen Zeile wird als erste Handlung gelöscht (präzisiert CR-E101b-04).
      writeText(root, BERICHT.visual, '{"suites":[],"fiktiv":"alt"}\n');
      const rot = await runE2e({ cwd: root, project: 'chromium-visual', repeatEach: 1 });
      expect(rot.ok).toBe(false);
      expect(existsSync(abs(root, BERICHT.visual)), 'alter Bericht von V6 liegt noch').toBe(false);
      expect(existsSync(abs(root, BERICHT.perf)), 'fremder Bericht gelöscht').toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-22][R-H-11] geerbtes WAP_PLAYWRIGHT_BERICHT wird überschrieben: Bericht unter playwright.json, kein fremder Bericht',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'geerbt');
      vi.stubEnv('WAP_PLAYWRIGHT_BERICHT', 'test-results/wap/fremd-fiktiv.json');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(abs(root, BERICHT.funktional))).toBe(true);
      expect(existsSync(abs(root, 'test-results/wap/fremd-fiktiv.json'))).toBe(false);
      expect(mitSchraegstrich(leseMarken(marke)[0]?.bericht ?? '')).toBe(BERICHT.funktional);
    },
    MITTEL,
  );
});

describe('runE2e: repeatEach (§2.1)', () => {
  it.each([
    ['1', 1],
    ['2,5', 2.5],
    ['11', 11],
  ])(
    '[R-H-21][R-H-11] repeatEach %s → rot «repeatEach ungültig», ohne Start',
    async (_t, wert) => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'wiederholung-rot');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'chromium-visual', repeatEach: wert });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('repeatEach ungültig');
      expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-11] repeatEach 2 bzw. 10 → --repeat-each: der Test läuft 2- bzw. 10-mal',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'wiederholung');
      const { runE2e } = await e2eC();
      const r2 = await runE2e({ cwd: root, project: 'chromium-visual', repeatEach: 2 });
      expect(r2.ok, schrittText(r2)).toBe(true);
      expect(
        leseMarken(marke)
          .map((x) => x.wiederholung)
          .sort((a, b) => a - b),
      ).toEqual([0, 1]);
      const r10 = await runE2e({ cwd: root, project: 'edge', repeatEach: 10 });
      expect(r10.ok, schrittText(r10)).toBe(true);
      const edge = leseMarken(marke).filter((x) => x.projekt === 'edge');
      expect(edge.map((x) => x.wiederholung).sort((a, b) => a - b)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    },
    MITTEL,
  );

  it(
    '[R-H-22][R-H-11] repeatEach mit perf → rot «Wiederholung im Projekt perf nicht zulässig», ohne Start',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'wiederholung-perf');
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'perf', repeatEach: 3 });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('Wiederholung im Projekt perf nicht zulässig');
      expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
    },
    MITTEL,
  );
});

/** runE2e in einem frischen Node-Prozess (eigene Umgebung, z.B. PLAYWRIGHT_BROWSERS_PATH); liefert den Schritt. */
function runE2eImKind(
  sb: Sandbox,
  root: string,
  project: string,
  env: Record<string, string>,
): { ok?: boolean; ursache?: string; fehler?: string } {
  const url = pathToFileURL(join(WT, 'scripts', 'wap-gate', 'e2e.mjs')).href;
  const skript = writeText(
    sb.base,
    `kind-e2e-${project}.mjs`,
    [
      'try {',
      `  const { runE2e } = await import(${JSON.stringify(url)});`,
      `  const r = await runE2e({ cwd: ${JSON.stringify(root)}, project: ${JSON.stringify(project)} });`,
      "  process.stdout.write(JSON.stringify({ ok: r.ok, ursache: r.ursache ?? '' }) + '\\n');",
      '} catch (e) {',
      "  process.stdout.write(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }) + '\\n');",
      '}',
      '',
    ].join('\n'),
  );
  const kindEnv: NodeJS.ProcessEnv = { ...sb.env, ...env };
  delete kindEnv.WAP_GATE_SPERRE;
  const r = spawnSync(process.execPath, [skript], {
    cwd: root,
    env: kindEnv,
    encoding: 'utf8',
    timeout: MITTEL,
    windowsHide: true,
  });
  const zeile = r.stdout.split(/\r?\n/).find((z) => z.startsWith('{'));
  expect(zeile, `Kindprozess ohne Ergebnis (Exit ${String(r.status)})`).toBeDefined();
  return JSON.parse(zeile as string) as { ok?: boolean; ursache?: string; fehler?: string };
}

describe('runE2e: Playwright-Chromium fehlt (V16)', () => {
  it.each(['chromium-visual', 'perf'])(
    '[R-H-21][R-H-22][R-H-11] %s mit leerem PLAYWRIGHT_BROWSERS_PATH (Testsubstitut) → rot «Playwright-Chromium fehlt: npx playwright install chromium (Orchestrator)», ohne Start, kein Rückfall auf Edge',
    (projekt) => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, `ohne-chromium-${projekt}`);
      const leer = join(sb.base, 'browser-leer');
      mkdirSync(leer, { recursive: true });
      const r = runE2eImKind(sb, root, projekt, { PLAYWRIGHT_BROWSERS_PATH: leer });
      if (r.fehler !== undefined) throw new Error(r.fehler);
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain(
        'Playwright-Chromium fehlt: npx playwright install chromium (Orchestrator)',
      );
      expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
      expect(readdirSync(leer), 'Browser installiert').toEqual([]);
    },
    MITTEL,
  );
});

/** Ruft die CLI scripts/wap-gate/e2e.mjs im synthetischen Repo auf (ohne geerbte Sperre). */
function e2eCli(sb: Sandbox, root: string, args: string[]): { status: number | null; out: string } {
  const env: NodeJS.ProcessEnv = { ...sb.env };
  delete env.WAP_GATE_SPERRE;
  const r = spawnSync(process.execPath, [join(WT, 'scripts', 'wap-gate', 'e2e.mjs'), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: MITTEL,
    windowsHide: true,
  });
  expect(r.status, 'CLI ohne Exit-Code (Zeitlimit oder Signal)').not.toBeNull();
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Belegt die Sperre des synthetischen Repos durch einen lebenden, fremden Halter. */
function fremdeSperre(root: string): { beenden(): void } {
  const halter = wartenderProzess();
  expect(halter.pid, 'Test-Aufbau: Halter ohne PID').toBeGreaterThan(0);
  schreibeSperre(join(root, '.git'), {
    pid: halter.pid as number,
    erstellt: new Date(Date.now() - 60_000).toISOString(),
    modus: 'full',
    worktree: 'C:\\fiktiv\\wap-wt\\anderes-paket',
    start: new Date(Date.now() + 60_000).toISOString(),
    token: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
  });
  return { beenden: () => halter.kill() };
}

describe('e2e.mjs als CLI: Sperre und Baseline-Befehl (§2.1, §2.2)', () => {
  it(
    '[R-H-22][R-H-18] --project perf bei belegter Sperre → Exit 1 «Sperre belegt», ohne Start',
    () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'cli-perf');
      const sperre = fremdeSperre(root);
      try {
        const r = e2eCli(sb, root, ['--project', 'perf']);
        expect(r.status).toBe(1);
        expect(r.out).toContain('Sperre belegt');
        expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
        expect(existsSync(abs(root, BERICHT.perf))).toBe(false);
      } finally {
        sperre.beenden();
      }
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-18] --project chromium-visual --baselines E1-01 bei belegter Sperre → Exit 1 «Sperre belegt», ohne Start, nichts geschrieben',
    () => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'cli-baselines');
      const sperre = fremdeSperre(root);
      try {
        const r = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01']);
        expect(r.status).toBe(1);
        expect(r.out).toContain('Sperre belegt');
        expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
        expect(existsSync(join(root, 'tests', 'wap-e2e', '__screenshots__'))).toBe(false);
      } finally {
        sperre.beenden();
      }
    },
    MITTEL,
  );

  it.each([
    ['ohne --project', ['--baselines', 'E1-01']],
    ['mit --project edge', ['--project', 'edge', '--baselines', 'E1-01']],
  ])(
    '[R-H-21][R-H-11] --baselines %s → Exit 1 mit Hinweis auf chromium-visual, ohne Start',
    (_f, args) => {
      const sb = neueSandbox();
      const { root, marke } = repo(sb, 'cli-ohne-visual');
      const r = e2eCli(sb, root, args);
      expect(r.status).toBe(1);
      expect(r.out).toContain('chromium-visual');
      expect(leseMarken(marke), 'Playwright gestartet').toEqual([]);
    },
    KURZ,
  );
});

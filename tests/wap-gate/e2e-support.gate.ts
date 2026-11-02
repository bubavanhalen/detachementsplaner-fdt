// E2E-Läufer (ADR-010 §3.2 V4, §10 «Ports und Parallelität»; R-H-11): freier Port in WAP_E2E_PORT,
// playwright test -c playwright.wap.config.ts --workers=2 --pass-with-no-tests; Artefaktpfad
// WAP_PDF_ARTEFAKTE; Harness-Einzeldateien für edge-dist vor dem Start; grün nur bei Exit 0 mit Bericht.
// Die Läufe mit Edge stehen in e2e-grundlauf.selbsttest.ts (Vertrag E1-01 §9 Nr 17).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (runE2e); E1-01 §2, §9 Nr 16.
// Übernommen aus dem Entwurf e2e-support.gate.entwurf.ts (Vertrag E1-01b §3). Synthetische Repos mit eigener
// Playwright-Konfiguration; die Probe-Tests brauchen keinen Browser.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  LANG,
  MITTEL,
  neueSandbox,
  node,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { e2e } from './support/vertrag';
import {
  e2eRepo,
  harnessEinstieg,
  leseMarke,
  PW_KONFIG_OHNE_BERICHT,
  playwrightTests,
  probeSpec,
} from './support/vertrag-b';

afterEach(aufraeumen);

/** Synthetisches Repo mit einer Probe-Spezifikation; liefert Wurzel und Pfad der Marke. */
function mitProbe(
  sb: Sandbox,
  opts: { gruen?: boolean; konfig?: string | null; mitNodeModules?: boolean } = {},
): { root: string; marke: string } {
  prozessUmgebung(sb);
  const marke = join(sb.base, 'marke.json');
  const root = e2eRepo(sb, {
    ...(opts.konfig === undefined ? {} : { konfig: opts.konfig }),
    ...(opts.mitNodeModules === undefined ? {} : { mitNodeModules: opts.mitNodeModules }),
  });
  writeText(root, 'tests/wap-e2e/probe.spec.ts', probeSpec(marke, opts.gruen ?? true));
  commitAlles(sb, root, 'Probe');
  return { root, marke };
}

const BERICHT = ['test-results', 'wap', 'playwright.json'];

describe('runE2e: Start, Umgebung, Bericht', () => {
  it(
    '[R-H-11] grüner Test → Schritt V4-e2e grün; WAP_E2E_PORT = port, --workers=2, WAP_PDF_ARTEFAKTE = <cwd>/test-results/wap/pdf, ohne VITEST-Variablen; Bericht playwright.json',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = mitProbe(sb);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.id).toBe('V4-e2e');
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.port).toBeGreaterThan(0);
      const m = leseMarke(marke);
      expect(m, 'Probe-Test lief nicht').not.toBeNull();
      expect(m?.port).toBe(String(r.port));
      expect(m?.workers).toBe(2);
      expect(resolve(m?.artefakte ?? '').toLowerCase()).toBe(
        join(root, 'test-results', 'wap', 'pdf').toLowerCase(),
      );
      expect(m?.vitest).toEqual([]);
      const tests = playwrightTests(join(root, ...BERICHT));
      expect(tests.map((t) => `${t.projekt}: ${t.status}`)).toEqual(['edge: passed']);
    },
    MITTEL,
  );

  it(
    '[R-H-11] roter Test → roter Schritt mit Ursache und nächstem Schritt',
    async () => {
      const sb = neueSandbox();
      const { root } = mitProbe(sb, { gruen: false });
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok).toBe(false);
      expect((r.ursache ?? '').length).toBeGreaterThan(0);
      expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
    },
    MITTEL,
  );

  it(
    '[R-H-11] keine Spezifikation → grün (--pass-with-no-tests)',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = e2eRepo(sb);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok, schrittText(r)).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Konfiguration ohne JSON-Bericht: Exit 0, aber kein playwright.json → rot',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = mitProbe(sb, { konfig: PW_KONFIG_OHNE_BERICHT });
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(leseMarke(marke), 'Probe-Test lief nicht').not.toBeNull();
      expect(existsSync(join(root, ...BERICHT))).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('playwright.json');
    },
    MITTEL,
  );

  it(
    '[R-H-11] playwright.wap.config.ts fehlt → rot mit Ursache, Playwright startet nicht',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = mitProbe(sb, { konfig: null });
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('playwright.wap.config.ts');
      expect(leseMarke(marke)).toBeNull();
    },
    MITTEL,
  );

  it(
    '[R-H-11] @playwright/test fehlt (kein node_modules) → rot mit Ursache, kein Start',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = mitProbe(sb, { mitNodeModules: false });
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('@playwright/test');
      expect(leseMarke(marke)).toBeNull();
    },
    MITTEL,
  );
});

describe('runE2e: Harness-Einzeldateien für edge-dist', () => {
  function harnessRepo(sb: Sandbox, kaputt: boolean): { root: string; marke: string } {
    const x = mitProbe(sb);
    writeText(x.root, 'tests/wap-e2e/harness/probe.tsx', harnessEinstieg('Harness-Probe bereit'));
    if (kaputt) {
      writeText(x.root, 'tests/wap-e2e/harness/kaputt.tsx', 'export const = ;\n');
    }
    writeText(
      x.root,
      'test-results/wap/einzeldatei/alt.html',
      '<!doctype html><title>alt</title>\n',
    );
    return x;
  }

  const einzeldatei = (root: string, name: string) =>
    join(root, 'test-results', 'wap', 'einzeldatei', name);

  it(
    '[R-H-11] project edge-dist: Ordner geleert, jede harness/*.tsx gebaut, dann Playwright',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = harnessRepo(sb, false);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge-dist' });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(einzeldatei(root, 'alt.html'))).toBe(false);
      expect(readFileSync(einzeldatei(root, 'probe.html'), 'utf8')).toContain(
        'Harness-Probe bereit',
      );
      expect(leseMarke(marke)).not.toBeNull();
    },
    MITTEL,
  );

  it(
    '[R-H-11] ohne project: ebenfalls geleert und gebaut',
    async () => {
      const sb = neueSandbox();
      const { root } = harnessRepo(sb, false);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(einzeldatei(root, 'alt.html'))).toBe(false);
      expect(existsSync(einzeldatei(root, 'probe.html'))).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-11] project edge: kein Bau, Ordner unverändert',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = harnessRepo(sb, false);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root, project: 'edge' });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(leseMarke(marke)).not.toBeNull();
      expect(existsSync(einzeldatei(root, 'alt.html'))).toBe(true);
      expect(existsSync(einzeldatei(root, 'probe.html'))).toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] roter Bau einer Harness-Datei → Schritt rot mit Dateiname, Playwright startet nicht',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = harnessRepo(sb, true);
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: root });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('kaputt');
      expect(leseMarke(marke), 'Playwright lief trotz rotem Bau').toBeNull();
    },
    MITTEL,
  );
});

describe('e2e.mjs als CLI', () => {
  it(
    '[R-H-11] --project edge im Repo: Exit 0 bei grünem, Exit 1 bei rotem Test',
    () => {
      const sb = neueSandbox();
      const cli = join(WT, 'scripts', 'wap-gate', 'e2e.mjs');
      const gruen = mitProbe(sb);
      const a = node(cli, ['--project', 'edge'], {
        cwd: gruen.root,
        env: sb.env,
        timeout: MITTEL,
      });
      expect(a.status, a.out).toBe(0);
      expect(leseMarke(gruen.marke)).not.toBeNull();
      const sb2 = neueSandbox();
      const rot = mitProbe(sb2, { gruen: false });
      const b = node(cli, ['--project', 'edge'], {
        cwd: rot.root,
        env: sb2.env,
        timeout: MITTEL,
      });
      expect(b.status).toBe(1);
    },
    LANG,
  );
});

describe('einzeldateiUrl (Fixtures, Projekt edge-dist)', () => {
  it('[R-H-11] nicht gebaute Einzeldatei → Fehler «Einzeldatei fehlt: <name>.html»', async () => {
    const { einzeldateiUrl } = await import('../wap-e2e/support/fixtures');
    const name = `zz-nicht-gebaut-${String(process.pid)}`;
    expect(() => einzeldateiUrl(name)).toThrow(`Einzeldatei fehlt: ${name}.html`);
  });
});

describe('Fixture port (WAP_E2E_PORT; TR-E101b-03, ohne Browser)', () => {
  /** Synthetisches Repo mit einer Spezifikation, die nur die Worker-Fixture port der WAP-Fixtures nutzt. */
  function portRepo(sb: Sandbox): { root: string; marke: string } {
    prozessUmgebung(sb);
    const marke = join(sb.base, 'port.json');
    const root = e2eRepo(sb, { name: 'port' });
    const fixtures = pathToFileURL(join(WT, 'tests', 'wap-e2e', 'support', 'fixtures.ts')).href;
    writeText(
      root,
      'tests/wap-e2e/port.spec.ts',
      [
        "import { writeFileSync } from 'node:fs';",
        "import { expect } from '@playwright/test';",
        `import { test } from ${JSON.stringify(fixtures)};`,
        '',
        "test('[R-1-01] port aus der Fixture', async ({ port }) => {",
        `  writeFileSync(${JSON.stringify(marke)}, JSON.stringify({ port }));`,
        '  expect(port).toBeGreaterThan(0);',
        '});',
        '',
      ].join('\n'),
    );
    commitAlles(sb, root, 'Port-Spezifikation');
    return { root, marke };
  }

  function playwright(sb: Sandbox, root: string, port: string | undefined) {
    const env: NodeJS.ProcessEnv = { ...sb.env };
    delete env.WAP_E2E_PORT;
    if (port !== undefined) env.WAP_E2E_PORT = port;
    node(
      join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      ['test', '-c', 'playwright.wap.config.ts', '--project', 'edge'],
      { cwd: root, env, timeout: MITTEL },
    );
    const tests = playwrightTests(join(root, 'test-results', 'wap', 'playwright.json'));
    expect(tests, 'genau ein Test im Bericht').toHaveLength(1);
    return tests[0] as NonNullable<(typeof tests)[0]>;
  }

  it(
    '[R-H-11] mit WAP_E2E_PORT → port = Wert der Variable',
    async () => {
      const sb = neueSandbox();
      const { root, marke } = portRepo(sb);
      const t = playwright(sb, root, '43217');
      expect(leseMarke(marke)?.port, t.fehler).toBe(43217);
      expect(t.status).toBe('passed');
    },
    MITTEL,
  );

  it(
    '[R-H-11] ohne WAP_E2E_PORT → Test rot mit «WAP_E2E_PORT fehlt: E2E nur über npm run wap:test:e2e»',
    async () => {
      const sb = neueSandbox();
      const { root } = portRepo(sb);
      const t = playwright(sb, root, undefined);
      expect(t.status).not.toBe('passed');
      expect(t.fehler).toContain('WAP_E2E_PORT fehlt: E2E nur über npm run wap:test:e2e');
    },
    MITTEL,
  );
});

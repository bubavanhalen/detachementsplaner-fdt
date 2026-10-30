// Lese-Schutz der Einzeldatei: Workspace-Markierungen in Vorfahren-Ordnern (Nachtrag-Tests W1–W3; R-H-11).
// Vite 8.3.0 liest beim Bau in jedem Vorfahren von cwd package.json, deno.json und deno.jsonc (Suche nach dem
// Workspace-Root). Zulässig sind deshalb zusätzlich nur diese Markierungsdateien (dazu pnpm-workspace.yaml und
// lerna.json), und nur direkt in einem echten Vorfahren-Ordner von realpath(cwd) bzw. resolve(cwd); sie kommen
// nie in «zulaessig». Jeder andere Zugriff ausserhalb der Wurzeln bleibt «Datei ausserhalb der erlaubten
// Wurzeln beim Bau gelesen».
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Lese-Schutz Workspace-Markierungen
// (05.10.2026, architect)» Nr 1–5; Ergänzung nach Test-Review CR1 Nr 2. Eigene Datei, weil
// einzeldatei-leseschutz.gate.ts gesperrt ist. Verschachtelter fiktiver Aufbau <sandbox>/aussen/mitte/repo = cwd;
// Sperrliste fiktiv (WAP_REFERENCE_DIR).
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  junction,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { einzeldateiModul, einzeldateiRepo } from './support/vertrag-b';
import { pruefeLesezugriffeFn } from './support/vertrag-b-cr1';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const AUSSERHALB = 'Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen';
const AUS = 'test-results/wap/einzeldatei/workspace.html';
const EINSTIEG = 'src/probe/main.tsx';
const PAKET = (name: string, extra: Record<string, unknown> = {}) =>
  `${JSON.stringify({ name, private: true, ...extra }, null, 2)}\n`;

/** Repo (einzeldateiRepo) als cwd unter <sandbox>/<pfad>, mit einem einfachen Einstieg. */
function bauRepo(sb: Sandbox, pfad: string): string {
  prozessUmgebung(sb);
  const root = einzeldateiRepo(sb, pfad);
  writeText(
    root,
    EINSTIEG,
    "const root = document.getElementById('root');\nif (root !== null) root.textContent = 'Workspace-Probe';\nexport {};\n",
  );
  return root;
}

async function baue(root: string) {
  const { buildEinzeldatei } = await einzeldateiModul();
  return buildEinzeldatei({
    cwd: root,
    entry: join(root, EINSTIEG),
    outFile: join(root, ...AUS.split('/')),
    titel: 'Workspace-Probe',
  });
}

/** Grüner Bau: Ausgabe geschrieben, keine Markierungsdatei unter den Modulen. */
function erwarteGruen(r: Awaited<ReturnType<typeof baue>>, root: string): void {
  expect(r.ok, schrittText(r)).toBe(true);
  expect(existsSync(join(root, ...AUS.split('/'))), 'Ausgabe fehlt').toBe(true);
  for (const m of r.module) {
    expect(m, m).not.toMatch(
      /(?:^|\/)(?:package\.json|deno\.jsonc?|pnpm-workspace\.yaml|lerna\.json)$/,
    );
  }
}

describe('buildEinzeldatei mit Workspace-Markierungen über cwd (W1)', () => {
  it(
    '[R-H-11] W1 aussen/package.json (ohne workspaces) und aussen/mitte/package.json über dem Bau-Ordner → grün',
    async () => {
      const sb = neueSandbox();
      writeText(sb.base, 'aussen/package.json', PAKET('fiktiv-aussen'));
      writeText(sb.base, 'aussen/mitte/package.json', PAKET('fiktiv-mitte'));
      const root = bauRepo(sb, 'aussen/mitte/repo');
      erwarteGruen(await baue(root), root);
    },
    MITTEL,
  );

  it(
    '[R-H-11] W1 aussen/package.json mit "workspaces" über dem Bau-Ordner → grün',
    async () => {
      const sb = neueSandbox();
      writeText(
        sb.base,
        'aussen/package.json',
        PAKET('fiktiv-workspace', { workspaces: ['mitte/*'] }),
      );
      const root = bauRepo(sb, 'aussen/mitte/repo');
      erwarteGruen(await baue(root), root);
    },
    MITTEL,
  );

  it(
    '[R-H-11] W1 aussen/deno.json und aussen/mitte/deno.jsonc über dem Bau-Ordner → grün',
    async () => {
      const sb = neueSandbox();
      writeText(sb.base, 'aussen/deno.json', '{ "tasks": {} }\n');
      writeText(sb.base, 'aussen/mitte/deno.jsonc', '// fiktiv\n{ "tasks": {} }\n');
      const root = bauRepo(sb, 'aussen/mitte/repo');
      erwarteGruen(await baue(root), root);
    },
    MITTEL,
  );
});

/** Verschachtelter Aufbau für pruefeLesezugriffe: cwd = <sandbox>/aussen/mitte/repo, Werkzeug-node_modules daneben. */
function aufbau(sb: Sandbox): { cwd: string; werkzeug: string } {
  prozessUmgebung(sb);
  const cwd = join(sb.base, 'aussen', 'mitte', 'repo');
  const werkzeug = join(sb.base, 'werkzeug', 'node_modules');
  mkdirSync(cwd, { recursive: true });
  mkdirSync(werkzeug, { recursive: true });
  return { cwd, werkzeug };
}

describe('pruefeLesezugriffe: Workspace-Markierungen (W2)', () => {
  it('[R-H-11] W2 Markierungen direkt in Vorfahren von cwd (package.json, deno.json, deno.jsonc, pnpm-workspace.yaml, lerna.json; auch andere Gross/Klein-Schreibung des Pfads) → kein Befund und nicht in zulaessig', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const pfade = [
      writeText(sb.base, 'aussen/package.json', PAKET('fiktiv-aussen')),
      writeText(sb.base, 'aussen/mitte/deno.jsonc', '{}\n'),
      writeText(sb.base, 'aussen/deno.json', '{}\n'),
      writeText(sb.base, 'aussen/mitte/package.json', PAKET('fiktiv-mitte')),
      writeText(sb.base, 'aussen/pnpm-workspace.yaml', 'packages: []\n'),
      writeText(sb.base, 'aussen/mitte/lerna.json', '{}\n'),
      join(sb.base, 'AUSSEN', 'package.json'),
    ];
    const r = pruefe(pfade, { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(r.befunde).toEqual([]);
    expect(r.zulaessig).toEqual([]);
  });

  it.each([
    ['anderer Dateiname im Vorfahren', 'aussen/tsconfig.json'],
    ['Geschwisterordner eines Vorfahren', 'aussen/geschwister/package.json'],
    ['Unterordner eines Vorfahren (nicht Vorfahre von cwd)', 'aussen/mitte/unter/package.json'],
    ['Nachbarordner von cwd', 'aussen/mitte/repo-nachbar/package.json'],
    ['Präfix von cwd als Ordner (rep statt repo)', 'aussen/mitte/rep/package.json'],
    ['Präfix eines Vorfahren als Ordner (mit statt mitte)', 'aussen/mit/package.json'],
  ])(
    '[R-H-11] W2 Gegenprobe (Regression, heute schon rot): %s → «Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen», nicht in zulaessig',
    async (_fall, rel) => {
      const pruefe = await pruefeLesezugriffeFn();
      const sb = neueSandbox();
      const { cwd, werkzeug } = aufbau(sb);
      writeText(sb.base, 'aussen/package.json', PAKET('fiktiv-aussen'));
      const datei = writeText(sb.base, rel, '{}\n');
      const r = pruefe([datei], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
      expect(r.befunde).toEqual([AUSSERHALB]);
      expect(r.zulaessig).toEqual([]);
    },
  );
});

describe('pruefeLesezugriffe: cwd selbst und Schreibweise des Dateinamens (W2)', () => {
  it('[R-H-11] W2 package.json in cwd selbst (Regression, bisherige Regel für cwd) → kein Befund und in zulaessig', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const datei = writeText(cwd, 'package.json', PAKET('fiktiv-repo'));
    const r = pruefe([datei], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(r.befunde).toEqual([]);
    expect(r.zulaessig).toHaveLength(1);
    expect((r.zulaessig[0] ?? '').replace(/\\/g, '/')).toMatch(/\/package\.json$/);
  });

  it('[R-H-11] W2 aussen/Package.json (Schreibung auf der Platte, Orchestrator-Zeile a) → kein Befund und nicht in zulaessig', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const datei = writeText(sb.base, 'aussen/Package.json', PAKET('fiktiv-aussen'));
    const r = pruefe([datei], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(r.befunde).toEqual([]);
    expect(r.zulaessig).toEqual([]);
  });
});

describe('Junction als Vorfahre (W3)', () => {
  /**
   * Echter Ort <sandbox>/echt/aussen/mitte/repo; cwd wird über die Junction <sandbox>/zugang/repo erreicht.
   * Vorfahren von resolve(cwd): zugang, sandbox; von realpath(cwd): echt/aussen/mitte, echt/aussen, echt, sandbox.
   */
  function junctionAufbau(sb: Sandbox): { echt: string; cwd: string } {
    const echt = join(sb.base, 'echt', 'aussen', 'mitte', 'repo');
    mkdirSync(echt, { recursive: true });
    junction(join(sb.base, 'zugang', 'repo'), echt);
    return { echt, cwd: join(sb.base, 'zugang', 'repo') };
  }

  it('[R-H-11] W3 cwd über eine Junction: Markierungen in Vorfahren beider Pfade (zugang/package.json, echt/aussen/mitte/package.json, echt/aussen/deno.json) → kein Befund und nicht in zulaessig', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const { cwd } = junctionAufbau(sb);
    const werkzeug = join(sb.base, 'werkzeug', 'node_modules');
    mkdirSync(werkzeug, { recursive: true });
    const pfade = [
      writeText(sb.base, 'zugang/package.json', PAKET('fiktiv-zugang')),
      writeText(sb.base, 'echt/aussen/mitte/package.json', PAKET('fiktiv-mitte')),
      writeText(sb.base, 'echt/aussen/deno.json', '{}\n'),
    ];
    const r = pruefe(pfade, { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(r.befunde).toEqual([]);
    expect(r.zulaessig).toEqual([]);
  });

  it.each([
    ['Geschwisterordner eines echten Vorfahren', 'echt/aussen/geschwister/package.json'],
    ['Unterordner des Junction-Vorfahren', 'zugang/unter/package.json'],
    ['Ordner neben dem echten Ort', 'echt/anders/package.json'],
    ['Präfix des Junction-Vorfahren als Ordner (zug statt zugang)', 'zug/package.json'],
  ])(
    '[R-H-11] W3 Gegenprobe (Regression, heute schon rot): %s → «Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen»',
    async (_fall, rel) => {
      const pruefe = await pruefeLesezugriffeFn();
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { cwd } = junctionAufbau(sb);
      const werkzeug = join(sb.base, 'werkzeug', 'node_modules');
      mkdirSync(werkzeug, { recursive: true });
      const datei = writeText(sb.base, rel, '{}\n');
      const r = pruefe([datei], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
      expect(r.befunde).toEqual([AUSSERHALB]);
      expect(r.zulaessig).toEqual([]);
    },
  );

  it(
    '[R-H-11] W3 buildEinzeldatei mit cwd über eine Junction und package.json im Junction-Vorfahren sowie im echten Vorfahren → grün',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const echt = einzeldateiRepo(sb, 'echt/aussen/mitte/repo');
      writeText(
        echt,
        EINSTIEG,
        "const root = document.getElementById('root');\nif (root !== null) root.textContent = 'Workspace-Probe';\nexport {};\n",
      );
      writeText(sb.base, 'echt/aussen/mitte/package.json', PAKET('fiktiv-mitte'));
      writeText(sb.base, 'zugang/package.json', PAKET('fiktiv-zugang'));
      const cwd = join(sb.base, 'zugang', 'repo');
      junction(cwd, echt);
      erwarteGruen(await baue(cwd), cwd);
    },
    MITTEL,
  );
});

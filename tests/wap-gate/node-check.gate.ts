// Node-Version (FINDINGS F-001, ADR-010 §3.1 F1, §10): jede Schleuse und jede WAP-Testkonfiguration
// bricht unter einer Node-Version ausserhalb von engines.node ab, mit Hinweis.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkNode, runGate), §3 (globalSetup der
// Vitest-Konfigurationen). E1-01-min: Golden- und Playwright-Konfiguration kommen mit E1-01d bzw. E1-01b
// (Entwurf node-check-spaeter.gate.entwurf.ts).
// Selbsttest mit dem lokal installierten Node 22 (nvm), Kindläufe im Mini-Repo bzw. im Klon.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { miniRepo } from './support/mini';
import {
  arbeitsstandKlon,
  aufraeumen,
  KURZ,
  lauf,
  MITTEL,
  neueSandbox,
  type Sandbox,
  WT,
  writeText,
} from './support/umgebung';
import { nodeCheck } from './support/vertrag';

afterEach(aufraeumen);

const NVM_PFAD = 'C:\\Users\\phili\\AppData\\Roaming\\nvm\\v24.15.0';

function node22(): string {
  const p = join(
    process.env.APPDATA ?? 'C:\\Users\\phili\\AppData\\Roaming',
    'nvm',
    'v22.19.0',
    'node.exe',
  );
  expect(existsSync(p), `Node 22 für den Selbsttest fehlt: ${p}`).toBe(true);
  return p;
}

function dateien(
  sb: Sandbox,
  nvmrc: string,
  engines = '>=24.15.0 <25',
): { packageJson: string; nvmrc: string } {
  return {
    packageJson: writeText(
      sb.base,
      'pkg/package.json',
      `${JSON.stringify({ name: 'x', engines: { node: engines } })}\n`,
    ),
    nvmrc: writeText(sb.base, 'pkg/.nvmrc', nvmrc),
  };
}

describe('checkNode', () => {
  it.each([['24.15.0'], ['24.15.1'], ['24.99.0']])(
    '[R-H-27] Version %s innerhalb engines.node und Hauptversion = .nvmrc → grün',
    async (version) => {
      const sb = neueSandbox();
      const { checkNode } = await nodeCheck();
      expect(checkNode({ ...dateien(sb, '24\n'), version }).ok).toBe(true);
    },
  );

  it.each([['24.14.9'], ['25.0.0'], ['22.19.0'], ['20.18.0']])(
    '[R-H-27] Version %s ausserhalb engines.node → rot; Ursache nennt die Version, nächster Schritt den Node-Pfad',
    async (version) => {
      const sb = neueSandbox();
      const { checkNode } = await nodeCheck();
      const r = checkNode({ ...dateien(sb, '24\n'), version });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain(version);
      expect(`${r.ursache ?? ''} ${r.naechsterSchritt ?? ''}`).toContain(NVM_PFAD);
    },
  );

  it('[R-H-27] Hauptversion weicht von .nvmrc ab (.nvmrc 22, Version 24.15.0) → rot', async () => {
    const sb = neueSandbox();
    const { checkNode } = await nodeCheck();
    expect(checkNode({ ...dateien(sb, '22\n'), version: '24.15.0' }).ok).toBe(false);
  });

  it('[R-H-27] .nvmrc in der Form v24.15.0 → Hauptversion 24, grün', async () => {
    const sb = neueSandbox();
    const { checkNode } = await nodeCheck();
    expect(checkNode({ ...dateien(sb, 'v24.15.0\r\n'), version: '24.15.0' }).ok).toBe(true);
  });

  it('[R-H-27] ohne version gilt process.versions.node (24.15.0) → grün', async () => {
    const sb = neueSandbox();
    const { checkNode } = await nodeCheck();
    expect(checkNode(dateien(sb, '24\n')).ok).toBe(true);
  });

  it('[R-H-27] package.json oder .nvmrc fehlt → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const { checkNode } = await nodeCheck();
    const d = dateien(sb, '24\n');
    expect(checkNode({ ...d, packageJson: join(sb.base, 'fehlt.json') }).ok).toBe(false);
    expect(checkNode({ ...d, nvmrc: join(sb.base, 'fehlt.nvmrc') }).ok).toBe(false);
  });
});

describe('Selbsttest mit Node 22: Schleusen brechen ab', () => {
  it.each([['fast'], ['full']])(
    '[R-H-27] gate.mjs %s unter Node 22 → Exit 1 mit Hinweis auf Node 24.15.0 und den Pfad',
    (modus) => {
      const sb = neueSandbox();
      const root = miniRepo(sb);
      const r = lauf(node22(), [join(WT, 'scripts', 'wap-gate', 'gate.mjs'), modus], {
        cwd: root,
        env: sb.env,
        timeout: KURZ,
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain('22.19.0');
      expect(r.out).toContain(NVM_PFAD);
    },
    KURZ,
  );
});

describe('Selbsttest mit Node 22: WAP-Testkonfigurationen brechen ab', () => {
  it(
    '[R-H-27] jede WAP-Vitest-Konfiguration von E1-01-min (wap, reference, gate, selbsttest) unter Node 22 → Abbruch mit Hinweis',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      const probe =
        "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-H-27] probe', () => {\n  expect(1).toBe(1);\n});\n";
      const faelle: Array<[string, string, string]> = [
        ['vitest.wap.config.ts', 'tests/wap/unit/zz-node-probe.test.ts', '4'],
        ['vitest.wap-reference.config.ts', 'tests/wap/reference/zz-node-probe.ref.ts', '4'],
        ['vitest.wap-gate.config.ts', 'tests/wap-gate/zz-node-probe.gate.ts', '4'],
        ['vitest.wap-selbsttest.config.ts', 'tests/wap-gate/zz-node-probe.selbsttest.ts', '1'],
      ];
      for (const [, datei] of faelle) writeText(k.root, datei, probe);
      const vitest = join(k.root, 'node_modules', 'vitest', 'vitest.mjs');
      for (const [konfig, datei, worker] of faelle) {
        expect(existsSync(join(k.root, konfig)), `Konfiguration fehlt: ${konfig}`).toBe(true);
        const r = lauf(node22(), [vitest, 'run', '-c', konfig, datei], {
          cwd: k.root,
          env: { ...sb.env, WAP_REFERENCE_DIR: sb.referenceDir, VITEST_MAX_WORKERS: worker },
          timeout: MITTEL,
        });
        expect(r.status, `${konfig} lief unter Node 22 durch`).not.toBe(0);
        expect(r.out, `${konfig} ohne Hinweis`).toContain('24.15.0');
      }
    },
    MITTEL,
  );
});

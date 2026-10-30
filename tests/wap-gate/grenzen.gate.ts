// F7 Grenzen (ADR-010 §3.1 F7, §4.4): Modulgrenzen (module-boundaries.mjs), Suite-Grenze
// (suite-boundary.mjs, suite-allowlist.json) und Sperr-Abdeckung (lock-coverage.mjs).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkModuleBoundaries, checkSuiteBoundary,
// checkLockCoverage), §6 (suite-allowlist.json), §7 und Änderungsnotiz AE-001 §2 (testpfade.json);
// ADR-010 Änderungsnotiz AE-001 §1 (ungesperrte WAP-Konfiguration aus der merge-base).
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  git,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { boundaries, lockCoverage, suiteBoundary } from './support/vertrag';

afterEach(aufraeumen);

const ALLOWLIST = `${JSON.stringify(
  { dateien: ['package.json', 'biome.json'], importe: ['src/components/ui/Knopf.tsx'] },
  null,
  2,
)}\n`;

/** Repo mit zulässigen Importen in allen Modulen (ADR-010 §4.4). */
function modulRepo(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'module');
  const dateien: Record<string, string> = {
    'scripts/wap-gate/suite-allowlist.json': ALLOWLIST,
    'src/model/wap/types.ts':
      'export interface Rgb {\n  r: number;\n  g: number;\n  b: number;\n}\n',
    'src/model/wap/plan.ts':
      "import { produce } from 'immer';\nimport type { Rgb } from './types';\n\nexport const leer = produce({ a: 1 }, (d) => d);\nexport type Farbe = Rgb;\n",
    'src/model/wap/layout/text/types.ts': "export type FontWeight = 'regular' | 'bold';\n",
    'src/model/wap/layout/satz.ts':
      "import hyphen from 'hyphen';\nimport { leer } from '../plan';\nimport type { FontWeight } from './text/types';\n\nexport const s = [hyphen, leer];\nexport type W = FontWeight;\n",
    'src/model/wap/checks/regel.ts':
      "import type { W } from '../layout/satz';\nimport { leer } from '../plan';\n\nexport const r = leer;\nexport type X = W;\n",
    'src/io/xlsx-drawing/zip.ts':
      "import { unzipSync } from 'fflate';\nimport { y } from './xml';\n\nexport const z = [unzipSync, y];\n",
    'src/io/xlsx-drawing/xml.ts': 'export const y = 1;\n',
    'src/io/wap-import/lesen.ts':
      "import { z } from '../xlsx-drawing/zip';\nimport { leer } from '../../model/wap/plan';\n\nexport const l = [z, leer];\n",
    'src/io/wap-persons/personen.ts':
      "import { leer } from '../../model/wap/plan';\n\nexport const p = leer;\n",
    'src/io/wap-plan/datei.ts':
      "import { leer } from '../../model/wap/plan';\n\nexport const d = leer;\n",
    'src/io/wap-pdf/pdf.ts':
      "import { PDFDocument } from 'pdf-lib';\nimport fontkit from 'fontkit';\nimport { leer } from '../../model/wap/plan';\nimport { schrift } from '../../assets/wap-fonts/schrift';\n\nexport const p = [PDFDocument, fontkit, leer, schrift];\n",
    'src/assets/wap-fonts/schrift.ts':
      "import type { FontWeight } from '../../model/wap/layout/text/types';\n\nexport const schrift = 1;\nexport type G = FontWeight;\n",
    'src/components/ui/Knopf.tsx': 'export const Knopf = (): null => null;\n',
    'src/components/wap/Ansicht.tsx':
      "import { useState } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { Knopf } from '../ui/Knopf';\nimport { p } from '../../io/wap-pdf/pdf';\nimport { s } from '../../model/wap/layout/satz';\n\nexport const A = [useState, createRoot, Knopf, p, s];\n",
    'src/pages/WapPage.tsx':
      "import { A } from '../components/wap/Ansicht';\n\nexport const WapPage = A;\n",
    'src/App.tsx':
      "import { WapPage } from './pages/WapPage';\nimport { z } from './io/xlsx-drawing/zip';\n\nexport const App = [WapPage, z];\n",
  };
  for (const [rel, inhalt] of Object.entries(dateien)) writeText(root, rel, inhalt);
  commitAlles(sb, root, 'Module');
  return root;
}

async function pruefeModule(root: string) {
  const { checkModuleBoundaries } = await boundaries();
  return checkModuleBoundaries({ cwd: root });
}

describe('checkModuleBoundaries (R-H-29, ADR-010 §4.4)', () => {
  it('[R-H-29] alle Importe innerhalb der Grenzen (auch import type, Pakete immer, hyphen, fflate, pdf-lib, react) → grün', async () => {
    const sb = neueSandbox();
    const root = modulRepo(sb);
    const r = await pruefeModule(root);
    expect(r.ok).toBe(true);
  });

  it.each([
    [
      'Modell importiert Oberfläche (statisch)',
      'src/model/wap/zz.ts',
      "import { A } from '../../components/wap/Ansicht';\n\nexport const zz = A;\n",
    ],
    [
      'Modell importiert io per import type',
      'src/model/wap/zz.ts',
      "import type { p } from '../../io/wap-pdf/pdf';\n\nexport type Z = typeof p;\n",
    ],
    [
      'Modell importiert Oberfläche dynamisch',
      'src/model/wap/zz.ts',
      "export const zz = () => import('../../components/wap/Ansicht');\n",
    ],
    [
      'Modell (ohne layout) importiert layout',
      'src/model/wap/zz.ts',
      "import { s } from './layout/satz';\n\nexport const zz = s;\n",
    ],
    [
      'Modell (ohne checks) importiert checks',
      'src/model/wap/zz.ts',
      "import { r } from './checks/regel';\n\nexport const zz = r;\n",
    ],
    [
      'Modell importiert fremdes Paket',
      'src/model/wap/zz.ts',
      "import { createRoot } from 'react-dom/client';\n\nexport const zz = createRoot;\n",
    ],
    [
      'Modell exportiert weiter aus der Oberfläche',
      'src/model/wap/zz.ts',
      "export { A } from '../../components/wap/Ansicht';\n",
    ],
    [
      'layout importiert checks',
      'src/model/wap/layout/zz.ts',
      "import { r } from '../checks/regel';\n\nexport const zz = r;\n",
    ],
    [
      'checks importiert layout als Wert',
      'src/model/wap/checks/zz.ts',
      "import { s } from '../layout/satz';\n\nexport const zz = s;\n",
    ],
    [
      'xlsx-drawing importiert das WAP-Modell',
      'src/io/xlsx-drawing/zz.ts',
      "import { leer } from '../../model/wap/plan';\n\nexport const zz = leer;\n",
    ],
    [
      'xlsx-drawing importiert model/tagesbefehl',
      'src/io/xlsx-drawing/zz.ts',
      "import { t } from '../../model/tagesbefehl/tb';\n\nexport const zz = t;\n",
    ],
    [
      'wap-plan importiert wap-pdf',
      'src/io/wap-plan/zz.ts',
      "import { p } from '../wap-pdf/pdf';\n\nexport const zz = p;\n",
    ],
    [
      'wap-import importiert wap-pdf',
      'src/io/wap-import/zz.ts',
      "import { p } from '../wap-pdf/pdf';\n\nexport const zz = p;\n",
    ],
    [
      'wap-pdf importiert react',
      'src/io/wap-pdf/zz.ts',
      "import { useState } from 'react';\n\nexport const zz = useState;\n",
    ],
    [
      'wap-fonts importiert Layout-Typen als Wert',
      'src/assets/wap-fonts/zz.ts',
      "import { s } from '../../model/wap/layout/satz';\n\nexport const zz = s;\n",
    ],
    [
      'Oberfläche importiert nicht freigegebenen Suite-Baustein',
      'src/components/wap/Zz.tsx',
      "import { B } from '../Andere';\n\nexport const Zz = B;\n",
    ],
    [
      'Suite-Datei importiert WAP ausserhalb von WapPage',
      'src/components/Andere.tsx',
      "import { leer } from '../model/wap/plan';\n\nexport const B = leer;\n",
    ],
  ])('[R-H-29] verbotener Import: %s → rot mit Pfad', async (_name, pfad, inhalt) => {
    const sb = neueSandbox();
    const root = modulRepo(sb);
    writeText(root, 'src/model/tagesbefehl/tb.ts', 'export const t = 1;\n');
    if (!pfad.endsWith('Andere.tsx'))
      writeText(root, 'src/components/Andere.tsx', 'export const B = 1;\n');
    writeText(root, pfad, inhalt);
    commitAlles(sb, root, 'Verstoss');
    const r = await pruefeModule(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain(pfad);
  });

  it('[R-H-29] Suite-Datei importiert WAP über src/pages/WapPage.tsx und src/io/xlsx-drawing → grün', async () => {
    const sb = neueSandbox();
    const root = modulRepo(sb);
    writeText(
      root,
      'src/components/Shell.tsx',
      "import { WapPage } from '../pages/WapPage';\nimport { y } from '../io/xlsx-drawing/xml';\n\nexport const Shell = [WapPage, y];\n",
    );
    commitAlles(sb, root, 'Shell');
    const r = await pruefeModule(root);
    expect(r.ok).toBe(true);
  });
});

/** Repo mit main-Stand und Zweig wap/x (Basis = main). */
function suiteRepo(sb: Sandbox): { root: string; basis: string } {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'suite', 'main');
  writeText(root, 'package.json', '{ "name": "suite", "private": true }\n');
  writeText(root, 'biome.json', '{}\n');
  writeText(root, 'src/model/pisa.ts', 'export const pisa = 1;\n');
  writeText(root, 'scripts/wap-gate/suite-allowlist.json', ALLOWLIST);
  const basis = commitAlles(sb, root, 'Suite');
  git(sb, root, 'checkout', '-q', '-b', 'wap/x');
  return { root, basis };
}

async function pruefeSuite(root: string, basis: string) {
  const { checkSuiteBoundary } = await suiteBoundary();
  return checkSuiteBoundary({ cwd: root, basis });
}

describe('checkSuiteBoundary (R-H-30)', () => {
  it('[R-H-30] nur freigegebene Suite-Dateien und WAP-Dateien geändert → grün', async () => {
    const sb = neueSandbox();
    const { root, basis } = suiteRepo(sb);
    writeText(root, 'package.json', '{ "name": "suite", "private": true, "scripts": {} }\n');
    writeText(root, 'src/model/wap/neu.ts', 'export const neu = 1;\n');
    commitAlles(sb, root, 'Erlaubt');
    const r = await pruefeSuite(root, basis);
    expect(r.ok).toBe(true);
  });

  it.each([
    ['README.md', '# Testrepo\n\nGeändert.\n'],
    ['src/model/pisa.ts', 'export const pisa = 2;\n'],
  ])(
    '[R-H-30] Änderung an der nicht freigegebenen Suite-Datei %s → rot mit Pfad',
    async (pfad, inhalt) => {
      const sb = neueSandbox();
      const { root, basis } = suiteRepo(sb);
      writeText(root, pfad, inhalt);
      commitAlles(sb, root, 'Verboten');
      const r = await pruefeSuite(root, basis);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(pfad);
    },
  );

  it('[R-H-30] neue Suite-Datei ausserhalb der Liste → rot; gelöschte Suite-Datei → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = suiteRepo(sb);
    writeText(root, 'src/components/Neu.tsx', 'export const Neu = 1;\n');
    commitAlles(sb, root, 'Neu');
    const neu = await pruefeSuite(root, basis);
    expect(neu.ok).toBe(false);
    expect(schrittText(neu)).toContain('src/components/Neu.tsx');
    git(sb, root, 'rm', '-q', 'src/components/Neu.tsx', 'src/model/pisa.ts');
    commitAlles(sb, root, 'Gelöscht');
    const weg = await pruefeSuite(root, basis);
    expect(weg.ok).toBe(false);
    expect(schrittText(weg)).toContain('src/model/pisa.ts');
  });

  it('[R-H-30] Änderung nur im Arbeitsbaum (nicht committet) an einer Suite-Datei → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = suiteRepo(sb);
    writeText(root, 'src/model/pisa.ts', 'export const pisa = 3;\n');
    const r = await pruefeSuite(root, basis);
    expect(r.ok).toBe(false);
  });

  it('[R-H-30] suite-allowlist.json fehlt → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const { root, basis } = suiteRepo(sb);
    git(sb, root, 'rm', '-q', 'scripts/wap-gate/suite-allowlist.json');
    commitAlles(sb, root, 'Ohne Liste');
    const r = await pruefeSuite(root, basis);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('suite-allowlist.json');
  });
});

describe('checkLockCoverage (F7, Vertrag §7 und Änderungsnotiz AE-001 §2; ADR-010 Änderungsnotiz AE-001 §1)', () => {
  /** Testpfadmenge (gesperrte Datei scripts/wap-gate/testpfade.json, AE-001 §2). */
  const TESTPFADE = 'scripts/wap-gate/testpfade.json';

  function paketDatei(name: string, eingefroren: boolean): string {
    return [
      `# Paket ${name} – fiktiv`,
      '',
      '- Etappe: 1',
      '- Anforderungen: R-9-01',
      '',
      '- [x] 1 Paket-Worktree angelegt und installiert',
      '- [x] 2 Schnittstellenvertrag und Stubs',
      '- [x] 3 Tests',
      '- [x] 4 Test-Review',
      '- [x] 5 Rot-Nachweis',
      `- [${eingefroren ? 'x' : ' '}] 6 Test-Freeze: Commit mit Tests, Stubs, Vertrag, test-lock.json`,
      '- [ ] 7 Umsetzung',
      '- [ ] 13 Integration',
      '',
    ].join('\n');
  }

  function lockRepo(
    sb: Sandbox,
    dateien: Record<string, string>,
    gesperrt: string[],
    testpfade: Record<string, string[]> | null = {},
  ): string {
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'abdeckung');
    const alle: Record<string, string> = { ...dateien };
    if (testpfade !== null) alle[TESTPFADE] = `${JSON.stringify(testpfade, null, 2)}\n`;
    for (const [rel, inhalt] of Object.entries(alle)) writeText(root, rel, inhalt);
    const files: Record<string, string> = {};
    const zuSperren = testpfade !== null ? [...gesperrt, TESTPFADE] : gesperrt;
    for (const rel of zuSperren) files[rel] = sha256Lf(readText(root, rel));
    writeText(
      root,
      'docs/wap-planer/test-lock.json',
      `${JSON.stringify({ version: 1, files }, null, 2)}\n`,
    );
    commitAlles(sb, root, 'Sperren');
    return root;
  }

  async function pruefe(root: string) {
    const { checkLockCoverage } = await lockCoverage();
    return checkLockCoverage({ cwd: root });
  }

  it('[R-H-10] jede Datei unter scripts/wap-gate/ gesperrt (inkl. testpfade.json) → grün', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'scripts/wap-gate/gate.mjs': 'export const g = 1;\n',
        'scripts/wap-gate/lib/out.mjs': 'export const o = 1;\n',
      },
      ['scripts/wap-gate/gate.mjs', 'scripts/wap-gate/lib/out.mjs'],
    );
    expect((await pruefe(root)).ok).toBe(true);
  });

  it('[R-H-10] ungesperrte Datei unter scripts/wap-gate/ → rot mit Pfad', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'scripts/wap-gate/gate.mjs': 'export const g = 1;\n',
        'scripts/wap-gate/zz-neu.mjs': 'export const n = 1;\n',
      },
      ['scripts/wap-gate/gate.mjs'],
    );
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('scripts/wap-gate/zz-neu.mjs');
  });

  it('[R-H-10] testpfade.json fehlt → rot mit Ursache (fail-closed)', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      { 'scripts/wap-gate/gate.mjs': 'export const g = 1;\n' },
      ['scripts/wap-gate/gate.mjs'],
      null,
    );
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('testpfade.json');
  });

  it('[R-H-10] eingefrorenes Paket (Kästchen 6), alle Dateien unter seinen Globs gesperrt → grün', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'docs/wap-planer/pakete/E1-91.md': paketDatei('E1-91', true),
        'tests/wap/unit/e1-91/a.test.ts': 'export const a = 1;\n',
        'tests/wap/golden/baselines/kvk-1.png': 'fiktiv-a',
        'tests/wap/golden/baselines/extras-1.png': 'fiktiv-b',
      },
      ['tests/wap/unit/e1-91/a.test.ts', 'tests/wap/golden/baselines/kvk-1.png'],
      { 'E1-91': ['tests/wap/unit/e1-91/**', 'tests/wap/golden/baselines/kvk-*.png'] },
    );
    expect((await pruefe(root)).ok).toBe(true);
  });

  it('[R-H-10] Datei unter einem Glob eines eingefrorenen Pakets nicht gesperrt → rot mit Pfad', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'docs/wap-planer/pakete/E1-91.md': paketDatei('E1-91', true),
        'tests/wap/unit/e1-91/a.test.ts': 'export const a = 1;\n',
        'tests/wap/golden/baselines/kvk-2.png': 'fiktiv-c',
      },
      ['tests/wap/unit/e1-91/a.test.ts'],
      { 'E1-91': ['tests/wap/unit/e1-91/**', 'tests/wap/golden/baselines/kvk-*.png'] },
    );
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('tests/wap/golden/baselines/kvk-2.png');
  });

  it('[R-H-10] eingefrorenes Paket ohne Eintrag in testpfade.json → rot mit Paket (fail-closed)', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'docs/wap-planer/pakete/E1-91.md': paketDatei('E1-91', true),
        'docs/wap-planer/pakete/E1-92.md': paketDatei('E1-92', true),
        'tests/wap/unit/e1-91/a.test.ts': 'export const a = 1;\n',
      },
      ['tests/wap/unit/e1-91/a.test.ts'],
      { 'E1-91': ['tests/wap/unit/e1-91/**'] },
    );
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('E1-92');
  });

  it('[R-H-10] nicht eingefrorenes Paket (Kästchen 6 offen): ungesperrte Dateien unter seinem Glob → grün', async () => {
    const sb = neueSandbox();
    const root = lockRepo(
      sb,
      {
        'docs/wap-planer/pakete/E1-93.md': paketDatei('E1-93', false),
        'tests/wap/unit/e1-93/b.test.ts': 'export const b = 1;\n',
      },
      [],
      { 'E1-93': ['tests/wap/unit/e1-93/**'] },
    );
    expect((await pruefe(root)).ok).toBe(true);
  });

  it.each([
    ['vitest.wap.config.ts'],
    ['vitest.wap-selbsttest.config.ts'],
    ['tsconfig.wap.json'],
    ['playwright.wap.config.ts'],
    ['stryker.wap.conf.mjs'],
  ])(
    '[R-H-10][R-H-18] %s existiert schon in git merge-base HEAD wap-planer und ist nicht gesperrt → rot mit Pfad; gesperrt → grün',
    async (datei) => {
      const sb = neueSandbox();
      const ungesperrt = lockRepo(sb, { [datei]: 'export default {};\n' }, []);
      git(sb, ungesperrt, 'checkout', '-q', '-b', 'wap/x');
      const rot = await pruefe(ungesperrt);
      expect(rot.ok).toBe(false);
      expect(schrittText(rot)).toContain(datei);
      const sb2 = neueSandbox();
      const gesperrt = lockRepo(sb2, { [datei]: 'export default {};\n' }, [datei]);
      git(sb2, gesperrt, 'checkout', '-q', '-b', 'wap/x');
      expect((await pruefe(gesperrt)).ok).toBe(true);
    },
  );

  it('[R-H-10][R-H-18] WAP-Konfiguration nur auf dem Paketzweig neu (nicht in der merge-base) und nicht gesperrt → grün', async () => {
    const sb = neueSandbox();
    const root = lockRepo(sb, {}, []);
    git(sb, root, 'checkout', '-q', '-b', 'wap/x');
    writeText(root, 'vitest.wap-neu.config.ts', 'export default {};\n');
    commitAlles(sb, root, 'Neue Konfiguration im Paket');
    expect((await pruefe(root)).ok).toBe(true);
  });
});

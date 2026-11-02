// F4 verbotene Muster (forbidden.mjs) und F5 Lint (biome.json mit WAP-Überschreibungen), ADR-010 §4.1,
// §4.5; Altmodule ohne Ausnahme in F4/F5 (§6a Fall 5).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (scanForbidden), §3 (biome.json), §6a (5).
// Verbotene Wörter und Muster werden zur Laufzeit gebildet (wort()), damit dieser Quelltext selbst
// keine Verstösse enthält.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  KURZ,
  kopiereAusWt,
  lauf,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  sha256Lf,
  wort,
  writeText,
} from './support/umgebung';
import { forbidden } from './support/vertrag';

afterEach(aufraeumen);

const w = wort;
const TODO = w('TO', 'DO');
const ENV_KOPF = '// @vitest-environment node\n';

/** Repo mit sauberen Dateien in allen geprüften Bereichen. */
function repo(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'muster');
  writeText(
    root,
    'src/model/wap/sauber.ts',
    'export const sauber = (a: number): number => a + 1;\n',
  );
  writeText(root, 'src/io/wap-pdf/sauber.ts', 'export const datum = new Date(0);\n');
  writeText(
    root,
    'tests/wap/unit/sauber.test.ts',
    `${ENV_KOPF}import { expect, it } from 'vitest';\n\nit('[R-1-01] sauber', () => {\n  expect(1).toBe(1);\n});\n`,
  );
  writeText(
    root,
    'scripts/wap-gate/lib/out.mjs',
    `export function ok(s) {\n  ${w('con', 'sole')}.log(s);\n}\n`,
  );
  writeText(root, 'tools/wap/sauber.mjs', 'export const t = 1;\n');
  commitAlles(sb, root, 'Sauber');
  return root;
}

async function pruefe(root: string) {
  const { scanForbidden } = await forbidden();
  return scanForbidden({ cwd: root });
}

describe('scanForbidden: sauberer Stand', () => {
  it('[R-H-13] ohne Verstoss → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const r = await pruefe(root);
    expect(r.ok).toBe(true);
  });

  it('[R-H-13] Muster ausserhalb des Geltungsbereichs (Suite-Datei) → nicht gewertet', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      'src/components/Andere.tsx',
      `// ${TODO} Suite\nexport const x: ${w('an', 'y')} = ${w('con', 'sole')}.log(1);\n`,
    );
    commitAlles(sb, root, 'Suite');
    const r = await pruefe(root);
    expect(r.ok).toBe(true);
  });

  it.each([
    ['Wortteil (todos)', 'src/model/wap/liste.ts', 'export const todosListe = 1;\n'],
    [
      'Bezeichner anything/company',
      'src/model/wap/firma.ts',
      'export const anything = 1;\nexport const company = 2;\n',
    ],
    ['new Date mit Argument im Modell', 'src/model/wap/zeit.ts', 'export const d = new Date(0);\n'],
    [
      'Konsolenausgabe in einem Test',
      'tests/wap/unit/log.test.ts',
      `${ENV_KOPF}import { it } from 'vitest';\n\nit('[R-1-01] log', () => {\n  ${w('con', 'sole')}.info('x');\n});\n`,
    ],
    [
      'ts-Fehler-erwartet-Kommentar mit Begründung im Test',
      'tests/wap/unit/erwartet.test.ts',
      `${ENV_KOPF}import { it } from 'vitest';\n\nit('[R-1-01] e', () => {\n  // ${w('@ts-', 'expect-error')} Absichtlich falscher Typ für den Fehlerfall\n  const n: number = 'x';\n  void n;\n});\n`,
    ],
    [
      'Biome-Ausnahme mit Begründung ≥ 15 Zeichen',
      'src/model/wap/frei.ts',
      `// ${w('biome', '-ignore')} lint/style/useConst: Begründung lang genug hier\nexport let f = 1;\n`,
    ],
    [
      'Stryker-Ausnahme mit Begründung ≥ 15 Zeichen',
      'src/model/wap/mutant.ts',
      `// ${w('Stryker', ' disable')} next-line all: gleichwertiger Mutant begründet\nexport const m = 1;\n`,
    ],
    [
      'Math.random ausserhalb des Modells (Import)',
      'src/io/wap-import/zufall.ts',
      `export const z = ${w('Math.', 'random')}();\n`,
    ],
  ])('[R-H-13] zulässig: %s → grün', async (_name, pfad, inhalt) => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, pfad, inhalt);
    commitAlles(sb, root, 'Zulässig');
    const r = await pruefe(root);
    expect(r.ok).toBe(true);
  });
});

const VERSTOESSE_ROH: Array<[string, string, string]> = [
  // Merkzettel-Wörter (Gross/Klein egal, ganzes Wort)
  [
    'Merkwort T-O-D-O in Produktcode',
    'src/model/wap/a.ts',
    `// ${TODO} später\nexport const a = 1;\n`,
  ],
  [
    'Merkwort t-o-d-o klein in Produktcode',
    'src/io/wap-plan/a.ts',
    `// ${TODO.toLowerCase()}: später\nexport const a = 1;\n`,
  ],
  [
    'Merkwort F-I-X-M-E in einem Test',
    'tests/wap/unit/a.test.ts',
    `${ENV_KOPF}// ${w('FIX', 'ME')}\nimport { it } from 'vitest';\n\nit('[R-1-01] a', () => {});\n`,
  ],
  [
    'Merkwort X-X-X in einem Skript',
    'scripts/wap-gate/a.mjs',
    `// ${w('XX', 'X')}\nexport const a = 1;\n`,
  ],
  [
    'Merkwort H-A-C-K in tools/wap',
    'tools/wap/a.mjs',
    `// ${w('HA', 'CK')}\nexport const a = 1;\n`,
  ],
  // übersprungene und fokussierte Tests
  [
    'fokussierter Test (it, nur dieser)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.on', 'ly')}('[R-1-01] b', () => {});\n`,
  ],
  [
    'übersprungener Test (it)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.sk', 'ip')}('[R-1-01] b', () => {});\n`,
  ],
  [
    'übersprungene Gruppe (describe)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { describe, it } from 'vitest';\n\ndescribe${w('.sk', 'ip')}('g', () => {\n  it('[R-1-01] b', () => {});\n});\n`,
  ],
  [
    'vorgemerkter Test (test, offen)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { test } from 'vitest';\n\ntest${w('.to', 'do')}('[R-1-01] b');\n`,
  ],
  [
    'erwartet scheiternder Test (it)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.fa', 'ils')}('[R-1-01] b', () => {});\n`,
  ],
  [
    'bedingt übersprungener Test (it, Bedingung)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.sk', 'ip', 'If')}(true)('[R-1-01] b', () => {});\n`,
  ],
  [
    'bedingt ausgeführter Test (it, Bedingung)',
    'tests/wap/unit/b.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.run', 'If')}(false)('[R-1-01] b', () => {});\n`,
  ],
  [
    'Playwright-Test zum Nachbessern markiert',
    'tests/wap-e2e/b.spec.ts',
    `import { test } from '@playwright/test';\n\ntest${w('.fix', 'me')}('[R-1-01] b', async () => {});\n`,
  ],
  [
    'Playwright-Test als scheiternd markiert',
    'tests/wap-e2e/c.spec.ts',
    `import { test } from '@playwright/test';\n\ntest${w('.fa', 'il')}('[R-1-01] c', async () => {});\n`,
  ],
  [
    'fokussierter Schleusen-Test',
    'tests/wap-gate/b.gate.ts',
    `import { it } from 'vitest';\n\nit${w('.on', 'ly')}('[R-H-10] b', () => {});\n`,
  ],
  // Konsolenausgaben
  [
    'Konsolenausgabe im Modell',
    'src/model/wap/c.ts',
    `export const c = (): void => {\n  ${w('con', 'sole')}.log(1);\n};\n`,
  ],
  [
    'Konsolenwarnung in einer Komponente',
    'src/components/wap/C.tsx',
    `export const C = (): null => {\n  ${w('con', 'sole')}.warn('x');\n  return null;\n};\n`,
  ],
  [
    'Konsolenausgabe in scripts/wap-gate ausserhalb lib/out.mjs',
    'scripts/wap-gate/c.mjs',
    `${w('con', 'sole')}.log('x');\n`,
  ],
  // any und Typprüfung abschalten
  ['Typ a-n-y', 'src/model/wap/d.ts', `export const d: ${w('an', 'y')} = 1;\n`],
  ['Typumwandlung nach a-n-y', 'src/model/wap/d.ts', `export const d = 1 as ${w('an', 'y')};\n`],
  ['spitze Klammer a-n-y', 'src/model/wap/d.ts', `export const d = <${w('an', 'y')}>1;\n`],
  [
    'ts-Ignorieren-Kommentar',
    'src/model/wap/d.ts',
    `// ${w('@ts-', 'ignore')}\nexport const d: number = 'x';\n`,
  ],
  [
    'ts-Keine-Prüfung-Kommentar',
    'src/model/wap/d.ts',
    `// ${w('@ts-', 'nocheck')}\nexport const d = 1;\n`,
  ],
  [
    'ts-Fehler-erwartet-Kommentar in Produktcode',
    'src/model/wap/d.ts',
    `// ${w('@ts-', 'expect-error')} Absichtlich falscher Typ für den Fehlerfall\nexport const d: number = 'x';\n`,
  ],
  [
    'ts-Fehler-erwartet-Kommentar mit kurzer Begründung im Test',
    'tests/wap/unit/d.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit('[R-1-01] d', () => {\n  // ${w('@ts-', 'expect-error')} kurz\n  const n: number = 'x';\n  void n;\n});\n`,
  ],
  // Regeln abschalten ohne Begründung
  [
    'Biome-Ausnahme mit zu kurzer Begründung',
    'src/model/wap/e.ts',
    `// ${w('biome', '-ignore')} lint/style/useConst: kurz\nexport let e = 1;\n`,
  ],
  [
    'Stryker-Ausnahme mit zu kurzer Begründung',
    'src/model/wap/e.ts',
    `// ${w('Stryker', ' disable')} next-line all: kurz\nexport const e = 1;\n`,
  ],
  // Reinheit des Modells (Leitplanke 2)
  [
    'document im Modell',
    'src/model/wap/f.ts',
    `export const f = (): unknown => ${w('docu', 'ment')}.title;\n`,
  ],
  [
    'window im Modell',
    'src/model/wap/f.ts',
    `export const f = (): unknown => ${w('win', 'dow')}.innerWidth;\n`,
  ],
  [
    'navigator im Modell',
    'src/model/wap/f.ts',
    `export const f = (): unknown => ${w('navi', 'gator')}.language;\n`,
  ],
  [
    'localStorage im Modell',
    'src/model/wap/f.ts',
    `export const f = (): unknown => ${w('local', 'Storage')}.length;\n`,
  ],
  [
    'indexedDB im Modell',
    'src/model/wap/f.ts',
    `export const f = (): unknown => ${w('indexed', 'DB')};\n`,
  ],
  [
    'Math.random im Modell',
    'src/model/wap/f.ts',
    `export const f = (): number => ${w('Math.', 'random')}();\n`,
  ],
  [
    'Date.now im Modell',
    'src/model/wap/f.ts',
    `export const f = (): number => ${w('Date.', 'now')}();\n`,
  ],
  [
    'new Date() ohne Argument im Modell',
    'src/model/wap/f.ts',
    `export const f = (): Date => ${w('new Date', '()')};\n`,
  ],
  [
    'performance.now im Modell',
    'src/model/wap/f.ts',
    `export const f = (): number => ${w('performance.', 'now')}();\n`,
  ],
  // Netz (R-11-03)
  [
    'fetch in src/io/wap-pdf',
    'src/io/wap-pdf/g.ts',
    `export const g = (): unknown => ${w('fet', 'ch')}('/x');\n`,
  ],
  [
    'XMLHttpRequest in einer Komponente',
    'src/components/wap/G.ts',
    `export const g = (): unknown => new ${w('XMLHttp', 'Request')}();\n`,
  ],
  [
    'WebSocket',
    'src/io/wap-plan/g.ts',
    `export const g = (): unknown => new ${w('Web', 'Socket')}('ws://127.0.0.1');\n`,
  ],
  [
    'EventSource',
    'src/io/wap-plan/g.ts',
    `export const g = (): unknown => new ${w('Event', 'Source')}('/e');\n`,
  ],
  [
    'navigator.sendBeacon',
    'src/io/wap-plan/g.ts',
    `export const g = (): unknown => navigator.${w('send', 'Beacon')}('/b');\n`,
  ],
  [
    'importScripts',
    'src/io/wap-plan/g.ts',
    `export const g = (): unknown => ${w('import', 'Scripts')}('/s.js');\n`,
  ],
  [
    'entfernte URL',
    'src/io/wap-plan/g.ts',
    `export const g = '${w('https', '://')}example.invalid/daten';\n`,
  ],
  // Plattformunabhängigkeit der WAP-Tests der Suite-Menge (ADR-010 §4.5)
  [
    'Test ohne @vitest-environment-Kopfzeile',
    'tests/wap/unit/h.test.ts',
    "import { it } from 'vitest';\n\nit('[R-1-01] h', () => {});\n",
  ],
  [
    'absoluter Pfad in einem Unit-Test',
    'tests/wap/unit/h.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nconst p = '${w('C:', '/Daten/plan.json')}';\nit('[R-1-01] h', () => {\n  void p;\n});\n`,
  ],
  [
    'Backslash im Pfad-Literal',
    'tests/wap/property/h.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nconst p = 'fixtures${w('\\', '\\')}plan.json';\nit('[R-1-01] h', () => {\n  void p;\n});\n`,
  ],
  [
    'process.platform',
    'tests/wap/integration/h.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nit('[R-1-01] h', () => {\n  void ${w('process.', 'platform')};\n});\n`,
  ],
  [
    'Systemschrift über local(',
    'tests/wap/pdf/h.test.ts',
    `${ENV_KOPF}import { it } from 'vitest';\n\nconst css = "src: ${w('loc', 'al(')}'Arial')";\nit('[R-1-01] h', () => {\n  void css;\n});\n`,
  ],
  [
    'document.fonts.check ohne eigene Schrift',
    'tests/wap/unit/h.test.ts',
    `// @vitest-environment jsdom\nimport { it } from 'vitest';\n\nit('[R-1-01] h', () => {\n  void ${w('document.fonts', '.check')}('12px Arial');\n});\n`,
  ],
];

/** IDs je Verstoss: Reinheit des Modells auch R-H-29 (Leitplanke 2), Plattformregeln auch R-H-28. */
function ids(name: string, pfad: string): string {
  if (
    pfad.startsWith('src/model/wap/') &&
    name.endsWith('im Modell') &&
    !name.startsWith('Konsolen')
  )
    return '[R-H-29][R-H-13]';
  if (
    /^tests\/wap\/(unit|property|integration|pdf)\//.test(pfad) &&
    /Kopfzeile|Pfad|Backslash|process|Systemschrift|document\.fonts/.test(name)
  ) {
    return '[R-H-28][R-H-13]';
  }
  return '[R-H-13]';
}

const VERSTOESSE: Array<[string, string, string, string]> = VERSTOESSE_ROH.map(
  ([name, pfad, inhalt]) => [ids(name, pfad), name, pfad, inhalt],
);

describe('scanForbidden: je Verstoss rot mit Pfad', () => {
  it.each(VERSTOESSE)('%s %s (%s) → rot', async (_ids, _name, pfad, inhalt) => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, pfad, inhalt);
    commitAlles(sb, root, 'Verstoss');
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain(pfad);
  });

  it('[R-H-13][R-H-14] (§6a 5) gelistetes Altmodul mit stimmendem SHA-256 und Merkwort → F4 rot (keine Altmodul-Ausnahme)', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const inhalt = `// ${TODO} Altbestand\nexport const z = 1;\n`;
    writeText(root, 'src/io/xlsx-drawing/zip.ts', inhalt);
    writeText(
      root,
      'scripts/wap-gate/legacy-modules.json',
      `${JSON.stringify({ version: 1, dateien: [{ pfad: 'src/io/xlsx-drawing/zip.ts', sha256: sha256Lf(inhalt) }] })}\n`,
    );
    commitAlles(sb, root, 'Altmodul');
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/io/xlsx-drawing/zip.ts');
  });

  it('[R-H-13] mehrere Verstösse → alle Pfade genannt', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'src/model/wap/x1.ts', `// ${TODO}\nexport const a = 1;\n`);
    writeText(root, 'src/model/wap/x2.ts', `export const b: ${w('an', 'y')} = 1;\n`);
    commitAlles(sb, root, 'Zwei');
    const r = await pruefe(root);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/model/wap/x1.ts');
    expect(schrittText(r)).toContain('src/model/wap/x2.ts');
  });
});

/** Biome des Pakets (biome.json als Kopie) im temporären Repo. */
function biome(sb: Sandbox, root: string, ...pfade: string[]) {
  return lauf(
    process.execPath,
    [join(root, 'node_modules', '@biomejs', 'biome', 'bin', 'biome'), 'check', ...pfade],
    {
      cwd: root,
      env: sb.env,
      timeout: KURZ,
    },
  );
}

function biomeRepo(sb: Sandbox): string {
  const root = repo(sb);
  kopiereAusWt(root, 'biome.json');
  nodeModules(root);
  return root;
}

describe('F5 Lint: biome.json mit WAP-Überschreibungen (Vertrag §3)', () => {
  it.each([
    [
      'fokussierter Test (it, nur dieser)',
      'tests/wap/unit/l.test.ts',
      `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.on', 'ly')}('[R-1-01] l', () => {});\n`,
      'noFocusedTests',
    ],
    [
      'übersprungener Test (it)',
      'tests/wap/unit/l.test.ts',
      `${ENV_KOPF}import { it } from 'vitest';\n\nit${w('.sk', 'ip')}('[R-1-01] l', () => {});\n`,
      'noSkippedTests',
    ],
    [
      'Typ a-n-y in der WAP-Pfadmenge',
      'src/model/wap/l.ts',
      `export const l: ${w('an', 'y')} = 1;\n`,
      'noExplicitAny',
    ],
  ])(
    '[R-H-13] %s → Biome-Fehler (Exit ≠ 0) und F4 rot',
    async (_name, pfad, inhalt, regel) => {
      const sb = neueSandbox();
      const root = biomeRepo(sb);
      writeText(root, pfad, inhalt);
      commitAlles(sb, root, 'Lint');
      const r4 = await pruefe(root);
      expect(r4.ok).toBe(false);
      const r5 = biome(sb, root, pfad);
      expect(r5.status).not.toBe(0);
      expect(r5.out).toContain(regel);
    },
    KURZ,
  );

  it(
    '[R-H-13] Typ a-n-y in einer Suite-Datei ausserhalb der WAP-Pfadmenge → keine Überschreibung (nur Suite-Regel, kein Fehler)',
    async () => {
      const sb = neueSandbox();
      const root = biomeRepo(sb);
      writeText(root, 'src/components/Suite.ts', `export const s: ${w('an', 'y')} = 1;\n`);
      commitAlles(sb, root, 'Suite');
      const r4 = await pruefe(root);
      expect(r4.ok).toBe(true);
      const r5 = biome(sb, root, 'src/components/Suite.ts');
      expect(r5.status).toBe(0);
    },
    KURZ,
  );

  it(
    '[R-H-13][R-H-14] (§6a 5) gelistetes Altmodul mit stimmendem SHA-256 und Typ a-n-y → F5 rot (keine Altmodul-Ausnahme)',
    async () => {
      const sb = neueSandbox();
      const root = biomeRepo(sb);
      const inhalt = `export const z: ${w('an', 'y')} = 1;\n`;
      writeText(root, 'src/io/xlsx-drawing/zip.ts', inhalt);
      writeText(
        root,
        'scripts/wap-gate/legacy-modules.json',
        `${JSON.stringify({ version: 1, dateien: [{ pfad: 'src/io/xlsx-drawing/zip.ts', sha256: sha256Lf(inhalt) }] })}\n`,
      );
      commitAlles(sb, root, 'Altmodul');
      const r4 = await pruefe(root);
      expect(r4.ok).toBe(false);
      const r5 = biome(sb, root, 'src/io/xlsx-drawing/zip.ts');
      expect(r5.status).not.toBe(0);
      expect(r5.out).toContain('noExplicitAny');
    },
    KURZ,
  );

  it(
    '[R-H-13] files.includes umfasst scripts/wap*/**/*.mjs und tools/wap/** (F-003): Formatfehler dort → Biome-Fehler',
    async () => {
      const sb = neueSandbox();
      const root = biomeRepo(sb);
      writeText(root, 'scripts/wap-gate/zz.mjs', 'export   const a=1\n');
      writeText(root, 'tools/wap/zz.mjs', 'export   const b=2\n');
      commitAlles(sb, root, 'Format');
      const r4 = await pruefe(root);
      expect(r4.ok).toBe(true);
      const a = biome(sb, root, 'scripts/wap-gate/zz.mjs');
      expect(a.status).not.toBe(0);
      expect(a.out).toContain('zz.mjs');
      const b = biome(sb, root, 'tools/wap/zz.mjs');
      expect(b.status).not.toBe(0);
    },
    KURZ,
  );
});

describe('scanForbidden({ dateien }) (Vertrag §9 Nr 14)', () => {
  it('[R-H-13] nur die genannten Dateien: Verstoss in einer nicht genannten Datei → grün, in einer genannten → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'src/model/wap/x1.ts', `// ${TODO}\nexport const a = 1;\n`);
    commitAlles(sb, root, 'Verstoss');
    const { scanForbidden } = await forbidden();
    const gruen = await scanForbidden({ cwd: root, dateien: ['src/model/wap/sauber.ts'] });
    expect(gruen.ok).toBe(true);
    const rot = await scanForbidden({
      cwd: root,
      dateien: ['src/model/wap/sauber.ts', 'src/model/wap/x1.ts'],
    });
    expect(rot.ok).toBe(false);
    expect(rot.ursache ?? '').toContain('src/model/wap/x1.ts');
  });

  it('[R-H-13] genannte Datei ausserhalb des Geltungsbereichs → übergangen, in details.ausserhalb gezählt', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'src/components/Andere.tsx', `// ${TODO}\nexport const x = 1;\n`);
    commitAlles(sb, root, 'Suite');
    const { scanForbidden } = await forbidden();
    const r = await scanForbidden({
      cwd: root,
      dateien: ['src/components/Andere.tsx', 'src/model/wap/sauber.ts'],
    });
    expect(r.ok).toBe(true);
    expect((r.details as { ausserhalb?: number } | undefined)?.ausserhalb).toBe(1);
  });

  it('[R-H-13] genannte, nicht vorhandene Datei → rot «Datei fehlt»', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const { scanForbidden } = await forbidden();
    const r = await scanForbidden({ cwd: root, dateien: ['src/model/wap/gibt-es-nicht.ts'] });
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Datei fehlt');
  });
});

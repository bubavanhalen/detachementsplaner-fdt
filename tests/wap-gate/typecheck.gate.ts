// F6 Typprüfung (ADR-010 §4.2, Entscheid E12 c, AR0-44): strikte Prüfung der WAP-Pfadmenge mit
// tsconfig.wap.json; Meldungen zu unveränderten Altmodulen (SHA-256 = legacy-modules.json) verworfen;
// Suite-Dateien nur über die Suite-Prüfung.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkTypes, legacyUnchanged), §3, §6a (1)–(4).
// Temporäre Repos mit den tsconfig-Dateien des Pakets (Kopie) und verknüpftem node_modules.
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  kopiereAusWt,
  MITTEL,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { legacy, typecheck } from './support/vertrag';

afterEach(aufraeumen);

const ALT = 'src/io/xlsx-drawing/zip.ts';
const ALT_INHALT = [
  'export interface Eintrag {',
  '  x: number;',
  '}',
  '',
  'export function erstes(liste: Eintrag[]): number {',
  '  return liste[0].x;',
  '}',
  '',
].join('\n');

const NUTZER = [
  "import { erstes } from '../xlsx-drawing/zip';",
  '',
  'export const wert: number = erstes([{ x: 1 }]);',
  '',
].join('\n');

function repo(sb: Sandbox, liste: 'stimmt' | 'fehlt' = 'stimmt'): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'typen');
  kopiereAusWt(root, 'tsconfig.json');
  kopiereAusWt(root, 'tsconfig.wap.json');
  nodeModules(root);
  writeText(root, ALT, ALT_INHALT);
  writeText(root, 'src/io/wap-import/nutzer.ts', NUTZER);
  if (liste === 'stimmt') {
    writeText(
      root,
      'scripts/wap-gate/legacy-modules.json',
      `${JSON.stringify({ version: 1, dateien: [{ pfad: ALT, sha256: sha256Lf(ALT_INHALT) }] }, null, 2)}\n`,
    );
  }
  commitAlles(sb, root, 'Typen');
  return root;
}

describe('checkTypes: Altmodule (§6a)', () => {
  it(
    '[R-H-14] (1) gelistete Datei mit strengem Fehler, SHA-256 stimmt, strenge Datei importiert sie → grün, verworfen nennt die Datei',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(true);
      expect(r.verworfen).toEqual([{ datei: ALT, anzahl: 1 }]);
    },
    MITTEL,
  );

  it(
    '[R-H-14] (2) dieselbe Datei um eine Zeile geändert → rot mit Meldung in dieser Datei',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, ALT, `// geändert\n${ALT_INHALT}`);
      commitAlles(sb, root, 'Geändert');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(ALT);
      expect(r.verworfen).toEqual([]);
    },
    MITTEL,
  );

  it(
    '[R-H-14] (3) derselbe Fehler in einer nicht gelisteten WAP-Datei → rot',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/io/wap-import/eigen.ts', ALT_INHALT);
      commitAlles(sb, root, 'Eigen');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('src/io/wap-import/eigen.ts');
    },
    MITTEL,
  );

  it(
    '[R-H-14] (4) Liste fehlt → rot mit Ursache',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb, 'fehlt');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('legacy-modules.json');
    },
    MITTEL,
  );

  it(
    '[R-H-14] Liste unlesbar (kein JSON) → rot mit Ursache',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'scripts/wap-gate/legacy-modules.json', '{ kaputt');
      commitAlles(sb, root, 'Kaputt');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('legacy-modules.json');
    },
    MITTEL,
  );
});

describe('checkTypes: strikte WAP-Prüfung und Suite-Prüfung', () => {
  it(
    '[R-H-14] ohne Fehler → grün, nichts verworfen',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(
        root,
        ALT,
        'export function erstes(liste: { x: number }[]): number {\n  return liste.length;\n}\n',
      );
      writeText(
        root,
        'scripts/wap-gate/legacy-modules.json',
        `${JSON.stringify({ version: 1, dateien: [{ pfad: ALT, sha256: sha256Lf('export function erstes(liste: { x: number }[]): number {\n  return liste.length;\n}\n') }] }, null, 2)}\n`,
      );
      commitAlles(sb, root, 'Sauber');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(true);
      expect(r.verworfen).toEqual([]);
    },
    MITTEL,
  );

  it.each([
    [
      'exactOptionalPropertyTypes',
      'interface O {\n  a?: number;\n}\nexport const o: O = { a: undefined };\n',
    ],
    [
      'noImplicitOverride',
      'class A {\n  f(): number {\n    return 1;\n  }\n}\nexport class B extends A {\n  f(): number {\n    return 2;\n  }\n}\n',
    ],
    [
      'noFallthroughCasesInSwitch',
      'export function g(n: number): number {\n  let r = 0;\n  switch (n) {\n    case 1:\n      r = 1;\n    case 2:\n      r = 2;\n      break;\n  }\n  return r;\n}\n',
    ],
    [
      'noImplicitReturns',
      'export function h(n: number) {\n  if (n > 0) {\n    return n;\n  }\n}\n',
    ],
  ])(
    '[R-H-14] Verstoss gegen %s in einer WAP-Datei → rot (tsconfig.wap.json strenger als die Suite)',
    async (option, inhalt) => {
      const sb = neueSandbox();
      const root = repo(sb);
      const datei = `src/model/wap/zz-${option}.ts`;
      writeText(root, datei, inhalt);
      commitAlles(sb, root, option);
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(datei);
    },
    MITTEL,
  );

  it(
    '[R-H-14] strenger Fehler in einer von WAP importierten Suite-Datei → nicht gewertet (nur Suite-Regeln); grün',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/model/suite-hilfe.ts', ALT_INHALT);
      writeText(
        root,
        'src/io/wap-import/suite-nutzer.ts',
        "import { erstes } from '../../model/suite-hilfe';\n\nexport const w: number = erstes([{ x: 2 }]);\n",
      );
      commitAlles(sb, root, 'Suite-Import');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(true);
      expect(schrittText(r)).not.toContain('src/model/suite-hilfe.ts');
    },
    MITTEL,
  );

  it(
    '[R-H-14] Typfehler nach Suite-Regeln in einer Suite-Datei → rot über die Suite-Prüfung',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/components/Suite.ts', "export const s: number = 'x';\n");
      commitAlles(sb, root, 'Suite-Fehler');
      const { checkTypes } = await typecheck();
      const r = await checkTypes({ cwd: root });
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('src/components/Suite.ts');
    },
    MITTEL,
  );
});

describe('legacyUnchanged', () => {
  it('[R-H-14] SHA-256 über LF: gleicher Inhalt mit CRLF gilt als unverändert, geänderte Datei nicht', async () => {
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'alt');
    const a = 'export const a = 1;\nexport const b = 2;\n';
    const b = 'export const c = 3;\n';
    writeText(root, 'src/io/xlsx-drawing/a.ts', a.replace(/\n/g, '\r\n'));
    writeText(root, 'src/io/xlsx-drawing/b.ts', `${b}// geändert\n`);
    writeText(
      root,
      'scripts/wap-gate/legacy-modules.json',
      `${JSON.stringify(
        {
          version: 1,
          dateien: [
            { pfad: 'src/io/xlsx-drawing/a.ts', sha256: sha256Lf(a) },
            { pfad: 'src/io/xlsx-drawing/b.ts', sha256: sha256Lf(b) },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const { legacyUnchanged } = await legacy();
    const r = await legacyUnchanged({ cwd: root });
    expect(r).toEqual([
      { pfad: 'src/io/xlsx-drawing/a.ts', unveraendert: true },
      { pfad: 'src/io/xlsx-drawing/b.ts', unveraendert: false },
    ]);
  });

  it('[R-H-14] Liste über opts.liste an anderer Stelle; fehlende gelistete Datei gilt als verändert', async () => {
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'alt2');
    const liste = writeText(
      root,
      'andere/liste.json',
      `${JSON.stringify({ version: 1, dateien: [{ pfad: 'src/io/xlsx-drawing/weg.ts', sha256: sha256Lf('x\n') }] })}\n`,
    );
    const { legacyUnchanged } = await legacy();
    const r = await legacyUnchanged({ cwd: root, liste });
    expect(r).toEqual([{ pfad: 'src/io/xlsx-drawing/weg.ts', unveraendert: false }]);
  });
});

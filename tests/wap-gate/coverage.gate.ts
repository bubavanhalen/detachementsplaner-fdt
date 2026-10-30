// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// V2 Abdeckung (ADR-010 §6): Zweigabdeckung ≥ 90 % (Fachlogik, Layout, Prüfregeln, Import) bzw. ≥ 75 %
// (übriger WAP-Code), je Pfadmenge und je Modulordner, Vitest und E2E zusammengeführt; Ausnahmen nur
// reine Typdateien.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkCoverage, CoverageSchwellen).
// Istanbul-Datensätze (coverage-final.json) von Hand mit bekannten Zweigzahlen erzeugt.
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  neueSandbox,
  type Sandbox,
  schrittText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { type CoverageSchwellen, coverage } from './support/vertrag';

afterEach(aufraeumen);

const SCHWELLEN: CoverageSchwellen = {
  mengen: [
    {
      name: 'fachlogik',
      muster: ['src/model/wap/**', 'src/io/wap-import/**', 'src/io/xlsx-drawing/**'],
      zweige: 90,
    },
    {
      name: 'uebrig',
      muster: [
        'src/io/wap-plan/**',
        'src/io/wap-pdf/**',
        'src/io/wap-persons/**',
        'src/components/wap/**',
        'src/pages/WapPage.tsx',
        'src/assets/wap-fonts/**',
        'tools/wap/**',
      ],
      zweige: 75,
    },
  ],
  jeModul: true,
  ausnahmen: ['**/types.ts', '**/*.d.ts'],
};

const ORT = { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } };

/** Istanbul-Eintrag einer Datei mit `zweige` Zweigpaaren; `getroffen` je Zweigort (Länge 2 × zweige). */
function datei(pfad: string, getroffen: number[]): Record<string, unknown> {
  const branchMap: Record<string, unknown> = {};
  const b: Record<string, number[]> = {};
  for (let i = 0; i < getroffen.length / 2; i++) {
    branchMap[String(i)] = { loc: ORT, type: 'if', locations: [ORT, ORT], line: i + 1 };
    b[String(i)] = [getroffen[2 * i] ?? 0, getroffen[2 * i + 1] ?? 0];
  }
  return {
    path: pfad,
    statementMap: { '0': ORT },
    fnMap: {},
    branchMap,
    s: { '0': 1 },
    f: {},
    b,
  };
}

/** Zweigorte: anzahl insgesamt, davon gedeckt getroffen (Rest 0). */
function orte(anzahl: number, gedeckt: number): number[] {
  return Array.from({ length: anzahl }, (_, i) => (i < gedeckt ? 1 : 0));
}

function istanbul(sb: Sandbox, name: string, dateien: Array<[string, number[]]>): string {
  const daten: Record<string, unknown> = {};
  for (const [pfad, g] of dateien) daten[pfad] = datei(pfad, g);
  // Repo-Wurzel (cwd) = Sandbox; Standard-Altmodul-Liste leer, sofern ein Test keine eigene schreibt.
  if (!existsSync(join(sb.base, 'scripts', 'wap-gate', 'legacy-modules.json'))) {
    writeText(sb.base, 'scripts/wap-gate/legacy-modules.json', LISTE([]));
  }
  return writeText(sb.base, `${name}.json`, `${JSON.stringify(daten, null, 2)}\n`);
}

function LISTE(dateien: { pfad: string; sha256: string }[]): string {
  return `${JSON.stringify({ version: 1, dateien }, null, 2)}\n`;
}

/** cwd = Ordner der Istanbul-Datensätze (Sandbox-Wurzel, Vertrag §9 Nr 3). */
async function pruefe(dateien: string[], legacyListe?: string) {
  const { checkCoverage } = await coverage();
  const cwd = dirname(dateien[0] ?? '.');
  return checkCoverage({
    cwd,
    istanbulDateien: dateien,
    schwellen: SCHWELLEN,
    ...(legacyListe ? { legacyListe } : {}),
  });
}

describe('checkCoverage: Schwellen je Pfadmenge', () => {
  it('[R-H-16] Fachlogik genau 90 % (9 von 10 Zweigorten) → grün (Grenze)', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [['src/model/wap/a.ts', orte(10, 9)]]);
    expect((await pruefe([f])).ok).toBe(true);
  });

  it('[R-H-16] Beispielmodul der Fachlogik unter der Schwelle (8 von 10) → rot mit Modul', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [['src/model/wap/a.ts', orte(10, 8)]]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/model/wap');
  });

  it('[R-H-16] übriger WAP-Code genau 75 % (3 von 4) → grün; 2 von 4 → rot', async () => {
    const sb = neueSandbox();
    const gut = istanbul(sb, 'gut', [['src/io/wap-plan/datei.ts', orte(4, 3)]]);
    expect((await pruefe([gut])).ok).toBe(true);
    const schlecht = istanbul(sb, 'schlecht', [['src/io/wap-plan/datei.ts', orte(4, 2)]]);
    const r = await pruefe([schlecht]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/io/wap-plan');
  });

  it('[R-H-16] 80 % im Import (Fachlogik-Menge, 90-%-Schwelle) → rot, obwohl ≥ 75 %', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [['src/io/wap-import/lesen.ts', orte(10, 8)]]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/io/wap-import');
  });
});

describe('checkCoverage: je Modul und Zusammenführung', () => {
  it('[R-H-16] grosses Modul 100 %, kleines Modul 50 % in derselben Pfadmenge (gesamt ≥ 90 %) → rot wegen des Moduls', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [
      ['src/model/wap/plan.ts', orte(200, 200)],
      ['src/model/wap/checks/regel.ts', orte(2, 1)],
    ]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/model/wap/checks');
  });

  it('[R-H-16] Vitest und E2E decken je einen anderen Zweigort derselben Datei → zusammengeführt grün, einzeln rot', async () => {
    const sb = neueSandbox();
    const vitest = istanbul(sb, 'vitest', [['src/components/wap/Ansicht.tsx', [1, 0, 1, 0]]]);
    const e2e = istanbul(sb, 'e2e', [['src/components/wap/Ansicht.tsx', [0, 1, 0, 1]]]);
    expect((await pruefe([vitest])).ok).toBe(false);
    expect((await pruefe([e2e])).ok).toBe(false);
    expect((await pruefe([vitest, e2e])).ok).toBe(true);
  });

  it('[R-H-16] reine Typdatei (ohne Zweigorte) → ausgenommen; Suite-Datei ausserhalb der Mengen → nicht gewertet', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [
      ['src/model/wap/a.ts', orte(10, 10)],
      ['src/model/wap/types.ts', []],
      ['src/components/Andere.tsx', orte(4, 0)],
    ]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(true);
    expect((r.details as { typAusnahmen?: number }).typAusnahmen).toBe(1);
  });

  it('[R-H-16] Datei nach Ausnahmemuster types.ts mit ausführbaren Zweigen → gewertet (nur reine Typdateien ausgenommen, ADR-010 §6.2)', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [
      ['src/model/wap/a.ts', orte(10, 10)],
      ['src/model/wap/x/types.ts', orte(4, 0)],
    ]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/model/wap/x');
  });

  it('[R-H-16] Bericht nennt je Pfadmenge und Modul gedeckt, gesamt und Prozent', async () => {
    const sb = neueSandbox();
    const f = istanbul(sb, 'v', [
      ['src/model/wap/a.ts', orte(10, 9)],
      ['src/io/wap-plan/b.ts', orte(4, 4)],
    ]);
    const r = await pruefe([f]);
    const d = r.details as {
      mengen: { name: string; gedeckt: number; gesamt: number; prozent: number }[];
      module: { modul: string; gedeckt: number; gesamt: number }[];
    };
    expect(d.mengen.map((m) => [m.name, m.gedeckt, m.gesamt, m.prozent])).toEqual([
      ['fachlogik', 9, 10, 90],
      ['uebrig', 4, 4, 100],
    ]);
    expect(d.module.map((m) => [m.modul, m.gedeckt, m.gesamt])).toEqual([
      ['src/io/wap-plan', 4, 4],
      ['src/model/wap', 9, 10],
    ]);
  });

  it('[R-H-16] fehlender Istanbul-Datensatz → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const r = await pruefe([join(sb.base, 'gibt-es-nicht.json')]);
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });
});

describe('checkCoverage: Altmodule (Vertrag §9 Nr 3, wie §6a für F6)', () => {
  const ALT = 'src/io/xlsx-drawing/zip.ts';
  const INHALT = 'export const z = (a: number): number => (a > 0 ? 1 : 2);\n';

  function altRepo(sb: Sandbox, liste: 'stimmt' | 'fehlt'): void {
    writeText(sb.base, ALT, INHALT);
    if (liste === 'stimmt') {
      writeText(
        sb.base,
        'scripts/wap-gate/legacy-modules.json',
        LISTE([{ pfad: ALT, sha256: sha256Lf(INHALT) }]),
      );
    }
  }

  it('[R-H-16] (a) gelistete Datei mit stimmendem SHA-256 und 0 % → ausgenommen, grün, details nennt sie', async () => {
    const sb = neueSandbox();
    altRepo(sb, 'stimmt');
    const f = istanbul(sb, 'v', [
      [ALT, orte(4, 0)],
      ['src/io/xlsx-drawing/neu.ts', orte(10, 10)],
    ]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.details ?? null)).toContain(ALT);
  });

  it('[R-H-16] (a) absoluter Istanbul-Pfad innerhalb von cwd wird wie der relative gewertet', async () => {
    const sb = neueSandbox();
    altRepo(sb, 'stimmt');
    const f = istanbul(sb, 'v', [[join(sb.base, ...ALT.split('/')), orte(4, 0)]]);
    expect((await pruefe([f])).ok).toBe(true);
  });

  it('[R-H-16] (b) dieselbe Datei um eine Zeile geändert → nicht ausgenommen, rot mit Modul', async () => {
    const sb = neueSandbox();
    altRepo(sb, 'stimmt');
    writeText(sb.base, ALT, `// geändert\n${INHALT}`);
    const f = istanbul(sb, 'v', [[ALT, orte(4, 0)]]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/io/xlsx-drawing');
  });

  it('[R-H-16] (c) nicht gelistete Datei mit 0 % → rot', async () => {
    const sb = neueSandbox();
    altRepo(sb, 'stimmt');
    writeText(sb.base, 'src/io/xlsx-drawing/andere.ts', INHALT);
    const f = istanbul(sb, 'v', [['src/io/xlsx-drawing/andere.ts', orte(4, 0)]]);
    const r = await pruefe([f]);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('src/io/xlsx-drawing');
  });

  it('[R-H-16] (d) Liste fehlt → rot mit Ursache; Liste über legacyListe an anderer Stelle → grün', async () => {
    const sb = neueSandbox();
    altRepo(sb, 'fehlt');
    const f = istanbul(sb, 'v', [['src/model/wap/a.ts', orte(10, 10)]]);
    rmSync(join(sb.base, 'scripts', 'wap-gate', 'legacy-modules.json'));
    const ohne = await pruefe([f]);
    expect(ohne.ok).toBe(false);
    expect(ohne.ursache ?? '').toContain('legacy-modules.json');
    const andere = writeText(
      sb.base,
      'andere/liste.json',
      LISTE([{ pfad: ALT, sha256: sha256Lf(INHALT) }]),
    );
    const f2 = istanbul(sb, 'w', [[ALT, orte(4, 0)]]);
    rmSync(join(sb.base, 'scripts', 'wap-gate', 'legacy-modules.json'));
    expect((await pruefe([f2], andere)).ok).toBe(true);
  });

  it('[R-H-16] absoluter Pfad ausserhalb von cwd → nicht gewertet', async () => {
    const sb = neueSandbox();
    const fremd = join(dirname(sb.base), 'fremd-ausserhalb', 'src', 'model', 'wap', 'x.ts');
    const f = istanbul(sb, 'v', [
      ['src/model/wap/a.ts', orte(10, 10)],
      [fremd, orte(10, 0)],
    ]);
    expect((await pruefe([f])).ok).toBe(true);
  });
});

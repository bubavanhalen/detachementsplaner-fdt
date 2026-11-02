// Paket F-TOOLS, FT-A-02 (Koordinator 20.10.2026): E2E-Anteil der Abdeckung V2 (R-H-16, ADR-010 §6.1 b).
// scripts/wap-gate/coverage-e2e.mjs rechnet die von wapPage abgelegte V8-Abdeckung mit demselben Umrechner wie
// Vitest (ast-v8-to-istanbul) um; coverage-check.mjs führt Vitest und E2E je Zweigort über die Lage zusammen.
// Fiktives Modul und von Hand gebaute V8-Daten in einem temporären Ordner.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aufraeumen, junction, ladeModul, neueSandbox, WT, writeText } from './support/umgebung';
import { coverage } from './support/vertrag';

afterEach(aufraeumen);

interface E2eModul {
  quellPfad(root: string, pfad: string): string | null;
  rechneUm(opts: {
    cwd: string;
    muster: string[];
  }): Promise<{ ok: boolean; dateien: number; tests: number; grund?: string }>;
  E2E_ROH: string;
  E2E_ISTANBUL: string;
}

const modul = () => ladeModul<E2eModul>('scripts/wap-gate/coverage-e2e.mjs');

/** Modul mit einem if; V8-Daten: Funktion f aufgerufen, nur der Zweig «a wahr» ausgeführt. */
const CODE = 'export function f(a) {\n  if (a) {\n    return 1;\n  }\n  return 2;\n}\n';

function v8Eintrag(url: string, elseGelaufen: boolean) {
  const ifBlock = CODE.indexOf('{\n    return 1;');
  const nachIf = CODE.indexOf('  return 2;');
  return {
    url,
    scriptId: '1',
    source: CODE,
    functions: [
      {
        functionName: '',
        isBlockCoverage: true,
        ranges: [{ startOffset: 0, endOffset: CODE.length, count: 1 }],
      },
      {
        functionName: 'f',
        isBlockCoverage: true,
        ranges: [
          {
            startOffset: CODE.indexOf('function f'),
            endOffset: CODE.lastIndexOf('}') + 1,
            count: 1,
          },
          ...(elseGelaufen
            ? [{ startOffset: ifBlock, endOffset: nachIf - 1, count: 0 }]
            : [{ startOffset: nachIf, endOffset: CODE.lastIndexOf('}'), count: 0 }]),
        ],
      },
    ],
  };
}

describe('coverage-e2e.mjs', () => {
  it('[R-H-16] quellPfad: URL des Entwicklungsservers mit Abfrage, /@fs/-Pfad und absoluter Pfad → repo-relativ; ausserhalb von src/ → null', async () => {
    const { quellPfad } = await modul();
    const root = 'C:/fiktiv/repo';
    expect(quellPfad(root, 'http://127.0.0.1:43001/src/components/wap/i2/A.tsx?t=1')).toBe(
      'src/components/wap/i2/A.tsx',
    );
    expect(quellPfad(root, '/@fs/C:/fiktiv/repo/src/model/wap/time.ts')).toBe(
      'src/model/wap/time.ts',
    );
    expect(quellPfad(root, 'C:\\fiktiv\\repo\\src\\io\\wap-plan\\x.ts')).toBe(
      'src/io/wap-plan/x.ts',
    );
    expect(quellPfad(root, 'http://127.0.0.1:43001/node_modules/.vite/deps/react.js')).toBeNull();
  });

  it('[R-H-16] rechneUm: V8-Daten je Test → Istanbul-Datensatz mit Zählern je Zweig, über Tests summiert; Quellen ausserhalb der Pfadmengen fehlen', async () => {
    const { rechneUm, E2E_ROH, E2E_ISTANBUL } = await modul();
    const sb = neueSandbox();
    writeText(sb.base, 'src/model/wap/fiktiv.ts', CODE);
    writeText(sb.base, 'src/andere/fiktiv.ts', CODE);
    const basis = 'http://127.0.0.1:43001';
    writeText(
      sb.base,
      `${E2E_ROH}/a.json`,
      JSON.stringify([
        v8Eintrag(`${basis}/src/model/wap/fiktiv.ts`, false),
        v8Eintrag(`${basis}/src/andere/fiktiv.ts`, false),
      ]),
    );
    writeText(
      sb.base,
      `${E2E_ROH}/b.json`,
      JSON.stringify([v8Eintrag(`${basis}/src/model/wap/fiktiv.ts`, true)]),
    );
    // node_modules des Paket-Worktrees (Umrechner, Vite) über einen Verweis
    junction(join(sb.base, 'node_modules'), join(WT, 'node_modules'));
    const r = await rechneUm({ cwd: sb.base, muster: ['src/model/wap/**'] });
    expect(r.ok, r.grund).toBe(true);
    expect(r.tests).toBe(2);
    const daten = JSON.parse(
      readFileSync(join(sb.base, ...E2E_ISTANBUL.split('/')), 'utf8'),
    ) as Record<string, { b: Record<string, number[]> }>;
    expect(Object.keys(daten)).toEqual(['src/model/wap/fiktiv.ts']);
    const zweige = Object.values(daten['src/model/wap/fiktiv.ts']?.b ?? {}).flat();
    expect(zweige.length).toBe(2);
    expect(zweige.every((n) => n > 0)).toBe(true);
  });

  it('[R-H-16] checkCoverage führt Vitest und E2E mit verschiedenen Zweig-IDs über die Lage zusammen: einzeln je 50 %, zusammen 100 %', async () => {
    const { checkCoverage } = await coverage();
    const sb = neueSandbox();
    writeText(sb.base, 'scripts/wap-gate/legacy-modules.json', '{"version":1,"dateien":[]}\n');
    const lage = (l: number, c: number) => ({
      start: { line: l, column: c },
      end: { line: l, column: c + 5 },
    });
    const eintrag = (id: string, treffer: number[]) => ({
      path: 'src/io/wap-plan/x.ts',
      statementMap: {},
      fnMap: {},
      s: {},
      f: {},
      branchMap: { [id]: { type: 'if', loc: lage(2, 2), locations: [lage(2, 2), lage(4, 2)] } },
      b: { [id]: treffer },
    });
    const v = writeText(
      sb.base,
      'v.json',
      JSON.stringify({ 'src/io/wap-plan/x.ts': eintrag('0', [1, 0]) }),
    );
    const e = writeText(
      sb.base,
      'e.json',
      JSON.stringify({ 'src/io/wap-plan/x.ts': eintrag('7', [0, 3]) }),
    );
    const schwellen = {
      mengen: [{ name: 'uebrig', muster: ['src/io/wap-plan/**'], zweige: 75 }],
      jeModul: true as const,
      ausnahmen: [],
    };
    expect(checkCoverage({ cwd: sb.base, istanbulDateien: [v], schwellen }).ok).toBe(false);
    expect(checkCoverage({ cwd: sb.base, istanbulDateien: [e], schwellen }).ok).toBe(false);
    const beide = checkCoverage({ cwd: sb.base, istanbulDateien: [v, e], schwellen });
    expect(beide.ok).toBe(true);
    expect(JSON.stringify(beide.details)).toContain('"gedeckt":2,"gesamt":2');
  });
});

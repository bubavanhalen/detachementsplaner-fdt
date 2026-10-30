// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Ende-zu-Ende-Fälle unverändert aus
// red-phase-eigenschaft.gate.ts verschoben, weil sie die schnelle Schleuse ausführen (Entscheid Orchestrator).

// Rot-Phase bei Eigenschaftstests mit fast-check (Nachtrag E1-01, Stufe B; ADR-010 §3.3, Prompt §7
// «Property-basierte Tests»): Ein Eigenschaftstest des Pakets, der am Vertrags-Stub des Pakets scheitert, ist
// fachlich rot, auch wenn fast-check den Fehler in seinen Bericht einbettet; ein Typfehler bleibt rot.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (runGate).
// Die schnelle Schleuse läuft in einem Mini-Repo mit echtem Vitest, echtem fast-check und der WAP-Vitest-Hilfe
// aus dem Paket-Worktree, mit eingespeistem `last` (temporäres commonDir, nie die gemeinsame Sperre, Vertrag
// AE-001 §2). Nur fiktive Daten.
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  git,
  kopiereAusWt,
  MITTEL,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { gate, type Schritt, schrittMit } from './support/vertrag';

afterEach(aufraeumen);

const PAKET = 'p9';
const ID = 'R-9-99';
const STUB = 'paket.modul.f';
/** Fester Startwert der Eigenschaftstests (Prompt §7). */
const SEED = 20_261_004;

/**
 * Mini-Repo auf wap/p9 in der Rot-Phase (Kästchen 6 erledigt, 7 offen), ID R-9-99 im Plan, Stub-Name im
 * Vertrag des Pakets, echte WAP-Vitest-Konfiguration und -Hilfe aus dem Paket-Worktree (vitest.wap.config.ts,
 * tests/wap/support/common/vitest-setup.ts, tests/setup.ts, scripts/wap-gate/), ein Eigenschaftstest des Pakets
 * (Standardumgebung jsdom, ohne Kopfzeile) mit
 * `praedikat` und ein fremder grüner Eigenschaftstest.
 */
function miniRotPhase(sb: Sandbox, name: string, praedikat: string): string {
  prozessUmgebung(sb);
  const root = miniRepo(sb, name, 'wap-planer');
  nodeModules(root);
  kopiereAusWt(root, 'vitest.wap.config.ts');
  kopiereAusWt(root, 'tests/wap/support/common/vitest-setup.ts');
  // Suite-Hilfen, die die WAP-Hilfe in jsdom lädt (Probe-Test ohne Umgebungs-Kopfzeile, E1-01-23).
  kopiereAusWt(root, 'tests/setup.ts');
  cpSync(join(WT, 'scripts', 'wap-gate'), join(root, 'scripts', 'wap-gate'), { recursive: true });
  commitAlles(sb, root, 'Konfiguration');
  git(sb, root, 'checkout', '-q', '-b', `wap/${PAKET}`);
  writeText(
    root,
    'docs/wap-planer/pakete/P9.md',
    `# Paket P9 – fiktiv\n\n- Etappe: 1\n- Anforderungen: ${ID}\n\n- [x] 6 Test-Freeze\n- [ ] 7 Umsetzung\n`,
  );
  writeText(
    root,
    'docs/wap-planer/plan/etappe-1.md',
    `# Plan (fiktiv)\n\n## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)\n\n| ID | Paket | Testart | Verweis auf | Hinweis |\n| --- | --- | --- | --- | --- |\n| ${ID} | P9 | Property | – | – |\n`,
  );
  writeText(
    root,
    'docs/wap-planer/plan/vertraege/P9.md',
    `# Vertrag P9 (fiktiv)\n\n## 1 Signaturen\n\n\`export function f(n: number): number;\`\n\n## 5 Stub-Namen\n\n\`${STUB}\`\n`,
  );
  writeText(
    root,
    'src/p9/modul.ts',
    `// Vertrags-Stub (fiktiv).\nexport function f(_n: number): number {\n  throw new Error('nicht implementiert: ${STUB}');\n}\n`,
  );
  writeText(
    root,
    'tests/wap/unit/p9-eigenschaft.test.ts',
    [
      "import fc from 'fast-check';",
      "import { describe, expect, it } from 'vitest';",
      "import { f } from '../../../src/p9/modul';",
      '',
      "describe('P9 fiktiv', () => {",
      `  it('[${ID}] Eigenschaft gegen den Stub', () => {`,
      '    fc.assert(',
      '      fc.property(fc.integer({ min: 0, max: 50 }), (n) => {',
      `        ${praedikat}`,
      '      }),',
      `      { seed: ${String(SEED)} },`,
      '    );',
      '  });',
      '',
      "  it('[R-1-01] fremde Eigenschaft grün', () => {",
      `    fc.assert(fc.property(fc.integer(), (n) => n === n), { seed: ${String(SEED)} });`,
      '  });',
      '});',
      '',
    ].join('\n'),
  );
  commitAlles(sb, root, 'Paket P9 in der Rot-Phase');
  return root;
}

async function f8In(sb: Sandbox, root: string): Promise<Schritt> {
  const { runGate } = await gate();
  const e = await runGate('fast', { cwd: root, last: testLast(sb).last });
  const s = schrittMit(e, 'F8');
  expect(s, 'Schritt F8 fehlt').toBeDefined();
  return s as Schritt;
}

describe('Ende-zu-Ende: schnelle Schleuse F8 mit echtem fast-check und der WAP-Vitest-Hilfe', () => {
  it(
    '[R-H-12] (e) Eigenschaftstest des Pakets scheitert am Vertrags-Stub des Pakets, fremder Test grün → F8 grün (Rot-Phase eingehalten)',
    async () => {
      const sb = neueSandbox();
      const root = miniRotPhase(sb, 'mini-stub', 'expect(f(n)).toBe(n);');
      const s = await f8In(sb, root);
      expect(s.ok, schrittText(s)).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-12] (e) Eigenschaftstest des Pakets scheitert an einem TypeError → F8 rot mit dem Testnamen',
    async () => {
      const sb = neueSandbox();
      const root = miniRotPhase(
        sb,
        'mini-typ',
        'const o = undefined as unknown as { x: { y: number } };\n        expect(o.x.y).toBe(f.length + n);',
      );
      const s = await f8In(sb, root);
      expect(s.ok).toBe(false);
      expect(schrittText(s)).toContain('Eigenschaft gegen den Stub');
    },
    MITTEL,
  );
});

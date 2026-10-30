// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): runSelftest baut die Verstösse in einen temporären Worktree
// ein und führt jeweils die zuständige Schleuse aus.
// Selbsttest der Schleusen (Prompt §5.3 Punkt 2, ADR-010 §3.5): S1–S5 und Zusatzfälle machen die
// zuständige Schleuse rot mit dem richtigen Grund; Protokoll mit erwartetem und erkanntem Grund.
// E1-01-min (Vertrag E1-01, Änderungsnotiz AE-001 §1: §9 Nr 13 nur S1–S5 und Zusatzfälle ohne Lizenz-,
// Browser- und Leistungsbezug); Z-lizenztext kommt mit E1-01e (Entwurf selftest-lizenz.selbsttest.entwurf.ts).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1 (wap:gate:selftest), §2 (runSelftest), §8, §9 Nr 13;
// direkte Aufrufe mit `last` (temporäres commonDir, keine fremden Prozesse, CPU-Last 0), AE-001 §2.
// Die Sperrliste ist die fiktive Testliste (WAP_REFERENCE_DIR).
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import {
  aufraeumen,
  LANG,
  neueSandbox,
  node,
  prozessUmgebung,
  SEHR_LANG,
  WT,
} from './support/umgebung';
import { selftest } from './support/vertrag';

afterEach(aufraeumen);

const AHV_MUSTER = /756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}/;

/** Verstösse von E1-01-min mit der erwarteten Schleuse bzw. dem Schritt (ADR-010 §3.5, Vertrag §9 Nr 13). */
const MIN_VERSTOESSE: Array<[string, RegExp[]]> = [
  ['S1', [/F4/, /F5/]],
  ['S2', [/F4/]],
  ['S3a', [/Hook|guard-edit/]],
  ['S3b', [/F2/]],
  ['S4', [/F3/]],
  ['S5', [/F9/]],
  ['Z-only', [/F4|F5/]],
  ['Z-console', [/F4|F5/]],
  ['Z-any', [/F4|F5/]],
  ['Z-biome-ignore', [/F4/]],
  ['Z-suite-datei', [/F7/]],
  ['Z-referenz-fehlt', [/V3/]],
  ['Z-fremde-id', [/F9/]],
  ['Z-ungesperrt', [/F7/]],
  ['Z-name-v11', [/V11/]],
  ['Z-python2', [/V10-python/]],
];

type Eintrag = { verstoss: string; erwartet: string; erkannt: string | null; ok: boolean };

function eintraege(liste: Eintrag[], s: string): Eintrag[] {
  return liste.filter((x) => new RegExp(`^${s}(?![0-9a-z])`, 'i').test(x.verstoss));
}

describe('runSelftest (S1–S5 und Zusatzfälle von E1-01-min)', () => {
  it(
    '[R-H-31][R-H-13][R-H-15][R-H-24][R-H-34][R-H-28] alle Verstösse erkannt: S1 (F4, F5), S2 (F4), S3a (Hook), S3b (F2), S4 (F3, maskiert), S5 (F9), Zusatzfälle je genau einmal mit erwarteter Schleuse',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { runSelftest } = await selftest();
      const liste = await runSelftest({ cwd: WT, last: testLast(sb).last });
      const nichtErkannt = liste
        .filter((x) => !x.ok)
        .map((x) => `${x.verstoss}: erwartet ${x.erwartet}, erkannt ${x.erkannt ?? '–'}`);
      expect(nichtErkannt).toEqual([]);
      for (const x of liste) expect((x.erkannt ?? '').length, x.verstoss).toBeGreaterThan(0);
      for (const [name, muster] of MIN_VERSTOESSE) {
        const e = eintraege(liste, name);
        expect(e.length, `Verstoss ${name} nicht genau einmal im Protokoll`).toBe(1);
        for (const m of muster) expect(e[0]?.erwartet, name).toMatch(m);
        expect(e[0]?.ok, name).toBe(true);
      }
      expect(JSON.stringify(liste)).not.toMatch(AHV_MUSTER);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-31] --nur S5,S2: genau diese beiden Verstösse, alle erkannt',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { runSelftest } = await selftest();
      const liste = await runSelftest({ cwd: WT, nur: ['S5', 'S2'], last: testLast(sb).last });
      expect(liste.map((x) => x.verstoss.slice(0, 2)).sort()).toEqual(['S2', 'S5']);
      expect(liste.every((x) => x.ok)).toBe(true);
    },
    LANG,
  );
});

describe('selftest.mjs als CLI', () => {
  it(
    '[R-H-31][R-H-24] --nur S4: Exit 0, Protokoll nennt S4 und den erkannten Grund, AHV-Nummer maskiert',
    () => {
      const sb = neueSandbox();
      const r = node(join(WT, 'scripts', 'wap-gate', 'selftest.mjs'), ['--nur', 'S4'], {
        cwd: WT,
        env: sb.env,
        timeout: LANG,
      });
      expect(r.status).toBe(0);
      expect(r.out).toContain('S4');
      expect(r.out).toContain('F3');
      expect(r.out).not.toMatch(AHV_MUSTER);
    },
    LANG,
  );
});

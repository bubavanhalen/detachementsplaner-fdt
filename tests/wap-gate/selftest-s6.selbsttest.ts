// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Verstoss S6 «Schrift unter der Mindestgrösse im PDF» (ADR-010
// §3.5, Änderungsnotiz AE-001 §1 «S6 belegt zuerst E1-01b mit [R-H-19]»). runSelftest legt im Klon
// test-results/wap/pdf/s6-probe.pdf mit einem Textlauf in 4 pt (eingebettete Liberation-Schrift) an und
// führt nur V5 aus; erkannt ist S6, wenn die Ursache «Schrift unter Mindestgrösse» und s6-probe.pdf nennt.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 «S6»; E1-01 §2 (runSelftest), §9 Nr 13.
// Direkte Aufrufe mit `last` (temporäres commonDir, keine fremden Prozesse, CPU-Last 0), AE-001 §2.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  arbeitsstandKlon,
  aufraeumen,
  KURZ,
  LANG,
  neueSandbox,
  node,
  prozessUmgebung,
  WT,
} from './support/umgebung';
import { selftest } from './support/vertrag';

afterEach(aufraeumen);

describe('runSelftest --nur S6', () => {
  it(
    '[R-H-19] als Funktion: genau ein Eintrag S6, erwartet V5-ebene2, erkannt mit «Schrift unter Mindestgrösse» und s6-probe.pdf',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { runSelftest } = await selftest();
      const ergebnis = await runSelftest({ cwd: WT, nur: ['S6'], last: testLast(sb).last }).then(
        (liste) => ({ liste, fehler: null }),
        (e: unknown) => ({ liste: [], fehler: e instanceof Error ? e.message : String(e) }),
      );
      expect(ergebnis.fehler, 'runSelftest mit --nur S6 warf').toBeNull();
      expect(ergebnis.liste.map((x) => x.verstoss)).toEqual(['S6']);
      const s6 = ergebnis.liste[0];
      expect(s6?.erwartet).toContain('V5-ebene2');
      expect(s6?.ok, s6?.erkannt ?? '').toBe(true);
      expect(s6?.erkannt ?? '').toContain('Schrift unter Mindestgrösse');
      expect(s6?.erkannt ?? '').toContain('s6-probe.pdf');
    },
    LANG,
  );

  it(
    '[R-H-19] über die CLI im Klon des Arbeitsstands (eigenes Git-Verzeichnis, nie die gemeinsame Sperre): Exit 0, Protokoll nennt S6, V5-ebene2 und s6-probe.pdf',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      const r = node(join(k.root, 'scripts', 'wap-gate', 'selftest.mjs'), ['--nur', 'S6'], {
        cwd: k.root,
        env: sb.env,
        timeout: LANG,
      });
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('S6');
      expect(r.out).toContain('V5-ebene2');
      expect(r.out).toContain('s6-probe.pdf');
    },
    LANG,
  );

  it(
    '[R-H-19] unbekannter --nur-Name → Exit 1; die Liste der gültigen Namen enthält S6 (Standardliste)',
    () => {
      const sb = neueSandbox();
      const mini = miniRepo(sb);
      const env: NodeJS.ProcessEnv = { ...sb.env };
      delete env.WAP_GATE_SPERRE;
      const r = node(
        join(WT, 'scripts', 'wap-gate', 'selftest.mjs'),
        ['--nur', 'Z-gibt-es-nicht'],
        {
          cwd: mini,
          env,
          timeout: KURZ,
        },
      );
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/\bS6\b/);
    },
    KURZ,
  );
});

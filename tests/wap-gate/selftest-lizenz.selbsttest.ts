// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Selbsttest «Lizenztext entfernt → rot» (R-H-23 Kriterium 2, Vertrag E1-01 §9 Nr 13 «Z-lizenztext»): Build im Klon,
// danach der Block von react-dom aus der Einzeldatei entfernt → V10-lizenztexte rot.
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { aufraeumen, neueSandbox, prozessUmgebung, SEHR_LANG, WT } from './support/umgebung';
import { selftest } from './support/vertrag';

afterEach(aufraeumen);

describe('runSelftest: Zusatzfall Z-lizenztext (F-TOOLS)', () => {
  it(
    '[R-H-23][R-H-31] --nur Z-lizenztext: Lizenztext einer gebündelten Abhängigkeit entfernt → V10-lizenztexte rot',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { runSelftest } = await selftest();
      const liste = await runSelftest({ cwd: WT, nur: ['Z-lizenztext'], last: testLast(sb).last });
      expect(liste.length).toBe(1);
      expect(liste[0]?.erwartet).toMatch(/V10-lizenztexte/);
      expect(liste[0]?.ok).toBe(true);
    },
    SEHR_LANG,
  );
});

// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Prompt §5.3 Paket 1 «Verstoss eingebaut → Schleuse rot»):
// Zusatzfälle des Selbsttests für die Pflichtwerkzeuge vor Gate B, je in einem frischen Klon mit genau einem
// eingebauten Verstoss: neue GPL-Abhängigkeit (F10), Modul ohne Test (V2), geänderte Render-Kette und
// abweichendes Golden-Bild (V5-golden), schwacher Test (V8). Der Fall «Lizenztext entfernt» steht in
// selftest-lizenz.selbsttest.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { aufraeumen, neueSandbox, prozessUmgebung, SEHR_LANG, WT } from './support/umgebung';
import { selftest } from './support/vertrag';

afterEach(aufraeumen);

const FAELLE: Array<[string, RegExp, string]> = [
  ['Z-lizenz-gpl', /^F10$/, 'zz-gpl-paket@1.0.0'],
  ['Z-abdeckung', /^V2$/, 'src/model/wap/zz-selbsttest'],
  ['Z-golden-kette', /^V5-golden$/, 'Render-Kette geändert'],
  ['Z-golden-pixel', /^V5-golden$/, 'Golden-Bild'],
  ['Z-mutation', /^V8$/, 'Fachlogik'],
];

describe('runSelftest: Zusatzfälle F-TOOLS', () => {
  it(
    '[R-H-23][R-H-16][R-H-20][R-H-17][R-H-31] --nur Z-lizenz-gpl,Z-abdeckung,Z-golden-kette,Z-golden-pixel,Z-mutation: je Verstoss die zuständige Schleuse rot mit der eingebauten Stelle',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const { runSelftest } = await selftest();
      const liste = await runSelftest({
        cwd: WT,
        nur: FAELLE.map(([n]) => n),
        last: testLast(sb).last,
      });
      expect(liste.map((x) => x.verstoss)).toEqual(FAELLE.map(([n]) => n));
      for (const [name, erwartet, nennung] of FAELLE) {
        const e = liste.find((x) => x.verstoss === name);
        expect(e?.erwartet, name).toMatch(erwartet);
        expect(e?.erkannt ?? '', name).toContain(nennung);
        expect(e?.ok, `${name}: ${e?.erkannt ?? ''}`).toBe(true);
      }
    },
    SEHR_LANG,
  );
});

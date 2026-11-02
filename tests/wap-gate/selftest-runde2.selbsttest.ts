// Paket F-TOOLS Runde 2 (Koordinator 20.10.2026, SA-2-03/SA-2-04; Prompt §5.3 Punkt 2): Selbsttest «Verstoss
// eingebaut → Schleuse rot» für R-H-32 (S6 Schrift unter Mindestgrösse im PDF → V5-ebene2, S7 Leistungsregression
// → V7-vergleich), R-H-37 (Suite-Konfiguration ohne Worker-Begrenzung → F7-worker) und CR-E101-P07 (UTF-16-Datei mit
// verbotenem Inhalt → V11-deep), je in einem frischen Klon.
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { aufraeumen, neueSandbox, prozessUmgebung, SEHR_LANG, WT } from './support/umgebung';
import { selftest } from './support/vertrag';

afterEach(aufraeumen);

const FAELLE: Array<[string, RegExp, string]> = [
  ['S6', /^V5-ebene2$/, 'Schrift unter Mindestgrösse'],
  ['S7', /^V7-vergleich$/, 'Leistungsregression'],
  ['Z-suite-worker', /^F7-worker$/, 'ohne Begrenzung der Worker'],
  ['Z-utf16', /^V11-deep$/, 'zz-selbsttest-utf16.txt'],
];

describe('runSelftest: Zusatzfälle F-TOOLS Runde 2', () => {
  it(
    '[R-H-32][R-H-37][R-H-24][R-H-31] --nur S6,S7,Z-suite-worker,Z-utf16: S6 und S7 machen die volle Schleuse rot, Suite-Konfiguration ohne Begrenzung F7, UTF-16-Datei mit AHV-Nummer V11',
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

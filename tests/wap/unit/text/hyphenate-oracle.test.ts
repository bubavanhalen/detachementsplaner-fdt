// @vitest-environment jsdom
// Paket E1-02b: Trennstellen gegen das Paket `hyphen` 1.14.1, Muster de-1996, Standardoptionen
// (Vertrag E1-02b 2.3 und Abschnitt 5; ADR-004 Entscheid E2). Abhängigkeit installiert E1-01.
import { describe, expect, it } from 'vitest';
import { hyphenationPoints } from '../../../../src/model/wap/layout/text/hyphenate';

interface HyphenModule {
  hyphenateSync(text: string): string;
}

const SOFT_HYPHEN = '\u00AD';

async function loadHyphenDe1996(): Promise<HyphenModule> {
  // Modulname als Variable: das Paket bringt keine Typen mit (Vertrag Abschnitt 5).
  const name = 'hyphen/de-1996';
  const mod = (await import(/* @vite-ignore */ name)) as Partial<HyphenModule> & {
    default?: Partial<HyphenModule>;
  };
  const fn = mod.hyphenateSync ?? mod.default?.hyphenateSync;
  expect(typeof fn, 'hyphen/de-1996 exportiert hyphenateSync').toBe('function');
  return { hyphenateSync: fn as HyphenModule['hyphenateSync'] };
}

/** UTF-16-Indizes der weichen Trennstriche, bezogen auf das Wort ohne sie. */
function oraclePoints(hyphenated: string): number[] {
  const points: number[] = [];
  let index = 0;
  for (let k = 0; k < hyphenated.length; k++) {
    if (hyphenated[k] === SOFT_HYPHEN) points.push(index);
    else index++;
  }
  return points;
}

const WORDS = [
  'Munitionsfassung',
  'Schiessausbildung',
  'Kompaniekommandant',
  'Gefechtsschiessen',
  'Fahrzeugdienst',
  'Retablierung',
  'Verschiebung',
  'Wachtdienst',
  'Tagesbefehl',
  'Übermittlungsübung',
  'Ausbildungsplanung',
  'Materialrückschub',
  'Zugführer',
  'Fahne',
  'Kp',
];

describe('hyphenationPoints gegen hyphen/de-1996', () => {
  it('[R-15-06] gleiche Trennstellen wie hyphen 1.14.1 de-1996 mit Standardoptionen', async () => {
    const hyphen = await loadHyphenDe1996();
    for (const word of WORDS) {
      const expected = oraclePoints(hyphen.hyphenateSync(word));
      expect(hyphenationPoints(word), word).toEqual(expected);
    }
  });
});

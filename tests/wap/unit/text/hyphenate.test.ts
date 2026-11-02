// @vitest-environment jsdom
// Paket E1-02b: Trennstellen (Vertrag E1-02b 2.3 `hyphenationPoints`; Beschrieb 15, R-15-06).
import { describe, expect, it } from 'vitest';
import { hyphenationPoints } from '../../../../src/model/wap/layout/text/hyphenate';
import { errorCode } from './helpers';

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
];

describe('hyphenationPoints', () => {
  it('[R-15-06] leerer Text → []', () => {
    expect(hyphenationPoints('')).toEqual([]);
  });

  it('[R-15-06] lange deutsche Wörter haben Trennstellen', () => {
    for (const word of WORDS) {
      expect(hyphenationPoints(word).length, word).toBeGreaterThan(0);
    }
  });

  it('[R-15-06] Indizes aufsteigend, eindeutig, ganzzahlig, 0 < i < Länge', () => {
    for (const word of [...WORDS, 'a', 'ab', 'Kp', 'Munitions-Fassung', 'AVOR']) {
      const points = hyphenationPoints(word);
      for (const [k, i] of points.entries()) {
        expect(Number.isInteger(i), word).toBe(true);
        expect(i, word).toBeGreaterThan(0);
        expect(i, word).toBeLessThan(word.length);
        if (k > 0) expect(i, word).toBeGreaterThan(points[k - 1] as number);
      }
    }
  });

  it('[R-15-06] Wort aus einem Zeichen hat keine Trennstelle (Grenzwert)', () => {
    expect(hyphenationPoints('a')).toEqual([]);
    expect(hyphenationPoints('\u{1F600}')).toEqual([]);
  });

  it('[R-15-06] deterministisch: gleiche Eingabe, gleiches Ergebnis', () => {
    for (const word of WORDS) {
      expect(hyphenationPoints(word)).toEqual(hyphenationPoints(word));
    }
  });

  it('[R-15-06] wirft nie, auch nicht bei Leerzeichen, Ziffern, Zeilenwechsel oder einzelnen Surrogaten', () => {
    for (const text of [
      ' ',
      '  a b ',
      '\n',
      '0700-1130',
      '\uD800',
      'a\u00ADb',
      '---',
      '\u{1F600}x',
    ]) {
      expect(
        errorCode(() => hyphenationPoints(text)),
        JSON.stringify(text),
      ).toBe('kein Fehler');
    }
  });
});

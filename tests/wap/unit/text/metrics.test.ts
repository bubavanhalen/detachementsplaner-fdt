// @vitest-environment jsdom
// Paket E1-02b: Metriken der gebündelten Schrift (Vertrag E1-02b 2.2, 2.4; ADR-003, ADR-004).
import { describe, expect, it } from 'vitest';
import { ascentPt, fontMetrics, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { errorCode } from './helpers';

const INVALID_SIZES = [
  0,
  -0,
  -1,
  -5.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

describe('fontMetrics', () => {
  it('[R-L-03] liefert bei jedem Aufruf dasselbe Objekt', () => {
    expect(fontMetrics()).toBe(fontMetrics());
  });

  it('[R-L-03] vertikale Werte aus hhea: Arimo 1.341, unitsPerEm 2048, Zeilenfaktor 1,1499 (ADR-003)', () => {
    const m = fontMetrics();
    expect(m.unitsPerEm).toBe(2048);
    expect(m.ascender).toBeGreaterThan(0);
    expect(m.descender).toBeLessThan(0);
    expect(m.lineGap).toBeGreaterThanOrEqual(0);
    expect((m.ascender - m.descender + m.lineGap) / m.unitsPerEm).toBeCloseTo(1.1499, 4);
  });

  it('[R-L-03] advance: Codepunkt der cmap → ganzzahliger Vorschub > 0 in beiden Schnitten', () => {
    const m = fontMetrics();
    for (const ch of ['a', 'M', 'ä', 'Ö', 'é', '«', '»', '–', '-', ' ']) {
      for (const weight of ['regular', 'bold'] as const) {
        const adv = m.advance(ch.codePointAt(0) as number, weight);
        expect(Number.isInteger(adv), `${ch} ${weight}`).toBe(true);
        expect(adv as number).toBeGreaterThan(0);
      }
    }
  });

  it('[R-L-03] advance: Schnitte unterscheiden sich (fett «i» breiter als normal)', () => {
    const m = fontMetrics();
    const i = 'i'.codePointAt(0) as number;
    expect(m.advance(i, 'bold') as number).toBeGreaterThan(m.advance(i, 'regular') as number);
  });

  it('[R-L-03] advance: Codepunkt ohne Glyphe und ungültige Codepunkte → null', () => {
    const m = fontMetrics();
    // ADR-003: Arimo enthält U+2713 und Emoji nicht.
    for (const cp of [0x2713, 0x1f600, -1, 0x110000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(m.advance(cp, 'regular'), String(cp)).toBeNull();
      expect(m.advance(cp, 'bold'), String(cp)).toBeNull();
    }
  });

  it('[R-L-03] notdefAdvance: ganzzahliger Vorschub > 0 je Schnitt', () => {
    const m = fontMetrics();
    for (const weight of ['regular', 'bold'] as const) {
      expect(Number.isInteger(m.notdefAdvance(weight))).toBe(true);
      expect(m.notdefAdvance(weight)).toBeGreaterThan(0);
    }
  });
});

describe('lineHeightPt und ascentPt', () => {
  it('[R-L-03] lineHeightPt = (ascender − descender + lineGap) × sizePt / unitsPerEm, exakt in dieser Reihenfolge', () => {
    const m = fontMetrics();
    for (const size of [5, 5.5, 4.5, 7.3, 9, 0.1, 1e-9, 1e6]) {
      expect(lineHeightPt(size)).toBe(
        ((m.ascender - m.descender + m.lineGap) * size) / m.unitsPerEm,
      );
    }
  });

  it('[R-L-03] ascentPt = ascender × sizePt / unitsPerEm, exakt', () => {
    const m = fontMetrics();
    for (const size of [5, 5.5, 4.5, 7.3, 9, 0.1, 1e-9, 1e6]) {
      expect(ascentPt(size)).toBe((m.ascender * size) / m.unitsPerEm);
    }
  });

  it('[R-L-03] lineHeightPt(10) ≈ 11,499 pt (ADR-003)', () => {
    expect(lineHeightPt(10)).toBeCloseTo(11.499, 3);
  });

  it('[R-L-03] lineHeightPt wirft invalidTextBox bei sizePt nicht endlich oder ≤ 0', () => {
    for (const size of INVALID_SIZES) {
      expect(
        errorCode(() => lineHeightPt(size)),
        String(size),
      ).toBe('invalidTextBox');
    }
  });

  it('[R-L-03] ascentPt wirft invalidTextBox bei sizePt nicht endlich oder ≤ 0', () => {
    for (const size of INVALID_SIZES) {
      expect(
        errorCode(() => ascentPt(size)),
        String(size),
      ).toBe('invalidTextBox');
    }
  });

  it('[R-L-03] kleinste positive Grösse ist gültig (Grenzwert)', () => {
    expect(errorCode(() => lineHeightPt(Number.MIN_VALUE))).toBe('kein Fehler');
    expect(errorCode(() => ascentPt(Number.MIN_VALUE))).toBe('kein Fehler');
    expect(lineHeightPt(Number.MIN_VALUE)).toBeGreaterThanOrEqual(0);
  });
});

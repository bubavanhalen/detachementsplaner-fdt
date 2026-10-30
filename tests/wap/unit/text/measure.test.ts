// @vitest-environment jsdom
// Paket E1-02b: Messen und Zeichenprüfung (Vertrag E1-02b 2.3, 2.4; ADR-004 Punkt 2 und AR0-13).
import { describe, expect, it } from 'vitest';
import {
  isRenderable,
  measureRuns,
  missingGlyphs,
} from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import type { FontWeight, StyledRun } from '../../../../src/model/wap/layout/text/types';
import { bold, errorCode, reg } from './helpers';

/** Summe der Vorschübe in Font-Einheiten nach Vertrag 2.3 (fehlende Glyphe → .notdef). */
function units(runs: readonly StyledRun[]): number {
  const m = fontMetrics();
  let sum = 0;
  for (const run of runs) {
    for (const ch of run.text) {
      const adv = m.advance(ch.codePointAt(0) as number, run.weight);
      sum += adv ?? m.notdefAdvance(run.weight);
    }
  }
  return sum;
}

function adv(ch: string, weight: FontWeight): number {
  return fontMetrics().advance(ch.codePointAt(0) as number, weight) as number;
}

const INVALID_SIZES = [0, -0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe('measureRuns', () => {
  it('[R-L-03] keine Läufe oder leere Texte → 0', () => {
    expect(measureRuns([], 5)).toBe(0);
    expect(measureRuns([reg(''), bold('')], 5)).toBe(0);
  });

  it('[R-L-03] erst Font-Einheiten summieren, dann × sizePt / unitsPerEm (P-7, exakt)', () => {
    const upem = fontMetrics().unitsPerEm;
    const cases: StyledRun[][] = [
      [reg('Kp Wo 1')],
      [bold('AVOR'), reg(' Fahne')],
      [reg('Munitions-Fassung')],
      [bold('Ausbildung Zug 2 «Wachtdienst» – 0700-1130')],
    ];
    for (const runs of cases) {
      for (const size of [5, 5.5, 4.5, 7.3, 0.1, 9]) {
        expect(measureRuns(runs, size)).toBe((units(runs) * size) / upem);
      }
    }
  });

  it('[R-L-03] Aufteilung in Läufe gleichen Schnitts ändert die Breite nicht (exakt)', () => {
    expect(measureRuns([reg('Munitions'), reg('-'), reg('Fassung')], 7.3)).toBe(
      measureRuns([reg('Munitions-Fassung')], 7.3),
    );
  });

  it('[R-L-03] misst jeden Lauf in seinem Schnitt', () => {
    const upem = fontMetrics().unitsPerEm;
    expect(measureRuns([bold('ii')], 5)).toBe((2 * adv('i', 'bold') * 5) / upem);
    expect(measureRuns([reg('ii')], 5)).toBe((2 * adv('i', 'regular') * 5) / upem);
    expect(measureRuns([bold('i'), reg('i')], 5)).toBe(
      ((adv('i', 'bold') + adv('i', 'regular')) * 5) / upem,
    );
    expect(measureRuns([bold('ii')], 5)).not.toBe(measureRuns([reg('ii')], 5));
  });

  it('[R-L-03] ohne Kerning und ohne Ligaturen: Breite = Summe der Einzelvorschübe', () => {
    const upem = fontMetrics().unitsPerEm;
    for (const pair of ['AV', 'To', 'Wa', 'fi', 'fl', 'LT']) {
      for (const weight of ['regular', 'bold'] as const) {
        const [a, b] = [...pair] as [string, string];
        expect(measureRuns([{ text: pair, weight }], 10)).toBe(
          ((adv(a, weight) + adv(b, weight)) * 10) / upem,
        );
      }
    }
  });

  it('[R-L-03] Zeichen ohne Glyphe zählt mit notdefAdvance seines Schnitts, je Codepunkt einmal', () => {
    const m = fontMetrics();
    const upem = m.unitsPerEm;
    // U+1F600 ist ein Surrogatpaar: ein Codepunkt, eine .notdef
    expect(measureRuns([reg('\u{1F600}')], 5)).toBe((m.notdefAdvance('regular') * 5) / upem);
    expect(measureRuns([bold('\u{1F600}')], 5)).toBe((m.notdefAdvance('bold') * 5) / upem);
    expect(measureRuns([reg('a\u2713b')], 5)).toBe(
      ((adv('a', 'regular') + m.notdefAdvance('regular') + adv('b', 'regular')) * 5) / upem,
    );
  });

  it('[R-L-03] wirft invalidTextBox bei sizePt nicht endlich oder ≤ 0', () => {
    for (const size of INVALID_SIZES) {
      expect(
        errorCode(() => measureRuns([reg('Kp')], size)),
        String(size),
      ).toBe('invalidTextBox');
      expect(
        errorCode(() => measureRuns([], size)),
        `leer ${size}`,
      ).toBe('invalidTextBox');
    }
  });

  it('[R-L-03] gültige kleinste Grösse wirft nicht (Grenzwert)', () => {
    expect(errorCode(() => measureRuns([reg('Kp')], Number.MIN_VALUE))).toBe('kein Fehler');
  });
});

describe('missingGlyphs und isRenderable', () => {
  it('[R-L-03] leerer Text → [] und renderbar', () => {
    expect(missingGlyphs('')).toEqual([]);
    expect(isRenderable('')).toBe(true);
  });

  it('[R-L-03] deutsche und Schweizer Texte mit Umlauten, Anführungszeichen und Gedankenstrich sind renderbar', () => {
    const text = 'Übung «Wachtdienst» – Zugführer Gfr Muster A, Mö Munitions-Fassung, äöüÄÖÜàéè’—';
    expect(missingGlyphs(text)).toEqual([]);
    expect(isRenderable(text)).toBe(true);
  });

  it('[R-L-03] meldet verschiedene fehlende Zeichen in der Reihenfolge des ersten Vorkommens, je Codepunkt', () => {
    const text = 'a\u{1F600}b\u2713\u{1F600}c\u2713';
    expect(missingGlyphs(text)).toEqual(['\u{1F600}', '\u2713']);
    expect(isRenderable(text)).toBe(false);
    expect(isRenderable('\u2713')).toBe(false);
  });

  it('[R-L-03] fehlende Glyphe in mindestens einem Schnitt: übereinstimmend mit fontMetrics für U+0000 bis U+2FFF (P-19)', () => {
    const m = fontMetrics();
    let mismatches = 0;
    const examples: string[] = [];
    for (let cp = 0; cp <= 0x2fff; cp++) {
      const ch = String.fromCodePoint(cp);
      const missing = m.advance(cp, 'regular') === null || m.advance(cp, 'bold') === null;
      const got = missingGlyphs(ch);
      const ok = missing ? got.length === 1 && got[0] === ch : got.length === 0;
      if (!ok || isRenderable(ch) === missing) {
        mismatches++;
        if (examples.length < 5) examples.push(cp.toString(16));
      }
    }
    expect(examples).toEqual([]);
    expect(mismatches).toBe(0);
  });

  it('[R-L-03] wirft nie, auch nicht bei einzelnen Surrogaten', () => {
    expect(errorCode(() => missingGlyphs('a\uD800b'))).toBe('kein Fehler');
    expect(errorCode(() => isRenderable('\uDC00'))).toBe('kein Fehler');
    expect(isRenderable('\uD800')).toBe(false);
  });
});

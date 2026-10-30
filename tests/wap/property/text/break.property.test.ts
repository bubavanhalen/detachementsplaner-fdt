// @vitest-environment jsdom
// Paket E1-02b: Property-Tests für Messen und Umbruch (Vertrag E1-02b 2.3 Regeln 1–8, P-7, P-9, P-10;
// Plan Etappe 1 §4.3 «Zeilenbreite ≤ Maximum, verlustfrei»; ADR-010: fester Startwert).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type BreakOptions, breakText } from '../../../../src/model/wap/layout/text/break';
import { hyphenationPoints } from '../../../../src/model/wap/layout/text/hyphenate';
import {
  isRenderable,
  measureRuns,
  missingGlyphs,
} from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import type { FontWeight, StyledRun } from '../../../../src/model/wap/layout/text/types';
import { expectBreakInvariants, lineText, width } from '../../unit/text/helpers';

const SEED = 20261002;
const PARAMS = { seed: SEED, numRuns: 200 } as const;

/** Zeichenvorrat: Buchstaben verschiedener Breite, Umlaut, Leerzeichen, Bindestrich, NBSP, Zeilenwechsel, Zeichen ohne Glyphe. */
const CHARS = [
  'a',
  'i',
  'M',
  'W',
  'ä',
  'f',
  ' ',
  ' ',
  ' ',
  '-',
  '-',
  '\u00A0',
  '\n',
  '\u{1F600}',
  '1',
];
const WORD_CHARS = ['a', 'i', 'M', 'W', 'ä', 'n', 's', 'u', 't', 'e', 'r'];

const textArb = (chars: readonly string[], maxLength = 40) =>
  fc.array(fc.constantFrom(...chars), { maxLength }).map((cs) => cs.join(''));
const weightArb = fc.constantFrom<FontWeight>('regular', 'bold');
const runsArb = (chars: readonly string[]) =>
  fc.array(fc.record({ text: textArb(chars, 15), weight: weightArb }), { maxLength: 4 });
const maxWidthArb = fc.oneof(
  fc.double({ min: 0.5, max: 120, noNaN: true }),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.MIN_VALUE),
);
const optsArb: fc.Arbitrary<BreakOptions> = fc.record({
  maxWidthPt: maxWidthArb,
  sizePt: fc.constantFrom(4.5, 5, 5.5, 9, 7.3),
  hyphenate: fc.constantFrom<BreakOptions['hyphenate']>('ifWordDoesNotFit', 'never'),
});

describe('breakText – Eigenschaften', () => {
  it('[R-15-06] verlustfrei, Breite = measureRuns, bei fits jede Zeile ≤ maxWidthPt, Läufe zusammengefasst, Leerzeichen nach P-15', () => {
    fc.assert(
      fc.property(runsArb(CHARS), optsArb, (runs, opts) => {
        const result = breakText(runs, opts);
        expectBreakInvariants(runs, opts, result);
      }),
      PARAMS,
    );
  });

  it('[R-15-06] deterministisch: zweimal gleiche Eingabe, gleiches Ergebnis', () => {
    fc.assert(
      fc.property(runsArb(CHARS), optsArb, (runs, opts) => {
        expect(breakText(runs, opts)).toEqual(breakText(runs, opts));
      }),
      PARAMS,
    );
  });

  it('[R-15-06] maxWidthPt = +Infinity: eine Zeile je Absatz, fits true, kein Trennstrich', () => {
    fc.assert(
      fc.property(runsArb(CHARS), (runs) => {
        const result = breakText(runs, {
          maxWidthPt: Number.POSITIVE_INFINITY,
          sizePt: 5,
          hyphenate: 'ifWordDoesNotFit',
        });
        const text = runs.map((r) => r.text).join('');
        expect(result.fits).toBe(true);
        expect(result.lines.length).toBe(text === '' ? 0 : text.split('\n').length);
        expect(result.lines.every((l) => !l.endsWithHyphen)).toBe(true);
      }),
      PARAMS,
    );
  });

  it('[R-15-06] hyphenate «never» setzt nie einen Trennstrich', () => {
    fc.assert(
      fc.property(runsArb(CHARS), optsArb, (runs, opts) => {
        const result = breakText(runs, { ...opts, hyphenate: 'never' });
        expect(result.lines.every((l) => !l.endsWithHyphen)).toBe(true);
      }),
      PARAMS,
    );
  });

  it('[R-15-06] gierig: bei fits und «never» passt das erste Wort der Folgezeile nicht mehr auf die Zeile davor', () => {
    // Nur Buchstaben und Leerzeichen, keine Leerzeichen am Absatzanfang: jeder Umbruch innerhalb eines
    // Absatzes liegt dann an einer Leerzeichenfolge (Regeln 3, 4).
    const paragraphArb = textArb(['a', 'i', 'M', 'W', ' ', ' ', '\n'], 60).map((t) =>
      t.replace(/(^|\n) +/g, '$1'),
    );
    fc.assert(
      fc.property(paragraphArb, fc.double({ min: 1, max: 60, noNaN: true }), (text, max) => {
        const result = breakText([{ text, weight: 'regular' }], {
          maxWidthPt: max,
          sizePt: 5,
          hyphenate: 'never',
        });
        if (!result.fits) return;
        result.lines.forEach((line, k) => {
          const next = result.lines[k + 1];
          if (next === undefined || line.trailing.endsWith('\n')) return;
          expect(line.trailing).toMatch(/^ +$/);
          const nextWord = lineText(next).split(' ')[0] as string;
          expect(width(lineText(line) + line.trailing + nextWord, 5)).toBeGreaterThan(max);
        });
      }),
      PARAMS,
    );
  });

  it('[R-15-06] ein Wort, das allein passt, wird nie getrennt oder zeichenweise umbrochen', () => {
    fc.assert(
      fc.property(
        fc.array(
          textArb(WORD_CHARS, 12).filter((w) => w.length > 0),
          { minLength: 1, maxLength: 6 },
        ),
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        (words, factor) => {
          const longest = Math.max(...words.map((w) => width(w, 5)));
          const max = longest * Math.max(1, factor);
          const result = breakText([{ text: words.join(' '), weight: 'regular' }], {
            maxWidthPt: max,
            sizePt: 5,
            hyphenate: 'ifWordDoesNotFit',
          });
          expect(result.fits).toBe(true);
          expect(result.lines.every((l) => !l.endsWithHyphen)).toBe(true);
          const lineWords = result.lines.flatMap((l) => lineText(l).split(' '));
          expect(lineWords).toEqual(words);
        },
      ),
      PARAMS,
    );
  });
});

describe('measureRuns – Eigenschaften', () => {
  it('[R-L-03] Summe der Font-Einheiten × sizePt / unitsPerEm, exakt (P-7), unabhängig von der Laufaufteilung', () => {
    fc.assert(
      fc.property(
        textArb(CHARS, 30),
        weightArb,
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.nat(30),
        (text, weight, size, cut) => {
          const m = fontMetrics();
          let units = 0;
          for (const ch of text) {
            units += m.advance(ch.codePointAt(0) as number, weight) ?? m.notdefAdvance(weight);
          }
          expect(measureRuns([{ text, weight }], size)).toBe((units * size) / m.unitsPerEm);
          const cps = [...text];
          const k = Math.min(cut, cps.length);
          const split: StyledRun[] = [
            { text: cps.slice(0, k).join(''), weight },
            { text: cps.slice(k).join(''), weight },
          ];
          expect(measureRuns(split, size)).toBe(measureRuns([{ text, weight }], size));
        },
      ),
      PARAMS,
    );
  });

  it('[R-L-03] isRenderable ⇔ missingGlyphs leer; gemeldete Zeichen kommen vor und sind verschieden', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 20 }), (text) => {
        const missing = missingGlyphs(text);
        expect(isRenderable(text)).toBe(missing.length === 0);
        expect(new Set(missing).size).toBe(missing.length);
        for (const ch of missing) {
          expect([...ch]).toHaveLength(1);
          expect(text).toContain(ch);
        }
      }),
      PARAMS,
    );
  });
});

describe('hyphenationPoints – Eigenschaften', () => {
  it('[R-15-06] wirft nie; Indizes aufsteigend, eindeutig, 0 < i < Länge', () => {
    fc.assert(
      fc.property(fc.oneof(textArb(WORD_CHARS, 25), fc.string({ maxLength: 25 })), (word) => {
        const points = hyphenationPoints(word);
        points.forEach((i, k) => {
          expect(Number.isInteger(i)).toBe(true);
          expect(i).toBeGreaterThan(0);
          expect(i).toBeLessThan(word.length);
          if (k > 0) expect(i).toBeGreaterThan(points[k - 1] as number);
        });
      }),
      PARAMS,
    );
  });
});

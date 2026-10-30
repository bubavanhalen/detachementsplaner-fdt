// @vitest-environment jsdom
// Paket E1-02b: Zeilenumbruch `breakText` (Vertrag E1-02b 2.3 Regeln 1–8, 2.4; Beschrieb 15, R-15-06).
// Testtexte fiktiv; Breiten immer über `measureRuns` (Vertrag 2.2), nie fest eingetragen.
import { describe, expect, it } from 'vitest';
import {
  type BreakOptions,
  type BreakResult,
  breakText,
} from '../../../../src/model/wap/layout/text/break';
import { hyphenationPoints } from '../../../../src/model/wap/layout/text/hyphenate';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import type { StyledRun } from '../../../../src/model/wap/layout/text/types';
import {
  bold,
  errorCode,
  expectBreakInvariants,
  expectedCharLines,
  expectedHyphenatedLines,
  expectedWordLines,
  lineText,
  nextDown,
  reg,
  width,
} from './helpers';

const SIZE = 5;

function opts(
  maxWidthPt: number,
  hyphenate: BreakOptions['hyphenate'] = 'ifWordDoesNotFit',
  sizePt = SIZE,
): BreakOptions {
  return { maxWidthPt, sizePt, hyphenate };
}

/** breakText mit Prüfung aller Invarianten (Regeln 2, 6, 7, 8). */
function run(runs: readonly StyledRun[], o: BreakOptions): BreakResult {
  const result = breakText(runs, o);
  expectBreakInvariants(runs, o, result);
  return result;
}

const texts = (r: BreakResult): string[] => r.lines.map(lineText);
const trailings = (r: BreakResult): string[] => r.lines.map((l) => l.trailing);
const hyphens = (r: BreakResult): boolean[] => r.lines.map((l) => l.endsWithHyphen);

describe('breakText – Regel 2: erzwungener Umbruch und leere Eingabe', () => {
  it('[R-15-06] leere Eingabe (keine Läufe oder nur leere Texte) → keine Zeile, fits true', () => {
    for (const runs of [[], [reg('')], [reg(''), bold('')]]) {
      for (const max of [10, Number.POSITIVE_INFINITY]) {
        expect(breakText(runs, opts(max))).toEqual({ lines: [], fits: true });
      }
    }
  });

  it('[R-15-06] U+000A beendet die Zeile und steht in trailing', () => {
    const r = run([reg('Kp\nWo 1')], opts(Number.POSITIVE_INFINITY));
    expect(texts(r)).toEqual(['Kp', 'Wo 1']);
    expect(trailings(r)).toEqual(['\n', '']);
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] Text nach dem letzten U+000A bildet die letzte Zeile, auch wenn er leer ist', () => {
    const r = run([reg('Kp\n')], opts(Number.POSITIVE_INFINITY));
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1]).toEqual({ runs: [], widthPt: 0, endsWithHyphen: false, trailing: '' });
    expect(run([reg('\n')], opts(100)).lines).toHaveLength(2);
    const three = run([reg('\n\n')], opts(100));
    expect(texts(three)).toEqual(['', '', '']);
    expect(trailings(three)).toEqual(['\n', '\n', '']);
  });

  it('[R-15-06] Leerzeichen vor U+000A stehen vor dem U+000A in trailing', () => {
    const r = run([reg('Kp  \nWo')], opts(Number.POSITIVE_INFINITY));
    expect(texts(r)).toEqual(['Kp', 'Wo']);
    expect(trailings(r)).toEqual(['  \n', '']);
  });

  it('[R-15-06] U+000A am Laufende trennt auch über Laufgrenzen', () => {
    const r = run([bold('Kp\n'), reg('Wo')], opts(Number.POSITIVE_INFINITY));
    expect(r.lines.map((l) => l.runs)).toEqual([[bold('Kp')], [reg('Wo')]]);
  });

  it('[R-15-06] maxWidthPt = +Infinity: nur erzwungene Umbrüche, keine Trennung', () => {
    const text = 'Ausbildung Zug 2 Wachtdienst Munitionsfassung Gefechtsschiessen';
    const r = run([reg(text)], opts(Number.POSITIVE_INFINITY));
    expect(texts(r)).toEqual([text]);
    expect(hyphens(r)).toEqual([false]);
    expect(r.fits).toBe(true);
    const two = run([reg('aaa bbb\nccc ddd')], opts(Number.POSITIVE_INFINITY, 'never'));
    expect(texts(two)).toEqual(['aaa bbb', 'ccc ddd']);
  });

  it('[R-15-06] erzwungener Umbruch und gieriger Umbruch zusammen', () => {
    const r = run([reg('aaa aaa\naaa aaa')], opts(width('aaa', SIZE)));
    expect(texts(r)).toEqual(['aaa', 'aaa', 'aaa', 'aaa']);
    expect(trailings(r)).toEqual([' ', '\n', ' ', '']);
  });
});

describe('breakText – Regeln 3 und 4: Umbruchstellen und gieriger Umbruch', () => {
  it('[R-15-06] «Munitions-Fassung» wird nach dem Bindestrich umbrochen, ohne Trennstrich', () => {
    for (const mode of ['ifWordDoesNotFit', 'never'] as const) {
      const r = run([reg('Munitions-Fassung')], opts(width('Munitions-', SIZE), mode));
      expect(texts(r)).toEqual(['Munitions-', 'Fassung']);
      expect(hyphens(r)).toEqual([false, false]);
      expect(trailings(r)).toEqual(['', '']);
      expect(r.fits).toBe(true);
    }
  });

  it('[R-15-06] «Munitions-Fassung» bleibt einzeilig, wenn die Breite exakt reicht (Grenzwert ≤)', () => {
    const full = width('Munitions-Fassung', SIZE);
    expect(texts(run([reg('Munitions-Fassung')], opts(full)))).toEqual(['Munitions-Fassung']);
    expect(texts(run([reg('Munitions-Fassung')], opts(nextDown(full))))).toEqual([
      'Munitions-',
      'Fassung',
    ]);
  });

  it('[R-15-06] gierig mit exaktem Vergleich: Zeile genau so breit wie maxWidthPt passt, ein Hauch weniger nicht', () => {
    const max = width('aaa aaa', SIZE);
    const exact = run([reg('aaa aaa aaa')], opts(max));
    expect(texts(exact)).toEqual(['aaa aaa', 'aaa']);
    expect(trailings(exact)).toEqual([' ', '']);
    const less = run([reg('aaa aaa aaa')], opts(nextDown(max)));
    expect(texts(less)).toEqual(['aaa', 'aaa', 'aaa']);
    expect(trailings(less)).toEqual([' ', ' ', '']);
  });

  it('[R-15-06] Leerzeichen am Zeilenende zählen nicht zur Breite', () => {
    const r = run([reg('aaa aaa')], opts(width('aaa', SIZE)));
    expect(texts(r)).toEqual(['aaa', 'aaa']);
    expect(r.lines[0]?.widthPt).toBe(width('aaa', SIZE));
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] eine Folge von Leerzeichen ist eine Umbruchstelle und landet ganz in trailing', () => {
    const r = run([reg('aa   aa')], opts(width('aa', SIZE)));
    expect(texts(r)).toEqual(['aa', 'aa']);
    expect(trailings(r)).toEqual(['   ', '']);
  });

  it('[R-15-06] Leerzeichen am Textende stehen in trailing', () => {
    const r = run([reg('aa  ')], opts(Number.POSITIVE_INFINITY));
    expect(texts(r)).toEqual(['aa']);
    expect(trailings(r)).toEqual(['  ']);
    expect(r.lines[0]?.widthPt).toBe(width('aa', SIZE));
  });

  it('[R-15-06] Leerzeichen am Absatzanfang bleiben in runs und zählen zur Breite', () => {
    const one = run([reg('  aa bb')], opts(Number.POSITIVE_INFINITY));
    expect(texts(one)).toEqual(['  aa bb']);
    expect(one.lines[0]?.widthPt).toBe(width('  aa bb', SIZE));
    const after = run([reg('aa\n  bb')], opts(Number.POSITIVE_INFINITY));
    expect(texts(after)).toEqual(['aa', '  bb']);
    expect(after.lines[1]?.widthPt).toBe(width('  bb', SIZE));
    const narrow = run([reg('  aa bb')], opts(width('  aa', SIZE)));
    expect(texts(narrow)).toEqual(['  aa', 'bb']);
    expect(trailings(narrow)).toEqual([' ', '']);
  });

  it('[R-15-06] Bindestrich nach einem Leerzeichen ist keine Umbruchstelle', () => {
    const r = run([reg('aaaa -aaaa')], opts(width('aaaa -', SIZE), 'never'));
    expect(texts(r)).toEqual(['aaaa', '-aaaa']);
    expect(trailings(r)).toEqual([' ', '']);
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] Bindestrich am Absatzanfang ist keine Umbruchstelle', () => {
    const max = width('aaaa', SIZE);
    const r = run([reg('-aaaa')], opts(max, 'never'));
    expect(r.fits).toBe(false);
    expect(texts(r)).toEqual(expectedCharLines('-aaaa', max, SIZE));
  });

  it('[R-15-06] Bindestrich vor U+000A, vor Leerzeichen und doppelt (Regel 3)', () => {
    const nl = run([reg('aa-\nbb')], opts(Number.POSITIVE_INFINITY));
    expect(texts(nl)).toEqual(['aa-', 'bb']);
    expect(trailings(nl)).toEqual(['\n', '']);
    const nlNarrow = run([reg('aa-\nbb')], opts(width('aa', SIZE), 'never'));
    expect(texts(nlNarrow)).toEqual(['aa', '-', 'bb']);
    expect(trailings(nlNarrow)).toEqual(['', '\n', '']);
    expect(nlNarrow.fits).toBe(false);
    const sp = run([reg('aa- bb')], opts(width('aa-', SIZE)));
    expect(texts(sp)).toEqual(['aa-', 'bb']);
    expect(trailings(sp)).toEqual([' ', '']);
    expect(hyphens(sp)).toEqual([false, false]);
    const spNarrow = run([reg('aa- bb')], opts(width('aa', SIZE), 'never'));
    expect(texts(spNarrow)).toEqual(['aa', '-', 'bb']);
    expect(trailings(spNarrow)).toEqual(['', ' ', '']);
    // «a--a»: nach beiden Bindestrichen eine Umbruchstelle (davor und danach je ein Nicht-Leerzeichen)
    const dbl = run([reg('a--a')], opts(width('a-', SIZE), 'never'));
    expect(texts(dbl)).toEqual(['a-', '-a']);
    expect(hyphens(dbl)).toEqual([false, false]);
    expect(dbl.fits).toBe(true);
  });

  it('[R-15-06] geschütztes Leerzeichen U+00A0 bindet', () => {
    const max = width('aaaa\u00A0', SIZE);
    const r = run([reg('aaaa\u00A0aaaa')], opts(max, 'never'));
    expect(r.fits).toBe(false);
    expect(texts(r)).toEqual(expectedCharLines('aaaa\u00A0aaaa', max, SIZE));
    expect(trailings(r)).toEqual(r.lines.map(() => ''));
  });

  it('[R-15-06] nur U+0020 ist Leerzeichen: Tabulator und schmales Leerzeichen sind keine Umbruchstelle', () => {
    for (const sep of ['\t', '\u2009']) {
      const max = width(`aaaa${sep}`, SIZE);
      const r = run([reg(`aaaa${sep}aaaa`)], opts(max, 'never'));
      expect(r.fits, JSON.stringify(sep)).toBe(false);
      expect(texts(r)).toEqual(expectedCharLines(`aaaa${sep}aaaa`, max, SIZE));
    }
  });

  it('[R-15-06] Laufgrenzen sind keine Umbruchstellen (Regel 1)', () => {
    const max = measureRuns([bold('AV'), reg('O')], SIZE);
    const r = run([bold('AV'), reg('OR')], opts(max, 'never'));
    expect(r.fits).toBe(false);
    expect(r.lines.map((l) => l.runs)).toEqual([[bold('AV'), reg('O')], [reg('R')]]);
  });

  it('[R-15-06] «AVOR Fahne»: Schnitte gemischt, Umbruch am Leerzeichen zwischen den Läufen', () => {
    const runs = [bold('AVOR'), reg(' Fahne')];
    const one = run(runs, opts(Number.POSITIVE_INFINITY));
    expect(one.lines.map((l) => l.runs)).toEqual([[bold('AVOR'), reg(' Fahne')]]);
    expect(one.lines[0]?.widthPt).toBe(measureRuns(runs, SIZE));
    const two = run(runs, opts(measureRuns([bold('AVOR'), reg(' Fahn')], SIZE)));
    expect(two.lines.map((l) => l.runs)).toEqual([[bold('AVOR')], [reg('Fahne')]]);
    expect(trailings(two)).toEqual([' ', '']);
  });

  it('[R-15-06] ein Wort, das allein passt, wird nie getrennt, sondern auf die nächste Zeile gesetzt', () => {
    for (const mode of ['ifWordDoesNotFit', 'never'] as const) {
      const r = run([reg('aa Munitionsfassung')], opts(width('Munitionsfassung', SIZE), mode));
      expect(texts(r)).toEqual(['aa', 'Munitionsfassung']);
      expect(hyphens(r)).toEqual([false, false]);
      expect(r.fits).toBe(true);
    }
  });
});

describe('breakText – Regel 5: Silbentrennung und Notumbruch', () => {
  const WORD = 'Munitionsfassung';
  /** Zeilenbreite für die Trennfälle; erst im Test berechnet (Messung braucht die Umsetzung). */
  const hyphenMax = (): number => width('Munitionsfas', SIZE);

  it('[R-15-06] ein Wort, das nicht passt, wird an Trennstellen getrennt (längstes Stück je Zeile, Trennstrich)', () => {
    const r = run([reg(WORD)], opts(hyphenMax()));
    const expected = expectedHyphenatedLines(WORD, hyphenMax(), SIZE);
    expect(expected.length).toBeGreaterThanOrEqual(2);
    expect(texts(r)).toEqual(expected);
    expect(hyphens(r)).toEqual(expected.map((_, i) => i < expected.length - 1));
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] ein zu langes Wort beginnt auf einer neuen Zeile («Mö» / «Munitions…»)', () => {
    const r = run([reg(`Mö ${WORD}`)], opts(hyphenMax()));
    expect(texts(r)).toEqual(['Mö', ...expectedHyphenatedLines(WORD, hyphenMax(), SIZE)]);
    expect(r.lines[0]?.trailing).toBe(' ');
    expect(r.lines[0]?.endsWithHyphen).toBe(false);
  });

  it('[R-15-06] Rest des getrennten Wortes bleibt auf der Zeile, folgende Segmente schliessen gierig an', () => {
    const pieces = expectedHyphenatedLines(WORD, hyphenMax(), SIZE);
    const last = pieces.at(-1) as string;
    expect(
      width(`${last} ab`, SIZE),
      'Testfall: Rest und «ab» passen zusammen',
    ).toBeLessThanOrEqual(hyphenMax());
    const r = run([reg(`${WORD} ab`)], opts(hyphenMax()));
    expect(texts(r)).toEqual([...pieces.slice(0, -1), `${last} ab`]);
  });

  it('[R-15-06] Trennstrich im Schnitt des Zeichens davor (fett und normal gemischt)', () => {
    for (const runs of [
      [bold('Munitions'), reg('fassung')],
      [reg('Munitions'), bold('fassung')],
    ]) {
      const r = run(runs, opts(measureRuns([bold('Munitionsfas')], SIZE)));
      expect(r.lines.some((l) => l.endsWithHyphen)).toBe(true);
      expect(r.fits).toBe(true);
    }
  });

  it('[R-15-06] Bindestrich der Eingabe am Zeilenende ist kein eingefügter Trennstrich', () => {
    const r = run([reg('Munitions-Fassung')], opts(width('Munitions-', SIZE)));
    expect(hyphens(r)).toEqual([false, false]);
  });

  it('[R-15-06] hyphenate «never»: zu langes Wort zeichenweise, ohne Trennstrich, fits false', () => {
    const max = width('Munitions', SIZE);
    const r = run([reg(WORD)], opts(max, 'never'));
    expect(texts(r)).toEqual(expectedCharLines(WORD, max, SIZE));
    expect(hyphens(r).every((h) => !h)).toBe(true);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Notumbruch: Stück bis zur nächsten Trennstelle passt nicht → zeichenweise, fits false', () => {
    const max = width('M', SIZE);
    const expected = expectedWordLines(WORD, max, SIZE, 'ifWordDoesNotFit');
    const r = run([reg(WORD)], opts(max));
    expect(texts(r)).toEqual(expected.lines);
    expect(hyphens(r)).toEqual(expected.hyphens);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Notumbruch, Literal: «Munitionsfassung» bei Breite von «M» (Arimo per SHA-256, hyphen 1.14.1)', () => {
    const r = run([reg(WORD)], opts(width('M', SIZE)));
    expect(texts(r)).toEqual([
      'M',
      'u',
      'ni',
      'ti-',
      'o',
      'n',
      's-',
      'f',
      'a',
      's-',
      's',
      'u',
      'n',
      'g',
    ]);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] hyphenate «never», Literal: «Munitions» | «fassung»', () => {
    const r = run([reg(WORD)], opts(width('Munitions', SIZE), 'never'));
    expect(texts(r)).toEqual(['Munitions', 'fassung']);
    expect(hyphens(r)).toEqual([false, false]);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Regel 5.3: Notumbruch höchstens bis zur nächsten Trennstelle (k ≤ g), Literal bei 2,5 pt', () => {
    // Ohne die Grenze g ergäbe sich «…|n|it|i|o|…» statt «…|n|i|ti|o|…».
    const r = run([reg(WORD)], opts(2.5));
    expect(texts(r)).toEqual([
      'M',
      'u',
      'n',
      'i',
      'ti',
      'o',
      'n',
      's',
      'f',
      'a',
      's',
      's',
      'u',
      'n',
      'g',
    ]);
    expect(texts(r)).toEqual(expectedWordLines(WORD, 2.5, SIZE, 'ifWordDoesNotFit').lines);
    expect(hyphens(r).every((h) => !h)).toBe(true);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Beispiel 5c: mehrere Trennzeilen, fits true; Literal mit Grenze nextDown', () => {
    const max = width('Muniti-', SIZE);
    const exact = run([reg(WORD)], opts(max));
    expect(texts(exact)).toEqual(['Muniti-', 'ons-', 'fas-', 'sung']);
    expect(hyphens(exact)).toEqual([true, true, true, false]);
    expect(exact.fits).toBe(true);
    const less = run([reg(WORD)], opts(nextDown(max)));
    expect(texts(less)).toEqual(['Muni-', 'tions-', 'fas-', 'sung']);
    expect(less.fits).toBe(true);
  });

  it('[R-15-06] Beispiel 5b/P-16: Zeile nach einem Notumbruch überspannt eine Trennstelle (Suche über Wortliste)', () => {
    const words = [
      'Munitionsfassung',
      'Schiessausbildung',
      'Gefechtsschiessen',
      'Ausbildungsplanung',
    ];
    let found: { word: string; max: number } | undefined;
    for (const word of words) {
      const points = hyphenationPoints(word);
      const candidates: number[] = [];
      for (let i = 0; i < word.length; i++) {
        for (let j = i + 1; j <= word.length; j++) {
          candidates.push(width(word.slice(i, j), SIZE), width(`${word.slice(i, j)}-`, SIZE));
        }
      }
      candidates.sort((a, b) => a - b);
      const max = candidates.find((m) => {
        const e = expectedWordLines(word, m, SIZE, 'ifWordDoesNotFit');
        let start = 0;
        return e.lines.some((line, k) => {
          const s = start;
          const len = e.hyphens[k] ? line.length - 1 : line.length;
          start += len;
          // Zeile davor ist ein Notumbruch: nicht getrennt und nicht die letzte Zeile des Wortes
          const afterBreak = k > 0 && !e.hyphens[k - 1];
          return afterBreak && !points.includes(s) && points.some((t) => t > s && t < s + len);
        });
      });
      if (max !== undefined) {
        found = { word, max };
        break;
      }
    }
    expect(found, 'Fall mit Zeile über eine Trennstelle nach Notumbruch gefunden').toBeDefined();
    const { word, max } = found as { word: string; max: number };
    const expected = expectedWordLines(word, max, SIZE, 'ifWordDoesNotFit');
    const r = run([reg(word)], opts(max));
    expect(texts(r)).toEqual(expected.lines);
    expect(hyphens(r)).toEqual(expected.hyphens);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Beispiel 5b/P-16, Literal: «Schiessausbildung» → «Schie» | «ssaus-» | «bil-» | «dung»', () => {
    const max = width('ssaus-', SIZE);
    const r = run([reg('Schiessausbildung')], opts(max));
    expect(texts(r)).toEqual(['Schie', 'ssaus-', 'bil-', 'dung']);
    expect(hyphens(r)).toEqual([false, true, true, false]);
    expect(r.fits).toBe(false);
    const less = run([reg('Schiessausbildung')], opts(nextDown(max)));
    expect(texts(less)).toEqual(['Schie', 'ss-', 'aus-', 'bil-', 'dung']);
    expect(hyphens(less)).toEqual([false, true, true, true, false]);
  });

  it('[R-15-06] Beispiel 5e: Notumbruch am Wortende ergibt keine leere Zeile, folgende Segmente schliessen an (P-20)', () => {
    const r = run([reg('iiW i')], opts(width('ii', SIZE), 'never'));
    expect(r.lines).toHaveLength(3);
    expect(texts(r)).toEqual(['ii', 'W', 'i']);
    expect(trailings(r)).toEqual(['', ' ', '']);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] Beispiel 5d: führende Leerzeichen bleiben beim Notumbruch in runs und zählen zur Breite', () => {
    const max = width('  a', SIZE);
    const expected = expectedWordLines('  abcd', max, SIZE, 'never');
    const r = run([reg('  abcd')], opts(max, 'never'));
    expect(texts(r)).toEqual(expected.lines);
    expect(texts(r)).toEqual(['  a', 'bc', 'd']);
    expect(r.lines[0]?.trailing).toBe('');
    expect(r.lines[0]?.widthPt).toBe(width('  a', SIZE));
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] maxWidthPt kleiner als jedes Zeichen: je Zeile genau ein Codepunkt, kein Trennstrich, endet', () => {
    for (const mode of ['ifWordDoesNotFit', 'never'] as const) {
      const r = run([reg('Kp ab')], opts(Number.MIN_VALUE, mode));
      expect(texts(r)).toEqual(['K', 'p', 'a', 'b']);
      expect(trailings(r)).toEqual(['', ' ', '', '']);
      expect(hyphens(r)).toEqual([false, false, false, false]);
      expect(r.fits).toBe(false);
    }
  });

  it('[R-15-06] Notumbruch trennt nie ein Surrogatpaar', () => {
    const r = run([reg('\u{1F600}\u{1F600}\u{1F600}')], opts(Number.MIN_VALUE));
    expect(texts(r)).toEqual(['\u{1F600}', '\u{1F600}', '\u{1F600}']);
    expect(r.fits).toBe(false);
  });

  it('[R-15-06] fits false nur durch Notumbruch: Trennung allein lässt fits true', () => {
    expect(run([reg(WORD)], opts(hyphenMax())).fits).toBe(true);
    expect(run([reg(WORD)], opts(hyphenMax(), 'never')).fits).toBe(false);
  });
});

describe('breakText – Regel 6: Zeilentext', () => {
  it('[R-15-06] keine leeren Läufe, benachbarte Läufe gleichen Schnitts zusammengefasst', () => {
    const r = run([reg('Kp'), reg(' Wo'), bold(''), reg(' 1')], opts(Number.POSITIVE_INFINITY));
    expect(r.lines.map((l) => l.runs)).toEqual([[reg('Kp Wo 1')]]);
    const mixed = run([bold('A'), bold('VOR'), reg(' Fahne')], opts(Number.POSITIVE_INFINITY));
    expect(mixed.lines.map((l) => l.runs)).toEqual([[bold('AVOR'), reg(' Fahne')]]);
  });

  it('[R-15-06] Leerzeichen am Zeilenende über eine Laufgrenze hinweg gehen in trailing', () => {
    const r = run([reg('aa'), bold('  '), reg('aa')], opts(width('aa', SIZE)));
    expect(r.lines.map((l) => l.runs)).toEqual([[reg('aa')], [reg('aa')]]);
    expect(trailings(r)).toEqual(['  ', '']);
  });
});

describe('breakText – Leerzeichen nach P-15 (Beispiele 3a–3g)', () => {
  it('[R-15-06] 3a: führende Leerzeichen gehören zum ersten Wort, bleiben in runs', () => {
    const r = run([reg('  ab cd')], opts(width('  ab cd', SIZE)));
    expect(texts(r)).toEqual(['  ab cd']);
    expect(trailings(r)).toEqual(['']);
  });

  it('[R-15-06] 3b: Umbruch nach dem ersten Wort mit führenden Leerzeichen', () => {
    const r = run([reg('  ab cd')], opts(nextDown(width('  ab cd', SIZE))));
    expect(texts(r)).toEqual(['  ab', 'cd']);
    expect(trailings(r)).toEqual([' ', '']);
    expect(r.lines[0]?.widthPt).toBe(width('  ab', SIZE));
  });

  it('[R-15-06] 3c: Absatz nur aus Leerzeichen → eine Zeile runs [], trailing = alle Leerzeichen', () => {
    for (const max of [Number.POSITIVE_INFINITY, Number.MIN_VALUE]) {
      const r = run([reg('   ')], opts(max));
      expect(r.lines).toEqual([{ runs: [], widthPt: 0, endsWithHyphen: false, trailing: '   ' }]);
      expect(r.fits).toBe(true);
    }
  });

  it('[R-15-06] 3d: Absatz nur aus Leerzeichen vor U+000A', () => {
    const r = run([reg('   \nx')], opts(Number.POSITIVE_INFINITY));
    expect(r.lines.map((l) => l.runs)).toEqual([[], [reg('x')]]);
    expect(trailings(r)).toEqual(['   \n', '']);
  });

  it('[R-15-06] 3e: abschliessende Leerzeichen gehen in trailing, auch wenn sie nicht passen', () => {
    const r = run([reg('ab   ')], opts(width('ab', SIZE)));
    expect(texts(r)).toEqual(['ab']);
    expect(trailings(r)).toEqual(['   ']);
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] 3f: leerer Absatz nach U+000A → Zeile ohne Läufe mit leerem trailing', () => {
    const r = run([reg('a\n')], opts(Number.POSITIVE_INFINITY));
    expect(texts(r)).toEqual(['a', '']);
    expect(trailings(r)).toEqual(['\n', '']);
    expect(r.lines[1]?.runs).toEqual([]);
  });

  it('[R-15-06] 3g: «a -b»: nach dem Bindestrich hinter einem Leerzeichen kein Umbruch', () => {
    const r = run([reg('a -b')], opts(nextDown(width('a -b', SIZE)), 'never'));
    expect(texts(r)).toEqual(['a', '-b']);
    expect(trailings(r)).toEqual([' ', '']);
    expect(r.fits).toBe(true);
  });

  it('[R-15-06] Leerzeichen an einer Umbruchstelle ohne Umbruch bleiben in runs und zählen zur Breite', () => {
    const r = run([reg('aa  aa')], opts(width('aa  aa', SIZE)));
    expect(texts(r)).toEqual(['aa  aa']);
    expect(r.lines[0]?.widthPt).toBe(width('aa  aa', SIZE));
  });
});

describe('breakText – Determinismus und Fehlerverhalten', () => {
  it('[R-15-06] deterministisch und ohne Änderung der Eingabe', () => {
    const runs = Object.freeze([
      Object.freeze(bold('AVOR')),
      Object.freeze(reg(' Fahne Munitionsfassung Munitions-Fassung\n  Kp Wo 1')),
    ]);
    const o = Object.freeze(opts(width('Munitionsfas', SIZE)));
    const a = run(runs, o);
    const b = run(runs, o);
    expect(a).toEqual(b);
    expect(runs).toEqual([
      bold('AVOR'),
      reg(' Fahne Munitionsfassung Munitions-Fassung\n  Kp Wo 1'),
    ]);
  });

  it('[R-15-06] wirft invalidTextBox, wenn maxWidthPt NaN oder ≤ 0 ist', () => {
    for (const max of [Number.NaN, 0, -0, -1, Number.NEGATIVE_INFINITY]) {
      expect(
        errorCode(() => breakText([reg('Kp')], opts(max))),
        String(max),
      ).toBe('invalidTextBox');
      expect(
        errorCode(() => breakText([], opts(max))),
        `leer ${max}`,
      ).toBe('invalidTextBox');
    }
  });

  it('[R-15-06] wirft invalidTextBox, wenn sizePt nicht endlich oder ≤ 0 ist', () => {
    for (const size of [
      Number.NaN,
      0,
      -0,
      -5,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(
        errorCode(() => breakText([reg('Kp')], opts(10, 'never', size))),
        String(size),
      ).toBe('invalidTextBox');
      expect(
        errorCode(() => breakText([], opts(10, 'never', size))),
        `leer ${size}`,
      ).toBe('invalidTextBox');
    }
  });

  it('[R-15-06] gültige Grenzwerte werfen nicht: maxWidthPt +Infinity und kleinste positive Zahl', () => {
    for (const max of [Number.POSITIVE_INFINITY, Number.MIN_VALUE]) {
      expect(
        errorCode(() => breakText([reg('Kp Wo 1')], opts(max))),
        String(max),
      ).toBe('kein Fehler');
    }
    expect(errorCode(() => breakText([reg('Kp')], opts(10, 'never', Number.MIN_VALUE)))).toBe(
      'kein Fehler',
    );
  });
});

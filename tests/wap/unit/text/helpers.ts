// Hilfen für die Tests von Paket E1-02b (Vertrag E1-02b, Abschnitt 2.3/2.4).
// Nur Zugriff über den Vertrag; Testtexte fiktiv.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type {
  BreakOptions,
  BreakResult,
  BrokenLine,
} from '../../../../src/model/wap/layout/text/break';
import { hyphenationPoints } from '../../../../src/model/wap/layout/text/hyphenate';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import type { FontWeight, StyledRun } from '../../../../src/model/wap/layout/text/types';

/** Wurzel des Repos (tests/wap/unit/text → vier Ebenen hoch). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** SHA-256 der Schriftdateien laut Vertrag E1-02b Abschnitt 1 (ADR-003). */
export const FONT_SHA256: { readonly [W in FontWeight]: string } = {
  regular: '88cc899855d30f9c779b73c3319d0e077b098f927187aafce11ca029add707a6',
  bold: 'ec96ac9fdd94766f66f6140c1375bf011577558f88d43f76b3b59307d2a6bca3',
};

export const reg = (text: string): StyledRun => ({ text, weight: 'regular' });
export const bold = (text: string): StyledRun => ({ text, weight: 'bold' });

/** Breite eines einheitlichen Laufs nach Vertrag 2.2 (über `measureRuns`). */
export function width(text: string, sizePt: number, weight: FontWeight = 'regular'): number {
  return measureRuns([{ text, weight }], sizePt);
}

/** Text der gezeichneten Läufe einer Zeile. */
export function lineText(line: BrokenLine): string {
  return line.runs.map((r) => r.text).join('');
}

/** Anteil der Zeile am Eingabetext (Regel 7): Text ohne eingefügten Trennstrich, dann `trailing`. */
export function sourceOf(line: BrokenLine): string {
  const t = lineText(line);
  return (line.endsWithHyphen ? t.slice(0, -1) : t) + line.trailing;
}

export function inputText(runs: readonly StyledRun[]): string {
  return runs.map((r) => r.text).join('');
}

/** Grösste Gleitkommazahl kleiner als x (x endlich und > 0). */
export function nextDown(x: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) - 1n);
  return view.getFloat64(0);
}

/**
 * Fehlercode eines Aufrufs (Vertrag 2.4: nur `code` wird geprüft, Festlegung E1-02b-02).
 * Liefert einen beschreibenden Text, wenn kein Fehler oder ein Fehler ohne `code` auftritt.
 */
export function errorCode(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e) return (e as { code: unknown }).code;
    return `Fehler ohne code: ${String(e)}`;
  }
  return 'kein Fehler';
}

/** Absatz (Text zwischen zwei U+000A) um die Stelle `pos` des Eingabetexts. */
function paragraphAt(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  const nl = text.indexOf('\n', pos);
  return { start, end: nl === -1 ? text.length : nl };
}

/**
 * Prüft die Invarianten von `breakText` (Regeln 2, 3, 6, 7, 8 mit P-15) für ein Ergebnis.
 */
export function expectBreakInvariants(
  runs: readonly StyledRun[],
  opts: BreakOptions,
  result: BreakResult,
): void {
  const text = inputText(runs);
  // Regel 7: verlustfrei
  expect(result.lines.map(sourceOf).join('')).toBe(text);
  // Regel 2: leere Eingabe → keine Zeile; sonst letzte Zeile ohne U+000A und je U+000A eine Zeile mehr
  if (text === '') {
    expect(result.lines).toEqual([]);
    expect(result.fits).toBe(true);
  } else {
    const newlines = [...text].filter((c) => c === '\n').length;
    expect(result.lines.filter((l) => l.trailing.endsWith('\n')).length).toBe(newlines);
    expect(result.lines.at(-1)?.trailing.endsWith('\n')).toBe(false);
  }
  let offset = 0;
  for (const line of result.lines) {
    // Regel 8
    expect(line.widthPt).toBe(measureRuns(line.runs, opts.sizePt));
    if (result.fits) expect(line.widthPt).toBeLessThanOrEqual(opts.maxWidthPt);
    // Regel 6: keine leeren Läufe, benachbarte Läufe mit verschiedenem Schnitt
    for (const [i, r] of line.runs.entries()) {
      expect(r.text.length).toBeGreaterThan(0);
      if (i > 0) expect(r.weight).not.toBe(line.runs[i - 1]?.weight);
    }
    // Regel 6: trailing = Leerzeichen, danach höchstens ein U+000A; kein U+000A in runs
    expect(line.trailing).toMatch(/^ *\n?$/);
    const drawn = lineText(line);
    expect(drawn).not.toContain('\n');
    // Regel 5: eingefügter Trennstrich im Schnitt des Zeichens davor (gleicher Lauf, da zusammengefasst)
    if (line.endsWithHyphen) {
      const last = line.runs.at(-1);
      expect(last?.text.endsWith('-')).toBe(true);
      expect(last?.text.length ?? 0).toBeGreaterThanOrEqual(2);
    }
    const source = sourceOf(line);
    const drawnLength = source.length - line.trailing.length;
    const para = paragraphAt(text, offset);
    // P-15: Zeilentext endet nur dann mit U+0020, wenn er ganz aus führenden Leerzeichen des Absatzes
    // besteht (Notumbruch, Regel 5); sonst stehen Leerzeichen am Zeilenende in trailing.
    if (drawn.endsWith(' ')) {
      expect(text.slice(para.start, offset + drawnLength)).toMatch(/^ +$/);
      expect(result.fits).toBe(false);
    }
    // P-15: Leerzeichen in trailing folgen einem Nicht-Leerzeichen desselben Absatzes, ausser der Absatz
    // besteht nur aus Leerzeichen (dann eine Zeile mit runs: []); führende Leerzeichen nie in trailing.
    const spaces = line.trailing.replace('\n', '');
    if (spaces.length > 0) {
      const before = text.slice(para.start, offset + drawnLength);
      const paragraph = text.slice(para.start, para.end);
      if (/^ *$/.test(paragraph)) {
        expect(line.runs).toEqual([]);
        expect(line.trailing.replace('\n', '')).toBe(paragraph);
      } else {
        expect(before).toMatch(/[^ ]/);
      }
    }
    offset += source.length;
  }
}

export interface ExpectedWordLines {
  /** Gezeichneter Text je Zeile (bei Trennung mit angehängtem «-»). */
  readonly lines: readonly string[];
  readonly hyphens: readonly boolean[];
  readonly fits: boolean;
}

/**
 * Erwartete Zeilen eines einzelnen Wortes (ein Schnitt, ohne Umbruchstelle) nach Regel 5 als Schrittfolge
 * (P-16): Rest passt → fertig; sonst grösste passende Trennstelle mit Trennstrich; sonst Notumbruch bis
 * höchstens zur nächsten Trennstelle (mindestens ein Codepunkt). Führende Leerzeichen zählen wie Zeichen.
 * Grundlage sind `hyphenationPoints` und `measureRuns` aus dem Vertrag.
 */
export function expectedWordLines(
  word: string,
  maxWidthPt: number,
  sizePt: number,
  hyphenate: BreakOptions['hyphenate'],
  weight: FontWeight = 'regular',
): ExpectedWordLines {
  const lead = (/^ */.exec(word)?.[0] ?? '').length;
  const points =
    hyphenate === 'never' ? [] : hyphenationPoints(word.slice(lead)).map((i) => i + lead);
  const fitsWidth = (t: string): boolean => width(t, sizePt, weight) <= maxWidthPt;
  const lines: string[] = [];
  const hyphens: boolean[] = [];
  let fits = true;
  let s = 0;
  // Endet, sobald das Wort aufgebraucht ist: nach einem Notumbruch bis zum Wortende entsteht keine leere Zeile.
  while (s < word.length) {
    if (fitsWidth(word.slice(s))) {
      lines.push(word.slice(s));
      hyphens.push(false);
      break;
    }
    const hs = points.filter((h) => h > s && fitsWidth(`${word.slice(s, h)}-`));
    if (hs.length > 0) {
      const h = Math.max(...hs);
      lines.push(`${word.slice(s, h)}-`);
      hyphens.push(true);
      s = h;
      continue;
    }
    const g = points.find((t) => t > s) ?? word.length;
    let k = s + String.fromCodePoint(word.codePointAt(s) as number).length;
    while (k < g) {
      const next = k + String.fromCodePoint(word.codePointAt(k) as number).length;
      if (next > g || !fitsWidth(word.slice(s, next))) break;
      k = next;
    }
    lines.push(word.slice(s, k));
    hyphens.push(false);
    fits = false;
    s = k;
  }
  return { lines, hyphens, fits };
}

/** Erwartete Zeilen eines zu langen Wortes, wenn jedes Stück bis zu einer Trennstelle passt (kein Notumbruch). */
export function expectedHyphenatedLines(
  word: string,
  maxWidthPt: number,
  sizePt: number,
  weight: FontWeight = 'regular',
): string[] {
  const e = expectedWordLines(word, maxWidthPt, sizePt, 'ifWordDoesNotFit', weight);
  expect(e.fits, 'Testfall setzt voraus, dass kein Notumbruch nötig ist').toBe(true);
  return [...e.lines];
}

/** Erwartete Zeilen eines zeichenweisen Notumbruchs ohne Trennstellen (Regel 5, `'never'`). */
export function expectedCharLines(
  word: string,
  maxWidthPt: number,
  sizePt: number,
  weight: FontWeight = 'regular',
): string[] {
  return [...expectedWordLines(word, maxWidthPt, sizePt, 'never', weight).lines];
}

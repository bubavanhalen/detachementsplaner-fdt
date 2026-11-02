import { assertMaxWidthPt, assertSizePt } from './errors';
import { hyphenationPoints } from './hyphenate';
import type { FontWeight, StyledRun } from './types';
import { charUnits, unitsToPt } from './units';

export interface BreakOptions {
  /** Grösste Zeilenbreite in pt: endlich und > 0 oder +Infinity (dann nur erzwungene Umbrüche). */
  readonly maxWidthPt: number;
  readonly sizePt: number;
  readonly hyphenate: 'ifWordDoesNotFit' | 'never';
}

export interface BrokenLine {
  /**
   * Zu zeichnender Text der Zeile: keine leeren Läufe, benachbarte Läufe gleichen Schnitts zusammengefasst,
   * ohne Leerzeichen und Zeilenwechsel am Zeilenende; bei `endsWithHyphen` mit eingefügtem Trennstrich
   * U+002D am Ende.
   */
  readonly runs: readonly StyledRun[];
  /** = measureRuns(runs, sizePt). */
  readonly widthPt: number;
  /** true nur für einen durch Silbentrennung eingefügten Trennstrich (nicht für einen Bindestrich der Eingabe). */
  readonly endsWithHyphen: boolean;
  /** Am Zeilenende abgetrennte, nicht gezeichnete Zeichen: Leerzeichen U+0020, danach höchstens ein U+000A. */
  readonly trailing: string;
}

export interface BreakResult {
  readonly lines: readonly BrokenLine[];
  /** false, wenn mindestens ein zeichenweiser Notumbruch nötig war (Wortteil auch nach Silbentrennung zu breit). */
  readonly fits: boolean;
}

const SPACE = ' ';
const NEWLINE = '\n';
const HYPHEN = '-';

/** Ein Codepunkt der Eingabe mit Schnitt und Vorschub in Font-Einheiten. */
interface Item {
  readonly char: string;
  readonly weight: FontWeight;
  readonly units: number;
}

/** Segment nach Regel 3: Wort und die Leerzeichen der Umbruchstelle dahinter (leer nach Bindestrich). */
interface Segment {
  readonly word: readonly Item[];
  readonly spaces: readonly Item[];
}

/**
 * Umbruch an Leerzeichen und nach Bindestrich; Silbentrennung (de-1996) nur für ein Wort, das allein nicht
 * in eine Zeile passt (Beschrieb 15, R-15-06). Regeln im Einzelnen: Vertrag E1-02b Abschnitt 2.3.
 * Verlustfrei: Die Verkettung über alle Zeilen von (Text der Läufe ohne eingefügten Trennstrich) + trailing
 * ergibt den Eingabetext.
 * @throws WapError `invalidTextBox`, wenn maxWidthPt NaN oder ≤ 0 ist oder sizePt nicht endlich oder ≤ 0 ist.
 */
export function breakText(runs: readonly StyledRun[], opts: BreakOptions): BreakResult {
  assertSizePt(opts.sizePt);
  assertMaxWidthPt(opts.maxWidthPt);
  // Regel 1: Codepunkt für Codepunkt über den verketteten Text aller Läufe.
  const items: Item[] = [];
  for (const run of runs) {
    for (const char of run.text) {
      items.push({ char, weight: run.weight, units: charUnits(char, run.weight) });
    }
  }
  if (items.length === 0) return { lines: [], fits: true };
  const breaker = new LineBreaker(opts);
  // Regel 2: U+000A beendet den Absatz; der Text nach dem letzten U+000A bildet die letzte Zeile.
  let start = 0;
  items.forEach((item, i) => {
    if (item.char !== NEWLINE) return;
    breaker.paragraph(items.slice(start, i), NEWLINE);
    start = i + 1;
  });
  breaker.paragraph(items.slice(start), '');
  return { lines: breaker.lines, fits: breaker.fits };
}

const sumUnits = (items: readonly Item[]): number => items.reduce((sum, it) => sum + it.units, 0);
const textOf = (items: readonly Item[]): string => items.map((it) => it.char).join('');

/** Läufe ohne leere Läufe; benachbarte Zeichen gleichen Schnitts zusammengefasst (Regel 6). */
function toRuns(items: readonly Item[]): StyledRun[] {
  const out: StyledRun[] = [];
  for (const it of items) {
    const last = out.at(-1);
    if (last?.weight === it.weight)
      out[out.length - 1] = { text: last.text + it.char, weight: it.weight };
    else out.push({ text: it.char, weight: it.weight });
  }
  return out;
}

/** Eingefügter Trennstrich im Schnitt des Zeichens davor (Regel 5). */
function hyphenAfter(item: Item): Item {
  return { char: HYPHEN, weight: item.weight, units: charUnits(HYPHEN, item.weight) };
}

/**
 * Segmente eines Absatzkerns (ohne abschliessende Leerzeichen, endet also mit einem Nicht-Leerzeichen):
 * Umbruchstellen sind Leerzeichenfolgen nach dem ersten Nicht-Leerzeichen und Bindestriche zwischen zwei
 * Nicht-Leerzeichen (Regel 3).
 */
function segmentsOf(core: readonly Item[]): Segment[] {
  const charAt = (i: number): string | undefined => core[i]?.char;
  const segments: Segment[] = [];
  let segStart = 0;
  // Führende Leerzeichen sind keine Umbruchstelle; sie gehören zum ersten Wort.
  let i = 0;
  while (charAt(i) === SPACE) i++;
  while (i < core.length) {
    if (charAt(i) === SPACE) {
      let j = i;
      while (charAt(j) === SPACE) j++;
      segments.push({ word: core.slice(segStart, i), spaces: core.slice(i, j) });
      segStart = j;
      i = j;
      continue;
    }
    const prev = charAt(i - 1);
    const next = charAt(i + 1);
    const isBreakHyphen =
      charAt(i) === HYPHEN &&
      prev !== undefined &&
      prev !== SPACE &&
      next !== undefined &&
      next !== SPACE;
    if (isBreakHyphen) {
      segments.push({ word: core.slice(segStart, i + 1), spaces: [] });
      segStart = i + 1;
    }
    i++;
  }
  segments.push({ word: core.slice(segStart), spaces: [] });
  return segments;
}

/**
 * Trennstellen eines Wortes als Codepunkt-Indizes: `hyphenationPoints` des Wortes ohne führende
 * Leerzeichen, um deren Anzahl verschoben (Regel 5); Stellen innerhalb eines Surrogatpaars entfallen.
 */
function wordHyphenationPoints(word: readonly Item[]): number[] {
  let lead = 0;
  while (word[lead]?.char === SPACE) lead++;
  const indexByOffset = new Map<number, number>();
  let offset = 0;
  for (let i = lead; i < word.length; i++) {
    indexByOffset.set(offset, i);
    offset += (word[i] as Item).char.length;
  }
  const points: number[] = [];
  for (const p of hyphenationPoints(textOf(word.slice(lead)))) {
    const index = indexByOffset.get(p);
    if (index !== undefined) points.push(index);
  }
  return points;
}

/** Zeilenumbruch nach Vertrag E1-02b 2.3, Absatz für Absatz. */
class LineBreaker {
  readonly lines: BrokenLine[] = [];
  fits = true;
  private readonly opts: BreakOptions;

  constructor(opts: BreakOptions) {
    this.opts = opts;
  }

  /** Regeln 3 bis 6 für einen Absatz; `end` ist U+000A oder leer (letzter Absatz). */
  paragraph(items: readonly Item[], end: string): void {
    let last = items.length - 1;
    while (items[last]?.char === SPACE) last--;
    // Abschliessende Leerzeichen gehen in trailing der letzten Zeile des Absatzes.
    const trailing = textOf(items.slice(last + 1)) + end;
    if (last < 0) {
      // Absatz nur aus Leerzeichen (auch leer): genau eine Zeile ohne Läufe.
      this.emit([], false, trailing);
      return;
    }
    let cur: Item[] = [];
    let curUnits = 0;
    let pending: readonly Item[] = [];
    for (const seg of segmentsOf(items.slice(0, last + 1))) {
      // Regel 4: gierig; die Leerzeichen der Umbruchstelle davor zählen nur ohne Umbruch.
      const wordUnits = sumUnits(seg.word);
      const joinedUnits = curUnits + sumUnits(pending) + wordUnits;
      if (cur.length > 0 && this.fitsUnits(joinedUnits)) {
        // Anhängen ohne Spread: lange Wörter (Import, .wap.json) sprengen sonst die Argumentliste.
        for (const item of pending) cur.push(item);
        for (const item of seg.word) cur.push(item);
        curUnits = joinedUnits;
      } else {
        if (cur.length > 0) this.emit(cur, false, textOf(pending));
        // Neue Zeile: das Wort beginnt sie; passt es allein nicht, wird es getrennt (Regel 5).
        cur = (this.fitsUnits(wordUnits) ? seg.word : this.splitWord(seg.word)).slice();
        curUnits = sumUnits(cur);
      }
      pending = seg.spaces;
    }
    this.emit(cur, false, trailing);
  }

  /**
   * Regel 5: gibt die Zeilen eines zu langen Wortes aus und liefert den Rest als laufende Zeile.
   * Breiten über Präfixsummen der Font-Einheiten (ganzzahlig, exakt); die Suche bricht ab, sobald die
   * Breite monoton über maxWidthPt wächst (CR-E102b-01).
   */
  private splitWord(word: readonly Item[]): readonly Item[] {
    const points = this.opts.hyphenate === 'never' ? [] : wordHyphenationPoints(word);
    // prefix[i] = Summe der Vorschübe von word[0..i).
    const prefix = [0];
    for (const item of word) prefix.push((prefix.at(-1) as number) + item.units);
    const unitsOf = (from: number, to: number): number =>
      (prefix[to] as number) - (prefix[from] as number);
    // Kein Trennstrich ist schmaler als dieser: Abbruchgrenze der Suche nach h.
    const minHyphenUnits = Math.min(charUnits(HYPHEN, 'regular'), charUnits(HYPHEN, 'bold'));
    let next = 0; // erste Trennstelle > s in `points` (aufsteigend)
    let s = 0;
    for (;;) {
      if (this.fitsUnits(unitsOf(s, word.length))) return word.slice(s);
      while ((points[next] ?? word.length) <= s) next++;
      // Grösste Trennstelle h > s, bei der das Stück mit Trennstrich passt.
      let h: number | undefined;
      for (let i = next; i < points.length; i++) {
        const t = points[i] as number;
        const piece = unitsOf(s, t);
        if (this.fitsUnits(piece + hyphenAfter(word[t - 1] as Item).units)) h = t;
        else if (!this.fitsUnits(piece + minHyphenUnits)) break;
      }
      if (h !== undefined) {
        const line = word.slice(s, h);
        line.push(hyphenAfter(word[h - 1] as Item));
        this.emit(line, true, '');
        s = h;
        continue;
      }
      // Notumbruch: höchstens bis zur nächsten Trennstelle g, mindestens ein Codepunkt.
      const g = points[next] ?? word.length;
      let k = s + 1;
      while (k < g && this.fitsUnits(unitsOf(s, k + 1))) k++;
      this.fits = false;
      // P-20: Erreicht der Notumbruch das Wortende, ist seine Zeile die laufende Zeile.
      if (k === word.length) return word.slice(s);
      this.emit(word.slice(s, k), false, '');
      s = k;
    }
  }

  private fitsUnits(units: number): boolean {
    return unitsToPt(units, this.opts.sizePt) <= this.opts.maxWidthPt;
  }

  private emit(items: readonly Item[], endsWithHyphen: boolean, trailing: string): void {
    this.lines.push({
      runs: toRuns(items),
      widthPt: unitsToPt(sumUnits(items), this.opts.sizePt),
      endsWithHyphen,
      trailing,
    });
  }
}

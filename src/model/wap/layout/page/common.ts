// Gemeinsame Bausteine der Seitenkomposition (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt D, E6, F;
// Änderungsnotiz Tests Schritt 3). Intern: wird nicht über page/index.ts exportiert. Rein (R-L-02).

import type { Id, IsoDate, Rgb } from '../../types';
import { GRID_CONSTANTS } from '../grid/constants';
import type {
  ItemRole,
  LineItem,
  PageItem,
  Rect,
  RectItem,
  Stroke,
  TextItem,
  TextRunOut,
} from '../pageModel';
import { type BrokenLine, breakText } from '../text/break';
import { measureRuns } from '../text/measure';
import { ascentPt, fontMetrics, lineHeightPt } from '../text/metrics';
import type { FontWeight, StyledRun } from '../text/types';
import type { PageFallbackEvent, PageRegion, PageTextKind, RegionLayout } from './types';

/** Innenabstand der Textflächen (E1-02d V-02d-9). */
export const INSET = GRID_CONSTANTS.textInsetPt;
/** Schritt beim Verkleinern (V-02d-8). */
export const SIZE_STEP = GRID_CONSTANTS.sizeStepPt;
/** Rechentoleranz beim Passen (E1-02d 2e, fitSingleLine). */
export const FIT_EPS = 1e-6;
/** Kürzungszeichen (R-10-41). */
export const ELLIPSIS = GRID_CONSTANTS.ellipsis;

/** Grössen der Stufen d = 0, 0,25, … von `standard` bis `min` (letzte Stufe = min). */
export function sizeSteps(standard: number, min: number): readonly number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const s = Math.max(min, standard - i * SIZE_STEP);
    out.push(s);
    if (s <= min) return out;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Elemente
// ---------------------------------------------------------------------------------------------------------

export function colorCopy(c: Rgb): Rgb {
  return { r: c.r, g: c.g, b: c.b };
}

export function strokeCopy(s: Stroke): Stroke {
  return {
    color: colorCopy(s.color),
    widthPt: s.widthPt,
    dash: s.dash === null ? null : [...s.dash],
  };
}

export function lineItem(
  role: ItemRole,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: Stroke,
): LineItem {
  return { kind: 'line', role, x1, y1, x2, y2, stroke: strokeCopy(stroke) };
}

export function rectItem(
  role: ItemRole,
  rect: Rect,
  fill: Rgb | null,
  stroke: Stroke | null,
): RectItem {
  return {
    kind: 'rect',
    role,
    rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    fill: fill === null ? null : colorCopy(fill),
    stroke: stroke === null ? null : strokeCopy(stroke),
  };
}

/** Läufe einer Zeile in einer Farbe (ohne leere Läufe). */
export function runsOut(runs: readonly StyledRun[], color: Rgb): TextRunOut[] {
  return runs
    .filter((r) => r.text !== '')
    .map((r) => ({ text: r.text, weight: r.weight, color: colorCopy(color), strike: false }));
}

export interface TextSpec {
  readonly role: ItemRole;
  readonly x: number;
  readonly baselineY: number;
  readonly rotation?: 0 | 90;
  readonly sizePt: number;
  readonly runs: readonly StyledRun[];
  readonly color: Rgb;
  readonly frame: Rect;
  readonly entryId?: Id;
}

export function textItem(t: TextSpec): TextItem {
  return {
    kind: 'text',
    role: t.role,
    ...(t.entryId === undefined ? {} : { entryId: t.entryId }),
    x: t.x,
    baselineY: t.baselineY,
    rotation: t.rotation ?? 0,
    sizePt: t.sizePt,
    runs: runsOut(t.runs, t.color),
    frame: { x: t.frame.x, y: t.frame.y, w: t.frame.w, h: t.frame.h },
  };
}

/** Sammelt Formen und Texte eines Bereichs; Formen stehen vor den Texten (D). */
export class RegionBuilder {
  private readonly shapes: PageItem[] = [];
  private readonly texts: {
    readonly item: TextItem;
    readonly kind: PageTextKind;
    readonly standardSizePt: number;
    readonly date: IsoDate | null;
  }[] = [];
  private readonly events: PageFallbackEvent[] = [];

  shape(item: PageItem): void {
    this.shapes.push(item);
  }

  /** Text nur, wenn er mindestens einen nicht leeren Lauf hat. */
  text(item: TextItem, kind: PageTextKind, standardSizePt: number, date: IsoDate | null): void {
    if (item.runs.length === 0) return;
    this.texts.push({ item, kind, standardSizePt, date });
  }

  event(e: PageFallbackEvent): void {
    this.events.push(e);
  }

  build(): RegionLayout {
    const items: PageItem[] = [...this.shapes];
    const texts = this.texts.map((t) => {
      items.push(t.item);
      return {
        item: items.length - 1,
        kind: t.kind,
        standardSizePt: t.standardSizePt,
        date: t.date,
      };
    });
    return { items, texts, fallbacks: [...this.events] };
  }
}

/** Rückfallereignis eines Seitentexts (E6 «Ereignisfelder», E3, E4). */
export function pageEvent(
  kind: 'ellipsis' | 'textOmitted' | 'continuationPage' | 'tooManyColumns' | 'labelOutside',
  region: PageRegion,
  weekId: Id,
  field: PageTextKind,
  extra: {
    readonly date?: IsoDate | null;
    readonly entryId?: Id | null;
    readonly columnId?: Id | null;
  } = {},
): PageFallbackEvent {
  return {
    kind,
    region,
    weekId,
    date: extra.date ?? null,
    entryId: extra.entryId ?? null,
    piece: null,
    dropped: [],
    field,
    columnId: extra.columnId ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------

/** Absatztext (E6): CR LF und CR werden zu LF; leere Läufe entfallen. */
export function paragraphRuns(runs: readonly StyledRun[]): StyledRun[] {
  return runs
    .map((r) => ({ text: r.text.replace(/\r\n?/g, '\n'), weight: r.weight }))
    .filter((r) => r.text !== '');
}

export function plainRuns(text: string, weight: FontWeight): StyledRun[] {
  return text === '' ? [] : [{ text, weight }];
}

export function runsText(runs: readonly { readonly text: string }[]): string {
  return runs.map((r) => r.text).join('');
}

export function width(runs: readonly StyledRun[], sizePt: number): number {
  return runs.length === 0 ? 0 : measureRuns(runs, sizePt);
}

/** Zeichen (Codepunkte) mit Schnitt. */
interface Glyph {
  readonly ch: string;
  readonly weight: FontWeight;
}

function glyphsOf(runs: readonly StyledRun[]): Glyph[] {
  const out: Glyph[] = [];
  for (const r of runs) for (const ch of r.text) out.push({ ch, weight: r.weight });
  return out;
}

/** Läufe ohne leere Läufe; benachbarte Zeichen gleichen Schnitts zusammengefasst. */
export function mergeGlyphs(glyphs: readonly Glyph[]): StyledRun[] {
  const out: StyledRun[] = [];
  for (const g of glyphs) {
    const last = out.at(-1);
    if (last?.weight === g.weight)
      out[out.length - 1] = { text: last.text + g.ch, weight: g.weight };
    else out.push({ text: g.ch, weight: g.weight });
  }
  return out;
}

const isSpace = (ch: string): boolean => /\s/u.test(ch);

/** Schnitt des «…» ohne verbliebene Zeichen: «normal» (E1-02d 2e) bzw. der des ersten Laufs (Köpfe, S3-18). */
export type EmptyWeight = 'regular' | 'firstRun';

/** Schnitt des «…»: der des letzten verbliebenen Zeichens, sonst nach `empty`. */
function ellipsisWeight(
  runs: readonly StyledRun[],
  last: Glyph | undefined,
  empty: EmptyWeight,
): FontWeight {
  if (last !== undefined) return last.weight;
  return empty === 'firstRun' ? (runs[0]?.weight ?? 'regular') : 'regular';
}

/** Anfangsstück aus `k` Codepunkten ohne Leerraum am Ende, mit «…» (wie E1-02d 2e «Kürzung»). */
export function truncatedRuns(
  runs: readonly StyledRun[],
  k: number,
  empty: EmptyWeight = 'regular',
): StyledRun[] {
  const head = glyphsOf(runs).slice(0, k);
  while (head.length > 0 && isSpace((head.at(-1) as Glyph).ch)) head.pop();
  return mergeGlyphs([...head, { ch: ELLIPSIS, weight: ellipsisWeight(runs, head.at(-1), empty) }]);
}

/**
 * Längstes Anfangsstück (Codepunkte, Leerraum am Ende entfernt) mit angehängtem «…» (Schnitt nach
 * `ellipsisWeight`), das einzeilig in `widthPt` passt (wie E1-02d 2e «Kürzung»); null, wenn nicht einmal «…»
 * passt. Läuft in O(n) über Präfixsummen.
 */
export function truncateLine(
  runs: readonly StyledRun[],
  widthPt: number,
  sizePt: number,
  empty: EmptyWeight = 'regular',
): StyledRun[] | null {
  const glyphs = glyphsOf(runs);
  const prefix = [0];
  for (const g of glyphs) {
    prefix.push((prefix.at(-1) as number) + width([{ text: g.ch, weight: g.weight }], sizePt));
  }
  // keep[k] = Zahl der Zeichen des Anfangsstücks k ohne Leerraum am Ende.
  const keep: number[] = [0];
  for (let k = 1; k <= glyphs.length; k++) {
    keep.push(isSpace((glyphs[k - 1] as Glyph).ch) ? (keep[k - 1] as number) : k);
  }
  for (let k = glyphs.length; k >= 0; k--) {
    const n = keep[k] as number;
    const weight = ellipsisWeight(runs, glyphs[n - 1], empty);
    const total = (prefix[n] as number) + width([{ text: ELLIPSIS, weight }], sizePt);
    if (total <= widthPt + FIT_EPS) {
      return mergeGlyphs([...glyphs.slice(0, n), { ch: ELLIPSIS, weight }]);
    }
  }
  return null;
}

/** Läufe ab dem n-ten UTF-16-Zeichen des verketteten Texts. */
export function runsFrom(runs: readonly StyledRun[], n: number): StyledRun[] {
  const out: StyledRun[] = [];
  let rest = n;
  for (const r of runs) {
    if (rest >= r.text.length) {
      rest -= r.text.length;
      continue;
    }
    out.push({ text: r.text.slice(rest), weight: r.weight });
    rest = 0;
  }
  return out;
}

/** Läufe bis vor das erste LF (für die Kürzung einer Zeile). */
export function runsUntilBreak(runs: readonly StyledRun[]): StyledRun[] {
  const out: StyledRun[] = [];
  for (const r of runs) {
    const i = r.text.indexOf('\n');
    if (i < 0) {
      out.push(r);
      continue;
    }
    if (i > 0) out.push({ text: r.text.slice(0, i), weight: r.weight });
    break;
  }
  return out;
}

export interface ParagraphLines {
  readonly lines: readonly BrokenLine[];
  /** Beginn jeder Zeile als UTF-16-Stelle im verketteten Text. */
  readonly starts: readonly number[];
  readonly fits: boolean;
}

/** Verbrauchte UTF-16-Zeichen einer umbrochenen Zeile (ohne eingefügten Trennstrich, mit trailing). */
function consumed(l: BrokenLine): number {
  return runsText(l.runs).length - (l.endsWithHyphen ? 1 : 0) + l.trailing.length;
}

/**
 * Umbruch in zwei Schritten (E3, S3-2): Zeile 1 mit `breakText` auf `w1`, der Rest (Läufe nach Zeile 1, ohne deren
 * trailing) auf `wR`; LF ist harter Umbruch, Trennung 'ifWordDoesNotFit' (S3-8 b).
 */
export function breakParagraph(
  runs: readonly StyledRun[],
  w1: number,
  wR: number,
  sizePt: number,
): ParagraphLines {
  if (runs.length === 0) return { lines: [], starts: [], fits: true };
  const r1 = breakText(runs, { maxWidthPt: w1, sizePt, hyphenate: 'ifWordDoesNotFit' });
  const l1 = r1.lines[0];
  if (l1 === undefined) return { lines: [], starts: [], fits: true };
  if (r1.lines.length === 1) return { lines: [l1], starts: [0], fits: r1.fits };
  let offset = consumed(l1);
  const rest = runsFrom(runs, offset);
  if (rest.length === 0) return { lines: [l1], starts: [0], fits: r1.fits };
  const r2 = breakText(rest, { maxWidthPt: wR, sizePt, hyphenate: 'ifWordDoesNotFit' });
  const starts = [0];
  for (const l of r2.lines) {
    starts.push(offset);
    offset += consumed(l);
  }
  return { lines: [l1, ...r2.lines], starts, fits: r1.fits && r2.fits };
}

/** Grundlinie einer Zeile, deren Zeilenkasten bei `top` beginnt. */
export function baselineAt(top: number, sizePt: number): number {
  return top + ascentPt(sizePt);
}

export { ascentPt, lineHeightPt, measureRuns };

/** Unterlänge (|hhea.descender|) in pt. */
export function descentPt(sizePt: number): number {
  const m = fontMetrics();
  return (-m.descender * sizePt) / m.unitsPerEm;
}

/** Zahl für Pfaddaten (Vertrag E1-02c V06): höchstens drei Nachkommastellen, ohne Exponent. */
export function pathNumber(v: number): string {
  const s = (Math.round(v * 1000) / 1000).toFixed(3);
  return s === '-0.000' ? '0.000' : s;
}

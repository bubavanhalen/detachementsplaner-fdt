// Text der Einträge im Raster: Passen, Grössenstufen, Rückfallregel, Kürzung, Lage (Vertrag E1-02d Abschnitt 2e;
// Änderungsnotizen V02, V11, Runde 2 V16, V18, T3, Q-032 A1–A8; Beschrieb 6, 10 «Rückfallregel»; F-23, F-61).
// Der Browser bricht nie selbst um: jede Zeile ist ein vorberechnetes `TextItem` (Leitplanke 2).

import type { FontSizes } from '../../template';
import type { Id, Rgb, RichText, TextDirection } from '../../types';
import { GRID_CONSTANTS } from '../grid/constants';
import type { DroppedLine, FallbackKind } from '../grid/types';
import type { ItemRole, Rect, TextItem } from '../pageModel';
import { breakText } from '../text/break';
import { measureRuns } from '../text/measure';
import { ascentPt, lineHeightPt } from '../text/metrics';
import type { FontWeight, StyledRun } from '../text/types';

export type Orientation = 'horizontal' | 'vertical';
type Hyphenate = 'ifWordDoesNotFit' | 'never';

/** Ein Absatz mit Grösse und Trennregel (2e «Passen»). */
interface Para {
  readonly runs: readonly StyledRun[];
  readonly sizePt: number;
  readonly hyphenate: Hyphenate;
}

/** Eine umbrochene Zeile; `hyphen` und `para` nur intern für die Wahl der Ausrichtung (Notiz Q-032 A8). */
interface FitLine {
  readonly runs: readonly StyledRun[];
  readonly widthPt: number;
  readonly sizePt: number;
  /** Zeile endet mit einem durch Silbentrennung eingefügten Trennstrich (`BrokenLine.endsWithHyphen`). */
  readonly hyphen: boolean;
  /** Index des Absatzes, aus dem die Zeile stammt. */
  readonly para: number;
}

/** Ergebnis der Textlage eines Textträgers. */
export interface TextOutcome {
  readonly lines: readonly FitLine[];
  readonly orientation: Orientation | null;
  /** Oben bündig (Rapport-Kästchen waagrecht, B-Kp-51) statt senkrecht zentriert. */
  readonly alignTop: boolean;
  readonly event: { readonly kind: FallbackKind; readonly dropped: readonly DroppedLine[] } | null;
  /**
   * E1-02l R2 (R-10-55): Kürzel bzw. Nummer passt auch in Mindestgrösse nicht ins Kästchen; sie steht vollständig
   * in einem Träger daneben (Grösse der Textart, beim Platzieren bis zur Mindestgrösse verkleinerbar).
   */
  readonly outside?: {
    readonly runs: readonly StyledRun[];
    readonly sizePt: number;
    /**
     * F-LAYOUT2 Punkt 13: Kürzel mit «(‹Ort›)» in einem Träger; gilt, wenn er im freien Bereich Platz findet, sonst
     * `runs` mit Wegfall des Orts.
     */
    readonly withOrt?: readonly StyledRun[];
    /** F-LAYOUT2 Runde 2: «(‹Ort›)» allein, falls Kürzel und Ort nicht zusammen am Kästchen Platz finden. */
    readonly ortRuns?: readonly StyledRun[];
  };
  /**
   * F-LAYOUT2 Punkt 13 (Entscheid Auftraggeber 19.10.2026 «13: ja»): Text, der nicht ins Kästchen passt und daneben
   * im freien Bereich steht (Ort eines Rapports); findet er dort keinen Platz, entfällt er mit Ereignis
   * 'lineDropped' (`dropped`).
   */
  readonly beside?: {
    readonly runs: readonly StyledRun[];
    readonly sizePt: number;
    readonly dropped: readonly DroppedLine[];
  };
}

/** Fläche, die nach V02/V18 als «passt nicht» gilt (Breite oder Höhe ≤ 0,01 pt). */
const MIN_AREA_PT = 0.01;
/** Toleranz der Höhensumme (2e «Passen»). */
const FIT_EPS = 1e-6;

const NO_TEXT: TextOutcome = { lines: [], orientation: null, alignTop: false, event: null };

function omitted(dropped: readonly DroppedLine[]): TextOutcome {
  return { lines: [], orientation: null, alignTop: false, event: { kind: 'textOmitted', dropped } };
}

function usable(area: Rect): boolean {
  return area.w > MIN_AREA_PT && area.h > MIN_AREA_PT;
}

/** Zeichen (Codepunkte) mit ihrem Schnitt. */
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
function mergeRuns(glyphs: readonly Glyph[]): StyledRun[] {
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

/** Am Rand getrimmt (Leerraum inkl. U+00A0, wie E1-02a N-3). */
function trimGlyphs(glyphs: readonly Glyph[]): Glyph[] {
  let a = 0;
  let b = glyphs.length;
  while (a < b && isSpace((glyphs[a] as Glyph).ch)) a++;
  while (b > a && isSpace((glyphs[b - 1] as Glyph).ch)) b--;
  return glyphs.slice(a, b);
}

/** Rich Text → Läufe; `bold` → fett. */
export function styledRuns(title: RichText): StyledRun[] {
  return title.map((r) => ({ text: r.text, weight: r.bold ? 'bold' : 'regular' }));
}

/** Rich Text → am Rand getrimmte Läufe (2e «Blockzeilen»). */
export function titleRuns(title: RichText): StyledRun[] {
  return mergeRuns(trimGlyphs(glyphsOf(styledRuns(title))));
}

/** Einzeiliger Text (V11): CR LF, CR und LF werden je zu einem Leerzeichen; danach getrimmt. */
export function singleLineRuns(runs: readonly StyledRun[]): StyledRun[] {
  const glyphs = glyphsOf(runs);
  const out: Glyph[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i] as Glyph;
    if (g.ch === '\r' || g.ch === '\n') {
      if (g.ch === '\r' && glyphs[i + 1]?.ch === '\n') i++;
      out.push({ ch: ' ', weight: g.weight });
    } else {
      out.push(g);
    }
  }
  return mergeRuns(trimGlyphs(out));
}

/** Anfangsstück aus `k` Codepunkten ohne Leerzeichen am Ende, mit «…» im Schnitt des letzten Zeichens. */
function truncatedRuns(glyphs: readonly Glyph[], k: number): StyledRun[] {
  const head = glyphs.slice(0, k);
  while (head.length > 0 && isSpace((head.at(-1) as Glyph).ch)) head.pop();
  const weight = head.at(-1)?.weight ?? 'regular';
  return mergeRuns([...head, { ch: GRID_CONSTANTS.ellipsis, weight }]);
}

/** Grössenpaare je Stufe d = 0, 0,25, …; letzte Stufe, sobald beide die Mindestgrösse erreicht haben. */
function sizeSteps(
  first: number,
  second: number,
  min: number,
): readonly (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  for (let i = 0; ; i++) {
    const d = i * GRID_CONSTANTS.sizeStepPt;
    const a = Math.max(min, first - d);
    const b = Math.max(min, second - d);
    out.push([a, b]);
    if (a <= min && b <= min) return out;
  }
}

/** Rechenreserve der Vorab-Schranke in pt (CR-E102d-02). */
const BOUND_EPS = 1e-6;

/**
 * Vorab-Schranke der Kürzung (CR-E102d-02): `mayFit(k)` ist false nur für Anfangsstücke, die beweisbar nicht
 * passen. Die Summe der Zeilenbreiten ist mindestens die Breite aller Zeichen ausser Leerraum (Leerzeichen am
 * Zeilenende entfallen, Trennstriche kommen hinzu); in der Fläche haben höchstens
 * floor(Höhe / lineHeightPt(min)) Zeilen zu je höchstens der Breite Platz. Alle Absätze stehen in Mindestgrösse.
 * `extra` = übrige Absätze bzw. Läufe derselben Prüfung (Zeitzeile, Zeitangabe des Markers).
 */
function truncationBound(
  glyphs: readonly Glyph[],
  extra: readonly StyledRun[],
  area: Rect,
  o: Orientation,
  min: number,
): (k: number) => boolean {
  const maxWidth = o === 'horizontal' ? area.w : area.h;
  const maxHeight = o === 'horizontal' ? area.h : area.w;
  const lines = Math.floor((maxHeight + FIT_EPS) / lineHeightPt(min));
  const budget = lines * maxWidth + BOUND_EPS;
  const ink = (ch: string, weight: FontWeight): number =>
    isSpace(ch) ? 0 : measureRuns([{ text: ch, weight }], min);
  const ellipsis = Math.min(
    ink(GRID_CONSTANTS.ellipsis, 'regular'),
    ink(GRID_CONSTANTS.ellipsis, 'bold'),
  );
  let fixed = ellipsis;
  for (const g of glyphsOf(extra)) fixed += ink(g.ch, g.weight);
  const prefix = [0];
  for (const g of glyphs) prefix.push((prefix.at(-1) as number) + ink(g.ch, g.weight));
  return (k) => (prefix[k] as number) + fixed <= budget;
}

/** Passen nach 2e: jeder Absatz ohne Notumbruch, Summe der Zeilenhöhen ≤ Höhe (senkrecht: Breite); ein Absatz ohne Läufe ist eine Leerzeile. */
function fitParas(paras: readonly Para[], area: Rect, o: Orientation): FitLine[] | null {
  if (!usable(area)) return null;
  const maxWidth = o === 'horizontal' ? area.w : area.h;
  const maxHeight = o === 'horizontal' ? area.h : area.w;
  const lines: FitLine[] = [];
  let total = 0;
  for (const [para, p] of paras.entries()) {
    if (p.runs.length === 0) {
      // Leerzeile (Teilaufgaben, R-10-47): eine Zeilenhöhe ohne Text.
      total += lineHeightPt(p.sizePt);
      lines.push({ runs: [], widthPt: 0, sizePt: p.sizePt, hyphen: false, para });
      if (total > maxHeight + FIT_EPS) return null;
      continue;
    }
    const r = breakText(p.runs, { maxWidthPt: maxWidth, sizePt: p.sizePt, hyphenate: p.hyphenate });
    if (!r.fits) return null;
    for (const l of r.lines) {
      total += lineHeightPt(p.sizePt);
      lines.push({
        runs: l.runs,
        widthPt: l.widthPt,
        sizePt: p.sizePt,
        hyphen: l.endsWithHyphen,
        para,
      });
    }
    if (total > maxHeight + FIT_EPS) return null;
  }
  return lines;
}

/** Eine Zeile ohne Umbruch (Querbalken, Marker-Beschriftung, Kästchennummer); senkrecht: Länge = Höhe. */
function fitSingle(
  runs: readonly StyledRun[],
  sizePt: number,
  area: Rect,
  o: Orientation = 'horizontal',
): FitLine | null {
  if (!usable(area) || runs.length === 0) return null;
  const widthPt = measureRuns(runs, sizePt);
  const length = o === 'horizontal' ? area.w : area.h;
  const cross = o === 'horizontal' ? area.h : area.w;
  if (widthPt > length || lineHeightPt(sizePt) > cross + FIT_EPS) return null;
  return { runs, widthPt, sizePt, hyphen: false, para: 0 };
}

// ---------------------------------------------------------------------------------------------------------
// Wahl der Ausrichtung (Notiz Q-032 A1–A3, A8)
// ---------------------------------------------------------------------------------------------------------

/** Ergebnis E(o) einer Ausrichtung mit den Kennzahlen nach A2. */
interface Rated {
  readonly outcome: TextOutcome;
  /** 0 = kein Ereignis oder `lineDropped`, 1 = `ellipsis`, 2 = `textOmitted`. */
  readonly klass: 0 | 1 | 2;
  /** Zahl der entfallenen Arten (nur Klasse 0). */
  readonly dropped: number;
  /** Grössenstufe (nur Klasse 0); kleiner = grössere Schrift. */
  readonly step: number;
  /** Codepunkte ohne Leerraum vor «…» (nur Klasse 1). */
  readonly shown: number;
  /** Zeilen mit eingefügtem Trennstrich. */
  readonly hyphens: number;
  /** Umbrüche: Zeilen minus gezeigte Absätze. */
  readonly breaks: number;
}

function rated(
  outcome: TextOutcome,
  klass: 0 | 1 | 2,
  dropped: number,
  step: number,
  shown: number,
): Rated {
  const paras = new Set(outcome.lines.map((l) => l.para)).size;
  return {
    outcome,
    klass,
    dropped,
    step,
    shown,
    hyphens: outcome.lines.filter((l) => l.hyphen).length,
    breaks: outcome.lines.length - paras,
  };
}

function ratedOmitted(dropped: readonly DroppedLine[]): Rated {
  return rated(omitted(dropped), 2, 0, 0, 0);
}

/**
 * Wahl nach A3 (Stufen 1–6): true = senkrecht. Die Umbruchschranke gilt in den Stufen 2, 3 und 5 (V-02d-22),
 * in Stufe 2 nicht, wenn die F-23-Bedingung erfüllt ist.
 */
function prefersVertical(w: Rated, s: Rated, f23: () => boolean): boolean {
  if (w.klass !== s.klass) return s.klass < w.klass;
  if (w.dropped !== s.dropped) return s.dropped < w.dropped && (s.breaks <= w.breaks || f23());
  if (w.step !== s.step) return s.step < w.step && s.breaks <= w.breaks;
  if (w.klass === 1 && w.shown !== s.shown) return s.shown > w.shown;
  return s.hyphens < w.hyphens && s.breaks <= w.breaks;
}

/**
 * Ausrichtung «auto» (A3) mit der Abkürzung A8: Ist W ohne Ereignis, in Standardgrösse und ohne Trennstrich,
 * kann S in keiner Stufe gewinnen und wird nicht gerechnet.
 */
function chooseAuto(horizontal: Rated, vertical: () => Rated, f23: () => boolean): TextOutcome {
  const w = horizontal;
  if (w.outcome.event === null && w.step === 0 && w.hyphens === 0) return w.outcome;
  const s = vertical();
  return prefersVertical(w, s, f23) ? s.outcome : w.outcome;
}

/** Zahl der Codepunkte ohne Leerraum. */
function inkCount(glyphs: readonly Glyph[]): number {
  return glyphs.filter((g) => !isSpace(g.ch)).length;
}

const plainRun = (text: string, weight: FontWeight = 'regular'): StyledRun[] =>
  text === '' ? [] : [{ text, weight }];

// ---------------------------------------------------------------------------------------------------------
// Block und Rapport-Block
// ---------------------------------------------------------------------------------------------------------

/**
 * Teilaufgabe im Blocktext (Gate S A1; R-10-47; H-LAYOUT SA-H-01): Titel fett (Läufe schon fett), Ltg und Ort
 * am Rand getrimmt ('' = leer).
 */
export interface SubtaskTextSpec {
  readonly title: readonly StyledRun[];
  readonly ltg: string;
  readonly ort: string;
}

/** Inhalt eines Block- oder Rapport-Block-Texts (2e «Blockzeilen»). */
export interface BlockTextSpec {
  /** Erfasste Zeit als erste Zeile (V01, V14), sonst null. */
  readonly timeLine: string | null;
  readonly title: readonly StyledRun[];
  /** 'ifWordDoesNotFit' für den Blocktitel, 'never' für das Kürzel des Rapport-Blocks. */
  readonly titleHyphenate: Hyphenate;
  readonly supplement: string;
  readonly ltg: string;
  readonly ort: string;
  /** Leer, wenn nicht gedruckt. */
  readonly tn: string;
  readonly tenue: string;
  readonly ltgMode: 'withOrt' | 'ownLinePrefixed';
  readonly direction: TextDirection;
  /** Teilaufgaben in Anzeigereihenfolge (R-10-47); leer beim Rapport-Block und bei Blöcken ohne Teilaufgaben. */
  readonly subtasks: readonly SubtaskTextSpec[];
}

/** Eine entfallende Zeile: Art und bei Teilaufgaben ihre Lage in `subtasks`. */
interface DropItem {
  readonly kind: DroppedLine;
  readonly index: number | null;
}

/** Indizes von der letzten zur ersten Teilaufgabe, die `keep` erfüllen (R-10-48 «von der letzten zur ersten»). */
function backwards(s: BlockTextSpec, keep: (t: SubtaskTextSpec) => boolean): number[] {
  const out: number[] = [];
  for (let i = s.subtasks.length - 1; i >= 0; i--)
    if (keep(s.subtasks[i] as SubtaskTextSpec)) out.push(i);
  return out;
}

/**
 * Vorhandene Zeilen in der Reihenfolge, in der sie entfallen (F-61; R-10-48, Auslegung F-65 (b)): Leerzeilen zwischen
 * den Gruppen; Tn, Tenue des Blocks; Ort der Teilaufgaben; Ltg der Teilaufgaben; Ltg, Ort, Zusatz des Blocks; Titel der
 * Teilaufgaben – bei den Teilaufgaben jeweils von der letzten zur ersten. Ohne Teilaufgaben wie F-61.
 */
function presentItems(s: BlockTextSpec): DropItem[] {
  const block = (kind: DroppedLine, value: string): DropItem[] =>
    value === '' ? [] : [{ kind, index: null }];
  const sub = (kind: DroppedLine, keep: (t: SubtaskTextSpec) => boolean): DropItem[] =>
    backwards(s, keep).map((index) => ({ kind, index }));
  return [
    ...sub('subtaskGap', () => true),
    ...block('tn', s.tn),
    ...block('tenue', s.tenue),
    ...sub('subtaskOrt', (t) => t.ort !== ''),
    ...sub('subtaskLtg', (t) => t.ltg !== ''),
    ...block('ltg', s.ltg),
    ...block('ort', s.ort),
    ...block('supplement', s.supplement),
    ...sub('subtaskTitle', () => true),
  ];
}

const kindsOf = (items: readonly DropItem[]): DroppedLine[] => items.map((d) => d.kind);

/** Zeile «Ltg (Ort)» bzw. «Ltg: …» und «(Ort)» im Format der Vorlage (R-4.9-03, B-Kp-53). */
function ltgOrtLines(
  mode: BlockTextSpec['ltgMode'],
  ltg: string,
  ort: string,
  showLtg: boolean,
  showOrt: boolean,
): string[] {
  const l = showLtg && ltg !== '';
  const o = showOrt && ort !== '';
  if (mode === 'withOrt') {
    if (l && o) return [`${ltg} (${ort})`];
    if (l) return [ltg];
    return o ? [`(${ort})`] : [];
  }
  return [...(l ? [`Ltg: ${ltg}`] : []), ...(o ? [`(${ort})`] : [])];
}

function blockParas(
  s: BlockTextSpec,
  dropped: readonly DropItem[],
  title: number,
  standard: number,
): Para[] {
  const gone = (kind: DroppedLine, index: number | null = null): boolean =>
    dropped.some((d) => d.kind === kind && d.index === index);
  const on = (k: DroppedLine, value: string): boolean => value !== '' && !gone(k);
  const line = (text: string): Para => ({
    runs: plainRun(text),
    sizePt: standard,
    hyphenate: 'ifWordDoesNotFit',
  });
  const out: Para[] = [];
  if (s.timeLine !== null) {
    out.push({ runs: plainRun(s.timeLine), sizePt: standard, hyphenate: 'never' });
  }
  if (s.title.length > 0) out.push({ runs: s.title, sizePt: title, hyphenate: s.titleHyphenate });
  if (on('supplement', s.supplement)) out.push(line(s.supplement));
  for (const text of ltgOrtLines(s.ltgMode, s.ltg, s.ort, !gone('ltg'), !gone('ort'))) {
    out.push(line(text));
  }
  if (on('tn', s.tn)) out.push(line(`Tn: ${s.tn}`));
  if (on('tenue', s.tenue)) out.push(line(`Tenue ${s.tenue}`));
  // Teilaufgaben nach dem Blocktext (R-10-47, Q-045 (e)): Leerzeile, Titel fett, darunter Ltg und Ort.
  s.subtasks.forEach((t, i) => {
    if (gone('subtaskTitle', i)) return;
    if (!gone('subtaskGap', i)) out.push({ runs: [], sizePt: standard, hyphenate: 'never' });
    if (t.title.length > 0)
      out.push({ runs: t.title, sizePt: title, hyphenate: 'ifWordDoesNotFit' });
    const lines = ltgOrtLines(
      s.ltgMode,
      t.ltg,
      t.ort,
      !gone('subtaskLtg', i),
      !gone('subtaskOrt', i),
    );
    for (const text of lines) out.push(line(text));
  });
  return out;
}

/**
 * F-23-Bedingung (Notiz Q-032 A2): Der Titel ist nicht leer und passt in Grösse `blockTitle` mit Trennung
 * 'never' waagrecht nicht, senkrecht aber schon.
 */
function f23Condition(s: BlockTextSpec, area: Rect, fs: FontSizes): boolean {
  if (s.title.length === 0) return false;
  const title: Para[] = [{ runs: s.title, sizePt: fs.blockTitle, hyphenate: 'never' }];
  const fits = (o: Orientation): boolean => fitParas(title, area, o) !== null;
  return !fits('horizontal') && fits('vertical');
}

/**
 * Block und Rapport-Block (2e «Grössen und Rückfallregel», V16 a): 'horizontal' und 'vertical' gelten wie
 * festgelegt (A4); 'auto' wählt zwischen beiden Ergebnissen nach A3 (Rapport-Block immer 'auto').
 */
export function blockText(s: BlockTextSpec, area: Rect, fs: FontSizes): TextOutcome {
  const present = presentItems(s);
  if (s.timeLine === null && s.title.length === 0 && present.length === 0) return NO_TEXT;
  const chosen =
    s.direction !== 'auto'
      ? blockResult(s, present, area, fs, s.direction).outcome
      : chooseAuto(
          blockResult(s, present, area, fs, 'horizontal'),
          () => blockResult(s, present, area, fs, 'vertical'),
          () => f23Condition(s, area, fs),
        );
  // E1-02l R2 (R-10-55): Das Kürzel eines Rapport-Blocks (Titel ohne Trennung) wird nie gekürzt.
  const truncated = chosen.event?.kind === 'ellipsis' || chosen.event?.kind === 'textOmitted';
  if (s.titleHyphenate === 'never' && s.title.length > 0 && truncated) {
    return outsideLabel(s.title, fs.rapportCode, kindsOf(present));
  }
  return chosen;
}

/**
 * Ergebnis E(o) für Block und Rapport-Block (A1): erstes passendes (L, d), dann Kürzung des Titels, dann nur die
 * Zeitzeile, dann `textOmitted`.
 */
function blockResult(
  s: BlockTextSpec,
  present: readonly DropItem[],
  area: Rect,
  fs: FontSizes,
  o: Orientation,
): Rated {
  const steps = sizeSteps(fs.blockTitle, fs.standard, fs.min);
  const all = kindsOf(present);
  for (let l = 0; l <= present.length; l++) {
    const dropped = present.slice(0, l);
    for (const [step, [title, standard]] of steps.entries()) {
      const lines = fitParas(blockParas(s, dropped, title, standard), area, o);
      if (lines !== null) {
        const outcome: TextOutcome = {
          lines,
          orientation: o,
          alignTop: false,
          event: l > 0 ? { kind: 'lineDropped', dropped: kindsOf(dropped) } : null,
        };
        return rated(outcome, 0, l, step, 0);
      }
    }
  }
  // Kürzung in Mindestgrösse; die Zeitzeile bleibt stehen (V16 a).
  const time: Para[] =
    s.timeLine === null ? [] : [{ runs: plainRun(s.timeLine), sizePt: fs.min, hyphenate: 'never' }];
  const glyphs = glyphsOf(s.title);
  const mayFit = truncationBound(
    glyphs,
    time.flatMap((t) => t.runs),
    area,
    o,
    fs.min,
  );
  for (let k = glyphs.length; k >= 0; k--) {
    if (!mayFit(k)) continue;
    const paras = [
      ...time,
      { runs: truncatedRuns(glyphs, k), sizePt: fs.min, hyphenate: s.titleHyphenate },
    ];
    const lines = fitParas(paras, area, o);
    if (lines !== null) {
      const outcome: TextOutcome = {
        lines,
        orientation: o,
        alignTop: false,
        event: { kind: 'ellipsis', dropped: all },
      };
      return rated(outcome, 1, 0, 0, inkCount(glyphs.slice(0, k)));
    }
  }
  const timeOnly = time.length > 0 ? fitParas(time, area, o) : null;
  if (timeOnly !== null) {
    const outcome: TextOutcome = {
      lines: timeOnly,
      orientation: o,
      alignTop: false,
      event: { kind: 'ellipsis', dropped: all },
    };
    return rated(outcome, 1, 0, 0, 0);
  }
  return ratedOmitted(all);
}

// ---------------------------------------------------------------------------------------------------------
// Rapport-Kästchen
// ---------------------------------------------------------------------------------------------------------

export interface RapportBoxTextSpec {
  readonly code: string;
  readonly timeLine: string | null;
  readonly ort: string;
}

/**
 * Rapport-Kästchen (Notiz Q-032 A1, A3, A4): immer 'auto'; die F-23-Bedingung gilt als erfüllt, die
 * Umbruchschranke wirkt also nur in den Stufen 3 und 5.
 */
export function rapportBoxText(s: RapportBoxTextSpec, area: Rect, fs: FontSizes): TextOutcome {
  const code = plainRun(s.code, 'bold');
  if (code.length === 0 && s.timeLine === null && s.ort === '') return NO_TEXT;
  const chosen = chooseAuto(
    rapportBoxResult(s, code, area, fs, 'horizontal'),
    () => rapportBoxResult(s, code, area, fs, 'vertical'),
    () => true,
  );
  // E1-02l R2 (R-10-55): das Kürzel wird nie gekürzt; statt «…» bzw. Wegfall steht es neben dem Kästchen.
  // F-LAYOUT2 Punkt 13: der Ort steht dann mit im Träger, wenn dort Platz ist.
  const ort = s.ort === '' ? [] : plainRun(`(${s.ort})`);
  const truncated = chosen.event?.kind === 'ellipsis' || chosen.event?.kind === 'textOmitted';
  if (code.length > 0 && truncated) {
    const out = outsideLabel(code, fs.rapportCode, s.ort === '' ? [] : ['ort']);
    if (ort.length === 0 || out.outside === undefined) return out;
    const withOrt = [...code, ...plainRun(` (${s.ort})`)];
    return { ...out, outside: { ...out.outside, withOrt, ortRuns: ort } };
  }
  // F-LAYOUT2 Punkt 13: passt nur «(‹Ort›)» nicht, steht er neben dem Kästchen statt wegzufallen.
  const dropped = chosen.event?.kind === 'lineDropped' ? chosen.event.dropped : [];
  if (ort.length > 0 && dropped.length === 1 && dropped[0] === 'ort') {
    return { ...chosen, event: null, beside: { runs: ort, sizePt: fs.standard, dropped } };
  }
  return chosen;
}

/**
 * Ergebnis E(o) im Rapport-Kästchen (A1): mit «(‹Ort›)» alle Stufen, ohne Ort alle Stufen, Kürzung des Kürzels
 * mit Zeitzeile, nur die Zeitzeile, `textOmitted`. Waagrecht oben bündig (B-Kp-51, A6).
 */
function rapportBoxResult(
  s: RapportBoxTextSpec,
  code: readonly StyledRun[],
  area: Rect,
  fs: FontSizes,
  o: Orientation,
): Rated {
  const alignTop = o === 'horizontal';
  const steps = sizeSteps(fs.rapportCode, fs.standard, fs.min);
  const paras = (codeSize: number, standard: number, withOrt: boolean): Para[] => {
    const out: Para[] = [];
    if (code.length > 0) out.push({ runs: code, sizePt: codeSize, hyphenate: 'never' });
    if (s.timeLine !== null) {
      out.push({ runs: plainRun(s.timeLine), sizePt: standard, hyphenate: 'never' });
    }
    if (withOrt && s.ort !== '') {
      out.push({ runs: plainRun(`(${s.ort})`), sizePt: standard, hyphenate: 'ifWordDoesNotFit' });
    }
    return out;
  };
  const variants: readonly (readonly [boolean, readonly DroppedLine[]])[] =
    s.ort === ''
      ? [[true, []]]
      : [
          [true, []],
          [false, ['ort']],
        ];
  for (const [withOrt, dropped] of variants) {
    for (const [step, [codeSize, standard]] of steps.entries()) {
      const lines = fitParas(paras(codeSize, standard, withOrt), area, o);
      if (lines !== null) {
        const outcome: TextOutcome = {
          lines,
          orientation: o,
          alignTop,
          event: dropped.length > 0 ? { kind: 'lineDropped', dropped } : null,
        };
        return rated(outcome, 0, dropped.length, step, 0);
      }
    }
  }
  const dropped: readonly DroppedLine[] = s.ort === '' ? [] : ['ort'];
  const time: Para[] =
    s.timeLine === null ? [] : [{ runs: plainRun(s.timeLine), sizePt: fs.min, hyphenate: 'never' }];
  const glyphs = glyphsOf(code);
  if (glyphs.length > 0) {
    const mayFit = truncationBound(
      glyphs,
      time.flatMap((t) => t.runs),
      area,
      o,
      fs.min,
    );
    for (let k = glyphs.length; k >= 0; k--) {
      if (!mayFit(k)) continue;
      const lines = fitParas(
        [{ runs: truncatedRuns(glyphs, k), sizePt: fs.min, hyphenate: 'never' }, ...time],
        area,
        o,
      );
      if (lines !== null) {
        const outcome: TextOutcome = {
          lines,
          orientation: o,
          alignTop,
          event: { kind: 'ellipsis', dropped },
        };
        return rated(outcome, 1, 0, 0, inkCount(glyphs.slice(0, k)));
      }
    }
  }
  const timeOnly = time.length > 0 ? fitParas(time, area, o) : null;
  if (timeOnly !== null) {
    const outcome: TextOutcome = {
      lines: timeOnly,
      orientation: o,
      alignTop,
      event: { kind: 'ellipsis', dropped },
    };
    return rated(outcome, 1, 0, 0, 0);
  }
  return ratedOmitted(dropped);
}

// ---------------------------------------------------------------------------------------------------------
// Einzeilige Texte
// ---------------------------------------------------------------------------------------------------------

/**
 * Kästchennummer, nie gekürzt (V-02d-12; E1-02l R2, R-10-55): je Grössenstufe von `besoNumber` bis zur
 * Mindestgrösse zuerst waagrecht, dann senkrecht; passt sie nie, steht sie vollständig neben dem Kästchen.
 */
export function numberText(
  text: string,
  weight: FontWeight,
  area: Rect,
  fs: FontSizes,
): TextOutcome {
  const runs = plainRun(text, weight);
  if (runs.length === 0) return NO_TEXT;
  for (const [size] of sizeSteps(fs.besoNumber, fs.min, fs.min)) {
    for (const o of ['horizontal', 'vertical'] as const) {
      const line = fitSingle(runs, size, area, o);
      if (line !== null) return { lines: [line], orientation: o, alignTop: false, event: null };
    }
  }
  return outsideLabel(runs, fs.besoNumber, []);
}

/** Ergebnis «neben dem Kästchen» (E1-02l R2): kein Text im Kästchen, Ereignis 'labelOutside'. */
function outsideLabel(
  runs: readonly StyledRun[],
  sizePt: number,
  dropped: readonly DroppedLine[],
): TextOutcome {
  return {
    lines: [],
    orientation: null,
    alignTop: false,
    event: { kind: 'labelOutside', dropped },
    outside: { runs, sizePt },
  };
}

/**
 * Einzeiliger Text in Standardgrösse bis Mindestgrösse, dann Kürzung von `head` (mit «…» und unverändertem
 * `tail`), dann `textOmitted` (Querbalken, Marker-Beschriftung; 2e «Weitere Texte», V16 b).
 */
export function singleLineText(
  head: readonly StyledRun[],
  tail: readonly StyledRun[],
  area: Rect,
  fs: FontSizes,
): TextOutcome {
  const full = mergeRuns(glyphsOf([...head, ...tail]));
  if (full.length === 0) return NO_TEXT;
  for (const [size] of sizeSteps(fs.standard, fs.min, fs.min)) {
    const line = fitSingle(full, size, area);
    if (line !== null)
      return { lines: [line], orientation: 'horizontal', alignTop: false, event: null };
  }
  const glyphs = glyphsOf(head);
  const mayFit = truncationBound(glyphs, tail, area, 'horizontal', fs.min);
  for (let k = glyphs.length; k >= 0; k--) {
    if (!mayFit(k)) continue;
    const runs = mergeRuns(glyphsOf([...truncatedRuns(glyphs, k), ...tail]));
    const line = fitSingle(runs, fs.min, area);
    if (line !== null) {
      return {
        lines: [line],
        orientation: 'horizontal',
        alignTop: false,
        event: { kind: 'ellipsis', dropped: [] },
      };
    }
  }
  return omitted([]);
}

/** Text entfällt ohne Versuch (Marker-Feld abgeschnitten, unten trotz Hindernis oder ohne Feld; T1, V-02d-13). */
export function omittedText(): TextOutcome {
  return omitted([]);
}

/** Breite eines einzeiligen Texts in pt (Marker-Feld, 2d Nr 5). */
export function singleLineWidth(runs: readonly StyledRun[], sizePt: number): number {
  return runs.length === 0 ? 0 : measureRuns(runs, sizePt);
}

// ---------------------------------------------------------------------------------------------------------
// Lage
// ---------------------------------------------------------------------------------------------------------

/**
 * Zeilen als `TextItem` (2e «Lage»; Notiz T3): waagrecht untereinander, jede Zeile zentriert, Zeilenblock senkrecht
 * zentriert oder oben bündig; senkrecht (Drehung 90) von links nach rechts, Zeilenblock waagrecht zentriert, jede
 * Zeile senkrecht zentriert. `frame` = Textfläche.
 */
export function placeText(
  outcome: TextOutcome,
  area: Rect,
  color: Rgb,
  role: ItemRole,
  entryId: Id,
): TextItem[] {
  const o = outcome.orientation;
  if (o === null) return [];
  const heights = outcome.lines.map((l) => lineHeightPt(l.sizePt));
  const total = heights.reduce((a, b) => a + b, 0);
  const items: TextItem[] = [];
  let offset =
    o === 'horizontal'
      ? outcome.alignTop
        ? area.y
        : area.y + (area.h - total) / 2
      : area.x + (area.w - total) / 2;
  outcome.lines.forEach((line, i) => {
    const runs = line.runs.map((r) => ({
      text: r.text,
      weight: r.weight,
      color: { r: color.r, g: color.g, b: color.b },
      strike: false,
    }));
    if (runs.length > 0) {
      const asc = ascentPt(line.sizePt);
      items.push(
        o === 'horizontal'
          ? {
              kind: 'text',
              role,
              entryId,
              x: area.x + (area.w - line.widthPt) / 2,
              baselineY: offset + asc,
              rotation: 0,
              sizePt: line.sizePt,
              runs,
              frame: area,
            }
          : {
              kind: 'text',
              role,
              entryId,
              x: offset + asc,
              baselineY: area.y + (area.h + line.widthPt) / 2,
              rotation: 90,
              sizePt: line.sizePt,
              runs,
              frame: area,
            },
      );
    }
    offset += heights[i] as number;
  });
  return items;
}

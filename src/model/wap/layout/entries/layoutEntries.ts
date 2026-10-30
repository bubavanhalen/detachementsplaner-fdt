// Einträge einer Woche im Raster: Flächen, Text, Zeichenreihenfolge, `entries` und `fallbacks` (Vertrag E1-02d
// Abschnitt 2d–2f; Änderungsnotizen V02, Runde 2 V13, V18, Q-032 A9; ADR-004, Leitplanke 2). Rein und
// deterministisch.

import type { Entry, Id, IsoDate, Rgb } from '../../types';
import { GRID_CONSTANTS } from '../grid/constants';
import { timeToY } from '../grid/geometry';
import type { DroppedLine, EntryGeometry, EntryPiece, FallbackEvent } from '../grid/types';
import type { PageItem, Rect, TextItem } from '../pageModel';
import { lineHeightPt } from '../text/metrics';
import type { StyledRun } from '../text/types';
import { layoutBlocks } from './blocks';
import { layoutBesoBoxes, layoutRapportBoxes } from './boxes';
import {
  compareEntries,
  compareIds,
  type Drawable,
  type EntriesContext,
  type PieceDraft,
  type TextSpec,
} from './draft';
import { textColorForFill } from './fill';
import { layoutMarkers } from './markers';
import { fallbackSpot, findLabelSpot, labelLineSize, textBounds } from './outsideLabel';
import { layoutQuerbalken } from './querbalken';
import { inset, overlaps } from './rects';
import { hasNextDayPart } from './spans';
import { markChangedRuns, styleEntryText } from './status';
import {
  blockText,
  numberText,
  omittedText,
  placeText,
  rapportBoxText,
  singleLineText,
  type TextOutcome,
} from './text';

export interface EntriesLayout {
  readonly items: readonly PageItem[];
  readonly entries: readonly EntryGeometry[];
  readonly fallbacks: readonly FallbackEvent[];
}

const RASTER_TYPES: ReadonlySet<Entry['type']> = new Set([
  'block',
  'querbalken',
  'marker',
  'rapport',
  'beso',
]);

/** Zeichenreihenfolge (2f): Gruppe; Querbalken nach Lage; dann Datum, gezeichneter Beginn, Erfassung, Teil. */
function compareDrawables(a: Drawable, b: Drawable): number {
  return (
    a.group - b.group ||
    a.bandLevel - b.bandLevel ||
    compareIds(a.date, b.date) ||
    a.start - b.start ||
    a.seq - b.seq ||
    compareIds(a.entryId, b.entryId) ||
    a.sub - b.sub
  );
}

/** Zahl für Pfaddaten: ohne Exponent, höchstens 4 Nachkommastellen (E1-02c V06, Vertrag 2f). */
function num(n: number): string {
  let s = (Math.round(n * 1e4) / 1e4).toFixed(4);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/** Höchste Auslenkung und Wellenlänge des offenen Endes in pt (R-4.7-13; Beschrieb 10 «offenes Ende gewellt»). */
const WAVE_AMPLITUDE_PT = 0.9;
const WAVE_LENGTH_PT = 4;

/**
 * Wellenlinie von (xFrom, y) nach (xTo, y) als C-Segmente: Halbwellen abwechselnd nach oben und unten um die
 * Mittellinie y mit der Auslenkung `d` (Kontrollpunkte bei 4/3 d ergeben genau d).
 */
function waveSegments(xFrom: number, xTo: number, y: number, d: number): string {
  // Gerade Zahl Halbwellen: hin und zurück ergeben dieselbe Linie.
  const n = 2 * Math.max(1, Math.round(Math.abs(xTo - xFrom) / WAVE_LENGTH_PT));
  const step = (xTo - xFrom) / n;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = xFrom + i * step;
    const k = ((i % 2 === 0) === xTo > xFrom ? -1 : 1) * ((4 * d) / 3);
    parts.push(
      `C ${num(a + step / 3)} ${num(y + k)} ${num(a + (2 * step) / 3)} ${num(y + k)} ${num(a + step)} ${num(y)}`,
    );
  }
  return parts.join(' ');
}

/**
 * Fläche und Rahmen eines Blocks mit gemeinsamer Leitung (zwei Dreiecke, Diagonale links unten → rechts oben,
 * R-4.7-03) und/oder offenem Ende (unterer Rand gewellt, übrige Ränder gerade, R-4.7-13).
 */
function sharedOrWavyItems(p: PieceDraft, entryId: Id): PageItem[] {
  const { role, stroke, rect } = p;
  const x = rect.x;
  const y = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const wavy = p.wavyBottom === true && !p.openBottom;
  const a = wavy ? Math.min(WAVE_AMPLITUDE_PT, rect.h / 4) : 0;
  const ym = y2 - a / 2;
  const yb = wavy ? ym : y2;
  const back = wavy ? waveSegments(x2, x, ym, a / 2) : `L ${num(x)} ${num(y2)}`;
  const forward = wavy ? waveSegments(x, x2, ym, a / 2) : `L ${num(x2)} ${num(y2)}`;
  const second = p.secondFill ?? null;
  const out: PageItem[] = [];
  if (second === null) {
    out.push({
      kind: 'path',
      role,
      entryId,
      d: `M ${num(x)} ${num(y)} L ${num(x2)} ${num(y)} L ${num(x2)} ${num(yb)} ${back} Z`,
      fill: p.fill,
      stroke: null,
    });
  } else {
    out.push(
      {
        kind: 'path',
        role,
        entryId,
        d: `M ${num(x)} ${num(y)} L ${num(x2)} ${num(y)} L ${num(x)} ${num(yb)} Z`,
        fill: p.fill,
        stroke: null,
      },
      {
        kind: 'path',
        role,
        entryId,
        d: `M ${num(x2)} ${num(y)} L ${num(x2)} ${num(yb)} ${back} Z`,
        fill: second,
        stroke: null,
      },
    );
  }
  if (p.openTop && p.openBottom) {
    out.push(
      { kind: 'line', role, entryId, x1: x, y1: y, x2: x, y2, stroke },
      { kind: 'line', role, entryId, x1: x2, y1: y, x2, y2, stroke },
    );
    return out;
  }
  const d = p.openTop
    ? `M ${num(x)} ${num(y)} L ${num(x)} ${num(yb)} ${forward} L ${num(x2)} ${num(y)}`
    : p.openBottom
      ? `M ${num(x)} ${num(y2)} L ${num(x)} ${num(y)} L ${num(x2)} ${num(y)} L ${num(x2)} ${num(y2)}`
      : `M ${num(x)} ${num(y)} L ${num(x2)} ${num(y)} L ${num(x2)} ${num(yb)} ${back} Z`;
  out.push({ kind: 'path', role, entryId, d, fill: null, stroke });
  return out;
}

/** Fläche und Rahmen eines Teilstücks (2f «Rahmen»). */
function shapeItems(p: PieceDraft, entryId: Id): PageItem[] {
  const { role, stroke, rect } = p;
  if (p.lineY === null && ((p.secondFill ?? null) !== null || p.wavyBottom === true))
    return sharedOrWavyItems(p, entryId);
  if (p.lineY !== null) {
    return [
      {
        kind: 'line',
        role,
        entryId,
        x1: rect.x,
        y1: p.lineY,
        x2: rect.x + rect.w,
        y2: p.lineY,
        stroke,
      },
    ];
  }
  if (!p.openTop && !p.openBottom)
    return [{ kind: 'rect', role, entryId, rect, fill: p.fill, stroke }];
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const out: PageItem[] = [{ kind: 'rect', role, entryId, rect, fill: p.fill, stroke: null }];
  if (p.openTop && p.openBottom) {
    out.push(
      { kind: 'line', role, entryId, x1: rect.x, y1: rect.y, x2: rect.x, y2, stroke },
      { kind: 'line', role, entryId, x1: x2, y1: rect.y, x2, y2, stroke },
    );
    return out;
  }
  const points: readonly (readonly [number, number])[] = p.openTop
    ? [
        [rect.x, rect.y],
        [rect.x, y2],
        [x2, y2],
        [x2, rect.y],
      ]
    : [
        [rect.x, y2],
        [rect.x, rect.y],
        [x2, rect.y],
        [x2, y2],
      ];
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${num(x)} ${num(y)}`).join(' ');
  out.push({ kind: 'path', role, entryId, d, fill: null, stroke });
  return out;
}

/**
 * Textfläche begrenzt durch Hindernisse (Runde 2 V13, mit äusserem Rechteck nach Notiz Q-032 A9): Hindernisse,
 * die die Fläche offen schneiden und oberhalb ihrer Mitte beginnen, begrenzen oben, alle übrigen unten.
 */
function avoid(area: Rect, obstacles: readonly Rect[]): Rect {
  const hits = obstacles.filter((o) => overlaps(o, area));
  if (hits.length === 0) return area;
  const middle = area.y + area.h / 2;
  let top = area.y;
  let bottom = area.y + area.h;
  for (const o of hits) {
    if (o.y < middle) top = Math.max(top, o.y + o.h);
    else bottom = Math.min(bottom, o.y);
  }
  return { x: area.x, y: top, w: area.w, h: bottom - top };
}

interface Obstacles {
  readonly forBlocks: readonly Rect[];
  readonly forBoxes: readonly Rect[];
}

/**
 * Äusseres Rechteck eines Hindernisses (Notiz Q-032 A9, Befund E1-02d-AV-01): Ein gerahmtes Rechteck (Marker-Feld,
 * Beso-Kästchen) reicht um die halbe Strichbreite über `rect` hinaus; das Band der Marker-Linie ist schon `rect`.
 */
function outerRect(p: PieceDraft): Rect {
  return p.lineY === null ? inset(p.rect, -p.stroke.widthPt / 2) : p.rect;
}

function obstaclesByDate(drawables: readonly Drawable[]): ReadonlyMap<IsoDate, Obstacles> {
  const out = new Map<IsoDate, { forBlocks: Rect[]; forBoxes: Rect[] }>();
  for (const d of drawables) {
    for (const p of d.pieces) {
      if (p.obstacle === null) continue;
      const o = out.get(p.date) ?? { forBlocks: [], forBoxes: [] };
      out.set(p.date, o);
      const outer = outerRect(p);
      o.forBlocks.push(outer);
      if (p.obstacle === 'allText') o.forBoxes.push(outer);
    }
  }
  return out;
}

/**
 * Flächen links und rechts der schmalen Hindernisse (Marker-Feld, Beso-Kästchen) unterhalb bzw. oberhalb der
 * Hindernisse über die ganze Breite (Marker-Linie) – Beschrieb 4.6 «Marker … verdecken aber keinen Text; ein
 * betroffener Titel rückt unter den Marker» (H-LAYOUT). Leer, wenn es keine schmalen Hindernisse gibt.
 */
function besideAreas(full: Rect, obstacles: readonly Rect[]): Rect[] {
  const hits = obstacles.filter((o) => overlaps(o, full));
  const wide = hits.filter((o) => o.x <= full.x + 1e-6 && o.x + o.w >= full.x + full.w - 1e-6);
  const base = avoid(full, wide);
  const narrow = hits.filter((o) => !wide.includes(o) && overlaps(o, base));
  if (narrow.length === 0) return [];
  const gap = GRID_CONSTANTS.textInsetPt;
  const x0 = Math.min(...narrow.map((o) => o.x)) - gap;
  const x1 = Math.max(...narrow.map((o) => o.x + o.w)) + gap;
  return [
    { x: base.x, y: base.y, w: x0 - base.x, h: base.h },
    { x: x1, y: base.y, w: base.x + base.w - x1, h: base.h },
  ].filter((r) => r.w > 0.01 && r.h > 0.01);
}

/**
 * Rang für die Wahl der Textfläche: ohne Ereignis, dann weniger entfallene Zeilen, dann «…» mit mehr gezeigten
 * Zeichen, dann Wegfall.
 */
function textRank(o: TextOutcome): number {
  const e = o.event;
  if (e === null) return 0;
  if (e.kind === 'lineDropped') return 1 + e.dropped.length;
  if (e.kind !== 'ellipsis') return 2000;
  const shown = o.lines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.length, 0), 0);
  return 1000 + 1 / (1 + shown);
}

/** Text eines Textträgers (2e) in seiner Textfläche. */
function textOf(
  ctx: EntriesContext,
  p: PieceDraft,
  obstacles: Obstacles | undefined,
): { readonly outcome: TextOutcome; readonly area: Rect } | null {
  const spec = p.text;
  if (spec === null) return null;
  const full = inset(p.rect, GRID_CONSTANTS.textInsetPt + p.stroke.widthPt / 2);
  if (spec.kind !== 'block') {
    const area = spec.kind === 'number' ? avoid(full, obstacles?.forBoxes ?? []) : full;
    return { outcome: outcomeIn(ctx, spec, area), area };
  }
  // Block: unter bzw. über den Hindernissen; reicht das nicht, neben einem schmalen Hindernis, wenn der Text dort
  // besser passt (H-LAYOUT, Beschrieb 4.6 «Marker … verdecken aber keinen Text»).
  const list = obstacles?.forBlocks ?? [];
  const below = avoid(full, list);
  let best = { area: below, outcome: outcomeIn(ctx, spec, below) };
  if (textRank(best.outcome) === 0) return best;
  for (const area of besideAreas(full, list)) {
    const outcome = outcomeIn(ctx, spec, area);
    if (textRank(outcome) < textRank(best.outcome)) best = { area, outcome };
  }
  return best;
}

/** Textergebnis eines Auftrags in einer Fläche, mit Zwischenspeicher. */
function outcomeIn(ctx: EntriesContext, spec: TextSpec, area: Rect): TextOutcome {
  const fs = ctx.template.fontSizes;
  // Gleicher Text in gleicher Fläche ergibt dasselbe Ergebnis (rein); der Zwischenspeicher spart das erneute Umbrechen
  // unveränderter Einträge, etwa beim Ziehen am Bildschirm (E1-02l, I2b-A A3).
  const key = JSON.stringify([spec, area.x, area.y, area.w, area.h, fs]);
  const known = outcomes.get(key);
  if (known !== undefined) return known;
  const outcome = ((): TextOutcome => {
    switch (spec.kind) {
      case 'block':
        return blockText(spec.spec, area, fs);
      case 'number':
        return numberText(spec.text, spec.weight, area, fs);
      case 'rapportBox':
        return rapportBoxText(spec.spec, area, fs);
      case 'singleLine':
        return singleLineText(spec.head, spec.tail, area, fs);
      case 'omitted':
        return omittedText();
    }
  })();
  if (outcomes.size >= OUTCOME_LIMIT) outcomes.clear();
  outcomes.set(key, outcome);
  return outcome;
}

/** Zwischenspeicher der Textergebnisse (Schlüssel: Auftrag, Fläche, Grössen). */
const outcomes = new Map<string, TextOutcome>();
const OUTCOME_LIMIT = 20000;

/** Auftrag für eine Beschriftung neben dem Kästchen (E1-02l R2). */
interface PendingLabel {
  readonly drawable: number;
  readonly entryId: Id;
  readonly date: IsoDate;
  readonly boxIndex: number;
  readonly box: PieceDraft;
  readonly runs: readonly StyledRun[];
  readonly sizePt: number;
  readonly dropped: readonly DroppedLine[];
  /**
   * F-LAYOUT2 Punkt 13: nur im freien Bereich (nie über einer Blockfläche); ohne Platz entfällt der Text mit
   * Ereignis 'lineDropped' (`dropped`) statt 'labelOutside'.
   */
  readonly optional?: boolean;
  /** F-LAYOUT2 Punkt 13: längerer Text (Kürzel mit Ort), zuerst im freien Bereich versucht; gilt mit dropped []. */
  readonly withOrt?: readonly StyledRun[];
  /** F-LAYOUT2 Runde 2: «(‹Ort›)» allein (eigener Träger, wenn nur das Kürzel am Kästchen Platz findet). */
  readonly ortRuns?: readonly StyledRun[];
}

/** Platzierte Beschriftung; `runs` und `dropped` wie gezeichnet (mit oder ohne Ort). */
interface PlacedLabel {
  readonly label: PendingLabel;
  readonly piece: PieceDraft;
  readonly items: PageItem[];
  readonly dropped: readonly DroppedLine[];
}

/** Hindernisse der Beschriftungen eines Tages: Flächen der Einträge und Textumrisse. */
interface LabelObstacles {
  readonly hard: Rect[];
  readonly soft: Rect[];
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** Grössen der Beschriftung: Textart, dann 0,25-pt-Stufen bis zur Mindestgrösse. */
function labelSizes(standard: number, min: number): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const s = Math.max(min, standard - i * GRID_CONSTANTS.sizeStepPt);
    out.push(s);
    if (s <= min) return out;
  }
}

/**
 * Beschriftungen neben ihren Kästchen (E1-02l R2, R-10-55): nächste freie Lage im Tag zwischen y(V0) und y(V1),
 * ohne Schnitt mit Kästchen, Markern, Texten und anderen Trägern; Blockflächen nur, wenn sonst nichts frei ist.
 * Grösse der Textart, sonst schrittweise bis zur Mindestgrösse. Weisser Träger mit dem Rahmen des Kästchens.
 */
function placeLabels(
  ctx: EntriesContext,
  pending: readonly PendingLabel[],
  obstacles: ReadonlyMap<IsoDate, LabelObstacles>,
): { readonly placed: readonly PlacedLabel[]; readonly missed: readonly PendingLabel[] } {
  const out: PlacedLabel[] = [];
  const missed: PendingLabel[] = [];
  const yTop = timeToY(ctx.scale, ctx.v0);
  const yBottom = timeToY(ctx.scale, ctx.v1);
  // Warteschlange: ein Ort, der nach Runde 2 einen eigenen Träger erhält, wird hinten angefügt.
  const queue: PendingLabel[] = [...pending];
  for (let qi = 0; qi < queue.length; qi++) {
    const label = queue[qi] as PendingLabel;
    const day = ctx.days.find((d) => d.geo.date === label.date);
    if (day === undefined) continue;
    const own = obstacles.get(label.date) ?? { hard: [], soft: [] };
    const bounds: Rect = { x: day.geo.x, y: yTop, w: day.geo.w, h: yBottom - yTop };
    const pad = GRID_CONSTANTS.textInsetPt + label.box.stroke.widthPt / 2;
    const box = outerRect(label.box);
    // Zuerst eine ganz freie Lage nahe am Kästchen, dann im ganzen Tag; Blockflächen nur, wenn nirgends Platz frei ist
    // (H-LAYOUT, Zusatzbefund visual-qa (d): nie über fremdem Block, solange es freien Platz gibt).
    // F-LAYOUT2 Runde 2 (VQA-2-03, VQA-2-07): zuerst unmittelbar am eigenen Kästchen (höchstens eine Zeile Abstand,
    // gemeinsame Projektion), damit eine Nummer nie nur über einem fremden Kästchen steht.
    const adjacent = [
      { allowSoft: false, far: false, adjacent: lineHeightPt(label.sizePt) },
    ] as const;
    const free = [
      ...adjacent,
      { allowSoft: false, far: false },
      { allowSoft: false, far: true },
    ] as const;
    const search = (
      runs: readonly StyledRun[],
      passes: readonly {
        readonly allowSoft: boolean;
        readonly far: boolean;
        readonly adjacent?: number;
      }[],
    ): { readonly spot: Rect; readonly size: number } | null => {
      for (const pass of passes) {
        for (const s of labelSizes(label.sizePt, ctx.template.fontSizes.min)) {
          const line = labelLineSize(runs, s);
          const spot = findLabelSpot(
            {
              box,
              w: line.w + 2 * pad,
              h: line.h + 2 * pad,
              bounds,
              hard: own.hard,
              soft: own.soft,
            },
            pass,
          );
          if (spot !== null) return { spot, size: s };
        }
      }
      return null;
    };
    // F-LAYOUT2 Punkt 13: Kürzel mit Ort nur im freien Bereich; sonst das Kürzel allein wie bisher. Runde 2: Finden
    // Kürzel und Ort zusammen nicht unmittelbar am Kästchen Platz, das Kürzel aber allein, steht das Kürzel dort und der
    // Ort in einem eigenen Träger (freier Bereich, sonst entfällt er mit Befund).
    let runs = label.runs;
    let dropped = label.dropped;
    let found: { readonly spot: Rect; readonly size: number } | null = null;
    if (label.withOrt !== undefined) {
      const together = search(label.withOrt, adjacent);
      const alone = together === null ? search(label.runs, adjacent) : null;
      if (together !== null) {
        found = together;
        runs = label.withOrt;
        dropped = [];
      } else if (alone !== null && label.ortRuns !== undefined) {
        found = alone;
        dropped = [];
        queue.push({
          drawable: label.drawable,
          entryId: label.entryId,
          date: label.date,
          boxIndex: label.boxIndex,
          box: label.box,
          runs: label.ortRuns,
          sizePt: ctx.template.fontSizes.standard,
          dropped: ['ort'],
          optional: true,
        });
      } else {
        const later = search(label.withOrt, free.slice(1));
        if (later !== null) {
          found = later;
          runs = label.withOrt;
          dropped = [];
        }
      }
    }
    found ??= search(
      runs,
      label.optional === true ? free : [...free, { allowSoft: true, far: false }],
    );
    if (found === null && label.optional === true) {
      missed.push(label);
      continue;
    }
    const spot = found?.spot ?? null;
    const size = found?.size ?? ctx.template.fontSizes.min;
    const line = labelLineSize(runs, size);
    const rect =
      spot ??
      fallbackSpot({ box, w: line.w + 2 * pad, h: line.h + 2 * pad, bounds, hard: [], soft: [] });
    const piece: PieceDraft = {
      ...label.box,
      kind: 'outsideLabel',
      rect,
      part: label.boxIndex,
      windowId: null,
      textCarrier: true,
      openTop: false,
      openBottom: false,
      fill: WHITE,
      text: null,
      obstacle: null,
    };
    const outcome: TextOutcome = {
      lines: [{ runs, widthPt: line.w, sizePt: size, hyphen: false, para: 0 }],
      orientation: 'horizontal',
      alignTop: false,
      event: null,
    };
    const items: PageItem[] = [
      ...shapeItems(piece, label.entryId),
      ...statusText(
        ctx,
        label.entryId,
        outcome,
        placeText(
          outcome,
          inset(rect, pad),
          textColorForFill(WHITE),
          label.box.role,
          label.entryId,
        ),
        0,
      ),
    ];
    if (obstacles.has(label.date)) (obstacles.get(label.date) as LabelObstacles).hard.push(rect);
    out.push({ label, piece, items, dropped });
  }
  return { placed: out, missed };
}

/** Absatz des Titels eines Textträgers (Block: nach der Zeitzeile; Kästchen, Querbalken, Marker: die erste Zeile). */
function titleParaOf(p: PieceDraft): number | null {
  const spec = p.text;
  if (spec === null || spec.kind === 'omitted') return null;
  if (spec.kind === 'block') {
    if (spec.spec.title.length === 0) return null;
    return spec.spec.timeLine === null ? 0 : 1;
  }
  return 0;
}

/** Status-Darstellung der Zeilen eines Eintrags (R-10-27 bis R-10-29, R-10-31); Zeilen ohne Läufe entfallen wie in placeText. */
function statusText(
  ctx: EntriesContext,
  entryId: Id,
  outcome: TextOutcome,
  items: TextItem[],
  titlePara: number | null,
): TextItem[] {
  const changed = ctx.changedEntryIds?.has(entryId) === true;
  const mark = (list: TextItem[]): TextItem[] =>
    changed ? list.map((item) => ({ ...item, runs: markChangedRuns(item.runs, true) })) : list;
  if (ctx.showStatus !== true) return mark(items);
  const paras = outcome.lines.filter((l) => l.runs.length > 0).map((l) => l.para);
  return mark(styleEntryText(items, paras, ctx.plan.entries[entryId], titlePara, true));
}

/** Alle Einträge der sichtbaren Tage (2d–2f). */
export function layoutEntries(ctx: EntriesContext, weekId: Id): EntriesLayout {
  const band = layoutQuerbalken(ctx, weekId);
  const drawables: Drawable[] = [...band.drawables];
  for (const day of ctx.days) drawables.push(...layoutBlocks(ctx, day));
  for (const day of ctx.days) drawables.push(...layoutRapportBoxes(ctx, day));
  for (const day of ctx.days) drawables.push(...layoutBesoBoxes(ctx, day));
  // GB-LAYOUT 18a (VQA-3-03): Blockflächen des Tages als Hindernis für die Markerfelder.
  const blockRects = new Map<IsoDate, Rect[]>();
  for (const d of drawables) {
    for (const p of d.pieces) {
      if (p.kind !== 'block') continue;
      const list = blockRects.get(p.date) ?? [];
      list.push(p.rect);
      blockRects.set(p.date, list);
    }
  }
  for (const day of ctx.days) {
    drawables.push(...layoutMarkers(ctx, day, blockRects.get(day.geo.date) ?? []));
  }
  drawables.sort(compareDrawables);
  const obstacles = obstaclesByDate(drawables);

  // Je Zeichenelement seine Items; Beschriftungen neben dem Kästchen (E1-02l R2) folgen den Items ihres Eintrags.
  const chunks: PageItem[][] = [];
  const pieces = new Map<Id, EntryPiece[]>();
  const textEvents: FallbackEvent[] = [];
  const pending: PendingLabel[] = [];
  const labelObstacles = new Map<IsoDate, LabelObstacles>();
  const obstaclesOf = (date: IsoDate): LabelObstacles => {
    const o = labelObstacles.get(date) ?? { hard: [], soft: [] };
    labelObstacles.set(date, o);
    return o;
  };
  drawables.forEach((d, di) => {
    const chunk: PageItem[] = [];
    chunks.push(chunk);
    const list = pieces.get(d.entryId) ?? [];
    pieces.set(d.entryId, list);
    for (const p of d.pieces) {
      const index = list.length;
      const text = textOf(ctx, p, obstacles.get(p.date));
      const textItems: TextItem[] =
        text === null || p.fill === null
          ? []
          : statusText(
              ctx,
              d.entryId,
              text.outcome,
              placeText(text.outcome, text.area, textColorForFill(p.fill), p.role, d.entryId),
              titleParaOf(p),
            );
      list.push({
        kind: p.kind,
        date: p.date,
        rect: p.rect,
        span: p.span,
        part: p.part,
        windowId: p.windowId,
        textCarrier: p.textCarrier,
        textOrientation: textItems.length > 0 ? (text?.outcome.orientation ?? null) : null,
        openTop: p.openTop,
        openBottom: p.openBottom,
        continuation: p.continuation,
      });
      chunk.push(...shapeItems(p, d.entryId), ...textItems);
      if (p.kind !== 'querbalken') {
        const o = obstaclesOf(p.date);
        (p.kind === 'block' ? o.soft : o.hard).push(outerRect(p));
        for (const t of textItems) o.hard.push(textBounds(t));
      }
      const outside = text?.outcome.outside;
      if (outside !== undefined && p.fill !== null) {
        pending.push({
          drawable: di,
          entryId: d.entryId,
          date: p.date,
          boxIndex: index,
          box: p,
          runs: outside.runs,
          sizePt: outside.sizePt,
          dropped: text?.outcome.event?.dropped ?? [],
          ...(outside.withOrt === undefined ? {} : { withOrt: outside.withOrt }),
          ...(outside.ortRuns === undefined ? {} : { ortRuns: outside.ortRuns }),
        });
        continue;
      }
      const beside = text?.outcome.beside;
      if (beside !== undefined && p.fill !== null) {
        pending.push({
          drawable: di,
          entryId: d.entryId,
          date: p.date,
          boxIndex: index,
          box: p,
          runs: beside.runs,
          sizePt: beside.sizePt,
          dropped: beside.dropped,
          optional: true,
        });
      }
      const event = text?.outcome.event ?? null;
      if (event !== null) {
        textEvents.push({
          kind: event.kind,
          region: 'block',
          weekId,
          date: p.date,
          entryId: d.entryId,
          piece: index,
          dropped: event.dropped,
        });
      }
    }
  });
  const labels = placeLabels(ctx, pending, labelObstacles);
  for (const placed of labels.placed) {
    const { label, piece } = placed;
    const list = pieces.get(label.entryId) ?? [];
    const index = list.length;
    list.push({
      kind: piece.kind,
      date: piece.date,
      rect: piece.rect,
      span: piece.span,
      part: piece.part,
      windowId: null,
      textCarrier: true,
      textOrientation: 'horizontal',
      openTop: false,
      openBottom: false,
      continuation: piece.continuation,
    });
    chunks[label.drawable]?.push(...placed.items);
    // F-LAYOUT2 Punkt 13: ein Ort im freien Bereich neben dem Kästchen ist kein Rückfall.
    if (label.optional === true) continue;
    textEvents.push({
      kind: 'labelOutside',
      region: 'block',
      weekId,
      date: label.date,
      entryId: label.entryId,
      piece: index,
      dropped: placed.dropped,
    });
  }
  for (const label of labels.missed) {
    textEvents.push({
      kind: 'lineDropped',
      region: 'block',
      weekId,
      date: label.date,
      entryId: label.entryId,
      piece: label.boxIndex,
      dropped: label.dropped,
    });
  }
  const items: PageItem[] = chunks.flat();

  const listed = new Map<Id, Entry>();
  for (const day of ctx.days) {
    for (const e of day.entries) {
      // C2: eigener Tag sichtbar (Querbalken: einer seiner Tage) oder Folgetag-Teil an diesem Tag.
      const own = e.type === 'querbalken' || ('date' in e && e.date === day.geo.date);
      if (RASTER_TYPES.has(e.type) && (own || hasNextDayPart(e, ctx.template))) listed.set(e.id, e);
    }
  }
  const entries = [...listed.values()].sort(compareEntries).map(
    (e): EntryGeometry => ({
      entryId: e.id,
      type: e.type,
      pieces: pieces.get(e.id) ?? [],
    }),
  );
  return { items, entries, fallbacks: [...band.bandEvents, ...textEvents] };
}

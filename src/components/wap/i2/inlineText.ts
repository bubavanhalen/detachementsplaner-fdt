// Direktbearbeitung im Block (F-UX2 P2; Rückmeldung N2 vom 19.10.2026; Beschrieb 5.1; ADR-004 Leitplanke 2): Der Block
// zeigt den Text aus der Layout-Schicht. Diese reine Abbildung ordnet jedem Zeichen eines bearbeiteten Feldes (Titel,
// Zusatz, Ltg, Ort) seine Lage in den vorberechneten Zeilen zu, damit Schreibmarke und Markierung im gezeichneten Text
// liegen. Der Browser bricht nie selbst um: Zeilenumbrüche, entfallene Leerzeichen und Trennstriche kommen aus dem
// Layout; ein Feld ohne Platz im Block bleibt ohne Lage (Feldanzeige an der Blockkante).

import { measureRuns } from '../../../model/wap/layout/text/measure';
import type { ScreenLine } from './layoutViews';

/** Ein gezeichnetes Zeichen: Zeile, Anfang und Ende entlang der Zeile in px ab dem Zeilenbeginn. */
interface Glyph {
  readonly ch: string;
  readonly line: number;
  readonly a: number;
  readonly b: number;
  readonly bold: boolean;
  /** Erstes bzw. letztes Zeichen seiner Zeile. */
  readonly first: boolean;
  readonly last: boolean;
}

/** Rechteck relativ zur Ansicht in px. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Lage eines Feldes: je Zeichen das gezeichnete Zeichen (Index in `glyphs`) oder null (nicht gezeichnet). */
export interface FieldPlacement {
  readonly value: string;
  readonly slots: readonly (number | null)[];
  /** Alle Zeichen des Feldes sind gezeichnet (sonst Feldanzeige). */
  readonly complete: boolean;
}

export interface InlineLayout {
  readonly glyphs: readonly Glyph[];
  readonly lines: readonly ScreenLine[];
  readonly fields: readonly FieldPlacement[];
}

const SPACE = /\s/u;
/** Trennstrich der Silbentrennung bzw. Kürzungszeichen der Layout-Schicht. */
const HYPHEN = '-';
const ELLIPSIS = '…';

function glyphsOf(lines: readonly ScreenLine[]): Glyph[] {
  const out: Glyph[] = [];
  lines.forEach((line, li) => {
    let x = 0;
    const start = out.length;
    for (const run of line.runs)
      for (const ch of run.text) {
        const w = measureRuns([{ text: ch, weight: run.bold ? 'bold' : 'regular' }], line.fontPx);
        out.push({ ch, line: li, a: x, b: x + w, bold: run.bold, first: false, last: false });
        x += w;
      }
    if (out.length > start) {
      const f = out[start] as Glyph;
      out[start] = { ...f, first: true };
      const l = out[out.length - 1] as Glyph;
      out[out.length - 1] = { ...l, last: true };
    }
  });
  return out;
}

/** Ordnet `value` ab dem Zeichen `from` zu; Ergebnis: Zuordnung, Anzahl gezeichneter Zeichen, nächstes Zeichen. */
function alignFrom(
  value: readonly string[],
  glyphs: readonly Glyph[],
  from: number,
): { slots: (number | null)[]; matched: number; next: number } {
  const slots: (number | null)[] = [];
  let j = from;
  let matched = 0;
  let stopped = false;
  for (const ch of value) {
    if (stopped) {
      slots.push(null);
      continue;
    }
    // Trennstrich am Zeilenende, den das Layout eingefügt hat (kein Zeichen des Feldes).
    while (
      j < glyphs.length &&
      (glyphs[j] as Glyph).ch === HYPHEN &&
      (glyphs[j] as Glyph).last &&
      ch !== HYPHEN
    )
      j++;
    const g = glyphs[j];
    if (g !== undefined && g.ch === ch) {
      slots.push(j);
      // Gezählt werden sichtbare Zeichen (wie `visible` in placeFields); sonst gälte ein Feld mit Leerzeichen nie
      // als ganz gezeichnet und die Feldanzeige zeigte den Wert doppelt (UX-2-14).
      if (!SPACE.test(ch)) matched++;
      j++;
      continue;
    }
    // Leerzeichen am Zeilenumbruch bzw. am Rand entfällt im Layout.
    if (SPACE.test(ch) && (g === undefined || g.first || matched === 0)) {
      slots.push(null);
      continue;
    }
    // Gekürzt («…») oder entfallen: der Rest ist nicht gezeichnet.
    if (g === undefined || g.ch === ELLIPSIS || g.ch !== ch) stopped = true;
    slots.push(null);
  }
  return { slots, matched, next: j };
}

/**
 * Lage der Felder in den Zeilen einer Ansicht. `values` in der Reihenfolge, in der das Layout sie setzt (Titel, Zusatz,
 * Ltg, Ort); jedes Feld wird nach dem vorherigen gesucht (bester Anfang mit den meisten gezeichneten Zeichen).
 */
export function placeFields(lines: readonly ScreenLine[], values: readonly string[]): InlineLayout {
  const glyphs = glyphsOf(lines);
  const fields: FieldPlacement[] = [];
  let from = 0;
  for (const value of values) {
    const chars = [...value];
    const visible = chars.filter((c) => !SPACE.test(c)).length;
    let best: { slots: (number | null)[]; matched: number; next: number } = {
      slots: chars.map(() => null),
      matched: 0,
      next: from,
    };
    if (visible > 0)
      for (let s = from; s < glyphs.length; s++) {
        const first = chars.find((c) => !SPACE.test(c));
        if ((glyphs[s] as Glyph).ch !== first) continue;
        const r = alignFrom(chars, glyphs, s);
        if (r.matched > best.matched) best = r;
        if (r.matched === visible) break;
      }
    // Zeichenindex (UTF-16) → Codepunkt: Eingabefelder zählen in UTF-16, die Zeilen in Codepunkten.
    const slots: (number | null)[] = [];
    chars.forEach((c, i) => {
      for (let k = 0; k < c.length; k++) slots.push(best.slots[i] ?? null);
    });
    fields.push({ value, slots, complete: best.matched === visible });
    if (best.matched > 0) from = best.next;
  }
  return { glyphs, lines, fields };
}

/** Rechteck eines Zeichens bzw. einer Strecke entlang einer Zeile (auch gedreht). */
function spanBox(line: ScreenLine, a: number, b: number): Box {
  const h = line.fontPx * 1.15;
  const lift = line.fontPx * 0.05;
  // Gedreht wie `Line` (LayoutRender): 90 von unten nach oben ab der Grundlinie, 270 um (0, 1em) im Uhrzeigersinn.
  if (line.rotation === 90) {
    const bottom = line.top + line.fontPx;
    return { left: line.left - line.fontPx - lift, top: bottom - b, width: h, height: b - a };
  }
  if (line.rotation === 270) {
    const top = line.top + line.fontPx;
    return { left: line.left - lift, top: top + a, width: h, height: b - a };
  }
  return { left: line.left + a, top: line.top - lift, width: b - a, height: h };
}

/** Schreibmarke vor dem Zeichen `index` des Feldes `field` (`index` = Länge: nach dem letzten); null = nicht gezeichnet. */
export function caretBox(layout: InlineLayout, field: number, index: number): Box | null {
  const f = layout.fields[field];
  if (f === undefined) return null;
  const at = (i: number): { g: Glyph; edge: 'a' | 'b' } | null => {
    for (let k = i; k < f.slots.length; k++) {
      const s = f.slots[k];
      if (s != null && k === i) return { g: layout.glyphs[s] as Glyph, edge: 'a' };
      if (s != null) break;
    }
    for (let k = Math.min(i, f.slots.length) - 1; k >= 0; k--) {
      const s = f.slots[k];
      if (s != null) return { g: layout.glyphs[s] as Glyph, edge: 'b' };
    }
    for (let k = i; k < f.slots.length; k++) {
      const s = f.slots[k];
      if (s != null) return { g: layout.glyphs[s] as Glyph, edge: 'a' };
    }
    return null;
  };
  const hit = at(index);
  if (hit === null) return null;
  const line = layout.lines[hit.g.line];
  if (line === undefined) return null;
  const x = hit.edge === 'a' ? hit.g.a : hit.g.b;
  const box = spanBox(line, x, x);
  return line.rotation === 0
    ? { ...box, left: box.left - 0.5, width: Math.max(1, line.fontPx / 10) }
    : { ...box, top: box.top - 0.5, height: Math.max(1, line.fontPx / 10) };
}

/** Markierung `start`–`end` des Feldes als Rechtecke je Zeile. */
export function selectionBoxes(
  layout: InlineLayout,
  field: number,
  start: number,
  end: number,
): readonly Box[] {
  const f = layout.fields[field];
  if (f === undefined || end <= start) return [];
  const byLine = new Map<number, { a: number; b: number }>();
  for (let i = start; i < end; i++) {
    const s = f.slots[i];
    if (s == null) continue;
    const g = layout.glyphs[s] as Glyph;
    const prev = byLine.get(g.line);
    byLine.set(
      g.line,
      prev === undefined
        ? { a: g.a, b: g.b }
        : { a: Math.min(prev.a, g.a), b: Math.max(prev.b, g.b) },
    );
  }
  const out: Box[] = [];
  for (const [li, r] of byLine) {
    const line = layout.lines[li];
    if (line !== undefined) out.push(spanBox(line, r.a, r.b));
  }
  return out;
}

/**
 * Zeichenindex des Feldes, das dem Punkt (px relativ zur Ansicht) am nächsten liegt: Feld und Index für die
 * Schreibmarke nach einem Klick in den Text; null, wenn kein Feld gezeichnet ist.
 */
export function indexAt(
  layout: InlineLayout,
  x: number,
  y: number,
): { readonly field: number; readonly index: number } | null {
  let best: { field: number; index: number; d: number } | null = null;
  layout.fields.forEach((f, fi) => {
    f.slots.forEach((s, i) => {
      if (s == null) return;
      const g = layout.glyphs[s] as Glyph;
      const line = layout.lines[g.line];
      if (line === undefined) return;
      const box = spanBox(line, g.a, g.b);
      const cx = Math.max(box.left, Math.min(x, box.left + box.width));
      const cy = Math.max(box.top, Math.min(y, box.top + box.height));
      const d = Math.hypot(cx - x, (cy - y) * 2);
      const vertical = line.rotation !== 0;
      const mid = vertical ? box.top + box.height / 2 : box.left + box.width / 2;
      const before = vertical ? (line.rotation === 90 ? y > mid : y < mid) : x < mid;
      const index = before ? i : i + 1;
      if (best === null || d < best.d - 1e-9) best = { field: fi, index, d };
    });
  });
  const found = best as { field: number; index: number; d: number } | null;
  return found === null ? null : { field: found.field, index: found.index };
}

/** Wortgrenzen um `index` (Doppelklick wählt ein Wort). */
export function wordAt(
  value: string,
  index: number,
): { readonly start: number; readonly end: number } {
  const word = /[\p{L}\p{N}_-]/u;
  let start = Math.max(0, Math.min(index, value.length));
  let end = start;
  while (start > 0 && word.test(value[start - 1] ?? '')) start--;
  while (end < value.length && word.test(value[end] ?? '')) end++;
  return { start, end };
}

/**
 * Trefferflächen des Textes (je Zeile, 2 px Rand): Klick und Ziehen im Text setzen die Schreibmarke bzw. markieren;
 * ausserhalb des Textes bleibt der Block greifbar (Ziehen übernimmt die Bearbeitung, UI-Richtlinie 5.4).
 */
export function textBoxes(layout: InlineLayout): readonly Box[] {
  return layout.lines.map((line) => {
    const length = line.runs.reduce((a, r) => a + r.widthPx, 0);
    const b = spanBox(line, 0, Math.max(length, line.fontPx / 2));
    return { left: b.left - 2, top: b.top - 2, width: b.width + 4, height: b.height + 4 };
  });
}

/**
 * Stelle zum Klickpunkt in der ganzen Blockfläche (UX-2-05): im Text wie `indexAt`, neben oder unter den Zeilen das
 * Ende der nächstgelegenen Zeile.
 */
export function indexNear(
  layout: InlineLayout,
  x: number,
  y: number,
): { readonly field: number; readonly index: number } | null {
  const boxes = textBoxes(layout);
  const inBox = (b: Box) =>
    x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;
  if (boxes.length === 0 || boxes.some(inBox)) return indexAt(layout, x, y);
  // Nur Zeilen mit Text eines Feldes (nicht z.B. die Zeitzeile).
  const editable = new Set<number>();
  for (const f of layout.fields)
    for (const s of f.slots) if (s != null) editable.add((layout.glyphs[s] as Glyph).line);
  let line = -1;
  let best = Number.POSITIVE_INFINITY;
  boxes.forEach((b, i) => {
    if (!editable.has(i)) return;
    const dx = Math.max(b.left - x, 0, x - (b.left + b.width));
    const dy = Math.max(b.top - y, 0, y - (b.top + b.height));
    // Nächstgelegen quer zur Zeile (über/unter waagrechten, neben gedrehten Zeilen), längs nur bei Gleichstand.
    const vertical = (layout.lines[i] as ScreenLine).rotation !== 0;
    const d = (vertical ? dx : dy) * 1e4 + (vertical ? dy : dx);
    if (d < best - 1e-9) {
      best = d;
      line = i;
    }
  });
  // Auf der Höhe einer Zeile (links oder rechts daneben): Anfang bzw. Ende wie im Text.
  if (best < 1e4) return indexAt(layout, x, y);
  let end: { field: number; index: number; glyph: number } | null = null;
  layout.fields.forEach((f, fi) => {
    f.slots.forEach((s, i) => {
      if (s == null || (layout.glyphs[s] as Glyph).line !== line) return;
      if (end === null || s > end.glyph) end = { field: fi, index: i + 1, glyph: s };
    });
  });
  const found = end as { field: number; index: number; glyph: number } | null;
  return found === null ? indexAt(layout, x, y) : { field: found.field, index: found.index };
}

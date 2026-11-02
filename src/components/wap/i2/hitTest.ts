// Treffen im Raster (F-UX2 P4; Rückmeldung N4 vom 19.10.2026; Gestaltung raster-bedienung-v2 §2–3; Beschrieb 5.1):
// Welcher Eintrag und welche Zone liegen unter dem Zeiger? Aus der Geometrie der Ansichten (Teilstücke der
// Layout-Schicht), nicht aus der Stapelung der Elemente: Marker vor Kästchen und Blöcken (ausser verdeckt an einer
// Blockkante), sonst der kleinste Eintrag, der den Punkt enthält, bei gleicher Fläche der oberste. Zonen in Bildschirm-px, unabhängig vom Zoom. Rein.
// F-UX3 (Rückmeldung Auftraggeber 21.10.2026 «ich mag nicht, dass ich einen Block zuerst anwählen muss»): Kanten- und
// Körperzonen gelten für jeden Block, nicht nur für den gewählten; die Auswahl ändert keine Zone mehr.
// F-UX3 Runde 3 (Entscheid Auftraggeber 21.10.2026, 5a «Pille mit Doppelpfeil»): Griffe an den Kanten des
// überfahrenen Blocks und am Marker; ihre Fläche plus 3 px ringsum ist Trefferfläche der Kante (ragt über die Kante
// hinaus); Kantenband bis ⅓ der Höhe, höchstens 12 px (Gestaltung bewegung-v1, Abweichung von raster-bedienung-v2 §2).

import type { EntryView, Rect } from './entryViews';
import type { ColumnBox } from './geometry';

export type Zone = 'body' | 'start' | 'end' | 'left' | 'right';

export interface Hit {
  readonly view: EntryView;
  readonly zone: Zone;
}

/**
 * Band der oberen bzw. unteren Kante innen (px): ab 24 px Höhe ein Drittel der Höhe, mindestens 8 und höchstens 12
 * (Runde 3: «Bandbreite ≤ 12 px»), 4 ab 12 px, darunter ein Drittel der Höhe (Rundung der Höhe auf ½ px toleriert),
 * damit auch sehr kleine Blöcke ohne Auswahl in der Grösse änderbar sind; die Mitte bleibt zum Verschieben. Gleich für
 * gewählte und nicht gewählte Einträge; `_selected` bleibt für Aufrufer erhalten und ändert nichts.
 */
export function edgeBand(height: number, _selected = false): number {
  if (height >= 23.5) return Math.min(12, Math.max(8, Math.floor(height / 3)));
  return height >= 11.5 ? 4 : Math.max(0, Math.floor(height / 3));
}

/** Griff (Pille 34 × 16 px mit Doppelpfeil, Variante B), Trefferfläche plus 3 px ringsum. */
export const GRIP_W = 34;
export const GRIP_H = 16;
export const GRIP_SLOP = 3;
/** Seitengriffe ab dieser Blockbreite und -höhe (px); oben/unten rechts ab GRIP_RIGHT_FROM px Breite. */
export const GRIP_SIDE_MIN_W = 60;
export const GRIP_SIDE_MIN_H = 30;
export const GRIP_RIGHT_FROM = 80;
export type GripZone = 'start' | 'end' | 'left' | 'right' | 'marker';

export interface Grip {
  readonly zone: GripZone;
  /** Mitte relativ zum Tag (px). */
  readonly cx: number;
  readonly cy: number;
  readonly vertical: boolean;
}

/**
 * Griffe einer Ansicht (Gestaltung bewegung-v1 «Griffe»): Block oben/unten ab 80 px Breite rechts (6 px vom Rand),
 * damit der mittig gesetzte Titel frei bleibt, sonst mittig; unter 30 px Höhe um eine halbe Griffhöhe − 2 px nach
 * aussen versetzt; seitlich in der Mitte der Kante erst ab 60 px Breite und 30 px Höhe. Rapport nur oben/unten,
 * Marker ein Zeitgriff mitten auf der Linie. Andere Einträge keine.
 */
export function gripsOf(view: EntryView): readonly Grip[] {
  const r = view.rect;
  if (view.kind === 'marker') {
    const line = markerLine(view);
    return [
      { zone: 'marker', cx: r.left + r.width / 2, cy: line.top + line.height / 2, vertical: false },
    ];
  }
  if (view.kind !== 'block' && view.kind !== 'rapport') return [];
  const out = r.height < GRIP_SIDE_MIN_H ? GRIP_H / 2 - 2 : 0;
  const cx = r.width >= GRIP_RIGHT_FROM ? r.left + r.width - GRIP_W / 2 - 6 : r.left + r.width / 2;
  const grips: Grip[] = [
    { zone: 'start', cx, cy: r.top - out, vertical: false },
    { zone: 'end', cx, cy: r.top + r.height + out, vertical: false },
  ];
  if (view.kind === 'block' && r.width >= GRIP_SIDE_MIN_W && r.height >= GRIP_SIDE_MIN_H)
    grips.push(
      { zone: 'left', cx: r.left, cy: r.top + r.height / 2, vertical: true },
      { zone: 'right', cx: r.left + r.width, cy: r.top + r.height / 2, vertical: true },
    );
  return grips;
}

/**
 * Linie eines Markers: das flachste Teilstück der Layout-Schicht (daneben liegt das Beschriftungsfeld); ohne
 * Teilstücke die Fläche der Ansicht (Linie in der Mitte).
 */
export function markerLine(view: EntryView): Rect {
  const pieces = view.hitRects ?? [];
  let best: Rect | null = null;
  for (const p of pieces) if (best === null || p.height < best.height) best = p;
  return best ?? view.rect;
}

/** Trefferfläche eines Griffs (Griff plus GRIP_SLOP ringsum), relativ zum Tag. */
export function gripHitRect(g: Grip): Rect {
  const w = (g.vertical ? GRIP_H : GRIP_W) + 2 * GRIP_SLOP;
  const h = (g.vertical ? GRIP_W : GRIP_H) + 2 * GRIP_SLOP;
  return { left: g.cx - w / 2, top: g.cy - h / 2, width: w, height: h };
}
/** Seitliche Kanten (px) innen, an jedem Block ab 24 px Breite (F-UX3; vorher nur am gewählten). */
export const SIDE_BAND = 6;
/**
 * Schmaler Block (< 24 px): seitliche Kante aussen (px; UX-2-03), an jedem Block über leerer Fläche (F-UX3; vorher nur
 * am gewählten). Mindestbreite der Kantenzone in schmalen Spalten; innen bleibt die ganze Breite zum Verschieben.
 */
export const OUTER_SIDE_BAND = 4;
/** Marker: dünne Linie mindestens ± 2 px (wie gezeichnet ab 100 %). */
export const MARKER_SLOP = 2;
/** Mindest-Trefferbreite schmaler Spalten (px). */
export const MIN_COLUMN_HIT = 16;

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + Math.max(r.height, 1);
}

/** Trefferflächen einer Ansicht relativ zum Tag: Teilstücke, Marker mit Toleranz um die Linie. */
export function hitRects(view: EntryView): readonly Rect[] {
  const pieces =
    view.hitRects !== undefined && view.hitRects.length > 0 ? view.hitRects : [view.rect];
  if (view.kind !== 'marker') return pieces;
  // Marker: dünne Linie mindestens ± MARKER_SLOP um ihre Mitte, das Beschriftungsfeld wie gezeichnet.
  return pieces.map((r) => {
    if (r.height >= 2 * MARKER_SLOP) return r;
    const mid = r.top + r.height / 2;
    return { left: r.left, top: mid - MARKER_SLOP, width: r.width, height: 2 * MARKER_SLOP };
  });
}

/**
 * Liegt der Punkt im Block jenseits des Kantenbands? Innen zählt der Griff nur bis zum Band (die Mitte bleibt zum
 * Verschieben, CR-U-2-04); aussen ragt er über die Kante hinaus.
 */
function insideBody(view: EntryView, zone: GripZone, x: number, y: number): boolean {
  if (zone === 'marker') return false;
  const r = view.rect;
  if (x < r.left || x >= r.left + r.width || y < r.top || y >= r.top + r.height) return false;
  const band = edgeBand(r.height);
  if (zone === 'start') return y - r.top >= band;
  if (zone === 'end') return r.top + r.height - y > band;
  if (zone === 'left') return x - r.left >= SIDE_BAND;
  return r.left + r.width - x > SIDE_BAND;
}

function area(rects: readonly Rect[]): number {
  return rects.reduce((a, r) => a + r.width * Math.max(r.height, 1), 0);
}

/**
 * Eintrag und Zone am Punkt (px relativ zum Tag). `selected` = Schlüssel des allein gewählten Eintrags (seitliche
 * Kanten nur dort, UI-Richtlinie 5.5: Griffe am gewählten Block).
 */
export function hitEntry(
  views: readonly EntryView[],
  x: number,
  y: number,
  selected: string | null = null,
  hovered: string | null = null,
): Hit | null {
  const under = views.filter(
    (v) => !v.id.includes('~') && hitRects(v).some((r) => inside(r, x, y)),
  );
  // Griffe des überfahrenen Eintrags (Runde 3, 5a): Griff plus 3 px ist Kante, auch über die Kante hinaus – dort nur
  // über leerer Fläche bzw. dem Eintrag selbst: ein anderer Eintrag am Punkt geht vor (R-5.1-26, CR-3-02), auch ein
  // Marker; der Zeitgriff des Markers zählt nur auf dem Marker oder über leerer Fläche.
  if (hovered !== null) {
    const h = views.find((v) => keyOf(v) === hovered && !v.id.includes('~'));
    if (h !== undefined && !under.some((v) => v !== h))
      for (const g of gripsOf(h))
        if (inside(gripHitRect(g), x, y) && !insideBody(h, g.zone, x, y))
          return { view: h, zone: g.zone === 'marker' ? 'body' : g.zone };
  }
  // Schmaler Block: Kante aussen links bzw. rechts (bei 50 % und «Einpassen» sind einspaltige Blöcke rund 20 px
  // breit; innen bleibt die Fläche zum Verschieben; UX-2-03). An jedem Block (F-UX3), nur über leerer Fläche: ein
  // anderer Eintrag am Punkt gilt vor der Kante (R-5.1-26, CR-3-02). Liegen zwei Kanten am Punkt, die nähere; bei
  // gleichem Abstand der gewählte.
  if (under.length === 0) {
    let outer: { hit: Hit; d: number; chosen: boolean } | null = null;
    for (const v of views) {
      if (v.kind !== 'block' || v.id.includes('~') || v.rect.width >= 24) continue;
      const c = v.rect;
      if (y < c.top || y >= c.top + c.height) continue;
      const left = x >= c.left - OUTER_SIDE_BAND && x < c.left;
      const right = x >= c.left + c.width && x < c.left + c.width + OUTER_SIDE_BAND;
      if (!left && !right) continue;
      const d = left ? c.left - x : x - (c.left + c.width);
      const chosen = selected !== null && keyOf(v) === selected;
      if (outer === null || d < outer.d - 0.01 || (Math.abs(d - outer.d) <= 0.01 && chosen))
        outer = { hit: { view: v, zone: left ? 'left' : 'right' }, d, chosen };
    }
    if (outer !== null) return outer.hit;
  }
  // Verdeckter Marker an der Kante (UX-2-04): liegt ein höher gestapelter Block bzw. Rapport über dem Marker und der
  // Punkt in dessen Kante oben/unten, gilt die sichtbare Kante (Zeit ändern). Im Innern bleibt der Marker vorn
  // (Treffer aus der Geometrie, R-5.1-26). Stapelung wie gezeichnet: der gewählte Eintrag liegt 20 Stufen höher.
  const stack = (v: EntryView) => v.z + (selected !== null && keyOf(v) === selected ? 20 : 0);
  const covered = (m: EntryView) =>
    under.some((v) => {
      if ((v.kind !== 'block' && v.kind !== 'rapport') || stack(v) <= stack(m)) return false;
      const zone = zoneOf(v, x, y, selected);
      return zone === 'start' || zone === 'end';
    });
  const visible = under.filter((v) => v.kind !== 'marker' || !covered(v));
  let best: { view: EntryView; area: number; marker: boolean } | null = null;
  for (const v of visible.length > 0 ? visible : under) {
    const rects = hitRects(v);
    const a = area(rects);
    const marker = v.kind === 'marker';
    if (
      best === null ||
      (marker && !best.marker) ||
      (marker === best.marker &&
        (a < best.area - 0.5 || (Math.abs(a - best.area) <= 0.5 && v.z > best.view.z)))
    )
      best = { view: v, area: a, marker };
  }
  if (best === null) return null;
  return { view: best.view, zone: zoneOf(best.view, x, y, selected) };
}

function keyOf(v: EntryView): string {
  return v.windowId === null ? v.id : `${v.id}:${v.windowId}`;
}

/**
 * Zone im Eintrag: Kanten oben/unten (Blöcke, Rapporte), seitlich an jedem Block ab 24 px Breite (F-UX3), am
 * Querbalken nur gewählt.
 */
export function zoneOf(view: EntryView, x: number, y: number, selected: string | null): Zone {
  const r = view.rect;
  const isSelected = selected !== null && selected === keyOf(view);
  if (view.kind === 'querbalken') {
    if (!isSelected) return 'body';
    if (view.first && x - r.left < SIDE_BAND) return 'left';
    if (view.last && r.left + r.width - x < SIDE_BAND) return 'right';
    return 'body';
  }
  if (view.kind !== 'block' && view.kind !== 'rapport') return 'body';
  const band = edgeBand(r.height);
  if (band > 0 && y - r.top < band) return 'start';
  if (band > 0 && r.top + r.height - y < band) return 'end';
  if (view.kind === 'block' && r.width >= 24) {
    if (x - r.left < SIDE_BAND) return 'left';
    if (r.left + r.width - x < SIDE_BAND) return 'right';
  }
  return 'body';
}

/**
 * Spalte unter dem Zeiger (Index in `columns`), schmale Spalten mit Mindest-Trefferbreite: Eine Spalte schmaler als
 * `min` gewinnt den Bereich `min` um ihre Mitte, höchstens bis zur Mitte der Nachbarn. Ausserhalb links → 0, rechts →
 * letzte; leer → -1.
 */
export function columnAt(columns: readonly ColumnBox[], x: number, min = MIN_COLUMN_HIT): number {
  if (columns.length === 0) return -1;
  let found = -1;
  columns.forEach((c, i) => {
    if (x >= c.left && x < c.left + c.width) found = i;
  });
  const first = columns[0] as ColumnBox;
  const last = columns[columns.length - 1] as ColumnBox;
  if (found < 0) found = x < first.left ? 0 : x >= last.left + last.width ? columns.length - 1 : 0;
  // Schmale Spalten in der Nähe: Mitte ± min/2, begrenzt auf die Mitte der Nachbarn.
  let narrow = -1;
  let narrowWidth = Number.POSITIVE_INFINITY;
  columns.forEach((c, i) => {
    if (c.width >= min) return;
    const mid = c.left + c.width / 2;
    const prev = columns[i - 1];
    const next = columns[i + 1];
    const lo = Math.max(mid - min / 2, prev === undefined ? -Infinity : prev.left + prev.width / 2);
    const hi = Math.min(mid + min / 2, next === undefined ? Infinity : next.left + next.width / 2);
    if (x >= lo && x < hi && c.width < narrowWidth) {
      narrow = i;
      narrowWidth = c.width;
    }
  });
  return narrow >= 0 ? narrow : found;
}

/** Mauszeiger je Zone (Gestaltung §2). */
export const ZONE_CURSOR: Readonly<Record<Zone | 'marker' | 'empty' | 'special', string>> = {
  body: 'grab',
  start: 'ns-resize',
  end: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
  marker: 'row-resize',
  empty: 'crosshair',
  special: 'cell',
};

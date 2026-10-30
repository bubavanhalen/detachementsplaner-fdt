// Bildschirmgeometrie des Wochenrasters (I2b-A A5, A8; Beschrieb 4.4 Breiten, 4.5 Zeitraster).
// Rein: Tagesbreiten (voll gleich breit, kompakt ein Drittel), Spaltenbreiten nach Gewicht, Zoom, Einpassen,
// Einrasten des Gewichts beim Ziehen der Spaltengrenze, Autoscroll-Geschwindigkeit, Zeitschild.

import { formatDate } from '../../../model/wap/calendar';
import { columnWeight } from '../../../model/wap/layout/grid/geometry';
import { formatMilTime } from '../../../model/wap/time';
import type { Column, ColumnWeight, DayDisplay, IsoDate, Weekday } from '../../../model/wap/types';

/** 100 %: 0,8 px je Minute (wie I2) und 360 px je vollem Tag. */
export const BASE_MINUTE_HEIGHT = 0.8;
export const BASE_DAY_WIDTH = 360;
export const ZOOM_LEVELS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
/** Breite der Zeitachse links (px). */
export const AXIS_WIDTH = 48;

export type ZoomSetting =
  | { readonly kind: 'level'; readonly value: number }
  | { readonly kind: 'fit' };

export interface Scale {
  /** Pixel je Minute. */
  readonly minute: number;
  /** Breite eines vollen Tags in Pixel. */
  readonly day: number;
  /**
   * Bildschirm = PDF (F-UX2 P1, CR-H-U-02/-03): px je pt, gleich in beiden Richtungen, und der Rahmen der Tage in pt
   * aus der PDF-Seite. Fehlt nur bei Massstäben ohne PDF-Bezug (ältere Aufrufer, Tests).
   */
  readonly factor?: number;
  readonly pt?: { readonly width: number; readonly height: number };
}

/**
 * Rahmen des Rasters aus der PDF-Seite (F-UX2 P1): Breite der sichtbaren Tage, Breite eines vollen Tags, pt je
 * Minute, Höhe der Spaltenköpfe und des Terminbereichs in pt.
 */
export interface PageBasis {
  readonly daysPt: number;
  readonly fullDayPt: number;
  readonly ptPerMinute: number;
  readonly minutes: number;
  readonly columnHeadPt: number;
}

/** PDF-Rahmen der Tage → Grundlage des Bildschirmmassstabs (Anteile wie `dayWidths`: voll 3, kompakt 1). */
export function pageBasis(
  grid: {
    readonly rect: { readonly w: number; readonly h: number };
    readonly timeAxisWidthPt: number;
    readonly dayHeaderHeightPt: number;
    readonly columnHeaderHeightPt: number;
  },
  displays: readonly DayDisplay[],
  minutes: number,
): PageBasis {
  const daysPt = grid.rect.w - 2 * grid.timeAxisWidthPt;
  const thirds = displays.reduce((s, d) => s + (d === 'full' ? 3 : d === 'compact' ? 1 : 0), 0);
  const body = grid.rect.h - grid.dayHeaderHeightPt - grid.columnHeaderHeightPt;
  return {
    daysPt,
    fullDayPt: thirds === 0 ? daysPt : (daysPt * 3) / thirds,
    ptPerMinute: minutes <= 0 ? 1 : body / minutes,
    minutes,
    columnHeadPt: grid.columnHeaderHeightPt,
  };
}

/** px je pt bei 100 %: 0,8 px je Minute wie bisher (Bezug der Zoomstufen, I2). */
export function basePageFactor(basis: PageBasis): number {
  return BASE_MINUTE_HEIGHT / basis.ptPerMinute;
}

/** Massstab mit einem einzigen Faktor (px je pt) für Raster, Köpfe und Termine (F-UX2 P1). */
export function pageScaleOf(basis: PageBasis, factor: number): Scale {
  return {
    minute: basis.ptPerMinute * factor,
    day: basis.fullDayPt * factor,
    factor,
    pt: { width: basis.daysPt, height: basis.minutes * basis.ptPerMinute },
  };
}

/**
 * Faktor der Zoomstufe bzw. für «Einpassen»: grösster Faktor, bei dem die Tage in die Breite und Köpfe, Raster und
 * Termine in die Höhe passen; `fixedPx` = feste Bildschirmhöhe (Tageszeile, Linien), `agendaPt` = Termine in pt.
 */
export function pageFactor(
  zoom: ZoomSetting,
  basis: PageBasis,
  available: { readonly width: number; readonly height: number },
  fixedPx: number,
  agendaPt: number,
): number {
  if (zoom.kind === 'level') return basePageFactor(basis) * zoom.value;
  const byWidth = available.width / Math.max(1, basis.daysPt);
  const heightPt = basis.columnHeadPt + basis.minutes * basis.ptPerMinute + agendaPt;
  const byHeight = (available.height - fixedPx) / Math.max(1, heightPt);
  const f = Math.min(byWidth, byHeight);
  // Auf Tausendstel abgerundet: kein Rollbalken durch Rundung, Massstab stabil beim Messen.
  return Math.max(0.1, Math.floor(f * 1000) / 1000);
}

export interface ColumnBox {
  readonly column: Column;
  readonly left: number;
  readonly width: number;
}

export interface DayBox {
  readonly date: IsoDate;
  readonly weekday: Weekday;
  readonly display: DayDisplay;
  readonly setId: string | null;
  readonly left: number;
  readonly width: number;
  readonly columns: readonly ColumnBox[];
  /** Planungs- und Nebenspalten (nehmen Blöcke auf). */
  readonly planning: readonly ColumnBox[];
}

const DAY_SHARE: Readonly<Record<DayDisplay, number>> = { full: 1, compact: 1 / 3, hidden: 0 };

/** Spalten eines Tages nebeneinander, Breite nach Gewicht (Planung 1/2/3, Nebenspalte 1, Rap 1, Beso 2). */
export function columnBoxes(columns: readonly Column[], dayWidth: number): readonly ColumnBox[] {
  const weights = columns.map(columnWeight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let left = 0;
  return columns.map((column, i) => {
    const width = sum === 0 ? 0 : (dayWidth * (weights[i] ?? 0)) / sum;
    const box = { column, left, width };
    left += width;
    return box;
  });
}

export function dayBoxes(
  days: readonly {
    readonly date: IsoDate;
    readonly weekday: Weekday;
    readonly display: DayDisplay;
    readonly setId: string | null;
    readonly columns: readonly Column[];
  }[],
  scale: Scale,
): readonly DayBox[] {
  let left = 0;
  const out: DayBox[] = [];
  for (const d of days) {
    if (d.display === 'hidden') continue;
    // Ohne Rundung: dieselben Breiten wie die Layout-Schicht (E1-02l, eine Layout-Schicht).
    const width = scale.day * DAY_SHARE[d.display];
    const columns = columnBoxes(d.columns, width);
    out.push({
      ...d,
      left,
      width,
      columns,
      planning: columns.filter(
        (c) => c.column.kind === 'planning' || c.column.kind === 'secondary',
      ),
    });
    left += width;
  }
  return out;
}

export function scaleOf(zoom: ZoomSetting, fit: Scale): Scale {
  if (zoom.kind === 'fit') return fit;
  return { minute: BASE_MINUTE_HEIGHT * zoom.value, day: BASE_DAY_WIDTH * zoom.value };
}

/** Einpassen: ganze Woche (alle sichtbaren Tage) und ganzer Anzeigebereich im verfügbaren Platz. */
export function fitScale(
  available: { readonly width: number; readonly height: number },
  displays: readonly DayDisplay[],
  minutes: number,
): Scale {
  const units = displays.reduce((sum, d) => sum + DAY_SHARE[d], 0);
  const day = units === 0 ? BASE_DAY_WIDTH : Math.max(60, Math.floor(available.width / units));
  const minute = minutes <= 0 ? BASE_MINUTE_HEIGHT : Math.max(0.2, available.height / minutes);
  return { day, minute };
}

export function nextZoom(zoom: ZoomSetting, current: Scale, direction: 1 | -1): ZoomSetting {
  const value = zoom.kind === 'level' ? zoom.value : current.minute / BASE_MINUTE_HEIGHT;
  const levels = direction > 0 ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse();
  const found = levels.find((l) => (direction > 0 ? l > value + 1e-6 : l < value - 1e-6));
  return { kind: 'level', value: found ?? (levels[levels.length - 1] as number) };
}

export function zoomLabel(zoom: ZoomSetting, current: Scale): string {
  const value = zoom.kind === 'level' ? zoom.value : current.minute / BASE_MINUTE_HEIGHT;
  return `${Math.round(value * 100)} %`;
}

const WEIGHTS: readonly ColumnWeight[] = ['narrow', 'normal', 'wide'];
const WEIGHT_NAMES: Readonly<Record<ColumnWeight, string>> = {
  narrow: 'schmal',
  normal: 'normal',
  wide: 'breit',
};

export function weightName(weight: ColumnWeight): string {
  return WEIGHT_NAMES[weight];
}

/**
 * Gewicht der Planungsspalte `index`, dessen rechte Kante dem Zeiger `x` (px ab Tagesbeginn) am nächsten liegt;
 * die Tagesbreite bleibt gleich, die übrigen Spalten behalten ihr Gewicht (A8). Andere Spaltenarten: unverändert.
 */
export function weightAtBoundary(
  columns: readonly Column[],
  index: number,
  x: number,
  dayWidth: number,
): ColumnWeight {
  const column = columns[index];
  if (column === undefined || column.kind !== 'planning') return column?.weight ?? 'normal';
  let best: ColumnWeight = column.weight;
  let distance = Number.POSITIVE_INFINITY;
  for (const weight of WEIGHTS) {
    const trial = columns.map((c, i) => (i === index ? { ...c, weight } : c));
    const box = columnBoxes(trial, dayWidth)[index];
    if (box === undefined) continue;
    const d = Math.abs(box.left + box.width - x);
    if (d < distance - 1e-9) {
      distance = d;
      best = weight;
    }
  }
  return best;
}

export function stepWeight(weight: ColumnWeight, direction: 1 | -1): ColumnWeight {
  const i = WEIGHTS.indexOf(weight) + direction;
  return WEIGHTS[Math.max(0, Math.min(WEIGHTS.length - 1, i))] as ColumnWeight;
}

/** Autoscroll (A4): 0 ausserhalb der Randzone, wachsend bis `max` px je Bild direkt am Rand. */
export function autoscrollSpeed(distance: number, zone = 40, max = 22): number {
  if (!Number.isFinite(distance) || distance >= zone) return 0;
  const closeness = Math.min(1, (zone - Math.max(0, distance)) / zone);
  return Math.max(1, Math.round(max * closeness * closeness));
}

/** Zeitschild am Zeiger: «Mo 05.10. · 0900-1000 · COBRA 10» (Spaltenbereich mit «–»). */
export function timeLabel(
  weekday: Weekday,
  date: IsoDate,
  from: number,
  to: number | null,
  columns: readonly string[],
): string {
  const day = `${weekday} ${formatDate(date, 'long').slice(0, 6)}`;
  const time = to === null ? formatMilTime(from) : `${formatMilTime(from)}-${formatMilTime(to)}`;
  const cols =
    columns.length === 0
      ? ''
      : columns.length === 1
        ? ` · ${columns[0]}`
        : ` · ${columns[0]}–${columns[columns.length - 1]}`;
  return `${day} · ${time}${cols}`;
}

import { addDays } from '../../../model/wap/calendar';
import { snap } from '../../../model/wap/time';
import type { Column, ColumnSelection, IsoDate } from '../../../model/wap/types';

export const MINUTE_HEIGHT = 0.8;
export const PLANNING_COLUMN_WIDTH = 120;
export const SPECIAL_COLUMN_WIDTH = 64;

export function snapMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) throw new RangeError('Die Zeit muss endlich sein.');
  return snap(minutes, 15);
}

export function columnsBetween(
  columns: readonly Column[],
  first: number,
  last: number,
): ColumnSelection {
  const placeable = columns.filter((c) => c.kind === 'planning' || c.kind === 'secondary');
  const from = Math.max(0, Math.min(first, last));
  const to = Math.min(placeable.length - 1, Math.max(first, last));
  return { kind: 'ids', ids: placeable.slice(from, to + 1).map((c) => c.id) };
}

export function drawingTime(first: number, last: number): { from: number; to: number } {
  const start = Math.max(0, Math.min(1425, snapMinutes(Math.min(first, last))));
  const end = Math.max(start + 15, Math.min(1440, snapMinutes(Math.max(first, last))));
  return { from: start, to: end };
}

/** Only converts pointer placement to a valid command input; the model owns dates and columns. */
export function moveAcrossDayBoundary(
  date: IsoDate,
  from: number,
  to: number,
  delta: number,
): { date: IsoDate; from: number; to: number } {
  const start = snapMinutes(from + delta);
  const offset = Math.floor(start / 1440);
  const normalized = start - offset * 1440;
  return { date: addDays(date, offset), from: normalized, to: normalized + (to - from) };
}

export function columnWidth(column: Column): number {
  return column.kind === 'planning' || column.kind === 'secondary'
    ? PLANNING_COLUMN_WIDTH
    : SPECIAL_COLUMN_WIDTH;
}

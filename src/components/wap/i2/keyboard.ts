// Zellzeiger und Tastaturwege im Raster (I2b-B B1; Beschrieb 6 «Tastatur», 11; UI-Richtlinie 13.3, 13.4).
// Rein: Bewegung des Zellzeigers (15-Min-Zeile × Spalte, über Tagesgrenzen), Bereich nach Shift+Pfeil,
// Namen für Screenreader und die Leserichtung der Einträge (Tag, Sortierzeit, Spalte).

import { formatDate } from '../../../model/wap/calendar';
import { formatMilTime } from '../../../model/wap/time';
import type { Column, IsoDate, Weekday } from '../../../model/wap/types';

/** Ein Tag, wie ihn der Zellzeiger braucht (Teil von DayBox). */
export interface CursorDay {
  readonly date: IsoDate;
  readonly weekday: Weekday;
  readonly columns: readonly { readonly column: Column }[];
}

/** Zelle des Zellzeigers: Tag, Beginn der 15-Min-Zeile, Index in den Spalten des Tages (alle Arten). */
export interface Cursor {
  readonly date: IsoDate;
  readonly minute: number;
  readonly column: number;
}

/** Zellbereich zwischen Anker und Zellzeiger (gleicher Tag; Spalten und Zeiten einschliesslich). */
export interface CellRange {
  readonly date: IsoDate;
  readonly from: number;
  readonly to: number;
  readonly firstColumn: number;
  readonly lastColumn: number;
}

export interface TimeBounds {
  readonly from: number;
  readonly to: number;
}

export const STEP = 15;

function clampMinute(minute: number, bounds: TimeBounds): number {
  const last = bounds.to - STEP;
  return Math.max(bounds.from, Math.min(last, Math.floor(minute / STEP) * STEP));
}

/** Gültiger Zellzeiger in den sichtbaren Tagen; fremder Tag → erster Tag, Spalte begrenzt. */
export function normalizeCursor(
  cursor: Cursor,
  days: readonly CursorDay[],
  bounds: TimeBounds,
): Cursor | null {
  const day = days.find((d) => d.date === cursor.date) ?? days[0];
  if (day === undefined || day.columns.length === 0) {
    const fallback = days.find((d) => d.columns.length > 0);
    if (fallback === undefined) return null;
    return { date: fallback.date, minute: clampMinute(cursor.minute, bounds), column: 0 };
  }
  return {
    date: day.date,
    minute: clampMinute(cursor.minute, bounds),
    column: Math.max(0, Math.min(day.columns.length - 1, cursor.column)),
  };
}

/** Anfangslage (UI-Richtlinie 13.4): Mo, erste Planungsspalte, 0800. */
export function initialCursor(days: readonly CursorDay[], bounds: TimeBounds): Cursor | null {
  const day = days.find((d) => d.columns.some((c) => c.column.kind === 'planning')) ?? days[0];
  if (day === undefined) return null;
  const column = Math.max(
    0,
    day.columns.findIndex((c) => c.column.kind === 'planning'),
  );
  return normalizeCursor({ date: day.date, minute: 480, column }, days, bounds);
}

/** Spalte gleichen Namens am anderen Tag, sonst gleicher Index (begrenzt). */
function columnOnDay(from: CursorDay, index: number, to: CursorDay): number {
  const name = from.columns[index]?.column.name;
  const same = to.columns.findIndex((c) => c.column.name === name);
  if (same >= 0) return same;
  return Math.max(0, Math.min(to.columns.length - 1, index));
}

export type CursorMove =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'pageUp'
  | 'pageDown'
  | 'home'
  | 'end'
  | 'nextDay'
  | 'previousDay';

/**
 * Neue Lage nach einer Taste: ←/→ eine Spalte (über die Tagesgrenze weiter), ↑/↓ 15 Min, Bild↑/↓ 1 Stunde,
 * Pos1/Ende Anfang/Ende des Anzeigebereichs, Ctrl+←/→ voriger/nächster Tag. `null` bei ↑ aus der ersten Zeile
 * (der Fokus geht dann zum Spaltenkopf).
 */
export function moveCursor(
  cursor: Cursor,
  move: CursorMove,
  days: readonly CursorDay[],
  bounds: TimeBounds,
): Cursor | null {
  const index = days.findIndex((d) => d.date === cursor.date);
  const day = days[index];
  if (day === undefined) return normalizeCursor(cursor, days, bounds);
  const last = bounds.to - STEP;
  const nextDayWith = (direction: 1 | -1): CursorDay | undefined => {
    for (let i = index + direction; i >= 0 && i < days.length; i += direction) {
      const d = days[i];
      if (d !== undefined && d.columns.length > 0) return d;
    }
    return undefined;
  };
  switch (move) {
    case 'up':
      return cursor.minute - STEP < bounds.from
        ? null
        : { ...cursor, minute: cursor.minute - STEP };
    case 'down':
      return { ...cursor, minute: Math.min(last, cursor.minute + STEP) };
    case 'pageUp':
      return { ...cursor, minute: Math.max(bounds.from, cursor.minute - 60) };
    case 'pageDown':
      return { ...cursor, minute: Math.min(last, cursor.minute + 60) };
    case 'home':
      return { ...cursor, minute: bounds.from };
    case 'end':
      return { ...cursor, minute: last };
    case 'left': {
      if (cursor.column > 0) return { ...cursor, column: cursor.column - 1 };
      const previous = nextDayWith(-1);
      return previous === undefined
        ? cursor
        : { ...cursor, date: previous.date, column: previous.columns.length - 1 };
    }
    case 'right': {
      if (cursor.column < day.columns.length - 1) return { ...cursor, column: cursor.column + 1 };
      const next = nextDayWith(1);
      return next === undefined ? cursor : { ...cursor, date: next.date, column: 0 };
    }
    case 'nextDay':
    case 'previousDay': {
      const other = nextDayWith(move === 'nextDay' ? 1 : -1);
      return other === undefined
        ? cursor
        : { ...cursor, date: other.date, column: columnOnDay(day, cursor.column, other) };
    }
  }
}

/** Bereich zwischen Anker und Zellzeiger; anderer Tag des Ankers → nur die Zelle des Zeigers. */
export function cellRange(cursor: Cursor, anchor: Cursor | null): CellRange {
  const a = anchor !== null && anchor.date === cursor.date ? anchor : cursor;
  return {
    date: cursor.date,
    from: Math.min(a.minute, cursor.minute),
    to: Math.max(a.minute, cursor.minute) + STEP,
    firstColumn: Math.min(a.column, cursor.column),
    lastColumn: Math.max(a.column, cursor.column),
  };
}

/** Kurzform «Mo 05.10.» */
export function dayLabel(weekday: Weekday, date: IsoDate): string {
  return `${weekday} ${formatDate(date, 'long').slice(0, 6)}`;
}

/**
 * Name des Zellzeigers (UI-Richtlinie 13.6): «Mo 05.10. 0900 COBRA 10, leer» bzw. «…, Block ‹Titel› 0900-1000»;
 * Bereich «Mo 05.10. 0900-1000 COBRA 10–COBRA 20, Bereich».
 */
export function cursorLabel(
  day: CursorDay,
  range: CellRange,
  occupant: { readonly type: string; readonly title: string; readonly time: string } | null,
): string {
  const first = day.columns[range.firstColumn]?.column.name ?? '';
  const last = day.columns[range.lastColumn]?.column.name ?? first;
  const single = range.to - range.from === STEP && range.firstColumn === range.lastColumn;
  const time = single
    ? formatMilTime(range.from)
    : `${formatMilTime(range.from)}-${formatMilTime(range.to)}`;
  const columns = range.firstColumn === range.lastColumn ? first : `${first}–${last}`;
  const where = `${dayLabel(day.weekday, day.date)} ${time} ${columns}`;
  if (!single) return `${where}, Bereich`;
  if (occupant === null) return `${where}, leer`;
  const title = occupant.title === '' ? '' : ` ${occupant.title}`;
  return `${where}, ${occupant.type}${title} ${occupant.time}`;
}

/** Ein Eintrag in Leserichtung. */
export interface ReadingItem {
  readonly id: string;
  readonly windowId: string | null;
  readonly date: IsoDate;
  readonly time: number;
  readonly left: number;
}

/** Schlüssel eines Eintrags (Beso je Zeitfenster). */
export function itemKey(item: { readonly id: string; readonly windowId: string | null }): string {
  return item.windowId === null ? item.id : `${item.id}:${item.windowId}`;
}

function compareItems(a: ReadingItem, b: ReadingItem): number {
  return a.date.localeCompare(b.date) || a.time - b.time || a.left - b.left;
}

/** Nächster bzw. vorheriger Eintrag nach dem Eintrag `from` (Schlüssel); null am Ende (Tab verlässt das Raster). */
export function adjacentItem(
  order: readonly ReadingItem[],
  from: string,
  direction: 1 | -1,
): ReadingItem | null {
  const index = order.findIndex((item) => itemKey(item) === from);
  if (index < 0) return null;
  return order[index + direction] ?? null;
}

/** Erster Eintrag nach (bzw. letzter vor) der Lage des Zellzeigers in Leserichtung. */
export function itemAfterCursor(
  order: readonly ReadingItem[],
  at: { readonly date: IsoDate; readonly time: number; readonly left: number },
  direction: 1 | -1,
): ReadingItem | null {
  const probe: ReadingItem = { id: '', windowId: null, ...at };
  if (direction > 0) return order.find((item) => compareItems(item, probe) >= 0) ?? null;
  return [...order].reverse().find((item) => compareItems(item, probe) < 0) ?? null;
}

/**
 * Delegat der Route an die Suite-Shell (UI-Richtlinie 18 S-3, ADR-001 «Tastatur»; Vertrag E1-11 §3): Die Shell fragt
 * zuerst `handles`; bei true führt sie nur `handle` aus und keine eigene Aktion.
 */
export interface RouteKeys {
  handles(event: KeyboardEvent): boolean;
  handle(event: KeyboardEvent): void;
}

/** Ziel ist ein Eingabefeld (Text, Auswahl) oder bearbeitbarer Inhalt. */
function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches('input,textarea,select') || target.isContentEditable === true)
  );
}

/**
 * Tasten, die auf /wap dem WAP-Planer gehören (UI-Richtlinie 13.2, 18 S-3, S-4): Ctrl+S (Plan-Datei), Ctrl+Z/Y und
 * Ctrl+Shift+Z (WAP-Historie, in Textfeldern natives Rückgängig), Ctrl+O, Ctrl+P, Ctrl+G, Ctrl+L, Ctrl+F, «?»,
 * Alt+Bild↑/↓; Ctrl+B nur während einer Textbearbeitung (dort nie die Suite-Seitenleiste). Ctrl+K und Alt+1–9
 * gehören nie dazu (Suite-Kürzel).
 */
export function ownsRouteKey(event: KeyboardEvent): boolean {
  const ctrl = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (ctrl && !event.altKey) {
    if (['s', 'z', 'y', 'o', 'p', 'g', 'l', 'f'].includes(key)) return true;
    return key === 'b' && typingIn(event.target);
  }
  if (event.altKey && !ctrl) return event.key === 'PageUp' || event.key === 'PageDown';
  return !event.altKey && event.key === '?';
}

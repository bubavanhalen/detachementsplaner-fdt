// Angaben zu Einträgen für die Befunde (Beschrieb 7): Woche, Tag, Spalten, Kurztitel, Ort in der Liste. Rein.

import { addDays, daysBetween, formatDate, isIsoDate, weekdayOf } from '../calendar';
import { resolveTitle } from '../derive/agenda';
import { markerLabel } from '../derive/marker';
import { formatMilTime, isMilTime, sortTime } from '../time';
import type { Column, DayConfig, Entry, Id, IsoDate, Plan, Week } from '../types';

const TITLE_LENGTH = 40;

/** Woche, deren Montag bis Sonntag das Datum enthält; sonst null. */
export function weekOf(plan: Plan, date: IsoDate): Week | null {
  if (!isIsoDate(date)) return null;
  for (const w of plan.weeks) {
    if (!isIsoDate(w.startDate)) continue;
    const offset = daysBetween(w.startDate, date);
    if (offset >= 0 && offset < 7) return w;
  }
  return null;
}

/** Tageseinstellung des Datums; null ausserhalb der Wochen. */
export function dayOf(plan: Plan, date: IsoDate): { week: Week; day: DayConfig } | null {
  const week = weekOf(plan, date);
  if (week === null) return null;
  const day = week.days[daysBetween(week.startDate, date)];
  return day === undefined ? null : { week, day };
}

/** Spalten des Spaltensatzes am Datum; ohne Spaltensatz oder ausserhalb der Wochen leer. */
export function columnsOn(plan: Plan, date: IsoDate): readonly Column[] {
  const d = dayOf(plan, date);
  if (d === null || d.day.columnSetId === null) return [];
  return plan.columnSets.find((s) => s.id === d.day.columnSetId)?.columns ?? [];
}

/** Name einer Spalte aus irgendeinem Spaltensatz; null, wenn es sie in keinem Satz mehr gibt. */
export function columnName(plan: Plan, id: Id): string | null {
  for (const set of plan.columnSets) {
    const c = set.columns.find((col) => col.id === id);
    if (c !== undefined) return c.name;
  }
  return null;
}

/** «Di 06.10.2026». */
export function dayText(date: IsoDate): string {
  return `${weekdayOf(date)} ${formatDate(date, 'long')}`;
}

/** Kurztitel: Titel, Kürzel, Marker-Beschriftung bzw. Text; über 40 Zeichen mit «…» gekürzt (nur in der Liste). */
export function entryTitle(plan: Plan, e: Entry): string {
  let text: string;
  switch (e.type) {
    case 'block':
    case 'querbalken':
    case 'beso':
      text = resolveTitle(plan, e.title)
        .map((r) => r.text)
        .join('');
      break;
    case 'rapport':
      text = e.code;
      break;
    case 'marker':
      text = isMilTime(e.at) ? markerLabel(e, plan) : e.kind === 'custom' ? e.customKind : e.kind;
      break;
    case 'dayRemark':
    case 'multiDayRemark':
      text = e.text;
      break;
  }
  const points = [...text.trim()];
  if (points.length === 0) return 'ohne Titel';
  return points.length > TITLE_LENGTH ? `${points.slice(0, TITLE_LENGTH).join('')}…` : text.trim();
}

/** Sortierzeit eines Eintrags in Minuten; null ohne Zeit. */
export function entryMinute(e: Entry): number | null {
  switch (e.type) {
    case 'block':
    case 'rapport':
      return sortTime(e.time);
    case 'marker':
      return e.at;
    case 'beso': {
      const times = e.windows.map((w) => sortTime(w.time));
      return times.length === 0 ? null : Math.min(...times);
    }
    default:
      return null;
  }
}

/** Datum eines Eintrags (Querbalken: erster Tag); null bei mehrtägigen Bemerkungen. */
export function entryDate(e: Entry): IsoDate | null {
  if (e.type === 'querbalken') return e.fromDate;
  if (e.type === 'multiDayRemark') return null;
  return e.date;
}

/** Ort für die Befundliste: «Di 06.10.2026 0800» bzw. ohne Zeit. */
export function placeOf(date: IsoDate | null, minute: number | null): string {
  if (date === null || !isIsoDate(date)) return '';
  const time =
    minute !== null && isMilTime(minute % 1440) ? ` ${formatMilTime(minute % 1440)}` : '';
  return `${dayText(date)}${time}`;
}

/** Tage eines Querbalkens (von–bis, höchstens 400). */
export function querbalkenDays(from: IsoDate, to: IsoDate): readonly IsoDate[] {
  if (!isIsoDate(from) || !isIsoDate(to)) return [];
  const n = Math.min(400, daysBetween(from, to));
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

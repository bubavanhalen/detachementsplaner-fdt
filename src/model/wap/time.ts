// Zeiten und Zeitformen (Vertrag E1-02a Abschnitt 3 und 8 P-4, P-5; Beschrieb 4.5, 4.6).

import { daysBetween, formatDate, isIsoDate, isoDateOf } from './calendar';
import { modelError } from './errors';
import type { IsoDate, MilTime, TimeSpec } from './types';

const DAY = 1440;
const MIL_TIME = /^(\d{2})(\d{2})$/;
const POINT = /^(\d{4})$/;
const RANGE = /^(\d{4})\s*-\s*(\d{4})$/;
const FROM = /^ab\s*(\d{4})$/i;
const UNTIL = /^bis\s*(\d{4})$/i;
const DEADLINE = /^bis\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?(?:\s+(\d{4}))?$/i;

/** Gültige Uhrzeit eines Tages: ganzzahlig, Vielfaches von 5, 0–1440 (Beschrieb 4.5). */
export function isMilTime(t: unknown): t is MilTime {
  return typeof t === 'number' && Number.isInteger(t) && t >= 0 && t <= DAY && t % 5 === 0;
}

/**
 * Prüft eine Zeitangabe zur Laufzeit (auch fehlende Felder trotz Typ): bekannte Zeitform, Zeiten auf
 * dem 5-Minuten-Raster, 'range' mit from < to ≤ from + 1440 (R-4.5-10).
 */
export function isValidTimeSpec(t: unknown): t is TimeSpec {
  if (typeof t !== 'object' || t === null) return false;
  const v = t as {
    readonly form?: unknown;
    readonly at?: unknown;
    readonly from?: unknown;
    readonly to?: unknown;
  };
  switch (v.form) {
    case 'point':
      return isMilTime(v.at);
    case 'from':
      return isMilTime(v.from);
    case 'until':
      return isMilTime(v.to);
    case 'deadline':
      return v.to === undefined || isMilTime(v.to);
    case 'range':
      return (
        isMilTime(v.from) &&
        typeof v.to === 'number' &&
        Number.isInteger(v.to) &&
        v.to % 5 === 0 &&
        v.to > v.from &&
        v.to <= v.from + DAY
      );
    default:
      return false;
  }
}

/** Genau vier Ziffern 'hhmm', 0000–2400; ModelError 'timeNotOnFiveMinutes' (F-18) bzw. 'invalidTime'. */
export function parseMilTime(s: string): MilTime {
  const match = MIL_TIME.exec(s);
  if (match === null) throw modelError('invalidTime');
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m >= 60 || (h === 24 && m > 0)) throw modelError('invalidTime');
  if (m % 5 !== 0) throw modelError('timeNotOnFiveMinutes');
  return h * 60 + m;
}

/** 0–2880; 1440 → '2400'; > 1440 → Uhrzeit des Folgetags; sonst ModelError 'invalidTime'. */
export function formatMilTime(t: MilTime): string {
  if (!Number.isInteger(t) || t < 0 || t > 2 * DAY) throw modelError('invalidTime');
  const v = t > DAY ? t - DAY : t;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}${String(v % 60).padStart(2, '0')}`;
}

/** Ergebnis von parseTimeSpec; deadlineDate nur bei Frist, sonst null. */
export interface ParsedTimeSpec {
  readonly time: TimeSpec;
  readonly deadlineDate: IsoDate | null;
}

/** Fristdatum ohne Jahr: aus Vorjahr, Jahr und Folgejahr von refDate das nächste, bei Gleichstand das spätere (P-4). */
function nearestDate(day: number, month: number, refDate: IsoDate): IsoDate {
  const year = Number(refDate.slice(0, 4));
  let best: IsoDate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const y of [year - 1, year, year + 1]) {
    const candidate = isoDateOf(y, month, day);
    if (candidate === null) continue;
    const distance = Math.abs(daysBetween(refDate, candidate));
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best === null) throw modelError('invalidDate');
  return best;
}

function parseDeadline(match: RegExpExecArray, refDate: IsoDate): ParsedTimeSpec {
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearText = match[3];
  const timeText = match[4];
  let deadlineDate: IsoDate;
  if (yearText === undefined) {
    deadlineDate = nearestDate(day, month, refDate);
  } else {
    // Jahr nur im Bezugsjahr ± 1; vier Ziffern ausserhalb sind meist eine Uhrzeit ohne Leerzeichen,
    // daher geht diese Prüfung der Kalenderprüfung vor (Änderungsnotiz N-4).
    const year = Number(yearText);
    if (Math.abs(year - Number(refDate.slice(0, 4))) > 1) throw modelError('invalidTime');
    const iso = isoDateOf(year, month, day);
    if (iso === null) throw modelError('invalidDate');
    deadlineDate = iso;
  }
  const time: TimeSpec =
    timeText === undefined
      ? { form: 'deadline' }
      : { form: 'deadline', to: parseMilTime(timeText) };
  return { time, deadlineDate };
}

/** '1130', '0900-1200', 'ab 1900', 'bis 1200', 'bis 21.10.', 'bis 21.10. 1200', 'bis 21.10.2026' (P-4). */
export function parseTimeSpec(s: string, refDate: IsoDate): ParsedTimeSpec {
  if (!isIsoDate(refDate)) throw modelError('invalidDate');
  const input = s.trim().replace(/–/g, '-');
  const point = POINT.exec(input);
  if (point !== null) {
    return { time: { form: 'point', at: parseMilTime(point[1] ?? '') }, deadlineDate: null };
  }
  const range = RANGE.exec(input);
  if (range !== null) {
    const from = parseMilTime(range[1] ?? '');
    const end = parseMilTime(range[2] ?? '');
    if (end === from) throw modelError('invalidTime');
    const to = end < from ? end + DAY : end;
    return { time: { form: 'range', from, to }, deadlineDate: null };
  }
  const fromMatch = FROM.exec(input);
  if (fromMatch !== null) {
    return { time: { form: 'from', from: parseMilTime(fromMatch[1] ?? '') }, deadlineDate: null };
  }
  const until = UNTIL.exec(input);
  if (until !== null) {
    return { time: { form: 'until', to: parseMilTime(until[1] ?? '') }, deadlineDate: null };
  }
  const deadline = DEADLINE.exec(input);
  if (deadline !== null) return parseDeadline(deadline, refDate);
  throw modelError('invalidTime');
}

/** Erfasste Form (R-4.6-37); date = Datum des Eintrags (Frist-Tag). */
export function formatTimeSpec(t: TimeSpec, date: IsoDate): string {
  switch (t.form) {
    case 'point':
      return formatMilTime(t.at);
    case 'range':
      return `${formatMilTime(t.from)}-${formatMilTime(t.to)}`;
    case 'from':
      return `ab ${formatMilTime(t.from)}`;
    case 'until':
      return `bis ${formatMilTime(t.to)}`;
    case 'deadline': {
      const day = formatDate(date, 'long').slice(0, 6);
      return t.to === undefined ? `bis ${day}` : `bis ${day} ${formatMilTime(t.to)}`;
    }
  }
}

/** Beginn; bei 'until' das Ende; Frist ohne Zeit → 0 (R-4.6-38, R-4.6-39). */
export function sortTime(t: TimeSpec): MilTime {
  switch (t.form) {
    case 'point':
      return t.at;
    case 'range':
    case 'from':
      return t.from;
    case 'until':
      return t.to;
    case 'deadline':
      return t.to ?? 0;
  }
}

/** Sortierzeit, dann Erfassungsreihenfolge (R-4.6-40). */
export function compareEntries(
  a: { readonly time: TimeSpec; readonly createdSeq: number },
  b: { readonly time: TimeSpec; readonly createdSeq: number },
): number {
  const byTime = sortTime(a.time) - sortTime(b.time);
  return byTime !== 0 ? byTime : a.createdSeq - b.createdSeq;
}

/** Nächste Rasterzeit, Math.round(t / step) * step (genau in der Mitte aufwärts). */
export function snap(t: number, step: 15 | 5): MilTime {
  // «+ 0» macht aus −0 eine 0 (Ziehen knapp vor 0000).
  return Math.round(t / step) * step + 0;
}

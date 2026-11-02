// Kalender (Vertrag E1-02a Abschnitt 3 und 8 P-13): Wochen ab Montag, ISO-Kalenderwoche, Datumsformate.
// Ungültiges IsoDate → ModelError 'invalidDate'. Rein: eigene Tagesrechnung ohne Date-Objekte,
// damit Zeitzone und Zeitumstellung keine Rolle spielen.

import { modelError } from './errors';
import type { IsoDate, Weekday } from './types';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SWISS_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

interface CivilDate {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

function isValidCivil(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Tage seit 1970-01-01 im proleptischen gregorianischen Kalender (Zählung in 400-Jahr-Zyklen). */
function toDayNumber(c: CivilDate): number {
  const y = c.m <= 2 ? c.y - 1 : c.y;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (c.m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + c.d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(n: number): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function toIso(c: CivilDate): IsoDate {
  return `${pad(c.y, 4)}-${pad(c.m, 2)}-${pad(c.d, 2)}`;
}

/** Zerlegt ein gültiges IsoDate; sonst null. */
function parseIso(d: unknown): CivilDate | null {
  if (typeof d !== 'string') return null;
  const match = ISO_DATE.exec(d);
  if (match === null) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const day = Number(match[3]);
  return isValidCivil(y, m, day) ? { y, m, d: day } : null;
}

function requireIso(d: IsoDate): CivilDate {
  const c = parseIso(d);
  if (c === null) throw modelError('invalidDate');
  return c;
}

/** Wochentag-Index 0 = Montag … 6 = Sonntag (1970-01-01 war ein Donnerstag). */
function weekdayIndex(dayNumber: number): number {
  return (((dayNumber + 3) % 7) + 7) % 7;
}

/** true, wenn d ein gültiges Kalenderdatum 'yyyy-mm-dd' ist (für Validierung und Ableitungen). */
export function isIsoDate(d: unknown): d is IsoDate {
  return parseIso(d) !== null;
}

/**
 * IsoDate aus Jahr, Monat und Tag; null, wenn eine Angabe keine ganze Zahl ist oder kein gültiges
 * Kalenderdatum mit vierstelligem Jahr entsteht (Änderungsnotiz N-5).
 */
export function isoDateOf(y: number, m: number, d: number): IsoDate | null {
  if (![y, m, d].every(Number.isInteger) || y < 0 || y > 9999) return null;
  return isValidCivil(y, m, d) ? toIso({ y, m, d }) : null;
}

/** Abstand in Tagen von a nach b (b − a); ungültiges Datum → ModelError 'invalidDate'. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return toDayNumber(requireIso(b)) - toDayNumber(requireIso(a));
}

export function isMonday(d: IsoDate): boolean {
  return weekdayIndex(toDayNumber(requireIso(d))) === 0;
}

/** Montag der Woche von d (d selbst, wenn Montag). */
export function previousMonday(d: IsoDate): IsoDate {
  const n = toDayNumber(requireIso(d));
  return toIso(fromDayNumber(n - weekdayIndex(n)));
}

/** n ganzzahlig, auch negativ; gebrochenes n ist ein Programmfehler (RangeError). */
export function addDays(d: IsoDate, n: number): IsoDate {
  const start = toDayNumber(requireIso(d));
  if (!Number.isInteger(n)) throw new RangeError('addDays: n muss ganzzahlig sein.');
  return toIso(fromDayNumber(start + n));
}

/** Sieben Daten Mo–So; kein Montag → ModelError 'startNotMonday' mit suggestion (R-4.2-02, F-15). */
export function weekDates(startDate: IsoDate): readonly IsoDate[] {
  const n = toDayNumber(requireIso(startDate));
  const wd = weekdayIndex(n);
  if (wd !== 0) {
    throw modelError('startNotMonday', { suggestion: toIso(fromDayNumber(n - wd)) });
  }
  return [0, 1, 2, 3, 4, 5, 6].map((i) => toIso(fromDayNumber(n + i)));
}

/** Kalenderwoche nach ISO 8601 (R-4.2-03): Woche des Donnerstags, gezählt ab der Woche mit dem 4. Januar. */
export function isoWeek(d: IsoDate): number {
  const n = toDayNumber(requireIso(d));
  const thursday = n - weekdayIndex(n) + 3;
  const year = fromDayNumber(thursday).y;
  return Math.floor((thursday - toDayNumber({ y: year, m: 1, d: 1 })) / 7) + 1;
}

export function weekdayOf(d: IsoDate): Weekday {
  return WEEKDAYS[weekdayIndex(toDayNumber(requireIso(d)))] as Weekday;
}

/** 'long' dd.mm.yyyy, 'compact' dd.mm.yy, 'file' yyyy-mm-dd. */
export function formatDate(d: IsoDate, form: 'long' | 'compact' | 'file'): string {
  const c = requireIso(d);
  if (form === 'file') return toIso(c);
  const year = form === 'long' ? pad(c.y, 4) : pad(c.y % 100, 2);
  return `${pad(c.d, 2)}.${pad(c.m, 2)}.${year}`;
}

/** 'd.m.yyyy' bis 'dd.mm.yyyy', Leerraum am Rand egal (P-13); sonst ModelError 'invalidDate'. */
export function parseSwissDate(s: string): IsoDate {
  const match = SWISS_DATE.exec(s.trim());
  const iso =
    match === null ? null : isoDateOf(Number(match[3]), Number(match[2]), Number(match[1]));
  if (iso === null) throw modelError('invalidDate');
  return iso;
}

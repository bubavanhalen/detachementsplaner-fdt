// Calendar arithmetic on ISO dates (YYYY-MM-DD) in UTC, so time zones and DST never shift a day.

const DAY_MS = 86_400_000;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function time(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}
export function addDays(value: string, days: number): string {
  return new Date(time(value) + days * DAY_MS).toISOString().slice(0, 10);
}
/** Whole days from `from` to `to`; negative when `to` lies before `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((time(to) - time(from)) / DAY_MS);
}
/** Today as a local calendar date, not the UTC date. */
export function today(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
/** True when `day` lies within [von, bis]; an open end counts as unbounded. */
export function within(day: string, von: string, bis: string): boolean {
  return (!von || day >= von) && (!bis || day <= bis);
}
/** True when the two ranges share at least one day; open ends count as unbounded. */
export function overlaps(aVon: string, aBis: string, bVon: string, bBis: string): boolean {
  return (!aBis || !bVon || bVon <= aBis) && (!bBis || !aVon || aVon <= bBis);
}

/**
 * Reads a date as typed in a list: «24.03.1999», «4.3.99», «1999-03-24» or the
 * spreadsheet default «3/24/99» (month first). Returns '' when it is not a date.
 */
export function parseListDate(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(clean);
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/.exec(clean);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/.exec(clean);
  let parts: [string, string, string] | null = null;
  if (iso) parts = [iso[1], iso[2], iso[3]];
  else if (swiss) parts = [swiss[3], swiss[2], swiss[1]];
  else if (us) parts = [us[3], us[1], us[2]];
  if (!parts) return '';
  let [year, month, day] = parts;
  if (year.length === 2) {
    // Two-digit years: up to the current year's last two digits means 20xx.
    const short = Number(year),
      current = new Date().getFullYear() % 100;
    year = String(short <= current ? 2000 + short : 1900 + short);
  }
  const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isIsoDate(result) ? result : '';
}

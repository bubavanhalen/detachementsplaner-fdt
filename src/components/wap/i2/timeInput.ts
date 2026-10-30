// Tolerante Eingabe von Zeiten und Daten (I2b-B B7; Beschrieb 11 «Zeiten militärisch», UI-Richtlinie 12 «Zeit»,
// «Startdatum»). Rein. Meldungen nennen Feld, Ursache und ein Beispiel.

import {
  formatDate,
  isMonday,
  isoDateOf,
  previousMonday,
  weekdayOf,
} from '../../../model/wap/calendar';
import type { IsoDate, Weekday } from '../../../model/wap/types';

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

/**
 * «900», «0900», «9:00», «9», «09.00» → 540 (Minuten). 0000–2400, nur auf 5 Minuten (F-18).
 * `field` ist der Name des Felds in der Meldung («Beginn»).
 */
export function parseTimeInput(input: string, field: string): ParseResult<number> {
  const text = input.trim();
  if (text === '')
    return { ok: false, message: `«${field}» ist leer. Eine Zeit eingeben, zum Beispiel 0900.` };
  const match =
    /^(\d{1,2})$/.exec(text) ??
    /^(\d{1,2})[:.](\d{2})$/.exec(text) ??
    /^(\d{1,2})(\d{2})$/.exec(text);
  if (match === null)
    return {
      ok: false,
      message: `«${field}»: «${text}» ist keine Zeit. Die Zeit als 0900, 900 oder 9:00 eingeben.`,
    };
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (hours > 24 || minutes >= 60 || (hours === 24 && minutes > 0))
    return {
      ok: false,
      message: `«${field}»: «${text}» liegt nicht zwischen 0000 und 2400. Eine Zeit wie 0830 eingeben.`,
    };
  if (minutes % 5 !== 0) {
    const lower = minutes - (minutes % 5);
    const pad = (m: number) =>
      `${String(hours + Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
    return {
      ok: false,
      message: `«${field}»: «${text}» liegt nicht im 5-Minuten-Raster. Zeiten auf 5 Minuten eingeben, zum Beispiel ${pad(lower)} oder ${pad(lower + 5)}.`,
    };
  }
  return { ok: true, value: hours * 60 + minutes };
}

/** «dd.mm.yyyy» (auch d.m.yyyy) oder ISO «yyyy-mm-dd» → IsoDate. */
export function parseDateInput(input: string, field: string): ParseResult<IsoDate> {
  const text = input.trim();
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date =
    swiss !== null
      ? isoDateOf(Number(swiss[3]), Number(swiss[2]), Number(swiss[1]))
      : iso !== null
        ? isoDateOf(Number(iso[1]), Number(iso[2]), Number(iso[3]))
        : null;
  if (date === null)
    return {
      ok: false,
      message:
        text === ''
          ? `«${field}» ist leer. Ein Datum eingeben, zum Beispiel 28.09.2026.`
          : `«${field}»: «${text}» ist kein Datum. Das Datum als dd.mm.yyyy eingeben, zum Beispiel 28.09.2026.`,
    };
  return { ok: true, value: date };
}

/** Hinweis bei einem Startdatum, das kein Montag ist (UI-Richtlinie 12 «Startdatum», F-15). */
export function mondayHint(
  date: IsoDate,
): { readonly text: string; readonly monday: IsoDate } | null {
  if (isMonday(date)) return null;
  const monday = previousMonday(date);
  return {
    text: `Der ${formatDate(date, 'long')} ist ein ${WEEKDAY_NAMES[weekdayOf(date)]}. Wochen beginnen am Montag.`,
    monday,
  };
}

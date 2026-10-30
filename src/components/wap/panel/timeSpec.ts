// Zeitangaben im Seitenfeld (Beschrieb 4.6 «Zeitformen»): «0900», «0900-1200», «ab 1900», «bis 1200», «bis 21.10.»;
// Uhrzeiten auch tolerant wie «9», «900», «9:00» (I2b-B B7). Meldungen nennen Feld, Ursache und Beispiel (F-18).

import { parseTimeSpec } from '../../../model/wap/time';
import type { IsoDate, TimeForm, TimeSpec } from '../../../model/wap/types';
import { parseTimeInput } from '../i2/timeInput';

const FORM_NAMES: Readonly<Record<TimeForm, string>> = {
  point: 'Zeitpunkt',
  range: 'von–bis',
  from: 'ab',
  until: 'bis',
  deadline: 'Frist',
};

/** Ergebnis von parseSpec; `deadlineDate` = Datum einer Frist (FA2-03), sonst null. */
export type SpecResult =
  | { readonly ok: true; readonly value: TimeSpec; readonly deadlineDate: IsoDate | null }
  | { readonly ok: false; readonly message: string };

/**
 * Zeitangabe aus Text; `forms` begrenzt die erlaubten Zeitformen (Rapport: Zeitpunkt oder von–bis, F-04). Bei einer
 * Frist mit Datum liefert `deadlineDate` das eingegebene Datum (nie still verworfen, FA2-03).
 */
export function parseSpec(
  input: string,
  date: IsoDate,
  field: string,
  forms: readonly TimeForm[],
): SpecResult {
  const text = input.trim().replace(/–/g, '-');
  const allowed = forms.map((f) => FORM_NAMES[f]).join(', ');
  const example = forms.includes('range') ? '0900-1200' : '0900';
  if (text === '')
    return {
      ok: false,
      message: `«${field}» ist leer. Eine Zeit eingeben, zum Beispiel ${example}.`,
    };
  let spec: TimeSpec | null = null;
  let deadlineDate: IsoDate | null = null;
  const range = /^([0-9:.]{1,5})\s*-\s*([0-9:.]{1,5})$/.exec(text);
  const from = /^ab\s+([0-9:.]{1,5})$/i.exec(text);
  const until = /^bis\s+([0-9:.]{1,5})$/i.exec(text);
  if (range !== null) {
    const a = parseTimeInput(range[1] ?? '', field);
    if (!a.ok) return a;
    const b = parseTimeInput(range[2] ?? '', field);
    if (!b.ok) return b;
    if (a.value === b.value)
      return {
        ok: false,
        message: `«${field}»: Beginn und Ende sind gleich. Ein späteres Ende eingeben, zum Beispiel ${example}.`,
      };
    spec = { form: 'range', from: a.value, to: b.value < a.value ? b.value + 1440 : b.value };
  } else if (from !== null) {
    const a = parseTimeInput(from[1] ?? '', field);
    if (!a.ok) return a;
    spec = { form: 'from', from: a.value };
  } else if (until !== null) {
    const a = parseTimeInput(until[1] ?? '', field);
    if (!a.ok) return a;
    spec = { form: 'until', to: a.value };
  } else if (/^[0-9:.]{1,5}$/.test(text)) {
    const a = parseTimeInput(text, field);
    if (!a.ok) return a;
    spec = { form: 'point', at: a.value };
  } else {
    try {
      const parsed = parseTimeSpec(text, date);
      spec = parsed.time;
      deadlineDate = parsed.deadlineDate;
    } catch {
      return {
        ok: false,
        message: `«${field}»: «${text}» ist keine Zeitangabe. Erlaubt: ${allowed}, zum Beispiel ${example}.`,
      };
    }
  }
  if (!forms.includes(spec.form))
    return {
      ok: false,
      message: `«${field}»: Die Zeitform «${FORM_NAMES[spec.form]}» ist hier nicht möglich. Erlaubt: ${allowed}, zum Beispiel ${example}.`,
    };
  return { ok: true, value: spec, deadlineDate };
}

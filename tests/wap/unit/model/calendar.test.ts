// @vitest-environment jsdom
// Kalender (Vertrag E1-02a Abschnitt 3 calendar.ts, 8 P-13; Beschrieb 4.2).
import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDate,
  isMonday,
  isoWeek,
  parseSwissDate,
  previousMonday,
  weekDates,
  weekdayOf,
} from '../../../../src/model/wap/calendar';
import { expectModelError } from '../../support/model/builders';

describe('Kalender', () => {
  it('[R-4.2-03] KVK-Woche: Start 28.09.2026 ergibt sieben Daten Mo–So bis 04.10.2026, Samstag 03.10.2026', () => {
    const dates = weekDates('2026-09-28');
    expect(dates).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(dates[5]).toBe('2026-10-03');
    expect(weekdayOf(dates[5] as string)).toBe('Sa');
  });

  it('[R-4.2-03] Kalenderwoche nach ISO 8601: 28.09.2026 → KW 40, alle Tage der Woche dieselbe KW', () => {
    expect(isoWeek('2026-09-28')).toBe(40);
    expect(isoWeek('2026-10-04')).toBe(40);
    expect(isoWeek('2026-10-05')).toBe(41);
  });

  it('[R-4.2-03] Jahreswechsel: Start 28.12.2026 → KW 53, Ende 03.01.2027 noch KW 53, 04.01.2027 KW 1', () => {
    expect(isoWeek('2026-12-28')).toBe(53);
    const dates = weekDates('2026-12-28');
    expect(dates[6]).toBe('2027-01-03');
    expect(isoWeek('2027-01-03')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
  });

  it('[R-4.2-03] Grenzfälle ISO-Woche: 01.01.2026 (Do) → KW 1, 29.12.2025 (Mo) → KW 1, 01.01.2027 (Fr) → KW 53', () => {
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2025-12-29')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53);
  });

  it('[R-4.2-03] Wochentage: 28.09.2026 Mo, 01.10.2026 Do, 04.10.2026 So, 29.02.2028 Di', () => {
    expect(weekdayOf('2026-09-28')).toBe('Mo');
    expect(weekdayOf('2026-10-01')).toBe('Do');
    expect(weekdayOf('2026-10-04')).toBe('So');
    expect(weekdayOf('2028-02-29')).toBe('Di');
  });

  it('[R-4.2-03] addDays über Monats-, Jahres- und Zeitumstellungsgrenze, auch negativ', () => {
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-09-28', 0)).toBe('2026-09-28');
    expect(addDays('2026-09-28', -7)).toBe('2026-09-21');
  });

  it('[R-4.2-02] isMonday: 28.09.2026 ja, 29.09.2026 und 04.10.2026 nein', () => {
    expect(isMonday('2026-09-28')).toBe(true);
    expect(isMonday('2026-09-29')).toBe(false);
    expect(isMonday('2026-10-04')).toBe(false);
  });

  it('[R-4.2-02] previousMonday: Montag bleibt, Dienstag und Sonntag ergeben den Montag derselben Woche', () => {
    expect(previousMonday('2026-09-28')).toBe('2026-09-28');
    expect(previousMonday('2026-09-29')).toBe('2026-09-28');
    expect(previousMonday('2026-10-04')).toBe('2026-09-28');
    expect(previousMonday('2027-01-02')).toBe('2026-12-28');
  });

  it('[R-4.2-02] (F-15) Startdatum Dienstag → startNotMonday mit Vorschlag des vorangehenden Montags und festem Wortlaut', () => {
    const err = expectModelError(() => weekDates('2026-09-29'), {
      code: 'startNotMonday',
      suggestion: '2026-09-28',
    });
    expect(err.userMessage.cause).toBe('Das Startdatum ist kein Montag.');
    expect(err.userMessage.nextStep).toBe('Den vorgeschlagenen Montag 28.09.2026 übernehmen.');
  });

  it('[R-4.2-02] (F-15) Startdatum Sonntag 04.10.2026 → Vorschlag 28.09.2026; Montag wird angenommen', () => {
    expectModelError(() => weekDates('2026-10-04'), {
      code: 'startNotMonday',
      suggestion: '2026-09-28',
    });
    expect(weekDates('2026-10-05')).toHaveLength(7);
  });

  it('[R-4.2-03] formatDate: lang dd.mm.yyyy, kompakt dd.mm.yy, Datei yyyy-mm-dd', () => {
    expect(formatDate('2026-09-28', 'long')).toBe('28.09.2026');
    expect(formatDate('2026-10-03', 'compact')).toBe('03.10.26');
    expect(formatDate('2026-10-03', 'file')).toBe('2026-10-03');
  });

  it('[R-4.2-03] parseSwissDate: ein- und zweistellige Tage und Monate, Leerraum am Rand', () => {
    expect(parseSwissDate('28.09.2026')).toBe('2026-09-28');
    expect(parseSwissDate('1.2.2027')).toBe('2027-02-01');
    expect(parseSwissDate('  3.10.2026 ')).toBe('2026-10-03');
    expect(parseSwissDate('29.02.2028')).toBe('2028-02-29');
  });

  it('[R-4.2-03] parseSwissDate: ungültige Eingaben → invalidDate', () => {
    for (const s of [
      '30.02.2026',
      '29.02.2026',
      '28.13.2026',
      '0.09.2026',
      '28.09.26',
      '28-09-2026',
      '',
      'Montag',
    ]) {
      expectModelError(() => parseSwissDate(s), { code: 'invalidDate' });
    }
  });

  it('[R-4.2-03] Kalenderfunktionen mit ungültigem IsoDate → invalidDate', () => {
    const invalid = ['2026-02-30', '2026-9-28', '28.09.2026', '2026-13-01', ''];
    for (const d of invalid) {
      expectModelError(() => weekDates(d), { code: 'invalidDate' });
      expectModelError(() => isoWeek(d), { code: 'invalidDate' });
      expectModelError(() => weekdayOf(d), { code: 'invalidDate' });
      expectModelError(() => addDays(d, 1), { code: 'invalidDate' });
      expectModelError(() => isMonday(d), { code: 'invalidDate' });
      expectModelError(() => previousMonday(d), { code: 'invalidDate' });
      expectModelError(() => formatDate(d, 'long'), { code: 'invalidDate' });
    }
  });
});

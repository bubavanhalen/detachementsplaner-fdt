// @vitest-environment jsdom
// Vertrag E1-07 §2b: Wochentag aus Kopftexten (weekdayOfText, SHEET_WEEKDAYS).
import { describe, expect, it } from 'vitest';
import { SHEET_WEEKDAYS, type SheetWeekday, weekdayOfText } from '../../../../src/io/xlsx-drawing';

describe('xlsx-drawing weekday (Vertrag E1-07 §2b)', () => {
  const accepted: [string, SheetWeekday][] = [
    // Abnahmefälle des Vertrags
    ['Montag', 'Mo'],
    ['MO', 'Mo'],
    ['  di', 'Di'],
    ['Sa 03.10.26', 'Sa'],
    ['Fr.', 'Fr'],
    ['Do,', 'Do'],
    ['So:', 'So'],
    ['Mo28', 'Mo'],
    ['Sonntag', 'So'],
    // Grenzfälle derselben Regel
    ['Dienstag', 'Di'],
    ['mittwoch', 'Mi'],
    ['DONNERSTAG', 'Do'],
    ['Freitag 02.10.2026', 'Fr'],
    ['Samstag,', 'Sa'],
    ['\tMi 5', 'Mi'],
    ['Mittwoch1', 'Mi'],
    ['Di\n', 'Di'],
  ];
  it.each(accepted)('[R-L-11] (§2b positiv) weekdayOfText(%j) ergibt %s', (text, day) => {
    expect(weekdayOfText(text)).toBe(day);
  });

  const rejected = [
    // Abnahmefälle des Vertrags
    'Mob',
    'Dorf',
    'Woche',
    '',
    'Zeit',
    // Grenzfälle: falsches Folgezeichen, Name nicht am Anfang, nur Leerraum
    'Montagabend',
    'Sonne',
    'Mon',
    'x Mo',
    '   ',
    'Mo-Fr',
    'Fr;',
  ];
  it.each(rejected)('[R-L-11] (§2b negativ) weekdayOfText(%j) ergibt null', (text) => {
    expect(weekdayOfText(text)).toBeNull();
  });

  it('[R-L-11] (§2b) SHEET_WEEKDAYS ist Mo … So, eingefroren, und jedes Kürzel wird erkannt', () => {
    const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    expect(names.map((name) => weekdayOfText(name))).toEqual(SHEET_WEEKDAYS);
    expect(SHEET_WEEKDAYS.map((day) => weekdayOfText(day))).toEqual(SHEET_WEEKDAYS);
    expect(SHEET_WEEKDAYS).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(Object.isFrozen(SHEET_WEEKDAYS)).toBe(true);
  });
});

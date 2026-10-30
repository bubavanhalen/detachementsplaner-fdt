// @vitest-environment jsdom
// Direkte Tests der vertraglich übernommenen Hilfsexporte und der Sammelnotiz (Vertrag E1-02a,
// Änderungsnotiz Code-Review Runde 1, N-6 (1) und (6); Test-Review TR-E102a-25). Alle Daten fiktiv.
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isIsoDate } from '../../../../src/model/wap/calendar';
import { resolveTitle } from '../../../../src/model/wap/derive/agenda';
import { requireWeek } from '../../../../src/model/wap/derive/columns';
import { entriesOnDate } from '../../../../src/model/wap/derive/entries';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { ModelError, modelError } from '../../../../src/model/wap/errors';
import { formatTimeSpec, isMilTime, isValidTimeSpec } from '../../../../src/model/wap/time';
import type { Block, ColumnSet, RichText } from '../../../../src/model/wap/types';
import { checkEntryStructure, validateColumnSet } from '../../../../src/model/wap/validate';
import {
  basePlan,
  beso,
  block,
  col,
  expectModelError,
  marker,
  multiDayRemark,
  withEntries,
  without,
} from '../../support/model/builders';

const plan = basePlan();

describe('N-6 (1) Hilfsexporte calendar.ts', () => {
  it('[R-4.2-03] daysBetween: b − a, auch negativ und über den Jahreswechsel; ungültig → invalidDate', () => {
    expect(daysBetween('2026-09-28', '2026-10-04')).toBe(6);
    expect(daysBetween('2026-10-04', '2026-09-28')).toBe(-6);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-10-04', '2026-10-04')).toBe(0);
    expectModelError(() => daysBetween('2026-02-30', '2026-10-04'), { code: 'invalidDate' });
    expectModelError(() => daysBetween('2026-10-04', '04.10.2026'), { code: 'invalidDate' });
  });

  it('[R-4.2-03] isIsoDate: nur gültige Kalenderdaten «yyyy-mm-dd»', () => {
    expect(isIsoDate('2026-10-04')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-1-4')).toBe(false);
    expect(isIsoDate('04.10.2026')).toBe(false);
    expect(isIsoDate(20261004)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('N-6 (1) Hilfsexporte time.ts', () => {
  it('[R-4.5-09] isMilTime: ganzzahlig, Vielfaches von 5, 0–1440', () => {
    for (const t of [0, 5, 830, 1435, 1440]) expect(isMilTime(t)).toBe(true);
    for (const t of [-5, 1445, 832, 7.5, Number.NaN, '0830', null])
      expect(isMilTime(t)).toBe(false);
  });

  it('[R-4.6-35] isValidTimeSpec: bekannte Zeitform, Raster, range from < to ≤ from + 1440', () => {
    expect(isValidTimeSpec({ form: 'point', at: 810 })).toBe(true);
    expect(isValidTimeSpec({ form: 'range', from: 540, to: 720 })).toBe(true);
    expect(isValidTimeSpec({ form: 'range', from: 1380, to: 1500 })).toBe(true);
    expect(isValidTimeSpec({ form: 'range', from: 540, to: 540 + 1440 })).toBe(true);
    expect(isValidTimeSpec({ form: 'range', from: 540, to: 540 + 1445 })).toBe(false);
    expect(isValidTimeSpec({ form: 'range', from: 720, to: 720 })).toBe(false);
    expect(isValidTimeSpec({ form: 'range', from: 720, to: 540 })).toBe(false);
    expect(isValidTimeSpec({ form: 'from', from: 1140 })).toBe(true);
    expect(isValidTimeSpec({ form: 'until', to: 1442 })).toBe(false);
    expect(isValidTimeSpec({ form: 'deadline' })).toBe(true);
    expect(isValidTimeSpec({ form: 'deadline', to: 720 })).toBe(true);
    expect(isValidTimeSpec({ form: 'deadline', to: 721 })).toBe(false);
    expect(isValidTimeSpec({ form: 'sofort', at: 810 })).toBe(false);
    expect(isValidTimeSpec(null)).toBe(false);
  });
});

describe('N-6 (1) Hilfsexporte errors.ts, validate.ts, derive/columns.ts', () => {
  it('[R-4.5-09] modelError ohne Meldung: Katalogmeldung mit festem Wortlaut; mit Meldung: diese', () => {
    const e = modelError('timeNotOnFiveMinutes');
    expect(e).toBeInstanceOf(ModelError);
    expect(e.code).toBe('timeNotOnFiveMinutes');
    expect(e.userMessage.cause).toBe('Zeiten sind auf 5 Minuten genau, z.B. 0830 oder 0835.');
    expect(e.field).toBeNull();
    const eigene = { cause: 'Fiktive Ursache.', nextStep: 'Fiktiver Schritt.' };
    const m = modelError('invalidEntry', { field: 'date' }, eigene);
    expect(m.userMessage).toEqual(eigene);
    expect(m.field).toBe('date');
  });

  it('[R-4.2-02] modelError startNotMonday: fester Wortlaut mit Vorschlag', () => {
    const e = modelError('startNotMonday', { suggestion: '2026-09-28' });
    expect(e.suggestion).toBe('2026-09-28');
    expect(e.userMessage).toEqual({
      cause: 'Das Startdatum ist kein Montag.',
      nextStep: 'Den vorgeschlagenen Montag 28.09.2026 übernehmen.',
    });
  });

  it('[R-4.6-01] checkEntryStructure: Regeln der Fabriken ohne Plan-Bezüge, Befunde in Feldreihenfolge', () => {
    expect(checkEntryStructure(block('e1', 1, { categoryId: 'k99' }))).toEqual([]);
    const ohneZeit = block('e1', 1, { columns: { kind: 'ids', ids: [] } });
    const issues = checkEntryStructure(without(ohneZeit, 'time') as Block);
    expect(issues.map((i) => [i.code, i.field])).toEqual([
      ['missingField', 'time'],
      ['emptyColumns', 'columns'],
    ]);
    expect(
      checkEntryStructure(block('e1', 1, { date: '2026-02-30', categoryId: '' })).map((i) => [
        i.code,
        i.field,
      ]),
    ).toEqual([
      ['invalidDate', 'date'],
      ['missingField', 'categoryId'],
    ]);
  });

  it('[R-4.3-01] requireWeek: vorhandene Woche; unbekannte → unknownWeek', () => {
    expect(requireWeek(plan, 'w27').startDate).toBe('2026-10-05');
    expectModelError(() => requireWeek(plan, 'w99'), { code: 'unknownWeek' });
  });
});

describe('N-6 (6) Sammelnotiz', () => {
  it('[R-4.2-03] addDays mit nicht ganzzahligem n → RangeError; ganzzahlig gültig', () => {
    expect(() => addDays('2026-10-04', 1.5)).toThrow(RangeError);
    expect(() => addDays('2026-10-04', Number.NaN)).toThrow(RangeError);
    expect(addDays('2026-10-04', -6)).toBe('2026-09-28');
  });

  it('[R-4.6-37] formatTimeSpec prüft das Datum nur bei Frist', () => {
    expect(formatTimeSpec({ form: 'point', at: 810 }, 'kein Datum')).toBe('1330');
    expect(formatTimeSpec({ form: 'range', from: 540, to: 720 }, '2026-02-30')).toBe('0900-1200');
    expect(formatTimeSpec({ form: 'deadline' }, '2026-10-21')).toBe('bis 21.10.');
    expectModelError(() => formatTimeSpec({ form: 'deadline' }, 'kein Datum'), {
      code: 'invalidDate',
    });
  });

  it('[R-4.8-04] resolveTitle: Läufe ohne Beso-Verweis mit gleichem Text und gleicher Stärke', () => {
    const p = withEntries(plan, [beso('e5', 1, { besoNumber: 21 })]);
    const title: RichText = [
      { text: ' Vorrevisionen ', bold: true },
      { text: '', bold: false },
      { text: 'siehe ', bold: false },
      { text: '', bold: false, besoRef: 'e5' },
    ];
    expect(resolveTitle(p, title)).toEqual([
      { text: ' Vorrevisionen ', bold: true },
      { text: '', bold: false },
      { text: 'siehe ', bold: false },
      { text: '(21)', bold: false },
    ]);
  });

  it('[R-4.6-40] entriesOnDate: bei gleicher Erfassungsnummer bleibt die Reihenfolge der Einträge im Plan', () => {
    const b = block('e2', 5, { date: '2026-09-29' });
    const m = marker('e1', 5, { date: '2026-09-29' });
    expect(entriesOnDate(withEntries(plan, [b, m]), '2026-09-29').map((e) => e.id)).toEqual([
      'e2',
      'e1',
    ]);
    expect(entriesOnDate(withEntries(plan, [m, b]), '2026-09-29').map((e) => e.id)).toEqual([
      'e1',
      'e2',
    ]);
  });

  it('[R-4.2-10] remarksForWeek: bei gleicher Nummer und Erfassungsnummer bleibt die Reihenfolge im Plan', () => {
    const a = multiDayRemark('e8', 3, { number: 2 });
    const b = multiDayRemark('e7', 3, { number: 2 });
    expect(remarksForWeek(withEntries(plan, [a, b]), 'w26').map((r) => r.id)).toEqual(['e8', 'e7']);
    expect(remarksForWeek(withEntries(plan, [b, a]), 'w26').map((r) => r.id)).toEqual(['e7', 'e8']);
  });

  it('[R-4.4-09] duplicateColumnId: ein Befund je weiteres Vorkommen', () => {
    const s: ColumnSet = {
      id: 's1',
      name: 'Fiktiv',
      columns: [
        col('c1', 'Zug 1', 'planning'),
        col('c1', 'Zug 1', 'planning'),
        col('c1', 'Zug 1', 'planning'),
        col('c2', 'Rap', 'rap'),
        col('c3', 'Beso', 'beso'),
      ],
    };
    expect(
      validateColumnSet(s)
        .filter((i) => i.code === 'duplicateColumnId')
        .map((i) => i.field),
    ).toEqual(['columns[1]', 'columns[2]']);
  });
});

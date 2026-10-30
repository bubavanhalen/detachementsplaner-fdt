// @vitest-environment jsdom
// Nachtragstests nach Code-Review E1-02a Runde 1 (Vertrag E1-02a, Änderungsnotiz Code-Review Runde 1,
// N-1 bis N-6 und Entscheid zu TR-E102a-28/-29; CR-E102a-01 bis -06, -10; Test-Review TR-E102a-21
// bis -29). Alle Daten fiktiv. Leerraum im Sinne von N-2/N-3 umfasst U+00A0 (geschütztes Leerzeichen).
import { describe, expect, it } from 'vitest';
import { isoDateOf } from '../../../../src/model/wap/calendar';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import { agendaLine } from '../../../../src/model/wap/derive/agenda';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { ModelError } from '../../../../src/model/wap/errors';
import {
  createPlanFromTemplate,
  newBeso,
  newMarker,
  newMultiDayRemark,
  newQuerbalken,
  newRapport,
} from '../../../../src/model/wap/factories';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import { parseTimeSpec } from '../../../../src/model/wap/time';
import type { Beso, MarkerKind, Querbalken, RemarkScope } from '../../../../src/model/wap/types';
import {
  type ValidationIssue,
  validateEntry,
  validateEntryPlacement,
} from '../../../../src/model/wap/validate';
import {
  basePlan,
  beso,
  besoInput,
  catchError,
  days,
  expectModelError,
  marker,
  markerInput,
  multiDayRemark,
  multiDayRemarkInput,
  plain,
  querbalken,
  querbalkenInput,
  rapport,
  rapportInput,
  rt,
  week,
  win,
  withEntries,
  without,
} from '../../support/model/builders';

/** Wochen von basePlan: w26 ab 28.09.2026, w27 ab 05.10.2026, w28 ab 12.10.2026 (Mo–Di «KVK Stufen»
 *  c8–c13, Rap c14, Beso c15; Mi–Fr «KVK Mi–Fr» c17–c19, Rap c20, Beso c21; Sa–So «Wochenende
 *  kompakt» c23, Rap c24, Beso c25). */
const plan = basePlan();

/** Geschütztes Leerzeichen U+00A0 (TR-E102a-29). */
const NBSP = ' ';

function codes(issues: readonly ValidationIssue[]): [string, string][] {
  return issues.map((i) => [i.code, i.field]);
}

function qb(over: Partial<Querbalken>): Querbalken {
  return querbalken('e1', 1, over);
}

describe('N-1 Querbalken-Platzierung in validateEntry (CR-E102a-01, P-10)', () => {
  it('[R-4.4-06] Querbalken mit Ziel Rap-Spalte an einem Tag einer Woche → invalidPlacement (columns)', () => {
    const e = qb({
      fromDate: '2026-09-28',
      toDate: '2026-09-29',
      columns: { kind: 'ids', ids: ['c8', 'c14'] },
    });
    expect(codes(validateEntry(plan, e))).toEqual([['invalidPlacement', 'columns']]);
  });

  it('[R-4.4-07] Querbalken mit Ziel Beso-Spalte → invalidPlacement (columns)', () => {
    const e = qb({
      fromDate: '2026-09-28',
      toDate: '2026-09-28',
      columns: { kind: 'ids', ids: ['c15'] },
    });
    expect(codes(validateEntry(plan, e))).toEqual([['invalidPlacement', 'columns']]);
  });

  it('[R-4.4-06] Prüfung je Tag mit dem Spaltensatz des Tages: Rap-Spalte c20 erst am Mittwoch', () => {
    // Mo–Di kennen c20 nicht (unbekannte ID ist kein Befund); Mi (Mi–Fr) führt c20 als Rap-Spalte.
    const bisMi = qb({
      fromDate: '2026-09-28',
      toDate: '2026-09-30',
      columns: { kind: 'ids', ids: ['c20'] },
    });
    expect(codes(validateEntry(plan, bisMi))).toEqual([['invalidPlacement', 'columns']]);
    const bisDi = qb({
      fromDate: '2026-09-28',
      toDate: '2026-09-29',
      columns: { kind: 'ids', ids: ['c20'] },
    });
    expect(validateEntry(plan, bisDi)).toEqual([]);
  });

  it('[R-4.4-07] über mehrere Wochen höchstens ein Befund: der des ersten Tages (aufsteigend)', () => {
    // Mo 28.09.: c15 ist Beso-Spalte; Mi 30.09.: c20 ist Rap-Spalte → Befund des Montags.
    const e = qb({
      fromDate: '2026-09-28',
      toDate: '2026-10-18',
      columns: { kind: 'ids', ids: ['c15', 'c20'] },
    });
    const montag = validateEntryPlacement(e, dayColumns(plan, 'w26', 'Mo'));
    const mittwoch = validateEntryPlacement(e, dayColumns(plan, 'w26', 'Mi'));
    // Beide Tage liefern einen Befund; übernommen wird genau einer, der des Montags.
    expect(montag?.code).toBe('invalidPlacement');
    expect(mittwoch?.code).toBe('invalidPlacement');
    expect(validateEntry(plan, e)).toEqual([montag]);
  });

  it('[R-4.4-06] Reihenfolge: invalidPlacement nach den Datumsfeldern und vor categoryId (P-14)', () => {
    const rap = { kind: 'ids', ids: ['c14'] } as const;
    const leer = qb({ fromDate: '2026-09-28', toDate: '2026-09-28', columns: rap, categoryId: '' });
    expect(codes(validateEntry(plan, leer))).toEqual([
      ['invalidPlacement', 'columns'],
      ['missingField', 'categoryId'],
    ]);
    const unbekannt = qb({
      fromDate: '2026-09-28',
      toDate: '2026-09-28',
      columns: rap,
      categoryId: 'k99',
    });
    expect(codes(validateEntry(plan, unbekannt))).toEqual([
      ['invalidPlacement', 'columns'],
      ['unknownCategory', 'categoryId'],
    ]);
  });

  it('[R-4.4-06] Querbalken mit ungültigen Daten oder von nach bis: keine Platzierungsprüfung', () => {
    const rap = { kind: 'ids', ids: ['c14'] } as const;
    // Gegenprobe mit gültigen Daten: Befund.
    expect(
      codes(
        validateEntry(plan, qb({ fromDate: '2026-09-28', toDate: '2026-09-29', columns: rap })),
      ),
    ).toEqual([['invalidPlacement', 'columns']]);
    expect(
      codes(
        validateEntry(plan, qb({ fromDate: '2026-09-29', toDate: '2026-09-28', columns: rap })),
      ),
    ).toEqual([['dateOrder', 'toDate']]);
    expect(
      codes(
        validateEntry(plan, qb({ fromDate: '2026-02-30', toDate: '2026-09-29', columns: rap })),
      ),
    ).toEqual([['invalidDate', 'fromDate']]);
    expect(
      codes(validateEntry(plan, qb({ fromDate: '2026-09-28', toDate: '', columns: rap }))),
    ).toEqual([['missingField', 'toDate']]);
  });

  it('[R-4.4-06] Tage ausserhalb der Wochen ergeben keinen Befund; der Teil innerhalb wird geprüft', () => {
    const rap = { kind: 'ids', ids: ['c14'] } as const;
    // ganz vor der ersten Woche (w26 beginnt am 28.09.2026)
    expect(
      validateEntry(plan, qb({ fromDate: '2026-09-20', toDate: '2026-09-27', columns: rap })),
    ).toEqual([]);
    // ganz nach der letzten Woche (w28 endet am 18.10.2026)
    expect(
      validateEntry(plan, qb({ fromDate: '2026-10-19', toDate: '2026-10-25', columns: rap })),
    ).toEqual([]);
    // beginnt vor der ersten Woche, endet am Montag 28.09. (Rap-Spalte c14)
    expect(
      codes(
        validateEntry(plan, qb({ fromDate: '2026-09-26', toDate: '2026-09-28', columns: rap })),
      ),
    ).toEqual([['invalidPlacement', 'columns']]);
    // beginnt am Sonntag 18.10. (Rap-Spalte c24), endet nach der letzten Woche
    const sonntag = qb({
      fromDate: '2026-10-18',
      toDate: '2026-10-25',
      columns: { kind: 'ids', ids: ['c24'] },
    });
    expect(codes(validateEntry(plan, sonntag))).toEqual([['invalidPlacement', 'columns']]);
  });

  it('[R-4.4-05] Querbalken in Planungsspalten oder «alle» über drei Wochen: kein Befund; dieselbe Spannweite mit Rap-Spalte: Befund', () => {
    const range = { fromDate: '2026-09-28', toDate: '2026-10-18' } as const;
    expect(validateEntry(plan, qb({ ...range, columns: { kind: 'all' } }))).toEqual([]);
    expect(
      validateEntry(plan, qb({ ...range, columns: { kind: 'ids', ids: ['c8', 'c17', 'c23'] } })),
    ).toEqual([]);
    expect(
      codes(
        validateEntry(
          plan,
          qb({ ...range, columns: { kind: 'ids', ids: ['c8', 'c17', 'c23', 'c24'] } }),
        ),
      ),
    ).toEqual([['invalidPlacement', 'columns']]);
  });

  it('[R-4.4-05] Querbalken in der Nebenspalte ist zulässig; Nebenspalte zusammen mit Rap- oder Beso-Spalte: Befund (TR-E102a-21)', () => {
    // Mo–Di mit «Züge mit Det»: c40, c41 Planung, c42 Nebenspalte «Det», c43 Rap, c44 Beso.
    const mitDet = basePlan({
      weeks: [
        week('w26', '2026-09-28', {
          days: days(['s39', 's39', 's16', 's16', 's16', 's22', 's22']),
        }),
      ],
    });
    const range = { fromDate: '2026-09-28', toDate: '2026-09-29' } as const;
    expect(
      validateEntry(mitDet, qb({ ...range, columns: { kind: 'ids', ids: ['c40', 'c42'] } })),
    ).toEqual([]);
    expect(validateEntry(mitDet, qb({ ...range, columns: { kind: 'ids', ids: ['c42'] } }))).toEqual(
      [],
    );
    expect(
      codes(validateEntry(mitDet, qb({ ...range, columns: { kind: 'ids', ids: ['c42', 'c43'] } }))),
    ).toEqual([['invalidPlacement', 'columns']]);
    expect(
      codes(validateEntry(mitDet, qb({ ...range, columns: { kind: 'ids', ids: ['c42', 'c44'] } }))),
    ).toEqual([['invalidPlacement', 'columns']]);
  });
});

function kontrlFsg(over: Partial<Beso> = {}): Beso {
  return beso('e1', 1, {
    date: '2026-10-01',
    besoNumber: 24,
    title: rt('Kontrl Fsg'),
    windows: [win('t1', { time: { form: 'point', at: 810 } })],
    ort: 'Säntisalp',
    ...over,
  });
}

describe('N-2 leerer Freitext der Terminzeile (CR-E102a-03, F-57)', () => {
  it('[R-4.6-28] Freitext leer → Terminzeile aus den Feldern wie bei null; anderer Freitext: Nummer + Freitext', () => {
    const ausFeldern = agendaLine(kontrlFsg({ agendaOverride: null }), plan);
    expect(plain(ausFeldern)).toBe('24 1330: Kontrl Fsg, Ort: Säntisalp.');
    expect(agendaLine(kontrlFsg({ agendaOverride: '' }), plan)).toEqual(ausFeldern);
    expect(
      plain(agendaLine(kontrlFsg({ agendaOverride: 'Kontrolle  gemäss Bf 03-01' }), plan)),
    ).toBe('24 Kontrolle  gemäss Bf 03-01');
  });

  it('[R-4.6-28] Freitext nur Leerraum → Terminzeile aus den Feldern, auch ohne Nummer', () => {
    const ausFeldern = agendaLine(kontrlFsg({ agendaOverride: null }), plan);
    expect(agendaLine(kontrlFsg({ agendaOverride: '  ' }), plan)).toEqual(ausFeldern);
    expect(agendaLine(kontrlFsg({ agendaOverride: ' \t\n ' }), plan)).toEqual(ausFeldern);
    expect(agendaLine(kontrlFsg({ agendaOverride: NBSP }), plan)).toEqual(ausFeldern);
    expect(agendaLine(kontrlFsg({ agendaOverride: ` ${NBSP}\t` }), plan)).toEqual(ausFeldern);
    expect(plain(agendaLine(kontrlFsg({ besoNumber: null, agendaOverride: '   ' }), plan))).toBe(
      '– 1330: Kontrl Fsg, Ort: Säntisalp.',
    );
  });
});

describe('Entscheid TR-E102a-28: Freitext am Rand getrimmt', () => {
  it('[R-4.6-28] Freitext mit Leerraum am Rand (auch U+00A0) → Nummer + getrimmter Freitext; Leerraum im Innern bleibt', () => {
    expect(
      plain(agendaLine(kontrlFsg({ agendaOverride: ' Kontrolle  gemäss Bf 03-01 ' }), plan)),
    ).toBe('24 Kontrolle  gemäss Bf 03-01');
    expect(plain(agendaLine(kontrlFsg({ agendaOverride: `${NBSP}Frei${NBSP}` }), plan))).toBe(
      '24 Frei',
    );
    expect(
      plain(agendaLine(kontrlFsg({ besoNumber: null, agendaOverride: '\tFrei  Text\n' }), plan)),
    ).toBe('– Frei  Text');
  });
});

describe('N-3 Trimmen der Teile und des Titels (CR-E102a-04, P-12)', () => {
  it('[R-4.8-04] Beispiel der Notiz: Titel « Übung », Ort « Säntisalp. » → «24 1330: Übung, Ort: Säntisalp.»', () => {
    const b = kontrlFsg({ title: rt(' Übung '), ort: ' Säntisalp. ' });
    expect(plain(agendaLine(b, plan))).toBe('24 1330: Übung, Ort: Säntisalp.');
  });

  it('[R-4.8-04] Leerraum am Rand von Ltg, Tn, Tpt und Ort entfällt, Leerraum im Innern bleibt', () => {
    const b = kontrlFsg({ ltg: '  Einh Fw ', tn: ' Zfhr', tpt: 'Kaserne  ', ort: ' Säntis  Alp ' });
    expect(plain(agendaLine(b, plan))).toBe(
      '24 1330: Kontrl Fsg, Ltg: Einh Fw, Tn: Zfhr, Tpt: Kaserne, Ort: Säntis  Alp.',
    );
  });

  it('[R-4.8-05] ein nach dem Trimmen leerer Teil entfällt samt Bezeichnung und Komma', () => {
    const b = kontrlFsg({ title: rt('   '), ltg: '  ', tn: '\t', ort: ' Säntisalp ' });
    expect(plain(agendaLine(b, plan))).toBe('24 1330: Ort: Säntisalp.');
    const nbsp = kontrlFsg({
      title: rt(`${NBSP}Übung${NBSP}`),
      tpt: NBSP,
      ort: `${NBSP}Säntisalp${NBSP}`,
    });
    expect(plain(agendaLine(nbsp, plan))).toBe('24 1330: Übung, Ort: Säntisalp.');
  });

  it('[R-4.8-04] Titel über Läufe getrimmt: Fettstärke bleibt, leere Läufe entfallen, Leerraum im Innern bleibt', () => {
    const b = kontrlFsg({
      title: [
        { text: '  ', bold: false },
        { text: ' Übung ', bold: true },
        { text: 'Kp 1  ', bold: false },
      ],
    });
    expect(agendaLine(b, plan)).toEqual([
      { text: '24 1330: ', bold: false },
      { text: 'Übung ', bold: true },
      { text: 'Kp 1, Ort: Säntisalp.', bold: false },
    ]);
    const fettesEnde = kontrlFsg({
      title: [
        { text: 'Übung', bold: false },
        { text: '  ', bold: true },
      ],
    });
    expect(agendaLine(fettesEnde, plan)).toEqual([
      { text: '24 1330: Übung, Ort: Säntisalp.', bold: false },
    ]);
  });

  it('[R-4.8-08] (V-02a-2) ein Zeitfenster: Zusatz getrimmt; Zusatz nur Leerraum → Muster ohne Zusatz (TR-E102a-22)', () => {
    const fenster = (supplement: string) =>
      kontrlFsg({ windows: [win('t1', { time: { form: 'point', at: 810 }, supplement })] });
    expect(plain(agendaLine(fenster(' Inf Kp 1 '), plan))).toBe(
      '24 Kontrl Fsg: 1330 Inf Kp 1, Ort: Säntisalp.',
    );
    expect(plain(agendaLine(fenster(`${NBSP}Inf Kp 1${NBSP}`), plan))).toBe(
      '24 Kontrl Fsg: 1330 Inf Kp 1, Ort: Säntisalp.',
    );
    for (const leer of ['  ', NBSP, '\t']) {
      expect(plain(agendaLine(fenster(leer), plan))).toBe('24 1330: Kontrl Fsg, Ort: Säntisalp.');
    }
  });

  it('[R-4.8-04] mehrere Zeitfenster: Zusatz und Titel getrimmt', () => {
    const b = beso('e2', 2, {
      date: '2026-10-05',
      besoNumber: 13,
      title: [{ text: 'Vorrevisionen  ', bold: true }],
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 720 }, supplement: ' Inf Kp 1 ' }),
        win('t2', { time: { form: 'range', from: 780, to: 960 }, supplement: 'Inf Kp 2  ' }),
      ],
      ort: '',
    });
    expect(agendaLine(b, plan)).toEqual([
      { text: '13 ', bold: false },
      { text: 'Vorrevisionen', bold: true },
      { text: ': 0900-1200 Inf Kp 1, 1300-1600 Inf Kp 2.', bold: false },
    ]);
  });

  it('[R-4.8-04] Schlusspunkt nach dem getrimmten Text: kein zweiter Punkt, sonst einer', () => {
    expect(plain(agendaLine(kontrlFsg({ ort: 'Ukft. ' }), plan))).toBe(
      '24 1330: Kontrl Fsg, Ort: Ukft.',
    );
    expect(plain(agendaLine(kontrlFsg({ title: rt('Abc. '), ort: '' }), plan))).toBe(
      '24 1330: Abc.',
    );
    expect(plain(agendaLine(kontrlFsg({ ort: 'Ukft ' }), plan))).toBe(
      '24 1330: Kontrl Fsg, Ort: Ukft.',
    );
  });
});

describe('N-4 Frist mit Jahr (CR-E102a-05, P-4)', () => {
  const ref = '2026-10-04';

  function katalogInvalidTime(): ModelError {
    const e = catchError(() => parseTimeSpec('bis morgen', ref));
    expect(e).toBeInstanceOf(ModelError);
    return e as ModelError;
  }

  it('[R-4.6-36] «bis 21.10.1200» (Uhrzeit ohne Leerzeichen) → invalidTime, field null, Katalogmeldung', () => {
    const err = expectModelError(() => parseTimeSpec('bis 21.10.1200', ref), {
      code: 'invalidTime',
      field: null,
    });
    expect(err.userMessage).toEqual(katalogInvalidTime().userMessage);
  });

  it('[R-4.6-36] Jahr ausserhalb Bezugsjahr ±1 → invalidTime, mit und ohne Uhrzeit', () => {
    for (const s of [
      'bis 21.10.2024',
      'bis 21.10.2028',
      'bis 21.10.2028 1200',
      'bis 1.1.2030',
      'bis 21.10.0001',
    ]) {
      expectModelError(() => parseTimeSpec(s, ref), { code: 'invalidTime', field: null });
    }
  });

  it('[R-4.6-36] Grenzen Bezugsjahr −1 und +1 sind gültig, auch am Jahreswechsel; eins weiter nicht', () => {
    expect(parseTimeSpec('bis 21.10.2025', ref)).toEqual({
      time: { form: 'deadline' },
      deadlineDate: '2025-10-21',
    });
    expect(parseTimeSpec('bis 21.10.2027 1200', ref)).toEqual({
      time: { form: 'deadline', to: 720 },
      deadlineDate: '2027-10-21',
    });
    expect(parseTimeSpec('bis 31.12.2025', '2026-01-01').deadlineDate).toBe('2025-12-31');
    expect(parseTimeSpec('bis 1.1.2025', '2026-01-01').deadlineDate).toBe('2025-01-01');
    expectModelError(() => parseTimeSpec('bis 31.12.2024', '2026-01-01'), {
      code: 'invalidTime',
      field: null,
    });
    expect(parseTimeSpec('bis 31.12.2027', '2026-12-31').deadlineDate).toBe('2027-12-31');
    expectModelError(() => parseTimeSpec('bis 01.01.2028', '2026-12-31'), {
      code: 'invalidTime',
      field: null,
    });
  });

  it('[R-4.6-35] Jahresprüfung vor der Kalenderprüfung: «bis 31.02.1200» → invalidTime, «bis 31.02.2026» → invalidDate', () => {
    expectModelError(() => parseTimeSpec('bis 31.02.1200', ref), {
      code: 'invalidTime',
      field: null,
    });
    expectModelError(() => parseTimeSpec('bis 29.02.2028', ref), {
      code: 'invalidTime',
      field: null,
    });
    expectModelError(() => parseTimeSpec('bis 31.02.2026', ref), { code: 'invalidDate' });
    expectModelError(() => parseTimeSpec('bis 29.02.2027', '2027-06-01'), { code: 'invalidDate' });
    expect(parseTimeSpec('bis 29.02.2028', '2027-06-01').deadlineDate).toBe('2028-02-29');
  });
});

describe('N-5 isoDateOf (CR-E102a-06)', () => {
  it('[R-4.2-03] Monat oder Tag keine ganze Zahl → null; ganze Zahlen ergeben das Datum', () => {
    expect(isoDateOf(2026, 1.5, 1)).toBeNull();
    expect(isoDateOf(2026, 10, 4.5)).toBeNull();
    expect(isoDateOf(2026, 2, 28.999)).toBeNull();
    expect(isoDateOf(2026, Number.NaN, 1)).toBeNull();
    expect(isoDateOf(2026, 10, Number.POSITIVE_INFINITY)).toBeNull();
    expect(isoDateOf(2026.5, 10, 4)).toBeNull();
    expect(isoDateOf(2026, 10, 4)).toBe('2026-10-04');
    expect(isoDateOf(2028, 2, 29)).toBe('2028-02-29');
    expect(isoDateOf(2026, 1, 1)).toBe('2026-01-01');
  });
});

describe('N-6 (2) Datumsprüfung der Fabriken und von validateEntry', () => {
  it('[R-4.6-04] Querbalken: fromDate/toDate fehlend → missingField, kein Kalenderdatum → invalidDate; Fabrik invalidEntry', () => {
    expectModelError(() => newQuerbalken(without(querbalkenInput(), 'fromDate'), 'e3', 2), {
      code: 'invalidEntry',
      field: 'fromDate',
    });
    expectModelError(() => newQuerbalken(querbalkenInput({ fromDate: '2026-02-30' }), 'e3', 2), {
      code: 'invalidEntry',
      field: 'fromDate',
    });
    expectModelError(() => newQuerbalken(querbalkenInput({ toDate: '18.10.2026' }), 'e3', 2), {
      code: 'invalidEntry',
      field: 'toDate',
    });
    expect(codes(validateEntry(plan, without(qb({}), 'fromDate')))).toEqual([
      ['missingField', 'fromDate'],
    ]);
    expect(codes(validateEntry(plan, qb({ toDate: '2026-13-01' })))).toEqual([
      ['invalidDate', 'toDate'],
    ]);
    expect(
      newQuerbalken(querbalkenInput({ fromDate: '2028-02-29', toDate: '2028-03-01' }), 'e3', 2)
        .fromDate,
    ).toBe('2028-02-29');
  });

  it('[R-4.6-11] Marker: Datum fehlend oder kein Kalenderdatum → invalidEntry (date); validateEntry missingField/invalidDate', () => {
    expectModelError(() => newMarker(without(markerInput(), 'date'), 'e4', 3), {
      code: 'invalidEntry',
      field: 'date',
    });
    expectModelError(() => newMarker(markerInput({ date: '2026-09-31' }), 'e4', 3), {
      code: 'invalidEntry',
      field: 'date',
    });
    expect(codes(validateEntry(plan, without(marker('e4', 3), 'date')))).toEqual([
      ['missingField', 'date'],
    ]);
    expect(codes(validateEntry(plan, marker('e4', 3, { date: '2026-09-31' })))).toEqual([
      ['invalidDate', 'date'],
    ]);
    expect(newMarker(markerInput({ date: '2026-09-30' }), 'e4', 3).date).toBe('2026-09-30');
  });

  it('[R-4.6-16] Rapport: Datum fehlend oder kein Kalenderdatum → invalidEntry (date) mit der Meldung des Befunds', () => {
    expectModelError(() => newRapport(without(rapportInput(), 'date'), 'e5', 4), {
      code: 'invalidEntry',
      field: 'date',
    });
    const err = expectModelError(() => newRapport(rapportInput({ date: '2026-02-29' }), 'e5', 4), {
      code: 'invalidEntry',
      field: 'date',
    });
    const issues = validateEntry(plan, rapport('e5', 4, { date: '2026-02-29' }));
    expect(codes(issues)).toEqual([['invalidDate', 'date']]);
    expect(err.userMessage).toEqual(issues[0]?.message);
    expect(newRapport(rapportInput({ date: '2028-02-29' }), 'e5', 4).date).toBe('2028-02-29');
  });

  it('[R-4.6-26] Beso: Datum fehlend oder kein Kalenderdatum → invalidEntry (date)', () => {
    expectModelError(() => newBeso(without(besoInput(), 'date'), 'e6', 5), {
      code: 'invalidEntry',
      field: 'date',
    });
    expectModelError(() => newBeso(besoInput({ date: '2026-10-32' }), 'e6', 5), {
      code: 'invalidEntry',
      field: 'date',
    });
    expect(codes(validateEntry(plan, beso('e6', 5, { date: '2026-10-32' })))).toEqual([
      ['invalidDate', 'date'],
    ]);
    expect(codes(validateEntry(plan, without(beso('e6', 5), 'date')))).toEqual([
      ['missingField', 'date'],
    ]);
    expect(newBeso(besoInput({ date: '2026-10-31' }), 'e6', 5).date).toBe('2026-10-31');
  });

  it('[R-4.2-10] Zeitraum-Bemerkung: Datum fehlend oder ungültig → invalidDate (scope); Fabrik invalidEntry (scope)', () => {
    // toDate fehlt (Laufzeitprüfung trotz Typ, P-9)
    const fehlend = { kind: 'range', fromDate: '2026-09-28' } as unknown as RemarkScope;
    expectModelError(() => newMultiDayRemark(multiDayRemarkInput({ scope: fehlend }), 'e7', 6), {
      code: 'invalidEntry',
      field: 'scope',
    });
    expectModelError(
      () =>
        newMultiDayRemark(
          multiDayRemarkInput({
            scope: { kind: 'range', fromDate: '2026-02-30', toDate: '2026-10-04' },
          }),
          'e7',
          6,
        ),
      { code: 'invalidEntry', field: 'scope' },
    );
    expect(codes(validateEntry(plan, multiDayRemark('e7', 6, { scope: fehlend })))).toEqual([
      ['invalidDate', 'scope'],
    ]);
    expect(
      codes(
        validateEntry(
          plan,
          multiDayRemark('e7', 6, {
            scope: { kind: 'range', fromDate: '2026-09-28', toDate: 'x' },
          }),
        ),
      ),
    ).toEqual([['invalidDate', 'scope']]);
    expect(
      validateEntry(
        plan,
        multiDayRemark('e7', 6, {
          scope: { kind: 'range', fromDate: '2026-09-28', toDate: '2026-10-04' },
        }),
      ),
    ).toEqual([]);
  });
});

describe('N-6 (3) Marker mit fehlender oder unbekannter Art', () => {
  it('[R-4.6-11] validateEntry: fehlende oder unbekannte Art → genau ein Befund missingField (kind); bekannte Arten gültig', () => {
    expect(codes(validateEntry(plan, without(marker('e4', 3), 'kind')))).toEqual([
      ['missingField', 'kind'],
    ]);
    expect(codes(validateEntry(plan, marker('e4', 3, { kind: 'XY' as MarkerKind })))).toEqual([
      ['missingField', 'kind'],
    ]);
    for (const kind of ['AV', 'ABV', 'HV'] as const) {
      expect(validateEntry(plan, marker('e4', 3, { kind }))).toEqual([]);
    }
    expect(validateEntry(plan, marker('e4', 3, { kind: 'custom', customKind: 'Appell' }))).toEqual(
      [],
    );
  });
});

describe('N-6 (5) createPlanFromTemplate mit Kategorie, die in der Legende fehlt', () => {
  const input = { planId: 'plan-n6', startDate: '2026-09-28', weekCount: 1 } as const;

  function template(over: Partial<LevelTemplate>): LevelTemplate {
    return { ...kpTemplate(), ...over };
  }

  it('[R-4.7-08] Funktion mit unbekanntem Kategorienamen → invalidPlanInput (functionList[i]); null ist gültig', () => {
    const kp = kpTemplate();
    const functionList = kp.functionList.map((f, i) =>
      i === 1 ? { ...f, categoryName: 'Ltg Fiktiv' } : f,
    );
    expectModelError(() => createPlanFromTemplate(template({ functionList }), input), {
      code: 'invalidPlanInput',
      field: 'functionList[1]',
    });
    const ohneKategorie = kp.functionList.map((f, i) =>
      i === 1 ? { ...f, categoryName: null } : f,
    );
    const p = createPlanFromTemplate(template({ functionList: ohneKategorie }), input);
    expect(p.functionList[1]?.categoryId).toBeNull();
  });

  it('[R-4.7-08] Kategoriename ist der Name, nicht die Legendenbeschriftung: «Leitung Kp» → invalidPlanInput (TR-E102a-27)', () => {
    const kp = kpTemplate();
    expect(kp.legend.find((c) => c.name === 'Ltg Kp')?.legendLabel).toBe('Leitung Kp');
    const functionList = kp.functionList.map((f, i) =>
      i === 0 ? { ...f, categoryName: 'Leitung Kp' } : f,
    );
    expectModelError(() => createPlanFromTemplate(template({ functionList }), input), {
      code: 'invalidPlanInput',
      field: 'functionList[0]',
    });
    const rapportCodes = kp.rapportCodes.map((r, i) =>
      i === 0 ? { ...r, categoryName: 'Leitung Kp' } : r,
    );
    expectModelError(() => createPlanFromTemplate(template({ rapportCodes }), input), {
      code: 'invalidPlanInput',
      field: 'rapportCodes[0]',
    });
  });

  it('[R-4.9-18] Rapportkürzel mit unbekanntem Kategorienamen → invalidPlanInput (rapportCodes[i])', () => {
    const rapportCodes = kpTemplate().rapportCodes.map((r, i) =>
      i === 2 ? { ...r, categoryName: 'Ltg Fiktiv' } : r,
    );
    expectModelError(() => createPlanFromTemplate(template({ rapportCodes }), input), {
      code: 'invalidPlanInput',
      field: 'rapportCodes[2]',
    });
  });

  it('[R-4.7-08] Reihenfolge: Spaltensätze vor Funktionsliste vor Rapportkürzeln, erster Fehler', () => {
    const kp = kpTemplate();
    const functionList = kp.functionList.map((f, i) => (i >= 3 ? { ...f, categoryName: 'X' } : f));
    const rapportCodes = kp.rapportCodes.map((r) => ({ ...r, categoryName: 'X' }));
    expectModelError(
      () => createPlanFromTemplate(template({ functionList, rapportCodes }), input),
      {
        code: 'invalidPlanInput',
        field: 'functionList[3]',
      },
    );
    const [erster, ...rest] = kp.columnSets;
    const ohneBeso = {
      ...erster,
      columns: (erster?.columns ?? []).filter((c) => c.kind !== 'beso'),
    } as NonNullable<typeof erster>;
    expectModelError(
      () =>
        createPlanFromTemplate(
          template({ functionList, rapportCodes, columnSets: [ohneBeso, ...rest] }),
          input,
        ),
      { code: 'invalidColumnSet', field: 'columnSets[0]' },
    );
  });

  it('[R-4.9-18] gleicher Kategoriename zweimal in der Legende: es gilt die erste Kategorie', () => {
    const kp = kpTemplate();
    const ltgKp = kp.legend.find((c) => c.name === 'Ltg Kp');
    expect(ltgKp).toBeDefined();
    const legend = [
      ...kp.legend,
      { ...(ltgKp as NonNullable<typeof ltgKp>), color: { r: 1, g: 2, b: 3 } },
    ];
    const p = createPlanFromTemplate(template({ legend }), input);
    const ersteId = p.legend.find((c) => c.name === 'Ltg Kp')?.id;
    const letzteId = p.legend[p.legend.length - 1]?.id;
    expect(ersteId).toBeDefined();
    expect(letzteId).not.toBe(ersteId);
    expect(p.rapportCodes.find((r) => r.code === 'KR')?.categoryId).toBe(ersteId);
    const kdtIndex = kp.functionList.findIndex((f) => f.code === 'Kp Kdt');
    expect(p.functionList[kdtIndex]?.categoryId).toBe(ersteId);
  });
});

describe('CR-E102a-02 Kürzel im Titel eines Querbalkens über die Wochengrenze', () => {
  it('[R-4.7-14] gewähltes Kürzel im Querbalken-Titel erscheint in jeder Woche mit Überschneidung, sonst nicht', () => {
    const p = withEntries(basePlan({ abbreviationsSelected: ['AVOR', 'Spl'] }), [
      querbalken('e1', 1, {
        title: rt('Messe mit AVOR'),
        fromDate: '2026-10-03',
        toDate: '2026-10-06',
      }),
    ]);
    expect(abbreviationsForWeek(p, 'w26')).toEqual(['AVOR']);
    expect(abbreviationsForWeek(p, 'w27')).toEqual(['AVOR']);
    expect(abbreviationsForWeek(p, 'w28')).toEqual([]);
  });

  it('[R-4.7-14] Ränder Querbalken/Woche: bis Montag, nur Sonntag, ganze Folgewoche; davor nichts (TR-E102a-23)', () => {
    const mit = (fromDate: string, toDate: string) =>
      withEntries(basePlan({ abbreviationsSelected: ['AVOR'] }), [
        querbalken('e1', 1, { title: rt('Messe mit AVOR'), fromDate, toDate }),
      ]);
    const bisMontag = mit('2026-09-21', '2026-09-28');
    expect(abbreviationsForWeek(bisMontag, 'w26')).toEqual(['AVOR']);
    expect(abbreviationsForWeek(bisMontag, 'w27')).toEqual([]);
    expect(abbreviationsForWeek(mit('2026-09-21', '2026-09-27'), 'w26')).toEqual([]);
    const sonntag = mit('2026-10-04', '2026-10-04');
    expect(abbreviationsForWeek(sonntag, 'w26')).toEqual(['AVOR']);
    expect(abbreviationsForWeek(sonntag, 'w27')).toEqual([]);
    const ganzeWoche = mit('2026-10-05', '2026-10-11');
    expect(abbreviationsForWeek(ganzeWoche, 'w26')).toEqual([]);
    expect(abbreviationsForWeek(ganzeWoche, 'w27')).toEqual(['AVOR']);
    expect(abbreviationsForWeek(ganzeWoche, 'w28')).toEqual([]);
  });
});

describe('N-6 (6) Quellen der Kürzelliste (TR-E102a-24)', () => {
  it('[R-4.7-14] Zusatz eines Zeitfensters, Freitext, Art «frei» und Bemerkungen der Woche zählen; ausgeblendete und Zeiträume ausserhalb nicht', () => {
    const p = withEntries(
      basePlan({
        abbreviationsSelected: ['AVOR', 'Ber', 'Mat', 'Spl', 'Ukft', 'WEME'],
        weeks: [
          week('w26', '2026-09-28', { hiddenRemarkIds: ['e9'] }),
          week('w27', '2026-10-05'),
          week('w28', '2026-10-12'),
        ],
      }),
      [
        beso('e1', 1, {
          title: rt('Kontrl Fsg'),
          windows: [win('t1', { supplement: 'Ukft Det' })],
        }),
        beso('e2', 2, { title: rt('Abgabe'), besoNumber: 25, agendaOverride: 'Abgabe Spl' }),
        marker('e3', 3, { kind: 'custom', customKind: 'AVOR' }),
        multiDayRemark('e8', 8, {
          scope: { kind: 'week', weekId: 'w26' },
          text: 'WEME am Freitag.',
        }),
        multiDayRemark('e9', 9, { scope: { kind: 'plan' }, text: 'Mat Fassung im Zeughaus.' }),
        multiDayRemark('e10', 10, {
          scope: { kind: 'range', fromDate: '2026-10-12', toDate: '2026-10-14' },
          text: 'Ber Ausb.',
        }),
      ],
    );
    expect(abbreviationsForWeek(p, 'w26')).toEqual(['AVOR', 'Spl', 'Ukft', 'WEME']);
    expect(abbreviationsForWeek(p, 'w27')).toEqual(['Mat']);
    expect(abbreviationsForWeek(p, 'w28')).toEqual(['Ber', 'Mat']);
  });
});

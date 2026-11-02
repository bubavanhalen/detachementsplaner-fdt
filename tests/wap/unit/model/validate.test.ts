// @vitest-environment jsdom
// Strukturelle Validierung (Vertrag E1-02a Abschnitt 3 validate.ts, 8 P-10; Beschrieb 4.4, 4.6).
import { describe, expect, it } from 'vitest';
import type { ColumnSet } from '../../../../src/model/wap/types';
import {
  type ValidationIssue,
  validateColumnSet,
  validateEntry,
  validateEntryPlacement,
} from '../../../../src/model/wap/validate';
import {
  basePlan,
  beso,
  block,
  CAT,
  col,
  dayRemark,
  marker,
  multiDayRemark,
  querbalken,
  rapport,
  setMiFr,
  setMitNebenspalte,
  setStufen,
  setWochenende,
  win,
  without,
} from '../../support/model/builders';

function codes(issues: readonly ValidationIssue[]): string[] {
  return issues.map((i) => i.code).sort();
}

function expectMessages(issues: readonly ValidationIssue[]): void {
  for (const i of issues) {
    expect(i.field.trim()).not.toBe('');
    expect(i.message.cause.trim()).not.toBe('');
    expect(i.message.nextStep.trim()).not.toBe('');
  }
}

const stufen = setStufen().columns;
const mitDet = setMitNebenspalte().columns;

describe('validateEntryPlacement', () => {
  it('[R-4.4-06] Block mit Ziel Rap-Spalte wird abgewiesen (invalidPlacement, columns)', () => {
    const issue = validateEntryPlacement(
      block('e1', 1, { columns: { kind: 'ids', ids: ['c14'] } }),
      stufen,
    );
    expect(issue?.code).toBe('invalidPlacement');
    expect(issue?.field).toBe('columns');
  });

  it('[R-4.4-07] Block mit Ziel Beso-Spalte wird abgewiesen (invalidPlacement, columns)', () => {
    const issue = validateEntryPlacement(
      block('e1', 1, { columns: { kind: 'ids', ids: ['c15'] } }),
      stufen,
    );
    expect(issue?.code).toBe('invalidPlacement');
    expect(issue?.field).toBe('columns');
  });

  it('[R-4.4-06] Beso-Zeitfenster mit Ziel Rap-Spalte wird abgewiesen (windows[i].columnId)', () => {
    const b = beso('e2', 2, {
      windows: [win('t1', { columnId: 'c8' }), win('t2', { columnId: 'c14' })],
    });
    const issue = validateEntryPlacement(b, stufen);
    expect(issue?.code).toBe('invalidPlacement');
    expect(issue?.field).toBe('windows[1].columnId');
  });

  it('[R-4.4-07] Beso-Zeitfenster nennt als Spalte nur Planungs- oder Nebenspalten, nie die Beso-Spalte selbst', () => {
    const b = beso('e2', 2, { windows: [win('t1', { columnId: 'c15' })] });
    expect(validateEntryPlacement(b, stufen)?.field).toBe('windows[0].columnId');
    const ok = beso('e3', 3, {
      windows: [win('t1', { columnId: null }), win('t2', { columnId: 'c42' })],
    });
    expect(validateEntryPlacement(ok, mitDet)).toBeNull();
  });

  it('[R-4.4-06] Rapport: Anzeige-Spalten dürfen keine Rap- oder Beso-Spalte nennen (displayColumns)', () => {
    const r = rapport('e4', 4, {
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: ['c14'] },
    });
    const issue = validateEntryPlacement(r, stufen);
    expect(issue?.code).toBe('invalidPlacement');
    expect(issue?.field).toBe('displayColumns');
    const ok = rapport('e5', 5, {
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: ['c8'] },
    });
    expect(validateEntryPlacement(ok, stufen)).toBeNull();
  });

  it('[R-4.4-07] Marker mit Ziel Beso-Spalte wird abgewiesen (columns)', () => {
    const m = marker('e6', 6, { columns: { kind: 'ids', ids: ['c15'] } });
    expect(validateEntryPlacement(m, stufen)?.field).toBe('columns');
  });

  it('[R-4.4-05] Block in der Nebenspalte und in Planungsspalten ist zulässig; «alle» ist zulässig', () => {
    expect(
      validateEntryPlacement(block('e1', 1, { columns: { kind: 'ids', ids: ['c42'] } }), mitDet),
    ).toBeNull();
    expect(
      validateEntryPlacement(
        block('e1', 1, { columns: { kind: 'ids', ids: ['c8', 'c10'] } }),
        stufen,
      ),
    ).toBeNull();
    expect(validateEntryPlacement(block('e1', 1, { columns: { kind: 'all' } }), stufen)).toBeNull();
  });

  it('[R-4.4-06] nur der erste Befund wird geliefert', () => {
    const issue = validateEntryPlacement(
      block('e1', 1, { columns: { kind: 'ids', ids: ['c14', 'c15'] } }),
      stufen,
    );
    expect(issue).not.toBeNull();
    expect(issue?.field).toBe('columns');
    expect(issue?.message.cause.trim()).not.toBe('');
  });
});

describe('validateColumnSet', () => {
  it('[R-4.4-09] die Spaltensätze der Kp-Vorlage und ein Satz mit Nebenspalte sind gültig', () => {
    for (const s of [setStufen(), setMiFr(), setWochenende(), setMitNebenspalte()]) {
      expect(validateColumnSet(s)).toEqual([]);
    }
  });

  it('[R-4.4-05] Tag ohne Nebenspalte gültig; zwei Nebenspalten → secondaryColumnCount', () => {
    expect(validateColumnSet(setMiFr())).toEqual([]);
    const s: ColumnSet = {
      id: 's1',
      name: 'Zwei Det',
      columns: [
        col('c1', 'A', 'planning'),
        col('c2', 'Det', 'secondary'),
        col('c3', 'Det 2', 'secondary'),
        col('c4', 'Rap', 'rap'),
        col('c5', 'Beso', 'beso'),
      ],
    };
    const issues = validateColumnSet(s);
    expect(codes(issues)).toContain('secondaryColumnCount');
    expect(issues.find((x) => x.code === 'secondaryColumnCount')?.field).toBe('columns');
    expectMessages(issues);
  });

  it('[R-4.4-06] genau eine Rap-Spalte: keine oder zwei → rapColumnCount', () => {
    const ohne: ColumnSet = {
      id: 's1',
      name: 'x',
      columns: [col('c1', 'A', 'planning'), col('c5', 'Beso', 'beso')],
    };
    expect(codes(validateColumnSet(ohne))).toContain('rapColumnCount');
    expect(validateColumnSet(ohne).find((x) => x.code === 'rapColumnCount')?.field).toBe('columns');
    const zwei: ColumnSet = {
      id: 's1',
      name: 'x',
      columns: [
        col('c1', 'A', 'planning'),
        col('c2', 'Rap', 'rap'),
        col('c3', 'Rap', 'rap'),
        col('c5', 'Beso', 'beso'),
      ],
    };
    expect(codes(validateColumnSet(zwei))).toContain('rapColumnCount');
  });

  it('[R-4.4-07] genau eine Beso-Spalte: keine oder zwei → besoColumnCount', () => {
    const ohne: ColumnSet = {
      id: 's1',
      name: 'x',
      columns: [col('c1', 'A', 'planning'), col('c2', 'Rap', 'rap')],
    };
    expect(codes(validateColumnSet(ohne))).toContain('besoColumnCount');
    expect(validateColumnSet(ohne).find((x) => x.code === 'besoColumnCount')?.field).toBe(
      'columns',
    );
    const zwei: ColumnSet = {
      id: 's1',
      name: 'x',
      columns: [
        col('c1', 'A', 'planning'),
        col('c2', 'Rap', 'rap'),
        col('c3', 'Beso', 'beso'),
        col('c4', 'Beso', 'beso'),
      ],
    };
    expect(codes(validateColumnSet(zwei))).toContain('besoColumnCount');
  });

  it('[R-4.4-09] Reihenfolge Planung, Neben, Rap, Beso: Abweichungen → columnOrder', () => {
    const variants: ColumnSet['columns'][] = [
      [col('c1', 'A', 'planning'), col('c3', 'Beso', 'beso'), col('c2', 'Rap', 'rap')],
      [
        col('c2', 'Det', 'secondary'),
        col('c1', 'A', 'planning'),
        col('c3', 'Rap', 'rap'),
        col('c4', 'Beso', 'beso'),
      ],
      [
        col('c1', 'A', 'planning'),
        col('c3', 'Rap', 'rap'),
        col('c2', 'B', 'planning'),
        col('c4', 'Beso', 'beso'),
      ],
      [
        col('c1', 'A', 'planning'),
        col('c3', 'Rap', 'rap'),
        col('c2', 'Det', 'secondary'),
        col('c4', 'Beso', 'beso'),
      ],
    ];
    const firstOut = [2, 1, 2, 2];
    variants.forEach((columns, i) => {
      const issues = validateColumnSet({ id: 's1', name: 'x', columns });
      expect(codes(issues)).toContain('columnOrder');
      expect(issues.find((x) => x.code === 'columnOrder')?.field).toBe(`columns[${firstOut[i]}]`);
    });
  });

  it('[R-4.4-09] doppelte Spalten-ID → duplicateColumnId', () => {
    const s: ColumnSet = {
      id: 's1',
      name: 'x',
      columns: [
        col('c1', 'A', 'planning'),
        col('c1', 'B', 'planning'),
        col('c2', 'Rap', 'rap'),
        col('c3', 'Beso', 'beso'),
      ],
    };
    const issues = validateColumnSet(s);
    expect(codes(issues)).toContain('duplicateColumnId');
    expect(issues.find((x) => x.code === 'duplicateColumnId')?.field).toBe('columns[1]');
  });

  it('[R-4.4-01] Planungsspalten mit Gewicht schmal, normal und breit sind gültig', () => {
    const s: ColumnSet = {
      id: 's1',
      name: 'Gewichte',
      columns: [
        col('c1', 'COBRA 10', 'planning', { weight: 'narrow' }),
        col('c2', 'COBRA 20', 'planning', { weight: 'normal' }),
        col('c3', 'COBRA 30', 'planning', { weight: 'wide', labelOrientation: 'vertical' }),
        col('c4', 'Rap', 'rap'),
        col('c5', 'Beso', 'beso'),
      ],
    };
    expect(validateColumnSet(s)).toEqual([]);
  });
});

describe('validateEntry', () => {
  const plan = basePlan();

  it('[R-4.6-01] gültige Einträge aller Typen ergeben keine Befunde', () => {
    const entries = [
      block('e1', 1),
      querbalken('e2', 2),
      marker('e3', 3),
      rapport('e4', 4),
      beso('e5', 5),
      dayRemark('e6', 6),
      multiDayRemark('e7', 7),
      multiDayRemark('e8', 8, { scope: { kind: 'week', weekId: 'w27' }, number: 2 }),
    ];
    for (const e of entries) expect(validateEntry(plan, e)).toEqual([]);
  });

  it('[R-4.7-02] Kategorie nicht in der Legende → unknownCategory (categoryId)', () => {
    const issues = validateEntry(plan, block('e1', 1, { categoryId: 'k99' }));
    expect(codes(issues)).toEqual(['unknownCategory']);
    expect(issues[0]?.field).toBe('categoryId');
    expectMessages(issues);
    expect(codes(validateEntry(plan, beso('e2', 2, { categoryId: 'k99' })))).toEqual([
      'unknownCategory',
    ]);
    expect(codes(validateEntry(plan, rapport('e3', 3, { categoryId: 'k99' })))).toEqual([
      'unknownCategory',
    ]);
  });

  it('[R-4.7-02] zweite Kategorie gleich der ersten → sameSecondCategory', () => {
    const issues = validateEntry(
      plan,
      block('e1', 1, { categoryId: CAT.kp, secondCategoryId: CAT.kp }),
    );
    expect(codes(issues)).toEqual(['sameSecondCategory']);
    expect(issues[0]?.field).toBe('secondCategoryId');
  });

  it('[R-4.6-01] leere Spaltenauswahl → emptyColumns; alle Befunde werden geliefert', () => {
    const issues = validateEntry(
      plan,
      block('e1', 1, { columns: { kind: 'ids', ids: [] }, categoryId: 'k99' }),
    );
    expect(codes(issues)).toEqual(['emptyColumns', 'unknownCategory']);
    expect(issues.find((i) => i.code === 'emptyColumns')?.field).toBe('columns');
  });

  it('[R-4.6-35] (F-04) Frist am Block und «ab X» am Rapport → timeFormNotAllowed', () => {
    expect(
      codes(validateEntry(plan, block('e1', 1, { time: { form: 'deadline' } as never }))),
    ).toEqual(['timeFormNotAllowed']);
    expect(
      codes(validateEntry(plan, rapport('e2', 2, { time: { form: 'from', from: 600 } as never }))),
    ).toEqual(['timeFormNotAllowed']);
  });

  it('[R-4.5-09] Zeit ausserhalb des 5-Minuten-Rasters → invalidTime; ungültiges Datum → invalidDate', () => {
    expect(
      codes(validateEntry(plan, block('e1', 1, { time: { form: 'point', at: 513 } }))),
    ).toEqual(['invalidTime']);
    expect(codes(validateEntry(plan, dayRemark('e2', 2, { date: '2026-09-31' })))).toEqual([
      'invalidDate',
    ]);
  });

  it('[R-4.6-04] Querbalken mit Datum von nach bis → dateOrder (toDate)', () => {
    const issues = validateEntry(
      plan,
      querbalken('e1', 1, { fromDate: '2026-10-18', toDate: '2026-10-08' }),
    );
    expect(codes(issues)).toEqual(['dateOrder']);
    expect(issues[0]?.field).toBe('toDate');
  });

  it('[R-4.6-16] Rapport ohne Kürzel → missingField (code)', () => {
    const issues = validateEntry(plan, rapport('e1', 1, { code: '' }));
    expect(codes(issues)).toEqual(['missingField']);
    expect(issues[0]?.field).toBe('code');
    expectMessages(issues);
  });

  it('[R-4.6-11] Marker Art «frei» ohne Bezeichnung → missingField (customKind)', () => {
    const issues = validateEntry(plan, marker('e1', 1, { kind: 'custom', customKind: '' }));
    expect(codes(issues)).toEqual(['missingField']);
    expect(issues[0]?.field).toBe('customKind');
    expect(validateEntry(plan, marker('e2', 2, { kind: 'custom', customKind: 'Appell' }))).toEqual(
      [],
    );
  });

  it('[R-4.6-41] Beso-Zeitfenster mit Zeit ausserhalb des 5-Minuten-Rasters → invalidTime (windows[0].time)', () => {
    const issues = validateEntry(
      plan,
      beso('e1', 1, { windows: [win('t1', { time: { form: 'point', at: 433 } })] }),
    );
    expect(codes(issues)).toEqual(['invalidTime']);
    expect(issues[0]?.field).toBe('windows[0].time');
  });

  it('[R-4.6-41] Beso ohne Zeitfenster → besoWithoutWindow; doppelte Zeitfenster-ID → duplicateWindowId', () => {
    expect(codes(validateEntry(plan, beso('e1', 1, { windows: [] })))).toEqual([
      'besoWithoutWindow',
    ]);
    expect(codes(validateEntry(plan, beso('e2', 2, { windows: [win('t1'), win('t1')] })))).toEqual([
      'duplicateWindowId',
    ]);
  });

  it('[R-4.8-09] Beso-Nummer nicht ganzzahlig ≥ 0 → invalidNumber; null (11. Beso) gültig', () => {
    expect(codes(validateEntry(plan, beso('e1', 1, { besoNumber: -1 })))).toEqual([
      'invalidNumber',
    ]);
    expect(codes(validateEntry(plan, beso('e2', 2, { besoNumber: 1.5 })))).toEqual([
      'invalidNumber',
    ]);
    expect(validateEntry(plan, beso('e3', 3, { besoNumber: null }))).toEqual([]);
    expect(validateEntry(plan, beso('e4', 4, { besoNumber: 0 }))).toEqual([]);
  });

  it('[R-4.2-10] Bemerkung für eine fehlende Woche → unknownWeek; Nummer nicht ganzzahlig → invalidNumber', () => {
    expect(
      codes(
        validateEntry(plan, multiDayRemark('e1', 1, { scope: { kind: 'week', weekId: 'w99' } })),
      ),
    ).toEqual(['unknownWeek']);
    expect(codes(validateEntry(plan, multiDayRemark('e2', 2, { number: -3 })))).toEqual([
      'invalidNumber',
    ]);
    const rev = validateEntry(
      plan,
      multiDayRemark('e3', 3, {
        scope: { kind: 'range', fromDate: '2026-10-08', toDate: '2026-10-01' },
      }),
    );
    expect(codes(rev)).toEqual(['dateOrder']);
    expect(rev[0]?.field).toBe('scope');
  });

  it('[R-4.7-02] (Vertrag P-14) leere Kategorie → genau ein Befund missingField (categoryId), kein unknownCategory', () => {
    for (const b of [block('e1', 1, { categoryId: '' }), without(block('e2', 2), 'categoryId')]) {
      const issues = validateEntry(plan, b);
      expect(issues.map((i) => [i.code, i.field])).toEqual([['missingField', 'categoryId']]);
      expectMessages(issues);
    }
    expect(
      validateEntry(plan, beso('e3', 3, { categoryId: '' })).map((i) => [i.code, i.field]),
    ).toEqual([['missingField', 'categoryId']]);
  });

  it('[R-4.7-02] (Vertrag P-14) zweite Kategorie: null gültig, leer → missingField, unbekannt → unknownCategory', () => {
    expect(validateEntry(plan, block('e1', 1, { secondCategoryId: null }))).toEqual([]);
    expect(
      validateEntry(plan, block('e2', 2, { secondCategoryId: '' })).map((i) => [i.code, i.field]),
    ).toEqual([['missingField', 'secondCategoryId']]);
    expect(
      validateEntry(plan, block('e3', 3, { secondCategoryId: 'k99' })).map((i) => [
        i.code,
        i.field,
      ]),
    ).toEqual([['unknownCategory', 'secondCategoryId']]);
  });

  it('[R-4.6-04] (Vertrag P-14) Querbalken-Kategorie: null gültig, leer → missingField, unbekannt → unknownCategory', () => {
    expect(validateEntry(plan, querbalken('e1', 1, { categoryId: null }))).toEqual([]);
    expect(
      validateEntry(plan, querbalken('e2', 2, { categoryId: '' })).map((i) => [i.code, i.field]),
    ).toEqual([['missingField', 'categoryId']]);
    expect(
      validateEntry(plan, querbalken('e3', 3, { categoryId: 'k99' })).map((i) => [i.code, i.field]),
    ).toEqual([['unknownCategory', 'categoryId']]);
  });

  it('[R-4.6-41] (Vertrag P-14) Befunde in Feldreihenfolge des Typs, Zeitfenster nach Index', () => {
    const b = beso('e1', 1, {
      date: '2026-02-30',
      windows: [
        win('t1', { time: { form: 'point', at: 433 } }),
        win('t2'),
        win('t3', { time: { form: 'point', at: 437 } }),
      ],
      categoryId: 'k99',
    });
    expect(validateEntry(plan, b).map((i) => [i.code, i.field])).toEqual([
      ['invalidDate', 'date'],
      ['invalidTime', 'windows[0].time'],
      ['invalidTime', 'windows[2].time'],
      ['unknownCategory', 'categoryId'],
    ]);
  });

  it('[R-4.4-06] Eintrag mit Datum in einer Woche: Platzierung gegen die Spalten des Tages (Block in Rap-Spalte)', () => {
    const issues = validateEntry(
      plan,
      block('e1', 1, { date: '2026-09-28', columns: { kind: 'ids', ids: ['c14'] } }),
    );
    expect(codes(issues)).toEqual(['invalidPlacement']);
    expect(issues[0]?.field).toBe('columns');
  });

  it('[R-4.4-07] Platzierung nach dem Spaltensatz des Tages: Mittwoch (Mi–Fr) Block in Beso-Spalte c21 abgewiesen, Montag-Spalte c8 kein Befund', () => {
    expect(
      codes(
        validateEntry(
          plan,
          block('e1', 1, { date: '2026-09-30', columns: { kind: 'ids', ids: ['c21'] } }),
        ),
      ),
    ).toEqual(['invalidPlacement']);
    expect(
      validateEntry(
        plan,
        block('e2', 2, { date: '2026-09-30', columns: { kind: 'ids', ids: ['c8'] } }),
      ),
    ).toEqual([]);
  });

  it('[R-4.6-01] Eintrag ausserhalb aller Wochen: keine Platzierungsprüfung', () => {
    expect(
      validateEntry(
        plan,
        block('e1', 1, { date: '2027-03-01', columns: { kind: 'ids', ids: ['c14'] } }),
      ),
    ).toEqual([]);
  });
});

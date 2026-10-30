// @vitest-environment jsdom
// Vertrag E1-07 §2c: Kopf-Kalibrierung detectSheetLayout (Tage, Spalten, Startdatum).
// Die Zeitachse ist eine von Hand gebaute SheetTimeScale; nur gridRight wird ausgewertet.
import { describe, expect, it } from 'vitest';
import {
  detectSheetLayout,
  type SheetDayBlock,
  type SheetModel,
  type SheetTimeScale,
  XlsxError,
} from '../../../../src/io/xlsx-drawing';
import { at, inl, numCell, serialOf, sheetModel, worksheetXml } from './fixture';

const time = (gridRight = Number.POSITIVE_INFINITY): SheetTimeScale => ({
  labels: [
    { minute: 300, y: 0 },
    { minute: 360, y: 100 },
  ],
  toMinute: (y) => 300 + y * 0.6,
  toY: (minute) => (minute - 300) / 0.6,
  gridLeft: 0,
  gridRight,
  gridTop: -100,
  gridBottom: 225,
  labelShapes: new Set<number>(),
});

/** Spalten eines Tags lückenlos, ohne Überlappung, nach x0 sortiert, je Breite > 0. */
function expectCover(day: SheetDayBlock) {
  expect(day.columns.length).toBeGreaterThan(0);
  expect(at(day.columns, 0).x0).toBe(day.x0);
  expect(at(day.columns, day.columns.length - 1).x1).toBe(day.x1);
  for (let i = 0; i < day.columns.length; i++) {
    expect(at(day.columns, i).x1).toBeGreaterThan(at(day.columns, i).x0);
    if (i > 0) expect(at(day.columns, i).x0).toBe(at(day.columns, i - 1).x1);
  }
}

function expectCalibrationFailed(fn: () => unknown) {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(XlsxError);
  expect((caught as XlsxError).code).toBe('calibrationFailed');
  expect((caught as XlsxError).message).toBe('xlsx: calibrationFailed');
}

/**
 * Grundblatt: Zeile 2 Kopf (Mo B:E, Di F:I, «Zeit» J), Zeile 3 Spaltenköpfe
 * (B «ALPHA   1 », C «Rap», D leer, E «Beso», F:G «Stab», H:I leer), Zeile 5 zwei Zellen.
 */
function baseSheet(cols = ''): SheetModel {
  return sheetModel(
    worksheetXml({
      cols,
      rows: {
        1: inl('A1', 'Kp Arbeitsplan Woche'),
        2: inl('B2', 'Montag') + inl('F2', 'Dienstag') + inl('J2', 'Zeit'),
        3: inl('B3', 'ALPHA   1 ') + inl('C3', 'Rap') + inl('E3', 'Beso') + inl('F3', 'Stab'),
        5: inl('B5', 'x') + inl('C5', 'y'),
      },
      merges: ['B2:E2', 'F2:I2', 'F3:G3'],
    }),
  );
}

describe('xlsx-drawing detectSheetLayout (Vertrag E1-07 §2c)', () => {
  it('[R-L-11] (§2c positiv) Kopfzeile, Spaltenkopfzeile, Tage, beschriftete und unbeschriftete Spalten', () => {
    const sheet = baseSheet();
    const x = (col: number) => sheet.colX(col);
    const layout = detectSheetLayout(sheet, time());
    expect(layout.headerRow).toBe(1);
    expect(layout.subHeaderRow).toBe(2);
    expect(layout.startDate).toBeNull();
    expect(layout.days).toEqual([
      {
        day: 'Mo',
        date: null,
        x0: x(1),
        x1: x(5),
        columns: [
          { name: 'ALPHA 1', kind: 'planning', x0: x(1), x1: x(2) },
          { name: 'Rap', kind: 'rap', x0: x(2), x1: x(3) },
          { name: '', kind: 'unlabeled', x0: x(3), x1: x(4) },
          { name: 'Beso', kind: 'beso', x0: x(4), x1: x(5) },
        ],
      },
      {
        day: 'Di',
        date: null,
        x0: x(5),
        x1: x(9),
        columns: [
          { name: 'Stab', kind: 'planning', x0: x(5), x1: x(7) },
          { name: '', kind: 'unlabeled', x0: x(7), x1: x(9) },
        ],
      },
    ]);
    for (const day of layout.days) expectCover(day);
  });

  it('[R-L-11] (§2c) ausgeblendete Blattspalten haben Breite 0 und erzeugen keine Spalte', () => {
    const sheet = baseSheet('<col min="4" max="4" width="8" hidden="1" customWidth="1"/>');
    const x = (col: number) => sheet.colX(col);
    expect(x(3)).toBe(x(4));
    const mo = at(detectSheetLayout(sheet, time()).days, 0);
    expect(mo.columns.map((c) => [c.name, c.kind])).toEqual([
      ['ALPHA 1', 'planning'],
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ]);
    expectCover(mo);
  });

  it('[R-L-11] (§2c) Spaltenart nach Kopftext: rap, beso, sonst planning', () => {
    const labels = [
      ['Rap', 'rap'],
      ['Rapport', 'rap'],
      ['rapporte', 'rap'],
      ['Raps.', 'rap'],
      ['RAPE', 'rap'],
      ['Beso', 'beso'],
      ['Bes.', 'beso'],
      ['besonderes', 'beso'],
      ['Besondere', 'beso'],
      ['Rapportraum', 'planning'],
      ['Besuch', 'planning'],
      ['Rap Kp', 'planning'],
    ] as const;
    const letters = 'BCDEFGHIJKLM';
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('N1', 'Di') + inl('P1', 'Zeit'),
          2: labels.map(([text], i) => inl(`${letters[i]}2`, text)).join('') + inl('N2', 'X'),
        },
      }),
    );
    const { days } = detectSheetLayout(sheet, time());
    const mo = at(days, 0);
    const di = at(days, 1);
    expect(mo.columns.map((c) => [c.name, c.kind])).toEqual(labels.map(([n, k]) => [n, k]));
    expect(di.columns.map((c) => [c.name, c.kind])).toEqual([
      ['X', 'planning'],
      ['', 'unlabeled'],
    ]);
    expectCover(mo);
    expectCover(di);
  });

  it('[R-L-11] (§2c) Spalte über die Taggrenze wird auf den Tag begrenzt', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit'),
          2: inl('B2', 'Breit') + inl('D2', 'Stab'),
        },
        merges: ['B2:C2', 'D2:H2'],
      }),
    );
    const x = (col: number) => sheet.colX(col);
    const layout = detectSheetLayout(sheet, time());
    expect(at(layout.days, 1).columns).toEqual([
      { name: 'Stab', kind: 'planning', x0: x(3), x1: x(5) },
    ]);
    expect(at(layout.days, 0).columns).toEqual([
      { name: 'Breit', kind: 'planning', x0: x(1), x1: x(3) },
    ]);
  });

  it('[R-L-11] (§2c) rechte Grenze ohne «Zeit»: gridRight, wenn endlich, sonst 12 Spalten nach dem letzten Tag', () => {
    const xml = worksheetXml({
      rows: { 1: inl('B1', 'Mo') + inl('F1', 'Di'), 2: inl('B2', 'A') + inl('F2', 'B') },
    });
    const sheet = sheetModel(xml);
    const finite = detectSheetLayout(sheet, time(sheet.colX(9) + 1234));
    expect(at(finite.days, 1).x1).toBe(sheet.colX(9) + 1234);
    const infinite = detectSheetLayout(sheet, time());
    expect(at(infinite.days, 1).x1).toBe(sheet.colX(5 + 12));
    expectCover(at(finite.days, 1));
    expectCover(at(infinite.days, 1));
  });

  it('[R-L-11] (§2c) «Zeit» links des letzten Tags zählt nicht als rechte Grenze', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: { 1: inl('A1', 'Zeit') + inl('B1', 'Mo') + inl('D1', 'Di') + inl('H1', 'Zeit') },
      }),
    );
    expect(at(detectSheetLayout(sheet, time()).days, 1).x1).toBe(sheet.colX(7));
  });

  it('[R-L-11] (§2c) ohne Spaltenkopfzeile: subHeaderRow null und je Tag genau eine Spalte unlabeled', () => {
    const sheet = sheetModel(
      worksheetXml({ rows: { 1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit') } }),
    );
    const layout = detectSheetLayout(sheet, time());
    expect(layout.subHeaderRow).toBeNull();
    expect(layout.days.map((d) => d.columns)).toEqual([
      [{ name: '', kind: 'unlabeled', x0: sheet.colX(1), x1: sheet.colX(3) }],
      [{ name: '', kind: 'unlabeled', x0: sheet.colX(3), x1: sheet.colX(5) }],
    ]);
  });

  it('[R-L-11] (§2c 5) Lücke am Taganfang und zwischen Spalten wird je eine Spalte unlabeled (TR-E107-02)', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          2: inl('B2', 'Montag') + inl('F2', 'Dienstag') + inl('J2', 'Zeit'),
          3: inl('C3', 'ALPHA') + inl('E3', 'Beso'),
        },
        merges: ['B2:E2', 'F2:I2'],
      }),
    );
    const x = (col: number) => sheet.colX(col);
    const mo = at(detectSheetLayout(sheet, time()).days, 0);
    expect(mo.columns).toEqual([
      { name: '', kind: 'unlabeled', x0: x(1), x1: x(2) },
      { name: 'ALPHA', kind: 'planning', x0: x(2), x1: x(3) },
      { name: '', kind: 'unlabeled', x0: x(3), x1: x(4) },
      { name: 'Beso', kind: 'beso', x0: x(4), x1: x(5) },
    ]);
    expectCover(mo);
  });

  it('[R-L-11] (§2c 5) Verbund, der im Vortag beginnt und in den nächsten Tag reicht, gehört nur zum Vortag (TR-E107-07)', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit'),
          2: inl('C2', 'Breit'),
        },
        merges: ['C2:E2'],
      }),
    );
    const x = (col: number) => sheet.colX(col);
    const { days } = detectSheetLayout(sheet, time());
    const mo = at(days, 0);
    const di = at(days, 1);
    expect(mo.columns).toEqual([
      { name: '', kind: 'unlabeled', x0: x(1), x1: x(2) },
      { name: 'Breit', kind: 'planning', x0: x(2), x1: x(3) },
    ]);
    expect(di.columns).toEqual([{ name: '', kind: 'unlabeled', x0: x(3), x1: x(5) }]);
    expectCover(mo);
    expectCover(di);
  });

  it('[R-L-11] (§2c 3) Spaltenkopfzeile zählt nur Zellen im Tagesbereich (TR-E107-03)', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit'),
          2: inl('A2', 'links') + inl('F2', 'Zeit') + inl('G2', 'rechts'),
          3: inl('B3', 'P') + inl('D3', 'Q'),
        },
      }),
    );
    const layout = detectSheetLayout(sheet, time());
    expect(layout.subHeaderRow).toBe(2);
    expect(layout.days.map((d) => d.columns.map((c) => c.name))).toEqual([
      ['P', ''],
      ['Q', ''],
    ]);
  });

  it('[R-L-11] (§2c) Spaltenkopfzeile: nur die vier Zeilen nach der Kopfzeile, bei Gleichstand die erste', () => {
    const tie = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit'),
          3: inl('B3', 'P') + inl('D3', 'Q'),
          4: inl('B4', 'R') + inl('D4', 'S'),
        },
      }),
    );
    expect(detectSheetLayout(tie, time()).subHeaderRow).toBe(2);
    const far = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('D1', 'Di') + inl('F1', 'Zeit'),
          5: inl('B5', 'P'),
          6: inl('B6', 'R') + inl('C6', 'S') + inl('D6', 'T'),
        },
      }),
    );
    expect(detectSheetLayout(far, time()).subHeaderRow).toBe(4);
  });

  it('[R-L-11] (§2c) Tage nach Mo … So sortiert, je Wochentag die erste Fundstelle, Spalte = Anfang des Verbunds', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: { 1: inl('C1', 'Di') + inl('F1', 'Mo') + inl('H1', 'Di') + inl('J1', 'Zeit') },
        merges: ['B1:E1'],
      }),
    );
    const x = (col: number) => sheet.colX(col);
    const layout = detectSheetLayout(sheet, time());
    expect(layout.days.map((d) => [d.day, d.x0, d.x1])).toEqual([
      ['Mo', x(5), x(9)],
      ['Di', x(1), x(5)],
    ]);
  });

  it('[R-L-11] (§2c) Kopfzeile: erste Zeile mit den meisten verschiedenen Wochentagen', () => {
    const sheet = sheetModel(
      worksheetXml({
        rows: {
          1: inl('B1', 'Mo') + inl('C1', 'Di'),
          2: inl('B2', 'Mo') + inl('C2', 'Di') + inl('D2', 'Mi') + inl('E2', 'Zeit'),
          3: inl('B3', 'Do') + inl('C3', 'Fr') + inl('D3', 'Sa'),
          4: inl('B4', 'Mo') + inl('C4', 'Mo') + inl('D4', 'Mo') + inl('E4', 'Di'),
        },
      }),
    );
    const layout = detectSheetLayout(sheet, time());
    expect(layout.headerRow).toBe(1);
    expect(layout.days.map((d) => d.day)).toEqual(['Mo', 'Di', 'Mi']);
  });

  it('[R-L-11] (§2c Grenzwert) Kopfzeile in Zeile 29 (0-basiert) wird gefunden, in Zeile 30 nicht', () => {
    const at = (row: number) =>
      sheetModel(
        worksheetXml({ rows: { [row + 1]: inl(`B${row + 1}`, 'Mo') + inl(`D${row + 1}`, 'Di') } }),
      );
    expect(detectSheetLayout(at(29), time()).headerRow).toBe(29);
    expectCalibrationFailed(() => detectSheetLayout(at(30), time()));
  });

  it('[R-L-11] (§2c negativ) weniger als zwei verschiedene Wochentage: XlsxError calibrationFailed', () => {
    const one = sheetModel(worksheetXml({ rows: { 1: inl('B1', 'Montag') + inl('D1', 'Mo') } }));
    expectCalibrationFailed(() => detectSheetLayout(one, time()));
    const none = sheetModel(worksheetXml({ rows: { 1: inl('B1', 'Woche') + inl('D1', 'Zeit') } }));
    expectCalibrationFailed(() => detectSheetLayout(none, time()));
    expectCalibrationFailed(() => detectSheetLayout(sheetModel(worksheetXml()), time()));
  });

  it('[R-L-11] (§2c) Tage mit Breite 0 (ausgeblendete Spalte) entfallen', () => {
    const sheet = sheetModel(
      worksheetXml({
        cols: '<col min="2" max="2" width="8" hidden="1" customWidth="1"/>',
        rows: { 1: inl('B1', 'Mo') + inl('C1', 'Di') + inl('D1', 'Mi') + inl('E1', 'Zeit') },
      }),
    );
    expect(detectSheetLayout(sheet, time()).days.map((d) => d.day)).toEqual(['Di', 'Mi']);
  });

  describe('Startdatum', () => {
    it('[R-L-11] (§2c 6a) «Woche vom» mit Datum rechts davon, auf Montag zurückgesetzt; Vorrang vor (b)', () => {
      const sheet = sheetModel(
        worksheetXml({
          rows: {
            1:
              inl('A1', 'Woche vom') + numCell('B1', 30000) + numCell('C1', serialOf('2030-01-09')),
            2: inl('B2', 'Mo') + inl('C2', 'Di') + numCell('D2', serialOf('2030-02-14')),
          },
        }),
      );
      const layout = detectSheetLayout(sheet, time());
      expect(layout.startDate).toBe('2030-01-07');
      expect(layout.days.map((d) => [d.day, d.date])).toEqual([
        ['Mo', '2030-01-07'],
        ['Di', '2030-01-08'],
      ]);
    });

    it('[R-L-11] (§2c 6a) date1904 verschiebt die Seriennummer um 1462 Tage', () => {
      const sheet = sheetModel(
        worksheetXml({
          rows: {
            1: inl('A1', 'Woche vom') + numCell('B1', serialOf('2030-01-09') - 1462),
            2: inl('B2', 'Mo') + inl('C2', 'Di'),
          },
        }),
      );
      expect(detectSheetLayout(sheet, time(), true).startDate).toBe('2030-01-07');
      expect(detectSheetLayout(sheet, time(), false).startDate).toBe('2026-01-05');
      expect(detectSheetLayout(sheet, time()).startDate).toBe('2026-01-05');
    });

    it('[R-L-11] (§2c 6b) erstes Datum der Kopfzeile ab der Spalte des ersten Tags, auf Montag zurückgesetzt', () => {
      const sheet = sheetModel(
        worksheetXml({
          rows: {
            2:
              numCell('A2', serialOf('2031-05-05')) +
              inl('B2', 'Mo') +
              numCell('C2', serialOf('2030-01-10')) +
              inl('D2', 'Di') +
              numCell('E2', serialOf('2030-03-01')),
          },
        }),
      );
      expect(detectSheetLayout(sheet, time()).startDate).toBe('2030-01-07');
    });

    it('[R-L-11] (§2c 6c) «‹Tag› dd.mm.yyyy» und «‹Tag› dd.mm.yy», um den Wochentag zurückgerechnet', () => {
      const four = sheetModel(
        worksheetXml({
          rows: { 1: inl('B1', 'Mo') + inl('C1', 'Di') + inl('D1', 'Do 01.10.2026') },
        }),
      );
      const layout = detectSheetLayout(four, time());
      expect(layout.startDate).toBe('2026-09-28');
      expect(layout.days.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-29', '2026-10-01']);
      const two = sheetModel(
        worksheetXml({ rows: { 1: inl('B1', 'Fr') + inl('C1', 'Sa 03.10.26') } }),
      );
      const short = detectSheetLayout(two, time());
      expect(short.startDate).toBe('2026-09-28');
      expect(short.days.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-03']);
    });

    it('[R-L-11] (§2c 6c, P17) Datum minus Wochentag-Index, ohne Rücksetzen auf Montag, auch wenn Tag und Datum nicht passen', () => {
      // 01.10.2026 ist ein Donnerstag; die Zelle nennt «Di» → 01.10.2026 minus 1 Tag.
      const sheet = sheetModel(
        worksheetXml({ rows: { 1: inl('B1', 'Mo') + inl('C1', 'Di 01.10.2026') } }),
      );
      const layout = detectSheetLayout(sheet, time());
      expect(layout.startDate).toBe('2026-09-30');
      expect(layout.days.map((d) => d.date)).toEqual(['2026-09-30', '2026-10-01']);
    });

    it('[R-L-11] (§2c 6 negativ) Seriennummern 30000 und 80000 sind kein Datum; nichts gefunden ergibt null', () => {
      const sheet = sheetModel(
        worksheetXml({
          rows: {
            1: inl('A1', 'Woche vom') + numCell('B1', 30000) + numCell('C1', 80000),
            2: inl('B2', 'Mo') + numCell('C2', 80000) + inl('D2', 'Di'),
          },
        }),
      );
      const layout = detectSheetLayout(sheet, time());
      expect(layout.startDate).toBeNull();
      expect(layout.days.every((d) => d.date === null)).toBe(true);
    });
  });

  it('[R-L-11] (§2c) rein: gleiche Eingabe gleiches Ergebnis', () => {
    const sheet = baseSheet();
    expect(detectSheetLayout(sheet, time())).toEqual(detectSheetLayout(sheet, time()));
  });
});

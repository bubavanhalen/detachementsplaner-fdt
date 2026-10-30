// @vitest-environment jsdom
// Vertrag E1-07 §2c: Zeitkalibrierung calibrateSheetTime (Stundenmarken als Formen).
import { describe, expect, it } from 'vitest';
import {
  calibrateSheetTime,
  type WapShape,
  XlsxError,
  type XlsxErrorCode,
} from '../../../../src/io/xlsx-drawing';
import { at } from './fixture';

let counter = 0;
/** Marke: Box 20 breit, 10 hoch, y-Mitte = y, linke Kante = x. */
function label(lines: string[] | string, y: number, x = 0): WapShape {
  return {
    index: counter++,
    name: 'Marke',
    kind: 'sp',
    geometry: 'rect',
    box: { x0: x, y0: y - 5, x1: x + 20, y1: y + 5 },
    lines: typeof lines === 'string' ? [lines] : lines,
    fill: null,
    line: null,
    rotation: 0,
    vertical: '',
    groupDepth: 1,
  };
}

function expectXlsxError(fn: () => unknown, code: XlsxErrorCode): XlsxError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(XlsxError);
  const error = caught as XlsxError;
  expect(error.code).toBe(code);
  expect(error.message).toBe(`xlsx: ${code}`);
  expect(error.name).toBe('XlsxError');
  return error;
}

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));

describe('xlsx-drawing calibrateSheetTime (Vertrag E1-07 §2c)', () => {
  /** Zwei Markenspalten (x 0 und 1000) mit 0500/0600/0700, dazu eine Nicht-Stunde. */
  const twoColumns = () => {
    const left = [label('0500', 100), label('0600', 200), label('0700', 400)];
    const right = [label('0500', 100, 1000), label('0600', 200, 1000), label('0700', 400, 1000)];
    const other = label('0735', 250, 500);
    return { left, right, other, shapes: [...left, other, ...right] };
  };

  it('[R-L-11] (§2c positiv) Marken, stückweise lineares toMinute mit Verlängerung, Raster und labelShapes', () => {
    const { left, right, other, shapes } = twoColumns();
    const time = calibrateSheetTime(shapes);
    expect(time.labels).toEqual([
      { minute: 300, y: 100 },
      { minute: 360, y: 200 },
      { minute: 420, y: 400 },
    ]);
    close(time.toMinute(150), 330);
    close(time.toMinute(300), 390);
    close(time.toMinute(100), 300);
    close(time.toMinute(400), 420);
    close(time.toMinute(50), 270); // vor der ersten Marke: erster Abschnitt verlängert
    close(time.toMinute(500), 450); // nach der letzten Marke: letzter Abschnitt verlängert
    expect(time.gridLeft).toBe(20);
    expect(time.gridRight).toBe(1000);
    // Stunde = (400 - 100) / ((420 - 300) / 60) = 150
    close(time.gridTop, 100 - 150);
    close(time.gridBottom, 400 + 150 * 1.25);
    expect([...time.labelShapes].sort((a, b) => a - b)).toEqual(
      [...left, ...right].map((s) => s.index).sort((a, b) => a - b),
    );
    expect(time.labelShapes.has(other.index)).toBe(false);
  });

  it('[R-L-11] (§2c) toY ist die exakte Umkehrung von toMinute, auch ausserhalb der Marken', () => {
    const time = calibrateSheetTime(twoColumns().shapes);
    close(time.toY(330), 150);
    close(time.toY(390), 300);
    close(time.toY(270), 50);
    close(time.toY(450), 500);
    for (let minute = 0; minute <= 1440; minute += 5)
      close(time.toMinute(time.toY(minute)), minute);
    for (let y = -300; y <= 900; y += 7) close(time.toY(time.toMinute(y)), y);
  });

  it('[R-L-11] (§2c) eine Markenspalte: gridRight ist +Unendlich', () => {
    const time = calibrateSheetTime([label('0500', 100), label('0600', 200), label('0700', 300)]);
    expect(time.gridRight).toBe(Number.POSITIVE_INFINITY);
    expect(time.gridLeft).toBe(20);
  });

  it('[R-L-11] (§2c Grenzwerte) «2400» ergibt 1440, «0000» ergibt 0; Zeilen werden ohne Leerzeilen zusammengefügt', () => {
    const time = calibrateSheetTime([
      label('0000', 0),
      label(['22', '00'], 200),
      label(['', '2300', ''], 300),
      label('2400', 400),
    ]);
    expect(time.labels.map((l) => l.minute)).toEqual([0, 1320, 1380, 1440]);
  });

  it('[R-L-11] (§2c negativ) «2500», «0730», «700», «07 00» und «0700h» sind keine Kandidaten', () => {
    const marks = [label('0500', 100), label('0600', 200), label('0700', 300)];
    const strays = [
      label('2500', 350),
      label('0730', 250),
      label('700', 260),
      label('07 00', 270),
      label('0700h', 280),
    ];
    const time = calibrateSheetTime([...marks, ...strays]);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420]);
    for (const s of strays) expect(time.labelShapes.has(s.index)).toBe(false);
  });

  it('[R-L-11] (§2c) Gruppe mit weniger als drei verschiedenen Texten ist keine Markenspalte', () => {
    const column = [label('0500', 100), label('0600', 200), label('0700', 300)];
    const pair = [label('0800', 400, 500), label('0900', 500, 500), label('0800', 400, 500)];
    const time = calibrateSheetTime([...column, ...pair]);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420]);
    expect(time.gridRight).toBe(Number.POSITIVE_INFINITY);
    for (const s of pair) expect(time.labelShapes.has(s.index)).toBe(false);
  });

  it('[R-L-11] (§2c) Gruppierung nach x-Mitte mit Toleranz = Median der Breiten', () => {
    // Mitten 10, 25, 30 liegen höchstens 20 (Median-Breite) auseinander: eine Spalte.
    const time = calibrateSheetTime([
      label('0500', 100, 0),
      label('0600', 200, 15),
      label('0700', 300, 20),
    ]);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420]);
    // Abstand 21 > 20: drei Gruppen mit je einem Text, keine Markenspalte.
    expectXlsxError(
      () =>
        calibrateSheetTime([label('0500', 100, 0), label('0600', 200, 21), label('0700', 300, 42)]),
      'calibrationFailed',
    );
  });

  it('[R-L-11] (§2c, P18) Kette: Abstand zum zuletzt aufgenommenen Element zählt, nicht zum Gruppenanfang', () => {
    // Breiten je 20 → t = 20. Mitten 10, 30, 50, 70: je 20 zum Vorgänger, Gruppe wird 60 breit.
    // Nach «Gruppenanfang» wären es mehrere Gruppen mit weniger als drei Texten (calibrationFailed).
    const chain = [
      label('0500', 100, 0),
      label('0600', 200, 20),
      label('0700', 300, 40),
      label('0800', 400, 60),
    ];
    const time = calibrateSheetTime(chain);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420, 480]);
    expect([...time.labelShapes].sort((a, b) => a - b)).toEqual(chain.map((s) => s.index));
    expect(time.gridLeft).toBe(80);
    expect(time.gridRight).toBe(Number.POSITIVE_INFINITY);
  });

  it('[R-L-11] (§2c, P18) Toleranz = sortierte Breiten[floor(n/2)], mindestens 1', () => {
    const wide = (text: string, y: number, x: number, width: number): WapShape => {
      const s = label(text, y, x);
      return { ...s, box: { ...s.box, x1: x + width } };
    };
    // Breiten 10, 10, 30, 30 → Index 2 → t = 30; Mitten 5, 30, 55 (Abstände 25) bilden eine Kette.
    const four = [
      wide('0500', 100, 0, 10),
      wide('0600', 200, 25, 10),
      wide('0700', 300, 40, 30),
      wide('0700', 300, 2000, 30),
    ];
    expect(calibrateSheetTime(four).labels.map((l) => l.minute)).toEqual([300, 360, 420]);
    // Breiten 0 → t = 1: Mitten 0, 1, 2 bilden eine Kette, Mitte 3,5 nicht mehr.
    const thin = [
      wide('0500', 100, 0, 0),
      wide('0600', 200, 1, 0),
      wide('0700', 300, 2, 0),
      wide('0800', 400, 3.5, 0),
    ];
    const time = calibrateSheetTime(thin);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420]);
    expect(time.labelShapes.has(at(thin, 3).index)).toBe(false);
  });

  it('[R-L-11] (§2c) je Stunde Mittelwert der y-Mitten aus allen Markenspalten', () => {
    const time = calibrateSheetTime([
      label('0500', 100),
      label('0600', 200),
      label('0700', 300),
      label('0500', 110, 1000),
      label('0600', 210, 1000),
      label('0700', 330, 1000),
    ]);
    expect(time.labels).toEqual([
      { minute: 300, y: 105 },
      { minute: 360, y: 205 },
      { minute: 420, y: 315 },
    ]);
  });

  it('[R-L-11] (§2c) spätere Ausreisser, die y nicht streng steigen lassen, fallen weg', () => {
    const outlier = label('0800', 150);
    const equal = label('0900', 300);
    const time = calibrateSheetTime([
      label('0500', 100),
      label('0600', 200),
      label('0700', 300),
      outlier,
      equal,
      label('1000', 500),
    ]);
    expect(time.labels.map((l) => l.minute)).toEqual([300, 360, 420, 600]);
    // Ausreisser bleiben Teil der Markenspalte (nie Inhalt).
    expect(time.labelShapes.has(outlier.index)).toBe(true);
    expect(time.labelShapes.has(equal.index)).toBe(true);
  });

  it('[R-L-11] (§2c negativ) weniger als zwei Kandidaten: XlsxError calibrationFailed', () => {
    expectXlsxError(() => calibrateSheetTime([]), 'calibrationFailed');
    expectXlsxError(
      () => calibrateSheetTime([label('0500', 100), label('Text', 200)]),
      'calibrationFailed',
    );
  });

  it('[R-L-11] (§2c negativ) keine Markenspalte (nur zwei verschiedene Texte): calibrationFailed', () => {
    expectXlsxError(
      () => calibrateSheetTime([label('0500', 100), label('0600', 200), label('0500', 300)]),
      'calibrationFailed',
    );
  });

  it('[R-L-11] (§2c negativ) weniger als zwei Marken nach dem Filtern streng steigender y: calibrationFailed', () => {
    expectXlsxError(
      () => calibrateSheetTime([label('0500', 300), label('0600', 200), label('0700', 100)]),
      'calibrationFailed',
    );
  });

  it('[R-L-11] (§2c) rein: Eingabe unverändert, gleiche Eingabe gleiches Ergebnis', () => {
    const { shapes } = twoColumns();
    const before = structuredClone(shapes);
    const a = calibrateSheetTime(shapes);
    const b = calibrateSheetTime(shapes);
    expect(shapes).toEqual(before);
    expect(a.labels).toEqual(b.labels);
    expect([...a.labelShapes]).toEqual([...b.labelShapes]);
    expect([a.gridLeft, a.gridRight, a.gridTop, a.gridBottom]).toEqual([
      b.gridLeft,
      b.gridRight,
      b.gridTop,
      b.gridBottom,
    ]);
  });
});

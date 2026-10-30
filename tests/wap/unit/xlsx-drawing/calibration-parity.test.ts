// @vitest-environment jsdom
// Vertrag E1-07 §2c (Risiko R-09): Gleichlauf der neutralen Kalibrierung mit
// src/io/wap/calibrate.ts auf den synthetischen Arbeitsmappen von tests/wap-parser.test.ts.
// Gleiche Marken, gleiche toMinute-Werte, gleiche Tage und Spaltengrenzen.
import { describe, expect, it } from 'vitest';
import { calibrateTime, detectLayout } from '../../../../src/io/wap/calibrate';
import {
  calibrateSheetTime,
  detectSheetLayout,
  type SheetColumn,
  type SheetModel,
  type WapShape,
} from '../../../../src/io/xlsx-drawing';
import { parseTheme } from '../../../../src/io/xlsx-drawing/colors';
import { readDrawing } from '../../../../src/io/xlsx-drawing/drawing';
import { parseSharedStrings, parseSheet, parseStyles } from '../../../../src/io/xlsx-drawing/sheet';
import { openPackage, resolveSheet, uses1904 } from '../../../../src/io/xlsx-drawing/zip';
import { syntheticWap } from '../../../fixtures/wap-synthetic';
import { at } from './fixture';

interface Parsed {
  name: string;
  sheet: SheetModel;
  shapes: WapShape[];
  date1904: boolean;
}

function parsedSheets(): Parsed[] {
  const pkg = openPackage(syntheticWap());
  const out: Parsed[] = [];
  for (const name of ['Woche A', 'Woche B']) {
    const r = resolveSheet(pkg, name);
    const theme = parseTheme(r.themePath ? pkg.xml(r.themePath) : null);
    const sst = parseSharedStrings(r.sharedStringsPath ? pkg.xml(r.sharedStringsPath) : null);
    const styles = parseStyles(r.stylesPath ? pkg.text(r.stylesPath) : null, theme);
    const doc = pkg.xml(r.sheetPath);
    if (!doc) throw new Error('Fixture ohne Blatt');
    const sheet = parseSheet(doc, sst, styles);
    const drawing = r.drawingPath ? pkg.xml(r.drawingPath) : null;
    const shapes = drawing ? readDrawing(drawing, sheet, theme) : [];
    out.push({ name, sheet, shapes, date1904: uses1904(pkg) });
  }
  return out;
}

const KIND: Record<string, SheetColumn['kind']> = { group: 'planning', rap: 'rap', beso: 'beso' };

describe('xlsx-drawing Kalibrierung im Gleichlauf mit calibrate.ts (Vertrag E1-07 §2c, R-09)', () => {
  const sheets = parsedSheets();

  it('[R-L-11] (§2c Gleichlauf) Fixture enthält Stundenmarken und Tage (Vorbedingung)', () => {
    for (const p of sheets) {
      expect(p.shapes.length, p.name).toBeGreaterThan(0);
      expect(calibrateTime(p.shapes).labels.length, p.name).toBeGreaterThanOrEqual(2);
    }
    // Rot-Nachweis: die neutrale Kalibrierung muss auf denselben Formen auswertbar sein.
    for (const p of sheets)
      expect(calibrateSheetTime(p.shapes).labels.length).toBeGreaterThanOrEqual(2);
  });

  it.each(['Woche A', 'Woche B'])(
    '[R-L-11] (§2c Gleichlauf) %s: gleiche Marken, toMinute, Raster und labelShapes',
    (name) => {
      const p = sheets.find((s) => s.name === name);
      if (!p) throw new Error('Fixture-Blatt fehlt');
      const old = calibrateTime(p.shapes);
      const neu = calibrateSheetTime(p.shapes);
      expect(neu.labels).toEqual(old.labels.map((l) => ({ minute: l.minutes, y: l.y })));
      const first = at(old.labels, 0).y;
      const last = at(old.labels, old.labels.length - 1).y;
      for (let i = -10; i <= 110; i++) {
        const y = first + ((last - first) * i) / 100;
        expect(neu.toMinute(y)).toBeCloseTo(old.toMinutes(y), 9);
      }
      expect([neu.gridLeft, neu.gridRight]).toEqual([old.gridLeft, old.gridRight]);
      expect(neu.gridTop).toBeCloseTo(old.gridTop, 9);
      expect(neu.gridBottom).toBeCloseTo(old.gridBottom, 9);
      expect([...neu.labelShapes].sort((a, b) => a - b)).toEqual(
        [...old.labelShapes].sort((a, b) => a - b),
      );
    },
  );

  it.each(['Woche A', 'Woche B'])(
    '[R-L-11] (§2c Gleichlauf) %s: gleiche Tage, Daten, Kopfzeilen und beschriftete Spaltengrenzen',
    (name) => {
      const p = sheets.find((s) => s.name === name);
      if (!p) throw new Error('Fixture-Blatt fehlt');
      const old = detectLayout(p.sheet, calibrateTime(p.shapes), p.date1904);
      const neu = detectSheetLayout(p.sheet, calibrateSheetTime(p.shapes), p.date1904);
      expect(neu.startDate).toBe(old.startDate === '' ? null : old.startDate);
      expect(neu.headerRow).toBe(old.headerRow);
      expect(neu.subHeaderRow).toBe(old.subHeaderRow < 0 ? null : old.subHeaderRow);
      expect(neu.days.map((d) => [d.day, d.x0, d.x1])).toEqual(
        old.days.map((d) => [d.day, d.x0, d.x1]),
      );
      old.days.forEach((oldDay, i) => {
        const day = at(neu.days, i);
        const unlabeledOnly = oldDay.columns.length === 1 && at(oldDay.columns, 0).label === '';
        const expected = unlabeledOnly
          ? [{ name: '', kind: 'unlabeled', x0: oldDay.x0, x1: oldDay.x1 }]
          : oldDay.columns.map((c) => ({ name: c.label, kind: KIND[c.kind], x0: c.x0, x1: c.x1 }));
        const labelled = unlabeledOnly
          ? day.columns
          : day.columns.filter((c) => c.kind !== 'unlabeled');
        expect(labelled).toEqual(expected);
      });
    },
  );
});

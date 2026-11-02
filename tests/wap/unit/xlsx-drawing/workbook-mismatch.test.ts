// @vitest-environment jsdom
// Vertrag E1-07 §2g Punkt 6: Schutz gegen auseinanderlaufende Durchläufe ('shapeIndexMismatch').
// Im Normalfall tritt der Fall nie ein (§2d/§2e); er wird erzwungen, indem die Vertragsfunktionen
// readShapeRuns (runs.ts) bzw. readShapeFills (fills.ts) eine Map der falschen Grösse liefern.
// Der Aufrufweg über './runs' und './fills' ist Vertragsbestandteil (§2g «Aufrufweg», P14).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkbook, XlsxError } from '../../../../src/io/xlsx-drawing';
import { absAnchor, at, bareRun, buildXlsx, drawingXml, sp, txBody, worksheetXml } from './fixture';

const mode = vi.hoisted(() => ({ runs: false, fills: false }));

vi.mock('../../../../src/io/xlsx-drawing/runs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../../src/io/xlsx-drawing/runs')>();
  return {
    ...orig,
    readShapeRuns: (...args: Parameters<typeof orig.readShapeRuns>) =>
      mode.runs ? new Map() : orig.readShapeRuns(...args),
  };
});
vi.mock('../../../../src/io/xlsx-drawing/fills', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../../src/io/xlsx-drawing/fills')>();
  return {
    ...orig,
    readShapeFills: (...args: Parameters<typeof orig.readShapeFills>) =>
      mode.fills ? new Map() : orig.readShapeFills(...args),
  };
});

afterEach(() => {
  mode.runs = false;
  mode.fills = false;
});

const bytes = buildXlsx({
  sheets: [
    {
      name: 'Woche 1',
      sheetXml: worksheetXml(),
      drawingXml: drawingXml(
        absAnchor(
          0,
          0,
          100_000,
          100_000,
          sp({ name: 'Kasten', txBody: txBody([bareRun('Text')]) }),
        ) + absAnchor(0, 200_000, 100_000, 100_000, sp({ name: 'Leer' })),
      ),
    },
  ],
});

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(XlsxError);
    return (error as XlsxError).code;
  }
  return undefined;
}

describe('xlsx-drawing readWorkbook – shapeIndexMismatch (Vertrag E1-07 §2g 6)', () => {
  it('[R-L-11] (§2g 6 negativ) übereinstimmende Durchläufe: kein Fehler, je Form ein Eintrag', () => {
    const sheet = at(readWorkbook(bytes).sheets, 0);
    expect(sheet.shapes).toHaveLength(2);
    expect(sheet.runs.size).toBe(2);
    expect(sheet.fills.size).toBe(2);
  });

  it('[R-L-11] (§2g 6 positiv) runs.size ≠ shapes.length: shapeIndexMismatch', () => {
    mode.runs = true;
    expect(codeOf(() => readWorkbook(bytes))).toBe('shapeIndexMismatch');
  });

  it('[R-L-11] (§2g 6 positiv) fills.size ≠ shapes.length: shapeIndexMismatch', () => {
    mode.fills = true;
    expect(codeOf(() => readWorkbook(bytes))).toBe('shapeIndexMismatch');
  });
});

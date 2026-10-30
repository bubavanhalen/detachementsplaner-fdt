// @vitest-environment jsdom
// Vertrag E1-07, Änderungsnotiz Code-Review Runde 1, Punkt 1 «Excel-Grenzen»: G4 (Anker from/to,
// col ≤ 16 383, row ≤ 1 048 575) und G5 (Zellen und verbundene Bereiche) → 'corrupt'.
// Hinweisnotiz in E1-08.md, Tests 6 und 7. Alle Arbeitsmappen fiktiv.
import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../../../../src/io/xlsx-drawing';
import { expectXlsxCode, readValid } from './expect-xlsx';
import { at, buildXlsx, drawingXml, inl, sp, worksheetXml } from './fixture';

type N = number | string;

const point = (tag: 'from' | 'to', col: N, row: N): string =>
  `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`;

const shape = (): string => sp({ name: 'Kasten' });

const twoCell = (from: [N, N], to: [N, N]): string =>
  `<xdr:twoCellAnchor>${point('from', ...from)}${point('to', ...to)}${shape()}<xdr:clientData/></xdr:twoCellAnchor>`;

const oneCell = (from: [N, N]): string =>
  `<xdr:oneCellAnchor>${point('from', ...from)}<xdr:ext cx="100000" cy="100000"/>${shape()}<xdr:clientData/></xdr:oneCellAnchor>`;

const alternate = (branch: 'Choice' | 'Fallback', anchor: string): string =>
  branch === 'Choice'
    ? `<mc:AlternateContent><mc:Choice Requires="a14">${anchor}</mc:Choice><mc:Fallback/></mc:AlternateContent>`
    : `<mc:AlternateContent><mc:Choice Requires="a14"/><mc:Fallback>${anchor}</mc:Fallback></mc:AlternateContent>`;

const withDrawing = (anchors: string): Uint8Array =>
  buildXlsx({
    sheets: [{ name: 'Woche 1', sheetXml: worksheetXml(), drawingXml: drawingXml(anchors) }],
  });

const withSheet = (sheetXml: string): Uint8Array =>
  buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml }] });

const MAX_COL = 16_383;
const MAX_ROW = 1_048_575;

describe('xlsx-drawing readWorkbook – G4 Anker (Änderungsnotiz CR-1)', () => {
  it('[R-L-11] (G4 Grenzwert) twoCellAnchor: col 16 383 / row 1 048 575 gültig, 16 384 bzw. 1 048 576 in from oder to corrupt', () => {
    const ok = readValid(withDrawing(twoCell([MAX_COL, MAX_ROW], [MAX_COL, MAX_ROW])));
    expect(at(ok.sheets, 0).shapes).toHaveLength(1);
    for (const anchors of [
      twoCell([MAX_COL + 1, 0], [MAX_COL, 1]),
      twoCell([0, 0], [MAX_COL + 1, 1]),
      twoCell([0, MAX_ROW + 1], [1, MAX_ROW]),
      twoCell([0, 0], [1, MAX_ROW + 1]),
    ])
      expectXlsxCode(() => readWorkbook(withDrawing(anchors)), 'corrupt');
  });

  it('[R-L-11] (G4 Grenzwert) oneCellAnchor: col 16 383 / row 1 048 575 gültig, 16 384 bzw. 1 048 576 corrupt', () => {
    const ok = readValid(withDrawing(oneCell([MAX_COL, MAX_ROW])));
    expect(at(ok.sheets, 0).shapes).toHaveLength(1);
    expectXlsxCode(() => readWorkbook(withDrawing(oneCell([MAX_COL + 1, 0]))), 'corrupt');
    expectXlsxCode(() => readWorkbook(withDrawing(oneCell([0, MAX_ROW + 1]))), 'corrupt');
  });

  it('[R-L-11] (G4 Grenzwert) Anker in mc:AlternateContent (Choice und Fallback): Grenzwert gültig, darüber corrupt', () => {
    for (const branch of ['Choice', 'Fallback'] as const) {
      const ok = readValid(
        withDrawing(alternate(branch, twoCell([MAX_COL, MAX_ROW], [MAX_COL, MAX_ROW]))),
      );
      expect(ok.sheets.map((s) => s.name)).toEqual(['Woche 1']);
      expectXlsxCode(
        () => readWorkbook(withDrawing(alternate(branch, twoCell([MAX_COL + 1, 0], [1, 1])))),
        'corrupt',
      );
      expectXlsxCode(
        () => readWorkbook(withDrawing(alternate(branch, oneCell([0, MAX_ROW + 1])))),
        'corrupt',
      );
    }
  });

  it('[R-L-11] (G4) Wert «1e7» (Auslesung als Zahl wie drawing.ts): corrupt', () => {
    expectXlsxCode(() => readWorkbook(withDrawing(twoCell(['1e7', 0], [1, 1]))), 'corrupt');
  });
});

describe('xlsx-drawing readWorkbook – G5 Zellen und Verbünde (Änderungsnotiz CR-1)', () => {
  it('[R-L-11] (G5 Grenzwert) Zelle XFD1048576 gültig; XFE1 und A1048577 corrupt', () => {
    const ok = readValid(withSheet(worksheetXml({ rows: { 1048576: inl('XFD1048576', 'Ende') } })));
    expect(at(ok.sheets, 0).model.cells.map((c) => [c.row, c.col])).toEqual([[MAX_ROW, MAX_COL]]);
    expectXlsxCode(
      () => readWorkbook(withSheet(worksheetXml({ rows: { 1: inl('XFE1', 'Zu weit') } }))),
      'corrupt',
    );
    expectXlsxCode(
      () =>
        readWorkbook(withSheet(worksheetXml({ rows: { 1048577: inl('A1048577', 'Zu tief') } }))),
      'corrupt',
    );
  });

  it('[R-L-11] (G5 Grenzwert) mergeCell bis XFD1048576 gültig; A1:A1048577 und A1:XFE1 corrupt', () => {
    const ok = readValid(
      withSheet(
        worksheetXml({ rows: { 1: inl('A1', 'Kopf') }, merges: ['XFC1048575:XFD1048576'] }),
      ),
    );
    expect(at(ok.sheets, 0).model.merges).toEqual([
      { r0: MAX_ROW - 1, c0: MAX_COL - 1, r1: MAX_ROW, c1: MAX_COL },
    ]);
    for (const merge of ['A1:A1048577', 'A1:XFE1'])
      expectXlsxCode(
        () =>
          readWorkbook(
            withSheet(worksheetXml({ rows: { 1: inl('A1', 'Kopf') }, merges: [merge] })),
          ),
        'corrupt',
      );
  });
});

// @vitest-environment jsdom
// Vertrag E1-07 §2a und §2g: readWorkbook – Prüfreihenfolge, XlsxError, Ergebnis.
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readWorkbook,
  type Workbook,
  XlsxError,
  type XlsxErrorCode,
} from '../../../../src/io/xlsx-drawing';
import {
  absAnchor,
  at,
  bareRun,
  buildXlsx,
  drawingXml,
  type FixtureWorkbook,
  inl,
  mixedDrawingXml,
  numCell,
  run,
  sharedStringsXml,
  solid,
  sp,
  sstCell,
  stylesXml,
  themeXml,
  txBody,
  worksheetXml,
  zipParts,
} from './fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

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
  expect(error).toBeInstanceOf(Error);
  return error;
}

const simpleSheet = (text = 'Fiktiver Inhalt') => worksheetXml({ rows: { 1: inl('A1', text) } });
const valid = (patch: Partial<FixtureWorkbook> = {}): Uint8Array =>
  buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml: simpleSheet() }], ...patch });

describe('xlsx-drawing readWorkbook – Fehler (Vertrag E1-07 §2a, §2g)', () => {
  it('[R-L-11] (§2g 1) OLE-Signatur (altes .xls, verschlüsseltes .xlsx): oldXlsFormat', () => {
    expectXlsxError(() => readWorkbook(new Uint8Array([...OLE, 0, 0, 0, 0])), 'oldXlsFormat');
    expectXlsxError(() => readWorkbook(new Uint8Array(OLE)), 'oldXlsFormat');
    // Signatur hat Vorrang, auch wenn danach ein ZIP folgt.
    expectXlsxError(() => readWorkbook(new Uint8Array([...OLE, ...valid()])), 'oldXlsFormat');
  });

  it('[R-L-11] (§2g 2) kein «PK» am Anfang, auch leer, ein Byte, unvollständige OLE-Signatur: notXlsx', () => {
    expectXlsxError(() => readWorkbook(new Uint8Array()), 'notXlsx');
    expectXlsxError(() => readWorkbook(new Uint8Array([0x50])), 'notXlsx');
    expectXlsxError(() => readWorkbook(new Uint8Array(OLE.slice(0, 7))), 'notXlsx');
    expectXlsxError(
      () => readWorkbook(strToU8('<html><body>keine Mappe</body></html>')),
      'notXlsx',
    );
    expectXlsxError(() => readWorkbook(strToU8('Spalte;Wert\nA;1\n')), 'notXlsx');
    expectXlsxError(() => readWorkbook(new Uint8Array([0x4b, 0x50, 0x03, 0x04])), 'notXlsx');
  });

  it('[R-L-11] (§2g 3) «PK» aber nicht entpackbar: corrupt mit cause', () => {
    const garbage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    const error = expectXlsxError(() => readWorkbook(garbage), 'corrupt');
    expect(error.cause).toBeDefined();
    const bytes = valid();
    expectXlsxError(() => readWorkbook(bytes.slice(0, Math.floor(bytes.length / 2))), 'corrupt');
    expectXlsxError(() => readWorkbook(new Uint8Array([0x50, 0x4b])), 'corrupt');
  });

  it('[R-L-11] (§2g 4) ZIP ohne Arbeitsmappen-Teil: unsupported', () => {
    expectXlsxError(
      () => readWorkbook(zipParts({ 'word/document.xml': '<document/>', 'readme.xml': '<x/>' })),
      'unsupported',
    );
    expectXlsxError(() => readWorkbook(zipSync({})), 'unsupported');
  });

  it('[R-L-11] (§2g 4) nur Diagrammblätter: unsupported; mit Arbeitsblatt dagegen gültig', () => {
    expectXlsxError(
      () => readWorkbook(buildXlsx({ sheets: [{ chartsheet: 'Diagramm' }] })),
      'unsupported',
    );
    const mixed = readWorkbook(
      buildXlsx({
        sheets: [{ chartsheet: 'Diagramm' }, { name: 'Daten', sheetXml: simpleSheet() }],
      }),
    );
    expect(mixed.sheets.map((s) => s.name)).toEqual(['Daten']);
  });

  it('[R-L-11] (§2g 5) ungültiges XML in Arbeitsmappe, Blatt, Zeichnung, gemeinsamen Zeichenfolgen oder Design: corrupt', () => {
    const broken = '<?xml version="1.0"?><kaputt><offen></kaputt>';
    const cases: [string, Uint8Array][] = [
      ['Arbeitsmappe', valid({ workbookXmlOverride: broken })],
      ['Blatt', buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml: broken }] })],
      [
        'Zeichnung',
        buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml: simpleSheet(), drawingXml: broken }] }),
      ],
      ['Zeichenfolgen', valid({ sharedStringsXml: broken })],
      ['Design', valid({ themeXml: broken })],
    ];
    for (const [part, bytes] of cases) {
      const error = expectXlsxError(() => readWorkbook(bytes), 'corrupt');
      expect(error.cause, part).toBeDefined();
    }
  });

  it('[R-L-11] (§2a) Meldung enthält nur den Code, nie Blattnamen, Texte oder Teilpfade', () => {
    const secret = 'Geheimblatt Muster';
    const bytes = buildXlsx({
      sheets: [{ name: secret, sheetXml: `<worksheet><kaputt>${secret}</worksheet>` }],
    });
    const error = expectXlsxError(() => readWorkbook(bytes), 'corrupt');
    expect(error.message).not.toContain('Geheim');
    expect(error.message).not.toContain('xl/');
    expect(String(error)).toBe('XlsxError: xlsx: corrupt');
  });

  it('[R-L-11] (§2a) Fehlerfälle schreiben nichts in die Konsole und machen keine Netzanfrage', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expectXlsxError(() => readWorkbook(new Uint8Array()), 'notXlsx');
    expectXlsxError(() => readWorkbook(new Uint8Array([0x50, 0x4b, 9, 9])), 'corrupt');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('xlsx-drawing readWorkbook – Ergebnis (Vertrag E1-07 §2g)', () => {
  const sst = sharedStringsXml([
    '<t>Gemeinsam</t>',
    '<r><rPr><b/></rPr><t>Fett</t></r><r><t> normal</t></r>',
  ]);
  const drawing = drawingXml(
    absAnchor(
      1000,
      2000,
      300_000,
      200_000,
      sp({
        name: 'Kasten',
        props: solid('CCECFF', 60000),
        txBody: txBody([run('Ausb', 'b="1"'), bareRun('Zfhr')]),
      }),
    ),
  );
  const spec: FixtureWorkbook = {
    sheets: [
      {
        name: 'Woche B',
        sheetXml: worksheetXml({
          rows: { 1: sstCell('A1', 0, 1) + sstCell('B1', 1) + numCell('C1', 7) },
        }),
        drawingXml: drawing,
      },
      { chartsheet: 'Diagramm' },
      { name: 'Versteckt', sheetXml: simpleSheet('x'), state: 'hidden' },
      { name: 'Sehr versteckt', sheetXml: simpleSheet('y'), state: 'veryHidden' },
      { name: 'Woche A', sheetXml: simpleSheet('z'), state: 'visible' },
    ],
    sharedStringsXml: sst,
    stylesXml: stylesXml('A1B2C3'),
    themeXml: themeXml({ accent1: '123456' }),
    date1904: true,
  };

  it('[R-L-11] (§2g) alle Arbeitsblätter in Mappenreihenfolge mit hidden; Diagrammblätter fehlen', () => {
    const wb = readWorkbook(buildXlsx(spec));
    expect(wb.sheets.map((s) => [s.name, s.hidden])).toEqual([
      ['Woche B', false],
      ['Versteckt', true],
      ['Sehr versteckt', true],
      ['Woche A', false],
    ]);
  });

  it('[R-L-11] (§2g) model mit gemeinsamen Zeichenfolgen und Formatvorlagen; richText nach §2f', () => {
    const sheet = at(readWorkbook(buildXlsx(spec)).sheets, 0);
    const a1 = sheet.model.cellAt(0, 0);
    expect(a1?.text).toBe('Gemeinsam');
    expect(sheet.model.fillOf(a1)).toBe('A1B2C3');
    expect(sheet.model.cellAt(0, 1)?.text).toBe('Fett normal');
    expect(sheet.model.cellAt(0, 2)?.value).toBe(7);
    expect([...sheet.richText.keys()]).toEqual(['B1']);
    expect(sheet.richText.get('B1')).toEqual([
      { text: 'Fett', bold: true, strike: false, color: null },
      { text: ' normal', bold: false, strike: false, color: null },
    ]);
  });

  it('[R-L-11] (§2g) shapes aus der verknüpften Zeichnung, runs und fills je WapShape.index', () => {
    const sheet = at(readWorkbook(buildXlsx(spec)).sheets, 0);
    expect(sheet.shapes.map((s) => [s.index, s.name, s.lines, s.fill])).toEqual([
      [0, 'Kasten', ['Ausb', 'Zfhr'], 'CCECFF'],
    ]);
    expect(sheet.runs.get(0)?.map((r) => [r.text, r.line, r.bold])).toEqual([
      ['Ausb', 0, true],
      ['Zfhr', 1, false],
    ]);
    expect(sheet.fills.get(0)?.fillAlpha).toBe(0.6);
  });

  it('[R-L-11] (§2g) Blatt ohne Zeichnung: shapes [], runs und fills leer', () => {
    const wb = readWorkbook(buildXlsx(spec));
    for (const sheet of wb.sheets.slice(1)) {
      expect(sheet.shapes).toEqual([]);
      expect(sheet.runs.size).toBe(0);
      expect(sheet.fills.size).toBe(0);
      expect(sheet.richText.size).toBe(0);
    }
  });

  it('[R-L-11] (§2g) runs und fills haben je Blatt genau die Schlüssel 0 … n-1', () => {
    const wb = readWorkbook(
      buildXlsx({
        sheets: [{ name: 'Gemischt', sheetXml: simpleSheet(), drawingXml: mixedDrawingXml() }],
      }),
    );
    const sheet = at(wb.sheets, 0);
    const expected = sheet.shapes.map((_, i) => i);
    expect(sheet.shapes.length).toBeGreaterThan(5);
    expect(sheet.shapes.map((s) => s.index)).toEqual(expected);
    expect([...sheet.runs.keys()].sort((a, b) => a - b)).toEqual(expected);
    expect([...sheet.fills.keys()].sort((a, b) => a - b)).toEqual(expected);
  });

  it('[R-L-11] (§2g) theme aus dem Design-Teil, date1904 aus workbookPr', () => {
    const wb = readWorkbook(buildXlsx(spec));
    expect(wb.theme.scheme.accent1).toBe('123456');
    expect(wb.date1904).toBe(true);
  });

  it('[R-L-11] (§2g) ohne Design Standardfarben, ohne workbookPr date1904 false, ohne Zeichenfolgen gültig', () => {
    const wb = readWorkbook(valid());
    expect(wb.theme.scheme.accent1).toBe('4472C4');
    expect(wb.theme.scheme.dk1).toBe('000000');
    expect(wb.date1904).toBe(false);
    expect(at(wb.sheets, 0).model.cellAt(0, 0)?.text).toBe('Fiktiver Inhalt');
  });

  it('[R-L-11] (§2g) deterministisch, ohne Konsole und ohne Netz', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const bytes = buildXlsx(spec);
    const view = (wb: Workbook) => ({
      theme: wb.theme,
      date1904: wb.date1904,
      sheets: wb.sheets.map((s) => ({
        name: s.name,
        hidden: s.hidden,
        shapes: s.shapes,
        runs: [...s.runs.entries()],
        fills: [...s.fills.entries()],
        richText: [...s.richText.entries()],
        cells: s.model.cells,
        merges: s.model.merges,
      })),
    });
    expect(view(readWorkbook(bytes))).toEqual(view(readWorkbook(bytes)));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

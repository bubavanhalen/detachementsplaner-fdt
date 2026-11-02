// @vitest-environment jsdom
// Vertrag E1-07, Änderungsnotiz Code-Review Runde 1, Punkt 1 «Nur gebrauchte Teile entpacken» und
// «Grösse eines Teils» (fflate 0.8.3 schneidet bei zu kleiner Angabe ab). Hinweisnotiz in E1-08.md,
// Tests 4 und 5. Grosse Angaben nur im Zentralverzeichnis (zip-directory.ts); alle Mappen fiktiv.
import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../../../../src/io/xlsx-drawing';
import { expectXlsxCode, plainWorkbook, readValid } from './expect-xlsx';
import {
  absAnchor,
  bareRun,
  buildXlsx,
  drawingXml,
  type FixtureWorkbook,
  inl,
  sharedStringsXml,
  sp,
  stylesXml,
  themeXml,
  txBody,
  worksheetXml,
} from './fixture';
import { entryOf, withBrokenDeflate, withDeclaredSizes } from './zip-directory';

const GIB = 1024 * 1024 * 1024;
const SHEET = 'xl/worksheets/sheet1.xml';

const spec: FixtureWorkbook = {
  sheets: [
    {
      name: 'Woche 1',
      sheetXml: worksheetXml({
        rows: { 1: inl('A1', 'Fiktiver Kopf') + inl('B1', 'Zweite Zelle'), 2: inl('A2', 'Mehr') },
      }),
      drawingXml: drawingXml(
        absAnchor(
          0,
          0,
          100_000,
          100_000,
          sp({ name: 'Kasten', txBody: txBody([bareRun('Text')]) }),
        ),
      ),
    },
  ],
  // Gebrauchte Teile auch für Formatvorlagen, gemeinsame Zeichenfolgen und Design (TR-E107-08).
  stylesXml: stylesXml('FFEE00'),
  sharedStringsXml: sharedStringsXml(['<t>Fiktive Zeichenfolge</t>']),
  themeXml: themeXml({ dk1: '101010', lt1: 'FFFFFF' }),
};

/** Ungebrauchte XML-Teile (Vertrag: calcChain.xml, docProps/*, Diagramme werden nie entpackt). */
const UNUSED = {
  'xl/calcChain.xml':
    '<?xml version="1.0" encoding="UTF-8"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="A1" i="1"/></calcChain>',
  'docProps/app.xml':
    '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fiktiv</Application></Properties>',
  'xl/charts/chart1.xml':
    '<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>',
};

describe('xlsx-drawing readWorkbook – nur gebrauchte Teile (Änderungsnotiz CR-1 Punkt 1)', () => {
  it('[R-L-11] (nur gebrauchte Teile) ungebrauchte Teile mit kaputten deflate-Daten oder angegebenen 1 GiB: gültig, Ergebnis gleich wie ohne sie', () => {
    const without = plainWorkbook(readValid(buildXlsx(spec)));
    let bytes = buildXlsx({ ...spec, extraParts: UNUSED });
    // calcChain.xml: kaputte Daten; app.xml: 1 GiB angegeben; chart1.xml: beides.
    bytes = withBrokenDeflate(bytes, 'xl/calcChain.xml');
    bytes = withDeclaredSizes(bytes, 'docProps/app.xml', { originalSize: GIB });
    bytes = withBrokenDeflate(bytes, 'xl/charts/chart1.xml');
    bytes = withDeclaredSizes(bytes, 'xl/charts/chart1.xml', { originalSize: GIB });
    expect(plainWorkbook(readValid(bytes))).toEqual(without);
  });

  it('[R-L-11] (nur gebrauchte Teile, negativ; TR-E107-08) gebrauchter Teil mit kaputten deflate-Daten, auch Formatvorlagen, gemeinsame Zeichenfolgen, Design: corrupt mit cause', () => {
    for (const part of [
      SHEET,
      'xl/drawings/drawing1.xml',
      'xl/workbook.xml',
      'xl/styles.xml',
      'xl/sharedStrings.xml',
      'xl/theme/theme1.xml',
    ]) {
      const error = expectXlsxCode(
        () => readWorkbook(withBrokenDeflate(buildXlsx(spec), part)),
        'corrupt',
      );
      expect(error.cause).toBeDefined();
    }
  });

  it('[R-L-11] (zu kleine Angabe) gebrauchtes Blatt mit originalSize kleiner als der Inhalt: abgeschnittenes XML, corrupt', () => {
    const bytes = buildXlsx(spec);
    expect(entryOf(bytes, SHEET).originalSize).toBeGreaterThan(100); // Fixture-Prüfung
    for (const originalSize of [100, entryOf(bytes, SHEET).originalSize - 1]) {
      expectXlsxCode(
        () => readWorkbook(withDeclaredSizes(bytes, SHEET, { originalSize })),
        'corrupt',
      );
    }
  });
});

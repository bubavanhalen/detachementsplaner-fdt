// @vitest-environment jsdom
// Vertrag E1-07, Änderungsnotiz Code-Review Runde 1 (04.10.2026), Punkt 1 und 2 (CR-E107-02, -03):
// Ressourcengrenzen G1–G3 von readWorkbook, Code 'tooLarge', XLSX_LIMITS (limits.ts über index.ts).
// Hinweisnotiz in E1-08.md, Tests 1–3. Grosse Teile werden nur im Zentralverzeichnis *angegeben*
// (Testhilfe zip-directory.ts); kein Test erzeugt grosse Puffer. Alle Arbeitsmappen sind fiktiv.
import { describe, expect, it } from 'vitest';
import * as xlsx from '../../../../src/io/xlsx-drawing';
import { readWorkbook } from '../../../../src/io/xlsx-drawing';
import { expectXlsxCode, plainWorkbook, readValid } from './expect-xlsx';
import {
  absAnchor,
  at,
  bareRun,
  buildXlsx,
  drawingXml,
  type FixtureWorkbook,
  inl,
  sharedStringsXml,
  sp,
  sstCell,
  stylesXml,
  themeXml,
  txBody,
  worksheetXml,
} from './fixture';
import {
  centralEntries,
  declaredSize,
  entryOf,
  withBrokenDeflate,
  withDeclaredSizes,
  withEntryCount,
} from './zip-directory';

const MIB = 1024 * 1024;
const G2 = 32 * MIB; // 33 554 432
const G3 = 16 * MIB; // 16 777 216
const GIB = 1024 * MIB;

const SHEET = 'xl/worksheets/sheet1.xml';
const STYLES = 'xl/styles.xml';

/** Kleine Mappe mit allen Teilarten: Blatt mit Zeichnung, gemeinsame Zeichenfolgen, Formatvorlagen, Design. */
const fullSpec: FixtureWorkbook = {
  sheets: [
    {
      name: 'Woche 1',
      sheetXml: worksheetXml({ rows: { 1: sstCell('A1', 0, 1) + inl('B1', 'Fiktiv') } }),
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
  sharedStringsXml: sharedStringsXml(['<t>Fiktive Zeichenfolge</t>']),
  stylesXml: stylesXml('FFEE00'),
  themeXml: themeXml({ dk1: '101010', lt1: 'FFFFFF' }),
};
const fullBytes = buildXlsx(fullSpec);

/** Als XML geparste Teile nach G3 (ohne [Content_Types].xml und ohne Formatvorlagen). */
const G3_PARTS = [
  '_rels/.rels',
  'xl/_rels/workbook.xml.rels',
  'xl/workbook.xml',
  'xl/theme/theme1.xml',
  'xl/sharedStrings.xml',
  SHEET,
  'xl/worksheets/_rels/sheet1.xml.rels',
  'xl/drawings/drawing1.xml',
];

describe('xlsx-drawing readWorkbook – Ressourcengrenzen G1–G3 (Änderungsnotiz CR-1, CR-E107-03)', () => {
  it('[R-L-11] (CR-1 limits.ts) XLSX_LIMITS über index.ts mit den Werten der Änderungsnotiz', () => {
    expect(Reflect.get(xlsx, 'XLSX_LIMITS')).toEqual({
      maxEntries: 10_000,
      maxStylesBytes: 33_554_432,
      maxXmlBytes: 16_777_216,
      maxCol: 16_383,
      maxRow: 1_048_575,
    });
  });

  it('[R-L-11] (G1 Grenzwert) 10 000 Einträge im Zentralverzeichnis gültig, 10 001 tooLarge', () => {
    const base = buildXlsx({
      sheets: [{ name: 'Woche 1', sheetXml: worksheetXml({ rows: { 1: inl('A1', 'Fiktiv') } }) }],
    });
    const withEntries = (total: number): Uint8Array => {
      const bytes = withEntryCount(base, total);
      expect(centralEntries(bytes)).toHaveLength(total); // Fixture-Prüfung
      return bytes;
    };
    const atLimit = readValid(withEntries(10_000));
    expect(atLimit.sheets.map((s) => s.name)).toEqual(['Woche 1']);
    expectXlsxCode(() => readWorkbook(withEntries(10_001)), 'tooLarge');
  });

  it('[R-L-11] (G1 vor gebrauchten Teilen, §2g neu 4 vor 5; TR-E107-10) 10 001 Einträge und kaputte xl/workbook.xml: tooLarge', () => {
    const base = buildXlsx({
      sheets: [{ name: 'Woche 1', sheetXml: worksheetXml({ rows: { 1: inl('A1', 'Fiktiv') } }) }],
    });
    const bytes = withBrokenDeflate(withEntryCount(base, 10_001), 'xl/workbook.xml');
    expect(centralEntries(bytes)).toHaveLength(10_001); // Fixture-Prüfung
    expectXlsxCode(() => readWorkbook(bytes), 'tooLarge');
  });

  it('[R-L-11] (G2 Grenzwert) Formatvorlagen angegeben 33 554 432 B gültig (zählen nicht zu G3), 33 554 433 B tooLarge', () => {
    const baseline = plainWorkbook(readValid(fullBytes));
    const atLimit = withDeclaredSizes(fullBytes, STYLES, { originalSize: G2 });
    expect(declaredSize(entryOf(atLimit, STYLES))).toBe(G2); // Fixture-Prüfung
    // Formatvorlagen wirken (Füllung aus Stil 1), Ergebnis gleich wie mit der wahren Angabe.
    const read = readValid(atLimit);
    expect(plainWorkbook(read)).toEqual(baseline);
    const sheet = at(read.sheets, 0);
    expect(sheet.model.fillOf(sheet.model.cellAt(0, 0))).not.toBeNull();
    expectXlsxCode(
      () => readWorkbook(withDeclaredSizes(fullBytes, STYLES, { originalSize: G2 + 1 })),
      'tooLarge',
    );
  });

  it('[R-L-11] (G2, CR-E107-02) Formatvorlagen angegeben über der Zeichenkettengrenze (600 MB): tooLarge, kein roher Error', () => {
    const bytes = withDeclaredSizes(fullBytes, STYLES, { originalSize: 600_000_000 });
    expectXlsxCode(() => readWorkbook(bytes), 'tooLarge');
  });

  it('[R-L-11] (G3 Grenzwert) Summe der XML-Teile genau 16 777 216 B gültig, 16 777 217 B tooLarge', () => {
    // Fixture-Prüfung: genau diese Teile plus [Content_Types].xml und Formatvorlagen.
    expect(
      centralEntries(fullBytes)
        .map((e) => e.name)
        .sort(),
    ).toEqual([...G3_PARTS, '[Content_Types].xml', STYLES].sort());
    const others = G3_PARTS.filter((p) => p !== SHEET).reduce(
      (sum, name) => sum + declaredSize(entryOf(fullBytes, name)),
      0,
    );
    const baseline = plainWorkbook(readValid(fullBytes));
    const atLimit = withDeclaredSizes(fullBytes, SHEET, { originalSize: G3 - others });
    expect(G3_PARTS.reduce((sum, name) => sum + declaredSize(entryOf(atLimit, name)), 0)).toBe(G3);
    expect(plainWorkbook(readValid(atLimit))).toEqual(baseline);
    const over = withDeclaredSizes(fullBytes, SHEET, { originalSize: G3 - others + 1 });
    expectXlsxCode(() => readWorkbook(over), 'tooLarge');
  });

  it('[R-L-11] (G3, Grösse = max(size, originalSize)) angegebene komprimierte Grösse über 16 MiB: tooLarge', () => {
    const entry = entryOf(fullBytes, SHEET);
    expect(entry.originalSize).toBeLessThan(MIB); // Fixture-Prüfung: nur size ist gross
    const bytes = withDeclaredSizes(fullBytes, SHEET, { size: G3 + 1 });
    expectXlsxCode(() => readWorkbook(bytes), 'tooLarge');
  });

  it('[R-L-11] (G3 vor dem Entpacken) Blatt mit angegebenen 1 GiB und kaputten deflate-Daten: tooLarge, nicht corrupt', () => {
    const broken = withBrokenDeflate(fullBytes, SHEET);
    // Gegenprobe: mit wahrer Angabe ist derselbe Defekt 'corrupt' (§2g 5).
    expectXlsxCode(() => readWorkbook(broken), 'corrupt');
    const bytes = withDeclaredSizes(broken, SHEET, { originalSize: GIB });
    expectXlsxCode(() => readWorkbook(bytes), 'tooLarge');
  });

  it('[R-L-11] (G2 vor dem Entpacken; TR-E107-09) Formatvorlagen mit angegebenen 33 554 433 B und kaputten deflate-Daten: tooLarge, nicht corrupt', () => {
    const broken = withBrokenDeflate(fullBytes, STYLES);
    // Gegenprobe: mit wahrer Angabe ist derselbe Defekt 'corrupt' (§2g 5).
    expectXlsxCode(() => readWorkbook(broken), 'corrupt');
    const bytes = withDeclaredSizes(broken, STYLES, { originalSize: G2 + 1 });
    expectXlsxCode(() => readWorkbook(bytes), 'tooLarge');
  });
});

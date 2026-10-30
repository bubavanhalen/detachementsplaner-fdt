// Gemeinsame Erwartungen der Nachtrag-Tests Code-Review Runde 1 (Vertrag E1-07, Änderungsnotiz).
// Nur über den Vertrag (index.ts); keine Inhalte in Meldungen.
import { expect } from 'vitest';
import { readWorkbook, type Workbook, XlsxError } from '../../../../src/io/xlsx-drawing';

/**
 * Liest eine gültige Mappe. Wirft readWorkbook, scheitert der Test an einer Assertion
 * (die Meldung von XlsxError enthält nur den Code).
 */
export function readValid(bytes: Uint8Array): Workbook {
  let caught: unknown;
  let workbook: Workbook | undefined;
  try {
    workbook = readWorkbook(bytes);
  } catch (error) {
    caught = error;
  }
  expect(caught, 'gültige Mappe: kein Fehler erwartet').toBeUndefined();
  return workbook as Workbook;
}

/**
 * `fn` wirft XlsxError mit genau diesem Code und der Meldung `xlsx: <code>` (Vertrag §2a).
 * Der Code ist als Zeichenkette typisiert, weil 'tooLarge' erst mit der Änderungsnotiz kommt.
 */
export function expectXlsxCode(fn: () => unknown, code: string): XlsxError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught, `erwartet XlsxError '${code}'`).toBeInstanceOf(XlsxError);
  const error = caught as XlsxError;
  expect(error.code).toBe(code);
  expect(error.message).toBe(`xlsx: ${code}`);
  expect(error.name).toBe('XlsxError');
  return error;
}

/** Vergleichbare, reine Daten einer gelesenen Arbeitsmappe (Maps als Eintragslisten, ohne Funktionen). */
export function plainWorkbook(wb: Workbook): unknown {
  return {
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
      cellFills: s.model.cells.map((c) => s.model.fillOf(c)),
    })),
  };
}

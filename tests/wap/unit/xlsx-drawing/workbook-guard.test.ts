// @vitest-environment jsdom
// Vertrag E1-07, Änderungsnotiz Code-Review Runde 1, Punkt 2 «Weitere Regeln» (CR-E107-02): Jede
// Ausnahme beim Lesen der Formatvorlagen (parseStyles) und in uses1904 wird zu XlsxError('corrupt')
// mit cause; kein roher Fehler verlässt readWorkbook (§2a). Aufrufweg: parseStyles aus './sheet',
// uses1904 aus './zip'; Tests dürfen beide mit vi.mock ersetzen. Hinweisnotiz in E1-08.md, Test 8.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkbook } from '../../../../src/io/xlsx-drawing';
import { expectXlsxCode, readValid } from './expect-xlsx';
import { buildXlsx, inl, stylesXml, worksheetXml } from './fixture';

const mode = vi.hoisted(() => ({
  styles: undefined as unknown,
  date1904: undefined as unknown,
}));

vi.mock('../../../../src/io/xlsx-drawing/sheet', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../../src/io/xlsx-drawing/sheet')>();
  return {
    ...orig,
    parseStyles: (...args: Parameters<typeof orig.parseStyles>) => {
      if (mode.styles !== undefined) throw mode.styles;
      return orig.parseStyles(...args);
    },
  };
});
vi.mock('../../../../src/io/xlsx-drawing/zip', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../../src/io/xlsx-drawing/zip')>();
  return {
    ...orig,
    uses1904: (...args: Parameters<typeof orig.uses1904>) => {
      if (mode.date1904 !== undefined) throw mode.date1904;
      return orig.uses1904(...args);
    },
  };
});

afterEach(() => {
  mode.styles = undefined;
  mode.date1904 = undefined;
});

const bytes = buildXlsx({
  sheets: [{ name: 'Woche 1', sheetXml: worksheetXml({ rows: { 1: inl('A1', 'Fiktiv', 1) } }) }],
  stylesXml: stylesXml('FFEE00'),
  date1904: true,
});

describe('xlsx-drawing readWorkbook – guard für Formatvorlagen und uses1904 (CR-E107-02)', () => {
  it('[R-L-11] (CR-E107-02) werfendes parseStyles: XlsxError corrupt, Meldung genau «xlsx: corrupt», cause = Ausnahme', () => {
    expect(readValid(bytes).sheets).toHaveLength(1); // ohne Ausnahme gültig
    const thrown = new RangeError('Invalid string length');
    mode.styles = thrown;
    const error = expectXlsxCode(() => readWorkbook(bytes), 'corrupt');
    expect(error.cause).toBe(thrown);
  });

  it('[R-L-11] (CR-E107-02) werfendes uses1904: XlsxError corrupt, Meldung genau «xlsx: corrupt», cause = Ausnahme', () => {
    expect(readValid(bytes).date1904).toBe(true); // ohne Ausnahme gültig
    const thrown = new TypeError('Fiktiver Lesefehler');
    mode.date1904 = thrown;
    const error = expectXlsxCode(() => readWorkbook(bytes), 'corrupt');
    expect(error.cause).toBe(thrown);
  });
});

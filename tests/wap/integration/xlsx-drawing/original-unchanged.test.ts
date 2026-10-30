// @vitest-environment jsdom
// R-8.2-22 (Beschrieb 8.2 Regel 9): Die Originaldatei wird nie verändert (nur der SHA-256-Test).
// Die übrigen Tests hier (Puffer-Ausschnitt, keine Referenz, Fehlerfall) tragen R-L-11 (Vertrag §3, P13).
// Vertrag E1-07 §2g und §3: Eingabe-Bytes vor und nach readWorkbook gleich (SHA-256);
// das Ergebnis hält keine Referenz auf die Eingabe. Fiktive, im Test erzeugte Arbeitsmappe.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readWorkbook, type Workbook, XlsxError } from '../../../../src/io/xlsx-drawing';
import {
  at,
  buildXlsx,
  inl,
  mixedDrawingXml,
  sharedStringsXml,
  sstCell,
  stylesXml,
  themeXml,
  worksheetXml,
} from '../../unit/xlsx-drawing/fixture';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const fixture = () =>
  buildXlsx({
    sheets: [
      {
        name: 'Woche 1',
        sheetXml: worksheetXml({
          rows: { 1: sstCell('A1', 0, 1) + sstCell('B1', 1), 2: inl('A2', 'Fiktive Zeile') },
        }),
        drawingXml: mixedDrawingXml(),
      },
      {
        name: 'Woche 2',
        sheetXml: worksheetXml({ rows: { 1: inl('B2', 'Mo') } }),
        state: 'hidden',
      },
    ],
    sharedStringsXml: sharedStringsXml(['<t>Gemeinsam</t>', '<r><rPr><b/></rPr><t>Fett</t></r>']),
    stylesXml: stylesXml('A1B2C3'),
    themeXml: themeXml({ accent1: '123456' }),
  });

/** Sichtbarer Inhalt des Ergebnisses (ohne Funktionen). */
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
    widths: Array.from({ length: 10 }, (_, c) => s.model.colWidth(c)),
  })),
});

/** Alle erreichbaren Werte (Objekte, Arrays, Maps, Sets), ohne Funktionsabschlüsse. */
function reachable(root: unknown): unknown[] {
  const seen = new Set<unknown>();
  const stack = [root];
  while (stack.length) {
    const value = stack.pop();
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (value instanceof Map) for (const [k, v] of value) stack.push(k, v);
    else if (value instanceof Set) for (const v of value) stack.push(v);
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) continue;
    for (const key of Reflect.ownKeys(value)) {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (d && 'value' in d) stack.push(d.value);
    }
  }
  return [...seen];
}

describe('xlsx-drawing Original unverändert (Vertrag E1-07 §2g)', () => {
  it('[R-8.2-22] SHA-256 der Eingabe-Bytes vor und nach readWorkbook gleich', () => {
    const bytes = fixture();
    const before = sha256(bytes);
    const copy = bytes.slice();
    const wb = readWorkbook(bytes);
    expect(wb.sheets.map((s) => s.name)).toEqual(['Woche 1', 'Woche 2']);
    expect(sha256(bytes)).toBe(before);
    expect(bytes).toEqual(copy);
  });

  it('[R-L-11] Eingabe als Ausschnitt eines grösseren Puffers: Umgebung und Ausschnitt bleiben unverändert', () => {
    const inner = fixture();
    const buffer = new Uint8Array(inner.length + 64).fill(0xa5);
    buffer.set(inner, 32);
    const view32 = buffer.subarray(32, 32 + inner.length);
    const before = sha256(buffer);
    const wb = readWorkbook(view32);
    expect(wb.sheets).toHaveLength(2);
    expect(sha256(buffer)).toBe(before);
  });

  it('[R-L-11] das Ergebnis hält keine Referenz auf die Eingabe-Bytes', () => {
    const bytes = fixture();
    const wb = readWorkbook(bytes);
    for (const value of reachable(wb)) {
      expect(value).not.toBe(bytes);
      expect(value).not.toBe(bytes.buffer);
      if (ArrayBuffer.isView(value)) expect(value.buffer).not.toBe(bytes.buffer);
    }
    // Überschreiben der Eingabe danach ändert das Ergebnis nicht.
    const snapshot = structuredClone(view(wb));
    bytes.fill(0);
    expect(view(wb)).toEqual(snapshot);
    expect(at(wb.sheets, 0).model.cellAt(1, 0)?.text).toBe('Fiktive Zeile');
  });

  it('[R-L-11] Fehlerfall: auch abgelehnte Eingaben bleiben unverändert', () => {
    const bytes = fixture();
    const broken = bytes.slice(0, Math.floor(bytes.length / 2));
    const before = sha256(broken);
    let brokenError: unknown;
    try {
      readWorkbook(broken);
    } catch (error) {
      brokenError = error;
    }
    expect(brokenError).toBeInstanceOf(XlsxError);
    expect((brokenError as XlsxError).code).toBe('corrupt');
    expect(sha256(broken)).toBe(before);
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2]);
    const oleBefore = sha256(ole);
    let caught: unknown;
    try {
      readWorkbook(ole);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(XlsxError);
    expect((caught as XlsxError).code).toBe('oldXlsFormat');
    expect(sha256(ole)).toBe(oleBefore);
  });
});

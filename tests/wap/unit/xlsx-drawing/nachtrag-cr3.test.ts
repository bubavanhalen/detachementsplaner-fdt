// @vitest-environment jsdom
// Vertrag E1-07, Entscheid «Orchestrator, 05.10.2026 (Code-Review Runde 3, CR-E107-12)»: Die Liste der
// gemeinsamen Zeichenfolgen (si) und ihre Läufe werden je Mappe genau einmal gebildet und für alle
// Blätter wiederverwendet; das Ergebnis je Zelle bleibt unverändert (§2f).
// Aufrufweg laut «Orchestrator, 05.10.2026 (Aufrufweg zu CR-E107-12)»: workbook.ts ruft
// readSharedRichText über './richText' genau einmal je Mappe auf; Tests dürfen './richText' per
// vi.mock ersetzen. Eine transparente Hülle zählt diese Aufrufe. Die Funktion wird per Reflect.get
// gesucht, damit ihr Fehlen heute an einer Assertion scheitert und nicht am Import. Danach leert die
// Hülle das Dokument, damit nur eine Umsetzung grün ist, die das Ergebnis nutzt (TR-E107-17).
// Dazu die Gegenprobe: unverändertes Ergebnis je Zelle über mehrere Blätter und Mappen. Alle Texte fiktiv.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CellRichRun } from '../../../../src/io/xlsx-drawing';
import { readValid } from './expect-xlsx';
import { at, buildXlsx, esc, sharedStringsXml, sstCell, worksheetXml } from './fixture';

const spy = vi.hoisted(() => ({ sharedCalls: 0 }));

vi.mock('../../../../src/io/xlsx-drawing/richText', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const original: unknown = Reflect.get(actual, 'readSharedRichText');
  if (typeof original !== 'function') return actual;
  return {
    ...actual,
    readSharedRichText: (...args: unknown[]): unknown => {
      spy.sharedCalls += 1;
      const result: unknown = Reflect.apply(original, undefined, args);
      // TR-E107-17: Nach Vertrag hat readSharedRichText die si-Liste samt Läufen gebildet. Die Hülle
      // leert danach das übergebene Dokument; sucht ein Blatt die si erneut im Dokument statt das
      // Ergebnis zu nutzen, fehlen die Läufe und die Ergebnis-Asserts scheitern.
      const doc = args[0];
      if (doc instanceof Document)
        for (const node of Array.from(doc.documentElement.childNodes))
          doc.documentElement.removeChild(node);
      return result;
    },
  };
});

afterEach(() => {
  spy.sharedCalls = 0;
});

const r = (text: string, rPr = '') =>
  `<r>${rPr ? `<rPr>${rPr}</rPr>` : ''}<t xml:space="preserve">${esc(text)}</t></r>`;

const run = (text: string, o: Partial<Omit<CellRichRun, 'text'>> = {}): CellRichRun => ({
  text,
  bold: o.bold ?? false,
  strike: o.strike ?? false,
  color: o.color ?? null,
});

/** Gemeinsame Zeichenfolgen: 0 ohne Läufe, 1–3 mit Läufen. */
const SST = sharedStringsXml([
  /* 0 */ '<t>Ohne Läufe</t>',
  /* 1 */ r('Fett ', '<b/>') + r('normal'),
  /* 2 */ r('Rot', '<color rgb="FFFF0000"/>') + r(' Strich', '<strike/>'),
  /* 3 */ r('a') + r('') + r('b', '<b val="0"/>'),
]);
const RUNS_1 = [run('Fett ', { bold: true }), run('normal')];
const RUNS_2 = [run('Rot', { color: 'FF0000' }), run(' Strich', { strike: true })];
const RUNS_3 = [run('a'), run('b')];

const inlineRich = (ref: string, runs: string) =>
  `<c r="${ref}" t="inlineStr"><is>${runs}</is></c>`;

const SHEET_1 = worksheetXml({
  rows: { 1: sstCell('A1', 0) + sstCell('B1', 1) + sstCell('C1', 2) },
});
const SHEET_2 = worksheetXml({
  rows: {
    1: sstCell('A1', 2),
    2: sstCell('B2', 1),
    3: sstCell('C3', 3),
    4: inlineRich('D4', r('Inline', '<b/>')),
  },
});
const SHEET_3 = worksheetXml({ rows: { 1: sstCell('A1', 99) + sstCell('B1', 1) } });

const EXPECT_1 = [
  ['B1', RUNS_1],
  ['C1', RUNS_2],
];
const EXPECT_2 = [
  ['A1', RUNS_2],
  ['B2', RUNS_1],
  ['C3', RUNS_3],
  ['D4', [run('Inline', { bold: true })]],
];
const EXPECT_3 = [['B1', RUNS_1]];

const richOf = (bytes: Uint8Array) =>
  readValid(bytes).sheets.map((s) => [s.name, [...s.richText.entries()]]);

describe('xlsx-drawing readWorkbook – Rich Text je Zelle über mehrere Blätter (CR-E107-12, Gegenprobe)', () => {
  it('[R-L-11] (CR-E107-12, §2f) drei Blätter mit gemeinsamen Zeichenfolgen: Läufe je Zelle unverändert, auch bei wiederholtem Index, inlineStr und Index ausserhalb der Liste', () => {
    const bytes = buildXlsx({
      sheets: [
        { name: 'Woche 1', sheetXml: SHEET_1 },
        { name: 'Woche 2', sheetXml: SHEET_2 },
        { name: 'Woche 3', sheetXml: SHEET_3 },
      ],
      sharedStringsXml: SST,
    });
    expect(richOf(bytes)).toEqual([
      ['Woche 1', EXPECT_1],
      ['Woche 2', EXPECT_2],
      ['Woche 3', EXPECT_3],
    ]);
  });

  it('[R-L-11] (CR-E107-12, §2f) Ergebnis eines Blatts hängt nicht von den übrigen Blättern und ihrer Reihenfolge ab', () => {
    const only2 = buildXlsx({
      sheets: [{ name: 'Woche 2', sheetXml: SHEET_2 }],
      sharedStringsXml: SST,
    });
    expect(richOf(only2)).toEqual([['Woche 2', EXPECT_2]]);
    const reversed = buildXlsx({
      sheets: [
        { name: 'Woche 3', sheetXml: SHEET_3 },
        { name: 'Woche 2', sheetXml: SHEET_2 },
        { name: 'Woche 1', sheetXml: SHEET_1 },
      ],
      sharedStringsXml: SST,
    });
    expect(richOf(reversed)).toEqual([
      ['Woche 3', EXPECT_3],
      ['Woche 2', EXPECT_2],
      ['Woche 1', EXPECT_1],
    ]);
  });

  it('[R-L-11] (CR-E107-12, je Mappe) zwei Mappen nacheinander mit verschiedenen Zeichenfolgen am selben Index: jede Mappe mit ihren eigenen Läufen', () => {
    const sheet = worksheetXml({ rows: { 1: sstCell('A1', 0) } });
    const first = buildXlsx({
      sheets: [{ name: 'Woche 1', sheetXml: sheet }],
      sharedStringsXml: sharedStringsXml([r('Erste', '<b/>')]),
    });
    const second = buildXlsx({
      sheets: [{ name: 'Woche 1', sheetXml: sheet }],
      sharedStringsXml: sharedStringsXml([r('Zweite', '<strike/>')]),
    });
    expect(at(richOf(first), 0)).toEqual(['Woche 1', [['A1', [run('Erste', { bold: true })]]]]);
    expect(at(richOf(second), 0)).toEqual(['Woche 1', [['A1', [run('Zweite', { strike: true })]]]]);
    // Dieselbe Mappe erneut gelesen: unverändert.
    expect(at(richOf(first), 0)).toEqual(['Woche 1', [['A1', [run('Erste', { bold: true })]]]]);
  });
});

describe('xlsx-drawing readWorkbook – gemeinsame Zeichenfolgen je Mappe einmal (CR-E107-12, Aufrufweg)', () => {
  it('[R-L-11] (CR-E107-12, Aufrufweg) drei Blätter mit gemeinsamen Zeichenfolgen: readSharedRichText genau einmal, Ergebnis je Zelle unverändert', () => {
    const bytes = buildXlsx({
      sheets: [
        { name: 'Woche 1', sheetXml: SHEET_1 },
        { name: 'Woche 2', sheetXml: SHEET_2 },
        { name: 'Woche 3', sheetXml: SHEET_3 },
      ],
      sharedStringsXml: SST,
    });
    spy.sharedCalls = 0;
    const rich = richOf(bytes);
    expect(spy.sharedCalls).toBe(1);
    expect(rich).toEqual([
      ['Woche 1', EXPECT_1],
      ['Woche 2', EXPECT_2],
      ['Woche 3', EXPECT_3],
    ]);
  });

  it('[R-L-11] (CR-E107-12, Aufrufweg, Gegenprobe) ein Blatt: readSharedRichText genau einmal; ohne gemeinsame Zeichenfolgen höchstens einmal', () => {
    spy.sharedCalls = 0;
    richOf(buildXlsx({ sheets: [{ name: 'Woche 2', sheetXml: SHEET_2 }], sharedStringsXml: SST }));
    expect(spy.sharedCalls).toBe(1);
    spy.sharedCalls = 0;
    const plain = worksheetXml({ rows: { 1: '<c r="A1"><v>1</v></c>' } });
    richOf(
      buildXlsx({
        sheets: [
          { name: 'Woche 1', sheetXml: plain },
          { name: 'Woche 2', sheetXml: plain },
        ],
      }),
    );
    expect(spy.sharedCalls).toBeLessThanOrEqual(1);
  });
});

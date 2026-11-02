// @vitest-environment jsdom
// Vertrag E1-07, Änderungsnotiz Code-Review Runde 1:
// - Punkt 3, §2c 6(c) neu (CR-E107-05): erste Fundstelle /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/,
//   Jahr genau zwei- oder vierstellig, ungültiges Kalenderdatum überspringt die Zelle.
// - Punkt 4, §2f Invariante neu (CR-E107-06): Läufe nur aus r/t; t auf oberster Ebene und (bei
//   inlineStr) rPh zählen zu Cell.text, nicht zu den Läufen.
// Hinweisnotiz in E1-08.md, Tests 9 und 10. Alle Texte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  detectSheetLayout,
  readCellRichText,
  type SheetModel,
  type SheetTimeScale,
} from '../../../../src/io/xlsx-drawing';
import { parseTheme } from '../../../../src/io/xlsx-drawing/colors';
import { esc, inl, sharedStringsXml, sheetModel, sstCell, worksheetXml, xmlDoc } from './fixture';

// Zeitachse von Hand; detectSheetLayout wertet nur gridRight aus.
const time: SheetTimeScale = {
  labels: [
    { minute: 300, y: 0 },
    { minute: 360, y: 100 },
  ],
  toMinute: (y) => 300 + y * 0.6,
  toY: (minute) => (minute - 300) / 0.6,
  gridLeft: 0,
  gridRight: Number.POSITIVE_INFINITY,
  gridTop: -100,
  gridBottom: 225,
  labelShapes: new Set<number>(),
};

/** Kopfzeile 1 mit den Zellen B1, C1 … in dieser Reihenfolge. */
const header = (...texts: string[]): SheetModel =>
  sheetModel(
    worksheetXml({
      rows: { 1: texts.map((t, i) => inl(`${String.fromCharCode(66 + i)}1`, t)).join('') },
    }),
  );

const startOf = (...texts: string[]): string | null =>
  detectSheetLayout(header(...texts), time).startDate;

describe('xlsx-drawing detectSheetLayout – §2c 6(c) neu (CR-E107-05)', () => {
  it('[R-L-11] (§2c 6c neu) ungültiges Kalenderdatum «Mo 31.02.26» wird übersprungen, «Di 06.10.26» gilt: 2026-10-05', () => {
    const layout = detectSheetLayout(header('Mo 31.02.26', 'Di 06.10.26'), time);
    expect(layout.startDate).toBe('2026-10-05');
    expect(layout.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('[R-L-11] (§2c 6c neu, negativ) drei- oder fünfstelliges Jahr ergibt keine Fundstelle: allein null', () => {
    expect(startOf('Mo 05.10.202', 'Di')).toBeNull();
    expect(startOf('Mo 05.10.20261', 'Di')).toBeNull();
    // Ohne Fundstelle wird die nächste Zelle geprüft.
    expect(startOf('Mo 05.10.202', 'Di 06.10.26')).toBe('2026-10-05');
    expect(startOf('Mo 05.10.20261', 'Di 06.10.26')).toBe('2026-10-05');
  });

  it('[R-L-11] (§2c 6c neu, positiv) vier- und zweistelliges Jahr (20yy): 2026-10-05', () => {
    expect(startOf('Mo 05.10.2026', 'Di')).toBe('2026-10-05');
    expect(startOf('Mo 05.10.26', 'Di')).toBe('2026-10-05');
  });

  it('[R-L-11] (§2c 6c neu) Tag 00 und Monat 13 werden übersprungen; allein null', () => {
    expect(startOf('Mo 00.10.26', 'Di 06.10.26')).toBe('2026-10-05');
    expect(startOf('Mo 05.13.26', 'Di 06.10.26')).toBe('2026-10-05');
    expect(startOf('Mo 00.10.26', 'Di')).toBeNull();
    expect(startOf('Mo 05.13.26', 'Di')).toBeNull();
  });

  it('[R-L-11] (§2c 6c neu) massgebend ist die erste Fundstelle der Zelle: ungültige erste Fundstelle überspringt die ganze Zelle', () => {
    expect(startOf('Mo 31.02.26 bis 05.10.26', 'Di')).toBeNull();
    expect(startOf('Mo 05.10.26 bis 31.02.26', 'Di')).toBe('2026-10-05');
  });
});

const theme = parseTheme(null);
const r = (text: string, rPr = '') =>
  `<r>${rPr ? `<rPr>${rPr}</rPr>` : ''}<t xml:space="preserve">${esc(text)}</t></r>`;
const t = (text: string) => `<t xml:space="preserve">${esc(text)}</t>`;
const rPh = (text: string) => `<rPh sb="0" eb="1">${t(text)}</rPh>`;

function cellTextAndRuns(
  sst: string | null,
  cells: string,
): { text: Map<string, string>; runs: Map<string, string[]> } {
  const sstDoc = sst === null ? null : xmlDoc(sst);
  const sheet = worksheetXml({ rows: { 1: cells } });
  const model = sheetModel(sheet, sstDoc);
  const rich = readCellRichText(sstDoc, xmlDoc(sheet), theme);
  return {
    text: new Map(
      model.cells.map((c) => [`${String.fromCharCode(65 + c.col)}${c.row + 1}`, c.text]),
    ),
    runs: new Map([...rich].map(([ref, list]) => [ref, list.map((run) => run.text)])),
  };
}

describe('xlsx-drawing readCellRichText – §2f Invariante neu (CR-E107-06)', () => {
  it('[R-L-11] (§2f neu, positiv) si nur mit r: Verkettung der Läufe = Cell.text', () => {
    const { text, runs } = cellTextAndRuns(
      sharedStringsXml([r('Kp ', '<b/>') + r('Alpha') + r(' 1', '<strike/>')]),
      sstCell('A1', 0),
    );
    expect(runs.get('A1')).toEqual(['Kp ', 'Alpha', ' 1']);
    expect(runs.get('A1')?.join('')).toBe(text.get('A1'));
  });

  it('[R-L-11] (§2f neu) si mit t auf oberster Ebene neben r: Läufe nur r-Texte, Cell.text mit t', () => {
    const { text, runs } = cellTextAndRuns(
      sharedStringsXml([t('Vor') + r('Kp ', '<b/>') + r('Alpha')]),
      sstCell('A1', 0),
    );
    expect(runs.get('A1')).toEqual(['Kp ', 'Alpha']);
    expect(text.get('A1')).toBe('VorKp Alpha');
  });

  it('[R-L-11] (§2f neu) inlineStr mit rPh: Cell.text mit Lautschrift, Läufe ohne', () => {
    const { text, runs } = cellTextAndRuns(
      null,
      `<c r="A1" t="inlineStr"><is>${r('Kp ', '<b/>')}${r('Alpha')}${rPh('LAUT')}</is></c>`,
    );
    expect(runs.get('A1')).toEqual(['Kp ', 'Alpha']);
    expect(text.get('A1')).toBe('Kp AlphaLAUT');
  });

  it('[R-L-11] (§2f neu, positiv) si mit rPh: Läufe und Cell.text beide ohne Lautschrift', () => {
    const { text, runs } = cellTextAndRuns(
      sharedStringsXml([r('Kp ', '<b/>') + rPh('LAUT') + r('Alpha')]),
      sstCell('A1', 0),
    );
    expect(runs.get('A1')).toEqual(['Kp ', 'Alpha']);
    expect(text.get('A1')).toBe('Kp Alpha');
  });
});

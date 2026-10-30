// @vitest-environment jsdom
// Vertrag E1-07 §2f: Rich Text in Zellen (readCellRichText).
import { describe, expect, it } from 'vitest';
import { readCellRichText, type Theme } from '../../../../src/io/xlsx-drawing';
import { parseTheme } from '../../../../src/io/xlsx-drawing/colors';
import {
  esc,
  inl,
  numCell,
  sharedStringsXml,
  sheetModel,
  sstCell,
  themeXml,
  worksheetXml,
  xmlDoc,
} from './fixture';

const theme: Theme = parseTheme(xmlDoc(themeXml({ dk1: '101010', lt1: 'FFFFFF' })));

const r = (text: string, rPr = '') =>
  `<r>${rPr ? `<rPr>${rPr}</rPr>` : ''}<t xml:space="preserve">${esc(text)}</t></r>`;

const sst = sharedStringsXml([
  /* 0 */ '<t>Ohne Läufe</t>',
  /* 1 */ r('Fett ', '<b/><color rgb="FFFF0000"/>') + r('normal'),
  /* 2 */ `${r('Kp')}<rPh sb="0" eb="2"><t>Lautschrift</t></rPh>${r(' Rap', '<strike/>')}`,
  /* 3 */
  r('a', '<b val="0"/><strike val="false"/>') +
    r('') +
    r('b', '<b val="1"/><strike val="true"/><color theme="1"/>') +
    r('c', '<b val="false"/><strike val="0"/><color indexed="2"/>') +
    r('d', '<color theme="0" tint="-0.5"/>'),
]);

const inlineRich = (ref: string, runs: string) =>
  `<c r="${ref}" t="inlineStr"><is>${runs}</is></c>`;

const sheet = worksheetXml({
  rows: {
    1: sstCell('A1', 0) + sstCell('B1', 1),
    3: sstCell('c3', 2) + sstCell('$D$3', 3),
    5: inlineRich('E5', r('Zeile ', '<b/>') + r('eins')) + inl('F5', 'Inline ohne Läufe'),
    6: [
      numCell('G6', 42),
      '<c r="H6" t="str"><v>Formel</v></c>',
      inlineRich('BK89', r('Weit')),
    ].join(''),
  },
});

describe('xlsx-drawing readCellRichText (Vertrag E1-07 §2f)', () => {
  it('[R-L-11] (§2f) aufgenommen nur t="s" mit r und inlineStr mit r; Schlüssel gross, ohne «$»', () => {
    const map = readCellRichText(xmlDoc(sst), xmlDoc(sheet), theme);
    expect([...map.keys()].sort()).toEqual(['B1', 'BK89', 'C3', 'D3', 'E5']);
  });

  it('[R-L-11] (§2f negativ) ohne gemeinsame Zeichenfolgen (null) nur inlineStr-Zellen', () => {
    const map = readCellRichText(null, xmlDoc(sheet), theme);
    expect([...map.keys()].sort()).toEqual(['BK89', 'E5']);
  });

  it('[R-L-11] (§2f) Läufe in Reihenfolge, Text unverändert, ohne Lautschrift, leere entfallen', () => {
    const map = readCellRichText(xmlDoc(sst), xmlDoc(sheet), theme);
    expect(map.get('B1')?.map((x) => x.text)).toEqual(['Fett ', 'normal']);
    expect(map.get('C3')?.map((x) => x.text)).toEqual(['Kp', ' Rap']);
    expect(map.get('D3')?.map((x) => x.text)).toEqual(['a', 'b', 'c', 'd']);
    expect(map.get('E5')?.map((x) => x.text)).toEqual(['Zeile ', 'eins']);
  });

  it('[R-L-11] (§2f Invariante) Läufe aneinandergefügt = Cell.text aus parseSheet', () => {
    const sstDoc = xmlDoc(sst);
    const model = sheetModel(sheet, sstDoc);
    const map = readCellRichText(sstDoc, xmlDoc(sheet), theme);
    expect(map.size).toBeGreaterThan(0);
    for (const [ref, runs] of map) {
      const cell = model.cells.find((c) => {
        let col = '';
        for (let n = c.col + 1; n > 0; n = Math.floor((n - 1) / 26))
          col = String.fromCharCode(65 + ((n - 1) % 26)) + col;
        return `${col}${c.row + 1}` === ref;
      });
      expect(cell, ref).toBeDefined();
      expect(runs.map((x) => x.text).join('')).toBe(cell?.text);
    }
  });

  it('[R-L-11] (§2f) bold/strike: Element vorhanden und val nicht «0»/«false»; ohne Angabe nicht', () => {
    const map = readCellRichText(xmlDoc(sst), xmlDoc(sheet), theme);
    const d3 = map.get('D3') ?? [];
    expect(d3.map((x) => [x.text, x.bold, x.strike])).toEqual([
      ['a', false, false],
      ['b', true, true],
      ['c', false, false],
      ['d', false, false],
    ]);
    expect(map.get('B1')?.map((x) => x.bold)).toEqual([true, false]);
    expect(map.get('C3')?.map((x) => x.strike)).toEqual([false, true]);
  });

  it('[R-L-11] (§2f) color über cellColor (rgb, theme, indexed, tint), sonst null; keine Formatvorlage', () => {
    const map = readCellRichText(xmlDoc(sst), xmlDoc(sheet), theme);
    expect(map.get('B1')?.map((x) => x.color)).toEqual(['FF0000', null]);
    // theme 1 = dk1 (Zell-Reihenfolge lt1, dk1, …), indexed 2 = FF0000, theme 0 = lt1 mit tint -0.5.
    expect(map.get('D3')?.map((x) => x.color)).toEqual([null, '101010', 'FF0000', '808080']);
    expect(map.get('E5')?.map((x) => x.color)).toEqual([null, null]);
  });

  it('[R-L-11] (§2f) rein: Dokumente unverändert, gleiche Eingabe gleiches Ergebnis', () => {
    const sstDoc = xmlDoc(sst);
    const sheetDoc = xmlDoc(sheet);
    const ser = new XMLSerializer();
    const before = [ser.serializeToString(sstDoc), ser.serializeToString(sheetDoc)];
    const a = readCellRichText(sstDoc, sheetDoc, theme);
    const b = readCellRichText(sstDoc, sheetDoc, theme);
    expect([ser.serializeToString(sstDoc), ser.serializeToString(sheetDoc)]).toEqual(before);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

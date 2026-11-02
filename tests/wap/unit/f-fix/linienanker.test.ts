// @vitest-environment jsdom
// F-FIX Runde 2, Befund FD-03 (R-8.2-44 = VQ-I2-01): Die Lage einer Linienform kommt aus ihrem Zeichnungsanker,
// so wie Excel sie zeichnet, nicht aus einer veralteten <a:xfrm> der obersten Ebene. Je Ankerart (zwei Zellen,
// eine Zelle, absolut) und gespiegelt: Lage der Form in EMU und Zeit des Markers nach Kalibrierung und Rundung
// (R-8.2-10). Frei erfundene Arbeitsmappen; die Altmodule (R-L-11) bleiben unberührt.
import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import type { Marker } from '../../../../src/model/wap/types';
import {
  block,
  buildKpWorkbook,
  COL_EMU,
  emptyWeek,
  geometryOf,
  HEADER_ROWS,
  MINUTE_EMU,
  minutes,
  normal,
  type WeekDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

type Anker = 'zweiZellen' | 'eineZelle' | 'absolut';

const g = geometryOf(emptyWeek());
const X0 = g.colX(g.dayStart[0] ?? 1) + 3000;
const X1 = g.colX((g.dayStart[0] ?? 1) + 2) - 3000;

/** Zeile (0-basiert) und Versatz einer Minute im Raster (eine Rasterzeile = 15 Min). */
function zelle(minute: number): { row: number; rowOff: number } {
  const ab = minute - 240;
  return {
    row: HEADER_ROWS + Math.floor(ab / 15),
    rowOff: Math.round((ab % 15) * MINUTE_EMU),
  };
}

const punkt = (tag: 'from' | 'to', x: number, minute: number): string => {
  const col = Math.floor(x / COL_EMU);
  const { row, rowOff } = zelle(minute);
  return `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${Math.round(x - col * COL_EMU)}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:${tag}>`;
};

let id = 7000;
/**
 * Waagrechte Linie (cxnSp) bei `minute` mit dem Anker `anker`; ihre <a:xfrm> steht absichtlich veraltet bei
 * `veraltet` (wie nach dem Ändern von Zeilenhöhen ohne Neuberechnung der xfrm).
 */
function linie(anker: Anker, minute: number, veraltet: number, flip = ''): string {
  const cxn =
    `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
    `<xdr:spPr><a:xfrm${flip}><a:off x="${X0}" y="${Math.round(yOf(veraltet))}"/><a:ext cx="${X1 - X0}" cy="0"/></a:xfrm>` +
    `<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp>`;
  if (anker === 'zweiZellen')
    return `<xdr:twoCellAnchor>${punkt('from', X0, minute)}${punkt('to', X1, minute)}${cxn}<xdr:clientData/></xdr:twoCellAnchor>`;
  if (anker === 'eineZelle')
    return `<xdr:oneCellAnchor>${punkt('from', X0, minute)}<xdr:ext cx="${X1 - X0}" cy="0"/>${cxn}<xdr:clientData/></xdr:oneCellAnchor>`;
  return `<xdr:absoluteAnchor><xdr:pos x="${X0}" y="${Math.round(yOf(minute))}"/><xdr:ext cx="${X1 - X0}" cy="0"/>${cxn}<xdr:clientData/></xdr:absoluteAnchor>`;
}

/** Woche mit einer Marker-Beschriftung «ABV» 2108–2118 und der Linie. */
function woche(linieXml: string): WeekDef {
  return emptyWeek({
    shapes: [block(0, [0, 0], '2108', '2118', [[normal('ABV')]])],
    rawShapes: [linieXml],
  });
}

const marker = (w: WeekDef): Marker | undefined =>
  entries(importWeeks([w]).result.plan).find((e): e is Marker => e.type === 'marker');

const linienform = (w: WeekDef) => {
  const sheet = readWorkbook(buildKpWorkbook([w])).sheets[0];
  return sheet?.shapes.find((s) => s.kind === 'cxn');
};

const FAELLE: readonly [Anker, string][] = [
  ['zweiZellen', ''],
  ['eineZelle', ''],
  ['absolut', ''],
  ['zweiZellen', ' flipH="1"'],
  ['zweiZellen', ' flipV="1"'],
  ['eineZelle', ' flipH="1" flipV="1"'],
];

describe('F-FIX FD-03: Lage einer Linienform aus dem Zeichnungsanker (R-8.2-44)', () => {
  for (const [anker, flip] of FAELLE) {
    const name = `${anker}${flip === '' ? '' : ` gespiegelt (${flip.trim()})`}`;

    it(`[R-8.2-44] ${name}: Lage der Linie = Anker, nicht die veraltete xfrm`, () => {
      const s = linienform(woche(linie(anker, minutes('2100'), minutes('2015'), flip)));
      expect(s).toBeDefined();
      expect(s?.box.y0).toBeCloseTo(yOf(minutes('2100')), 0);
      expect(s?.box.y1).toBeCloseTo(yOf(minutes('2100')), 0);
      expect(s?.box.x0).toBeCloseTo(X0, 0);
      expect(s?.box.x1).toBeCloseTo(X1, 0);
    });

    it(`[R-8.2-44][R-8.2-10] ${name}: Marker-Zeit nach Kalibrierung und Rundung = Zeit der Linie 2100`, () => {
      const m = marker(woche(linie(anker, minutes('2100'), minutes('2015'), flip)));
      expect(m).toMatchObject({ kind: 'ABV', at: 1260 });
      expect(m?.columns.kind).toBe('all');
    });
  }

  it('[R-8.2-44][R-8.2-10] Anker mit Zeilenversatz neben der 5-Min-Linie: Zeit auf 5 Min gerundet (2107 → 2105)', () => {
    const m = marker(woche(linie('zweiZellen', minutes('2107'), minutes('2015'))));
    expect(m).toMatchObject({ kind: 'ABV', at: 1265 });
  });

  it('[R-8.2-44] Senkrechte Linie als um 90° gedrehte Form (Anker ohne Breite): gezeichnete Lage = Anker', () => {
    const x = X0 + 100_000;
    const yA = yOf(minutes('2030'));
    const yB = yOf(minutes('2130'));
    const len = Math.round(yB - yA);
    const cxn =
      `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
      `<xdr:spPr><a:xfrm rot="5400000"><a:off x="${x - len / 2}" y="${Math.round(yOf(minutes('1900')))}"/><a:ext cx="${len}" cy="0"/></a:xfrm>` +
      `<a:prstGeom prst="line"><a:avLst/></a:prstGeom></xdr:spPr></xdr:cxnSp>`;
    const xml = `<xdr:twoCellAnchor>${punkt('from', x, minutes('2030'))}${punkt('to', x, minutes('2130'))}${cxn}<xdr:clientData/></xdr:twoCellAnchor>`;
    const s = linienform(woche(xml));
    expect(s?.box.x0).toBeCloseTo(x, 0);
    expect(s?.box.x1).toBeCloseTo(x, 0);
    expect(s?.box.y0).toBeCloseTo(yA, 0);
    expect(s?.box.y1).toBeCloseTo(yB, 0);
  });

  it('[R-8.2-44] Schräg gedrehte Form (45°) mit Anker ohne Fläche: xfrm bleibt massgebend (Grenze der Vorstufe)', () => {
    // Nur Vierteldrehungen lassen sich ohne Verzerrung auf den Anker legen; sonst gilt die xfrm wie bisher.
    const y = Math.round(yOf(minutes('1900')));
    const cxn =
      `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
      `<xdr:spPr><a:xfrm rot="2700000"><a:off x="${X0}" y="${y}"/><a:ext cx="${X1 - X0}" cy="0"/></a:xfrm>` +
      `<a:prstGeom prst="line"><a:avLst/></a:prstGeom></xdr:spPr></xdr:cxnSp>`;
    const xml = `<xdr:twoCellAnchor>${punkt('from', X0, minutes('2100'))}${punkt('to', X1, minutes('2100'))}${cxn}<xdr:clientData/></xdr:twoCellAnchor>`;
    const s = linienform(woche(xml));
    expect(((s?.box.y0 ?? 0) + (s?.box.y1 ?? 0)) / 2).toBeCloseTo(y, 0);
  });

  it('[R-8.2-44] Linie in einer Gruppe: Lage aus der Gruppen-Transformation (xfrm des Kinds) wie bisher', () => {
    // Gegenprobe: Kinder einer Gruppe haben keinen eigenen Anker; ihre xfrm bleibt massgebend.
    const gid = id++;
    const y = Math.round(yOf(minutes('2100')));
    const grpXml =
      `<xdr:twoCellAnchor>${punkt('from', X0, minutes('2045'))}${punkt('to', X1, minutes('2115'))}` +
      `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${gid}" name="Gruppe fiktiv"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
      `<xdr:grpSpPr><a:xfrm><a:off x="${X0}" y="${Math.round(yOf(minutes('2045')))}"/><a:ext cx="${X1 - X0}" cy="${Math.round(30 * MINUTE_EMU)}"/>` +
      `<a:chOff x="${X0}" y="${Math.round(yOf(minutes('2045')))}"/><a:chExt cx="${X1 - X0}" cy="${Math.round(30 * MINUTE_EMU)}"/></a:xfrm></xdr:grpSpPr>` +
      `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
      `<xdr:spPr><a:xfrm><a:off x="${X0}" y="${y}"/><a:ext cx="${X1 - X0}" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom></xdr:spPr></xdr:cxnSp>` +
      `</xdr:grpSp><xdr:clientData/></xdr:twoCellAnchor>`;
    const s = linienform(woche(grpXml));
    expect(s?.box.y0).toBeCloseTo(y, 0);
  });
});

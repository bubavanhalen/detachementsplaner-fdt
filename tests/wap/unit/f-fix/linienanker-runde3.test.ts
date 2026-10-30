// @vitest-environment jsdom
// F-FIX Runde 3: Befunde VQA-3-01 (visual-qa-3, Rückschritt durch FD-03) und CR-3-04 (code-reviewer-3) zu R-8.2-44.
// VQA-3-01: Neben der echten Markerlinie liegt eine Linie der Länge 0 am rechten Spaltenrand; sie darf den Marker nicht
// übernehmen (die Linie mit Länge bestimmt Zeit und Spalten). CR-3-04: Nur Linien werden auf ihren Anker gelegt; eine
// gefüllte Form, deren Anker auf Höhe 0 fällt, behält ihre Lage aus der xfrm. Frei erfundene Arbeitsmappen.
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

const g = geometryOf(emptyWeek());
const START = g.dayStart[0] ?? 1;
/** Linke Kante von Kdo und rechte Kante von Bravo (alle drei Planungsspalten des Tags). */
const X0 = g.colX(START) + 3000;
const X1 = g.colX(START + 3) - 3000;

function punkt(tag: 'from' | 'to', x: number, minute: number): string {
  const col = Math.floor(x / COL_EMU);
  const ab = minute - 240;
  const row = HEADER_ROWS + Math.floor(ab / 15);
  const rowOff = Math.round((ab % 15) * MINUTE_EMU);
  return `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${Math.round(x - col * COL_EMU)}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:${tag}>`;
}

let id = 8000;
function cxn(x0: number, y: number, cx: number, flip = ''): string {
  return (
    `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
    `<xdr:spPr><a:xfrm${flip}><a:off x="${Math.round(x0)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="0"/></a:xfrm>` +
    `<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp>`
  );
}

/** Linie über alle drei Planungsspalten bei `minute` (Anker zwei Zellen). */
const echteLinie = (minute: number): string =>
  `<xdr:twoCellAnchor>${punkt('from', X0, minute)}${punkt('to', X1, minute)}${cxn(X0, yOf(minute), X1 - X0)}<xdr:clientData/></xdr:twoCellAnchor>`;

/**
 * «Null-Linie» an der rechten Kante von Bravo bei `minute`: Anker 1 EMU breit, xfrm 1 EMU, gespiegelt (wie in der
 * Mappe gefunden: Länge höchstens 1 EMU).
 */
const nullLinie = (minute: number): string =>
  `<xdr:twoCellAnchor>${punkt('from', X1 - 1, minute)}${punkt('to', X1, minute)}${cxn(X1 - 1, yOf(minute), 1, ' flipH="1"')}<xdr:clientData/></xdr:twoCellAnchor>`;

/** Woche mit der Beschriftung «AV» 0700–0715 in Bravo und den Linien in Dokumentreihenfolge. */
function woche(linien: readonly string[]): WeekDef {
  return emptyWeek({
    shapes: [block(0, [2, 2], '0700', '0715', [[normal('AV')]])],
    rawShapes: linien,
  });
}

const marker = (w: WeekDef): Marker | undefined =>
  entries(importWeeks([w]).result.plan).find((e): e is Marker => e.type === 'marker');

describe('F-FIX Runde 3: Linie ohne Länge (höchstens 1 EMU) neben der Markerlinie (VQA-3-01, R-8.2-44)', () => {
  it('[R-8.2-44][R-4.6-15] Null-Linie vor der echten Linie: Marker über alle Planungsspalten, Zeit 0700', () => {
    const m = marker(woche([nullLinie(minutes('0700')), echteLinie(minutes('0700'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });

  it('[R-8.2-44][R-4.6-15] Null-Linie nach der echten Linie: ebenso über alle Planungsspalten', () => {
    const m = marker(woche([echteLinie(minutes('0700')), nullLinie(minutes('0700'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });

  it('[R-8.2-44][R-4.6-15] Nur eine Null-Linie: kein Linienmarker aus ihr, Marker ohne Linie über alle Spalten', () => {
    const o = importWeeks([woche([nullLinie(minutes('0700'))])]);
    const m = entries(o.result.plan).find((e): e is Marker => e.type === 'marker');
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });
});

describe('F-FIX Runde 3: nur Linien auf den Anker legen (CR-3-04, R-8.2-44)', () => {
  it('[R-8.2-44] Gefüllte Form mit Anker der Höhe 0: Lage aus der xfrm wie bisher, nicht flach', () => {
    const y0 = Math.round(yOf(minutes('0900')));
    const y1 = Math.round(yOf(minutes('1000')));
    const sp =
      `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id++}" name="Form fiktiv"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
      `<xdr:spPr><a:xfrm><a:off x="${X0}" y="${y0}"/><a:ext cx="${X1 - X0}" cy="${y1 - y0}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
      `<a:solidFill><a:srgbClr val="FFFF99"/></a:solidFill></xdr:spPr></xdr:sp>`;
    const anker = `<xdr:twoCellAnchor>${punkt('from', X0, minutes('0900'))}${punkt('to', X1, minutes('0900'))}${sp}<xdr:clientData/></xdr:twoCellAnchor>`;
    const sheet = readWorkbook(buildKpWorkbook([emptyWeek({ rawShapes: [anker] })])).sheets[0];
    const s = sheet?.shapes.find((x) => x.name === 'Form fiktiv');
    expect(s?.box.y0).toBeCloseTo(y0, 0);
    expect(s?.box.y1).toBeCloseTo(y1, 0);
  });

  it('[R-8.2-44] Form mit Geometrie «line» (xdr:sp) und Anker der Höhe 0: Lage am Anker', () => {
    const y = Math.round(yOf(minutes('2100')));
    const sp =
      `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id++}" name="Strich fiktiv"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
      `<xdr:spPr><a:xfrm><a:off x="${X0}" y="${Math.round(yOf(minutes('2015')))}"/><a:ext cx="${X1 - X0}" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom></xdr:spPr></xdr:sp>`;
    const anker = `<xdr:twoCellAnchor>${punkt('from', X0, minutes('2100'))}${punkt('to', X1, minutes('2100'))}${sp}<xdr:clientData/></xdr:twoCellAnchor>`;
    const sheet = readWorkbook(buildKpWorkbook([emptyWeek({ rawShapes: [anker] })])).sheets[0];
    const s = sheet?.shapes.find((x) => x.name === 'Strich fiktiv');
    expect(s?.box.y0).toBeCloseTo(y, 0);
  });
});

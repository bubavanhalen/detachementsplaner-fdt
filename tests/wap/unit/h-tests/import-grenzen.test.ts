// @vitest-environment jsdom
// H-TESTS (Härtung, TR-H-15, TR-H-16): Import-Regeln an Grenzwerten und Transformationen durch den ganzen Import
// (Beschrieb 8.2 Regel 3, Regel 11; Gate S A2; R-8.2-09, R-8.2-42). Fiktive Arbeitsmappen aus dem Testbaukasten.
import { describe, expect, it } from 'vitest';
import {
  besoBox,
  block,
  bold,
  emptyWeek,
  geometryOf,
  normal,
  rawShape,
  type ShapeDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { blocks, importWeeks, titleOf } from '../import/support';

/** Kästchen Nr 10 bei `box`, Termintext 0830 → Berichtseinträge «Kästchen neben dem Termintext». */
function deviation(box: string): number[] {
  const o = importWeeks([
    emptyWeek({
      shapes: [besoBox(0, 4, box, 10)],
      agenda: [{ day: 0, paragraphs: [[normal('10 0830: Eins.')]] }],
    }),
  ]);
  return o.report.items.filter((i) => i.kind === 'boxTimeDeviation').map((i) => i.besoNumber ?? -1);
}

describe('H-TESTS Regel 3: Grenzwert der Abweichung', () => {
  it('[R-8.2-09] 16 Min vor dem Termintext → Berichtseintrag; 15 Min → keiner', () => {
    expect(deviation('0814')).toEqual([10]);
    expect(deviation('0815')).toEqual([]);
  });

  it('[R-8.2-09] 16 Min nach dem Termintext → Berichtseintrag; 15 Min → keiner', () => {
    expect(deviation('0846')).toEqual([10]);
    expect(deviation('0845')).toEqual([]);
  });
});

/** Zielblock Mo, Spalte `col`, 0800–1200, über die ganze Spaltenbreite. */
const target = (col: number): ShapeDef =>
  block(0, [col, col], '0800', '1200', [[bold('Ziel')]], { fraction: [0, 1] });

function ziel(shapes: readonly ShapeDef[], rawShapes: readonly string[]) {
  const o = importWeeks([emptyWeek({ shapes, rawShapes })]);
  return {
    block: blocks(o.result.plan).find((b) => titleOf(b) === 'Ziel'),
    hidden: o.report.items.filter((i) => i.kind === 'hidden'),
  };
}

/** Rechteck der Zielfläche (EMU) in Spalte `col`. */
function zielFlaeche(col: number) {
  const g = geometryOf(emptyWeek());
  const [x0, x1] = g.colSpan(0, col);
  return { x0, x1, y0: yOf(480), y1: yOf(720) };
}

/** Ungedrehte Gruppe genau über der Zielfläche (Kindkoordinaten = Blattkoordinaten). */
function gruppeUeberZiel(col: number, kind: string): string {
  const { x0, x1, y0, y1 } = zielFlaeche(col);
  const [gx, gy, gw, gh] = [x0, y0, x1 - x0, y1 - y0].map(Math.round) as [
    number,
    number,
    number,
    number,
  ];
  return `<xdr:absoluteAnchor><xdr:pos x="${gx}" y="${gy}"/><xdr:ext cx="${gw}" cy="${gh}"/><xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="9102" name="Gruppe gedreht"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr><a:xfrm><a:off x="${gx}" y="${gy}"/><a:ext cx="${gw}" cy="${gh}"/><a:chOff x="${gx}" y="${gy}"/><a:chExt cx="${gw}" cy="${gh}"/></a:xfrm></xdr:grpSpPr>${kind}</xdr:grpSp><xdr:clientData/></xdr:absoluteAnchor>`;
}

/** Quer liegendes gefülltes Rechteck um die Mitte der Zielfläche, gedreht um `rot` Grad (Kindform ohne Anker). */
function querDecke(col: number, rot: number): string {
  const { x0, x1, y0, y1 } = zielFlaeche(col);
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const kind = rawShape(cx - h / 2, cy - w / 2, cx + h / 2, cy + w / 2, {
    fill: 'FDEADA',
    paragraphs: [[bold('Decke')]],
    rotation: rot,
  })
    .replace(/^<xdr:absoluteAnchor>.*?<xdr:ext[^>]*\/>/, '')
    .replace(/<xdr:clientData\/><\/xdr:absoluteAnchor>$/, '');
  return gruppeUeberZiel(col, kind);
}

/**
 * Gruppe der doppelten Zielbreite, rechte Hälfte = Zielfläche in Spalte `col`; das Kind liegt in Kindkoordinaten
 * links (0–500 von 1000). Mit `flipH` spiegelt die Gruppe das Kind auf die rechte Hälfte.
 */
function gruppe(col: number, flipH: boolean): string {
  const { x0, x1, y0, y1 } = zielFlaeche(col);
  const w = x1 - x0;
  const child = rawShape(0, 0, 500, 1000, { fill: 'FDEADA', paragraphs: [[bold('Kind')]] })
    .replace(/^<xdr:absoluteAnchor>.*?<xdr:ext[^>]*\/>/, '')
    .replace(/<xdr:clientData\/><\/xdr:absoluteAnchor>$/, '');
  const gx = Math.round(x0 - w);
  const flip = flipH ? ' flipH="1"' : '';
  return `<xdr:absoluteAnchor><xdr:pos x="${gx}" y="${Math.round(y0)}"/><xdr:ext cx="${Math.round(2 * w)}" cy="${Math.round(y1 - y0)}"/><xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="9101" name="Gruppe gespiegelt"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr><a:xfrm${flip}><a:off x="${gx}" y="${Math.round(y0)}"/><a:ext cx="${Math.round(2 * w)}" cy="${Math.round(y1 - y0)}"/><a:chOff x="0" y="0"/><a:chExt cx="1000" cy="1000"/></a:xfrm></xdr:grpSpPr>${child}</xdr:grpSp><xdr:clientData/></xdr:absoluteAnchor>`;
}

describe('H-TESTS Verdeckung nach der Transformation durch den ganzen Import', () => {
  it('[R-8.2-42] später gezeichnete Gruppe: quer liegende Kindform mit rot 90° deckt das senkrechte Ziel ganz → kein Eintrag, Bericht «verdeckt»', () => {
    const r = ziel([target(2)], [querDecke(2, 90)]);
    expect(r.block).toBeUndefined();
    expect(r.hidden).toHaveLength(1);
  });

  it('[R-8.2-42] dieselbe Form ohne Drehung deckt nur einen Streifen → Ziel bleibt Eintrag, kein Bericht «verdeckt»', () => {
    const r = ziel([target(2)], [querDecke(2, 0)]);
    expect(r.block).toBeDefined();
    expect(r.hidden).toHaveLength(0);
  });

  it('[R-8.2-42] Gruppe mit flipH spiegelt die gefüllte Kindform auf das Ziel → kein Eintrag, Bericht «verdeckt»', () => {
    const r = ziel([target(2)], [gruppe(2, true)]);
    expect(r.block).toBeUndefined();
    expect(r.hidden).toHaveLength(1);
  });

  it('[R-8.2-42] dieselbe Gruppe ohne flipH: Kindform liegt neben dem Ziel → Ziel bleibt Eintrag', () => {
    const r = ziel([target(2)], [gruppe(2, false)]);
    expect(r.block).toBeDefined();
    expect(r.hidden).toHaveLength(0);
  });
});

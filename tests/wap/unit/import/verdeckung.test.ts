// @vitest-environment jsdom
// I4 (E1-08): Gate S A2 «nur die oberste Ebene» – ganz und teilweise verdeckte Formen (R-8.2-39 bis R-8.2-42;
// Q-042, Q-044 (d) Arbeitsannahmen). Fiktive Arbeitsmappen; Anteile über Breitenbruchteile exakt gesetzt.
import { describe, expect, it } from 'vitest';
import { coveredShare, visibleSpan } from '../../../../src/io/wap-import/geometry';
import {
  block,
  bold,
  emptyWeek,
  geometryOf,
  normal,
  rawShape,
  type ShapeDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { blocks, entries, importWeeks, titleOf } from './support';

const target = (extra: Partial<ShapeDef> = {}): ShapeDef =>
  block(0, [0, 0], '0800', '1200', [[bold('Ziel')]], { fraction: [0, 1], ...extra });
const cover = (
  from: string,
  to: string,
  fraction: readonly [number, number],
  title = 'Decke',
): ShapeDef => block(0, [0, 0], from, to, [[bold(title)]], { fraction, fill: 'FDEADA' });

function outcome(shapes: readonly ShapeDef[], rawShapes: readonly string[] = []) {
  const o = importWeeks([emptyWeek({ shapes, rawShapes })]);
  const zielBlocks = blocks(o.result.plan).filter((b) => titleOf(b) === 'Ziel');
  const hidden = o.report.items.filter((i) => i.kind === 'hidden');
  const partly = o.report.items.filter((i) => i.kind === 'partlyHidden');
  return { o, ziel: zielBlocks[0], hidden, partly };
}

describe('Verdeckung (Gate S A2)', () => {
  it('[R-8.2-39] zu 100 % und zu 99,0 % bedeckt → kein Eintrag, Bericht «verdeckt»; 98,9 % → Eintrag', () => {
    const full = outcome([target(), cover('0800', '1200', [0, 1])]);
    expect(full.ziel).toBeUndefined();
    expect(full.hidden).toHaveLength(1);
    expect(full.hidden[0]?.target.shapeIndex).not.toBeNull();
    const ninetyNine = outcome([target(), cover('0800', '1200', [0, 0.99])]);
    expect(ninetyNine.ziel).toBeUndefined();
    expect(ninetyNine.hidden).toHaveLength(1);
    const below = outcome([target(), cover('0800', '1200', [0, 0.989])]);
    expect(below.ziel).toBeDefined();
    expect(below.hidden).toHaveLength(0);
  });

  it('[R-8.2-39] zwei sich überlappende Decken zusammen 99,0 % → «verdeckt»; zusammen 98,9 % → Eintrag; Bilanz je Blatt', () => {
    const union = outcome([
      target(),
      cover('0800', '1200', [0, 0.6], 'A'),
      cover('0800', '1200', [0.3, 0.99], 'B'),
    ]);
    expect(union.ziel).toBeUndefined();
    expect(union.hidden).toHaveLength(1);
    const sheet = union.o.report.sheets[0];
    expect(sheet !== undefined && sheet.shapesRead === sheet.assigned + sheet.unassigned).toBe(
      true,
    );
    expect(sheet?.unassigned).toBe(1);
    const less = outcome([
      target(),
      cover('0800', '1200', [0, 0.6], 'A'),
      cover('0800', '1200', [0.3, 0.989], 'B'),
    ]);
    expect(less.ziel).toBeDefined();
  });

  it('[R-8.2-40] 98,9 % und 5,0 % → Eintrag und Bericht mit Anteil; 4,9 % → keine Meldung; 2 × 3 % → 6 %', () => {
    const high = outcome([target(), cover('0800', '1200', [0, 0.989])]);
    expect(high.partly[0]?.message.cause).toMatch(/\(98 %\)/);
    const five = outcome([target(), cover('0800', '1200', [0, 0.05])]);
    expect(five.ziel).toBeDefined();
    expect(five.partly[0]?.message.cause).toMatch(/\(5 %\)/);
    const under = outcome([target(), cover('0800', '1200', [0, 0.049])]);
    expect(under.partly).toHaveLength(0);
    const two = outcome([
      target(),
      cover('0800', '1200', [0, 0.03], 'A'),
      cover('0800', '1200', [0.5, 0.53], 'B'),
    ]);
    expect(two.partly[0]?.message.cause).toMatch(/\(6 %\)/);
  });

  it('[R-8.2-41] Zeit des teilweise verdeckten Eintrags: nur am Anfang/Ende gekürzt, sonst volle Zeit', () => {
    const time = (...covers: ShapeDef[]) => outcome([target(), ...covers]).ziel?.time;
    expect(time(cover('0800', '0945', [0, 1]))).toEqual({ form: 'range', from: 585, to: 720 });
    expect(time(cover('1100', '1200', [0, 1]))).toEqual({ form: 'range', from: 480, to: 660 });
    expect(time(cover('0800', '0900', [0, 1], 'A'), cover('1100', '1200', [0, 1], 'B'))).toEqual({
      form: 'range',
      from: 540,
      to: 660,
    });
    expect(time(cover('0900', '1000', [0, 1]))).toEqual({ form: 'range', from: 480, to: 720 });
    expect(time(cover('0830', '0900', [0, 1], 'A'), cover('1000', '1030', [0, 1], 'B'))).toEqual({
      form: 'range',
      from: 480,
      to: 720,
    });
    expect(time(cover('0800', '0900', [0, 1], 'A'), cover('1000', '1030', [0, 1], 'B'))).toEqual({
      form: 'range',
      from: 540,
      to: 720,
    });
    expect(time(cover('0800', '1200', [0, 0.5]))).toEqual({ form: 'range', from: 480, to: 720 });
    expect(
      time(cover('0800', '0945', [0, 0.5], 'A'), cover('0800', '0945', [0.5, 1], 'B')),
    ).toEqual({
      form: 'range',
      from: 585,
      to: 720,
    });
    // Der Bericht nennt die ursprüngliche Spanne.
    const o = outcome([target(), cover('0800', '0945', [0, 1])]);
    expect(o.partly[0]?.span).toEqual({ from: 480, to: 720 });
  });

  it('[R-8.2-42] früher gezeichnete, ungefüllte oder durchsichtige Form verdeckt nicht', () => {
    const earlier = outcome([cover('0800', '1200', [0, 1]), target()]);
    expect(earlier.ziel).toBeDefined();
    expect(earlier.partly).toHaveLength(0);
    const unfilled = outcome([target(), { ...cover('0800', '1200', [0, 1]), fill: null }]);
    expect(unfilled.ziel).toBeDefined();
    expect(unfilled.hidden).toHaveLength(0);
    const transparent = outcome([target(), { ...cover('0800', '1200', [0, 1]), alpha: 0.6 }]);
    expect(transparent.ziel).toBeDefined();
    expect(transparent.hidden).toHaveLength(0);
  });

  it('[R-8.2-42] Form in einer später gezeichneten Gruppe und gedrehte Form verdecken nach der Transformation', () => {
    const g = geometryOf(emptyWeek());
    const [x0, x1] = g.colSpan(0, 0);
    const y0 = yOf(480);
    const y1 = yOf(720);
    const child = rawShape(0, 0, 1000, 1000, { fill: 'FDEADA', paragraphs: [[bold('Kind')]] })
      .replace(/^<xdr:absoluteAnchor>.*?<xdr:ext[^>]*\/>/, '')
      .replace(/<xdr:clientData\/><\/xdr:absoluteAnchor>$/, '');
    const group = `<xdr:absoluteAnchor><xdr:pos x="${x0}" y="${y0}"/><xdr:ext cx="${x1 - x0}" cy="${y1 - y0}"/><xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="9001" name="Gruppe"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="1000"/><a:chOff x="0" y="0"/><a:chExt cx="1000" cy="1000"/></a:xfrm></xdr:grpSpPr>${child}</xdr:grpSp><xdr:clientData/></xdr:absoluteAnchor>`;
    const grouped = outcome([target()], [group]);
    expect(grouped.ziel).toBeUndefined();
    expect(grouped.hidden).toHaveLength(1);
    // Gedreht: Ein 90° gedrehtes, quer liegendes Rechteck deckt nach der Drehung das senkrechte Ziel ganz.
    const w = x1 - x0;
    const h = y1 - y0;
    const cxm = (x0 + x1) / 2;
    const cym = (y0 + y1) / 2;
    expect(
      coveredShare({ x0, y0, x1, y1 }, [
        { x0: cxm - h / 2, y0: cym - w / 2, x1: cxm + h / 2, y1: cym + w / 2 },
      ]),
    ).toBeLessThan(1);
    expect(visibleSpan({ x0, y0, x1, y1 }, [{ x0, y0, x1, y1: cym }])).toEqual({ y0: cym, y1 });
  });

  it('[R-8.2-42] Linienform unter einer gefüllten Form bleibt Marker, keine Meldung «verdeckt»', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          { day: 0, cols: [0, 2], from: 420, to: 420, line: true },
          block(0, [2, 2], '0702', '0716', [[normal('AV')]], { fill: 'FFFF99' }),
          block(0, [0, 1], '0645', '0730', [[bold('Antreten')]], { fill: 'FDEADA' }),
        ],
      }),
    ]);
    expect(entries(o.result.plan).some((e) => e.type === 'marker')).toBe(true);
    expect(o.report.items.filter((i) => i.kind === 'hidden')).toHaveLength(0);
  });
});

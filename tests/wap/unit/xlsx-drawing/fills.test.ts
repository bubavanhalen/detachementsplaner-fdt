// @vitest-environment jsdom
// Vertrag E1-07 §2e: Füllung und Linie je Form (readShapeFills).
import { describe, expect, it } from 'vitest';
import { readShapeFills, type ShapeFillExtras } from '../../../../src/io/xlsx-drawing';
import {
  absAnchor,
  childSp,
  defaultTheme,
  drawingXml,
  emptySheet,
  grp,
  mixedDrawingXml,
  shapesOf,
  sheetHiddenB,
  solid,
  sp,
  xmlDoc,
} from './fixture';

const keys = (map: ReadonlyMap<number, unknown>) => [...map.keys()].sort((a, b) => a - b);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const NONE: ShapeFillExtras = {
  fillAlpha: null,
  fillStops: [],
  lineDash: null,
  lineWidthEmu: null,
};

const grad = (stops: string) =>
  `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill>`;
const gs = (pos: number, color: string) => `<a:gs pos="${pos}">${color}</a:gs>`;
const srgb = (val: string, alpha?: number) =>
  `<a:srgbClr val="${val}">${alpha == null ? '' : `<a:alpha val="${alpha}"/>`}</a:srgbClr>`;

/** Je Form ein eigener Anker; Ergebnis nach Formname. */
function fillsByName(shapes: string[]): Map<string, ShapeFillExtras | undefined> {
  const doc = xmlDoc(
    drawingXml(shapes.map((s, i) => absAnchor(0, i * 200_000, 100_000, 100_000, s)).join('')),
  );
  const sheet = emptySheet();
  const theme = defaultTheme();
  const fills = readShapeFills(doc, sheet, theme);
  return new Map(shapesOf(doc, sheet, theme).map((s) => [s.name, fills.get(s.index)]));
}

describe('xlsx-drawing readShapeFills (Vertrag E1-07 §2e)', () => {
  it('[R-L-11] (§2e) Schlüssel genau 0 … n-1 wie readDrawing, jede Form hat einen Eintrag (auch blattabhängig)', () => {
    const doc = xmlDoc(mixedDrawingXml());
    const theme = defaultTheme();
    for (const sheet of [emptySheet(), sheetHiddenB()]) {
      const n = shapesOf(doc, sheet, theme).length;
      const fills = readShapeFills(doc, sheet, theme);
      expect(keys(fills)).toEqual(range(n));
      for (const value of fills.values()) expect(value).toBeDefined();
    }
  });

  it('[R-L-11] (§2e) fillAlpha aus a:alpha der Einfarb- und Musterfüllung, auf 0 … 1 begrenzt; ohne a:alpha null', () => {
    const f = fillsByName([
      sp({ name: 'Halb', props: solid('FF0000', 50000) }),
      sp({ name: 'Voll', props: solid('00FF00') }),
      sp({ name: 'Zuviel', props: solid('0000FF', 150000) }),
      sp({ name: 'Grenze', props: solid('0000FF', 100000) }),
      sp({ name: 'Null', props: solid('0000FF', 0) }),
      sp({ name: 'Negativ', props: solid('0000FF', -20000) }),
      sp({
        name: 'Muster',
        props: `<a:pattFill prst="pct50"><a:fgClr>${srgb('AABBCC', 25000)}</a:fgClr><a:bgClr>${srgb('FFFFFF', 90000)}</a:bgClr></a:pattFill>`,
      }),
    ]);
    expect(f.get('Halb')?.fillAlpha).toBe(0.5);
    expect(f.get('Voll')?.fillAlpha).toBeNull();
    expect(f.get('Zuviel')?.fillAlpha).toBe(1);
    expect(f.get('Grenze')?.fillAlpha).toBe(1);
    expect(f.get('Null')?.fillAlpha).toBe(0);
    expect(f.get('Negativ')?.fillAlpha).toBe(0);
    expect(f.get('Muster')?.fillAlpha).toBe(0.25);
    for (const name of ['Halb', 'Voll', 'Muster']) expect(f.get(name)?.fillStops).toEqual([]);
  });

  it('[R-L-11] (§2e negativ) fillAlpha null ohne Füllung, bei noFill, blipFill, Verlauf und Füllung nur über p:style/a:fillRef', () => {
    const f = fillsByName([
      sp({ name: 'Ohne' }),
      sp({ name: 'Keine', props: '<a:noFill/>' }),
      sp({
        name: 'Bild',
        props: '<a:blipFill><a:blip/><a:stretch><a:fillRect/></a:stretch></a:blipFill>',
      }),
      sp({
        name: 'Verlauf',
        props: grad(gs(0, srgb('FF0000', 50000)) + gs(100000, srgb('0000FF', 50000))),
      }),
      sp({
        name: 'Stil',
        style:
          `<a:lnRef idx="1">${srgb('000000')}</a:lnRef><a:fillRef idx="1">${srgb('CCCCCC', 40000)}</a:fillRef>` +
          `<a:effectRef idx="0">${srgb('000000')}</a:effectRef><a:fontRef idx="minor">${srgb('000000')}</a:fontRef>`,
      }),
    ]);
    expect(f.get('Ohne')).toEqual(NONE);
    expect(f.get('Keine')).toEqual(NONE);
    expect(f.get('Bild')).toEqual(NONE);
    expect(f.get('Verlauf')?.fillAlpha).toBeNull();
    expect(f.get('Stil')?.fillAlpha).toBeNull();
    expect(f.get('Stil')?.fillStops).toEqual([]);
  });

  it('[R-L-11] (§2e) fillStops: alle auflösbaren a:gs nach position, bei Gleichstand Dokumentreihenfolge; alpha sonst 1', () => {
    const f = fillsByName([
      sp({
        name: 'Verlauf',
        props: grad(
          gs(100000, srgb('FF0000')) +
            gs(0, srgb('00FF00', 40000)) +
            gs(50000, '<a:schemeClr val="unbekannt"/>') +
            gs(50000, srgb('111111')) +
            gs(50000, srgb('222222', 75000)),
        ),
      }),
    ]);
    expect(f.get('Verlauf')?.fillStops).toEqual([
      { position: 0, color: '00FF00', alpha: 0.4 },
      { position: 0.5, color: '111111', alpha: 1 },
      { position: 0.5, color: '222222', alpha: 0.75 },
      { position: 1, color: 'FF0000', alpha: 1 },
    ]);
  });

  it('[R-L-11] (§2e) grpFill übernimmt die Füllung der nächsten Gruppe mit eigener Füllung; noFill der Gruppe ergibt keine', () => {
    const solidGroup = grp(
      'Einfarbig',
      childSp({ name: 'Kind einfarbig', props: '<a:grpFill/>' }),
      `${solid('ABCDEF', 30000)}<a:ln w="38100"><a:prstDash val="dash"/></a:ln>`,
    );
    const gradGroup = grp(
      'Aussen',
      grp('Innen', childSp({ name: 'Kind Verlauf', props: '<a:grpFill/>' })),
      grad(gs(0, srgb('010203')) + gs(100000, srgb('040506', 20000))),
    );
    const emptyGroup = grp(
      'Aussen 2',
      grp('Innen 2', childSp({ name: 'Kind ohne', props: '<a:grpFill/>' }), '<a:noFill/>'),
      solid('ABCDEF', 30000),
    );
    const f = fillsByName([solidGroup, gradGroup, emptyGroup]);
    expect(f.get('Kind einfarbig')).toEqual({ ...NONE, fillAlpha: 0.3 });
    expect(f.get('Kind Verlauf')?.fillStops).toEqual([
      { position: 0, color: '010203', alpha: 1 },
      { position: 1, color: '040506', alpha: 0.2 },
    ]);
    expect(f.get('Kind ohne')).toEqual(NONE);
  });

  it('[R-L-11] (§2e) lineDash aus prstDash, «custom» bei custDash, sonst null; lineWidthEmu aus a:ln@w', () => {
    const f = fillsByName([
      sp({ name: 'Punkt', props: '<a:ln w="12700"><a:prstDash val="sysDot"/></a:ln>' }),
      sp({
        name: 'Frei',
        props: '<a:ln><a:custDash><a:ds d="100000" sp="100000"/></a:custDash></a:ln>',
      }),
      sp({
        name: 'Dünn',
        props: '<a:ln w="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>',
      }),
      sp({ name: 'Ohne Linie', props: solid('FFFFFF') }),
    ]);
    expect(f.get('Punkt')).toMatchObject({ lineDash: 'sysDot', lineWidthEmu: 12700 });
    expect(f.get('Frei')).toMatchObject({ lineDash: 'custom', lineWidthEmu: null });
    expect(f.get('Dünn')).toMatchObject({ lineDash: null, lineWidthEmu: 0 });
    expect(f.get('Ohne Linie')).toMatchObject({ lineDash: null, lineWidthEmu: null });
  });

  it('[R-L-11] (§2e negativ) Linien werden nicht von Gruppen geerbt', () => {
    const f = fillsByName([
      grp(
        'Liniengruppe',
        childSp({ name: 'Kind ohne Linie', props: solid('FFFFFF') }),
        '<a:ln w="38100"><a:prstDash val="dash"/></a:ln>',
      ),
    ]);
    expect(f.get('Kind ohne Linie')).toMatchObject({ lineDash: null, lineWidthEmu: null });
  });

  it('[R-L-11] (§2e Grenzwerte, P15) Stopp-alpha ebenfalls auf 0 … 1 begrenzt', () => {
    const f = fillsByName([
      sp({
        name: 'Verlauf',
        props: grad(
          gs(0, srgb('0A0A0A', -5000)) +
            gs(50000, srgb('0B0B0B', 100000)) +
            gs(100000, srgb('0C0C0C', 250000)),
        ),
      }),
    ]);
    expect(f.get('Verlauf')?.fillStops).toEqual([
      { position: 0, color: '0A0A0A', alpha: 0 },
      { position: 0.5, color: '0B0B0B', alpha: 1 },
      { position: 1, color: '0C0C0C', alpha: 1 },
    ]);
  });

  it('[R-L-11] (§2e negativ, P15) lineWidthEmu null ohne w und bei nicht numerischem w', () => {
    const f = fillsByName([
      sp({ name: 'Ohne w', props: '<a:ln><a:prstDash val="dash"/></a:ln>' }),
      sp({ name: 'Text w', props: '<a:ln w="dick"><a:prstDash val="dash"/></a:ln>' }),
      sp({ name: 'Leeres w', props: '<a:ln w=""/>' }),
    ]);
    expect(f.get('Ohne w')).toMatchObject({ lineDash: 'dash', lineWidthEmu: null });
    expect(f.get('Text w')).toMatchObject({ lineDash: 'dash', lineWidthEmu: null });
    expect(f.get('Leeres w')).toMatchObject({ lineDash: null, lineWidthEmu: null });
  });

  it('[R-L-11] (§2e) rein: Dokument unverändert, gleiche Eingabe gleiches Ergebnis', () => {
    const doc = xmlDoc(mixedDrawingXml());
    const before = new XMLSerializer().serializeToString(doc);
    const a = readShapeFills(doc, emptySheet(), defaultTheme());
    const b = readShapeFills(doc, emptySheet(), defaultTheme());
    expect(new XMLSerializer().serializeToString(doc)).toBe(before);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

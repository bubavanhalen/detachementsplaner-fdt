// @vitest-environment jsdom
// Vertrag E1-07 §2d: Textläufe je Form (readShapeRuns).
import { describe, expect, it } from 'vitest';
import { readShapeRuns, type ShapeTextRun, type Theme } from '../../../../src/io/xlsx-drawing';
import { parseTheme } from '../../../../src/io/xlsx-drawing/colors';
import {
  absAnchor,
  at,
  bareRun,
  defaultTheme,
  drawingXml,
  emptySheet,
  mixedDrawingXml,
  run,
  shapesOf,
  sheetHiddenB,
  sp,
  themeXml,
  txBody,
  xmlDoc,
} from './fixture';

const keys = (map: ReadonlyMap<number, unknown>) => [...map.keys()].sort((a, b) => a - b);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const brief = (runs: readonly ShapeTextRun[] | undefined) =>
  (runs ?? []).map((r) => ({ paragraph: r.paragraph, line: r.line, text: r.text }));

/** Eine Form je Anker, Textkörper frei. */
const oneShape = (body: string, style = '') =>
  xmlDoc(drawingXml(absAnchor(0, 0, 100_000, 100_000, sp({ name: 'Form', txBody: body, style }))));

describe('xlsx-drawing readShapeRuns (Vertrag E1-07 §2d)', () => {
  it('[R-L-11] (§2d) Schlüssel genau 0 … n-1 wie readDrawing; Fallback statt Choice, ausgeblendete und verworfene Formen fehlen', () => {
    const doc = xmlDoc(mixedDrawingXml());
    const theme = defaultTheme();
    const sheet = emptySheet();
    const shapes = shapesOf(doc, sheet, theme);
    const runs = readShapeRuns(doc, sheet, theme);
    expect(keys(runs)).toEqual(range(shapes.length));
    const byName = new Map(shapes.map((s) => [s.name, s.index]));
    expect(brief(runs.get(byName.get('Text') ?? -1)).map((r) => r.text)).toEqual(['Erste Form']);
    expect(runs.get(byName.get('Leer') ?? -1)).toEqual([]);
    expect(runs.get(byName.get('Linie') ?? -1)).toEqual([]);
    expect(runs.get(byName.get('Kind 2') ?? -1)).toEqual([]);
    expect(brief(runs.get(byName.get('Ersatz') ?? -1)).map((r) => r.text)).toEqual([
      'Fallback-Text',
    ]);
    expect(brief(runs.get(byName.get('Ankerkind') ?? -1)).map((r) => r.text)).toEqual([
      'Ankertext',
    ]);
    expect(brief(runs.get(byName.get('Letzte') ?? -1)).map((r) => r.text)).toEqual(['Ende']);
    const all = [...runs.values()].flat().map((r) => r.text);
    for (const text of ['Choice-Text', 'Versteckter Text', 'Verworfener Text'])
      expect(all).not.toContain(text);
  });

  it('[R-L-11] (§2d, P4) Zuordnung hängt vom Blatt ab wie readDrawing: Gruppe am Anker über ausgeblendeter Spalte entfällt', () => {
    const doc = xmlDoc(mixedDrawingXml());
    const theme = defaultTheme();
    const visible = emptySheet();
    const hidden = sheetHiddenB();
    const nVisible = shapesOf(doc, visible, theme).length;
    const shapesHidden = shapesOf(doc, hidden, theme);
    expect(shapesHidden.length).toBe(nVisible - 1);
    const runs = readShapeRuns(doc, hidden, theme);
    expect(keys(runs)).toEqual(range(shapesHidden.length));
    const last = shapesHidden.find((s) => s.name === 'Letzte');
    expect(brief(runs.get(last?.index ?? -1)).map((r) => r.text)).toEqual(['Ende']);
    expect([...runs.values()].flat().map((r) => r.text)).not.toContain('Ankertext');
  });

  it('[R-L-11] (§2d) Läufe a:r und a:fld in Dokumentreihenfolge, Text unverändert, leere entfallen; paragraph und line', () => {
    const doc = oneShape(
      txBody([
        `${run('Ausb ', 'b="1"')}${bareRun('Funk')}<a:br/>${run(' Zfhr')}`,
        '<a:endParaRPr lang="de-CH"/>',
        `<a:fld id="{00000000-0000-0000-0000-000000000001}" type="slidenum"><a:rPr lang="de-CH"/><a:t>Seite 1</a:t></a:fld>${run('')}`,
      ]),
    );
    const shape = at(shapesOf(doc, emptySheet(), defaultTheme()), 0);
    expect(shape.lines).toEqual(['Ausb Funk', 'Zfhr', '', 'Seite 1']);
    expect(brief(readShapeRuns(doc, emptySheet(), defaultTheme()).get(0))).toEqual([
      { paragraph: 0, line: 0, text: 'Ausb ' },
      { paragraph: 0, line: 0, text: 'Funk' },
      { paragraph: 0, line: 1, text: ' Zfhr' },
      { paragraph: 2, line: 3, text: 'Seite 1' },
    ]);
  });

  it('[R-L-11] (§2d Invariante) Läufe je Zeile zusammengefügt, Leerraum inkl. U+00A0 zusammengefasst und getrimmt = WapShape.lines', () => {
    const doc = xmlDoc(
      drawingXml(
        absAnchor(
          0,
          0,
          100_000,
          100_000,
          sp({
            name: 'A',
            txBody: txBody([
              `${run('A ')}${run(' B  ')}${run('C')}<a:br/><a:br/>${run('  D')}`,
              `${run(' ')}`,
              `${bareRun('E')}<a:fld id="{00000000-0000-0000-0000-000000000002}" type="datetime"><a:t> F </a:t></a:fld>`,
            ]),
          }),
        ) + mixedDrawingXml().replace(/^[\s\S]*?<xdr:wsDr[^>]*>|<\/xdr:wsDr>$/g, ''),
      ),
    );
    const sheet = emptySheet();
    const theme = defaultTheme();
    const shapes = shapesOf(doc, sheet, theme);
    const runs = readShapeRuns(doc, sheet, theme);
    expect(at(shapes, 0).lines).toEqual(['A B C', '', 'D', '', 'E F']);
    expect(keys(runs)).toEqual(range(shapes.length));
    for (const shape of shapes) {
      const own = runs.get(shape.index) ?? [];
      for (const r of own) {
        expect(r.text).not.toBe('');
        expect(r.line).toBeLessThan(shape.lines.length);
      }
      shape.lines.forEach((line, i) => {
        const joined = own
          .filter((r) => r.line === i)
          .map((r) => r.text)
          .join('')
          .replace(/[\s ]+/g, ' ')
          .trim();
        expect(joined).toBe(line);
      });
    }
  });

  describe('Eigenschaften', () => {
    const theme: Theme = parseTheme(xmlDoc(themeXml({ accent1: '123456' })));
    const lst =
      '<a:lvl1pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="00AA00"/></a:solidFill></a:defRPr></a:lvl1pPr>' +
      '<a:lvl2pPr><a:defRPr b="1" strike="sngStrike"/></a:lvl2pPr>';
    const doc = oneShape(
      txBody(
        [
          run('r0', 'b="1" sz="1100"', '<a:solidFill><a:srgbClr val="ff0000"/></a:solidFill>') +
            run('r1', 'b="0"') +
            run('r2', 'b="true" strike="dblStrike"') +
            run('r3', 'strike="noStrike"') +
            bareRun('r4'),
          '<a:pPr lvl="1"><a:defRPr sz="1000"/></a:pPr>' +
            bareRun('p1r0') +
            run('p1r1', 'strike="noStrike"'),
          '<a:pPr><a:defRPr b="1"/></a:pPr>' +
            run('p2r0', 'sz="850"', '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>') +
            run('p2r1', 'b="false"'),
        ],
        lst,
      ),
    );
    const get = () => {
      const runs = readShapeRuns(doc, emptySheet(), theme).get(0) ?? [];
      return new Map(runs.map((r) => [r.text, r]));
    };

    it('[R-L-11] (§2d) bold aus b «1»/«true»; «0»/«false» und ohne Quelle nicht fett', () => {
      const r = get();
      expect(r.get('r0')?.bold).toBe(true);
      expect(r.get('r1')?.bold).toBe(false);
      expect(r.get('r2')?.bold).toBe(true);
      expect(r.get('r4')?.bold).toBe(false);
      expect(r.get('p2r1')?.bold).toBe(false);
    });

    it('[R-L-11] (§2d) strike: sngStrike/dblStrike durchgestrichen, noStrike und ohne Angabe nicht', () => {
      const r = get();
      expect(r.get('r2')?.strike).toBe(true);
      expect(r.get('r3')?.strike).toBe(false);
      expect(r.get('r0')?.strike).toBe(false);
      expect(r.get('p1r0')?.strike).toBe(true); // aus lvl2pPr
      expect(r.get('p1r1')?.strike).toBe(false);
    });

    it('[R-L-11] (§2d) color über drawingColor (RRGGBB gross), sonst null; sizePt = sz / 100, sonst null', () => {
      const r = get();
      expect(r.get('r0')?.color).toBe('FF0000');
      expect(r.get('r0')?.sizePt).toBe(11);
      expect(r.get('p2r0')?.color).toBe('123456');
      expect(r.get('p2r0')?.sizePt).toBe(8.5);
      expect(r.get('p1r0')?.color).toBeNull(); // lvl2pPr ohne Farbe, kein Rückfall auf lvl1pPr
    });

    it('[R-L-11] (§2d) Vorrang je Eigenschaft: rPr vor pPr/defRPr vor lstStyle/lvl‹lvl+1›pPr/defRPr', () => {
      const r = get();
      // r1: b aus rPr (0), Farbe und Grösse aus lvl1pPr (ohne lvl).
      expect([r.get('r1')?.bold, r.get('r1')?.color, r.get('r1')?.sizePt]).toEqual([
        false,
        '00AA00',
        9,
      ]);
      expect([r.get('r4')?.color, r.get('r4')?.sizePt]).toEqual(['00AA00', 9]);
      // p1 (lvl 1): Grösse aus pPr/defRPr, fett und durchgestrichen aus lvl2pPr.
      expect([r.get('p1r0')?.bold, r.get('p1r0')?.sizePt]).toEqual([true, 10]);
      // p2: fett aus pPr/defRPr; Grösse aus rPr, Farbe aus rPr; ohne lvl wieder lvl1pPr.
      expect([r.get('p2r0')?.bold, r.get('p2r0')?.sizePt]).toEqual([true, 8.5]);
      expect([r.get('p2r1')?.color, r.get('p2r1')?.sizePt]).toEqual(['00AA00', 9]);
    });

    it('[R-L-11] (§2d negativ) Formvorlage p:style/a:fontRef wird nicht ausgewertet', () => {
      const styled = oneShape(
        txBody([bareRun('Stil')]),
        '<a:lnRef idx="0"><a:srgbClr val="000000"/></a:lnRef><a:fillRef idx="0"><a:srgbClr val="000000"/></a:fillRef>' +
          '<a:effectRef idx="0"><a:srgbClr val="000000"/></a:effectRef><a:fontRef idx="minor"><a:srgbClr val="FF00FF"/></a:fontRef>',
      );
      const [only] = readShapeRuns(styled, emptySheet(), theme).get(0) ?? [];
      expect(only).toEqual({
        paragraph: 0,
        line: 0,
        text: 'Stil',
        bold: false,
        strike: false,
        color: null,
        sizePt: null,
      });
    });
  });

  it('[R-L-11] (§2d) rein: Dokument unverändert, gleiche Eingabe gleiches Ergebnis', () => {
    const doc = xmlDoc(mixedDrawingXml());
    const before = new XMLSerializer().serializeToString(doc);
    const a = readShapeRuns(doc, emptySheet(), defaultTheme());
    const b = readShapeRuns(doc, emptySheet(), defaultTheme());
    expect(new XMLSerializer().serializeToString(doc)).toBe(before);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

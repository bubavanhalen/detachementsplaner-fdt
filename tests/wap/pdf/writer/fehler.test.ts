// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Eingabeprüfung und Fehler invalidItem (R-10-01; Vertrag E1-02c §2.4, §5;
// Präzisierung P-7; Änderungsnotiz Vertragsprüfung V01, V06, V07, V13, Runde 2 V15, V16). Jede Prüfung mit
// positivem und negativem Fall; Fundstelle (pageIndex, itemIndex, character) und Meldungstexte verbindlich.
import { describe, expect, it, vi } from 'vitest';
import { PDF_WRITE_MESSAGES, PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import { WapError } from '../../../../src/model/wap/errors';
import {
  LINE_EXCLUDED_CODEPOINTS,
  type PageItem,
  type PageModel,
} from '../../../../src/model/wap/layout/pageModel';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import { readPdf } from '../../support/pdf/read';
import { jpegGrau, pngPalette } from './support/bilder';
import { rechteckNahe } from './support/pruefen';
import { ablehnung, pdfMitArtefakt, pdfOhneArtefakt } from './support/schreiben';
import {
  BLAU,
  bild,
  lauf,
  linie,
  pfad,
  ROT,
  rechteck,
  SCHWARZ,
  seite,
  strich,
  text,
  zeile,
} from './support/seiten';

const INVALID_CAUSE =
  'Das PDF konnte nicht erzeugt werden, weil ein Element der Seite ungültig ist.';
const INVALID_NEXT =
  'Den WAP-Planer neu laden und das PDF erneut erzeugen. Bleibt der Fehler, die zuletzt geänderten Einträge prüfen.';

/** Absichtlich ungültige Eingabe ausserhalb des Typs (nur für Fehlerfälle). */
function roh<T>(wert: unknown): T {
  return wert as T;
}

const GUT = text(20, 20, 'gültig');

/** Das Element steht auf Seite 2 an Stelle 2 (pageIndex 1, itemIndex 1). */
function anStelle(item: PageItem): PageModel[] {
  return [seite([GUT]), seite([GUT, item, GUT])];
}

interface Fund {
  readonly pageIndex: number | null;
  readonly itemIndex: number | null;
  readonly character: string | null;
}

async function ungueltig(pages: readonly PageModel[], fund: Fund, name: string): Promise<void> {
  const e = await ablehnung(writePdf({ pages, title: 'Fiktiv' }));
  expect(e, name).toBeInstanceOf(PdfWriteError);
  expect(e, name).toBeInstanceOf(WapError);
  const f = e as PdfWriteError;
  expect(
    { code: f.code, pageIndex: f.pageIndex, itemIndex: f.itemIndex, character: f.character },
    name,
  ).toEqual({ code: 'invalidItem', ...fund });
  expect(f.userMessage, name).toEqual({ cause: INVALID_CAUSE, nextStep: INVALID_NEXT });
  expect(f.message, name).toBe(INVALID_CAUSE);
  expect(f.name, name).toBe('PdfWriteError');
}

const ELEMENT: Fund = { pageIndex: 1, itemIndex: 1, character: null };

const NICHT_ENDLICH = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe('writePdf: Meldungen (V07)', () => {
  it('[R-10-01] (V07) PDF_WRITE_MESSAGES enthält die verbindlichen Texte; ein Fehler trägt genau diese Meldung', async () => {
    await ungueltig([], { pageIndex: null, itemIndex: null, character: null }, 'pages leer');
    expect(PDF_WRITE_MESSAGES.invalidItem).toEqual({
      cause: INVALID_CAUSE,
      nextStep: INVALID_NEXT,
    });
    expect(PDF_WRITE_MESSAGES.fontLoad).toEqual({
      cause: 'Die Schrift für das PDF konnte nicht geladen werden.',
      nextStep: 'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
    });
    expect(PDF_WRITE_MESSAGES.missingGlyph.nextStep).toBe(
      'Das Zeichen im betroffenen Eintrag ersetzen und das PDF erneut erzeugen.',
    );
  });
});

describe('writePdf: Seiten (§2.4)', () => {
  it('[R-10-01] pages leer → invalidItem ohne Fundstelle', async () => {
    await ungueltig([], { pageIndex: null, itemIndex: null, character: null }, 'pages leer');
  });

  it('[R-10-01] Seitengrösse nicht endlich oder ≤ 0 → invalidItem mit pageIndex, itemIndex null', async () => {
    const werte = [...NICHT_ENDLICH, 0, -1, -0.01];
    for (const w of werte) {
      await ungueltig(
        [seite([GUT]), seite([GUT], { widthPt: w, heightPt: 595.28 })],
        { pageIndex: 1, itemIndex: null, character: null },
        `Breite ${String(w)}`,
      );
      await ungueltig(
        [seite([GUT]), seite([GUT], { widthPt: 841.89, heightPt: w })],
        { pageIndex: 1, itemIndex: null, character: null },
        `Höhe ${String(w)}`,
      );
    }
  });

  it('[R-10-01] positiv: leere Seite, kleine und grosse Seiten, Fortsetzungsseite ergeben ein PDF', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('seiten-gueltig', [
        seite([]),
        seite([GUT], { widthPt: 1, heightPt: 1 }),
        seite([GUT], { widthPt: 2000, heightPt: 1500 }, 'continuation'),
      ]),
    );
    expect(info.pages).toHaveLength(3);
  });
});

describe('writePdf: Zahlen und Farben (§2.4)', () => {
  it('[R-10-01] nicht endliche Koordinaten in Rechteck, Linie, Text und Bild → invalidItem mit Fundstelle', async () => {
    const s = strich(SCHWARZ, 1);
    for (const v of NICHT_ENDLICH) {
      const faelle: [string, PageItem][] = [
        ['rect.x', rechteck({ x: v, y: 1, w: 2, h: 3 }, ROT, null)],
        ['rect.y', rechteck({ x: 1, y: v, w: 2, h: 3 }, ROT, null)],
        ['rect.w', rechteck({ x: 1, y: 1, w: v, h: 3 }, null, s)],
        ['rect.h', rechteck({ x: 1, y: 1, w: 2, h: v }, null, s)],
        ['line.x1', linie(v, 1, 2, 3, s)],
        ['line.y1', linie(1, v, 2, 3, s)],
        ['line.x2', linie(1, 1, v, 3, s)],
        ['line.y2', linie(1, 1, 2, v, s)],
        ['text.x', text(v, 10, 'a')],
        ['text.baselineY', text(10, v, 'a')],
        ['text.sizePt', text(10, 10, 'a', { sizePt: v })],
        // Bilder mit lesbaren Bytes, damit allein die Zahl den Fehler auslöst (TR-E102c-04).
        ['image.rect.x', bild({ x: v, y: 1, w: 2, h: 2 }, 'image/png', pngPalette().bytes)],
        ['image.rect.y', bild({ x: 1, y: v, w: 2, h: 2 }, 'image/png', pngPalette().bytes)],
        ['image.rect.w', bild({ x: 1, y: 1, w: v, h: 2 }, 'image/png', pngPalette().bytes)],
        ['image.rect.h', bild({ x: 1, y: 1, w: 2, h: v }, 'image/jpeg', jpegGrau().bytes)],
      ];
      for (const [name, item] of faelle) {
        await ungueltig(anStelle(item), ELEMENT, `${name} = ${String(v)}`);
      }
    }
  });

  it('[R-10-01] Strich: widthPt nicht endlich oder ≤ 0 → invalidItem (Rechteck, Linie, Pfad)', async () => {
    for (const w of [...NICHT_ENDLICH, 0, -0.5]) {
      const s = strich(SCHWARZ, w);
      await ungueltig(
        anStelle(rechteck({ x: 1, y: 1, w: 2, h: 3 }, null, s)),
        ELEMENT,
        `rect ${String(w)}`,
      );
      await ungueltig(anStelle(linie(1, 1, 2, 2, s)), ELEMENT, `line ${String(w)}`);
      await ungueltig(anStelle(pfad('M 1 1 L 2 2', null, s)), ELEMENT, `path ${String(w)}`);
    }
  });

  it('[R-10-01] Strichelung leer, mit Wert ≤ 0 oder nicht endlich → invalidItem', async () => {
    const faelle: number[][] = [[], [0], [2, -1], [2, Number.NaN], [Number.POSITIVE_INFINITY]];
    for (const d of faelle) {
      const s = strich(SCHWARZ, 1, d);
      const n = JSON.stringify(d);
      await ungueltig(anStelle(linie(1, 1, 2, 2, s)), ELEMENT, `Linie dash ${n}`);
      // TR-E102c-04: auch am Rahmen eines Rechtecks und eines Pfads.
      await ungueltig(
        anStelle(rechteck({ x: 1, y: 1, w: 2, h: 3 }, ROT, s)),
        ELEMENT,
        `Rechteck dash ${n}`,
      );
      await ungueltig(anStelle(pfad('M 1 1 L 2 2 Z', ROT, s)), ELEMENT, `Pfad dash ${n}`);
    }
  });

  it('[R-10-01] rect.w bzw. rect.h < 0 und sizePt ≤ 0 → invalidItem', async () => {
    await ungueltig(
      anStelle(bild({ x: 1, y: 1, w: -1, h: 2 }, 'image/png', pngPalette().bytes)),
      ELEMENT,
      'Bild w < 0',
    );
    await ungueltig(
      anStelle(bild({ x: 1, y: 1, w: 2, h: -0.5 }, 'image/jpeg', jpegGrau().bytes)),
      ELEMENT,
      'Bild h < 0',
    );
    await ungueltig(anStelle(rechteck({ x: 1, y: 1, w: -1, h: 3 }, ROT, null)), ELEMENT, 'w < 0');
    await ungueltig(
      anStelle(rechteck({ x: 1, y: 1, w: 2, h: -0.01 }, ROT, null)),
      ELEMENT,
      'h < 0',
    );
    await ungueltig(anStelle(text(10, 10, 'a', { sizePt: 0 })), ELEMENT, 'sizePt 0');
    await ungueltig(anStelle(text(10, 10, 'a', { sizePt: -5 })), ELEMENT, 'sizePt −5');
  });

  it('[R-10-01] Rgb nicht ganzzahlig 0–255 in Fläche, Strich und Lauf → invalidItem', async () => {
    const falsch = [
      { r: 256, g: 0, b: 0 },
      { r: 0, g: -1, b: 0 },
      { r: 0, g: 0, b: 1.5 },
      { r: Number.NaN, g: 0, b: 0 },
    ];
    for (const c of falsch) {
      const n = JSON.stringify(c);
      await ungueltig(
        anStelle(rechteck({ x: 1, y: 1, w: 2, h: 3 }, c, null)),
        ELEMENT,
        `fill ${n}`,
      );
      await ungueltig(anStelle(linie(1, 1, 2, 2, strich(c, 1))), ELEMENT, `stroke ${n}`);
      await ungueltig(anStelle(pfad('M 1 1 L 2 2 Z', c, null)), ELEMENT, `path fill ${n}`);
      await ungueltig(
        anStelle(zeile({ x: 10, baselineY: 10, runs: [lauf('a'), lauf('b', { color: c })] })),
        ELEMENT,
        `run ${n}`,
      );
    }
  });

  it('[R-10-01] positiv: Grenzwerte gültig (w = h = 0, Farbe 0 und 255, Strichelung mit einem Wert, Elemente ausserhalb der Seite)', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('grenzwerte', [
        seite([
          rechteck({ x: 10, y: 10, w: 0, h: 20 }, null, strich({ r: 255, g: 255, b: 255 }, 0.01)),
          rechteck({ x: 30, y: 10, w: 20, h: 0 }, null, strich({ r: 0, g: 0, b: 0 }, 1, [2])),
          rechteck({ x: 60, y: 10, w: 20, h: 20 }, { r: 255, g: 0, b: 255 }, null),
          rechteck({ x: -50, y: -50, w: 20, h: 20 }, BLAU, null),
          rechteck({ x: 2000, y: 2000, w: 20, h: 20 }, BLAU, null),
          text(-100, -100, 'ausserhalb'),
          text(100, 100, 'innerhalb'),
        ]),
      ]),
    );
    expect(info.texts.map((t) => t.text)).toContain('innerhalb');
    rechteckNahe(
      info.strokes.find((s) => s.fill?.g === 0 && s.fill.r === 255)?.bbox,
      { x: 60, y: 10, w: 20, h: 20 },
      'Magenta',
    );
  });

  it('[R-10-01] nicht geprüft und kein Fehler: frame, role, entryId und Schrift unter 4,5 pt (ohne Artefakt, P-10)', async () => {
    const z = zeile({
      x: 100,
      baselineY: 100,
      sizePt: 3,
      runs: [lauf('klein')],
      frame: { x: Number.NaN, y: -1, w: -5, h: Number.POSITIVE_INFINITY },
    });
    const item = roh<PageItem>({ ...z, role: 'unbekannteRolle', entryId: '' });
    const bytes = await pdfOhneArtefakt({ pages: [seite([item])], title: 'Fiktiv' });
    const info = await readPdf(bytes);
    expect(info.texts.map((t) => [t.text, t.sizePt])).toEqual([['klein', 3]]);
  });
});

describe('writePdf: Grammatik von d (V06)', () => {
  const GUELTIG: readonly [string, { x: number; y: number; w: number; h: number } | null][] = [
    ['M10 10L20 20', { x: 10, y: 10, w: 10, h: 10 }],
    ['  M 10,10 L 20, 20 Z  ', { x: 10, y: 10, w: 10, h: 10 }],
    ['M 10    10 L 20      30', { x: 10, y: 10, w: 10, h: 20 }],
    ['M10,10L20,10L20,20Z', { x: 10, y: 10, w: 10, h: 10 }],
    ['M .5 10.25 L 20.75 .5', { x: 0.5, y: 0.5, w: 20.25, h: 9.75 }],
    ['M -5 -5 L 5 5', { x: -5, y: -5, w: 10, h: 10 }],
    ['M 0 0 C 0 -10 20 -10 20 0 Z', { x: 0, y: -7.5, w: 20, h: 7.5 }],
    ['M 10 10 L 20 10 Z M 30 30 L 40 30 L 40 40 Z', { x: 10, y: 10, w: 30, h: 30 }],
    ['M 100 100 Z', null],
  ];

  it('[R-10-01] (V06) positiv: gültige Formen von d ergeben ein PDF mit der Geometrie des Pfads', async () => {
    const bytes = await pdfMitArtefakt('pfad-grammatik', [
      seite(GUELTIG.map(([d]) => pfad(d, null, strich(SCHWARZ, 1)))),
    ]);
    const info = await readPdf(bytes);
    const mitGeometrie = GUELTIG.filter(([, b]) => b !== null);
    expect(info.strokes).toHaveLength(mitGeometrie.length);
    mitGeometrie.forEach(([d, b], i) => {
      rechteckNahe(info.strokes[i]?.bbox, b ?? { x: 0, y: 0, w: 0, h: 0 }, JSON.stringify(d));
    });
  });

  it('[R-10-01] (V06) negativ: jede Abweichung von der Grammatik ergibt invalidItem', async () => {
    const UNGUELTIG = [
      '',
      '   ',
      'Z',
      'L 0 0',
      'm 0 0',
      'M 0 0 l 1 1',
      'M 0 0 1 1',
      'M 0',
      'M 0 0 0',
      'M 1e2 0',
      'M 1E2 0',
      'M 0 0 H 5',
      'M 0 0 V 5',
      'M 0 0 Q 1 1 2 2',
      'M 0 0 A 1 1 0 0 0 2 2',
      'M 0,,0',
      'M +1 0',
      'M 1. 0',
      'M 0 0 L 1 1 ,',
      'M 0 0 C 1 1 2 2 3',
      'M 0 0 C 1 1 2 2 3 3 4',
      'M 0-1',
      'M 0 0 Z 1',
      'M 0 0 L NaN 1',
      'M 0 0 L 1 1 x',
      'M 0 0 L 1 1;',
    ];
    for (const d of UNGUELTIG) {
      await ungueltig(anStelle(pfad(d, ROT, null)), ELEMENT, JSON.stringify(d));
    }
  });
});

describe('writePdf: weitere Fälle (V13)', () => {
  it('[R-10-01] (V13) rotation nicht 0/90/270, weight nicht regular/bold, unbekannte kind → invalidItem', async () => {
    for (const r of [45, 180, -90, 360]) {
      await ungueltig(
        anStelle(roh<PageItem>({ ...text(10, 10, 'a'), rotation: r })),
        ELEMENT,
        `rotation ${String(r)}`,
      );
    }
    await ungueltig(
      anStelle(roh<PageItem>({ ...text(10, 10, 'a'), runs: [{ ...lauf('a'), weight: 'medium' }] })),
      ELEMENT,
      'weight medium',
    );
    await ungueltig(
      anStelle(roh<PageItem>({ role: 'block', kind: 'circle', cx: 1, cy: 1, r: 2 })),
      ELEMENT,
      'kind circle',
    );
  });

  it('[R-10-01] positiv: rotation 0, 90, 270 und beide Schnitte ergeben ein PDF', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('drehungen-schnitte', [
        seite([
          zeile({
            x: 100,
            baselineY: 100,
            rotation: 0,
            runs: [lauf('null'), lauf(' fett', { weight: 'bold' })],
          }),
          zeile({ x: 200, baselineY: 300, rotation: 90, runs: [lauf('neunzig')] }),
          zeile({ x: 300, baselineY: 100, rotation: 270, runs: [lauf('zweisiebzig')] }),
        ]),
      ]),
    );
    expect(info.texts.map((t) => t.rotation)).toEqual([0, 0, 90, 270]);
  });
});

describe('writePdf: gesperrte Codepunkte (V01, Runde 2 V15)', () => {
  /** Bereiche aus Vertragsprüfung Runde 2 V15 (einschliesslich der Grenzen). */
  const BEREICHE: readonly (readonly [number, number])[] = [
    [0x0000, 0x001f],
    [0x007f, 0x009f],
    [0x00ad, 0x00ad],
    [0x034f, 0x034f],
    [0x061c, 0x061c],
    [0x200c, 0x200f],
    [0x2028, 0x202e],
    [0x2061, 0x2064],
    [0x2066, 0x206f],
  ];

  it('[R-10-01] (V15) für jeden Bereichsanfang und jedes Bereichsende ergibt «a‹cp›b» invalidItem mit character = ‹cp›', async () => {
    for (const [a, b] of BEREICHE) {
      for (const cp of new Set([a, b])) {
        const z = String.fromCodePoint(cp);
        await ungueltig(
          anStelle(text(10, 10, `a${z}b`)),
          { pageIndex: 1, itemIndex: 1, character: z },
          `U+${cp.toString(16).toUpperCase()}`,
        );
      }
    }
    expect(LINE_EXCLUDED_CODEPOINTS).toEqual(BEREICHE);
  });

  it('[R-10-01] (V01, V15) auch Codepunkte im Innern der Bereiche, im zweiten Lauf und im fetten Schnitt', async () => {
    for (const cp of [
      0x0009, 0x000a, 0x000d, 0x0085, 0x200d, 0x200e, 0x202a, 0x202b, 0x2062, 0x2069, 0x206a,
    ]) {
      const z = String.fromCodePoint(cp);
      await ungueltig(
        anStelle(
          zeile({
            x: 10,
            baselineY: 10,
            runs: [lauf('vorne '), lauf(`x${z}y`, { weight: 'bold' })],
          }),
        ),
        { pageIndex: 1, itemIndex: 1, character: z },
        `U+${cp.toString(16).toUpperCase()}`,
      );
    }
  });

  it('[R-10-01] (V15) Gegenfall: U+200B, U+2060 und U+FEFF sowie Nachbarn der Bereiche ergeben ein PDF', async () => {
    const erlaubt = [
      0x200b, 0x2060, 0xfeff, 0x0020, 0x007e, 0x00a0, 0x00ac, 0x00ae, 0x2010, 0x2030,
    ];
    for (const cp of erlaubt) {
      expect(fontMetrics().advance(cp, 'regular'), `U+${cp.toString(16)} in Arimo`).not.toBeNull();
    }
    const info = await readPdf(
      await pdfMitArtefakt('erlaubte-codepunkte', [
        seite(erlaubt.map((cp, i) => text(50, 30 + i * 15, `a${String.fromCodePoint(cp)}b`))),
      ]),
    );
    expect(info.texts).toHaveLength(erlaubt.length);
  });

  it('[R-10-01] (P-7) in einem Element zuerst invalidItem, dann missingGlyph: «a✓\\u0000» → invalidItem mit character U+0000', async () => {
    await ungueltig(
      anStelle(zeile({ x: 1, baselineY: 1, runs: [lauf('a✓'), lauf('\u0000')] })),
      { pageIndex: 1, itemIndex: 1, character: '\u0000' },
      'gesperrt nach fehlender Glyphe',
    );
    // U+061C hat keine Glyphe in Arimo; gesperrt geht vor.
    expect(fontMetrics().advance(0x061c, 'regular')).toBeNull();
    await ungueltig(
      anStelle(text(1, 1, 'a\u061Cb')),
      { pageIndex: 1, itemIndex: 1, character: '\u061C' },
      'U+061C',
    );
  });
});

describe('writePdf: NFC ohne kombinierende Zeichen (Runde 2 V16)', () => {
  it('[R-10-01] (V16) «A»+U+0308 ergibt invalidItem mit character U+0308; «Ä» (U+00C4) wird gezeichnet', async () => {
    await ungueltig(
      anStelle(text(10, 10, 'A\u0308pfel')),
      { pageIndex: 1, itemIndex: 1, character: '\u0308' },
      'A + U+0308',
    );
    const info = await readPdf(await pdfMitArtefakt('nfc-ae', [seite([text(10, 30, 'Äpfel')])]));
    expect(info.texts.map((t) => t.text)).toEqual(['Äpfel']);
  });

  it('[R-10-01] (V16) «Å» als U+212B ergibt invalidItem mit character U+212B (erstes abweichendes Zeichen)', async () => {
    await ungueltig(
      anStelle(text(10, 10, 'x\u212By')),
      { pageIndex: 1, itemIndex: 1, character: '\u212B' },
      'U+212B',
    );
    await ungueltig(
      anStelle(text(10, 10, 'Ohm \u2126')),
      { pageIndex: 1, itemIndex: 1, character: '\u2126' },
      'U+2126',
    );
  });

  it('[R-10-01] (V16) Hebräisch mit Punktierung (U+05D1 U+05BC) ergibt invalidItem mit character U+05BC', async () => {
    await ungueltig(
      anStelle(text(10, 10, '\u05D1\u05BC')),
      { pageIndex: 1, itemIndex: 1, character: '\u05BC' },
      'Bet mit Dagesch',
    );
  });

  it('[R-10-01] (V16) kombinierendes Zeichen am Anfang und zerlegtes «é»: character = erstes Zeichen der Kategorie M', async () => {
    await ungueltig(
      anStelle(text(10, 10, '\u0301a')),
      { pageIndex: 1, itemIndex: 1, character: '\u0301' },
      'U+0301 am Anfang',
    );
    await ungueltig(
      anStelle(zeile({ x: 10, baselineY: 10, runs: [lauf('ok '), lauf('Cafe\u0301')] })),
      { pageIndex: 1, itemIndex: 1, character: '\u0301' },
      'e + U+0301',
    );
  });

  it('[R-10-01] (V16) positiv: NFC-Text mit Umlauten, Akzenten und Hebräisch ohne Punktierung wird gezeichnet', async () => {
    const proben = ['ÄÖÜäöüéàÅ', '\u05E9\u05DC\u05D5\u05DD'];
    const info = await readPdf(
      await pdfMitArtefakt('nfc-positiv', [seite(proben.map((p, i) => text(50, 50 + i * 20, p)))]),
    );
    expect(info.texts.map((t) => t.text)).toEqual(proben);
  });
});

describe('writePdf: Prüfreihenfolge (§2.4)', () => {
  it('[R-10-01] zuerst pages leer, dann Seiten in Reihenfolge: Seitengrösse vor Elementen, Elemente in Reihenfolge', async () => {
    await ungueltig(
      [
        seite([text(1, 1, 'a\u0000')], { widthPt: 0, heightPt: 10 }),
        seite([text(1, 1, 'b\u0000')]),
      ],
      { pageIndex: 0, itemIndex: null, character: null },
      'Seitengrösse vor Element',
    );
    await ungueltig(
      [seite([GUT, text(1, 1, 'x', { sizePt: 0 })]), seite([GUT], { widthPt: -1, heightPt: 1 })],
      { pageIndex: 0, itemIndex: 1, character: null },
      'Seite 1 vor Seite 2',
    );
  });

  it('[R-10-01] ein früheres Element mit fehlender Glyphe geht einem späteren ungültigen Element vor (und umgekehrt)', async () => {
    const e = (await ablehnung(
      writePdf({
        pages: [seite([GUT, text(1, 1, '✓'), text(1, 1, 'x', { sizePt: 0 })])],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex, e.character]).toEqual(['missingGlyph', 0, 1, '✓']);
    await ungueltig(
      [seite([GUT, text(1, 1, 'x', { sizePt: 0 }), text(1, 1, '✓')])],
      { pageIndex: 0, itemIndex: 1, character: null },
      'ungültig vor fehlender Glyphe',
    );
  });

  it('[R-10-01] im selben Element geht invalidItem vor missingGlyph (Grösse 0 mit «✓»)', async () => {
    await ungueltig(
      anStelle(text(1, 1, '✓', { sizePt: 0 })),
      ELEMENT,
      'sizePt 0 und fehlende Glyphe',
    );
  });
});

describe('writePdf: keine Konsolenausgabe (§2.4)', () => {
  it('[R-10-01] weder beim Erzeugen noch bei Fehlern eine Konsolenausgabe', async () => {
    const methoden = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
    const spione = methoden.map((m) =>
      vi.spyOn(globalThis.console, m).mockImplementation(() => {}),
    );
    await pdfMitArtefakt('konsole', [
      seite([
        rechteck({ x: 1, y: 1, w: 5, h: 5 }, ROT, strich(BLAU, 1, [1, 1])),
        text(10, 10, 'Text'),
        pfad('M 1 1 L 9 9', null, strich(ROT, 1)),
      ]),
    ]);
    await ablehnung(writePdf({ pages: [seite([text(1, 1, '✓')])], title: 'Fiktiv' }));
    await ablehnung(writePdf({ pages: [seite([pfad('', ROT, null)])], title: 'Fiktiv' }));
    await ablehnung(writePdf({ pages: [], title: 'Fiktiv' }));
    for (const [i, s] of spione.entries()) expect(s, methoden[i]).not.toHaveBeenCalled();
  });
});

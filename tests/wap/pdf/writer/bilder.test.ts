// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Rasterbilder (R-10-01; Vertrag E1-02c §2.3 Nr 8, §2.4; Änderungsnotiz
// Vertragsprüfung V03, V05, V13, Runde 2 V17, V18, V19; Datenschutz AGENTS.md). Fiktive Bilder mit
// Markierungstexten in jedem Metadatenteil: Die Markierung steht weder in den PDF-Bytes noch in einem entpackten
// Strom; das PDF ist byte-gleich wie mit dem Bild ohne Metadaten. Lage und Streckung am gerenderten PDF.
import { describe, expect, it } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import type { PageModel } from '../../../../src/model/wap/layout/pageModel';
import { renderPdfPage } from '../../support/golden/render';
import { readPdf } from '../../support/pdf/read';
import {
  adobeApp14,
  adobeMitAnhang,
  app,
  app14Fremd,
  ascii,
  bleibt,
  entfaellt,
  jfifMitAnhang,
  jfifMitVorschau,
  jfifOhneVorschau,
  jfxx,
  jpegGrau,
  jpgn,
  kommentar,
  metadatenSegment,
  pngPalette,
  pngRgb,
  xmp,
} from './support/bilder';
import { enthaeltMarke, latin1 } from './support/roh';
import { ablehnung, pdfMitArtefakt, TITEL } from './support/schreiben';
import { bild, seite, text } from './support/seiten';

const RAHMEN = { x: 100, y: 150, w: 120, h: 80 };

function bildSeite(mime: 'image/png' | 'image/jpeg', bytes: Uint8Array): PageModel {
  return seite([text(100, 100, 'Unterschrift fiktiv'), bild(RAHMEN, mime, bytes)]);
}

/** Pixel (RGBA) an der Stelle (xPt, yPt) der gerenderten Seite (300 dpi). */
function pixel(r: { width: number; rgba: Uint8Array }, xPt: number, yPt: number): number[] {
  const x = Math.round((xPt * 300) / 72);
  const y = Math.round((yPt * 300) / 72);
  const i = (y * r.width + x) * 4;
  return Array.from(r.rgba.subarray(i, i + 3));
}

function nahe(rgb: readonly number[], soll: readonly number[]): boolean {
  return rgb.every((v, i) => Math.abs(v - (soll[i] ?? -1)) <= 40);
}

const METADATEN: readonly (number | 'COM')[] = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  15,
  'COM',
];

describe('writePdf: Bilder einbetten und zeichnen (Vertrag §2.3 Nr 8, V05)', () => {
  it('[R-10-01] PNG wird eingebettet und füllt rect ohne Erhalt des Seitenverhältnisses (V05)', async () => {
    const png = pngRgb([230, 30, 30], [30, 30, 230]);
    const bytes = await pdfMitArtefakt('bild-png', [bildSeite('image/png', png)]);
    expect((await readPdf(bytes)).images).toBe(1);
    const r = await renderPdfPage(bytes, 1, 300);
    const { x, y, w, h } = RAHMEN;
    // Bild 2 × 1 Pixel in 120 × 80 pt: links rot, rechts blau, bis in die Ecken (keine Ränder).
    expect(nahe(pixel(r, x + 0.1 * w, y + 0.05 * h), [230, 30, 30])).toBe(true);
    expect(nahe(pixel(r, x + 0.1 * w, y + 0.95 * h), [230, 30, 30])).toBe(true);
    expect(nahe(pixel(r, x + 0.9 * w, y + 0.05 * h), [30, 30, 230])).toBe(true);
    expect(nahe(pixel(r, x + 0.9 * w, y + 0.95 * h), [30, 30, 230])).toBe(true);
    // Ausserhalb des Rahmens weiss.
    expect(pixel(r, x - 2, y + h / 2)).toEqual([255, 255, 255]);
    expect(pixel(r, x + w + 2, y + h / 2)).toEqual([255, 255, 255]);
    expect(pixel(r, x + w / 2, y - 2)).toEqual([255, 255, 255]);
    expect(pixel(r, x + w / 2, y + h + 2)).toEqual([255, 255, 255]);
  });

  it('[R-10-01] JPEG wird eingebettet und in rect gezeichnet', async () => {
    const bytes = await pdfMitArtefakt('bild-jpeg', [bildSeite('image/jpeg', jpegGrau().bytes)]);
    expect((await readPdf(bytes)).images).toBe(1);
    const r = await renderPdfPage(bytes, 1, 300);
    expect(nahe(pixel(r, RAHMEN.x + 5, RAHMEN.y + 5), [128, 128, 128])).toBe(true);
    expect(nahe(pixel(r, RAHMEN.x + RAHMEN.w - 5, RAHMEN.y + RAHMEN.h - 5), [128, 128, 128])).toBe(
      true,
    );
    expect(pixel(r, RAHMEN.x - 2, RAHMEN.y + 5)).toEqual([255, 255, 255]);
  });

  it('[R-10-01] Anzahl Bilder = Anzahl ImageItem, auch über mehrere Seiten', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('bilder-anzahl', [
        bildSeite('image/png', pngPalette().bytes),
        seite([
          bild({ x: 10, y: 10, w: 20, h: 20 }, 'image/jpeg', jpegGrau().bytes),
          bild({ x: 40, y: 10, w: 20, h: 20 }, 'image/jpeg', jpegGrau({ progressiv: true }).bytes),
        ]),
      ]),
    );
    expect(info.images).toBe(3);
  });

  it('[R-10-01] (V03) Teilansicht mit byteOffset ≠ 0 wird eingebettet; gleiches PDF wie mit einer Kopie', async () => {
    const jpeg = jpegGrau().bytes;
    const traeger = new Uint8Array(jpeg.length + 9);
    traeger.set(jpeg, 4);
    const ansicht = traeger.subarray(4, 4 + jpeg.length);
    const mitAnsicht = await pdfMitArtefakt('bild-teilansicht', [bildSeite('image/jpeg', ansicht)]);
    const mitKopie = await writePdf({
      pages: [bildSeite('image/jpeg', jpeg.slice())],
      title: TITEL,
    });
    expect(mitAnsicht).toEqual(mitKopie);
  });
});

describe('writePdf: JPEG ohne Metadaten (V03, V17, V19)', () => {
  it('[R-10-01] (V03) EXIF, XMP, APP2–APP13, APP15 und COM mit Markierung fehlen im PDF; PDF gleich wie ohne Metadaten', async () => {
    const marken = METADATEN.map((n) => `FIKTIV-MARKE-${String(n)}-5001`);
    const bild = jpegGrau({
      vorSof: [
        bleibt(jfifOhneVorschau()),
        entfaellt(xmp('FIKTIV-MARKE-XMP-5001')),
        ...METADATEN.map((n, i) => entfaellt(metadatenSegment(n, marken[i] ?? ''))),
        bleibt(adobeApp14()),
      ],
    });
    const mit = await pdfMitArtefakt('jpeg-metadaten', [bildSeite('image/jpeg', bild.bytes)]);
    for (const m of [...marken, 'FIKTIV-MARKE-XMP-5001']) {
      expect(enthaeltMarke(mit, m), m).toBe(false);
    }
    const ohne = await writePdf({ pages: [bildSeite('image/jpeg', bild.sauber)], title: TITEL });
    expect(mit).toEqual(ohne);
  });

  it('[R-10-01] (V17) Markierung nach dem EOI fehlt im PDF', async () => {
    const bild = jpegGrau({ nachEoi: [entfaellt(ascii('FIKTIV-NACH-EOI-5002'))] });
    const pdf = await pdfMitArtefakt('jpeg-nach-eoi', [bildSeite('image/jpeg', bild.bytes)]);
    expect(enthaeltMarke(pdf, 'FIKTIV-NACH-EOI-5002')).toBe(false);
  });

  it('[R-10-01] (V03, V17) progressive Folge mit COM und APP1 zwischen zwei Scans: Markierungen fehlen im PDF', async () => {
    const bild = jpegGrau({
      progressiv: true,
      zwischenScans: [
        entfaellt(kommentar('FIKTIV-ZWISCHEN-COM-5003')),
        entfaellt(metadatenSegment(1, 'FIKTIV-ZWISCHEN-APP1-5003')),
      ],
      nachEoi: [entfaellt(ascii('FIKTIV-PROGRESSIV-ENDE-5003'))],
    });
    const pdf = await pdfMitArtefakt('jpeg-progressiv', [bildSeite('image/jpeg', bild.bytes)]);
    for (const m of [
      'FIKTIV-ZWISCHEN-COM-5003',
      'FIKTIV-ZWISCHEN-APP1-5003',
      'FIKTIV-PROGRESSIV-ENDE-5003',
    ]) {
      expect(enthaeltMarke(pdf, m), m).toBe(false);
    }
    expect((await readPdf(pdf)).images).toBe(1);
  });

  it('[R-10-01] (V19) JFIF mit Vorschaubild und JFXX mit Markierung fehlen im PDF', async () => {
    const mitVorschau = jpegGrau({ vorSof: [entfaellt(jfifMitVorschau('FIKTIV-VORSCHAU-5004'))] });
    const mitJfxx = jpegGrau({
      vorSof: [bleibt(jfifOhneVorschau()), entfaellt(jfxx('FIKTIV-JFXX-5004'))],
    });
    const pdf = await pdfMitArtefakt('jpeg-app0', [
      seite([
        bild({ x: 10, y: 10, w: 30, h: 30 }, 'image/jpeg', mitVorschau.bytes),
        bild({ x: 50, y: 10, w: 30, h: 30 }, 'image/jpeg', mitJfxx.bytes),
      ]),
    ]);
    expect(enthaeltMarke(pdf, 'FIKTIV-VORSCHAU-5004')).toBe(false);
    expect(enthaeltMarke(pdf, 'FIKTIV-JFXX-5004')).toBe(false);
  });

  it('[R-10-01] (V03, V19) das PDF enthält die bereinigten JPEG-Bytes unverändert: JFIF ohne Vorschaubild, APP14 und Bilddaten byte-gleich', async () => {
    const b = jpegGrau({
      vorSof: [
        bleibt(jfifOhneVorschau()),
        entfaellt(kommentar('FIKTIV-KOMMENTAR-5005')),
        bleibt(adobeApp14()),
      ],
    });
    const pdf = await pdfMitArtefakt('jpeg-jfif', [bildSeite('image/jpeg', b.bytes)]);
    expect(latin1(pdf).includes(latin1(b.sauber))).toBe(true);
    expect(enthaeltMarke(pdf, 'FIKTIV-KOMMENTAR-5005')).toBe(false);
  });

  it('[R-10-01] (V17) JPEG ohne EOI → invalidItem mit pageIndex und itemIndex', async () => {
    const e = (await ablehnung(
      writePdf({
        pages: [
          seite([text(1, 1, 'a')]),
          seite([text(1, 1, 'b'), bild(RAHMEN, 'image/jpeg', jpegGrau({ ohneEoi: true }).bytes)]),
        ],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex, e.character]).toEqual(['invalidItem', 1, 1, null]);
  });
});

describe('writePdf: JPEG nach Positivliste (Test-Review Runde 1 a, TR-E102c-01)', () => {
  it('[R-10-01] (TR-E102c-01) Markierungen in JFIF 0×0 mit Anhang, APP14 «Adobe» mit Anhang, fremdem APP14 und JPGn (FFF0, FFFD) fehlen in rohen und entpackten PDF-Bytes', async () => {
    const faelle: [string, Uint8Array][] = [
      ['FIKTIV-PDF-JFIF-ANHANG-9001', jfifMitAnhang('FIKTIV-PDF-JFIF-ANHANG-9001')],
      ['FIKTIV-PDF-ADOBE-ANHANG-9002', adobeMitAnhang('FIKTIV-PDF-ADOBE-ANHANG-9002')],
      ['FIKTIV-PDF-APP14-FREMD-9003', app14Fremd('FIKTIV-PDF-APP14-FREMD-9003')],
      ['FIKTIV-PDF-JPG0-9004', jpgn(0xf0, 'FIKTIV-PDF-JPG0-9004')],
      ['FIKTIV-PDF-JPG13-9005', jpgn(0xfd, 'FIKTIV-PDF-JPG13-9005')],
    ];
    const bild = jpegGrau({
      vorSof: [bleibt(jfifOhneVorschau()), ...faelle.map(([, t]) => entfaellt(t))],
    });
    const pdf = await pdfMitArtefakt('jpeg-positivliste', [bildSeite('image/jpeg', bild.bytes)]);
    for (const [marke] of faelle) expect(enthaeltMarke(pdf, marke), marke).toBe(false);
    const ohne = await writePdf({ pages: [bildSeite('image/jpeg', bild.sauber)], title: TITEL });
    expect(pdf).toEqual(ohne);
    expect((await readPdf(pdf)).images).toBe(1);
  });

  it('[R-10-01] (TR-E102c-01) Gegenfall: gültiges JFIF 0×0 und gültige Adobe-Struktur stehen byte-gleich im PDF', async () => {
    const bild = jpegGrau({ vorSof: [bleibt(jfifOhneVorschau()), bleibt(adobeApp14())] });
    expect(bild.sauber).toEqual(bild.bytes);
    const pdf = await pdfMitArtefakt('jpeg-positivliste-gueltig', [
      bildSeite('image/jpeg', bild.bytes),
    ]);
    expect(latin1(pdf).includes(latin1(bild.bytes))).toBe(true);
  });
});

describe('writePdf: PNG ohne Metadaten (V03, V18)', () => {
  it('[R-10-01] (V03, V18) tEXt, zTXt, iTXt, eXIf, tIME, iCCP und Bytes nach IEND mit Markierung fehlen im PDF; PDF gleich wie ohne diese Blöcke', async () => {
    const bild = pngPalette({
      metadaten: 'FIKTIV-PNG-MARKE-6001',
      nachIend: [entfaellt(ascii('FIKTIV-NACH-IEND-6001'))],
    });
    const mit = await pdfMitArtefakt('png-metadaten', [bildSeite('image/png', bild.bytes)]);
    expect(enthaeltMarke(mit, 'FIKTIV-PNG-MARKE-6001')).toBe(false);
    expect(enthaeltMarke(mit, 'FIKTIV-NACH-IEND-6001')).toBe(false);
    const ohne = await writePdf({ pages: [bildSeite('image/png', bild.sauber)], title: TITEL });
    expect(mit).toEqual(ohne);
  });
});

describe('writePdf: Bild nicht lesbar (V13, V18)', () => {
  const faelle: [string, 'image/png' | 'image/jpeg', Uint8Array][] = [
    ['keine Bilddaten als PNG', 'image/png', ascii('FIKTIV-KEIN-BILD')],
    ['keine Bilddaten als JPEG', 'image/jpeg', ascii('FIKTIV-KEIN-BILD')],
    ['leer', 'image/png', new Uint8Array(0)],
    ['PNG als JPEG', 'image/jpeg', pngPalette().bytes],
    ['JPEG als PNG', 'image/png', jpegGrau().bytes],
    ['JPEG mit abgeschnittenem Segment', 'image/jpeg', jpegGrau().bytes.slice(0, 30)],
  ];

  it('[R-10-01] (V13) nicht lesbares Bild oder falscher mime → invalidItem mit Fundstelle', async () => {
    for (const [name, mime, bytes] of faelle) {
      const e = (await ablehnung(
        writePdf({ pages: [seite([text(1, 1, 'a'), bild(RAHMEN, mime, bytes)])], title: 'Fiktiv' }),
      )) as PdfWriteError;
      expect(e, name).toBeInstanceOf(PdfWriteError);
      expect([e.code, e.pageIndex, e.itemIndex, e.character], name).toEqual([
        'invalidItem',
        0,
        1,
        null,
      ]);
    }
  });

  it('[R-10-01] (V13) mime weder PNG noch JPEG → invalidItem', async () => {
    const e = (await ablehnung(
      writePdf({
        pages: [
          seite([
            text(1, 1, 'a'),
            { ...bild(RAHMEN, 'image/png', pngPalette().bytes), mime: 'image/gif' as 'image/png' },
          ]),
        ],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex]).toEqual(['invalidItem', 0, 1]);
  });

  it('[R-10-01] (V13) APP0 ohne JFIF-Kennung allein macht das Bild nicht unlesbar (positiv)', async () => {
    const b = jpegGrau({ vorSof: [entfaellt(app(0, ascii('FIKTIV\0APP0-6002')))] });
    const pdf = await pdfMitArtefakt('jpeg-app0-fremd', [bildSeite('image/jpeg', b.bytes)]);
    expect(enthaeltMarke(pdf, 'FIKTIV\0APP0-6002')).toBe(false);
    expect((await readPdf(pdf)).images).toBe(1);
  });
});

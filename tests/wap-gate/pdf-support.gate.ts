// PDF Ebene 2 (ADR-010 §7.2, R-H-19): Prüfhilfen lesen Text, Positionen, Schriftgrössen, eingebettete
// Schriften und Linien aus dem fertigen PDF (pdfjs-dist), nicht aus dem Layout-Modell. Selbsttest gegen von
// Hand mit pdf-lib erzeugte PDF mit bekannten Werten (auch gedrehter Text, Matrix wie ADR-004).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4, §9 Nr 4–5 und E1-01b.md §2 «Prüfhilfen»
// (Leerraum, Präfix, fett, Füllflächen, Umriss mit ascent/descent, overlaps, minFontSize, jsdom).
// Übernommen aus dem Entwurf pdf-support.gate.entwurf.ts (Vertrag E1-01b §3). Nur fiktive Texte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  concatTransformationMatrix,
  degrees,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { edgesOffTime, minFontSize, overlaps, textOutsideFrames } from '../wap/support/pdf/checks';
import { type PdfInfo, type PdfTextRun, type Rect, readPdf } from '../wap/support/pdf/read';
import {
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  nodeModules,
  WT,
  writeText,
} from './support/umgebung';
import { fontkit, LIBERATION_TTF, liberationMetrik } from './support/vertrag-b';

afterEach(aufraeumen);

const H = 300;
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface Soll {
  bytes: Uint8Array;
  breiteZeit: number;
  breiteGedreht: number;
  breiteEingebettet: number;
  breiteQuer: number;
}

let soll: Soll;
let metrik: { ascent: number; descent: number };

async function erzeuge(): Promise<Soll> {
  const doc = await PDFDocument.create();
  doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
  doc.setTitle('Fiktiver Plan');
  doc.setProducer('Schleusen-Test');
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const eigen = await doc.embedFont(readFileSync(LIBERATION_TTF), { subset: false });
  const p1 = doc.addPage([400, H]);
  p1.drawLine({
    start: { x: 10, y: 290 },
    end: { x: 390, y: 290 },
    thickness: 0.5,
    color: rgb(0, 0, 1),
    dashArray: [3, 2],
  });
  p1.drawRectangle({
    x: 20,
    y: 20,
    width: 100,
    height: 50,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: rgb(0.2, 0.4, 0.6),
  });
  p1.drawText('0700', { x: 50, y: 250, size: 12, font: helv, color: rgb(1, 0, 0) });
  p1.drawText('Fett', { x: 50, y: 200, size: 8, font: helvBold, color: rgb(0, 0, 0) });
  p1.drawText('Gedreht', {
    x: 200,
    y: 50,
    size: 10,
    font: helv,
    color: rgb(0, 0, 0),
    rotate: degrees(90),
  });
  p1.drawText('Eingebettet', { x: 250, y: 150, size: 9, font: eigen, color: rgb(0, 0, 0) });
  p1.drawText('Quer', { x: 300, y: 60, size: 10, font: eigen, rotate: degrees(90) });
  const p2 = doc.addPage([595.28, 841.89]);
  const bild = await doc.embedPng(Buffer.from(PNG_1X1, 'base64'));
  p2.drawImage(bild, { x: 10, y: 10, width: 20, height: 20 });
  p2.drawText('Seite', { x: 30, y: 800, size: 4, font: helv });
  const bytes = await doc.save({ useObjectStreams: false });
  return {
    bytes,
    breiteZeit: helv.widthOfTextAtSize('0700', 12),
    breiteGedreht: helv.widthOfTextAtSize('Gedreht', 10),
    breiteEingebettet: eigen.widthOfTextAtSize('Eingebettet', 9),
    breiteQuer: eigen.widthOfTextAtSize('Quer', 10),
  };
}

beforeAll(async () => {
  soll = await erzeuge();
  metrik = await liberationMetrik();
});

function textlauf(info: PdfInfo, text: string): PdfTextRun {
  const r = info.texts.find((t) => t.text === text);
  expect(r, `Textlauf «${text}» fehlt`).toBeDefined();
  return r as PdfTextRun;
}

/** PDF mit einer Seite; `zeichne` erhält Seite und Schriften. */
async function einSeitenPdf(
  zeichne: (
    p: ReturnType<PDFDocument['addPage']>,
    f: { helv: Awaited<ReturnType<PDFDocument['embedFont']>> },
  ) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  zeichne(doc.addPage([200, 200]), { helv });
  return doc.save({ useObjectStreams: false });
}

describe('readPdf: Text, Lage, Grösse, Schrift, Farbe, Drehung', () => {
  it('[R-H-19] Seiten mit Grösse in pt', async () => {
    const info = await readPdf(soll.bytes);
    expect(info.pages).toHaveLength(2);
    expect(info.pages[0]?.widthPt).toBeCloseTo(400, 2);
    expect(info.pages[0]?.heightPt).toBeCloseTo(300, 2);
    expect(info.pages[1]?.widthPt).toBeCloseTo(595.28, 2);
    expect(info.pages[1]?.heightPt).toBeCloseTo(841.89, 2);
  });

  it('[R-H-19] waagrechter Text: x, Grundlinie (oben links), Breite, Grösse, Schrift, Farbe, Seite', async () => {
    const info = await readPdf(soll.bytes);
    const k = textlauf(info, '0700');
    expect(k.page).toBe(1);
    expect(k.x).toBeCloseTo(50, 2);
    expect(k.baselineY).toBeCloseTo(H - 250, 2);
    expect(k.width).toBeCloseTo(soll.breiteZeit, 2);
    expect(k.sizePt).toBeCloseTo(12, 3);
    expect(k.fontName).toMatch(/Helvetica/);
    expect(k.bold).toBe(false);
    expect(k.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(k.rotation).toBe(0);
    const f = textlauf(info, 'Fett');
    expect(f.sizePt).toBeCloseTo(8, 3);
    expect(f.baselineY).toBeCloseTo(H - 200, 2);
    expect(f.bold).toBe(true);
    expect(f.color).toEqual({ r: 0, g: 0, b: 0 });
    const s = textlauf(info, 'Seite');
    expect(s.page).toBe(2);
    expect(s.baselineY).toBeCloseTo(841.89 - 800, 2);
  });

  it('[R-H-19] gedrehter Text (rotate 90°, Matrix [0,s,-s,0,x,y]) → rotation 90, Ursprung und Breite entlang der Schrift', async () => {
    const info = await readPdf(soll.bytes);
    const g = textlauf(info, 'Gedreht');
    expect(g.rotation).toBe(90);
    expect(g.x).toBeCloseTo(200, 2);
    expect(g.baselineY).toBeCloseTo(H - 50, 2);
    expect(g.sizePt).toBeCloseTo(10, 3);
    expect(g.width).toBeCloseTo(soll.breiteGedreht, 2);
  });

  it('[R-H-19] eingebettete Schrift mit ToUnicode und nicht eingebettete Standardschrift unterschieden', async () => {
    const info = await readPdf(soll.bytes);
    const e = textlauf(info, 'Eingebettet');
    expect(e.width).toBeCloseTo(soll.breiteEingebettet, 2);
    const eingebettet = info.fonts.filter((f) => f.embedded);
    const fremd = info.fonts.filter((f) => !f.embedded);
    expect(eingebettet).toHaveLength(1);
    expect(eingebettet[0]?.toUnicode).toBe(true);
    expect(eingebettet[0]?.name).toMatch(/Liberation/);
    expect(eingebettet[0]?.subtype.length).toBeGreaterThan(0);
    expect(fremd.map((f) => f.name).join(' ')).toMatch(/Helvetica/);
  });

  it('[R-H-19] Linie mit Strichstärke, Strichmuster, Farbe; Rechteck mit Rahmen und Füllung; Reihenfolge', async () => {
    const info = await readPdf(soll.bytes);
    const linie = info.strokes.find((s) => s.kind === 'line');
    expect(linie).toBeDefined();
    expect(linie?.page).toBe(1);
    expect(linie?.widthPt).toBeCloseTo(0.5, 3);
    expect(linie?.dash).toEqual([3, 2]);
    expect(linie?.color).toEqual({ r: 0, g: 0, b: 255 });
    expect(linie?.bbox.x).toBeCloseTo(10, 2);
    expect(linie?.bbox.y).toBeCloseTo(H - 290, 2);
    expect(linie?.bbox.w).toBeCloseTo(380, 2);
    expect(linie?.bbox.h).toBeCloseTo(0, 2);
    const rect = info.strokes.find((s) => s.kind === 'rect');
    expect(rect).toBeDefined();
    expect(rect?.bbox.x).toBeCloseTo(20, 2);
    expect(rect?.bbox.y).toBeCloseTo(H - 20 - 50, 2);
    expect(rect?.bbox.w).toBeCloseTo(100, 2);
    expect(rect?.bbox.h).toBeCloseTo(50, 2);
    expect(rect?.widthPt).toBeCloseTo(1, 3);
    expect(rect?.color).toEqual({ r: 0, g: 0, b: 0 });
    expect(rect?.fill).toEqual({ r: 51, g: 102, b: 153 });
    expect(rect?.dash).toBeNull();
    expect((linie?.order ?? 0) < (rect?.order ?? 0)).toBe(true);
  });

  it('[R-H-19] Bilder gezählt, Metadaten gelesen', async () => {
    const info = await readPdf(soll.bytes);
    expect(info.images).toBe(1);
    expect(Object.values(info.metadata)).toContain('Fiktiver Plan');
  });

  it('[R-H-19] deterministisch: zwei Läufe auf denselben Bytes (auch auf einer Kopie) liefern dasselbe Ergebnis', async () => {
    const a = await readPdf(soll.bytes);
    const b = await readPdf(new Uint8Array(soll.bytes));
    expect(b).toEqual(a);
  });
});

describe('Präzisierungen Vertrag E1-01b §2 «Prüfhilfen»', () => {
  it('[R-H-19] Läufe nur aus Leerraum (auch synthetische Leerzeichen von pdfjs) entfallen; Leerzeichen im Lauf bleiben', async () => {
    const bytes = await einSeitenPdf((p, { helv }) => {
      p.drawText('Oben', { x: 10, y: 150, size: 8, font: helv });
      p.drawText('   ', { x: 10, y: 120, size: 8, font: helv });
      p.drawText('Unten', { x: 10, y: 100, size: 8, font: helv });
      p.drawText('A B', { x: 100, y: 100, size: 8, font: helv });
    });
    const info = await readPdf(bytes);
    expect(info.texts.map((t) => t.text).sort()).toEqual(['A B', 'Oben', 'Unten']);
  });

  it('[R-H-19] minFontSize ohne Textläufe (nur Fläche bzw. nur Leerraum) → Infinity', async () => {
    const nurFlaeche = await einSeitenPdf((p) => {
      p.drawRectangle({ x: 10, y: 10, width: 50, height: 20, color: rgb(1, 0, 0) });
    });
    expect(minFontSize(await readPdf(nurFlaeche))).toBe(Number.POSITIVE_INFINITY);
    const nurLeerraum = await einSeitenPdf((p, { helv }) => {
      p.drawText('   ', { x: 10, y: 100, size: 3, font: helv });
    });
    expect(minFontSize(await readPdf(nurLeerraum))).toBe(Number.POSITIVE_INFINITY);
  });

  it('[R-H-19] fontName ohne Teilschrift-Präfix «ABCDEF+»', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const f = await doc.embedFont(readFileSync(LIBERATION_TTF), {
      subset: false,
      customName: 'ABCDEF+Fiktivschrift',
    });
    doc.addPage([200, 200]).drawText('Praefix', { x: 10, y: 100, size: 10, font: f });
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    expect(textlauf(info, 'Praefix').fontName).toBe('Fiktivschrift');
  });

  it('[R-H-19] bold allein über den Schriftnamen ohne Präfix: enthält «Bold» ohne Beachtung von Gross/Klein (Notiz Runde 2 Nr 3)', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const ttf = readFileSync(LIBERATION_TTF);
    // Dieselbe (normale) Schriftdatei unter drei Namen: nur der Name entscheidet.
    const namen = [
      ['ABCDEF+Fiktiv-BOLD', 'Gross'],
      ['GHIJKL+Fiktivbold', 'Klein'],
      ['MNOPQR+Fiktiv-Regular', 'Normal'],
    ] as const;
    const seite = doc.addPage([300, 200]);
    let y = 150;
    for (const [customName, text] of namen) {
      const f = await doc.embedFont(ttf, { subset: false, customName });
      seite.drawText(text, { x: 10, y, size: 10, font: f });
      y -= 30;
    }
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    expect(textlauf(info, 'Gross').fontName).toBe('Fiktiv-BOLD');
    expect(textlauf(info, 'Gross').bold).toBe(true);
    expect(textlauf(info, 'Klein').bold).toBe(true);
    expect(textlauf(info, 'Normal').bold).toBe(false);
  });

  it('[R-H-19] Füllfläche ohne Rahmen → widthPt 0, color = fill', async () => {
    const bytes = await einSeitenPdf((p) => {
      p.drawRectangle({ x: 10, y: 10, width: 50, height: 20, color: rgb(0.2, 0.4, 0.6) });
    });
    const info = await readPdf(bytes);
    const flaechen = info.strokes.filter((s) => s.kind === 'rect');
    expect(flaechen).toHaveLength(1);
    expect(flaechen[0]?.widthPt).toBe(0);
    expect(flaechen[0]?.fill).toEqual({ r: 51, g: 102, b: 153 });
    expect(flaechen[0]?.color).toEqual({ r: 51, g: 102, b: 153 });
    expect(flaechen[0]?.bbox.y).toBeCloseTo(200 - 30, 2);
  });

  it('[R-H-19] ascent/descent in em aus der Schrift: eingebettete Liberation wie in der Schriftdatei; jeder Lauf ascent > 0 ≥ descent', async () => {
    const info = await readPdf(soll.bytes);
    const e = textlauf(info, 'Eingebettet');
    expect(e.ascent).toBeCloseTo(metrik.ascent, 2);
    expect(e.descent).toBeCloseTo(metrik.descent, 2);
    for (const t of info.texts) {
      expect(t.ascent, t.text).toBeGreaterThan(0);
      expect(t.descent, t.text).toBeLessThanOrEqual(0);
      expect(Number.isFinite(t.ascent) && Number.isFinite(t.descent), t.text).toBe(true);
    }
  });
});

describe('Transformationsmatrix (cm) und Pfade (TR-E101b-01)', () => {
  const HS = 200;

  it('[R-H-19] Text unter CTM-Skalierung 0,5: sizePt ≈ 4, x ≈ 20, baselineY ≈ H − 20, minFontSize ≈ 4', async () => {
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([200, HS]);
    p.pushOperators(pushGraphicsState(), concatTransformationMatrix(0.5, 0, 0, 0.5, 0, 0));
    p.drawText('Skaliert', { x: 40, y: 40, size: 8, font: helv });
    p.pushOperators(popGraphicsState());
    p.drawText('Normal', { x: 100, y: 100, size: 9, font: helv });
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    const s = textlauf(info, 'Skaliert');
    expect(s.sizePt).toBeCloseTo(4, 3);
    expect(s.x).toBeCloseTo(20, 2);
    expect(s.baselineY).toBeCloseTo(HS - 20, 2);
    expect(s.width).toBeCloseTo(
      [...'Skaliert'].reduce((a, c) => a + helv.widthOfTextAtSize(c, 8), 0) / 2,
      2,
    );
    expect(s.rotation).toBe(0);
    expect(textlauf(info, 'Normal').sizePt).toBeCloseTo(9, 3);
    expect(minFontSize(info)).toBeCloseTo(4, 3);
  });

  it('[R-H-19] Rechteck unter CTM-Skalierung 2 → bbox { x 20, y H − 30, w 40, h 10 }', async () => {
    const doc = await PDFDocument.create();
    const p = doc.addPage([200, HS]);
    p.pushOperators(pushGraphicsState(), concatTransformationMatrix(2, 0, 0, 2, 0, 0));
    p.drawRectangle({ x: 10, y: 10, width: 20, height: 5, color: rgb(1, 0, 0) });
    p.pushOperators(popGraphicsState());
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    const rechtecke = info.strokes.filter((s) => s.kind === 'rect');
    expect(rechtecke).toHaveLength(1);
    const b = rechtecke[0]?.bbox;
    expect(b?.x).toBeCloseTo(20, 2);
    expect(b?.y).toBeCloseTo(HS - 30, 2);
    expect(b?.w).toBeCloseTo(40, 2);
    expect(b?.h).toBeCloseTo(10, 2);
    expect(rechtecke[0]?.fill).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('[R-H-19] freier Pfad (Dreieck, nur Strich) → genau ein Strich kind path mit bbox und Farbe, ohne Füllung', async () => {
    const doc = await PDFDocument.create();
    const p = doc.addPage([200, HS]);
    p.drawSvgPath('M 0 0 L 40 0 L 40 20 Z', {
      x: 100,
      y: 150,
      borderColor: rgb(0, 0, 1),
      borderWidth: 1,
    });
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    const pfade = info.strokes.filter((s) => s.kind === 'path');
    expect(pfade).toHaveLength(1);
    expect(info.strokes).toHaveLength(1);
    const pfad = pfade[0];
    expect(pfad?.page).toBe(1);
    expect(pfad?.bbox.x).toBeCloseTo(100, 2);
    expect(pfad?.bbox.y).toBeCloseTo(HS - 150, 2);
    expect(pfad?.bbox.w).toBeCloseTo(40, 2);
    expect(pfad?.bbox.h).toBeCloseTo(20, 2);
    expect(pfad?.color).toEqual({ r: 0, g: 0, b: 255 });
    expect(pfad?.fill).toBeNull();
  });
});

describe('Prüfungen auf dem ausgelesenen PDF', () => {
  it('[R-H-19] minFontSize: kleinste Schrift aller Seiten (4 pt auf Seite 2) → unter der Mindestgrösse 4,5 pt erkennbar', async () => {
    const info = await readPdf(soll.bytes);
    const m = minFontSize(info);
    expect(m).toBeCloseTo(4, 3);
    expect(m < 4.5).toBe(true);
  });

  it('[R-H-19] textOutsideFrames: Text im Rahmen nicht gemeldet, Text ausserhalb gemeldet', async () => {
    const info = await readPdf(soll.bytes);
    const rahmen: Rect[] = [
      { x: 40, y: 30, w: 100, h: 30 },
      { x: 40, y: 85, w: 60, h: 25 },
    ];
    const aussen = textOutsideFrames(info, rahmen).map((t) => t.text);
    expect(aussen).not.toContain('0700');
    expect(aussen).not.toContain('Fett');
    expect(aussen).toContain('Gedreht');
    expect(aussen).toContain('Eingebettet');
    const eng = textOutsideFrames(info, [{ x: 40, y: 30, w: 20, h: 30 }]).map((t) => t.text);
    expect(eng).toContain('0700');
  });

  it('[R-H-19] textOutsideFrames: Umriss x … x + width, Grundlinie − ascent·size … Grundlinie − descent·size; Rand ± 0,01 pt', async () => {
    const info = await readPdf(soll.bytes);
    const base = H - 150;
    const genau: Rect = {
      x: 250,
      y: base - metrik.ascent * 9,
      w: soll.breiteEingebettet,
      h: (metrik.ascent - metrik.descent) * 9,
    };
    const gemeldet = (r: Rect) =>
      textOutsideFrames(info, [r])
        .map((t) => t.text)
        .includes('Eingebettet');
    expect(gemeldet(genau), 'genau passender Rahmen').toBe(false);
    expect(gemeldet({ ...genau, y: genau.y + 0.005, h: genau.h - 0.005 }), 'oben 0,005 pt').toBe(
      false,
    );
    expect(gemeldet({ ...genau, y: genau.y + 0.03, h: genau.h - 0.03 }), 'oben 0,03 pt').toBe(true);
    expect(gemeldet({ ...genau, h: genau.h - 0.03 }), 'unten 0,03 pt (Unterlänge)').toBe(true);
    expect(gemeldet({ ...genau, w: genau.w - 0.03 }), 'rechts 0,03 pt').toBe(true);
    expect(gemeldet({ ...genau, x: genau.x + 0.03, w: genau.w - 0.03 }), 'links 0,03 pt').toBe(
      true,
    );
  });

  it('[R-H-19] textOutsideFrames bei 90° gedrehtem Text: Umriss entlang der Schrift nach oben, quer von x − ascent·size bis x − descent·size', async () => {
    const info = await readPdf(soll.bytes);
    const q = textlauf(info, 'Quer');
    expect(q.rotation).toBe(90);
    const base = H - 60;
    const genau: Rect = {
      x: 300 - metrik.ascent * 10,
      y: base - soll.breiteQuer,
      w: (metrik.ascent - metrik.descent) * 10,
      h: soll.breiteQuer,
    };
    const gemeldet = (r: Rect) =>
      textOutsideFrames(info, [r])
        .map((t) => t.text)
        .includes('Quer');
    expect(gemeldet(genau), 'genau passender Rahmen').toBe(false);
    expect(gemeldet({ ...genau, y: genau.y + 0.03, h: genau.h - 0.03 }), 'Textende 0,03 pt').toBe(
      true,
    );
    expect(gemeldet({ ...genau, x: genau.x + 0.03, w: genau.w - 0.03 }), 'Oberlänge 0,03 pt').toBe(
      true,
    );
    expect(gemeldet({ ...genau, w: genau.w - 0.03 }), 'Unterlänge 0,03 pt').toBe(true);
  });

  it('[R-H-19] textOutsideFrames bei 270° gedrehtem Text: Umriss entlang der Schrift nach unten, quer von x + descent·size bis x + ascent·size (TR-E101b-04)', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const eigen = await doc.embedFont(readFileSync(LIBERATION_TTF), { subset: false });
    doc
      .addPage([200, 200])
      .drawText('Runter', { x: 100, y: 150, size: 10, font: eigen, rotate: degrees(-90) });
    const breite = eigen.widthOfTextAtSize('Runter', 10);
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    const r = textlauf(info, 'Runter');
    expect(r.rotation).toBe(270);
    const genau: Rect = {
      x: 100 + metrik.descent * 10,
      y: 200 - 150,
      w: (metrik.ascent - metrik.descent) * 10,
      h: breite,
    };
    const gemeldet = (f: Rect) =>
      textOutsideFrames(info, [f])
        .map((t) => t.text)
        .includes('Runter');
    expect(gemeldet(genau), 'genau passender Rahmen').toBe(false);
    expect(gemeldet({ ...genau, h: genau.h - 0.03 }), 'Textende 0,03 pt').toBe(true);
    expect(gemeldet({ ...genau, y: genau.y + 0.03, h: genau.h - 0.03 }), 'Textanfang 0,03 pt').toBe(
      true,
    );
    expect(gemeldet({ ...genau, w: genau.w - 0.03 }), 'Oberlänge 0,03 pt').toBe(true);
    expect(gemeldet({ ...genau, x: genau.x + 0.03, w: genau.w - 0.03 }), 'Unterlänge 0,03 pt').toBe(
      true,
    );
  });

  it('[R-H-19] textOutsideFrames: «in einem Rahmen» heisst in einem einzigen; zwei angrenzende Rahmen, deren Vereinigung den Umriss deckt, reichen nicht (TR-E101b-04)', async () => {
    const info = await readPdf(soll.bytes);
    const links: Rect = { x: 40, y: 30, w: 25, h: 30 };
    const rechts: Rect = { x: 65, y: 30, w: 75, h: 30 };
    const ganz: Rect = { x: 40, y: 30, w: 100, h: 30 };
    const aussen = (r: Rect[]) => textOutsideFrames(info, r).map((t) => t.text);
    expect(aussen([ganz])).not.toContain('0700');
    expect(aussen([links, rechts])).toContain('0700');
    expect(aussen([links, rechts, ganz])).not.toContain('0700');
  });

  it('[R-H-19] overlaps: überlappende Rechtecke gemeldet, berührende nicht, erlaubte Paare ausgenommen', () => {
    const a: Rect = { x: 0, y: 0, w: 10, h: 10 };
    const b: Rect = { x: 5, y: 5, w: 10, h: 10 };
    const c: Rect = { x: 10, y: 0, w: 5, h: 5 };
    const d: Rect = { x: 30, y: 30, w: 5, h: 5 };
    expect(overlaps([a, b, c, d])).toEqual([[a, b]]);
    expect(overlaps([a, c, d])).toEqual([]);
    expect(overlaps([a, b], (x, y) => x === a && y === b)).toEqual([]);
  });

  it('[R-H-19] overlaps: Schnitt > 0,001 pt in x und in y gemeldet, ≤ 0,001 nicht; Paare i < j in Eingabereihenfolge', () => {
    const a: Rect = { x: 0, y: 0, w: 10, h: 10 };
    const knapp: Rect = { x: 9.9995, y: 0, w: 10, h: 10 };
    const deutlich: Rect = { x: 9.998, y: 0, w: 10, h: 10 };
    const nurX: Rect = { x: 5, y: 10, w: 10, h: 10 };
    expect(overlaps([a, knapp])).toEqual([]);
    expect(overlaps([a, deutlich])).toEqual([[a, deutlich]]);
    expect(overlaps([a, nurX])).toEqual([]);
    const e: Rect = { x: 2, y: 2, w: 2, h: 2 };
    expect(overlaps([e, a, deutlich])).toEqual([
      [e, a],
      [a, deutlich],
    ]);
  });

  it('[R-H-19] edgesOffTime: Kanten auf dem 5-Minuten-Raster innerhalb der Toleranz nicht gemeldet, daneben gemeldet', () => {
    const skala = { yTop: 100, ptPerMinute: 0.5, fromMin: 420 };
    expect(edgesOffTime([100, 102.5, 130, 130.4, 129.6], skala, 0.5)).toEqual([]);
    expect(edgesOffTime([131, 100, 101.25], skala, 0.5)).toEqual([131, 101.25]);
    expect(edgesOffTime([131], skala, 1)).toEqual([]);
  });
});

describe('Präzisierungen Vertrag E1-01 §9 Nr 4 und Nr 5', () => {
  it('[R-H-19] Text mit 270° (rotate -90) → rotation 270; Text mit 180° → readPdf wirft «nicht unterstützte Drehung: 180»', async () => {
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([200, 200]);
    p.drawText('Abwaerts', { x: 100, y: 150, size: 10, font: helv, rotate: degrees(-90) });
    const info = await readPdf(await doc.save({ useObjectStreams: false }));
    expect(textlauf(info, 'Abwaerts').rotation).toBe(270);
    expect(textlauf(info, 'Abwaerts').baselineY).toBeCloseTo(50, 2);

    const kopf = await PDFDocument.create();
    const f = await kopf.embedFont(StandardFonts.Helvetica);
    kopf
      .addPage([200, 200])
      .drawText('Kopfstand', { x: 100, y: 100, size: 10, font: f, rotate: degrees(180) });
    const bytes = await kopf.save({ useObjectStreams: false });
    await expect(readPdf(bytes)).rejects.toThrow('PDF-Text mit nicht unterstützter Drehung: 180');
  });

  it('[R-H-19] edgesOffTime: fromMin kein Vielfaches von 5 (Raster bleibt t ≡ 0 mod 5); Duplikate bleiben in Eingabereihenfolge', () => {
    const skala = { yTop: 100, ptPerMinute: 0.5, fromMin: 418 };
    // Rasterlinien bei t = 420 (y 101), 425 (y 103.5), …; y 100 liegt 1 pt neben 101.
    expect(edgesOffTime([101, 103.5], skala, 0.5)).toEqual([]);
    expect(edgesOffTime([100, 101, 100], skala, 0.5)).toEqual([100, 100]);
  });

  it('[R-H-19] edgesOffTime: Abstand gleich der Toleranz nicht gemeldet, knapp darüber gemeldet', () => {
    const skala = { yTop: 100, ptPerMinute: 0.5, fromMin: 420 };
    expect(edgesOffTime([100.5, 102], skala, 0.5)).toEqual([]);
    expect(edgesOffTime([100.51, 101.99], skala, 0.5)).toEqual([100.51, 101.99]);
  });
});

describe('readPdf ohne Konsolenausgabe, in Vitest node und jsdom', () => {
  const METHODEN = ['log', 'info', 'warn', 'error', 'debug'] as const;

  it('[R-H-19] Vitest node: readPdf schreibt nichts auf die Konsole', async () => {
    const spione = METHODEN.map((m) => vi.spyOn(console, m));
    await readPdf(soll.bytes);
    const aufrufe = spione.reduce((n, s) => n + s.mock.calls.length, 0);
    expect(aufrufe, 'Konsolenaufrufe während readPdf').toBe(0);
  });

  it(
    '[R-H-19] Vitest jsdom (Kindlauf): readPdf liefert dasselbe Ergebnis wie in node, ohne Konsolenausgabe',
    async () => {
      const sb = neueSandbox();
      const dir = join(sb.base, 'jsdom');
      writeText(dir, 'probe.pdf', soll.bytes);
      const ziel = join(dir, 'ergebnis.json');
      const leser = pathToFileURL(join(WT, 'tests', 'wap', 'support', 'pdf', 'read.ts')).href;
      writeText(
        dir,
        'vitest.config.mjs',
        "export default { test: { environment: 'jsdom', include: ['probe.test.ts'], retry: 0 } };\n",
      );
      writeText(
        dir,
        'probe.test.ts',
        [
          "import { readFileSync, writeFileSync } from 'node:fs';",
          "import { expect, it, vi } from 'vitest';",
          `import { readPdf } from ${JSON.stringify(leser)};`,
          '',
          "it('jsdom-Probe', async () => {",
          "  expect(typeof document).toBe('object');",
          "  const spione = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m));",
          `  const info = await readPdf(new Uint8Array(readFileSync(${JSON.stringify(join(dir, 'probe.pdf'))})));`,
          `  writeFileSync(${JSON.stringify(ziel)}, JSON.stringify(info));`,
          '  expect(spione.reduce((n, s) => n + s.mock.calls.length, 0)).toBe(0);',
          '});',
          '',
        ].join('\n'),
      );
      nodeModules(dir);
      const r = lauf(
        process.execPath,
        [
          join(WT, 'node_modules', 'vitest', 'vitest.mjs'),
          'run',
          '-c',
          'vitest.config.mjs',
          '--reporter=default',
        ],
        { cwd: dir, env: { ...sb.env, VITEST_MAX_WORKERS: '1' }, timeout: MITTEL },
      );
      expect(r.status, r.out).toBe(0);
      const node = JSON.parse(JSON.stringify(await readPdf(soll.bytes))) as unknown;
      expect(JSON.parse(readFileSync(ziel, 'utf8')) as unknown).toEqual(node);
    },
    MITTEL,
  );
});

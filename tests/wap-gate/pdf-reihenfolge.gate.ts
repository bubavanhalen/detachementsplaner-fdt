// readPdf: Zeichenreihenfolge und Bildlagen (Werkzeug-Nachtrag E1-01b, R-H-19, ADR-010 §7.2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-02e.md, Ausarbeitung Schritt 2, Abschnitt «P Nachtrag E1-01b:
// readPdf» Nr 1–5 (PdfTextRun.order, PdfInfo.imagePlacements, Export textOutline aus checks.ts; V27: page
// zählt ab 1). Selbsttest gegen von Hand mit pdf-lib erzeugte PDF (ohne den Schreiber von E1-02c) mit
// bekannten Werten. Nur frei erfundene Texte.
// Die neuen Felder und der neue Export werden über Reflect.get gelesen und zur Laufzeit geprüft: die Datei
// übersetzt so vor und nach dem Nachtrag, und ein fehlendes Feld scheitert fachlich (Assertion) statt mit
// einem Typ- oder Importfehler.
import { createCanvas } from '@napi-rs/canvas';
import {
  concatTransformationMatrix,
  PDFDocument,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import * as checks from '../wap/support/pdf/checks';
import {
  type PdfInfo,
  type PdfStroke,
  type PdfTextRun,
  type Rect,
  readPdf,
} from '../wap/support/pdf/read';

/** Toleranz der Bildlage in pt (Vertrag E1-02e P Nr 5: ± 0,01). */
const TOL_LAGE = 0.01;

/** Seitenhöhe der Seite 1 des Hauptfalls (pt). */
const H1 = 200;

/** Bildlage nach Vertrag E1-02e P Nr 2. */
interface Bildlage {
  page: number;
  bbox: Rect;
  order: number;
}

/** Erzeugtes 1×1-PNG (eine deckende Farbe). */
async function png1x1(): Promise<Uint8Array> {
  const c = createCanvas(1, 1);
  const g = c.getContext('2d');
  g.fillStyle = '#336699';
  g.fillRect(0, 0, 1, 1);
  return new Uint8Array(await c.encode('png'));
}

/**
 * Hauptfall (P Nr 5): Seite 1 zeichnet Rechteck A, Text «eins», das Bild in den Rahmen x 10, y 20, w 30,
 * h 40 (oben links), Rechteck B, einen Lauf aus reinem Leerraum und Text «zwei»; Seite 2 Text «drei».
 */
async function hauptPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bild = await doc.embedPng(await png1x1());
  const p1 = doc.addPage([200, H1]);
  p1.drawRectangle({ x: 120, y: 160, width: 20, height: 10, color: rgb(1, 0, 0) });
  p1.drawText('eins', { x: 20, y: 180, size: 10, font: helv });
  p1.drawImage(bild, { x: 10, y: H1 - 20 - 40, width: 30, height: 40 });
  p1.drawRectangle({ x: 120, y: 100, width: 20, height: 10, color: rgb(0, 0, 1) });
  p1.drawText('   ', { x: 20, y: 120, size: 10, font: helv });
  p1.drawText('zwei', { x: 20, y: 100, size: 10, font: helv });
  const p2 = doc.addPage([200, 150]);
  p2.drawText('drei', { x: 20, y: 100, size: 10, font: helv });
  return doc.save({ useObjectStreams: false });
}

/** Zeichnet das Bild unter einer zusätzlichen CTM [a b c d e f]; drawImage legt es auf (0, 0) mit w × h. */
function bildUnterCtm(
  seite: PDFPage,
  bild: Parameters<PDFPage['drawImage']>[0],
  ctm: [number, number, number, number, number, number],
  w: number,
  h: number,
): void {
  seite.pushOperators(pushGraphicsState(), concatTransformationMatrix(...ctm));
  seite.drawImage(bild, { x: 0, y: 0, width: w, height: h });
  seite.pushOperators(popGraphicsState());
}

/** Zweiter Fall: Seite 1 leer (120 × 80), Seite 2 (200 × 200) mit einem gedrehten Bild unter `ctm`. */
async function gedrehtPdf(
  ctm: [number, number, number, number, number, number],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bild = await doc.embedPng(await png1x1());
  doc.addPage([120, 80]);
  bildUnterCtm(doc.addPage([200, 200]), bild, ctm, 40, 20);
  return doc.save({ useObjectStreams: false });
}

let haupt: PdfInfo;

beforeAll(async () => {
  haupt = await readPdf(await hauptPdf());
});

function textlauf(info: PdfInfo, text: string): PdfTextRun {
  const r = info.texts.find((t) => t.text === text);
  expect(r, `Textlauf «${text}» fehlt`).toBeDefined();
  return r as PdfTextRun;
}

function flaeche(info: PdfInfo, fill: { r: number; g: number; b: number }): PdfStroke {
  const treffer = info.strokes.filter((s) => s.kind === 'rect' && s.fill !== null);
  const s = treffer.find((t) => t.fill?.r === fill.r && t.fill.g === fill.g && t.fill.b === fill.b);
  expect(s, `Rechteck mit Füllung ${JSON.stringify(fill)} fehlt`).toBeDefined();
  return s as PdfStroke;
}

/** Feld `order` eines Laufs, Strichs oder einer Bildlage; muss eine ganze Zahl sein (P Nr 1–2). */
function ordnung(element: object, name: string): number {
  const o: unknown = Reflect.get(element, 'order');
  expect(typeof o, `${name}: order fehlt oder ist keine Zahl`).toBe('number');
  expect(Number.isInteger(o), `${name}: order ist keine ganze Zahl`).toBe(true);
  return Number(o);
}

/** Feld `imagePlacements` (P Nr 2); muss eine Liste sein. */
function bildlagen(info: PdfInfo): Bildlage[] {
  const l: unknown = Reflect.get(info, 'imagePlacements');
  expect(Array.isArray(l), 'PdfInfo.imagePlacements fehlt oder ist keine Liste').toBe(true);
  return l as Bildlage[];
}

/** Export `textOutline` aus checks.ts (P Nr 3). */
function textOutline(t: PdfTextRun): Rect {
  const f: unknown = Reflect.get(checks, 'textOutline');
  expect(typeof f, 'checks.ts exportiert textOutline nicht als Funktion').toBe('function');
  return (f as (t: PdfTextRun) => Rect)(t);
}

function erwarteRect(ist: Rect | undefined, soll: Rect, tol: number, name: string): void {
  expect(ist, `${name}: bbox fehlt`).toBeDefined();
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const wert = ist?.[k];
    expect(typeof wert, `${name}: bbox.${k} ist keine Zahl`).toBe('number');
    expect(
      Math.abs(Number(wert) - soll[k]),
      `${name}: bbox.${k} = ${String(wert)}, erwartet ${String(soll[k])} ± ${String(tol)}`,
    ).toBeLessThanOrEqual(tol);
  }
}

/**
 * Bisherige Formel des Umrisses (Vertrag E1-01b §2, interne Funktion `umriss` in checks.ts vor dem Nachtrag),
 * hier unabhängig als Intervalle gerechnet: längs der Schrift die Breite, quer Grundlinie − ascent·size bis
 * Grundlinie − descent·size; bei 90° läuft die Schrift nach oben (Oberlänge links), bei 270° nach unten
 * (Oberlänge rechts).
 */
function bisherigerUmriss(t: PdfTextRun): Rect {
  const auf = t.ascent * t.sizePt;
  const ab = t.descent * t.sizePt;
  let xs: [number, number];
  let ys: [number, number];
  if (t.rotation === 90) {
    xs = [t.x - auf, t.x - ab];
    ys = [t.baselineY - t.width, t.baselineY];
  } else if (t.rotation === 270) {
    xs = [t.x + ab, t.x + auf];
    ys = [t.baselineY, t.baselineY + t.width];
  } else {
    xs = [t.x, t.x + t.width];
    ys = [t.baselineY - auf, t.baselineY - ab];
  }
  return { x: xs[0], y: ys[0], w: xs[1] - xs[0], h: ys[1] - ys[0] };
}

describe('readPdf: order über Striche, Texte und Bilder (P Nr 1–2)', () => {
  it('[R-H-19] order A < «eins» < Bild < B < «zwei» < «drei» streng steigend über beide Seiten; Lauf aus reinem Leerraum fehlt und bekommt keine Nummer', () => {
    const einzigeLage = (): Bildlage => {
      const lagen = bildlagen(haupt);
      expect(lagen, 'genau eine Bildlage').toHaveLength(1);
      return lagen[0] as Bildlage;
    };
    const folge: [string, number][] = [
      ['Rechteck A', ordnung(flaeche(haupt, { r: 255, g: 0, b: 0 }), 'Rechteck A')],
      ['eins', ordnung(textlauf(haupt, 'eins'), 'eins')],
      ['Bild', ordnung(einzigeLage(), 'Bild')],
      ['Rechteck B', ordnung(flaeche(haupt, { r: 0, g: 0, b: 255 }), 'Rechteck B')],
      ['zwei', ordnung(textlauf(haupt, 'zwei'), 'zwei')],
      ['drei', ordnung(textlauf(haupt, 'drei'), 'drei')],
    ];
    for (let i = 1; i < folge.length; i++) {
      const [vorName, vor] = folge[i - 1] as [string, number];
      const [name, wert] = folge[i] as [string, number];
      expect(wert, `${vorName} (${String(vor)}) < ${name} (${String(wert)})`).toBeGreaterThan(vor);
    }
    // Leerraum: kein Lauf, und zwischen B und «zwei» liegt keine verbrauchte Nummer.
    expect(haupt.texts.map((t) => t.text)).toEqual(['eins', 'zwei', 'drei']);
    expect(haupt.strokes).toHaveLength(2);
    const nrB = (folge[3] as [string, number])[1];
    const nrZwei = (folge[4] as [string, number])[1];
    expect(nrZwei, 'Leerraum-Lauf hat eine Nummer verbraucht').toBe(nrB + 1);
    // Keine Nummer doppelt.
    const alle = folge.map(([, n]) => n);
    expect(new Set(alle).size).toBe(alle.length);
  });
});

describe('readPdf: imagePlacements (P Nr 2) und page ab 1 (V27)', () => {
  it('[R-H-19] images = 1 = imagePlacements.length; Lage { page 1, bbox {10, 20, 30, 40} ± 0,01 }; page von «eins», «zwei» = 1, «drei» = 2', () => {
    const lagen = bildlagen(haupt);
    expect(haupt.images).toBe(1);
    expect(lagen).toHaveLength(haupt.images);
    const lage = lagen[0];
    expect(lage?.page, 'Seite der Bildlage (ab 1)').toBe(1);
    erwarteRect(lage?.bbox, { x: 10, y: 20, w: 30, h: 40 }, TOL_LAGE, 'Bild Seite 1');
    expect(textlauf(haupt, 'eins').page).toBe(1);
    expect(textlauf(haupt, 'zwei').page).toBe(1);
    expect(textlauf(haupt, 'drei').page).toBe(2);
  });

  it('[R-H-19] gedrehtes Bild (CTM 90°) auf Seite 2 → umschliessende bbox mit getauschter Breite und Höhe, page 2', async () => {
    // cm [0 1 −1 0 200 0]: (x, y) → (200 − y, x). Bild 40 × 20 auf (0, 0) → x 180 … 200, y 0 … 40 (PDF);
    // oben links auf der 200 pt hohen Seite: x 180, y 160, w 20, h 40.
    const info = await readPdf(await gedrehtPdf([0, 1, -1, 0, 200, 0]));
    const lagen = bildlagen(info);
    expect(info.images).toBe(1);
    expect(lagen).toHaveLength(1);
    expect(lagen[0]?.page).toBe(2);
    erwarteRect(lagen[0]?.bbox, { x: 180, y: 160, w: 20, h: 40 }, TOL_LAGE, 'Bild 90°');
  });

  it('[R-H-19] gedrehtes Bild (CTM 45°) → bbox umschliesst alle vier Ecken, nicht nur die Diagonale (0,0)–(1,1)', async () => {
    // cm [c s −s c 100 60] mit c = s = √½. Ecken des Bildes 40 × 20: x von 100 − 20·s bis 100 + 40·c,
    // y von 60 bis 60 + 60·s (PDF); oben links: y = 200 − (60 + 60·s).
    const c = Math.SQRT1_2;
    const info = await readPdf(await gedrehtPdf([c, c, -c, c, 100, 60]));
    const lagen = bildlagen(info);
    expect(lagen).toHaveLength(1);
    expect(lagen[0]?.page).toBe(2);
    erwarteRect(
      lagen[0]?.bbox,
      { x: 100 - 20 * c, y: 200 - (60 + 60 * c), w: 60 * c, h: 60 * c },
      TOL_LAGE,
      'Bild 45°',
    );
  });
});

describe('checks.ts: textOutline (P Nr 3)', () => {
  it.each([0, 90, 270] as const)(
    '[R-H-19] textOutline bei rotation %i = bisherige Formel (Grundlinie − ascent·size … Grundlinie − descent·size quer, width längs)',
    (rotation) => {
      const basis = textlauf(haupt, 'eins');
      // Werte mit exakter Binärdarstellung: von Hand nachgerechnet (auf = 7,5, ab = −2,5).
      const exakt: PdfTextRun = {
        ...basis,
        x: 100,
        baselineY: 200,
        width: 50,
        sizePt: 10,
        ascent: 0.75,
        descent: -0.25,
        rotation,
      };
      const vonHand: Record<0 | 90 | 270, Rect> = {
        0: { x: 100, y: 192.5, w: 50, h: 10 },
        90: { x: 92.5, y: 150, w: 10, h: 50 },
        270: { x: 97.5, y: 200, w: 10, h: 50 },
      };
      expect(textOutline(exakt)).toEqual(vonHand[rotation]);
      expect(bisherigerUmriss(exakt)).toEqual(vonHand[rotation]);
      // Krumme Werte (Metrik wie Helvetica) und der gelesene Lauf selbst: gleich der Formel.
      const krumm: PdfTextRun = {
        ...basis,
        x: 33.3,
        baselineY: 71.7,
        width: 17.89,
        sizePt: 7.5,
        ascent: 0.718,
        descent: -0.207,
        rotation,
      };
      for (const [name, t] of [
        ['krumm', krumm],
        ['gelesen', { ...basis, rotation }],
      ] as const) {
        const ist = textOutline(t);
        const soll = bisherigerUmriss(t);
        for (const k of ['x', 'y', 'w', 'h'] as const) {
          expect(ist[k], `${name}: ${k}`).toBeCloseTo(soll[k], 9);
        }
      }
    },
  );

  it('[R-H-19] textOutsideFrames nutzt textOutline: Rahmen = textOutline(Lauf) → nicht gemeldet; je Seite 0,03 pt enger → gemeldet', () => {
    const eins = textlauf(haupt, 'eins');
    const u = textOutline(eins);
    const gemeldet = (r: Rect) =>
      checks
        .textOutsideFrames(haupt, [r])
        .map((t) => t.text)
        .includes('eins');
    expect(gemeldet(u), 'Rahmen = Umriss').toBe(false);
    expect(gemeldet({ ...u, x: u.x + 0.03, w: u.w - 0.03 }), 'links enger').toBe(true);
    expect(gemeldet({ ...u, w: u.w - 0.03 }), 'rechts enger').toBe(true);
    expect(gemeldet({ ...u, y: u.y + 0.03, h: u.h - 0.03 }), 'oben enger').toBe(true);
    expect(gemeldet({ ...u, h: u.h - 0.03 }), 'unten enger').toBe(true);
  });
});

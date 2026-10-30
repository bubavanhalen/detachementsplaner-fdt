// PDF-Bildvergleich für I1 (ADR-010 §7.3 Render-Kette, Änderungsnotiz AE-001 §1 «E1-01b: PDF-Ebene 2 mit
// Bildvergleich»; R-H-19): renderPdfPage rendert eine Seite mit 300 dpi auf weissem Grund, compareExact
// vergleicht RGBA-Pixel exakt und zeigt Abweichungen im Differenzbild rot. Golden-Bilder und die
// Render-Kette (assertRenderChain) folgen mit E1-01d.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4 und E1-01b.md §2 (renderPdfPage, compareExact).
// Übernommen aus dem Entwurf golden.gate.entwurf.ts, Teil «renderPdfPage und compareExact» (Vertrag E1-01b §3).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { compareExact, renderPdfPage } from '../wap/support/golden/render';

const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Seite 72 × 144 pt (bei 300 dpi 300 × 600 px), obere Hälfte schwarz gefüllt. */
async function testPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([72, 144]);
  p.drawRectangle({ x: 0, y: 72, width: 72, height: 72, color: rgb(0, 0, 0) });
  return doc.save({ useObjectStreams: false });
}

function pixel(rgba: Uint8Array, breite: number, x: number, y: number): number[] {
  const i = (y * breite + x) * 4;
  return Array.from(rgba.slice(i, i + 4));
}

function bild(
  breite: number,
  hoehe: number,
  farbe: number[],
): { width: number; height: number; rgba: Uint8Array } {
  const rgba = new Uint8Array(breite * hoehe * 4);
  for (let i = 0; i < breite * hoehe; i++) rgba.set(farbe, i * 4);
  return { width: breite, height: hoehe, rgba };
}

/** Dekodiert ein PNG zu RGBA (unabhängig von compareExact). */
async function dekodiere(
  png: Uint8Array,
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const img = await loadImage(Buffer.from(png));
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const daten = g.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, rgba: new Uint8Array(daten.data) };
}

describe('renderPdfPage', () => {
  it('[R-H-19] rendert eine Seite mit 300 dpi: Grösse in Pixeln, bekannte Pixelfarben, PNG', async () => {
    const r = await renderPdfPage(await testPdf(), 1, 300);
    expect(r.width).toBe(300);
    expect(r.height).toBe(600);
    expect(r.rgba.length).toBe(300 * 600 * 4);
    expect(pixel(r.rgba, 300, 150, 150)).toEqual([0, 0, 0, 255]);
    expect(pixel(r.rgba, 300, 150, 450)).toEqual([255, 255, 255, 255]);
    expect(Array.from(r.png.slice(0, 8))).toEqual(PNG_SIGNATUR);
  });

  it('[R-H-19] Pixel = round(pt · 300/72): Seite 10 × 10,1 pt → 42 × 42 px; leere Seite weiss und deckend', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([10, 10.1]);
    const r = await renderPdfPage(await doc.save({ useObjectStreams: false }), 1, 300);
    expect(r.width).toBe(42);
    expect(r.height).toBe(42);
    for (const [x, y] of [
      [0, 0],
      [41, 41],
      [20, 20],
    ] as const) {
      expect(pixel(r.rgba, 42, x, y), `Pixel ${String(x)},${String(y)}`).toEqual([
        255, 255, 255, 255,
      ]);
    }
  });

  it('[R-H-19] Seite 2 wird gerendert; fehlende Seite → Fehler «Seite <n> fehlt»', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([72, 72]);
    doc.addPage([144, 72]);
    const bytes = await doc.save({ useObjectStreams: false });
    const r = await renderPdfPage(bytes, 2, 300);
    expect(r.width).toBe(600);
    expect(r.height).toBe(300);
    await expect(renderPdfPage(bytes, 3, 300)).rejects.toThrow('Seite 3 fehlt');
  });

  it('[R-H-19] zweimal gerendert → exakt gleich (0 abweichende Pixel)', async () => {
    const pdf = await testPdf();
    const a = await renderPdfPage(pdf, 1, 300);
    const b = await renderPdfPage(pdf, 1, 300);
    expect(compareExact(a, b).diffPixels).toBe(0);
  });
});

describe('compareExact', () => {
  it('[R-H-19] ein Pixel Unterschied (ein Kanal um 1) → diffPixels 1 mit Differenzbild (PNG)', () => {
    const a = bild(4, 3, [10, 20, 30, 255]);
    const b = bild(4, 3, [10, 20, 30, 255]);
    b.rgba[(1 * 4 + 2) * 4 + 1] = 21;
    const r = compareExact(a, b);
    expect(r.diffPixels).toBe(1);
    expect(Array.from(r.diffPng.slice(0, 8))).toEqual(PNG_SIGNATUR);
    expect(compareExact(a, bild(4, 3, [10, 20, 30, 255])).diffPixels).toBe(0);
  });

  it('[R-H-19] nur der Alphakanal verschieden → als Unterschied gezählt', () => {
    const a = bild(2, 2, [0, 0, 0, 255]);
    const b = bild(2, 2, [0, 0, 0, 255]);
    b.rgba[3] = 254;
    expect(compareExact(a, b).diffPixels).toBe(1);
  });

  it('[R-H-19] Differenzbild: gleiche Grösse, abweichende Pixel rot, übrige weiss', async () => {
    const a = bild(3, 2, [10, 20, 30, 255]);
    const b = bild(3, 2, [10, 20, 30, 255]);
    b.rgba[(0 * 3 + 2) * 4] = 11;
    b.rgba[(1 * 3 + 0) * 4 + 3] = 0;
    const r = compareExact(a, b);
    expect(r.diffPixels).toBe(2);
    const d = await dekodiere(r.diffPng);
    expect([d.width, d.height]).toEqual([3, 2]);
    const rot = [255, 0, 0, 255];
    const weiss = [255, 255, 255, 255];
    expect(pixel(d.rgba, 3, 2, 0)).toEqual(rot);
    expect(pixel(d.rgba, 3, 0, 1)).toEqual(rot);
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ] as const) {
      expect(pixel(d.rgba, 3, x, y), `Pixel ${String(x)},${String(y)}`).toEqual(weiss);
    }
  });

  it('[R-H-19] verschiedene Bildgrössen → Fehler «Bildgrössen verschieden» (Breite und Höhe je für sich)', () => {
    const a = bild(4, 3, [0, 0, 0, 255]);
    expect(() => compareExact(a, bild(5, 3, [0, 0, 0, 255]))).toThrow('Bildgrössen verschieden');
    expect(() => compareExact(a, bild(4, 2, [0, 0, 0, 255]))).toThrow('Bildgrössen verschieden');
    expect(() => compareExact(a, bild(3, 4, [0, 0, 0, 255]))).toThrow('Bildgrössen verschieden');
  });
});

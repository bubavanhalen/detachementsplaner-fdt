// Golden-Rendering mit fixierter Render-Kette (Paket E1-01b, R-H-19, ADR-010 §7.3).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4 und E1-01b.md §2 (renderPdfPage, compareExact):
// pdfjs-dist 6.3.289 rendert mit @napi-rs/canvas (Node-Canvas von pdfjs) auf weissem Grund; der Vergleich
// zählt jedes Pixel mit mindestens einem abweichenden Kanal (auch Alpha). PNG werden hier selbst kodiert
// (node:zlib), damit Differenz- und Seitenbilder nicht vom Canvas-Kodierer abhängen.
// assertRenderChain folgt mit E1-01d (Stub, Vertrag E1-01b §1).
import { crc32, deflateSync } from 'node:zlib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** RGBA-Bild, 4 Bytes je Pixel, zeilenweise von oben links. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** Zeichenfläche der Canvas-Fabrik von pdfjs (Node: @napi-rs/canvas). */
interface Flaeche {
  canvas: unknown;
  context: {
    fillStyle: unknown;
    fillRect(x: number, y: number, w: number, h: number): void;
    getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
  };
}

interface CanvasFabrik {
  create(breite: number, hoehe: number): Flaeche;
  destroy(f: Flaeche): void;
}

const PNG_SIGNATUR = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function block(typ: string, daten: Uint8Array): Uint8Array {
  const kopf = new Uint8Array(8);
  const sicht = new DataView(kopf.buffer);
  sicht.setUint32(0, daten.length);
  kopf.set(new TextEncoder().encode(typ), 4);
  const pruef = new Uint8Array(4);
  new DataView(pruef.buffer).setUint32(0, crc32(Buffer.concat([kopf.subarray(4), daten])));
  return Buffer.concat([kopf, daten, pruef]);
}

/** PNG (RGBA, 8 Bit, ohne Filter, ohne Zusatzblöcke) aus Rohdaten; deterministisch. */
function png(rgba: Uint8Array, breite: number, hoehe: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const sicht = new DataView(ihdr.buffer);
  sicht.setUint32(0, breite);
  sicht.setUint32(4, hoehe);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const zeile = breite * 4;
  const roh = new Uint8Array((zeile + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (zeile + 1)] = 0;
    roh.set(rgba.subarray(y * zeile, (y + 1) * zeile), y * (zeile + 1) + 1);
  }
  return new Uint8Array(
    Buffer.concat([
      PNG_SIGNATUR,
      block('IHDR', ihdr),
      block('IDAT', deflateSync(roh, { level: 9 })),
      block('IEND', new Uint8Array(0)),
    ]),
  );
}

/** Rendert eine Seite (1-basiert) mit 300 dpi; Pixel = round(pt · 300/72), weisser Grund. */
export async function renderPdfPage(
  bytes: Uint8Array,
  page: number,
  dpi: 300,
): Promise<{ width: number; height: number; rgba: Uint8Array; png: Uint8Array }> {
  const aufgabe = getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  try {
    const pdf = await aufgabe.promise;
    if (!Number.isInteger(page) || page < 1 || page > pdf.numPages) {
      throw new Error(`Seite ${String(page)} fehlt`);
    }
    const seite = await pdf.getPage(page);
    const ansicht = seite.getViewport({ scale: dpi / 72 });
    const breite = Math.round(ansicht.width);
    const hoehe = Math.round(ansicht.height);
    const fabrik = (pdf as unknown as { canvasFactory: CanvasFabrik }).canvasFactory;
    const flaeche = fabrik.create(breite, hoehe);
    try {
      flaeche.context.fillStyle = '#ffffff';
      flaeche.context.fillRect(0, 0, breite, hoehe);
      await seite.render({
        canvas: flaeche.canvas as HTMLCanvasElement,
        canvasContext: flaeche.context as unknown as CanvasRenderingContext2D,
        viewport: ansicht,
        background: '#ffffff',
      }).promise;
      const rgba = new Uint8Array(flaeche.context.getImageData(0, 0, breite, hoehe).data);
      return { width: breite, height: hoehe, rgba, png: png(rgba, breite, hoehe) };
    } finally {
      fabrik.destroy(flaeche);
      seite.cleanup();
    }
  } finally {
    await aufgabe.destroy();
  }
}

/**
 * Vergleicht die installierte Render-Kette (Teil «pdf») mit render-chain.json; wirft AssertionError
 * «Render-Kette geändert: …». root: Repo-Wurzel (Standard: Wurzel dieses Checkouts); kette: Pfad der
 * Kettendatei (Standard: <root>/tests/wap/golden/render-chain.json). Stub bis E1-01d.
 */
export function assertRenderChain(_opts?: { root?: string; kette?: string }): Promise<void> {
  throw new Error('nicht implementiert: support.assertRenderChain');
}

/** Exakter Pixelvergleich; jedes Pixel mit einem abweichenden Kanal zählt; diffPng: rot = abweichend. */
export function compareExact(
  a: RgbaImage,
  b: RgbaImage,
): { diffPixels: number; diffPng: Uint8Array } {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `Bildgrössen verschieden: ${String(a.width)} × ${String(a.height)} gegen ${String(b.width)} × ${String(b.height)} Pixel`,
    );
  }
  const pixel = a.width * a.height;
  const diff = new Uint8Array(pixel * 4);
  let diffPixels = 0;
  for (let p = 0; p < pixel; p++) {
    const i = p * 4;
    const anders =
      a.rgba[i] !== b.rgba[i] ||
      a.rgba[i + 1] !== b.rgba[i + 1] ||
      a.rgba[i + 2] !== b.rgba[i + 2] ||
      a.rgba[i + 3] !== b.rgba[i + 3];
    if (anders) diffPixels += 1;
    diff[i] = 255;
    diff[i + 1] = anders ? 0 : 255;
    diff[i + 2] = anders ? 0 : 255;
    diff[i + 3] = 255;
  }
  return { diffPixels, diffPng: png(diff, a.width, a.height) };
}

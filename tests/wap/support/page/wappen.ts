// Fiktive Wappen-Bilder, zur Laufzeit erzeugt (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2»
// E4, G4, J «Wappen-Leser (V07)»). PNG mit gültigem IHDR in beliebiger Pixelgrösse, JPEG-Köpfe mit SOI und einem
// SOFn-Segment, dazu gebrochene Varianten. Nur Node (node:zlib); keine echten Bilder.
import { crc32, deflateSync } from 'node:zlib';

function verkette(teile: readonly Uint8Array[]): Uint8Array {
  const aus = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) {
    aus.set(t, o);
    o += t.length;
  }
  return aus;
}

function ascii(s: string): Uint8Array {
  return Uint8Array.from([...s].map((z) => z.charCodeAt(0)));
}

const PNG_SIGNATUR = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG-Block mit Länge, Typ, Daten und CRC. */
function pngBlock(typ: string, daten: Uint8Array): Uint8Array {
  const kopf = new Uint8Array(8);
  new DataView(kopf.buffer).setUint32(0, daten.length);
  kopf.set(ascii(typ), 4);
  const pruef = new Uint8Array(4);
  new DataView(pruef.buffer).setUint32(0, crc32(verkette([kopf.subarray(4), daten])));
  return verkette([kopf, daten, pruef]);
}

function ihdr(w: number, h: number): Uint8Array {
  const d = new Uint8Array(13);
  const v = new DataView(d.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  d.set([8, 2, 0, 0, 0], 8);
  return pngBlock('IHDR', d);
}

/** Einfarbiges RGB-PNG w × h (Filter 0 je Zeile). */
export function pngEinfarbig(
  w: number,
  h: number,
  farbe: readonly [number, number, number] = [180, 30, 40],
): Uint8Array {
  const zeile = new Uint8Array(1 + 3 * w);
  for (let x = 0; x < w; x++) zeile.set(farbe, 1 + 3 * x);
  const roh = new Uint8Array(zeile.length * h);
  for (let y = 0; y < h; y++) roh.set(zeile, y * zeile.length);
  return verkette([
    PNG_SIGNATUR,
    ihdr(w, h),
    pngBlock('IDAT', new Uint8Array(deflateSync(roh))),
    pngBlock('IEND', new Uint8Array(0)),
  ]);
}

/** PNG mit gebrochenem IHDR: Länge 8 statt 13 (Pixelmasse nicht lesbar). */
export function pngIhdrGebrochen(): Uint8Array {
  return verkette([
    PNG_SIGNATUR,
    pngBlock('IHDR', Uint8Array.from([0, 0, 0, 40, 0, 0, 0, 20])),
    pngBlock('IDAT', new Uint8Array(deflateSync(Uint8Array.from([0, 1, 2, 3])))),
    pngBlock('IEND', new Uint8Array(0)),
  ]);
}

/** PNG, das nach der Signatur mitten im IHDR abbricht. */
export function pngAbgeschnitten(): Uint8Array {
  return pngEinfarbig(4, 2).subarray(0, 8 + 10);
}

/** JPEG-Segment 0xFF<marker> mit Längenfeld. */
function segment(marker: number, daten: readonly number[]): Uint8Array {
  const l = daten.length + 2;
  return Uint8Array.from([0xff, marker, l >> 8, l & 0xff, ...daten]);
}

const SOI = Uint8Array.from([0xff, 0xd8]);
const EOI = Uint8Array.from([0xff, 0xd9]);
const JFIF = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

/** JPEG-Kopf mit SOI, APP0 und einem SOFn (Marker 0xC0 … 0xCF) mit Höhe h und Breite w, dann EOI. */
export function jpegKopf(sof: number, w: number, h: number): Uint8Array {
  const sofDaten = [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0];
  return verkette([SOI, JFIF, segment(sof, sofDaten), EOI]);
}

/** JPEG mit SOI und APP0, aber ohne SOFn. */
export function jpegOhneSof(): Uint8Array {
  return verkette([SOI, JFIF, EOI]);
}

/** Base64 für `ImageAsset.dataBase64` (nur im Testcode; die Layout-Schicht dekodiert selbst, Vertrag E4). */
export function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

// Fiktive Rasterbilder, zur Laufzeit gebaut (Paket E1-02c; Vertrag E1-02c §2.3 Nr 8, Vertragsprüfung V03,
// Runde 2 V17–V19). Jedes Bild entsteht aus Teilen mit der Angabe, ob der Teil nach `sanitizeImageBytes`
// bleibt; die erwarteten bereinigten Bytes sind die Verkettung der bleibenden Teile. Markierungstexte sind
// erfunden und stehen nur in Teilen, die entfallen müssen. Nur Node (node:zlib).
import { crc32, deflateSync } from 'node:zlib';

/** Ein Teil eines Bildes und ob er nach der Bereinigung bleibt. */
export interface Teil {
  readonly bytes: Uint8Array;
  readonly bleibt: boolean;
}

/** Bild aus Teilen: alle Bytes und die erwarteten bereinigten Bytes. */
export interface GebautesBild {
  readonly bytes: Uint8Array;
  readonly sauber: Uint8Array;
}

export function verkette(teile: readonly Uint8Array[]): Uint8Array {
  const laenge = teile.reduce((s, t) => s + t.length, 0);
  const aus = new Uint8Array(laenge);
  let o = 0;
  for (const t of teile) {
    aus.set(t, o);
    o += t.length;
  }
  return aus;
}

export function baue(teile: readonly Teil[]): GebautesBild {
  return {
    bytes: verkette(teile.map((t) => t.bytes)),
    sauber: verkette(teile.filter((t) => t.bleibt).map((t) => t.bytes)),
  };
}

export const bleibt = (bytes: Uint8Array): Teil => ({ bytes, bleibt: true });
export const entfaellt = (bytes: Uint8Array): Teil => ({ bytes, bleibt: false });

export function ascii(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, 'latin1'));
}

// ---------------------------------------------------------------- JPEG

export const SOI = Uint8Array.from([0xff, 0xd8]);
export const EOI = Uint8Array.from([0xff, 0xd9]);

/** Segment mit Marker 0xFF<marker> und Längenfeld (2 + Länge der Daten). */
export function segment(marker: number, daten: Uint8Array | readonly number[]): Uint8Array {
  const d = daten instanceof Uint8Array ? daten : Uint8Array.from(daten);
  const l = d.length + 2;
  return verkette([Uint8Array.from([0xff, marker, l >> 8, l & 0xff]), d]);
}

/** APPn-Segment (n = 0–15). */
export function app(n: number, daten: Uint8Array): Uint8Array {
  return segment(0xe0 + n, daten);
}

/** COM-Segment. */
export function kommentar(text: string): Uint8Array {
  return segment(0xfe, ascii(text));
}

/** APP0 JFIF 1.01 ohne Vorschaubild (Xthumbnail = Ythumbnail = 0). */
export function jfifOhneVorschau(): Uint8Array {
  return app(0, Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
}

/** APP0 JFIF mit Vorschaubild w × h (RGB-Daten enthalten die Markierung). */
export function jfifMitVorschau(marke: string): Uint8Array {
  const m = ascii(marke);
  // 3 Bytes je Pixel; Breite so, dass die Markierung hineinpasst.
  const w = Math.ceil(m.length / 3);
  const rgb = new Uint8Array(w * 3);
  rgb.set(m);
  return app(
    0,
    verkette([Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 2, 0, 0, 1, 0, 1, w, 1]), rgb]),
  );
}

/** APP0 JFXX (Erweiterung, Vorschaubild als JPEG, Code 0x10) mit Markierung. */
export function jfxx(marke: string): Uint8Array {
  return app(0, verkette([Uint8Array.from([0x4a, 0x46, 0x58, 0x58, 0x00, 0x10]), ascii(marke)]));
}

/** APP14 «Adobe», genau die 12-Byte-Struktur (bleibt byte-gleich; Orchestrator-Zeile Test-Review Runde 1 a). */
export function adobeApp14(): Uint8Array {
  return app(14, Uint8Array.from([0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0]));
}

/** APP0 JFIF mit Vorschaubild 0 × 0, aber angehängten Bytes mit Markierung (Segmentlänge > 16, entfällt). */
export function jfifMitAnhang(marke: string): Uint8Array {
  return app(
    0,
    verkette([
      Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
      ascii(marke),
    ]),
  );
}

/** APP14 «Adobe» mit angehängten Bytes mit Markierung (nicht genau 12 Datenbytes, entfällt). */
export function adobeMitAnhang(marke: string): Uint8Array {
  return app(
    14,
    verkette([
      Uint8Array.from([0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0]),
      ascii(marke),
    ]),
  );
}

/** APP14 ohne Adobe-Kennung mit Markierung (entfällt). */
export function app14Fremd(marke: string): Uint8Array {
  return app(14, ascii(`Fiktiv\0${marke}`));
}

/** Segment JPGn (Marker 0xF0–0xFD) mit Markierung (entfällt). */
export function jpgn(marker: number, marke: string): Uint8Array {
  return segment(marker, ascii(marke));
}

/** DRI (Restart-Intervall), bleibt nach der Positivliste. */
export function dri(intervall: number): Uint8Array {
  return segment(0xdd, [intervall >> 8, intervall & 0xff]);
}

/** EXIF-APP1 (big endian) mit Orientierung und optional einem Zusatztext. */
export function exif(orientierung: number, zusatz = ''): Uint8Array {
  const kopf = ascii('Exif\0\0');
  // TIFF-Kopf «MM», IFD0 ab Byte 8 mit einem Eintrag Orientierung (0x0112, SHORT, 1), kein weiteres IFD.
  const tiffKopf = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08];
  const ifd0 = [0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientierung];
  const tiff = Uint8Array.from([...tiffKopf, ...ifd0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  return app(1, verkette([kopf, tiff, ascii(zusatz)]));
}

/** Typische Inhalte der Metadaten-Segmente APP1–APP13, APP15 und COM mit Markierung. */
export function metadatenSegment(n: number | 'COM', marke: string): Uint8Array {
  if (n === 'COM') return kommentar(marke);
  if (n === 1) return exif(1, marke);
  if (n === 2)
    return app(2, verkette([ascii('ICC_PROFILE\0'), Uint8Array.from([1, 1]), ascii(marke)]));
  if (n === 13) return app(13, ascii(`Photoshop 3.0\0${marke}`));
  return app(n, ascii(`Fiktiv${String(n)}\0${marke}`));
}

/** XMP-APP1 mit Markierung. */
export function xmp(marke: string): Uint8Array {
  return app(
    1,
    ascii(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/">${marke}</x:xmpmeta>`),
  );
}

const DQT = segment(0xdb, [0x00, ...new Array<number>(64).fill(1)]);
const SOF0 = segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]);
const SOF2 = segment(0xc2, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]);
/** Huffman-Tabelle mit einem Code der Länge 1 für Symbol 0 (Klasse 0 = DC, 1 = AC). */
function dht(klasse: 0 | 1): Uint8Array {
  return segment(0xc4, [klasse << 4, 1, ...new Array<number>(15).fill(0), 0x00]);
}
const SOS_BASIS = segment(0xda, [1, 1, 0x00, 0, 63, 0]);
const SOS_DC = segment(0xda, [1, 1, 0x00, 0, 0, 0]);
const SOS_AC = segment(0xda, [1, 1, 0x00, 1, 63, 0]);

/**
 * Graues 8 × 8-JPEG (Graustufe 128), dekodierbar von pdfjs und Edge, aus Teilen.
 * - `vorSof`: Teile zwischen SOI und DQT (z.B. APP-Segmente);
 * - `progressiv`: SOF2 mit DC- und AC-Scan, `zwischenScans` zwischen den beiden Scans;
 * - `nachEoi`: Teile nach dem EOI; `ohneEoi`: kein EOI.
 */
export function jpegGrau(
  opts: {
    readonly vorSof?: readonly Teil[];
    readonly progressiv?: boolean;
    readonly zwischenScans?: readonly Teil[];
    readonly nachEoi?: readonly Teil[];
    readonly ohneEoi?: boolean;
  } = {},
): GebautesBild {
  const teile: Teil[] = [
    bleibt(SOI),
    ...(opts.vorSof ?? [bleibt(jfifOhneVorschau())]),
    bleibt(DQT),
  ];
  if (opts.progressiv === true) {
    teile.push(bleibt(SOF2), bleibt(dht(0)), bleibt(SOS_DC), bleibt(Uint8Array.from([0x7f])));
    teile.push(...(opts.zwischenScans ?? []));
    teile.push(bleibt(dht(1)), bleibt(SOS_AC), bleibt(Uint8Array.from([0x7f])));
  } else {
    teile.push(bleibt(SOF0), bleibt(dht(0)), bleibt(dht(1)), bleibt(SOS_BASIS));
    teile.push(bleibt(Uint8Array.from([0x3f])));
  }
  if (opts.ohneEoi !== true) teile.push(bleibt(EOI));
  teile.push(...(opts.nachEoi ?? []));
  return baue(teile);
}

/**
 * JPEG-Struktur mit DRI und Scandaten, die Füllbytes (FF 00) und Restart-Marker (FF D0) enthalten; nur für die
 * Bereinigung (nicht dekodierbar).
 */
export function jpegMitRestart(nachEoi: readonly Teil[] = []): GebautesBild {
  return baue([
    bleibt(SOI),
    bleibt(jfifOhneVorschau()),
    entfaellt(kommentar('FIKTIV-KOMMENTAR-RST')),
    bleibt(DQT),
    bleibt(dri(1)),
    bleibt(SOF0),
    bleibt(dht(0)),
    bleibt(dht(1)),
    bleibt(SOS_BASIS),
    bleibt(
      Uint8Array.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0x00, 0xff, 0xd1, 0x78]),
    ),
    bleibt(EOI),
    ...nachEoi,
  ]);
}

// ---------------------------------------------------------------- PNG

export const PNG_SIGNATUR = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG-Block mit Länge, Typ, Daten und CRC. */
export function pngBlock(typ: string, daten: Uint8Array, laengeFalsch = false): Uint8Array {
  const kopf = new Uint8Array(8);
  new DataView(kopf.buffer).setUint32(0, daten.length + (laengeFalsch ? 1000 : 0));
  kopf.set(ascii(typ), 4);
  const pruef = new Uint8Array(4);
  new DataView(pruef.buffer).setUint32(0, crc32(verkette([kopf.subarray(4), daten])));
  return verkette([kopf, daten, pruef]);
}

function ihdr(w: number, h: number, farbtyp: number): Uint8Array {
  const d = new Uint8Array(13);
  const v = new DataView(d.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  d.set([8, farbtyp, 0, 0, 0], 8);
  return pngBlock('IHDR', d);
}

/** Zeilen mit Filter 0 voranstellen und packen. */
function idatDaten(zeilen: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(deflateSync(verkette(zeilen.map((z) => verkette([Uint8Array.of(0), z])))));
}

/** Zusatzblöcke mit Markierung (Text, komprimierter Text, internationaler Text, EXIF, Zeit, Farbprofil). */
export function pngMetadaten(marke: string): {
  readonly vorPlte: Teil[];
  readonly vorIdat: Teil[];
  readonly nachIdat: Teil[];
} {
  return {
    vorPlte: [
      entfaellt(
        pngBlock(
          'iCCP',
          verkette([ascii('Fiktiv\0\0'), new Uint8Array(deflateSync(ascii(`ICC ${marke}`)))]),
        ),
      ),
      entfaellt(pngBlock('gAMA', Uint8Array.from([0, 0, 0xb1, 0x8f]))),
      entfaellt(
        pngBlock('cHRM', Uint8Array.from(new Array<number>(32).fill(0).map((_, i) => i * 7))),
      ),
      entfaellt(pngBlock('sRGB', Uint8Array.of(0))),
    ],
    vorIdat: [
      entfaellt(pngBlock('eXIf', verkette([ascii('MM\0*\0\0\0\x08\0\0'), ascii(marke)]))),
      entfaellt(pngBlock('tEXt', ascii(`Comment\0${marke}`))),
      entfaellt(
        pngBlock(
          'zTXt',
          verkette([ascii('Comment\0\0'), new Uint8Array(deflateSync(ascii(marke)))]),
        ),
      ),
      entfaellt(pngBlock('iTXt', ascii(`Comment\0\0\0de\0Kommentar\0${marke}`))),
      entfaellt(pngBlock('tIME', Uint8Array.from([0x07, 0xea, 10, 5, 12, 0, 0]))),
    ],
    nachIdat: [entfaellt(pngBlock('tEXt', ascii(`Author\0${marke}`)))],
  };
}

/**
 * Palettenbild 2 × 1 (links Farbe 0, rechts Farbe 1) mit PLTE und tRNS, IDAT in zwei Blöcken.
 * Optional Metadatenblöcke (entfallen) und Bytes nach IEND (entfallen).
 */
export function pngPalette(
  opts: {
    readonly farben?: readonly [
      readonly [number, number, number],
      readonly [number, number, number],
    ];
    readonly metadaten?: string;
    readonly nachIend?: readonly Teil[];
  } = {},
): GebautesBild {
  const farben = opts.farben ?? [
    [220, 20, 60],
    [20, 60, 220],
  ];
  const meta =
    opts.metadaten === undefined
      ? { vorPlte: [], vorIdat: [], nachIdat: [] }
      : pngMetadaten(opts.metadaten);
  // Zwei Pixel mit 8 Bit Index: Index 0 und 1.
  const daten = idatDaten([Uint8Array.from([0, 1])]);
  const mitte = Math.floor(daten.length / 2);
  return baue([
    bleibt(PNG_SIGNATUR),
    bleibt(ihdr(2, 1, 3)),
    ...meta.vorPlte,
    bleibt(pngBlock('PLTE', Uint8Array.from([...farben[0], ...farben[1]]))),
    bleibt(pngBlock('tRNS', Uint8Array.from([255, 255]))),
    ...meta.vorIdat,
    bleibt(pngBlock('IDAT', daten.subarray(0, mitte))),
    bleibt(pngBlock('IDAT', daten.subarray(mitte))),
    ...meta.nachIdat,
    bleibt(pngBlock('IEND', new Uint8Array(0))),
    ...(opts.nachIend ?? []),
  ]);
}

/** RGB-PNG 2 × 1 (links Farbe a, rechts Farbe b) ohne Zusatzblöcke. */
export function pngRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): Uint8Array {
  return verkette([
    PNG_SIGNATUR,
    ihdr(2, 1, 2),
    pngBlock('IDAT', idatDaten([Uint8Array.from([...a, ...b])])),
    pngBlock('IEND', new Uint8Array(0)),
  ]);
}

/** PNG ohne einen der Pflichtblöcke bzw. mit falscher Blocklänge. */
export function pngDefekt(art: 'ohneIhdr' | 'ohneIdat' | 'ohneIend' | 'laenge'): Uint8Array {
  const daten = idatDaten([Uint8Array.from([0, 1])]);
  const teile: Uint8Array[] = [PNG_SIGNATUR];
  if (art !== 'ohneIhdr') teile.push(ihdr(2, 1, 3));
  teile.push(pngBlock('PLTE', Uint8Array.from([0, 0, 0, 255, 255, 255])));
  if (art !== 'ohneIdat') teile.push(pngBlock('IDAT', daten, art === 'laenge'));
  if (art !== 'ohneIend') teile.push(pngBlock('IEND', new Uint8Array(0)));
  return verkette(teile);
}

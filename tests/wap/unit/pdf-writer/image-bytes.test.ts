// @vitest-environment jsdom
// Paket E1-02c: Bereinigung von Rasterbildern vor dem Zeichnen, sanitizeImageBytes (Vertrag E1-02c §2.3 Nr 8;
// Änderungsnotiz Vertragsprüfung V03, Runde 2 V17, V18, V19; Datenschutz AGENTS.md). Fiktive Bilder, zur
// Laufzeit gebaut (tests/wap/pdf/writer/support/bilder.ts); die Erwartung ist jeweils die Verkettung der
// Teile, die laut Vertrag bleiben. Positivliste nach Orchestrator-Zeile «Test-Review Runde 1» (a), TR-E102c-01.
import { describe, expect, it, vi } from 'vitest';
import { sanitizeImageBytes } from '../../../../src/io/wap-pdf/imageBytes';
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
  jpegMitRestart,
  jpgn,
  kommentar,
  metadatenSegment,
  PNG_SIGNATUR,
  pngDefekt,
  pngPalette,
  verkette,
  xmp,
} from '../../pdf/writer/support/bilder';

const METADATEN_SEGMENTE: readonly (number | 'COM')[] = [
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

function name(n: number | 'COM'): string {
  return n === 'COM' ? 'COM' : `APP${String(n)}`;
}

/** Blocktypen eines PNG in Reihenfolge (ohne Prüfung). */
function pngBloecke(bytes: Uint8Array): string[] {
  const aus: string[] = [];
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 8;
  while (o + 8 <= bytes.length) {
    const l = v.getUint32(o);
    aus.push(String.fromCharCode(...bytes.subarray(o + 4, o + 8)));
    o += 12 + l;
  }
  return aus;
}

/** Deterministischer Zufallsgenerator (LCG) mit festem Startwert. */
function lcg(start: number): () => number {
  let s = start >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

describe('sanitizeImageBytes: JPEG (V03, V17, V19)', () => {
  it('[R-10-01] (V03) APP1–APP13, APP15 und COM entfallen; SOI, APP0 (JFIF ohne Vorschaubild), APP14 und Bilddaten bleiben byte-gleich', () => {
    const bild = jpegGrau({
      vorSof: [
        bleibt(jfifOhneVorschau()),
        entfaellt(xmp('FIKTIV-XMP-1001')),
        ...METADATEN_SEGMENTE.map((n) => entfaellt(metadatenSegment(n, `FIKTIV-${name(n)}-1002`))),
        bleibt(adobeApp14()),
      ],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V03) jedes Metadaten-Segment einzeln (APP1 bis APP13, APP15, COM) entfällt, auch nach APP14', () => {
    for (const n of METADATEN_SEGMENTE) {
      const bild = jpegGrau({
        vorSof: [
          bleibt(jfifOhneVorschau()),
          bleibt(adobeApp14()),
          entfaellt(metadatenSegment(n, `FIKTIV-EINZELN-${name(n)}`)),
        ],
      });
      expect(sanitizeImageBytes('image/jpeg', bild.bytes), name(n)).toEqual(bild.sauber);
    }
  });

  it('[R-10-01] (V03) progressive Datei: COM, APP1 und APP2 zwischen den Scans entfallen; DHT und Scans bleiben', () => {
    const bild = jpegGrau({
      progressiv: true,
      zwischenScans: [
        entfaellt(kommentar('FIKTIV-ZWISCHEN-COM')),
        entfaellt(metadatenSegment(1, 'FIKTIV-ZWISCHEN-APP1')),
        entfaellt(metadatenSegment(2, 'FIKTIV-ZWISCHEN-APP2')),
      ],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V17) Bytes nach dem EOI entfallen; die Ausgabe endet mit dem ersten EOI nach dem letzten Scan', () => {
    const bild = jpegGrau({
      nachEoi: [
        entfaellt(ascii('FIKTIV-NACH-EOI-VIDEO')),
        entfaellt(Uint8Array.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x41, 0x42, 0xff, 0xd9])),
      ],
    });
    const aus = sanitizeImageBytes('image/jpeg', bild.bytes);
    expect(aus).toEqual(bild.sauber);
    expect(Array.from(aus?.subarray(-2) ?? [])).toEqual([0xff, 0xd9]);
  });

  it('[R-10-01] (V17) progressive Datei mit Bytes nach dem EOI: Ausgabe endet mit dem EOI', () => {
    const bild = jpegGrau({
      progressiv: true,
      nachEoi: [entfaellt(ascii('FIKTIV-NACH-EOI-PROGRESSIV'))],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V17) ohne EOI → null, auch progressiv und mit Bytes, die kein EOI sind', () => {
    expect(sanitizeImageBytes('image/jpeg', jpegGrau({ ohneEoi: true }).bytes)).toBeNull();
    expect(
      sanitizeImageBytes('image/jpeg', jpegGrau({ ohneEoi: true, progressiv: true }).bytes),
    ).toBeNull();
    expect(
      sanitizeImageBytes(
        'image/jpeg',
        jpegGrau({ ohneEoi: true, nachEoi: [entfaellt(ascii('FIKTIV-OHNE-EOI'))] }).bytes,
      ),
    ).toBeNull();
  });

  it('[R-10-01] (V17) jedes echte Anfangsstück eines gültigen JPEG ist nicht lesbar → null (kein Wurf)', () => {
    for (const bild of [jpegGrau(), jpegGrau({ progressiv: true })]) {
      for (let l = 0; l < bild.bytes.length; l++) {
        expect(
          sanitizeImageBytes('image/jpeg', bild.bytes.slice(0, l)),
          `Länge ${String(l)}`,
        ).toBeNull();
      }
    }
  });

  it('[R-10-01] (V19) APP0 JFIF mit Vorschaubild entfällt (samt Markierung im Vorschaubild)', () => {
    const bild = jpegGrau({
      vorSof: [entfaellt(jfifMitVorschau('FIKTIV-VORSCHAU-2001')), bleibt(adobeApp14())],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V19) APP0 JFXX entfällt; JFIF ohne Vorschaubild davor bleibt byte-gleich', () => {
    const bild = jpegGrau({
      vorSof: [bleibt(jfifOhneVorschau()), entfaellt(jfxx('FIKTIV-JFXX-2002'))],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V19) APP0 mit anderem Bezeichner als JFIF entfällt', () => {
    const bild = jpegGrau({
      vorSof: [entfaellt(app(0, ascii('FIKTIV\0APP0-2003'))), bleibt(jfifOhneVorschau())],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V19) JFIF ohne Vorschaubild und ohne weitere Metadaten: Ergebnis byte-gleich mit der Eingabe', () => {
    const bild = jpegGrau();
    expect(bild.bytes).toEqual(bild.sauber);
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.bytes);
    const progressiv = jpegGrau({ progressiv: true });
    expect(sanitizeImageBytes('image/jpeg', progressiv.bytes)).toEqual(progressiv.bytes);
  });

  it('[R-10-01] (V03) Scandaten mit Füllbytes (FF 00) und Restart-Markern (FF D0, FF D1) bleiben byte-gleich', () => {
    const bild = jpegMitRestart([entfaellt(ascii('FIKTIV-NACH-RST'))]);
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (V03) nicht lesbare Segmentfolge → null: ohne SOI, abgeschnittenes Segment, leere Eingabe, Segmentlänge < 2', () => {
    const gut = jpegGrau().bytes;
    expect(sanitizeImageBytes('image/jpeg', gut.slice(2))).toBeNull();
    expect(sanitizeImageBytes('image/jpeg', new Uint8Array(0))).toBeNull();
    const abgeschnitten = verkette([
      gut.subarray(0, 2),
      Uint8Array.from([0xff, 0xe1, 0x40, 0x00, 1, 2]),
    ]);
    expect(sanitizeImageBytes('image/jpeg', abgeschnitten)).toBeNull();
    const zuKurz = verkette([
      gut.subarray(0, 2),
      Uint8Array.from([0xff, 0xe1, 0x00, 0x01]),
      gut.subarray(2),
    ]);
    expect(sanitizeImageBytes('image/jpeg', zuKurz)).toBeNull();
    expect(sanitizeImageBytes('image/jpeg', ascii('FIKTIV-KEIN-BILD'))).toBeNull();
  });

  it('[R-10-01] (V18) falscher Medientyp: PNG als JPEG und JPEG als PNG → null', () => {
    expect(sanitizeImageBytes('image/jpeg', pngPalette().bytes)).toBeNull();
    expect(sanitizeImageBytes('image/png', jpegGrau().bytes)).toBeNull();
  });
});

describe('sanitizeImageBytes: Positivliste (Test-Review Runde 1 a, TR-E102c-01)', () => {
  it('[R-10-01] (TR-E102c-01) APP0 JFIF 0×0 mit angehängten Bytes (Segmentlänge > 16) entfällt samt Markierung', () => {
    const bild = jpegGrau({
      vorSof: [entfaellt(jfifMitAnhang('FIKTIV-JFIF-ANHANG-8001')), bleibt(adobeApp14())],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
  });

  it('[R-10-01] (TR-E102c-01) APP14 «Adobe» mit angehängten Bytes und APP14 ohne Adobe-Kennung entfallen', () => {
    for (const teil of [
      adobeMitAnhang('FIKTIV-ADOBE-ANHANG-8002'),
      app14Fremd('FIKTIV-APP14-8003'),
    ]) {
      const bild = jpegGrau({ vorSof: [bleibt(jfifOhneVorschau()), entfaellt(teil)] });
      expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.sauber);
    }
  });

  it('[R-10-01] (TR-E102c-01) Segmente JPGn (FFF0, FFF7, FFFD) entfallen, vor dem Bild und zwischen den Scans', () => {
    for (const marker of [0xf0, 0xf7, 0xfd]) {
      const vorne = jpegGrau({
        vorSof: [
          bleibt(jfifOhneVorschau()),
          entfaellt(jpgn(marker, `FIKTIV-JPGN-${String(marker)}-8004`)),
        ],
      });
      expect(sanitizeImageBytes('image/jpeg', vorne.bytes), `vorne ${String(marker)}`).toEqual(
        vorne.sauber,
      );
      const zwischen = jpegGrau({
        progressiv: true,
        zwischenScans: [entfaellt(jpgn(marker, `FIKTIV-JPGN-ZWISCHEN-${String(marker)}-8005`))],
      });
      expect(
        sanitizeImageBytes('image/jpeg', zwischen.bytes),
        `zwischen ${String(marker)}`,
      ).toEqual(zwischen.sauber);
    }
  });

  it('[R-10-01] (TR-E102c-01) Gegenfall: gültiges JFIF 0×0 (14 Datenbytes), gültige Adobe-Struktur (12 Datenbytes) und DRI bleiben byte-gleich', () => {
    const jfif = jfifOhneVorschau();
    const adobe = adobeApp14();
    expect([jfif[2], jfif[3]]).toEqual([0, 16]);
    expect([adobe[2], adobe[3]]).toEqual([0, 14]);
    const bild = jpegGrau({ vorSof: [bleibt(jfif), bleibt(adobe)] });
    expect(bild.sauber).toEqual(bild.bytes);
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(bild.bytes);
    const mitDri = jpegMitRestart();
    expect(sanitizeImageBytes('image/jpeg', mitDri.bytes)).toEqual(mitDri.sauber);
  });
});

describe('sanitizeImageBytes: PNG (V18)', () => {
  it('[R-10-01] (V18) PNG mit eXIf, iCCP, tEXt, zTXt, iTXt, tIME, gAMA, cHRM, sRGB und Bytes nach IEND ergibt nur IHDR, PLTE, tRNS, IDAT, IEND (byte-gleich mit CRC)', () => {
    const bild = pngPalette({
      metadaten: 'FIKTIV-PNG-3001',
      nachIend: [entfaellt(ascii('FIKTIV-NACH-IEND'))],
    });
    const aus = sanitizeImageBytes('image/png', bild.bytes);
    expect(aus).toEqual(bild.sauber);
    expect(pngBloecke(aus ?? new Uint8Array(0))).toEqual([
      'IHDR',
      'PLTE',
      'tRNS',
      'IDAT',
      'IDAT',
      'IEND',
    ]);
    expect(Array.from(aus?.subarray(0, 8) ?? [])).toEqual(Array.from(PNG_SIGNATUR));
  });

  it('[R-10-01] (V18) PNG ohne Zusatzblöcke bleibt byte-gleich', () => {
    const bild = pngPalette();
    expect(sanitizeImageBytes('image/png', bild.bytes)).toEqual(bild.bytes);
  });

  it('[R-10-01] (V18) PNG ohne IHDR, ohne IDAT, ohne IEND oder mit falscher Blocklänge → null', () => {
    for (const art of ['ohneIhdr', 'ohneIdat', 'ohneIend', 'laenge'] as const) {
      expect(sanitizeImageBytes('image/png', pngDefekt(art)), art).toBeNull();
    }
  });

  it('[R-10-01] (V18) falsche Signatur und jedes echte Anfangsstück eines gültigen PNG → null', () => {
    const gut = pngPalette({ metadaten: 'FIKTIV-PNG-3002' }).bytes;
    const falsch = gut.slice();
    falsch[1] = 0x51;
    expect(sanitizeImageBytes('image/png', falsch)).toBeNull();
    for (let l = 0; l < gut.length; l++) {
      expect(sanitizeImageBytes('image/png', gut.slice(0, l)), `Länge ${String(l)}`).toBeNull();
    }
  });
});

describe('sanitizeImageBytes: Kopie, Determinismus, wirft nie', () => {
  it('[R-10-01] (V03, V18) liefert eine neue Kopie mit byteOffset 0, auch für eine Teilansicht; die Eingabe bleibt unverändert', () => {
    for (const [mime, bild] of [
      [
        'image/jpeg',
        jpegGrau({ vorSof: [bleibt(jfifOhneVorschau()), entfaellt(kommentar('FIKTIV-K'))] }),
      ],
      ['image/png', pngPalette({ metadaten: 'FIKTIV-PNG-3003' })],
    ] as const) {
      const traeger = new Uint8Array(bild.bytes.length + 7);
      traeger.set(bild.bytes, 5);
      const ansicht = traeger.subarray(5, 5 + bild.bytes.length);
      const kopie = traeger.slice();
      const aus = sanitizeImageBytes(mime, ansicht);
      expect(aus).toEqual(bild.sauber);
      expect(aus?.byteOffset).toBe(0);
      expect(aus?.buffer).not.toBe(traeger.buffer);
      expect(traeger).toEqual(kopie);
    }
  });

  it('[R-10-01] (V03) auch ohne zu entfernende Teile ist das Ergebnis eine Kopie, nicht die Eingabe', () => {
    const bild = jpegGrau();
    const aus = sanitizeImageBytes('image/jpeg', bild.bytes);
    expect(aus).toEqual(bild.bytes);
    expect(aus).not.toBe(bild.bytes);
    expect(aus?.buffer).not.toBe(bild.bytes.buffer);
  });

  it('[R-10-01] (V03) deterministisch: zweimal dieselbe Eingabe ergibt dieselben Bytes', () => {
    const bild = jpegGrau({
      progressiv: true,
      zwischenScans: [entfaellt(kommentar('FIKTIV-DET'))],
      nachEoi: [entfaellt(ascii('FIKTIV-DET-ENDE'))],
    });
    expect(sanitizeImageBytes('image/jpeg', bild.bytes)).toEqual(
      sanitizeImageBytes('image/jpeg', bild.bytes.slice()),
    );
  });

  it('[R-10-01] (V03) wirft nie: 400 zufällige und verfälschte Eingaben (fester Startwert 4711) liefern null oder Bytes', () => {
    const zufall = lcg(4711);
    const vorlagen = [jpegGrau().bytes, jpegGrau({ progressiv: true }).bytes, pngPalette().bytes];
    for (let i = 0; i < 400; i++) {
      const vorlage = vorlagen[i % vorlagen.length] ?? new Uint8Array(0);
      const b = i % 2 === 0 ? vorlage.slice() : new Uint8Array(zufall() % 64);
      for (let k = 0; k < b.length; k++)
        if (i % 2 === 1 || zufall() % 7 === 0) b[k] = zufall() & 0xff;
      for (const mime of ['image/jpeg', 'image/png'] as const) {
        let aus: Uint8Array | null | undefined;
        expect(() => {
          aus = sanitizeImageBytes(mime, b);
        }).not.toThrow();
        expect(aus === null || aus instanceof Uint8Array).toBe(true);
      }
    }
  });

  it('[R-10-01] (V03) keine Konsolenausgabe', () => {
    const methoden = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spione = methoden.map((m) =>
      vi.spyOn(globalThis.console, m).mockImplementation(() => {}),
    );
    sanitizeImageBytes('image/jpeg', jpegGrau({ nachEoi: [entfaellt(ascii('FIKTIV-K2'))] }).bytes);
    sanitizeImageBytes('image/png', pngDefekt('laenge'));
    sanitizeImageBytes('image/jpeg', ascii('FIKTIV'));
    for (const s of spione) expect(s).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
// Paket E1-02c, Nachtrag Code-Review Runde 1 (CR-E102c-02; Orchestrator-Zeile 05.10.2026 (e) im Vertrag E1-02c;
// Datenschutz AGENTS.md): Behaltene JPEG-Segmente müssen ihre Strukturlänge genau einhalten – DQT
// Σ(1 + 64·(1 + Pq)), DHT Σ(17 + ΣLi), SOFn 6 + 3·Nf, SOS-Kopf 4 + 2·Ns, DRI 2 Datenbytes. Weicht die
// Segmentlänge ab, liefert sanitizeImageBytes null und der Schreiber invalidItem; fiktive Markierungen in
// überzähligen Bytes erreichen so kein PDF. Gegenfälle mit genauer Strukturlänge (auch mehrere Tabellen in einem
// Segment) bleiben gültig und byte-gleich. Fiktive Bilder, zur Laufzeit gebaut.
import { describe, expect, it } from 'vitest';
import { sanitizeImageBytes } from '../../../../src/io/wap-pdf/imageBytes';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import {
  ascii,
  EOI,
  jfifOhneVorschau,
  SOI,
  segment,
  verkette,
} from '../../pdf/writer/support/bilder';
import { latin1 } from '../../pdf/writer/support/roh';
import { ablehnung, pdfMitArtefakt } from '../../pdf/writer/support/schreiben';
import { bild, seite, text } from '../../pdf/writer/support/seiten';
import { readPdf } from '../../support/pdf/read';

/** Datenbytes einer Quantisierungstabelle: Pq/Tq-Byte und 64 Werte mit 8 bzw. 16 Bit (alle 1). */
function dqtTabelle(bits: 8 | 16, tq: number): number[] {
  const werte =
    bits === 8
      ? new Array<number>(64).fill(1)
      : new Array<number>(64).fill(0).flatMap(() => [0, 1]);
  return [(bits === 16 ? 0x10 : 0x00) | tq, ...werte];
}

/** Datenbytes einer Huffman-Tabelle (Klasse 0 = DC, 1 = AC): ein Code der Länge 1 für Symbol 0. */
function dhtTabelle(klasse: 0 | 1, th: number): number[] {
  return [(klasse << 4) | th, 1, ...new Array<number>(15).fill(0), 0x00];
}

/** Teile eines grauen 8 × 8-JPEG (dekodierbar); jedes Segment einzeln ersetzbar. */
interface Bauteile {
  dqt: Uint8Array;
  dht: Uint8Array;
  dri: Uint8Array | null;
  sof: Uint8Array;
  sos: Uint8Array;
}

function standard(): Bauteile {
  return {
    dqt: segment(0xdb, dqtTabelle(8, 0)),
    dht: segment(0xc4, [...dhtTabelle(0, 0), ...dhtTabelle(1, 0)]),
    dri: null,
    sof: segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]),
    sos: segment(0xda, [1, 1, 0x00, 0, 63, 0]),
  };
}

/** Baseline-JPEG aus den Teilen: SOI, APP0 JFIF, DQT, DHT, [DRI], SOF0, SOS, Scandaten, EOI. */
function jpeg(t: Bauteile): Uint8Array {
  return verkette([
    SOI,
    jfifOhneVorschau(),
    t.dqt,
    t.dht,
    ...(t.dri === null ? [] : [t.dri]),
    t.sof,
    t.sos,
    Uint8Array.of(0x3f),
    EOI,
  ]);
}

/** Progressives JPEG (SOF2, DC- und AC-Scan) mit ersetzbarem SOF2-Segment. */
function jpegProgressiv(sof2: Uint8Array): Uint8Array {
  return verkette([
    SOI,
    jfifOhneVorschau(),
    segment(0xdb, dqtTabelle(8, 0)),
    sof2,
    segment(0xc4, dhtTabelle(0, 0)),
    segment(0xda, [1, 1, 0x00, 0, 0, 0]),
    Uint8Array.of(0x7f),
    segment(0xc4, dhtTabelle(1, 0)),
    segment(0xda, [1, 1, 0x00, 1, 63, 0]),
    Uint8Array.of(0x7f),
    EOI,
  ]);
}

const RAHMEN = { x: 100, y: 100, w: 80, h: 80 };

async function invalidItem(bytes: Uint8Array, name: string): Promise<void> {
  const e = (await ablehnung(
    writePdf({
      pages: [seite([text(10, 10, 'fiktiv'), bild(RAHMEN, 'image/jpeg', bytes)])],
      title: 'Fiktiv',
    }),
  )) as PdfWriteError;
  expect(e, name).toBeInstanceOf(PdfWriteError);
  expect([e.code, e.pageIndex, e.itemIndex, e.character], name).toEqual([
    'invalidItem',
    0,
    1,
    null,
  ]);
}

/** Überzählige Bytes mit fiktiver Markierung je Segmentart (Datenbytes länger als die Struktur). */
function ueberlaenge(): [string, string, Uint8Array][] {
  const m = (art: string) => `FIKTIV-UEBERLAENGE-${art}-7101`;
  const s = standard();
  return [
    [
      'DQT 8 Bit',
      m('DQT8'),
      jpeg({ ...s, dqt: segment(0xdb, [...dqtTabelle(8, 0), ...ascii(m('DQT8'))]) }),
    ],
    [
      'DQT 16 Bit',
      m('DQT16'),
      jpeg({ ...s, dqt: segment(0xdb, [...dqtTabelle(16, 0), ...ascii(m('DQT16'))]) }),
    ],
    [
      'DHT',
      m('DHT'),
      jpeg({
        ...s,
        dht: segment(0xc4, [...dhtTabelle(0, 0), ...dhtTabelle(1, 0), ...ascii(m('DHT'))]),
      }),
    ],
    [
      'SOF0',
      m('SOF0'),
      jpeg({ ...s, sof: segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0, ...ascii(m('SOF0'))]) }),
    ],
    [
      'SOF2',
      m('SOF2'),
      jpegProgressiv(segment(0xc2, [8, 0, 8, 0, 8, 1, 1, 0x11, 0, ...ascii(m('SOF2'))])),
    ],
    [
      'SOS-Kopf',
      m('SOS'),
      jpeg({ ...s, sos: segment(0xda, [1, 1, 0x00, 0, 63, 0, ...ascii(m('SOS'))]) }),
    ],
    ['DRI', m('DRI'), jpeg({ ...s, dri: segment(0xdd, [0, 0, ...ascii(m('DRI'))]) })],
  ];
}

/** Zu kurze Segmente (Datenbytes kürzer als die Struktur). */
function unterlaenge(): [string, Uint8Array][] {
  const s = standard();
  return [
    ['DQT 8 Bit, 63 Werte', jpeg({ ...s, dqt: segment(0xdb, dqtTabelle(8, 0).slice(0, 64)) })],
    ['DHT ohne Symbol', jpeg({ ...s, dht: segment(0xc4, dhtTabelle(0, 0).slice(0, 17)) })],
    ['DRI mit 1 Byte', jpeg({ ...s, dri: segment(0xdd, [0]) })],
    // TR-E102c-11: SOF0 mit Nf = 1, aber ohne die 3 Komponentenbytes (6 statt 9 Datenbytes).
    ['SOF0 ohne Komponente', jpeg({ ...s, sof: segment(0xc0, [8, 0, 8, 0, 8, 1]) })],
    // TR-E102c-11: SOS-Kopf mit Ns = 1, aber nur 4 statt 6 Datenbytes.
    ['SOS-Kopf mit 4 Bytes', jpeg({ ...s, sos: segment(0xda, [1, 1, 0x00, 0]) })],
  ];
}

/** Gültige Strukturlängen, auch mehrere Tabellen in einem Segment. */
function gueltig(): [string, Uint8Array][] {
  const s = standard();
  return [
    ['Standard', jpeg(s)],
    [
      'DQT zwei 8-Bit-Tabellen',
      jpeg({ ...s, dqt: segment(0xdb, [...dqtTabelle(8, 0), ...dqtTabelle(8, 1)]) }),
    ],
    ['DQT 16 Bit', jpeg({ ...s, dqt: segment(0xdb, dqtTabelle(16, 0)) })],
    [
      'DQT 8 und 16 Bit',
      jpeg({ ...s, dqt: segment(0xdb, [...dqtTabelle(8, 0), ...dqtTabelle(16, 1)]) }),
    ],
    [
      'DHT vier Tabellen',
      jpeg({
        ...s,
        dht: segment(0xc4, [
          ...dhtTabelle(0, 0),
          ...dhtTabelle(1, 0),
          ...dhtTabelle(0, 1),
          ...dhtTabelle(1, 1),
        ]),
      }),
    ],
    ['DRI', jpeg({ ...s, dri: segment(0xdd, [0, 0]) })],
    ['progressiv', jpegProgressiv(segment(0xc2, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]))],
  ];
}

describe('sanitizeImageBytes: Strukturlänge behaltener Segmente (Orchestrator-Zeile e, CR-E102c-02)', () => {
  it('[R-10-01] (CR-E102c-02) überzählige Bytes mit Markierung in DQT (8/16 Bit), DHT, SOF0, SOF2, SOS-Kopf und DRI → null', () => {
    for (const [name, , bytes] of ueberlaenge()) {
      expect(sanitizeImageBytes('image/jpeg', bytes), name).toBeNull();
    }
  });

  it('[R-10-01] (CR-E102c-02, TR-E102c-11) zu kurze Segmente (DQT, DHT, DRI, SOF0, SOS-Kopf) → null', () => {
    for (const [name, bytes] of unterlaenge()) {
      expect(sanitizeImageBytes('image/jpeg', bytes), name).toBeNull();
    }
  });

  it('[R-10-01] (CR-E102c-02) Gegenfall: genaue Strukturlängen, auch mehrere Tabellen in einem Segment, bleiben gültig und byte-gleich', () => {
    for (const [name, bytes] of gueltig()) {
      expect(sanitizeImageBytes('image/jpeg', bytes), name).toEqual(bytes);
    }
  });
});

describe('writePdf: Strukturlänge behaltener JPEG-Segmente (Orchestrator-Zeile e, CR-E102c-02)', () => {
  it('[R-10-01] (CR-E102c-02) überzählige Bytes je Segmentart → invalidItem mit Fundstelle; kein PDF mit der Markierung', async () => {
    for (const [name, , bytes] of ueberlaenge()) {
      await invalidItem(bytes, name);
    }
  });

  it('[R-10-01] (CR-E102c-02, TR-E102c-11) zu kurze Segmente (DQT, DHT, DRI, SOF0, SOS-Kopf) → invalidItem', async () => {
    for (const [name, bytes] of unterlaenge()) {
      await invalidItem(bytes, name);
    }
  });

  it('[R-10-01] (CR-E102c-02) Gegenfall: gültige Strukturlängen ergeben ein PDF mit dem Bild, JPEG-Bytes unverändert eingebettet', async () => {
    const faelle = gueltig();
    const pdf = await pdfMitArtefakt('jpeg-strukturlaenge', [
      seite(
        faelle.map(([, bytes], i) =>
          bild({ x: 20 + i * 60, y: 50, w: 50, h: 50 }, 'image/jpeg', bytes),
        ),
      ),
    ]);
    expect((await readPdf(pdf)).images).toBe(faelle.length);
    const roh = latin1(pdf);
    for (const [name, bytes] of faelle) expect(roh.includes(latin1(bytes)), name).toBe(true);
  });
});

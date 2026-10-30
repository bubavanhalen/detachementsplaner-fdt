// @vitest-environment node
// H-DATEN (Härtung vor Gate B): beschädigte oder übergrosse Personenliste (.xlsx) → Meldung «invalidFile» ohne
// unbehandelte Ablehnung und ohne unbegrenztes Entpacken (CR-H-D-08). Beschrieb 5.7; R-5.7-04. Fiktive Dateien.
// F-FLAKY (FL-02): Die übergrosse Mappe entsteht ohne 60-MiB-Zeichenkette und ohne Deflate in JavaScript: Das Blatt
// wird in Stücken von 1 MiB durch den Deflate-Strom von node:zlib geschrieben (gleicher entpackter Inhalt wie
// vorher). Vorher kostete allein der Bau rund 1 s Rechenzeit und 120 MB Speicher und überschritt unter Rechnerlast
// die Vorgabe von 5 s; das Lesen selbst bricht nach 50 MB ab und dauert wenige Millisekunden.
import { crc32, createDeflateRaw } from 'node:zlib';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPersonFile } from '../../../../src/io/wap-persons/index';

/** ZIP mit genau einem Teil, Daten unverändert mit der angegebenen Methode (0 gespeichert, 8 Deflate). */
function zipWith(name: string, method: number, data: Uint8Array): Uint8Array {
  const n = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + n.length + data.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, method, true);
  lv.setUint32(18, data.length, true);
  lv.setUint16(26, n.length, true);
  local.set(n, 30);
  local.set(data, 30 + n.length);
  const cd = new Uint8Array(46 + n.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, method, true);
  cv.setUint32(20, data.length, true);
  cv.setUint16(28, n.length, true);
  cv.setUint32(42, 0, true);
  cd.set(n, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + cd.length + 22);
  out.set(local, 0);
  out.set(cd, local.length);
  out.set(end, local.length + cd.length);
  return out;
}

const enc = new TextEncoder();
const cell = (ref: string, t: string) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;
const WORKBOOK =
  '<workbook xmlns:r="r"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>';
const RELS =
  '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
const SHEET_KOPF =
  `<worksheet><sheetData><row r="1">${cell('A1', 'Grad')}${cell('B1', 'Name')}${cell('C1', 'Vorname')}${cell('D1', 'Funktion')}</row>` +
  `<row r="2">${cell('A2', 'Hptm')}${cell('B2', 'Muster')}${cell('C2', 'Fiktiv')}${cell('D2', 'Kp Kdt')}</row>`;
const SHEET_ENDE = '</sheetData></worksheet>';

/** Kleine fiktive Arbeitsmappe mit einer Person; `padding` (Leerraum) vergrössert das Blatt entpackt. */
function book(padding: string): Uint8Array {
  return zipSync({
    'xl/workbook.xml': enc.encode(WORKBOOK),
    'xl/_rels/workbook.xml.rels': enc.encode(RELS),
    'xl/worksheets/sheet1.xml': enc.encode(`${SHEET_KOPF}${padding}${SHEET_ENDE}`),
  });
}

/** Deflate (roh) der aneinandergereihten Stücke über den Strom von node:zlib. */
async function deflateStuecke(stuecke: readonly Uint8Array[]): Promise<Uint8Array> {
  const strom = createDeflateRaw({ level: 1 });
  const aus: Buffer[] = [];
  strom.on('data', (c: Buffer) => {
    aus.push(c);
  });
  const fertig = new Promise<void>((ok, fehler) => {
    strom.on('end', ok);
    strom.on('error', fehler);
  });
  for (const s of stuecke) {
    if (!strom.write(s)) await new Promise<void>((ok) => strom.once('drain', () => ok()));
  }
  strom.end();
  await fertig;
  return new Uint8Array(Buffer.concat(aus));
}

/**
 * Dieselbe Arbeitsmappe wie `book(' '.repeat(paddingMiB · 1 MiB))`, als gültiges ZIP (Deflate, CRC-32 und Grössen
 * gesetzt), ohne den Leerraum als Ganzes anzulegen.
 */
async function grosseMappe(paddingMiB: number): Promise<Uint8Array> {
  const mib = new Uint8Array(1024 * 1024).fill(0x20);
  const teile: { name: string; stuecke: Uint8Array[] }[] = [
    { name: 'xl/workbook.xml', stuecke: [enc.encode(WORKBOOK)] },
    { name: 'xl/_rels/workbook.xml.rels', stuecke: [enc.encode(RELS)] },
    {
      name: 'xl/worksheets/sheet1.xml',
      stuecke: [
        enc.encode(SHEET_KOPF),
        ...Array.from({ length: paddingMiB }, () => mib),
        enc.encode(SHEET_ENDE),
      ],
    },
  ];
  const lokal: Uint8Array[] = [];
  const zentral: Uint8Array[] = [];
  let offset = 0;
  for (const t of teile) {
    const name = enc.encode(t.name);
    const daten = await deflateStuecke(t.stuecke);
    let crc = 0;
    let groesse = 0;
    for (const s of t.stuecke) {
      crc = crc32(s, crc);
      groesse += s.length;
    }
    const kopf = new Uint8Array(30 + name.length);
    const kv = new DataView(kopf.buffer);
    kv.setUint32(0, 0x04034b50, true);
    kv.setUint16(4, 20, true);
    kv.setUint16(8, 8, true);
    kv.setUint32(14, crc, true);
    kv.setUint32(18, daten.length, true);
    kv.setUint32(22, groesse, true);
    kv.setUint16(26, name.length, true);
    kopf.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, daten.length, true);
    cv.setUint32(24, groesse, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    lokal.push(kopf, daten);
    zentral.push(cd);
    offset += kopf.length + daten.length;
  }
  const cdLaenge = zentral.reduce((n, c) => n + c.length, 0);
  const ende = new Uint8Array(22);
  const ev = new DataView(ende.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, teile.length, true);
  ev.setUint16(10, teile.length, true);
  ev.setUint32(12, cdLaenge, true);
  ev.setUint32(16, offset, true);
  return new Uint8Array(Buffer.concat([...lokal, ...zentral, ende]));
}

describe('CR-H-D-08: Personenliste mit beschädigtem oder übergrossem Inhalt', () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  beforeEach(() => {
    rejections.length = 0;
    process.on('unhandledRejection', onRejection);
  });
  afterEach(() => {
    process.off('unhandledRejection', onRejection);
  });

  it('[R-5.7-04] beschädigter Deflate-Strom: Meldung «invalidFile», keine unbehandelte Ablehnung', async () => {
    const bad = zipWith('xl/workbook.xml', 8, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x13]));
    await expect(readPersonFile(bad, 'fiktiv.xlsx')).rejects.toMatchObject({ code: 'invalidFile' });
    await new Promise((r) => setTimeout(r, 50));
    expect(rejections).toEqual([]);
  });

  // F-FLAKY (FL-01, FL-02): keine Zeitanforderung; rund 0,3 s, unter künstlicher Rechnerlast (60 Lastthreads) über
  // 5 s gemessen – Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-5.7-04] Blatt, das entpackt grösser als 50 MB wäre: Meldung «invalidFile» statt Lesen', async () => {
    // Gegenprobe zum Bau: dieselbe Mappe mit 1 MiB Leerraum wird gelesen; so liegt «invalidFile» an der Grösse.
    const klein = await readPersonFile(await grosseMappe(1), 'fiktiv.xlsx');
    expect(klein.persons.length).toBe(1);
    const bytes = await grosseMappe(60);
    await expect(readPersonFile(bytes, 'fiktiv.xlsx')).rejects.toMatchObject({
      code: 'invalidFile',
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(rejections).toEqual([]);
  }, 120_000);

  it('[R-5.7-04] gültige kleine Arbeitsmappe wird weiterhin gelesen (keine Fehlmeldung durch die Grenze)', async () => {
    const r = await readPersonFile(book(''), 'fiktiv.xlsx');
    expect(r.persons.length).toBe(1);
  });
});

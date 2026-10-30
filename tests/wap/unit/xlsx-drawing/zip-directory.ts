// Testhilfe für die Ressourcengrenzen des Lesemoduls (Vertrag E1-07, Änderungsnotiz Code-Review
// Runde 1; Hinweisnotiz in E1-08.md «Fixtures»). Sie liest und setzt die Angaben eines Eintrags im
// ZIP-Zentralverzeichnis (Signatur 50 4B 01 02): `size` (komprimiert, Offset 20) und
// `originalSize` (entpackt, Offset 24). So lassen sich grosse Teile *angeben*, ohne grosse Puffer
// zu erzeugen. Arbeitet nur mit fiktiven, im Test erzeugten Arbeitsmappen; gibt nie Inhalte aus.
import { unzipSync, type Zippable, zipSync } from 'fflate';

const SIG_CENTRAL = 0x02014b50; // 50 4B 01 02
const SIG_LOCAL = 0x04034b50; // 50 4B 03 04
const SIG_END = 0x06054b50; // 50 4B 05 06
/** 0xFFFFFFFF kennzeichnet ZIP64; die Hilfe setzt nur kleinere Werte. */
const MAX_PLAIN = 0xfffffffe;

export interface CentralEntry {
  readonly name: string;
  /** Byte-Offset des Eintrags im Zentralverzeichnis. */
  readonly at: number;
  /** Kompressionsmethode (0 gespeichert, 8 deflate). */
  readonly method: number;
  /** Komprimierte Grösse laut Zentralverzeichnis. */
  readonly size: number;
  /** Entpackte Grösse laut Zentralverzeichnis. */
  readonly originalSize: number;
  /** Offset des lokalen Kopfs. */
  readonly localOffset: number;
}

const view = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function endRecord(bytes: Uint8Array): number {
  const dv = view(bytes);
  for (let e = bytes.length - 22; e >= 0; e--) if (dv.getUint32(e, true) === SIG_END) return e;
  throw new Error('Testhilfe: kein Ende des Zentralverzeichnisses gefunden');
}

/** Alle Einträge des Zentralverzeichnisses in Dateireihenfolge. */
export function centralEntries(bytes: Uint8Array): CentralEntry[] {
  const dv = view(bytes);
  const end = endRecord(bytes);
  const count = dv.getUint16(end + 10, true);
  let at = dv.getUint32(end + 16, true);
  const out: CentralEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(at, true) !== SIG_CENTRAL)
      throw new Error('Testhilfe: Signatur 50 4B 01 02 fehlt');
    const nameLength = dv.getUint16(at + 28, true);
    const extraLength = dv.getUint16(at + 30, true);
    const commentLength = dv.getUint16(at + 32, true);
    out.push({
      name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      at,
      method: dv.getUint16(at + 10, true),
      size: dv.getUint32(at + 20, true),
      originalSize: dv.getUint32(at + 24, true),
      localOffset: dv.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

export function entryOf(bytes: Uint8Array, name: string): CentralEntry {
  const entry = centralEntries(bytes).find((e) => e.name === name);
  if (!entry) throw new Error('Testhilfe: Teil fehlt im Fixture');
  return entry;
}

/** Grösse eines Teils nach Vertrag: max(size, originalSize) aus dem Zentralverzeichnis. */
export const declaredSize = (entry: CentralEntry): number =>
  Math.max(entry.size, entry.originalSize);

/**
 * Kopie der Datei, in der beim Teil `name` die Angaben im Zentralverzeichnis ersetzt sind.
 * Die Daten und der lokale Kopf bleiben unverändert.
 */
export function withDeclaredSizes(
  bytes: Uint8Array,
  name: string,
  sizes: { readonly size?: number; readonly originalSize?: number },
): Uint8Array {
  const out = bytes.slice();
  const entry = entryOf(out, name);
  const dv = view(out);
  for (const value of [sizes.size, sizes.originalSize])
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > MAX_PLAIN))
      throw new Error('Testhilfe: Grösse ausserhalb 0 … 0xFFFFFFFE');
  if (sizes.size !== undefined) dv.setUint32(entry.at + 20, sizes.size, true);
  if (sizes.originalSize !== undefined) dv.setUint32(entry.at + 24, sizes.originalSize, true);
  return out;
}

/**
 * Kopie der Datei, in der die komprimierten Daten des Teils `name` durch 0xFF ersetzt sind
 * (deflate: Blocktyp 3 ist ungültig, Entpacken scheitert). Längen bleiben gleich.
 */
export function withBrokenDeflate(bytes: Uint8Array, name: string): Uint8Array {
  const out = bytes.slice();
  const entry = entryOf(out, name);
  if (entry.method !== 8) throw new Error('Testhilfe: Teil ist nicht deflate-komprimiert');
  const dv = view(out);
  if (dv.getUint32(entry.localOffset, true) !== SIG_LOCAL)
    throw new Error('Testhilfe: lokaler Kopf fehlt');
  const start =
    entry.localOffset +
    30 +
    dv.getUint16(entry.localOffset + 26, true) +
    dv.getUint16(entry.localOffset + 28, true);
  out.fill(0xff, start, start + entry.size);
  return out;
}

/**
 * Kopie der Datei mit genau `total` Einträgen im Zentralverzeichnis: Die vorhandenen Teile bleiben
 * (deflate), dazu kommen leere, ungebrauchte Füllteile `xl/media/leer<n>.bin` (gespeichert, schnell).
 */
export function withEntryCount(bytes: Uint8Array, total: number): Uint8Array {
  const parts = unzipSync(bytes);
  const files: Zippable = {};
  for (const [name, data] of Object.entries(parts)) files[name] = [data, { level: 6 }];
  const fill = total - Object.keys(parts).length;
  if (fill < 0) throw new Error('Testhilfe: Fixture hat schon mehr Einträge');
  for (let i = 0; i < fill; i++) files[`xl/media/leer${i}.bin`] = [new Uint8Array(), { level: 0 }];
  return zipSync(files, { mtime: new Date(Date.UTC(2030, 0, 7, 12)) });
}

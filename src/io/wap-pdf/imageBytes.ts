// Bereinigung von Rasterbildern vor dem Zeichnen (Vertrag E1-02c, Änderungsnotiz Vertragsprüfung Runde 2:
// V17, V18, V19; Orchestrator-Zeilen 05.10.2026 (a) Positivliste und (d) arithmetische Codierung; Datenschutz
// AGENTS.md). Rein und deterministisch; PDF-Schreiber und Bildschirm-Zeichner zeichnen dieselben bereinigten
// Bytes, damit Bildschirm und PDF gleich aussehen (Leitplanke 2).

/** Ein Abschnitt [start, ende) der Eingabe, der in die Ausgabe übernommen wird. */
type Abschnitt = readonly [number, number];

/** Neue Kopie (byteOffset 0) aus den übernommenen Abschnitten. */
function verkette(bytes: Uint8Array, abschnitte: readonly Abschnitt[]): Uint8Array {
  let laenge = 0;
  for (const [a, e] of abschnitte) laenge += e - a;
  const aus = new Uint8Array(laenge);
  let o = 0;
  for (const [a, e] of abschnitte) {
    aus.set(bytes.subarray(a, e), o);
    o += e - a;
  }
  return aus;
}

/** Stimmen die Bytes ab `pos` mit `muster` überein? */
function beginntMit(bytes: Uint8Array, pos: number, muster: readonly number[]): boolean {
  return muster.every((b, i) => bytes[pos + i] === b);
}

// ---------------------------------------------------------------- JPEG

const JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00];
const ADOBE = [0x41, 0x64, 0x6f, 0x62, 0x65];

/** Marker mit Längenfeld, die nach der Positivliste immer bleiben: DQT, DHT, DRI. */
const BLEIBEN = new Set([0xdb, 0xc4, 0xdd]);

/** SOFn mit Huffman-Codierung (C0–C3, C5–C7); C4 ist DHT, C8 reserviert, C9–CF arithmetisch. */
function istSofHuffman(m: number): boolean {
  return (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7);
}

/** Marker, mit denen die Segmentfolge nicht lesbar bzw. nicht unterstützt ist. */
function istUnzulaessig(m: number): boolean {
  // Ohne Längenfeld (00, TEM, RSTn ausserhalb eines Scans, zweites SOI) oder arithmetische Codierung
  // (SOF C9–CF und DAC CC, Orchestrator-Zeile d).
  return m === 0x00 || m === 0x01 || (m >= 0xd0 && m <= 0xd8) || (m >= 0xc9 && m <= 0xcf);
}

/**
 * Datenbytes, die die Struktur eines behaltenen Segments verlangt (Orchestrator-Zeile e, CR-E102c-02):
 * DQT Σ(1 + 64·(1 + Pq)) mit Pq 0 oder 1, DHT Σ(17 + ΣLi), SOFn 6 + 3·Nf, SOS-Kopf 4 + 2·Ns, DRI 2. Für
 * andere Marker `null` (keine Vorgabe); eine DQT-Tabelle mit Pq > 1 ergibt -1.
 */
function strukturLaenge(bytes: Uint8Array, m: number, daten: number, l: number): number | null {
  const b = (k: number) => bytes[daten + k] ?? 0;
  if (m === 0xdd) return 2;
  if (m === 0xda) return 4 + 2 * b(0);
  if (istSofHuffman(m)) return 6 + 3 * b(5);
  if (m !== 0xdb && m !== 0xc4) return null;
  let o = 0;
  while (o < l) {
    if (m === 0xdb) {
      const pq = b(o) >> 4;
      if (pq > 1) return -1;
      o += 1 + 64 * (1 + pq);
    } else {
      let symbole = 0;
      for (let i = 1; i <= 16; i++) symbole += b(o + i);
      o += 17 + symbole;
    }
  }
  return o;
}

/** Bleibt das Segment mit Marker `m`, Daten ab `daten` und `l` Datenbytes? */
function segmentBleibt(bytes: Uint8Array, m: number, daten: number, l: number): boolean {
  if (BLEIBEN.has(m) || istSofHuffman(m)) return true;
  // APP0 nur als JFIF mit genau 14 Datenbytes und Vorschaubild 0 × 0 (V19, Positivliste a).
  if (m === 0xe0) {
    return (
      l === 14 &&
      beginntMit(bytes, daten, JFIF) &&
      bytes[daten + 12] === 0 &&
      bytes[daten + 13] === 0
    );
  }
  // APP14 nur als genau die 12-Byte-Struktur «Adobe» (Positivliste a).
  return m === 0xee && l === 12 && beginntMit(bytes, daten, ADOBE);
}

/**
 * Ende der Scandaten ab `pos`: Stelle des ersten 0xFF, das weder Füllbyte (FF 00) noch Restart-Marker
 * (FF D0–D7) einleitet; -1, wenn die Daten vorher enden.
 */
function scanEnde(bytes: Uint8Array, pos: number): number {
  let j = pos;
  while (j < bytes.length) {
    if (bytes[j] !== 0xff) {
      j += 1;
      continue;
    }
    const n = bytes[j + 1];
    if (n === undefined) return -1;
    if (n !== 0x00 && (n < 0xd0 || n > 0xd7)) return j;
    j += 2;
  }
  return -1;
}

/**
 * JPEG nach der Positivliste: SOI, DQT, DHT, DRI, SOFn (Huffman), SOS samt Scandaten mit RSTn, EOI; APP0 nur
 * als JFIF ohne Vorschaubild, APP14 nur als Adobe-Struktur; alles andere entfällt. Endet mit dem ersten EOI
 * nach einem Scan. `null` bei nicht lesbarer Segmentfolge, ohne EOI und bei arithmetischer Codierung.
 */
function jpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const teile: Abschnitt[] = [[0, 2]];
  let pos = 2;
  let sof = false;
  let scans = 0;
  for (;;) {
    if (bytes[pos] !== 0xff) return null;
    // Füllbytes 0xFF vor einem Marker entfallen.
    while (bytes[pos + 1] === 0xff) pos += 1;
    const m = bytes[pos + 1];
    if (m === undefined || istUnzulaessig(m)) return null;
    if (m === 0xd9) {
      if (scans === 0) return null;
      teile.push([pos, pos + 2]);
      return verkette(bytes, teile);
    }
    const laenge = ((bytes[pos + 2] ?? 0) << 8) | (bytes[pos + 3] ?? 0);
    const ende = pos + 2 + laenge;
    if (laenge < 2 || ende > bytes.length) return null;
    // Behaltene Segmente müssen ihre Strukturlänge genau einhalten; sonst blieben überzählige Bytes im PDF.
    const soll = strukturLaenge(bytes, m, pos + 4, laenge - 2);
    if (soll !== null && soll !== laenge - 2) return null;
    if (m === 0xda) {
      const scan = sof ? scanEnde(bytes, ende) : -1;
      if (scan < 0) return null;
      teile.push([pos, scan]);
      scans += 1;
      pos = scan;
      continue;
    }
    if (istSofHuffman(m)) sof = true;
    if (segmentBleibt(bytes, m, pos + 4, laenge - 2)) teile.push([pos, ende]);
    pos = ende;
  }
}

// ---------------------------------------------------------------- PNG

const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Blöcke, die bleiben (V18): Bildkopf, Palette, Transparenz, Bilddaten, Ende. */
const PNG_BLEIBEN = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

/** Vorzeichenlose 32-Bit-Zahl (big endian) ab `pos`; der Aufrufer stellt sicher, dass 4 Bytes da sind. */
function u32(bytes: Uint8Array, pos: number): number {
  const b = (k: number) => bytes[pos + k] as number;
  return ((b(0) << 24) | (b(1) << 16) | (b(2) << 8) | b(3)) >>> 0;
}

/**
 * PNG mit Signatur und nur IHDR, PLTE, tRNS, IDAT, IEND (byte-gleich mit CRC, in ihrer Reihenfolge); Bytes
 * nach IEND entfallen. `null` ohne Signatur, wenn IHDR nicht der erste Block ist, ohne IDAT oder IEND und bei
 * einer Blocklänge über das Ende hinaus.
 */
function png(bytes: Uint8Array): Uint8Array | null {
  if (!beginntMit(bytes, 0, PNG_SIGNATUR)) return null;
  const teile: Abschnitt[] = [[0, 8]];
  let pos = 8;
  let idat = false;
  for (;;) {
    if (pos + 12 > bytes.length) return null;
    const ende = pos + 12 + u32(bytes, pos);
    if (ende > bytes.length) return null;
    const typ = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (pos === 8 && typ !== 'IHDR') return null;
    if (PNG_BLEIBEN.has(typ)) teile.push([pos, ende]);
    idat ||= typ === 'IDAT';
    if (typ === 'IEND') return idat ? verkette(bytes, teile) : null;
    pos = ende;
  }
}

/**
 * Liefert eine neue Kopie (byteOffset 0) ohne Metadaten oder `null`, wenn die Struktur nicht lesbar ist.
 * - JPEG (Positivliste, Orchestrator-Zeile 05.10.2026 a): SOI, DQT, DHT, DRI, SOFn, SOS samt Scandaten, RSTn
 *   und EOI; APP0 nur als JFIF mit 14 Datenbytes und Vorschaubild 0 × 0 (V19), APP14 nur als 12-Byte-Struktur
 *   «Adobe»; alle übrigen Segmente (APPn, COM, JPGn, FFF0–FFFD, unbekannte) entfallen, auch zwischen Scans;
 *   endet mit dem ersten EOI nach dem letzten Scan, folgende Bytes entfallen (V17); ohne EOI, bei unlesbarer
 *   Segmentfolge und bei arithmetischer Codierung (SOF C9–CF, Zeile d) → `null`.
 * - PNG: Signatur und nur die Blöcke IHDR, PLTE, tRNS, IDAT, IEND in ihrer Reihenfolge (byte-gleich mit CRC);
 *   Bytes nach IEND entfallen; ohne IHDR, IDAT oder IEND bzw. mit falscher Blocklänge → `null` (V18).
 * Wirft nie; keine Konsolenausgabe.
 */
export function sanitizeImageBytes(
  mime: 'image/png' | 'image/jpeg',
  bytes: Uint8Array,
): Uint8Array | null {
  if (mime === 'image/jpeg') return jpeg(bytes);
  if (mime === 'image/png') return png(bytes);
  return null;
}

// Wappen lesen: Base64 mit eigener Dekodierung, Pixelmasse aus PNG-IHDR bzw. JPEG-SOFn (Vertrag E1-02e, Notiz «Ausarbeitung
// Schritt 2» Abschnitt E4 «Wappen», G1, V07, V26; V-02e-12). Intern: nicht über page/index.ts exportiert.
// Rein (R-L-02): eigene Dekodierung ohne Laufzeit-Hilfen des Browsers oder von Node.

import type { ImageAsset } from '../../types';

export interface CoatOfArms {
  readonly mime: 'image/png' | 'image/jpeg';
  readonly bytes: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const WERT: ReadonlyMap<string, number> = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Base64 (Standardalphabet, Auffüllung mit «=»; Leerraum wird übergangen) → Bytes; null bei ungültiger Form. */
export function decodeBase64(text: string): Uint8Array | null {
  const s = text.replace(/[ \t\r\n]/g, '');
  if (s.length % 4 !== 0) return null;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const body = s.slice(0, s.length - pad);
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let bits = 0;
  let n = 0;
  let o = 0;
  for (const c of body) {
    const v = WERT.get(c);
    if (v === undefined) return null;
    bits = (bits << 6) | v;
    n += 6;
    if (n >= 8) {
      n -= 8;
      out[o++] = (bits >> n) & 0xff;
      bits &= (1 << n) - 1;
    }
  }
  // Nicht verwendete Bits der letzten Gruppe müssen 0 sein (kanonische Form).
  if (bits !== 0) return null;
  return o === out.length ? out : null;
}

function u16(b: Uint8Array, p: number): number {
  return ((b[p] ?? 0) << 8) | (b[p + 1] ?? 0);
}

function u32(b: Uint8Array, p: number): number {
  return (
    (((b[p] ?? 0) << 24) | ((b[p + 1] ?? 0) << 16) | ((b[p + 2] ?? 0) << 8) | (b[p + 3] ?? 0)) >>> 0
  );
}

const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG mit gültigem IHDR als erstem Block (Länge 13, Breite und Höhe > 0). */
function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 8 + 8 + 13 || !PNG_SIGNATUR.every((v, i) => b[i] === v)) return null;
  const typ = String.fromCharCode(b[12] ?? 0, b[13] ?? 0, b[14] ?? 0, b[15] ?? 0);
  if (u32(b, 8) !== 13 || typ !== 'IHDR') return null;
  const w = u32(b, 16);
  const h = u32(b, 20);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** SOFn-Marker: C0–CF ohne DHT (C4), JPG (C8) und DAC (CC). */
function istSof(m: number): boolean {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
}

/** Lesbar sind nur SOFn mit Huffman-Codierung C0–C3 und C5–C7 (V07). */
function istLesbarerSof(m: number): boolean {
  return (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7);
}

/** JPEG mit SOI und erstem SOFn aus C0–C3 oder C5–C7; Pixelmasse aus dem SOFn. */
function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let pos = 2;
  for (;;) {
    if (b[pos] !== 0xff) return null;
    while (b[pos + 1] === 0xff) pos += 1;
    const m = b[pos + 1];
    if (m === undefined || m === 0xd9 || m === 0xda) return null;
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      pos += 2;
      continue;
    }
    const len = u16(b, pos + 2);
    if (len < 2 || pos + 2 + len > b.length) return null;
    if (istSof(m)) {
      if (!istLesbarerSof(m) || len < 7) return null;
      const h = u16(b, pos + 5);
      const w = u16(b, pos + 7);
      return w > 0 && h > 0 ? { w, h } : null;
    }
    pos += 2 + len;
  }
}

/** Wappen des Plans oder null, wenn es nicht lesbar ist (Warnung invalidImage beim Aufrufer). */
export function readCoatOfArms(asset: ImageAsset): CoatOfArms | null {
  const bytes = decodeBase64(asset.dataBase64);
  if (bytes === null || bytes.length === 0) return null;
  const size = asset.mime === 'image/png' ? pngSize(bytes) : jpegSize(bytes);
  if (size === null) return null;
  return { mime: asset.mime, bytes, widthPx: size.w, heightPx: size.h };
}

// Typen der genutzten Schnittstelle von `fontkit` 2.0.4 (bringt keine Typen mit; Vertrag E1-02c Abschnitt 2.2,
// Präzisierung P-4). Nur, was PDF-Schreiber und Adapter nutzen; pdf-lib greift über den Adapter auf das
// vollständige Schriftobjekt zu.
declare module 'fontkit' {
  export interface FontkitGlyph {
    readonly id: number;
    readonly advanceWidth: number;
    readonly codePoints: readonly number[];
  }

  /** Teilmenge (TTFSubset): `encode()` liefert die Bytes; `encodeStream()` gibt es in fontkit 2 nicht. */
  export interface FontkitSubset {
    includeGlyph(glyph: number | FontkitGlyph): number;
    encode(): Uint8Array;
  }

  export interface FontkitFont {
    readonly postscriptName: string;
    readonly unitsPerEm: number;
    readonly characterSet: readonly number[];
    glyphForCodePoint(codePoint: number): FontkitGlyph;
    layout(text: string, features?: unknown): { readonly glyphs: readonly FontkitGlyph[] };
    createSubset(): FontkitSubset;
  }

  /** Liest eine Schriftdatei (TTF); wirft bei unlesbaren Bytes. */
  export function create(buffer: Uint8Array, postscriptName?: string): FontkitFont;
}

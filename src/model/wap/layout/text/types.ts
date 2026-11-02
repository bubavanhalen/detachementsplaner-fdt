/**
 * Typen der Textschicht des WAP-Planers (Vertrag E1-02b, ADR-003, ADR-004).
 * Rein, ohne DOM; `src/assets/wap-fonts/` importiert daraus nur Typen (AR0-11).
 */

/** Schnitt der Schrift Arimo; Beschrieb 10 kennt nur fett und normal. */
export type FontWeight = 'regular' | 'bold';

/** Name der Schrift am Bildschirm (`new FontFace(FONT_FAMILY_SCREEN, bytes)`, Vertrag E1-02c). */
export const FONT_FAMILY_SCREEN = 'WAP Arimo';

/** Ein Textlauf mit einheitlichem Schnitt. */
export interface StyledRun {
  readonly text: string;
  readonly weight: FontWeight;
}

/**
 * Inhalt von `metrics.generated.ts` (erzeugt von `tools/wap/gen-font-metrics.mjs`).
 * Alle Werte in Font-Einheiten; vertikale Werte aus der Tabelle `hhea`, für beide Schnitte gleich.
 */
export interface GeneratedFontMetrics {
  readonly unitsPerEm: number;
  /** hhea.ascender (positiv). */
  readonly ascender: number;
  /** hhea.descender (negativ). */
  readonly descender: number;
  /** hhea.lineGap. */
  readonly lineGap: number;
  /** SHA-256 (hex, Kleinbuchstaben) der Quelldateien `Arimo-Regular.ttf` und `Arimo-Bold.ttf`. */
  readonly sourceSha256: { readonly [W in FontWeight]: string };
  /** Vorschub der Glyphe 0 (.notdef) je Schnitt. */
  readonly notdefAdvance: { readonly [W in FontWeight]: number };
  /**
   * Je Schnitt flache Paarliste `[codePoint0, advance0, codePoint1, advance1, …]`,
   * aufsteigend nach Codepunkt, genau die Codepunkte der cmap (fontkit `characterSet`).
   */
  readonly advances: { readonly [W in FontWeight]: readonly number[] };
}

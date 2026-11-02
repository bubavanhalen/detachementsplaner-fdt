// Typen der genutzten Schnittstelle des Pakets `hyphen` 1.14.1 (bringt keine Typen mit; Vertrag E1-02b
// Abschnitt 5, Änderungsnotiz Code-Review Runde 1: CR-E102b-06).
declare module 'hyphen' {
  /** Musterdaten einer Sprache (Inhalt von `hyphen/patterns/<sprache>`); Aufbau nur für das Paket. */
  export type HyphenationPatterns = readonly unknown[];

  export interface HyphenatorOptions {
    /** false: Text nicht als HTML lesen (Text nach «<» ist kein Tag). */
    readonly html?: boolean;
  }

  /** Synchroner Trenner: Text mit weichen Trennstrichen U+00AD an allen Trennstellen. */
  export default function createHyphenator(
    patterns: HyphenationPatterns,
    options?: HyphenatorOptions,
  ): (text: string) => string;
}

declare module 'hyphen/patterns/de-1996' {
  import type { HyphenationPatterns } from 'hyphen';

  const patterns: HyphenationPatterns;
  export default patterns;
}

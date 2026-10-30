// Erwarteter Teilmengen-Präfix nach Vertrag E1-02c §2.3 Nr 6 (P-6, Vertragsprüfung V12): sechs Buchstaben
// A–Z aus der Menge der Codepunkte aller gezeichneten Läufe eines Schnitts (FNV-1a über drei Bytes je
// Codepunkt, aufsteigend, ohne Doppelte). Wörtlich aus dem Vertrag übernommen; Testorakel.

export function erwarteterPraefix(codepunkte: Iterable<number>): string {
  const menge = [...new Set(codepunkte)].sort((a, b) => a - b);
  let h = 0x811c9dc5;
  for (const cp of menge) {
    for (const byte of [(cp >> 16) & 0xff, (cp >> 8) & 0xff, cp & 0xff]) {
      h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    }
  }
  let tag = '';
  for (let i = 0; i < 6; i++) {
    tag += String.fromCharCode(65 + (h % 26));
    h = Math.floor(h / 26);
  }
  return tag;
}

/** Codepunkte aller Texte (für einen Schnitt). */
export function codepunkteVon(texte: Iterable<string>): number[] {
  const aus: number[] = [];
  for (const t of texte) for (const c of t) aus.push(c.codePointAt(0) as number);
  return aus;
}

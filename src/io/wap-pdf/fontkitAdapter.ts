// Adapter fontkit 2 → pdf-lib 1.17.1 (ADR-005 Option B; Vertrag E1-02c Abschnitt 2.2, Präzisierungen P-2, P-3).
// pdf-lib erwartet die Schnittstelle von @pdf-lib/fontkit 1: `createSubset().encodeStream()` und eine
// Glyphenfolge aus `layout()`. Der Adapter bildet beides auf fontkit 2 ab, ohne Kerning und ohne
// Glyphenersetzung (je Codepunkt die Glyphe der cmap, wie die Messung in layout/text).

import type { FontkitFont, FontkitGlyph } from 'fontkit';
import type { PDFDocument } from 'pdf-lib';

/** Schnittstelle, die pdf-lib in `registerFontkit` erwartet. */
export type PdfLibFontkit = Parameters<PDFDocument['registerFontkit']>[0];

/** Genutzter Teil des Moduls fontkit 2 (Namensraum von `import('fontkit')`). */
export interface FontkitModule {
  create(buffer: Uint8Array, postscriptName?: string): FontkitFont;
}

/**
 * Geteilte Glyphen von Arimo 1.341 (beide Schnitte): Zweitcodepunkt → Hauptcodepunkt. `ToUnicode` nennt für
 * diese Glyphen immer den Hauptcodepunkt, unabhängig von der Reihenfolge im Dokument (Änderungsnotiz
 * Vertragsprüfung V02). U+00AD ist ohnehin gesperrt (`LINE_EXCLUDED_CODEPOINTS`).
 */
export const SHARED_GLYPH_PRIMARY: ReadonlyMap<number, number> = new Map([
  [0x00ad, 0x002d],
  [0x037e, 0x003b],
  [0x04d8, 0x018f],
  [0x04d9, 0x0259],
  [0x202f, 0x2009],
  [0x2215, 0x2044],
  [0xf001, 0xfb01],
  [0xf002, 0xfb02],
]);

/**
 * Liefert ein Objekt für `PDFDocument.registerFontkit`. Jede damit erzeugte Schrift:
 * - `layout(text, features)` → je Codepunkt von `text` eine Glyphe mit `id` und `advanceWidth` von
 *   `glyphForCodePoint(codePoint)` (cmap, .notdef bei fehlender Glyphe) und `codePoints` = [Hauptcodepunkt]
 *   (`SHARED_GLYPH_PRIMARY`, sonst der Codepunkt selbst), unabhängig von früheren Aufrufen; `features` wird
 *   nicht ausgewertet (kein GSUB, kein GPOS, kein Kerning);
 * - `createSubset()` → Teilmenge mit zusätzlichem `encodeStream()`; dessen `on(ereignis, fn)` gibt den Strom
 *   zurück; frühestens in einer Mikroaufgabe nach dem Aufruf von `encodeStream()`, nie synchron, meldet er genau
 *   einmal `'data'` mit `encode()` und danach `'end'`, bzw. genau einmal `'error'`, wenn `encode()` wirft;
 * - alle übrigen Felder unverändert von fontkit 2.
 * Verändert das übergebene Modul nicht; kein Zufall, keine Uhr. Wirft nie (Fehler von fontkit treten erst in
 * `create` auf und werden von `writePdf` als `PdfWriteError` 'fontLoad' gemeldet).
 */
export function createFontkitAdapter(fontkit: FontkitModule): PdfLibFontkit {
  return {
    create: (buffer, postscriptName) =>
      // fontkit 2 liefert zur Laufzeit das ganze Schriftobjekt, das pdf-lib erwartet; fontkit.d.ts typisiert
      // nur den genutzten Teil (P-4). Die Umwandlung ist darum nur eine Typangabe.
      adaptiere(fontkit.create(buffer, postscriptName)) as unknown as ReturnType<
        PdfLibFontkit['create']
      >,
  };
}

type Ereignis = 'data' | 'end' | 'error';

/** Strom von `encodeStream()`, wie ihn pdf-lib liest (`on` gibt den Strom zurück). */
interface Teilstrom {
  on(ereignis: Ereignis, fn: (wert?: unknown) => void): Teilstrom;
}

/**
 * Strom aus `encode()` (V10): frühestens in einer Mikroaufgabe, nie synchron, genau einmal `data` mit den
 * Bytes und danach `end`, bzw. genau einmal `error`, wenn `encode()` wirft.
 */
function teilstrom(encode: () => Uint8Array): Teilstrom {
  const empfaenger: { readonly [E in Ereignis]: ((wert?: unknown) => void)[] } = {
    data: [],
    end: [],
    error: [],
  };
  const strom: Teilstrom = {
    on(ereignis, fn) {
      empfaenger[ereignis].push(fn);
      return strom;
    },
  };
  queueMicrotask(() => {
    let bytes: Uint8Array;
    try {
      bytes = encode();
    } catch (e: unknown) {
      for (const fn of empfaenger.error) fn(e);
      return;
    }
    for (const fn of empfaenger.data) fn(bytes);
    for (const fn of empfaenger.end) fn();
  });
  return strom;
}

/**
 * Ersetzt an dieser einen Schrift (nicht am Modul und nicht am Prototyp) `layout` und `createSubset`; alle
 * übrigen Felder bleiben die von fontkit 2.
 */
function adaptiere(schrift: FontkitFont): FontkitFont {
  const glyphe = schrift.glyphForCodePoint.bind(schrift);
  const teilmenge = schrift.createSubset.bind(schrift);
  // Je Codepunkt die cmap-Glyphe als neues Objekt: fontkit legt Glyphen je Schrift mit den Codepunkten des
  // ersten Abrufs ab; die festen `codePoints` machen ToUnicode unabhängig von der Reihenfolge (V02).
  schrift.layout = (text: string) => ({
    glyphs: Array.from(text, (z): FontkitGlyph => {
      const cp = z.codePointAt(0) as number;
      const g = glyphe(cp);
      return {
        id: g.id,
        advanceWidth: g.advanceWidth,
        codePoints: [SHARED_GLYPH_PRIMARY.get(cp) ?? cp],
      };
    }),
  });
  schrift.createSubset = () => {
    const teil = teilmenge();
    return Object.assign(teil, { encodeStream: () => teilstrom(() => teil.encode()) });
  };
  return schrift;
}

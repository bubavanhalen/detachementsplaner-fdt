// Textwarnungen der Seiten (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt G2, T-2;
// Änderungsnotiz E1-02c; R-14.3-02). Rein (R-L-02).

import { LINE_EXCLUDED_CODEPOINTS, type PageModel } from '../pageModel';
import { fontMetrics } from '../text/metrics';
import type { LayoutWarning, LayoutWarningCode } from './types';

/** «U+» und mindestens vier hexadezimale Grossbuchstaben. */
function codePointText(ch: string): string {
  return `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}

function excluded(cp: number): boolean {
  return LINE_EXCLUDED_CODEPOINTS.some(([a, b]) => cp >= a && cp <= b);
}

/**
 * Zeichen, das gegen die NFC-Regel des Schreibers verstösst (E1-02c V16): das erste Zeichen der Kategorie M,
 * sonst das erste Zeichen, ab dem sich Text und NFC-Form unterscheiden; null, wenn der Lauf NFC ohne kombinierende
 * Zeichen ist.
 */
function nfcCharacter(text: string): string | null {
  const mark = /\p{M}/u.exec(text);
  if (mark !== null) return mark[0];
  const nfc = text.normalize('NFC');
  if (nfc === text) return null;
  const a = [...text];
  const b = [...nfc];
  return a.find((ch, i) => ch !== b[i]) ?? (a[0] as string);
}

/**
 * Alle TextItem aller Seiten in der Reihenfolge Seite, Element, Lauf, Codepunkt: 'invalidCharacter'
 * bzw. 'missingGlyph', je (Code, Zeichen, entryId) einmal beim ersten Vorkommen. Wirft nie.
 */
export function textWarnings(pages: readonly PageModel[]): readonly LayoutWarning[] {
  const out: LayoutWarning[] = [];
  const seen = new Set<string>();
  const metrics = fontMetrics();
  pages.forEach((page, pi) => {
    page.items.forEach((item, ii) => {
      if (item.kind !== 'text') return;
      const entryId = item.entryId ?? null;
      const add = (code: LayoutWarningCode, ch: string): void => {
        const key = JSON.stringify([code, ch, entryId]);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          code,
          character: ch,
          codePoint: codePointText(ch),
          entryId,
          page: pi,
          item: ii,
        });
      };
      for (const run of item.runs) {
        // (a) gesperrter Codepunkt, (b) Lauf nicht NFC oder mit Zeichen der Kategorie M, (c) fehlende Glyphe.
        for (const ch of run.text) {
          if (excluded(ch.codePointAt(0) as number)) add('invalidCharacter', ch);
        }
        const nfc = nfcCharacter(run.text);
        if (nfc !== null) add('invalidCharacter', nfc);
        for (const ch of run.text) {
          const cp = ch.codePointAt(0) as number;
          if (!excluded(cp) && metrics.advance(cp, run.weight) === null) add('missingGlyph', ch);
        }
      }
    });
  });
  return out;
}

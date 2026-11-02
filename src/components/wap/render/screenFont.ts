// Bildschirmschrift des WAP-Planers (Vertrag E1-02c Abschnitt 3.1; ADR-004 Punkt 4, Gate-0-Entscheid G-4 c).
// Lädt Arimo Regular und Bold per FontFace aus den Bytes im Bundle (kein @font-face, keine URL; CSP der
// Suite unverändert).

import { fontBytes } from '../../../assets/wap-fonts/index';
import { WapError } from '../../../model/wap/errors';
import { FONT_FAMILY_SCREEN, type FontWeight } from '../../../model/wap/layout/text/types';

export type FontLoadErrorCode = 'screenFontUnavailable';

/** Meldung bei fehlender Bildschirmschrift (R-L-05); `PageView` zeigt genau diese Texte. */
export const SCREEN_FONT_MESSAGE = {
  cause:
    'Die Schrift des WAP-Planers konnte nicht geladen werden. Ohne sie würden Umbrüche vom PDF abweichen.',
  nextStep: 'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
} as const;

/** Die Bildschirmschrift ist nicht verfügbar (FontFace fehlt, wirft oder lädt nicht). */
export class FontLoadError extends WapError {
  declare readonly code: FontLoadErrorCode;

  constructor(options?: { cause?: unknown }) {
    super('screenFontUnavailable', SCREEN_FONT_MESSAGE, options);
  }
}

/** CSS-Gewicht je Schnitt (Beschrieb 10 kennt nur normal und fett). */
const GEWICHT: { readonly [W in FontWeight]: string } = { regular: '400', bold: '700' };

/** Der eine Ladevorgang dieses Dokuments (V-02c-3: kein neuer Versuch, auch nach einem Fehler). */
let ladevorgang: Promise<void> | undefined;

/** Lädt beide Schnitte; wirft `FontLoadError` bei jedem Scheitern. */
async function lade(): Promise<void> {
  // Über globalThis gelesen: Fehlt FontFace, wäre der blosse Name ein ReferenceError.
  const Schrift = (globalThis as { FontFace?: typeof FontFace }).FontFace;
  if (typeof Schrift !== 'function') throw new FontLoadError();
  try {
    const schnitte = (['regular', 'bold'] as const).map(
      (w) =>
        new Schrift(FONT_FAMILY_SCREEN, new Uint8Array(fontBytes(w)), {
          weight: GEWICHT[w],
          style: 'normal',
        }),
    );
    await Promise.all(schnitte.map((s) => s.load()));
    if (schnitte.some((s) => s.status !== 'loaded'))
      throw new Error('Schriftstatus nicht «loaded»');
    for (const s of schnitte) document.fonts.add(s);
  } catch (e: unknown) {
    throw new FontLoadError({ cause: e });
  }
}

/**
 * Lädt beide Schnitte als `new FontFace(FONT_FAMILY_SCREEN, bytes, { weight: '400' | '700' })`, wartet auf
 * `load()` und fügt sie `document.fonts` hinzu. Ein Ladevorgang je Dokument: Folgeaufrufe erhalten dasselbe
 * Ergebnis, auch einen Fehler (Erholung nur durch Neuladen der Seite). Keine Konsolenausgabe.
 * @throws FontLoadError (als abgelehntes Promise) mit Code 'screenFontUnavailable'.
 */
export function ensureScreenFont(): Promise<void> {
  ladevorgang ??= lade();
  return ladevorgang;
}

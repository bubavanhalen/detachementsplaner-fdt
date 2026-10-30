// Fehler und Warnungstexte der Seitenkomposition (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2»
// Abschnitt B «Fehlerverhalten», G2; _konventionen.md §3). Nur ungültige Eingabe des Aufrufers wirft;
// fachliche Zustände (Platzmangel, Fortsetzung, unlesbares Bild, fehlende Glyphe) sind Rückgabewerte.

import { type UserMessage, WapError } from '../../errors';
import type { LayoutWarningCode } from './types';

export type PageLayoutErrorCode = 'unknownPageGeometry';

/** Verbindliche Meldungstexte (Abschnitt B, Tabelle). */
export const PAGE_LAYOUT_MESSAGES: { readonly [C in PageLayoutErrorCode]: UserMessage } = {
  unknownPageGeometry: {
    cause: 'Die Seitenvorlage des Plans ist unbekannt.',
    nextStep:
      'Den WAP-Planer neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
  },
};

export class PageLayoutError extends WapError {
  declare readonly code: PageLayoutErrorCode;

  constructor(code: PageLayoutErrorCode, options?: { cause?: unknown }) {
    super(code, PAGE_LAYOUT_MESSAGES[code], options);
  }
}

/**
 * Verbindliche Texte der Warnungen (Abschnitt B, Tabelle; T-2). Platzhalter {zeichen} = das Zeichen,
 * {code} = LayoutWarning.codePoint («U+» und mindestens vier hexadezimale Grossbuchstaben).
 */
export const LAYOUT_WARNING_MESSAGES: { readonly [C in LayoutWarningCode]: UserMessage } = {
  missingGlyph: {
    cause:
      'Der Plan enthält das Zeichen «{zeichen}» ({code}), das die Schrift des WAP-Planers nicht darstellen kann.',
    nextStep: 'Das Zeichen im betroffenen Eintrag ersetzen; sonst kann kein PDF erzeugt werden.',
  },
  invalidCharacter: {
    cause: 'Der Plan enthält das Zeichen {code}, das im PDF anders erschiene als am Bildschirm.',
    nextStep: 'Das Zeichen im betroffenen Eintrag entfernen; sonst kann kein PDF erzeugt werden.',
  },
  invalidImage: {
    cause: 'Das Wappen des Plans ist kein lesbares PNG- oder JPEG-Bild.',
    nextStep: 'In den Plan-Einstellungen ein anderes Wappen wählen.',
  },
};

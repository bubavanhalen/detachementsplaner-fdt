// Fehler des Raster-Layouts (Vertrag E1-02d Abschnitt 2a Nr 1, 2g; _konventionen.md §3).
// Nur ungültige Eingabe des Aufrufers; fachliche Zustände sind Rückgabewerte (FallbackEvent).

import { type UserMessage, WapError } from '../../errors';

export type GridLayoutErrorCode = 'gridFrameTooSmall' | 'invalidDisplayRange';

/** Verbindliche Meldungstexte (Vertrag E1-02d Abschnitt 2g). */
export const GRID_LAYOUT_MESSAGES: { readonly [C in GridLayoutErrorCode]: UserMessage } = {
  gridFrameTooSmall: {
    cause: 'Das Wochenraster hat auf der Seite keinen Platz.',
    nextStep:
      'Den WAP-Planer neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
  },
  invalidDisplayRange: {
    cause:
      'Der Anzeigebereich des Plans ist ungültig; er muss in 0000–2400 liegen und mehr als eine Stunde umfassen.',
    nextStep: 'In den Plan-Einstellungen einen gültigen Anzeigebereich wählen, z.B. 0400–2400.',
  },
};

export class GridLayoutError extends WapError {
  declare readonly code: GridLayoutErrorCode;

  constructor(code: GridLayoutErrorCode, options?: { cause?: unknown }) {
    super(code, GRID_LAYOUT_MESSAGES[code], options);
  }
}

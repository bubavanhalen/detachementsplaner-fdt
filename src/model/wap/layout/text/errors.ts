// Fehler der Textschicht (Vertrag E1-02b Abschnitt 2.4, P-13; _konventionen.md Abschnitt 3).
import { WapError } from '../../errors';

/** Meldung für `invalidTextBox` (Vorschlag für den Meldungskatalog E1-11, Vertrag E1-02b 2.4). */
const INVALID_TEXT_BOX = {
  cause:
    'Ein Text konnte nicht gesetzt werden, weil sein Feld keine gültige Breite oder Schriftgrösse hat.',
  nextStep: 'Spaltenbreiten und Schriftgrössen in den Plan-Einstellungen prüfen.',
} as const;

/** Wirft `invalidTextBox`, wenn `sizePt` nicht endlich oder ≤ 0 ist. */
export function assertSizePt(sizePt: number): void {
  if (!(Number.isFinite(sizePt) && sizePt > 0)) throw invalidTextBox();
}

/** Wirft `invalidTextBox`, wenn `maxWidthPt` NaN oder ≤ 0 ist (+Infinity ist zulässig). */
export function assertMaxWidthPt(maxWidthPt: number): void {
  if (!(maxWidthPt > 0)) throw invalidTextBox();
}

function invalidTextBox(): WapError {
  return new WapError('invalidTextBox', INVALID_TEXT_BOX);
}

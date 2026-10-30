// Sichtbarer Text eines Textfelds (F-IMPORT2, Entscheid 9 des Auftraggebers vom 19.10.2026; Beschrieb 4.2,
// 8.2 Regel 8). Rein, Masse in EMU des Blatts. Das Lesemodul liefert weder Innenränder noch Überlaufregeln des
// Textkörpers; die Schätzung ist deshalb zugunsten der Sichtbarkeit gewählt (kein Innenrand, schmale Zeichen),
// damit sichtbarer Text nie verloren geht: Excel schneidet in der Referenz am Rand ab (vertOverflow/horzOverflow
// «clip»), Text ausserhalb des Textfelds oder unter einer deckenden Form ist dort nicht zu sehen.
import type { Rect } from './geometry';

const EMU_PER_PT = 12700;
/** Mittlere Zeichenbreite in Geviert (eher schmal geschätzt). */
const CHAR_EM = 0.45;
/** Zeilenhöhe in Geviert. */
const LINE_EM = 1.2;
/** Schriftgrösse ohne Angabe im Textkörper (Excel-Vorgabe 11 pt). */
const DEFAULT_PT = 11;
/** Toleranz für Rundung der Anker: so viel der Breite darf eine deckende Form fehlen. */
const WIDTH_TOLERANCE = 0.005;

export interface TextBoxLine {
  readonly text: string;
  /** Schriftgrösse in pt; null = Vorgabe. */
  readonly sizePt: number | null;
}

/**
 * Je Zeile (Absatz oder Zeilenumbruch, oben beginnend): true, wenn ihr erster Umbruch sichtbar ist, d.h. das
 * Textfeld mindestens ein Zeichen breit ist, die Mitte der ersten Zeile im Textfeld liegt und dort keine der
 * `covers` (später gezeichnete deckende Formen) über die ganze Breite liegt. Leere Zeilen belegen eine Zeile.
 */
export function visibleTextLines(
  box: Rect,
  lines: readonly TextBoxLine[],
  covers: readonly Rect[],
): boolean[] {
  const width = box.x1 - box.x0;
  let y = box.y0;
  return lines.map((line) => {
    const size = (line.sizePt ?? DEFAULT_PT) * EMU_PER_PT;
    const perRow = Math.floor(width / (size * CHAR_EM));
    const rows = perRow <= 0 ? 1 : Math.max(1, Math.ceil(line.text.length / perRow));
    const mid = y + (size * LINE_EM) / 2;
    y += rows * size * LINE_EM;
    if (perRow <= 0 || mid >= box.y1) return false;
    const slack = width * WIDTH_TOLERANCE;
    return !covers.some(
      (c) => c.y0 <= mid && c.y1 > mid && c.x0 <= box.x0 + slack && c.x1 >= box.x1 - slack,
    );
  });
}

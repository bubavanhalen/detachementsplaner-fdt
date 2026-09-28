// Footnote markers (small boxes "10" … "79" in the grid) and footnote texts (text
// boxes below the grid, "Termine": one line per footnote, "31 0915-1045: …").
import { TB_WEEKDAYS, type TbWeekday } from '../../model/tagesbefehl/types';
import type { TimeScale } from './calibrate';
import { type FootnoteTime, parseFootnoteLine } from './content';
import type { WapShape } from './drawing';

export interface Footnote {
  nr: number;
  /** Day of the text box the footnote is written in (null if outside all days). */
  day: TbWeekday | null;
  time: FootnoteTime | null;
  body: string;
  /** Full footnote line as in the WAP. */
  raw: string;
}

/** Marker number of a small numbered box, else null. */
export function markerNumber(shape: WapShape): number | null {
  const text = shape.lines.filter(Boolean).join('').trim();
  if (!/^\d{2}$/.test(text)) return null;
  const nr = Number(text);
  return nr >= 10 && nr <= 79 ? nr : null;
}

/** Weekday encoded in a footnote number: 1x Mo … 5x Fr, 6x Sa, 7x weekend (So). */
export function dayOfNumber(nr: number): TbWeekday | null {
  const tens = Math.floor(nr / 10);
  return tens >= 1 && tens <= 7 ? TB_WEEKDAYS[tens - 1] : null;
}

const NUMBERED = /^\s*\d{2}(?:\s*[-–—]\s*|\s+)\S/;

export function isFootnoteBox(shape: WapShape, time: TimeScale): boolean {
  const lines = shape.lines.filter(Boolean);
  if (!lines.length) return false;
  const numbered = lines.filter((line) => NUMBERED.test(line)).length;
  const last = time.labels[time.labels.length - 1];
  return numbered > 0 && numbered * 2 >= lines.length && shape.box.y0 > last.y;
}

export function readFootnotes(
  boxes: readonly WapShape[],
  dayAt: (x: number) => TbWeekday | null,
): Footnote[] {
  const out: Footnote[] = [];
  for (const box of boxes) {
    const day = dayAt((box.box.x0 + box.box.x1) / 2);
    let current: Footnote | null = null;
    for (const line of box.lines) {
      if (!line) continue;
      const parsed = NUMBERED.test(line) ? parseFootnoteLine(line) : null;
      if (parsed) {
        current = { nr: parsed.nr, day, time: parsed.time, body: parsed.body, raw: line };
        out.push(current);
      } else if (current) {
        // Continuation line of the previous footnote.
        current.body = `${current.body} ${line}`.trim();
        current.raw = `${current.raw} ${line}`;
      }
    }
  }
  return out;
}

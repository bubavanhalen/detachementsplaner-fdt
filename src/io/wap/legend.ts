// Legend: fill colour → Leitung (read from the sheet's own legend cells, with the
// usual WAP colours as fallback) and rapport abbreviations (e.g. "KR" → "Kp Rap").
import type { TbLeitung } from '../../model/tagesbefehl/types';
import { colorDistance, isOrange, type Rgb } from './colors';
import type { SheetModel } from './sheet';

export interface Legend {
  /** Colour per Leitung as found in the sheet (or fallback). */
  colors: Partial<Record<Exclude<TbLeitung, ''>, Rgb>>;
  /** True when the colour was read from the sheet (not the fallback). */
  fromSheet: Partial<Record<Exclude<TbLeitung, ''>, boolean>>;
  /** Rapport abbreviations from the legend, e.g. KR → "Kp Rap". */
  abbreviations: Map<string, string>;
  leitungOf(fill: Rgb | null): TbLeitung;
}

export const FALLBACK_COLORS: Record<Exclude<TbLeitung, ''>, Rgb> = {
  bat: 'CCECFF',
  kp: 'FFFF99',
  zfhr: 'FDEADA',
  extern: 'BFBFBF',
  s2: 'FFC000',
};

const LABELS: [Exclude<TbLeitung, ''>, RegExp][] = [
  ['bat', /^\s*(?:leitung|ltg)\s+bat\b/i],
  ['kp', /^\s*(?:leitung|ltg)\s+kp\b/i],
  ['zfhr', /^\s*(?:leitung|ltg)\s+zfhr\b/i],
  ['extern', /^\s*extern\b/i],
  ['s2', /^\s*(?:leitung|ltg)\s+s\s?2\b/i],
];

export function readLegend(sheet: SheetModel, headerRows: number): Legend {
  const colors: Legend['colors'] = {};
  const fromSheet: Legend['fromSheet'] = {};
  for (const cell of sheet.cells) {
    const hit = LABELS.find(([, re]) => re.test(cell.text));
    if (!hit || colors[hit[0]]) continue;
    const range = sheet.rangeAt(cell.row, cell.col);
    // The swatch is the cell left of the label (or the label cell itself if filled).
    let rgb: Rgb | null = null;
    for (let col = range.c0 - 1; col >= Math.max(0, range.c0 - 2) && !rgb; col--) {
      const swatch = sheet.rangeAt(cell.row, col);
      rgb = sheet.fillOf(sheet.cellAt(swatch.r0, swatch.c0));
    }
    rgb ??= sheet.fillOf(cell);
    if (rgb && rgb !== 'FFFFFF') {
      colors[hit[0]] = rgb;
      fromSheet[hit[0]] = true;
    }
  }
  for (const [key, rgb] of Object.entries(FALLBACK_COLORS) as [Exclude<TbLeitung, ''>, Rgb][])
    colors[key] ??= rgb;

  // Abbreviation legend: short code cell followed by a description cell in the same row.
  const abbreviations = new Map<string, string>();
  for (const cell of sheet.cells) {
    const code = cell.text.trim();
    if (cell.row <= headerRows || !/^[A-Z]{1,4}\s?\d?$/.test(code)) continue;
    const range = sheet.rangeAt(cell.row, cell.col);
    const next = sheet.cells.find(
      (c) => c.row === cell.row && c.col > range.c1 && c.col <= range.c1 + 2 && c.text.trim(),
    );
    const description = next?.text.replace(/\s+/g, ' ').trim() ?? '';
    const key = code.replace(/\s+/g, '');
    if (description.length > code.length && !abbreviations.has(key))
      abbreviations.set(key, description);
  }

  const entries = Object.entries(colors) as [Exclude<TbLeitung, ''>, Rgb][];
  return {
    colors,
    fromSheet,
    abbreviations,
    leitungOf(fill) {
      if (!fill) return '';
      const exact = entries.find(([, rgb]) => rgb === fill);
      if (exact) return exact[0];
      let best: [TbLeitung, number] = ['', Number.POSITIVE_INFINITY];
      for (const [key, rgb] of entries) {
        const d = colorDistance(rgb, fill);
        if (d < best[1]) best = [key, d];
      }
      for (const [key, rgb] of Object.entries(FALLBACK_COLORS) as [TbLeitung, Rgb][]) {
        const d = colorDistance(rgb, fill);
        if (d < best[1]) best = [key, d];
      }
      if (best[1] <= 40) return best[0];
      return isOrange(fill) ? 's2' : '';
    },
  };
}

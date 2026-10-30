// Status-Darstellung (Beschrieb 10 «Status»; R-10-27 bis R-10-29, R-10-31; Gate 0 Q-009 UI-F-1: Rot #c00000).
// Eine Regel für PDF und Bildschirm (Leitplanke 2): offen → Titel bzw. Terminzeile rot; Feldwert «offen» → nur das
// Wort rot; gestrichen → ganzer Eintrag rot durchgestrichen. Mit `showStatus` false bleibt alles in der Grundfarbe.

import type { Entry, Rgb } from '../../types';
import type { TextItem, TextRunOut } from '../pageModel';

/** Status-Rot (#c00000, Q-009 UI-F-1). */
export const STATUS_RED: Rgb = { r: 192, g: 0, b: 0 };

/** Feldwert «offen» (Glossar `OPEN_VALUE`). */
export const OPEN_WORD = 'offen';

const WORD = /(?<![\p{L}\p{N}])offen(?![\p{L}\p{N}])/gu;

function red(): Rgb {
  return { r: STATUS_RED.r, g: STATUS_RED.g, b: STATUS_RED.b };
}

/** Läufe mit dem Wort «offen» in Rot zerlegt (R-10-28); übriger Text unverändert. */
export function markOpenWord(runs: readonly TextRunOut[]): TextRunOut[] {
  const out: TextRunOut[] = [];
  for (const r of runs) {
    let last = 0;
    for (const m of r.text.matchAll(WORD)) {
      const at = m.index ?? 0;
      if (at > last) out.push({ ...r, text: r.text.slice(last, at) });
      out.push({ ...r, text: OPEN_WORD, color: red() });
      last = at + OPEN_WORD.length;
    }
    if (last === 0) out.push(r);
    else if (last < r.text.length) out.push({ ...r, text: r.text.slice(last) });
  }
  return out;
}

/** «Änderungen markieren» (Beschrieb 10): Läufe eines geänderten Eintrags rot, Durchstreichung bleibt. */
export function markChangedRuns(runs: readonly TextRunOut[], changed: boolean): TextRunOut[] {
  return changed ? runs.map((r) => ({ ...r, color: red() })) : [...runs];
}

/** Alle Läufe rot (offen: Titel) bzw. rot und durchgestrichen (gestrichen). */
export function paintRuns(runs: readonly TextRunOut[], strike: boolean): TextRunOut[] {
  return runs.map((r) => ({ ...r, color: red(), strike: strike || r.strike }));
}

/**
 * Text eines Eintrags nach Status: `paras[i]` ist der Absatz der Zeile `items[i]`, `titlePara` der Absatz des
 * Titels (bzw. des Kürzels, der Nummer, der einzigen Zeile) oder null. Ohne Status-Darstellung unverändert.
 */
export function styleEntryText(
  items: readonly TextItem[],
  paras: readonly number[],
  entry: Entry | undefined,
  titlePara: number | null,
  showStatus: boolean,
): TextItem[] {
  if (!showStatus || entry === undefined) return [...items];
  return items.map((item, i) => {
    if (entry.status === 'cancelled') return { ...item, runs: paintRuns(item.runs, true) };
    if (entry.status === 'open' && titlePara !== null && paras[i] === titlePara)
      return { ...item, runs: paintRuns(item.runs, false) };
    if (titlePara !== null && paras[i] === titlePara) return { ...item };
    return { ...item, runs: markOpenWord(item.runs) };
  });
}

/**
 * Terminzeile (Beso, ganztägige Bemerkung) nach Status: offen → ganze Zeile rot (R-10-27), gestrichen → rot
 * durchgestrichen (R-10-29), sonst nur das Wort «offen» rot (R-10-28).
 */
export function styleAgendaRuns(
  runs: readonly TextRunOut[],
  entry: Entry | undefined,
  showStatus: boolean,
): TextRunOut[] {
  if (!showStatus || entry === undefined) return [...runs];
  if (entry.status === 'cancelled') return paintRuns(runs, true);
  if (entry.status === 'open') return paintRuns(runs, false);
  return markOpenWord(runs);
}

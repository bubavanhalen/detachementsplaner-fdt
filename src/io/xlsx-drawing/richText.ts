// Rich Text in Zellen (Vertrag E1-07 §2f; Beschrieb 8.2 Regel 1, 2; Termindetails Bat).
import { cellColor, type Rgb, type Theme } from './colors';
import { parseRef } from './sheet';
import { child, children, numText } from './xml';

export interface CellRichRun {
  /** Text des Laufs (r/t) unverändert, ohne Lautschrift (rPh), nie leer. */
  readonly text: string;
  readonly bold: boolean;
  readonly strike: boolean;
  /** Farbe aus rPr/color ("RRGGBB") oder null. */
  readonly color: Rgb | null;
}

/** Schalter wie <b/> oder <strike val="0"/>: vorhanden und val nicht «0»/«false». */
function flag(rPr: Element | undefined, name: string): boolean {
  const el = child(rPr, name);
  if (!el) return false;
  const val = el.getAttribute('val');
  return val !== '0' && val !== 'false';
}

function colorOf(rPr: Element | undefined, theme: Theme): Rgb | null {
  const el = child(rPr, 'color');
  if (!el) return null;
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) attrs[attr.localName] = attr.value;
  return cellColor(attrs, theme);
}

/** Läufe aus den r-Kindern eines si- bzw. is-Elements; null ohne r. */
function runsOf(container: Element | undefined, theme: Theme): CellRichRun[] | null {
  const rs = children(container, 'r');
  if (!rs.length) return null;
  const runs: CellRichRun[] = [];
  for (const r of rs) {
    const text = children(r, 't')
      .map((t) => t.textContent)
      .join('');
    if (text === '') continue;
    const rPr = child(r, 'rPr');
    runs.push({
      text,
      bold: flag(rPr, 'b'),
      strike: flag(rPr, 'strike'),
      color: colorOf(rPr, theme),
    });
  }
  return runs;
}

/**
 * Vorbereitete gemeinsame Zeichenfolgen einer Arbeitsmappe (CR-E107-12): die si-Liste samt Läufen,
 * einmal gebildet und nicht an das Dokument gebunden. Opak; nur für readCellRichTextWith.
 */
export interface SharedRichText {
  /** Läufe des si-Eintrags am Index; null ohne Läufe oder ausserhalb der Liste. */
  runsAt(index: number): readonly CellRichRun[] | null;
}

/**
 * Bildet die si-Liste samt Läufen genau einmal (intern, nicht über index.ts). sharedStringsXml ist
 * null, wenn die Arbeitsmappe keine gemeinsamen Zeichenfolgen hat. Liest nur.
 */
export function readSharedRichText(
  sharedStringsXml: Document | null,
  theme: Theme,
): SharedRichText {
  const list = sharedStringsXml
    ? children(sharedStringsXml.documentElement, 'si').map((si) => runsOf(si, theme))
    : [];
  return { runsAt: (index) => list[index] ?? null };
}

/**
 * Läufe je Zelle mit Rich Text (gemeinsame Zeichenfolge mit r-Elementen oder inlineStr mit r-Elementen).
 * Schlüssel: Zelladresse in Grossbuchstaben ohne «$» (z.B. «BK89»). Zellen ohne Läufe fehlen.
 * sharedStringsXml ist null, wenn die Arbeitsmappe keine gemeinsamen Zeichenfolgen hat. Liest nur.
 */
export function readCellRichText(
  sharedStringsXml: Document | null,
  sheetXml: Document,
  theme: Theme,
): ReadonlyMap<string, readonly CellRichRun[]> {
  return readCellRichTextWith(readSharedRichText(sharedStringsXml, theme), sheetXml, theme);
}

/** Wie readCellRichText, mit vorbereiteten gemeinsamen Zeichenfolgen (Zugriff über den Index). */
export function readCellRichTextWith(
  shared: SharedRichText,
  sheetXml: Document,
  theme: Theme,
): ReadonlyMap<string, readonly CellRichRun[]> {
  const out = new Map<string, readonly CellRichRun[]>();
  const sheetData = child(sheetXml.documentElement, 'sheetData');
  for (const row of children(sheetData, 'row'))
    for (const c of children(row, 'c')) {
      const ref = c.getAttribute('r') ?? '';
      if (!parseRef(ref)) continue;
      const type = c.getAttribute('t');
      const runs =
        type === 's'
          ? shared.runsAt(numText(child(c, 'v'), -1))
          : type === 'inlineStr'
            ? runsOf(child(c, 'is'), theme)
            : null;
      if (runs) out.set(ref.trim().replace(/\$/g, '').toUpperCase(), runs);
    }
  return out;
}

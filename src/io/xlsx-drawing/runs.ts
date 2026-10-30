// Textläufe je Form aus dem Zeichnungs-XML (Vertrag E1-07 §2d; Beschrieb 8.2 Regel 2, 12).
// Zweiter Durchlauf über dieselben Knoten wie drawing.ts readDrawing; Zuordnung über WapShape.index.
import { drawingColor, type Rgb, type Theme } from './colors';
import { drawingLeaves } from './nodes';
import type { SheetModel } from './sheet';
import { child, children, num } from './xml';

export interface ShapeTextRun {
  /** Index des Absatzes (a:p) im Textkörper, 0-basiert. */
  readonly paragraph: number;
  /** Index der Zeile in WapShape.lines (neue Zeile bei jedem a:p und jedem a:br), 0-basiert. */
  readonly line: number;
  /** Text des Laufs (a:r oder a:fld) unverändert, nie leer. */
  readonly text: string;
  readonly bold: boolean;
  readonly strike: boolean;
  /** Ausdrücklich gesetzte Textfarbe ("RRGGBB") oder null. */
  readonly color: Rgb | null;
  /** Schriftgrösse in pt (sz / 100) oder null. */
  readonly sizePt: number | null;
}

/** Erste Quelle mit dem Attribut: rPr des Laufs → pPr/defRPr → lstStyle/lvl‹n›pPr/defRPr. */
function firstAttribute(sources: readonly (Element | undefined)[], name: string): string | null {
  for (const source of sources) if (source?.hasAttribute(name)) return source.getAttribute(name);
  return null;
}

function runProperties(
  sources: readonly (Element | undefined)[],
  theme: Theme,
): Pick<ShapeTextRun, 'bold' | 'strike' | 'color' | 'sizePt'> {
  const b = firstAttribute(sources, 'b');
  const strike = firstAttribute(sources, 'strike');
  // Fehlend oder leer gilt als nicht gesetzt (Number('') wäre 0).
  const size = Number(firstAttribute(sources, 'sz') || Number.NaN);
  let color: Rgb | null = null;
  for (const source of sources) {
    const fill = child(source, 'solidFill');
    if (fill) {
      color = drawingColor(children(fill)[0], theme);
      break;
    }
  }
  return {
    bold: b === '1' || b === 'true',
    strike: strike !== null && strike !== 'noStrike',
    color,
    sizePt: Number.isFinite(size) ? size / 100 : null,
  };
}

/** Text eines a:r bzw. a:fld: seine a:t-Kinder unverändert aneinandergefügt (null zählt als ''). */
const runText = (run: Element): string =>
  children(run, 't')
    .map((t) => t.textContent)
    .join('');

/** Läufe eines Textkörpers; Zeilen wie textLines in drawing.ts (jedes a:p und a:br beginnt eine Zeile). */
function bodyRuns(node: Element, theme: Theme): ShapeTextRun[] {
  const body = child(node, 'txBody');
  if (!body) return [];
  const lstStyle = child(body, 'lstStyle');
  const runs: ShapeTextRun[] = [];
  let line = 0;
  children(body, 'p').forEach((p, paragraph) => {
    const pPr = child(p, 'pPr');
    const level = num(pPr, 'lvl', 0) + 1;
    const paragraphDefaults = child(pPr, 'defRPr');
    const levelDefaults = child(child(lstStyle, `lvl${String(level)}pPr`), 'defRPr');
    for (const c of children(p)) {
      if (c.localName === 'br') line++;
      else if (c.localName === 'r' || c.localName === 'fld') {
        const text = runText(c);
        if (text !== '') {
          const sources = [child(c, 'rPr'), paragraphDefaults, levelDefaults];
          runs.push({ paragraph, line, text, ...runProperties(sources, theme) });
        }
      }
    }
    line++;
  });
  return runs;
}

/**
 * Läufe je Form. Die Map hat genau die Schlüssel 0 … n-1 mit n = readDrawing(drawingXml, sheet, theme).length;
 * Formen ohne Text erhalten []. Liest nur.
 */
export function readShapeRuns(
  drawingXml: Document,
  sheet: SheetModel,
  theme: Theme,
): ReadonlyMap<number, readonly ShapeTextRun[]> {
  const out = new Map<number, readonly ShapeTextRun[]>();
  drawingLeaves(drawingXml, sheet).forEach((leaf, index) => {
    out.set(index, bodyRuns(leaf.node, theme));
  });
  return out;
}

// Füllung und Linie je Form aus dem Zeichnungs-XML (Vertrag E1-07 §2e; Beschrieb 8.2 Regel 5, Marker).
// Zweiter Durchlauf über dieselben Knoten wie drawing.ts readDrawing; Zuordnung über WapShape.index.
import { drawingColor, type Rgb, type Theme } from './colors';
import { drawingLeaves } from './nodes';
import type { SheetModel } from './sheet';
import { child, children, descendants, num } from './xml';

export interface ShapeFillStop {
  /** Lage im Verlauf 0 … 1 (a:gs pos / 100000). */
  readonly position: number;
  readonly color: Rgb;
  /** Deckkraft 0 … 1 (a:alpha / 100000), 1 ohne a:alpha. */
  readonly alpha: number;
}

export interface ShapeFillExtras {
  /** Deckkraft der wirksamen Einfarb- oder Musterfüllung 0 … 1; null ohne a:alpha, ohne Füllung oder bei Verlauf. */
  readonly fillAlpha: number | null;
  /** Alle Stopps einer wirksamen Verlaufsfüllung, nach position aufsteigend; [] ohne Verlauf. */
  readonly fillStops: readonly ShapeFillStop[];
  /** a:ln/a:prstDash@val (z.B. 'solid', 'dash', 'sysDot'), 'custom' bei a:custDash, sonst null. */
  readonly lineDash: string | null;
  /** a:ln@w in EMU oder null. */
  readonly lineWidthEmu: number | null;
}

/** Wirksame Füllung wie fillFromProps in drawing.ts, aber mit dem Füllungselement statt der Farbe. */
type FillPick =
  | { readonly kind: 'none' }
  | { readonly kind: 'fill'; readonly el: Element }
  | { readonly kind: 'unset' };

const NONE: FillPick = { kind: 'none' };

/** Farbelement, an dem readDrawing die Füllung festmacht (Verlauf: erster Stopp). */
const FILL_COLOR: Readonly<Record<string, (fill: Element) => Element | undefined>> = {
  solidFill: (fill) => children(fill)[0],
  gradFill: (fill) => children(descendants(fill, 'gs')[0])[0],
  pattFill: (fill) => children(child(fill, 'fgClr'))[0],
};

function pickFill(props: Element | undefined, inherited: Element | null, theme: Theme): FillPick {
  for (const item of children(props)) {
    const name = item.localName;
    if (name === 'noFill' || name === 'blipFill') return NONE;
    if (name === 'grpFill') return inherited ? { kind: 'fill', el: inherited } : NONE;
    const colorOf = FILL_COLOR[name];
    if (colorOf) return drawingColor(colorOf(item), theme) ? { kind: 'fill', el: item } : NONE;
  }
  return { kind: 'unset' };
}

/** a:alpha-Kind einer Farbe / 100000, auf 0 … 1 begrenzt; null ohne verwertbaren Wert. */
function alphaOf(colorEl: Element | undefined): number | null {
  const value = num(child(colorEl, 'alpha'), 'val', Number.NaN);
  return Number.isNaN(value) ? null : Math.max(0, Math.min(1, value / 100000));
}

function gradientStops(grad: Element, theme: Theme): ShapeFillStop[] {
  const stops: ShapeFillStop[] = [];
  for (const gs of descendants(grad, 'gs')) {
    const colorEl = children(gs)[0];
    const color = drawingColor(colorEl, theme);
    if (color === null) continue;
    stops.push({ position: num(gs, 'pos') / 100000, color, alpha: alphaOf(colorEl) ?? 1 });
  }
  return stops.sort((a, b) => a.position - b.position);
}

function lineDashOf(ln: Element | undefined): string | null {
  for (const c of children(ln)) {
    if (c.localName === 'custDash') return 'custom';
    if (c.localName === 'prstDash') return c.getAttribute('val') || null;
  }
  return null;
}

/** Wie num() in xml.ts: fehlend, leer oder nicht numerisch ergibt null. */
function lineWidthOf(ln: Element | undefined): number | null {
  const value = num(ln, 'w', Number.NaN);
  return Number.isNaN(value) ? null : value;
}

function extrasOf(node: Element, groups: readonly Element[], theme: Theme): ShapeFillExtras {
  let groupFill: Element | null = null;
  for (const group of groups) {
    const pick = pickFill(child(group, 'grpSpPr'), groupFill, theme);
    if (pick.kind === 'fill') groupFill = pick.el;
    else if (pick.kind === 'none') groupFill = null;
  }
  const props = child(node, 'spPr');
  const pick = pickFill(props, groupFill, theme);
  const fill = pick.kind === 'fill' ? pick.el : null;
  let fillAlpha: number | null = null;
  let fillStops: ShapeFillStop[] = [];
  if (fill?.localName === 'solidFill') fillAlpha = alphaOf(children(fill)[0]);
  else if (fill?.localName === 'pattFill') fillAlpha = alphaOf(children(child(fill, 'fgClr'))[0]);
  else if (fill?.localName === 'gradFill') fillStops = gradientStops(fill, theme);
  const ln = child(props, 'ln');
  return { fillAlpha, fillStops, lineDash: lineDashOf(ln), lineWidthEmu: lineWidthOf(ln) };
}

/**
 * Füllungs- und Linienangaben je Form. Die Map hat genau die Schlüssel 0 … n-1 mit
 * n = readDrawing(drawingXml, sheet, theme).length. Liest nur.
 */
export function readShapeFills(
  drawingXml: Document,
  sheet: SheetModel,
  theme: Theme,
): ReadonlyMap<number, ShapeFillExtras> {
  const out = new Map<number, ShapeFillExtras>();
  drawingLeaves(drawingXml, sheet).forEach((leaf, index) => {
    out.set(index, extrasOf(leaf.node, leaf.groups, theme));
  });
  return out;
}

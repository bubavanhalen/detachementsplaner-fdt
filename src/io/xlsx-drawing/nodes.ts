// Interner Helfer (nicht in index.ts): Durchlauf über die Formknoten einer Zeichnung mit genau
// denselben Regeln wie readDrawing in drawing.ts (Vertrag E1-07 §2d, §2e). Er liefert die
// Blatt-Formen in derselben Reihenfolge, so dass die Position in der Liste WapShape.index ist.
// drawing.ts bleibt byteweise unverändert (§1a); die nötigen privaten Teile sind hier nachgebildet.
import type { Box } from './drawing';
import type { SheetModel } from './sheet';
import { child, children, num, numText } from './xml';

/** Eine Blatt-Form, wie readDrawing sie ausgibt, mit ihren Gruppen (äusserste zuerst). */
export interface DrawingLeaf {
  readonly node: Element;
  readonly groups: readonly Element[];
}

interface XfrmBoxes {
  readonly box: Box;
  readonly chBox: Box | null;
}

const SHAPES: ReadonlySet<string> = new Set(['sp', 'grpSp', 'cxnSp', 'pic', 'graphicFrame']);

const isTrue = (value: string | null): boolean => /^(?:1|true)$/.test(value ?? '');

const hasArea = (box: Box): boolean => box.x1 - box.x0 > 0 && box.y1 - box.y0 > 0;

/** Wie readXfrm: null ohne a:xfrm, a:off oder a:ext; chBox nur mit a:chOff und a:chExt. */
function readXfrmBoxes(el: Element | undefined): XfrmBoxes | null {
  const off = child(el, 'off');
  const ext = child(el, 'ext');
  if (!off || !ext) return null;
  const x = num(off, 'x');
  const y = num(off, 'y');
  const chOff = child(el, 'chOff');
  const chExt = child(el, 'chExt');
  let chBox: Box | null = null;
  if (chOff && chExt) {
    const cx = num(chOff, 'x');
    const cy = num(chOff, 'y');
    chBox = { x0: cx, y0: cy, x1: cx + num(chExt, 'cx'), y1: cy + num(chExt, 'cy') };
  }
  return { box: { x0: x, y0: y, x1: x + num(ext, 'cx'), y1: y + num(ext, 'cy') }, chBox };
}

/** Wie anchorBox in drawing.ts. */
function anchorBox(anchor: Element, sheet: SheetModel): Box | null {
  const point = (el: Element): readonly [number, number] => {
    const col = numText(child(el, 'col'));
    const row = numText(child(el, 'row'));
    const colOff = Math.min(numText(child(el, 'colOff')), sheet.colWidth(col));
    const rowOff = Math.min(numText(child(el, 'rowOff')), sheet.rowHeight(row));
    return [sheet.colX(col) + colOff, sheet.rowY(row) + rowOff];
  };
  if (anchor.localName === 'twoCellAnchor') {
    const from = child(anchor, 'from');
    const to = child(anchor, 'to');
    if (!from || !to) return null;
    const [x0, y0] = point(from);
    const [x1, y1] = point(to);
    return {
      x0: Math.min(x0, x1),
      y0: Math.min(y0, y1),
      x1: Math.max(x0, x1),
      y1: Math.max(y0, y1),
    };
  }
  if (anchor.localName === 'oneCellAnchor') {
    const from = child(anchor, 'from');
    const ext = child(anchor, 'ext');
    if (!from || !ext) return null;
    const [x0, y0] = point(from);
    return { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') };
  }
  if (anchor.localName === 'absoluteAnchor') {
    const pos = child(anchor, 'pos');
    const ext = child(anchor, 'ext');
    if (!pos || !ext) return null;
    const x0 = num(pos, 'x');
    const y0 = num(pos, 'y');
    return { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') };
  }
  return null;
}

/** Wie anchorShapes: Formen eines Ankers, mc:AlternateContent mit Fallback vor Choice. */
function anchorShapes(anchor: Element): Element[] {
  const out: Element[] = [];
  for (const c of children(anchor)) {
    if (SHAPES.has(c.localName)) out.push(c);
    else if (c.localName === 'AlternateContent') {
      const [branch] = [...children(c, 'Fallback'), ...children(c, 'Choice')];
      out.push(...children(branch).filter((e) => SHAPES.has(e.localName)));
    }
  }
  return out;
}

/** Ausgeblendet über cNvPr@hidden des ersten nv*-Kinds. */
function isHidden(node: Element): boolean {
  const nv = children(node).find((c) => c.localName.startsWith('nv'));
  return isTrue(child(nv, 'cNvPr')?.getAttribute('hidden') ?? null);
}

/**
 * Blatt-Formen in der Reihenfolge von readDrawing. Gruppen ohne gültige Transformation
 * werden samt Kindern verworfen, Blatt-Formen ohne Anker und ohne a:xfrm ebenso.
 */
export function drawingLeaves(doc: Document, sheet: SheetModel): DrawingLeaf[] {
  const leaves: DrawingLeaf[] = [];
  const visit = (node: Element, groups: readonly Element[], anchor: Box | null): void => {
    if (isHidden(node)) return;
    if (node.localName === 'grpSp') {
      const x = readXfrmBoxes(child(child(node, 'grpSpPr'), 'xfrm'));
      if (!x?.chBox) return;
      const kept = hasArea(x.box) || (anchor !== null && hasArea(anchor) && hasArea(x.chBox));
      if (!kept) return;
      const inner = [...groups, node];
      for (const c of children(node)) if (SHAPES.has(c.localName)) visit(c, inner, null);
      return;
    }
    const xfrm =
      node.localName === 'graphicFrame' ? child(node, 'xfrm') : child(child(node, 'spPr'), 'xfrm');
    if (anchor === null && readXfrmBoxes(xfrm) === null) return;
    leaves.push({ node, groups });
  };
  for (const anchor of children(doc.documentElement)) {
    const box = anchorBox(anchor, sheet);
    for (const node of anchorShapes(anchor)) visit(node, [], box);
  }
  return leaves;
}

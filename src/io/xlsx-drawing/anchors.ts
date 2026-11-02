// Lage von Formen ohne Fläche (waagrechte bzw. senkrechte Linien) aus ihrem Zeichnungsanker (R-8.2-44,
// FINDINGS VQ-I2-01). `readDrawing` (Altmodul, R-L-11 unverändert) nimmt für eine Form der obersten Ebene den
// Anker nur, wenn er eine Fläche hat; sonst die <a:xfrm>, die nach geänderten Zeilenhöhen veraltet sein kann.
// Excel zeichnet die Linie am Anker. Diese Vorstufe setzt darum in einer Kopie der Zeichnung die xfrm solcher
// Linien (Verbinder bzw. Linien-Geometrie) auf den Anker (zwei Zellen, eine Zelle, absolut); Gruppen und alle
// übrigen Formen bleiben unberührt, auch eine gefüllte Form, deren Anker auf Höhe 0 fällt (CR-3-04).
import type { SheetModel } from './sheet';
import { child, children, num, numText } from './xml';

interface AnchorBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Ankerrechteck wie in `readDrawing` (Versatz höchstens bis zum Zellenende). */
function anchorBox(anchor: Element, sheet: SheetModel): AnchorBox | null {
  const point = (el: Element): readonly [number, number] => {
    const col = numText(child(el, 'col'));
    const row = numText(child(el, 'row'));
    const colOff = Math.min(numText(child(el, 'colOff')), sheet.colWidth(col));
    const rowOff = Math.min(numText(child(el, 'rowOff')), sheet.rowHeight(row));
    return [sheet.colX(col) + colOff, sheet.rowY(row) + rowOff];
  };
  const from = child(anchor, 'from');
  const to = child(anchor, 'to');
  const ext = child(anchor, 'ext');
  const pos = child(anchor, 'pos');
  if (anchor.localName === 'twoCellAnchor' && from !== undefined && to !== undefined) {
    const [ax, ay] = point(from);
    const [bx, by] = point(to);
    return {
      x0: Math.min(ax, bx),
      y0: Math.min(ay, by),
      x1: Math.max(ax, bx),
      y1: Math.max(ay, by),
    };
  }
  if (anchor.localName === 'oneCellAnchor' && from !== undefined && ext !== undefined) {
    const [x0, y0] = point(from);
    return { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') };
  }
  if (anchor.localName === 'absoluteAnchor' && pos !== undefined && ext !== undefined) {
    const x0 = num(pos, 'x');
    const y0 = num(pos, 'y');
    return { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') };
  }
  return null;
}

const SINGLE = new Set(['sp', 'cxnSp', 'pic', 'graphicFrame']);

/** Linie: Verbinder (cxnSp) oder Form mit Linien- bzw. Verbinder-Geometrie; gefüllte Flächen nie (CR-3-04). */
const LINE_GEOMETRY =
  /^(?:line|lineInv|straightConnector1|bentConnector[2-5]|curvedConnector[2-5])$/;

function isLine(node: Element): boolean {
  const prst = child(child(node, 'spPr'), 'prstGeom')?.getAttribute('prst') ?? '';
  return node.localName === 'cxnSp' || (node.localName === 'sp' && LINE_GEOMETRY.test(prst));
}

/** Einzelformen (keine Gruppen) eines Ankers, mc:AlternateContent wie in `readDrawing` (Fallback zuerst). */
function singleShapes(anchor: Element): Element[] {
  const out: Element[] = [];
  for (const c of children(anchor)) {
    if (SINGLE.has(c.localName)) out.push(c);
    else if (c.localName === 'AlternateContent') {
      const branch = child(c, 'Fallback') ?? child(c, 'Choice');
      out.push(...children(branch).filter((e) => SINGLE.has(e.localName)));
    }
  }
  return out;
}

/** Setzt die xfrm so, dass ihr gedrehtes Rechteck (Vierteldrehungen) genau das Ankerrechteck ist. */
function placeOnAnchor(xfrm: Element, box: AnchorBox): void {
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  if (off === undefined || ext === undefined) return;
  const turn = (((num(xfrm, 'rot') / 60000) % 180) + 180) % 180;
  if (turn !== 0 && turn !== 90) return;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // Bei 90° ist die gezeichnete Breite die Höhe der xfrm (Drehung um die Mitte).
  const [cx, cy] = turn === 0 ? [w, h] : [h, w];
  off.setAttribute('x', String((box.x0 + box.x1 - cx) / 2));
  off.setAttribute('y', String((box.y0 + box.y1 - cy) / 2));
  ext.setAttribute('cx', String(cx));
  ext.setAttribute('cy', String(cy));
}

/**
 * Kopie der Zeichnung, in der Einzelformen der obersten Ebene mit einem Anker ohne Fläche die Lage ihres Ankers
 * tragen. Die Reihenfolge und Anzahl der Formen bleibt gleich (Zuordnung über `WapShape.index`).
 */
export function anchorShapesWithoutArea(doc: Document, sheet: SheetModel): Document {
  const copy = doc.cloneNode(true) as Document;
  for (const anchor of children(copy.documentElement)) {
    const box = anchorBox(anchor, sheet);
    if (box === null || (box.x1 > box.x0 && box.y1 > box.y0)) continue;
    for (const node of singleShapes(anchor)) {
      // Nur Linien: eine gefüllte Form, deren Anker auf Höhe 0 fällt (z.B. ausgeblendete Zeile), bleibt (CR-3-04).
      if (!isLine(node)) continue;
      const xfrm = child(child(node, 'spPr'), 'xfrm');
      if (xfrm !== undefined) placeOnAnchor(xfrm, box);
    }
  }
  return copy;
}

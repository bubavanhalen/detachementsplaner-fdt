// DrawingML shape tree walk. Every leaf shape gets its visual bounding box in one
// common sheet space (EMU derived from the anchors), with group transforms composed
// (off/ext/chOff/chExt), rotation about the box centre and flips applied.
//
// Top-level positions come from the cell anchors (from/to), which Excel treats as
// authoritative; the top-level <a:xfrm> can be stale or zero. Inside a group only
// <a:xfrm> exists, so the group's xfrm box is mapped onto its anchor box.
import { drawingColor, type Rgb, type Theme } from './colors';
import type { SheetModel } from './sheet';
import { child, children, num, numText } from './xml';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface WapShape {
  /** Document order (stable for a given file). */
  index: number;
  name: string;
  kind: 'sp' | 'cxn' | 'pic' | 'other';
  /** prstGeom preset, e.g. "rect", "line", "sun", "moon". */
  geometry: string;
  /** Visual bounding box in sheet EMU. */
  box: Box;
  /** Text lines (paragraphs and line breaks), trimmed, empty ones kept as ''. */
  lines: string[];
  fill: Rgb | null;
  line: Rgb | null;
  /** Composed rotation in degrees (0 … 360). */
  rotation: number;
  /** bodyPr vert attribute (e.g. "vert270"). */
  vertical: string;
  groupDepth: number;
}

/** 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  // m · n (apply n first, then m)
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const scale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];

/** Rotation (clockwise, degrees) and flips about a centre point. */
export function aboutCentre(
  cx: number,
  cy: number,
  degrees: number,
  flipH = false,
  flipV = false,
): Matrix {
  const rad = (degrees * Math.PI) / 180;
  // Snap exact quarter turns to avoid floating noise in the swapped boxes.
  const snap = (v: number) =>
    Math.abs(v) < 1e-12 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-12 ? Math.sign(v) : v;
  const cos = snap(Math.cos(rad)),
    sin = snap(Math.sin(rad));
  const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
  const flip = scale(flipH ? -1 : 1, flipV ? -1 : 1);
  return multiply(translate(cx, cy), multiply(rotation, multiply(flip, translate(-cx, -cy))));
}

export function boundingBox(m: Matrix, box: Box): Box {
  const pts = [
    apply(m, box.x0, box.y0),
    apply(m, box.x1, box.y0),
    apply(m, box.x0, box.y1),
    apply(m, box.x1, box.y1),
  ];
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Maps box `from` onto box `to` per axis (scale + translate). */
export function boxToBox(from: Box, to: Box): Matrix {
  const w = from.x1 - from.x0,
    h = from.y1 - from.y0;
  const sx = w ? (to.x1 - to.x0) / w : 1,
    sy = h ? (to.y1 - to.y0) / h : 1;
  return multiply(translate(to.x0, to.y0), multiply(scale(sx, sy), translate(-from.x0, -from.y0)));
}

interface Xfrm {
  box: Box;
  rot: number;
  flipH: boolean;
  flipV: boolean;
  chBox?: Box;
}

function readXfrm(el: Element | undefined): Xfrm | null {
  if (!el) return null;
  const off = child(el, 'off'),
    ext = child(el, 'ext');
  if (!off || !ext) return null;
  const x = num(off, 'x'),
    y = num(off, 'y');
  const out: Xfrm = {
    box: { x0: x, y0: y, x1: x + num(ext, 'cx'), y1: y + num(ext, 'cy') },
    rot: num(el, 'rot') / 60000,
    flipH: /^(?:1|true)$/.test(el.getAttribute('flipH') ?? ''),
    flipV: /^(?:1|true)$/.test(el.getAttribute('flipV') ?? ''),
  };
  const chOff = child(el, 'chOff'),
    chExt = child(el, 'chExt');
  if (chOff && chExt) {
    const cx = num(chOff, 'x'),
      cy = num(chOff, 'y');
    out.chBox = { x0: cx, y0: cy, x1: cx + num(chExt, 'cx'), y1: cy + num(chExt, 'cy') };
  }
  return out;
}

const hasArea = (box: Box) => box.x1 - box.x0 > 0 && box.y1 - box.y0 > 0;
const centre = (box: Box): [number, number] => [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];

/** Rendering transform of a node in its parent space (rotation and flips about its centre). */
const nodeTransform = (x: Xfrm): Matrix =>
  x.rot || x.flipH || x.flipV ? aboutCentre(...centre(x.box), x.rot, x.flipH, x.flipV) : IDENTITY;

/** Visual (rotated) box of a node in its parent space. */
export const visualBox = (x: Xfrm): Box => boundingBox(nodeTransform(x), x.box);

type FillState = { kind: 'none' } | { kind: 'color'; rgb: Rgb } | { kind: 'unset' };

function fillFromProps(props: Element | undefined, inherited: Rgb | null, theme: Theme): FillState {
  for (const item of children(props)) {
    switch (item.localName) {
      case 'noFill':
        return { kind: 'none' };
      case 'solidFill': {
        const rgb = drawingColor(item.firstElementChild ?? undefined, theme);
        return rgb ? { kind: 'color', rgb } : { kind: 'none' };
      }
      case 'gradFill': {
        const stop = item.getElementsByTagNameNS('*', 'gs')[0];
        const rgb = drawingColor(stop?.firstElementChild ?? undefined, theme);
        return rgb ? { kind: 'color', rgb } : { kind: 'none' };
      }
      case 'pattFill': {
        const rgb = drawingColor(child(item, 'fgClr')?.firstElementChild ?? undefined, theme);
        return rgb ? { kind: 'color', rgb } : { kind: 'none' };
      }
      case 'grpFill':
        return inherited ? { kind: 'color', rgb: inherited } : { kind: 'none' };
      case 'blipFill':
        return { kind: 'none' };
      default:
    }
  }
  return { kind: 'unset' };
}

function styleColor(node: Element, ref: string, theme: Theme): Rgb | null {
  const r = child(child(node, 'style'), ref);
  if (!r || r.getAttribute('idx') === '0') return null;
  return drawingColor(r.firstElementChild ?? undefined, theme);
}

function textLines(node: Element): { lines: string[]; vertical: string } {
  const body = child(node, 'txBody');
  if (!body) return { lines: [], vertical: '' };
  const lines: string[] = [];
  for (const p of children(body, 'p')) {
    let current = '';
    const walk = (el: Element) => {
      for (const c of children(el)) {
        if (c.localName === 't') current += c.textContent ?? '';
        else if (c.localName === 'br') {
          lines.push(current);
          current = '';
        } else if (c.localName === 'r' || c.localName === 'fld') walk(c);
      }
    };
    walk(p);
    lines.push(current);
  }
  return {
    lines: lines.map((line) => line.replace(/[\s ]+/g, ' ').trim()),
    vertical: child(body, 'bodyPr')?.getAttribute('vert') ?? '',
  };
}

interface AnchorInfo {
  box: Box | null;
}

function anchorBox(anchor: Element, sheet: SheetModel): AnchorInfo {
  const point = (el: Element | undefined) => {
    const col = numText(child(el, 'col')),
      row = numText(child(el, 'row'));
    const colOff = Math.min(numText(child(el, 'colOff')), sheet.colWidth(col));
    const rowOff = Math.min(numText(child(el, 'rowOff')), sheet.rowHeight(row));
    return [sheet.colX(col) + colOff, sheet.rowY(row) + rowOff] as const;
  };
  if (anchor.localName === 'twoCellAnchor') {
    const from = child(anchor, 'from'),
      to = child(anchor, 'to');
    if (!from || !to) return { box: null };
    const [x0, y0] = point(from),
      [x1, y1] = point(to);
    return {
      box: {
        x0: Math.min(x0, x1),
        y0: Math.min(y0, y1),
        x1: Math.max(x0, x1),
        y1: Math.max(y0, y1),
      },
    };
  }
  if (anchor.localName === 'oneCellAnchor') {
    const from = child(anchor, 'from'),
      ext = child(anchor, 'ext');
    if (!from || !ext) return { box: null };
    const [x0, y0] = point(from);
    return { box: { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') } };
  }
  if (anchor.localName === 'absoluteAnchor') {
    const pos = child(anchor, 'pos'),
      ext = child(anchor, 'ext');
    if (!pos || !ext) return { box: null };
    const x0 = num(pos, 'x'),
      y0 = num(pos, 'y');
    return { box: { x0, y0, x1: x0 + num(ext, 'cx'), y1: y0 + num(ext, 'cy') } };
  }
  return { box: null };
}

const SHAPES = new Set(['sp', 'grpSp', 'cxnSp', 'pic', 'graphicFrame']);

/** Shape elements of an anchor, unwrapping mc:AlternateContent (Fallback preferred). */
function anchorShapes(anchor: Element): Element[] {
  const out: Element[] = [];
  for (const c of children(anchor)) {
    if (SHAPES.has(c.localName)) out.push(c);
    else if (c.localName === 'AlternateContent') {
      const branch = child(c, 'Fallback') ?? child(c, 'Choice');
      out.push(...children(branch).filter((e) => SHAPES.has(e.localName)));
    }
  }
  return out;
}

export function readDrawing(doc: Document, sheet: SheetModel, theme: Theme): WapShape[] {
  const shapes: WapShape[] = [];
  const visit = (
    node: Element,
    parent: Matrix,
    groupFill: Rgb | null,
    depth: number,
    anchor: Box | null,
    parentRotation: number,
  ) => {
    const nv = children(node).find((c) => c.localName.startsWith('nv'));
    const cNvPr = child(nv, 'cNvPr');
    if (/^(?:1|true)$/.test(cNvPr?.getAttribute('hidden') ?? '')) return;
    if (node.localName === 'grpSp') {
      const props = child(node, 'grpSpPr');
      const x = readXfrm(child(props, 'xfrm'));
      const fill = fillFromProps(props, groupFill, theme);
      const nextFill = fill.kind === 'color' ? fill.rgb : fill.kind === 'none' ? null : groupFill;
      let matrix: Matrix;
      if (x?.chBox && hasArea(x.box)) {
        const own = multiply(nodeTransform(x), boxToBox(x.chBox, x.box));
        // Top level: map the group's visual xfrm box onto its anchor box.
        const outer = anchor && hasArea(anchor) ? boxToBox(visualBox(x), anchor) : parent;
        matrix = anchor ? multiply(outer, own) : multiply(parent, own);
      } else if (x?.chBox && anchor && hasArea(anchor) && hasArea(x.chBox)) {
        matrix = boxToBox(x.chBox, anchor);
      } else return;
      for (const c of children(node))
        if (SHAPES.has(c.localName))
          visit(c, matrix, nextFill, depth + 1, null, parentRotation + (x?.rot ?? 0));
      return;
    }
    const props = child(node, 'spPr');
    const x =
      node.localName === 'graphicFrame'
        ? readXfrm(child(node, 'xfrm'))
        : readXfrm(child(props, 'xfrm'));
    let box: Box | null = null;
    if (anchor && hasArea(anchor)) box = anchor;
    else if (x) box = boundingBox(parent, visualBox(x));
    else if (anchor) box = anchor;
    if (!box) return;
    const fill = fillFromProps(props, groupFill, theme);
    const lineProps = child(props, 'ln');
    const lineFill = fillFromProps(lineProps, null, theme);
    const { lines, vertical } = textLines(node);
    shapes.push({
      index: shapes.length,
      name: cNvPr?.getAttribute('name') ?? '',
      kind:
        node.localName === 'sp'
          ? 'sp'
          : node.localName === 'cxnSp'
            ? 'cxn'
            : node.localName === 'pic'
              ? 'pic'
              : 'other',
      geometry: child(props, 'prstGeom')?.getAttribute('prst') ?? '',
      box,
      lines,
      fill:
        fill.kind === 'color'
          ? fill.rgb
          : fill.kind === 'none'
            ? null
            : node.localName === 'sp'
              ? styleColor(node, 'fillRef', theme)
              : null,
      line:
        lineFill.kind === 'color'
          ? lineFill.rgb
          : lineFill.kind === 'none'
            ? null
            : styleColor(node, 'lnRef', theme),
      rotation: (((parentRotation + (x?.rot ?? 0)) % 360) + 360) % 360,
      vertical,
      groupDepth: depth,
    });
  };
  for (const anchor of children(doc.documentElement)) {
    const { box } = anchorBox(anchor, sheet);
    for (const node of anchorShapes(anchor)) visit(node, IDENTITY, null, 0, box, 0);
  }
  return shapes;
}

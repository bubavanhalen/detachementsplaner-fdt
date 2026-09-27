import { strFromU8, unzipSync } from 'fflate';

/** A logo picture from the template header, for the print view and PDFs. */
export interface TbTemplateLogo {
  name: string;
  mime: 'image/png' | 'image/jpeg';
  data: Uint8Array;
  /** Position within the header row band of the day sheet. */
  align: 'left' | 'center' | 'right';
  widthMm: number;
  heightMm: number;
  /** Offset from the top of the logo band (template row 2). */
  topMm?: number;
}

const EMU_PER_MM = 36_000;
const EMU_PER_PT = 12_700;
const EMU_PER_PX = 9_525;
/** Template rows 1–10 form the header; pictures further down (signature) are not logos. */
const HEADER_ROWS = 10;
/** Header logo band: template row 2 (0-based row index 1). */
const LOGO_ROW = 1;
/** Content columns of a day sheet: B … E (0-based 1 … 4). */
const FIRST_COL = 1;
const LAST_COL = 4;
const SIGNATURE_MEDIA = 'xl/media/image2.png';

const parseXml = (text: string): Document =>
  new DOMParser().parseFromString(text, 'application/xml');
const elements = (root: Document | Element, name: string): Element[] =>
  Array.from(root.getElementsByTagNameNS('*', name));
const child = (element: Element | undefined, name: string): Element | undefined =>
  element ? Array.from(element.children).find((item) => item.localName === name) : undefined;
const intText = (element: Element | undefined): number =>
  Number.parseInt(element?.textContent ?? '', 10) || 0;
const numAttr = (element: Element | undefined, name: string): number | undefined => {
  const value = Number.parseFloat(element?.getAttribute(name) ?? '');
  return Number.isFinite(value) ? value : undefined;
};

/** Relationship attributes (r:id, r:embed) regardless of the namespace prefix/flavour. */
function relAttr(element: Element, name: string): string {
  for (const attr of Array.from(element.attributes))
    if (attr.localName === name && /relationships/i.test(attr.namespaceURI ?? ''))
      return attr.value;
  return '';
}

function resolvePath(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = fromPart.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment && segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

function relsPath(part: string): string {
  const index = part.lastIndexOf('/');
  return `${part.slice(0, index)}/_rels/${part.slice(index + 1)}.rels`;
}

function relationships(files: Record<string, Uint8Array>, part: string): Map<string, string> {
  const map = new Map<string, string>();
  const data = files[relsPath(part)];
  if (!data) return map;
  for (const rel of elements(parseXml(strFromU8(data)), 'Relationship')) {
    if (rel.getAttribute('TargetMode') === 'External') continue;
    const id = rel.getAttribute('Id'),
      target = rel.getAttribute('Target');
    if (id && target) map.set(id, resolvePath(part, target));
  }
  return map;
}

function imageMime(data: Uint8Array): TbTemplateLogo['mime'] | undefined {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return undefined;
}

/** Excel column width (characters) → EMU, using the default 7 px maximum digit width. */
const columnEmu = (width: number): number =>
  Math.trunc(((256 * width + Math.trunc(128 / 7)) / 256) * 7) * EMU_PER_PX;

function sheetGeometry(sheet: Document) {
  const format = elements(sheet, 'sheetFormatPr')[0];
  const defaultWidth =
    numAttr(format, 'defaultColWidth') ?? (numAttr(format, 'baseColWidth') ?? 8) + 0.7109375;
  const defaultHeight = numAttr(format, 'defaultRowHeight') ?? 15;
  const colWidths = new Map<number, number>();
  for (const col of elements(sheet, 'col')) {
    const min = numAttr(col, 'min') ?? 0,
      max = Math.min(numAttr(col, 'max') ?? min, LAST_COL + 1);
    const width = col.getAttribute('hidden') === '1' ? 0 : columnEmu(numAttr(col, 'width') ?? 0);
    for (let index = min; index <= max; index++) colWidths.set(index - 1, width);
  }
  const rowHeights = new Map<number, number>();
  for (const row of elements(sheet, 'row')) {
    const r = numAttr(row, 'r'),
      ht = numAttr(row, 'ht');
    if (r && r <= HEADER_ROWS + 1) rowHeights.set(r - 1, (ht ?? defaultHeight) * EMU_PER_PT);
  }
  const colX = (col: number): number => {
    let x = 0;
    for (let index = 0; index < col; index++) x += colWidths.get(index) ?? columnEmu(defaultWidth);
    return x;
  };
  const rowY = (row: number): number => {
    let y = 0;
    for (let index = 0; index < row; index++)
      y += rowHeights.get(index) ?? defaultHeight * EMU_PER_PT;
    return y;
  };
  return { colX, rowY };
}

interface AnchorBox {
  x: number;
  y: number;
  row: number;
  cx: number;
  cy: number;
}

function anchorBox(anchor: Element, geometry: ReturnType<typeof sheetGeometry>): AnchorBox | null {
  const pic = elements(anchor, 'pic')[0];
  const ext = child(child(child(pic, 'spPr'), 'xfrm'), 'ext');
  let cx = numAttr(ext, 'cx') ?? 0,
    cy = numAttr(ext, 'cy') ?? 0;
  if (anchor.localName === 'absoluteAnchor') {
    const pos = child(anchor, 'pos'),
      size = child(anchor, 'ext');
    cx ||= numAttr(size, 'cx') ?? 0;
    cy ||= numAttr(size, 'cy') ?? 0;
    const x = numAttr(pos, 'x') ?? 0,
      y = numAttr(pos, 'y') ?? 0;
    let row = 0;
    while (row < HEADER_ROWS + 1 && geometry.rowY(row + 1) <= y) row++;
    return cx > 0 && cy > 0 ? { x, y, row, cx, cy } : null;
  }
  const from = child(anchor, 'from');
  if (!from) return null;
  const col = intText(child(from, 'col')),
    row = intText(child(from, 'row'));
  const x = geometry.colX(col) + intText(child(from, 'colOff')),
    y = geometry.rowY(row) + intText(child(from, 'rowOff'));
  if (anchor.localName === 'oneCellAnchor') {
    const size = child(anchor, 'ext');
    cx ||= numAttr(size, 'cx') ?? 0;
    cy ||= numAttr(size, 'cy') ?? 0;
  }
  const to = child(anchor, 'to');
  if (to && (!cx || !cy)) {
    cx ||= geometry.colX(intText(child(to, 'col'))) + intText(child(to, 'colOff')) - x;
    cy ||= geometry.rowY(intText(child(to, 'row'))) + intText(child(to, 'rowOff')) - y;
  }
  return cx > 0 && cy > 0 ? { x, y, row, cx, cy } : null;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Extracts the header logos of the day sheet "Mo" (sheet → drawing → media). The signature
 * picture (xl/media/image2.png) and pictures below the header are excluded. Never throws:
 * an unreadable or unexpected template simply yields no logos.
 */
export function extractTemplateLogos(template: Uint8Array): TbTemplateLogo[] {
  try {
    return readLogos(unzipSync(template));
  } catch {
    return [];
  }
}

function readLogos(files: Record<string, Uint8Array>): TbTemplateLogo[] {
  const workbookPart = 'xl/workbook.xml';
  if (!files[workbookPart]) return [];
  const workbook = parseXml(strFromU8(files[workbookPart]));
  const sheets = elements(workbook, 'sheet');
  const preferred = ['mo', 'montag', 'di', 'mi', 'do', 'fr'];
  const sheet = preferred
    .map((name) => sheets.find((item) => item.getAttribute('name')?.trim().toLowerCase() === name))
    .find(Boolean);
  if (!sheet) return [];
  const sheetPart = relationships(files, workbookPart).get(relAttr(sheet, 'id'));
  if (!sheetPart || !files[sheetPart]) return [];
  const sheetXml = parseXml(strFromU8(files[sheetPart]));
  const drawingRef = elements(sheetXml, 'drawing')[0];
  const drawingPart = drawingRef
    ? relationships(files, sheetPart).get(relAttr(drawingRef, 'id'))
    : undefined;
  if (!drawingPart || !files[drawingPart]) return [];
  const drawing = parseXml(strFromU8(files[drawingPart]));
  const drawingRels = relationships(files, drawingPart);
  const geometry = sheetGeometry(sheetXml);
  const spanStart = geometry.colX(FIRST_COL),
    spanWidth = Math.max(1, geometry.colX(LAST_COL + 1) - spanStart),
    bandTop = geometry.rowY(LOGO_ROW);
  const anchors = ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor'].flatMap((name) =>
    elements(drawing, name),
  );
  const logos: (TbTemplateLogo & { x: number })[] = [];
  for (const anchor of anchors) {
    const blip = elements(anchor, 'blip')[0];
    const media = blip ? drawingRels.get(relAttr(blip, 'embed')) : undefined;
    if (!media || media === SIGNATURE_MEDIA || !files[media]) continue;
    const box = anchorBox(anchor, geometry);
    if (!box || box.row >= HEADER_ROWS) continue;
    const data = files[media],
      mime = imageMime(data);
    if (!mime) continue;
    const center = (box.x + box.cx / 2 - spanStart) / spanWidth;
    logos.push({
      name: media.split('/').pop() ?? media,
      mime,
      data,
      align: center < 1 / 3 ? 'left' : center > 2 / 3 ? 'right' : 'center',
      widthMm: round(box.cx / EMU_PER_MM),
      heightMm: round(box.cy / EMU_PER_MM),
      topMm: round(Math.max(0, box.y - bandTop) / EMU_PER_MM),
      x: box.x,
    });
  }
  return logos.sort((a, b) => a.x - b.x).map(({ x: _x, ...logo }) => logo);
}

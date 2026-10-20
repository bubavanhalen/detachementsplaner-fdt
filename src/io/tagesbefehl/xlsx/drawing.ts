// Signature picture: find it via the drawing relationships and move its anchor
// into the two empty rows between "Einheit" and "Name" of a rebuilt day sheet.
// Coat of arms: optionally shown in place of the right-hand header logo.
import {
  type PackageFiles,
  partRels,
  readPart,
  relsPathFor,
  relTypeIs,
  writePart,
} from './package';

const EMU_PER_POINT = 12_700;
/** Aspect of the template's signature picture (1026 × 302 px). */
export const TEMPLATE_SIGNATURE_ASPECT = 1026 / 302;
/** Signature box: at most this wide (column D is ≈ 1.28 M EMU) and this tall. */
const MAX_WIDTH_EMU = 1_150_000;
const MARGIN_EMU = 15_000;

export function pngSize(bytes: Uint8Array | undefined): { width: number; height: number } | null {
  if (!bytes || bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  return width && height ? { width, height } : null;
}
export const isPng = (bytes: Uint8Array | undefined): boolean => pngSize(bytes) !== null;

export interface SheetDrawing {
  path: string;
  /** rIds of image relationships targeting the signature media part. */
  signatureRids: Set<string>;
}

/** Drawing part of a worksheet and the rIds pointing at `mediaPath`. */
export function sheetDrawing(
  files: PackageFiles,
  sheetPath: string,
  mediaPath: string,
): SheetDrawing | null {
  const rel = partRels(files, sheetPath).find((r) => relTypeIs(r, 'drawing') && r.path);
  if (!rel?.path || !files[rel.path]) return null;
  const signatureRids = new Set(
    partRels(files, rel.path)
      .filter((r) => relTypeIs(r, 'image') && r.path === mediaPath)
      .map((r) => r.id),
  );
  return { path: rel.path, signatureRids };
}

/** Media part used by the signature picture: image2.png as in the template. */
export function signatureMediaPath(files: PackageFiles, sheetPaths: string[]): string | null {
  const preferred = 'xl/media/image2.png';
  for (const sheet of sheetPaths) {
    const drawing = sheetDrawing(files, sheet, preferred);
    if (drawing?.signatureRids.size) return preferred;
  }
  // Fallback for re-saved templates: the picture anchored in column D below the header.
  for (const sheet of sheetPaths) {
    const rel = partRels(files, sheet).find((r) => relTypeIs(r, 'drawing') && r.path);
    if (!rel?.path) continue;
    const xml = readPart(files, rel.path) ?? '';
    const prefix = drawingPrefix(xml);
    const images = partRels(files, rel.path).filter((r) => relTypeIs(r, 'image'));
    for (const anchor of anchors(xml, prefix)) {
      const from = new RegExp(
        `<${prefix}from>\\s*<${prefix}col>(\\d+)</${prefix}col>[\\s\\S]*?<${prefix}row>(\\d+)</${prefix}row>`,
      ).exec(anchor);
      const embed = /r:embed="([^"]+)"/.exec(anchor)?.[1];
      if (!from || !embed || Number(from[1]) !== 3 || Number(from[2]) < 10) continue;
      const image = images.find((r) => r.id === embed);
      if (image?.path && files[image.path]) return image.path;
    }
  }
  return null;
}

function drawingPrefix(xml: string): string {
  const m = /<(?:(\w+):)?wsDr\b/.exec(xml);
  return m?.[1] ? `${m[1]}:` : '';
}
function anchors(xml: string, prefix: string): string[] {
  return [
    ...xml.matchAll(
      new RegExp(
        `<${prefix}(twoCellAnchor|oneCellAnchor)\\b[\\s\\S]*?</${prefix}(?:twoCellAnchor|oneCellAnchor)>`,
        'g',
      ),
    ),
  ].map((m) => m[0]);
}

export interface SignaturePlacement {
  /** 1-based row of the "Einheit" line; the picture fills the next two rows. */
  unitRow: number;
  aspect: number;
  rowHeightPt: number;
}

/** Moves every anchor that shows the signature into the placement box. */
export function placeSignature(
  xml: string,
  signatureRids: Set<string>,
  placement: SignaturePlacement,
): string {
  if (!signatureRids.size) return xml;
  const prefix = drawingPrefix(xml);
  const p = prefix;
  const rowEmu = Math.round(placement.rowHeightPt * EMU_PER_POINT);
  const boxHeight = 2 * rowEmu;
  let height = boxHeight - 2 * MARGIN_EMU;
  let width = Math.round(height * placement.aspect);
  if (width > MAX_WIDTH_EMU) {
    width = MAX_WIDTH_EMU;
    height = Math.round(width / placement.aspect);
  }
  const top = Math.round((boxHeight - height) / 2);
  const firstRow = placement.unitRow; // 0-based index of the row after the unit row
  const bottom = top + height;
  const toRow = firstRow + Math.floor(bottom / rowEmu);
  const toOff = bottom % rowEmu;
  const marker = (tag: string, col: number, colOff: number, row: number, rowOff: number) =>
    `<${p}${tag}><${p}col>${col}</${p}col><${p}colOff>${colOff}</${p}colOff><${p}row>${row}</${p}row><${p}rowOff>${rowOff}</${p}rowOff></${p}${tag}>`;
  const re = new RegExp(
    `<${p}(twoCellAnchor|oneCellAnchor)\\b[\\s\\S]*?</${p}(?:twoCellAnchor|oneCellAnchor)>`,
    'g',
  );
  return xml.replace(re, (anchor, kind: string) => {
    const embed = /r:embed="([^"]+)"/.exec(anchor)?.[1];
    if (!embed || !signatureRids.has(embed)) return anchor;
    let next = anchor.replace(
      new RegExp(`<${p}from>[\\s\\S]*?</${p}from>`),
      marker('from', 3, 0, firstRow, top),
    );
    if (kind === 'twoCellAnchor')
      next = next.replace(
        new RegExp(`<${p}to>[\\s\\S]*?</${p}to>`),
        marker('to', 3, width, toRow, toOff),
      );
    else
      next = next.replace(
        new RegExp(`<${p}ext\\b[^>]*/>`),
        `<${p}ext cx="${width}" cy="${height}"/>`,
      );
    return next.replace(/<a:ext\b[^>]*cx="\d+"[^>]*\/>/, `<a:ext cx="${width}" cy="${height}"/>`);
  });
}

export function updateDrawing(
  files: PackageFiles,
  drawing: SheetDrawing,
  placement: SignaturePlacement,
): void {
  const xml = readPart(files, drawing.path);
  if (xml) writePart(files, drawing.path, placeSignature(xml, drawing.signatureRids, placement));
}

// ---------------------------------------------------------------------------
// Coat of arms in place of the template's right-hand header logo.

const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
/** Template rows 1–10 (0-based 0–9) form the header; pictures there are logos. */
const HEADER_ROWS = 10;
/** The right-hand logo starts in column D or further right (0-based 3). */
const RIGHT_LOGO_MIN_COL = 3;

interface Marker {
  col: number;
  colOff: number;
  row: number;
  rowOff: number;
}

function readMarker(anchor: string, p: string, tag: string): Marker | null {
  const body = new RegExp(`<${p}${tag}>([\\s\\S]*?)</${p}${tag}>`).exec(anchor)?.[1];
  if (!body) return null;
  const n = (name: string) =>
    Number(new RegExp(`<${p}${name}>(-?\\d+)</${p}${name}>`).exec(body)?.[1] ?? Number.NaN);
  const marker = { col: n('col'), colOff: n('colOff'), row: n('row'), rowOff: n('rowOff') };
  return Object.values(marker).every(Number.isFinite) ? marker : null;
}

/** Box of a picture in EMU: from the markers where they share a cell, else its stated size. */
function anchorSize(anchor: string, p: string, from: Marker): { cx: number; cy: number } | null {
  const to = readMarker(anchor, p, 'to');
  const stated =
    new RegExp(`<${p}ext\\b[^>]*cx="(\\d+)"[^>]*cy="(\\d+)"`).exec(anchor) ??
    /<a:ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(anchor);
  const cx = to && to.col === from.col ? to.colOff - from.colOff : Number(stated?.[1]);
  const cy = to && to.row === from.row ? to.rowOff - from.rowOff : Number(stated?.[2]);
  return cx > 0 && cy > 0 ? { cx, cy } : null;
}

/** Relationship target of `path` as seen from `part` (both package paths). */
function relativeTarget(part: string, path: string): string {
  const from = part.split('/').slice(0, -1),
    to = path.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/');
}

export interface WappenPlacement {
  /** Package path of the coat of arms picture, e.g. xl/media/wappen.png. */
  mediaPath: string;
  /** Signature media part; never treated as a logo. */
  signatureMedia: string | null;
  size: { width: number; height: number };
}

/**
 * Shows the coat of arms instead of the right-most header logo of a drawing. The
 * picture gets its own relationship, so the template's logo part stays as it is, and
 * a one-cell anchor at the top right of the logo's box, scaled to fit the box with
 * its own aspect ratio. Returns false when the drawing has no such logo.
 */
export function placeWappen(
  files: PackageFiles,
  drawingPath: string,
  placement: WappenPlacement,
): boolean {
  const xml = readPart(files, drawingPath);
  if (!xml) return false;
  const p = drawingPrefix(xml);
  const images = partRels(files, drawingPath).filter((r) => relTypeIs(r, 'image'));
  let best: { anchor: string; from: Marker } | undefined;
  for (const anchor of anchors(xml, p)) {
    const from = readMarker(anchor, p, 'from');
    const embed = /r:embed="([^"]+)"/.exec(anchor)?.[1];
    const image = images.find((r) => r.id === embed);
    if (!from || !image?.path || image.path === placement.signatureMedia) continue;
    if (from.row >= HEADER_ROWS || from.col < RIGHT_LOGO_MIN_COL) continue;
    if (
      !best ||
      from.col > best.from.col ||
      (from.col === best.from.col && from.colOff > best.from.colOff)
    )
      best = { anchor, from };
  }
  if (!best) return false;
  const box = anchorSize(best.anchor, p, best.from);
  const pic = new RegExp(`<${p}pic>[\\s\\S]*?</${p}pic>`).exec(best.anchor)?.[0];
  if (!box || !pic) return false;

  const relsPath = relsPathFor(drawingPath);
  const relsXml = readPart(files, relsPath);
  if (!relsXml) return false;
  let rid = 'rIdWappen';
  for (let n = 2; relsXml.includes(`Id="${rid}"`); n++) rid = `rIdWappen${n}`;
  const target = relativeTarget(drawingPath, placement.mediaPath);
  writePart(
    files,
    relsPath,
    relsXml.replace(
      /<\/Relationships>\s*$/,
      `<Relationship Id="${rid}" Type="${IMAGE_REL}" Target="${target}"/></Relationships>`,
    ),
  );

  const { size } = placement;
  const scale = Math.min(box.cx / size.width, box.cy / size.height);
  const width = Math.max(1, Math.round(size.width * scale)),
    height = Math.max(1, Math.round(size.height * scale));
  // Right aligned while the box lies within one column, so the offset stays in that cell.
  const to = readMarker(best.anchor, p, 'to');
  const dx = !to || to.col === best.from.col ? box.cx - width : 0;
  const { col, colOff, row, rowOff } = best.from;
  const from = `<${p}from><${p}col>${col}</${p}col><${p}colOff>${colOff + dx}</${p}colOff><${p}row>${row}</${p}row><${p}rowOff>${rowOff}</${p}rowOff></${p}from>`;
  const picture = pic
    .replace(/r:embed="[^"]+"/, `r:embed="${rid}"`)
    .replace(
      /(<a:off\b[^>]*\bx=")(\d+)"/,
      (_, head: string, x: string) => `${head}${Number(x) + dx}"`,
    )
    .replace(/<a:ext\b[^>]*\bcx="\d+"[^>]*\/>/, `<a:ext cx="${width}" cy="${height}"/>`);
  const clientData =
    new RegExp(`<${p}clientData\\b[^>]*?(?:/>|>[\\s\\S]*?</${p}clientData>)`).exec(
      best.anchor,
    )?.[0] ?? `<${p}clientData/>`;
  writePart(
    files,
    drawingPath,
    xml.replace(
      best.anchor,
      `<${p}oneCellAnchor>${from}<${p}ext cx="${width}" cy="${height}"/>${picture}${clientData}</${p}oneCellAnchor>`,
    ),
  );
  return true;
}

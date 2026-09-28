// Signature picture: find it via the drawing relationships and move its anchor
// into the two empty rows between "Einheit" and "Name" of a rebuilt day sheet.
import { type PackageFiles, partRels, readPart, relTypeIs, writePart } from './package';

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

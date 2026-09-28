import { zipSync } from 'fflate';
import { PDFDocument, type PDFImage, rgb, StandardFonts } from 'pdf-lib';
import { swissDate, weekFileLabel } from '../../model/tagesbefehl/state';
import { TB_WEEKDAY_NAMES, type TbOrder, type TbSettings } from '../../model/tagesbefehl/types';
import {
  layoutOrder,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  pdfText,
  type SheetBox,
  textBaseline,
} from './sheet-layout';
import type { TbTemplateLogo } from './template';

export interface TbPdfAssets {
  logos: TbTemplateLogo[];
  signature?: Uint8Array;
}

export interface TbPdfOptions {
  /** Creation date written to the metadata (defaults to now). */
  now?: Date;
}

/** Neutral producer/creator: no library URLs, user names or machine details. */
const APP_NAME = 'WK Util Suite';

/** 01_Mo.pdf … 07_So.pdf — weekday index, not the TB number. */
export function pdfFileName(order: Pick<TbOrder, 'index' | 'day'>): string {
  return `${String(order.index).padStart(2, '0')}_${order.day}.pdf`;
}

/** "Tagesbefehl Nr 3 – Mittwoch, 30.09.2026" (date omitted while the week has none). */
export function pdfTitle(order: Pick<TbOrder, 'number' | 'day' | 'date'>): string {
  const date = order.date ? `, ${swissDate(order.date)}` : '';
  return `Tagesbefehl Nr ${order.number} – ${TB_WEEKDAY_NAMES[order.day]}${date}`;
}

const fileSafe = (value: string): string =>
  value
    .trim()
    .replace(/[^\wÄÖÜäöü-]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** Tagesbefehle_KVK_FDT_2026_PDF.zip */
export function pdfZipName(sheet: string, settings: Pick<TbSettings, 'dienstleistung'>): string {
  return ['Tagesbefehle', weekFileLabel(sheet), fileSafe(settings.dienstleistung), 'PDF']
    .filter(Boolean)
    .join('_')
    .concat('.zip');
}

const isPng = (data: Uint8Array): boolean =>
  data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
const isJpeg = (data: Uint8Array): boolean =>
  data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

async function embedImage(doc: PDFDocument, data: Uint8Array, what: string): Promise<PDFImage> {
  try {
    if (isPng(data)) return await doc.embedPng(data);
    if (isJpeg(data)) return await doc.embedJpg(data);
  } catch {
    // Fall through to the generic message; details could contain file data.
  }
  throw new Error(`${what} konnte nicht in das PDF übernommen werden (PNG oder JPEG erwartet).`);
}

/** PDF y axis starts at the bottom of the page. */
const pdfY = (top: number, height = 0): number => PAGE_HEIGHT - top - height;

/** Scales the picture into the box, keeping its aspect ratio (left aligned, centred vertically). */
function contain(box: SheetBox, image: PDFImage): SheetBox {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale,
    height = image.height * scale;
  return { x: box.x, top: box.top + (box.height - height) / 2, width, height };
}

/** One A4 portrait page per order, text drawn with the standard Helvetica fonts (selectable). */
export async function buildDayPdf(
  order: TbOrder,
  assets: TbPdfAssets,
  options: TbPdfOptions = {},
): Promise<Uint8Array> {
  const layout = layoutOrder(order, assets.logos);
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(pdfTitle(order), { showInWindowTitleBar: true });
  if (order.signature.name.trim()) doc.setAuthor(order.signature.name.trim());
  doc.setCreator(APP_NAME);
  doc.setProducer(APP_NAME);
  doc.setLanguage('de-CH');
  doc.setCreationDate(options.now ?? new Date());

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const box of layout.logos) {
    const image = await embedImage(doc, assets.logos[box.index].data, 'Ein Logo der Vorlage');
    page.drawImage(image, {
      x: box.x,
      y: pdfY(box.top, box.height),
      width: box.width,
      height: box.height,
    });
  }
  for (const bar of layout.bars)
    page.drawRectangle({
      x: bar.x,
      y: pdfY(bar.top, bar.height),
      width: bar.width,
      height: bar.height,
      color: rgb(0, 0, 0),
    });
  if (assets.signature?.length) {
    const image = await embedImage(doc, assets.signature, 'Die Unterschrift');
    const box = contain(layout.signature, image);
    page.drawImage(image, {
      x: box.x,
      y: pdfY(box.top, box.height),
      width: box.width,
      height: box.height,
    });
  }
  for (const row of layout.rows)
    for (const cell of row.cells) {
      const font = cell.bold ? bold : regular;
      cell.lines.forEach((line, index) => {
        const text = pdfText(line);
        if (!text.trim()) return;
        const width = font.widthOfTextAtSize(text, cell.size);
        page.drawText(text, {
          x: cell.align === 'right' ? cell.x + cell.width - width : cell.x,
          y: pdfY(textBaseline(cell, index)),
          size: cell.size,
          font,
          color: cell.color === 'white' ? rgb(1, 1, 1) : rgb(0, 0, 0),
        });
      });
    }
  return doc.save();
}

/** Zip with the per-day PDFs (01_Mo.pdf …) directly at its root. */
export async function buildPdfZip(
  orders: TbOrder[],
  assets: TbPdfAssets,
  options: TbPdfOptions = {},
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const order of [...orders].sort((a, b) => a.index - b.index))
    files[pdfFileName(order)] = await buildDayPdf(order, assets, options);
  return zipSync(files, { level: 6, ...(options.now ? { mtime: options.now } : {}) });
}

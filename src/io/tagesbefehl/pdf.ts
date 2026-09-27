import type { TbOrder } from '../../model/tagesbefehl/types';
import type { TbTemplateLogo } from './template';

export interface TbPdfAssets {
  logos: TbTemplateLogo[];
  signature?: Uint8Array;
}

/** 01_Mo.pdf … 07_So.pdf — weekday index, not the TB number. */
export function pdfFileName(order: Pick<TbOrder, 'index' | 'day'>): string {
  return `${String(order.index).padStart(2, '0')}_${order.day}.pdf`;
}

/** One A4 portrait page per order. STUB — print/PDF work package. */
export async function buildDayPdf(_order: TbOrder, _assets: TbPdfAssets): Promise<Uint8Array> {
  throw new Error('PDF-Export noch nicht verfügbar.');
}

/** Zip with the per-day PDFs at its root. STUB — print/PDF work package. */
export async function buildPdfZip(_orders: TbOrder[], _assets: TbPdfAssets): Promise<Uint8Array> {
  throw new Error('PDF-Export noch nicht verfügbar.');
}

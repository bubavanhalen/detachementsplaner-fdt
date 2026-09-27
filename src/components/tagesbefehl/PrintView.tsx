import type { ReactNode } from 'react';
import { pdfFileName } from '../../io/tagesbefehl/pdf';
import type { TbTemplateLogo } from '../../io/tagesbefehl/template';
import { dayIndex } from '../../model/tagesbefehl/state';
import type { TbOrder, TbWeekday } from '../../model/tagesbefehl/types';
import OrderSheet from './OrderSheet';
import './order-sheet.css';

export interface PrintViewProps {
  orders: TbOrder[];
  logos: TbTemplateLogo[];
  /** Object URL / data URL of the prepared signature PNG. */
  signatureUrl?: string;
  /** Optional controls above each sheet (e.g. "Drucken", "PDF"); never printed. */
  sheetActions?: (order: TbOrder) => ReactNode;
}

/** Class on <html> while printOrders() runs; order-sheet.css then prints only the sheets. */
export const TB_PRINT_CLASS = 'tb-print';
/** Attribute on <html> restricting the print to one weekday. */
export const TB_PRINT_DAY_ATTRIBUTE = 'data-tb-print-day';
/** Zero page margin only during a Tagesbefehl print (other prints keep their margins). */
const PAGE_RULE = '@page { size: A4 portrait; margin: 0; }';

/** All sheets of a week, one A4 page each. Must be mounted when printOrders() is called. */
export default function PrintView({ orders, logos, signatureUrl, sheetActions }: PrintViewProps) {
  return (
    <div className="tb-print-root">
      {orders.length ? (
        orders.map((order) => (
          <div key={order.day} className="tb-print-page" data-day={order.day}>
            {sheetActions ? <div className="tb-sheet-actions">{sheetActions(order)}</div> : null}
            <OrderSheet order={order} logos={logos} signatureUrl={signatureUrl} />
          </div>
        ))
      ) : (
        <p className="tb-print-empty">Keine Tagesbefehle für diese Woche.</p>
      )}
    </div>
  );
}

let activeCleanup: (() => void) | undefined;

/**
 * Prints all mounted sheets, or only the sheet of `day`. Sets `tb-print` (and
 * `data-tb-print-day`) on <html>, calls window.print() and restores everything on
 * `afterprint`. For a single day the document title becomes e.g. "03_Mi", which browsers
 * propose as file name when saving as PDF.
 */
export function printOrders(day?: TbWeekday): void {
  activeCleanup?.();
  const root = document.documentElement,
    previousTitle = document.title;
  const style = document.createElement('style');
  style.setAttribute('data-tb-print', '');
  style.textContent = PAGE_RULE;
  document.head.append(style);
  root.classList.add(TB_PRINT_CLASS);
  if (day) {
    root.setAttribute(TB_PRINT_DAY_ATTRIBUTE, day);
    document.title = pdfFileName({ index: dayIndex(day), day }).replace(/\.pdf$/, '');
  } else root.removeAttribute(TB_PRINT_DAY_ATTRIBUTE);

  const cleanup = () => {
    if (activeCleanup !== cleanup) return;
    activeCleanup = undefined;
    window.removeEventListener('afterprint', cleanup);
    root.classList.remove(TB_PRINT_CLASS);
    root.removeAttribute(TB_PRINT_DAY_ATTRIBUTE);
    style.remove();
    document.title = previousTitle;
  };
  activeCleanup = cleanup;
  window.addEventListener('afterprint', cleanup);
  try {
    window.print();
  } catch {
    cleanup();
  }
}

// Print view: HTML replica of the day sheets and the print trigger. Fictional data only.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderSheet from '../src/components/tagesbefehl/OrderSheet';
import PrintView, {
  printOrders,
  TB_PRINT_CLASS,
  TB_PRINT_DAY_ATTRIBUTE,
} from '../src/components/tagesbefehl/PrintView';
import { layoutOrder } from '../src/io/tagesbefehl/sheet-layout';
import type { TbTemplateLogo } from '../src/io/tagesbefehl/template';
import { TB_WEEKDAYS } from '../src/model/tagesbefehl/types';
import { fictionalOrder, makePng } from './tb-fixtures';

const logos: TbTemplateLogo[] = [
  {
    name: 'links.png',
    mime: 'image/png',
    data: makePng(8, 2),
    align: 'left',
    widthMm: 54,
    heightMm: 11,
    topMm: 2,
  },
  {
    name: 'rechts.png',
    mime: 'image/png',
    data: makePng(4, 4),
    align: 'right',
    widthMm: 27,
    heightMm: 23,
  },
];
const SIGNATURE = 'data:image/png;base64,AAAA';

afterEach(() => {
  document.documentElement.classList.remove(TB_PRINT_CLASS);
  document.documentElement.removeAttribute(TB_PRINT_DAY_ATTRIBUTE);
  window.dispatchEvent(new Event('afterprint'));
});

describe('OrderSheet', () => {
  it('renders every block of the order in template order', () => {
    const order = fictionalOrder('Mi');
    render(<OrderSheet order={order} logos={logos} signatureUrl={SIGNATURE} />);
    const sheet = screen.getByRole('article', { name: order.title });
    expect(sheet).toHaveAttribute('data-day', 'Mi');
    const rows = Array.from(sheet.querySelectorAll<HTMLElement>('.tb-row'));
    const kinds = rows.map((row) => row.dataset.kind);
    const blockKinds = order.blocks.map((block) => block.kind);
    expect(kinds.filter((kind) => ['section', 'group', 'entry'].includes(kind ?? ''))).toEqual(
      blockKinds,
    );
    const entryRows = rows.filter((row) => row.dataset.kind === 'entry');
    expect(entryRows.map((row) => row.dataset.entryId)).toEqual(
      order.blocks.flatMap((block) => (block.kind === 'entry' ? [block.entryId] : [])),
    );
    const text = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('.tb-line'))
        .map((line) => line.textContent)
        .join(' ');
    for (const [index, block] of order.blocks.filter((b) => b.kind === 'entry').entries()) {
      if (block.kind !== 'entry') continue;
      const cells = entryRows[index].querySelectorAll<HTMLElement>('.tb-cell');
      expect(Array.from(cells).map((cell) => cell.dataset.column)).toEqual(['B', 'C', 'D', 'E']);
      expect(text(cells[0] as HTMLElement)).toBe(block.zeit);
      expect(text(cells[1] as HTMLElement)).toBe(block.taetigkeit);
      expect(text(cells[2] as HTMLElement)).toBe(block.verantwortlich);
      expect(text(cells[3] as HTMLElement)).toBe(block.ort);
    }
    for (const heading of order.blocks.flatMap((b) => (b.kind === 'entry' ? [] : [b.heading])))
      expect(within(sheet).getByText(heading)).toBeInTheDocument();
    for (const value of [
      'Kdt Inf Ustü Kp 99/9',
      'Tagesbefehl',
      order.title,
      order.lk,
      'Tagesoffizier',
      'Oblt Muster Max',
      '000 000 00 00',
      'Hptm Beispiel Hans',
      'Kommandant',
      'Geht an',
      'Kader Inf Ustü Kp 99/9',
      '(via Anschlag)',
      'z K an',
      'Kdt Inf Bat 99',
    ])
      expect(within(sheet).getAllByText(value).length).toBeGreaterThan(0);
  });

  it('uses the same line breaks and font size as the PDF layout', () => {
    const order = fictionalOrder('Mi');
    const layout = layoutOrder(order, logos);
    render(<OrderSheet order={order} logos={logos} />);
    const sheet = screen.getByRole('article');
    expect(sheet).toHaveAttribute('data-font-size', String(layout.fontSize));
    const wrapped = sheet.querySelector('[data-entry-id="Mi-4"] [data-column="C"]');
    const expected = layout.rows
      .find((row) => row.entryId === 'Mi-4')
      ?.cells.find((cell) => cell.column === 'C')?.lines;
    expect(expected && expected.length > 1).toBe(true);
    expect(
      Array.from(wrapped?.querySelectorAll('.tb-line') ?? []).map((line) => line.textContent),
    ).toEqual(expected);
  });

  it('shows the logos as data URLs and the signature when present', () => {
    const { rerender } = render(
      <OrderSheet order={fictionalOrder('Mo')} logos={logos} signatureUrl={SIGNATURE} />,
    );
    const images = Array.from(document.querySelectorAll('img'));
    expect(images.filter((img) => img.classList.contains('tb-sheet-logo'))).toHaveLength(2);
    for (const img of images.filter((i) => i.classList.contains('tb-sheet-logo')))
      expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByAltText('Unterschrift')).toHaveAttribute('src', SIGNATURE);
    rerender(<OrderSheet order={fictionalOrder('Mo')} logos={[]} />);
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders weekend orders with the Wacht Of line and without Rapporte', () => {
    render(<OrderSheet order={fictionalOrder('So')} logos={[]} />);
    const sheet = screen.getByRole('article');
    expect(within(sheet).getByText('Wochenend Wacht Of')).toBeInTheDocument();
    expect(within(sheet).getByText('Wacht Of Kp 99/8')).toBeInTheDocument();
    expect(within(sheet).queryByText('3 Rapporte')).not.toBeInTheDocument();
  });
});

describe('PrintView', () => {
  it('renders one A4 sheet per order with optional per-sheet actions', () => {
    const orders = TB_WEEKDAYS.map((day) => fictionalOrder(day));
    render(
      <PrintView
        orders={orders}
        logos={logos}
        signatureUrl={SIGNATURE}
        sheetActions={(order) => <button type="button">PDF {order.day}</button>}
      />,
    );
    expect(screen.getAllByRole('article').map((sheet) => sheet.dataset.day)).toEqual([
      ...TB_WEEKDAYS,
    ]);
    expect(screen.getByRole('button', { name: 'PDF Mi' })).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('.tb-print-page')).map(
        (page) => page.dataset.day,
      ),
    ).toEqual([...TB_WEEKDAYS]);
  });

  it('states when there is nothing to print', () => {
    render(<PrintView orders={[]} logos={[]} />);
    expect(screen.getByText('Keine Tagesbefehle für diese Woche.')).toBeInTheDocument();
  });
});

describe('printOrders', () => {
  it('marks the document for printing all sheets and cleans up after printing', () => {
    const root = document.documentElement;
    const title = document.title;
    let during: { cls: boolean; day: string | null; page: boolean } | undefined;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      during = {
        cls: root.classList.contains(TB_PRINT_CLASS),
        day: root.getAttribute(TB_PRINT_DAY_ATTRIBUTE),
        page: Boolean(document.querySelector('style[data-tb-print]')?.textContent?.includes('A4')),
      };
    });
    render(<PrintView orders={[fictionalOrder('Mo')]} logos={[]} />);
    printOrders();
    expect(print).toHaveBeenCalledTimes(1);
    expect(during).toEqual({ cls: true, day: null, page: true });
    window.dispatchEvent(new Event('afterprint'));
    expect(root.classList.contains(TB_PRINT_CLASS)).toBe(false);
    expect(document.querySelector('style[data-tb-print]')).toBeNull();
    expect(document.title).toBe(title);
  });

  it('restricts the print to one day and names it like the PDF', () => {
    const root = document.documentElement;
    const title = document.title;
    let during: { day: string | null; title: string } | undefined;
    vi.spyOn(window, 'print').mockImplementation(() => {
      during = { day: root.getAttribute(TB_PRINT_DAY_ATTRIBUTE), title: document.title };
    });
    printOrders('Mi');
    expect(during).toEqual({ day: 'Mi', title: '03_Mi' });
    window.dispatchEvent(new Event('afterprint'));
    expect(root.hasAttribute(TB_PRINT_DAY_ATTRIBUTE)).toBe(false);
    expect(root.classList.contains(TB_PRINT_CLASS)).toBe(false);
    expect(document.title).toBe(title);
  });

  it('cleans up immediately when printing fails and resets a pending print', () => {
    const root = document.documentElement;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    printOrders('Fr');
    expect(root.getAttribute(TB_PRINT_DAY_ATTRIBUTE)).toBe('Fr');
    print.mockImplementation(() => {
      throw new Error('blocked');
    });
    printOrders();
    expect(root.classList.contains(TB_PRINT_CLASS)).toBe(false);
    expect(root.hasAttribute(TB_PRINT_DAY_ATTRIBUTE)).toBe(false);
    expect(document.querySelectorAll('style[data-tb-print]')).toHaveLength(0);
  });
});

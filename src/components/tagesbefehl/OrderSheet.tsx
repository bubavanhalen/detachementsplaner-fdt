import { type CSSProperties, useMemo } from 'react';
import { toBase64 } from '../../io/tagesbefehl/bytes';
import { layoutOrder, type SheetBox } from '../../io/tagesbefehl/sheet-layout';
import type { TbTemplateLogo } from '../../io/tagesbefehl/template';
import type { TbOrder } from '../../model/tagesbefehl/types';
import './order-sheet.css';

export interface OrderSheetProps {
  order: TbOrder;
  logos: TbTemplateLogo[];
  /** Object URL / data URL of the prepared signature PNG. */
  signatureUrl?: string;
}

const logoUrls = new WeakMap<Uint8Array, string>();
/** data: URL (allowed by the offline CSP) for a template logo; cached per byte array. */
export function logoUrl(logo: TbTemplateLogo): string {
  let url = logoUrls.get(logo.data);
  if (!url) {
    url = `data:${logo.mime};base64,${toBase64(logo.data)}`;
    logoUrls.set(logo.data, url);
  }
  return url;
}

const pt = (value: number): string => `${Math.round(value * 100) / 100}pt`;
const boxStyle = (box: SheetBox): CSSProperties => ({
  left: pt(box.x),
  top: pt(box.top),
  width: pt(box.width),
  height: pt(box.height),
});

/**
 * A4 portrait replica of one template day sheet. Positions, font size and line breaks
 * come from the same layout as the PDF, so print view and PDF match line by line.
 */
export default function OrderSheet({ order, logos, signatureUrl }: OrderSheetProps) {
  const layout = useMemo(() => layoutOrder(order, logos), [order, logos]);
  return (
    <article
      className="tb-sheet"
      data-day={order.day}
      data-font-size={layout.fontSize}
      aria-label={order.title}
    >
      {layout.logos.map((box) => (
        <img
          key={`logo-${box.index}`}
          className="tb-sheet-logo"
          src={logoUrl(logos[box.index])}
          alt=""
          style={boxStyle(box)}
        />
      ))}
      {layout.bars.map((bar) => (
        <div
          key={`bar-${bar.top}`}
          className="tb-sheet-bar"
          aria-hidden="true"
          style={{ ...boxStyle(bar), borderTopWidth: pt(bar.height) }}
        />
      ))}
      {signatureUrl ? (
        <img
          className="tb-sheet-signature"
          src={signatureUrl}
          alt="Unterschrift"
          style={boxStyle(layout.signature)}
        />
      ) : null}
      {layout.rows.map((row) => (
        <div
          key={`${row.kind}-${row.top}`}
          className={`tb-row tb-row-${row.kind}`}
          data-kind={row.kind}
          data-entry-id={row.entryId}
          style={{ top: pt(row.top), height: pt(row.height) }}
        >
          {row.cells.map((cell) => (
            <div
              key={cell.column}
              className="tb-cell"
              data-column={cell.column}
              style={{
                left: pt(cell.x),
                top: pt(cell.top - row.top),
                width: pt(cell.width),
                fontSize: pt(cell.size),
                lineHeight: pt(cell.lineHeight),
                fontWeight: cell.bold ? 700 : 400,
                textAlign: cell.align,
                color: cell.color === 'white' ? '#fff' : '#000',
              }}
            >
              {cell.lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: wrapped lines have no identity
                <span key={index} className="tb-line">
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </article>
  );
}

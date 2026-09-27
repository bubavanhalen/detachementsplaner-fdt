import type { TbTemplateLogo } from '../../io/tagesbefehl/template';
import type { TbOrder } from '../../model/tagesbefehl/types';

export interface OrderSheetProps {
  order: TbOrder;
  logos: TbTemplateLogo[];
  /** Object URL / data URL of the prepared signature PNG. */
  signatureUrl?: string;
}

/** A4 replica of one template day sheet. STUB — print/PDF work package. */
export default function OrderSheet({ order }: OrderSheetProps) {
  return (
    <article className="tb-sheet">
      <h2>{order.title}</h2>
    </article>
  );
}

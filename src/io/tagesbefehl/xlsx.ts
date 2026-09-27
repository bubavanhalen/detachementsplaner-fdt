import type { TbOrder, TbSettings, TbWeek } from '../../model/tagesbefehl/types';

export interface TagesbefehlXlsxInput {
  /** Official template (Tagesbefehle_Vorlage.xlsx). */
  template: Uint8Array;
  /** Prepared signature PNG (see signature.ts); omitted → template picture stays. */
  signature?: Uint8Array;
  week: TbWeek;
  /** buildOrders(project, tb, week) — the same orders the print view and PDFs render. */
  orders: TbOrder[];
  settings: TbSettings;
  einheit: string;
  now?: Date;
}

/** Edits the template at XML level. STUB — xlsx export work package. */
export function buildTagesbefehlXlsx(_input: TagesbefehlXlsxInput): Uint8Array {
  throw new Error('xlsx-Export noch nicht verfügbar.');
}

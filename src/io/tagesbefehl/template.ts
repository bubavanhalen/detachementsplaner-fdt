/** A logo picture from the template header, for the print view and PDFs. */
export interface TbTemplateLogo {
  name: string;
  mime: 'image/png' | 'image/jpeg';
  data: Uint8Array;
  /** Position within the header row band of the day sheet. */
  align: 'left' | 'center' | 'right';
  widthMm: number;
  heightMm: number;
}

/** Extracts the day-sheet header logos from the template. STUB — print/PDF work package. */
export function extractTemplateLogos(_template: Uint8Array): TbTemplateLogo[] {
  return [];
}

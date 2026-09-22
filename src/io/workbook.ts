import * as XLSX from 'xlsx';
import * as codepages from 'xlsx/dist/cpexcel.full.mjs';

XLSX.set_cptable(codepages);

export { XLSX };

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  try {
    return XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  } catch {
    throw new Error('Die Datei konnte nicht als Excel- oder CSV-Liste gelesen werden.');
  }
}
export function sheetRows(workbook: XLSX.WorkBook, sheet: string): string[][] {
  const source = workbook.Sheets[sheet];
  if (!source) return [];
  return XLSX.utils.sheet_to_json<string[]>(source, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });
}

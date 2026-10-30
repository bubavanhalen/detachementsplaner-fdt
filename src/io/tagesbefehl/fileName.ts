// File name of the Tagesbefehl workbook, without the xlsx/zip code (fflate), so that dialogs which only show
// the name (e.g. ServiceDialog in the shell) do not pull the export code into every bundle.
import { weekFileLabel } from '../../model/tagesbefehl/state';

/** Tagesbefehle_<Woche>_<Dateikürzel>.xlsx, e.g. Tagesbefehle_KVK_FDT_2026.xlsx */
export function xlsxFileName(sheet: string, dateikuerzel: string): string {
  const suffix = dateikuerzel
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Tagesbefehle_${weekFileLabel(sheet)}${suffix ? `_${suffix}` : ''}.xlsx`;
}

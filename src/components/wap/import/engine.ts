// Import-Werk für die Oberfläche (I4). Bewusst ein eigenes Modul: Nur Einstiege, die den Excel-Import anbieten
// (Suite-Seite /wap), binden das XLSX-Lesemodul samt fflate ein; die Zwischenstands-Einzeldateien ohne Import
// bleiben ohne fflate (Werkzeug-Regel «kein Worker in der Einzeldatei», scripts/wap-gate/einzeldatei.mjs).
import { importBytes, runImport } from '../../../io/wap-import/index';

export interface ExcelImportEngine {
  readonly importBytes: typeof importBytes;
  readonly runImport: typeof runImport;
}

export const excelImportEngine: ExcelImportEngine = { importBytes, runImport };

// Öffentliche Schnittstelle des gemeinsamen XLSX-Lesemoduls (Vertrag E1-07 §2h).
// Verbraucher ausserhalb des Moduls (E1-08 WAP-Import, E1-09 Personenliste) importieren nur von hier.
export {
  calibrateSheetTime,
  detectSheetLayout,
  type SheetColumn,
  type SheetColumnKind,
  type SheetDayBlock,
  type SheetHourLabel,
  type SheetLayout,
  type SheetTimeScale,
} from './calibration';
export type { Rgb, Theme } from './colors';
export type { Box, WapShape } from './drawing';
export { XlsxError, type XlsxErrorCode } from './errors';
export { readShapeFills, type ShapeFillExtras, type ShapeFillStop } from './fills';
export { XLSX_LIMITS } from './limits';
export { type CellRichRun, readCellRichText } from './richText';
export { readShapeRuns, type ShapeTextRun } from './runs';
export type { Cell, Merge, SheetModel } from './sheet';
export { SHEET_WEEKDAYS, type SheetWeekday, weekdayOfText } from './weekday';
export { type ReadSheet, readWorkbook, type Workbook } from './workbook';

// Kp-WAP parser: reads the DrawingML layer of one sheet of the company work plan
// (.xlsx) locally and turns it into Tagesbefehl entries for review. No network, no
// logging; errors are generic German messages (WapError).
import type { TbRule, WapParseResult } from '../../model/tagesbefehl/types';
import { assemble } from './assemble';
import { calibrateTime, detectLayout } from './calibrate';
import { parseTheme } from './colors';
import { readDrawing } from './drawing';
import { readLegend } from './legend';
import { parseSharedStrings, parseSheet, parseStyles, type SheetModel } from './sheet';
import { WapError } from './xml';
import { openPackage, resolveSheet, uses1904, workbookSheets } from './zip';

export { WapError } from './xml';

/** Sheet names of a Kp-WAP workbook in workbook order (visible sheets first choice). */
export function listWapSheets(bytes: Uint8Array): string[] {
  const sheets = workbookSheets(openPackage(bytes));
  const visible = sheets.filter((s) => !s.hidden);
  return (visible.length ? visible : sheets).map((s) => s.name);
}

export interface WapParseOptions {
  rules: readonly TbRule[];
  /**
   * Optional heading names for sub-column headers, keyed by the header text in the
   * sheet (case-insensitive), e.g. { "Stv": "Kdt Stv" }. Columns mapped to the same
   * name share one heading. Without aliases the sheet's own headers are used.
   */
  groupAliases?: Readonly<Record<string, string>>;
}

/** Own unit number from the sheet head ("… Kp 12/3" → "12/3"), '' if not stated. */
function ownUnitOf(sheet: SheetModel, texts: readonly string[]): string {
  const head = [...sheet.cells.filter((c) => c.row <= 2).map((c) => c.text), ...texts];
  for (const text of head) {
    const match = /\bKp\s+(\d{1,3}\/\d{1,2})\b/.exec(text);
    if (match) return match[1];
  }
  return '';
}

/** Parses one WAP sheet (DrawingML layer) locally. */
export function parseWap(
  bytes: Uint8Array,
  sheet: string,
  options: WapParseOptions,
): WapParseResult {
  const pkg = openPackage(bytes);
  const ref = resolveSheet(pkg, sheet);
  if (!ref.drawingPath)
    throw new WapError('Das Tabellenblatt enthält keine WAP-Kästchen (keine Zeichnungsebene).');
  const theme = parseTheme(ref.themePath ? pkg.xml(ref.themePath) : null);
  const styles = parseStyles(ref.stylesPath ? pkg.text(ref.stylesPath) : null, theme);
  const sheetDoc = pkg.xml(ref.sheetPath);
  const drawingDoc = pkg.xml(ref.drawingPath);
  if (!sheetDoc || !drawingDoc)
    throw new WapError('Das Tabellenblatt konnte nicht gelesen werden.');
  const model = parseSheet(
    sheetDoc,
    parseSharedStrings(ref.sharedStringsPath ? pkg.xml(ref.sharedStringsPath) : null),
    styles,
  );
  const shapes = readDrawing(drawingDoc, model, theme);
  const time = calibrateTime(shapes);
  const layout = detectLayout(model, time, uses1904(pkg));
  if (!layout.days.length)
    throw new WapError('Im Tabellenblatt wurden keine sichtbaren Tagesspalten gefunden.');
  const legend = readLegend(model, Math.max(layout.subHeaderRow, layout.headerRow));
  const topTexts = shapes.filter((s) => s.box.y1 <= time.gridTop).map((s) => s.lines.join(' '));
  return assemble({
    sheetName: sheet,
    sheet: model,
    shapes,
    time,
    layout,
    legend,
    ownUnit: ownUnitOf(model, topTexts),
    rules: options.rules,
    groupAliases: options.groupAliases,
  });
}

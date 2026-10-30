// Zusammenführung für den WAP-Import und die Personenliste (Vertrag E1-07 §2g, Änderungsnotiz
// Code-Review Runde 1: Ressourcengrenzen G1–G5 und Prüfreihenfolge).
import { anchorShapesWithoutArea } from './anchors';
import { parseTheme, type Theme } from './colors';
import { readDrawing, type WapShape } from './drawing';
import { XlsxError, type XlsxErrorCode } from './errors';
import { readShapeFills, type ShapeFillExtras } from './fills';
import { XLSX_LIMITS } from './limits';
import { keyOf, openLimitedPackage } from './package';
import {
  type CellRichRun,
  readCellRichTextWith,
  readSharedRichText,
  type SharedRichText,
} from './richText';
import { readShapeRuns, type ShapeTextRun } from './runs';
import {
  type CellStyles,
  parseSharedStrings,
  parseSheet,
  parseStyles,
  type SheetModel,
} from './sheet';
import { child, descendants, numText } from './xml';
import {
  relationships,
  relsPath,
  uses1904,
  type WapPackage,
  type WorkbookSheet,
  workbookPath,
  workbookSheets,
} from './zip';

export interface ReadSheet {
  readonly name: string;
  /** Blatt in der Arbeitsmappe ausgeblendet (state hidden oder veryHidden). */
  readonly hidden: boolean;
  /** Formen der Zeichnung in Dokumentreihenfolge; [] ohne Zeichnung. */
  readonly shapes: readonly WapShape[];
  readonly runs: ReadonlyMap<number, readonly ShapeTextRun[]>;
  readonly fills: ReadonlyMap<number, ShapeFillExtras>;
  readonly richText: ReadonlyMap<string, readonly CellRichRun[]>;
  readonly model: SheetModel;
}

export interface Workbook {
  /** Alle Arbeitsblätter (keine Diagrammblätter) in der Reihenfolge der Arbeitsmappe. */
  readonly sheets: readonly ReadSheet[];
  readonly theme: Theme;
  /** Arbeitsmappe nutzt das 1904-Datumssystem (für detectSheetLayout). */
  readonly date1904: boolean;
}

/** OLE-Verbunddatei (altes .xls, auch verschlüsselte .xlsx). */
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);

/**
 * Führt `fn` aus; jede Ausnahme ausser XlsxError wird zu XlsxError(code) mit der
 * auslösenden Ausnahme als cause (Vertrag §2a: Meldung nur mit Code).
 */
function guard<T>(code: XlsxErrorCode, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof XlsxError) throw error;
    throw new XlsxError(code, { cause: error });
  }
}

/** Gebrauchter XML-Teil; null, wenn er fehlt. Ungültiges XML ergibt 'corrupt', G3 'tooLarge'. */
const xmlPart = (pkg: WapPackage, path: string | null): Document | null =>
  path === null ? null : guard('corrupt', () => pkg.xml(path));

interface WorkbookParts {
  readonly sharedStrings: string | null;
  readonly styles: string | null;
  readonly theme: string | null;
}

/** Teile der Arbeitsmappe über ihre Beziehungen (wie resolveSheet in zip.ts). */
function workbookParts(pkg: WapPackage, wbPath: string): WorkbookParts {
  const rels = relationships(pkg, wbPath);
  const byType = (suffix: string): string | null =>
    rels.find((rel) => rel.type.endsWith(suffix) && pkg.has(rel.target))?.target ?? null;
  return {
    sharedStrings: byType('/sharedStrings'),
    styles: byType('/styles'),
    theme: byType('/theme'),
  };
}

/** Verknüpfte Zeichnung eines Blatts (wie resolveSheet in zip.ts). */
function drawingPathOf(pkg: WapPackage, sheetPath: string): string | null {
  const rels = guard('corrupt', () => relationships(pkg, sheetPath));
  return (
    rels.find((rel) => rel.type.endsWith('/drawing') && !rel.external && pkg.has(rel.target))
      ?.target ?? null
  );
}

/** Gelesene, noch nicht ausgewertete Teile eines Blatts (§2g Schritt 5). */
interface SheetParts {
  readonly entry: WorkbookSheet;
  readonly sheetXml: Document;
  readonly drawingXml: Document | null;
}

/**
 * Merkt sich einen Blatt- oder Zeichnungsteil. Ein zweites Mal verwendet ist er 'corrupt', bevor er
 * erneut ausgewertet wird (CR-E107-10); Pfadvergleich ohne Gross-/Kleinschreibung wie keyOf.
 */
function claimPart(used: Set<string>, path: string): void {
  const key = keyOf(path);
  if (used.has(key)) throw new XlsxError('corrupt');
  used.add(key);
}

function readSheetParts(pkg: WapPackage, entry: WorkbookSheet, used: Set<string>): SheetParts {
  claimPart(used, entry.path);
  const sheetXml = xmlPart(pkg, entry.path);
  if (!sheetXml) throw new XlsxError('corrupt');
  const drawingPath = drawingPathOf(pkg, entry.path);
  if (drawingPath !== null) claimPart(used, drawingPath);
  const drawingXml = xmlPart(pkg, drawingPath);
  return { entry, sheetXml, drawingXml };
}

const beyond = (col: number, row: number): boolean =>
  col > XLSX_LIMITS.maxCol || row > XLSX_LIMITS.maxRow;

/** G4: jedes Element from/to innerhalb der Excel-Grenzen (Auslesung wie drawing.ts). */
function checkAnchors(drawingXml: Document): void {
  const root = drawingXml.documentElement;
  for (const point of [...descendants(root, 'from'), ...descendants(root, 'to')])
    if (beyond(numText(child(point, 'col')), numText(child(point, 'row'))))
      throw new XlsxError('corrupt');
}

/** G5: Zellen und verbundene Bereiche innerhalb der Excel-Grenzen. */
function checkCells(model: SheetModel): void {
  if (
    model.cells.some((cell) => beyond(cell.col, cell.row)) ||
    model.merges.some((merge) => beyond(merge.c1, merge.r1))
  )
    throw new XlsxError('corrupt');
}

interface Context {
  readonly theme: Theme;
  readonly sharedStrings: readonly string[];
  /** si-Liste samt Läufen, genau einmal je Arbeitsmappe (CR-E107-12). */
  readonly sharedRich: SharedRichText;
  /** Ergebnis von parseStyles, genau einmal je Arbeitsmappe (CR-E107-07). */
  readonly styles: CellStyles;
}

/** Blattmodell mit G5 und G4 (§2g Schritt 6). */
function modelOf(ctx: Context, parts: SheetParts): SheetModel {
  return guard('corrupt', () => {
    const model = parseSheet(parts.sheetXml, ctx.sharedStrings, ctx.styles);
    checkCells(model);
    if (parts.drawingXml) checkAnchors(parts.drawingXml);
    return model;
  });
}

/** Formen, Läufe, Füllungen und Zell-Rich-Text (§2g Schritt 7: 'shapeIndexMismatch'). */
function readSheet(ctx: Context, parts: SheetParts, model: SheetModel): ReadSheet {
  const { entry, sheetXml, drawingXml } = parts;
  return guard('corrupt', () => {
    // Linien ohne Fläche liegen am Zeichnungsanker (R-8.2-44); readDrawing selbst bleibt unverändert (R-L-11).
    const shapes = drawingXml
      ? readDrawing(anchorShapesWithoutArea(drawingXml, model), model, ctx.theme)
      : [];
    const runs = drawingXml
      ? readShapeRuns(drawingXml, model, ctx.theme)
      : new Map<number, readonly ShapeTextRun[]>();
    const fills = drawingXml
      ? readShapeFills(drawingXml, model, ctx.theme)
      : new Map<number, ShapeFillExtras>();
    if (runs.size !== shapes.length || fills.size !== shapes.length)
      throw new XlsxError('shapeIndexMismatch');
    const richText = readCellRichTextWith(ctx.sharedRich, sheetXml, ctx.theme);
    return { name: entry.name, hidden: entry.hidden, shapes, runs, fills, richText, model };
  });
}

/**
 * Liest nur; die Eingabe-Bytes werden nie verändert und nicht im Ergebnis gehalten (R-8.2-22).
 * Entpackt nur gebrauchte Teile und erst nach der Grössenprüfung (XLSX_LIMITS, G1–G3).
 * Zuordnung Läufe/Füllungen ↔ Form über WapShape.index; weicht die Anzahl ab: 'shapeIndexMismatch'.
 * Fehler: XlsxError 'notXlsx', 'oldXlsFormat', 'corrupt', 'tooLarge', 'unsupported',
 * 'shapeIndexMismatch'.
 */
export function readWorkbook(bytes: Uint8Array): Workbook {
  // §2g Schritte 1–4: Signaturen, Zentralverzeichnis, G1.
  if (startsWith(bytes, OLE_SIGNATURE)) throw new XlsxError('oldXlsFormat');
  if (!startsWith(bytes, [0x50, 0x4b])) throw new XlsxError('notXlsx');
  const pkg = openLimitedPackage(bytes);

  // §2g Schritt 5: gebrauchte Teile in Lesereihenfolge. Beziehungen und Arbeitsmappe zuerst:
  // ungültiges XML ist 'corrupt', eine fehlende Arbeitsmappe oder ein fehlendes Arbeitsblatt
  // 'unsupported'.
  xmlPart(pkg, relsPath(''));
  const wbPath = guard('unsupported', () => workbookPath(pkg));
  xmlPart(pkg, wbPath);
  xmlPart(pkg, relsPath(wbPath));
  const entries = guard('unsupported', () => workbookSheets(pkg));
  if (!entries.length) throw new XlsxError('unsupported');

  const paths = workbookParts(pkg, wbPath);
  const themeXml = xmlPart(pkg, paths.theme);
  const sharedStringsXml = xmlPart(pkg, paths.sharedStrings);
  const stylesPath = paths.styles;
  const stylesText = guard('corrupt', () => (stylesPath === null ? null : pkg.text(stylesPath)));
  const used = new Set<string>();
  const sheetParts = entries.map((entry) => readSheetParts(pkg, entry, used));
  const date1904 = guard('corrupt', () => uses1904(pkg));

  // Auswertung der gelesenen Teile.
  const theme = guard('corrupt', () => parseTheme(themeXml));
  const sharedStrings = guard('corrupt', () => parseSharedStrings(sharedStringsXml));
  const sharedRich = guard('corrupt', () => readSharedRichText(sharedStringsXml, theme));
  const styles = guard('corrupt', () => parseStyles(stylesText, theme));
  const ctx: Context = { theme, sharedStrings, sharedRich, styles };
  // §2g Schritt 6 für alle Blätter vor Schritt 7.
  const sheets = sheetParts
    .map((parts) => ({ parts, model: modelOf(ctx, parts) }))
    .map(({ parts, model }) => readSheet(ctx, parts, model));
  return { sheets, theme, date1904 };
}

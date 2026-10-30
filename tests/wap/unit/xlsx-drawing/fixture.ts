// Synthetische, frei erfundene XLSX-Bausteine für die Tests des gemeinsamen Lesemoduls
// (Vertrag E1-07 §3). Keine Inhalte aus reference/ oder fixtures-private/; alle Texte,
// Blattnamen und Farben sind fiktiv. Die Arbeitsmappen entstehen im Test per fflate.
import { strToU8, zipSync } from 'fflate';
import { parseTheme, type Theme } from '../../../../src/io/xlsx-drawing/colors';
import { readDrawing, type WapShape } from '../../../../src/io/xlsx-drawing/drawing';
import {
  parseSharedStrings,
  parseSheet,
  parseStyles,
  type SheetModel,
} from '../../../../src/io/xlsx-drawing/sheet';

export const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
export const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Parst XML wie ein Verbraucher (DOMParser der Testumgebung). */
export function xmlDoc(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

// ---------------------------------------------------------------------------
// Arbeitsblatt

/** Zelle mit Inline-Text (t="inlineStr", ohne Läufe). */
export const inl = (ref: string, text: string, style?: number): string =>
  `<c r="${ref}" t="inlineStr"${style == null ? '' : ` s="${style}"`}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;

/** Zahlenzelle. */
export const numCell = (ref: string, value: number): string => `<c r="${ref}"><v>${value}</v></c>`;

/** Zelle mit gemeinsamer Zeichenfolge. */
export const sstCell = (ref: string, index: number, style?: number): string =>
  `<c r="${ref}" t="s"${style == null ? '' : ` s="${style}"`}><v>${index}</v></c>`;

export interface WorksheetParts {
  /** Zeilen: Zeilennummer (1-basiert) → Zellen-XML. */
  rows?: Record<number, string>;
  /** Inhalt von <cols> (z.B. ausgeblendete Spalten). */
  cols?: string;
  merges?: string[];
}

export function worksheetXml(parts: WorksheetParts = {}): string {
  const rows = Object.entries(parts.rows ?? {})
    .map(([r, cells]) => [Number(r), cells] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([r, cells]) => `<row r="${r}">${cells}</row>`)
    .join('');
  const cols = parts.cols ? `<cols>${parts.cols}</cols>` : '';
  const merges = parts.merges?.length
    ? `<mergeCells count="${parts.merges.length}">${parts.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${cols}<sheetData>${rows}</sheetData>${merges}</worksheet>`;
}

// ---------------------------------------------------------------------------
// Zeichnung

/** Umhüllt Anker mit dem Wurzelelement der Zeichnung (Präfixe xdr, a, mc). */
export const drawingXml = (anchors: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:mc="${NS_MC}">${anchors}</xdr:wsDr>`;

/** Absoluter Anker mit Fläche (Position und Grösse in EMU). */
export const absAnchor = (x: number, y: number, cx: number, cy: number, body: string): string =>
  `<xdr:absoluteAnchor><xdr:pos x="${x}" y="${y}"/><xdr:ext cx="${cx}" cy="${cy}"/>${body}<xdr:clientData/></xdr:absoluteAnchor>`;

/** Zwei-Zellen-Anker von (fromCol, fromRow) bis (toCol, toRow), ohne Versatz. */
export const twoCellAnchor = (
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  body: string,
): string =>
  `<xdr:twoCellAnchor><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
  `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>${body}<xdr:clientData/></xdr:twoCellAnchor>`;

let nextShapeId = 100;

export interface SpOptions {
  name: string;
  /** Inhalt von xdr:spPr nach der Geometrie (Füllung, Linie). */
  props?: string;
  /** Vollständiger xdr:txBody oder leer für eine Form ohne Text. */
  txBody?: string;
  /** Inhalt von xdr:style. */
  style?: string;
  hidden?: boolean;
  xfrm?: string;
}

/** Einfache Form (xdr:sp). */
export function sp(o: SpOptions): string {
  const id = nextShapeId++;
  return (
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${esc(o.name)}"${o.hidden ? ' hidden="1"' : ''}/><xdr:cNvSpPr/></xdr:nvSpPr>` +
    `<xdr:spPr>${o.xfrm ?? ''}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${o.props ?? ''}</xdr:spPr>` +
    `${o.style ? `<xdr:style>${o.style}</xdr:style>` : ''}${o.txBody ?? ''}</xdr:sp>`
  );
}

/** Textkörper aus Absätzen (Inhalt je a:p) mit optionalem lstStyle. */
export const txBody = (paragraphs: string[], lstStyle = ''): string =>
  `<xdr:txBody><a:bodyPr wrap="square"/><a:lstStyle>${lstStyle}</a:lstStyle>${paragraphs.map((p) => `<a:p>${p}</a:p>`).join('')}</xdr:txBody>`;

/** Lauf a:r mit optionalen rPr-Attributen und rPr-Inhalt. */
export const run = (text: string, rPrAttrs = '', rPrBody = ''): string =>
  `<a:r><a:rPr lang="de-CH"${rPrAttrs ? ` ${rPrAttrs}` : ''}>${rPrBody}</a:rPr><a:t xml:space="preserve">${esc(text)}</a:t></a:r>`;

/** Lauf ohne rPr. */
export const bareRun = (text: string): string =>
  `<a:r><a:t xml:space="preserve">${esc(text)}</a:t></a:r>`;

export const solid = (rgb: string, alpha?: number): string =>
  `<a:solidFill><a:srgbClr val="${rgb}">${alpha == null ? '' : `<a:alpha val="${alpha}"/>`}</a:srgbClr></a:solidFill>`;

/** Gruppe mit Fläche (xfrm mit chOff/chExt 1:1) und Kindern. */
export function grp(name: string, children: string, grpProps = '', withArea = true): string {
  const id = nextShapeId++;
  const ext = withArea ? 'cx="1000" cy="1000"' : 'cx="0" cy="0"';
  return (
    `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${id}" name="${esc(name)}"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
    `<xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext ${ext}/><a:chOff x="0" y="0"/><a:chExt cx="1000" cy="1000"/></a:xfrm>${grpProps}</xdr:grpSpPr>${children}</xdr:grpSp>`
  );
}

/** Kind-Form in einer Gruppe (mit eigenem xfrm). */
export const childSp = (o: SpOptions): string =>
  sp({
    ...o,
    xfrm: o.xfrm ?? '<a:xfrm><a:off x="100" y="100"/><a:ext cx="200" cy="200"/></a:xfrm>',
  });

// ---------------------------------------------------------------------------
// Arbeitsmappe

export interface FixtureSheet {
  name: string;
  sheetXml: string;
  drawingXml?: string;
  state?: 'visible' | 'hidden' | 'veryHidden';
}

export interface FixtureWorkbook {
  /** Arbeits- und Diagrammblätter in der Reihenfolge der Arbeitsmappe. */
  sheets: (FixtureSheet | { chartsheet: string })[];
  sharedStringsXml?: string;
  stylesXml?: string;
  themeXml?: string;
  date1904?: boolean;
  /** Ersetzt xl/workbook.xml vollständig (z.B. ungültiges XML). */
  workbookXmlOverride?: string;
  /** Zusätzliche Teile (Pfad → Inhalt). */
  extraParts?: Record<string, string | Uint8Array>;
}

/** Baut eine kleine .xlsx-Datei. Teile werden in umgekehrter Reihenfolge der Dateinummern abgelegt. */
export function buildXlsx(spec: FixtureWorkbook): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, content: string | Uint8Array) => {
    files[path] = typeof content === 'string' ? strToU8(content) : content;
  };
  const overrides: string[] = [];
  add(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  const wbRels: string[] = [];
  const entries: string[] = [];
  spec.sheets.forEach((sheet, i) => {
    const n = i + 1;
    const rid = `rId${n}`;
    if ('chartsheet' in sheet) {
      add(
        `xl/chartsheets/sheet${n}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><chartsheet xmlns="${NS_MAIN}"/>`,
      );
      wbRels.push(
        `<Relationship Id="${rid}" Type="${REL_TYPE}/chartsheet" Target="chartsheets/sheet${n}.xml"/>`,
      );
      entries.push(`<sheet name="${esc(sheet.chartsheet)}" sheetId="${n}" r:id="${rid}"/>`);
      overrides.push(`/xl/chartsheets/sheet${n}.xml`);
      return;
    }
    add(`xl/worksheets/sheet${n}.xml`, sheet.sheetXml);
    overrides.push(`/xl/worksheets/sheet${n}.xml`);
    if (sheet.drawingXml != null) {
      add(`xl/drawings/drawing${n}.xml`, sheet.drawingXml);
      add(
        `xl/worksheets/_rels/sheet${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${REL_TYPE}/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`,
      );
    }
    wbRels.push(
      `<Relationship Id="${rid}" Type="${REL_TYPE}/worksheet" Target="worksheets/sheet${n}.xml"/>`,
    );
    const state = sheet.state && sheet.state !== 'visible' ? ` state="${sheet.state}"` : '';
    entries.push(`<sheet name="${esc(sheet.name)}" sheetId="${n}"${state} r:id="${rid}"/>`);
  });
  const k = spec.sheets.length;
  if (spec.sharedStringsXml != null) {
    add('xl/sharedStrings.xml', spec.sharedStringsXml);
    wbRels.push(
      `<Relationship Id="rId${k + 1}" Type="${REL_TYPE}/sharedStrings" Target="sharedStrings.xml"/>`,
    );
  }
  if (spec.stylesXml != null) {
    add('xl/styles.xml', spec.stylesXml);
    wbRels.push(`<Relationship Id="rId${k + 2}" Type="${REL_TYPE}/styles" Target="styles.xml"/>`);
  }
  if (spec.themeXml != null) {
    add('xl/theme/theme1.xml', spec.themeXml);
    wbRels.push(
      `<Relationship Id="rId${k + 3}" Type="${REL_TYPE}/theme" Target="theme/theme1.xml"/>`,
    );
  }
  add(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG_REL}">${wbRels.join('')}</Relationships>`,
  );
  const pr = spec.date1904 ? '<workbookPr date1904="1"/>' : '';
  add(
    'xl/workbook.xml',
    spec.workbookXmlOverride ??
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${pr}<sheets>${entries.join('')}</sheets></workbook>`,
  );
  add(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${overrides.map((p) => `<Override PartName="${p}" ContentType="application/xml"/>`).join('')}</Types>`,
  );
  for (const [path, content] of Object.entries(spec.extraParts ?? {})) add(path, content);
  return zipSync(files, { level: 6, mtime: new Date(Date.UTC(2030, 0, 7, 12)) });
}

/** ZIP mit beliebigen Teilen (z.B. ohne Arbeitsmappe). */
export const zipParts = (parts: Record<string, string>): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])), {
    mtime: new Date(Date.UTC(2030, 0, 7, 12)),
  });

export function themeXml(scheme: Record<string, string>): string {
  const entries = Object.entries(scheme)
    .map(([name, rgb]) => `<a:${name}><a:srgbClr val="${rgb}"/></a:${name}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="${NS_A}" name="Fiktiv"><a:themeElements><a:clrScheme name="Fiktiv">${entries}</a:clrScheme></a:themeElements></a:theme>`;
}

/** Formatvorlagen: Stil 1 hat die Einfarbfüllung `fillRgb`. */
export const stylesXml = (fillRgb: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${fillRgb}"/></patternFill></fill></fills>` +
  `<cellXfs count="2"><xf fillId="0"/><xf fillId="2"/></cellXfs></styleSheet>`;

export const sharedStringsXml = (items: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${NS_MAIN}" count="${items.length}" uniqueCount="${items.length}">${items.map((si) => `<si>${si}</si>`).join('')}</sst>`;

/** Excel-Seriennummer (1900-System) eines ISO-Datums. */
export const serialOf = (iso: string): number =>
  (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

// ---------------------------------------------------------------------------
// Eingaben für die Einzelfunktionen (Altdateien sind funktionsfähige Kopien, Vertrag §1b).

/** Blattmodell wie in readWorkbook: parseSheet mit gemeinsamen Zeichenfolgen, ohne Formatvorlagen. */
export function sheetModel(sheetXml: string, sst: Document | null = null): SheetModel {
  return parseSheet(xmlDoc(sheetXml), parseSharedStrings(sst), parseStyles(null, parseTheme(null)));
}

/** Leeres Blatt (Standard-Spaltenbreiten). */
export const emptySheet = (): SheetModel => sheetModel(worksheetXml());

export const defaultTheme = (): Theme => parseTheme(null);

/** Formen wie readDrawing (Referenz für Schlüssel 0 … n-1 und die Zeilen-Invariante). */
export const shapesOf = (doc: Document, sheet: SheetModel, theme: Theme): WapShape[] =>
  readDrawing(doc, sheet, theme);

// ---------------------------------------------------------------------------
// Gemischte Zeichnung für die Zuordnung über WapShape.index (Vertrag §2d/§2e).

/**
 * Formen mit und ohne Text, Verbinder, ausgeblendete Form, mc:AlternateContent
 * (Choice und Fallback), Gruppe mit Kindern, Gruppe ohne xfrm (wird verworfen) und
 * eine Gruppe ohne eigene Fläche an einem Zwei-Zellen-Anker über Spalte B: Sie bleibt
 * nur, wenn Spalte B nicht ausgeblendet ist (readDrawing hängt vom Blatt ab).
 */
export function mixedDrawingXml(): string {
  const cxn =
    `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${nextShapeId++}" name="Linie"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
    `<xdr:spPr><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="9525"><a:prstDash val="dash"/></a:ln></xdr:spPr></xdr:cxnSp>`;
  const alternate =
    `<mc:AlternateContent><mc:Choice Requires="a14">${sp({ name: 'Wahl', txBody: txBody([bareRun('Choice-Text')]) })}</mc:Choice>` +
    `<mc:Fallback>${sp({ name: 'Ersatz', txBody: txBody([bareRun('Fallback-Text')]) })}</mc:Fallback></mc:AlternateContent>`;
  const noXfrmGroup =
    `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${nextShapeId++}" name="Ohne Xfrm"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr/>` +
    `${childSp({ name: 'Verworfen', txBody: txBody([bareRun('Verworfener Text')]) })}</xdr:grpSp>`;
  return drawingXml(
    absAnchor(
      0,
      0,
      100_000,
      100_000,
      sp({ name: 'Text', txBody: txBody([bareRun('Erste Form')]) }),
    ) +
      absAnchor(0, 100_000, 100_000, 100_000, sp({ name: 'Leer' })) +
      absAnchor(0, 200_000, 100_000, 10, cxn) +
      absAnchor(
        0,
        300_000,
        100_000,
        100_000,
        sp({ name: 'Versteckt', hidden: true, txBody: txBody([bareRun('Versteckter Text')]) }),
      ) +
      absAnchor(0, 400_000, 100_000, 100_000, alternate) +
      absAnchor(
        0,
        500_000,
        100_000,
        100_000,
        grp(
          'Gruppe',
          childSp({ name: 'Kind 1', txBody: txBody([bareRun('Erstes Kind')]) }) +
            childSp({ name: 'Kind 2' }),
        ),
      ) +
      absAnchor(0, 600_000, 100_000, 100_000, noXfrmGroup) +
      twoCellAnchor(
        1,
        0,
        2,
        1,
        grp(
          'Anker-Gruppe',
          childSp({ name: 'Ankerkind', txBody: txBody([bareRun('Ankertext')]) }),
          '',
          false,
        ),
      ) +
      absAnchor(
        0,
        700_000,
        100_000,
        100_000,
        sp({ name: 'Letzte', txBody: txBody([bareRun('Ende')]) }),
      ),
  );
}

/** Blatt mit ausgeblendeter Spalte B (Breite 0). */
export const sheetHiddenB = (): SheetModel =>
  sheetModel(worksheetXml({ cols: '<col min="2" max="2" width="8" hidden="1" customWidth="1"/>' }));

/**
 * Element `index` einer Liste für die strenge Typprüfung (noUncheckedIndexedAccess, tsconfig.wap.json).
 * Fehlt das Element, bricht der Test mit klarer Meldung ab, wie zuvor beim Zugriff auf `undefined`.
 */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) {
    throw new Error(`Element ${String(index)} fehlt (Länge ${String(list.length)})`);
  }
  return item;
}

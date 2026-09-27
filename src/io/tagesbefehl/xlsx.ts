// xlsx export from the official template, edited at XML level (port of the
// reference build). Drawings, logos, styles and page setup of the template stay;
// only cell content, a few workbook settings and the signature picture change.
// Everything runs locally; nothing is logged or sent anywhere.
import { unzipSync, zipSync } from 'fflate';
import { weekFileLabel } from '../../model/tagesbefehl/state';
import {
  isWeekend,
  TB_WEEKDAYS,
  type TbOrder,
  type TbSettings,
  type TbWeek,
  type TbWeekday,
} from '../../model/tagesbefehl/types';
import {
  isPng,
  pngSize,
  sheetDrawing,
  signatureMediaPath,
  TEMPLATE_SIGNATURE_ASPECT,
  updateDrawing,
} from './xlsx/drawing';
import { type CellValue, evaluateFormula, isoToSerial, valueToText } from './xlsx/formula';
import {
  type FixedRegion,
  type LayoutStyles,
  layoutDay,
  layoutVerteiler,
  layoutWeekendHalf,
  type OrderContent,
  SA_HALF,
  SA_VERTEILER,
  SO_HALF,
  SO_VERTEILER,
} from './xlsx/layout';
import {
  CONTENT_TYPES,
  dropRels,
  ensureDefaultContentType,
  type PackageFiles,
  partRels,
  readPart,
  relTypeIs,
  removePart,
  writePart,
} from './xlsx/package';
import {
  cellStyle,
  cellText,
  clearCell,
  dimensionRef,
  escapeXml,
  findCell,
  getAttr,
  numberCell,
  parseSharedStrings,
  parseSheet,
  putCell,
  type SheetCell,
  type SheetDoc,
  serializeSheet,
  setAttr,
  stringCell,
  unescapeXml,
} from './xlsx/sheet';

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

const INVALID_TEMPLATE = 'Die Vorlage ist keine gültige Tagesbefehl-Vorlage (.xlsx).';
const WEEKEND_SHEET = /^Sa\s*\+\s*So$/;
/** Rows 2–10 (header, logos, title, LK) are kept; the order starts in row 11. */
const HEADER_LAST_ROW = 10;

/** Tagesbefehle_<Woche>_<Dienstleistung>.xlsx, e.g. Tagesbefehle_KVK_FDT_2026.xlsx */
export function xlsxFileName(sheet: string, settings: Pick<TbSettings, 'dienstleistung'>): string {
  const suffix = settings.dienstleistung
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Tagesbefehle_${weekFileLabel(sheet)}${suffix ? `_${suffix}` : ''}.xlsx`;
}

interface SheetInfo {
  name: string;
  index: number;
  path: string;
}

interface ConfValues {
  serial: number | undefined;
  firstNumber: number;
  lk: string;
  einheit: string;
  name: string;
  funktion: string;
}

function isoShift(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function confValues(input: TagesbefehlXlsxInput, orders: TbOrder[]): ConfValues {
  const first = orders[0];
  const monday = first?.date ? isoShift(first.date, 1 - first.index) : input.week.startDate;
  return {
    serial: isoToSerial(monday),
    firstNumber: first ? first.number - (first.index - 1) : input.week.firstNumber,
    lk: first?.lk ?? input.settings.lk,
    einheit: first?.einheit || input.einheit,
    name: first?.signature.name ?? input.settings.kdtName,
    funktion: first?.signature.funktion ?? input.settings.kdtFunktion,
  };
}

/** Content for a day without Tagesbefehl (its sheet is hidden). */
function blankOrder(day: TbWeekday, conf: ConfValues, reference?: TbOrder): OrderContent {
  return {
    blocks: [],
    officer: { label: isWeekend(day) ? 'Wochenend Wacht Of' : 'Tagesoffizier', lines: [] },
    signature: { einheit: conf.einheit, name: conf.name, funktion: conf.funktion },
    verteiler: reference?.verteiler ?? { gehtAn: [], zK: [] },
  };
}

function listSheets(files: PackageFiles, workbookPath: string, workbook: string): SheetInfo[] {
  const rels = partRels(files, workbookPath);
  return [...workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)].flatMap((m, index) => {
    const rid = getAttr(m[1], 'r:id');
    const path = rels.find((r) => r.id === rid)?.path;
    const name = unescapeXml(getAttr(m[1], 'name') ?? '');
    return path && files[path] ? [{ name, index, path }] : [];
  });
}

// ---------------------------------------------------------------------------
// Styles: two additional cellXfs (wrapped text top aligned, time top aligned).

function addStyles(files: PackageFiles, path: string | undefined): LayoutStyles {
  const xml = path ? readPart(files, path) : undefined;
  const m = xml ? /<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/.exec(xml) : null;
  if (!xml || !path || !m) throw new Error(INVALID_TEMPLATE);
  const count = (m[2].match(/<xf\b/g) ?? []).length;
  const added =
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>';
  const replacement = `<cellXfs${setAttr(m[1], 'count', String(count + 2))}>${m[2]}${added}</cellXfs>`;
  writePart(files, path, xml.replace(m[0], replacement));
  return { wrap: count, time: count + 1 };
}

// ---------------------------------------------------------------------------
// Cell values and cached formula results.

function cellValue(cell: SheetCell | undefined, sst: readonly string[]): CellValue | undefined {
  if (!cell) return '';
  const attrs = /^<c\b([^>]*?)\/?>/.exec(cell.xml)?.[1] ?? '';
  const type = getAttr(attrs, 't');
  if (type === 'e') return undefined;
  if (type === 's' || type === 'inlineStr' || type === 'str') return cellText(cell, sst);
  const v = /<v>([\s\S]*?)<\/v>/.exec(cell.xml)?.[1];
  if (v === undefined) return '';
  if (type === 'b') return v === '1' ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

type Lookup = (sheet: string | undefined, ref: string) => CellValue | undefined;

/** Recomputes cached values of supported formulas; clears #REF!/#VALUE! leftovers. */
function refreshFormulas(doc: SheetDoc, lookup: Lookup): void {
  for (const row of doc.rows)
    row.cells = row.cells.map((cell) => {
      const m = /^<c\b([^>]*?)(?:\/>|>([\s\S]*)<\/c>)$/.exec(cell.xml);
      if (!m?.[2]) return cell;
      const attrs = m[1];
      const f = /<f\b([^>]*)>([\s\S]*?)<\/f>/.exec(m[2]);
      if (!f) return getAttr(attrs, 't') === 'e' ? clearCell(cell, row.r) : cell;
      const formula = unescapeXml(f[2]);
      if (formula.includes('#REF!')) return clearCell(cell, row.r);
      if (/\bt="(?:shared|array|dataTable)"/.test(f[1])) return cell;
      const value = evaluateFormula(formula, lookup);
      if (value === undefined) return cell;
      const t = typeof value === 'string' ? 'str' : undefined;
      const text = typeof value === 'string' ? value : valueToText(value);
      return {
        col: cell.col,
        xml: `<c${setAttr(attrs, 't', t)}><f${f[1]}>${f[2]}</f><v>${escapeXml(text)}</v></c>`,
      };
    });
}

/** Removes conditional formats with broken references (#REF!). */
function dropBrokenConditionalFormats(xml: string): string {
  let next = xml.replace(/<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g, (cf) =>
    cf.includes('#REF!') ? '' : cf,
  );
  next = next.replace(/<x14:conditionalFormatting\b[\s\S]*?<\/x14:conditionalFormatting>/g, (cf) =>
    cf.includes('#REF!') ? '' : cf,
  );
  return next
    .replace(/<x14:conditionalFormattings>\s*<\/x14:conditionalFormattings>/g, '')
    .replace(/<ext\b[^>]*>\s*<\/ext>/g, '')
    .replace(/<extLst>\s*<\/extLst>/g, '');
}

/** Drops merged ranges that start in the rebuilt part of a sheet. */
function dropMergesFrom(xml: string, firstRow: number, lastRow = Infinity): string {
  return xml.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (_, inner: string) => {
    const kept = [...inner.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+)(\d+)[^"]*"[^>]*\/>/g)]
      .filter((m) => Number(m[2]) < firstRow || Number(m[2]) > lastRow)
      .map((m) => m[0]);
    return kept.length ? `<mergeCells count="${kept.length}">${kept.join('')}</mergeCells>` : '';
  });
}

function writeSheet(files: PackageFiles, path: string, doc: SheetDoc, lookup: Lookup): void {
  refreshFormulas(doc, lookup);
  let xml = serializeSheet(doc);
  xml = xml.replace(/<dimension\b[^>]*\/>/, `<dimension ref="${dimensionRef(doc)}"/>`);
  writePart(files, path, dropBrokenConditionalFormats(xml));
}

function defaultRowHeight(xml: string): number {
  const value = Number(/<sheetFormatPr\b[^>]*defaultRowHeight="([\d.]+)"/.exec(xml)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 13;
}

function clearE2(doc: SheetDoc): void {
  const cell = findCell(doc, 'E2');
  if (cell) putCell(doc, 2, clearCell(cell, 2));
}

// ---------------------------------------------------------------------------

export function buildTagesbefehlXlsx(input: TagesbefehlXlsxInput): Uint8Array {
  let files: PackageFiles;
  try {
    files = { ...unzipSync(input.template) };
  } catch {
    throw new Error(INVALID_TEMPLATE);
  }
  const orders = [...input.orders]
    .filter((o, i, all) => all.findIndex((x) => x.day === o.day) === i)
    .sort((a, b) => a.index - b.index);
  if (!orders.length) throw new Error('Die Woche enthält keine Tagesbefehle.');
  const byDay = new Map(orders.map((o) => [o.day, o]));

  const workbookPath =
    partRels(files, '').find((r) => relTypeIs(r, 'officeDocument'))?.path ?? 'xl/workbook.xml';
  let workbook = readPart(files, workbookPath);
  if (!workbook) throw new Error(INVALID_TEMPLATE);
  const workbookRels = partRels(files, workbookPath);
  const sheets = listSheets(files, workbookPath, workbook);
  const sheet = (name: string) => sheets.find((s) => s.name === name);
  const conf = sheet('Conf');
  if (!conf || (['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const).some((d) => !sheet(d)))
    throw new Error('Die Vorlage enthält nicht die erwarteten Blätter (Conf, Mo bis Fr).');
  const sst = parseSharedStrings(
    readPart(files, workbookRels.find((r) => relTypeIs(r, 'sharedStrings'))?.path ?? ''),
  );
  const styles = addStyles(files, workbookRels.find((r) => relTypeIs(r, 'styles'))?.path);

  // Conf: B1 first day, B2 first number, B5 LK, B7 unit, B8 name, B9 function.
  const values = confValues(input, orders);
  const confDoc = parseSheet(readPart(files, conf.path) ?? '');
  const style = (ref: string) => {
    const cell = findCell(confDoc, ref);
    return cell ? cellStyle(cell) : undefined;
  };
  if (values.serial !== undefined)
    putCell(confDoc, 1, numberCell(2, 1, values.serial, style('B1')));
  putCell(confDoc, 2, numberCell(2, 2, values.firstNumber, style('B2')));
  putCell(confDoc, 5, stringCell(2, 5, values.lk, style('B5')));
  putCell(confDoc, 7, stringCell(2, 7, values.einheit, style('B7')));
  putCell(confDoc, 8, stringCell(2, 8, values.name, style('B8')));
  putCell(confDoc, 9, stringCell(2, 9, values.funktion, style('B9')));
  const lookup: Lookup = (sheetName, ref) =>
    sheetName?.toLowerCase() === 'conf' ? cellValue(findCell(confDoc, ref), sst) : undefined;
  writeSheet(files, conf.path, confDoc, lookup);

  // Signature picture (xl/media/image2.png in the template).
  if (input.signature && !isPng(input.signature))
    throw new Error('Die Unterschrift muss als PNG-Bild vorliegen.');
  const dayPaths = TB_WEEKDAYS.flatMap((d) => sheet(d)?.path ?? []);
  const mediaPath = signatureMediaPath(files, dayPaths);
  const size = pngSize(input.signature ?? (mediaPath ? files[mediaPath] : undefined));
  const aspect = size ? size.width / size.height : TEMPLATE_SIGNATURE_ASPECT;

  // Day sheets: Mo–Fr visible when issued. The single Sa / So sheets stay hidden
  // because "Sa + So" shows both weekend orders on one page.
  const weekend = sheets.find((s) => WEEKEND_SHEET.test(s.name.trim()));
  const printAreaRows = new Map<number, number>();
  const hidden = new Set<number>();
  for (const day of TB_WEEKDAYS) {
    const info = sheet(day);
    if (!info) continue;
    const xml = readPart(files, info.path) ?? '';
    const order = byDay.get(day);
    const doc = parseSheet(xml);
    doc.rows = doc.rows.filter((row) => row.r <= HEADER_LAST_ROW);
    clearE2(doc);
    const layout = layoutDay(order ?? blankOrder(day, values, orders[0]), styles);
    doc.rows.push(...layout.rows);
    writeSheet(files, info.path, doc, lookup);
    writePart(
      files,
      info.path,
      dropMergesFrom(readPart(files, info.path) ?? '', HEADER_LAST_ROW + 1),
    );
    printAreaRows.set(info.index, layout.lastRow);
    if (!order || (isWeekend(day) && weekend)) hidden.add(info.index);
    const drawing = mediaPath ? sheetDrawing(files, info.path, mediaPath) : null;
    if (drawing)
      updateDrawing(files, drawing, {
        unitRow: layout.unitRow,
        aspect,
        rowHeightPt: defaultRowHeight(xml),
      });
  }

  // "Sa + So": fixed rows of both halves; anchors stay where the template has them.
  if (weekend) {
    const doc = parseSheet(readPart(files, weekend.path) ?? '');
    const sa = byDay.get('Sa'),
      so = byDay.get('So');
    const verteiler = (sa ?? so ?? orders[0]).verteiler;
    const regions: FixedRegion[] = [SA_HALF, SO_HALF, SA_VERTEILER, SO_VERTEILER];
    doc.rows = doc.rows.filter(
      (row) => !regions.some((g) => row.r >= g.top && row.r <= g.clearEnd),
    );
    clearE2(doc);
    doc.rows.push(
      ...layoutWeekendHalf(sa, SA_HALF, styles),
      ...layoutWeekendHalf(so, SO_HALF, styles),
      ...layoutVerteiler(verteiler, SA_VERTEILER, styles),
      ...layoutVerteiler(verteiler, SO_VERTEILER, styles),
    );
    writeSheet(files, weekend.path, doc, lookup);
    let xml = readPart(files, weekend.path) ?? '';
    for (const g of regions) xml = dropMergesFrom(xml, g.top, g.clearEnd);
    writePart(files, weekend.path, xml);
    if (!sa && !so) hidden.add(weekend.index);
  }

  // Remaining sheets: cached values and broken leftovers only.
  for (const info of sheets) {
    if (info === conf || info === weekend || (TB_WEEKDAYS as readonly string[]).includes(info.name))
      continue;
    writeSheet(files, info.path, parseSheet(readPart(files, info.path) ?? ''), lookup);
  }

  // Active sheet: first issued day, else "Sa + So", else Conf.
  const active =
    TB_WEEKDAYS.filter((d) => !isWeekend(d) && byDay.has(d))
      .map((d) => sheet(d)?.index)
      .find((i) => i !== undefined) ??
    (weekend && !hidden.has(weekend.index) ? weekend.index : conf.index);
  for (const info of sheets) {
    const xml = readPart(files, info.path) ?? '';
    let next = xml.replace(/(<sheetView\b[^>]*?)\s+tabSelected="[^"]*"/g, '$1');
    if (info.index === active) next = next.replace(/<sheetView\b/, '<sheetView tabSelected="1"');
    if (next !== xml) writePart(files, info.path, next);
  }

  // Workbook: visibility, external link, broken names, print areas, recalculation.
  const managed = new Set(
    [...TB_WEEKDAYS.map((d) => sheet(d)?.index), weekend?.index].filter(
      (i): i is number => i !== undefined,
    ),
  );
  let sheetIndex = 0;
  workbook = workbook.replace(/<sheet\b([^>]*?)(\/?)>/g, (_, attrs: string, close: string) => {
    const index = sheetIndex++;
    if (!managed.has(index)) return `<sheet${attrs}${close}>`;
    const state = hidden.has(index) ? 'hidden' : undefined;
    return `<sheet${setAttr(attrs, 'state', state)}${close}>`;
  });
  workbook = workbook
    .replace(/<externalReferences\b[\s\S]*?<\/externalReferences>/g, '')
    .replace(/<externalReferences\s*\/>/g, '')
    .replace(
      /<mc:AlternateContent\b[^>]*>\s*<mc:Choice\b[^>]*>\s*<x15ac:absPath\b[^>]*\/>\s*<\/mc:Choice>\s*<\/mc:AlternateContent>/g,
      '',
    )
    .replace(
      /<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g,
      (whole, attrs: string, body: string) => {
        const text = unescapeXml(body);
        if (/\[\d+\]/.test(text) || text.includes('#REF!')) return '';
        if (getAttr(attrs, 'name') !== '_xlnm.Print_Area') return whole;
        const last = printAreaRows.get(Number(getAttr(attrs, 'localSheetId')));
        if (last === undefined || text.includes(',')) return whole;
        return `<definedName${attrs}>${escapeXml(text.replace(/\d+$/, String(last)))}</definedName>`;
      },
    )
    .replace(/<definedNames>\s*<\/definedNames>/g, '');
  workbook = /<calcPr\b/.test(workbook)
    ? workbook.replace(
        /<calcPr\b([^>]*?)(\/?)>/,
        (_, attrs: string, close: string) =>
          `<calcPr${setAttr(attrs, 'fullCalcOnLoad', '1')}${close}>`,
      )
    : workbook.replace(
        /(<oleSize\b|<customWorkbookViews\b|<pivotCaches\b|<smartTagPr\b|<smartTagTypes\b|<webPublishing\b|<fileRecoveryPr\b|<webPublishObjects\b|<extLst\b|<\/workbook>)/,
        '<calcPr fullCalcOnLoad="1"/>$1',
      );
  workbook = workbook.replace(
    /<workbookView\b([^>]*?)(\/?)>/,
    (_, attrs: string, close: string) => {
      const next = setAttr(setAttr(attrs, 'activeTab', String(active)), 'firstSheet', undefined);
      return `<workbookView${next}${close}>`;
    },
  );
  writePart(files, workbookPath, workbook);

  // Template leftovers: external link, calculation chain, trash folder.
  for (const rel of dropRels(
    files,
    workbookPath,
    (r) => relTypeIs(r, 'externalLink') || relTypeIs(r, 'calcChain'),
  )) {
    const target = workbookRels.find((r) => r.id === rel.id)?.path;
    if (target) removePart(files, target);
  }
  for (const path of Object.keys(files))
    if (path.startsWith('xl/externalLinks/') || path === 'xl/calcChain.xml')
      removePart(files, path);
    else if (path.startsWith('[trash]/')) delete files[path];

  if (input.signature && mediaPath) {
    files[mediaPath] = input.signature;
    ensureDefaultContentType(files, 'png', 'image/png');
  }

  // Metadata: last modified by the signing commander, now.
  const corePath =
    partRels(files, '').find((r) => relTypeIs(r, 'core-properties'))?.path ?? 'docProps/core.xml';
  const core = readPart(files, corePath);
  if (core) {
    const now = (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const title = [
      'Tagesbefehle',
      input.week.sheet,
      input.settings.dienstleistung.replace(/_/g, ' '),
      values.einheit,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
    const setElement = (xml: string, tag: string, text: string, attrsIfNew = ''): string => {
      const build = (attrs: string) =>
        text ? `<${tag}${attrs}>${escapeXml(text)}</${tag}>` : `<${tag}${attrs}/>`;
      const m = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>[\\s\\S]*?</${tag}>)`).exec(xml);
      if (m) return xml.replace(m[0], build(m[1]));
      if (!new RegExp(`xmlns:${tag.split(':')[0]}=`).test(xml)) return xml;
      const attrs = /xmlns:xsi=/.test(xml) ? attrsIfNew : '';
      return xml.replace(/<\/cp:coreProperties>/, `${build(attrs)}</cp:coreProperties>`);
    };
    let next = setElement(core, 'cp:lastModifiedBy', values.name);
    next = setElement(next, 'dcterms:modified', now, ' xsi:type="dcterms:W3CDTF"');
    next = setElement(next, 'dc:title', title);
    writePart(files, corePath, next);
  }

  const ordered: PackageFiles = {};
  if (files[CONTENT_TYPES]) ordered[CONTENT_TYPES] = files[CONTENT_TYPES];
  for (const [path, data] of Object.entries(files))
    if (path !== CONTENT_TYPES) ordered[path] = data;
  return zipSync(ordered, { level: 6 });
}

// Synthetische, frei erfundene Kp-Arbeitsmappe für die Tests des Excel-Imports (I4, E1-08). Keine Inhalte aus
// reference/; Einheit, Namen, Orte und Texte sind fiktiv. Aufbau wie ein Kp-WAP: Kopfzellen (Tage in Zeile 4,
// Spalten in Zeile 6), Stundenmarken als Formen links und rechts, Raster aus gleich hohen Zeilen (eine Zeile
// = 15 Min), Formen mit absolutem Anker, Termintexte als Textfelder unter dem Raster, Seitenleiste rechts.
import {
  absAnchor,
  buildXlsx,
  drawingXml,
  esc,
  inl,
  NS_MAIN,
  numCell,
  serialOf,
} from '../../unit/xlsx-drawing/fixture';

export const EMU_PER_PX = 9525;
/** Spaltenbreite 12 Zeichen bei Arial 10 (Ziffernbreite 7 px) = 84 px. */
export const COL_CHARS = 12;
export const COL_EMU = 84 * EMU_PER_PX;
/** Kopfzeilen 0–5 mit 20 px, Rasterzeilen ab Zeile 6 mit 10 px = 15 Min; Zeile 6 beginnt bei 0400. */
export const HEADER_ROWS = 6;
export const HEADER_ROW_EMU = 20 * EMU_PER_PX;
export const GRID_ROW_EMU = 10 * EMU_PER_PX;
/** Eine Minute im Raster. */
export const MINUTE_EMU = GRID_ROW_EMU / 15;
const GRID_START_MIN = 240;
const GRID_ROWS = 80; // 0400–2400

export const minutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2, 4));
export const yOf = (minute: number): number =>
  HEADER_ROWS * HEADER_ROW_EMU + (minute - GRID_START_MIN) * MINUTE_EMU;

export interface Run {
  readonly text: string;
  readonly bold?: boolean;
  readonly strike?: boolean;
  /** «RRGGBB» */
  readonly color?: string;
}
/** Absatz: Läufe (Zeilenumbruch im Absatz mit {br:true}) oder leer. */
export type Para = readonly (Run | { readonly br: true })[];

export interface DayDef {
  /** Spaltenköpfe in Reihenfolge; '' = unbeschriftete Zwischenspalte. */
  readonly columns: readonly string[];
}

export interface ShapeDef {
  readonly day: number;
  /** Spaltenindizes im Tag (einschliesslich). */
  readonly cols: readonly [number, number];
  readonly from: number;
  readonly to: number;
  readonly paragraphs?: readonly Para[];
  readonly fill?: string | null;
  readonly alpha?: number;
  readonly gradient?: readonly [string, string];
  /** Designfarbe (schemeClr) statt RGB. */
  readonly scheme?: string;
  readonly geometry?: string;
  /** Feinlage in EMU: Versatz links/rechts innerhalb der Spalten (Standard 3000). */
  readonly inset?: number;
  /** Linke und rechte Kante in Spaltenbruchteilen statt ganzer Spalten. */
  readonly fraction?: readonly [number, number];
  readonly rotation?: number;
  /** Als Linie (cxnSp, Höhe 0) zeichnen. */
  readonly line?: boolean;
}

export interface AgendaDef {
  readonly day: number;
  readonly paragraphs: readonly Para[];
}

export interface WeekDef {
  readonly sheet: string;
  /** Titel-Zeile, z.B. «Inf Fik Kp 99/9 Arbeitsplan Woche 1». */
  readonly title: string;
  readonly beilage: string;
  readonly monday: string;
  readonly stand?: string;
  /** Mo … So; fehlende Tage am Ende sind ausgeblendet. */
  readonly days: readonly DayDef[];
  readonly shapes?: readonly ShapeDef[];
  readonly agenda?: readonly AgendaDef[];
  /** Box «Bemerkungen» in der Seitenleiste: Zeilen nach der Überschrift. */
  readonly remarks?: readonly string[];
  /** Box überdeckt die Legende (Beschrieb 14.5). */
  readonly remarksOverLegend?: boolean;
  readonly goals?: readonly string[];
  /** Legendenfarben im Blatt (Beschriftung → «RRGGBB»). */
  readonly legend?: Readonly<Record<string, string>>;
  /** Zusätzliche Formen mit EMU-Anker (für Sonderfälle). */
  readonly rawShapes?: readonly string[];
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

let shapeId = 1000;

function colName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
const ref = (row: number, col: number): string => `${colName(col)}${row + 1}`;

function runXml(r: Run): string {
  const attrs = [r.bold ? 'b="1"' : 'b="0"', r.strike ? 'strike="sngStrike"' : '']
    .filter(Boolean)
    .join(' ');
  const fill = r.color ? `<a:solidFill><a:srgbClr val="${r.color}"/></a:solidFill>` : '';
  return `<a:r><a:rPr lang="de-CH" sz="800" ${attrs}>${fill}</a:rPr><a:t xml:space="preserve">${esc(r.text)}</a:t></a:r>`;
}

function bodyXml(paragraphs: readonly Para[]): string {
  const ps = paragraphs
    .map((p) => `<a:p>${p.map((x) => ('br' in x ? '<a:br/>' : runXml(x))).join('')}</a:p>`)
    .join('');
  return `<xdr:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${ps === '' ? '<a:p/>' : ps}</xdr:txBody>`;
}

function fillXml(s: Pick<ShapeDef, 'fill' | 'alpha' | 'gradient' | 'scheme'>): string {
  if (s.gradient !== undefined)
    return `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${s.gradient[0]}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${s.gradient[1]}"/></a:gs></a:gsLst><a:lin ang="2700000"/></a:gradFill>`;
  if (s.scheme !== undefined) return `<a:solidFill><a:schemeClr val="${s.scheme}"/></a:solidFill>`;
  if (s.fill === null) return '<a:noFill/>';
  const alpha = s.alpha === undefined ? '' : `<a:alpha val="${Math.round(s.alpha * 100000)}"/>`;
  return `<a:solidFill><a:srgbClr val="${s.fill ?? 'FFFF99'}">${alpha}</a:srgbClr></a:solidFill>`;
}

/** Form (xdr:sp) mit absolutem Anker in EMU. */
export function rawShape(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  o: {
    readonly paragraphs?: readonly Para[];
    readonly fill?: string | null;
    readonly alpha?: number;
    readonly gradient?: readonly [string, string];
    readonly scheme?: string;
    readonly geometry?: string;
    readonly rotation?: number;
  } = {},
): string {
  const id = shapeId++;
  const rot = o.rotation ? ` rot="${Math.round(o.rotation * 60000)}"` : '';
  const xfrm = `<a:xfrm${rot}><a:off x="${Math.round(x0)}" y="${Math.round(y0)}"/><a:ext cx="${Math.round(x1 - x0)}" cy="${Math.round(y1 - y0)}"/></a:xfrm>`;
  const body = o.paragraphs === undefined ? '' : bodyXml(o.paragraphs);
  const sp =
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="Form ${id}"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
    `<xdr:spPr>${xfrm}<a:prstGeom prst="${o.geometry ?? 'rect'}"><a:avLst/></a:prstGeom>${fillXml(o)}<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="solid"/></a:ln></xdr:spPr>${body}</xdr:sp>`;
  return absAnchor(Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0), sp);
}

function lineShape(x0: number, y: number, x1: number): string {
  const id = shapeId++;
  const cxn =
    `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="Linie ${id}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
    `<xdr:spPr><a:xfrm><a:off x="${Math.round(x0)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(x1 - x0)}" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp>`;
  return absAnchor(Math.round(x0), Math.round(y), Math.round(x1 - x0), 0, cxn);
}

/** Geometrie eines Blatts: Startspalte je Tag, Spalte der rechten Marken, Seitenleiste. */
export interface SheetGeometry {
  readonly dayStart: readonly number[];
  readonly rightLabelCol: number;
  readonly sideCol: number;
  colX(col: number): number;
  /** x0/x1 der Spalte `c` des Tags `d`. */
  colSpan(d: number, c: number): readonly [number, number];
}

export function geometryOf(week: WeekDef): SheetGeometry {
  const dayStart: number[] = [];
  let col = 1;
  for (const d of week.days) {
    dayStart.push(col);
    col += d.columns.length;
  }
  const colX = (c: number): number => c * COL_EMU;
  return {
    dayStart,
    rightLabelCol: col,
    sideCol: col + 1,
    colX,
    colSpan: (d, c) => [colX((dayStart[d] ?? 0) + c), colX((dayStart[d] ?? 0) + c + 1)],
  };
}

const LEGEND_LABELS = ['Leitung Bat', 'Leitung Kp', 'Leitung Zfhr', 'Extern', 'Ltg S2'];
const DEFAULT_LEGEND: Readonly<Record<string, string>> = {
  'Leitung Bat': 'CCECFF',
  'Leitung Kp': 'FFFF99',
  'Leitung Zfhr': 'FDEADA',
  Extern: 'BFBFBF',
  'Ltg S2': 'FFCC99',
};

function sheetXmlOf(
  week: WeekDef,
  g: SheetGeometry,
  legendStyle: (label: string) => number,
): string {
  const rows: Record<number, string[]> = {};
  const put = (row: number, xml: string) => {
    const list = rows[row + 1] ?? [];
    list.push(xml);
    rows[row + 1] = list;
  };
  put(0, inl(ref(0, 0), 'SCHWEIZER ARMEE'));
  put(1, inl(ref(1, g.sideCol), 'Stand'));
  if (week.stand !== undefined) put(1, numCell(ref(1, g.sideCol + 1), serialOf(week.stand)));
  week.days.forEach((d, i) => {
    const date = new Date(`${week.monday}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const label = `${WEEKDAYS[i] ?? ''} ${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCFullYear()).slice(2)}`;
    put(3, inl(ref(3, g.dayStart[i] ?? 0), label));
    d.columns.forEach((name, c) => {
      if (name !== '') put(5, inl(ref(5, (g.dayStart[i] ?? 0) + c), name));
    });
  });
  put(5, inl(ref(5, g.sideCol), 'Wochenziele'));
  put(42, inl(ref(42, g.sideCol), 'Bemerkungen'));
  put(44, inl(ref(44, g.sideCol), 'Nr'));
  put(44, inl(ref(44, g.sideCol + 1), 'Was'));
  put(58, inl(ref(58, g.sideCol), 'Legende'));
  put(60, inl(ref(60, g.sideCol), 'KR'));
  put(60, inl(ref(60, g.sideCol + 1), 'Kp Rapport fiktiv'));
  LEGEND_LABELS.forEach((label, i) => {
    const row = 74 + i * 2;
    put(row, `<c r="${ref(row, g.sideCol)}" s="${legendStyle(label)}"/>`);
    put(row, inl(ref(row, g.sideCol + 1), label));
  });
  const rowsXml = Object.entries(rows)
    .map(([r, cells]) => [Number(r), cells.join('')] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([r, cells]) => {
      const ht =
        r - 1 >= HEADER_ROWS && r - 1 < HEADER_ROWS + GRID_ROWS ? ' ht="7.5" customHeight="1"' : '';
      return `<row r="${r}"${ht}>${cells}</row>`;
    });
  // Alle Rasterzeilen mit Höhe 7.5 pt (10 px), auch leere.
  const present = new Set(Object.keys(rows).map(Number));
  for (let r = HEADER_ROWS + 1; r <= HEADER_ROWS + GRID_ROWS; r++)
    if (!present.has(r)) rowsXml.push(`<row r="${r}" ht="7.5" customHeight="1"></row>`);
  rowsXml.sort((a, b) => Number(/r="(\d+)"/.exec(a)?.[1]) - Number(/r="(\d+)"/.exec(b)?.[1]));
  const cols = `<col min="1" max="${g.sideCol + 3}" width="${COL_CHARS}" customWidth="1"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rowsXml.join('')}</sheetData></worksheet>`;
}

function drawingOf(week: WeekDef, g: SheetGeometry): string {
  const parts: string[] = [];
  // Titel oben in der Mitte.
  parts.push(
    rawShape(g.colX(2), 0, g.colX(6), HEADER_ROW_EMU * 2, {
      fill: null,
      paragraphs: [[{ text: week.title, bold: true }], [{ text: week.beilage }]],
    }),
  );
  // Stundenmarken links und rechts, zentriert auf der Zeilengrenze der vollen Stunde.
  for (let h = 5; h <= 23; h++) {
    const y = yOf(h * 60);
    const text = `${String(h).padStart(2, '0')}00`;
    for (const col of [0, g.rightLabelCol])
      parts.push(
        rawShape(g.colX(col) + 50_000, y - 40_000, g.colX(col + 1) - 50_000, y + 40_000, {
          fill: null,
          paragraphs: [[{ text }]],
        }),
      );
  }
  for (const s of week.shapes ?? []) {
    const [a] = g.colSpan(s.day, s.cols[0]);
    const [, b] = g.colSpan(s.day, s.cols[1]);
    const inset = s.inset ?? 3000;
    const x0 = s.fraction === undefined ? a + inset : a + (b - a) * s.fraction[0];
    const x1 = s.fraction === undefined ? b - inset : a + (b - a) * s.fraction[1];
    if (s.line) {
      parts.push(lineShape(x0, yOf(s.from), x1));
      continue;
    }
    parts.push(
      rawShape(x0, yOf(s.from), x1, yOf(s.to), {
        ...(s.paragraphs === undefined ? {} : { paragraphs: s.paragraphs }),
        ...(s.fill === undefined ? {} : { fill: s.fill }),
        ...(s.alpha === undefined ? {} : { alpha: s.alpha }),
        ...(s.gradient === undefined ? {} : { gradient: s.gradient }),
        ...(s.scheme === undefined ? {} : { scheme: s.scheme }),
        ...(s.geometry === undefined ? {} : { geometry: s.geometry }),
        ...(s.rotation === undefined ? {} : { rotation: s.rotation }),
      }),
    );
  }
  // Termine: ein Textfeld je Tag unter dem Raster.
  const yAgenda = yOf(1440) + 120_000;
  for (const a of week.agenda ?? []) {
    const last = (week.days[a.day]?.columns.length ?? 1) - 1;
    const [x0] = g.colSpan(a.day, 0);
    const [, x1] = g.colSpan(a.day, last);
    parts.push(
      rawShape(x0 + 5000, yAgenda, x1 - 5000, yAgenda + 900_000, {
        fill: null,
        paragraphs: a.paragraphs,
      }),
    );
  }
  // Seitenleiste.
  const sx0 = g.colX(g.sideCol);
  const sx1 = g.colX(g.sideCol + 3);
  if (week.goals !== undefined)
    parts.push(
      rawShape(sx0, HEADER_ROW_EMU * 6 + 10_000, sx1, yOf(600), {
        fill: null,
        paragraphs: week.goals.map((t) => [{ text: `- ${t}` }]),
      }),
    );
  if (week.remarks !== undefined) {
    // Zeile 42 liegt im Raster: y der Zeilengrenze 42 bzw. 58 (Legende).
    const rowY = (r: number) => HEADER_ROWS * HEADER_ROW_EMU + (r - HEADER_ROWS) * GRID_ROW_EMU;
    const y0 = rowY(43);
    const y1 = week.remarksOverLegend ? rowY(66) : rowY(57);
    parts.push(
      rawShape(sx0, y0, sx1, y1, {
        fill: 'FFFFFF',
        paragraphs: [
          [{ text: 'Bemerkungen (gelten durchgehend)', bold: true }],
          ...week.remarks.map((t) => [{ text: `- ${t}` }]),
        ],
      }),
    );
  }
  parts.push(...(week.rawShapes ?? []));
  return drawingXml(parts.join(''));
}

/** Baut die Arbeitsmappe; Blätter in Reihenfolge. */
export function buildKpWorkbook(weeks: readonly WeekDef[]): Uint8Array {
  const legendColors = [
    ...new Set(
      weeks.flatMap((w) =>
        LEGEND_LABELS.map((l) => (w.legend ?? DEFAULT_LEGEND)[l] ?? DEFAULT_LEGEND[l] ?? 'FFFFFF'),
      ),
    ),
  ];
  const fills = legendColors
    .map(
      (rgb) =>
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/></patternFill></fill>`,
    )
    .join('');
  const xfs = legendColors.map((_, i) => `<xf fillId="${i + 2}"/>`).join('');
  const styles =
    `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts>` +
    `<fills count="${legendColors.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills}</fills>` +
    `<cellXfs count="${legendColors.length + 1}"><xf fillId="0"/>${xfs}</cellXfs></styleSheet>`;
  return buildXlsx({
    stylesXml: styles,
    sheets: weeks.map((w) => {
      const g = geometryOf(w);
      const legend = w.legend ?? DEFAULT_LEGEND;
      const styleOf = (label: string) =>
        legendColors.indexOf(legend[label] ?? DEFAULT_LEGEND[label] ?? 'FFFFFF') + 1;
      return { name: w.sheet, sheetXml: sheetXmlOf(w, g, styleOf), drawingXml: drawingOf(w, g) };
    }),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Bausteine

export const KP_DAY: DayDef = { columns: ['Kdo', 'Alpha', 'Bravo', 'Rap', 'Beso'] };
export const KP_DAY_GAP: DayDef = { columns: ['Kdo', 'Alpha', 'Bravo', '', 'Rap', 'Beso'] };
export const WEEKEND: DayDef = { columns: ['Kp', 'Beso'] };

export const bold = (text: string): Run => ({ text, bold: true });
export const normal = (text: string): Run => ({ text });

/** Fiktive Woche ohne Einträge (Mo–Fr KP_DAY, Sa/So kompakt). */
export function emptyWeek(over: Partial<WeekDef> = {}): WeekDef {
  return {
    sheet: 'Wo 1',
    title: 'Inf Fik Kp 99/9 Arbeitsplan Woche 1',
    beilage: 'Beilage 01-02 zum Allgemeinen Befehl für den FDT 2099',
    monday: '2099-10-05',
    stand: '2099-09-17',
    days: [KP_DAY, KP_DAY, KP_DAY, KP_DAY, KP_DAY, WEEKEND, WEEKEND],
    ...over,
  };
}

/** Blockform: Tag, Spalten (im Tag), Zeit «hhmm», Absätze. */
export function block(
  day: number,
  cols: readonly [number, number],
  from: string,
  to: string,
  paragraphs: readonly Para[],
  extra: Partial<ShapeDef> = {},
): ShapeDef {
  return { day, cols, from: minutes(from), to: minutes(to), paragraphs, ...extra };
}

/** Beso-Kästchen (fest 30 Min) mit Nummer. */
export function besoBox(
  day: number,
  col: number,
  from: string,
  nr: number,
  extra: Partial<ShapeDef> = {},
): ShapeDef {
  return {
    day,
    cols: [col, col],
    from: minutes(from),
    to: minutes(from) + 30,
    paragraphs: [[normal(String(nr))]],
    ...extra,
  };
}

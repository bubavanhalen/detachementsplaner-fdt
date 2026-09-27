// Wholly fictional Kp-WAP workbook generated in code for parser tests. Names,
// places and units are invented. The layout mimics the DrawingML structure of a
// company work plan: cell headers (day row, sub-column row with merges, hidden
// columns), hour labels as shapes in nested groups at both grid sides, boxes as
// anchored shapes (some with stale or zero <a:xfrm>, one rotated inside a group),
// footnote markers, footnote text boxes, legend cells with fills and side notes.
import { strToU8, zipSync } from 'fflate';

export interface SynthColumn {
  label: string;
  /** Width in sheet columns (merged header). */
  span?: number;
}
export interface SynthDay {
  header: string;
  columns: SynthColumn[];
  hidden?: boolean;
}
export interface SynthBox {
  day: number;
  /** Sub-column range of the day (inclusive indices). */
  cols: [number, number];
  from: string;
  to: string;
  lines: string[];
  fill?: string;
  /** Draw as a 90° rotated shape inside a scaled group (visual box = given range). */
  rotated?: boolean;
  /** Top-level <a:xfrm> pointing somewhere else (anchors must win). */
  staleXfrm?: boolean;
  /** Top-level <a:xfrm> with zero offset/extent. */
  zeroXfrm?: boolean;
}
export interface SynthMarker {
  day: number;
  col: number;
  at: string;
  nr: number;
}
export interface SynthSheet {
  name: string;
  title: string;
  mondayIso: string;
  days: SynthDay[];
  boxes: SynthBox[];
  markers?: SynthMarker[];
  footnotes?: { day: number; lines: string[] }[];
  wochenziele?: string[];
  bemerkungen?: string[];
  legend?: Partial<Record<'bat' | 'kp' | 'zfhr' | 'extern' | 's2', string>>;
  abbreviations?: [string, string][];
  /** No drawing part at all. */
  noDrawing?: boolean;
}

// ---------------------------------------------------------------------------
// Geometry (Excel column/row formulas with Arial 10 → max digit width 7 px).

const MDW = 7;
const EMU = 9525;
const COL_WIDTH = 3.5; // chars
const LABEL_WIDTH = 5;
const SIDE_WIDTH = 30;
const ROW_PT = 9; // grid rows: 12 px
const ROW_EMU = Math.round((ROW_PT * 96) / 72) * EMU;
const HEADER_ROW_EMU = 20 * EMU; // default 15 pt
const GRID_ROW0 = 6; // first grid row (0-based) = 04:30
const T0 = 270;

const colPx = (chars: number) => Math.trunc(((256 * chars + Math.trunc(128 / MDW)) / 256) * MDW);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2, 4));

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (index: number) => {
  let n = index + 1,
    out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};
const ref = (row: number, col: number) => `${colName(col)}${row + 1}`;

interface Layout {
  /** Sheet column of each day's sub-columns: [start, end] inclusive. */
  sub: [number, number][][];
  dayStart: number[];
  rightLabel: number;
  side: number;
  widths: number[]; // chars per column (0 = hidden)
}

function layoutOf(sheet: SynthSheet): Layout {
  const widths: number[] = [LABEL_WIDTH];
  const sub: [number, number][][] = [];
  const dayStart: number[] = [];
  for (const day of sheet.days) {
    dayStart.push(widths.length);
    const cols: [number, number][] = [];
    for (const c of day.columns) {
      const start = widths.length;
      for (let i = 0; i < (c.span ?? 1); i++) widths.push(day.hidden ? 0 : COL_WIDTH);
      cols.push([start, widths.length - 1]);
    }
    sub.push(cols);
  }
  const rightLabel = widths.length;
  widths.push(LABEL_WIDTH, SIDE_WIDTH, SIDE_WIDTH);
  return { sub, dayStart, rightLabel, side: rightLabel + 1, widths };
}

const colX = (layout: Layout, col: number) =>
  layout.widths.slice(0, col).reduce((sum, w) => sum + (w ? colPx(w) : 0) * EMU, 0);
const rowY = (row: number) =>
  row < GRID_ROW0 ? row * HEADER_ROW_EMU : GRID_ROW0 * HEADER_ROW_EMU + (row - GRID_ROW0) * ROW_EMU;

/** Grid row/offset of a time (minutes). */
function timeAnchor(t: number): { row: number; off: number } {
  const r = (t - T0) / 15;
  const row = GRID_ROW0 + Math.floor(r);
  return { row, off: Math.round((r - Math.floor(r)) * ROW_EMU) };
}
const timeY = (t: number) => {
  const a = timeAnchor(t);
  return rowY(a.row) + a.off;
};

// ---------------------------------------------------------------------------
// XML parts.

let shapeId = 2;
const nextId = () => shapeId++;

function txBody(lines: string[], vert = ''): string {
  const paras = lines
    .map((line) =>
      line
        ? `<a:p><a:r><a:rPr lang="de-CH" sz="800"/><a:t>${esc(line)}</a:t></a:r></a:p>`
        : '<a:p><a:endParaRPr lang="de-CH"/></a:p>',
    )
    .join('');
  return `<xdr:txBody><a:bodyPr${vert ? ` vert="${vert}"` : ''} wrap="square"/><a:lstStyle/>${paras}</xdr:txBody>`;
}

function fillXml(fill?: string): string {
  return fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>';
}

function sp(
  name: string,
  xfrm: string,
  lines: string[],
  fill?: string,
  opts: { vert?: string; prst?: string } = {},
): string {
  return (
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${nextId()}" name="${esc(name)}"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr>` +
    `<xdr:spPr>${xfrm}<a:prstGeom prst="${opts.prst ?? 'rect'}"><a:avLst/></a:prstGeom>${fillXml(fill)}<a:ln w="3175"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr>` +
    `${lines.length ? txBody(lines, opts.vert) : ''}</xdr:sp>`
  );
}

const xfrmXml = (x: number, y: number, cx: number, cy: number, extra = '') =>
  `<a:xfrm${extra}><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/></a:xfrm>`;

function twoCell(
  fromCol: number,
  fromColOff: number,
  from: { row: number; off: number },
  toCol: number,
  toColOff: number,
  to: { row: number; off: number },
  body: string,
): string {
  return (
    `<xdr:twoCellAnchor><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>${fromColOff}</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>${from.off}</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>${toColOff}</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>${to.off}</xdr:rowOff></xdr:to>` +
    `${body}<xdr:clientData/></xdr:twoCellAnchor>`
  );
}

/** Hour labels 0500 … 2300 in a nested, scaled group anchored on one column. */
function hourLabelGroup(col: number): string {
  const top = timeAnchor(T0),
    bottom = timeAnchor(24 * 60);
  // Outer group: arbitrary xfrm box (mapped onto the anchor), child space 1000 × 11700.
  const labels: string[] = [];
  for (let h = 5; h <= 23; h++) {
    const y = ((h * 60 - 7.5 - T0) * 10) / 2; // inner child units are halved
    labels.push(sp(`Label ${h}`, xfrmXml(50, y, 400, 75), [`${String(h).padStart(2, '0')}00`]));
  }
  const inner =
    `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${nextId()}" name="Inner"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
    `<xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="11700"/><a:chOff x="0" y="0"/><a:chExt cx="500" cy="5850"/></a:xfrm></xdr:grpSpPr>${labels.join('')}</xdr:grpSp>`;
  const outer =
    `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${nextId()}" name="Hours"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
    `<xdr:grpSpPr><a:xfrm><a:off x="777" y="888"/><a:ext cx="300000" cy="9000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000" cy="11700"/></a:xfrm></xdr:grpSpPr>${inner}</xdr:grpSp>`;
  return twoCell(col, 0, top, col + 1, 0, bottom, outer);
}

function boxAnchor(layout: Layout, box: SynthBox) {
  const cols = layout.sub[box.day];
  const c0 = cols[box.cols[0]][0],
    c1 = cols[box.cols[1]][1] + 1;
  return { c0, c1, from: timeAnchor(minutes(box.from)), to: timeAnchor(minutes(box.to)) };
}

function boxXml(layout: Layout, box: SynthBox, index: number): string {
  const a = boxAnchor(layout, box);
  const x0 = colX(layout, a.c0),
    x1 = colX(layout, a.c1);
  const y0 = timeY(minutes(box.from)),
    y1 = timeY(minutes(box.to));
  if (box.rotated) {
    // Group anchored on a wider area; child units = EMU / 100 relative to the anchor.
    const gx0 = colX(layout, layout.dayStart[box.day]);
    const gx1 = x1 + (x1 - x0);
    const gy0 = timeY(minutes(box.from) - 60),
      gy1 = timeY(minutes(box.to) + 60);
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    const w = y1 - y0,
      h = x1 - x0; // unrotated: wide and short
    const child = sp(
      `Rotated ${index}`,
      xfrmXml(
        (cx - w / 2 - gx0) / 100,
        (cy - h / 2 - gy0) / 100,
        w / 100,
        h / 100,
        ' rot="5400000"',
      ),
      box.lines,
      box.fill,
      { vert: 'vert270' },
    );
    const group =
      `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${nextId()}" name="Group ${index}"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
      // The group xfrm differs from the anchor (offset and 2× scale): only the mapping counts.
      `<xdr:grpSpPr><a:xfrm><a:off x="4242" y="2424"/><a:ext cx="${Math.round((gx1 - gx0) * 2)}" cy="${Math.round((gy1 - gy0) * 2)}"/>` +
      `<a:chOff x="0" y="0"/><a:chExt cx="${Math.round((gx1 - gx0) / 100)}" cy="${Math.round((gy1 - gy0) / 100)}"/></a:xfrm></xdr:grpSpPr>${child}</xdr:grpSp>`;
    const gc1 = a.c1 + (a.c1 - a.c0);
    return twoCell(
      layout.dayStart[box.day],
      0,
      timeAnchor(minutes(box.from) - 60),
      gc1,
      0,
      timeAnchor(minutes(box.to) + 60),
      group,
    );
  }
  const xfrm = box.zeroXfrm
    ? xfrmXml(0, 0, 0, 0)
    : box.staleXfrm
      ? xfrmXml(123456, 654321, 99999, 88888)
      : xfrmXml(x0, y0, x1 - x0, y1 - y0);
  return twoCell(a.c0, 0, a.from, a.c1, 0, a.to, sp(`Box ${index}`, xfrm, box.lines, box.fill));
}

function drawingXml(sheet: SynthSheet, layout: Layout): string {
  shapeId = 2;
  const parts: string[] = [];
  // Title box above the grid (ignored by the parser).
  parts.push(
    twoCell(
      3,
      0,
      { row: 0, off: 0 },
      12,
      0,
      { row: 2, off: 0 },
      sp('Title', xfrmXml(0, 0, 1, 1), [sheet.title]),
    ),
  );
  parts.push(hourLabelGroup(0), hourLabelGroup(layout.rightLabel));
  sheet.boxes.forEach((box, i) => {
    parts.push(boxXml(layout, box, i));
  });
  for (const m of sheet.markers ?? []) {
    const cols = layout.sub[m.day][m.col];
    const t = minutes(m.at);
    parts.push(
      twoCell(
        cols[0],
        0,
        timeAnchor(t),
        cols[0] + 1,
        0,
        timeAnchor(t + 30),
        sp(`Marker ${m.nr}`, xfrmXml(0, 0, 0, 0), [String(m.nr)], 'FFFF99'),
      ),
    );
  }
  // Footnote text boxes below the grid, one per day block.
  const below = timeAnchor(24 * 60 + 30);
  for (const fn of sheet.footnotes ?? []) {
    const cols = layout.sub[fn.day];
    parts.push(
      twoCell(
        cols[0][0],
        0,
        below,
        cols[cols.length - 1][1] + 1,
        0,
        { row: below.row + 12, off: 0 },
        sp('Termine', xfrmXml(0, 0, 0, 0), fn.lines),
      ),
    );
  }
  if (sheet.wochenziele)
    parts.push(
      twoCell(
        layout.side,
        0,
        { row: 7, off: 0 },
        layout.side + 2,
        0,
        { row: 25, off: 0 },
        sp('Ziele', xfrmXml(0, 0, 0, 0), sheet.wochenziele),
      ),
    );
  if (sheet.bemerkungen)
    parts.push(
      twoCell(
        layout.side,
        0,
        { row: 31, off: 0 },
        layout.side + 2,
        0,
        { row: 45, off: 0 },
        sp('Bemerkungen', xfrmXml(0, 0, 0, 0), sheet.bemerkungen),
      ),
    );
  // Sun/moon symbols and a red AV line (ignored / diagnostics only).
  parts.push(
    twoCell(
      layout.side,
      0,
      { row: 90, off: 0 },
      layout.side + 1,
      0,
      { row: 91, off: 0 },
      sp('Sonne', xfrmXml(0, 0, 0, 0), [], undefined, { prst: 'sun' }),
    ),
  );
  const av = timeAnchor(7 * 60);
  parts.push(
    twoCell(
      layout.sub[0][0][0],
      0,
      av,
      layout.sub[0][layout.sub[0].length - 1][1],
      0,
      av,
      `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${nextId()}" name="Gerader Verbinder"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr>${xfrmXml(0, 0, 0, 0)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="28575"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${parts.join('')}</xdr:wsDr>`;
}

// Fill ids in styles.xml: 2 bat, 3 kp, 4 zfhr, 5 extern, 6 s2 → cellXfs 1 … 5.
const LEGEND_ORDER = ['bat', 'kp', 'zfhr', 'extern', 's2'] as const;
const LEGEND_LABEL: Record<(typeof LEGEND_ORDER)[number], string> = {
  bat: 'Leitung Bat',
  kp: 'Leitung Kp',
  zfhr: 'Leitung Zfhr',
  extern: 'Extern',
  s2: 'Ltg S2',
};
const DEFAULT_LEGEND = {
  bat: 'CCECFF',
  kp: 'FFFF99',
  zfhr: 'FDEADA',
  extern: 'BFBFBF',
  s2: 'FFC000',
};

function stylesXml(sheet: SynthSheet): string {
  const legend = { ...DEFAULT_LEGEND, ...sheet.legend };
  const fills = LEGEND_ORDER.map(
    (k) =>
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${legend[k]}"/><bgColor indexed="64"/></patternFill></fill>`,
  ).join('');
  const xfs = LEGEND_ORDER.map(
    (_, i) => `<xf numFmtId="0" fontId="0" fillId="${i + 2}" borderId="0" applyFill="1"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts>' +
    `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills}</fills>` +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>${xfs}</cellXfs></styleSheet>`
  );
}

function serial(iso: string): number {
  return (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
}

function sheetXml(sheet: SynthSheet, layout: Layout, sst: string[], withDrawing: boolean): string {
  const cells = new Map<number, [number, string][]>();
  const put = (row: number, col: number, xml: string) =>
    cells.set(row, [...(cells.get(row) ?? []), [col, xml]]);
  const str = (row: number, col: number, text: string, style = 0) => {
    // Alternate shared and inline strings to exercise both.
    if (text.length % 2) {
      sst.push(text);
      put(
        row,
        col,
        `<c r="${ref(row, col)}" t="s"${style ? ` s="${style}"` : ''}><v>${sst.length - 1}</v></c>`,
      );
    } else
      put(
        row,
        col,
        `<c r="${ref(row, col)}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t>${esc(text)}</t></is></c>`,
      );
  };
  const merges: string[] = [];
  str(0, 0, sheet.title);
  str(2, 2, 'Woche vom');
  put(2, 5, `<c r="${ref(2, 5)}"><v>${serial(sheet.mondayIso)}</v></c>`);
  str(3, 0, 'Zeit');
  str(3, layout.rightLabel, 'Zeit');
  sheet.days.forEach((day, d) => {
    str(3, layout.dayStart[d], day.header);
    const cols = layout.sub[d];
    merges.push(`${ref(3, cols[0][0])}:${ref(4, cols[Math.min(1, cols.length - 1)][1])}`);
    day.columns.forEach((c, i) => {
      str(5, cols[i][0], c.label);
      if (cols[i][1] > cols[i][0]) merges.push(`${ref(5, cols[i][0])}:${ref(5, cols[i][1])}`);
    });
  });
  str(5, layout.side + 1, 'Wochenziele');
  str(29, layout.side + 1, 'Bemerkungen');
  str(47, layout.side + 1, 'Legende');
  (sheet.abbreviations ?? []).forEach(([code, text], i) => {
    str(49 + i, layout.side, code);
    str(49 + i, layout.side + 1, text);
  });
  LEGEND_ORDER.forEach((key, i) => {
    const row = 60 + i * 2;
    put(row, layout.side, `<c r="${ref(row, layout.side)}" s="${i + 1}"/>`);
    str(row, layout.side + 1, LEGEND_LABEL[key]);
  });
  const rows = [...cells.keys()].sort((a, b) => a - b);
  const maxRow = timeAnchor(24 * 60).row + 20;
  const rowXml: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const ht = r >= GRID_ROW0 ? ` ht="${ROW_PT}" customHeight="1"` : '';
    const content = rows.includes(r)
      ? (cells.get(r) ?? [])
          .sort((a, b) => a[0] - b[0])
          .map(([, xml]) => xml)
          .join('')
      : '';
    if (ht || content) rowXml.push(`<row r="${r + 1}"${ht}>${content}</row>`);
  }
  const cols = layout.widths
    .map(
      (w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w || COL_WIDTH}"${w ? '' : ' hidden="1"'} customWidth="1"/>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rowXml.join('')}</sheetData>` +
    `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` +
    `${withDrawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`
  );
}

/** Builds a fictional WAP workbook (.xlsx bytes). */
export function buildWap(sheets: SynthSheet[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const sst: string[] = [];
  const add = (path: string, text: string) => {
    files[path] = strToU8(text);
  };
  add(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  const wbRels: string[] = [];
  const sheetEntries: string[] = [];
  sheets.forEach((sheet, i) => {
    const n = i + 1;
    const layout = layoutOf(sheet);
    const withDrawing = !sheet.noDrawing;
    add(`xl/worksheets/sheet${n}.xml`, sheetXml(sheet, layout, sst, withDrawing));
    if (withDrawing) {
      add(
        `xl/worksheets/_rels/sheet${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`,
      );
      add(`xl/drawings/drawing${n}.xml`, drawingXml(sheet, layout));
    }
    wbRels.push(
      `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`,
    );
    sheetEntries.push(`<sheet name="${esc(sheet.name)}" sheetId="${n}" r:id="rId${n}"/>`);
  });
  // Styles: the first sheet's legend colours define the fills.
  add('xl/styles.xml', stylesXml(sheets[0]));
  add(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
  );
  const k = sheets.length;
  wbRels.push(
    `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `<Relationship Id="rId${k + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`,
  );
  add(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>`,
  );
  add(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries.join('')}</sheets></workbook>`,
  );
  add(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
  );
  return zipSync(files);
}

// ---------------------------------------------------------------------------
// The fictional week used by the tests (Kp 99/9, invented places).

const UNITS: SynthColumn[] = [
  { label: 'Stab', span: 2 },
  { label: 'ALPHA 1' },
  { label: 'ALPHA 2' },
  { label: 'BRAVO' },
  { label: 'Rap' },
  { label: 'Beso', span: 2 },
];
const WEEKEND: SynthColumn[] = [{ label: 'Kp', span: 2 }, { label: 'Bes' }];
const ALL = [0, 3] as [number, number];

export const WEEK_A: SynthSheet = {
  name: 'Woche A',
  title: 'Kp 99/9 Arbeitsplan Woche A',
  mondayIso: '2030-01-07',
  legend: { kp: 'FFFF66' },
  abbreviations: [
    ['KR', 'Kp Rap'],
    ['DR', 'Dienstrapport'],
  ],
  days: [
    { header: '  Montag', columns: UNITS },
    { header: '  Dienstag', columns: UNITS },
    { header: '  Mittwoch', columns: UNITS, hidden: true },
    { header: 'Sa 12.01.30', columns: WEEKEND },
    { header: 'So 13.01.30', columns: WEEKEND },
  ],
  boxes: [
    // Monday
    {
      day: 0,
      cols: ALL,
      from: '0600',
      to: '0645',
      lines: ['Tagwach / MoE', '(Ukft/Kantine)'],
      fill: 'FFFF66',
    },
    { day: 0, cols: ALL, from: '0700', to: '0710', lines: ['AV'], fill: 'FFFF66', staleXfrm: true },
    {
      day: 0,
      cols: [0, 0],
      from: '0800',
      to: '1200',
      lines: ['AVOR Übung', '(Ukft)'],
      fill: 'FFFF66',
    },
    {
      day: 0,
      cols: [1, 1],
      from: '0800',
      to: '1100',
      lines: ['Schiessen', 'Grfhr', '(Spl)'],
      fill: 'FDEADA',
    },
    { day: 0, cols: [2, 2], from: '0800', to: '1000', lines: ['Theorie Funk'], fill: 'FDEADA' },
    {
      day: 0,
      cols: [3, 3],
      from: '0900',
      to: '1100',
      lines: ['Fahrschule', '(Ukft)'],
      fill: 'FFFF66',
      rotated: true,
    },
    {
      day: 0,
      cols: [1, 1],
      from: '1300',
      to: '1700',
      lines: ['Späh Ausb (Anh 06-02b-3)'],
      fill: 'BFBFBF',
    },
    { day: 0, cols: [3, 3], from: '1300', to: '1400', lines: ['Geheim'], fill: 'FFFF66' },
    { day: 0, cols: [3, 3], from: '1300', to: '1430', lines: ['Sport'], fill: 'FFFF66' },
    { day: 0, cols: [4, 4], from: '0600', to: '0630', lines: ['KR'], fill: 'FFFF66' },
    {
      day: 0,
      cols: [5, 5],
      from: '1300',
      to: '1600',
      lines: ['Holzlieferung', 'Ltg: Mat C', 'NORDHAUSEN'],
      fill: 'FFFF66',
    },
    { day: 0, cols: ALL, from: '1800', to: '1845', lines: ['NaE'], fill: 'FFFF66', zeroXfrm: true },
    { day: 0, cols: [0, 0], from: '1900', to: '2100', lines: ['BR 2', '(Bat KP)'], fill: 'CCECFF' },
    { day: 0, cols: ALL, from: '2200', to: '2230', lines: ['ABV 2330', '(Trp)'], fill: 'FFFF66' },
    // Tuesday
    {
      day: 1,
      cols: ALL,
      from: '0600',
      to: '0645',
      lines: ['Tagwach / MoE', '(Ukft/Kantine)'],
      fill: 'FFFF66',
    },
    {
      day: 1,
      cols: [1, 1],
      from: '0800',
      to: '1200',
      lines: ['Gefechtsschiessen', '(Spl)'],
      fill: 'FDEADA',
    },
    {
      day: 1,
      cols: [2, 2],
      from: '0800',
      to: '1200',
      lines: ['Gefechtsschiessen', '(Spl)'],
      fill: 'FDEADA',
    },
    { day: 1, cols: [3, 3], from: '0800', to: '1200', lines: ['Wachtdienst'], fill: 'FFFF66' },
    { day: 1, cols: [4, 4], from: '1100', to: '1200', lines: ['DR'], fill: 'FFFF66' },
    {
      day: 1,
      cols: [0, 0],
      from: '1300',
      to: '1600',
      lines: ['Aufbau Zelte', 'Einh Fw', '', 'Aufbau Küche', 'Four', '', 'anschl', 'Rückschub'],
      fill: 'FFFF66',
    },
    { day: 1, cols: ALL, from: '1930', to: '2200', lines: ['Kaderabend'], fill: 'FFFF66' },
    { day: 1, cols: [3, 3], from: '1300', to: '1600', lines: ['KU QXZ 4 (Spl)'], fill: 'BFBFBF' },
    // Saturday
    { day: 3, cols: [0, 0], from: '0800', to: '1800', lines: ['Urlaub'], fill: 'FFFF66' },
  ],
  markers: [
    { day: 0, col: 5, at: '1330', nr: 11 },
    { day: 0, col: 5, at: '1500', nr: 12 },
    { day: 0, col: 5, at: '1315', nr: 14 },
    { day: 0, col: 5, at: '1700', nr: 15 },
    { day: 1, col: 5, at: '2000', nr: 21 },
    { day: 4, col: 1, at: '1000', nr: 70 },
  ],
  footnotes: [
    {
      day: 0,
      lines: [
        '11 1330-1400: Materialkontrolle, Ltg: Einh Fw, Tn: alle Zfhr, Ort: Mag.',
        '12 Wachtablösung; Ltg: Wacht Of.',
        '13 1600: Info via Teams, Tn: Kdt Stv.',
        '14 1330-1630: Holzlieferung NORDHAUSEN, Tn: Mat C.',
      ],
    },
    {
      day: 1,
      lines: [
        '21 — 2000: Planungsrapport, Tn: Kdt Stv, Four.',
        '22 1500: Kontrolle QZX 4 Material.',
      ],
    },
    { day: 4, lines: ['70 Rückkehr Vorausdetachement; Ltg: Four.'] },
  ],
  wochenziele: ['- Ziel eins ist erreicht.', '- Ziel zwei (Bf 08-04) ist erreicht.'],
  bemerkungen: [
    'Bemerkungen (gelten durchgehend)',
    '- Späh melden sich beim Kdt.',
    '- Ausgang bis 2300.',
  ],
};

const STUFEN: SynthColumn[] = [
  { label: 'Kdt', span: 2 },
  { label: 'Stv' },
  { label: 'Zfhr' },
  { label: 'Wm' },
  { label: 'Trp' },
  { label: 'Rap' },
  { label: 'Beso', span: 2 },
];

export const WEEK_B: SynthSheet = {
  name: 'Woche B',
  title: 'Kp 99/9 Arbeitsplan Woche B',
  mondayIso: '2030-01-14',
  days: [
    { header: 'Montag', columns: STUFEN },
    { header: 'Dienstag', columns: STUFEN },
  ],
  boxes: [
    { day: 0, cols: [0, 0], from: '0800', to: '1200', lines: ['AVOR'] },
    { day: 0, cols: [1, 1], from: '0800', to: '1200', lines: ['Planung Ausb'] },
    { day: 0, cols: [3, 4], from: '0800', to: '1700', lines: ['Einrichten Mag', 'Einh Fw'] },
    {
      day: 1,
      cols: [0, 2],
      from: '1300',
      to: '1700',
      lines: ['Erkundung Gelände WESTFELD'],
      fill: 'BFBFBF',
    },
    { day: 1, cols: [0, 4], from: '1200', to: '1300', lines: ['MiE'] },
  ],
};

export const EMPTY_SHEET: SynthSheet = {
  name: 'Leer',
  title: 'Leer',
  mondayIso: '2030-01-21',
  days: [{ header: 'Montag', columns: UNITS }],
  boxes: [],
  noDrawing: true,
};

export const syntheticWap = (): Uint8Array => buildWap([WEEK_A, WEEK_B, EMPTY_SHEET]);

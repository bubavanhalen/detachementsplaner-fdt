// Wholly fictional stand-in for the official Tagesbefehl template. It mirrors only
// the structure the xlsx export relies on (sheet names, row numbers, style ids,
// Conf formulas, drawings with the signature picture) plus the known template
// bugs the export must clean up. No real names, texts or images.
import { strToU8, zipSync, zlibSync } from 'fflate';
import { createProject } from '../../src/model/project';
import { buildOrders, createTbState, emptyWeek } from '../../src/model/tagesbefehl/state';
import type { TbEntry, TbState, TbWeek, TbWeekday } from '../../src/model/tagesbefehl/types';
import type { Person, Project } from '../../src/model/types';

// ---------------------------------------------------------------------------
// PNG encoder (RGBA, no filter) for fictional logos and signatures.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(strToU8(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
export function makePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number] = () => [0, 0, 0, 255],
): Uint8Array {
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Template parts.

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export const TEMPLATE_UNIT = 'Vorlage Kp 9/9';
export const TEMPLATE_NAME = 'Hptm Vorlage Beispiel';
const SST = [
  '1. Tag der Woche', // 0
  '1. Tagesbefehl Nummer der Woche', // 1
  'LK', // 2
  'Ersteller - Einheit', // 3
  TEMPLATE_UNIT, // 4
  'Ersteller - Name', // 5
  TEMPLATE_NAME, // 6
  'Ersteller - Funktion', // 7
  'Kommandant', // 8
  `Kdt ${TEMPLATE_UNIT}`, // 9
  'Tagesbefehl', // 10
  '1 Dienstbetrieb / Ausbildung', // 11
  '0600', // 12
  'Beispieltätigkeit Vorlage', // 13
  'Tagesoffizier', // 14
  'Geht an', // 15
  'z K an', // 16
  '2 Besonderes', // 17
  'Wochenend Wacht Of', // 18
  'LK 1:25 000, Bl 9999', // 19
  'Name', // 20
  'Tel Nr.', // 21
  '(via Anschlag)', // 22
];
export const DAY_SHEETS: TbWeekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const s = (ref: string, index: number, style = 1) =>
  `<c r="${ref}" s="${style}" t="s"><v>${index}</v></c>`;
const e = (ref: string, style = 1) => `<c r="${ref}" s="${style}"/>`;
const f = (ref: string, formula: string, value: string, style = 1) =>
  `<c r="${ref}" s="${style}" t="str"><f>${formula}</f><v>${value}</v></c>`;
const row = (r: number, cells: string, attrs = '') =>
  `<row r="${r}" spans="2:9"${attrs} x14ac:dyDescent="0.15">${cells}</row>`;

function worksheet(sheetData: string, tail: string, extra = ''): string {
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A2:I79"/><sheetViews><sheetView ${extra}workbookViewId="0"><selection activeCell="B7" sqref="B7"/></sheetView></sheetViews><sheetFormatPr baseColWidth="10" defaultColWidth="9.1640625" defaultRowHeight="13" x14ac:dyDescent="0.15"/><cols><col min="1" max="1" width="9.1640625" style="2" customWidth="1"/><col min="2" max="2" width="14.6640625" style="2" customWidth="1"/><col min="3" max="3" width="39.5" style="2" customWidth="1"/><col min="4" max="5" width="18.5" style="2" customWidth="1"/></cols><sheetData>${sheetData}</sheetData>${tail}</worksheet>`;
}
const PAGE =
  '<pageMargins left="0.59" right="0.24" top="0.59" bottom="0.59" header="0" footer="0"/><pageSetup paperSize="9" scale="88" orientation="portrait"/><drawing r:id="rId2"/>';

function header(offset: number, n: number, e2: string): string {
  const plus = n ? `+${n}` : '';
  const title = `&quot;Tagesbefehl Nr &quot;&amp;Conf!B2${plus}&amp;&quot; für &quot;&amp;TEXT(Conf!B1${plus},&quot;TTTT, TT.MM.JJJJ&quot;)`;
  return [
    row(
      offset + 2,
      e(`B${offset + 2}`) + e2 + e(`I${offset + 2}`, 17),
      ' ht="66.5" customHeight="1"',
    ),
    row(offset + 3, s(`B${offset + 3}`, 9, 3)),
    row(
      offset + 4,
      s(`B${offset + 4}`, 10, 20) + e(`C${offset + 4}`, 21) + e(`E${offset + 4}`, 21),
    ),
    row(offset + 5, e(`B${offset + 5}`), ' ht="4.5" customHeight="1"'),
    row(offset + 7, f(`B${offset + 7}`, title, `Tagesbefehl Nr ${n + 1} für Vorlage`, 6)),
    row(offset + 8, f(`B${offset + 8}`, 'Conf!B5', 'LK 1:25 000, Bl 9999')),
    row(offset + 10, e(`B${offset + 10}`, 8) + e(`E${offset + 10}`, 8)),
  ].join('');
}

function daySheet(n: number): string {
  const brokenValue = n === 1 ? '<c r="E2" s="5" t="e"><v>#VALUE!</v></c>' : e('E2', 5);
  const rows = [
    header(0, n, brokenValue),
    row(11, s('B11', 11, 10)),
    row(12, s('B12', 12, 13) + s('C12', 13) + e('D12') + e('E12', 12)),
    row(30, e('B30', 9) + e('C30')),
    row(47, s('C47', 14) + s('D47', 20) + s('E47', 21)),
    row(50, f('D50', 'Conf!B7', TEMPLATE_UNIT)),
    n === 0 ? row(51, '<c r="D51" s="1" t="e"><f>Mo!#REF!=Conf!#REF!</f><v>#REF!</v></c>') : '',
    row(53, f('D53', 'Conf!B8', TEMPLATE_NAME)),
    row(54, f('D54', 'Conf!B9', 'Kommandant')),
    row(56, s('B56', 15, 10)),
    row(57, s('B57', 9)),
    row(58, s('B58', 4) + s('C58', 22)),
    row(60, s('B60', 16)),
    row(61, s('B61', 9)),
    n === 0 ? row(79, e('I79', 14)) : '',
  ].join('');
  const merges =
    n === 0
      ? '<mergeCells count="2"><mergeCell ref="B4:E4"/><mergeCell ref="B30:E30"/></mergeCells>'
      : '<mergeCells count="1"><mergeCell ref="B4:E4"/></mergeCells>';
  const cf =
    n === 0
      ? '<conditionalFormatting sqref="I79"><cfRule type="expression" dxfId="0" priority="1"><formula>IF(#REF!="OK",TRUE,FALSE)</formula></cfRule></conditionalFormatting>'
      : '';
  return worksheet(rows, merges + cf + PAGE, n === 0 ? 'tabSelected="1" ' : '');
}

function weekendSheet(): string {
  const half = (o: number, n: number) =>
    [
      header(o, n, e(`E${o + 2}`, 5)),
      row(o + 11, s(`B${o + 11}`, 11, 10)),
      row(o + 12, s(`B${o + 12}`, 12, 13) + s(`C${o + 12}`, 13)),
      row(o + 13, s(`B${o + 13}`, 12, 13) + s(`C${o + 13}`, 13)),
    ].join('');
  const rows = [
    half(0, 5),
    row(14, e('B14', 13)),
    row(15, e('B15', 13) + e('C15', 18)),
    row(17, s('B17', 12, 13) + s('C17', 13)),
    row(19, s('B19', 17, 10) + e('C19', 18)),
    row(20, e('B20') + e('C20', 18)),
    row(22, s('C22', 18) + s('D22', 20) + s('E22', 21)),
    row(24, e('B24')),
    row(25, f('D25', 'Conf!B7', TEMPLATE_UNIT)),
    row(28, f('D28', 'Conf!B8', TEMPLATE_NAME)),
    row(29, f('D29', 'Conf!B9', 'Kommandant')),
    row(31, s('B31', 15, 10)),
    row(32, s('B32', 9)),
    row(33, s('B33', 4) + s('C33', 22)),
    row(35, s('B35', 16)),
    row(36, s('B36', 9)),
    half(36, 6).replace('Conf!B2+6', 'Conf!$B$2+6').replace('Conf!B1+6', 'Conf!$B$1+6'),
    row(50, s('B50', 17, 10)),
    row(51, e('B51')),
    row(53, s('C53', 18) + s('D53', 20) + s('E53', 21)),
    row(56, f('D56', 'Conf!B7', TEMPLATE_UNIT)),
    row(59, f('D59', 'Conf!B8', TEMPLATE_NAME)),
    row(60, f('D60', 'Conf!B9', 'Kommandant')),
    row(62, s('B62', 15, 10)),
    row(63, s('B63', 9)),
    row(64, s('B64', 4) + s('C64', 22)),
    row(66, s('B66', 16)),
    row(67, s('B67', 9)),
  ].join('');
  return worksheet(
    rows,
    `<mergeCells count="2"><mergeCell ref="B4:E4"/><mergeCell ref="B40:E40"/></mergeCells>${PAGE}`,
  );
}

function confSheet(): string {
  const rows = [
    `<row r="1">${s('A1', 0)}<c r="B1" s="15"><v>45978</v></c></row>`,
    `<row r="2">${s('A2', 1)}<c r="B2" s="11"><v>1</v></c></row>`,
    `<row r="5">${s('A5', 2)}${s('B5', 19, 11)}</row>`,
    `<row r="7"><c r="A7" t="s"><v>3</v></c>${s('B7', 4)}</row>`,
    `<row r="8"><c r="A8" t="s"><v>5</v></c>${s('B8', 6)}</row>`,
    `<row r="9"><c r="A9" t="s"><v>7</v></c>${s('B9', 8)}</row>`,
  ].join('');
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><dimension ref="A1:B9"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="13"/><sheetData>${rows}</sheetData><pageMargins left="0.7" right="0.7" top="0.78" bottom="0.78" header="0.3" footer="0.3"/></worksheet>`;
}

function styles(): string {
  const xf = (attrs = '') =>
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"${attrs}/>`;
  const xfs = Array.from({ length: 22 }, (_, i) =>
    i === 9 || i === 13
      ? '<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      : i === 15
        ? '<xf numFmtId="14" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        : i === 10
          ? '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
          : xf(),
  ).join('');
  return `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="22">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><fill><patternFill><bgColor rgb="FF92D050"/></patternFill></fill></dxf></dxfs></styleSheet>`;
}

const picture = (
  id: number,
  rid: string,
  from: [number, number, number, number],
  to: [number, number, number, number],
) => {
  const marker = (tag: string, [col, colOff, r, rowOff]: number[]) =>
    `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:${tag}>`;
  return `<xdr:twoCellAnchor editAs="oneCell">${marker('from', from)}${marker('to', to)}<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Grafik ${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="${rid}"><a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="959518" cy="282431"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
};
const drawingXml = (anchors: string) =>
  `${XML_HEAD}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`;
const rels = (items: [string, string, string, string?][]) =>
  `${XML_HEAD}<Relationships xmlns="${NS_PKG}">${items
    .map(
      ([id, type, target, mode]) =>
        `<Relationship Id="${id}" Type="${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`,
    )
    .join('')}</Relationships>`;

export const LOGO_ANCHOR: [number, number, number, number] = [1, 38100, 1, 65422];
export const SIGNATURE_PNG = makePng(34, 10, (x, y) =>
  y > 3 && y < 6 && x > 2 ? [0, 0, 0, 255] : [0, 0, 0, 0],
);

/** Fictional template; drawing2 (Di) uses a different rId for the signature picture. */
export function buildSyntheticTemplate(): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, text: string) => {
    files[path] = strToU8(text);
  };
  const sheetNames = ['Conf', ...DAY_SHEETS, 'Sa + So'];
  const sheetIds = [20, 19, 21, 22, 23, 24, 26, 27, 25];
  const overrides = [
    [
      '/xl/workbook.xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    ],
    ...sheetNames.map((_, i) => [
      `/xl/worksheets/sheet${i + 1}.xml`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
    ]),
    [
      '/xl/externalLinks/externalLink1.xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml',
    ],
    ['/xl/styles.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'],
    [
      '/xl/sharedStrings.xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
    ],
    ...Array.from({ length: 8 }, (_, i) => [
      `/xl/drawings/drawing${i + 1}.xml`,
      'application/vnd.openxmlformats-officedocument.drawing+xml',
    ]),
    [
      '/xl/calcChain.xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml',
    ],
    ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
  ];
  put(
    '[Content_Types].xml',
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides
      .map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)
      .join('')}</Types>`,
  );
  put(
    '_rels/.rels',
    rels([
      ['rId3', `${REL}/extended-properties`, 'docProps/app.xml'],
      [
        'rId2',
        'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        'docProps/core.xml',
      ],
      ['rId1', `${REL}/officeDocument`, 'xl/workbook.xml'],
    ]),
  );
  put(
    'docProps/core.xml',
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Vorlage</dc:title><dc:creator>Vorlage Autor</dc:creator><cp:lastModifiedBy>Vorlage Bearbeiter</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2020-01-02T00:00:00Z</dcterms:modified></cp:coreProperties>`,
  );
  put(
    'docProps/app.xml',
    `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>`,
  );
  const definedNames = [
    ...sheetNames.slice(1).map((name, i) => {
      const quoted = name.includes(' ') ? `'${name}'` : name;
      return `<definedName name="_xlnm.Print_Area" localSheetId="${i + 1}">${quoted}!$A$1:$E$${name === 'Sa + So' ? 68 : 61}</definedName>`;
    }),
    '<definedName name="Pers_2">[1]Liste!$A$2:$A$110</definedName>',
  ].join('');
  put(
    'xl/workbook.xml',
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x15" xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"><workbookPr/><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x15"><x15ac:absPath url="C:\\Vorlagen\\Beispiel\\" xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac"/></mc:Choice></mc:AlternateContent><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="15000" activeTab="1"/></bookViews><sheets>${sheetNames
      .map((name, i) => `<sheet name="${name}" sheetId="${sheetIds[i]}" r:id="rId${i + 1}"/>`)
      .join(
        '',
      )}</sheets><externalReferences><externalReference r:id="rId10"/></externalReferences><definedNames>${definedNames}</definedNames><calcPr calcId="191028"/></workbook>`,
  );
  put(
    'xl/_rels/workbook.xml.rels',
    rels([
      ...sheetNames.map(
        (_, i) =>
          [`rId${i + 1}`, `${REL}/worksheet`, `worksheets/sheet${i + 1}.xml`] as [
            string,
            string,
            string,
          ],
      ),
      ['rId10', `${REL}/externalLink`, 'externalLinks/externalLink1.xml'],
      ['rId11', `${REL}/styles`, 'styles.xml'],
      ['rId12', `${REL}/sharedStrings`, 'sharedStrings.xml'],
      ['rId13', `${REL}/calcChain`, 'calcChain.xml'],
    ]),
  );
  put(
    'xl/externalLinks/externalLink1.xml',
    `${XML_HEAD}<externalLink xmlns="${NS_MAIN}"><externalBook xmlns:r="${NS_R}" r:id="rId1"><sheetNames><sheetName val="Liste"/></sheetNames></externalBook></externalLink>`,
  );
  put(
    'xl/externalLinks/_rels/externalLink1.xml.rels',
    rels([['rId1', `${REL}/externalLinkPath`, 'file:///C:/Beispiel/Liste.xlsx', 'External']]),
  );
  put(
    'xl/calcChain.xml',
    `${XML_HEAD}<calcChain xmlns="${NS_MAIN}"><c r="B7" i="19" l="1"/><c r="D51" i="19"/></calcChain>`,
  );
  put('xl/styles.xml', styles());
  put(
    'xl/sharedStrings.xml',
    `${XML_HEAD}<sst xmlns="${NS_MAIN}" count="${SST.length}" uniqueCount="${SST.length}">${SST.map(
      (text) => `<si><t>${text}</t></si>`,
    ).join('')}</sst>`,
  );
  put('xl/worksheets/sheet1.xml', confSheet());
  DAY_SHEETS.forEach((_, n) => {
    put(`xl/worksheets/sheet${n + 2}.xml`, daySheet(n));
  });
  put('xl/worksheets/sheet9.xml', weekendSheet());
  for (let i = 2; i <= 9; i++)
    put(
      `xl/worksheets/_rels/sheet${i}.xml.rels`,
      rels([['rId2', `${REL}/drawing`, `../drawings/drawing${i - 1}.xml`]]),
    );
  for (let d = 1; d <= 8; d++) {
    const sigRid = d === 2 ? 'rId5' : 'rId2';
    const logoRid = d === 2 ? 'rId2' : 'rId1';
    const anchors =
      d === 8
        ? picture(2, logoRid, LOGO_ANCHOR, [2, 990600, 1, 477503]) +
          picture(7, sigRid, [3, 0, 25, 24849], [3, 959518, 26, 141628]) +
          picture(8, sigRid, [3, 0, 56, 24849], [3, 959518, 57, 141627])
        : picture(2, logoRid, LOGO_ANCHOR, [2, 990600, 1, 477503]) +
          picture(5, sigRid, [3, 8283, 50, 24846], [3, 967801, 51, 141625]);
    put(`xl/drawings/drawing${d}.xml`, drawingXml(anchors));
    put(
      `xl/drawings/_rels/drawing${d}.xml.rels`,
      rels([
        [logoRid, `${REL}/image`, '../media/image1.png'],
        [sigRid, `${REL}/image`, '../media/image2.png'],
      ]),
    );
  }
  files['xl/media/image1.png'] = makePng(20, 6, () => [40, 80, 160, 255]);
  files['xl/media/image2.png'] = makePng(34, 10, () => [200, 200, 200, 255]);
  files['[trash]/0000.dat'] = new Uint8Array([1, 2, 3]);
  return zipSync(files);
}

// ---------------------------------------------------------------------------
// Fictional week built with the real order builder.

const person = (
  id: string,
  grad: string,
  vorname: string,
  nachname: string,
  tel: string,
): Person => ({
  id,
  name: `${vorname} ${nachname}`,
  vorname,
  nachname,
  grad,
  funktion: 'Zugführer',
  einteilung: 'Muster Kp 1/1',
  tel,
  lics: [],
  raw: {},
  planning: { status: 'included', reason: '' },
});

let entryCounter = 0;
export function fictionalEntry(
  day: TbWeekday,
  section: TbEntry['section'],
  zeit: string,
  taetigkeit: string,
  verantwortlich = 'Einh Fw',
  ort = 'Ukft',
  group = '',
): TbEntry {
  return { id: `e${++entryCounter}`, day, section, group, zeit, taetigkeit, verantwortlich, ort };
}

export function fictionalSetup(days: TbWeekday[] = DAY_SHEETS): {
  project: Project;
  tb: TbState;
  week: TbWeek;
} {
  const project = createProject();
  project.settings.eigeneEinheit = 'Muster Kp 1/1';
  project.persons = [
    person('p1', 'Oblt', 'Anna', 'Muster', '000 000 00 01'),
    person('p2', 'Lt', 'Beat', 'Beispiel', '000 000 00 02'),
  ];
  const tb = createTbState();
  tb.settings = {
    ...tb.settings,
    lk: 'LK 1:25 000, Bl 1111',
    kdtName: 'Hptm Hans Muster',
    kdtFunktion: 'Kommandant',
    zK: ['Kdt Muster Bat 1'],
    dienstleistung: 'FDT_2026',
  };
  tb.offiziere = ['p1', 'p2'];
  const week: TbWeek = {
    ...emptyWeek('Wo 1'),
    startDate: '2026-09-28',
    firstNumber: 8,
    days,
    groups: { Mi: ['Gruppe Alpha', 'Gruppe Bravo'] },
    wachtOf: { Sa: ['Wacht Of Muster Kp 1/2', 'Tel folgt'], So: ['Wacht Of Muster Kp 1/2'] },
    entries: [
      fictionalEntry('Mo', 'dienstbetrieb', '0600', 'Tagwache'),
      fictionalEntry('Mo', 'dienstbetrieb', '0700', 'AV', 'Kp Kdt', 'AV Platz'),
      fictionalEntry(
        'Mo',
        'besonderes',
        'gz Tag',
        'Ein sehr langer fiktiver Besonderes-Eintrag, der sicher über mehrere Zeilen umbricht & <Sonderzeichen> "zitiert"',
        'Oblt Muster',
        'Ausbildungsgelände Nord',
      ),
      fictionalEntry('Mo', 'rapporte', '1700', 'Kp Rap', 'Kp Kdt', 'Rapportraum'),
      fictionalEntry('Mi', 'dienstbetrieb', '0600', 'Tagwache'),
      fictionalEntry(
        'Mi',
        'dienstbetrieb',
        '0800 - 1200',
        'Ausbildung A',
        'Zfhr',
        'Spl',
        'Gruppe Alpha',
      ),
      fictionalEntry(
        'Mi',
        'dienstbetrieb',
        '0800 - 1200',
        'Ausbildung B',
        'Zfhr',
        'Spl',
        'Gruppe Bravo',
      ),
      fictionalEntry('Sa', 'dienstbetrieb', 'gz Tag', 'Allgemeiner Urlaub', 'Kp Kdt', ''),
      fictionalEntry('Sa', 'besonderes', '1000', 'Wachablösung', 'Wacht Of', 'Kaserne'),
      fictionalEntry('So', 'dienstbetrieb', 'gz Tag', 'Allgemeiner Urlaub', 'Kp Kdt', ''),
    ],
  };
  tb.wochen[week.sheet] = week;
  return { project, tb, week };
}

export function fictionalOrders(days?: TbWeekday[]) {
  const setup = fictionalSetup(days);
  return { ...setup, orders: buildOrders(setup.project, setup.tb, setup.week) };
}

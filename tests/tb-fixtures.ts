// Wholly fictional Tagesbefehl fixtures and synthetic images/templates for tests.
import { strToU8, zipSync, zlibSync } from 'fflate';
import { orderTitle } from '../src/model/tagesbefehl/state';
import {
  isWeekend,
  TB_SECTION_HEADINGS,
  TB_WEEKDAYS,
  type TbOrder,
  type TbOrderBlock,
  type TbWeekday,
} from '../src/model/tagesbefehl/types';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const u32 = (value: number) => [
  value >>> 24,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
function chunk(type: string, data: Uint8Array): number[] {
  const typed = new Uint8Array([...strToU8(type), ...data]);
  return [...u32(data.length), ...typed, ...u32(crc32(typed))];
}

/** Synthetic RGBA PNG (solid colour), built by hand. */
export function makePng(width: number, height: number, rgba = [20, 45, 150, 255]): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) raw.set(rgba, y * (1 + width * 4) + 1 + x * 4);
  }
  const header = new Uint8Array([...u32(width), ...u32(height), 8, 6, 0, 0, 0]);
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', header),
    ...chunk('IDAT', zlibSync(raw)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

const entry = (
  entryId: string,
  zeit: string,
  taetigkeit: string,
  verantwortlich: string,
  ort: string,
): TbOrderBlock => ({ kind: 'entry', entryId, zeit, taetigkeit, verantwortlich, ort });

/** A fictional order for a fictional unit (no real persons, places or numbers). */
export function fictionalOrder(day: TbWeekday = 'Mi', overrides: Partial<TbOrder> = {}): TbOrder {
  const index = TB_WEEKDAYS.indexOf(day) + 1,
    weekend = isWeekend(day),
    number = 40 + index,
    date = `2031-03-${String(9 + index).padStart(2, '0')}`;
  const blocks: TbOrderBlock[] = weekend
    ? [
        { kind: 'section', heading: TB_SECTION_HEADINGS.dienstbetrieb },
        entry(`${day}-1`, 'gz Tag', 'Allgemeiner Urlaub', 'Kp Kdt', ''),
        { kind: 'section', heading: TB_SECTION_HEADINGS.besonderes },
        entry(`${day}-2`, '1000', 'Übernahme Wache Musterdorf', 'Wacht Of', 'Kaserne Beispiel'),
      ]
    : [
        { kind: 'section', heading: TB_SECTION_HEADINGS.dienstbetrieb },
        entry(`${day}-1`, '0600', 'Tagwache', 'Zfhr / Einh Fw', 'Ukft'),
        entry(`${day}-2`, '0615 - 0645', 'Morgenessen', 'Einh Four', 'Ukft'),
        entry(`${day}-3`, '0700', 'AV', 'Kp Kdt', 'AV Platz'),
        { kind: 'group', heading: 'COBRA 10 / COBRA 20' },
        entry(
          `${day}-4`,
          '0730 - 1145',
          'Ausbildung Fahrzeugbergung im Gelände – Übungsanlage Süd, anschliessend Parkdienst und Retablierung',
          'Oblt Muster',
          'Übungsplatz Beispielberg',
        ),
        { kind: 'section', heading: TB_SECTION_HEADINGS.besonderes },
        entry(`${day}-5`, 'bis 1200', 'Meldung Sanität', 'Einh Fw', ''),
        { kind: 'section', heading: TB_SECTION_HEADINGS.rapporte },
        entry(`${day}-6`, '1730', 'Kp Rap', 'Kp Kdt', 'Rapportraum'),
      ];
  return {
    day,
    index,
    date,
    number,
    title: orderTitle(number, day, date),
    lk: 'LK 1:25 000, Bl 9999',
    einheit: 'Inf Ustü Kp 99/9',
    weekend,
    blocks,
    officer: weekend
      ? { label: 'Wochenend Wacht Of', lines: ['Wacht Of Kp 99/8', 'Tel folgt'] }
      : { label: 'Tagesoffizier', lines: ['Oblt Muster Max', '000 000 00 00'] },
    signature: { einheit: 'Inf Ustü Kp 99/9', name: 'Hptm Beispiel Hans', funktion: 'Kommandant' },
    verteiler: {
      gehtAn: ['Kader Inf Ustü Kp 99/9', 'Inf Ustü Kp 99/9 (via Anschlag)'],
      zK: ['Kdt Inf Bat 99'],
    },
    ...overrides,
  };
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function picAnchor(
  rid: string,
  from: [number, number, number, number],
  ext: [number, number],
): string {
  const [col, colOff, row, rowOff] = from;
  return `<xdr:twoCellAnchor editAs="absolute"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col}</xdr:col><xdr:colOff>${colOff + ext[0]}</xdr:colOff><xdr:row>${row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Bild"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ext[0]}" cy="${ext[1]}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
}

/**
 * Minimal synthetic template: sheets "Conf" and "Mo"; Mo has a left logo, a centred JPEG,
 * a right logo in the header and the signature picture (image2.png) further down.
 */
export function syntheticTemplate(): {
  xlsx: Uint8Array;
  left: Uint8Array;
  right: Uint8Array;
  center: Uint8Array;
} {
  const left = makePng(8, 2, [200, 0, 0, 255]),
    right = makePng(4, 4, [0, 120, 0, 255]),
    signature = makePng(6, 2),
    center = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0xff, 0xd9,
    ]);
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheetFormatPr defaultRowHeight="13"/><cols><col min="1" max="1" width="9.1640625" customWidth="1"/><col min="2" max="2" width="14.6640625" customWidth="1"/><col min="3" max="3" width="39.5" customWidth="1"/><col min="4" max="5" width="18.5" customWidth="1"/></cols><sheetData><row r="2" ht="66.5" customHeight="1"/><row r="3" ht="18"/></sheetData><drawing r:id="rId1"/></worksheet>`;
  const drawing = `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${picAnchor('rId1', [1, 38100, 1, 65422], [1955800, 412081])}${picAnchor('rId2', [3, 0, 48, 55000], [1060000, 300200])}${picAnchor('rId4', [2, 900000, 1, 0], [720000, 360000])}${picAnchor('rId3', [4, 238125, 1, 0], [972000, 844500])}</xdr:wsDr>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheets><sheet name="Conf" sheetId="1" r:id="rId1"/><sheet name="Mo" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS_MAIN}"><sheetData/></worksheet>`,
    ),
    'xl/worksheets/sheet2.xml': strToU8(sheet),
    'xl/worksheets/_rels/sheet2.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    ),
    'xl/drawings/drawing1.xml': strToU8(drawing),
    'xl/drawings/_rels/drawing1.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG}"><Relationship Id="rId3" Type="${REL}/image" Target="../media/image3.png"/><Relationship Id="rId2" Type="${REL}/image" Target="../media/image2.png"/><Relationship Id="rId1" Type="${REL}/image" Target="../media/image1.png"/><Relationship Id="rId4" Type="${REL}/image" Target="../media/image4.jpeg"/></Relationships>`,
    ),
    'xl/media/image1.png': left,
    'xl/media/image2.png': signature,
    'xl/media/image3.png': right,
    'xl/media/image4.jpeg': center,
  };
  return { xlsx: zipSync(files), left, right, center };
}

// xlsx export from the template, checked against a wholly fictional template.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import {
  prepareSignature,
  processSignaturePixels,
  SIGNATURE_ASPECT,
} from '../src/io/tagesbefehl/signature';
import {
  buildTagesbefehlXlsx,
  type TagesbefehlXlsxInput,
  xlsxFileName,
} from '../src/io/tagesbefehl/xlsx';
import { evaluateFormula, formatDate, isoToSerial } from '../src/io/tagesbefehl/xlsx/formula';
import { wrappedLines } from '../src/io/tagesbefehl/xlsx/wrap';
import { XLSX } from '../src/io/workbook';
import { buildOrders } from '../src/model/tagesbefehl/state';
import type { TbWeekday } from '../src/model/tagesbefehl/types';
import {
  buildSyntheticTemplate,
  fictionalEntry,
  fictionalOrders,
  fictionalSetup,
  LOGO_ANCHOR,
  makePng,
  SIGNATURE_PNG,
} from './fixtures/tb-template';

const TEMPLATE = buildSyntheticTemplate();
const NOW = new Date('2026-09-27T08:00:00Z');

function exportWeek(
  days?: TbWeekday[],
  patch: Partial<TagesbefehlXlsxInput> = {},
  edit?: (setup: ReturnType<typeof fictionalSetup>) => void,
) {
  const setup = fictionalSetup(days);
  edit?.(setup);
  const orders = buildOrders(setup.project, setup.tb, setup.week);
  const bytes = buildTagesbefehlXlsx({
    template: TEMPLATE,
    week: setup.week,
    orders,
    settings: setup.tb.settings,
    einheit: setup.project.settings.eigeneEinheit,
    now: NOW,
    ...patch,
  });
  return { bytes, files: unzipSync(bytes), orders, ...setup };
}

const xml = (files: Record<string, Uint8Array>, path: string): Document => {
  const doc = new DOMParser().parseFromString(strFromU8(files[path]), 'application/xml');
  expect(doc.getElementsByTagName('parsererror').length, path).toBe(0);
  return doc;
};
const SHEET = {
  Conf: 1,
  Mo: 2,
  Di: 3,
  Mi: 4,
  Do: 5,
  Fr: 6,
  Sa: 7,
  So: 8,
  'Sa + So': 9,
} as const;
const sheetDoc = (files: Record<string, Uint8Array>, name: keyof typeof SHEET) =>
  xml(files, `xl/worksheets/sheet${SHEET[name]}.xml`);

interface CellInfo {
  text: string;
  s: string | null;
  t: string | null;
  formula: string | null;
}
function cells(doc: Document): Map<string, CellInfo> {
  const out = new Map<string, CellInfo>();
  for (const c of Array.from(doc.getElementsByTagName('c'))) {
    const is = c.getElementsByTagName('is')[0];
    const v = c.getElementsByTagName('v')[0];
    out.set(c.getAttribute('r') ?? '', {
      text: is ? (is.textContent ?? '') : (v?.textContent ?? ''),
      s: c.getAttribute('s'),
      t: c.getAttribute('t'),
      formula: c.getElementsByTagName('f')[0]?.textContent ?? null,
    });
  }
  return out;
}
const rowAttr = (doc: Document, r: number, name: string) =>
  Array.from(doc.getElementsByTagName('row'))
    .find((row) => row.getAttribute('r') === String(r))
    ?.getAttribute(name) ?? null;
const textRows = (doc: Document) =>
  [...cells(doc)].filter(([, c]) => c.text).map(([ref]) => Number(ref.replace(/^[A-Z]+/, '')));

function anchors(doc: Document) {
  return Array.from(doc.getElementsByTagName('xdr:twoCellAnchor')).map((a) => {
    const marker = (tag: string) => {
      const m = a.getElementsByTagName(tag)[0];
      const n = (name: string) => Number(m.getElementsByTagName(name)[0].textContent);
      return [n('xdr:col'), n('xdr:colOff'), n('xdr:row'), n('xdr:rowOff')];
    };
    return {
      embed: a.getElementsByTagName('a:blip')[0].getAttribute('r:embed'),
      from: marker('xdr:from'),
      to: marker('xdr:to'),
    };
  });
}

describe('buildTagesbefehlXlsx with a fictional template', () => {
  it('produces a well-formed package without dangling parts', () => {
    const { files } = exportWeek();
    expect(Object.keys(files)[0]).toBe('[Content_Types].xml');
    for (const path of Object.keys(files)) if (/\.(xml|rels)$/.test(path)) xml(files, path);

    const ct = strFromU8(files['[Content_Types].xml']);
    const overrides = [...ct.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]);
    for (const part of overrides) expect(files[part], part).toBeDefined();
    for (const part of Object.keys(files)) {
      if (part === '[Content_Types].xml' || part.endsWith('.rels')) continue;
      const ext = part.split('.').pop() ?? '';
      expect(overrides.includes(part) || ct.includes(`Extension="${ext}"`), part).toBe(true);
    }
    for (const relsPath of Object.keys(files).filter((p) => p.endsWith('.rels'))) {
      const base = relsPath.replace(/_rels\/([^/]*)\.rels$/, '$1').replace(/[^/]*$/, '');
      for (const rel of Array.from(xml(files, relsPath).getElementsByTagName('Relationship'))) {
        if (rel.getAttribute('TargetMode') === 'External') continue;
        const target = new URL(
          rel.getAttribute('Target') ?? '',
          `http://pkg/${base}`,
        ).pathname.slice(1);
        expect(files[decodeURI(target)], `${relsPath} → ${target}`).toBeDefined();
      }
    }
    expect(Object.keys(files).some((p) => /externalLink|calcChain|\[trash\]/.test(p))).toBe(false);
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).not.toMatch(/externalReference|Pers_2|absPath|#REF!/);
    expect(wb).toMatch(/<calcPr calcId="191028" fullCalcOnLoad="1"\/>/);
    expect(strFromU8(files['xl/_rels/workbook.xml.rels'])).not.toMatch(/externalLink|calcChain/);

    for (let i = 1; i <= 9; i++) {
      const doc = xml(files, `xl/worksheets/sheet${i}.xml`);
      const rows = Array.from(doc.getElementsByTagName('row'));
      const numbers = rows.map((r) => Number(r.getAttribute('r')));
      expect(numbers, `sheet${i} rows`).toEqual([...new Set(numbers)].sort((a, b) => a - b));
      for (const row of rows) {
        const refs = Array.from(row.getElementsByTagName('c')).map(
          (c) => c.getAttribute('r') ?? '',
        );
        const cols = refs.map((ref) => {
          expect(ref.replace(/^[A-Z]+/, ''), `sheet${i} ${ref}`).toBe(row.getAttribute('r'));
          return ref.replace(/\d+$/, '').padStart(3, ' ');
        });
        expect(cols).toEqual([...new Set(cols)].sort());
      }
      expect(strFromU8(files[`xl/worksheets/sheet${i}.xml`])).not.toMatch(/#REF!|#VALUE!/);
    }
  });

  it('writes the Conf values and correct cached formula results', () => {
    const { files, orders } = exportWeek();
    const conf = cells(sheetDoc(files, 'Conf'));
    expect(conf.get('B1')).toMatchObject({
      text: String(isoToSerial('2026-09-28')),
      s: '15',
      t: null,
    });
    expect(conf.get('B2')).toMatchObject({ text: '8', s: '11' });
    expect(conf.get('B5')?.text).toBe('LK 1:25 000, Bl 1111');
    expect(conf.get('B7')?.text).toBe('Muster Kp 1/1');
    expect(conf.get('B8')?.text).toBe('Hptm Hans Muster');
    expect(conf.get('B9')?.text).toBe('Kommandant');

    const mi = cells(sheetDoc(files, 'Mi'));
    expect(mi.get('B7')?.text).toBe('Tagesbefehl Nr 10 für Mittwoch, 30.09.2026');
    expect(mi.get('B7')?.text).toBe(orders.find((o) => o.day === 'Mi')?.title);
    expect(mi.get('B7')?.formula).toContain('Conf!B2+2');
    expect(mi.get('B8')?.text).toBe('LK 1:25 000, Bl 1111');
    const weekend = cells(sheetDoc(files, 'Sa + So'));
    expect(weekend.get('B7')?.text).toBe('Tagesbefehl Nr 13 für Samstag, 03.10.2026');
    expect(weekend.get('B43')?.text).toBe('Tagesbefehl Nr 14 für Sonntag, 04.10.2026');
    expect(weekend.get('D28')).toMatchObject({ text: 'Hptm Hans Muster', formula: 'Conf!B8' });
    const so = cells(sheetDoc(files, 'So'));
    expect(so.get('B7')?.text).toBe('Tagesbefehl Nr 14 für Sonntag, 04.10.2026');
  });

  it('rebuilds each day sheet from row 11 like the reference build', () => {
    const { files } = exportWeek();
    const doc = sheetDoc(files, 'Mo');
    const mo = cells(doc);
    // Header rows 2–10 stay as in the template.
    expect(rowAttr(doc, 2, 'ht')).toBe('66.5');
    expect(mo.get('B3')).toMatchObject({ t: 's', text: '9' });
    expect(mo.get('B4')).toMatchObject({ t: 's', s: '20' });
    // Styles: two added cellXfs → 22 (wrap) and 23 (time).
    const styles = strFromU8(files['xl/styles.xml']);
    expect(styles).toMatch(/<cellXfs count="24">/);
    expect(mo.get('B11')).toMatchObject({ text: '1 Dienstbetrieb / Ausbildung', s: '10' });
    expect(mo.get('B12')).toMatchObject({ text: '0600', s: '23' });
    expect(mo.get('C12')).toMatchObject({ text: 'Tagwache', s: '22' });
    expect(mo.get('D12')?.text).toBe('Einh Fw');
    expect(mo.get('E13')?.text).toBe('AV Platz');
    expect(mo.has('B14')).toBe(false);
    expect(mo.get('B15')).toMatchObject({ text: '2 Besonderes', s: '10' });
    expect(mo.get('C16')?.text).toBe(
      'Ein sehr langer fiktiver Besonderes-Eintrag, der sicher über mehrere Zeilen umbricht & <Sonderzeichen> "zitiert"',
    );
    expect(rowAttr(doc, 16, 'ht')).toBe('39');
    expect(rowAttr(doc, 16, 'customHeight')).toBe('1');
    expect(rowAttr(doc, 12, 'ht')).toBeNull();
    expect(mo.get('B18')?.text).toBe('3 Rapporte');
    expect(mo.get('C19')?.text).toBe('Kp Rap');
    expect(mo.get('C22')?.text).toBe('Tagesoffizier');
    expect(mo.get('D22')?.text).toBe('Oblt Anna Muster');
    expect(mo.get('E22')?.text).toBe('000 000 00 01');
    expect(mo.get('D25')).toMatchObject({ formula: 'Conf!B7', text: 'Muster Kp 1/1', t: 'str' });
    expect(mo.get('D28')).toMatchObject({ formula: 'Conf!B8', text: 'Hptm Hans Muster' });
    expect(mo.get('D29')).toMatchObject({ formula: 'Conf!B9', text: 'Kommandant' });
    expect(mo.get('B31')).toMatchObject({ text: 'Geht an', s: '10' });
    expect(mo.get('B32')?.text).toBe('Kader Muster Kp 1/1');
    expect(mo.get('B33')?.text).toBe('Muster Kp 1/1');
    expect(mo.get('C33')?.text).toBe('(via Anschlag)');
    expect(mo.get('B35')?.text).toBe('z K an');
    expect(mo.get('B36')?.text).toBe('Kdt Muster Bat 1');
    expect(Math.max(...textRows(doc))).toBe(36);
    // Template leftovers are gone.
    expect(mo.has('D51')).toBe(false);
    expect(mo.has('I79')).toBe(false);
    const raw = strFromU8(files['xl/worksheets/sheet2.xml']);
    expect(raw).not.toContain('conditionalFormatting');
    expect(raw).toContain('<mergeCells count="1"><mergeCell ref="B4:E4"/></mergeCells>');
    expect(raw).toContain('<dimension ref="B2:I36"/>');
    expect(raw).toMatch(/<pageSetup [^>]*scale="88"/);
    expect(raw).toContain('<drawing r:id="rId2"/>');
    expect(strFromU8(files['xl/workbook.xml'])).toContain(
      '<definedName name="_xlnm.Print_Area" localSheetId="1">Mo!$A$1:$E$36</definedName>',
    );
    // Groups get a blank row and the sub-heading style.
    const mi = cells(sheetDoc(files, 'Mi'));
    expect(mi.has('B13')).toBe(false);
    expect(mi.get('B14')).toMatchObject({ text: 'Gruppe Alpha', s: '9' });
    expect(mi.get('C15')?.text).toBe('Ausbildung A');
    expect(mi.get('B17')).toMatchObject({ text: 'Gruppe Bravo', s: '9' });
    // #VALUE! leftover in E2 (Di) is cleared, the style stays.
    expect(cells(sheetDoc(files, 'Di')).get('E2')).toMatchObject({ s: '5', t: null, text: '' });
  });

  it('moves the signature between unit and name and replaces the picture', () => {
    const { files } = exportWeek(undefined, { signature: SIGNATURE_PNG });
    expect(files['xl/media/image2.png']).toEqual(SIGNATURE_PNG);
    const template = unzipSync(TEMPLATE);
    expect(files['xl/media/image1.png']).toEqual(template['xl/media/image1.png']);
    // Mo: unit in row 25 → picture in rows 26–27 (0-based 25–26); Di (no entries): row 21.
    for (const [drawing, sigRid, unitRow] of [
      ['drawing1', 'rId2', 25],
      ['drawing2', 'rId5', 21],
    ] as const) {
      const list = anchors(xml(files, `xl/drawings/${drawing}.xml`));
      const logo = list.find((a) => a.embed !== sigRid);
      const signature = list.find((a) => a.embed === sigRid);
      expect(logo?.from).toEqual(LOGO_ANCHOR);
      expect(signature?.from[0]).toBe(3);
      expect(signature?.from[2]).toBe(unitRow);
      expect(signature?.to[2]).toBeGreaterThanOrEqual(unitRow);
      expect(signature?.to[2]).toBeLessThanOrEqual(unitRow + 1);
      const width = signature?.to[1] ?? 0;
      expect(width / 300_200).toBeCloseTo(3.4, 1);
    }
    // "Sa + So": anchors stay where the template has them.
    const weekend = anchors(xml(files, 'xl/drawings/drawing8.xml')).filter(
      (a) => a.embed === 'rId2',
    );
    expect(weekend.map((a) => a.from[2])).toEqual([25, 56]);

    const without = exportWeek().files;
    expect(without['xl/media/image2.png']).toEqual(template['xl/media/image2.png']);
  });

  it('fills the fixed rows of "Sa + So" and keeps the page structure', () => {
    const { files } = exportWeek();
    const doc = sheetDoc(files, 'Sa + So');
    const c = cells(doc);
    expect(c.get('B11')).toMatchObject({ text: '1 Dienstbetrieb / Ausbildung', s: '10' });
    expect(c.get('B12')).toMatchObject({ text: 'gz Tag', s: '23' });
    expect(c.get('C12')?.text).toBe('Allgemeiner Urlaub');
    for (let r = 13; r <= 18; r++) expect(textRows(doc)).not.toContain(r);
    expect(c.get('B19')).toMatchObject({ text: '2 Besonderes', s: '10' });
    expect(c.get('C20')?.text).toBe('Wachablösung');
    expect(c.get('C22')?.text).toBe('Wochenend Wacht Of');
    expect(c.get('D22')?.text).toBe('Wacht Of Muster Kp 1/2');
    expect(c.get('E22')?.text).toBe('Tel folgt');
    expect(c.get('D25')?.formula).toBe('Conf!B7');
    expect(c.get('B31')?.text).toBe('Geht an');
    expect(c.get('C33')?.text).toBe('(via Anschlag)');
    expect(c.get('B36')?.text).toBe('Kdt Muster Bat 1');
    expect(c.get('B47')?.text).toBe('1 Dienstbetrieb / Ausbildung');
    expect(c.get('C48')?.text).toBe('Allgemeiner Urlaub');
    expect(c.get('B50')?.text).toBe('2 Besonderes');
    expect(textRows(doc)).not.toContain(51);
    expect(c.get('D53')?.text).toBe('Wacht Of Muster Kp 1/2');
    expect(c.get('B67')?.text).toBe('Kdt Muster Bat 1');
    const raw = strFromU8(files['xl/worksheets/sheet9.xml']);
    expect(raw).toContain('<mergeCell ref="B40:E40"/>');
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).toContain('<sheet name="Sa + So" sheetId="25" r:id="rId9"/>');
    expect(wb).toMatch(/<sheet name="Sa" [^>]*state="hidden"/);
    expect(wb).toMatch(/<sheet name="So" [^>]*state="hidden"/);
    expect(wb).toContain("'Sa + So'!$A$1:$E$68");
  });

  it('keeps every weekend entry when the fixed rows overflow', () => {
    const { files } = exportWeek(undefined, {}, ({ week }) => {
      for (let i = 0; i < 14; i++)
        week.entries.push(
          fictionalEntry('So', 'dienstbetrieb', `${10 + i}00`, `Sonntag Posten ${i}`),
        );
      for (let i = 0; i < 3; i++)
        week.entries.push(fictionalEntry('So', 'besonderes', 'gz Tag', `Sonntag Hinweis ${i}`));
    });
    const doc = sheetDoc(files, 'Sa + So');
    const soTexts = [...cells(doc)]
      .filter(([ref]) => {
        const r = Number(ref.replace(/^[A-Z]+/, ''));
        return r >= 47 && r <= 55;
      })
      .map(([, cell]) => cell.text)
      .join('\n');
    for (let i = 0; i < 14; i++) expect(soTexts).toContain(`Sonntag Posten ${i}`);
    for (let i = 0; i < 3; i++) expect(soTexts).toContain(`Sonntag Hinweis ${i}`);
    expect(textRows(doc).filter((r) => r > 54 && r < 56)).toEqual([]);
    expect(cells(doc).get('D56')?.formula).toBe('Conf!B7');
    // Stacked rows wrap and get a matching height.
    const stacked = Array.from(doc.getElementsByTagName('row')).filter(
      (row) => Number(row.getAttribute('r')) >= 47 && Number(row.getAttribute('ht') ?? 0) > 13,
    );
    expect(stacked.length).toBeGreaterThan(0);
  });

  it('keeps the template date while the week has no start date', () => {
    const { files } = exportWeek(undefined, {}, ({ week }) => {
      week.startDate = '';
    });
    const conf = cells(sheetDoc(files, 'Conf'));
    expect(conf.get('B1')?.text).toBe('45978');
    expect(conf.get('B2')?.text).toBe('8');
    expect(cells(sheetDoc(files, 'Di')).get('B7')?.text).toBe(
      'Tagesbefehl Nr 9 für Dienstag, 18.11.2025',
    );
  });

  it('hides days without Tagesbefehl and selects the first issued day', () => {
    const { files } = exportWeek(['Mi', 'Do']);
    const wb = strFromU8(files['xl/workbook.xml']);
    for (const day of ['Mo', 'Di', 'Fr', 'Sa', 'So', 'Sa \\+ So'])
      expect(wb, day).toMatch(new RegExp(`<sheet name="${day}" [^>]*state="hidden"`));
    for (const day of ['Conf', 'Mi', 'Do']) expect(wb).toContain(`<sheet name="${day}" sheetId=`);
    expect(wb).not.toMatch(/<sheet name="(?:Conf|Mi|Do)"[^>]*state=/);
    expect(wb).toMatch(/<workbookView [^>]*activeTab="3"/);
    const selected = Object.keys(SHEET).filter((name) =>
      strFromU8(files[`xl/worksheets/sheet${SHEET[name as keyof typeof SHEET]}.xml`]).includes(
        'tabSelected="1"',
      ),
    );
    expect(selected).toEqual(['Mi']);
    // Hidden day sheets carry no template sample rows.
    const mo = sheetDoc(files, 'Mo');
    expect(cells(mo).get('C12')).toBeUndefined();
    expect(cells(mo).get('B7')?.text).toBe('Tagesbefehl Nr 8 für Montag, 28.09.2026');
  });

  it('sets document properties and stays readable for other readers', () => {
    const { bytes, files } = exportWeek();
    const core = strFromU8(files['docProps/core.xml']);
    expect(core).toContain('<cp:lastModifiedBy>Hptm Hans Muster</cp:lastModifiedBy>');
    expect(core).toContain(
      '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-27T08:00:00Z</dcterms:modified>',
    );
    expect(core).toContain('<dc:title>Tagesbefehle Wo 1 FDT 2026 Muster Kp 1/1</dc:title>');
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Conf', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'Sa + So']);
    expect(wb.Sheets.Mo.C12.v).toBe('Tagwache');
    expect(wb.Sheets.Mo.B7.v).toBe('Tagesbefehl Nr 8 für Montag, 28.09.2026');
    expect(wb.Workbook?.Sheets?.map((s) => s.Hidden ?? 0)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 0]);
  });

  it('works offline and reports problems with generic messages', () => {
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const { orders, week, tb, project } = fictionalOrders();
    const base = {
      template: TEMPLATE,
      week,
      orders,
      settings: tb.settings,
      einheit: project.settings.eigeneEinheit,
    };
    expect(() => buildTagesbefehlXlsx({ ...base, template: new Uint8Array([1, 2, 3]) })).toThrow(
      'Die Vorlage ist keine gültige Tagesbefehl-Vorlage (.xlsx).',
    );
    expect(() => buildTagesbefehlXlsx({ ...base, orders: [] })).toThrow(
      'Die Woche enthält keine Tagesbefehle.',
    );
    expect(() =>
      buildTagesbefehlXlsx({ ...base, signature: new Uint8Array([0xff, 0xd8, 0xff]) }),
    ).toThrow('Die Unterschrift muss als PNG-Bild vorliegen.');
    buildTagesbefehlXlsx(base);
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('names the file after the week and the service', () => {
    expect(xlsxFileName('KVK', { dienstleistung: 'FDT_2026' })).toBe(
      'Tagesbefehle_KVK_FDT_2026.xlsx',
    );
    expect(xlsxFileName('Wo 1', { dienstleistung: 'FDT_2026' })).toBe(
      'Tagesbefehle_Wo_1_FDT_2026.xlsx',
    );
    expect(xlsxFileName('Wo 2', { dienstleistung: ' ' })).toBe('Tagesbefehle_Wo_2.xlsx');
  });
});

describe('xlsx helpers', () => {
  it('evaluates the template formulas with German date codes', () => {
    const conf: Record<string, number | string> = { B1: 46293, B2: 1, B5: 'LK 1' };
    const lookup = (sheet: string | undefined, ref: string) =>
      sheet === 'Conf' ? conf[ref] : undefined;
    expect(
      evaluateFormula(
        '"Tagesbefehl Nr "&Conf!B2+2&" für "&TEXT(Conf!B1+2,"TTTT, TT.MM.JJJJ")',
        lookup,
      ),
    ).toBe('Tagesbefehl Nr 3 für Mittwoch, 30.09.2026');
    expect(evaluateFormula('Conf!$B$5', lookup)).toBe('LK 1');
    expect(evaluateFormula('SUM(Conf!B1)', lookup)).toBeUndefined();
    expect(evaluateFormula('Mo!#REF!=Conf!#REF!', lookup)).toBeUndefined();
    expect(evaluateFormula('Other!B1', lookup)).toBeUndefined();
    expect(formatDate(46293, 'TTT TT.MM.JJ')).toBe('Mo 28.09.26');
    expect(formatDate(46293, 'dddd, dd.mm.yyyy')).toBe('Montag, 28.09.2026');
  });

  it('estimates wrapped lines like Python textwrap', () => {
    expect(wrappedLines('', 40)).toBe(1);
    expect(wrappedLines('a'.repeat(40), 40)).toBe(1);
    expect(wrappedLines('a'.repeat(41), 40)).toBe(2);
    expect(wrappedLines('eins zwei drei', 9)).toBe(2);
    expect(wrappedLines('Start-Info Test', 6)).toBe(3); // 'Start-' / 'Info' / 'Test'
    expect(wrappedLines('Probe Info, Tn: Muster Fw u/o Beispiel, Gerät A, B', 40)).toBe(2);
    expect(wrappedLines('erste Zeile\nzweite Zeile', 40)).toBe(2);
  });
});

describe('prepareSignature', () => {
  it('returns the PNG unchanged where no canvas exists', async () => {
    const png = makePng(4, 2);
    await expect(prepareSignature(png)).resolves.toBe(png);
  });

  it('crops, thickens thin strokes and pads to the template aspect', () => {
    const width = 200,
      height = 60;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let x = 20; x < 180; x++) {
      const i = (30 * width + x) * 4;
      data.set([10, 30, 120, 255], i);
    }
    const result = processSignaturePixels({ data, width, height });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.width / result.height).toBeCloseTo(SIGNATURE_ASPECT, 1);
    let ink = 0;
    for (let i = 3; i < result.data.length; i += 4) if (result.data[i]) ink++;
    expect(ink).toBeGreaterThan(160);
    const first = result.data.findIndex((_, i) => i % 4 === 3 && result.data[i] > 0);
    expect([...result.data.slice(first - 3, first)]).toEqual([10, 30, 120]);
  });

  it('drops an opaque white background and ignores empty images', () => {
    const width = 120,
      height = 40;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 10; y < 30; y++) data.set([0, 0, 0, 255], (y * width + 60) * 4);
    const result = processSignaturePixels({ data, width, height });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.width / result.height).toBeCloseTo(SIGNATURE_ASPECT, 1);
    let opaque = 0;
    for (let i = 3; i < result.data.length; i += 4) if (result.data[i]) opaque++;
    // Only the (slightly thickened) stroke is visible; the white paper is transparent.
    expect(opaque).toBeGreaterThanOrEqual(20);
    expect(opaque).toBeLessThan(100);
    expect(result.data[result.data.length - 1]).toBe(0);
    const blank = new Uint8ClampedArray(width * height * 4).fill(255);
    expect(processSignaturePixels({ data: blank, width, height })).toBeNull();
  });
});

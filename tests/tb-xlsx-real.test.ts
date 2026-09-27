// Local-only check against the real template and the reviewed reference output.
// The fixtures live in the git-ignored fixtures-private/ folder (owner exception);
// without them this suite is skipped. No real content is written into this file,
// and assertion messages only name cell references, never cell texts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildTagesbefehlXlsx, xlsxFileName } from '../src/io/tagesbefehl/xlsx';
import { XLSX } from '../src/io/workbook';
import { emptyWeek, orderTitle } from '../src/model/tagesbefehl/state';
import {
  TB_WEEKDAYS,
  type TbOrder,
  type TbOrderBlock,
  type TbSettings,
  type TbWeekday,
} from '../src/model/tagesbefehl/types';
import { fictionalOrders, SIGNATURE_PNG } from './fixtures/tb-template';

const DIR = 'fixtures-private/fixtures';
const TEMPLATE = `${DIR}/Tagesbefehle_Vorlage.xlsx`;
const EXPECTED = `${DIR}/Tagesbefehle_KVK_FDT_2026_expected.xlsx`;
const REVIEWED = `${DIR}/kvk_expected.json`;
const OUT_DIR = 'fixtures-private/out';
const available = [TEMPLATE, EXPECTED, REVIEWED].every((path) => existsSync(path));

interface ReviewedEntry {
  zeit: string;
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
}
interface ReviewedDay {
  date: string;
  tb_nr: number;
  tagesoffizier?: { name: string; tel: string };
  sections?: { heading: string; level: number; entries: ReviewedEntry[] }[];
  dienstbetrieb?: ReviewedEntry[];
  besonderes?: ReviewedEntry[];
  wacht_of?: string[];
}
interface Reviewed {
  week_start: string;
  first_tb_number: number;
  days: Partial<Record<TbWeekday, ReviewedDay>>;
}

type Texts = Map<string, string>;
function sheetTexts(sheet: XLSX.WorkSheet | undefined): Texts {
  const out: Texts = new Map();
  if (!sheet) return out;
  for (const [ref, cell] of Object.entries(sheet)) {
    if (ref.startsWith('!')) continue;
    const value = (cell as XLSX.CellObject).v;
    const text = value == null ? '' : String(value);
    if (text !== '') out.set(ref, text);
  }
  return out;
}
const cellText = (sheet: XLSX.WorkSheet | undefined, ref: string): string =>
  sheetTexts(sheet).get(ref) ?? '';

/** Verteiler lines as rendered in the reference day sheet (B + C of each row). */
function referenceVerteiler(sheet: XLSX.WorkSheet): { gehtAn: string[]; zK: string[] } {
  const texts = sheetTexts(sheet);
  const rowOf = (label: string) =>
    [...texts].find(([ref, text]) => ref.startsWith('B') && text === label)?.[0].slice(1);
  const lines = (from: string | undefined): string[] => {
    const out: string[] = [];
    for (let r = Number(from) + 1; from && texts.has(`B${r}`); r++)
      out.push([texts.get(`B${r}`), texts.get(`C${r}`)].filter(Boolean).join(' '));
    return out;
  };
  return { gehtAn: lines(rowOf('Geht an')), zK: lines(rowOf('z K an')) };
}

const entry = (e: ReviewedEntry, id: string): TbOrderBlock => ({
  kind: 'entry',
  entryId: id,
  ...e,
});

function reviewedOrders(reviewed: Reviewed, settings: TbSettings, einheit: string): TbOrder[] {
  const verteiler = { gehtAn: settings.gehtAn, zK: settings.zK };
  return TB_WEEKDAYS.flatMap((day, i) => {
    const d = reviewed.days[day];
    if (!d) return [];
    const weekend = day === 'Sa' || day === 'So';
    const blocks: TbOrderBlock[] = weekend
      ? [
          { kind: 'section', heading: '1 Dienstbetrieb / Ausbildung' },
          ...(d.dienstbetrieb ?? []).map((e, j) => entry(e, `${day}-d${j}`)),
          { kind: 'section', heading: '2 Besonderes' },
          ...(d.besonderes ?? []).map((e, j) => entry(e, `${day}-b${j}`)),
        ]
      : (d.sections ?? []).flatMap((s, k) => [
          { kind: s.level === 1 ? 'section' : 'group', heading: s.heading } as TbOrderBlock,
          ...s.entries.map((e, j) => entry(e, `${day}-${k}-${j}`)),
        ]);
    return [
      {
        day,
        index: i + 1,
        date: d.date,
        number: d.tb_nr,
        title: orderTitle(d.tb_nr, day, d.date),
        lk: settings.lk,
        einheit,
        weekend,
        blocks,
        officer: weekend
          ? { label: 'Wochenend Wacht Of', lines: d.wacht_of ?? [] }
          : {
              label: 'Tagesoffizier',
              lines: [d.tagesoffizier?.name ?? '', d.tagesoffizier?.tel ?? ''].filter(Boolean),
            },
        signature: { einheit, name: settings.kdtName, funktion: settings.kdtFunktion },
        verteiler,
      },
    ];
  });
}

describe.skipIf(!available)('xlsx export with the real template (local fixtures only)', () => {
  it('reproduces the reviewed reference workbook', () => {
    const expected = XLSX.read(readFileSync(EXPECTED), { type: 'buffer', cellStyles: true });
    const conf = expected.Sheets.Conf;
    const einheit = cellText(conf, 'B7');
    const settings: TbSettings = {
      lk: cellText(conf, 'B5'),
      kdtName: cellText(conf, 'B8'),
      kdtFunktion: cellText(conf, 'B9'),
      ...referenceVerteiler(expected.Sheets.Mo),
      dienstleistung: 'FDT_2026',
    };
    const reviewed = JSON.parse(readFileSync(REVIEWED, 'utf8')) as Reviewed;
    const week = {
      ...emptyWeek('KVK'),
      startDate: reviewed.week_start,
      firstNumber: reviewed.first_tb_number,
      days: TB_WEEKDAYS.filter((d) => reviewed.days[d]),
    };
    const orders = reviewedOrders(reviewed, settings, einheit);
    const bytes = buildTagesbefehlXlsx({
      template: new Uint8Array(readFileSync(TEMPLATE)),
      week,
      orders,
      settings,
      einheit,
      now: new Date('2026-09-27T12:00:00Z'),
    });
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(`${OUT_DIR}/${xlsxFileName(week.sheet, settings)}`, bytes);

    // Every XML part is well-formed.
    const parts = unzipSync(bytes);
    for (const [path, data] of Object.entries(parts))
      if (/\.(xml|rels)$/.test(path)) {
        const doc = new DOMParser().parseFromString(strFromU8(data), 'application/xml');
        expect(doc.getElementsByTagName('parsererror').length, path).toBe(0);
      }

    const actual = XLSX.read(bytes, { type: 'array', cellStyles: true });
    const report: Record<string, { missing: string[]; extra: string[]; changed: string[] }> = {};
    const heights: Record<string, string[]> = {};
    for (const name of expected.SheetNames) {
      const want = sheetTexts(expected.Sheets[name]);
      const got = sheetTexts(actual.Sheets[name]);
      const diff = {
        missing: [...want.keys()].filter((ref) => !got.has(ref)),
        extra: [...got.keys()].filter((ref) => !want.has(ref)),
        changed: [...want.keys()].filter((ref) => got.has(ref) && got.get(ref) !== want.get(ref)),
      };
      if (diff.missing.length || diff.extra.length || diff.changed.length) report[name] = diff;
      const wantRows = expected.Sheets[name]['!rows'] ?? [];
      const gotRows = actual.Sheets[name]['!rows'] ?? [];
      const rowDiffs: string[] = [];
      for (let r = 10; r < Math.max(wantRows.length, gotRows.length); r++) {
        const a = wantRows[r]?.hpt,
          b = gotRows[r]?.hpt;
        if ((a ?? 13) !== (b ?? 13)) rowDiffs.push(`${r + 1}`);
      }
      if (rowDiffs.length) heights[name] = rowDiffs;
    }
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(`${OUT_DIR}/kvk-xlsx-diff.json`, JSON.stringify({ report, heights }, null, 2));

    // Visible sheets must match the reference; hidden single Sa / So sheets are
    // rebuilt from the orders (the reference kept the template's sample rows there).
    for (const name of ['Conf', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa + So'])
      expect(report[name], `${name}: ${JSON.stringify(report[name])}`).toBeUndefined();
    for (const name of ['Mo', 'Di', 'Mi', 'Do', 'Fr'])
      expect(heights[name], `${name} row heights`).toBeUndefined();
  }, 30_000);

  it('moves a replacement signature into every day sheet of the real template', () => {
    const template = new Uint8Array(readFileSync(TEMPLATE));
    const sample = cellText(XLSX.read(template, { type: 'array' }).Sheets.Conf, 'B8');
    const { week, orders, tb, project } = fictionalOrders();
    const files = unzipSync(
      buildTagesbefehlXlsx({
        template,
        signature: SIGNATURE_PNG,
        week,
        orders,
        settings: tb.settings,
        einheit: project.settings.eigeneEinheit,
      }),
    );
    expect(files['xl/media/image2.png']).toEqual(SIGNATURE_PNG);
    for (let i = 2; i <= 8; i++) {
      const sheet = strFromU8(files[`xl/worksheets/sheet${i}.xml`]);
      const unitRow = Number(/<c r="D(\d+)"[^>]*><f>Conf!B7<\/f>/.exec(sheet)?.[1]);
      const rels = strFromU8(files[`xl/worksheets/_rels/sheet${i}.xml.rels`]);
      const drawing = /Target="\.\.\/drawings\/(drawing\d+\.xml)"/.exec(rels)?.[1];
      const drawingRels = strFromU8(files[`xl/drawings/_rels/${drawing}.rels`]);
      const rid = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/image2\.png"/.exec(drawingRels)?.[1];
      const anchor = strFromU8(files[`xl/drawings/${drawing}`])
        .split('</xdr:twoCellAnchor>')
        .find((a) => a.includes(`r:embed="${rid}"`));
      expect(
        Number(/<xdr:from><xdr:col>3<\/xdr:col>.*?<xdr:row>(\d+)</.exec(anchor ?? '')?.[1]),
        `sheet${i}`,
      ).toBe(unitRow);
    }
    // The template's sample commander is no longer shown anywhere.
    for (const [path, data] of Object.entries(files))
      if (path.startsWith('xl/worksheets/sheet'))
        expect(strFromU8(data).includes(`<v>${sample}</v>`), path).toBe(false);
  });
});

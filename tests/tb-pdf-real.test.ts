// Local-only check against the real (git-ignored) template and reference week.
// Skipped when fixtures-private/ is absent (CI, other machines). Outputs stay in
// fixtures-private/out/, which is git-ignored. No real data lives in this file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPdfZip, pdfFileName } from '../src/io/tagesbefehl/pdf';
import { layoutOrder } from '../src/io/tagesbefehl/sheet-layout';
import { extractTemplateLogos } from '../src/io/tagesbefehl/template';
import { dayIndex, orderTitle } from '../src/model/tagesbefehl/state';
import {
  isWeekend,
  TB_SECTION_HEADINGS,
  TB_WEEKDAYS,
  type TbOrder,
  type TbOrderBlock,
  type TbWeekday,
} from '../src/model/tagesbefehl/types';

const DIR = 'fixtures-private/fixtures';
const TEMPLATE = `${DIR}/Tagesbefehle_Vorlage.xlsx`;
const REFERENCE = `${DIR}/kvk_expected.json`;
const REFERENCE_XLSX = `${DIR}/Tagesbefehle_KVK_FDT_2026_expected.xlsx`;
const OUT = 'fixtures-private/out';

interface RefEntry {
  zeit: string;
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
}
interface RefDay {
  date: string;
  tb_nr: number;
  tagesoffizier?: { name: string; tel: string };
  sections?: { heading: string; level: number; entries: RefEntry[] }[];
  dienstbetrieb?: RefEntry[];
  besonderes?: RefEntry[];
  wacht_of?: string[];
}

function orderFromReference(day: TbWeekday, ref: RefDay): TbOrder {
  const blocks: TbOrderBlock[] = [];
  let n = 0;
  const entries = (list: RefEntry[] = []) =>
    list.map((e): TbOrderBlock => ({ kind: 'entry', entryId: `${day}-${n++}`, ...e }));
  if (ref.sections)
    for (const section of ref.sections)
      blocks.push(
        { kind: section.level === 1 ? 'section' : 'group', heading: section.heading },
        ...entries(section.entries),
      );
  else
    blocks.push(
      { kind: 'section', heading: TB_SECTION_HEADINGS.dienstbetrieb },
      ...entries(ref.dienstbetrieb),
      { kind: 'section', heading: TB_SECTION_HEADINGS.besonderes },
      ...entries(ref.besonderes),
    );
  const weekend = isWeekend(day);
  return {
    day,
    index: dayIndex(day),
    date: ref.date,
    number: ref.tb_nr,
    title: orderTitle(ref.tb_nr, day, ref.date),
    lk: 'LK 1:50 000, Bl 9999',
    einheit: 'Inf Ustü Kp 99/9',
    weekend,
    blocks,
    officer: weekend
      ? { label: 'Wochenend Wacht Of', lines: ref.wacht_of ?? [] }
      : {
          label: 'Tagesoffizier',
          lines: [ref.tagesoffizier?.name ?? '', ref.tagesoffizier?.tel ?? ''].filter(Boolean),
        },
    signature: { einheit: 'Inf Ustü Kp 99/9', name: 'Hptm Beispiel Hans', funktion: 'Kommandant' },
    verteiler: {
      gehtAn: ['Kader Inf Ustü Kp 99/9', 'Inf Ustü Kp 99/9 (via Anschlag)'],
      zK: ['Kdt Inf Bat 99'],
    },
  };
}

describe.skipIf(!existsSync(TEMPLATE))('real template (local only)', () => {
  it('extracts the two header logos of the Mo sheet, without the signature', () => {
    const logos = extractTemplateLogos(readFileSync(TEMPLATE));
    expect(logos.map((logo) => logo.align)).toEqual(['left', 'right']);
    expect(logos.map((logo) => logo.name)).not.toContain('image2.png');
    expect(logos[0].widthMm).toBeCloseTo(54.3, 0);
    expect(logos[0].heightMm).toBeCloseTo(11.4, 0);
    expect(logos[1].widthMm).toBeCloseTo(27, 0);
    expect(logos[1].heightMm).toBeCloseTo(23.5, 0);
  });

  it.skipIf(!existsSync(REFERENCE))(
    'renders the reference week as one-page PDFs',
    async () => {
      const reference = JSON.parse(readFileSync(REFERENCE, 'utf8')) as {
        days: Partial<Record<TbWeekday, RefDay>>;
      };
      const orders = TB_WEEKDAYS.flatMap((day) => {
        const ref = reference.days[day];
        return ref ? [orderFromReference(day, ref)] : [];
      });
      const logos = extractTemplateLogos(readFileSync(TEMPLATE));
      const signature = existsSync(REFERENCE_XLSX)
        ? unzipSync(readFileSync(REFERENCE_XLSX))['xl/media/image2.png']
        : undefined;
      const zip = await buildPdfZip(orders, { logos, signature });
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/Tagesbefehle_KVK_PDF.zip`, zip);
      const files = unzipSync(zip);
      expect(Object.keys(files)).toEqual(orders.map(pdfFileName));
      for (const order of orders) {
        const bytes = files[pdfFileName(order)];
        writeFileSync(`${OUT}/${pdfFileName(order)}`, bytes);
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(layoutOrder(order, logos).fontSize).toBeGreaterThanOrEqual(7);
      }
      // Embedding the real signature seven times is slow under a fully parallel test run.
    },
    60_000,
  );
});

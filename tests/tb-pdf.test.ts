// Per-day PDFs and template logos, with fictional orders and synthetic images only.
import { strFromU8, unzipSync } from 'fflate';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  type PDFStream,
} from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDayPdf,
  buildPdfZip,
  pdfFileName,
  pdfTitle,
  pdfZipName,
} from '../src/io/tagesbefehl/pdf';
import {
  layoutOrder,
  PAGE_HEIGHT,
  pdfText,
  textWidth,
  wrapText,
} from '../src/io/tagesbefehl/sheet-layout';
import { extractTemplateLogos, type TbTemplateLogo } from '../src/io/tagesbefehl/template';
import { TB_WEEKDAYS, type TbOrder } from '../src/model/tagesbefehl/types';
import { fictionalOrder, makePng, syntheticTemplate } from './tb-fixtures';

const WIN_ANSI_EXTRA: Record<number, string> = {
  128: '€',
  133: '…',
  145: '‘',
  146: '’',
  147: '“',
  148: '”',
  150: '–',
  151: '—',
};
const decodeHex = (hex: string): string =>
  (hex.match(/../g) ?? [])
    .map((byte) => {
      const code = Number.parseInt(byte, 16);
      return WIN_ANSI_EXTRA[code] ?? String.fromCharCode(code);
    })
    .join('');

/** Loads a PDF and returns page count, sizes, drawn text lines and image count of page 1. */
async function inspectPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = doc.getPage(0);
  const contents = page.node.Contents();
  const streams: PDFStream[] =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref) as PDFStream)
      : contents
        ? [contents]
        : [];
  const lines: string[] = [];
  for (const stream of streams) {
    const data =
      stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
    for (const match of strFromU8(data, true).matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g))
      lines.push(decodeHex(match[1]));
  }
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'));
  return {
    doc,
    pages: doc.getPageCount(),
    size: page.getSize(),
    lines,
    text: lines.join('\n'),
    images: xObjects instanceof PDFDict ? xObjects.keys().length : 0,
  };
}

const logos = (): TbTemplateLogo[] => [
  {
    name: 'links.png',
    mime: 'image/png',
    data: makePng(8, 2, [180, 0, 0, 255]),
    align: 'left',
    widthMm: 54.33,
    heightMm: 11.45,
    topMm: 1.82,
  },
  {
    name: 'rechts.png',
    mime: 'image/png',
    data: makePng(4, 4, [0, 90, 0, 255]),
    align: 'right',
    widthMm: 27,
    heightMm: 23.46,
    topMm: 0,
  },
];
const NOW = new Date('2031-03-01T08:00:00Z');

afterEach(() => vi.restoreAllMocks());

describe('Tagesbefehl PDF file names', () => {
  it('uses the weekday index and abbreviation, not the TB number', () => {
    expect(TB_WEEKDAYS.map((day, index) => pdfFileName({ day, index: index + 1 }))).toEqual([
      '01_Mo.pdf',
      '02_Di.pdf',
      '03_Mi.pdf',
      '04_Do.pdf',
      '05_Fr.pdf',
      '06_Sa.pdf',
      '07_So.pdf',
    ]);
    expect(pdfFileName(fictionalOrder('Do', { number: 99 }))).toBe('04_Do.pdf');
  });

  it('names the zip after week and service', () => {
    expect(pdfZipName('KVK', { dienstleistung: 'FDT_2031' })).toBe(
      'Tagesbefehle_KVK_FDT_2031_PDF.zip',
    );
    expect(pdfZipName('Wo 2', { dienstleistung: 'WK 2031' })).toBe(
      'Tagesbefehle_Wo_2_WK_2031_PDF.zip',
    );
    expect(pdfZipName('Wo 1', { dienstleistung: '' })).toBe('Tagesbefehle_Wo_1_PDF.zip');
  });

  it('derives the metadata title from the order', () => {
    expect(pdfTitle(fictionalOrder('Mi'))).toBe('Tagesbefehl Nr 43 – Mittwoch, 12.03.2031');
    expect(pdfTitle({ number: 5, day: 'So', date: '' })).toBe('Tagesbefehl Nr 5 – Sonntag');
  });
});

describe('buildDayPdf', () => {
  it('renders exactly one A4 portrait page with the full order as selectable text', async () => {
    const order = fictionalOrder('Mi');
    const pdf = await inspectPdf(
      await buildDayPdf(order, { logos: logos(), signature: makePng(34, 10) }, { now: NOW }),
    );
    expect(pdf.pages).toBe(1);
    expect(pdf.size.width).toBeCloseTo(595.28, 1);
    expect(pdf.size.height).toBeCloseTo(841.89, 1);
    const expected = [
      'Kdt Inf Ustü Kp 99/9',
      'Tagesbefehl',
      order.title,
      order.lk,
      '1 Dienstbetrieb / Ausbildung',
      'COBRA 10 / COBRA 20',
      '2 Besonderes',
      '3 Rapporte',
      '0615 - 0645',
      'Morgenessen',
      'Zfhr / Einh Fw',
      'AV Platz',
      'Tagesoffizier',
      'Oblt Muster Max',
      '000 000 00 00',
      'Hptm Beispiel Hans',
      'Kommandant',
      'Geht an',
      'Kader Inf Ustü Kp 99/9',
      '(via Anschlag)',
      'z K an',
      'Kdt Inf Bat 99',
    ];
    for (const text of expected) expect(pdf.lines).toContain(text);
    // Wrapped cells: all words survive, in order, with umlauts and the en dash.
    const long = order.blocks.find((b) => b.kind === 'entry' && b.entryId === 'Mi-4');
    expect(long?.kind).toBe('entry');
    if (long?.kind === 'entry') expect(pdf.text.replace(/\n/g, ' ')).toContain(long.taetigkeit);
    // Two logos plus the signature.
    expect(pdf.images).toBe(3);
  });

  it('writes neutral metadata: title, author, app name, creation date only', async () => {
    const order = fictionalOrder('Fr');
    const { doc } = await inspectPdf(await buildDayPdf(order, { logos: [] }, { now: NOW }));
    expect(doc.getTitle()).toBe('Tagesbefehl Nr 45 – Freitag, 14.03.2031');
    expect(doc.getAuthor()).toBe('Hptm Beispiel Hans');
    expect(doc.getProducer()).toBe('WK Util Suite');
    expect(doc.getCreator()).toBe('WK Util Suite');
    expect(doc.getCreationDate()?.toISOString()).toBe(NOW.toISOString());
    expect(doc.getModificationDate()).toBeUndefined();
    expect(doc.getSubject()).toBeUndefined();
    expect(doc.getKeywords()).toBeUndefined();
  });

  it('renders a weekend order as its own single page', async () => {
    const order = fictionalOrder('Sa');
    const pdf = await inspectPdf(await buildDayPdf(order, { logos: logos() }));
    expect(pdf.pages).toBe(1);
    expect(pdf.lines).toContain(order.title);
    expect(pdf.lines).toContain('Wochenend Wacht Of');
    expect(pdf.lines).toContain('Wacht Of Kp 99/8');
    expect(pdf.lines).not.toContain('3 Rapporte');
    expect(pdf.text).not.toContain('Sonntag');
    expect(pdf.images).toBe(2);
  });

  it('shrinks the font step-wise so long orders stay on one page', async () => {
    const activity = (index: number) =>
      `Ausbildungssequenz ${index + 1} mit Vorbereitung, Durchführung und Auswertung`;
    const many: TbOrder['blocks'] = Array.from({ length: 20 }, (_, index) => ({
      kind: 'entry',
      entryId: `x${index}`,
      zeit: `${String(6 + (index % 12)).padStart(2, '0')}00`,
      taetigkeit: activity(index),
      verantwortlich: 'Zfhr Beispiel',
      ort: 'Übungsraum Nord',
    }));
    const order = fictionalOrder('Di', {
      blocks: [{ kind: 'section', heading: '1 Dienstbetrieb / Ausbildung' }, ...many],
    });
    const layout = layoutOrder(order);
    expect(layout.fontSize).toBeLessThan(10);
    expect(layout.fontSize).toBeGreaterThanOrEqual(7);
    const last = layout.rows.at(-1);
    expect((last?.top ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(PAGE_HEIGHT - 42.5);
    const pdf = await inspectPdf(await buildDayPdf(order, { logos: [] }));
    expect(pdf.pages).toBe(1);
    expect(pdf.text.replace(/\n/g, ' ')).toContain(activity(0));
    expect(pdf.text.replace(/\n/g, ' ')).toContain(activity(19));
    expect(pdf.lines).toContain('Hptm Beispiel Hans');

    const huge = fictionalOrder('Di', {
      blocks: [{ kind: 'section', heading: '1 Dienstbetrieb' }, ...many, ...many, ...many],
    });
    const hugeLayout = layoutOrder(huge);
    expect(hugeLayout.fontSize).toBeLessThan(7);
    const hugeLast = hugeLayout.rows.at(-1);
    expect((hugeLast?.top ?? 0) + (hugeLast?.height ?? 0)).toBeLessThanOrEqual(PAGE_HEIGHT - 42.5);
    expect((await inspectPdf(await buildDayPdf(huge, { logos: [] }))).pages).toBe(1);
  });

  it('keeps short orders at the template font size of 10 pt', () => {
    expect(layoutOrder(fictionalOrder('Mo')).fontSize).toBe(10);
  });

  it('wraps cells within their column width', () => {
    const layout = layoutOrder(fictionalOrder('Mi'));
    for (const row of layout.rows.filter((r) => r.kind === 'entry'))
      for (const cell of row.cells)
        for (const line of cell.lines)
          expect(textWidth(line, cell.size, cell.bold)).toBeLessThanOrEqual(cell.width + 0.01);
    const wrapped = layout.rows.find((r) => r.entryId === 'Mi-4');
    expect(wrapped?.cells.find((c) => c.column === 'C')?.lines.length).toBeGreaterThan(1);
    expect(wrapText('Überlangeswortohneleerzeichenundohnetrennung', 40, 10).length).toBeGreaterThan(
      1,
    );
    expect(wrapText('', 40, 10)).toEqual(['']);
  });

  it('draws characters outside WinAnsi with safe replacements instead of failing', async () => {
    expect(pdfText('Sammelplatz → Halle ≥ 2 😀')).toBe('Sammelplatz -> Halle >= 2 ?');
    expect(pdfText('Übung – Café')).toBe('Übung – Café');
    const order = fictionalOrder('Do', {
      blocks: [
        { kind: 'section', heading: '1 Dienstbetrieb / Ausbildung' },
        {
          kind: 'entry',
          entryId: 'u',
          zeit: '0800',
          taetigkeit: 'Verschiebung → Sammelplatz ✓',
          verantwortlich: 'Zfhr',
          ort: 'Ukft',
        },
      ],
    });
    const pdf = await inspectPdf(await buildDayPdf(order, { logos: [] }));
    expect(pdf.lines).toContain('Verschiebung -> Sammelplatz v');
  });

  it('rejects an unusable signature with a generic message', async () => {
    await expect(
      buildDayPdf(fictionalOrder('Mo'), { logos: [], signature: new Uint8Array([1, 2, 3, 4]) }),
    ).rejects.toThrow(/Unterschrift konnte nicht/);
  });

  it('does not touch network APIs while generating', async () => {
    const spies = [
      typeof globalThis.fetch === 'function' ? vi.spyOn(globalThis, 'fetch') : undefined,
      vi.spyOn(XMLHttpRequest.prototype, 'open'),
      vi.spyOn(XMLHttpRequest.prototype, 'send'),
    ].filter(Boolean);
    await buildPdfZip([fictionalOrder('Mo'), fictionalOrder('Sa')], {
      logos: logos(),
      signature: makePng(10, 3),
    });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('buildPdfZip', () => {
  it('contains exactly the per-day PDFs at the root, one A4 page each', async () => {
    const orders = (['So', 'Mi', 'Mo', 'Sa'] as const).map((day) => fictionalOrder(day));
    const zip = unzipSync(
      await buildPdfZip(orders, { logos: logos(), signature: makePng(34, 10) }, { now: NOW }),
    );
    expect(Object.keys(zip)).toEqual(['01_Mo.pdf', '03_Mi.pdf', '06_Sa.pdf', '07_So.pdf']);
    for (const [name, bytes] of Object.entries(zip)) {
      const pdf = await inspectPdf(bytes);
      const order = orders.find((o) => pdfFileName(o) === name);
      expect(pdf.pages).toBe(1);
      expect(pdf.size.width).toBeLessThan(pdf.size.height);
      expect(pdf.lines).toContain(order?.title);
      expect(pdf.doc.getTitle()).toBe(order && pdfTitle(order));
    }
  });

  it('builds all seven days of a full week', async () => {
    const zip = unzipSync(
      await buildPdfZip(
        TB_WEEKDAYS.map((day) => fictionalOrder(day)),
        { logos: [] },
      ),
    );
    expect(Object.keys(zip)).toEqual([
      '01_Mo.pdf',
      '02_Di.pdf',
      '03_Mi.pdf',
      '04_Do.pdf',
      '05_Fr.pdf',
      '06_Sa.pdf',
      '07_So.pdf',
    ]);
  });
});

describe('extractTemplateLogos', () => {
  it('returns the header logos of the Mo sheet without the signature picture', () => {
    const { xlsx, left, right, center } = syntheticTemplate();
    const found = extractTemplateLogos(xlsx);
    expect(found.map((logo) => [logo.name, logo.mime, logo.align])).toEqual([
      ['image1.png', 'image/png', 'left'],
      ['image4.jpeg', 'image/jpeg', 'center'],
      ['image3.png', 'image/png', 'right'],
    ]);
    expect(found[0].data).toEqual(left);
    expect(found[1].data).toEqual(center);
    expect(found[2].data).toEqual(right);
    expect(found[0].widthMm).toBeCloseTo(54.33, 1);
    expect(found[0].heightMm).toBeCloseTo(11.45, 1);
    expect(found[0].topMm).toBeCloseTo(1.82, 1);
    expect(found[2].widthMm).toBeCloseTo(27, 1);
    expect(found[2].heightMm).toBeCloseTo(23.46, 1);
    expect(found[2].topMm).toBe(0);
  });

  it('yields no logos for unreadable input instead of throwing', () => {
    expect(extractTemplateLogos(new Uint8Array([1, 2, 3]))).toEqual([]);
    expect(extractTemplateLogos(new Uint8Array())).toEqual([]);
  });

  it('feeds the PDF with the extracted logos', async () => {
    const found = extractTemplateLogos(syntheticTemplate().xlsx).filter(
      (logo) => logo.mime === 'image/png',
    );
    const pdf = await inspectPdf(await buildDayPdf(fictionalOrder('Mo'), { logos: found }));
    expect(pdf.images).toBe(2);
  });
});

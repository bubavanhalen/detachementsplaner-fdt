// @vitest-environment jsdom
// Paket E1-02f: nicht einbettbares Wappen (R-10-03, R-10-21; Vertrag E1-02f «Änderungsnotiz aus E1-02e CR-03»
// Nr 1 bis 5; E1-02e E4, V-02e-12). Ist das Wappen für den Schreiber nicht einbettbar, entsteht das PDF ohne
// Wappen und mit genau einer Warnung `invalidImage`; der Entscheid fällt vor dem Zeichnen (layoutWeekForOutput),
// mit genau den Schritten von writePdf (imageEmbeddable ⇔ writePdf nimmt das Bild an). Fiktive Bilder, zur
// Laufzeit gebaut; KVK+ aus E1-02e.
import { describe, expect, it } from 'vitest';
import {
  imageEmbeddable,
  knownEmbeddable,
  layoutWeekForOutput,
  layoutWeekForOutputSync,
  PdfWriteError,
  writePdf,
} from '../../../../src/io/wap-pdf';
import { sanitizeImageBytes } from '../../../../src/io/wap-pdf/imageBytes';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { LayoutWarning } from '../../../../src/model/wap/layout/page/types';
import type { ImageAsset, Plan } from '../../../../src/model/wap/types';
import { KVK_WOCHE, kvk, kvkPlus, wappenPng } from '../../support/page/varianten';
import { jpegKopf } from '../../support/page/wappen';
import { pdfArtefakt } from '../../support/pdf/artefakt';
import { readPdf } from '../../support/pdf/read';
import { bild, seite } from '../writer/support/seiten';
import { gesamtPdf, sha256, wochenPdf } from './support/pdf-plan';
import {
  jpegScanBeliebig,
  mitFolgewoche,
  mitWappen,
  optionen,
  PDF_TITEL,
  pngIdatKaputt,
  pngLeeresIdat,
  pngNurIhdr,
} from './support/plaene';

/** Die Warnung bei nicht einbettbarem Wappen (Änderungsnotiz CR-03 Nr 2). */
const W: LayoutWarning = {
  code: 'invalidImage',
  character: null,
  codePoint: null,
  entryId: null,
  page: 0,
  item: null,
};

/** KVK+ mit fiktivem PNG nur aus Signatur und IHDR als Wappen. */
function plusIhdr(): Plan {
  return mitWappen(kvkPlus(), 'image/png', pngNurIhdr());
}

function wappenVon(plan: Plan): ImageAsset {
  if (plan.coatOfArms === null) throw new Error('Testplan ohne Wappen');
  return plan.coatOfArms;
}

/**
 * Nicht einbettbare Wappen für P9: das PNG nur aus IHDR (CR-03 Nr 5) und das PNG mit leerem IDAT, das
 * sanitizeImageBytes annimmt und erst pdf-lib ablehnt (Änderungsnotiz Test-Review Runde 1 Nr 1).
 */
const KAPUTT: readonly {
  readonly name: string;
  readonly fall: string;
  readonly bytes: () => Uint8Array;
}[] = [
  { name: 'PNG nur aus IHDR', fall: 'ihdr', bytes: pngNurIhdr },
  { name: 'PNG mit leerem IDAT', fall: 'leeres-idat', bytes: pngLeeresIdat },
];

describe('Wappen nicht einbettbar: PDF ohne Wappen mit Warnung (R-10-03, R-10-21; CR-03 Nr 1, 3, 5 P9; Notiz Test-Review Runde 1 Nr 1)', () => {
  for (const k of KAPUTT) {
    it(`[R-10-03][R-10-21] KVK+ mit ${k.name}: renderWeekPdf löst auf, keine Bildlage, Warnungen = [invalidImage]; Bytes gleich wie mit coatOfArms null`, async () => {
      const plan = mitWappen(kvkPlus(), 'image/png', k.bytes());
      const { pdf, info } = await wochenPdf(`kvk-plus-${k.fall}`, plan, KVK_WOCHE);
      expect(info.images).toBe(0);
      expect(info.imagePlacements).toEqual([]);
      expect(pdf.warnings).toEqual([W]);
      const ohne = await wochenPdf(
        `kvk-plus-${k.fall}-ohne-wappen`,
        { ...plan, coatOfArms: null },
        KVK_WOCHE,
      );
      expect(ohne.pdf.warnings).toEqual([]);
      expect(sha256(pdf.bytes)).toBe(sha256(ohne.pdf.bytes));
      expect(pdf.pageCount).toBe(ohne.pdf.pageCount);
    });

    it(`[R-10-03][R-10-21] Gesamt-PDF zweier Wochen mit ${k.name}: genau ein invalidImage mit page 0, keine Bildlage; Bytes gleich wie ohne Wappen`, async () => {
      const plan = mitFolgewoche(mitWappen(kvkPlus(), 'image/png', k.bytes()));
      const { pdf, info } = await gesamtPdf(`kvk-plus-${k.fall}-gesamt`, plan);
      expect(info.images).toBe(0);
      expect(pdf.warnings).toEqual([W]);
      const ohne = await gesamtPdf(`kvk-plus-${k.fall}-gesamt-ohne-wappen`, {
        ...plan,
        coatOfArms: null,
      });
      expect(sha256(pdf.bytes)).toBe(sha256(ohne.pdf.bytes));
    });
  }

  it('[R-10-03][R-10-21] Gegenfall gültiges Wappen (wappenPng): Wochen- und Gesamt-PDF mit Bildlage, ohne invalidImage', async () => {
    const plan = mitFolgewoche(mitWappen(kvkPlus(), 'image/png', wappenPng()));
    const w = await wochenPdf('kvk-plus-wappen', plan, KVK_WOCHE);
    expect(w.info.images).toBe(1);
    expect(w.pdf.warnings.filter((x) => x.code === 'invalidImage')).toEqual([]);
    const g = await gesamtPdf('kvk-plus-wappen-gesamt', plan);
    expect(g.info.images).toBeGreaterThanOrEqual(1);
    expect(g.pdf.warnings.filter((x) => x.code === 'invalidImage')).toEqual([]);
  });
});

describe('Entscheid vor dem Zeichnen (R-10-03, R-10-21; CR-03 Nr 2)', () => {
  it('[R-10-03][R-10-21] ohne Wappen: layoutWeekForOutputSync liefert sofort das Layout von layoutWeekPage, coatOfArmsDropped false', async () => {
    const plan = kvk();
    expect(plan.coatOfArms).toBeNull();
    const sync = layoutWeekForOutputSync(plan, KVK_WOCHE, optionen());
    expect(sync).not.toBeNull();
    const soll = layoutWeekPage(plan, KVK_WOCHE, optionen());
    expect(sync?.coatOfArmsDropped).toBe(false);
    expect(sync?.layout.pages).toEqual(soll.pages);
    expect(sync?.warnings).toEqual(soll.warnings);
    const asy = await layoutWeekForOutput(plan, KVK_WOCHE, optionen());
    expect(asy.coatOfArmsDropped).toBe(false);
    expect(asy.layout.pages).toEqual(soll.pages);
  });

  it('[R-10-03][R-10-21] nicht einbettbares Wappen: Sync null, solange ungeprüft; nach layoutWeekForOutput Layout wie mit coatOfArms null, coatOfArmsDropped true, Warnung angehängt; knownEmbeddable false', async () => {
    const plan = plusIhdr();
    const asset = wappenVon(plan);
    expect(knownEmbeddable(asset)).toBeUndefined();
    expect(layoutWeekForOutputSync(plan, KVK_WOCHE, optionen())).toBeNull();
    const ohne = layoutWeekPage({ ...plan, coatOfArms: null }, KVK_WOCHE, optionen());
    const r = await layoutWeekForOutput(plan, KVK_WOCHE, optionen());
    expect(r.coatOfArmsDropped).toBe(true);
    expect(r.layout.pages).toEqual(ohne.pages);
    expect(r.warnings).toEqual([...ohne.warnings, W]);
    expect(knownEmbeddable(asset)).toBe(false);
    const sync = layoutWeekForOutputSync(plan, KVK_WOCHE, optionen());
    expect(sync?.coatOfArmsDropped).toBe(true);
    expect(sync?.layout.pages).toEqual(ohne.pages);
    expect(sync?.warnings).toEqual([...ohne.warnings, W]);
  });

  it('[R-10-03][R-10-21] einbettbares Wappen: Layout von layoutWeekPage mit Bild, coatOfArmsDropped false; knownEmbeddable true nach der Prüfung', async () => {
    const plan = mitWappen(kvkPlus(), 'image/png', wappenPng());
    const asset = wappenVon(plan);
    expect(knownEmbeddable(asset)).toBeUndefined();
    expect(layoutWeekForOutputSync(plan, KVK_WOCHE, optionen())).toBeNull();
    const r = await layoutWeekForOutput(plan, KVK_WOCHE, optionen());
    const soll = layoutWeekPage(plan, KVK_WOCHE, optionen());
    expect(r.coatOfArmsDropped).toBe(false);
    expect(r.layout.pages).toEqual(soll.pages);
    expect(r.warnings).toEqual(soll.warnings);
    expect(r.layout.pages[0]?.items.some((i) => i.kind === 'image')).toBe(true);
    expect(knownEmbeddable(asset)).toBe(true);
    expect(layoutWeekForOutputSync(plan, KVK_WOCHE, optionen())?.coatOfArmsDropped).toBe(false);
  });

  it('[R-10-03][R-10-21] unbekannte Woche: layoutWeekForOutput lehnt mit ModelError «unknownWeek» ab, layoutWeekForOutputSync wirft ihn synchron', async () => {
    const plan = kvk();
    const e = await layoutWeekForOutput(plan, 'w-fehlt', optionen()).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toMatchObject({ name: 'ModelError', code: 'unknownWeek' });
    let sync: unknown = null;
    try {
      layoutWeekForOutputSync(plan, 'w-fehlt', optionen());
    } catch (x) {
      sync = x;
    }
    expect(sync).toMatchObject({ name: 'ModelError', code: 'unknownWeek' });
  });
});

describe('imageEmbeddable ⇔ writePdf nimmt das Bild an (R-10-03, R-10-21; CR-03 Nr 2, 5 P10)', () => {
  const bilder: readonly {
    readonly name: string;
    readonly mime: 'image/png' | 'image/jpeg';
    readonly bytes: () => Uint8Array;
    /** Vom Vertrag genannter Wert, sofern festgelegt (Prüfung der Fixture, nicht der Erwartung). */
    readonly vertrag: boolean | null;
    /** Vorbedingung: sanitizeImageBytes nimmt das Bild an, writePdf lehnt mit invalidItem ab (Notiz TR Runde 1 Nr 1). */
    readonly nurPdfLib?: true;
  }[] = [
    { name: 'gültiges PNG (wappenPng)', mime: 'image/png', bytes: wappenPng, vertrag: true },
    { name: 'PNG nur mit IHDR', mime: 'image/png', bytes: pngNurIhdr, vertrag: false },
    {
      name: 'JPEG-Kopf mit SOF C0 ohne Scan (jpegKopf)',
      mime: 'image/jpeg',
      bytes: () => jpegKopf(0xc0, 2, 1),
      vertrag: false,
    },
    {
      name: 'PNG mit IDAT aus nicht entpackbaren Bytes',
      mime: 'image/png',
      bytes: pngIdatKaputt,
      vertrag: null,
    },
    {
      name: 'JPEG mit SOF C0, Scan aus beliebigen Bytes und EOI',
      mime: 'image/jpeg',
      bytes: jpegScanBeliebig,
      vertrag: null,
    },
    {
      name: 'PNG mit leerem IDAT (nur pdf-lib lehnt ab)',
      mime: 'image/png',
      bytes: pngLeeresIdat,
      vertrag: null,
      nurPdfLib: true,
    },
  ];
  for (const b of bilder) {
    it(`[R-10-03][R-10-21] ${b.name}: imageEmbeddable = true genau dann, wenn writePdf eine Seite mit genau diesem Bild annimmt`, async () => {
      const bytes = b.bytes();
      const annahme = await imageEmbeddable(b.mime, bytes);
      let pdf: Uint8Array | null = null;
      let fehler: unknown = null;
      try {
        pdf = await writePdf({
          pages: [seite([bild({ x: 100, y: 100, w: 40, h: 40 }, b.mime, bytes)])],
          title: PDF_TITEL,
        });
      } catch (e) {
        pdf = null;
        fehler = e;
      }
      if (b.nurPdfLib === true) {
        expect(sanitizeImageBytes(b.mime, bytes)).not.toBeNull();
        expect(fehler).toBeInstanceOf(PdfWriteError);
        expect(fehler).toMatchObject({ code: 'invalidItem' });
      }
      if (b.vertrag !== null) expect(pdf !== null, 'Fixture wie im Vertrag').toBe(b.vertrag);
      expect(annahme).toBe(pdf !== null);
      if (pdf !== null) {
        await pdfArtefakt(
          `e1-02f-bild-${b.mime === 'image/png' ? 'png' : 'jpeg'}-${String(bilder.indexOf(b))}`,
          pdf,
        );
        expect((await readPdf(pdf)).images).toBe(1);
      }
    });
  }

  it('[R-10-03][R-10-21] imageEmbeddable wirft nie: leere Bytes und fremde Bytes ergeben false', async () => {
    expect(await imageEmbeddable('image/png', new Uint8Array(0))).toBe(false);
    expect(await imageEmbeddable('image/jpeg', Uint8Array.from([1, 2, 3, 4]))).toBe(false);
    expect(await imageEmbeddable('image/png', jpegScanBeliebig())).toBe(false);
  });
});

// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Schrift nicht lesbar → fontLoad (R-10-36; Vertrag E1-02c §2.4 «prüfbar mit
// vi.mock des öffentlichen Moduls src/assets/wap-fonts/index.ts»; Änderungsnotiz Vertragsprüfung V07, V13).
// Die Schriftbytes werden für diese Datei durch fiktive, unlesbare Bytes ersetzt; danach wieder durch die echten.
import { describe, expect, it, vi } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import { WapError } from '../../../../src/model/wap/errors';
import { readPdf } from '../../support/pdf/read';
import { jpegGrau } from './support/bilder';
import { ablehnung, pdfMitArtefakt } from './support/schreiben';
import { bild, seite, text } from './support/seiten';

const zustand = vi.hoisted(() => ({ kaputt: true }));

vi.mock('../../../../src/assets/wap-fonts/index.ts', async (importOriginal) => {
  const echt = await importOriginal<typeof import('../../../../src/assets/wap-fonts/index.ts')>();
  return {
    ...echt,
    fontBytes: (weight: Parameters<typeof echt.fontBytes>[0]) =>
      zustand.kaputt
        ? Uint8Array.from([0x46, 0x49, 0x4b, 0x54, 0x49, 0x56, 0, 1, 2, 3])
        : echt.fontBytes(weight),
  };
});

const FONT_LOAD = {
  cause: 'Die Schrift für das PDF konnte nicht geladen werden.',
  nextStep: 'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
};

const SEITE = seite([text(100, 100, 'Übung KVK'), text(100, 120, 'Fett', { weight: 'bold' })]);

async function fontLoad(): Promise<PdfWriteError> {
  const e = await ablehnung(writePdf({ pages: [SEITE], title: 'Fiktiv' }));
  expect(e).toBeInstanceOf(PdfWriteError);
  expect(e).toBeInstanceOf(WapError);
  return e as PdfWriteError;
}

describe('writePdf: fontLoad (§2.4, V07, V13)', () => {
  it('[R-10-36] unlesbare Schriftbytes → fontLoad ohne Fundstelle, cause = Originalfehler, verbindliche Meldung', async () => {
    zustand.kaputt = true;
    const e = await fontLoad();
    expect(e.code).toBe('fontLoad');
    expect([e.pageIndex, e.itemIndex, e.character]).toEqual([null, null, null]);
    expect(e.userMessage).toEqual(FONT_LOAD);
    expect(e.message).toBe(FONT_LOAD.cause);
    expect(e.cause).toBeInstanceOf(Error);
    expect(e.cause).not.toBeInstanceOf(PdfWriteError);
  });

  it('[R-10-36] (V13) nach fontLoad bleibt kein Zustand: der nächste Aufruf lädt neu (gleiche Bytes → wieder fontLoad, echte Bytes → PDF)', async () => {
    zustand.kaputt = true;
    expect((await fontLoad()).code).toBe('fontLoad');
    expect((await fontLoad()).code).toBe('fontLoad');
    zustand.kaputt = false;
    const bytes = await pdfMitArtefakt('nach-fontload', [SEITE]);
    const info = await readPdf(bytes);
    expect(info.texts.map((t) => t.text)).toEqual(['Übung KVK', 'Fett']);
    expect(info.fonts.every((f) => f.embedded)).toBe(true);
  });

  it('[R-10-36] die Eingabe wird vor dem Laden der Schrift geprüft: invalidItem und missingGlyph statt fontLoad', async () => {
    zustand.kaputt = true;
    const ungueltig = (await ablehnung(
      writePdf({ pages: [seite([text(1, 1, 'a', { sizePt: 0 })])], title: 'Fiktiv' }),
    )) as PdfWriteError;
    expect(ungueltig).toBeInstanceOf(PdfWriteError);
    expect(ungueltig.code).toBe('invalidItem');
    const fehlt = (await ablehnung(
      writePdf({ pages: [seite([text(1, 1, 'Haken ✓')])], title: 'Fiktiv' }),
    )) as PdfWriteError;
    expect(fehlt).toBeInstanceOf(PdfWriteError);
    expect(fehlt.code).toBe('missingGlyph');
    const bildFehlt = (await ablehnung(
      writePdf({
        pages: [
          seite([
            bild({ x: 1, y: 1, w: 2, h: 2 }, 'image/jpeg', jpegGrau({ ohneEoi: true }).bytes),
          ]),
        ],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(bildFehlt).toBeInstanceOf(PdfWriteError);
    expect(bildFehlt.code).toBe('invalidItem');
  });
});

// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – import('fontkit') scheitert → fontLoad (R-10-36; Vertrag E1-02c §2.3 Nr 6
// «fontkit wird im ersten Aufruf mit import('fontkit') geladen», §2.4; Änderungsnotiz Vertragsprüfung V13).
// Das Modul fontkit ist in dieser Datei durch einen Fehler beim Laden ersetzt (fiktiv).
import { describe, expect, it, vi } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import { ablehnung } from './support/schreiben';
import { seite, text } from './support/seiten';

vi.mock('fontkit', () => {
  throw new Error('fiktiv: fontkit nicht ladbar');
});

describe('writePdf: fontkit nicht ladbar (§2.4, V13)', () => {
  it('[R-10-36] scheitert import(fontkit), lehnt writePdf mit fontLoad ab; ein zweiter Aufruf ebenso (kein Zustand)', async () => {
    for (let i = 0; i < 2; i++) {
      const e = (await ablehnung(
        writePdf({ pages: [seite([text(100, 100, 'Übung')])], title: 'Fiktiv' }),
      )) as PdfWriteError;
      expect(e, `Aufruf ${String(i + 1)}`).toBeInstanceOf(PdfWriteError);
      expect(e.code).toBe('fontLoad');
      expect([e.pageIndex, e.itemIndex, e.character]).toEqual([null, null, null]);
      expect(e.userMessage).toEqual({
        cause: 'Die Schrift für das PDF konnte nicht geladen werden.',
        nextStep:
          'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
      });
      expect(e.cause).toBeDefined();
    }
  });
});

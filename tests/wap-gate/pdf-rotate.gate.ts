// Gedrehte PDF-Seiten (Nachtrag-Tests N18, N19 nach Code-Review Runde 1, CR-E101b-08; R-H-19): readPdf liest
// nur ungedrehte Seiten und wirft bei /Rotate ≠ 0 (Wert wie von pdfjs normalisiert, auch geerbt) mit fester
// Meldung; gedrehter Text über die Textmatrix bleibt erlaubt. checkPdfArtefakte meldet eine solche Datei als
// «nicht-lesbar», ohne Text aus dem PDF.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 6 und Nr 8;
// Entscheid TR-E101b-05 (wert). Nur selbst erzeugte PDF mit frei erfundenem Text.
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPdf } from '../wap/support/pdf/read';
import { aufraeumen, neueSandbox, prozessUmgebung, writeText } from './support/umgebung';
import { pdfArtefakteModul } from './support/vertrag-b';
import { drehPdf } from './support/vertrag-b-cr1';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const TEXT = 'Fiktive Drehprobe 0700';

const meldung = (seite: number, grad: number) =>
  `PDF-Seite ${String(seite)} ist gedreht (/Rotate ${String(grad)}): readPdf liest nur ungedrehte Seiten`;

/** Meldung des Fehlers von readPdf; null, wenn readPdf nicht wirft. */
async function fehlerVon(bytes: Uint8Array): Promise<string | null> {
  return readPdf(bytes).then(
    () => null,
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );
}

describe('readPdf: gedrehte Seiten (N18)', () => {
  it.each([
    [90, 90],
    [180, 180],
    [270, 270],
    [-90, 270],
  ])(
    '[R-H-19] N18 Seite 1 mit /Rotate %i → wirft «PDF-Seite 1 ist gedreht (/Rotate %i): …»',
    async (rotate, normalisiert) => {
      const fehler = await fehlerVon(await drehPdf({ drehungen: [rotate], text: TEXT }));
      expect(fehler, 'readPdf wirft nicht').not.toBeNull();
      expect(fehler).toBe(meldung(1, normalisiert));
      expect(fehler).not.toContain(TEXT);
    },
  );

  it('[R-H-19] N18 nur Seite 2 gedreht (/Rotate 90) → Meldung nennt Seite 2; /Rotate am Seitenbaum (geerbt, 270) → Meldung für Seite 1', async () => {
    const zweite = await fehlerVon(await drehPdf({ drehungen: [null, 90], text: TEXT }));
    expect(zweite, 'readPdf wirft nicht').not.toBeNull();
    expect(zweite).toBe(meldung(2, 90));
    const geerbt = await fehlerVon(await drehPdf({ drehungen: [null], text: TEXT, geerbt: 270 }));
    expect(geerbt, 'readPdf wirft bei geerbtem /Rotate nicht').not.toBeNull();
    expect(geerbt).toBe(meldung(1, 270));
  });

  it('[R-H-19] N18 /Rotate 0 und 360 (normalisiert 0) sowie gedrehter Text über die Textmatrix → kein Fehler, Text gelesen; zuvor ist /Rotate 90 rot', async () => {
    expect(await fehlerVon(await drehPdf({ drehungen: [90], text: TEXT })), 'Gegenprobe').toBe(
      meldung(1, 90),
    );
    for (const d of [0, 360]) {
      const info = await readPdf(await drehPdf({ drehungen: [d], text: TEXT }));
      expect(info.texts.map((t) => t.text).join(' '), `/Rotate ${String(d)}`).toContain(
        'Drehprobe',
      );
    }
    const quer = await readPdf(await drehPdf({ drehungen: [null], text: TEXT, textDrehung: 90 }));
    expect(quer.texts.map((t) => t.text).join(' ')).toContain('Drehprobe');
  });
});

describe('checkPdfArtefakte: gedrehte Seite (N19)', () => {
  it('[R-H-19] N19 PDF mit gedrehter Seite → Befund nicht-lesbar, wert und Ursache ohne PDF-Text; ungedrehtes PDF daneben ohne Befund', async () => {
    const sb = neueSandbox();
    const ordner = join(sb.base, 'pdf');
    writeText(ordner, 'gedreht.pdf', await drehPdf({ drehungen: [90], text: TEXT }));
    writeText(ordner, 'gerade.pdf', await drehPdf({ drehungen: [null], text: TEXT }));
    const { checkPdfArtefakte } = await pdfArtefakteModul();
    const r = await checkPdfArtefakte({ cwd: sb.base, ordner });
    expect(r.ok).toBe(false);
    expect(r.geprueft).toBe(2);
    expect(r.befunde.map((b) => b.art)).toEqual(['nicht-lesbar']);
    const b = r.befunde[0];
    expect(b?.datei).toContain('gedreht.pdf');
    expect((b?.wert ?? '').trim().length).toBeGreaterThan(0);
    for (const teil of [TEXT, 'Drehprobe']) {
      expect(b?.wert ?? '', 'PDF-Text im wert').not.toContain(teil);
      expect(r.ursache ?? '', 'PDF-Text in der Ursache').not.toContain(teil);
    }
    expect(r.ursache ?? '').toContain('gedreht.pdf');
  });
});

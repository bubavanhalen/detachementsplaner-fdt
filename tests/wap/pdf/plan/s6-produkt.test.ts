// @vitest-environment jsdom
// Paket E1-02f: Selbsttest S6 am Produkt-PDF (R-10-03, R-H-19; Vertrag E1-02f Notiz «Ausarbeitung Schritt 2» H2,
// J P8; SA-AE001-M-2). Ein Gesamt-PDF, dessen Kopf mit einer Testvorlage (Mindestgrösse 4 pt) auf 4 pt fällt,
// macht den Schritt V5-ebene2 (checkPdfArtefakte, E1-01b) rot, ohne die Schleuse zu ändern; Gegenprobe mit dem
// Gesamt-PDF der KVK. Die PDF liegen nur in eigenen Temp-Ordnern (nie in WAP_PDF_ARTEFAKTE) und werden am Ende
// gelöscht (nur die Probe; die gültige Gegenprobe wird zusätzlich als Artefakt abgelegt, H1). Fiktive Variante der pseudonymisierten KVK-Fixture.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderPlanPdf } from '../../../../src/io/wap-pdf';
import type { PageOptions } from '../../../../src/model/wap/layout/page/types';
import { kpTemplate, type TemplateSet } from '../../../../src/model/wap/template';
import { kvk } from '../../support/page/varianten';
import { pdfArtefakt } from '../../support/pdf/artefakt';
import { optionen, PDF_TITEL } from './support/plaene';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Schritt V5-ebene2 der Schleuse (scripts/wap-gate/pdf-artefakte.mjs, Vertrag E1-01b §2), unverändert geladen. */
interface PdfArtefakteModul {
  checkPdfArtefakte(opts: { cwd: string; ordner?: string; mindestPt?: number }): Promise<{
    ok: boolean;
    ursache?: string;
    geprueft: number;
    befunde: { datei: string; art: string; wert: string }[];
  }>;
}

async function checkPdfArtefakte(opts: { cwd: string; ordner: string }) {
  const modul = (await import(
    pathToFileURL(join(WURZEL, 'scripts', 'wap-gate', 'pdf-artefakte.mjs')).href
  )) as PdfArtefakteModul;
  return modul.checkPdfArtefakte(opts);
}

/** Kopie der Kp-Vorlage mit Mindestgrösse 4 pt unter dem Schlüssel 'kp' (Vertrag H2). */
function vorlagenMitMindestgroesse4(): TemplateSet {
  const kp = kpTemplate();
  return new Map([['kp', { ...kp, fontSizes: { ...kp.fontSizes, min: 4 } }]]);
}

function s6Optionen(): PageOptions {
  return { paper: 'A4', showStatus: true, templates: vorlagenMitMindestgroesse4() };
}

/** Schreibt `bytes` als `name` in einen neuen Temp-Ordner, prüft ihn mit V5-ebene2 und löscht ihn danach. */
async function pruefeImTempOrdner(name: string, bytes: Uint8Array) {
  const ordner = mkdtempSync(join(tmpdir(), 'wap-e1-02f-s6-'));
  try {
    writeFileSync(join(ordner, name), bytes);
    return await checkPdfArtefakte({ cwd: WURZEL, ordner });
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

describe('S6 am Produkt-PDF (R-10-03, R-H-19; H2, J P8)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; zwei Gesamt-PDF (renderPlanPdf der KVK unter 0,1 s) und zwei Läufe
  // V5-ebene2 zusammen rund 0,6 s, unter künstlicher Rechnerlast 6 s (19 Lastthreads) bis 25 s (60) gemessen –
  // Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-16).
  it('[R-10-03][R-H-19] Gesamt-PDF mit Einheit aus 200 Zeichen und Vorlage mit Mindestgrösse 4 pt: V5-ebene2 rot mit Befund «schriftgroesse» 4 und Ursache «Schrift unter Mindestgrösse 4,5 pt» samt Dateiname; Gegenprobe KVK grün', async () => {
    const probe = { ...kvk(), unit: 'Einheit '.repeat(25).slice(0, 200) };
    const pdf = await renderPlanPdf(probe, s6Optionen(), PDF_TITEL);
    const rot = await pruefeImTempOrdner('e1-02f-s6-produkt.pdf', pdf.bytes);
    expect(rot.ok).toBe(false);
    expect(rot.geprueft).toBe(1);
    expect(rot.befunde).toEqual([expect.objectContaining({ art: 'schriftgroesse', wert: '4' })]);
    expect(rot.ursache ?? '').toContain('Schrift unter Mindestgrösse 4,5 pt');
    expect(rot.ursache ?? '').toContain('e1-02f-s6-produkt.pdf');

    // Gegenprobe: Gesamt-PDF der KVK mit den mitgelieferten Vorlagen (Mindestgrösse 4,5 pt).
    const kvkPdf = await renderPlanPdf(kvk(), optionen(), PDF_TITEL);
    await pdfArtefakt('e1-02f-s6-gegenprobe', kvkPdf.bytes);
    const gruen = await pruefeImTempOrdner('e1-02f-s6-gegenprobe.pdf', kvkPdf.bytes);
    expect(gruen.ok).toBe(true);
    expect(gruen.geprueft).toBe(1);
    expect(gruen.befunde).toEqual([]);
  }, 120_000);
});

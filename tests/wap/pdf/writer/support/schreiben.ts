// Aufruf des PDF-Schreibers in den Vitest-Tests (Paket E1-02c; Vertrag E1-02c §2, P-10).
// Jedes gültige Test-PDF wird mit pdfArtefakt('e1-02c-<fall>', …) für die Ebene-2-Prüfung der Schleuse
// (V5-ebene2, Befund E1-01b-02) abgelegt; ausgenommen sind nur PDF mit absichtlich zu kleiner Schrift.
// Nur in Vitest verwenden: der Schreiber lädt die Schriftdateien über Vite (`?inline`).
import { expect } from 'vitest';
import { type PdfWriteInput, writePdf } from '../../../../../src/io/wap-pdf/writer';
import type { PageModel } from '../../../../../src/model/wap/layout/pageModel';
import { pdfArtefakt } from '../../../support/pdf/artefakt';

/** Standardtitel der Test-PDF (fiktiv, mit Umlaut). */
export const TITEL = 'WAP Übung KVK Wo1 Stand 01';

/**
 * Schreibt die Seiten und legt das PDF als Artefakt `e1-02c-<fall>` ab.
 * @param fall Kleinbuchstaben, Ziffern, Bindestrich (Artefaktname nach E1-01b)
 */
export async function pdfMitArtefakt(
  fall: string,
  pages: readonly PageModel[],
  title: string = TITEL,
): Promise<Uint8Array> {
  const bytes = await writePdf({ pages, title });
  await pdfArtefakt(`e1-02c-${fall}`, bytes);
  return bytes;
}

/** Schreibt ohne Ablage (nur für PDF mit absichtlich zu kleiner Schrift, P-10, oder Vergleichsläufe). */
export async function pdfOhneArtefakt(input: PdfWriteInput): Promise<Uint8Array> {
  return writePdf(input);
}

/**
 * Liefert den Ablehnungsgrund eines Promise; erfüllt es sich, scheitert der Test an einer Assertion.
 */
export async function ablehnung(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e: unknown) {
    return e;
  }
  expect.fail('writePdf hat nicht abgelehnt');
}

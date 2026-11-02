// Paket E1-02c: PDF deterministisch über Node und Edge (R-L-01; Leitplanke 4; Vertrag E1-02c §2.3 Nr 7, §5,
// P-10, P-14). Die Harness erzeugt das PDF mit writePdf in Edge (Projekt edge); die Node-Seite rechnet im selben
// Checkout in einem Kindprozess über die Vite-API (ohne eingefrorenen Hash). Gleiche Eingabe → gleiche Bytes,
// auch zweimal in Edge. Die in Edge erzeugten Bytes werden mit pdfArtefakt abgelegt (Befund E1-01b-02).
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { pdfImKindprozess } from '../../wap/integration/pdf-writer/support/kindprozess';
import { BEISPIEL_TITEL, beispielSeiten } from '../../wap/pdf/writer/support/beispiel';
import { ausBase64, zuJson } from '../../wap/pdf/writer/support/seite-json';
import { pdfArtefakt } from '../../wap/support/pdf/artefakt';
import { readPdf } from '../../wap/support/pdf/read';
import { test } from '../support/fixtures';
import { harnessBereit } from './support/messen';

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('[R-L-01] writePdf in Edge ergibt dieselben Bytes wie in Node (SHA-256), zweimal in Edge gleich', async ({
  wapPage,
}) => {
  test.setTimeout(180_000);
  await harnessBereit(wapPage);
  const seiten = beispielSeiten().map(zuJson);
  const erzeuge = () =>
    wapPage.evaluate(async ([s, t]) => (await window.wapHarness?.pdf(s, t)) ?? null, [
      seiten,
      BEISPIEL_TITEL,
    ] as const);
  const erster = await erzeuge();
  expect(erster).toMatchObject({ ok: true });
  const zweiter = await erzeuge();
  expect(zweiter).toMatchObject({ ok: true });
  const edge1 = erster?.ok === true ? ausBase64(erster.base64) : new Uint8Array(0);
  const edge2 = zweiter?.ok === true ? ausBase64(zweiter.base64) : new Uint8Array(0);
  await pdfArtefakt('e1-02c-edge-beispiel', edge1);
  expect(sha(edge2)).toBe(sha(edge1));

  const node = await pdfImKindprozess(seiten, BEISPIEL_TITEL, 'Europe/Zurich');
  expect(node).toMatchObject({ ok: true });
  expect(node.ok ? node.sha256 : '').toBe(sha(edge1));

  const info = await readPdf(edge1);
  expect(info.pages).toHaveLength(2);
  expect(info.fonts.map((f) => f.name).sort()).toEqual(['Arimo', 'Arimo-Bold']);
  expect(info.metadata.Title).toBe(BEISPIEL_TITEL);
});

test('[R-L-01] writePdf in Edge: Fehler der Eingabe als PdfWriteError (invalidItem) mit Code, wie in Node', async ({
  wapPage,
}) => {
  await harnessBereit(wapPage);
  const leer = await wapPage.evaluate(
    async () => (await window.wapHarness?.pdf([], 'Fiktiv')) ?? null,
  );
  expect(leer).toMatchObject({
    ok: false,
    name: 'PdfWriteError',
    code: 'invalidItem',
    istPdfWriteError: true,
  });
});

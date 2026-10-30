// Paket E1-02f: Wochen-PDF deterministisch über Edge und Node (R-5-01, R-L-01; Vertrag E1-02f, Notiz «Ausarbeitung
// Schritt 2» B4, E «Node-Seite», H1, J X8; Leitplanke 4). Die Harness erzeugt das PDF der KVK mit renderWeekPdf in
// Edge; die Node-Seite rechnet im selben Checkout in Kindprozessen mit den Zeitzonen Europe/Zurich und
// America/New_York. Gleiche Eingabe → gleiche SHA-256. Pseudonymisierte KVK-Fixture.
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { test } from '../support/fixtures';
import { edgePdf, keineKonsole } from './support/ablauf';
import { imKindprozess, nodeDaten } from './support/kindprozess';
import { harnessBereit, PDF_TITEL } from './support/messen-woche';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

test('[R-5-01][R-L-01] SHA-256 von renderWeekPdf der KVK im Kindprozess (Europe/Zurich und America/New_York) = SHA-256 von pdfWoche in Edge', async ({
  wapPage,
}) => {
  test.setTimeout(300_000);
  const d = await nodeDaten();
  await harnessBereit(wapPage);
  const weekId = d.wochen.kvk[0]?.weekId ?? '';
  const edge = await edgePdf(wapPage, d.plaene.kvk, weekId, 'kvk-woche');
  const soll = createHash('sha256').update(edge.bytes).digest('hex');
  const zonen = [
    { tz: 'Europe/Zurich', versatz: -60 },
    { tz: 'America/New_York', versatz: 300 },
  ];
  for (const z of zonen) {
    const r = await imKindprozess(
      { art: 'pdfWoche', plan: d.plaene.kvk, weekId, title: PDF_TITEL },
      z.tz,
    );
    expect(r, z.tz).toMatchObject({ ok: true });
    if (!r.ok) continue;
    expect(r.wert.zeitzone).toBe(z.tz);
    expect(r.wert.versatzJanuar).toBe(z.versatz);
    expect(r.wert.sha256, `Node (${z.tz}) = Edge`).toBe(soll);
  }
});

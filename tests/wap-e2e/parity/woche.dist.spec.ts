// Paket E1-02f: Parität in der Einzeldatei unter der Suite-CSP (R-5-01; Vertrag E1-02f, Notiz «Ausarbeitung
// Schritt 2» Abschnitte E, G, J X2; ADR-010 §7.4 «zusätzlich im Projekt edge-dist unter der Suite-CSP»).
// Projekt edge-dist: runE2e baut tests/wap-e2e/harness/week.tsx nach test-results/wap/einzeldatei/week.html
// (nicht versioniert); geöffnet über file://. Keine Konsolenmeldung, keine fremde Anfrage (wapPage), keine
// CSP-Verletzung. Pseudonymisierte KVK-Fixture aus der Node-Seite.
import { expect } from '@playwright/test';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { einzeldateiUrl, test } from '../support/fixtures';
import { edgePdf, keineKonsole, pruefeParitaet, zeigeUndMiss } from './support/ablauf';
import { nodeDaten } from './support/kindprozess';
import { harnessBereit, ZOOM_100 } from './support/messen-woche';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

test('[R-5-01] Einzeldatei week.html unter der Suite-CSP, KVK bei scale 4/3: vergleicheSeiten = [], Containerzahl = pageCount = Seiten von readPdf; keine CSP-Verletzung', async ({
  wapPage,
  requests,
}) => {
  test.setTimeout(240_000);
  await wapPage.addInitScript(() => {
    const verstoesse: string[] = [];
    (window as unknown as { wapCsp: string[] }).wapCsp = verstoesse;
    document.addEventListener('securitypolicyviolation', (e) => {
      verstoesse.push(e.effectiveDirective);
    });
  });
  const d = await nodeDaten();
  const url = einzeldateiUrl('week');
  expect(url.startsWith('file:')).toBe(true);
  await harnessBereit(wapPage, url);
  const w = d.wochen.kvk[0];
  const weekId = w?.weekId ?? '';
  const pdf = await edgePdf(wapPage, d.plaene.kvk, weekId, 'dist-kvk');
  const m = await zeigeUndMiss(wapPage, d.plaene.kvk, weekId, w?.seiten ?? [], ZOOM_100);
  pruefeParitaet(m, pdf, 'Einzeldatei KVK scale 4/3');
  expect(await wapPage.evaluate(() => (window as unknown as { wapCsp: string[] }).wapCsp)).toEqual(
    [],
  );
  expect(
    requests.every((u) => u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')),
  ).toBe(true);
});

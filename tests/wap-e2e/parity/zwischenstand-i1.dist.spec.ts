// Paket E1-02f: Einstiegsseite des Zwischenstands I1 (R-5-01, R-10-03; Vertrag E1-02f, Notiz «Ausarbeitung
// Schritt 2» Abschnitt F, J W7; V-02f-3; AE-001 §3). Projekt edge-dist: runE2e baut
// tests/wap-e2e/harness/zwischenstand-i1.tsx nach test-results/wap/einzeldatei/zwischenstand-i1.html; geöffnet
// über file://. Rollen, Namen und Texte nach F, PDF der Woche und aller Wochen als lokaler Download, kein Speicher,
// keine Netzanfrage, keine Konsolenausgabe. Nur der synthetische, fiktive Plan.
import { readFileSync } from 'node:fs';
import { type Download, expect } from '@playwright/test';
import { pdfArtefakt } from '../../wap/support/pdf/artefakt';
import { readPdf } from '../../wap/support/pdf/read';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { einzeldateiUrl, test } from '../support/fixtures';
import { keineKonsole } from './support/ablauf';
import { nodeDaten } from './support/kindprozess';
import { container, TOL_PX } from './support/messen-woche';

const TITEL = 'WAP-Planer – Zwischenstand I1';
const HINWEIS =
  'Fiktiver Plan zur Ansicht, keine echten Daten. Die Seite speichert nichts im Browser und sendet nichts; PDF werden nur auf dieses Gerät heruntergeladen.';
const WOCHEN = ['KVK KW 40', 'Wo1 KW 41', 'Wo2 KW 42', 'Wo3 KW 43'];
const ZOOMSTUFEN = ['100 %', '150 %', '200 %', '300 %'];
const DATEI_WOCHE = 'WAP-Planer_Zwischenstand_I1_KVK.pdf';
const DATEI_PLAN = 'WAP-Planer_Zwischenstand_I1_Plan.pdf';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

async function bytesVon(d: Download): Promise<Uint8Array> {
  return new Uint8Array(readFileSync(await d.path()));
}

test('[R-5-01][R-10-03] (V-02f-3) Einstiegsseite Zwischenstand I1: «PDF dieser Woche» meldet «PDF erstellt: …» und lädt die Datei herunter; Rollen, Namen und Texte nach F; Wochen- und Zoomwahl; «PDF aller Wochen»; kein Speicher, keine Netzanfrage', async ({
  wapPage,
}) => {
  test.setTimeout(300_000);
  const d = await nodeDaten();
  const syn = d.wochen.synthetisch;
  await wapPage.goto(einzeldateiUrl('zwischenstand-i1'));
  await expect(wapPage.getByRole('heading', { level: 1, name: TITEL })).toBeVisible({
    timeout: 20_000,
  });
  const status = wapPage.getByRole('status');
  const startText = await status.textContent();

  const download = wapPage.waitForEvent('download', { timeout: 120_000 }).catch(() => null);
  await wapPage.getByRole('button', { name: 'PDF dieser Woche' }).click();
  await expect(status).not.toHaveText('', { timeout: 120_000 });
  await expect(status).toHaveText(`PDF erstellt: ${DATEI_WOCHE}`);
  const dl = await download;
  expect(dl, 'Download').not.toBeNull();
  if (dl === null) return;
  expect(dl.suggestedFilename()).toBe(DATEI_WOCHE);
  const woche = await bytesVon(dl);
  await pdfArtefakt('e1-02f-edge-zwischenstand-woche', woche);
  const wInfo = await readPdf(woche);
  expect(wInfo.metadata.Title).toBe(DATEI_WOCHE.slice(0, -'.pdf'.length));
  expect(wInfo.pages.length).toBe(syn[0]?.seiten.length);
  await expect(container(wapPage)).toHaveCount(wInfo.pages.length);

  // Aufbau nach F.
  expect(startText ?? '').toBe('');
  await expect(wapPage.getByRole('heading', { level: 1 })).toHaveText(TITEL);
  await expect(wapPage.locator('h1 + p')).toHaveText(HINWEIS);
  const wochenwahl = wapPage.getByRole('combobox', { name: 'Woche' });
  await expect(wochenwahl.locator('option')).toHaveText(WOCHEN);
  expect(
    await wochenwahl.evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent),
  ).toBe(WOCHEN[0]);
  const zoom = wapPage.getByRole('combobox', { name: 'Zoom' });
  await expect(zoom.locator('option')).toHaveText(ZOOMSTUFEN);
  expect(await zoom.evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent)).toBe(
    '200 %',
  );
  await expect(wapPage.getByRole('button', { name: 'PDF aller Wochen' })).toBeVisible();
  const breite = syn[0]?.seiten[0]?.widthPt ?? 0;
  await expect
    .poll(async () =>
      Math.abs(((await container(wapPage).first().boundingBox())?.width ?? 0) - (breite * 8) / 3),
    )
    .toBeLessThanOrEqual(TOL_PX);
  await expect(
    wapPage.getByRole('document', { name: `Wochenseite ${syn[0]?.label ?? ''}` }),
  ).toHaveCount(1);

  // Wochen- und Zoomwahl.
  await wochenwahl.selectOption({ label: 'Wo2 KW 42' });
  await expect(wapPage.getByRole('document', { name: 'Wochenseite Woche 2' })).toHaveCount(1);
  await zoom.selectOption({ label: '100 %' });
  await expect
    .poll(async () =>
      Math.abs(((await container(wapPage).first().boundingBox())?.width ?? 0) - (breite * 4) / 3),
    )
    .toBeLessThanOrEqual(TOL_PX);

  // Gesamt-PDF.
  const download2 = wapPage.waitForEvent('download', { timeout: 120_000 }).catch(() => null);
  await wapPage.getByRole('button', { name: 'PDF aller Wochen' }).click();
  await expect(status).toHaveText(`PDF erstellt: ${DATEI_PLAN}`, { timeout: 120_000 });
  const dl2 = await download2;
  expect(dl2, 'Download Gesamt-PDF').not.toBeNull();
  if (dl2 === null) return;
  expect(dl2.suggestedFilename()).toBe(DATEI_PLAN);
  const plan = await bytesVon(dl2);
  await pdfArtefakt('e1-02f-edge-zwischenstand-plan', plan);
  const pInfo = await readPdf(plan);
  expect(pInfo.metadata.Title).toBe(DATEI_PLAN.slice(0, -'.pdf'.length));
  expect(syn.length).toBe(4);
  expect(pInfo.pages.length).toBe(syn.reduce((s, w) => s + w.seiten.length, 0));

  // Kein Speicher.
  const speicher = await wapPage.evaluate(async () => ({
    localStorage: localStorage.length,
    indexedDB: (await indexedDB.databases()).length,
  }));
  expect(speicher).toEqual({ localStorage: 0, indexedDB: 0 });
});

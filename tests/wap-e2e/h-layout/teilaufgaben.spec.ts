// Paket H-LAYOUT, Befund SA-H-01 (Gate S A1 «Bildschirm»; R-10-49, R-5-01): Teilaufgaben erscheinen in der
// Wochenansicht in derselben Lage und mit denselben Umbrüchen wie im PDF – auch im Rückfall. Projekt edge (Vite).
// Plan: pseudonymisierte KVK-Fixture der Node-Seite; Block e35 erhält im Test fiktive Teilaufgaben.
import { expect, type Page } from '@playwright/test';
import { edgePdf, keineKonsole, pruefeParitaet } from '../parity/support/ablauf';
import { nodeDaten } from '../parity/support/kindprozess';
import {
  bildschirmTexte,
  container,
  harnessBereit,
  messeWoche,
  setzePlan,
  ZOOM_100,
  zeigeWoche,
} from '../parity/support/messen-woche';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { test } from '../support/fixtures';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

type PlanJson = { entries: Record<string, Record<string, unknown>> };

/** KVK mit Teilaufgaben an e35; `zeit` verkürzt den Block für den Rückfall. */
function mitTeilaufgaben(kvk: unknown, zeit?: { from: number; to: number }): unknown {
  const p = JSON.parse(JSON.stringify(kvk)) as PlanJson;
  const e35 = p.entries.e35 ?? {};
  p.entries.e35 = {
    ...e35,
    title: [{ text: 'Fsg Mat', bold: true }],
    ltg: 'Kp Kdt',
    subtasks: [
      { title: [{ text: 'Fsg Fz', bold: true }], ltg: 'Zfhr', ort: 'Halle 3' },
      { title: [{ text: 'Fahrer Rep anschl Vs Ukft', bold: false }], ltg: '', ort: '' },
    ],
    ...(zeit === undefined ? {} : { time: { form: 'range', ...zeit } }),
  };
  return p;
}

/** Wartet, bis die Ansicht bereit ist: Seiten = pageCount, nichts beschäftigt, Zeilenzahl stabil. */
async function bereit(page: Page, seiten: number): Promise<void> {
  const c = container(page);
  await expect(c).toHaveCount(seiten, { timeout: 30_000 });
  await expect(page.locator('#root [aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  let vorher = -1;
  await expect
    .poll(
      async () => {
        const n = await page.locator('#root span[data-wap-item]').count();
        const stabil = n > 0 && n === vorher;
        vorher = n;
        return stabil;
      },
      { intervals: [250, 250, 500, 500, 1000], timeout: 30_000 },
    )
    .toBe(true);
}

test.describe('Parität Teilaufgaben (R-10-49)', () => {
  for (const fall of [
    { name: 'voll', zeit: undefined },
    { name: 'rueckfall', zeit: { from: 540, to: 600 } },
  ]) {
    test(`[R-10-49] KVK mit Teilaufgaben an e35 (${fall.name}) bei scale 4/3: Bildschirm = PDF (vergleicheSeiten = [])`, async ({
      wapPage,
    }) => {
      test.setTimeout(180_000);
      const d = await nodeDaten();
      await harnessBereit(wapPage);
      const w = d.wochen.kvk[0];
      const weekId = w?.weekId ?? '';
      const plan = mitTeilaufgaben(d.plaene.kvk, fall.zeit);
      const pdf = await edgePdf(wapPage, plan, weekId, `h-layout-teilaufgaben-${fall.name}`);
      await setzePlan(wapPage, plan);
      expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 })).toEqual({ ok: true });
      await bereit(wapPage, pdf.pageCount);
      const m = await messeWoche(wapPage, ZOOM_100);
      if (fall.zeit === undefined) {
        const texte = bildschirmTexte(m);
        expect(texte).toContain('Fsg Fz');
        // Der Ort kann seit «12: ja» (Nebenspalte Gewicht 2, schmalerer Block; F-LAYOUT2) umbrechen.
        expect(texte.join(' ')).toMatch(/\(Halle\s3\)/);
      }
      pruefeParitaet(m, pdf, `Teilaufgaben ${fall.name}`);
    });
  }
});

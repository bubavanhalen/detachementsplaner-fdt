// Paket E1-02c: PageView in der Einzeldatei unter der Suite-CSP (R-L-04; Vertrag E1-02c §3.1 «kein @font-face,
// keine URL, CSP der Suite unverändert (G-4 c)», §5 «zusätzlich ein Fall in edge-dist … ohne CSP-Verletzung»;
// P-14). Projekt edge-dist: runE2e baut tests/wap-e2e/harness/page-view.tsx zur Einzeldatei; geöffnet über file://.
import { expect } from '@playwright/test';
import { measureRuns } from '../../../src/model/wap/layout/text/measure';
import {
  BLAU,
  fett,
  lauf,
  rechteck,
  seite,
  strich,
  zeile,
} from '../../wap/pdf/writer/support/seiten';
import { einzeldateiUrl, test } from '../support/fixtures';
import {
  harnessBereit,
  type Konsolenmeldung,
  konsoleMitschneiden,
  messeZeilen,
  nahe,
  TOL_GRUNDLINIE,
  TOL_X,
  zeige,
} from './support/messen';

// Keine Konsolenausgabe jeder Art (TR-E102c-06): jede Meldung der Seite wird gezählt, erwartet 0.
let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  expect(konsole).toEqual([]);
});

const LABEL = 'Wochenseite Einzeldatei';

test('[R-L-04] Einzeldatei unter der Suite-CSP: Zeilen als span mit white-space pre an berechneter Lage, Schrift geladen, keine CSP-Verletzung', async ({
  wapPage,
}) => {
  await wapPage.addInitScript(() => {
    const verstoesse: string[] = [];
    (window as unknown as { wapCsp: string[] }).wapCsp = verstoesse;
    document.addEventListener('securitypolicyviolation', (e) => {
      verstoesse.push(e.effectiveDirective);
    });
  });
  const url = einzeldateiUrl('page-view');
  expect(url.startsWith('file:')).toBe(true);
  await harnessBereit(wapPage, url);
  const runs = [fett('Einzeldatei '), lauf('Übung «KVK» 0700-1200')];
  const p = seite([
    rechteck({ x: 40, y: 40, w: 300, h: 60 }, null, strich(BLAU, 0.5, [2, 1])),
    zeile({ x: 50.25, baselineY: 70.5, sizePt: 5.5, runs }),
    zeile({ x: 30, baselineY: 300, sizePt: 6, rotation: 90, runs: [lauf('Gedreht')] }),
  ]);
  await zeige(wapPage, p, { scale: 1, label: LABEL });
  const c = wapPage.getByRole('document', { name: LABEL });
  await expect(c.locator('span[data-wap-item]')).toHaveCount(2);
  const z = await messeZeilen(wapPage, LABEL, 1);
  expect(z.map((x) => x.text)).toEqual(['Einzeldatei Übung «KVK» 0700-1200', 'Gedreht']);
  expect(z.map((x) => x.stil.whiteSpace)).toEqual(['pre', 'pre']);
  expect(z[0]?.stil.fontFamily.replace(/["']/g, '').split(',')[0]?.trim()).toBe('WAP Arimo');
  nahe(z[0]?.start.x, 50.25, TOL_X, 'x');
  nahe(z[0]?.start.y, 70.5, TOL_GRUNDLINIE, 'Grundlinie');
  nahe(z[0]?.ende.x, 50.25 + measureRuns(runs, 5.5), TOL_X, 'Ende (Breite)');
  const fonts = await wapPage.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.family.replace(/["']/g, '') === 'WAP Arimo')
      .map((f) => `${f.weight} ${f.status}`)
      .sort(),
  );
  expect(fonts).toEqual(['400 loaded', '700 loaded']);
  await expect(c.locator('svg')).not.toHaveCount(0);
  expect(await wapPage.evaluate(() => (window as unknown as { wapCsp: string[] }).wapCsp)).toEqual(
    [],
  );
});

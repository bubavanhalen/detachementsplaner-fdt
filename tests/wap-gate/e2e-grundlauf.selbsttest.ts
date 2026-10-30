// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17, Test mit Browser): Playwright-Grundlauf in Edge (Kanal msedge,
// Gate-0-Entscheid E4 b; Plan R-05) im Klon des Arbeitsstands, Projekte edge (Vite) und edge-dist
// (Einzeldatei unter der Suite-CSP). Die Fixtures machen einen Test rot bei Konsolenfehlern oder
// -warnungen der Seite und bei Netzanfragen ausserhalb der App; ein CSP-Verstoss der Einzeldatei zeigt
// sich so als roter Test (R-H-11). readPdf läuft auch in Playwright (R-H-19).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (runE2e, playwright.wap.config.ts, Fixtures,
// einzeldateiUrl, Prüfhilfen). Nur fiktive Seiten und Texte; Anfragen nur an 127.0.0.1.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  neueSandbox,
  prozessUmgebung,
  schrittText,
  writeText,
} from './support/umgebung';
import { e2e } from './support/vertrag';
import { type PwTest, playwrightTests } from './support/vertrag-b';

afterEach(aufraeumen);

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Harness-Einstieg: hängt sich selbst in #root ein, mit einem Bild aus einer data:-URL. */
const GRUNDLAUF_TSX = [
  "const root = document.getElementById('root');",
  'if (root !== null) {',
  "  const text = document.createElement('p');",
  "  text.textContent = 'Grundlauf bereit';",
  "  const bild = document.createElement('img');",
  "  bild.alt = 'Punkt';",
  `  bild.src = ${JSON.stringify(PNG_1X1)};`,
  '  root.append(text, bild);',
  '}',
  'export {};',
  '',
].join('\n');

/** Seite für das Projekt edge (Vite-Entwicklungsserver). */
const GRUNDLAUF_HTML = [
  '<!doctype html>',
  '<html lang="de-CH">',
  '  <head>',
  '    <meta charset="utf-8" />',
  '    <link rel="icon" href="data:," />',
  '    <title>Grundlauf</title>',
  '  </head>',
  '  <body>',
  '    <div id="root"></div>',
  '    <script type="module" src="./zz-grundlauf.tsx"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

const SEITE = '/tests/wap-e2e/harness/zz-grundlauf.html';

const KOPF = [
  "import { expect } from '@playwright/test';",
  "import { einzeldateiUrl, test } from './support/fixtures';",
  '',
].join('\n');

/** Grüne Spezifikationen: edge über Vite, edge-dist über die Einzeldatei, readPdf in Playwright. */
function grueneSpezifikationen(root: string): void {
  writeText(root, 'tests/wap-e2e/harness/zz-grundlauf.tsx', GRUNDLAUF_TSX);
  writeText(root, 'tests/wap-e2e/harness/zz-grundlauf.html', GRUNDLAUF_HTML);
  writeText(
    root,
    'tests/wap-e2e/zz-grundlauf.spec.ts',
    [
      KOPF,
      "test('[R-H-11] Grundlauf edge', async ({ wapPage }) => {",
      `  await wapPage.goto(${JSON.stringify(SEITE)});`,
      "  await expect(wapPage.getByText('Grundlauf bereit')).toBeVisible();",
      "  await expect(wapPage.getByRole('img', { name: 'Punkt' })).toBeVisible();",
      '});',
      '',
    ].join('\n'),
  );
  writeText(
    root,
    'tests/wap-e2e/zz-grundlauf.dist.spec.ts',
    [
      KOPF,
      "test('[R-H-11] Grundlauf edge-dist', async ({ wapPage }) => {",
      "  const url = einzeldateiUrl('zz-grundlauf');",
      "  expect(url.startsWith('file:')).toBe(true);",
      '  await wapPage.goto(url);',
      "  await expect(wapPage.getByText('Grundlauf bereit')).toBeVisible();",
      "  await expect(wapPage.getByRole('img', { name: 'Punkt' })).toBeVisible();",
      '});',
      '',
    ].join('\n'),
  );
  writeText(
    root,
    'tests/wap-e2e/zz-pdf.spec.ts',
    [
      "import { expect, test } from '@playwright/test';",
      "import { PDFDocument, StandardFonts } from 'pdf-lib';",
      "import { readPdf } from '../wap/support/pdf/read';",
      '',
      "test('[R-H-19] readPdf in Playwright', async () => {",
      '  const doc = await PDFDocument.create();',
      '  const f = await doc.embedFont(StandardFonts.Helvetica);',
      "  doc.addPage([200, 200]).drawText('Grundlauf', { x: 10, y: 100, size: 10, font: f });",
      '  const info = await readPdf(await doc.save());',
      "  expect(info.texts.map((t) => t.text)).toEqual(['Grundlauf']);",
      '});',
      '',
    ].join('\n'),
  );
}

function eintrag(liste: PwTest[], titel: string, projekt: string): PwTest {
  const t = liste.find((x) => x.titel === titel && x.projekt === projekt);
  expect(t, `${titel} (${projekt}) fehlt im Bericht`).toBeDefined();
  return t as PwTest;
}

describe('Playwright-Grundlauf in Edge (runE2e im Klon)', () => {
  it(
    '[R-H-11][R-H-19] edge (Vite, Seite mit data:-Bild) und edge-dist (Einzeldatei unter der Suite-CSP) grün; readPdf läuft in Playwright; Berichte und PDF früherer Schritte unter test-results/wap bleiben erhalten',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      grueneSpezifikationen(k.root);
      // Stand nach V1 bis V3: V9 liest diese Berichte, V5-ebene2 diese PDF (Vertrag E1-01b §2).
      const frueher = [
        writeText(k.root, 'test-results/wap/vitest.json', '{"testResults":[]}\n'),
        writeText(k.root, 'test-results/wap/pdf/v1-probe.pdf', '%PDF-1.7\n'),
      ];
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: k.root });
      for (const d of frueher) expect(existsSync(d), `${d} gelöscht`).toBe(true);
      const liste = playwrightTests(join(k.root, 'test-results', 'wap', 'playwright.json'));
      const rote = liste
        .filter((t) => t.status !== 'passed')
        .map((t) => `${t.projekt} ${t.titel}: ${t.fehler}`);
      expect(rote).toEqual([]);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(eintrag(liste, '[R-H-11] Grundlauf edge', 'edge').status).toBe('passed');
      expect(eintrag(liste, '[R-H-11] Grundlauf edge-dist', 'edge-dist').status).toBe('passed');
      expect(eintrag(liste, '[R-H-19] readPdf in Playwright', 'edge').status).toBe('passed');
      expect(
        liste.some((t) => t.titel === '[R-H-11] Grundlauf edge' && t.projekt === 'edge-dist'),
      ).toBe(false);
      expect(
        liste.some((t) => t.titel === '[R-H-11] Grundlauf edge-dist' && t.projekt === 'edge'),
      ).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-11] Konsolenfehler, Konsolenwarnung, Anfrage an einen fremden Port und CSP-Verstoss der Einzeldatei → je roter Test mit Meldung; Schritt rot',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      grueneSpezifikationen(k.root);
      const konsole = ['con', 'sole'].join('');
      writeText(
        k.root,
        'tests/wap-e2e/zz-verstoss.spec.ts',
        [
          KOPF,
          "test('[R-H-11] Konsolenfehler', async ({ wapPage }) => {",
          `  await wapPage.goto(${JSON.stringify(SEITE)});`,
          "  await expect(wapPage.getByText('Grundlauf bereit')).toBeVisible();",
          `  await wapPage.evaluate(() => ${konsole}.error('fiktiver Fehler'));`,
          '});',
          '',
          "test('[R-H-11] Konsolenwarnung', async ({ wapPage }) => {",
          `  await wapPage.goto(${JSON.stringify(SEITE)});`,
          "  await expect(wapPage.getByText('Grundlauf bereit')).toBeVisible();",
          `  await wapPage.evaluate(() => ${konsole}.warn('fiktive Warnung'));`,
          '});',
          '',
          "test('[R-H-11] fremde Anfrage', async ({ wapPage, consoleErrors }) => {",
          `  await wapPage.goto(${JSON.stringify(SEITE)});`,
          "  await expect(wapPage.getByText('Grundlauf bereit')).toBeVisible();",
          "  const meldung = wapPage.waitForEvent('console', { timeout: 3000 }).catch(() => null);",
          "  const r = await wapPage.evaluate(() => fetch('http://127.0.0.1:9/fiktiv').then(() => 'erreicht', () => 'gesperrt'));",
          "  expect(r).toBe('gesperrt');",
          '  await meldung;',
          '  // Erwartete Netzwerk-Meldung des Browsers entfernt der Test selbst (Vertrag E1-01b §2).',
          '  consoleErrors.splice(0);',
          '});',
          '',
        ].join('\n'),
      );
      writeText(
        k.root,
        'tests/wap-e2e/harness/zz-csp.tsx',
        [
          "const root = document.getElementById('root');",
          "const rechnen = new Function('return 2');",
          "if (root !== null) root.textContent = 'CSP-Probe ' + String(rechnen());",
          'export {};',
          '',
        ].join('\n'),
      );
      writeText(
        k.root,
        'tests/wap-e2e/zz-csp.dist.spec.ts',
        [
          KOPF,
          "test('[R-H-11] CSP-Verstoss der Einzeldatei', async ({ wapPage }) => {",
          "  await wapPage.goto(einzeldateiUrl('zz-csp'));",
          "  await expect(wapPage.locator('#root')).toBeAttached();",
          '});',
          '',
        ].join('\n'),
      );
      const { runE2e } = await e2e();
      const r = await runE2e({ cwd: k.root });
      expect(r.ok).toBe(false);
      expect((r.ursache ?? '').length).toBeGreaterThan(0);
      const liste = playwrightTests(join(k.root, 'test-results', 'wap', 'playwright.json'));
      const KONSOLE = 'Konsolenfehler oder -warnungen der Seite';
      for (const [titel, projekt, meldung] of [
        ['[R-H-11] Konsolenfehler', 'edge', KONSOLE],
        ['[R-H-11] Konsolenwarnung', 'edge', KONSOLE],
        ['[R-H-11] fremde Anfrage', 'edge', 'Netzanfrage ausserhalb der App'],
        ['[R-H-11] CSP-Verstoss der Einzeldatei', 'edge-dist', KONSOLE],
      ] as const) {
        const t = eintrag(liste, titel, projekt);
        expect(t.status, titel).toBe('failed');
        expect(t.fehler, titel).toContain(meldung);
      }
      expect(eintrag(liste, '[R-H-11] Grundlauf edge', 'edge').status).toBe('passed');
      expect(eintrag(liste, '[R-H-11] Grundlauf edge-dist', 'edge-dist').status).toBe('passed');
    },
    LANG,
  );
});

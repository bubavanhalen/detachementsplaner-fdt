// Selbsttest-Teil (Test mit Browser, Edge im Klon des Arbeitsstands; Nachtrag-Test N17 nach Code-Review
// Runde 1, CR-E101b-06; R-H-11): wapPage fängt Anfragen ausserhalb der App ab, bevor sie das Gerät verlassen
// (route mit Abbruch, routeWebSocket mit Schliessen), und meldet sie weiterhin («Netzanfrage ausserhalb der
// App: <n>»). Der Empfänger ist ein lokaler Server auf 127.0.0.1 mit einem anderen Port als die App; so entsteht
// auch in der Rot-Phase kein Verkehr ausserhalb des Geräts.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 5 und Nr 8.
// Nur fiktive Seiten und Texte.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  neueSandbox,
  prozessUmgebung,
  writeText,
} from './support/umgebung';
import { e2e } from './support/vertrag';
import { type PwTest, playwrightTests } from './support/vertrag-b';
import { type Empfaenger, empfaenger } from './support/vertrag-b-cr1';

afterEach(aufraeumen);

const SEITE = '/tests/wap-e2e/harness/zz-route.html';

const ROUTE_HTML = [
  '<!doctype html>',
  '<html lang="de-CH">',
  '  <head>',
  '    <meta charset="utf-8" />',
  '    <link rel="icon" href="data:," />',
  '    <title>Routenprobe</title>',
  '  </head>',
  '  <body>',
  '    <h1>Routenprobe bereit</h1>',
  '  </body>',
  '</html>',
  '',
].join('\n');

/** Spezifikation: Kontrolle ohne fremde Anfrage, fetch und WebSocket an die beiden Empfänger. */
function routeSpec(httpPort: number, wsPort: number): string {
  const http = `http://127.0.0.1:${String(httpPort)}/fiktiv`;
  const ws = `ws://127.0.0.1:${String(wsPort)}/fiktiv`;
  return [
    "import { expect, type Page } from '@playwright/test';",
    "import { test } from './support/fixtures';",
    '',
    'async function bereit(page: Page): Promise<void> {',
    `  await page.goto(${JSON.stringify(SEITE)});`,
    "  await expect(page.getByRole('heading', { name: 'Routenprobe bereit' })).toBeVisible();",
    '}',
    '',
    "test('[R-H-11] Routenprobe Kontrolle', async ({ wapPage }) => {",
    '  await bereit(wapPage);',
    '});',
    '',
    "test('[R-H-11] Routenprobe fetch', async ({ wapPage, consoleErrors }) => {",
    '  await bereit(wapPage);',
    "  const meldung = wapPage.waitForEvent('console', { timeout: 3000 }).catch(() => null);",
    '  await wapPage.evaluate(',
    "    (u) => fetch(u).then(() => 'erreicht', () => 'gesperrt'),",
    `    ${JSON.stringify(http)},`,
    '  );',
    '  await meldung;',
    '  // Erwartete Netzwerk-Meldung des Browsers entfernt der Test selbst (Vertrag E1-01b §2).',
    '  consoleErrors.splice(0);',
    '});',
    '',
    "test('[R-H-11] Routenprobe WebSocket', async ({ wapPage, consoleErrors }) => {",
    '  await bereit(wapPage);',
    "  const meldung = wapPage.waitForEvent('console', { timeout: 3000 }).catch(() => null);",
    '  await wapPage.evaluate(',
    '    (u) =>',
    '      new Promise<string>((fertig) => {',
    '        const s = new WebSocket(u);',
    "        s.onopen = () => { s.close(); fertig('offen'); };",
    "        s.onerror = () => fertig('fehler');",
    "        s.onclose = () => fertig('zu');",
    "        setTimeout(() => fertig('zeit'), 3000);",
    '      }),',
    `    ${JSON.stringify(ws)},`,
    '  );',
    '  await meldung;',
    '  consoleErrors.splice(0);',
    '});',
    '',
  ].join('\n');
}

function eintrag(liste: PwTest[], titel: string): PwTest {
  const t = liste.find((x) => x.titel === titel && x.projekt === 'edge');
  expect(t, `${titel} fehlt im Bericht`).toBeDefined();
  return t as PwTest;
}

describe('wapPage: Abfangregeln für fremde Anfragen (N17, Edge im Klon)', () => {
  it(
    '[R-H-11] N17 fetch und WebSocket an einen lokalen Empfänger auf einem anderen Port: der Empfänger zählt 0 Anfragen; Meldung «Netzanfrage ausserhalb der App: 1» (fetch) bzw. ≥ 1 (WebSocket); die App selbst bleibt erreichbar',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      const empf: Empfaenger[] = [];
      try {
        const http = await empfaenger();
        empf.push(http);
        const ws = await empfaenger();
        empf.push(ws);
        writeText(k.root, 'tests/wap-e2e/harness/zz-route.html', ROUTE_HTML);
        writeText(k.root, 'tests/wap-e2e/zz-route.spec.ts', routeSpec(http.port, ws.port));
        const { runE2e } = await e2e();
        const r = await runE2e({ cwd: k.root, project: 'edge' });
        // Erste fachliche Erwartung: nichts hat den Empfänger erreicht.
        expect(http.zaehler(), 'fetch hat den Empfänger erreicht').toEqual({
          verbindungen: 0,
          anfragen: 0,
        });
        expect(ws.zaehler(), 'WebSocket hat den Empfänger erreicht').toEqual({
          verbindungen: 0,
          anfragen: 0,
        });
        expect(r.ok).toBe(false);
        const liste = playwrightTests(join(k.root, 'test-results', 'wap', 'playwright.json'));
        const kontrolle = eintrag(liste, '[R-H-11] Routenprobe Kontrolle');
        expect(kontrolle.status, kontrolle.fehler).toBe('passed');
        const f = eintrag(liste, '[R-H-11] Routenprobe fetch');
        expect(f.status).toBe('failed');
        expect(f.fehler).toMatch(/Netzanfrage ausserhalb der App: 1(?!\d)/);
        const w = eintrag(liste, '[R-H-11] Routenprobe WebSocket');
        expect(w.status).toBe('failed');
        expect(w.fehler).toMatch(/Netzanfrage ausserhalb der App: [1-9]\d*/);
      } finally {
        for (const e of empf) await e.schliessen();
      }
    },
    LANG,
  );
});

// V11-deep, Lizenzblock nur als echtes Element (Nachtrag-Tests nach Code-Review E1-01-28, CR-E101-P01..P03;
// R-H-11, R-H-24): Die Ausnahme vom E-Mail-Muster gilt nur, wenn ein Tokenizer genau ein echtes Element
// <template id="application-licenses"> im echten head/body findet. Vorkommen der Zeichenfolge in Kommentaren,
// Skripten, CDATA, Textareas oder Attributwerten sind nie Ausnahme; Attributwerte werden vor dem Vergleich
// dekodiert (zweites Element mit maskierter ID zählt). Meldungen nennen nur Datei und Muster, nie den Treffer.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md, «Änderungsnotiz E1-01-28» und Orchestrator-Zeilen
// «E1-01-28, Auslegung» sowie «Code-Review E1-01-28, CR-E101-P01..P03»; §2 deepPrivacyScan (Pfad-Modus).
// Fiktive HTML-Dateien in einer Sandbox; E-Mail-Adresse zur Laufzeit gebildet; Sperrliste fiktiv.
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { privacyDeep } from './support/vertrag';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad und der Scan lesen nie die echte Liste.
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

/** Fiktive E-Mail-Adresse eines Paketautors, zur Laufzeit gebildet (nie als Literal im Quelltext). */
function email(): string {
  return ['fiktiv.autor', 'beispiel.invalid'].join('@');
}

/** Lizenztext eines fiktiven npm-Pakets mit Copyright-Zeile (HTML-maskiert wie im Bau). */
function lizenz(kontakt: string): string {
  return [
    'fiktiv-paket',
    'MIT License',
    '',
    `Copyright (c) 2026 Fiktiv Autor &lt;${kontakt}&gt;`,
  ].join('\n');
}

/** Lizenzblock in der Bau-Form. */
const block = (inhalt: string) =>
  `<template id="application-licenses"><pre>${inhalt}</pre></template>`;

/** Einzeldatei in der Form von buildEinzeldatei; `koerper` steht im body nach #root und dem Skript. */
function seite(koerper: string): string {
  return [
    '<!doctype html>',
    '<html lang="de-CH" data-offline="true">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <title>Probe</title>',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    "    <script>(function(){document.title='Probe';})();</script>",
    `    ${koerper}`,
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

const EINZELDATEI = 'test-results/wap/einzeldatei/probe.html';

function repo(sb: Sandbox): string {
  prozessUmgebung(sb);
  return neuesRepo(sb, 'lizenzblock-element');
}

async function scanne(inhalt: string) {
  const sb = neueSandbox();
  const root = repo(sb);
  writeText(root, EINZELDATEI, inhalt);
  const { deepPrivacyScan } = await privacyDeep();
  return deepPrivacyScan({ cwd: root, pfade: [join(root, ...EINZELDATEI.split('/'))] });
}

/** Rot «E-Mail-Adresse» mit Datei, ohne Treffertext in der Meldung. */
function erwarteRotEmail(r: Awaited<ReturnType<typeof scanne>>): void {
  expect(r.ok, 'Scan grün statt rot (Zeichenfolge wurde als Lizenzblock gewertet)').toBe(false);
  const text = schrittText(r);
  expect(text).toContain('probe.html');
  expect(text).toContain('E-Mail-Adresse');
  expect(text.toLowerCase(), 'Treffer in der Meldung').not.toContain(email().toLowerCase());
}

describe('deepPrivacyScan: Lizenzblock nur als echtes Element (CR-E101-P01)', () => {
  it.each([
    ['(a) HTML-Kommentar', () => `<!-- ${block(lizenz(email()))} -->`],
    ['(b) Zeichenkette in <script>', () => `<script>var s='${block(lizenz(email()))}';</script>`],
    ['(c) CDATA-Abschnitt', () => `<svg><![CDATA[${block(lizenz(email()))}]]></svg>`],
    ['(d) <textarea>', () => `<textarea>${block(lizenz(email()))}</textarea>`],
    ['(e) Attributwert', () => `<div title='${block(lizenz(email()))}'></div>`],
  ])(
    '[R-H-11][R-H-24] Seite ohne echten Lizenzblock, Bau-Form samt E-Mail-Adresse in %s → rot «E-Mail-Adresse», ohne Treffer',
    async (_ort, koerper) => {
      erwarteRotEmail(await scanne(seite(koerper())));
    },
  );
});

describe('deepPrivacyScan: echte Lage und dekodierte ID (CR-E101-P02, -P03)', () => {
  it('[R-H-11][R-H-24] (f) Kommentar «<!-- <head> -->» + Block + «<!-- </head> -->» vor <html> → kein Block im echten head/body, rot «E-Mail-Adresse», ohne Treffer', async () => {
    const inhalt = [
      '<!doctype html>',
      `<!-- <head> -->${block(lizenz(email()))}<!-- </head> -->`,
      '<html lang="de-CH"><head><title>Probe</title></head><body><div id="root"></div></body></html>',
      '',
    ].join('\n');
    erwarteRotEmail(await scanne(inhalt));
  });

  it('[R-H-11][R-H-24] (g) echter Lizenzblock mit E-Mail-Adresse und ein zweites Element mit maskierter ID id="application&#45;licenses" (ohne E-Mail) → zwei Elemente, keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    erwarteRotEmail(
      await scanne(
        seite(
          `${block(lizenz(email()))}\n    <template id="application&#45;licenses"><pre>ohne Kontakt</pre></template>`,
        ),
      ),
    );
  });

  it.each([
    ['einem anderen <template>', (b: string) => `<template>${b}</template>`],
    ['einem <div>', (b: string) => `<div class="fiktiv">${b}</div>`],
  ])(
    '[R-H-11][R-H-24] (h) Lizenzblock mit E-Mail-Adresse verschachtelt in %s (nicht direktes Kind von body) → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer',
    async (_huelle, huelle) => {
      erwarteRotEmail(await scanne(seite(huelle(block(lizenz(email()))))));
    },
  );

  it.each([
    ['<script>', (b: string) => `<div class="fiktiv"><script>var s='</div>';</script>${b}</div>`],
    ['<textarea>', (b: string) => `<div class="fiktiv"><textarea></div></textarea>${b}</div>`],
    ['<style>', (b: string) => `<div class="fiktiv"><style>/* </div> */</style>${b}</div>`],
    ['<title>', (b: string) => `<div class="fiktiv"><title></div></title>${b}</div>`],
    ['CDATA', (b: string) => `<div class="fiktiv"><svg><![CDATA[</svg></div>]]></svg>${b}</div>`],
  ])(
    '[R-H-11][R-H-24] (i) Rohtext von %s enthält «</div>»: der folgende Lizenzblock mit E-Mail-Adresse bleibt im <div> verschachtelt → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer (TR-E101-P11)',
    async (_roh, huelle) => {
      erwarteRotEmail(await scanne(seite(huelle(block(lizenz(email()))))));
    },
  );

  it('[R-H-11][R-H-24] Gegenfall: echter Lizenzblock mit E-Mail-Adresse und daneben dieselbe Zeichenfolge in einem Kommentar (ohne E-Mail) → Kommentar zählt nicht, genau ein Element, grün', async () => {
    const r = await scanne(
      seite(`<!-- ${block(lizenz('ohne Kontakt'))} -->\n    ${block(lizenz(email()))}`),
    );
    expect(r.ok, schrittText(r)).toBe(true);
  });
});

// Typen, Lader und Hilfen der Schleusen-Tests von E1-01b (Werkzeug I1: PDF-Auslesung, Bildvergleich,
// Playwright-Grundlauf, Einzeldatei; R-H-11, R-H-19). Neue Hilfen liegen hier, weil vertrag.ts gesperrt ist und
// umgebung.ts nur für TR-E101b-09 entsperrt wurde (Vertrag E1-01b §3). Nur fiktive Daten und selbst erzeugte Test-PDF.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2, §3.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { expect } from 'vitest';
import {
  commitAlles,
  ladeModul,
  neuesRepo,
  nodeModules,
  readText,
  type Sandbox,
  WT,
  writeText,
} from './umgebung';
import type { Schritt } from './vertrag';

/** scripts/wap-gate/einzeldatei.mjs (Vertrag E1-01b §2). */
export interface EinzeldateiModul {
  buildEinzeldatei(opts: {
    cwd: string;
    entry: string;
    outFile: string;
    titel: string;
  }): Promise<Schritt & { module: string[]; bytes: number }>;
  suiteCsp(cwd: string): string;
  /** Freigaberegeln der fertigen Einzeldatei; rein, Befunde (leer = freigegeben). Notiz Runde 2 Nr 6. */
  pruefeEinzeldatei(html: string, csp: string): string[];
}

export type PdfBefundArt = 'schriftgroesse' | 'nicht-eingebettet' | 'nicht-lesbar';

/** scripts/wap-gate/pdf-artefakte.mjs (Vertrag E1-01b §2, Schritt V5-ebene2). */
export interface PdfArtefakteModul {
  checkPdfArtefakte(opts: { cwd: string; ordner?: string; mindestPt?: number }): Promise<
    Schritt & {
      geprueft: number;
      befunde: { datei: string; art: PdfBefundArt; wert: string }[];
    }
  >;
}

/** scripts/wap-gate/lib/temp.mjs (Vertrag E1-01b §2, Befund E1-01-24). */
export interface TempModul {
  eigenerTempOrdner(praefix: string, tmpDir?: string): string;
  raeumeVerwaisteTemp(opts: {
    praefix: string;
    tmpDir?: string;
    lebt?: (pid: number) => boolean;
    jetztMs?: number;
    altMs?: number;
  }): { entfernt: number; behalten: number; fehler: number };
}

export const einzeldateiModul = () =>
  ladeModul<EinzeldateiModul>('scripts/wap-gate/einzeldatei.mjs');
export const pdfArtefakteModul = () =>
  ladeModul<PdfArtefakteModul>('scripts/wap-gate/pdf-artefakte.mjs');
export const tempModul = () => ladeModul<TempModul>('scripts/wap-gate/lib/temp.mjs');

/** Schrift aus pdfjs-dist, die sich vollständig einbetten lässt (nur für Test-PDF). */
export const LIBERATION_TTF = join(
  WT,
  'node_modules',
  'pdfjs-dist',
  'standard_fonts',
  'LiberationSans-Regular.ttf',
);

interface FontkitSchrift {
  ascent: number;
  descent: number;
  unitsPerEm: number;
}

interface FontkitModul {
  create(daten: Uint8Array): FontkitSchrift;
}

/** fontkit 2 ohne eigene Typen; über einen Variablennamen geladen (kein Typimport nötig). */
export async function fontkit(): Promise<FontkitModul> {
  const modulName = 'fontkit';
  const m = (await import(modulName)) as { default?: unknown };
  return (m.default ?? m) as FontkitModul;
}

/** jsdom (ohne eigene Typen in diesem Repo): nur der Konstruktor mit Dokument. */
export type JsdomKlasse = new (
  html: string,
  opts?: { runScripts?: 'dangerously' },
) => { window: { document: Document } };

/** Lädt jsdom über einen Variablennamen (wie fontkit). */
export async function jsdomKlasse(): Promise<JsdomKlasse> {
  const modulName = 'jsdom';
  const m = (await import(modulName)) as { JSDOM?: unknown; default?: { JSDOM?: unknown } };
  return (m.JSDOM ?? m.default?.JSDOM) as JsdomKlasse;
}

/** Oberlänge und Unterlänge der Liberation-Schrift in em, unabhängig vom PDF-Leser aus der Schriftdatei. */
export async function liberationMetrik(): Promise<{ ascent: number; descent: number }> {
  const f = (await fontkit()).create(readFileSync(LIBERATION_TTF));
  return { ascent: f.ascent / f.unitsPerEm, descent: f.descent / f.unitsPerEm };
}

/**
 * Fiktives Test-PDF mit einem Textlauf in `groessePt`: eingebettet (Liberation, ganz eingebettet) oder in der
 * nicht eingebetteten Standardschrift Helvetica. Text ist frei erfunden.
 */
export async function testPdf(opts: {
  groessePt: number;
  eingebettet: boolean;
  text?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
  const font = opts.eingebettet
    ? await doc.embedFont(readFileSync(LIBERATION_TTF), { subset: false })
    : await doc.embedFont(StandardFonts.Helvetica);
  const seite = doc.addPage([300, 200]);
  seite.drawText(opts.text ?? 'Fiktive Probe 0700', {
    x: 20,
    y: 100,
    size: opts.groessePt,
    font,
    color: rgb(0, 0, 0),
  });
  return doc.save({ useObjectStreams: false });
}

/** Ergebnis eines Tests aus einem Playwright-JSON-Bericht. */
export interface PwTest {
  titel: string;
  projekt: string;
  status: string;
  fehler: string;
}

/** Liest einen Playwright-JSON-Bericht (Format des json-Reporters) ohne die Hilfen der Schleuse. */
export function playwrightTests(bericht: string): PwTest[] {
  expect(existsSync(bericht), `Playwright-Bericht fehlt: ${bericht}`).toBe(true);
  const daten = JSON.parse(readFileSync(bericht, 'utf8')) as { suites?: PwSuite[] };
  const out: PwTest[] = [];
  const gehe = (s: PwSuite): void => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const r = (t.results ?? []).at(-1);
        const fehler = [
          ...(r?.errors ?? []).map((e) => e.message ?? ''),
          r?.error?.message ?? '',
        ].join('\n');
        out.push({
          titel: spec.title ?? '',
          projekt: t.projectName ?? '',
          status: r?.status ?? 'ohne Ergebnis',
          fehler,
        });
      }
    }
    for (const k of s.suites ?? []) gehe(k);
  };
  for (const s of daten.suites ?? []) gehe(s);
  return out;
}

interface PwSuite {
  specs?: {
    title?: string;
    tests?: {
      projectName?: string;
      results?: {
        status?: string;
        error?: { message?: string };
        errors?: { message?: string }[];
      }[];
    }[];
  }[];
  suites?: PwSuite[];
}

/** Fiktive App-Lizenz der synthetischen Repos. */
export const FIKTIVE_APP_LIZENZ = 'MIT License\n\nFiktive App-Lizenz für Schleusen-Tests E1-01b.\n';

/** Fiktive CSP der synthetischen tools/build-offline.mjs (Quelle von suiteCsp im synthetischen Repo). */
export const FIKTIVE_CSP_TEILE = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
];

/** Synthetisches tools/build-offline.mjs: nur der CSP-Abschnitt in der Form der Suite. */
export function fiktivesBuildSkript(teile: string[] = FIKTIVE_CSP_TEILE): string {
  return [
    '// Fiktives Build-Skript (Schleusen-Test E1-01b); nur der CSP-Abschnitt.',
    'const vorher = 1;',
    'const csp = [',
    ...teile.map((t) => `  ${JSON.stringify(t)},`),
    "].join('; ');",
    'export { csp, vorher };',
    '',
  ].join('\n');
}

/**
 * Synthetisches Repo für Builds einer Einzeldatei: package.json, LICENSE, tools/build-offline.mjs (fiktive
 * CSP) und ein echtes node_modules mit einer Kopie des kleinen MIT-Pakets `classcat` (keine Verknüpfung:
 * alle gebündelten Module liegen damit innerhalb des Repos). Kein Commit nötig.
 */
export function einzeldateiRepo(sb: Sandbox, name = 'einzeldatei'): string {
  const root = neuesRepo(sb, name);
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-einzeldatei', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
  writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
  cpSync(join(WT, 'node_modules', 'classcat'), join(root, 'node_modules', 'classcat'), {
    recursive: true,
  });
  return root;
}

/** Lizenztext von classcat (Datei im Paket, LF, ohne Leerraum am Rand). */
export function classcatLizenz(root: string): string {
  return normalisiert(readText(root, 'node_modules/classcat/LICENSE.md'));
}

/** CRLF → LF, Leerraum am Zeilenende und am Rand entfernt (Vergleich von Lizenztexten). */
export function normalisiert(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((z) => z.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

/**
 * Synthetisches Repo für runE2e: eigene Playwright-Konfiguration (ohne Browser-Fixtures), node_modules
 * verknüpft (Playwright des Paket-Worktrees), tools/build-offline.mjs und LICENSE für Harness-Builds.
 */
export function e2eRepo(
  sb: Sandbox,
  opts: { konfig?: string | null; mitNodeModules?: boolean; name?: string } = {},
): string {
  const root = neuesRepo(sb, opts.name ?? 'e2e');
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-e2e', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
  writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
  if (opts.konfig !== null) {
    writeText(root, 'playwright.wap.config.ts', opts.konfig ?? PW_KONFIG_JSON);
  }
  if (opts.mitNodeModules !== false) nodeModules(root);
  commitAlles(sb, root, 'E2E-Projekt');
  return root;
}

/** Playwright-Konfiguration des synthetischen Repos: JSON-Bericht wie playwright.wap.config.ts, 1 Worker. */
export const PW_KONFIG_JSON = [
  'export default {',
  "  testDir: 'tests/wap-e2e',",
  "  testMatch: '**/*.spec.ts',",
  '  retries: 0,',
  '  forbidOnly: true,',
  '  workers: 1,',
  "  outputDir: 'test-results/wap/playwright-ausgabe',",
  "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
  "  projects: [{ name: 'edge' }, { name: 'edge-dist' }],",
  '};',
  '',
].join('\n');

/** Dieselbe Konfiguration ohne JSON-Bericht (Reporter «line»). */
export const PW_KONFIG_OHNE_BERICHT = PW_KONFIG_JSON.replace(
  "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
  "  reporter: 'line',",
);

/**
 * Spezifikation, die beim Lauf die Umgebung in `marke` (JSON) schreibt und `gruen` erfüllt oder nicht.
 * Braucht keinen Browser (keine page-Fixture).
 */
export function probeSpec(marke: string, gruen = true): string {
  return [
    "import { writeFileSync } from 'node:fs';",
    "import { expect, test } from '@playwright/test';",
    '',
    "test('[R-1-01] Probe der Umgebung', async ({}, testInfo) => {",
    '  const env = process.env;',
    `  writeFileSync(${JSON.stringify(marke)}, JSON.stringify({`,
    "    port: env.WAP_E2E_PORT ?? '',",
    "    artefakte: env.WAP_PDF_ARTEFAKTE ?? '',",
    '    workers: testInfo.config.workers,',
    '    vitest: Object.keys(env).filter((k) => /^(?:__)?VITEST/i.test(k)),',
    '  }));',
    `  expect(${gruen ? '1' : '2'}).toBe(1);`,
    '});',
    '',
  ].join('\n');
}

/** Liest die Marke einer Probe-Spezifikation; fehlt sie → null. */
export function leseMarke(
  marke: string,
): { port: string; artefakte: string; workers: number; vitest: string[] } | null {
  if (!existsSync(marke)) return null;
  return JSON.parse(readFileSync(marke, 'utf8')) as {
    port: string;
    artefakte: string;
    workers: number;
    vitest: string[];
  };
}

/** Kurzer Harness-Einstieg ohne Importe: hängt sich selbst in #root ein. */
export function harnessEinstieg(text: string): string {
  return [
    "const root = document.getElementById('root');",
    `if (root !== null) root.textContent = ${JSON.stringify(text)};`,
    'export {};',
    '',
  ].join('\n');
}

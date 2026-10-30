// Hilfen der Nachtrag-Tests nach Code-Review Runde 1 von E1-01b (R-H-11, R-H-19): Verweise in der Einzeldatei
// (N1–N12), Läufer runE2e (N13–N15), Vite-Konfiguration der E2E (N16), Abfangregeln von wapPage (N17) und
// gedrehte PDF-Seiten (N18, N19); Lese-Schutz der Einzeldatei (L1–L4). Eigene Datei, weil vertrag.ts,
// vertrag-b.ts und umgebung.ts gesperrt sind.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1, Nr 1–8, und
// «Ergänzung nach Test-Review CR1» Nr 1–3.
// Nur fiktive Dateien und Texte; Empfänger nur auf 127.0.0.1.
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename } from 'node:path';
import { degrees, PDFDocument, PDFName, PDFNumber, rgb } from 'pdf-lib';
import { expect } from 'vitest';
import { ladeModul, type Sandbox } from './umgebung';
import type { Schritt } from './vertrag';
import { fontkit, LIBERATION_TTF } from './vertrag-b';

/** PNG-Signatur: die fiktiven Bilddateien beginnen wie ein PNG, der Rest ist eine Inhaltsmarke. */
const PNG_SIGNATUR = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Fiktive Bild- bzw. Schriftdatei: PNG-Signatur und die Inhaltsmarke `marke` (frei erfunden). */
export function fiktiveDatei(marke: string): Uint8Array {
  return Buffer.concat([PNG_SIGNATUR, Buffer.from(marke, 'utf8')]);
}

/**
 * Erwartet einen roten Bau der Einzeldatei nach Notiz CR1 Nr 8: rot, nichts geschrieben, die Ursache nennt
 * jede der `meldungen`, ohne Inhaltsmarke und ohne absoluten Pfad.
 */
export function erwarteRot(
  r: Schritt & { module: string[] },
  o: { sb: Sandbox; aus: string; meldungen: string[]; marken?: string[] },
): string {
  const ursache = r.ursache ?? '';
  expect(r.ok, `Bau grün statt rot (erwartet: ${o.meldungen.join(' | ')})`).toBe(false);
  for (const m of o.meldungen) expect(ursache, 'Ursache').toContain(m);
  expect(existsSync(o.aus), 'Ausgabe wurde geschrieben').toBe(false);
  expect((r.naechsterSchritt ?? '').trim().length).toBeGreaterThan(0);
  ohneInhaltUndAbsolutenPfad(ursache, o.sb, o.marken ?? []);
  return ursache;
}

/** Die Meldung enthält keine Inhaltsmarke (auch nicht Base64) und keinen absoluten Pfad. */
export function ohneInhaltUndAbsolutenPfad(text: string, sb: Sandbox, marken: string[]): void {
  for (const m of marken) {
    expect(text, 'Inhaltsmarke in der Meldung').not.toContain(m);
    expect(text, 'Inhaltsmarke (Base64) in der Meldung').not.toContain(
      Buffer.from(fiktiveDatei(m)).toString('base64'),
    );
    expect(text, 'Inhaltsmarke (Base64) in der Meldung').not.toContain(
      Buffer.from(m, 'utf8').toString('base64'),
    );
  }
  expect(text, 'absoluter Pfad in der Meldung').not.toMatch(/[A-Za-z]:[\\/]/);
  expect(text, 'Pfad der Sandbox in der Meldung').not.toContain(basename(sb.base));
}

/** Text des Lizenzblocks `<template id="application-licenses">` einer gebauten Einzeldatei (LF, ohne Rand). */
export function lizenzblock(datei: string): string {
  const html = readFileSync(datei, 'utf8');
  const m = /<template\b[^>]*\bid=["']?application-licenses["']?[^>]*>([\s\S]*?)<\/template>/i.exec(
    html,
  );
  expect(m, 'Lizenzblock fehlt').not.toBeNull();
  return entitaeten((m?.[1] ?? '').replace(/<[^>]+>/g, ''))
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((z) => z.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

function entitaeten(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Marke der Umgebungsprobe von runE2e (N14, N15). */
export interface UmgebungsMarke {
  /** Namen aller Variablen mit PW bzw. PLAYWRIGHT am Anfang (Schreibweise wie im Prozess). */
  schluessel: string[];
  browsersPath: string | null;
  viteCache: string | null;
}

/**
 * Playwright-Spezifikation ohne Browser: schreibt die für N14/N15 wichtigen Umgebungsvariablen des
 * Test-Workers als JSON nach `marke`; danach grün bzw. (gruen = false) rot an einer Assertion.
 */
export function umgebungsProbeSpec(marke: string, gruen = true): string {
  return [
    "import { writeFileSync } from 'node:fs';",
    "import { expect, test } from '@playwright/test';",
    '',
    "test('[R-1-01] Probe der Umgebung CR1', async () => {",
    '  const env = process.env;',
    `  writeFileSync(${JSON.stringify(marke)}, JSON.stringify({`,
    '    schluessel: Object.keys(env).filter((k) => /^(?:pw|playwright)/i.test(k)),',
    '    browsersPath: env.PLAYWRIGHT_BROWSERS_PATH ?? null,',
    '    viteCache: env.WAP_VITE_CACHE_DIR ?? null,',
    '  }));',
    `  expect(${gruen ? '1' : '2'}).toBe(1);`,
    '});',
    '',
  ].join('\n');
}

/** Liest die Marke der Umgebungsprobe; fehlt sie → Assertion (die Probe lief nicht). */
export function leseUmgebungsMarke(marke: string): UmgebungsMarke {
  expect(existsSync(marke), 'Probe-Test lief nicht (Marke fehlt)').toBe(true);
  return JSON.parse(readFileSync(marke, 'utf8')) as UmgebungsMarke;
}

/** Lokaler Empfänger auf 127.0.0.1 (anderer Port als die App): zählt Verbindungen, Anfragen und Upgrades. */
export interface Empfaenger {
  port: number;
  /** TCP-Verbindungen, HTTP-Anfragen und WebSocket-Upgrades zusammen. */
  zaehler(): { verbindungen: number; anfragen: number };
  schliessen(): Promise<void>;
}

export async function empfaenger(): Promise<Empfaenger> {
  let verbindungen = 0;
  let anfragen = 0;
  const srv = createServer((_req, res) => {
    anfragen += 1;
    res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('fiktiv');
  });
  srv.on('connection', () => {
    verbindungen += 1;
  });
  srv.on('upgrade', (_req, socket) => {
    anfragen += 1;
    socket.destroy();
  });
  const port = await new Promise<number>((res, rej) => {
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const adr = srv.address();
      res(typeof adr === 'object' && adr !== null ? adr.port : 0);
    });
  });
  expect(port, 'Test-Aufbau: Empfänger ohne Port').toBeGreaterThan(0);
  return {
    port,
    zaehler: () => ({ verbindungen, anfragen }),
    schliessen: () =>
      new Promise<void>((res) => {
        srv.closeAllConnections();
        srv.close(() => res());
      }),
  };
}

/**
 * Fiktives PDF mit eingebetteter Schrift (10 pt), eine Seite je Eintrag von `drehungen` (Grad für /Rotate der
 * Seite; null = ohne /Rotate). `geerbt` setzt /Rotate am Seitenbaum (Pages), nicht an der Seite.
 */
export async function drehPdf(o: {
  drehungen: (number | null)[];
  text: string;
  geerbt?: number;
  textDrehung?: number;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
  const font = await doc.embedFont(readFileSync(LIBERATION_TTF), { subset: false });
  for (const d of o.drehungen) {
    const seite = doc.addPage([300, 200]);
    seite.drawText(o.text, {
      x: 40,
      y: 100,
      size: 10,
      font,
      color: rgb(0, 0, 0),
      ...(o.textDrehung === undefined ? {} : { rotate: degrees(o.textDrehung) }),
    });
    if (d !== null) seite.setRotation(degrees(d));
  }
  if (o.geerbt !== undefined) {
    doc.catalog.Pages().set(PDFName.of('Rotate'), PDFNumber.of(o.geerbt));
  }
  return doc.save({ useObjectStreams: false });
}

/** Optionen von pruefeLesezugriffe (Ergänzung nach Test-Review CR1 Nr 2). */
export interface LesezugriffOptionen {
  cwd: string;
  werkzeugNodeModules: string;
  versioniert: boolean;
}

/** Zulässige Herkunft von data:-URIs (Ergänzung nach Test-Review CR1 Nr 2). */
export interface DataUriZulaessig {
  sha256: ReadonlySet<string>;
  quelltexte: readonly string[];
}

/** Lese-Schutz in scripts/wap-gate/einzeldatei.mjs; heute noch nicht vorhanden (daher optional typisiert). */
interface LeseschutzRoh {
  pruefeLesezugriffe?: unknown;
  pruefeDataUris?: unknown;
}

/**
 * pruefeLesezugriffe aus einzeldatei.mjs. Fehlt die Funktion, scheitert der Test an einer Assertion
 * (typeof-Prüfung, Ergänzung nach Test-Review CR1 Nr 3), nicht an einem Import- oder Aufruffehler.
 */
export async function pruefeLesezugriffeFn(): Promise<
  (pfade: string[], opts: LesezugriffOptionen) => { befunde: string[]; zulaessig: string[] }
> {
  const m = await ladeModul<LeseschutzRoh>('scripts/wap-gate/einzeldatei.mjs');
  expect(typeof m.pruefeLesezugriffe, 'pruefeLesezugriffe fehlt in einzeldatei.mjs').toBe(
    'function',
  );
  return m.pruefeLesezugriffe as (
    pfade: string[],
    opts: LesezugriffOptionen,
  ) => { befunde: string[]; zulaessig: string[] };
}

/** pruefeDataUris aus einzeldatei.mjs; fehlt sie → Assertion (typeof-Prüfung). */
export async function pruefeDataUrisFn(): Promise<
  (text: string, zulaessig: DataUriZulaessig) => string[]
> {
  const m = await ladeModul<LeseschutzRoh>('scripts/wap-gate/einzeldatei.mjs');
  expect(typeof m.pruefeDataUris, 'pruefeDataUris fehlt in einzeldatei.mjs').toBe('function');
  return m.pruefeDataUris as (text: string, zulaessig: DataUriZulaessig) => string[];
}

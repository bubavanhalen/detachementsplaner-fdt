// Kindprozess der Node-Seite der Paritätstests von Paket E1-02f (Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2»
// Abschnitt E «Node-Seite»; wie pdfImKindprozess aus E1-02c). Der Kindprozess lädt
// tests/wap-e2e/parity/support/node-seite.ts im selben Checkout über die Vite-API (ssrLoadModule, ohne Port, mit
// eigenem Cache-Ordner im Temp-Verzeichnis, den der Elternprozess anlegt und auch nach einem Abbruch entfernt), führt einen Auftrag aus und meldet das Ergebnis als
// JSON auf stdout. Grund: Die Schriften kommen über Vite `?inline`, die KVK-Fixture als JSON-Modul. Zeitzone
// wählbar (X8). Keine Ausgabe von Planinhalten in Meldungen.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Auftrag, Daten, PdfSha } from './node-seite';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export type KindErgebnis<T> =
  | ({ readonly ok: true } & { readonly wert: T })
  | { readonly ok: false; readonly fehler: string };

const KIND_CODE = `
import { rmSync } from 'node:fs';
import { createServer } from 'vite';
const text = await new Promise((ok, nein) => {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => ok(s));
  process.stdin.on('error', nein);
});
const auftrag = JSON.parse(text);
const cache = process.env.WAP_E1_02F_KIND_CACHE;
let server;
let aus;
try {
  server = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    cacheDir: cache,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const seite = await server.ssrLoadModule('/tests/wap-e2e/parity/support/node-seite.ts');
  aus = { ok: true, wert: await seite.fuehreAus(auftrag) };
} catch (e) {
  aus = { ok: false, fehler: e instanceof Error ? e.name + ': ' + e.message : String(e) };
} finally {
  if (server !== undefined) await server.close();
  rmSync(cache, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(aus));
`;

/**
 * Startet `node` mit der Zeitzone `tz`, übergibt den Auftrag über stdin und liefert das Ergebnis. Bricht nach
 * 180 s ab (Ergebnis `ok: false`).
 */
export function imKindprozess(
  auftrag: { readonly art: 'daten' },
  tz?: string,
): Promise<KindErgebnis<Daten>>;
export function imKindprozess(
  auftrag: Extract<Auftrag, { art: 'pdfWoche' }>,
  tz?: string,
): Promise<KindErgebnis<PdfSha>>;
export function imKindprozess(
  auftrag: Auftrag,
  tz = 'Europe/Zurich',
): Promise<KindErgebnis<Daten | PdfSha>> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (
      /^(?:VITEST|NODE_OPTIONS$|WAP_PDF_ARTEFAKTE$|TZ$|PW_|PLAYWRIGHT_|WAP_E1_02F_KIND_CACHE$)/i.test(
        k,
      )
    )
      continue;
    env[k] = v;
  }
  env.TZ = tz;
  // Cache-Ordner legt der Elternprozess an und entfernt ihn auch, wenn der Kindprozess abbricht (TR-E102f-08).
  const cache = mkdtempSync(join(tmpdir(), 'wap-e1-02f-kind-'));
  env.WAP_E1_02F_KIND_CACHE = cache;
  const aufraeumen = () => rmSync(cache, { recursive: true, force: true });
  return new Promise((ok) => {
    const kind = spawn(process.execPath, ['--input-type=module', '-e', KIND_CODE], {
      cwd: WURZEL,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let aus = '';
    let err = '';
    const uhr = setTimeout(() => {
      kind.kill();
    }, 180_000);
    kind.stdout.setEncoding('utf8');
    kind.stderr.setEncoding('utf8');
    kind.stdout.on('data', (d: string) => {
      aus += d;
    });
    kind.stderr.on('data', (d: string) => {
      err += d;
    });
    kind.on('error', (e) => {
      clearTimeout(uhr);
      aufraeumen();
      ok({ ok: false, fehler: `Kindprozess nicht gestartet: ${e.message}` });
    });
    kind.on('close', (code) => {
      clearTimeout(uhr);
      aufraeumen();
      try {
        ok(JSON.parse(aus) as KindErgebnis<Daten | PdfSha>);
      } catch {
        const zeile = err.trim().split(/\r?\n/).at(-1) ?? '';
        ok({ ok: false, fehler: `Kindprozess ohne Ergebnis (Exit ${String(code)}): ${zeile}` });
      }
    });
    kind.stdin.end(JSON.stringify(auftrag));
  });
}

let daten: Promise<Daten> | undefined;

/**
 * Pläne und Sollwerte der Node-Seite, einmal je Worker (Playwright lädt die Testdatei je Worker einmal). Scheitert
 * der Kindprozess, lehnt das Promise mit der Meldung ab (ohne Planinhalte).
 */
export function nodeDaten(): Promise<Daten> {
  daten ??= imKindprozess({ art: 'daten' }).then((r) => {
    if (!r.ok) throw new Error(`Node-Seite: ${r.fehler}`);
    return r.wert;
  });
  return daten;
}

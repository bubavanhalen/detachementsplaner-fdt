// Erzeugt ein PDF mit writePdf in einem eigenen Node-Prozess (Paket E1-02c, R-L-01; Vertrag E1-02c §2.3 Nr 7,
// §5 und P-14: «die Node-Seite rechnet im selben Checkout ohne eingefrorenen Hash (z.B. Vite ssrLoadModule
// oder Kindprozess)»). Der Kindprozess lädt den Schreiber über die Vite-API (ssrLoadModule, ohne Port, mit
// eigenem Cache-Ordner im Temp-Verzeichnis, danach entfernt) und meldet SHA-256, Bytes, Zeitzone und
// Zeitzonenversatz als JSON auf stdout. Verwendet von Vitest (Integration) und Playwright (Node-Seite).
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeiteJson } from '../../../pdf/writer/support/seite-json';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
// Zeichenkette statt URL-Objekt: unter jsdom ist URL die Klasse von jsdom, die fileURLToPath nicht annimmt.
export const WURZEL = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
);

export type KindErgebnis =
  | {
      readonly ok: true;
      readonly sha256: string;
      readonly base64: string;
      readonly zeitzone: string;
      /** Date#getTimezoneOffset am 15.01.2026 1200 UTC (Minuten). */
      readonly versatzJanuar: number;
    }
  | { readonly ok: false; readonly fehler: string };

const KIND_CODE = `
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const text = await new Promise((ok, nein) => {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => ok(s));
  process.stdin.on('error', nein);
});
const eingabe = JSON.parse(text);
const cache = mkdtempSync(join(tmpdir(), 'wap-e1-02c-kind-'));
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
  const json = await server.ssrLoadModule('/tests/wap/pdf/writer/support/seite-json.ts');
  const schreiber = await server.ssrLoadModule('/src/io/wap-pdf/writer.ts');
  const bytes = await schreiber.writePdf({ pages: eingabe.seiten.map(json.ausJson), title: eingabe.title });
  aus = {
    ok: true,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    base64: Buffer.from(bytes).toString('base64'),
    zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    versatzJanuar: new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset(),
  };
} catch (e) {
  aus = { ok: false, fehler: e instanceof Error ? e.name + ': ' + e.message : String(e) };
} finally {
  if (server !== undefined) await server.close();
  rmSync(cache, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(aus));
`;

/**
 * Startet `node` mit der Zeitzone `tz`, übergibt Seiten und Titel über stdin und liefert das Ergebnis.
 * Bricht nach 90 s ab (Ergebnis `ok: false`).
 */
export function pdfImKindprozess(
  seiten: readonly SeiteJson[],
  title: string,
  tz: string,
): Promise<KindErgebnis> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (/^(?:VITEST|NODE_OPTIONS$|WAP_PDF_ARTEFAKTE$|TZ$)/i.test(k)) continue;
    env[k] = v;
  }
  env.TZ = tz;
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
    }, 90_000);
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
      ok({ ok: false, fehler: `Kindprozess nicht gestartet: ${e.message}` });
    });
    kind.on('close', (code) => {
      clearTimeout(uhr);
      try {
        ok(JSON.parse(aus) as KindErgebnis);
      } catch {
        const zeile = err.trim().split(/\r?\n/).at(-1) ?? '';
        ok({ ok: false, fehler: `Kindprozess ohne Ergebnis (Exit ${String(code)}): ${zeile}` });
      }
    });
    kind.stdin.end(JSON.stringify({ seiten, title }));
  });
}

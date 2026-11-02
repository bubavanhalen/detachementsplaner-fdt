// Hülle des Vite-Entwicklungsservers der WAP-E2E (Paket E1-01b, R-H-11; ADR-010 §3.4).
// Aufruf: node scripts/wap-gate/lib/vite-server.mjs --config <datei> --port <p> --strictPort --host 127.0.0.1
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Stabilität (05.10.2026, architect)» Nr 1,
// 2 und 4. Kein Prozess der E2E-Kette fragt einen Port ab, der geschlossen sein könnte: Die Hülle startet Vite
// über die JS-API und meldet die Bereitschaft per IPC ({ bereit: true, port }). Sie endet auf die IPC-Nachricht
// «ende», bei «disconnect» (Elternprozess weg, keine Waisen) sowie bei SIGINT und SIGTERM: server.close(), dann
// Exit 0. Startfehler: Exit 1 und eine Zeile auf stderr ohne Pfade und ohne Meldungstext.
// Ohne IPC (Rückfall: Playwright startet die Hülle selbst als webServer) läuft sie, bis sie beendet wird.
import { resolve } from 'node:path';

/** Frist für server.close() nach Wegfall des Elternprozesses bzw. einem Signal (danach Exit ohne Warten). */
const FRIST_OHNE_ELTERN_MS = 5_000;

/**
 * Wert einer Option `--name <wert>`; null, wenn sie fehlt.
 * @param {string[]} args
 * @param {string} name
 * @returns {string | null}
 */
function wert(args, name) {
  const i = args.indexOf(name);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v === undefined || v.startsWith('--') ? null : v;
}

/**
 * Startfehler: eine Zeile auf stderr (nur Art und Code des Fehlers, keine Pfade), Exit 1.
 * @param {string} grund
 * @returns {never}
 */
function startfehler(grund) {
  process.stderr.write(`Vite-Server nicht gestartet: ${grund}\n`);
  process.exit(1);
}

/**
 * Art eines Fehlers ohne Meldungstext (der Pfade oder Inhalte enthalten kann).
 * @param {unknown} e
 * @returns {string}
 */
function fehlerArt(e) {
  if (!(e instanceof Error)) return 'unbekannter Fehler';
  const name = /^[A-Za-z]+$/.test(e.name) ? e.name : 'Error';
  const code = /** @type {{ code?: unknown }} */ (e).code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? `${name} (${code})` : name;
}

const args = process.argv.slice(2);
const konfig = wert(args, '--config');
const portText = wert(args, '--port') ?? '';
const host = wert(args, '--host') ?? '127.0.0.1';
const port = /^\d+$/.test(portText) ? Number(portText) : Number.NaN;
if (konfig === null || !Number.isInteger(port) || port <= 0 || port > 65_535) {
  startfehler('Aufruf ohne --config <datei> bzw. gültigen --port <p>');
}

/** @type {import('vite').ViteDevServer | null} */
let server = null;
let endet = false;

/**
 * Beendet die Hülle: server.close(), dann Exit 0. Mit `frist` endet sie spätestens danach (Elternprozess weg
 * bzw. Signal); ohne Frist wartet sie auf server.close() (IPC «ende»; den Rückfall übernimmt runE2e).
 * @param {number | null} frist
 */
function beende(frist) {
  if (endet) return;
  endet = true;
  if (frist !== null) setTimeout(() => process.exit(0), frist);
  const s = server;
  if (s === null) process.exit(0);
  s.close().then(
    () => process.exit(0),
    () => process.exit(0),
  );
}

process.on('message', (m) => {
  if (m === 'ende') beende(null);
});
process.on('disconnect', () => beende(FRIST_OHNE_ELTERN_MS));
process.on('SIGINT', () => beende(FRIST_OHNE_ELTERN_MS));
process.on('SIGTERM', () => beende(FRIST_OHNE_ELTERN_MS));

try {
  const { createServer } = await import('vite');
  const s = await createServer({
    configFile: resolve(/** @type {string} */ (konfig)),
    logLevel: 'silent',
    clearScreen: false,
    // CS-I5-B3-KONSOLE-01 (F-TOOLS, Koordinator 20.10.2026): ohne HMR; @vitejs/plugin-react schaltet damit React
    // Fast Refresh ab (kein /@react-refresh, kein $RefreshSig$-Vorspann, kein HMR-WebSocket). Unter Last brach
    // sonst die Anfrage /@react-refresh ab (net::ERR_NO_BUFFER_SPACE) mit «$RefreshSig$ is not defined».
    server: { port, strictPort: true, host, hmr: false },
  });
  server = s;
  if (endet) {
    // «ende» bzw. Wegfall des Elternprozesses kam während des Starts.
    await s.close().catch(() => undefined);
    process.exit(0);
  }
  await s.listen();
  const adresse = s.httpServer?.address();
  const tatsaechlich = typeof adresse === 'object' && adresse !== null ? adresse.port : port;
  if (!endet && typeof process.send === 'function' && process.connected) {
    process.send({ bereit: true, port: tatsaechlich });
  }
} catch (e) {
  startfehler(fehlerArt(e));
}

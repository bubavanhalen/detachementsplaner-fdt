// F7-worker (R-H-37; Q-021, Gate S S-5; FINDINGS E1-07-03; Paket F-TOOLS Runde 2): Die aufgelöste
// Suite-Konfiguration vitest.config.ts begrenzt die Vitest-Worker auf höchstens 4 (maxWorkers 4). Geladen wird die
// Konfiguration wie von Vitest selbst (vite.loadConfigFromFile, Funktion oder Objekt); fehlt die Begrenzung oder
// ist sie grösser, ist der Schritt rot.
// Aufruf: node scripts/wap-gate/suite-worker.mjs [--root <dir>] [--datei <konfig>]
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ok, rot } from './lib/out.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

/** Vorgesehene Workerzahl der Suite (Q-021). */
export const SUITE_WORKER = 4;

/**
 * @param {{ cwd: string; datei?: string }} opts datei: repo-relativ oder absolut (Standard vitest.config.ts)
 * @returns {Promise<Schritt>}
 */
export async function checkSuiteWorker(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const datei = resolve(root, opts.datei ?? 'vitest.config.ts');
  /** @param {string} ursache @returns {Schritt} */
  const rotSchritt = (ursache) => ({
    id: 'F7-worker',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt: `in vitest.config.ts test.maxWorkers: ${String(SUITE_WORKER)} setzen (Q-021, R-H-37)`,
  });
  if (!existsSync(datei)) return rotSchritt('Suite-Konfiguration vitest.config.ts fehlt');
  /** @type {unknown} */
  let wert;
  try {
    const vite =
      /** @type {{ loadConfigFromFile: (e: Record<string, unknown>, f: string, r: string, l: string) => Promise<{ config: Record<string, unknown> } | null> }} */ (
        await import(
          pathToFileURL(join(root, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href
        )
      );
    const geladen = await vite.loadConfigFromFile(
      { command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false },
      datei,
      root,
      'silent',
    );
    const test = /** @type {Record<string, unknown> | undefined} */ (geladen?.config.test);
    wert = test?.maxWorkers;
  } catch {
    return rotSchritt('Suite-Konfiguration vitest.config.ts nicht ladbar');
  }
  if (wert !== SUITE_WORKER) {
    return rotSchritt(
      `Suite-Konfiguration ohne Begrenzung der Worker (maxWorkers ${wert === undefined ? 'fehlt' : String(wert)}, erwartet ${String(SUITE_WORKER)})`,
    );
  }
  return { id: 'F7-worker', ok: true, ms: Date.now() - beginn };
}

// CLI
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const datei = wert('--datei');
  const s = await checkSuiteWorker({
    cwd: wert('--root') ?? '.',
    ...(datei === undefined ? {} : { datei }),
  });
  if (s.ok) ok(s.id, s.ms);
  else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
  process.exitCode = s.ok ? 0 : 1;
}

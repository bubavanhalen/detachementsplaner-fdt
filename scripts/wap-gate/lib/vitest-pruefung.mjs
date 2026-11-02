// Gemeinsame Prüfungen der globalSetup-Dateien aller WAP-Vitest-Konfigurationen (Paket E1-01, R-H-27,
// R-H-18; ADR-010 Änderungsnotiz AE-001 §2): Node-Version (F1) und feste Workerzahl.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkNode } from '../node-check.mjs';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
export const SKRIPT_WURZEL = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

/**
 * Wirft, wenn die Node-Version nicht zu engines.node bzw. .nvmrc der Wurzel passt.
 * @param {string} [nodeVersion]
 * @param {string} [wurzel]
 * @returns {void}
 */
export function pruefeNode(nodeVersion, wurzel = SKRIPT_WURZEL) {
  const s = checkNode({
    packageJson: join(wurzel, 'package.json'),
    nvmrc: join(wurzel, '.nvmrc'),
    ...(nodeVersion === undefined ? {} : { version: nodeVersion }),
  });
  if (!s.ok) {
    throw new Error(
      `${s.ursache ?? 'Node-Prüfung rot'}. Nächster Schritt: ${s.naechsterSchritt ?? ''}`,
    );
  }
}

/**
 * Wirft, wenn VITEST_MAX_WORKERS gesetzt ist und von maxWorkers abweicht (AE-001 §2).
 * @param {Record<string, string | undefined>} env
 * @param {number | undefined} maxWorkers
 * @returns {void}
 */
export function pruefeWorker(env, maxWorkers) {
  const wert = env.VITEST_MAX_WORKERS;
  if (wert === undefined || wert === '') return;
  if (Number(wert) !== maxWorkers) {
    throw new Error(
      `VITEST_MAX_WORKERS=${wert} weicht von maxWorkers ${String(maxWorkers)} dieser Konfiguration ab. ` +
        `Nächster Schritt: mit VITEST_MAX_WORKERS=${String(maxWorkers)} starten (agent-regeln 5).`,
    );
  }
}

/**
 * Vorgesehene Workerzahl der Konfiguration. Vitest 5.0.1 überschreibt das aufgelöste maxWorkers mit
 * VITEST_MAX_WORKERS; deshalb gibt jede WAP-Konfiguration den Wert zusätzlich über
 * `provide.wapMaxWorkers` weiter.
 * @param {{ config: { maxWorkers?: number; provide?: Record<string, unknown> } }} project
 * @returns {number | undefined}
 */
export function vorgeseheneWorker(project) {
  const p = project.config.provide?.wapMaxWorkers;
  return typeof p === 'number' ? p : project.config.maxWorkers;
}

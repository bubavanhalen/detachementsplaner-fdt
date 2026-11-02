// globalSetup der WAP-Vitest-Konfigurationen vitest.wap.config.ts und vitest.wap-gate.config.ts (Paket
// E1-01, R-H-27, R-H-18; Vertrag E1-01 §3, Änderungsnotiz AE-001 §2): Node-Prüfung (F-001) und feste
// Workerzahl. Ohne Sperre: diese Läufe sind keine Belegläufe (ADR-010 Änderungsnotiz AE-001 §2).
import { pruefeNode, pruefeWorker, vorgeseheneWorker } from './lib/vitest-pruefung.mjs';

/**
 * Vitest-globalSetup: wirft bei falscher Node-Version oder abweichendem VITEST_MAX_WORKERS.
 * @param {{ config: { maxWorkers?: number; provide?: Record<string, unknown> } }} project
 * @returns {Promise<void>}
 */
export default async function setup(project) {
  pruefeNode();
  pruefeWorker(process.env, vorgeseheneWorker(project));
}

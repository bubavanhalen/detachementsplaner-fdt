// globalSetup von vitest.wap-golden.config.ts (R-H-20, R-H-27, R-H-18; ADR-010 §7.3; Paket F-TOOLS): Node-Prüfung,
// feste Workerzahl und Render-Kette (Teil «pdf» von tests/wap/golden/render-chain.json). Eine Abweichung der
// Kette bricht den Lauf mit «Render-Kette geändert: …» ab (Grund, nicht Pixelfehler).
import { KETTE_GEAENDERT, kettenAbweichungen } from './golden.mjs';
import {
  pruefeNode,
  pruefeWorker,
  SKRIPT_WURZEL,
  vorgeseheneWorker,
} from './lib/vitest-pruefung.mjs';

/**
 * @param {{ config: { root?: string; maxWorkers?: number; provide?: Record<string, unknown> } }} project
 * @returns {Promise<void>}
 */
export default async function setup(project) {
  pruefeNode();
  pruefeWorker(process.env, vorgeseheneWorker(project));
  const ab = kettenAbweichungen({ root: project.config.root ?? SKRIPT_WURZEL });
  if (ab.length > 0) {
    throw new Error(
      `${KETTE_GEAENDERT}${ab.join('; ')}. Nächster Schritt: Versionen gemäss tests/wap/golden/render-chain.json herstellen (npm ci) oder die Kette mit neuen Baselines per lock-update nachführen (eigener Commit, Gate B)`,
    );
  }
}

// Vite-Konfiguration des Entwicklungsservers der WAP-E2E-Tests (Paket E1-01b, R-H-11; CR-E101b-03).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 2.
// Übernimmt vite.config.ts der Suite (Objekt oder Funktion) und setzt nur cacheDir auf WAP_VITE_CACHE_DIR:
// Jeder E2E-Lauf hat so einen eigenen Cache unter test-results/wap/vite-cache/ statt des gemeinsamen
// node_modules/.vite (bei Klonen mit verknüpftem node_modules von allen Läufen geteilt). Die Variable setzt
// scripts/wap-gate/e2e.mjs (npm run wap:test:e2e); fehlt sie, bricht das Laden mit Hinweis ab.
// CS-I5-B3-KONSOLE-01 (F-TOOLS, Koordinator 20.10.2026): HMR und damit React Fast Refresh sind in den E2E-Läufen
// aus; gesetzt in der Server-Hülle scripts/wap-gate/lib/vite-server.mjs (createServer mit server.hmr = false), damit
// diese Datei weiterhin genau die Einstellungen der Suite übernimmt (Test vite-e2e-config.gate.ts, N16).
import { type ConfigEnv, mergeConfig, type UserConfig, type UserConfigExport } from 'vite';
import suite from '../../../vite.config';

/** Löst eine Vite-Konfiguration in jeder zulässigen Form auf (Objekt, Promise oder Funktion). */
async function aufgeloest(konfig: UserConfigExport, umgebung: ConfigEnv): Promise<UserConfig> {
  return typeof konfig === 'function' ? await konfig(umgebung) : await konfig;
}

export default async (umgebung: ConfigEnv): Promise<UserConfig> => {
  const cacheDir = process.env.WAP_VITE_CACHE_DIR ?? '';
  if (cacheDir === '') {
    throw new Error('WAP_VITE_CACHE_DIR fehlt: E2E nur über npm run wap:test:e2e');
  }
  return mergeConfig(await aufgeloest(suite, umgebung), { cacheDir });
};

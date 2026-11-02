// Vitest-Konfiguration für Stryker (V8, R-H-17, ADR-010 §6.3; Paket F-TOOLS): vitest.wap.config.ts unverändert,
// ohne Tests, die die Zeitzone im laufenden Prozess umstellen. Der Stryker-Läufer erzwingt den Pool «threads»;
// dort wirkt process.env.TZ nicht je Test (Zeitzone ist prozessweit), der Test wäre im Trockenlauf falsch rot.
// Ausgenommen ist nur tests/wap/integration/pdf-writer/determinismus.test.ts (PDF-Schreiber, nicht in der
// Mutations-Pfadmenge); er läuft unverändert in F8/V1, die Zeitzonen prüft zusätzlich V1-zeitzonen.
import { defineConfig, mergeConfig } from 'vitest/config';
import basis from './vitest.wap.config';

export default mergeConfig(
  basis,
  defineConfig({
    test: {
      exclude: ['**/node_modules/**', 'tests/wap/integration/pdf-writer/determinismus.test.ts'],
    },
  }),
);

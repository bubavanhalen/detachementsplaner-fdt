// Vitest-Konfiguration der Golden-Tests Ebene 3 (R-H-20, ADR-010 §3.2 V5, §7.3; Paket F-TOOLS, Auftraggeber
// 19.10.2026 «7: ja»). Aufruf: VITEST_MAX_WORKERS=4 npx vitest run -c vitest.wap-golden.config.ts
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 («include tests/wap/golden/**/*.golden.ts; globalSetup prüft
// Render-Kette»). Der globalSetup prüft Node-Version, feste Workerzahl und die Render-Kette (Teil «pdf» von
// tests/wap/golden/render-chain.json); bei Abweichung bricht der Lauf mit «Render-Kette geändert» ab, bevor
// ein Bild verglichen wird (kein Pixelfehler). JSON-Bericht für V9.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/wap/golden/**/*.golden.ts'],
    setupFiles: [],
    globalSetup: ['./scripts/wap-gate/vitest-golden-setup.mjs'],
    retry: 0,
    maxWorkers: 4,
    provide: { wapMaxWorkers: 4 },
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/wap/vitest-golden.json' },
    testTimeout: 180_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    clearMocks: true,
  },
});

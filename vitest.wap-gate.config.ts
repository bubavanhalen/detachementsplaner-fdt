// Vitest-Konfiguration der Schleusen-Tests (Paket E1-01, ADR-010 §3.2 V1a, §4.5; Testart
// Integration-Gate). Aufruf: npm run wap:test:gate bzw.
// VITEST_MAX_WORKERS=4 npx vitest run -c vitest.wap-gate.config.ts
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 und Änderungsnotiz AE-001 §2: globalSetup mit
// Node-Prüfung (R-H-27) und Prüfung der festen Workerzahl (4, R-H-18), JSON-Bericht für V9.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/wap-gate/**/*.gate.ts'],
    setupFiles: [],
    globalSetup: ['./scripts/wap-gate/vitest-node-setup.mjs'],
    retry: 0,
    maxWorkers: 4,
    provide: { wapMaxWorkers: 4 },
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/wap/vitest-gate.json' },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    clearMocks: true,
  },
});

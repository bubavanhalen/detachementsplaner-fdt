// Eigene Vitest-Konfiguration für die Harness-Tests des WAP-Planers (Paket H0, P11).
// Aufruf: npx vitest run -c vitest.wap-harness.config.ts
// Node-Umgebung ohne setupFiles der Suite; die Suite-Konfiguration vitest.config.ts nimmt
// *.harness.ts nicht auf (R-H-08). Die Tests setzen Windows voraus (P2).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/wap-harness/**/*.harness.ts'],
    setupFiles: [],
    // Einzelne Tests setzen eigene, längere Zeitlimits (Worktree- und Merge-Abläufe).
    testTimeout: 60_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    clearMocks: true,
  },
});

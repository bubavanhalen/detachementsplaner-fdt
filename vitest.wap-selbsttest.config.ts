// Vitest-Konfiguration des Selbsttest-Teils der Schleusen-Tests (Paket E1-01, ADR-010 §3.2 V1a und
// Änderungsnotiz AE-001; Testart Integration-Gate). Aufruf (Beleglauf, nur nach Vorgabe des Orchestrators):
// VITEST_MAX_WORKERS=1 npx vitest run -c vitest.wap-selbsttest.config.ts
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §9 Nr 17 und Änderungsnotiz AE-001 §2, §4 Nr 5, 8.
// Die Tests führen ganze Schleusen in Klonen aus; deshalb läuft immer nur eine Datei (fileParallelism:
// false, maxWorkers: 1). VITEST_MAX_WORKERS übersteuert fileParallelism (Spike architect-r9); die Schleuse
// setzt die Variable für diesen Schritt deshalb auf 1. Der globalSetup scripts/wap-gate/vitest-setup.mjs
// prüft Node-Version und VITEST_MAX_WORKERS (gesetzt und ≠ 1 → Abbruch), belegt die Sperre
// <git-common-dir>/wap-gate/sperre.json, prüft auf fremde Last (F0-last) und setzt WAP_GATE_SPERRE für
// die Worker; in der vollen Schleuse läuft er geschachtelt. provide.wapMaxWorkers trägt die vorgesehene
// Workerzahl, weil Vitest 5.0.1 das aufgelöste maxWorkers mit VITEST_MAX_WORKERS überschreibt.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/wap-gate/**/*.selbsttest.ts'],
    setupFiles: [],
    globalSetup: ['./scripts/wap-gate/vitest-setup.mjs'],
    retry: 0,
    fileParallelism: false,
    maxWorkers: 1,
    provide: { wapMaxWorkers: 1 },
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/wap/vitest-selbsttest.json' },
    testTimeout: 3_600_000,
    hookTimeout: 3_600_000,
    restoreMocks: true,
    clearMocks: true,
  },
});

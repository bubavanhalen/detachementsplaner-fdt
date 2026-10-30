// Vitest-Konfiguration der WAP-Tests der Arten Unit, Property, Integration ohne Referenz und PDF
// (Paket E1-01, ADR-010 §3.1 F8, §3.2 V1, §4.5). Aufruf: npm run wap:test bzw.
// VITEST_MAX_WORKERS=4 npx vitest run -c vitest.wap.config.ts
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 und Änderungsnotiz AE-001 §2. Umgebung wie im
// Suite-Lauf (vitest.config.ts: React-Plugin, jsdom); jede WAP-Testdatei nennt ihre Umgebung in der
// Kopfzeile (ADR-010 §4.1). Die Suite-Hilfen aus tests/setup.ts gelten in jsdom-Dateien
// (tests/wap/support/common/vitest-setup.ts).
// Abdeckung (V2, R-H-16, ADR-010 §6.1/§6.2; Paket F-TOOLS): V8, nur eingeschaltet mit --coverage.enabled=true
// (scripts/wap-gate/coverage-check.mjs); gemessen werden alle Dateien der Pfadmengen aus der gesperrten
// Schwellendatei scripts/wap-gate/coverage-schwellen.json, auch ungetestete.
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const schwellen = JSON.parse(
  readFileSync(new URL('./scripts/wap-gate/coverage-schwellen.json', import.meta.url), 'utf8'),
) as { mengen: { muster: string[] }[] };

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/wap/**/*.test.ts'],
    setupFiles: ['./tests/wap/support/common/vitest-setup.ts'],
    globalSetup: ['./scripts/wap-gate/vitest-node-setup.mjs'],
    retry: 0,
    maxWorkers: 4,
    provide: { wapMaxWorkers: 4 },
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/wap/vitest.json' },
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      enabled: false,
      provider: 'v8',
      include: schwellen.mengen.flatMap((m) => m.muster),
      reporter: ['json', 'json-summary'],
      reportsDirectory: 'test-results/wap/coverage/vitest',
      reportOnFailure: true,
      clean: true,
    },
  },
});

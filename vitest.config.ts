import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    // WAP-Planer-Tests laufen mit eigener Konfiguration (npm run wap:test, vitest.wap.config.ts): sie nennen ihre
    // Umgebung je Datei, und tests/setup.ts setzt jsdom voraus.
    exclude: [...configDefaults.exclude, 'tests/wap/**'],
    setupFiles: ['./tests/setup.ts'],
    // Höchstens 4 Worker (Q-021, Gate S S-5; R-H-37): ohne Begrenzung startet Vitest auf 20 logischen Kernen
    // 19 Worker, und Tests laufen unter Last in die Zeitgrenze (FINDINGS E1-07-03).
    maxWorkers: 4,
    restoreMocks: true,
    clearMocks: true,
  },
});

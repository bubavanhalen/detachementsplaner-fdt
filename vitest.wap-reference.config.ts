// Vitest-Konfiguration der Referenztests test:reference (Paket E1-01, ADR-010 §3.2 V3, §4.5; Prompt §5.6).
// Aufruf: npm run test:reference mit WAP_REFERENCE_DIR auf den lokalen Ordner reference/; fehlt eine in
// tests/wap/reference/required-files.json genannte Datei, scheitert der Lauf im globalSetup (nie «skip»).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1, §3 und Änderungsnotiz AE-001 §2, §4 Nr 6.
// Referenztests laufen nie im Suite-Lauf (ADR-010 §4.5); ohne die jsdom-Hilfen aus tests/setup.ts, jede
// Datei nennt ihre Umgebung in der Kopfzeile.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/wap/reference/**/*.ref.ts'],
    setupFiles: [],
    globalSetup: ['./scripts/wap-gate/vitest-reference-setup.mjs'],
    retry: 0,
    maxWorkers: 4,
    provide: { wapMaxWorkers: 4 },
    // Kein JSON-Bericht im Worktree: Meldungstexte von Referenztests könnten echte Zellinhalte enthalten.
    // V3 der Schleuse schreibt den Rohbericht in einen temporären Ordner und legt nur einen bereinigten
    // Bericht unter test-results/wap/vitest-reference.json ab (E1-01-22).
    reporters: ['default'],
    testTimeout: 60_000,
    restoreMocks: true,
    clearMocks: true,
  },
});

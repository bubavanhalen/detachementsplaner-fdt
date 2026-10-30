// Stryker-Konfiguration der WAP-Mutationstests (R-H-17, Prompt §7, ADR-010 §6.3; Paket F-TOOLS, Auftraggeber
// 19.10.2026 «7: ja»). Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 und Änderungsnotiz AE-001 §2.
// Pfadmenge: Fachlogik, Layout-Schicht, Prüfregeln, Beso-Nummerierung (src/model/wap/**, ohne Typdateien) und
// Formtext-Zerlegung (src/io/wap-import/formtext/**, src/io/wap-import/agenda-text/**). Schwelle break 80.
// Aufruf: npm run wap:test:mutation (ganze Pfadmenge, je Bereich) bzw. in der vollen Schleuse V8 inkrementell mit
// --mutate <geänderte Dateien>. Berichte unter test-results/wap/stryker/ (nicht versioniert).
// Abweichungen vom Vertrag (Befund FT-M-01, Paketseite F-TOOLS):
// - Läufer «vitest-wap» (scripts/wap-gate/stryker-vitest-wap.mjs) statt «vitest»: der Vitest-Läufer 10.0.0 wählt
//   mit Vitest 5 je Mutant 0 Tests (Namensfilter « » statt « > », «related» ohne transitive Importe); «vitest-wap»
//   führt je Mutant alle Testdateien mit abdeckenden Tests aus (Obermenge); related aus.
// - Vitest-Konfiguration vitest.wap-stryker.config.ts = vitest.wap.config.ts ohne den Zeitzonentest des
//   PDF-Schreibers, der im vom Läufer erzwungenen Pool «threads» nicht lauffähig ist.
// - disableTypeChecks aus (Vitest prüft keine Typen; «// @ts-nocheck» verfälschte den Vergleich der generierten
//   Metrik-Tabelle), ignoreStatic an (statische Mutanten verlangen je Mutant alle 2228 Tests; Anzahl im Bericht
//   unter «übrige»), Trockenlauf bis 40 min.
// Eigenständig (keine Importe), damit Selbsttests die Datei in ein temporäres Repo kopieren können.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest-wap',
  vitest: { configFile: 'vitest.wap-stryker.config.ts', related: false },
  plugins: ['@stryker-mutator/vitest-runner', './scripts/wap-gate/stryker-vitest-wap.mjs'],
  mutate: [
    'src/model/wap/**/*.ts',
    '!src/model/wap/**/types.ts',
    '!src/model/wap/**/*.d.ts',
    '!src/model/wap/layout/text/metrics.generated.ts',
    'src/io/wap-import/formtext/**/*.ts',
    'src/io/wap-import/agenda-text/**/*.ts',
  ],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  thresholds: { high: 90, low: 80, break: 80 },
  incremental: true,
  incrementalFile: 'test-results/wap/stryker/incremental.json',
  concurrency: 4,
  reporters: ['clear-text', 'progress', 'json', 'html'],
  jsonReporter: { fileName: 'test-results/wap/stryker/mutation.json' },
  htmlReporter: { fileName: 'test-results/wap/stryker/mutation.html' },
  // Sandbox ausserhalb von test-results/wap: abgebrochene Läufe hinterlassen dort keine Repo-Kopien im Scanpfad
  // von V11-deep (F-TOOLS Runde 2).
  tempDirName: 'test-results/stryker-tmp',
  ignorePatterns: ['/dist', '/test-results', '/spikes', '/.claude'],
  cleanTempDir: 'always',
  timeoutMS: 10_000,
  dryRunTimeoutMinutes: 40,
  disableTypeChecks: false,
  // TypeScript 7 (nativ) hat keine JS-Schnittstelle; Strykers tsconfig-Umschreibung (ts.parseConfigFileTextToJson)
  // scheitert daran. Die Sandbox liegt im Repo und braucht keine Umschreibung der tsconfig-Verweise: Verweis auf
  // eine nicht vorhandene Datei schaltet den Schritt ab (Vitest-Läufer und Instrumenter brauchen sie nicht).
  tsconfigFile: 'test-results/wap/stryker/keine-tsconfig.json',
};

export default config;

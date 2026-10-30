// Stryker-Testläufer «vitest-wap» (R-H-17, ADR-010 §6.3; Paket F-TOOLS, Auftraggeber 19.10.2026 «7: ja»).
// Grund (Befund FT-M-01): @stryker-mutator/vitest-runner 10.0.0 filtert je Mutant über einen Namensausdruck aus
// den mit Leerzeichen verbundenen Test- und Gruppennamen; Vitest 5 vergleicht ihn mit fullTestName, dessen Teile
// mit « > » verbunden sind (vitest/dist/task-utils.js createTaskName). Jeder Test in einer describe-Gruppe wird
// dadurch übersprungen, der Mutant gilt fälschlich als «überlebt» (Probe: 0,00 Tests je Mutant). Zusätzlich
// schneidet «related» die Testauswahl auf direkt verwandte Dateien zu und verliert Tests, die das Modul über
// einen Index einbinden.
// Dieser Läufer erbt den Vitest-Läufer unverändert und ersetzt nur die Auswahl je Mutant: statt Namensfilter
// laufen alle Testdateien, die mindestens einen abdeckenden Test enthalten (Obermenge der abdeckenden Tests;
// keine Lockerung, nur mehr Laufzeit). Ohne Testauswahl (statische Mutanten) bleibt das Verhalten des Läufers.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  commonTokens,
  declareFactoryPlugin,
  PluginKind,
  tokens,
} from '@stryker-mutator/api/plugin';

const require = createRequire(import.meta.url);
const paket = dirname(require.resolve('@stryker-mutator/vitest-runner/package.json'));
const { VitestTestRunner } =
  /** @type {{ VitestTestRunner: new (...a: unknown[]) => { run(o?: { testIds?: string[]; relatedFiles?: string[]; testFiles?: string[] }): Promise<unknown> } }} */ (
    await import(pathToFileURL(join(paket, 'dist', 'src', 'vitest-test-runner.js')).href)
  );
const { INSTRUMENTER_CONSTANTS } =
  /** @type {{ INSTRUMENTER_CONSTANTS: { NAMESPACE: string } }} */ (
    await import('@stryker-mutator/api/core')
  );

/** Vitest-Läufer mit Dateiauswahl statt Namensfilter je Mutant. */
class WapVitestTestRunner extends VitestTestRunner {
  /**
   * @param {{ testIds?: string[]; relatedFiles?: string[]; testFiles?: string[] }} [o]
   * @returns {Promise<unknown>}
   * @override
   */
  async run(o = {}) {
    if (o.testIds !== undefined && o.testIds.length > 0) {
      const dateien = [...new Set(o.testIds.map((id) => id.split('#')[0] ?? ''))].filter(
        (d) => d !== '',
      );
      return super.run({
        ...(o.relatedFiles ? { relatedFiles: o.relatedFiles } : {}),
        testFiles: dateien,
      });
    }
    return super.run(o);
  }
}

/**
 * Fabrik wie createVitestTestRunnerFactory des Pakets (globalNamespace des Instrumenters).
 * @param {{ provideValue(n: string, v: unknown): { injectClass(c: unknown): unknown } }} injector
 * @returns {unknown}
 */
function erzeuge(injector) {
  return injector
    .provideValue('globalNamespace', INSTRUMENTER_CONSTANTS.NAMESPACE)
    .injectClass(WapVitestTestRunner);
}
erzeuge.inject = tokens(commonTokens.injector);

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.TestRunner,
    'vitest-wap',
    /** @type {Parameters<typeof declareFactoryPlugin<PluginKind.TestRunner, ['$injector']>>[2]} */ (
      /** @type {unknown} */ (erzeuge)
    ),
  ),
];

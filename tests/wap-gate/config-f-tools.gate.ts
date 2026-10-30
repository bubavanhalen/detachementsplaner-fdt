// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Statische Prüfung der Konfigurationen der Pflichtwerkzeuge (Vertrag E1-01 §3, ADR-010 §3.4, §6, §7.3):
// vitest.wap-golden.config.ts ([R-H-20][R-H-18][R-H-27]), stryker.wap.conf.mjs ([R-H-17][R-H-18]), Abdeckung in
// vitest.wap.config.ts und gesperrte Schwellen ([R-H-16]).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WT } from './support/umgebung';

async function ladeKonfig(rel: string): Promise<Record<string, unknown>> {
  const datei = join(WT, rel);
  expect(existsSync(datei), `Konfiguration fehlt: ${rel}`).toBe(true);
  const mod = (await import(pathToFileURL(datei).href)) as { default: unknown };
  const roh =
    typeof mod.default === 'function' ? await (mod.default as () => unknown)() : mod.default;
  return roh as Record<string, unknown>;
}

function test(konfig: Record<string, unknown>): Record<string, unknown> {
  return (konfig.test ?? {}) as Record<string, unknown>;
}

describe('vitest.wap-golden.config.ts', () => {
  it('[R-H-20][R-H-18][R-H-27] include tests/wap/golden/**/*.golden.ts, retry 0, maxWorkers 4, globalSetup mit Render-Kette, JSON-Bericht für V9', async () => {
    const k = await ladeKonfig('vitest.wap-golden.config.ts');
    expect(test(k).include).toEqual(['tests/wap/golden/**/*.golden.ts']);
    expect(test(k).retry ?? 0).toBe(0);
    expect(test(k).maxWorkers).toBe(4);
    expect(test(k).globalSetup).toEqual(['./scripts/wap-gate/vitest-golden-setup.mjs']);
    expect(test(k).outputFile).toEqual({ json: 'test-results/wap/vitest-golden.json' });
  });
});

describe('stryker.wap.conf.mjs', () => {
  it('[R-H-17][R-H-18] Läufer vitest-wap (Befund FT-M-01) auf vitest.wap-stryker.config.ts ohne related, Schwelle break 80, inkrementell, concurrency 4, Pfadmenge nach ADR-010 §6.3, Berichte unter test-results/wap/stryker/', async () => {
    const k = await ladeKonfig('stryker.wap.conf.mjs');
    expect(k.testRunner).toBe('vitest-wap');
    expect(k.plugins).toEqual([
      '@stryker-mutator/vitest-runner',
      './scripts/wap-gate/stryker-vitest-wap.mjs',
    ]);
    expect(k.vitest).toEqual({ configFile: 'vitest.wap-stryker.config.ts', related: false });
    expect(k.coverageAnalysis).toBe('perTest');
    const thresholds = k.thresholds as Record<string, number>;
    expect(thresholds.break).toBe(80);
    expect(thresholds.low).toBe(80);
    expect(k.incremental).toBe(true);
    expect(k.concurrency).toBe(4);
    expect(k.mutate).toEqual(
      expect.arrayContaining([
        'src/model/wap/**/*.ts',
        '!src/model/wap/**/types.ts',
        'src/io/wap-import/formtext/**/*.ts',
        'src/io/wap-import/agenda-text/**/*.ts',
      ]),
    );
    expect(String((k.jsonReporter as Record<string, unknown>).fileName)).toMatch(
      /^test-results\/wap\/stryker\//,
    );
  });
});

describe('vitest.wap-stryker.config.ts', () => {
  it('[R-H-17][R-H-18] gleich vitest.wap.config.ts (include, Umgebung, retry 0, Setup) und nur der Zeitzonentest des PDF-Schreibers ausgenommen', async () => {
    const s = test(await ladeKonfig('vitest.wap-stryker.config.ts'));
    const w = test(await ladeKonfig('vitest.wap.config.ts'));
    for (const feld of [
      'include',
      'environment',
      'setupFiles',
      'globalSetup',
      'retry',
      'maxWorkers',
    ]) {
      expect(s[feld], feld).toEqual(w[feld]);
    }
    expect(s.exclude).toEqual([
      '**/node_modules/**',
      'tests/wap/integration/pdf-writer/determinismus.test.ts',
    ]);
  });
});

describe('Abdeckung (V2)', () => {
  it('[R-H-16][R-H-18] vitest.wap.config.ts: V8-Abdeckung nur auf Anforderung, alle Muster der gesperrten Schwellen, Bericht unter test-results/wap/coverage/vitest', async () => {
    const k = await ladeKonfig('vitest.wap.config.ts');
    const c = test(k).coverage as Record<string, unknown>;
    expect(c.enabled).toBe(false);
    expect(c.provider).toBe('v8');
    expect(c.reportsDirectory).toBe('test-results/wap/coverage/vitest');
    expect(c.reporter).toEqual(expect.arrayContaining(['json']));
    const schwellen = JSON.parse(
      readFileSync(join(WT, 'scripts', 'wap-gate', 'coverage-schwellen.json'), 'utf8'),
    ) as { mengen: { name: string; muster: string[]; zweige: number }[] };
    expect(c.include).toEqual(schwellen.mengen.flatMap((m) => m.muster));
  });

  it('[R-H-16] Schwellen nach Prompt §7 / ADR-010 §6.2: Fachlogik, Layout, Prüfregeln, Import 90 %, übriger WAP-Code 75 %, je Modul; tools/wap nach Gate-B-Entscheid 34c ausserhalb', () => {
    const s = JSON.parse(
      readFileSync(join(WT, 'scripts', 'wap-gate', 'coverage-schwellen.json'), 'utf8'),
    ) as {
      mengen: { name: string; muster: string[]; zweige: number }[];
      jeModul: boolean;
      ausnahmen: string[];
    };
    expect(s.jeModul).toBe(true);
    expect(s.mengen.map((m) => [m.name, m.zweige])).toEqual([
      ['fachlogik', 90],
      ['uebrig', 75],
    ]);
    expect(s.mengen[0]?.muster).toEqual([
      'src/model/wap/**',
      'src/io/wap-import/**',
      'src/io/xlsx-drawing/**',
    ]);
    expect(s.mengen[1]?.muster).toEqual([
      'src/io/wap-plan/**',
      'src/io/wap-pdf/**',
      'src/io/wap-persons/**',
      'src/components/wap/**',
      'src/pages/WapPage.tsx',
      'src/assets/wap-fonts/**',
    ]);
    // Gate B 28.10.2026, Entscheid 34c: tools/wap/** (Bauwerkzeug) nicht mehr in «übriger WAP-Code»; Begründung und
    // Entscheid-Verweis stehen in der Schwellendatei.
    expect(s.mengen[1]?.muster).not.toContain('tools/wap/**');
    expect((s.mengen[1] as { entscheid?: string } | undefined)?.entscheid ?? '').toContain(
      'Gate B 28.10.2026, Entscheid 34c',
    );
    expect(s.ausnahmen).toEqual([
      '**/types.ts',
      '**/*.d.ts',
      'src/model/wap/layout/text/metrics.generated.ts',
    ]);
  });
});

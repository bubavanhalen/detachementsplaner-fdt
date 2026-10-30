// Schnelle Schleuse (ADR-010 §3.1): ein Befehl; F1–F10 in Reihenfolge; ohne Verstoss grün; je Schritt
// ein eingebauter Verstoss rot mit dem richtigen Grund; Node- und Lock-Prüfung brechen sofort ab;
// --pre-commit mit F0-arbeitsbaum ohne F2/Datenschutz-Scan; Ausgabeformat lib/out.mjs.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1, §2 (runGate, ok, rot).
// Läufe in einem Klon des aktuellen Arbeitsstands (eigenes Repo, keine Hooks), Sperren wie nach dem
// Merge von E1-01 (lock-update --add für scripts/wap-gate/** und die Test-Hilfen, ADR-010 §2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aufraeumen, KURZ, neueSandbox, node, WT, writeText } from './support/umgebung';

afterEach(aufraeumen);

describe('package.json: schnelle Schleuse als ein Befehl', () => {
  it('[R-H-10] Skripte wap:gate:fast und wap:gate:selftest gemäss Vertrag §1', () => {
    const pkg = JSON.parse(readFileSync(join(WT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['wap:gate:fast']).toBe('node scripts/wap-gate/gate.mjs fast');
    expect(pkg.scripts?.['wap:gate:selftest']).toBe('node scripts/wap-gate/selftest.mjs');
    expect(pkg.scripts?.['wap:gate:stability']).toBe('node scripts/wap-gate/stability.mjs');
  });

  it('[R-H-10][R-H-15][R-H-34] Skripte von E1-01-min gemäss Vertrag §1: wap:gate:full, wap:test, wap:test:gate', () => {
    const pkg = JSON.parse(readFileSync(join(WT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['wap:gate:full']).toBe('node scripts/wap-gate/gate.mjs full');
    expect(pkg.scripts?.['wap:test']).toBe('vitest run -c vitest.wap.config.ts');
    expect(pkg.scripts?.['wap:test:gate']).toBe('vitest run -c vitest.wap-gate.config.ts');
  });
});

describe('lib/out.mjs', () => {
  it(
    '[R-H-10] ok() meldet «OK <schritt> (<ms> ms)», rot() «ROT <schritt>: <ursache>. Nächster Schritt: <hinweis>»',
    () => {
      const sb = neueSandbox();
      const out = join(WT, 'scripts', 'wap-gate', 'lib', 'out.mjs').replace(/\\/g, '/');
      const skript = writeText(
        sb.base,
        'probe-out.mjs',
        [
          `import { ok, rot } from 'file:///${out}';`,
          "ok('F1-node', 12);",
          "rot('F4-muster', 'Verbotenes Muster in src/model/wap/a.ts', 'Muster entfernen');",
          '',
        ].join('\n'),
      );
      const r = node(skript, [], { cwd: sb.base, env: sb.env });
      expect(r.status).toBe(0);
      expect(r.out).toContain('OK F1-node (12 ms)');
      expect(r.out).toContain(
        'ROT F4-muster: Verbotenes Muster in src/model/wap/a.ts. Nächster Schritt: Muster entfernen',
      );
    },
    KURZ,
  );
});

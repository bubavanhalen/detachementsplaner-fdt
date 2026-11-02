// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Node-Prüfung der Golden-Konfiguration (R-H-27, ADR-010 §10 «Node-Versionsprüfung»): ein Einzelaufruf von
// vitest.wap-golden.config.ts unter Node 22 bricht im globalSetup mit Hinweis auf 24.15.0 ab.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  writeText,
} from './support/umgebung';

afterEach(aufraeumen);

function node22(): string {
  const p = join(
    process.env.APPDATA ?? 'C:\\Users\\phili\\AppData\\Roaming',
    'nvm',
    'v22.19.0',
    'node.exe',
  );
  expect(existsSync(p), `Node 22 für den Selbsttest fehlt: ${p}`).toBe(true);
  return p;
}

describe('Selbsttest mit Node 22: spätere Konfigurationen brechen ab', () => {
  it(
    '[R-H-20][R-H-27] vitest.wap-golden.config.ts unter Node 22 → Abbruch mit Hinweis (E1-01d)',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      writeText(
        k.root,
        'tests/wap/golden/zz-node-probe.golden.ts',
        "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-H-20] probe', () => {\n  expect(1).toBe(1);\n});\n",
      );
      const r = lauf(
        node22(),
        [
          join(k.root, 'node_modules', 'vitest', 'vitest.mjs'),
          'run',
          '-c',
          'vitest.wap-golden.config.ts',
          'tests/wap/golden/zz-node-probe.golden.ts',
        ],
        { cwd: k.root, env: { ...sb.env, VITEST_MAX_WORKERS: '4' }, timeout: MITTEL },
      );
      expect(r.status).not.toBe(0);
      expect(r.out).toContain('24.15.0');
    },
    MITTEL,
  );
});

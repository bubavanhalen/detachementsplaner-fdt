// Positivpfad des Default-Exports `setup` von scripts/wap-gate/vitest-setup.mjs (TR-E101-12; Vertrag E1-01,
// Änderungsnotiz AE-001 §2 und §4 Nr 5, 8). Der Aufruf läuft in einem Kindprozess aus einer Kopie von
// scripts/wap-gate/ in einem temporären Mini-Repo (cwd = dessen Wurzel, ohne WAP_GATE_SPERRE): Die Sperre
// entsteht nur unter <Mini-Repo>/.git/wap-gate, nie im gemeinsamen Git-Verzeichnis. F0-last nutzt hier die
// echte Prozessquelle; deshalb gehört der Test zum Selbsttest-Teil (ein Worker, Vertrag §9 Nr 17).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setupImKind } from './support/last';
import { aufraeumen, LANG, neueSandbox } from './support/umgebung';
import { ENV_WERT } from './support/vertrag';

afterEach(aufraeumen);

describe('setup (Default-Export) im temporären Repo', () => {
  it(
    '[R-H-18][R-H-27] VITEST_MAX_WORKERS = 1 = project.config.maxWorkers → Sperre unter <Mini-Repo>/.git/wap-gate belegt, WAP_GATE_SPERRE = <Pfad>#<Token> gesetzt, Teardown gibt sie frei',
    () => {
      const sb = neueSandbox();
      const { r, root } = setupImKind(sb, { maxWorkers: 1, vitestMaxWorkers: '1' });
      if (r.fehler !== undefined && /^nicht implementiert: /.test(r.fehler)) {
        throw new Error(r.fehler);
      }
      expect(r.fehler, 'setup warf').toBeUndefined();
      expect(r.ok).toBe(true);
      const m = ENV_WERT.exec(r.envWert ?? '');
      expect(m, 'WAP_GATE_SPERRE nicht in der Form <Pfad>#<Token>').not.toBeNull();
      expect(m?.groups?.pfad?.toLowerCase()).toBe(
        join(root, '.git', 'wap-gate', 'sperre.json').toLowerCase(),
      );
      expect(r.sperreWaehrend).toBe(true);
      expect(r.sperreDanach).toBe(false);
      expect(existsSync(join(root, '.git', 'wap-gate', 'sperre.json'))).toBe(false);
    },
    LANG,
  );
});

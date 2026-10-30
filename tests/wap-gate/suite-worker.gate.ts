// Paket F-TOOLS Runde 2 (Koordinator 20.10.2026, SA-2-03): R-H-37 (Q-021, Gate S S-5; FINDINGS E1-07-03).
// Statischer Gate-Test: die aufgelöste Suite-Konfiguration vitest.config.ts hat maxWorkers 4 (F7-worker, als
// Vitest-Konfiguration geladen); eine Kopie ohne Begrenzung bzw. mit mehr Workern ist rot; vitest.config.ts steht
// in der freigegebenen Liste (R-H-30).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aufraeumen, junction, ladeModul, neueSandbox, WT, writeText } from './support/umgebung';
import type { Schritt } from './support/vertrag';

afterEach(aufraeumen);

const modul = () =>
  ladeModul<{ checkSuiteWorker(o: { cwd: string; datei?: string }): Promise<Schritt> }>(
    'scripts/wap-gate/suite-worker.mjs',
  );

describe('F7-worker (R-H-37)', () => {
  it('[R-H-37] aufgelöste vitest.config.ts des Pakets begrenzt auf maxWorkers 4 → grün; die Datei steht in der freigegebenen Liste', async () => {
    const { checkSuiteWorker } = await modul();
    const s = await checkSuiteWorker({ cwd: WT });
    expect(s.ok, s.ursache).toBe(true);
    const liste = JSON.parse(
      readFileSync(join(WT, 'scripts', 'wap-gate', 'suite-allowlist.json'), 'utf8'),
    ) as { dateien: string[] };
    expect(liste.dateien).toContain('vitest.config.ts');
  });

  it.each([
    ['ohne Begrenzung', (t: string) => t.replace(/\n\s*maxWorkers: 4,/, '')],
    ['mit 8 Workern', (t: string) => t.replace('maxWorkers: 4,', 'maxWorkers: 8,')],
  ])(
    '[R-H-37] Selbsttest: Kopie der Suite-Konfiguration %s → rot mit Ursache und nächstem Schritt',
    async (_fall, aendern) => {
      const { checkSuiteWorker } = await modul();
      const sb = neueSandbox();
      const original = readFileSync(join(WT, 'vitest.config.ts'), 'utf8');
      const kopie = aendern(original);
      expect(kopie).not.toBe(original);
      writeText(sb.base, 'vitest.config.ts', kopie);
      junction(join(sb.base, 'node_modules'), join(WT, 'node_modules'));
      const s = await checkSuiteWorker({ cwd: sb.base });
      expect(s.ok).toBe(false);
      expect(s.ursache ?? '').toContain('Begrenzung der Worker');
      expect(s.naechsterSchritt ?? '').toContain('maxWorkers: 4');
    },
  );

  it('[R-H-37] fehlende Suite-Konfiguration → rot', async () => {
    const { checkSuiteWorker } = await modul();
    const sb = neueSandbox();
    const s = await checkSuiteWorker({ cwd: sb.base, datei: 'gibt-es-nicht.config.ts' });
    expect(s.ok).toBe(false);
  });
});

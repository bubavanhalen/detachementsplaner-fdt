// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17; TR-E101b-02, Entscheid zu Einwand 10): ganze volle Schleuse im
// synthetischen Mini-Repo. V3 räumt beim Start verwaiste `wap-v3-*`-Ordner auf (Befund E1-01-24; R-H-11, R-H-24).
// Fall unverändert aus temp.gate.ts verschoben. TEMP und TMP zeigen auf die Sandbox; nie auf den echten
// temporären Ordner. Der direkte Aufruf von runGate speist `last` ein und entfernt WAP_GATE_SPERRE (AE-001 §2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (E1-01-24).
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testLast, totePid } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  git,
  LANG,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { gate } from './support/vertrag';

afterEach(aufraeumen);

/** Temporärer Ordner der Sandbox als TEMP/TMP des Testprozesses. */
function tempAufSandbox(sb: Sandbox): string {
  const t = join(sb.base, 'temp');
  mkdirSync(t, { recursive: true });
  vi.stubEnv('TEMP', t);
  vi.stubEnv('TMP', t);
  expect(tmpdir(), 'Test-Aufbau: os.tmpdir() folgt TEMP').toBe(t);
  return t;
}

function ordner(tmp: string, name: string): string {
  const p = join(tmp, name);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'roh.json'), '{}\n');
  return p;
}

function prefixOrdner(tmp: string, praefix: string): string[] {
  return readdirSync(tmp)
    .filter((n) => n.startsWith(praefix) && statSync(join(tmp, n)).isDirectory())
    .sort();
}

describe('V3 der vollen Schleuse räumt verwaiste wap-v3-* auf (E1-01-24)', () => {
  it(
    '[R-H-11][R-H-24] runGate full im Mini-Repo, TEMP auf die Sandbox: verwaister Ordner entfernt, Ordner einer lebenden PID behalten, details.verwaistEntfernt 1, kein eigener wap-v3-Ordner bleibt',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      writeText(
        root,
        'vitest.wap-reference.config.ts',
        "export default { test: { include: ['tests/wap/reference/**/*.ref.ts'], environment: 'node', retry: 0 } };\n",
      );
      writeText(
        root,
        'tests/wap/reference/required-files.json',
        `${JSON.stringify({ version: 1, dateien: ['anhaenge/zz-mini-fiktiv.csv'] }, null, 2)}\n`,
      );
      nodeModules(root);
      commitAlles(sb, root, 'Referenz-Konfiguration');
      const t = tempAufSandbox(sb);
      const verwaist = ordner(t, `wap-v3-${String(totePid())}-verwst`);
      const lebend = ordner(t, `wap-v3-${String(process.pid)}-lebend`);
      const vorher = prefixOrdner(t, 'wap-v3-');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v3 = e.schritte.find((s) => /^V3(?![0-9a-z])/i.test(s.id));
      expect(v3, 'Schritt V3 fehlt').toBeDefined();
      expect(existsSync(verwaist), 'verwaister Ordner noch vorhanden').toBe(false);
      expect(existsSync(lebend)).toBe(true);
      const details = (v3?.details ?? {}) as { verwaistEntfernt?: unknown };
      expect(details.verwaistEntfernt, schrittText(v3 ?? {})).toBe(1);
      expect(prefixOrdner(t, 'wap-v3-')).toEqual(vorher.filter((n) => join(t, n) !== verwaist));
    },
    LANG,
  );
});

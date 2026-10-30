// Selbsttest der Schleusen, Aufrufschnittstelle (Vertrag E1-01 §1, §9 Nr 13): unbekannter --nur-Name
// → Exit 1 mit der Liste der gültigen Namen, ohne dass ein Verstoss gebaut wird. Die Läufe mit
// eingebauten Verstössen stehen in selftest.selbsttest.ts (§9 Nr 17).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { miniRepo } from './support/mini';
import { aufraeumen, KURZ, neueSandbox, node, WT } from './support/umgebung';

afterEach(aufraeumen);

/**
 * Gültige --nur-Namen von E1-01-min (Vertrag §9 Nr 13 und Änderungsnotiz AE-001 §1: ohne Lizenz-,
 * Browser- und Leistungsbezug; Z-lizenztext kommt mit E1-01e).
 */
const NAMEN = [
  'S1',
  'S2',
  'S3a',
  'S3b',
  'S4',
  'S5',
  'Z-only',
  'Z-console',
  'Z-any',
  'Z-biome-ignore',
  'Z-suite-datei',
  'Z-referenz-fehlt',
  'Z-fremde-id',
  'Z-ungesperrt',
  'Z-name-v11',
  'Z-python2',
];

describe('selftest.mjs als CLI', () => {
  it(
    '[R-H-31] --nur mit unbekanntem Namen → Exit 1, Ausgabe nennt alle gültigen Namen; geprüft vor F1, F0-sperre und F0-last: kein Ordner .git/wap-gate im Aufrufverzeichnis (§4 Nr 8, temporäres Repo)',
    () => {
      const sb = neueSandbox();
      const mini = miniRepo(sb);
      const env: NodeJS.ProcessEnv = { ...sb.env };
      delete env.WAP_GATE_SPERRE;
      const r = node(
        join(WT, 'scripts', 'wap-gate', 'selftest.mjs'),
        ['--nur', 'Z-gibt-es-nicht'],
        { cwd: mini, env, timeout: KURZ },
      );
      expect(r.status).toBe(1);
      for (const n of NAMEN) expect(r.out, n).toContain(n);
      expect(existsSync(join(mini, '.git', 'wap-gate'))).toBe(false);
    },
    KURZ,
  );
});

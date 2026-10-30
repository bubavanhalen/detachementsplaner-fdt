// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Fälle unverändert aus reference-lock.gate.ts verschoben,
// weil sie die ganze schnelle Schleuse im Mini-Repo ausführen (ADR-010 §7.1, R-14-03). Direkte Aufrufe
// von runGate mit `last` (temporäres commonDir, keine fremden Prozesse), Vertrag E1-01 AE-001 §2.
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  LANG,
  neueSandbox,
  node,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { gate, schrittMit } from './support/vertrag';

afterEach(aufraeumen);

const ANHANG_A = 'Woche;Tag;Eintrag\n1;Mo;Fiktiver Eintrag A\n';
const ANHANG_B = 'Mass;Wert\nRand;10\n';
const REF_LOCK = 'docs/wap-planer/reference-lock.json';

/** Referenzordner mit zwei fiktiven bestätigten Anhängen und passender reference-lock.json im Repo. */
function aufbau(sb: Sandbox): { root: string; ref: string } {
  prozessUmgebung(sb);
  const ref = sb.referenceDir;
  writeText(ref, 'anhaenge/anhang-a-kp.csv', ANHANG_A);
  writeText(ref, 'anhaenge/anhang-b-kp.csv', ANHANG_B);
  const root = miniRepo(sb);
  writeText(
    root,
    'docs/wap-planer/reference-lock.json',
    `${JSON.stringify(
      {
        version: 1,
        files: {
          'anhaenge/anhang-a-kp.csv': sha256Lf(ANHANG_A),
          'anhaenge/anhang-b-kp.csv': sha256Lf(ANHANG_B),
        },
      },
      null,
      2,
    )}\n`,
  );
  commitAlles(sb, root, 'Referenz-Sperre');
  return { root, ref };
}

describe('Schleuse: Änderung an einem bestätigten Anhang bricht die Lock-Prüfung (F2)', () => {
  it(
    '[R-14-03][R-H-10] geänderter Anhang → F2 rot und sofortiger Abbruch; unverändert → F2 grün',
    async () => {
      const sb = neueSandbox();
      const { root, ref } = aufbau(sb);
      vi.stubEnv('WAP_REFERENCE_DIR', ref);
      const { runGate } = await gate();
      const gut = await runGate('fast', { cwd: root, last: testLast(sb, { name: 'gut' }).last });
      const f2gut = gut.schritte.filter((x) => /^F2(?![0-9a-z])/i.test(x.id));
      expect(f2gut.length).toBeGreaterThan(0);
      expect(f2gut.every((x) => x.ok)).toBe(true);
      writeText(ref, 'anhaenge/anhang-a-kp.csv', `${ANHANG_A}2;Di;geändert\n`);
      const schlecht = await runGate('fast', {
        cwd: root,
        last: testLast(sb, { name: 'schlecht' }).last,
      });
      expect(schlecht.ok).toBe(false);
      const rot = schlecht.schritte.filter((x) => /^F2(?![0-9a-z])/i.test(x.id) && !x.ok);
      expect(rot.length).toBeGreaterThan(0);
      expect(rot.map((x) => schrittText(x)).join(' ')).toContain('anhang-a-kp.csv');
      expect(schlecht.schritte.at(-1)?.id).toMatch(/^F2(?![0-9a-z])/i);
      expect(schrittMit(schlecht, 'F3')).toBeUndefined();
    },
    LANG,
  );
});

describe('reference-lock.json gesperrt (Vertrag AE-001 §4 Nr 9, TR-E101-06)', () => {
  /** Wie nach dem Merge von E1-01-min: reference-lock.json per lock-update --add gesperrt (Protokollzeile). */
  function gesperrt(sb: Sandbox): { root: string; ref: string } {
    const a = aufbau(sb);
    const r = node(
      join(a.root, 'scripts', 'wap', 'lock-update.mjs'),
      ['--grund', 'Testaufbau: Sperre wie nach dem Merge', '--add', REF_LOCK],
      { cwd: a.root, env: sb.env },
    );
    if (r.status !== 0) throw new Error(`Test-Aufbau: lock-update scheiterte: ${r.out}`);
    commitAlles(sb, a.root, 'reference-lock.json gesperrt');
    return a;
  }

  /** Anhang A geändert und reference-lock.json gemeinsam nachgeführt (ohne lock-update). */
  function gemeinsamNachgefuehrt(root: string, ref: string): void {
    const neu = `${ANHANG_A}2;Di;Aus dem Import ergänzt\n`;
    writeText(ref, 'anhaenge/anhang-a-kp.csv', neu);
    writeText(
      root,
      REF_LOCK,
      `${JSON.stringify(
        {
          version: 1,
          files: {
            'anhaenge/anhang-a-kp.csv': sha256Lf(neu),
            'anhaenge/anhang-b-kp.csv': sha256Lf(ANHANG_B),
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  it(
    '[R-14-03][R-H-10] Anhang und reference-lock.json gemeinsam nachgeführt, ohne lock-update → F2 rot mit reference-lock.json, sofortiger Abbruch',
    async () => {
      const sb = neueSandbox();
      const { root, ref } = gesperrt(sb);
      vi.stubEnv('WAP_REFERENCE_DIR', ref);
      gemeinsamNachgefuehrt(root, ref);
      commitAlles(sb, root, 'Anhang und Sperre nachgeführt');
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: testLast(sb).last });
      expect(e.ok).toBe(false);
      const rot = e.schritte.filter((x) => /^F2(?![0-9a-z])/i.test(x.id) && !x.ok);
      expect(rot.length).toBeGreaterThan(0);
      expect(rot.map((x) => schrittText(x)).join(' ')).toContain('reference-lock.json');
      expect(schrittMit(e, 'F3')).toBeUndefined();
    },
    LANG,
  );

  it(
    '[R-14-03][R-H-10] dieselbe Nachführung mit lock-update --refresh (Protokollzeile) → F2 grün',
    async () => {
      const sb = neueSandbox();
      const { root, ref } = gesperrt(sb);
      vi.stubEnv('WAP_REFERENCE_DIR', ref);
      gemeinsamNachgefuehrt(root, ref);
      const u = node(
        join(root, 'scripts', 'wap', 'lock-update.mjs'),
        ['--grund', 'Korrektur Anhang A, einzeln bestätigt (Test)', '--refresh', REF_LOCK],
        { cwd: root, env: sb.env },
      );
      expect(u.status, 'lock-update --refresh scheiterte').toBe(0);
      commitAlles(sb, root, 'Anhang nachgeführt mit Protokoll');
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: testLast(sb).last });
      const f2 = e.schritte.filter((x) => /^F2(?![0-9a-z])/i.test(x.id));
      expect(f2.length).toBeGreaterThan(0);
      expect(f2.filter((x) => !x.ok).map((x) => schrittText(x))).toEqual([]);
    },
    LANG,
  );
});

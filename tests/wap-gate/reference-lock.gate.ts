// Sperre der bestätigten Anhänge unter WAP_REFERENCE_DIR (ADR-010 §7.1, bis H0-Ergänzung B): eine
// Änderung an einem bestätigten Anhang bricht die Schleuse (Lock-Prüfung F2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkReferenceLock, runGate), §6 (reference-lock.json).
// Fiktive Anhänge in einem temporären Referenzordner (nie der echte Ordner reference/).
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { referenceLock } from './support/vertrag';

afterEach(aufraeumen);

const ANHANG_A = 'Woche;Tag;Eintrag\n1;Mo;Fiktiver Eintrag A\n';
const ANHANG_B = 'Mass;Wert\nRand;10\n';

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

async function pruefe(root: string, ref: string) {
  const { checkReferenceLock } = await referenceLock();
  return checkReferenceLock({ cwd: root, referenceDir: ref });
}

describe('checkReferenceLock', () => {
  it('[R-14-03][R-14-01] bestätigte Anhänge unverändert (Hash gesperrt) → grün', async () => {
    const sb = neueSandbox();
    const { root, ref } = aufbau(sb);
    const r = await pruefe(root, ref);
    expect(r.ok).toBe(true);
  });

  it('[R-14-03] gleicher Inhalt mit CRLF statt LF → grün (Hash über LF)', async () => {
    const sb = neueSandbox();
    const { root, ref } = aufbau(sb);
    writeText(ref, 'anhaenge/anhang-a-kp.csv', ANHANG_A.replace(/\n/g, '\r\n'));
    expect((await pruefe(root, ref)).ok).toBe(true);
  });

  it('[R-14-03] Anhang A nach der Bestätigung geändert (z.B. aus einem Importergebnis angepasst) → rot «geändert» mit Pfad', async () => {
    const sb = neueSandbox();
    const { root, ref } = aufbau(sb);
    writeText(ref, 'anhaenge/anhang-a-kp.csv', `${ANHANG_A}2;Di;Aus dem Import ergänzt\n`);
    const r = await pruefe(root, ref);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('anhang-a-kp.csv');
    expect(schrittText(r)).toContain('geändert');
  });

  it('[R-14-03] gesperrter Anhang fehlt → rot «fehlt»', async () => {
    const sb = neueSandbox();
    const { root, ref } = aufbau(sb);
    rmSync(join(ref, 'anhaenge', 'anhang-b-kp.csv'));
    const r = await pruefe(root, ref);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('anhang-b-kp.csv');
    expect(schrittText(r)).toContain('fehlt');
  });

  it('[R-14-03] Referenzordner fehlt bzw. reference-lock.json fehlt → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const { root, ref } = aufbau(sb);
    const ohneOrdner = await pruefe(root, join(ref, 'gibt-es-nicht'));
    expect(ohneOrdner.ok).toBe(false);
    rmSync(join(root, 'docs', 'wap-planer', 'reference-lock.json'));
    const ohneSperre = await pruefe(root, ref);
    expect(ohneSperre.ok).toBe(false);
    expect(ohneSperre.ursache ?? '').toContain('reference-lock.json');
  });
});

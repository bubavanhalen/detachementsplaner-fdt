// globalSetup der Selbsttest-Konfiguration (scripts/wap-gate/vitest-setup.mjs; Vertrag E1-01, Änderungsnotiz
// AE-001 §2 «globalSetup der Selbsttest-Konfiguration» und §4 Nr 5): Node-Prüfung, VITEST_MAX_WORKERS gesetzt
// und ≠ maxWorkers → Fehler, Sperre belegen und F0-last (beides nicht, wenn geschachtelt); liefert
// { envWert, freigeben }. Geprüft über pruefeSelbsttestSetup mit eingespeister Last (temporäres commonDir,
// fiktive Prozessquelle, WAP_GATE_SPERRE im Testprozess entfernt).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FREMDER_HALTER,
  fremderVitest,
  proz,
  schreibeSperre,
  setupImKind,
  sperrPfad,
  testLast,
} from './support/last';
import { aufraeumen, KURZ, neueSandbox, WT } from './support/umgebung';
import { ENV_WERT, lastModul, vitestSetup } from './support/vertrag';

afterEach(aufraeumen);

/** Erwartet einen Wurf, dessen Meldung alle Stichwörter enthält. */
async function wirft(p: Promise<unknown>, ...stichwoerter: string[]): Promise<void> {
  let fehler: unknown;
  try {
    await p;
  } catch (e) {
    fehler = e;
  }
  expect(fehler, 'kein Fehler geworfen').toBeInstanceOf(Error);
  const text = (fehler as Error).message;
  // Ein Stub-Fehler ist kein erwarteter Wurf: unverändert weiterreichen (Rot-Phase, ADR-010 §3.3).
  if (/^nicht implementiert: /.test(text)) throw fehler;
  for (const s of stichwoerter) expect(text).toContain(s);
}

describe('pruefeSelbsttestSetup (vitest-setup.mjs)', () => {
  it(
    '[R-H-18][R-H-27] gültige Lage (VITEST_MAX_WORKERS = 1 = maxWorkers, Sperre frei, keine fremden Prozesse) → envWert <Pfad>#<Token> der belegten Sperre; freigeben() gibt sie frei',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { pruefeSelbsttestSetup } = await vitestSetup();
      const r = await pruefeSelbsttestSetup({
        env: { VITEST_MAX_WORKERS: '1' },
        maxWorkers: 1,
        last: t.last,
      });
      const m = ENV_WERT.exec(r.envWert);
      expect(m, 'envWert nicht in der Form <Pfad>#<Token>').not.toBeNull();
      expect(m?.groups?.pfad?.toLowerCase()).toBe(sperrPfad(t.commonDir).toLowerCase());
      expect(existsSync(sperrPfad(t.commonDir))).toBe(true);
      expect(t.aufrufe.prozesse).toBeGreaterThan(0);
      await r.freigeben();
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    KURZ,
  );

  it(
    '[R-H-18] VITEST_MAX_WORKERS nicht gesetzt → kein Fehler (nur «gesetzt und abweichend» ist verboten)',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { pruefeSelbsttestSetup } = await vitestSetup();
      const r = await pruefeSelbsttestSetup({ env: {}, maxWorkers: 1, last: t.last });
      await r.freigeben();
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    KURZ,
  );

  it.each([['4'], ['19']])(
    '[R-H-18] VITEST_MAX_WORKERS = %s bei maxWorkers 1 → wirft mit Hinweis auf VITEST_MAX_WORKERS vor der Sperre: kein Ordner wap-gate unter commonDir, Prozessquelle nie abgefragt (§4 Nr 8)',
    async (wert) => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { pruefeSelbsttestSetup } = await vitestSetup();
      await wirft(
        pruefeSelbsttestSetup({ env: { VITEST_MAX_WORKERS: wert }, maxWorkers: 1, last: t.last }),
        'VITEST_MAX_WORKERS',
      );
      expect(existsSync(join(t.commonDir, 'wap-gate'))).toBe(false);
      expect(t.aufrufe.prozesse).toBe(0);
      expect(t.aufrufe.cpuMs).toEqual([]);
    },
    KURZ,
  );

  it(
    '[R-H-27] Node-Version 22.19.0 ausserhalb engines.node → wirft mit Version; keine Sperre angelegt, Prozessquelle nicht abgefragt',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { pruefeSelbsttestSetup } = await vitestSetup();
      await wirft(
        pruefeSelbsttestSetup({
          env: { VITEST_MAX_WORKERS: '1' },
          maxWorkers: 1,
          nodeVersion: '22.19.0',
          last: t.last,
        }),
        '22.19.0',
      );
      expect(existsSync(join(t.commonDir, 'wap-gate'))).toBe(false);
      expect(t.aufrufe.prozesse).toBe(0);
    },
    KURZ,
  );

  it(
    '[R-H-18] Sperre durch lebenden fremden Halter belegt → wirft mit Halter; Sperrdatei unverändert',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb, { lebt: () => true });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const vorher = readFileSync(sperrPfad(t.commonDir), 'utf8');
      const { pruefeSelbsttestSetup } = await vitestSetup();
      await wirft(
        pruefeSelbsttestSetup({ env: { VITEST_MAX_WORKERS: '1' }, maxWorkers: 1, last: t.last }),
        String(FREMDER_HALTER.pid),
      );
      expect(readFileSync(sperrPfad(t.commonDir), 'utf8')).toBe(vorher);
    },
    KURZ,
  );

  it(
    '[R-H-18] fremder Vitest-Lauf (F0-last) → wirft mit PID; die eigene Sperre ist danach frei',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb, { prozesse: [fremderVitest(990_444)] });
      const { pruefeSelbsttestSetup } = await vitestSetup();
      await wirft(
        pruefeSelbsttestSetup({ env: { VITEST_MAX_WORKERS: '1' }, maxWorkers: 1, last: t.last }),
        '990444',
      );
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    KURZ,
  );

  it(
    '[R-H-18] geschachtelt (WAP_GATE_SPERRE gültig, Halter lebt und ist Vorfahr von eigenePid) → kein F0-last trotz fremdem Prozess und CPU-Last; Datei des Halters bleibt nach freigeben()',
    async () => {
      const sb = neueSandbox();
      const halterLast = testLast(sb);
      const { belegeSperre } = await lastModul();
      const halter = await belegeSperre({ modus: 'full', worktree: WT, last: halterLast.last });
      expect(halter.ok).toBe(true);
      if (!halter.ok) return;
      try {
        const vorher = readFileSync(sperrPfad(halterLast.commonDir), 'utf8');
        const kindPid = 880_001;
        const t = testLast(sb, {
          name: 'common',
          prozesse: [
            proz(process.pid, 1, 'node.exe', 'node vitest.mjs run', '2000-01-01T00:00:00.000Z'),
            proz(
              kindPid,
              process.pid,
              'node.exe',
              'node vitest worker',
              '2026-10-04T08:00:00.000Z',
            ),
            fremderVitest(990_333),
          ],
          cpu: 0.9,
        });
        const { pruefeSelbsttestSetup } = await vitestSetup();
        const r = await pruefeSelbsttestSetup({
          env: { VITEST_MAX_WORKERS: '1', WAP_GATE_SPERRE: halter.envWert },
          maxWorkers: 1,
          eigenePid: kindPid,
          last: t.last,
        });
        expect(t.aufrufe.cpuMs).toEqual([]);
        await r.freigeben();
        expect(readFileSync(sperrPfad(halterLast.commonDir), 'utf8')).toBe(vorher);
      } finally {
        await halter.freigeben();
      }
    },
    KURZ,
  );
});

describe('setup (Default-Export, Vitest-globalSetup)', () => {
  it(
    '[R-H-18] VITEST_MAX_WORKERS = 4 bei project.config.maxWorkers 1 → wirft mit Hinweis auf VITEST_MAX_WORKERS vor der Sperre; kein Ordner .git/wap-gate (Kindprozess mit Kopie von scripts/wap-gate im temporären Repo, §4 Nr 8)',
    () => {
      const sb = neueSandbox();
      const { r, root } = setupImKind(sb, { maxWorkers: 1, vitestMaxWorkers: '4' });
      ohneFehlerStub(r);
      expect(r.ok, 'setup lief trotz abweichendem VITEST_MAX_WORKERS durch').not.toBe(true);
      expect(r.fehler ?? '').toContain('VITEST_MAX_WORKERS');
      expect(existsSync(join(root, '.git', 'wap-gate'))).toBe(false);
    },
    KURZ,
  );
});

/** Ein Stub-Fehler aus dem Kindprozess ist kein erwarteter Wurf: als Stub-Fehler weiterreichen. */
function ohneFehlerStub(r: { fehler?: string }): void {
  if (r.fehler !== undefined && /^nicht implementiert: /.test(r.fehler)) throw new Error(r.fehler);
}

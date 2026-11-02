// Reihenfolge F1 → F0-sperre → F0-last in runGate, runSelftest und runStability (Befund E1-07-03; ADR-010
// Änderungsnotiz AE-001 §2; Vertrag E1-01, Änderungsnotiz AE-001 §2 und §4 Nr 2, 4, 7): Node-Prüfung zuerst,
// dann die exklusive Sperre, dann die Prüfung auf fremde Prozesse; rotes F0-sperre/F0-last beim Start bricht
// sofort ab und gibt die eigene Sperre frei; in `full` werden spätere Funde gesammelt und am Ende als rotes
// F0-last gemeldet; --pre-commit prüft nur die Sperre. Läufe im synthetischen Mini-Repo mit eingespeister
// Last (temporäres commonDir, Prozessquelle fiktiv, WAP_GATE_SPERRE entfernt).
// Selbsttest-Teil (Vertrag §9 Nr 17), weil runGate, runSelftest und runStability ganze Läufe starten.
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { FREMDER_HALTER, fremderVitest, schreibeSperre, sperrPfad, testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  LANG,
  neueSandbox,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import {
  type GateErgebnis,
  gate,
  type Schritt,
  schrittMit,
  selftest,
  stability,
} from './support/vertrag';

afterEach(aufraeumen);

function mini(sb: Sandbox): string {
  prozessUmgebung(sb);
  return miniRepo(sb);
}

function mit(e: GateErgebnis, id: string): Schritt[] {
  return e.schritte.filter((s) => s.id === id);
}

function pos(e: GateErgebnis, s: Schritt | undefined): number {
  expect(s, 'Schritt fehlt').toBeDefined();
  return e.schritte.indexOf(s as Schritt);
}

describe('runGate: F1 vor F0-sperre', () => {
  it.each([['fast'], ['full']] as const)(
    '[R-H-18][R-H-27] %s: Node-Version ausserhalb engines.node → F1 rot, Abbruch; kein F0-sperre, keine Sperrdatei, F0-last nicht ausgeführt',
    async (modus) => {
      const sb = neueSandbox();
      const root = mini(sb);
      const pkg = JSON.parse(readText(root, 'package.json')) as Record<string, unknown>;
      writeText(
        root,
        'package.json',
        `${JSON.stringify({ ...pkg, engines: { node: '>=99.0.0' } }, null, 2)}\n`,
      );
      commitAlles(sb, root, 'Node 99 verlangt');
      const t = testLast(sb, { prozesse: [fremderVitest()] });
      const { runGate } = await gate();
      const e = await runGate(modus, { cwd: root, last: t.last });
      expect(e.ok).toBe(false);
      expect(schrittMit(e, 'F1')?.ok).toBe(false);
      expect(e.schritte.at(-1)?.id).toMatch(/^F1(?![0-9a-z])/i);
      expect(mit(e, 'F0-sperre')).toEqual([]);
      expect(mit(e, 'F0-last')).toEqual([]);
      expect(t.aufrufe.prozesse).toBe(0);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );
});

describe('runGate: F0-sperre vor F0-last', () => {
  it(
    '[R-H-18] Sperre durch einen lebenden fremden Lauf belegt → F0-sperre rot mit Halter und Start, sofortiger Abbruch (kein F0-last, kein F2); F1 grün davor; Sperrdatei unverändert',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, { prozesse: [fremderVitest()], lebt: () => true });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const vorher = readFileSync(sperrPfad(t.commonDir), 'utf8');
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: t.last });
      expect(e.ok).toBe(false);
      const f1 = schrittMit(e, 'F1');
      expect(f1?.ok).toBe(true);
      const sperre = mit(e, 'F0-sperre')[0];
      expect(sperre?.ok).toBe(false);
      expect(schrittText(sperre ?? {})).toContain(String(FREMDER_HALTER.pid));
      expect(schrittText(sperre ?? {})).toContain(FREMDER_HALTER.start);
      expect(pos(e, f1)).toBeLessThan(pos(e, sperre));
      expect(e.schritte.at(-1)?.id).toBe('F0-sperre');
      expect(mit(e, 'F0-last')).toEqual([]);
      expect(schrittMit(e, 'F2')).toBeUndefined();
      expect(t.aufrufe.prozesse).toBe(0);
      expect(readFileSync(sperrPfad(t.commonDir), 'utf8')).toBe(vorher);
    },
    LANG,
  );

  it(
    '[R-H-18] freie Sperre, fremder Vitest-Lauf beim Start → F0-last rot mit PID, sofortiger Abbruch (kein F2); beim Abfragen ist die Sperre belegt; F1 → F0-sperre → F0-last; danach Sperre frei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, { prozesse: [fremderVitest(990_777)] });
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: t.last });
      expect(e.ok).toBe(false);
      const last = mit(e, 'F0-last')[0];
      expect(last?.ok).toBe(false);
      expect(schrittText(last ?? {})).toContain('990777');
      expect(t.sperreBeimAbfragen[0]).toBe(true);
      const f1 = schrittMit(e, 'F1');
      const sperre = mit(e, 'F0-sperre')[0];
      expect(sperre?.ok).toBe(true);
      expect(pos(e, f1)).toBeLessThan(pos(e, sperre));
      expect(pos(e, sperre)).toBeLessThan(pos(e, last));
      expect(e.schritte.at(-1)?.id).toBe('F0-last');
      expect(schrittMit(e, 'F2')).toBeUndefined();
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-18] freie Sperre, keine fremden Prozesse, CPU-Last 0 → F0-sperre und F0-last grün, Lauf geht weiter (F2 ausgeführt); danach Sperre frei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: t.last });
      expect(mit(e, 'F0-sperre')[0]?.ok).toBe(true);
      expect(mit(e, 'F0-last')[0]?.ok).toBe(true);
      expect(schrittMit(e, 'F2')).toBeDefined();
      expect(t.aufrufe.prozesse).toBeGreaterThan(0);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-18] freie Sperre, CPU-Last 40 % beim Start → F0-last rot, sofortiger Abbruch; Sperre frei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, { cpu: 0.4 });
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, last: t.last });
      expect(mit(e, 'F0-last')[0]?.ok).toBe(false);
      expect(e.schritte.at(-1)?.id).toBe('F0-last');
      expect(e.ok).toBe(false);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-18] full: fremder Prozess erst während des Laufs (Wiederholungsprüfung über pruefIntervallMs) → Lauf geht weiter bis V11, am Ende rotes F0-last mit PID; Sperre frei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, {
        prozesseBeiAufruf: (n) => (n === 1 ? [] : [fremderVitest(990_888)]),
        pruefIntervallMs: 200,
      });
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: t.last });
      const lasten = mit(e, 'F0-last');
      expect(lasten[0]?.ok).toBe(true);
      expect(schrittMit(e, 'V11'), 'Lauf nicht bis V11 fortgesetzt').toBeDefined();
      const ende = e.schritte.at(-1);
      expect(ende?.id).toBe('F0-last');
      expect(ende?.ok).toBe(false);
      expect(schrittText(ende ?? {})).toContain('990888');
      expect(e.ok).toBe(false);
      expect(t.aufrufe.prozesse).toBeGreaterThan(1);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );
});

describe('runGate fast --pre-commit: nur die Sperre', () => {
  it(
    '[R-H-18][R-H-10] Sperre frei, fremder Vitest-Lauf und CPU-Last 90 % → F0-sperre grün, kein F0-last, Prozessquelle nie abgefragt; danach keine Sperrdatei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, { prozesse: [fremderVitest()], cpu: 0.9 });
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, preCommit: true, last: t.last });
      expect(e.schritte[0]?.id).toBe('F0-arbeitsbaum');
      expect(mit(e, 'F0-sperre')[0]?.ok).toBe(true);
      expect(mit(e, 'F0-last')).toEqual([]);
      expect(t.aufrufe.prozesse).toBe(0);
      expect(t.aufrufe.cpuMs).toEqual([]);
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-18][R-H-10] Sperre durch einen lebenden fremden Lauf belegt → F0-sperre rot mit Halter (Beleglauf des Orchestrators: Pre-commit rot)',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const t = testLast(sb, { lebt: () => true });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: root, preCommit: true, last: t.last });
      expect(e.ok).toBe(false);
      const sperre = mit(e, 'F0-sperre')[0];
      expect(sperre?.ok).toBe(false);
      expect(schrittText(sperre ?? {})).toContain(String(FREMDER_HALTER.pid));
      expect(mit(e, 'F0-last')).toEqual([]);
    },
    LANG,
  );
});

describe('runSelftest und runStability: Sperre und F0-last', () => {
  it(
    '[R-H-18][R-H-31] runSelftest bei belegter Sperre → genau eine Zeile { verstoss F0-sperre, erwartet frei, erkannt = Ursache mit Halter, ok false }',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const t = testLast(sb, { lebt: () => true });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const { runSelftest } = await selftest();
      const liste = await runSelftest({ cwd: WT, nur: ['S5'], last: t.last });
      expect(liste.length).toBe(1);
      expect(liste[0]?.verstoss).toBe('F0-sperre');
      expect(liste[0]?.erwartet).toBe('frei');
      expect(liste[0]?.ok).toBe(false);
      expect(liste[0]?.erkannt ?? '').toContain(String(FREMDER_HALTER.pid));
      expect(t.aufrufe.prozesse).toBe(0);
    },
    LANG,
  );

  it(
    '[R-H-18] runStability: Sperre belegt → rot mit Halter, kein Testlauf; fremder Prozess bei freier Sperre → rot mit PID, Sperre danach frei',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const { runStability } = await stability();
      const belegt = testLast(sb, { name: 'belegt', lebt: () => true });
      schreibeSperre(belegt.commonDir, FREMDER_HALTER);
      const r1 = await runStability({ cwd: root, last: belegt.last });
      expect(r1.ok).toBe(false);
      expect(schrittText(r1)).toContain(String(FREMDER_HALTER.pid));
      expect(belegt.aufrufe.prozesse).toBe(0);
      const fremd = testLast(sb, { name: 'fremd', prozesse: [fremderVitest(990_555)] });
      const r2 = await runStability({ cwd: root, last: fremd.last });
      expect(r2.ok).toBe(false);
      expect(schrittText(r2)).toContain('990555');
      expect(existsSync(sperrPfad(fremd.commonDir))).toBe(false);
    },
    LANG,
  );
});

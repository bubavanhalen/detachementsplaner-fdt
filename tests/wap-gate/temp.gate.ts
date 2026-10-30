// Temporäre Ordner der Schleuse (Befund E1-01-24; R-H-11, R-H-24): V3 räumt beim Start verwaiste
// `wap-v3-*`-Ordner auf und legt seinen eigenen Ordner mit Prozesskennung an. Entfernt werden nur Ordner
// mit dem Präfix: `<praefix><pid>-…` mit nicht lebender PID und die alte Form ohne PID ab altMs (1 h);
// Fehler zählen, ohne Wurf; ausgegeben werden nur Anzahlen.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (eigenerTempOrdner, raeumeVerwaisteTemp, E1-01-24).
// TEMP und TMP zeigen in jedem Test auf die Sandbox; nie auf den echten temporären Ordner. Der Lauf der
// vollen Schleuse (V3) steht in temp.selbsttest.ts (Vertrag E1-01 §9 Nr 17, TR-E101b-02).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { totePid } from './support/last';
import { aufraeumen, neueSandbox, type Sandbox } from './support/umgebung';
import { tempModul } from './support/vertrag-b';

const prozesse: ChildProcess[] = [];

afterEach(async () => {
  while (prozesse.length > 0) {
    const p = prozesse.pop();
    if (p !== undefined && p.exitCode === null) {
      const ende = new Promise<void>((res) => p.once('exit', () => res()));
      p.kill();
      await ende;
    }
  }
  aufraeumen();
});

const STUNDE = 60 * 60 * 1000;

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

describe('eigenerTempOrdner', () => {
  it('[R-H-11][R-H-24] legt <tmpDir>/<praefix><pid>-… an; zwei Aufrufe → zwei verschiedene, leere Ordner', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 'eigen');
    mkdirSync(t);
    const { eigenerTempOrdner } = await tempModul();
    const a = eigenerTempOrdner('wap-v3-', t);
    const b = eigenerTempOrdner('wap-v3-', t);
    expect(a).not.toBe(b);
    for (const p of [a, b]) {
      expect(dirname(p)).toBe(t);
      expect(basename(p).startsWith(`wap-v3-${String(process.pid)}-`), basename(p)).toBe(true);
      expect(basename(p).length).toBeGreaterThan(`wap-v3-${String(process.pid)}-`.length);
      expect(statSync(p).isDirectory()).toBe(true);
      expect(readdirSync(p)).toEqual([]);
    }
  });

  it('[R-H-11][R-H-24] ohne tmpDir → unter os.tmpdir() (TEMP auf die Sandbox)', async () => {
    const sb = neueSandbox();
    const t = tempAufSandbox(sb);
    const { eigenerTempOrdner } = await tempModul();
    const p = eigenerTempOrdner('wap-v3-');
    expect(dirname(p)).toBe(t);
    expect(basename(p).startsWith(`wap-v3-${String(process.pid)}-`)).toBe(true);
  });
});

describe('raeumeVerwaisteTemp', () => {
  it('[R-H-11][R-H-24] PID-Form: nicht lebende PID entfernt, lebende behalten (auch wenn alt); fremdes Präfix und Dateien unberührt', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const tot = ordner(t, 'wap-v3-424242-abc123');
    const lebend = ordner(t, 'wap-v3-515151-def456');
    const fremd = ordner(t, 'wap-gate-424242-abc123');
    writeFileSync(join(t, 'wap-v3-424242-datei.json'), '{}\n');
    const { raeumeVerwaisteTemp } = await tempModul();
    const r = raeumeVerwaisteTemp({
      praefix: 'wap-v3-',
      tmpDir: t,
      lebt: (pid) => pid === 515_151,
      jetztMs: Date.now() + 10 * STUNDE,
    });
    expect(r).toEqual({ entfernt: 1, behalten: 1, fehler: 0 });
    expect(existsSync(tot)).toBe(false);
    expect(existsSync(lebend)).toBe(true);
    expect(existsSync(fremd)).toBe(true);
    expect(existsSync(join(t, 'wap-v3-424242-datei.json'))).toBe(true);
  });

  it('[R-H-11][R-H-24] alte Form ohne PID: ab altMs entfernt, jünger behalten (Standard altMs 1 h)', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const alt = ordner(t, 'wap-v3-Qx7RtZ');
    const { raeumeVerwaisteTemp } = await tempModul();
    const jung = raeumeVerwaisteTemp({
      praefix: 'wap-v3-',
      tmpDir: t,
      lebt: () => false,
      jetztMs: Date.now() + STUNDE - 60_000,
    });
    expect(jung).toEqual({ entfernt: 0, behalten: 1, fehler: 0 });
    expect(existsSync(alt)).toBe(true);
    const r = raeumeVerwaisteTemp({
      praefix: 'wap-v3-',
      tmpDir: t,
      lebt: () => false,
      jetztMs: Date.now() + STUNDE + 60_000,
    });
    expect(r).toEqual({ entfernt: 1, behalten: 0, fehler: 0 });
    expect(existsSync(alt)).toBe(false);
  });

  it('[R-H-11][R-H-24] alte Form nur aus Ziffern (wap-v3-424242, ohne «-» nach der Zahl) gilt nicht als PID-Form: jung behalten trotz nicht lebender PID, alt entfernt', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const ziffern = ordner(t, 'wap-v3-424242');
    const { raeumeVerwaisteTemp } = await tempModul();
    const jung = raeumeVerwaisteTemp({
      praefix: 'wap-v3-',
      tmpDir: t,
      lebt: () => false,
      jetztMs: Date.now() + STUNDE - 60_000,
    });
    expect(jung).toEqual({ entfernt: 0, behalten: 1, fehler: 0 });
    expect(existsSync(ziffern)).toBe(true);
    const alt = raeumeVerwaisteTemp({
      praefix: 'wap-v3-',
      tmpDir: t,
      lebt: () => true,
      jetztMs: Date.now() + STUNDE + 60_000,
    });
    expect(alt).toEqual({ entfernt: 1, behalten: 0, fehler: 0 });
    expect(existsSync(ziffern)).toBe(false);
  });

  it('[R-H-11][R-H-24] altMs einstellbar: 10 min', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const alt = ordner(t, 'wap-v3-Ab3dEf');
    const { raeumeVerwaisteTemp } = await tempModul();
    const altMs = 10 * 60_000;
    expect(
      raeumeVerwaisteTemp({
        praefix: 'wap-v3-',
        tmpDir: t,
        jetztMs: Date.now() + altMs - 60_000,
        altMs,
      }),
    ).toEqual({ entfernt: 0, behalten: 1, fehler: 0 });
    expect(
      raeumeVerwaisteTemp({
        praefix: 'wap-v3-',
        tmpDir: t,
        jetztMs: Date.now() + altMs + 60_000,
        altMs,
      }),
    ).toEqual({ entfernt: 1, behalten: 0, fehler: 0 });
    expect(existsSync(alt)).toBe(false);
  });

  it('[R-H-11][R-H-24] Standard für «lebt»: eigene PID lebt (behalten), beendeter Prozess nicht (entfernt)', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const eigen = ordner(t, `wap-v3-${String(process.pid)}-eigen1`);
    const tot = ordner(t, `wap-v3-${String(totePid())}-tot001`);
    const { raeumeVerwaisteTemp } = await tempModul();
    const r = raeumeVerwaisteTemp({ praefix: 'wap-v3-', tmpDir: t });
    expect(r).toEqual({ entfernt: 1, behalten: 1, fehler: 0 });
    expect(existsSync(eigen)).toBe(true);
    expect(existsSync(tot)).toBe(false);
  });

  it('[R-H-11][R-H-24] nicht entfernbarer Ordner (Arbeitsverzeichnis eines laufenden Prozesses) → fehler 1, kein Wurf, nur Anzahlen, keine Konsolenausgabe', async () => {
    const sb = neueSandbox();
    const t = join(sb.base, 't');
    const gesperrt = ordner(t, 'wap-v3-434343-gesperrt');
    const tot = ordner(t, 'wap-v3-454545-frei01');
    const p = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], {
      cwd: gesperrt,
      windowsHide: true,
      stdio: 'ignore',
    });
    prozesse.push(p);
    await new Promise<void>((res, rej) => {
      p.once('spawn', () => res());
      p.once('error', rej);
    });
    const spione = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    const { raeumeVerwaisteTemp } = await tempModul();
    const r = raeumeVerwaisteTemp({ praefix: 'wap-v3-', tmpDir: t, lebt: () => false });
    expect(r).toEqual({ entfernt: 1, behalten: 0, fehler: 1 });
    expect(existsSync(gesperrt)).toBe(true);
    expect(existsSync(tot)).toBe(false);
    expect(spione.reduce((n, s) => n + s.mock.calls.length, 0)).toBe(0);
  });
});

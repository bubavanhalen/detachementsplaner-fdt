// @vitest-environment jsdom
// Paket E1-02b: Generator der Metrik-Tabelle, «Datei = Neuerzeugung» (R-L-03; Vertrag E1-02b
// Abschnitt 1, 2.4, 2.5, P-2, P-14). Braucht die Schriftdateien unter src/assets/wap-fonts/.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_SHA256, REPO_ROOT } from './helpers';

interface GenModule {
  renderFontMetricsModule(ttf: { regular: Uint8Array; bold: Uint8Array }): string;
  runGenFontMetrics(argv: readonly string[], opts: { cwd: string }): Promise<number>;
}

const GEN_PATH = join(REPO_ROOT, 'tools', 'wap', 'gen-font-metrics.mjs');
const FONT_DIR = ['src', 'assets', 'wap-fonts'] as const;
const GENERATED = ['src', 'model', 'wap', 'layout', 'text', 'metrics.generated.ts'] as const;
const HEADER = 'Erzeugt von tools/wap/gen-font-metrics.mjs – nicht von Hand ändern.';

async function loadGen(): Promise<GenModule> {
  // Dynamischer Import über die Datei-URL: das Werkzeug ist ESM mit JSDoc (ADR-010 §4.2).
  return (await import(/* @vite-ignore */ pathToFileURL(GEN_PATH).href)) as GenModule;
}

function readTtf(): { regular: Uint8Array; bold: Uint8Array } {
  const regular = join(REPO_ROOT, ...FONT_DIR, 'Arimo-Regular.ttf');
  const boldPath = join(REPO_ROOT, ...FONT_DIR, 'Arimo-Bold.ttf');
  expect(existsSync(regular), 'Schriftdatei fehlt: Arimo-Regular.ttf').toBe(true);
  expect(existsSync(boldPath), 'Schriftdatei fehlt: Arimo-Bold.ttf').toBe(true);
  return {
    regular: new Uint8Array(readFileSync(regular)),
    bold: new Uint8Array(readFileSync(boldPath)),
  };
}

const tempDirs: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Temporäres Repo-Abbild mit den beiden Schriftdateien und optional der erzeugten Datei. */
function sandbox(generated?: string): string {
  const ttf = readTtf();
  const dir = mkdtempSync(join(tmpdir(), 'wap-e1-02b-gen-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, ...FONT_DIR), { recursive: true });
  writeFileSync(join(dir, ...FONT_DIR, 'Arimo-Regular.ttf'), ttf.regular);
  writeFileSync(join(dir, ...FONT_DIR, 'Arimo-Bold.ttf'), ttf.bold);
  if (generated !== undefined) {
    mkdirSync(join(dir, ...GENERATED.slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, ...GENERATED), generated);
  }
  return dir;
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('renderFontMetricsModule', () => {
  it('[R-L-03] versionierte metrics.generated.ts = Neuerzeugung aus den Schriftdateien', async () => {
    const gen = await loadGen();
    const expected = gen.renderFontMetricsModule(readTtf());
    const path = join(REPO_ROOT, ...GENERATED);
    expect(existsSync(path), 'metrics.generated.ts fehlt').toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(expected);
  });

  it('[R-L-03] deterministisch, LF, Kopfkommentar, Quell-SHA-256, keine Zeitangaben', async () => {
    const gen = await loadGen();
    const ttf = readTtf();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = gen.renderFontMetricsModule(ttf);
    vi.setSystemTime(new Date('2031-07-15T13:45:00Z'));
    const second = gen.renderFontMetricsModule(ttf);
    expect(second).toBe(first);
    expect(first).not.toContain('\r');
    expect(first.endsWith('\n')).toBe(true);
    expect(first.split('\n').slice(0, 3).join('\n')).toContain(HEADER);
    expect(first).toContain(FONT_SHA256.regular);
    expect(first).toContain(FONT_SHA256.bold);
    expect(first).toContain('ARIMO_METRICS');
  });

  // F-FLAKY (FL-01): keine Zeitanforderung; startet einen Node-Kindprozess (ruhig 0,2 s), in der schnellen Schleuse unter
  // Fremdlast 12 s gemessen – Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-L-03] Ausgabe ist Biome-konform (biome format ändert nichts, P-14)', async () => {
    const gen = await loadGen();
    const text = gen.renderFontMetricsModule(readTtf());
    const biome = join(REPO_ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
    const result = spawnSync(
      process.execPath,
      [biome, 'format', `--stdin-file-path=${GENERATED.join('/')}`],
      { cwd: REPO_ROOT, input: text, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(text);
  }, 120_000);

  it('[R-L-03] prüft zuerst den SHA-256 je Schnitt: Error mit Nennung des Schnitts, auch für Bytes ohne TrueType (P-17)', async () => {
    const gen = await loadGen();
    const ttf = readTtf();
    expect(typeof gen.renderFontMetricsModule(ttf)).toBe('string');
    const messageOf = (fn: () => unknown): string => {
      const e = thrownBy(fn);
      expect(e).toBeInstanceOf(Error);
      return (e as Error).message;
    };
    const changed = new Uint8Array(ttf.regular);
    changed[changed.length - 1] = (changed[changed.length - 1] as number) ^ 0xff;
    expect(
      messageOf(() => gen.renderFontMetricsModule({ regular: changed, bold: ttf.bold })),
    ).toSatisfy((msg: string) => /regular|normal/i.test(msg) && !/bold|fett/i.test(msg));
    const changedBold = new Uint8Array(ttf.bold);
    changedBold[0] = (changedBold[0] as number) ^ 0xff;
    expect(
      messageOf(() => gen.renderFontMetricsModule({ regular: ttf.regular, bold: changedBold })),
    ).toSatisfy((msg: string) => /bold|fett/i.test(msg) && !/regular|normal/i.test(msg));
    const garbage = new Uint8Array(4096).fill(0x41);
    expect(
      messageOf(() => gen.renderFontMetricsModule({ regular: garbage, bold: ttf.bold })),
    ).toSatisfy((msg: string) => /regular|normal/i.test(msg) && !/bold|fett/i.test(msg));
    expect(
      messageOf(() =>
        gen.renderFontMetricsModule({ regular: ttf.regular, bold: new Uint8Array(0) }),
      ),
    ).toSatisfy((msg: string) => /bold|fett/i.test(msg) && !/regular|normal/i.test(msg));
    expect(
      thrownBy(() => gen.renderFontMetricsModule({ regular: ttf.bold, bold: ttf.regular })),
    ).toBeInstanceOf(Error);
  });
});

describe('runGenFontMetrics', () => {
  it('[R-L-03] ohne Argument: legt fehlende metrics.generated.ts samt Ordner an (= Neuerzeugung), Exit 0', async () => {
    const gen = await loadGen();
    const dir = sandbox();
    expect(await gen.runGenFontMetrics([], { cwd: dir })).toBe(0);
    expect(readFileSync(join(dir, ...GENERATED), 'utf8')).toBe(
      gen.renderFontMetricsModule(readTtf()),
    );
  });

  it('[R-L-03] ohne Argument: überschreibt eine veraltete metrics.generated.ts mit der Neuerzeugung', async () => {
    const gen = await loadGen();
    const dir = sandbox('// veraltet\n');
    expect(await gen.runGenFontMetrics([], { cwd: dir })).toBe(0);
    expect(readFileSync(join(dir, ...GENERATED), 'utf8')).toBe(
      gen.renderFontMetricsModule(readTtf()),
    );
    expect(await gen.runGenFontMetrics(['--check'], { cwd: dir })).toBe(0);
  });

  it('[R-L-03] --check: aktuelle Datei → 0; abweichend oder fehlend → 1, ohne zu schreiben', async () => {
    const gen = await loadGen();
    const current = gen.renderFontMetricsModule(readTtf());
    expect(await gen.runGenFontMetrics(['--check'], { cwd: sandbox(current) })).toBe(0);

    const stale = `${current}// veraltet\n`;
    const staleDir = sandbox(stale);
    expect(await gen.runGenFontMetrics(['--check'], { cwd: staleDir })).toBe(1);
    expect(readFileSync(join(staleDir, ...GENERATED), 'utf8')).toBe(stale);

    const missingDir = sandbox();
    expect(await gen.runGenFontMetrics(['--check'], { cwd: missingDir })).toBe(1);
    expect(existsSync(join(missingDir, ...GENERATED))).toBe(false);
  });

  it('[R-L-03] fehlende Schriftdatei → Error mit Dateinamen', async () => {
    const gen = await loadGen();
    const dir = sandbox();
    expect(await gen.runGenFontMetrics([], { cwd: dir })).toBe(0);
    rmSync(join(dir, ...FONT_DIR, 'Arimo-Bold.ttf'));
    await expect(gen.runGenFontMetrics(['--check'], { cwd: dir })).rejects.toThrow(
      'Arimo-Bold.ttf',
    );
    await expect(gen.runGenFontMetrics([], { cwd: dir })).rejects.toBeInstanceOf(Error);
  });

  // F-FLAKY (FL-01): keine Zeitanforderung; startet einen Node-Kindprozess (ruhig 0,2 s) wie der Biome-Test oben –
  // Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-L-03] CLI im Repo: node tools/wap/gen-font-metrics.mjs --check → Exit 0', () => {
    readTtf();
    const result = spawnSync(process.execPath, [GEN_PATH, '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
  }, 120_000);
});

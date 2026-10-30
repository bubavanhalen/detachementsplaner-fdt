// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): Golden-Vergleich Ebene 3 (R-H-20,
// ADR-010 §7.3). vergleicheMitGolden (tests/wap/golden/support/golden.ts) gegen ein Manifest in einem temporären
// Ordner: gleiches Bild grün; ein Pixel anders rot mit Vorher/Nachher/Differenz; Toleranz aus dem Manifest;
// fehlende bzw. veränderte Baseline rot; PNG-Lesen und -Schreiben verlustfrei (scripts/wap-gate/golden.mjs).
// Fiktive 4 × 4-Bilder; keine Daten.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { vergleicheMitGolden } from '../wap/golden/support/golden';
import { aufraeumen, neueSandbox, writeText } from './support/umgebung';
import { goldenModul } from './support/vertrag-f-tools';

const { pngLesen, pngSchreiben, sha256, vergleiche } = await goldenModul();

afterEach(aufraeumen);

function bild(abweichend: number[] = []): Uint8Array {
  const rgba = new Uint8Array(4 * 4 * 4).fill(255);
  for (const p of abweichend) {
    rgba[p * 4] = 0;
    rgba[p * 4 + 1] = 0;
  }
  return pngSchreiben({ width: 4, height: 4, rgba });
}

function manifest(root: string, png: Uint8Array | null, toleranz = 0, sha?: string): void {
  if (png !== null) writeText(root, 'tests/wap/golden/baselines/probe.png', png);
  writeText(
    root,
    'tests/wap/golden/manifest.json',
    `${JSON.stringify({
      version: 1,
      toleranz: { pixel: toleranz },
      bilder:
        png === null
          ? []
          : [
              {
                datei: 'baselines/probe.png',
                sha256: sha ?? sha256(png),
                status: 'vorläufig',
                anforderungen: ['R-H-20'],
                grund: 'fiktiver Testfall',
                commit: 'abc1234',
              },
            ],
    })}\n`,
  );
}

const INFO = { name: 'probe', beschreibung: 'fiktiv', anforderungen: ['R-H-20'] };

async function fehler(f: () => Promise<void>): Promise<Error | null> {
  try {
    await f();
    return null;
  } catch (e) {
    return e as Error;
  }
}

describe('vergleicheMitGolden', () => {
  it('[R-H-20] gleiches Bild → grün; Ist-Bild und Kandidatenbeschreibung abgelegt', async () => {
    const sb = neueSandbox();
    manifest(sb.base, bild());
    expect(await fehler(() => vergleicheMitGolden(INFO, bild(), { root: sb.base }))).toBeNull();
    expect(existsSync(join(sb.base, 'test-results', 'wap', 'golden', 'ist', 'probe.png'))).toBe(
      true,
    );
    expect(existsSync(join(sb.base, 'test-results', 'wap', 'golden', 'ist', 'probe.json'))).toBe(
      true,
    );
  });

  it('[R-H-20] ein Pixel anders bei Toleranz 0 → AssertionError mit Anzahl; Vorher/Nachher/Differenz abgelegt', async () => {
    const sb = neueSandbox();
    manifest(sb.base, bild());
    const e = await fehler(() => vergleicheMitGolden(INFO, bild([5]), { root: sb.base }));
    expect(e?.name).toBe('AssertionError');
    expect(e?.message).toContain('Golden-Bild probe: 1 Pixel abweichend (Toleranz 0)');
    for (const teil of ['vorher.png', 'nachher.png', 'differenz.png']) {
      expect(
        existsSync(join(sb.base, 'test-results', 'wap', 'golden', 'diff', 'probe', teil)),
        teil,
      ).toBe(true);
    }
  });

  it('[R-H-20] Toleranz 1 im Manifest: 1 Pixel anders → grün, 2 Pixel → rot', async () => {
    const sb = neueSandbox();
    manifest(sb.base, bild(), 1);
    expect(await fehler(() => vergleicheMitGolden(INFO, bild([5]), { root: sb.base }))).toBeNull();
    expect(
      (await fehler(() => vergleicheMitGolden(INFO, bild([5, 6]), { root: sb.base })))?.message,
    ).toContain('2 Pixel abweichend (Toleranz 1)');
  });

  it('[R-H-20] keine Baseline im Manifest → «Baseline fehlt» mit Hinweis auf die Aufnahme', async () => {
    const sb = neueSandbox();
    manifest(sb.base, null);
    expect(
      (await fehler(() => vergleicheMitGolden(INFO, bild(), { root: sb.base })))?.message,
    ).toContain('Baseline fehlt: probe (Aufnahme ausstehend');
  });

  it('[R-H-20] Baseline-Datei verändert (SHA-256 ungleich Manifest) → rot', async () => {
    const sb = neueSandbox();
    manifest(sb.base, bild(), 0, sha256(bild([1])));
    expect(
      (await fehler(() => vergleicheMitGolden(INFO, bild(), { root: sb.base })))?.message,
    ).toContain('Baseline verändert: probe');
  });

  it('[R-H-20] andere Bildgrösse → rot «Bildgrösse geändert»', async () => {
    const sb = neueSandbox();
    manifest(
      sb.base,
      pngSchreiben({ width: 1, height: 1, rgba: Uint8Array.from([255, 255, 255, 255]) }),
    );
    expect(
      (await fehler(() => vergleicheMitGolden(INFO, bild(), { root: sb.base })))?.message,
    ).toContain('Bildgrösse geändert');
  });

  it('[R-H-20] ungültiges Manifest (Toleranz negativ) → rot', async () => {
    const sb = neueSandbox();
    manifest(sb.base, bild(), -1);
    expect(
      (await fehler(() => vergleicheMitGolden(INFO, bild(), { root: sb.base })))?.message,
    ).toContain('Golden-Manifest');
  });
});

describe('PNG und Vergleich (golden.mjs)', () => {
  it('[R-H-20] PNG schreiben und lesen ist verlustfrei; Vergleich zählt jedes Pixel mit einem abweichenden Kanal, auch Alpha', async () => {
    const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) % 256);
    const b = pngLesen(pngSchreiben({ width: 3, height: 2, rgba }));
    expect([b.width, b.height]).toEqual([3, 2]);
    expect(Array.from(b.rgba)).toEqual(Array.from(rgba));
    const anders = Uint8Array.from(rgba);
    anders[3] = (anders[3] ?? 0) ^ 1;
    const v = vergleiche(b, { width: 3, height: 2, rgba: anders });
    expect(v.groesse && v.diffPixels).toBe(1);
    expect(vergleiche(b, { width: 2, height: 3, rgba }).groesse).toBe(false);
  });
});

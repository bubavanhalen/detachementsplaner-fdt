// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// PDF Ebene 3 (ADR-010 §7.3): Golden-Bilder mit fixierter Render-Kette exakt verglichen; geänderte Kette
// meldet sich als «Render-Kette geändert»; ein Pixel Unterschied → rot; Vorher/Nachher/Differenz für Gate B.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (goldenReport), §3 (vitest.wap-golden.config.ts),
// §4 (renderPdfPage, assertRenderChain, compareExact), §6 (render-chain.json, manifest.json), §9 Nr 6, 7.
// assertRenderChain liegt in tests/wap/golden/support/golden.ts (der Stub in tests/wap/support/golden/render.ts
// ist gesperrt und bleibt unverändert); Vergleich mit der Toleranz aus manifest.json (Vorgabe 0 Pixel).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { afterEach, describe, expect, it } from 'vitest';
import { assertRenderChain } from '../wap/golden/support/golden';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  lauf,
  neueSandbox,
  readText,
  sha256,
  WT,
  writeText,
} from './support/umgebung';
import { goldenReportModul } from './support/vertrag';

afterEach(aufraeumen);

const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('Render-Kette (render-chain.json)', () => {
  it('[R-H-20] installierte Kette entspricht render-chain.json → assertRenderChain erfüllt', async () => {
    await expect(assertRenderChain()).resolves.toBeUndefined();
    const kette = JSON.parse(readText(WT, 'tests/wap/golden/render-chain.json')) as {
      pdf: { pdfjsDist: string; napiRsCanvas: string };
    };
    expect(kette.pdf.pdfjsDist).toBe('6.3.289');
    const lock = JSON.parse(readText(WT, 'package-lock.json')) as {
      packages: Record<string, { version?: string }>;
    };
    expect(kette.pdf.napiRsCanvas).toBe(lock.packages['node_modules/@napi-rs/canvas']?.version);
  });

  it('[R-H-20] assertRenderChain({ kette }) mit abweichender pdfjs-dist-Version → AssertionError «Render-Kette geändert: » mit Feld, Soll und Ist', async () => {
    const sb = neueSandbox();
    const quelle = join(WT, 'tests', 'wap', 'golden', 'render-chain.json');
    expect(existsSync(quelle), 'tests/wap/golden/render-chain.json fehlt').toBe(true);
    const kette = JSON.parse(readText(WT, 'tests/wap/golden/render-chain.json')) as {
      pdf: Record<string, unknown>;
    };
    kette.pdf.pdfjsDist = '0.0.0';
    const datei = writeText(sb.base, 'render-chain.json', `${JSON.stringify(kette, null, 2)}\n`);
    const fehler = await assertRenderChain({ kette: datei }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(fehler).not.toBeNull();
    expect(fehler?.name).toBe('AssertionError');
    expect(fehler?.message.startsWith('Render-Kette geändert: ')).toBe(true);
    expect(fehler?.message).toContain('pdfjsDist');
    expect(fehler?.message).toContain('0.0.0');
    expect(fehler?.message).toContain('6.3.289');
  });

  it('[R-H-20] assertRenderChain({ kette }) mit fehlender Kettendatei → «Render-Kette geändert: »', async () => {
    const sb = neueSandbox();
    await expect(assertRenderChain({ kette: join(sb.base, 'fehlt.json') })).rejects.toThrow(
      /^Render-Kette geändert: /,
    );
  });

  it(
    '[R-H-20] geänderte Kette (pdfjs-dist-Version in render-chain.json) → Golden-Lauf rot «Render-Kette geändert», nicht als Pixelfehler; unverändert grün',
    () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      writeText(
        k.root,
        'tests/wap/golden/zz-kette.golden.ts',
        "// @vitest-environment node\nimport { it } from 'vitest';\nimport { assertRenderChain } from './support/golden';\n\nit('[R-H-20] kette', async () => {\n  await assertRenderChain();\n});\n",
      );
      const vitest = join(k.root, 'node_modules', 'vitest', 'vitest.mjs');
      const args = [
        vitest,
        'run',
        '-c',
        'vitest.wap-golden.config.ts',
        'tests/wap/golden/zz-kette.golden.ts',
      ];
      const gruen = lauf(process.execPath, args, { cwd: k.root, env: sb.env, timeout: LANG });
      expect(gruen.status, gruen.out).toBe(0);
      const kette = JSON.parse(readText(k.root, 'tests/wap/golden/render-chain.json')) as {
        pdf: Record<string, unknown>;
      };
      kette.pdf.pdfjsDist = '0.0.0';
      writeText(
        k.root,
        'tests/wap/golden/render-chain.json',
        `${JSON.stringify(kette, null, 2)}\n`,
      );
      const rot = lauf(process.execPath, args, { cwd: k.root, env: sb.env, timeout: LANG });
      expect(rot.status).not.toBe(0);
      expect(rot.out).toContain('Render-Kette geändert');
    },
    LANG,
  );
});

function png(breite: number, hoehe: number, abweichung: boolean): Buffer {
  const c = createCanvas(breite, hoehe);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, breite, hoehe);
  if (abweichung) {
    g.fillStyle = '#000000';
    g.fillRect(1, 1, 1, 1);
  }
  return c.toBuffer('image/png');
}

function manifestStand(root: string, ordner: string, abweichung: boolean, status: string): string {
  const daten = png(4, 4, abweichung);
  writeText(root, `${ordner}/baselines/woche-1.png`, daten);
  return writeText(
    root,
    `${ordner}/manifest.json`,
    `${JSON.stringify(
      {
        version: 1,
        bilder: [
          {
            datei: 'baselines/woche-1.png',
            sha256: sha256(daten),
            status,
            anforderungen: ['R-4.6-03'],
            grund: 'Fiktiver Testfall',
            commit: 'abc1234',
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

/** Alle Dateien unter `dir`; ist `dir` selbst eine Datei (Bericht als eine Datei), nur diese. */
function alleDateien(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? alleDateien(p) : [p];
  });
}

describe('goldenReport (Vorher / Nachher / Differenz für Gate B)', () => {
  it('[R-H-20] zwei Manifest-Stände mit einem geänderten Bild → Bericht mit Bildname, Status und Differenzbild', async () => {
    const sb = neueSandbox();
    const vorher = manifestStand(sb.base, 'vorher', false, 'freigegeben');
    const nachher = manifestStand(sb.base, 'nachher', true, 'vorläufig');
    const out = join(sb.base, 'bericht');
    const { goldenReport } = await goldenReportModul();
    const r = await goldenReport({ vorher, nachher, out });
    expect(r.ok).toBe(true);
    // Aufbau nach Vertrag §9 Nr 7.
    expect(r.details).toEqual({ geaendert: 1, neu: 0, entfernt: 0, unveraendert: 0 });
    const bericht = readFileSync(join(out, 'bericht.md'), 'utf8');
    expect(bericht).toContain('woche-1');
    expect(bericht).toContain('freigegeben');
    expect(bericht).toContain('vorläufig');
    expect(bericht).toContain('geändert');
    expect(bericht).toContain('R-4.6-03');
    for (const teil of ['vorher.png', 'nachher.png', 'differenz.png']) {
      const p = join(out, 'woche-1', teil);
      expect(Array.from(readFileSync(p).subarray(0, 8)), teil).toEqual(PNG_SIGNATUR);
    }
    expect(alleDateien(out).length).toBe(4);
  });

  it('[R-H-20] Bild nur im Nachher-Stand → Art neu, nur nachher.png', async () => {
    const sb = neueSandbox();
    const vorher = writeText(
      sb.base,
      'vorher/manifest.json',
      `${JSON.stringify({ version: 1, bilder: [] })}\n`,
    );
    const nachher = manifestStand(sb.base, 'nachher', false, 'vorläufig');
    const out = join(sb.base, 'bericht');
    const { goldenReport } = await goldenReportModul();
    const r = await goldenReport({ vorher, nachher, out });
    expect(r.ok).toBe(true);
    expect(r.details).toEqual({ geaendert: 0, neu: 1, entfernt: 0, unveraendert: 0 });
    expect(readFileSync(join(out, 'bericht.md'), 'utf8')).toContain('neu');
    expect(alleDateien(join(out, 'woche-1')).map((d) => d.slice(-11))).toEqual(['nachher.png']);
  });

  it('[R-H-20] SHA-256 im Manifest passt nicht zum Bild → rot', async () => {
    const sb = neueSandbox();
    const vorher = manifestStand(sb.base, 'vorher', false, 'freigegeben');
    const nachher = manifestStand(sb.base, 'nachher', true, 'vorläufig');
    writeText(sb.base, 'nachher/baselines/woche-1.png', png(4, 4, false));
    const { goldenReport } = await goldenReportModul();
    const r = await goldenReport({ vorher, nachher, out: join(sb.base, 'bericht') });
    expect(r.ok).toBe(false);
  });

  it('[R-H-20] fehlender Vorher-Stand → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const nachher = manifestStand(sb.base, 'nachher', true, 'vorläufig');
    const { goldenReport } = await goldenReportModul();
    const r = await goldenReport({
      vorher: join(sb.base, 'fehlt', 'manifest.json'),
      nachher,
      out: join(sb.base, 'bericht'),
    });
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });
});

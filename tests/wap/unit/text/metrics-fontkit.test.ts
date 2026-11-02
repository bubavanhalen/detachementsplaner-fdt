// @vitest-environment jsdom
// Paket E1-02b: Metrik-Tabelle = Schriftdatei für alle Glyphen beider Schnitte, ohne Kerning
// (R-L-03; Vertrag E1-02b 2.2, P-5, P-6; ADR-004 Punkt 2). Vergleich mit `fontkit` 2.0.4 (installiert E1-01).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import type { FontWeight } from '../../../../src/model/wap/layout/text/types';
import { REPO_ROOT } from './helpers';

/** Genutzte Felder von fontkit 2 (das Paket bringt keine Typen mit). */
interface FkGlyph {
  readonly advanceWidth: number;
}
interface FkFont {
  readonly unitsPerEm: number;
  readonly characterSet: readonly number[];
  readonly hhea: { readonly ascent: number; readonly descent: number; readonly lineGap: number };
  glyphForCodePoint(cp: number): FkGlyph;
  getGlyph(id: number): FkGlyph;
}
type FkCreate = (buffer: Uint8Array) => FkFont;

type Fonts = { readonly [W in FontWeight]: FkFont };
let cached: Fonts | undefined;

/** fontkit direkt an den gebundenen TTF-Dateien (P-17); einmal je Datei geparst (Zeitbudget P-19). */
async function loadFonts(): Promise<Fonts> {
  if (cached !== undefined) return cached;
  const name = 'fontkit';
  const mod = (await import(/* @vite-ignore */ name)) as {
    create?: FkCreate;
    default?: { create?: FkCreate };
  };
  const create = mod.create ?? mod.default?.create;
  expect(typeof create, 'fontkit exportiert create').toBe('function');
  const fk = create as FkCreate;
  const file = (weight: FontWeight): Uint8Array => {
    const path = join(REPO_ROOT, 'src', 'assets', 'wap-fonts', FILES[weight]);
    expect(existsSync(path), `Schriftdatei fehlt: ${FILES[weight]}`).toBe(true);
    return new Uint8Array(readFileSync(path));
  };
  cached = { regular: fk(file('regular')), bold: fk(file('bold')) };
  return cached;
}

const WEIGHTS = ['regular', 'bold'] as const;
const FILES = { regular: 'Arimo-Regular.ttf', bold: 'Arimo-Bold.ttf' } as const;

/** Zahlen der flachen Paarliste `advances.<weight>` aus dem Text von metrics.generated.ts (Form P-4). */
function advancesFromText(text: string, weight: FontWeight): number[] {
  const start = text.indexOf('advances');
  expect(start, 'Feld advances im Text').toBeGreaterThanOrEqual(0);
  const key = new RegExp(`\\b${weight}\\b['"]?\\s*:\\s*\\[`, 'g');
  key.lastIndex = start;
  const match = key.exec(text);
  expect(match, `advances.${weight} im Text`).not.toBeNull();
  const open = (match?.index ?? 0) + (match?.[0].length ?? 0);
  const close = text.indexOf(']', open);
  // P-21: ganze Dezimalzahlen ohne führende Nullen, Vorzeichen nur «-», keine Kommentare in ARIMO_METRICS.
  const tokens = text
    .slice(open, close)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
  const wrong = tokens.filter((t) => !/^-?(0|[1-9]\d*)$/.test(t));
  expect(wrong.slice(0, 5), `advances.${weight}: Zahlenformat nach P-21`).toEqual([]);
  return tokens.map(Number);
}

describe('Metrik-Tabelle gegen fontkit', () => {
  it('[R-L-03] advance stimmt für jeden Codepunkt der cmap mit fontkit überein (beide Schnitte)', async () => {
    const fonts = await loadFonts();
    const m = fontMetrics();
    for (const weight of WEIGHTS) {
      const font = fonts[weight];
      expect(font.characterSet.length, weight).toBeGreaterThan(1000);
      const wrong: string[] = [];
      for (const cp of font.characterSet) {
        if (m.advance(cp, weight) !== font.glyphForCodePoint(cp).advanceWidth)
          wrong.push(cp.toString(16));
      }
      expect(wrong, weight).toEqual([]);
    }
  });

  it('[R-L-03] advance ist null für Codepunkte ausserhalb der cmap (Stichprobe nach P-19)', async () => {
    const fonts = await loadFonts();
    const m = fontMetrics();
    const extra = [-1, 0x110000, 1.5, Number.NaN, 0xd800, 0x10ffff, 0x2713, 0x1f600];
    for (const weight of WEIGHTS) {
      const inCmap = new Set(fonts[weight].characterSet);
      const wrong: string[] = [];
      for (let cp = 0; cp <= 0x2fff; cp++) {
        if (!inCmap.has(cp) && m.advance(cp, weight) !== null) wrong.push(cp.toString(16));
      }
      for (const cp of extra) {
        if (m.advance(cp, weight) !== null) wrong.push(String(cp));
      }
      expect(wrong, weight).toEqual([]);
    }
  });

  it('[R-L-03] Codepunkte der Paarliste in metrics.generated.ts sind genau die cmap (characterSet) je Schnitt', async () => {
    const fonts = await loadFonts();
    const path = join(REPO_ROOT, 'src', 'model', 'wap', 'layout', 'text', 'metrics.generated.ts');
    expect(existsSync(path), 'metrics.generated.ts fehlt').toBe(true);
    const text = readFileSync(path, 'utf8');
    for (const weight of WEIGHTS) {
      const pairs = advancesFromText(text, weight);
      expect(pairs.length % 2, weight).toBe(0);
      const cps = pairs.filter((_, i) => i % 2 === 0);
      for (let i = 1; i < cps.length; i++) {
        expect((cps[i] as number) > (cps[i - 1] as number), `${weight} aufsteigend`).toBe(true);
      }
      expect(cps, weight).toEqual([...fonts[weight].characterSet].sort((a, b) => a - b));
    }
  });

  it('[R-L-03] notdefAdvance = Vorschub der Glyphe 0 (P-5)', async () => {
    const fonts = await loadFonts();
    for (const weight of WEIGHTS) {
      expect(fontMetrics().notdefAdvance(weight)).toBe(fonts[weight].getGlyph(0).advanceWidth);
    }
  });

  it('[R-L-03] unitsPerEm und vertikale Werte aus hhea; beide gebundenen Schnitte gleich (P-6, P-17)', async () => {
    const fonts = await loadFonts();
    const m = fontMetrics();
    // P-17: Voraussetzung direkt an den TTF – gleiche unitsPerEm und hhea-Werte beider Schnitte
    const { regular, bold } = fonts;
    expect(bold.unitsPerEm).toBe(regular.unitsPerEm);
    expect(bold.hhea.ascent).toBe(regular.hhea.ascent);
    expect(bold.hhea.descent).toBe(regular.hhea.descent);
    expect(bold.hhea.lineGap).toBe(regular.hhea.lineGap);
    for (const weight of WEIGHTS) {
      const font = fonts[weight];
      expect(m.unitsPerEm, weight).toBe(font.unitsPerEm);
      expect(m.ascender, weight).toBe(font.hhea.ascent);
      expect(m.descender, weight).toBe(font.hhea.descent);
      expect(m.lineGap, weight).toBe(font.hhea.lineGap);
    }
  });

  it('[R-L-03] measureRuns = Summe der fontkit-Vorschübe ohne Kerning, skaliert (P-7)', async () => {
    const fonts = await loadFonts();
    const text = 'AVOR Fahne – Wachtdienst «Kp» To Wa LT fi ffl Übung 0700-1130';
    for (const weight of WEIGHTS) {
      const font = fonts[weight];
      let units = 0;
      for (const ch of text)
        units += font.glyphForCodePoint(ch.codePointAt(0) as number).advanceWidth;
      expect(measureRuns([{ text, weight }], 5.5)).toBe((units * 5.5) / font.unitsPerEm);
    }
  });
});

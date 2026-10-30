// @vitest-environment node
// F-ABDECKUNG (FT-A-01): reine Hilfen des Imports – Farbabstand und Farbzuordnung (Beschrieb 8.2 Regel 5, F-31),
// Flächen und Verdeckung (Gate S A2, R-8.2-39 bis -42), Zeitkalibrierung an den Zeilengrenzen (normalisierung 13
// «6 Zeiten», N-21). Konkrete Werte, Grenzwerte und Rückfälle. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  AMBIGUITY_RATIO,
  DELTA_E_MAX,
  deltaE2000,
  hexToRgb,
  nearestColor,
  onWhite,
} from '../../../../src/io/wap-import/colors';
import {
  area,
  coveredShare,
  intersect,
  overlap1d,
  visibleSpan,
} from '../../../../src/io/wap-import/geometry';
import { rowTimeScale } from '../../../../src/io/wap-import/timescale';
import type { SheetModel, SheetTimeScale } from '../../../../src/io/xlsx-drawing/index';

const SCHWARZ = { r: 0, g: 0, b: 0 };
const WEISS = { r: 255, g: 255, b: 255 };

describe('F-ABDECKUNG Farben (F-31: ΔE2000 ≤ 10, zweitnächste Farbe ≥ 1,5-fach)', () => {
  it('[R-8.2-12] ΔE2000: gleiche Farbe 0; Schwarz–Weiss genau 100 (unbunt, ΔL = 100, SL = 1); symmetrisch', () => {
    expect(deltaE2000(WEISS, WEISS)).toBe(0);
    expect(deltaE2000(SCHWARZ, WEISS)).toBeCloseTo(100, 4);
    const a = { r: 255, g: 255, b: 153 };
    const b = { r: 204, g: 236, b: 255 };
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 9);
  });

  it('[R-8.2-12] ΔE2000 bei Farbtönen über 0°/360° (Rot–Magenta) und sehr dunklen Farben bleibt endlich und klein', () => {
    const rot = { r: 200, g: 20, b: 30 };
    const magenta = { r: 200, g: 20, b: 60 };
    const d = deltaE2000(rot, magenta);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(10);
    // Fast schwarz: linearer Bereich der sRGB-Kurve und der Lab-Funktion.
    const fast = deltaE2000({ r: 2, g: 2, b: 2 }, { r: 4, g: 4, b: 4 });
    expect(fast).toBeGreaterThan(0);
    expect(fast).toBeLessThan(2);
    // Gegenfarben über die Hue-Grenze (dh > 180 bzw. < −180).
    const x = deltaE2000({ r: 255, g: 0, b: 128 }, { r: 255, g: 128, b: 0 });
    const y = deltaE2000({ r: 255, g: 128, b: 0 }, { r: 255, g: 0, b: 128 });
    expect(x).toBeCloseTo(y, 9);
    expect(x).toBeGreaterThan(10);
  });

  it('[R-8.2-12] Halbtransparent auf Weiss: Deckkraft 0 → Weiss, 1 → Farbe, 0,5 → Mitte; ausserhalb 0–1 begrenzt', () => {
    const c = { r: 0, g: 100, b: 200 };
    expect(onWhite(c, 0)).toEqual(WEISS);
    expect(onWhite(c, 1)).toEqual(c);
    expect(onWhite(c, 0.5)).toEqual({ r: 128, g: 178, b: 228 });
    expect(onWhite(c, 2)).toEqual(c);
    expect(onWhite(c, -1)).toEqual(WEISS);
  });

  it('[R-8.2-12] «RRGGBB» → RGB; ungültig oder null → null', () => {
    expect(hexToRgb('FFCC99')).toEqual({ r: 255, g: 204, b: 153 });
    expect(hexToRgb('ffcc99')).toEqual({ r: 255, g: 204, b: 153 });
    expect(hexToRgb('FFCC9')).toBeNull();
    expect(hexToRgb('GGGGGG')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });

  it('[R-8.2-14] Zuordnung: ohne Kandidaten unklar; über ΔE 10 kein Treffer; Grenzwerte 10 und 1,5 laut F-31', () => {
    expect(DELTA_E_MAX).toBe(10);
    expect(AMBIGUITY_RATIO).toBe(1.5);
    expect(nearestColor(WEISS, [])).toEqual({
      key: null,
      distance: Number.POSITIVE_INFINITY,
      unclear: true,
    });
    const fern = nearestColor({ r: 0, g: 0, b: 255 }, [
      { key: 'gelb', color: { r: 255, g: 255, b: 153 } },
    ]);
    expect(fern.key).toBeNull();
    expect(fern.unclear).toBe(true);
    expect(fern.distance).toBeGreaterThan(10);
  });

  it('[R-8.2-12][R-8.2-14] Nächste Farbe eindeutig; zweitnächste zu nahe → Treffer mit «unklar»; exakter Treffer nie unklar', () => {
    const gelb = { r: 255, g: 255, b: 153 };
    const fast = { r: 250, g: 250, b: 150 };
    const eindeutig = nearestColor(fast, [
      { key: 'gelb', color: gelb },
      { key: 'blau', color: { r: 204, g: 236, b: 255 } },
    ]);
    expect(eindeutig).toMatchObject({ key: 'gelb', unclear: false });
    const zwei = nearestColor({ r: 250, g: 250, b: 150 }, [
      { key: 'gelb', color: gelb },
      { key: 'gelb2', color: { r: 245, g: 245, b: 147 } },
    ]);
    expect(zwei.key).not.toBeNull();
    expect(zwei.unclear).toBe(true);
    const exakt = nearestColor(gelb, [
      { key: 'gelb', color: gelb },
      { key: 'gelb2', color: { r: 254, g: 254, b: 152 } },
    ]);
    expect(exakt).toMatchObject({ key: 'gelb', distance: 0, unclear: false });
  });
});

describe('F-ABDECKUNG Flächen und Verdeckung (Gate S A2)', () => {
  const R = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

  it('[R-8.2-39] Fläche, Schnitt und Überlappung: negative Masse zählen 0; Berührung ist kein Schnitt', () => {
    expect(area(R(0, 0, 10, 5))).toBe(50);
    expect(area(R(10, 0, 0, 5))).toBe(0);
    expect(intersect(R(0, 0, 10, 10), R(5, 5, 20, 20))).toEqual(R(5, 5, 10, 10));
    expect(intersect(R(0, 0, 10, 10), R(10, 0, 20, 10))).toBeNull();
    expect(overlap1d(0, 10, 5, 20)).toBe(5);
    expect(overlap1d(0, 10, 20, 30)).toBe(0);
  });

  it('[R-8.2-39] Anteil bedeckt: Ziel ohne Fläche 0; ohne Schnitt 0; überlappende Decken zählen einmal; höchstens 1', () => {
    const z = R(0, 0, 100, 100);
    expect(coveredShare(R(0, 0, 0, 100), [z])).toBe(0);
    expect(coveredShare(z, [R(200, 200, 300, 300)])).toBe(0);
    expect(coveredShare(z, [R(0, 0, 60, 100), R(40, 0, 100, 50)])).toBeCloseTo(0.8, 9);
    expect(coveredShare(z, [R(-10, -10, 110, 110), z])).toBe(1);
    // Zwei getrennte Streifen in derselben Höhe.
    expect(coveredShare(z, [R(0, 0, 10, 100), R(90, 0, 100, 100)])).toBeCloseTo(0.2, 9);
  });

  it('[R-8.2-41] Sichtbare Spanne: ohne Decke ganz; oben bzw. unten bedeckt → Rest; ganz bedeckt → null; Toleranz 0,5 % der Breite', () => {
    const z = R(0, 0, 100, 100);
    expect(visibleSpan(z, [])).toEqual({ y0: 0, y1: 100 });
    expect(visibleSpan(z, [R(0, 0, 100, 30)])).toEqual({ y0: 30, y1: 100 });
    expect(visibleSpan(z, [R(0, 70, 100, 100)])).toEqual({ y0: 0, y1: 70 });
    expect(visibleSpan(z, [R(-1, -1, 101, 101)])).toBeNull();
    // 0,4 % der Breite frei gilt als bedeckt; 1 % frei nicht.
    expect(visibleSpan(z, [R(0.4, 0, 100, 100)])).toBeNull();
    expect(visibleSpan(z, [R(1, 0, 100, 100)])).toEqual({ y0: 0, y1: 100 });
    // Mitte bedeckt: Spanne vom ersten bis zum letzten sichtbaren Streifen.
    expect(visibleSpan(z, [R(0, 40, 100, 60)])).toEqual({ y0: 0, y1: 100 });
  });
});

describe('F-ABDECKUNG Zeitkalibrierung an den Zeilengrenzen (N-21)', () => {
  /** Blatt mit gleich hohen Zeilen (100 EMU), Zeile 0 beginnt bei 0. */
  const sheet = (h = 100): SheetModel => ({ rowY: (r: number) => r * h }) as unknown as SheetModel;
  function base(labels: { minute: number; y: number }[]): SheetTimeScale {
    return {
      labels,
      toMinute: () => -1,
      toY: () => -1,
      gridLeft: 0,
      gridRight: 1000,
      gridTop: 0,
      gridBottom: 0,
      labelShapes: new Set<number>(),
    };
  }

  it('[R-8.2-10] Marken neben den Zeilengrenzen → an die nächste Grenze gezogen, linear dazwischen und ausserhalb', () => {
    // 1 Stunde = 4 Zeilen = 400 EMU; Marken 3 und 5 EMU neben den Grenzen 400/800/1200.
    const t = rowTimeScale(
      base([
        { minute: 300, y: 403 },
        { minute: 360, y: 795 },
        { minute: 420, y: 1205 },
      ]),
      sheet(),
    );
    expect(t.labels).toEqual([
      { minute: 300, y: 400 },
      { minute: 360, y: 800 },
      { minute: 420, y: 1200 },
    ]);
    expect(t.toMinute(600)).toBe(330);
    expect(t.toMinute(200)).toBe(270);
    expect(t.toMinute(1400)).toBe(450);
    expect(t.toY(330)).toBe(600);
    expect(t.toY(270)).toBe(200);
    expect(t.toY(450)).toBe(1400);
    expect(t.gridTop).toBe(0);
    expect(t.gridBottom).toBe(1700);
  });

  it('[R-8.2-10] Rückfall auf die Marken: weniger als zwei Marken, nicht aufsteigend, zwei Marken an derselben Grenze, ungleiche Abstände', () => {
    const one = base([{ minute: 300, y: 400 }]);
    expect(rowTimeScale(one, sheet())).toBe(one);
    const fallend = base([
      { minute: 300, y: 800 },
      { minute: 360, y: 400 },
    ]);
    expect(rowTimeScale(fallend, sheet())).toBe(fallend);
    const gleich = base([
      { minute: 300, y: 401 },
      { minute: 360, y: 399 },
    ]);
    expect(rowTimeScale(gleich, sheet())).toBe(gleich);
    const zeit = base([
      { minute: 360, y: 400 },
      { minute: 300, y: 800 },
    ]);
    expect(rowTimeScale(zeit, sheet())).toBe(zeit);
    // Abstände 400 und 600 je Stunde: mehr als 5 % vom Median → Marken bleiben.
    const ungleich = base([
      { minute: 300, y: 400 },
      { minute: 360, y: 800 },
      { minute: 420, y: 1400 },
    ]);
    expect(rowTimeScale(ungleich, sheet())).toBe(ungleich);
  });
});

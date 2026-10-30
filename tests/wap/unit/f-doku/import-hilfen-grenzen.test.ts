// @vitest-environment node
// F-DOKU, Auflage TR-2-05 des test-reviewer-2: Grenzwerte der reinen Import-Hilfen an der Grenze, je ein Wert knapp
// innerhalb und knapp ausserhalb. Farbzuordnung F-31 (ΔE2000 ≤ 10; zweitnächste Farbe näher als das 1,5-Fache →
// «unklar»; Beschrieb 8.2 Regel 5) und Zeitkalibrierung an den Zeilengrenzen (normalisierung 13, N-21: Abstände je
// Stunde höchstens 5 % vom Median, sonst Kalibrierung an den Marken). Tötet die Handmutanten A und C aus
// `.qa/haertung/tr2/mut/` (Beleg lokal). Fiktive Farben und Blätter.
import { describe, expect, it } from 'vitest';
import { deltaE2000, nearestColor } from '../../../../src/io/wap-import/colors';
import { rowTimeScale } from '../../../../src/io/wap-import/timescale';
import type { SheetModel, SheetTimeScale } from '../../../../src/io/xlsx-drawing/index';
import type { Rgb } from '../../../../src/model/wap/types';

const grau = (v: number): Rgb => ({ r: v, g: v, b: v });

/** Grauwerte unterhalb von `basis`, der letzte mit ΔE ≤ `grenze` und der erste mit ΔE > `grenze`. */
function umGrenze(basis: Rgb, start: number, grenze: number): { innen: Rgb; aussen: Rgb } {
  let innen: Rgb | null = null;
  for (let v = start; v >= 0; v--) {
    const c = grau(v);
    if (deltaE2000(c, basis) > grenze) {
      if (innen === null) throw new Error('Startwert schon ausserhalb');
      return { innen, aussen: c };
    }
    innen = c;
  }
  throw new Error('Grenze nicht gefunden');
}

describe('F-DOKU TR-2-05: Farbzuordnung an der Toleranz ΔE 10 (F-31)', () => {
  const legende = grau(200);
  const { innen, aussen } = umGrenze(legende, 200, 10);

  it('[R-8.2-12][R-8.2-14] Prüfwerte liegen knapp an der Grenze (9 < ΔE ≤ 10 < ΔE < 11)', () => {
    const di = deltaE2000(innen, legende);
    const da = deltaE2000(aussen, legende);
    expect(di).toBeGreaterThan(9);
    expect(di).toBeLessThanOrEqual(10);
    expect(da).toBeGreaterThan(10);
    expect(da).toBeLessThan(11);
  });

  it('[R-8.2-12] knapp innerhalb ΔE 10 → Legendenfarbe zugeordnet, nicht unklar', () => {
    expect(nearestColor(innen, [{ key: 'ltg', color: legende }])).toMatchObject({
      key: 'ltg',
      unclear: false,
    });
  });

  it('[R-8.2-14] knapp ausserhalb ΔE 10 → keine Zuordnung, «unklar» (Bericht)', () => {
    expect(nearestColor(aussen, [{ key: 'ltg', color: legende }])).toMatchObject({
      key: null,
      unclear: true,
    });
  });
});

describe('F-DOKU TR-2-05: zweitnächste Farbe an der Grenze 1,5-fach (F-31)', () => {
  // Farbe grau(128); nächste Legendenfarbe grau(138) darüber, zweite Legendenfarbe darunter in der Nähe des
  // 1,5-fachen Abstands.
  const farbe = grau(128);
  const naechste = grau(138);
  const d1 = deltaE2000(farbe, naechste);
  const { innen: nah, aussen: fern } = umGrenze(farbe, 127, d1 * 1.5);

  it('[R-8.2-14] Prüfwerte: zweite Farbe knapp unter bzw. knapp über dem 1,5-fachen Abstand', () => {
    expect(d1).toBeGreaterThan(0.5);
    const rNah = deltaE2000(farbe, nah) / d1;
    const rFern = deltaE2000(farbe, fern) / d1;
    expect(rNah).toBeGreaterThan(1.3);
    expect(rNah).toBeLessThan(1.5);
    expect(rFern).toBeGreaterThan(1.5);
    expect(rFern).toBeLessThan(1.7);
  });

  it('[R-8.2-14] zweite Farbe näher als das 1,5-Fache → Treffer mit «unklar»', () => {
    const m = nearestColor(farbe, [
      { key: 'a', color: naechste },
      { key: 'b', color: nah },
    ]);
    expect(m).toMatchObject({ key: 'a', unclear: true });
  });

  it('[R-8.2-14] zweite Farbe knapp über dem 1,5-Fachen → Treffer ohne «unklar»', () => {
    expect(
      nearestColor(farbe, [
        { key: 'a', color: naechste },
        { key: 'b', color: fern },
      ]),
    ).toMatchObject({ key: 'a', unclear: false });
  });
});

describe('F-DOKU TR-2-05: Zeitkalibrierung, Abstände je Stunde an der Grenze 5 % vom Median', () => {
  /** Blatt mit Zeilen zu 10 EMU; Marken liegen genau auf Zeilengrenzen. */
  const blatt = { rowY: (r: number) => r * 10 } as unknown as SheetModel;
  function basis(letzterAbstand: number): SheetTimeScale {
    return {
      labels: [
        { minute: 300, y: 1000 },
        { minute: 360, y: 2000 },
        { minute: 420, y: 3000 },
        { minute: 480, y: 3000 + letzterAbstand },
      ],
      toMinute: () => -1,
      toY: () => -1,
      gridLeft: 0,
      gridRight: 1000,
      gridTop: 0,
      gridBottom: 0,
      labelShapes: new Set<number>(),
    };
  }

  it('[R-8.2-10] letzte Stunde 4 % länger bzw. kürzer als der Median → Kalibrierung an den Zeilengrenzen', () => {
    for (const abstand of [1040, 960]) {
      const b = basis(abstand);
      const t = rowTimeScale(b, blatt);
      expect(t, String(abstand)).not.toBe(b);
      expect(t.toMinute(1500)).toBe(330);
      expect(t.toMinute(3000 + abstand)).toBe(480);
    }
  });

  it('[R-8.2-10] letzte Stunde 6 % länger bzw. kürzer als der Median → Rückfall auf die Marken', () => {
    for (const abstand of [1060, 940]) {
      const b = basis(abstand);
      expect(rowTimeScale(b, blatt), String(abstand)).toBe(b);
    }
  });
});

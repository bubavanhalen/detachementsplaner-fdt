// @vitest-environment jsdom
// Paket E1-02d: Tages- und Spaltenbreiten, Zeit → y (Vertrag E1-02d Abschnitt 1, 2a Nr 2–4; Beschrieb 4.4, 4.5;
// F-40, F-41). Nur über die vertraglichen Funktionen; Erwartungen aus den Gewichten von Beschrieb 4.4.
import { describe, expect, it } from 'vitest';
import {
  columnWeight,
  columnWidths,
  dayWidths,
  timeToY,
} from '../../../../src/model/wap/layout/grid/geometry';
import type { TimeScale } from '../../../../src/model/wap/layout/grid/types';
import type { ColumnKind, ColumnWeight, DayDisplay } from '../../../../src/model/wap/types';
import { catchError } from '../../support/model/builders';

const tage = (...d: DayDisplay[]) => d.map((display) => ({ display }));
const sp = (kind: ColumnKind, weight: ColumnWeight = 'normal') => ({ kind, weight });

function summe(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

describe('dayWidths (2a Nr 2)', () => {
  it('[R-4.4-11] kompakt / voll = 1/3 genau (F-40)', () => {
    const w = dayWidths(tage('full', 'compact'), 400);
    expect(w).toHaveLength(2);
    expect(w[0]).toBeCloseTo(300, 9);
    expect(w[1]).toBeCloseTo(100, 9);
    expect((w[1] as number) / (w[0] as number)).toBeCloseTo(1 / 3, 9);
  });

  it('[R-4.4-11] KVK-Woche Mo–Fr voll, Sa/So kompakt: jeder kompakte Tag ein Drittel eines vollen', () => {
    const w = dayWidths(tage('full', 'full', 'full', 'full', 'full', 'compact', 'compact'), 652.51);
    const voll = 652.51 / (5 + 2 / 3);
    for (const i of [0, 1, 2, 3, 4]) expect(w[i]).toBeCloseTo(voll, 6);
    for (const i of [5, 6]) expect(w[i]).toBeCloseTo(voll / 3, 6);
  });

  it('[R-4.4-10] alle vollen Tage gleich breit, Summe = Gesamtbreite', () => {
    const w = dayWidths(tage('full', 'full', 'full', 'full', 'full', 'full', 'full'), 700);
    expect(w).toEqual([100, 100, 100, 100, 100, 100, 100].map((x) => expect.closeTo(x, 9)));
  });

  it('[R-4.4-12] ausgeblendete Tage erhalten 0 und geben ihre Breite an die übrigen ab', () => {
    const w = dayWidths(
      tage('full', 'hidden', 'compact', 'hidden', 'full', 'hidden', 'hidden'),
      700,
    );
    expect(w[1]).toBe(0);
    expect(w[3]).toBe(0);
    expect(w[5]).toBe(0);
    expect(w[6]).toBe(0);
    expect(w[0]).toBeCloseTo(300, 9);
    expect(w[2]).toBeCloseTo(100, 9);
    expect(w[4]).toBeCloseTo(300, 9);
    expect(summe(w)).toBeCloseTo(700, 9);
  });

  it('[R-4.4-12] kein Tag sichtbar → alle 0 (Grenzfall)', () => {
    expect(dayWidths(tage('hidden', 'hidden', 'hidden'), 500)).toEqual([0, 0, 0]);
    expect(dayWidths([], 500)).toEqual([]);
  });

  it('[R-4.4-12] totalWidthPt nicht endlich oder ≤ 0 → RangeError', () => {
    for (const total of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        catchError(() => dayWidths(tage('full'), total)),
        String(total),
      ).toBeInstanceOf(RangeError);
    }
  });

  it('[R-4.4-12] kleinste positive Breite ist gültig (Grenzwert)', () => {
    const w = dayWidths(tage('full', 'full'), 0.02);
    expect(summe(w)).toBeCloseTo(0.02, 12);
  });
});

describe('columnWeight und columnWidths (2a Nr 3)', () => {
  it('[R-4.4-13] Planungsspalte schmal 1, normal 2, breit 3', () => {
    expect(columnWeight(sp('planning', 'narrow'))).toBe(1);
    expect(columnWeight(sp('planning', 'normal'))).toBe(2);
    expect(columnWeight(sp('planning', 'wide'))).toBe(3);
  });

  // Nebenspalte 2 statt 1: Entscheid Auftraggeber 19.10.2026 «12: ja» (Q-HL-03), bewusste Abweichung von
  // Beschrieb 4.4 (F-LAYOUT2).
  it('[R-4.4-13] Neben-, Rap- und Beso-Spalte 2, 1, 2 – ihr gespeichertes Gewicht wirkt nicht', () => {
    for (const weight of ['narrow', 'normal', 'wide'] as const) {
      expect(columnWeight(sp('secondary', weight)), `secondary ${weight}`).toBe(2);
      expect(columnWeight(sp('rap', weight)), `rap ${weight}`).toBe(1);
      expect(columnWeight(sp('beso', weight)), `beso ${weight}`).toBe(2);
    }
  });

  it('[R-4.4-13] je eine Spalte jeder Art: Breiten 1 : 2 : 3 : 2 : 1 : 2', () => {
    const spalten = [
      sp('planning', 'narrow'),
      sp('planning', 'normal'),
      sp('planning', 'wide'),
      sp('secondary', 'wide'),
      sp('rap', 'wide'),
      sp('beso', 'narrow'),
    ];
    const w = columnWidths(spalten, 132);
    expect(w).toHaveLength(6);
    [12, 24, 36, 24, 12, 24].forEach((soll, i) => {
      expect(w[i], `Spalte ${i}`).toBeCloseTo(soll, 9);
    });
  });

  it('[R-4.4-13] Reihenfolge der Eingabe bleibt; leer → []; Breite 0 → alle 0', () => {
    expect(columnWidths([sp('beso'), sp('planning', 'narrow')], 30)).toEqual([
      expect.closeTo(20, 9),
      expect.closeTo(10, 9),
    ]);
    expect(columnWidths([], 100)).toEqual([]);
    expect(columnWidths([sp('planning'), sp('rap')], 0)).toEqual([0, 0]);
  });

  it('[R-4.4-13] dayWidthPt nicht endlich oder < 0 → RangeError', () => {
    for (const w of [-0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        catchError(() => columnWidths([sp('planning')], w)),
        String(w),
      ).toBeInstanceOf(RangeError);
    }
  });
});

describe('timeToY (2a Nr 4)', () => {
  const skala: TimeScale = { fromMin: 300, toMin: 1380, yTop: 60, ptPerMinute: 0.5 };

  it('[R-4.5-02] Anzeigebereich 0500–2300: y(0500) = yTop, y(2300) = yTop + 1080 · pt/min, linear', () => {
    expect(timeToY(skala, 300)).toBeCloseTo(60, 9);
    expect(timeToY(skala, 1380)).toBeCloseTo(600, 9);
    expect(timeToY(skala, 840)).toBeCloseTo(330, 9);
    expect(timeToY(skala, 845) - timeToY(skala, 840)).toBeCloseTo(2.5, 9);
  });

  it('[R-4.5-02] ohne Begrenzung ausserhalb des Bereichs (Spannen unter 0 und über 1440)', () => {
    expect(timeToY(skala, 0)).toBeCloseTo(-90, 9);
    expect(timeToY(skala, -30)).toBeCloseTo(-105, 9);
    expect(timeToY(skala, 1500)).toBeCloseTo(660, 9);
  });

  it('[R-4.5-02] anderer Bereich verändert die Abbildung (0400–2400)', () => {
    const s2: TimeScale = { fromMin: 240, toMin: 1440, yTop: 60, ptPerMinute: 0.3 };
    expect(timeToY(s2, 300)).toBeCloseTo(78, 9);
    expect(timeToY(s2, 300)).not.toBeCloseTo(timeToY(skala, 300), 3);
  });
});

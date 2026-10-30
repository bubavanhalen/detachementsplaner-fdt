// @vitest-environment jsdom
// Paket E1-02d: Füllfarbe und Schriftfarbe (Vertrag E1-02d Abschnitt 2e «Farbe», 2f «Füllung»; Beschrieb 4.6, 4.7;
// R-4.6-09 WCAG-Kontrast). Fiktive Legenden.
import { describe, expect, it } from 'vitest';
import { categoryFill, textColorForFill } from '../../../../src/model/wap/layout/entries/fill';
import type { LtgCategory } from '../../../../src/model/wap/types';
import { lege, MO, rasterPlan, rechtecke, STD, texte } from '../../support/grid/build';
import { basePlan, block, CAT, catchError, kpLegend, rt } from '../../support/model/builders';

const SCHWARZ = { r: 0, g: 0, b: 0 };
const WEISS = { r: 255, g: 255, b: 255 };

function kategorie(id: string, color: LtgCategory['color'], neutral = false): LtgCategory {
  return {
    id,
    name: `Kategorie ${id}`,
    legendLabel: `Kategorie ${id}`,
    color,
    neutral,
    inLegend: !neutral,
  };
}

describe('textColorForFill (2e «Farbe»)', () => {
  it('[R-4.6-09] dunkle Füllung → Weiss, Gelb → Schwarz, Kp-Legende überall Schwarz', () => {
    expect(textColorForFill({ r: 0, g: 0, b: 0 })).toEqual(WEISS);
    expect(textColorForFill({ r: 0, g: 0, b: 128 })).toEqual(WEISS);
    expect(textColorForFill({ r: 128, g: 0, b: 0 })).toEqual(WEISS);
    expect(textColorForFill({ r: 255, g: 255, b: 0 })).toEqual(SCHWARZ);
    expect(textColorForFill({ r: 255, g: 255, b: 255 })).toEqual(SCHWARZ);
    for (const c of kpLegend()) expect(textColorForFill(c.color), c.name).toEqual(SCHWARZ);
  });

  it('[R-4.6-09] Grenze nach WCAG (Linearisierung 0,03928): Grau 117 → Weiss, Grau 118 → Schwarz', () => {
    // Relative Leuchtdichte L(117) ≈ 0,1779: Kontrast zu Weiss 4,608 > zu Schwarz 4,558.
    expect(textColorForFill({ r: 117, g: 117, b: 117 })).toEqual(WEISS);
    // L(118) ≈ 0,1812: Kontrast zu Schwarz 4,623 > zu Weiss 4,542.
    expect(textColorForFill({ r: 118, g: 118, b: 118 })).toEqual(SCHWARZ);
  });

  it('[R-4.6-09] Kanalgewichte nach WCAG: reines Grün hell (Schwarz), reines Blau dunkel (Weiss)', () => {
    expect(textColorForFill({ r: 0, g: 255, b: 0 })).toEqual(SCHWARZ);
    expect(textColorForFill({ r: 0, g: 0, b: 255 })).toEqual(WEISS);
    // Nur Grün (Gewicht 0,7152): G 137 → L ≈ 0,1789 (Weiss 4,587 > Schwarz 4,578); G 138 → L ≈ 0,1818 (Schwarz).
    expect(textColorForFill({ r: 0, g: 137, b: 0 })).toEqual(WEISS);
    expect(textColorForFill({ r: 0, g: 138, b: 0 })).toEqual(SCHWARZ);
    // Grau 137 ist dagegen hell (L ≈ 0,2502): die Kanäle werden gewichtet, nicht gemittelt.
    expect(textColorForFill({ r: 137, g: 137, b: 137 })).toEqual(SCHWARZ);
  });

  it('[R-4.6-09] Kanal nicht ganzzahlig 0–255 → RangeError', () => {
    for (const fill of [
      { r: 256, g: 0, b: 0 },
      { r: 0, g: -1, b: 0 },
      { r: 0, g: 0, b: 1.5 },
      { r: Number.NaN, g: 0, b: 0 },
    ]) {
      expect(
        catchError(() => textColorForFill(fill)),
        JSON.stringify(fill),
      ).toBeInstanceOf(RangeError);
    }
  });

  it('[R-4.6-09] (V-02d-3) Block mit dunkler Füllung: Text weiss; mit Kp-Füllung schwarz', () => {
    const dunkel = kategorie('k9', { r: 0, g: 0, b: 128 });
    const plan = rasterPlan({
      over: { legend: [...kpLegend(), dunkel] },
      entries: [
        block('e1', 1, {
          date: MO,
          columns: { kind: 'ids', ids: [STD.p1] },
          categoryId: 'k9',
          title: rt('Nacht'),
        }),
        block('e2', 2, {
          date: MO,
          columns: { kind: 'ids', ids: [STD.p2] },
          categoryId: CAT.kp,
          title: rt('Tag'),
        }),
      ],
    });
    const L = lege(plan);
    expect(rechtecke(L, 'e1')[0]?.fill).toEqual({ r: 0, g: 0, b: 128 });
    expect(texte(L, 'e1').flatMap((t) => t.runs.map((r) => r.color))).toEqual([WEISS]);
    expect(texte(L, 'e2').flatMap((t) => t.runs.map((r) => r.color))).toEqual([SCHWARZ]);
  });
});

describe('categoryFill (2f «Füllung»)', () => {
  it('[R-4.6-48] Farbe der Kategorie in plan.legend', () => {
    const plan = basePlan();
    expect(categoryFill(plan, CAT.extern)).toEqual({ r: 191, g: 191, b: 191 });
    expect(categoryFill(plan, CAT.kp)).toEqual({ r: 255, g: 255, b: 153 });
  });

  it('[R-4.6-48] null oder unbekannt → erste Kategorie mit neutral: true', () => {
    const plan = basePlan({
      legend: [
        kategorie('k1', { r: 10, g: 20, b: 30 }),
        kategorie('k2', { r: 240, g: 240, b: 240 }, true),
        kategorie('k3', { r: 200, g: 200, b: 200 }, true),
      ],
    });
    expect(categoryFill(plan, null)).toEqual({ r: 240, g: 240, b: 240 });
    expect(categoryFill(plan, 'k999')).toEqual({ r: 240, g: 240, b: 240 });
    expect(categoryFill(plan, 'k3')).toEqual({ r: 200, g: 200, b: 200 });
  });

  it('[R-4.6-48] ohne neutrale Kategorie → Weiss', () => {
    const plan = basePlan({ legend: [kategorie('k1', { r: 10, g: 20, b: 30 })] });
    expect(categoryFill(plan, null)).toEqual(WEISS);
    expect(categoryFill(plan, 'k999')).toEqual(WEISS);
    expect(categoryFill(basePlan({ legend: [] }), null)).toEqual(WEISS);
  });
});

// @vitest-environment jsdom
// Paket E1-02d: Eigenschaften der Tagesbreiten (Vertrag E1-02d Abschnitt 2a Nr 2; Beschrieb 4.4; R-4.4-10, R-4.4-12;
// F-40). Zufällige Wochen mit festem Startwert (ADR-010 §5).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dayWidths } from '../../../../src/model/wap/layout/grid/geometry';
import type { DayDisplay } from '../../../../src/model/wap/types';
import { GRID_RUNS, GRID_SEED, raster, TAGE_DER_WOCHE } from '../../support/arbitraries/grid';
import { lege, nahe, rasterPlan, X0 } from '../../support/grid/build';

const OPTIONEN = { seed: GRID_SEED, numRuns: GRID_RUNS } as const;
const darstellung = fc.constantFrom<DayDisplay>('full', 'compact', 'hidden');

describe('dayWidths (Eigenschaften)', () => {
  it('[R-4.4-10] alle vollen Tage gleich breit, kompakte genau ein Drittel davon', () => {
    fc.assert(
      fc.property(
        fc.array(darstellung, { minLength: 1, maxLength: 7 }),
        fc.double({ min: 1, max: 2000, noNaN: true }),
        (tage, W) => {
          const w = dayWidths(
            tage.map((display) => ({ display })),
            W,
          );
          const voll = tage.flatMap((d, i) => (d === 'full' ? [w[i] as number] : []));
          const kompakt = tage.flatMap((d, i) => (d === 'compact' ? [w[i] as number] : []));
          for (const v of voll) nahe(v, voll[0] as number, 1e-6);
          if (voll.length > 0) for (const k of kompakt) nahe(k, (voll[0] as number) / 3, 1e-6);
        },
      ),
      OPTIONEN,
    );
  });

  it('[R-4.4-12] Summe = Gesamtbreite bei mindestens einem sichtbaren Tag; ausgeblendete 0; keiner sichtbar → alle 0', () => {
    fc.assert(
      fc.property(
        fc.array(darstellung, { minLength: 1, maxLength: 7 }),
        fc.double({ min: 1, max: 2000, noNaN: true }),
        (tage, W) => {
          const w = dayWidths(
            tage.map((display) => ({ display })),
            W,
          );
          expect(w).toHaveLength(tage.length);
          tage.forEach((d, i) => {
            if (d === 'hidden') expect(w[i]).toBe(0);
            else expect(w[i] as number).toBeGreaterThan(0);
          });
          const summe = w.reduce((a, b) => a + b, 0);
          if (tage.some((d) => d !== 'hidden')) nahe(summe, W, 1e-6);
          else expect(summe).toBe(0);
        },
      ),
      OPTIONEN,
    );
  });
});

describe('layoutGrid (Eigenschaften der Tage)', () => {
  it('[R-4.4-10] zufällige Wochen (Darstellung, Spaltensätze verschiedener Grösse): volle Tage gleich breit', () => {
    fc.assert(
      fc.property(raster(), (r) => {
        const L = lege(rasterPlan({ sets: r.sets, tage: r.tage, range: r.range }), {
          W: r.W,
          ppm: r.ppm,
        });
        const voll = L.days.filter((d) => d.display === 'full');
        for (const d of voll) nahe(d.w, voll[0]?.w ?? 0, 0.01);
        const kompakt = L.days.filter((d) => d.display === 'compact');
        if (voll.length > 0) for (const d of kompakt) nahe(d.w, (voll[0]?.w ?? 0) / 3, 0.01);
      }),
      OPTIONEN,
    );
  });

  it('[R-4.4-12] zufällige Wochen: nur sichtbare Tage in Wochenreihenfolge, lückenlos ab X0, Summe = Tagesfläche', () => {
    fc.assert(
      fc.property(raster(false), (r) => {
        const L = lege(rasterPlan({ sets: r.sets, tage: r.tage, range: r.range }), {
          W: r.W,
          ppm: r.ppm,
        });
        const sichtbar = TAGE_DER_WOCHE.filter((_, i) => r.tage[i]?.display !== 'hidden');
        expect(L.days.map((d) => d.date)).toEqual(sichtbar);
        let x = X0;
        for (const d of L.days) {
          nahe(d.x, x, 0.01);
          x += d.w;
        }
        if (sichtbar.length > 0) nahe(x, X0 + r.W, 0.01);
        nahe(L.band.w, r.W, 0.01);
      }),
      OPTIONEN,
    );
  });
});

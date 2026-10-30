// @vitest-environment node
// Paket GB-LAYOUT, Gate B (Auftraggeber 28.10.2026 «All as recommended»):
// 17a (VQA-2-04, VQA-3-02; R-4.6-15): Der flache Marker endet auf der genannten Zeit (wie die Referenz, z.B. «ABV 2300»
// 2230–2300), statt dort zu beginnen; am Anfang des Zeitbereichs beginnt er an y(V0).
// 18a (VQA-3-03; R-4.6-12, R-14.3-01): Das Beschriftungsfeld eines Linienmarkers weicht Blöcken aus – unter der Linie,
// sonst mittig auf der Linie (wie die Referenz), sonst darüber, solange es dort keine Blockfläche überdeckt; erst ohne
// freie Lage wie bisher.
// Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { EntryPiece } from '../../../../src/model/wap/layout/grid/types';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';
import { lege, MO, PPM, rasterPlan, STD, teile, texte, yZeit } from '../../support/grid/build';
import { block, marker, rt } from '../../support/model/builders';

function schnitt(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.001 && h > 0.001;
}

describe('GB-LAYOUT 17a: flacher Marker endet auf der Zeit (R-4.6-15)', () => {
  it('[R-4.6-15] ABV 2300 flach (Vorgabe 30 Min): Rechteck 2230–2300, Beschriftung darin', () => {
    const m = marker('e1', 1, { date: MO, at: 1380, kind: 'ABV', asFlatBlock: true });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect as Rect;
    expect(r.y).toBeCloseTo(yZeit(1350), 6);
    expect(r.y + r.h).toBeCloseTo(yZeit(1380), 6);
    expect(texte(L, 'e1')).toHaveLength(1);
  });

  it('[R-4.6-15] Dauer aus dem Plan (flatBlockMinutes 15): Rechteck at − 15 Min bis at', () => {
    const m = marker('e1', 1, {
      date: MO,
      at: 600,
      kind: 'HV',
      asFlatBlock: true,
      flatBlockMinutes: 15,
    });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect as Rect;
    expect(r.y).toBeCloseTo(yZeit(585), 6);
    expect(r.h).toBeCloseTo(15 * PPM, 6);
  });

  it('[R-4.6-15] am Anfang des Zeitbereichs (0510, V0 = 0500): beginnt an y(V0), 0,5 h lang', () => {
    const m = marker('e1', 1, { date: MO, at: 310, kind: 'AV', asFlatBlock: true });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect as Rect;
    expect(r.y).toBeCloseTo(yZeit(300), 6);
    expect(r.y + r.h).toBeCloseTo(yZeit(330), 6);
  });

  it('[R-4.6-15] 2400 am Ende des Zeitbereichs: 2330–2400 wie bisher', () => {
    const m = marker('e1', 1, { date: MO, at: 1440, kind: 'HV', asFlatBlock: true });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect as Rect;
    expect(r.y).toBeCloseTo(yZeit(1410), 6);
    expect(r.y + r.h).toBeCloseTo(yZeit(1440), 6);
  });
});

describe('GB-LAYOUT 18a: Markerfeld weicht Blöcken aus (R-4.6-12)', () => {
  const ab1730 = block('b1', 2, {
    date: MO,
    time: { form: 'range', from: 1050, to: 1200 },
    columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
    title: rt('Ausbildung'),
  });

  it('[R-4.6-12][R-14.3-01] HV 1715 knapp über einem Block ab 1730: Feld überdeckt den Block nicht (mittig auf der Linie)', () => {
    const m = marker('e1', 1, { date: MO, at: 1035, kind: 'HV' });
    const L = lege(rasterPlan({ entries: [ab1730, m] }));
    const feld = teile(L, 'e1').find((p) => p.kind === 'markerField') as EntryPiece;
    expect(feld).toBeDefined();
    const b = teile(L, 'b1')[0]?.rect as Rect;
    expect(schnitt(feld.rect, b)).toBe(false);
    expect(feld.rect.y).toBeLessThan(yZeit(1035));
    expect(feld.rect.y + feld.rect.h).toBeGreaterThan(yZeit(1035));
    expect(texte(L, 'e1').length).toBe(1);
  });

  it('[R-4.6-12] Block direkt ab der Linie (mittig auch belegt): Feld darüber', () => {
    const ab1715 = block('b2', 3, {
      date: MO,
      time: { form: 'range', from: 1035, to: 1200 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Ausbildung'),
    });
    const m = marker('e1', 1, { date: MO, at: 1035, kind: 'HV' });
    const L = lege(rasterPlan({ entries: [ab1715, m] }));
    const feld = teile(L, 'e1').find((p) => p.kind === 'markerField') as EntryPiece;
    const b = teile(L, 'b2')[0]?.rect as Rect;
    expect(schnitt(feld.rect, b)).toBe(false);
    expect(feld.rect.y + feld.rect.h).toBeLessThanOrEqual(yZeit(1035) + 1e-6);
  });

  it('[R-4.6-12] ohne Block darunter: Feld wie bisher unter der Linie (Gegenprobe)', () => {
    const m = marker('e1', 1, { date: MO, at: 1035, kind: 'HV' });
    const L = lege(rasterPlan({ entries: [m] }));
    const feld = teile(L, 'e1').find((p) => p.kind === 'markerField') as EntryPiece;
    expect(feld.rect.y).toBeGreaterThan(yZeit(1035));
  });

  it('[R-4.6-12][R-4.6-59] Marker mitten im Block (oben und unten belegt): Feld wie bisher unter der Linie', () => {
    const m = marker('e1', 1, { date: MO, at: 1110, kind: 'HV' });
    const L = lege(rasterPlan({ entries: [ab1730, m] }));
    const feld = teile(L, 'e1').find((p) => p.kind === 'markerField') as EntryPiece;
    expect(feld.rect.y).toBeGreaterThan(yZeit(1110));
  });
});

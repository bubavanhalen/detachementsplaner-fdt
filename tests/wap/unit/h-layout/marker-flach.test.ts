// @vitest-environment node
// Paket H-LAYOUT, Zusatzbefund visual-qa (f) (R-4.6-15; Beschrieb 4.6 Marker «wahlweise als flacher Block»): Der
// flache Block ist ein Block von 0,5 h ab dem Zeitpunkt mit der Beschriftung darin (Referenz: Block 0,5 h mit Text),
// kein 1,56-pt-Balken mit Feld. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { textBounds } from '../../../../src/model/wap/layout/entries/outsideLabel';
import {
  lege,
  MO,
  PPM,
  rasterPlan,
  STD,
  teile,
  texte,
  yZeit,
  zeilenText,
} from '../../support/grid/build';
import { marker } from '../../support/model/builders';

describe('Marker als flacher Block (R-4.6-15)', () => {
  // GB-LAYOUT 17a (Gate B, Auftraggeber 28.10.2026): der flache Block endet auf der genannten Zeit.
  it('[R-4.6-15] ABV 2330 als flacher Block: Rechteck 2300–2330 über die Spalten, Beschriftung «ABV 2330» darin, kein Feld, keine Linie', () => {
    const m = marker('e1', 1, {
      date: MO,
      at: 1410,
      kind: 'ABV',
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      asFlatBlock: true,
    });
    const L = lege(rasterPlan({ entries: [m] }));
    const teileM = teile(L, 'e1');
    expect(teileM.map((p) => p.kind)).toEqual(['markerLine']);
    const r = teileM[0]?.rect;
    expect(r).toBeDefined();
    if (r === undefined) return;
    expect(r.y).toBeCloseTo(yZeit(1380), 6);
    expect(r.h).toBeCloseTo(30 * PPM, 6);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['ABV 2330']);
    const u = textBounds(z[0] as (typeof z)[number]);
    expect(u.x).toBeGreaterThanOrEqual(r.x);
    expect(u.y).toBeGreaterThanOrEqual(r.y);
    expect(u.x + u.w).toBeLessThanOrEqual(r.x + r.w);
    expect(u.y + u.h).toBeLessThanOrEqual(r.y + r.h);
    expect(L.items.filter((i) => i.entryId === 'e1' && i.kind === 'line')).toEqual([]);
    expect(L.fallbacks.filter((e) => e.entryId === 'e1')).toEqual([]);
  });

  it('[R-4.6-15] am Ende des Zeitbereichs: flacher Block endet an y(V1) und reicht 0,5 h davor', () => {
    const m = marker('e1', 1, { date: MO, at: 1440, kind: 'HV', asFlatBlock: true });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect;
    expect(r?.y).toBeCloseTo(yZeit(1410), 6);
    expect((r?.y ?? 0) + (r?.h ?? 0)).toBeCloseTo(yZeit(1440), 6);
  });

  it('[R-4.6-15] Dauer aus dem Plan (flatBlockMinutes 15): Rechteck at − 15 Min bis at (GB-LAYOUT 17a)', () => {
    const m = marker('e1', 1, {
      date: MO,
      at: 600,
      kind: 'HV',
      asFlatBlock: true,
      flatBlockMinutes: 15,
    });
    const L = lege(rasterPlan({ entries: [m] }));
    const r = teile(L, 'e1')[0]?.rect;
    expect(r?.y).toBeCloseTo(yZeit(585), 6);
    expect(r?.h).toBeCloseTo(15 * PPM, 6);
  });

  it('[R-4.6-15][R-4.6-59] (CR-TE-HL-03-01) Linienmarker HV 2400 neben flachem ABV 2330: Feld und Text des HV liegen nicht im flachen Block, dessen Beschriftung bleibt', () => {
    const cols = { kind: 'ids' as const, ids: [STD.p1, STD.p2, STD.p3] };
    const flach = marker('e1', 1, {
      date: MO,
      at: 1410,
      kind: 'ABV',
      columns: cols,
      asFlatBlock: true,
    });
    const linie = marker('e2', 2, { date: MO, at: 1440, kind: 'HV', columns: cols });
    const L = lege(rasterPlan({ entries: [flach, linie] }));
    const block = teile(L, 'e1')[0]?.rect;
    expect(block).toBeDefined();
    if (block === undefined) return;
    const innen = (r: { x: number; y: number; w: number; h: number }) =>
      Math.min(r.x + r.w, block.x + block.w) - Math.max(r.x, block.x) > 0.01 &&
      Math.min(r.y + r.h, block.y + block.h) - Math.max(r.y, block.y) > 0.01;
    for (const p of teile(L, 'e2', 'markerField')) expect(innen(p.rect)).toBe(false);
    for (const z of texte(L, 'e2')) expect(innen(textBounds(z))).toBe(false);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['ABV 2330']);
  });
});

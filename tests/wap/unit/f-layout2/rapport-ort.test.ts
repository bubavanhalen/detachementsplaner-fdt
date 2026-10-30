// @vitest-environment node
// Paket F-LAYOUT2, Entscheid Auftraggeber 19.10.2026 «13: ja» (Q-HL-03 Kat. C; Abweichung von Beschrieb 10
// «Rückfallregel» für den Ort eines Rapports): Passt «(‹Ort›)» nicht ins Rapport-Kästchen, steht er vollständig
// daneben im freien Bereich des Tages, wie das Kürzel nach E1-02l R2 (R-10-55), statt wegzufallen. Befund P8 nur,
// wenn auch daneben kein freier Platz ist. Fiktive Kürzel und Orte; Raster nach E1-02d (Testhilfe `lege`).
import { describe, expect, it } from 'vitest';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry } from '../../../../src/model/wap/types';
import { geo, lege, MO, rasterPlan, STD, texte, zeilenText } from '../../support/grid/build';
import { block, rapport, rt } from '../../support/model/builders';

/** Rap-Spalte 80 · 1/9 ≈ 8,9 pt wie in den Zug-Wochen; 2 h bei 0,3 pt/Min = 36 pt. */
const W = 80;

function umriss(t: TextItem): Rect {
  const m = fontMetrics();
  const a = ascentPt(t.sizePt);
  const d = (-m.descender * t.sizePt) / m.unitsPerEm;
  const w = measureRuns(
    t.runs.map((r) => ({ text: r.text, weight: r.weight })),
    t.sizePt,
  );
  if (t.rotation === 0) return { x: t.x, y: t.baselineY - a, w, h: a + d };
  return { x: t.x - a, y: t.baselineY - w, w: a + d, h: w };
}

function schnitt(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.001 && h > 0.001;
}

const rap = (over: Partial<Parameters<typeof rapport>[2]> = {}): Entry =>
  rapport('r1', 1, {
    date: MO,
    code: 'KR',
    time: { form: 'range', from: 1140, to: 1260 },
    ort: 'Werkhof Nord',
    ...over,
  });

const alleTexte = (L: GridLayout): TextItem[] =>
  L.items.filter((i): i is TextItem => i.kind === 'text');

describe('F-LAYOUT2 Punkt 13: Ort eines Rapports neben dem Kästchen', () => {
  it('[R-10-55][R-10-41] Ort passt nicht ins Kästchen: Kürzel im Kästchen, «(Ort)» vollständig daneben im freien Bereich, kein Rückfall', () => {
    const L = lege(rasterPlan({ entries: [rap()] }), { W });
    expect(L.fallbacks.filter((f) => f.entryId === 'r1')).toEqual([]);
    const g = geo(L, 'r1');
    const box = g.pieces.find((p) => p.kind === 'rapportBox');
    const label = g.pieces.find((p) => p.kind === 'outsideLabel');
    expect(box).toBeDefined();
    expect(label).toBeDefined();
    const t = texte(L, 'r1');
    const ort = t.filter((x) => zeilenText(x) === '(Werkhof Nord)');
    expect(ort).toHaveLength(1);
    const o = ort[0] as TextItem;
    expect(o.sizePt).toBeGreaterThanOrEqual(4.5);
    // Daneben, nicht im Kästchen; im Tag; über keinem anderen Text.
    expect(schnitt(umriss(o), box?.rect as Rect)).toBe(false);
    const day = L.days[0];
    const u = umriss(o);
    expect(u.x).toBeGreaterThanOrEqual((day?.x ?? 0) - 0.01);
    expect(u.x + u.w).toBeLessThanOrEqual((day?.x ?? 0) + (day?.w ?? 0) + 0.01);
    for (const other of alleTexte(L)) {
      if (other === o) continue;
      expect(schnitt(umriss(other), u), zeilenText(other)).toBe(false);
    }
    // Das Kürzel steht im Kästchen.
    expect(t.some((x) => zeilenText(x) === 'KR' && schnitt(umriss(x), box?.rect as Rect))).toBe(
      true,
    );
  });

  it('[R-10-55][R-10-41] Ort passt ins Kästchen (breite Rap-Spalte): kein Träger daneben, kein Rückfall', () => {
    const L = lege(rasterPlan({ entries: [rap({ ort: 'Hof' })] }), { W: 180 });
    expect(geo(L, 'r1').pieces.some((p) => p.kind === 'outsideLabel')).toBe(false);
    expect(L.fallbacks.filter((f) => f.entryId === 'r1')).toEqual([]);
  });

  it('[R-10-55][R-7-11] auch daneben kein freier Platz (Planungsspalten ganztags belegt): Ort entfällt mit Befund P8 lineDropped «ort»', () => {
    const voll = block('b1', 2, {
      date: MO,
      time: { form: 'range', from: 300, to: 1440 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Ganztags'),
    });
    const ortText = '(Werkhof Nord Ost)';
    const L = lege(rasterPlan({ entries: [voll, rap({ ort: 'Werkhof Nord Ost' })] }), { W });
    // Vorbedingung: Rap- und Beso-Spalte zusammen sind schmaler als der Ort in Mindestgrösse.
    const frei = (L.days[0]?.columns ?? [])
      .filter((c) => c.kind === 'rap' || c.kind === 'beso')
      .reduce((s, c) => s + c.w, 0);
    expect(measureRuns([{ text: ortText, weight: 'regular' }], 4.5)).toBeGreaterThan(frei);
    expect(L.fallbacks.filter((f) => f.entryId === 'r1').map((f) => [f.kind, f.dropped])).toEqual([
      ['lineDropped', ['ort']],
    ]);
    expect(texte(L, 'r1').some((x) => zeilenText(x).includes('Werkhof'))).toBe(false);
  });

  it('[R-10-55] Kürzel passt nicht ins Kästchen: Kürzel und «(Ort)» zusammen daneben (ein Träger), Befund nur für das Kürzel', () => {
    const code = 'ARKXYZQRS';
    const L = lege(
      rasterPlan({ entries: [rap({ code, time: { form: 'range', from: 1140, to: 1200 } })] }),
      { W },
    );
    // Vorbedingung: das Kürzel passt in Mindestgrösse weder waagrecht noch senkrecht ins Kästchen.
    const box = geo(L, 'r1').pieces.find((p) => p.kind === 'rapportBox')?.rect as Rect;
    const lang = measureRuns([{ text: code, weight: 'bold' }], 4.5);
    expect(lang).toBeGreaterThan(Math.max(box.w, box.h));
    const ev = L.fallbacks.filter((f) => f.entryId === 'r1');
    expect(ev.map((f) => [f.kind, f.dropped])).toEqual([['labelOutside', []]]);
    expect(texte(L, 'r1').map(zeilenText)).toContain(`${code} (Werkhof Nord)`);
  });
});

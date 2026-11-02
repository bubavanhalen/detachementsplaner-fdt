// @vitest-environment node
// Paket E1-02l R2 (R-10-55; Auftraggeber 09.10.2026): Rapportkürzel und Beso-Nummern nie gekürzt – je Grössenstufe
// zuerst waagrecht, dann senkrecht, erst danach verkleinert; passt es nicht, vollständig in einem eigenen Träger
// neben dem Kästchen im nächsten freien Bereich (nie über fremdem Text oder einem Kästchen), mit Befund P8
// 'labelOutside'. Fiktive Kürzel und Nummern; Raster nach E1-02d (Testhilfe `lege`).
import { describe, expect, it } from 'vitest';
import type { EntryPiece, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry } from '../../../../src/model/wap/types';
import { geo, lege, MO, rasterPlan, STD, texte, zeilenText } from '../../support/grid/build';
import { beso, block, rapport, rt, win } from '../../support/model/builders';

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

function innen(a: Rect, b: Rect): boolean {
  return (
    a.x >= b.x - 0.01 &&
    a.y >= b.y - 0.01 &&
    a.x + a.w <= b.x + b.w + 0.01 &&
    a.y + a.h <= b.y + b.h + 0.01
  );
}

/** Drei bzw. vier gleichzeitige Beso in der Beso-Spalte (Nummern dreistellig). */
function gleichzeitig(n: number): Entry[] {
  return Array.from({ length: n }, (_, i) =>
    beso(`b${String(i)}`, i + 1, {
      date: MO,
      besoNumber: 100 + i,
      windows: [win(`w${String(i)}`, { time: { form: 'point', at: 600 } })],
    }),
  );
}

/** Beschriftungsträger neben dem Kästchen und ihr Text. */
function aussen(L: GridLayout, id: string): { teil: EntryPiece; text: TextItem }[] {
  const g = geo(L, id);
  return g.pieces
    .filter((p) => p.kind === 'outsideLabel')
    .map((teil) => {
      const text = texte(L, id).find((t) => innen(t.frame, teil.rect)) as TextItem;
      return { teil, text };
    });
}

describe('Beso-Nummer (R-10-55)', () => {
  it('[R-10-55] passt waagrecht: Nummer im Kästchen, waagrecht in 5 pt, kein Ereignis', () => {
    const L = lege(rasterPlan({ entries: [beso('e1', 1, { date: MO, besoNumber: 7 })] }));
    const [t] = texte(L, 'e1');
    expect(zeilenText(t as TextItem)).toBe('7');
    expect(t?.rotation).toBe(0);
    expect(t?.sizePt).toBe(5);
    expect(L.fallbacks.filter((e) => e.entryId === 'e1')).toEqual([]);
  });

  it('[R-10-55] drei gleichzeitige Beso, schmale Bahn: zuerst senkrecht in 5 pt statt verkleinert', () => {
    const L = lege(rasterPlan({ entries: gleichzeitig(3) }), { W: 100, ppm: 0.4 });
    for (let i = 0; i < 3; i++) {
      const g = geo(L, `b${String(i)}`);
      const box = g.pieces.find((p) => p.kind === 'besoBox') as EntryPiece;
      const breite = measureRuns([{ text: String(100 + i), weight: 'regular' }], 5);
      // Waagrecht passt die Nummer nicht in die Bahn (Breite abzüglich Innenabstand und Strich).
      expect(breite).toBeGreaterThan(box.rect.w - 1);
      const [t] = texte(L, `b${String(i)}`);
      expect(zeilenText(t as TextItem)).toBe(String(100 + i));
      expect(t?.rotation).toBe(90);
      expect(t?.sizePt).toBe(5);
      expect(g.pieces.some((p) => p.kind === 'outsideLabel')).toBe(false);
    }
  });

  it('[R-10-55] vier gleichzeitige Beso in sehr schmaler Spalte: Nummer vollständig im Träger neben dem Kästchen, Ereignis labelOutside am Eintrag', () => {
    const L = lege(rasterPlan({ entries: gleichzeitig(4) }), { W: 60 });
    for (let i = 0; i < 4; i++) {
      const id = `b${String(i)}`;
      const labels = aussen(L, id);
      expect(labels, id).toHaveLength(1);
      const { teil, text } = labels[0] as { teil: EntryPiece; text: TextItem };
      expect(zeilenText(text)).toBe(String(100 + i));
      expect(text.sizePt).toBeGreaterThanOrEqual(4.5);
      expect(innen(umriss(text), teil.rect)).toBe(true);
      const g = geo(L, id);
      const index = g.pieces.indexOf(teil);
      expect(g.pieces[teil.part]?.kind).toBe('besoBox');
      const ev = L.fallbacks.filter((e) => e.entryId === id);
      expect(ev).toEqual([
        {
          kind: 'labelOutside',
          region: 'block',
          weekId: 'w26',
          date: MO,
          entryId: id,
          piece: index,
          dropped: [],
        },
      ]);
    }
  });
});

describe('Rapportkürzel (R-10-55)', () => {
  it('[R-10-55] schmale Rap-Spalte: Kürzel nie mit «…», vollständig neben dem Kästchen; Text im Träger, mit «(‹Ort›)» (F-LAYOUT2 Punkt 13, Entscheid 19.10.2026 «13: ja»)', () => {
    const L = lege(
      rasterPlan({ entries: [rapport('r1', 1, { date: MO, code: 'ARKX', ort: 'Kdo Raum' })] }),
      { W: 90 },
    );
    const alle = texte(L, 'r1').map(zeilenText);
    for (const t of alle) expect(t).not.toContain('…');
    const labels = aussen(L, 'r1');
    expect(labels).toHaveLength(1);
    expect(zeilenText((labels[0] as { text: TextItem }).text)).toBe('ARKX (Kdo Raum)');
    expect(L.fallbacks.find((e) => e.entryId === 'r1')?.kind).toBe('labelOutside');
    expect(L.fallbacks.find((e) => e.entryId === 'r1')?.dropped).toEqual([]);
  });

  it('[R-10-55] Kürzel passt: im Kästchen, kein Träger, kein Ereignis', () => {
    const L = lege(rasterPlan({ entries: [rapport('r1', 1, { date: MO, code: 'KR' })] }));
    expect(aussen(L, 'r1')).toEqual([]);
    expect(texte(L, 'r1').map(zeilenText)).toContain('KR');
    expect(L.fallbacks.filter((e) => e.entryId === 'r1')).toEqual([]);
  });

  it('[R-10-55] Rapport-Block in schmaler Planungsspalte: Kürzel nie gekürzt', () => {
    const L = lege(
      rasterPlan({
        entries: [
          rapport('r1', 1, {
            date: MO,
            code: 'ARKXYZ',
            display: 'onlyInColumns',
            displayColumns: { kind: 'ids', ids: [STD.p1] },
            time: { form: 'range', from: 600, to: 615 },
          }),
        ],
      }),
      { W: 60 },
    );
    for (const t of texte(L, 'r1').map(zeilenText)) expect(t).not.toContain('…');
    expect(texte(L, 'r1').map(zeilenText).join('')).toContain('ARKXYZ');
  });
});

describe('Träger im freien Bereich (R-10-55)', () => {
  it('[R-10-55] Träger schneidet kein Kästchen, keinen fremden Text und keinen anderen Träger; liegt im Tag unter dem Band', () => {
    const entries: Entry[] = [
      ...gleichzeitig(4),
      block('k1', 10, {
        date: MO,
        time: { form: 'range', from: 540, to: 660 },
        columns: { kind: 'ids', ids: [STD.p3] },
        title: rt('Ausbildung'),
      }),
      rapport('r1', 11, { date: MO, code: 'ARKX', time: { form: 'range', from: 600, to: 630 } }),
    ];
    const L = lege(rasterPlan({ entries }), { W: 60 });
    const tag = L.days[0] as GridLayout['days'][number];
    const unterBand = L.band.y + L.band.h;
    const kaesten = L.entries.flatMap((g) =>
      g.pieces
        .filter((p) => p.kind === 'besoBox' || p.kind === 'rapportBox' || p.kind === 'outsideLabel')
        .map((p) => ({ id: g.entryId, p })),
    );
    const textUmrisse = L.items
      .filter((i): i is TextItem => i.kind === 'text')
      .map((t) => ({ t, r: umriss(t) }));
    const traeger = kaesten.filter((k) => k.p.kind === 'outsideLabel');
    expect(traeger.length).toBeGreaterThan(0);
    for (const { id, p } of traeger) {
      expect(p.rect.x).toBeGreaterThanOrEqual(tag.x - 0.01);
      expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(tag.x + tag.w + 0.01);
      expect(p.rect.y).toBeGreaterThanOrEqual(unterBand - 0.01);
      for (const k of kaesten) {
        if (k.p === p) continue;
        expect(schnitt(p.rect, k.p.rect), `${id} / ${k.id} ${k.p.kind}`).toBe(false);
      }
      for (const { t, r } of textUmrisse) {
        if (innen(r, p.rect)) continue;
        expect(schnitt(p.rect, r), `${id} über «${zeilenText(t)}»`).toBe(false);
      }
    }
  });
});

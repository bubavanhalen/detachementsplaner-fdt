// @vitest-environment node
// Paket F-LAYOUT2, Entscheid Auftraggeber 19.10.2026 «12: ja» (Q-HL-03 Kat. B; bewusste Abweichung von Beschrieb 4.4
// «Nebenspalte 1», R-4.4-13 mit Änderungsnotiz F-LAYOUT2): Die Nebenspalte hat das Gewicht 2 wie eine normale
// Planungsspalte, damit ein Block in «Det» Titel und Ltg in zwei senkrechten Zeilen fasst (rueckfaelle-echt Kat. B).
// Fiktive Spalten und Texte.
import { describe, expect, it } from 'vitest';
import { columnWeight, columnWidths } from '../../../../src/model/wap/layout/grid/geometry';
import type { Column } from '../../../../src/model/wap/types';
import { lege, MO, nurMontag, rasterPlan, satz } from '../../support/grid/build';
import { block, rt } from '../../support/model/builders';

const sp = (kind: Column['kind'], weight: Column['weight'] = 'normal') => ({ kind, weight });

describe('F-LAYOUT2 Punkt 12: Nebenspalte Gewicht 2', () => {
  it('[R-4.4-13] Nebenspalte hat das Gewicht 2, ihr gespeichertes Gewicht wirkt nicht', () => {
    for (const w of ['narrow', 'normal', 'wide'] as const) {
      expect(columnWeight(sp('secondary', w)), `secondary ${w}`).toBe(2);
    }
  });

  it('[R-4.4-13] je eine Spalte jeder Art: Breiten 1 : 2 : 3 : 2 : 1 : 2, Tagesbreite bleibt', () => {
    const w = columnWidths(
      [
        sp('planning', 'narrow'),
        sp('planning', 'normal'),
        sp('planning', 'wide'),
        sp('secondary', 'narrow'),
        sp('rap'),
        sp('beso'),
      ],
      132,
    );
    [12, 24, 36, 24, 12, 24].forEach((soll, i) => {
      expect(w[i], `Spalte ${String(i)}`).toBeCloseTo(soll, 9);
    });
  });

  it('[R-4.4-13][R-10-41] Block in der Nebenspalte (3 h): Titel und Ltg stehen vollständig, kein Rückfall', () => {
    const set = satz('s1', [
      { id: 'p1', kind: 'planning' },
      { id: 'p2', kind: 'planning' },
      { id: 'p3', kind: 'planning' },
      { id: 'p4', kind: 'planning' },
      { id: 'p5', kind: 'planning' },
      { id: 'p6', kind: 'planning' },
      { id: 'det', kind: 'secondary' },
      { id: 'rap', kind: 'rap' },
      { id: 'beso', kind: 'beso' },
    ]);
    const e = block('e1', 1, {
      date: MO,
      time: { form: 'range', from: 780, to: 960 },
      columns: { kind: 'ids', ids: ['det'] },
      title: rt('Ausb Mun Det', true),
      ltg: 'Wm Muster',
    });
    // Tag wie die Kp-Woche: 115 pt breit, Anzeige 0400–2400 mit 0,3 pt/Min (3 h = 54 pt).
    const L = lege(rasterPlan({ sets: [set], tage: nurMontag('s1'), entries: [e] }), { W: 115 });
    expect(L.fallbacks.filter((f) => f.entryId === 'e1')).toEqual([]);
    const det = L.days[0]?.columns.find((c) => c.columnId === 'det');
    expect(det?.w).toBeCloseTo((115 * 2) / 17, 6);
  });
});

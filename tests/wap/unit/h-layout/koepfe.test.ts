// @vitest-environment node
// Paket H-LAYOUT, Zusatzbefund visual-qa (a) (R-10-54; AE-006 Entscheid «2 a»): Ein Spaltenkopf, der nicht in seine
// Spalte passt, bleibt im Kopfbereich – waagrecht nur, wenn er dort (seitlich verschoben) Platz hat, sonst senkrecht;
// er ragt nicht über die Kopf-Unterlinie ins Band, solange der Kopfbereich eine freie Lage bietet. Fiktive Spalten
// (Namen aus den Beispielen in Beschrieb 4.4).
import { describe, expect, it } from 'vitest';
import { textBounds } from '../../../../src/model/wap/layout/entries/outsideLabel';
import {
  type ColumnHeadInput,
  headBounds,
  layoutColumnHeads,
} from '../../../../src/model/wap/layout/page/columnHeads';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import type { ColumnSet } from '../../../../src/model/wap/types';
import { rasterPlan, satz } from '../../support/grid/build';
import { col } from '../../support/model/builders';
import { seite } from '../../support/page/seite';

const SIZES = { standard: 5, min: 4.5 };

function kopf(name: string, frame: Rect): ColumnHeadInput {
  return {
    columnId: `c-${name}`,
    runs: [{ text: name, weight: 'bold' }],
    frame,
    frameV: frame,
    prefer: 'horizontal',
    hyphenate: 'ifWordDoesNotFit',
  };
}

describe('Überlaufender Spaltenkopf bleibt im Kopfbereich (R-10-54)', () => {
  it('[R-10-54] schmale Spalte, freier Kopfbereich daneben: Zeilen ganz im Kopfbereich, nicht darunter im Band', () => {
    const area: Rect = { x: 0, y: 0, w: 60, h: 11 };
    const band: Rect = { ...area, h: 40 };
    const [h] = layoutColumnHeads(
      [kopf('Alpha Beta Gamma', { x: 28, y: 0, w: 4, h: 11 })],
      { area, extended: band, blocked: [] },
      SIZES,
    );
    expect(h?.result).toBe('overflow');
    const b = headBounds(h?.lines ?? []) as Rect;
    expect(b.y).toBeGreaterThanOrEqual(area.y - 1e-6);
    expect(b.y + b.h).toBeLessThanOrEqual(area.y + area.h + 1e-6);
    expect(
      (h?.lines ?? [])
        .map((l) => l.runs.map((r) => r.text).join(''))
        .join(' ')
        .replace(/-\s/g, ''),
    ).toBe('Alpha Beta Gamma');
  });

  it('[R-10-54] Wochenseite mit Zug-Spalten (5 Planungsspalten Mo–Fr voll, Wochenende kompakt mit einer Spalte): kein Kopf ragt ins Band', () => {
    const namen = ['SERVIZIO', 'COBRA 10', 'COBRA 20', 'FALCON', 'HAWK'];
    const s: ColumnSet = satz('s1', [
      ...namen.map((_, i) => ({ id: `p${String(i)}`, kind: 'planning' as const })),
      { id: 'rap', kind: 'rap' as const },
      { id: 'beso', kind: 'beso' as const },
    ]);
    const set: ColumnSet = {
      ...s,
      columns: s.columns.map((c, i) =>
        c.kind === 'planning' ? col(c.id, namen[i] as string, 'planning') : c,
      ),
    };
    const wochenende: ColumnSet = satz('s2', [
      { id: 'w0', kind: 'planning' },
      { id: 'wr', kind: 'rap' },
      { id: 'wb', kind: 'beso' },
    ]);
    const tage = ['full', 'full', 'full', 'full', 'full', 'compact', 'compact'] as const;
    const plan = rasterPlan({
      sets: [
        set,
        {
          ...wochenende,
          columns: wochenende.columns.map((c) =>
            c.kind === 'planning' ? col(c.id, 'Kp', 'planning') : c,
          ),
        },
      ],
      tage: tage.map((display, i) => ({ set: i < 5 ? 's1' : 's2', display })),
    });
    const L = seite(plan, 'w26');
    const koepfe = (L.pages[0]?.items ?? []).filter(
      (i): i is TextItem => i.kind === 'text' && i.role === 'columnHeader',
    );
    expect(koepfe.length).toBeGreaterThan(0);
    for (const t of koepfe) {
      const b = textBounds(t);
      expect(b.y + b.h, t.runs.map((r) => r.text).join('')).toBeLessThanOrEqual(
        L.grid.band.y + 1e-6,
      );
      expect(t.sizePt).toBeGreaterThanOrEqual(4.5);
    }
  });
});

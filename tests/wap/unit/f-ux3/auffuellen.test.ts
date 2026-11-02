// @vitest-environment node
// F-UX3 (Rückmeldung des Auftraggebers vom 21.10.2026: «Beim Doppelklick auf einen Block wird ABV nicht
// berücksichtigt»; Entscheid Koordinator, Bestätigung Gate B; Änderungsnotiz R-5.1-28): Auffüllen bis zur Kante hält
// auch an Markern (AV, ABV, HV, frei) an. Seit dem Entscheid des Auftraggebers vom 21.10.2026 gelten Marker immer über
// alle Planungsspalten: jeder Marker des Tags begrenzt, auch einer mit gespeicherter anderer Spalte. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { fillTarget } from '../../../../src/components/wap/i2/fill';
import type { Block, MarkerKind, Plan } from '../../../../src/model/wap/types';
import { basePlan, block, marker, withEntries } from '../../support/model/builders';

const MO = '2026-09-28';

function plan(markers: { at: number; kind: MarkerKind; ids: string[] | 'all' }[]): Plan {
  return withEntries(basePlan({ id: 'fux3-auffuellen' }), [
    block('b', 1, {
      date: MO,
      time: { form: 'range', from: 600, to: 660 },
      columns: { kind: 'ids', ids: ['c8'] },
    }),
    ...markers.map((m, i) =>
      marker(`m${String(i)}`, 10 + i, {
        date: MO,
        at: m.at,
        kind: m.kind,
        ...(m.kind === 'custom' ? { customKind: 'Appell' } : {}),
        columns: m.ids === 'all' ? { kind: 'all' } : { kind: 'ids', ids: m.ids },
      }),
    ),
  ]);
}

const b = (p: Plan) => p.entries.b as Block;

describe('F-UX3: Auffüllen hält an jedem Marker des Tags', () => {
  it('[R-5.1-28] unten bis zum ABV, oben bis zum AV in derselben Spalte', () => {
    const p = plan([
      { at: 1320, kind: 'ABV', ids: ['c8'] },
      { at: 450, kind: 'AV', ids: ['c8'] },
    ]);
    expect(fillTarget(p, b(p), 'end')).toBe(1320);
    expect(fillTarget(p, b(p), 'start')).toBe(450);
  });

  it('[R-5.1-28] Marker über alle Spalten (HV, frei) begrenzen ebenfalls, auch einer mit gespeicherter anderer Spalte', () => {
    const p = plan([
      { at: 1200, kind: 'HV', ids: 'all' },
      { at: 900, kind: 'ABV', ids: ['c9'] },
      { at: 500, kind: 'custom', ids: 'all' },
    ]);
    expect(fillTarget(p, b(p), 'end')).toBe(900);
    expect(fillTarget(p, b(p), 'start')).toBe(500);
  });
});

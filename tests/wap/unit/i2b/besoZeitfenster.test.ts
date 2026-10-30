// @vitest-environment node
// I2b-A A6: Beso-Kästchen verschieben ändert die Zeit des Zeitfensters; Nummern nach Beschrieb 5.3.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { placeTimeWindow } from '../../../../src/model/wap/commands/arrange';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { basePlan, beso, rt, win, withEntries } from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };
const MO = '2026-09-28';

function numbers(plan: Plan, ...ids: string[]): (number | null)[] {
  return ids.map((id) => (plan.entries[id] as Beso).besoNumber);
}

function day(stand: Plan['stand']): Plan {
  return withEntries(basePlan({ stand }), [
    beso('eA', 1, {
      title: rt('Arzt'),
      besoNumber: 10,
      windows: [win('tA', { time: { form: 'point', at: 480 } })],
    }),
    beso('eB', 2, {
      title: rt('Zahnarzt'),
      besoNumber: 11,
      windows: [win('tB', { time: { form: 'point', at: 600 } })],
    }),
    beso('eC', 3, {
      title: rt('Fassung'),
      besoNumber: 12,
      windows: [win('tC', { time: { form: 'range', from: 720, to: 780 } })],
    }),
  ]);
}

const early = { date: MO, time: { form: 'range', from: 420, to: 480 }, columnId: null } as const;

describe('I2b A6 Beso-Zeitfenster verschieben', () => {
  it('[R-5.3-03][R-5.3-04] vor dem ersten Stand nummeriert das Verschieben den Tag nach Sortierzeit neu', () => {
    const plan = day(null);
    const r = placeTimeWindow(plan, 'eC', 'tC', early, ctx);
    expect(numbers(r.plan, 'eC', 'eA', 'eB')).toEqual([10, 11, 12]);
    expect((r.plan.entries.eC as Beso).windows[0]?.time).toEqual(early.time);
    expect(r.label).toBe('Beso «Fassung» verschoben');
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(plan);
  });

  it('[R-5.3-06] ab dem ersten Stand bleiben die Nummern fixiert', () => {
    const plan = day({ date: '2026-09-17', version: 1 });
    const r = placeTimeWindow(plan, 'eC', 'tC', early, ctx);
    expect(numbers(r.plan, 'eA', 'eB', 'eC')).toEqual([10, 11, 12]);
  });

  it('[R-5.3-02] in eine Planungsspalte und auf einen anderen Tag: Spalte des Zeitfensters, Nummer im Kreis des Zieltags', () => {
    const plan = day(null);
    const inColumn = placeTimeWindow(
      plan,
      'eA',
      'tA',
      { date: MO, time: { form: 'point', at: 495 }, columnId: 'c9' },
      ctx,
    );
    expect((inColumn.plan.entries.eA as Beso).windows[0]).toMatchObject({
      columnId: 'c9',
      time: { form: 'point', at: 495 },
    });
    const moved = placeTimeWindow(
      plan,
      'eB',
      'tB',
      { date: '2026-09-29', time: { form: 'point', at: 600 }, columnId: null },
      ctx,
    );
    const b = moved.plan.entries.eB as Beso;
    expect(b.date).toBe('2026-09-29');
    expect(b.besoNumber).toBe(20);
    expect(numbers(moved.plan, 'eA', 'eC')).toEqual([10, 11]);
  });

  it('[R-5.3-05] eine fixierte Nummer bleibt auch vor dem Stand', () => {
    const plan = withEntries(day(null), [
      beso('eC', 3, {
        title: rt('Fassung'),
        besoNumber: 12,
        numberFixed: true,
        windows: [win('tC', { time: { form: 'range', from: 720, to: 780 } })],
      }),
    ]);
    const r = placeTimeWindow(plan, 'eC', 'tC', early, ctx);
    expect(numbers(r.plan, 'eC', 'eA', 'eB')).toEqual([12, 10, 11]);
  });
});

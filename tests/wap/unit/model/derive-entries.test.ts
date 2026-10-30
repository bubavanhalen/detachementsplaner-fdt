// @vitest-environment jsdom
// Einträge eines Datums (Vertrag E1-02a Abschnitt 3 derive/entries.ts, 8 P-11; Beschrieb 4.6).
import { describe, expect, it } from 'vitest';
import { entriesOnDate } from '../../../../src/model/wap/derive/entries';
import {
  basePlan,
  beso,
  block,
  dayRemark,
  marker,
  multiDayRemark,
  querbalken,
  rapport,
  win,
  withEntries,
} from '../../support/model/builders';

const ids = (list: readonly { readonly id: string }[]) => list.map((e) => e.id);

describe('entriesOnDate', () => {
  it('[R-4.6-04] Querbalken 08.10.–18.10.2026 erscheint als dasselbe Objekt an jedem Tag des Zeitraums, auch in der Folgewoche', () => {
    const q = querbalken('e1', 1);
    const plan = withEntries(basePlan(), [q]);
    for (const d of ['2026-10-08', '2026-10-11', '2026-10-12', '2026-10-18']) {
      const found = entriesOnDate(plan, d);
      expect(ids(found)).toEqual(['e1']);
      expect(found[0]).toEqual(q);
    }
    expect(entriesOnDate(plan, '2026-10-07')).toEqual([]);
    expect(entriesOnDate(plan, '2026-10-19')).toEqual([]);
  });

  it('[R-4.6-35] (Vertrag P-11 entriesOnDate; Darstellung über Mitternacht in E1-02d) von–bis über Mitternacht: Block, Rapport und Beso erscheinen auch am Folgetag', () => {
    const plan = withEntries(basePlan(), [
      block('e1', 1, { date: '2026-09-28', time: { form: 'range', from: 1320, to: 1560 } }),
      rapport('e2', 2, { date: '2026-09-28', time: { form: 'range', from: 1380, to: 1470 } }),
      beso('e3', 3, {
        date: '2026-09-28',
        windows: [
          win('t1', { time: { form: 'point', at: 600 } }),
          win('t2', { time: { form: 'range', from: 1410, to: 1500 } }),
        ],
      }),
    ]);
    expect(ids(entriesOnDate(plan, '2026-09-28'))).toEqual(['e1', 'e2', 'e3']);
    expect(ids(entriesOnDate(plan, '2026-09-29'))).toEqual(['e1', 'e2', 'e3']);
    expect(entriesOnDate(plan, '2026-09-30')).toEqual([]);
  });

  it('[R-4.6-35] (Vertrag P-11 entriesOnDate; Darstellung über Mitternacht in E1-02d) Ende genau 2400 ist keine Fortsetzung am Folgetag', () => {
    const plan = withEntries(basePlan(), [
      block('e1', 1, { date: '2026-09-28', time: { form: 'range', from: 1200, to: 1440 } }),
    ]);
    expect(ids(entriesOnDate(plan, '2026-09-28'))).toEqual(['e1']);
    expect(entriesOnDate(plan, '2026-09-29')).toEqual([]);
  });

  it('[R-4.6-29] Einträge mit Datum: Block, Marker, Rapport, Beso und ganztägige Bemerkung; ohne mehrtägige Bemerkungen; nach Erfassung', () => {
    const plan = withEntries(basePlan(), [
      dayRemark('e5', 50, { date: '2026-10-02' }),
      block('e1', 10, { date: '2026-10-02' }),
      marker('e2', 30, { date: '2026-10-02' }),
      rapport('e3', 20, { date: '2026-10-02' }),
      beso('e4', 40, { date: '2026-10-02' }),
      multiDayRemark('e6', 5),
      block('e7', 1, { date: '2026-10-01' }),
    ]);
    expect(ids(entriesOnDate(plan, '2026-10-02'))).toEqual(['e1', 'e3', 'e2', 'e4', 'e5']);
  });
});

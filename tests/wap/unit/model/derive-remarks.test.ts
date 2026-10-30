// @vitest-environment jsdom
// Bemerkungen einer Woche (Vertrag E1-02a Abschnitt 3 derive/remarks.ts, 8 P-11; Beschrieb 4.1, 4.2; F-38).
import { describe, expect, it } from 'vitest';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import {
  basePlan,
  dayRemark,
  expectModelError,
  multiDayRemark,
  week,
  withEntries,
} from '../../support/model/builders';

const ids = (list: readonly { readonly id: string }[]) => list.map((r) => r.id);

describe('remarksForWeek', () => {
  it('[R-4.1-14] Plan-Bemerkung erscheint auf allen Wochen', () => {
    const plan = withEntries(basePlan(), [multiDayRemark('e1', 1)]);
    for (const w of ['w26', 'w27', 'w28']) expect(ids(remarksForWeek(plan, w))).toEqual(['e1']);
  });

  it('[R-4.2-07] (F-38) Plan-Bemerkung erscheint in jeder Woche genau einmal, auch neben Wochen- und Zeitraum-Bemerkungen', () => {
    const plan = withEntries(basePlan(), [
      multiDayRemark('e1', 1),
      multiDayRemark('e2', 2, { scope: { kind: 'week', weekId: 'w27' } }),
      multiDayRemark('e3', 3, {
        scope: { kind: 'range', fromDate: '2026-09-28', toDate: '2026-10-18' },
      }),
    ]);
    for (const w of ['w26', 'w27', 'w28']) {
      expect(ids(remarksForWeek(plan, w)).filter((id) => id === 'e1')).toHaveLength(1);
    }
  });

  it('[R-4.2-07] (remarksForWeek: hiddenRemarkIds, Vertrag P-11/P-17; Abnahme in E1-14) in einer Woche ausgeblendete Plan-Bemerkung fehlt nur in dieser Woche', () => {
    const base = basePlan();
    const plan = withEntries(
      {
        ...base,
        weeks: base.weeks.map((w) => (w.id === 'w27' ? { ...w, hiddenRemarkIds: ['e1'] } : w)),
      },
      [multiDayRemark('e1', 1), multiDayRemark('e2', 2)],
    );
    expect(ids(remarksForWeek(plan, 'w26'))).toEqual(['e1', 'e2']);
    expect(ids(remarksForWeek(plan, 'w27'))).toEqual(['e2']);
    expect(ids(remarksForWeek(plan, 'w28'))).toEqual(['e1', 'e2']);
  });

  it('[R-4.2-10] Zeitraum über zwei Wochen → erscheint in beiden Wochen mit derselben Nummer, nicht in der dritten', () => {
    const plan = withEntries(basePlan(), [
      multiDayRemark('e1', 1, {
        number: 3,
        scope: { kind: 'range', fromDate: '2026-10-01', toDate: '2026-10-08' },
      }),
    ]);
    const w26 = remarksForWeek(plan, 'w26');
    const w27 = remarksForWeek(plan, 'w27');
    expect(ids(w26)).toEqual(['e1']);
    expect(ids(w27)).toEqual(['e1']);
    expect(w26[0]?.number).toBe(3);
    expect(w27[0]?.number).toBe(3);
    expect(remarksForWeek(plan, 'w28')).toEqual([]);
  });

  it('[R-4.2-10] Grenzen des Zeitraums: letzter Tag Sonntag 04.10. nur KVK-Woche; erster Tag Montag 12.10. nur dritte Woche', () => {
    const plan = withEntries(basePlan(), [
      multiDayRemark('e1', 1, {
        scope: { kind: 'range', fromDate: '2026-09-20', toDate: '2026-10-04' },
      }),
      multiDayRemark('e2', 2, {
        scope: { kind: 'range', fromDate: '2026-10-12', toDate: '2026-10-30' },
      }),
    ]);
    expect(ids(remarksForWeek(plan, 'w26'))).toEqual(['e1']);
    expect(ids(remarksForWeek(plan, 'w27'))).toEqual([]);
    expect(ids(remarksForWeek(plan, 'w28'))).toEqual(['e2']);
  });

  it('[R-4.2-10] (remarksForWeek: scope week, Vertrag P-11/P-17; Abnahme in E1-14) Bemerkung für eine Woche erscheint nur in dieser Woche', () => {
    const plan = withEntries(basePlan(), [
      multiDayRemark('e1', 1, { scope: { kind: 'week', weekId: 'w26' } }),
    ]);
    expect(ids(remarksForWeek(plan, 'w26'))).toEqual(['e1']);
    expect(remarksForWeek(plan, 'w27')).toEqual([]);
  });

  it('[R-4.2-10] Reihenfolge nach Nummer, Bemerkungen ohne Nummer zuletzt, sonst nach Erfassung', () => {
    const plan = withEntries(basePlan(), [
      multiDayRemark('e1', 1, { number: null }),
      multiDayRemark('e2', 2, { number: 5 }),
      multiDayRemark('e3', 3, { number: 2 }),
      multiDayRemark('e4', 4, { number: null }),
      multiDayRemark('e5', 5, { number: 2, createdSeq: 0 }),
    ]);
    expect(ids(remarksForWeek(plan, 'w26'))).toEqual(['e5', 'e3', 'e2', 'e1', 'e4']);
  });

  it('[R-4.1-14] ganztägige Bemerkungen und andere Einträge gehören nicht zu den Wochen-Bemerkungen', () => {
    const plan = withEntries(basePlan(), [dayRemark('e1', 1), multiDayRemark('e2', 2)]);
    expect(ids(remarksForWeek(plan, 'w26'))).toEqual(['e2']);
  });

  it('[R-4.1-14] unbekannte Woche → unknownWeek', () => {
    expectModelError(() => remarksForWeek(basePlan(), 'w99'), { code: 'unknownWeek' });
    const plan = basePlan({ weeks: [week('w26', '2026-09-28')] });
    expectModelError(() => remarksForWeek(plan, 'w27'), { code: 'unknownWeek' });
  });
});

// @vitest-environment jsdom
// H-DATEN (Härtung vor Gate B, Befund visual-qa Härtung 1 «Bemerkungen fehlen in Wo2/Wo3»): Kp-Bemerkungen
// «gelten durchgehend» – einmal pro Plan, auf allen Wochen, pro Woche ausblendbar (Beschrieb 4.2; R-4.2-07 bis
// R-4.2-10). Eine Woche ohne eigene Box übernimmt die Bemerkungen der Vorwoche. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import type { MultiDayRemark } from '../../../../src/model/wap/types';
import { emptyWeek } from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

const week = (n: number, monday: string, remarks?: readonly string[]) =>
  emptyWeek({
    sheet: `Wo ${n}`,
    title: `Inf Fik Kp 99/9 Arbeitsplan Woche ${n}`,
    monday,
    ...(remarks === undefined ? {} : { remarks }),
  });

describe('Kp-Bemerkungen gelten durchgehend', () => {
  const o = importWeeks([
    week(1, '2099-10-05', ['Fiktive Bemerkung A', 'Fiktive Bemerkung B']),
    week(2, '2099-10-12'),
    week(3, '2099-10-19', ['Fiktive Bemerkung A', 'Fiktive Bemerkung C']),
  ]);
  const plan = o.result.plan;
  const texts = (i: number) => {
    const w = plan.weeks[i];
    return w === undefined ? [] : remarksForWeek(plan, w.id).map((r) => r.text);
  };

  it('[R-4.2-07] gleiche Bemerkung in mehreren Wochen ist ein Eintrag für den ganzen Plan', () => {
    const rs = entries(plan).filter((e): e is MultiDayRemark => e.type === 'multiDayRemark');
    expect(rs.map((r) => r.text)).toEqual([
      'Fiktive Bemerkung A',
      'Fiktive Bemerkung B',
      'Fiktive Bemerkung C',
    ]);
    expect(rs.every((r) => r.scope.kind === 'plan')).toBe(true);
  });

  it('[R-4.2-08] jede Woche zeigt ihre Bemerkungen; eine Woche ohne Box übernimmt die der Vorwoche', () => {
    expect(texts(0)).toEqual(['Fiktive Bemerkung A', 'Fiktive Bemerkung B']);
    expect(texts(1)).toEqual(['Fiktive Bemerkung A', 'Fiktive Bemerkung B']);
    expect(texts(2)).toEqual(['Fiktive Bemerkung A', 'Fiktive Bemerkung C']);
  });

  it('[R-8.2-20] die Box jeder Woche ist zugeordnet (nicht im Bericht als nicht zugeordnet)', () => {
    for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
    expect(o.report.items.filter((i) => i.kind === 'unassignedShape')).toHaveLength(0);
  });
});

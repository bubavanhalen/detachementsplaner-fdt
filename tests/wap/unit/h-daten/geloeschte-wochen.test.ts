// @vitest-environment node
// H-DATEN (Härtung vor Gate B): Kategorien und Spaltensätze, die nur eine gelöschte Woche verwendet
// (CR-H-D-04, CR-H-D-05). Beschrieb 5.2 «Woche löschen … wiederherstellen», 4.7; R-5.2-06, R-4.7-01. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { columnSetUsage } from '../../../../src/model/wap/commands/dayColumns';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import {
  categoryUsage,
  createColumnSet,
  deleteCategory,
  deleteColumnSet,
} from '../../../../src/model/wap/commands/settings';
import { deleteWeek, restoreWeek } from '../../../../src/model/wap/commands/weeks';
import type { Plan } from '../../../../src/model/wap/types';
import { add, CTX, kpPlan } from '../../support/i5/plan';

describe('CR-H-D-04: Kategorie einer gelöschten Woche', () => {
  const setup = () => {
    let plan = kpPlan(2);
    const w2 = plan.weeks[1];
    if (w2 === undefined) throw new Error('Woche 2 fehlt');
    const cat = plan.legend[0];
    const other = plan.legend[1];
    if (cat === undefined || other === undefined) throw new Error('Legende zu kurz');
    // Nur der Eintrag der Woche 2 nutzt eine neue, sonst unbenutzte Kategorie.
    const fresh = { ...cat, id: 'k-fiktiv', name: 'Fiktive Leitung', legendLabel: 'Fiktiv' };
    plan = { ...plan, legend: [...plan.legend, fresh] };
    const r = add(plan, {
      type: 'block',
      date: w2.startDate,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'all' },
      title: [{ text: 'Fiktiver Block', bold: true }],
      categoryId: fresh.id,
    });
    plan = deleteWeek(r.plan, w2.id, CTX).plan;
    return { plan, id: r.id, fresh: fresh.id, other: other.id };
  };

  it('[R-4.7-01] Verwendung zählt Einträge gelöschter Wochen mit; Löschen ohne Ersatz wird abgelehnt', () => {
    const { plan, fresh } = setup();
    expect(categoryUsage(plan, fresh)).toBe(1);
    expect(() => deleteCategory(plan, fresh, null, CTX)).toThrow();
  });

  it('[R-5.2-06] Woche löschen → Kategorie mit Ersatz löschen → Woche wiederherstellen: Eintrag hat den Ersatz', () => {
    const { plan: p0, id, fresh, other } = setup();
    let plan = deleteCategory(p0, fresh, other, CTX).plan;
    plan = restoreWeek(plan, 0, CTX).plan;
    const e = plan.entries[id];
    expect(e !== undefined && 'categoryId' in e ? e.categoryId : null).toBe(other);
    expect(plan.legend.some((c) => c.id === fresh)).toBe(false);
  });
});

describe('CR-H-D-05: Spaltensatz einer gelöschten Woche', () => {
  const setup = (): { plan: Plan; setId: string; weekId: string } => {
    let plan = kpPlan(2);
    const w2 = plan.weeks[1];
    const base = plan.columnSets[0];
    if (w2 === undefined || base === undefined) throw new Error('Plan unvollständig');
    const cs = createColumnSet(plan, 'Fiktiver Satz', base.id, CTX);
    plan = setDayColumnSet(cs.plan, w2.id, ['Mo'], cs.setId, CTX).plan;
    const col = plan.columnSets
      .find((s) => s.id === cs.setId)
      ?.columns.find((c) => c.kind === 'planning');
    if (col === undefined) throw new Error('Spalte fehlt');
    plan = add(plan, {
      type: 'block',
      date: w2.startDate,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: [col.id] },
      title: [{ text: 'Fiktiver Block', bold: true }],
    }).plan;
    plan = deleteWeek(plan, w2.id, CTX).plan;
    return { plan, setId: cs.setId, weekId: w2.id };
  };

  it('[R-5.2-06] Nutzung zählt Tage gelöschter Wochen mit', () => {
    const { plan, setId } = setup();
    expect(columnSetUsage(plan, setId)).toBe(1);
  });

  it('[R-5.2-06] Spaltensatz einer gelöschten Woche lässt sich nicht löschen; Meldung nennt die gelöschte Woche', () => {
    const { plan, setId } = setup();
    expect(() => deleteColumnSet(plan, setId, CTX)).toThrow(/gelöscht/);
  });

  it('[R-5.2-06] nach dem Wiederherstellen hat jeder Tag einen vorhandenen Spaltensatz', () => {
    const { plan: p0, setId, weekId } = setup();
    let plan = p0;
    try {
      plan = deleteColumnSet(plan, setId, CTX).plan;
    } catch {
      // abgelehnt: so soll es sein
    }
    plan = restoreWeek(plan, 0, CTX).plan;
    const week = plan.weeks.find((w) => w.id === weekId);
    expect(week?.days.every((d) => plan.columnSets.some((s) => s.id === d.columnSetId))).toBe(true);
  });
});

// @vitest-environment node
// H-TESTS (Härtung, TR-H-07, TR-H-16): P1 für Rapporte «auch in Spalten» und für Querbalken, P17 für einen Beso ohne
// Nummer an einem nicht vollen Tag, Stufen der Befunde aus dem echten Prüflauf (Beschrieb 7; Vertrag E1-06
// Abschnitt 2; R-7-08, R-7-10, R-7-13). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  countBySeverity,
  type Finding,
  RULE_SEVERITY,
  runChecks,
} from '../../../../src/model/wap/checks';
import { setDayColumnSet, setDayDisplay } from '../../../../src/model/wap/commands/days';
import { deleteEntries } from '../../../../src/model/wap/commands/entries';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { add, besos, block, CTX, column, entry, kpPlan, MO } from '../../support/i5/plan';

const DI: IsoDate = '2026-09-29';
const wk = (plan: Plan): Id => plan.weeks[0]?.id ?? '';
const check = (plan: Plan): readonly Finding[] =>
  runChecks({ plan, layoutFor: (w) => layoutWeekPage(plan, w, pageOptions()) });
const rules = (plan: Plan, rule: string) => check(plan).filter((f) => f.rule === rule);

/** Spaltensatz «KVK Mi–Fr» (andere Spalten) an den Tagen `days` der ersten Woche. */
function otherSet(plan: Plan, days: readonly ('Mo' | 'Di')[]): Plan {
  const set = plan.columnSets[1];
  if (set === undefined) throw new Error('Spaltensatz fehlt');
  return setDayColumnSet(plan, wk(plan), days, set.id, CTX).plan;
}

function rapport(plan: Plan, display: 'rapColumn' | 'alsoInColumns' | 'onlyInColumns') {
  return add(plan, {
    type: 'rapport',
    date: MO,
    code: 'AR1',
    time: { form: 'point', at: 600 },
    display,
    displayColumns: { kind: 'ids', ids: [column(plan, 0).id] },
  });
}

function querbalken(plan: Plan, columns: { kind: 'all' } | { kind: 'ids'; ids: Id[] }) {
  return add(plan, {
    type: 'querbalken',
    fromDate: MO,
    toDate: DI,
    title: [{ text: 'Gefechtsschiessen', bold: true }],
    columns,
  });
}

describe('H-TESTS P1 Rapport-Anzeigespalten und Querbalken', () => {
  it('[R-7-10] P1 (positiv): Rapport «auch in Spalten» in einer Spalte, die es nach dem Wechsel des Spaltensatzes nicht mehr gibt → Befund mit Spaltenname', () => {
    const base = kpPlan(1);
    const name = column(base, 0).name;
    let { plan, id } = rapport(base, 'alsoInColumns');
    expect(rules(plan, 'P1')).toEqual([]);
    plan = otherSet(plan, ['Mo']);
    const f = rules(plan, 'P1');
    expect(f.map((x) => [x.entryId, x.date, x.severity])).toEqual([[id, MO, 'error']]);
    expect(f[0]?.message.cause).toContain('«AR1»');
    expect(f[0]?.message.cause).toContain(name);
  });

  it('[R-7-10] P1 (positiv): Rapport «nur in Spalten» in fehlender Spalte → Befund', () => {
    const { plan, id } = rapport(kpPlan(1), 'onlyInColumns');
    expect(rules(otherSet(plan, ['Mo']), 'P1').map((x) => x.entryId)).toEqual([id]);
  });

  it('[R-7-10] P1 (negativ): Rapport nur in der Rap-Spalte (Anzeigespalten ohne Wirkung) → kein Befund, auch nach dem Wechsel des Spaltensatzes', () => {
    const { plan } = rapport(kpPlan(1), 'rapColumn');
    expect(rules(otherSet(plan, ['Mo']), 'P1')).toEqual([]);
  });

  it('[R-7-10] P1 (positiv): Querbalken Mo–Di in der ersten Spalte, am Di fehlt die Spalte → genau ein Befund am ersten betroffenen Tag', () => {
    const base = kpPlan(1);
    let { plan, id } = querbalken(base, { kind: 'ids', ids: [column(base, 0).id] });
    expect(rules(plan, 'P1')).toEqual([]);
    plan = otherSet(plan, ['Di']);
    const f = rules(plan, 'P1');
    expect(f.map((x) => [x.entryId, x.date])).toEqual([[id, DI]]);
    expect(f[0]?.message.cause).toContain('«Gefechtsschiessen»');
    expect(f[0]?.message.cause).toContain('Di 29.09.2026');
    // An beiden Tagen fehlend: weiterhin ein Befund, am ersten Tag.
    expect(rules(otherSet(plan, ['Mo', 'Di']), 'P1').map((x) => [x.entryId, x.date])).toEqual([
      [id, MO],
    ]);
  });

  it('[R-7-10] P1 (negativ): Querbalken über alle Spalten bzw. Spalte an beiden Tagen vorhanden → kein Befund', () => {
    const all = querbalken(kpPlan(1), { kind: 'all' }).plan;
    expect(rules(otherSet(all, ['Di']), 'P1')).toEqual([]);
    const base = kpPlan(1);
    const present = querbalken(base, { kind: 'ids', ids: [column(base, 0).id] }).plan;
    expect(rules(present, 'P1')).toEqual([]);
  });
});

describe('H-TESTS P17 Beso ohne Nummer an einem nicht vollen Tag', () => {
  it('[R-7-13][R-5.3-09] P17 (negativ): nach dem ersten Stand 11 Beso, ein nummerierter gelöscht → der elfte erhält die frei gewordene Nummer, kein Befund; die übrigen bleiben unverändert', () => {
    let { plan, ids } = besos(kpPlan(1), 11);
    const elf = ids[10] as Id;
    plan = applyStand(plan, { date: '2026-09-20' }, CTX).plan;
    expect((entry(plan, elf) as Beso).besoNumber).toBeNull();
    plan = deleteEntries(plan, [ids[3] as Id], CTX).plan;
    expect(Object.values(plan.entries).filter((e) => e.type === 'beso')).toHaveLength(10);
    // Ab dem ersten Stand nie automatisch umnummeriert (R-5.3-06, F-52): der elfte bleibt ohne Nummer.
    expect(ids.slice(4, 10).map((i) => (entry(plan, i) as Beso).besoNumber)).toEqual([
      14, 15, 16, 17, 18, 19,
    ]);
    // Die frei gewordene Nummer 13 geht an den Beso ohne Nummer; P17 entfällt ohne weitere Aktion.
    expect((entry(plan, elf) as Beso).besoNumber).toBe(13);
    expect(rules(plan, 'P17')).toEqual([]);
  });

  it('[R-7-13] P17 (positiv): Beso ohne Nummer (Stand aus einer Plan-Datei) an einem Tag mit nur drei Beso → Befund nach Vertrag E1-06 (Grundlage besoNumber null)', () => {
    const { plan: base, ids } = besos(kpPlan(1), 3);
    const id = ids[2] as Id;
    const b = entry(base, id) as Beso;
    const plan: Plan = { ...base, entries: { ...base.entries, [id]: { ...b, besoNumber: null } } };
    const f = rules(plan, 'P17');
    expect(f.map((x) => [x.entryId, x.date, x.severity])).toEqual([[id, MO, 'error']]);
    expect(f[0]?.message.cause).toContain('«Visite 3» hat keine Nummer («–»)');
  });

  it('[R-7-13] P17 (negativ): Beso mit Nummer an einem nicht vollen Tag → kein Befund', () => {
    expect(rules(besos(kpPlan(1), 3).plan, 'P17')).toEqual([]);
  });
});

describe('H-TESTS Stufen aus dem echten Prüflauf', () => {
  it('[R-7-08] jeder Befund des Prüflaufs trägt die Stufe seiner Regel nach Beschrieb 7: P1, P8, P16, P17 als Fehler; Zählung nach Stufe', () => {
    // Ein Plan mit je mindestens einem Befund P1, P8, P16 und P17.
    let plan = besos(kpPlan(1), 11).plan;
    plan = block(plan, 'Ausb Mö').plan;
    plan = otherSet(plan, ['Mo']);
    plan = block(plan, 'Abcdefghij klmnop qrstuv', {
      date: DI,
      time: { form: 'range', from: 480, to: 495 },
    }).plan;
    plan = block(plan, 'Wache', { date: '2026-10-04' }).plan;
    plan = setDayDisplay(plan, wk(plan), ['So'], 'hidden', CTX).plan;
    const f = check(plan);
    expect(new Set(f.map((x) => x.rule))).toEqual(new Set(['P1', 'P8', 'P16', 'P17']));
    const beschrieb7 = { P1: 'error', P8: 'error', P16: 'error', P17: 'error' } as const;
    for (const x of f) {
      expect(x.severity).toBe(beschrieb7[x.rule as keyof typeof beschrieb7]);
      expect(x.severity).toBe(RULE_SEVERITY[x.rule]);
    }
    expect(countBySeverity(f)).toMatchObject({ error: f.length, warning: 0, hint: 0 });
  });
});

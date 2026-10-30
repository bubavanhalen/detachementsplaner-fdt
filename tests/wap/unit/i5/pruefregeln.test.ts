// @vitest-environment node
// I5 D1: Prüfregeln P1, P8, P16, P17 je positiv und negativ (Beschrieb 7, 14.7; Vertrag E1-06), Stufen, Quittieren,
// Export-Auswahl und Zwischenspeicher des Prüflaufs. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_RULES,
  acknowledgeFinding,
  countBySeverity,
  countOpen,
  createCheckRunner,
  type Finding,
  findingsForExport,
  RULE_SEVERITY,
  runChecks,
  unacknowledgeFinding,
} from '../../../../src/model/wap/checks';
import { setDayColumnSet, setDayDisplay } from '../../../../src/model/wap/commands/days';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Id, Plan } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { add, besos, block, CTX, column, kpPlan, MO } from '../../support/i5/plan';

const layoutFor = (plan: Plan) => (weekId: Id) => layoutWeekPage(plan, weekId, pageOptions());
const check = (plan: Plan): readonly Finding[] => runChecks({ plan, layoutFor: layoutFor(plan) });
const rules = (plan: Plan, rule: string) => check(plan).filter((f) => f.rule === rule);
const wk = (plan: Plan, i = 0) => plan.weeks[i]?.id ?? '';
/** Spaltensatz «KVK Mi–Fr» (andere Spalten) am Montag der ersten Woche. */
function otherSetOnMonday(plan: Plan): Plan {
  const set = plan.columnSets[1];
  if (set === undefined) throw new Error('Spaltensatz fehlt');
  return setDayColumnSet(plan, wk(plan), ['Mo'], set.id, CTX).plan;
}

describe('I5 D1 Prüfregeln', () => {
  it('[R-7-08] jede Regel hat die Stufe aus Beschrieb 7; Etappe 1 prüft P1, P8, P16, P17', () => {
    expect(ACTIVE_RULES).toEqual(['P1', 'P8', 'P16', 'P17']);
    for (const r of ['P1', 'P8', 'P16', 'P17'] as const) expect(RULE_SEVERITY[r]).toBe('error');
    for (const r of ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P18'] as const)
      expect(RULE_SEVERITY[r]).toBe('warning');
    for (const r of ['P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P19'] as const)
      expect(RULE_SEVERITY[r]).toBe('hint');
  });

  it('[R-7-10][R-5.2-09] P1 (positiv): Spaltensatz des Tages gewechselt → Befund mit Spaltenname, Ursache und nächstem Schritt', () => {
    let { plan, id } = block(kpPlan(1), 'Ausb Mö');
    const name = column(plan, 0).name;
    plan = otherSetOnMonday(plan);
    const f = rules(plan, 'P1');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ entryId: id, severity: 'error', date: MO, weekId: wk(plan) });
    expect(f[0]?.message.cause).toContain('«Ausb Mö»');
    expect(f[0]?.message.cause).toContain(name);
    expect(f[0]?.message.cause).toContain('Mo 28.09.2026');
    expect(f[0]?.message.nextStep).toMatch(/Spalte wählen|Spaltensatz/);
  });

  it('[R-7-10] P1 (negativ): Eintrag in vorhandener Spalte bzw. in «alle Spalten» → kein Befund', () => {
    let { plan } = block(kpPlan(1), 'Ausb Mö');
    plan = block(plan, 'MiE', { columns: { kind: 'all' } }).plan;
    expect(rules(plan, 'P1')).toEqual([]);
    // «alle» bleibt nach dem Wechsel des Spaltensatzes «alle» (R-5.1-19): kein P1.
    plan = otherSetOnMonday(block(kpPlan(1), 'MiE', { columns: { kind: 'all' } }).plan);
    expect(rules(plan, 'P1')).toEqual([]);
  });

  it('[R-7-10][R-5.1-18] P1 (positiv): Beso-Zeitfenster in einer Spalte, die es am Tag nicht gibt', () => {
    const base = kpPlan(1);
    let { plan } = add(base, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Arztvisite', bold: false }],
      windows: [{ time: { form: 'point', at: 600 }, columnId: column(base, 1).id }],
    });
    plan = otherSetOnMonday(plan);
    expect(rules(plan, 'P1').map((f) => f.title)).toEqual(['Arztvisite']);
  });

  it('[R-7-12] P16 (positiv): Eintrag am ausgeblendeten Sonntag → Befund', () => {
    let { plan, id } = block(kpPlan(1), 'Wache', { date: '2026-10-04' });
    plan = setDayDisplay(plan, wk(plan), ['So'], 'hidden', CTX).plan;
    const f = rules(plan, 'P16');
    expect(f.map((x) => x.entryId)).toEqual([id]);
    expect(f[0]?.message.cause).toContain('So 04.10.2026');
    expect(f[0]?.message.nextStep).toContain('einblenden');
  });

  it('[R-7-12] P16 (negativ): ausgeblendeter Tag ohne Eintrag bzw. Eintrag am sichtbaren Tag → kein Befund', () => {
    const hidden = setDayDisplay(kpPlan(1), wk(kpPlan(1)), ['So'], 'hidden', CTX).plan;
    expect(rules(hidden, 'P16')).toEqual([]);
    const visible = block(kpPlan(1), 'Wache', { date: '2026-10-04' }).plan;
    expect(rules(visible, 'P16')).toEqual([]);
    // Kompakt ist nicht ausgeblendet.
    const compact = setDayDisplay(visible, wk(visible), ['So'], 'compact', CTX).plan;
    expect(rules(compact, 'P16')).toEqual([]);
  });

  it('[R-7-13][R-5.3-10] P17 (positiv): 11 Beso am Montag → der 11. ohne Nummer ergibt den Befund', () => {
    const { plan, ids } = besos(kpPlan(1), 11);
    const f = rules(plan, 'P17');
    expect(f.map((x) => x.entryId)).toEqual([ids[10]]);
    expect(f[0]?.message.cause).toContain('11 Beso');
    expect(f[0]?.message.cause).toContain('10–19');
  });

  it('[R-7-13] P17 (negativ): 10 Beso am Montag → kein Befund', () => {
    expect(rules(besos(kpPlan(1), 10).plan, 'P17')).toEqual([]);
  });

  it('[R-7-13][R-5.3-09] P17 (negativ): Beso ohne Nummer erhält beim Stand eine frei gewordene Nummer → kein Befund mehr', () => {
    let { plan, ids } = besos(kpPlan(1), 11);
    // Ein Beso wird gestrichen; beim Stand wird er entfernt und seine Nummer frei (Fall (d)).
    plan = updateEntry(plan, ids[0] as Id, 'beso', { status: 'cancelled' }, CTX).plan;
    expect(rules(plan, 'P17')).toHaveLength(1);
    plan = applyStand(plan, { date: '2026-09-20' }, CTX).plan;
    expect((plan.entries[ids[10] as Id] as Beso).besoNumber).not.toBeNull();
    expect(rules(plan, 'P17')).toEqual([]);
  });

  it('[R-7-13][R-5.3-09] P17 (positiv): Tag voll, nichts gestrichen → nach dem Stand bleibt der Befund', () => {
    let { plan, ids } = besos(kpPlan(1), 11);
    plan = applyStand(plan, { date: '2026-09-20' }, CTX).plan;
    expect(rules(plan, 'P17').map((f) => f.entryId)).toEqual([ids[10]]);
  });

  it('[R-7-11][R-10-43] P8 (positiv): überlanger Titel in einer Viertelstunde → Befund je Rückfallereignis', () => {
    const { plan, id } = block(
      kpPlan(1),
      'Einrichten Ukft Magazin Fahrzeughalle Werkstatt Lager Nord',
      {
        time: { form: 'range', from: 480, to: 495 },
        supplement: 'Zusatz lang lang lang',
        ltg: 'Zfhr',
        ort: 'Spl',
      },
    );
    const layout = layoutWeekPage(plan, wk(plan), pageOptions());
    const own = layout.fallbacks.filter((e) => e.entryId === id);
    expect(own.length).toBeGreaterThan(0);
    const f = rules(plan, 'P8').filter((x) => x.entryId === id);
    expect(f).toHaveLength(own.length);
    expect(f[0]?.message.cause).toContain('4,5 pt');
    expect(f[0]?.region).toBe('block');
  });

  it('[R-7-11] P8 (negativ): kurzer Titel in grossem Block → kein Befund', () => {
    const { plan } = block(kpPlan(1), 'MiE', { columns: { kind: 'all' } });
    expect(rules(plan, 'P8')).toEqual([]);
  });

  it('[R-7-11][R-4.6-62] P8 (positiv): drei Querbalken am selben Tag → genau ein Befund für den dritten; zwei → keiner', () => {
    let plan = kpPlan(1);
    const ids: Id[] = [];
    for (const t of ['Eins', 'Zwei', 'Drei']) {
      const r = add(plan, {
        type: 'querbalken',
        fromDate: MO,
        toDate: MO,
        title: [{ text: t, bold: true }],
      });
      plan = r.plan;
      ids.push(r.id);
    }
    const f = rules(plan, 'P8');
    expect(f.map((x) => [x.entryId, x.region])).toEqual([[ids[2], 'band']]);
    const two = kpPlan(1);
    let p2 = two;
    for (const t of ['Eins', 'Zwei'])
      p2 = add(p2, {
        type: 'querbalken',
        fromDate: MO,
        toDate: MO,
        title: [{ text: t, bold: true }],
      }).plan;
    expect(rules(p2, 'P8')).toEqual([]);
  });

  it('[R-10-43] P8 (positiv): übervoller Terminbereich → Fortsetzungsseite und Befund «Fortsetzung»', () => {
    let plan = kpPlan(1);
    for (let i = 0; i < 70; i++)
      plan = add(plan, {
        type: 'dayRemark',
        date: MO,
        text: `Bemerkung ${String(i)} mit etwas längerem Text für den Terminbereich`,
      }).plan;
    const layout = layoutWeekPage(plan, wk(plan), pageOptions());
    expect(layout.pages.length).toBeGreaterThan(1);
    const f = rules(plan, 'P8').filter((x) => x.message.cause.includes('Fortsetzung'));
    expect(f.length).toBeGreaterThan(0);
  });

  it('[R-14.7-01] jede Regel der Etappe 1 ist mit positivem und negativem Fall belegt (Tabelle)', () => {
    const cases: [string, Plan, Plan][] = [
      ['P1', otherSetOnMonday(block(kpPlan(1), 'A').plan), block(kpPlan(1), 'A').plan],
      [
        'P16',
        setDayDisplay(block(kpPlan(1), 'A').plan, wk(kpPlan(1)), ['Mo'], 'hidden', CTX).plan,
        block(kpPlan(1), 'A').plan,
      ],
      ['P17', besos(kpPlan(1), 11).plan, besos(kpPlan(1), 10).plan],
      [
        'P8',
        block(kpPlan(1), 'Sehr langer Titel der nicht in eine Viertelstunde passt', {
          time: { form: 'range', from: 480, to: 495 },
        }).plan,
        block(kpPlan(1), 'A', { columns: { kind: 'all' } }).plan,
      ],
    ];
    expect(cases.map(([r]) => r).sort()).toEqual([...ACTIVE_RULES].sort());
    for (const [rule, positive, negative] of cases) {
      expect(rules(positive, rule).length, rule).toBeGreaterThan(0);
      expect(rules(negative, rule), rule).toEqual([]);
    }
  });

  it('[R-7-34] Quittieren: Befund zählt nicht mehr, bleibt mit Datum und Grund sichtbar; Aufheben und Undo stellen ihn wieder her', () => {
    const plan = otherSetOnMonday(block(kpPlan(1), 'Ausb Mö').plan);
    const [f] = check(plan);
    if (f === undefined) throw new Error('Befund fehlt');
    expect(countOpen(check(plan))).toBe(1);
    const ack = acknowledgeFinding(plan, f, '  Absprache   mit Kp Kdt ', '2026-09-29', CTX);
    const after = check(ack.plan);
    expect(countOpen(after)).toBe(0);
    expect(after[0]).toMatchObject({
      key: f.key,
      acknowledged: true,
      acknowledgement: { at: '2026-09-29', reason: 'Absprache mit Kp Kdt' },
    });
    expect(ack.label).toContain('quittiert');
    expect(countBySeverity(after)).toEqual({ error: 0, warning: 0, hint: 0 });
    // Aufheben ist ein eigener Befehl; Undo über die inversen Patches.
    const back = unacknowledgeFinding(ack.plan, f, CTX).plan;
    expect(countOpen(check(back))).toBe(1);
    expect(acknowledgeFinding(ack.plan, f, 'x', '2026-09-29', CTX).patches).toEqual([]);
  });

  it('[R-7-34] Quittierung gilt nur für dieselbe Ursache: fehlt eine andere Spalte, erscheint der Befund wieder', () => {
    const base = block(kpPlan(1), 'Ausb Mö');
    const plan = otherSetOnMonday(base.plan);
    const [f] = check(plan);
    if (f === undefined) throw new Error('Befund fehlt');
    const acked = acknowledgeFinding(plan, f, '', '2026-09-29', CTX).plan;
    const moved = updateEntry(
      acked,
      base.id,
      'block',
      { columns: { kind: 'ids', ids: [column(acked, 2).id] } },
      CTX,
    ).plan;
    expect(countOpen(check(moved))).toBe(1);
  });

  it('[R-7-04][R-7-05] Export-Auswahl: nur Befunde der Woche; Bestätigung nur bei offenen Fehlern', () => {
    let plan = kpPlan(2);
    plan = block(plan, 'Woche zwei', { date: '2026-10-05' }).plan;
    plan = setDayDisplay(plan, wk(plan, 1), ['Mo'], 'hidden', CTX).plan;
    const all = check(plan);
    expect(findingsForExport(all, [wk(plan, 0)])).toEqual({ list: [], hasErrors: false });
    const second = findingsForExport(all, [wk(plan, 1)]);
    expect(second.list.map((f) => f.rule)).toEqual(['P16']);
    expect(second.hasErrors).toBe(true);
    const [f] = second.list;
    if (f === undefined) throw new Error('Befund fehlt');
    const acked = acknowledgeFinding(plan, f, '', '2026-09-29', CTX).plan;
    expect(findingsForExport(check(acked), [wk(plan, 1)]).hasErrors).toBe(false);
  });

  it('[R-7-01] Zwischenspeicher: gleiche Befunde wie runChecks, Änderung in Woche 2 setzt Woche 1 nicht neu', () => {
    let plan = kpPlan(2);
    plan = block(plan, 'Sehr langer Titel der nicht in eine Viertelstunde passt', {
      time: { form: 'range', from: 480, to: 495 },
    }).plan;
    const runner = createCheckRunner();
    const calls: Id[] = [];
    const counting = (p: Plan) => (weekId: Id) => {
      calls.push(weekId);
      return layoutWeekPage(p, weekId, pageOptions());
    };
    expect(runner({ plan, layoutFor: counting(plan) })).toEqual(check(plan));
    expect(calls).toEqual([wk(plan, 0), wk(plan, 1)]);
    calls.length = 0;
    const next = block(plan, 'Neu', { date: '2026-10-07' }).plan;
    expect(runner({ plan: next, layoutFor: counting(next) })).toEqual(check(next));
    expect(calls).toEqual([wk(plan, 1)]);
  });
});

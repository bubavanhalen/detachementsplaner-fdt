// @vitest-environment jsdom
// Spaltensatz und Darstellung je Tag (Vertrag E1-03 Abschnitt 2c, 2b, 1b, 1c; Beschrieb 5.2).
import { describe, expect, it } from 'vitest';
import { setDayColumnSet, setDayDisplay } from '../../../../src/model/wap/commands/days';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { Plan } from '../../../../src/model/wap/types';
import {
  ctx,
  DI,
  eintrag,
  expectCommandError,
  expectKeineWirkung,
  fenster,
  MO,
  planMit,
  run,
  SA,
  SO,
  satz,
} from '../../support/commands/helpers';
import {
  beso,
  block,
  marker,
  querbalken,
  rapport,
  setMiFr,
  setMitNebenspalte,
  setStufen,
  setWochenende,
} from '../../support/model/builders';

/** Neuer Satz «Neu»: Kp Kdt, Zfhr, Neu (keine Stv). */
const NEU = satz('sNeu', 'Neu', [
  { id: 'cN1', name: 'Kp Kdt' },
  { id: 'cN2', name: 'Zfhr' },
  { id: 'cN3', name: 'Neu' },
]);

function planMitEintraegen(): Plan {
  return planMit(
    [
      block('e1', 1, { date: DI, columns: { kind: 'ids', ids: ['c10'] } }),
      block('e2', 2, { date: DI, columns: { kind: 'ids', ids: ['c9'] } }),
      block('e3', 3, { date: DI, columns: { kind: 'all' } }),
      marker('e4', 4, { date: DI, columns: { kind: 'ids', ids: ['c8'] } }),
      rapport('e5', 5, {
        date: DI,
        display: 'alsoInColumns',
        displayColumns: { kind: 'ids', ids: ['c10'] },
      }),
      beso('e6', 6, {
        date: DI,
        besoNumber: 20,
        windows: [fenster('t6', { form: 'point', at: 600 }, { columnId: 'c10' })],
      }),
      block('e7', 7, { date: MO, columns: { kind: 'ids', ids: ['c10'] } }),
      querbalken('e8', 8, { fromDate: MO, toDate: DI, columns: { kind: 'ids', ids: ['c10'] } }),
    ],
    { columnSets: [setStufen(), setMiFr(), setWochenende(), setMitNebenspalte(), NEU] },
  );
}

describe('setDayColumnSet', () => {
  it('[R-5.2-08] Satz zuweisen: Einträge des Tages bleiben in Spalten gleichen Namens; andere Tage und Querbalken unverändert', () => {
    const plan = planMitEintraegen();
    const r = run(plan, (p) => setDayColumnSet(p, 'w26', ['Di'], 'sNeu', ctx));
    expect(r.plan.weeks[0]?.days[1].columnSetId).toBe('sNeu');
    expect(r.plan.weeks[1]?.days[1].columnSetId).toBe('s7');
    expect(eintrag(r.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['cN2'] } });
    expect(eintrag(r.plan, 'e3')).toMatchObject({ columns: { kind: 'all' } });
    expect(eintrag(r.plan, 'e4')).toMatchObject({ columns: { kind: 'ids', ids: ['cN1'] } });
    expect(eintrag(r.plan, 'e5')).toMatchObject({ displayColumns: { kind: 'ids', ids: ['cN2'] } });
    expect(eintrag(r.plan, 'e6')).toMatchObject({ windows: [{ id: 't6', columnId: 'cN2' }] });
    expect(eintrag(r.plan, 'e7')).toEqual(plan.entries.e7);
    expect(eintrag(r.plan, 'e8')).toEqual(plan.entries.e8);
    expect(r.label).toBe('Spaltensatz «Neu» zugewiesen');
    expect(r.affectedDates).toEqual([DI]);
    expect(r.affectedEntryIds).toEqual(['e1', 'e4', 'e5', 'e6']);
  });

  it('[R-5.2-09] Spalte fehlt im neuen Satz: Eintrag bleibt mit seiner Spalten-ID (Grundlage P1), nichts wird gelöscht', () => {
    const plan = planMitEintraegen();
    const r = run(plan, (p) => setDayColumnSet(p, 'w26', ['Di'], 'sNeu', ctx));
    expect(eintrag(r.plan, 'e2')).toEqual(plan.entries.e2);
    expect(dayColumns(r.plan, 'w26', 'Di').map((c) => c.id)).not.toContain('c9');
    expect(Object.keys(r.plan.entries).sort()).toEqual(Object.keys(plan.entries).sort());
  });

  it('[R-5.2-08] mehrere Tage in einem Befehl; Doppel zählen einmal; Datum je geänderter Tag', () => {
    const plan = planMitEintraegen();
    const r = run(plan, (p) => setDayColumnSet(p, 'w26', ['Di', 'Mo', 'Di'], 'sNeu', ctx));
    expect(r.plan.weeks[0]?.days.map((d) => d.columnSetId)).toEqual([
      'sNeu',
      'sNeu',
      's16',
      's16',
      's16',
      's22',
      's22',
    ]);
    expect(eintrag(r.plan, 'e7')).toMatchObject({ columns: { kind: 'ids', ids: ['cN2'] } });
    expect(r.affectedDates).toEqual([MO, DI]);
  });

  it('[R-5.2-08] gleicher Satz → ohne Wirkung', () => {
    const plan = planMitEintraegen();
    expectKeineWirkung(plan, setDayColumnSet(plan, 'w26', ['Mo', 'Di'], 's7', ctx));
  });

  it('[R-5.2-08] Fehler in Parameterreihenfolge: unknownWeek, emptySelection, unknownColumnSet', () => {
    const plan = planMitEintraegen();
    expectCommandError(plan, (p) => setDayColumnSet(p, 'w99', [], 's99', ctx), {
      code: 'unknownWeek',
    });
    expectCommandError(plan, (p) => setDayColumnSet(p, 'w26', [], 's99', ctx), {
      code: 'emptySelection',
    });
    expectCommandError(plan, (p) => setDayColumnSet(p, 'w26', ['Mo'], 's99', ctx), {
      code: 'unknownColumnSet',
    });
  });
});

describe('setDayDisplay', () => {
  it('[R-5.2-08] Darstellung setzen: nur die Tage ändern sich, Einträge bleiben in ihren Spalten; Bezeichnungen', () => {
    const plan = planMitEintraegen();
    const r = run(plan, (p) => setDayDisplay(p, 'w26', ['Sa', 'So'], 'compact', ctx));
    expect(r.plan.weeks[0]?.days.map((d) => d.display)).toEqual([
      'full',
      'full',
      'full',
      'full',
      'full',
      'compact',
      'compact',
    ]);
    expect(r.plan.entries).toEqual(plan.entries);
    expect(r.label).toBe('Darstellung «kompakt» gesetzt');
    expect(r.affectedDates).toEqual([SA, SO]);
    expect(r.affectedEntryIds).toEqual([]);
    expect(run(plan, (p) => setDayDisplay(p, 'w26', ['So'], 'hidden', ctx)).label).toBe(
      'Darstellung «ausgeblendet» gesetzt',
    );
    expect(run(r.plan, (p) => setDayDisplay(p, 'w26', ['Sa'], 'full', ctx)).label).toBe(
      'Darstellung «voll» gesetzt',
    );
  });

  it('[R-5.2-08] gleiche Darstellung → ohne Wirkung; Fehler unknownWeek, emptySelection', () => {
    const plan = planMitEintraegen();
    expectKeineWirkung(plan, setDayDisplay(plan, 'w26', ['Mo'], 'full', ctx));
    expectCommandError(plan, (p) => setDayDisplay(p, 'w99', ['Mo'], 'full', ctx), {
      code: 'unknownWeek',
    });
    expectCommandError(plan, (p) => setDayDisplay(p, 'w26', [], 'full', ctx), {
      code: 'emptySelection',
    });
  });
});

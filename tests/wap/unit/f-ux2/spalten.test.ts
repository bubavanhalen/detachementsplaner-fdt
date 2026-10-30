// @vitest-environment node
// F-UX2 P6 (Rückmeldung N1 vom 19.10.2026: «Man kann Zugspalten resp. Det-Spalten ändern, aber nicht hinzufügen oder
// entfernen»; Beschrieb 4.4, 5.2 «fällt eine Spalte weg, werden die Einträge markiert statt gelöscht (P1)»): Spalte im
// Spaltenkopf einfügen und entfernen, für alle Tage mit dem Spaltensatz oder nur diesen Tag; ein Undo-Schritt. Fiktive
// Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { missingColumns } from '../../../../src/components/wap/i2/selectionCommands';
import { CommandError } from '../../../../src/model/wap/commands/command';
import { insertOrRemoveDayColumn } from '../../../../src/model/wap/commands/dayColumns';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import { basePlan, block, withEntries } from '../../support/model/builders';

const CTX = { templates: builtInTemplates() };
const MO = '2026-09-28';
const DI = '2026-09-29';

function plan() {
  return withEntries(basePlan({ id: 'fux2-spalten' }), [
    block('mo9', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c9'] },
    }),
    block('mo8', 2, {
      date: MO,
      time: { form: 'range', from: 600, to: 660 },
      columns: { kind: 'ids', ids: ['c8'] },
    }),
    block('di9', 3, {
      date: DI,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c9'] },
    }),
  ]);
}

const names = (p: ReturnType<typeof plan>, weekday: 'Mo' | 'Di') =>
  dayColumns(p, 'w26', weekday).map((c) => c.name);

describe('F-UX2 P6: Spalten im Spaltenkopf einfügen und entfernen', () => {
  it('[R-5.2-08] Einfügen für alle Tage mit dem Spaltensatz: neue Planungsspalte an der Stelle, Kennung zurück, ein Undo-Schritt', () => {
    const p = plan();
    const r = insertOrRemoveDayColumn(
      p,
      'w26',
      'Mo',
      { op: 'insert', index: 1, name: 'Neue Spalte' },
      'set',
      CTX,
    );
    expect(names(r.plan, 'Mo').slice(0, 3)).toEqual(['Kp Kdt', 'Neue Spalte', 'Stv']);
    expect(names(r.plan, 'Di').slice(0, 3)).toEqual(['Kp Kdt', 'Neue Spalte', 'Stv']);
    expect(dayColumns(r.plan, 'w26', 'Mo')[1]?.id).toBe(r.columnId);
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(p);
    // Rechts von der letzten Planungsspalte bzw. dahinter: höchstens vor Neben-, Rap- und Beso-Spalte.
    const end = insertOrRemoveDayColumn(
      p,
      'w26',
      'Mo',
      { op: 'insert', index: 99, name: 'Zug 9' },
      'set',
      CTX,
    );
    expect(names(end.plan, 'Mo').slice(-3)).toEqual(['Zug 9', 'Rap', 'Beso']);
  });

  it('[R-5.2-08][R-5.2-09] Entfernen nur für diesen Tag: Kopie des Spaltensatzes, Einträge folgen; Einträge der entfernten Spalte bleiben und tragen P1', () => {
    const p = plan();
    const r = insertOrRemoveDayColumn(p, 'w26', 'Mo', { op: 'remove', columnId: 'c9' }, 'day', CTX);
    expect(names(r.plan, 'Mo')).not.toContain('Stv');
    expect(names(r.plan, 'Di')).toContain('Stv');
    expect(Object.keys(r.plan.entries).sort()).toEqual(['di9', 'mo8', 'mo9']);
    expect(missingColumns(r.plan, ['mo9'])).not.toEqual([]);
    expect(missingColumns(r.plan, ['mo8'])).toEqual([]);
    expect(missingColumns(r.plan, ['di9'])).toEqual([]);
    expect(r.label).toContain('nur Mo');
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(p);
  });

  it('[R-5.2-09] Entfernen für alle Tage: Einträge an allen Tagen bleiben und tragen P1; Rap/Beso und letzte Planungsspalte nicht entfernbar', () => {
    const p = plan();
    const r = insertOrRemoveDayColumn(p, 'w26', 'Di', { op: 'remove', columnId: 'c9' }, 'set', CTX);
    expect(names(r.plan, 'Mo')).not.toContain('Stv');
    expect(missingColumns(r.plan, ['mo9'])).not.toEqual([]);
    expect(missingColumns(r.plan, ['di9'])).not.toEqual([]);
    expect(() =>
      insertOrRemoveDayColumn(p, 'w26', 'Mo', { op: 'remove', columnId: 'c14' }, 'set', CTX),
    ).toThrow(CommandError);
    let q = p;
    for (const id of ['c9', 'c10', 'c11', 'c12', 'c13'])
      q = insertOrRemoveDayColumn(q, 'w26', 'Mo', { op: 'remove', columnId: id }, 'set', CTX).plan;
    expect(() =>
      insertOrRemoveDayColumn(q, 'w26', 'Mo', { op: 'remove', columnId: 'c8' }, 'set', CTX),
    ).toThrow(/mindestens eine Planungsspalte/);
  });

  it('[R-5.2-08] Einfügen nur für diesen Tag: neue Spalte nur am Tag, Einträge des Tages in der Kopie', () => {
    const p = plan();
    const r = insertOrRemoveDayColumn(
      p,
      'w26',
      'Mo',
      { op: 'insert', index: 0, name: 'Zug 0' },
      'day',
      CTX,
    );
    expect(names(r.plan, 'Mo')[0]).toBe('Zug 0');
    expect(names(r.plan, 'Di')[0]).toBe('Kp Kdt');
    expect(missingColumns(r.plan, ['mo9', 'mo8'])).toEqual([]);
    expect(dayColumns(r.plan, 'w26', 'Mo')[0]?.id).toBe(r.columnId);
  });
});

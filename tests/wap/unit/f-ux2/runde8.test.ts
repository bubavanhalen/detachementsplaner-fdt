// @vitest-environment node
// F-UX2 Runde 8 (code-reviewer-5 CR-5-03): aufbewahrte Spaltensätze werden am Aufbau erkannt und von der Sitzung
// geführt, nicht am Namen – ein Benutzersatz mit passendem Namensende bleibt, ein umbenannter aufbewahrter Satz wird
// trotzdem aufgeräumt. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  createdKeptSets,
  insertOrRemoveDayColumn,
  tidyKeptColumnSets,
} from '../../../../src/model/wap/commands/dayColumns';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { createColumnSet, renameColumnSet } from '../../../../src/model/wap/commands/settings';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, block, withEntries } from '../../support/model/builders';

const CTX = { templates: builtInTemplates() };
const MO = '2026-09-28';

function plan(): Plan {
  return withEntries(basePlan({ id: 'fux2-runde8' }), [
    block('b1', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c10'] },
    }),
  ]);
}

const verschieben = (p: Plan) => {
  const ziel = dayColumns(p, 'w26', 'Mo').find((c) => c.kind === 'planning');
  if (ziel === undefined) throw new Error('Spalte fehlt');
  return updateEntry(p, 'b1', 'block', { columns: { kind: 'ids', ids: [ziel.id] } }, CTX);
};

describe('F-UX2 Runde 8: aufbewahrte Sätze am Aufbau erkannt (CR-5-03)', () => {
  it('[R-5.2-09] ein Benutzersatz mit passendem Namensende wird nicht aufgeräumt', () => {
    const p0 = plan();
    const user = createColumnSet(p0, 'Mein Satz (vor Entfernen von «Zfhr»)', null, CTX);
    expect(createdKeptSets(p0, user.plan)).toEqual([]);
    const r = tidyKeptColumnSets(verschieben(user.plan), CTX, new Set());
    expect(r.plan.columnSets.some((s) => s.id === user.setId)).toBe(true);
  });

  it('[R-5.2-09] ein aufbewahrter Satz wird am Aufbau erkannt und auch umbenannt aufgeräumt', () => {
    const p0 = plan();
    const removed = insertOrRemoveDayColumn(
      p0,
      'w26',
      'Mo',
      { op: 'remove', columnId: 'c10' },
      'set',
      CTX,
    );
    const kept = createdKeptSets(p0, removed.plan);
    expect(kept).toHaveLength(1);
    const id = kept[0] ?? '';
    const renamed = renameColumnSet(removed.plan, id, 'Alte Folge', CTX).plan;
    const r = tidyKeptColumnSets(verschieben(renamed), CTX, new Set(kept));
    expect(r.plan.columnSets.some((s) => s.id === id)).toBe(false);
    // Nicht in der Liste der Sitzung (z.B. nach dem Neuladen): bleibt.
    const fremd = tidyKeptColumnSets(verschieben(renamed), CTX, new Set());
    expect(fremd.plan.columnSets.some((s) => s.id === id)).toBe(true);
  });
});

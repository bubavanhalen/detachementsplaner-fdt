// @vitest-environment node
// F-UX2 Runde 5 (ux-critic Runde 3, UX-3-02; Beschrieb 4.4, 5.2; R-5.2-09): Entfernen einer Spalte im eigenen bzw. für
// alle Tage verwendeten Spaltensatz – Einträge der Spalte tragen P1 und behalten ihre relative Lage (eine Spalte, nicht
// die ganze Planungsbreite); ohne Einträge in der Spalte kein zusätzlicher Satz; ein Undo-Schritt. Fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { missingColumns } from '../../../../src/components/wap/i2/selectionCommands';
import { relativeColumns } from '../../../../src/model/wap/commands/columns';
import { insertOrRemoveDayColumn } from '../../../../src/model/wap/commands/dayColumns';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, block, withEntries } from '../../support/model/builders';

const CTX = { templates: builtInTemplates() };
const MO = '2026-09-28';

function plan(): Plan {
  return withEntries(basePlan({ id: 'fux2-runde5' }), [
    block('mo10', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c10'] },
    }),
  ]);
}

const drawn = (p: Plan, id: string) => {
  const e = p.entries[id];
  if (e?.type !== 'block') throw new Error('Block fehlt');
  return relativeColumns(p, e.columns, dayColumns(p, 'w26', 'Mo')).map((c) => c.name);
};

describe('F-UX2 Runde 5: entfernte Spalte im eigenen Satz', () => {
  it('[R-5.2-09] UX-3-02: Spalte für alle Tage entfernt – der Block trägt P1 und steht in einer Spalte an der früheren Lage', () => {
    const p = plan();
    const vorher = dayColumns(p, 'w26', 'Mo').map((c) => c.name);
    const r = insertOrRemoveDayColumn(
      p,
      'w26',
      'Mo',
      { op: 'remove', columnId: 'c10' },
      'set',
      CTX,
    );
    expect(missingColumns(r.plan, ['mo10'])).not.toEqual([]);
    const lage = drawn(r.plan, 'mo10');
    expect(lage).toHaveLength(1);
    // Nachbar der früheren Spalte (nicht die ganze Breite, nicht die erste Spalte).
    const i = vorher.indexOf(dayColumns(p, 'w26', 'Mo').find((c) => c.id === 'c10')?.name ?? '');
    expect([vorher[i - 1], vorher[i + 1]]).toContain(lage[0]);
    // Ein Undo-Schritt stellt den Plan her.
    const zurueck = applyPatches(r.plan, r.inversePatches as Parameters<typeof applyPatches>[1]);
    expect(zurueck).toEqual(p);
  });

  it('[R-5.2-09] UX-3-02: ohne Einträge in der Spalte entsteht kein zusätzlicher Spaltensatz', () => {
    const p = plan();
    const r = insertOrRemoveDayColumn(
      p,
      'w26',
      'Mo',
      { op: 'remove', columnId: 'c11' },
      'set',
      CTX,
    );
    expect(r.plan.columnSets.length).toBe(p.columnSets.length);
  });
});

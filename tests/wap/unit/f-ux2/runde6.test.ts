// @vitest-environment node
// F-UX2 Runde 6 (code-reviewer-4 CR-4-01/-03/-04, Repros nach `.qa/haertung/cr-4/keepset.cr.test.ts`, lokal): der beim
// Entfernen einer belegten Spalte aufbewahrte Satz hat einen eindeutigen Namen (Zähler), wird aufgeräumt, sobald kein
// Eintrag mehr auf ihn verweist (ein Rückgängig-Schritt mit der auslösenden Handlung), und berücksichtigt Einträge
// gelöschter Wochen. Fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { relativeColumns } from '../../../../src/model/wap/commands/columns';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import {
  columnSetReferences,
  insertOrRemoveDayColumn,
  tidyKeptColumnSets,
} from '../../../../src/model/wap/commands/dayColumns';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { renameColumnSet } from '../../../../src/model/wap/commands/settings';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, block, withEntries } from '../../support/model/builders';

const CTX = { templates: builtInTemplates() };
const MO = '2026-09-28';

function plan(): Plan {
  return withEntries(basePlan({ id: 'fux2-runde6' }), [
    block('b1', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c10'] },
    }),
  ]);
}

const remove = (p: Plan, id: string) =>
  insertOrRemoveDayColumn(p, 'w26', 'Mo', { op: 'remove', columnId: id }, 'set', CTX);
const undo = (r: CommandResult) =>
  applyPatches(r.plan, r.inversePatches as Parameters<typeof applyPatches>[1]);

describe('F-UX2 Runde 6: aufbewahrter Spaltensatz', () => {
  it('[R-5.2-09] CR-4-01: wiederholtes Entfernen der gleichnamigen Spalte – eindeutige Satznamen, Umbenennen auf den eigenen Namen geht', () => {
    let p = plan();
    const name =
      p.columnSets.flatMap((s) => s.columns).find((c) => c.id === 'c10')?.name ?? 'Spalte';
    p = remove(p, 'c10').plan;
    for (let i = 0; i < 3; i++) {
      const ins = insertOrRemoveDayColumn(
        p,
        'w26',
        'Mo',
        { op: 'insert', index: 0, name },
        'set',
        CTX,
      );
      const id = ins.columnId ?? '';
      const b1 = ins.plan.entries.b1;
      if (b1?.type !== 'block') throw new Error('Block fehlt');
      p = {
        ...ins.plan,
        entries: {
          ...ins.plan.entries,
          [`x${String(i)}`]: { ...b1, id: `x${String(i)}`, columns: { kind: 'ids', ids: [id] } },
        },
      };
      p = remove(p, id).plan;
    }
    const names = p.columnSets.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    const kept = p.columnSets.filter((s) => s.name.includes('vor Entfernen'));
    expect(kept.length).toBe(4);
    for (const s of kept) expect(() => renameColumnSet(p, s.id, s.name, CTX)).not.toThrow();
  });

  it('[R-5.2-09] CR-4-03: nach dem Verschieben des letzten verweisenden Eintrags verschwindet der Satz im selben Rückgängig-Schritt', () => {
    const p = remove(plan(), 'c10').plan;
    const vorher = p.columnSets.length;
    const ziel = dayColumns(p, 'w26', 'Mo').find((c) => c.kind === 'planning');
    if (ziel === undefined) throw new Error('Spalte fehlt');
    const r = tidyKeptColumnSets(
      updateEntry(p, 'b1', 'block', { columns: { kind: 'ids', ids: [ziel.id] } }, CTX),
      CTX,
    );
    expect(r.plan.columnSets.length).toBe(vorher - 1);
    expect(undo(r)).toEqual(p);
    // Ohne aufbewahrte Sätze oder solange Einträge verweisen: unverändert.
    const anderer = updateEntry(p, 'b1', 'block', { title: [{ text: 'Neu', bold: true }] }, CTX);
    expect(tidyKeptColumnSets(anderer, CTX)).toBe(anderer);
  });

  it('[R-5.2-09] CR-4-04: verweist nur ein Eintrag einer gelöschten Woche auf die Spalte, bleibt die Lage aufbewahrt', () => {
    const base = basePlan({ id: 'fux2-runde6-del' });
    const w = base.weeks.find((x) => x.id === 'w27');
    if (w === undefined) throw new Error('Woche fehlt');
    const e = block('d1', 1, {
      date: '2026-10-05',
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c10'] },
    });
    const p: Plan = {
      ...base,
      weeks: base.weeks.filter((x) => x.id !== 'w27'),
      deletedWeeks: [{ week: w, entries: [e] }],
    };
    const r = remove(p, 'c10');
    expect(r.plan.columnSets.length).toBe(p.columnSets.length + 1);
    const kept = r.plan.columnSets[r.plan.columnSets.length - 1];
    expect(columnSetReferences(r.plan, kept?.id ?? '')).toBe(1);
    if (e.type !== 'block') throw new Error('Block fehlt');
    expect(relativeColumns(r.plan, e.columns, dayColumns(r.plan, 'w26', 'Mo'))).toHaveLength(1);
  });
});

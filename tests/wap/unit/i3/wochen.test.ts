// @vitest-environment node
// I3 C3: Wochenbefehle (Beschrieb 5.2, 4.1 «Liste der Wochen»; F-16, F-17). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import {
  deleteWeek,
  duplicateWeek,
  insertWeek,
  insertWeekPreview,
  renameWeek,
  restoreWeek,
  setWeekStart,
} from '../../../../src/model/wap/commands/weeks';
import type { Plan } from '../../../../src/model/wap/types';
import { CTX, kpPlan, undo, weekId } from '../../support/i3/plan';

function labels(plan: Plan): string[] {
  return plan.weeks.map((w) => `${w.shortName}@${w.startDate}`);
}

function withBlock(plan: Plan, date: string, title: string): { plan: Plan; id: string } {
  const r = createEntry(
    plan,
    {
      type: 'block',
      date,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'all' },
      title: [{ text: title, bold: true }],
    },
    CTX,
  );
  return { plan: r.plan, id: r.entryId };
}

describe('I3 C3 Wochen', () => {
  it('[R-4.1-16] Reihenfolge der Wochen nach Einfügen, Löschen und Wiederherstellen stabil (nach Datum)', () => {
    const p = kpPlan(3);
    expect(labels(p)).toEqual(['KVK@2026-09-28', 'Wo1@2026-10-05', 'Wo2@2026-10-12']);
    // Einfügen hinter der letzten Woche: Vorwoche + 7 Tage (F-16).
    const ins = insertWeek(p, weekId(p, 2), { shiftFollowing: false }, CTX);
    expect(labels(ins.plan)).toEqual([
      'KVK@2026-09-28',
      'Wo1@2026-10-05',
      'Wo2@2026-10-12',
      'Wo3@2026-10-19',
    ]);
    const del = deleteWeek(ins.plan, weekId(ins.plan, 1), CTX);
    expect(labels(del.plan)).toEqual(['KVK@2026-09-28', 'Wo2@2026-10-12', 'Wo3@2026-10-19']);
    const back = restoreWeek(del.plan, 0, CTX);
    expect(labels(back.plan)).toEqual(labels(ins.plan));
    expect(back.plan.deletedWeeks).toEqual([]);
  });

  it('[R-4.1-16] Einfügen mitten im Plan: ohne Bestätigung abgelehnt (F-16), mit Verschieben rücken die Folgewochen samt Einträgen um eine Woche', () => {
    const p0 = kpPlan(3);
    const { plan: p, id } = withBlock(p0, '2026-10-14', 'Block Wo2');
    const preview = insertWeekPreview(p, weekId(p, 0));
    expect(preview.startDate).toBe('2026-10-05');
    expect(preview.collides).toBe(true);
    expect(preview.shifted.map((s) => `${s.from}→${s.to}`)).toEqual([
      '2026-10-05→2026-10-12',
      '2026-10-12→2026-10-19',
    ]);
    expect(() => insertWeek(p, weekId(p, 0), { shiftFollowing: false }, CTX)).toThrow(
      /liegt schon eine Woche/,
    );
    const r = insertWeek(p, weekId(p, 0), { shiftFollowing: true }, CTX);
    expect(r.plan.weeks.map((w) => w.startDate)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(r.plan.weeks[1]?.id).toBe(r.weekId);
    expect(r.plan.entries[id]).toMatchObject({ date: '2026-10-21' });
    expect(undo(r).entries[id]).toMatchObject({ date: '2026-10-14' });
  });

  it('[R-4.1-16] Duplizieren: unabhängige Kopien aller Einträge, Spaltensätze und Darstellungen in der neuen Woche', () => {
    const p0 = kpPlan(2);
    const { plan: p, id } = withBlock(p0, '2026-10-06', 'Block Wo1');
    const r = duplicateWeek(p, weekId(p, 1), { shiftFollowing: false }, CTX);
    const copy = r.plan.weeks.find((w) => w.id === r.weekId);
    expect(copy?.startDate).toBe('2026-10-12');
    expect(copy?.days.map((d) => d.columnSetId)).toEqual(
      p.weeks[1]?.days.map((d) => d.columnSetId),
    );
    const copies = Object.values(r.plan.entries).filter(
      (e) => e.type === 'block' && e.date === '2026-10-13',
    );
    expect(copies).toHaveLength(1);
    expect(copies[0]?.id).not.toBe(id);
    expect(r.plan.entries[id]).toMatchObject({ date: '2026-10-06' });
  });

  it('[R-4.1-16] Umbenennen und Startdatum: Kurzname eindeutig, Startdatum nur Montag, Einträge wandern mit', () => {
    const p0 = kpPlan(2);
    const { plan: p, id } = withBlock(p0, '2026-10-06', 'Block Wo1');
    const named = renameWeek(p, weekId(p, 1), { label: 'FDT Woche 1', shortName: 'Wo1' }, CTX);
    expect(named.plan.weeks[1]).toMatchObject({ label: 'FDT Woche 1', shortName: 'Wo1' });
    expect(() => renameWeek(p, weekId(p, 1), { label: 'X', shortName: 'KVK' }, CTX)).toThrow(
      /Kurznamen/,
    );
    expect(() => setWeekStart(p, weekId(p, 1), '2026-10-07', CTX)).toThrow(/kein Montag/);
    const moved = setWeekStart(p, weekId(p, 1), '2026-10-19', CTX);
    expect(moved.plan.weeks[1]?.startDate).toBe('2026-10-19');
    expect(moved.plan.entries[id]).toMatchObject({ date: '2026-10-20' });
    expect(() => setWeekStart(p, weekId(p, 1), '2026-09-28', CTX)).toThrow(/schon eine Woche/);
  });

  it('[R-4.1-16] Löschen legt Woche und Einträge in «Gelöschte Wochen»; Wiederherstellen ergibt dieselben Einträge (F-17)', () => {
    const p0 = kpPlan(3);
    const { plan: p, id } = withBlock(p0, '2026-10-07', 'Block Wo1');
    const before = p.entries[id];
    const del = deleteWeek(p, weekId(p, 1), CTX);
    expect(del.plan.entries[id]).toBeUndefined();
    expect(del.plan.deletedWeeks).toHaveLength(1);
    expect(del.plan.deletedWeeks[0]?.entries.map((e) => e.id)).toEqual([id]);
    const back = restoreWeek(del.plan, 0, CTX);
    expect(back.plan.entries[id]).toEqual(before);
    expect(() => deleteWeek(kpPlan(1), weekId(kpPlan(1), 0), CTX)).toThrow(/einzige Woche/);
  });
});

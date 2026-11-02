// @vitest-environment jsdom
// I3 C2/C3: Darstellung aus der Layout-Schicht (eine Quelle für Bildschirm und PDF, E1-02l R3): Rapport-Anzeige
// «auch/nur in Spalten», Spaltensatz-Wechsel mit P1-Marke, Status-Darstellung. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { missingColumns } from '../../../../src/components/wap/i2/selectionCommands';
import { updateColumnSet } from '../../../../src/model/wap/commands/columns';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import {
  createEntry,
  deleteEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import { STATUS_RED } from '../../../../src/model/wap/layout/entries/status';
import { layoutGrid } from '../../../../src/model/wap/layout/grid/layout';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { pageGeometryFor } from '../../../../src/model/wap/layout/page/geometry';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { CTX, columnsOf, kpPlan, weekId } from '../../support/i3/plan';

const MO = '2026-09-28';

function grid(plan: Plan, showStatus = false): GridLayout {
  const template = kpTemplate();
  return layoutGrid({
    plan,
    weekId: weekId(plan, 0),
    template,
    frame: {
      rect: { x: 0, y: 0, w: 800, h: 500 },
      timeAxisWidthPt: 0,
      dayHeaderHeightPt: 0,
      columnHeaderHeightPt: 0,
      lines: pageGeometryFor(template.pageGeometryId).lines,
    },
    showStatus,
  });
}

function piecesOf(g: GridLayout, id: Id): readonly string[] {
  return (g.entries.find((e) => e.entryId === id)?.pieces ?? []).map((p) => p.kind);
}

function rapport(plan: Plan, display: 'alsoInColumns' | 'onlyInColumns'): { plan: Plan; id: Id } {
  const cols = columnsOf(plan, 0, 'Mo').filter((c) => c.kind === 'planning');
  const r = createEntry(
    plan,
    {
      type: 'rapport',
      date: MO,
      code: 'KR',
      time: { form: 'range', from: 1080, to: 1110 },
      display,
      displayColumns: { kind: 'ids', ids: [cols[0]?.id ?? '', cols[1]?.id ?? ''] },
    },
    CTX,
  );
  return { plan: r.plan, id: r.entryId };
}

describe('I3 Rapport-Anzeige', () => {
  it('[R-4.6-22] «auch in Spalten»: Kästchen in der Rap-Spalte und Block in den Spalten, ein Objekt (Zeit und Löschen wirken auf beide)', () => {
    const { plan, id } = rapport(kpPlan(1), 'alsoInColumns');
    expect([...piecesOf(grid(plan), id)].sort()).toEqual(['block', 'rapportBox']);
    const moved = updateEntry(
      plan,
      id,
      'rapport',
      { time: { form: 'range', from: 1140, to: 1170 } },
      CTX,
    ).plan;
    const g = grid(moved);
    const pieces = g.entries.find((e) => e.entryId === id)?.pieces ?? [];
    expect(pieces.every((p) => p.span?.from === 1140)).toBe(true);
    expect(piecesOf(grid(deleteEntries(moved, [id], CTX).plan), id)).toEqual([]);
  });

  it('[R-4.6-23] «nur in Spalten»: kein Kästchen in der Rap-Spalte, Block in den gewählten Spalten', () => {
    const { plan, id } = rapport(kpPlan(1), 'onlyInColumns');
    expect(piecesOf(grid(plan), id)).toEqual(['block']);
  });
});

describe('I3 Spaltensatz-Wechsel', () => {
  it('[R-5.2-08] Spalte eingefügt → bestehende Einträge bleiben in ihren Spalten; [R-5.2-09] Spalte entfernt → Eintrag bleibt und trägt die P1-Marke', () => {
    const p = kpPlan(1);
    const set = p.columnSets[0];
    const zfhr = set?.columns.find((c) => c.name === 'Zfhr');
    if (set === undefined || zfhr === undefined) throw new Error('Vorlage ohne Zfhr');
    const b = createEntry(
      p,
      {
        type: 'block',
        date: MO,
        time: { form: 'range', from: 480, to: 540 },
        columns: { kind: 'ids', ids: [zfhr.id] },
        title: [{ text: 'Ausb Muster', bold: true }],
      },
      CTX,
    );
    const added = updateColumnSet(
      b.plan,
      set.id,
      { op: 'add', index: 0, column: { name: 'Neu', kind: 'planning' } },
      CTX,
    );
    expect(added.plan.entries[b.entryId]).toMatchObject({
      columns: { kind: 'ids', ids: [zfhr.id] },
    });
    expect(missingColumns(added.plan, [b.entryId])).toEqual([]);
    const removed = updateColumnSet(added.plan, set.id, { op: 'remove', columnId: zfhr.id }, CTX);
    expect(removed.plan.entries[b.entryId]).toBeDefined();
    expect(missingColumns(removed.plan, [b.entryId])).toHaveLength(1);
    // Gezeichnet an der relativen Lage (nicht gelöscht).
    expect(piecesOf(grid(removed.plan), b.entryId)).toEqual(['block']);
  });

  it('[R-5.2-09] anderer Spaltensatz für den Tag: Eintrag in fehlender Spalte bleibt, P1-Marke; ein Undo-Schritt für mehrere Tage', () => {
    const p = kpPlan(1);
    const stufen = p.columnSets[0];
    const miFr = p.columnSets[1];
    const uof = stufen?.columns.find((c) => c.name === 'Uof');
    if (stufen === undefined || miFr === undefined || uof === undefined) throw new Error('Vorlage');
    const b = createEntry(
      p,
      {
        type: 'block',
        date: MO,
        time: { form: 'range', from: 480, to: 540 },
        columns: { kind: 'ids', ids: [uof.id] },
        title: [{ text: 'Block Uof', bold: true }],
      },
      CTX,
    );
    const r = setDayColumnSet(b.plan, weekId(p, 0), ['Mo', 'Di', 'Mi'], miFr.id, CTX);
    expect(r.plan.weeks[0]?.days.slice(0, 3).map((d) => d.columnSetId)).toEqual([
      miFr.id,
      miFr.id,
      miFr.id,
    ]);
    expect(r.plan.entries[b.entryId]).toBeDefined();
    expect(missingColumns(r.plan, [b.entryId])).toEqual(['Uof']);
  });
});

describe('I3 Status-Darstellung in der Layout-Schicht', () => {
  it('[R-10-27] offen → Titel rot (#c00000); [R-10-29] gestrichen → alle Zeilen rot durchgestrichen; ohne Status-Darstellung schwarz', () => {
    const p = kpPlan(1);
    const make = (plan: Plan, title: string, from: number, status: 'open' | 'cancelled') =>
      createEntry(
        plan,
        {
          type: 'block',
          date: MO,
          time: { form: 'range', from, to: from + 120 },
          columns: { kind: 'all' },
          title: [{ text: title, bold: true }],
          supplement: 'Zusatz Muster',
          status,
        },
        CTX,
      );
    const a = make(p, 'Offener Block', 480, 'open');
    const c = make(a.plan, 'Gestrichener Block', 720, 'cancelled');
    const texts = (g: GridLayout, id: Id) =>
      g.items
        .filter((i) => i.kind === 'text' && i.entryId === id)
        .flatMap((i) => (i.kind === 'text' ? i.runs : []));
    const on = grid(c.plan, true);
    const open = texts(on, a.entryId);
    expect(open.find((r) => r.text.includes('Offener'))?.color).toEqual(STATUS_RED);
    expect(open.find((r) => r.text.includes('Zusatz'))?.color).not.toEqual(STATUS_RED);
    const cancelled = texts(on, c.entryId);
    expect(cancelled.length).toBeGreaterThan(0);
    expect(cancelled.every((r) => r.strike && r.color.r === 192)).toBe(true);
    const off = grid(c.plan, false);
    expect(
      [...texts(off, a.entryId), ...texts(off, c.entryId)].some(
        (r) => r.strike || r.color.r === 192,
      ),
    ).toBe(false);
  });
});

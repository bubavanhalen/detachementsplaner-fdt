// @vitest-environment node
// F-UX3 Runde 4 (Rückmeldung Auftraggeber 21.10.2026 zu e1598a3: «with shift, it only moves items that are equal
// width, but it should move all items below. And with normal drag, it should not overlap … grow one item and the
// connected ones shrink»; Auftrag Koordinator): Shift schiebt alle Einträge darunter mit überschneidenden Spalten,
// transitiv, bis Tagesende (Blöcke, Rapporte in Planungsspalten, Beso-Kästchen; Marker bleiben); ohne Taste nie
// überlappen (gemeinsame Kante, Andocken und Schrumpfen, Verdrängen beim Verschieben); nur Alt überlappt. Fiktive
// Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  applyArrangement,
  arrangeBlocks,
  type BlockGesture,
} from '../../../../src/model/wap/commands/arrange';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Beso, Block, Plan } from '../../../../src/model/wap/types';
import {
  basePlan,
  beso,
  block,
  marker,
  rapport,
  rt,
  withEntries,
} from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };
const MO = '2026-09-28';
const c8 = { kind: 'ids', ids: ['c8'] } as const;
const c9 = { kind: 'ids', ids: ['c9'] } as const;
const c89 = { kind: 'ids', ids: ['c8', 'c9'] } as const;
const c10 = { kind: 'ids', ids: ['c10'] } as const;
const range = (from: number, to: number) => ({ form: 'range', from, to }) as const;

/**
 * A 0800–0900 (c8), B 1000–1100 (c8), W 1200–1300 (c8+c9), D 1330–1400 (c9), E 0800–0900 (c10, unbeteiligt),
 * Beso-Kästchen 1030 in c8, Rapport 1230 in Planungsspalten c9, Rapport 1000 in der Rap-Spalte, Marker 1000.
 */
function tag(): Plan {
  return withEntries(basePlan(), [
    block('eA', 1, { title: rt('Alpha'), time: range(480, 540), columns: c8 }),
    block('eB', 2, { title: rt('Bravo'), time: range(600, 660), columns: c8 }),
    block('eW', 3, { title: rt('Breit'), time: range(720, 780), columns: c89 }),
    block('eD', 4, { title: rt('Delta'), time: range(810, 840), columns: c9 }),
    block('eE', 5, { title: rt('Echo'), time: range(480, 540), columns: c10 }),
    beso('eS', 6, {
      date: MO,
      windows: [{ id: 'tS', time: { form: 'point', at: 630 }, columnId: 'c8', supplement: '' }],
    }),
    rapport('eR', 7, {
      date: MO,
      time: { form: 'point', at: 750 },
      display: 'alsoInColumns',
      displayColumns: c9,
    }),
    rapport('eQ', 8, { date: MO, time: { form: 'point', at: 600 } }),
    marker('eM', 9, { date: MO, at: 600, columns: { kind: 'all' } }),
  ]);
}

function timeOf(plan: Plan, id: string): [number, number] {
  const e = plan.entries[id] as Block;
  if (e.time.form !== 'range') throw new Error('Zeitform');
  return [e.time.from, e.time.to];
}

function apply(plan: Plan, gesture: BlockGesture, mode: 'adjust' | 'shift' | 'none') {
  return applyArrangement(
    plan,
    gesture,
    mode,
    (p, time) => {
      const id = gesture.kind === 'create' ? '' : gesture.blockId;
      const r = updateEntry(
        p,
        id,
        'block',
        gesture.kind === 'move'
          ? {
              date: gesture.target.date,
              time: range(time.from, time.to),
              columns: gesture.target.columns,
            }
          : { time: range(time.from, time.to) },
        ctx,
      );
      return { ...r, entryId: id };
    },
    ctx,
  );
}

describe('F-UX3 Runde 4: Shift schiebt alle Einträge darunter (transitiv)', () => {
  it('[R-5.1-14] untere Kante mit Shift: alle darunter mit überschneidenden Spalten, transitiv, Beso-Kästchen mit; Marker, Rap-Spalte und Unbeteiligte bleiben', () => {
    const a = arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 600 }, 'shift');
    expect(a.target).toEqual({ from: 480, to: 600 });
    // B, Beso-Kästchen (c8) und W (c8+c9) liegen darunter; D (c9), weil W ihn überdecken würde (transitiv). Der
    // Rapport in c9 liegt neben A innerhalb von W (nicht darunter) und wird nicht überdeckt: bleibt.
    expect(a.changes).toEqual([
      { id: 'eB', from: 660, to: 720 },
      { id: 'eW', from: 780, to: 840 },
      { id: 'eD', from: 870, to: 900 },
    ]);
    expect(a.shifts).toEqual([{ id: 'eS', windowId: 'tS', delta: 60 }]);
  });

  it('[R-5.1-14] ein Undo-Schritt; Beso-Zeitfenster und Rapport rücken, Marker und Rap-Spalte bleiben', () => {
    const plan = tag();
    const r = apply(plan, { kind: 'end', blockId: 'eA', edge: 600 }, 'shift');
    expect(timeOf(r.plan, 'eD')).toEqual([870, 900]);
    expect((r.plan.entries.eS as Beso).windows[0]?.time).toEqual({ form: 'point', at: 690 });
    for (const id of ['eR', 'eQ', 'eM', 'eE']) expect(r.plan.entries[id]).toEqual(plan.entries[id]);
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(plan);
    expect(r.label).toContain('4 Nachbarn angepasst');
  });

  it('[R-5.1-14] Verschieben mit Shift: Folgendes rückt so weit nötig, auch in anderen Spalten über einen breiten Block (transitiv)', () => {
    const a = arrangeBlocks(
      tag(),
      { kind: 'move', blockId: 'eA', target: { date: MO, from: 690, to: 750, columns: c8 } },
      'shift',
    );
    // Ziel 1130–1230 in c8: W (c8+c9, 1200) rückt auf 1230–1330; in c9 liegen danach der Rapport (1230) und D (1330)
    // unter W → Rapport auf 1330, D auf 1400 (je so weit nötig).
    expect(a.changes).toEqual([
      { id: 'eW', from: 750, to: 810 },
      { id: 'eD', from: 840, to: 870 },
    ]);
    expect(a.shifts).toEqual([{ id: 'eR', windowId: null, delta: 60 }]);
    const b = arrangeBlocks(
      tag(),
      { kind: 'move', blockId: 'eA', target: { date: MO, from: 690, to: 780, columns: c8 } },
      'shift',
    );
    expect(b.changes).toEqual([
      { id: 'eW', from: 780, to: 840 },
      { id: 'eD', from: 870, to: 900 },
    ]);
    expect(b.shifts).toEqual([{ id: 'eR', windowId: null, delta: 90 }]);
  });
});

describe('F-UX3 Runde 4: ohne Taste nie überlappen', () => {
  it('[R-5.1-14] gemeinsame Kante: der Nachbar schrumpft mit, an der Grenze (15 Min) hält die Kante an («limit»); zurück wächst er', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(480, 540), columns: c8 }),
      block('eB', 2, { time: range(540, 600), columns: c8 }),
    ]);
    expect(
      arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 570 }, 'adjust').changes,
    ).toEqual([{ id: 'eB', from: 570, to: 600 }]);
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 600 }, 'adjust')).toMatchObject({
      target: { from: 480, to: 585 },
      changes: [{ id: 'eB', from: 585, to: 600 }],
      limit: true,
    });
    expect(
      arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 510 }, 'adjust').changes,
    ).toEqual([{ id: 'eB', from: 510, to: 600 }]);
  });

  it('[R-5.1-14] freie Kante: dockt an und lässt ab dort den Nachbarn schrumpfen, auch bei überschneidenden Spalten', () => {
    const plan = tag();
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eB', edge: 720 }, 'adjust')).toEqual({
      target: { from: 600, to: 720 },
      changes: [],
      splits: [],
      dock: 'eW',
    });
    // W (c8+c9) schrumpft von oben, obwohl er breiter ist.
    expect(
      arrangeBlocks(plan, { kind: 'end', blockId: 'eB', edge: 750 }, 'adjust').changes,
    ).toEqual([{ id: 'eW', from: 750, to: 780 }]);
    // Nach oben: D (c9) dockt an. Code-Review CR-F3-04 (Entscheid Koordinator 23.10.2026): der Rapport in c9
    // (1230–1300, in den Planungsspalten angezeigt) gilt wie ein Block – die Kante hält an seinem Ende an, er wird
    // nicht überdeckt (vorher schrumpfte W bis 1245 und überdeckte den Rapport).
    expect(arrangeBlocks(plan, { kind: 'start', blockId: 'eD', edge: 765 }, 'adjust')).toEqual({
      target: { from: 780, to: 840 },
      changes: [],
      splits: [],
      // W und der Rapport enden beide 1300; angezeigt wird der Block.
      dock: 'eW',
    });
  });

  it('[R-5.1-14] Verschieben auf belegte Fläche: Teile werden gekürzt bzw. ausgespart; ganz Überdecktes rückt direkt darunter, Folgendes gleicher Spalten mit', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(480, 540), columns: c8 }),
      block('eB', 2, { time: range(540, 570), columns: c8 }),
      block('eC', 3, { time: range(600, 660), columns: c8 }),
      block('eZ', 4, { time: range(900, 960), columns: c8 }),
    ]);
    const a = arrangeBlocks(
      plan,
      { kind: 'move', blockId: 'eZ', target: { date: MO, from: 525, to: 585, columns: c8 } },
      'adjust',
    );
    // A behält 0800–0845; B (ganz überdeckt) rückt auf 0945–1015; C (1000) dahinter auf 1015–1115.
    expect(a.changes).toEqual([
      { id: 'eA', from: 480, to: 525 },
      { id: 'eB', from: 585, to: 615 },
      { id: 'eC', from: 615, to: 675 },
    ]);
    expect(a.splits).toEqual([]);
  });

  it('[R-5.1-14] nur Alt überlappt: keine Anpassung an Kante und beim Verschieben', () => {
    const plan = tag();
    for (const g of [
      { kind: 'end', blockId: 'eA', edge: 720 },
      { kind: 'move', blockId: 'eB', target: { date: MO, from: 480, to: 540, columns: c8 } },
    ] as const) {
      const r = arrangeBlocks(plan, g, 'none');
      expect([r.changes, r.splits, r.shifts, r.dock]).toEqual([[], [], undefined, undefined]);
    }
    // Der unbeteiligte Block (c10) bleibt in jedem Modus.
    for (const m of ['adjust', 'shift'] as const)
      expect(
        arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 720 }, m).changes.some(
          (c) => c.id === 'eE',
        ),
      ).toBe(false);
  });
});

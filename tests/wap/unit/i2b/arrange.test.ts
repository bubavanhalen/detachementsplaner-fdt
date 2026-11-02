// @vitest-environment node
// I2b-A A7 «Nachbarblöcke, Variante c»: Kante, Shift-Kaskade, Verschieben in belegten Bereich, Alt, Erfassen.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  applyArrangement,
  arrangeBlocks,
  type BlockGesture,
} from '../../../../src/model/wap/commands/arrange';
import { createEntry, updateEntry } from '../../../../src/model/wap/commands/entries';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Block, Plan } from '../../../../src/model/wap/types';
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
const one = { kind: 'ids', ids: ['c8'] } as const;
const two = { kind: 'ids', ids: ['c8', 'c9'] } as const;

function range(from: number, to: number) {
  return { form: 'range', from, to } as const;
}

/** Fiktiver Tag: A 0800–0900, B 0900–1000, C 1000–1100 in Spalte «Kp Kdt», dazu Fremdes. */
function chain(extra: readonly Parameters<typeof withEntries>[1][number][] = []): Plan {
  return withEntries(basePlan(), [
    block('eA', 1, { title: rt('Alpha'), time: range(480, 540), columns: one }),
    block('eB', 2, { title: rt('Bravo'), time: range(540, 600), columns: one }),
    block('eC', 3, { title: rt('Charlie'), time: range(600, 660), columns: one }),
    ...extra,
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
      if (gesture.kind === 'create') {
        return createEntry(
          p,
          {
            type: 'block',
            date: gesture.target.date,
            time: range(time.from, time.to),
            columns: gesture.target.columns,
            title: rt('Neu', true),
          },
          ctx,
        );
      }
      const r = updateEntry(
        p,
        gesture.blockId,
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
      return { ...r, entryId: gesture.blockId };
    },
    ctx,
  );
}

describe('I2b A7 Kante ziehen', () => {
  it('[R-5.1-14] ohne Taste passt der direkt angrenzende Nachbar seine Kante an, sonst bleibt alles', () => {
    const plan = chain();
    const later = arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 570 }, 'adjust');
    expect(later).toEqual({
      target: { from: 480, to: 570 },
      changes: [{ id: 'eB', from: 570, to: 600 }],
      splits: [],
    });
    const earlier = arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 510 }, 'adjust');
    expect(earlier.changes).toEqual([{ id: 'eB', from: 510, to: 600 }]);
    const top = arrangeBlocks(plan, { kind: 'start', blockId: 'eC', edge: 585 }, 'adjust');
    expect(top).toEqual({
      target: { from: 585, to: 660 },
      changes: [{ id: 'eB', from: 540, to: 585 }],
      splits: [],
    });
    const lone = withEntries(basePlan(), [
      block('eA', 1, { time: range(480, 540), columns: one }),
      block('eB', 2, { time: range(570, 600), columns: one }),
    ]);
    expect(
      arrangeBlocks(lone, { kind: 'end', blockId: 'eA', edge: 555 }, 'adjust').changes,
    ).toEqual([]);
  });

  it('[R-5.1-14] der Nachbar wird nie kürzer als 15 Minuten; die Kante hält dort an', () => {
    // Entscheid Auftraggeber 21.10.2026 (Shift alle darunter, ohne Taste nie überlappen): angehalten wird mit
    // `limit` (Hinweis «Shift = mitschieben»).
    const plan = chain();
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 600 }, 'adjust')).toEqual({
      target: { from: 480, to: 585 },
      changes: [{ id: 'eB', from: 585, to: 600 }],
      splits: [],
      limit: true,
    });
    expect(arrangeBlocks(plan, { kind: 'start', blockId: 'eB', edge: 480 }, 'adjust')).toEqual({
      target: { from: 495, to: 600 },
      changes: [{ id: 'eA', from: 480, to: 495 }],
      splits: [],
      limit: true,
    });
  });

  it('[R-5.1-14] mit Shift rücken alle folgenden bzw. vorangehenden Blöcke um die Differenz, Dauer bleibt', () => {
    const plan = chain();
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 570 }, 'shift')).toEqual({
      target: { from: 480, to: 570 },
      changes: [
        { id: 'eB', from: 570, to: 630 },
        { id: 'eC', from: 630, to: 690 },
      ],
      splits: [],
    });
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 510 }, 'shift').changes).toEqual(
      [
        { id: 'eB', from: 510, to: 570 },
        { id: 'eC', from: 570, to: 630 },
      ],
    );
    expect(arrangeBlocks(plan, { kind: 'start', blockId: 'eC', edge: 570 }, 'shift')).toEqual({
      target: { from: 570, to: 660 },
      changes: [
        { id: 'eA', from: 450, to: 510 },
        { id: 'eB', from: 510, to: 570 },
      ],
      splits: [],
    });
  });

  it('[R-5.1-14] Shift-Kaskade bleibt im Tag: die Kante hält an, wenn ein Folgeblock 2400 erreichen würde', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(1200, 1320), columns: one }),
      block('eB', 2, { time: range(1320, 1410), columns: one }),
    ]);
    const r = arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 1380 }, 'shift');
    expect(r.target).toEqual({ from: 1200, to: 1350 });
    expect(r.changes).toEqual([{ id: 'eB', from: 1350, to: 1440 }]);
  });

  // Entscheid Auftraggeber 21.10.2026 (Shift alle darunter, ohne Taste nie überlappen): nach aussen schrumpft jeder
  // Block mit überschneidenden Spalten (vorher nur gleiche bzw. über alle Spalten); Shift schiebt alle darunter mit
  // überschneidenden Spalten (vorher nur gleiche Spalten).
  it('[R-5.1-14] Kante nach aussen: Blöcke mit überschneidenden Spalten schrumpfen; Shift schiebt alle mit überschneidenden Spalten', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(480, 540), columns: one }),
      block('eW', 2, { time: range(540, 600), columns: two }),
      block('eAll', 3, { time: range(600, 660), columns: { kind: 'all' } }),
      block('eX', 4, { time: range(540, 600), columns: { kind: 'ids', ids: ['c10'] } }),
    ]);
    expect(
      arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 555 }, 'adjust').changes,
    ).toEqual([{ id: 'eW', from: 555, to: 600 }]);
    expect(
      arrangeBlocks(plan, { kind: 'end', blockId: 'eX', edge: 615 }, 'adjust').changes,
    ).toEqual([{ id: 'eAll', from: 615, to: 660 }]);
    expect(arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 615 }, 'shift').changes).toEqual(
      [
        { id: 'eW', from: 615, to: 675 },
        { id: 'eAll', from: 675, to: 735 },
      ],
    );
  });
});

describe('I2b A7 Verschieben und Erfassen', () => {
  it('[R-5.1-14] ohne Taste werden Überdecktes gekürzt bzw. ausgespart, nichts wandert', () => {
    const plan = chain();
    const gesture = (from: number, to: number): BlockGesture => ({
      kind: 'move',
      blockId: 'eC',
      target: { date: MO, from, to, columns: one },
    });
    expect(arrangeBlocks(plan, gesture(510, 570), 'adjust')).toEqual({
      target: { from: 510, to: 570 },
      changes: [
        { id: 'eA', from: 480, to: 510 },
        { id: 'eB', from: 570, to: 600 },
      ],
      splits: [],
    });
    const wide = withEntries(basePlan(), [
      block('eL', 1, { time: range(480, 720), columns: one }),
      block('eM', 2, { time: range(900, 930), columns: one }),
    ]);
    expect(
      arrangeBlocks(
        wide,
        { kind: 'move', blockId: 'eM', target: { date: MO, from: 540, to: 600, columns: one } },
        'adjust',
      ),
    ).toEqual({
      target: { from: 540, to: 600 },
      changes: [{ id: 'eL', from: 480, to: 540 }],
      splits: [{ sourceId: 'eL', from: 600, to: 720 }],
    });
    // Entscheid Auftraggeber 21.10.2026 (ohne Taste nie überlappen): ganz Überdecktes bzw. ein Rest unter 15 Min
    // rückt direkt unter das Ziel (vorher blieb es parallel).
    expect(arrangeBlocks(plan, gesture(470, 610), 'adjust').changes).toEqual([
      { id: 'eA', from: 610, to: 670 },
      { id: 'eB', from: 670, to: 730 },
    ]);
    expect(arrangeBlocks(plan, gesture(530, 590), 'adjust').changes).toEqual([
      { id: 'eA', from: 480, to: 530 },
      { id: 'eB', from: 590, to: 650 },
    ]);
  });

  it('[R-5.1-14] ein breiterer Block über alle Spalten wird ausgespart, ohne dass seine Daten ändern', () => {
    const plan = withEntries(basePlan(), [
      block('eAll', 1, { time: range(480, 720), columns: { kind: 'all' } }),
      block('eM', 2, { time: range(900, 960), columns: one }),
    ]);
    expect(
      arrangeBlocks(
        plan,
        { kind: 'move', blockId: 'eM', target: { date: MO, from: 540, to: 600, columns: one } },
        'adjust',
      ),
    ).toEqual({ target: { from: 540, to: 600 }, changes: [], splits: [] });
  });

  it('[R-5.1-14] mit Shift rücken die Folgeblöcke nach, ein angeschnittener wird geteilt', () => {
    const plan = chain();
    const r = arrangeBlocks(
      plan,
      { kind: 'move', blockId: 'eC', target: { date: MO, from: 510, to: 540, columns: one } },
      'shift',
    );
    expect(r).toEqual({
      target: { from: 510, to: 540 },
      changes: [
        { id: 'eA', from: 480, to: 510 },
        { id: 'eB', from: 570, to: 630 },
      ],
      splits: [{ sourceId: 'eA', from: 540, to: 570 }],
    });
    const pushed = arrangeBlocks(
      chain(),
      { kind: 'create', target: { date: MO, from: 540, to: 570, columns: one } },
      'shift',
    );
    expect(pushed.changes).toEqual([
      { id: 'eB', from: 570, to: 630 },
      { id: 'eC', from: 630, to: 690 },
    ]);
  });

  it('[R-5.1-14] mit Alt keine Anpassung (parallel bzw. Ausnahme)', () => {
    const plan = chain();
    for (const gesture of [
      { kind: 'end', blockId: 'eA', edge: 570 },
      { kind: 'move', blockId: 'eC', target: { date: MO, from: 510, to: 570, columns: one } },
      { kind: 'create', target: { date: MO, from: 495, to: 525, columns: one } },
    ] as const) {
      expect(arrangeBlocks(plan, gesture, 'none').changes).toEqual([]);
      expect(arrangeBlocks(plan, gesture, 'none').splits).toEqual([]);
    }
  });

  it('[R-5.1-02] neuer Block mitten in einen bestehenden spart ihn aus (Standard)', () => {
    const plan = withEntries(basePlan(), [block('eL', 1, { time: range(480, 720), columns: one })]);
    const r = apply(
      plan,
      { kind: 'create', target: { date: MO, from: 540, to: 600, columns: one } },
      'adjust',
    );
    const blocks = Object.values(r.plan.entries).filter((e): e is Block => e.type === 'block');
    expect(
      blocks
        .map((b) => [
          b.time.form === 'range' ? b.time.from : -1,
          b.time.form === 'range' ? b.time.to : -1,
        ])
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
    ).toEqual([
      [480, 540],
      [540, 600],
      [600, 720],
    ]);
    expect(r.label).toContain('1 Nachbar angepasst');
  });

  it('[R-5.1-16] beim Verschieben auf einen anderen Tag gelten die Nachbarn des Zieltags', () => {
    const plan = withEntries(chain(), [
      block('eD', 4, { date: '2026-09-29', time: range(480, 600), columns: one }),
    ]);
    const r = arrangeBlocks(
      plan,
      {
        kind: 'move',
        blockId: 'eA',
        target: { date: '2026-09-29', from: 540, to: 660, columns: one },
      },
      'adjust',
    );
    expect(r.changes).toEqual([{ id: 'eD', from: 480, to: 540 }]);
  });
});

describe('I2b A7 ein Undo-Schritt', () => {
  it('[R-5.6-16] die ganze Geste ist ein Befehl; die inversen Patches stellen alles her', () => {
    // Entscheid Auftraggeber 21.10.2026 (Shift alle darunter): das Beso-Kästchen in der Spalte des Blocks rückt mit;
    // Marker und der Rapport in der Rap-Spalte bleiben.
    const plan = chain([
      marker('eMk', 5, { date: MO, at: 570, columns: one }),
      rapport('eR', 6, { date: MO, time: range(540, 570) }),
      beso('eS', 7, {
        date: MO,
        windows: [{ id: 'tS', time: { form: 'point', at: 555 }, columnId: 'c8', supplement: '' }],
      }),
    ]);
    const r = apply(plan, { kind: 'end', blockId: 'eA', edge: 570 }, 'shift');
    expect(timeOf(r.plan, 'eA')).toEqual([480, 570]);
    expect(timeOf(r.plan, 'eB')).toEqual([570, 630]);
    expect(timeOf(r.plan, 'eC')).toEqual([630, 690]);
    for (const id of ['eMk', 'eR']) expect(r.plan.entries[id]).toEqual(plan.entries[id]);
    const s = r.plan.entries.eS;
    expect(s?.type === 'beso' ? s.windows[0]?.time : null).toEqual({ form: 'point', at: 585 });
    expect(r.label).toBe('Block «Alpha» geändert · 3 Nachbarn angepasst');
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(plan);
    expect(applyPatches(plan, [...r.patches])).toEqual(r.plan);
    expect(r.affectedEntryIds).toEqual(['eA', 'eB', 'eC', 'eS']);
  });

  it('[R-5.6-16] Teilstück als neue Kopie mit eigener ID; Undo entfernt sie wieder', () => {
    const plan = withEntries(basePlan(), [
      block('eL', 1, { title: rt('Lang'), time: range(480, 720), columns: one }),
      block('eM', 2, { time: range(900, 930), columns: one }),
    ]);
    const r = apply(
      plan,
      { kind: 'move', blockId: 'eM', target: { date: MO, from: 540, to: 600, columns: one } },
      'adjust',
    );
    const copy = r.plan.entries.e100 as Block;
    expect(copy.title).toEqual(rt('Lang'));
    expect(copy.time).toEqual(range(600, 720));
    expect(copy.createdSeq).toBe(1);
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(plan);
  });
});

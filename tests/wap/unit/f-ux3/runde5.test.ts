// @vitest-environment node
// F-UX3 Runde 5 (Code-Review F-UX3, .qa/haertung/code-reviewer-fux3.md; Auftrag Koordinator 23.10.2026): Grenze am
// Tagesende beim Verdrängen und Mitschieben (CR-F3-01), Mehrfachauswahl mit Shift nimmt Beso-Kästchen und Rapporte
// mit (CR-F3-03), Shift-Kante mit Block über Mitternacht (CR-F3-02), ohne Taste nie überlappen auch für Rapporte in
// Planungsspalten, Beso-Kästchen bleiben (CR-F3-04, Entscheid Koordinator). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { moveSelection } from '../../../../src/components/wap/i2/selectionCommands';
import { applyArrangement, arrangeBlocks } from '../../../../src/model/wap/commands/arrange';
import { CommandError } from '../../../../src/model/wap/commands/command';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Beso, Block, Plan, Rapport } from '../../../../src/model/wap/types';
import { basePlan, beso, block, rapport, withEntries } from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };
const MO = '2026-09-28';
const c8 = { kind: 'ids', ids: ['c8'] } as const;
const c9 = { kind: 'ids', ids: ['c9'] } as const;
const range = (from: number, to: number) => ({ form: 'range', from, to }) as const;

function timeOf(plan: Plan, id: string): [number, number] {
  const e = plan.entries[id] as Block;
  if (e.time.form !== 'range') throw new Error('Zeitform');
  return [e.time.from, e.time.to];
}

/** X 1200–1300 (wird gezogen), A 2310–2330, C 2330–2400 in c8. */
function abend(): Plan {
  return withEntries(basePlan(), [
    block('eX', 1, { time: range(720, 780), columns: c8 }),
    block('eA', 2, { time: range(1390, 1410), columns: c8 }),
    block('eC', 3, { time: range(1410, 1440), columns: c8 }),
  ]);
}

describe('F-UX3 Runde 5: Tagesende (CR-F3-01)', () => {
  it('[R-5.1-14] ohne Taste: Ziel 2300–2400 hätte A und C über 2400 verdrängt – die Vorschau hält früher an, alles bleibt im Tag', () => {
    const a = arrangeBlocks(
      abend(),
      { kind: 'move', blockId: 'eX', target: { date: MO, from: 1380, to: 1440, columns: c8 } },
      'adjust',
    );
    expect(a.dayEnd).toBe(true);
    expect(a.target).toEqual({ from: 1335, to: 1395 });
    expect(a.changes).toEqual([{ id: 'eA', from: 1395, to: 1410 }]);
    expect(a.blocked).toBeUndefined();
  });

  it('[R-5.1-14] mit Shift ebenso: nichts beginnt bzw. endet nach 2400', () => {
    const a = arrangeBlocks(
      abend(),
      { kind: 'move', blockId: 'eX', target: { date: MO, from: 1380, to: 1440, columns: c8 } },
      'shift',
    );
    expect(a.dayEnd).toBe(true);
    expect(a.target.to).toBeLessThanOrEqual(1440);
    for (const c of a.changes) expect(c.to).toBeLessThanOrEqual(1440);
    // Ablegen ohne Fehler: ein Undo-Schritt, alles gültig.
    const r = applyArrangement(
      abend(),
      { kind: 'move', blockId: 'eX', target: { date: MO, from: 1380, to: 1440, columns: c8 } },
      'shift',
      (p, t) => ({
        ...updateEntry(p, 'eX', 'block', { time: range(t.from, t.to) }, ctx),
        entryId: 'eX',
      }),
      ctx,
    );
    expect(timeOf(r.plan, 'eC')[1]).toBeLessThanOrEqual(1440);
  });

  it('[R-5.1-14] Pfeiltaste: keine rohe Zeitmeldung, sondern Ursache und nächster Schritt', () => {
    const plan = withEntries(basePlan(), [
      block('eX', 1, { time: range(1365, 1425), columns: c8 }),
      block('eA', 2, { time: range(1425, 1440), columns: c8 }),
    ]);
    let error: unknown;
    try {
      moveSelection(plan, ['eX'], { deltaMinutes: 15 }, 'adjust', ctx);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CommandError);
    expect((error as CommandError).userMessage).toEqual({
      cause: 'Die folgenden Einträge reichen über das Tagesende.',
      nextStep: 'Weniger weit verschieben oder mit Alt parallel legen.',
    });
  });
});

describe('F-UX3 Runde 5: Mehrfachauswahl mit Shift (CR-F3-03)', () => {
  it('[R-5.1-14] A (c8) und B (c9) 60 Min nach unten mit Shift: das Beso-Kästchen und der Rapport darunter rücken mit wie beim Einzelblock', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(480, 540), columns: c8 }),
      block('eB', 2, { time: range(480, 540), columns: c9 }),
      beso('eS', 3, {
        date: MO,
        windows: [{ id: 'tS', time: { form: 'point', at: 570 }, columnId: 'c8', supplement: '' }],
      }),
      rapport('eR', 4, {
        date: MO,
        time: { form: 'point', at: 570 },
        display: 'alsoInColumns',
        displayColumns: c9,
      }),
    ]);
    const r = moveSelection(plan, ['eA', 'eB'], { deltaMinutes: 60 }, 'shift', ctx);
    expect(timeOf(r.plan, 'eA')).toEqual([540, 600]);
    expect((r.plan.entries.eS as Beso).windows[0]?.time).toEqual({ form: 'point', at: 600 });
    expect((r.plan.entries.eR as Rapport).time).toEqual({ form: 'point', at: 600 });
  });
});

describe('F-UX3 Runde 5: Shift-Kante mit Block über Mitternacht (CR-F3-02)', () => {
  it('[R-5.1-14] der Block 2300–0100 rückt mit, bis sein Beginn 2400 erreicht; die Kante bewegt sich', () => {
    const plan = withEntries(basePlan(), [
      block('eA', 1, { time: range(720, 780), columns: c8 }),
      block('eN', 2, { time: range(1380, 1500), columns: c8 }),
    ]);
    const a = arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 810 }, 'shift');
    expect(a.target).toEqual({ from: 720, to: 810 });
    expect(a.changes).toEqual([{ id: 'eN', from: 1410, to: 1530 }]);
    const b = arrangeBlocks(plan, { kind: 'end', blockId: 'eA', edge: 900 }, 'shift');
    expect(b.target).toEqual({ from: 720, to: 840 });
    expect(b.dayEnd).toBe(true);
  });
});

describe('F-UX3 Runde 5: Rapporte in Planungsspalten ohne Taste wie Blöcke, Beso-Kästchen bleiben (CR-F3-04)', () => {
  const plan = () =>
    withEntries(basePlan(), [
      block('eX', 1, { time: range(480, 540), columns: c8 }),
      rapport('eR', 2, {
        date: MO,
        time: { form: 'point', at: 600 },
        display: 'alsoInColumns',
        displayColumns: c8,
      }),
      beso('eS', 3, {
        date: MO,
        windows: [{ id: 'tS', time: { form: 'point', at: 615 }, columnId: 'c8', supplement: '' }],
      }),
    ]);

  it('[R-5.1-14] Verschieben auf den Rapport: er rückt direkt unter das Ziel; das Beso-Kästchen bleibt über dem Block', () => {
    const a = arrangeBlocks(
      plan(),
      { kind: 'move', blockId: 'eX', target: { date: MO, from: 585, to: 645, columns: c8 } },
      'adjust',
    );
    expect(a.shifts).toEqual([{ id: 'eR', windowId: null, delta: 45 }]);
    expect(a.changes).toEqual([]);
  });

  it('[R-5.1-14] Kante über den Rapport: dockt an ihm an, überdeckt ihn nicht', () => {
    expect(arrangeBlocks(plan(), { kind: 'end', blockId: 'eX', edge: 660 }, 'adjust')).toEqual({
      target: { from: 480, to: 600 },
      changes: [],
      splits: [],
      dock: 'eR',
    });
  });
});

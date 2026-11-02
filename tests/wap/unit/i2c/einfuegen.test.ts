// @vitest-environment node
// I2b-B B3: Einfügen mit relativer Lage und Spaltenzuordnung nach Namen; fehlt die Spalte am Ziel, gleiche
// relative Lage und Befund P1 (Beschrieb 5.1; UI-Richtlinie 5.7). Duplizieren unmittelbar anschliessend. Fiktiv.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  duplicateSelection,
  missingColumns,
  pasteEntries,
  referencePoint,
} from '../../../../src/components/wap/i2/selectionCommands';
import { relativeColumns } from '../../../../src/model/wap/commands/columns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Block, Entry, Plan } from '../../../../src/model/wap/types';
import { basePlan, block, rt, setMiFr, withEntries } from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };
const MO = '2026-09-28';

function range(from: number, to: number) {
  return { form: 'range', from, to } as const;
}

/** Mo: «Früh» 0800–0900 in Kp Kdt, «Spät» 1000–1100 in Stv (Spaltensatz «KVK Stufen»). */
function plan(): Plan {
  return withEntries(basePlan(), [
    block('eF', 1, {
      title: rt('Früh'),
      time: range(480, 540),
      columns: { kind: 'ids', ids: ['c8'] },
    }),
    block('eS', 2, {
      title: rt('Spät'),
      time: range(600, 660),
      columns: { kind: 'ids', ids: ['c9'] },
    }),
  ]);
}

function blockOf(p: Plan, id: string): Block {
  const e = p.entries[id];
  if (e?.type !== 'block') throw new Error(`Block ${id} fehlt`);
  return e;
}

function times(p: Plan, id: string) {
  const b = blockOf(p, id);
  return b.time.form === 'range' ? [b.date, b.time.from, b.time.to] : null;
}

describe('I2b-B B3 Einfügen', () => {
  it('[R-5.1-17] frühester Eintrag beginnt am Ziel, die übrigen behalten die relative Lage; ein Undo-Schritt', () => {
    const before = plan();
    expect(referencePoint([before.entries.eF as Entry, before.entries.eS as Entry])).toEqual({
      date: MO,
      minute: 480,
    });
    const r = pasteEntries(before, ['eS', 'eF'], { date: '2026-09-29', minute: 780 }, false, ctx);
    expect(r.newIds).toHaveLength(2);
    const [first, second] = r.newIds;
    expect(times(r.plan, first ?? '')).toEqual(['2026-09-29', 900, 960]);
    expect(times(r.plan, second ?? '')).toEqual(['2026-09-29', 780, 840]);
    // Gleicher Spaltensatz am Di: Spalten bleiben (Kp Kdt, Stv); Originale unverändert.
    expect(blockOf(r.plan, first ?? '').columns).toEqual({ kind: 'ids', ids: ['c9'] });
    expect(r.missing).toEqual([]);
    expect(times(r.plan, 'eF')).toEqual([MO, 480, 540]);
    expect(applyPatches(r.plan, r.inversePatches as never)).toEqual(before);
  });

  it('[R-5.1-17] zwischen Wochen: gleicher Wochentag in der Zielwoche, Spalten nach Namen', () => {
    const r = pasteEntries(plan(), ['eF'], { date: '2026-10-05', minute: 480 }, false, ctx);
    const id = r.newIds[0] ?? '';
    expect(times(r.plan, id)).toEqual(['2026-10-05', 480, 540]);
    expect(blockOf(r.plan, id).columns).toEqual({ kind: 'ids', ids: ['c8'] });
    expect(r.label).toBe('Block «Früh» eingefügt');
  });

  it('[R-5.1-18] fehlt die Spalte am Zieltag, gleiche relative Lage und Befund P1', () => {
    // Mi hat den Spaltensatz «KVK Mi–Fr» (Kdo, Mö, Sph): «Stv» fehlt.
    const r = pasteEntries(plan(), ['eS'], { date: '2026-09-30', minute: 600 }, false, ctx);
    const id = r.newIds[0] ?? '';
    const pasted = blockOf(r.plan, id);
    expect(pasted.date).toBe('2026-09-30');
    expect(pasted.columns).toEqual({ kind: 'ids', ids: ['c9'] });
    expect(r.missing).toEqual(['Stv']);
    expect(missingColumns(r.plan, [id])).toEqual(['Stv']);
    // Gezeichnet an der gleichen relativen Lage: Stv (2. von 6 Spalten) liegt am nächsten bei «Kdo».
    expect(relativeColumns(r.plan, pasted.columns, setMiFr().columns).map((c) => c.name)).toEqual([
      'Kdo',
    ]);
  });

  it('[R-5.1-17] Ausschneiden verschiebt beim Einfügen (Variante c gilt), kein Doppel', () => {
    const before = withEntries(plan(), [
      block('eN', 3, {
        title: rt('Nachbar'),
        time: range(900, 1020),
        columns: { kind: 'ids', ids: ['c8'] },
      }),
    ]);
    const r = pasteEntries(before, ['eF'], { date: MO, minute: 840 }, true, ctx);
    expect(r.newIds).toEqual(['eF']);
    expect(times(r.plan, 'eF')).toEqual([MO, 840, 900]);
    expect(Object.keys(r.plan.entries)).toHaveLength(3);
    // Überdeckung: der Nachbar ausserhalb der Auswahl wird nicht verändert, weil nichts überlappt.
    expect(times(r.plan, 'eN')).toEqual([MO, 900, 1020]);
    const over = pasteEntries(before, ['eF'], { date: MO, minute: 930 }, true, ctx);
    expect(times(over.plan, 'eF')).toEqual([MO, 930, 990]);
    expect(Object.values(over.plan.entries).filter((e) => e.type === 'block')).toHaveLength(4);
    expect(applyPatches(over.plan, over.inversePatches as never)).toEqual(before);
  });

  it('[R-5.1-17] Einfügen über 2400 hinaus wird abgelehnt (Plan unverändert)', () => {
    expect(() =>
      pasteEntries(plan(), ['eF', 'eS'], { date: MO, minute: 1380 }, false, ctx),
    ).toThrow(/ausserhalb von 0000 bis 2400|Zeit/);
  });
});

describe('I2b-B B1 Duplizieren (Ctrl+D)', () => {
  it('[R-5.1-17] Kopie beginnt am Ende des Originals, gleiche Spalten; bei Mehrfachauswahl nach der ganzen Auswahl', () => {
    const one = duplicateSelection(plan(), ['eF'], ctx);
    expect(times(one.plan, one.newIds[0] ?? '')).toEqual([MO, 540, 600]);
    expect(blockOf(one.plan, one.newIds[0] ?? '').columns).toEqual({ kind: 'ids', ids: ['c8'] });
    const both = duplicateSelection(plan(), ['eF', 'eS'], ctx);
    expect(both.newIds.map((id) => times(both.plan, id))).toEqual([
      [MO, 660, 720],
      [MO, 780, 840],
    ]);
  });
});

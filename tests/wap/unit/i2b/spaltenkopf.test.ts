// @vitest-environment node
// I2b-A A8: Spaltenkopf umbenennen und Gewicht ändern, nur dieser Tag oder alle Tage mit dem Spaltensatz;
// Einrasten des Gewichts beim Ziehen, Tagesbreite bleibt.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  columnBoxes,
  stepWeight,
  weightAtBoundary,
} from '../../../../src/components/wap/i2/geometry';
import { columnSetUsage, updateDayColumn } from '../../../../src/model/wap/commands/dayColumns';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Block, Column, Plan } from '../../../../src/model/wap/types';
import { basePlan, block, col, withEntries } from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };

function plan(): Plan {
  return withEntries(basePlan(), [
    block('eMo', 1, { date: '2026-09-28', columns: { kind: 'ids', ids: ['c9', 'c10'] } }),
    block('eDi', 2, { date: '2026-09-29', columns: { kind: 'ids', ids: ['c9'] } }),
  ]);
}

describe('I2b A8 Spaltenkopf im Modell', () => {
  it('[R-5.2-08] zählt die Tage, die einen Spaltensatz verwenden', () => {
    expect(columnSetUsage(plan(), 's7')).toBe(6);
    expect(columnSetUsage(plan(), 's39')).toBe(0);
  });

  it('[R-5.2-08] alle Tage mit dem Spaltensatz: Name und Gewicht im Spaltensatz, ein Undo-Schritt', () => {
    const before = plan();
    const r = updateDayColumn(
      before,
      'w26',
      'Mo',
      'c9',
      { name: ' Stv Zug ', weight: 'wide' },
      'set',
      ctx,
    );
    const set = r.plan.columnSets.find((s) => s.id === 's7');
    expect(set?.columns.find((c) => c.id === 'c9')).toMatchObject({
      name: 'Stv Zug',
      weight: 'wide',
    });
    expect(r.label).toBe('Spalte «Stv Zug» umbenannt');
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(before);
  });

  it('[R-5.2-08] nur dieser Tag: Kopie des Spaltensatzes, Einträge des Tages folgen, andere Tage bleiben', () => {
    const before = plan();
    const r = updateDayColumn(before, 'w26', 'Mo', 'c9', { name: 'Stv Zug' }, 'day', ctx);
    const mo = r.plan.weeks[0]?.days[0];
    expect(mo?.columnSetId).not.toBe('s7');
    const copy = r.plan.columnSets.find((s) => s.id === mo?.columnSetId);
    expect(copy?.columns.map((c) => c.name)).toEqual([
      'Kp Kdt',
      'Stv Zug',
      'Zfhr',
      'Uof',
      'höh Uof',
      'Trp',
      'Rap',
      'Beso',
    ]);
    expect(copy?.name).toBe('KVK Stufen (Mo 28.09.26)');
    const ids = copy?.columns.map((c) => c.id) ?? [];
    expect((r.plan.entries.eMo as Block).columns).toEqual({ kind: 'ids', ids: [ids[1], ids[2]] });
    expect(r.plan.entries.eDi).toEqual(before.entries.eDi);
    expect(r.plan.weeks[0]?.days[1]?.columnSetId).toBe('s7');
    expect(r.plan.columnSets.find((s) => s.id === 's7')).toEqual(
      before.columnSets.find((s) => s.id === 's7'),
    );
    expect(r.label).toBe('Spalte «Stv Zug» umbenannt (nur Mo 28.09.2026)');
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(before);
  });

  it('[R-5.7-03] leerer Name wird mit Ursache und nächstem Schritt abgelehnt', () => {
    expect(() => updateDayColumn(plan(), 'w26', 'Mo', 'c9', { name: '  ' }, 'set', ctx)).toThrow(
      /keinen Namen/,
    );
  });
});

describe('I2b A8 Breite per Spaltengrenze', () => {
  const columns: Column[] = [
    col('a', 'A', 'planning'),
    col('b', 'B', 'planning'),
    col('r', 'Rap', 'rap'),
    col('s', 'Beso', 'beso'),
  ];

  it('[R-4.4-13] Gewichte 1/2/3 (Rap 1, Beso 2); die Tagesbreite bleibt gleich', () => {
    const boxes = columnBoxes(columns, 350);
    expect(boxes.map((b) => b.width)).toEqual([100, 100, 50, 100]);
    const wide = columnBoxes(
      columns.map((c) => (c.id === 'a' ? { ...c, weight: 'wide' } : c)),
      350,
    );
    expect(wide.reduce((sum, b) => sum + b.width, 0)).toBeCloseTo(350);
  });

  it('[R-4.4-13] rastet auf schmal, normal oder breit je nach Lage der Grenze', () => {
    expect(weightAtBoundary(columns, 0, 100, 350)).toBe('normal');
    expect(weightAtBoundary(columns, 0, 135, 350)).toBe('wide');
    expect(weightAtBoundary(columns, 0, 40, 350)).toBe('narrow');
    expect(weightAtBoundary(columns, 2, 500, 350)).toBe('normal');
    expect(stepWeight('normal', 1)).toBe('wide');
    expect(stepWeight('wide', 1)).toBe('wide');
    expect(stepWeight('normal', -1)).toBe('narrow');
  });
});

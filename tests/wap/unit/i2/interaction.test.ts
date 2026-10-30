// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  columnsBetween,
  drawingTime,
  moveAcrossDayBoundary,
  snapMinutes,
} from '../../../../src/components/wap/i2/interaction';
import { carryColumnSelection } from '../../../../src/model/wap/commands/columns';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Column } from '../../../../src/model/wap/types';

function column(id: string, name = id): Column {
  return {
    id,
    name,
    kind: 'planning',
    weight: 'normal',
    labelOrientation: 'horizontal',
    defaultCategoryId: null,
    origin: 'manual',
  };
}

describe('I2 Rasterinteraktion', () => {
  it('[R-4.5-08] [R-5.1-14] rastet auf die nächste Viertelstunde, auch an der Mitte', () => {
    expect(snapMinutes(487)).toBe(480);
    expect(snapMinutes(487.5)).toBe(495);
    expect(snapMinutes(502)).toBe(495);
    expect(snapMinutes(503)).toBe(510);
  });

  it('[R-5.1-02] [R-5.1-14] zieht vorwärts und rückwärts, mindestens 15 Minuten', () => {
    expect(drawingTime(480, 510)).toEqual({ from: 480, to: 510 });
    expect(drawingTime(510, 480)).toEqual({ from: 480, to: 510 });
    expect(drawingTime(480, 481)).toEqual({ from: 480, to: 495 });
    expect(drawingTime(1439, 1500)).toEqual({ from: 1425, to: 1440 });
  });

  it('[R-5.1-02] [R-5.1-14] nimmt beim Ziehen alle überstrichenen Planungsspalten mit', () => {
    const columns = [column('c1'), column('c2'), column('c3')];
    expect(columnsBetween(columns, 0, 2)).toEqual({ kind: 'ids', ids: ['c1', 'c2', 'c3'] });
    expect(columnsBetween(columns, 2, 1)).toEqual({ kind: 'ids', ids: ['c2', 'c3'] });
    expect(columnsBetween(columns, 1, 1)).toEqual({ kind: 'ids', ids: ['c2'] });
  });

  it('[R-5.1-14] [R-5.1-16] verschiebt über Mitternacht ohne die Dauer zu ändern', () => {
    expect(moveAcrossDayBoundary('2026-10-05', 1425, 1485, 22)).toEqual({
      date: '2026-10-06',
      from: 0,
      to: 60,
    });
    expect(moveAcrossDayBoundary('2026-10-05', 0, 60, -15)).toEqual({
      date: '2026-10-04',
      from: 1425,
      to: 1485,
    });
    expect(moveAcrossDayBoundary('2026-10-05', 480, 540, 22)).toEqual({
      date: '2026-10-05',
      from: 495,
      to: 555,
    });
  });

  it('[R-5.1-16] [R-5.1-17] verwendet beim Tageswechsel die öffentliche Namenszuordnung', () => {
    const base = createPlanFromTemplate(kpTemplate(), {
      planId: 'i2-interaction-test',
      startDate: '2026-10-05',
      weekCount: 1,
    });
    const plan = {
      ...base,
      columnSets: [{ id: 's-test', name: 'Test', columns: [column('c-old', 'Zug 1')] }],
    };
    expect(
      carryColumnSelection(plan, { kind: 'ids', ids: ['c-old'] }, [column('c-new', 'Zug 1')]),
    ).toEqual({ kind: 'ids', ids: ['c-new'] });
    expect(carryColumnSelection(plan, { kind: 'all' }, [column('c-new', 'Zug 1')])).toEqual({
      kind: 'all',
    });
  });
});

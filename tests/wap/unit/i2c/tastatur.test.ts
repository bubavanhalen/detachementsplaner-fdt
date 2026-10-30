// @vitest-environment node
// I2b-B B1: Zellzeiger (15-Min-Zeile × Spalte), Bereich, Namen für Screenreader, Leserichtung; «Gehe zu» (B4).
import { describe, expect, it } from 'vitest';
import { goToOptions } from '../../../../src/components/wap/i2/GridDialogs';
import {
  adjacentItem,
  type CursorDay,
  cellRange,
  cursorLabel,
  initialCursor,
  itemAfterCursor,
  moveCursor,
  type ReadingItem,
} from '../../../../src/components/wap/i2/keyboard';
import { col } from '../../support/model/builders';

const MO: CursorDay = {
  date: '2026-10-05',
  weekday: 'Mo',
  columns: [
    { column: col('c1', 'COBRA 10', 'planning') },
    { column: col('c2', 'COBRA 20', 'planning') },
    { column: col('c3', 'Rap', 'rap') },
  ],
};
const DI: CursorDay = {
  date: '2026-10-06',
  weekday: 'Di',
  columns: [
    { column: col('c9', 'FALCON', 'planning') },
    { column: col('c2', 'COBRA 20', 'planning') },
  ],
};
const DAYS = [MO, DI];
const BOUNDS = { from: 240, to: 1440 };

describe('I2b-B B1 Zellzeiger', () => {
  it('[R-5.1-14] Anfangslage Mo, erste Planungsspalte, 0800 (UI-Richtlinie 13.4)', () => {
    expect(initialCursor(DAYS, BOUNDS)).toEqual({ date: '2026-10-05', minute: 480, column: 0 });
  });

  it('[R-5.1-14] Pfeile 15 Min / eine Spalte über die Tagesgrenze; Bild↑/↓ 1 h; Pos1/Ende; Ctrl+←/→ Tag', () => {
    const c = { date: '2026-10-05', minute: 480, column: 0 };
    expect(moveCursor(c, 'down', DAYS, BOUNDS)).toEqual({ ...c, minute: 495 });
    expect(moveCursor(c, 'pageDown', DAYS, BOUNDS)).toEqual({ ...c, minute: 540 });
    expect(moveCursor(c, 'home', DAYS, BOUNDS)).toEqual({ ...c, minute: 240 });
    expect(moveCursor(c, 'end', DAYS, BOUNDS)).toEqual({ ...c, minute: 1425 });
    expect(moveCursor({ ...c, column: 2 }, 'right', DAYS, BOUNDS)).toEqual({
      date: '2026-10-06',
      minute: 480,
      column: 0,
    });
    expect(
      moveCursor({ date: '2026-10-06', minute: 480, column: 0 }, 'left', DAYS, BOUNDS),
    ).toEqual({ ...c, column: 2 });
    // Ctrl+→: gleichnamige Spalte am nächsten Tag (COBRA 20 ist dort an zweiter Stelle).
    expect(moveCursor({ ...c, column: 1 }, 'nextDay', DAYS, BOUNDS)).toEqual({
      date: '2026-10-06',
      minute: 480,
      column: 1,
    });
    // ↑ aus der ersten Zeile → null (Fokus zum Spaltenkopf); ↓ bleibt in der letzten Zeile.
    expect(moveCursor({ ...c, minute: 240 }, 'up', DAYS, BOUNDS)).toBeNull();
    expect(moveCursor({ ...c, minute: 1425 }, 'down', DAYS, BOUNDS)).toEqual({
      ...c,
      minute: 1425,
    });
  });

  it('[R-5.1-03] Namen: «Mo 05.10. 0900 COBRA 10, leer», belegt und als Bereich', () => {
    const one = cellRange({ date: '2026-10-05', minute: 540, column: 0 }, null);
    expect(cursorLabel(MO, one, null)).toBe('Mo 05.10. 0900 COBRA 10, leer');
    expect(cursorLabel(MO, one, { type: 'Block', title: 'Mö Sch', time: '0900-1000' })).toBe(
      'Mo 05.10. 0900 COBRA 10, Block Mö Sch 0900-1000',
    );
    const area = cellRange(
      { date: '2026-10-05', minute: 585, column: 1 },
      { date: '2026-10-05', minute: 540, column: 0 },
    );
    expect(area).toEqual({
      date: '2026-10-05',
      from: 540,
      to: 600,
      firstColumn: 0,
      lastColumn: 1,
    });
    expect(cursorLabel(MO, area, null)).toBe('Mo 05.10. 0900-1000 COBRA 10–COBRA 20, Bereich');
  });

  it('[R-5.1-14] Tab: nächster bzw. vorheriger Eintrag in Leserichtung (Tag, Zeit, Spalte); am Ende null', () => {
    const order: ReadingItem[] = [
      { id: 'a', windowId: null, date: '2026-10-05', time: 480, left: 0 },
      { id: 'b', windowId: 't1', date: '2026-10-05', time: 480, left: 100 },
      { id: 'c', windowId: null, date: '2026-10-06', time: 300, left: 0 },
    ];
    expect(adjacentItem(order, 'a', 1)?.id).toBe('b');
    expect(adjacentItem(order, 'b:t1', 1)?.id).toBe('c');
    expect(adjacentItem(order, 'c', 1)).toBeNull();
    expect(adjacentItem(order, 'a', -1)).toBeNull();
    expect(itemAfterCursor(order, { date: '2026-10-05', time: 540, left: 0 }, 1)?.id).toBe('c');
    expect(itemAfterCursor(order, { date: '2026-10-05', time: 540, left: 0 }, -1)?.id).toBe('b');
  });
});

describe('I2b-B B4 Gehe zu (Ctrl+G)', () => {
  const days = [
    { date: '2026-10-05', weekday: 'Mo' as const, columns: ['COBRA 10', 'COBRA 20', 'Rap'] },
    { date: '2026-10-06', weekday: 'Di' as const, columns: ['FALCON'] },
  ];
  const entries = [
    { key: 'e1', label: 'Block Mö Sch 0800-1200 · Mo', title: 'Mö Sch', besoNumber: null },
    {
      key: 'e2:t3',
      label: 'Beso 21 Arztvisite 0930-1000 · Di',
      title: 'Arztvisite',
      besoNumber: 21,
    },
  ];

  it('[R-5.1-14] «Mo 0800 COBRA 2» springt zur Zelle; «Di» zum Tag; «21» zum Beso; Titelanfang zum Eintrag', () => {
    expect(goToOptions('Mo 0800 COBRA 2', days, entries)[0]?.target).toEqual({
      kind: 'cell',
      date: '2026-10-05',
      minute: 480,
      column: 1,
    });
    expect(goToOptions('di', days, entries)[0]?.target).toEqual({
      kind: 'cell',
      date: '2026-10-06',
      minute: null,
      column: null,
    });
    expect(goToOptions('Mo 9:10', days, entries)[0]?.target).toMatchObject({ minute: 540 });
    expect(goToOptions('21', days, entries)[0]?.target).toEqual({ kind: 'entry', key: 'e2:t3' });
    expect(goToOptions('mö', days, entries)[0]?.target).toEqual({ kind: 'entry', key: 'e1' });
    expect(goToOptions('visite', days, entries)[0]?.target).toEqual({
      kind: 'entry',
      key: 'e2:t3',
    });
    expect(goToOptions('', days, entries)).toEqual([]);
  });
});

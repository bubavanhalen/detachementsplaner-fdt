// @vitest-environment node
// PERF (R-5.1-14, R-11-11; I2b-A A7): Vorschau beim Ziehen ohne neues Layout. Die angepassten Nachbarn und Teilstücke
// erscheinen an ihrer neuen Lage mit der Zeichnung aus der Layout-Schicht (kein Browser-Umbruch, ADR-004); die übrigen
// Tage bleiben dieselben Objekte, und Tage ohne Vorschau werden nicht berechnet. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { EntryView } from '../../../../src/components/wap/i2/entryViews';
import type { DayBox } from '../../../../src/components/wap/i2/geometry';
import type { LayoutRender } from '../../../../src/components/wap/i2/layoutViews';
import { withPreview } from '../../../../src/components/wap/i2/preview';
import type { IsoDate } from '../../../../src/model/wap/types';

const MO = '2026-09-28';
const DI = '2026-09-29';

function day(date: IsoDate, left: number): DayBox {
  return {
    date,
    weekday: date === MO ? 'Mo' : 'Di',
    display: 'full',
    setId: 's7',
    left,
    width: 360,
    columns: [],
    planning: [],
  };
}

const RENDER: LayoutRender = {
  shapes: {
    viewBox: '0 0 10 10',
    x0: 0,
    y0: 0,
    factor: 2.2,
    width: 100,
    height: 48,
    items: [],
    clip: false,
  },
  lines: [{ left: 2, top: 2, fontPx: 11, rotation: 0, runs: [] }],
  simple: { fill: 'rgb(1 2 3)', border: 'rgb(0 0 0)', borderPx: 1 },
};

function view(id: string, top: number, height: number, render?: LayoutRender): EntryView {
  return {
    key: id,
    id,
    windowId: null,
    kind: 'block',
    label: `Block ${id}`,
    text: id,
    sub: '',
    rect: { left: 0, top, width: 100, height },
    pieces: [],
    textPiece: 0,
    fill: 'rgb(1 2 3)',
    ink: 'rgb(0 0 0)',
    z: 4,
    from: 240 + top / 0.8,
    to: 240 + (top + height) / 0.8,
    first: true,
    last: true,
    cancelled: false,
    ...(render === undefined ? {} : { render }),
  };
}

const DAYS = [day(MO, 0), day(DI, 360)];

function laid(): Map<IsoDate, readonly EntryView[]> {
  return new Map<IsoDate, readonly EntryView[]>([
    [MO, [view('a', 0, 48, RENDER), view('b', 48, 48, RENDER)]],
    [DI, [view('c', 0, 96, RENDER)]],
  ]);
}

describe('PERF: Vorschau beim Ziehen ohne neues Layout', () => {
  it('[R-5.1-14] ohne Vorschau dieselben Ansichten, keine Berechnung', () => {
    const base = laid();
    const calls: IsoDate[] = [];
    const out = withPreview(
      base,
      DAYS,
      (d) => {
        calls.push(d.date);
        return [];
      },
      new Set(),
      new Set(),
    );
    expect(out).toBe(base);
    expect(calls).toEqual([]);
  });

  it('[R-5.1-14] angepasster Nachbar: neue Lage, bisherige Zeichnung; übrige Tage unverändert', () => {
    const base = laid();
    const calls: IsoDate[] = [];
    const out = withPreview(
      base,
      DAYS,
      (d) => {
        calls.push(d.date);
        // Rohansichten des Tages mit Vorschau (ohne Layout): b kürzer, a unverändert.
        return [view('a', 0, 48), view('b', 60, 36)];
      },
      new Set(['b']),
      new Set([MO]),
    );
    expect(calls).toEqual([MO]);
    expect(out.get(DI)).toBe(base.get(DI));
    const mo = out.get(MO) ?? [];
    expect(mo.map((v) => v.id)).toEqual(['a', 'b']);
    expect(mo[0]).toBe(base.get(MO)?.[0]);
    const b = mo.find((v) => v.id === 'b');
    expect(b?.rect).toEqual({ left: 0, top: 60, width: 100, height: 36 });
    expect(b?.render).toBe(RENDER);
    expect(b?.z).toBe(4);
  });

  it('[R-5.1-14] Teilstück eines ausgesparten Blocks trägt die Zeichnung seines Blocks', () => {
    const out = withPreview(
      laid(),
      DAYS,
      () => [view('b', 48, 12), view('b~0', 84, 12)],
      new Set(['b']),
      new Set([MO]),
    );
    const piece = out.get(MO)?.find((v) => v.id === 'b~0');
    expect(piece?.render).toBe(RENDER);
    expect(piece?.rect.top).toBe(84);
  });

  it('[R-5.1-14] ohne bisherige Zeichnung keine Vorschau (der Browser bricht nie selbst um)', () => {
    const out = withPreview(laid(), DAYS, () => [view('neu~0', 10, 20)], new Set(), new Set([MO]));
    expect(out.get(MO)?.map((v) => v.id)).toEqual(['a', 'b']);
    expect([...(out.get(MO) ?? [])].every((v) => v.render !== undefined)).toBe(true);
  });
});

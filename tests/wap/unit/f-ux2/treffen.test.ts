// @vitest-environment node
// F-UX2 P4/P5 (Rückmeldung N4, N5 vom 19.10.2026; Gestaltung raster-bedienung-v2 §2, §3, §5; Beschrieb 4.6, 5.1):
// Treffer aus der Geometrie – Marker vor Blöcken, kleinster Eintrag vor dem grösseren, Aussparungen gehören nicht zum
// Block; Zonen in Bildschirm-px; schmale Spalten mit Mindest-Trefferbreite; Auffüllen bis zum Nachbarblock. Fiktive
// Daten.
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { fillTarget } from '../../../../src/components/wap/i2/fill';
import type { ColumnBox } from '../../../../src/components/wap/i2/geometry';
import { columnAt, edgeBand, hitEntry, zoneOf } from '../../../../src/components/wap/i2/hitTest';
import { basePlan, block, col, withEntries } from '../../support/model/builders';

function view(
  id: string,
  kind: EntryView['kind'],
  rect: Rect,
  z = 0,
  hitRects?: Rect[],
): EntryView {
  return {
    key: id,
    id,
    windowId: null,
    kind,
    label: id,
    text: '',
    sub: '',
    rect,
    pieces: [],
    textPiece: 0,
    fill: '',
    ink: '',
    z,
    from: 0,
    to: 0,
    first: true,
    last: true,
    cancelled: false,
    ...(hitRects === undefined ? {} : { hitRects }),
  };
}

const r = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});

describe('F-UX2 P4: Treffen aus der Geometrie', () => {
  it('[R-5.1-01] Vorrang: kleinster Eintrag vor dem grösseren, auch wenn der grössere oben liegt (gewählt, z-Index)', () => {
    const wide = view('breit', 'block', r(0, 0, 200, 100), 50);
    const beso = view('beso', 'beso', r(10, 20, 30, 24), 1);
    expect(hitEntry([wide, beso], 20, 30)?.view.id).toBe('beso');
    expect(hitEntry([wide, beso], 100, 50)?.view.id).toBe('breit');
    // Gleiche Fläche: der oberste.
    const a = view('a', 'block', r(0, 0, 50, 50), 1);
    const b = view('b', 'block', r(0, 0, 50, 50), 2);
    expect(hitEntry([a, b], 25, 25)?.view.id).toBe('b');
  });

  it('[R-5.1-01] Aussparung: der breite Block trifft nur in seinen Teilstücken; Marker vor dem Block, nur an der Linie', () => {
    const wide = view('MiE', 'block', r(0, 0, 200, 60), 9, [r(0, 0, 50, 60), r(100, 0, 100, 60)]);
    const ex = view('Ausnahme', 'block', r(50, 0, 50, 30), 1);
    expect(hitEntry([wide, ex], 75, 10)?.view.id).toBe('Ausnahme');
    // Im ausgesparten Teil ohne Ausnahme (unten) trifft nichts.
    expect(hitEntry([wide, ex], 75, 45)).toBeNull();
    const m = view('ABV', 'marker', r(0, 40, 200, 20), 0, [r(0, 40, 200, 1), r(80, 41, 40, 12)]);
    const blockUnder = view('Block', 'block', r(0, 0, 200, 100), 0);
    expect(hitEntry([blockUnder, m], 10, 41.5)?.view.id).toBe('ABV');
    expect(hitEntry([blockUnder, m], 10, 37)?.view.id).toBe('Block');
    expect(hitEntry([blockUnder, m], 90, 50)?.view.id).toBe('ABV');
  });

  // Auftrag Koordinator 21.10.2026 (F-UX3, Rückmeldung Auftraggeber «nicht zuerst anwählen»): Kanten- und Körperzonen
  // für jeden Block, die Auswahl ändert keine Zone; sehr kleine Blöcke haben ein Band von einem Drittel der Höhe.
  it('[R-5.1-14] Zonen in px: Kanten oben/unten 8 px ab 24 px Höhe, 4 px ab 12 px, darunter ein Drittel; seitlich an jedem Block', () => {
    // Entscheid Auftraggeber 21.10.2026 Varianten 1a–5a: ab 24 px Höhe ⅓ der Höhe, 8 bis 12 px.
    expect([edgeBand(40), edgeBand(24), edgeBand(20), edgeBand(12), edgeBand(11)]).toEqual([
      12, 8, 4, 4, 3,
    ]);
    const v = view('b', 'block', r(0, 100, 60, 48));
    expect(zoneOf(v, 30, 103, null)).toBe('start');
    expect(zoneOf(v, 30, 145, null)).toBe('end');
    expect(zoneOf(v, 30, 124, null)).toBe('body');
    expect(zoneOf(v, 2, 124, null)).toBe('left');
    expect(zoneOf(v, 2, 124, 'b')).toBe('left');
    expect(zoneOf(v, 58, 124, 'b')).toBe('right');
    expect(zoneOf(view('k', 'block', r(0, 0, 60, 10)), 30, 1, null)).toBe('start');
    expect(zoneOf(view('k', 'block', r(0, 0, 60, 10)), 30, 5, null)).toBe('body');
    expect(zoneOf(view('m', 'marker', r(0, 0, 60, 10)), 30, 1, null)).toBe('body');
  });

  it('[R-5.1-14] Spalte unter dem Zeiger: schmale Spalte (Det) mit Mindest-Trefferbreite 16 px', () => {
    const cols = (widths: number[]): ColumnBox[] => {
      let left = 0;
      return widths.map((w, i) => {
        const c = { column: col(`c${String(i)}`, `S${String(i)}`, 'planning'), left, width: w };
        left += w;
        return c;
      });
    };
    const c = cols([25, 25, 6, 25]);
    // Det von 50 bis 56, Mitte 53: Treffer von 45 bis 61.
    expect(columnAt(c, 46)).toBe(2);
    expect(columnAt(c, 60)).toBe(2);
    expect(columnAt(c, 44)).toBe(1);
    expect(columnAt(c, 62)).toBe(3);
    expect(columnAt(c, -5)).toBe(0);
    expect(columnAt(c, 500)).toBe(3);
    expect(columnAt([], 3)).toBe(-1);
  });
});

describe('F-UX2 P5: Auffüllen per Doppelklick auf die Blockkante', () => {
  const MO = '2026-09-28';
  const p = withEntries(basePlan({ id: 'fux2-fill' }), [
    block('a', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c8'] },
    }),
    block('b', 2, {
      date: MO,
      time: { form: 'range', from: 600, to: 660 },
      columns: { kind: 'ids', ids: ['c8', 'c9'] },
    }),
    block('c', 3, {
      date: MO,
      time: { form: 'range', from: 720, to: 780 },
      columns: { kind: 'ids', ids: ['c9'] },
    }),
    block('d', 4, {
      date: MO,
      time: { form: 'range', from: 610, to: 640 },
      columns: { kind: 'ids', ids: ['c8'] },
    }),
    block('e', 5, {
      date: MO,
      time: { form: 'range', from: 900, to: 960 },
      columns: { kind: 'ids', ids: ['c10'] },
    }),
  ]);
  const of = (id: string) => {
    const e = p.entries[id];
    if (e?.type !== 'block') throw new Error(id);
    return e;
  };
  it('[R-5.1-14] oben bis zum Ende des vorangehenden Blocks mit gemeinsamer Spalte, unten bis zum Beginn des folgenden', () => {
    expect(fillTarget(p, of('b'), 'start')).toBe(540);
    expect(fillTarget(p, of('b'), 'end')).toBe(720);
    expect(fillTarget(p, of('a'), 'end')).toBe(600);
  });
  it('[R-5.1-14] ohne Nachbarn bis zum Rasterbeginn unter dem Band bzw. zum Ende des Anzeigebereichs; Überlappende zählen nicht', () => {
    expect(fillTarget(p, of('e'), 'start')).toBe(p.displayRange.from + 60);
    expect(fillTarget(p, of('e'), 'end')).toBe(p.displayRange.to);
    // «d» liegt in «b» (Ausnahme): zählt für «b» nicht, «d» füllt oben bis «a».
    expect(fillTarget(p, of('d'), 'start')).toBe(540);
  });
});

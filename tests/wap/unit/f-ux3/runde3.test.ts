// @vitest-environment node
// F-UX3 Runde 3 (Entscheid Auftraggeber 21.10.2026 «1: a / 2: a / 3: a / 4: a / 5: a»; Gestaltung bewegung-v1,
// endgültig): 2a freie Kante dockt am nächsten Block derselben Spalten an, darüber nur mit Alt; 4a Shift schiebt alle
// Folgeblöcke bis Tagesende; 5a Griffe (Pille) an den Kanten des überfahrenen Blocks, Trefferfläche Griff plus 3 px,
// Kantenband höchstens 12 px. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { edgeBand, gripsOf, hitEntry } from '../../../../src/components/wap/i2/hitTest';
import { arrangeBlocks } from '../../../../src/model/wap/commands/arrange';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, block, rt, withEntries } from '../../support/model/builders';

const one = { kind: 'ids', ids: ['c8'] } as const;
const range = (from: number, to: number) => ({ form: 'range', from, to }) as const;

/** A 0800–0900, Lücke, B 1000–1100, C 1200–1300 in derselben Spalte; D 0930–1030 in einer anderen. */
function tag(): Plan {
  return withEntries(basePlan(), [
    block('eA', 1, { title: rt('Alpha'), time: range(480, 540), columns: one }),
    block('eB', 2, { title: rt('Bravo'), time: range(600, 660), columns: one }),
    block('eC', 3, { title: rt('Charlie'), time: range(720, 780), columns: one }),
    block('eD', 4, {
      title: rt('Delta'),
      time: range(570, 630),
      columns: { kind: 'ids', ids: ['c9'] },
    }),
  ]);
}

function view(id: string, kind: EntryView['kind'], rect: Rect, z = 0): EntryView {
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
  };
}
const r = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});

describe('F-UX3 Runde 3: freie Kante dockt an (2a), Shift bis Tagesende (4a)', () => {
  // Entscheid Auftraggeber 21.10.2026 (Shift alle darunter, ohne Taste nie überlappen): die freie Kante dockt an und
  // wird ab dort zur gemeinsamen Kante – weiteres Ziehen lässt den Nachbarn schrumpfen (vorher hielt sie an).
  it('[R-5.1-14] untere Kante ohne Taste: dockt am Beginn des nächsten Blocks an, darüber hinaus schrumpft er', () => {
    expect(arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 600 }, 'adjust')).toEqual({
      target: { from: 480, to: 600 },
      changes: [],
      splits: [],
      dock: 'eB',
    });
    expect(arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 630 }, 'adjust')).toEqual({
      target: { from: 480, to: 630 },
      changes: [{ id: 'eB', from: 630, to: 660 }],
      splits: [],
    });
    // Ein Block in einer anderen Spalte (Delta) zählt nicht.
    expect(arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 585 }, 'adjust')).toEqual({
      target: { from: 480, to: 585 },
      changes: [],
      splits: [],
    });
  });

  it('[R-5.1-14] obere Kante ohne Taste: dockt am Ende des vorangehenden Blocks an, darüber hinaus schrumpft er', () => {
    expect(arrangeBlocks(tag(), { kind: 'start', blockId: 'eC', edge: 660 }, 'adjust').dock).toBe(
      'eB',
    );
    expect(arrangeBlocks(tag(), { kind: 'start', blockId: 'eC', edge: 630 }, 'adjust')).toEqual({
      target: { from: 630, to: 780 },
      changes: [{ id: 'eB', from: 600, to: 630 }],
      splits: [],
    });
  });

  it('[R-5.1-14] mit Alt läuft die Kante darüber (parallel), keine Anpassung', () => {
    expect(arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 630 }, 'none')).toEqual({
      target: { from: 480, to: 630 },
      changes: [],
      splits: [],
    });
  });

  it('[R-5.1-14] Shift schiebt alle Folgeblöcke derselben Spalten bis Tagesende um die Differenz (4a)', () => {
    const a = arrangeBlocks(tag(), { kind: 'end', blockId: 'eA', edge: 630 }, 'shift');
    expect(a.target).toEqual({ from: 480, to: 630 });
    expect(a.changes).toEqual([
      { id: 'eB', from: 690, to: 750 },
      { id: 'eC', from: 810, to: 870 },
    ]);
    expect(a.dock).toBeUndefined();
  });
});

describe('F-UX3 Runde 3: Griffe (5a) und Kantenband', () => {
  it('[R-5.1-27] Kantenband ab 24 px Höhe ⅓ der Höhe, 8 bis 12 px', () => {
    expect([24, 30, 36, 48, 400].map((h) => edgeBand(h))).toEqual([8, 10, 12, 12, 12]);
  });

  it('[R-5.1-14] Lage der Griffe: oben/unten ab 80 px Breite rechts (6 px vom Rand), sonst mittig; Seiten ab 60 × 30 px', () => {
    const breit = gripsOf(view('B', 'block', r(0, 100, 120, 60)));
    expect(breit.map((g) => [g.zone, g.cx, g.cy, g.vertical])).toEqual([
      ['start', 120 - 17 - 6, 100, false],
      ['end', 120 - 17 - 6, 160, false],
      ['left', 0, 130, true],
      ['right', 120, 130, true],
    ]);
    const schmal = gripsOf(view('S', 'block', r(0, 100, 40, 60)));
    expect(schmal.map((g) => [g.zone, g.cx])).toEqual([
      ['start', 20],
      ['end', 20],
    ]);
  });

  it('[R-5.1-14] kleiner Block (< 30 px hoch): Griffe um eine halbe Griffhöhe − 2 px nach aussen, keine Seitengriffe', () => {
    const k = gripsOf(view('K', 'block', r(0, 100, 120, 15)));
    expect(k.map((g) => [g.zone, g.cy])).toEqual([
      ['start', 94],
      ['end', 121],
    ]);
  });

  it('[R-5.1-14] Rapport nur oben/unten, Marker ein Zeitgriff mitten auf der Linie, Beso und Querbalken keine', () => {
    expect(gripsOf(view('R', 'rapport', r(0, 0, 100, 60))).map((g) => g.zone)).toEqual([
      'start',
      'end',
    ]);
    expect(gripsOf(view('M', 'marker', r(0, 94, 200, 12)))).toEqual([
      { zone: 'marker', cx: 100, cy: 100, vertical: false },
    ]);
    // Marker aus der Layout-Schicht: Linie (flachstes Teilstück) und Beschriftungsfeld darunter; Griff auf der Linie.
    const gezeichnet = {
      ...view('M2', 'marker', r(0, 100, 200, 10)),
      hitRects: [r(0, 100, 200, 2), r(80, 101, 40, 9)],
    };
    expect(gripsOf(gezeichnet)[0]).toMatchObject({ cx: 100, cy: 101 });
    expect(gripsOf(view('X', 'beso', r(0, 0, 30, 30)))).toEqual([]);
    expect(gripsOf(view('Q', 'querbalken', r(0, 0, 300, 30)))).toEqual([]);
  });

  it('[R-5.1-26] Trefferfläche Griff plus 3 px über die Kante hinaus nur am überfahrenen Block und nur über leerer Fläche', () => {
    const b = view('B', 'block', r(0, 100, 120, 60));
    // 9 px unter der Unterkante beim Griff (rechts): ohne Überfahren leere Fläche, überfahren die Kante.
    expect(hitEntry([b], 97, 169)).toBeNull();
    expect(hitEntry([b], 97, 169, null, 'B')).toMatchObject({ zone: 'end' });
    expect(hitEntry([b], 97, 169, null, 'B')?.view.id).toBe('B');
    // Ein anderer Eintrag am Punkt geht vor (R-5.1-26).
    const n = view('N', 'block', r(0, 160, 120, 60));
    expect(hitEntry([b, n], 97, 165, null, 'B')?.view.id).toBe('N');
    // Ausserhalb des Griffs keine Kante.
    expect(hitEntry([b], 20, 169, null, 'B')).toBeNull();
  });

  it('[R-5.1-14] im Block zählt der Griff nur bis zum Kantenband; die Mitte bleibt Körper (CR-U-2-04)', () => {
    const k = view('K', 'block', r(0, 0, 60, 18));
    // Band 4 px bei 18 px Höhe; der Griff ragt nach innen bis 5 px, zählt dort aber nicht.
    expect(hitEntry([k], 30, 4.5, null, 'K')?.zone).toBe('body');
    expect(hitEntry([k], 30, 3.5, null, 'K')?.zone).toBe('start');
    // Über der Oberkante: Griff des überfahrenen Blocks.
    expect(hitEntry([k], 30, -5, null, 'K')?.zone).toBe('start');
  });
});

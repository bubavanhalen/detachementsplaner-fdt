// @vitest-environment node
// F-UX2 Runde 3 (ux-critic Runde 2, 20.10.2026): UX-2-04 verdeckter Marker unter der Blockkante, UX-2-03 seitlicher
// Griff aussen am schmalen gewählten Block, UX-2-05 Klick neben den Text setzt die Marke ans Zeilenende, UX-2-14 Feld
// mit Leerzeichen gilt als ganz gezeichnet. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { hitEntry } from '../../../../src/components/wap/i2/hitTest';
import { indexNear, placeFields } from '../../../../src/components/wap/i2/inlineText';
import type { ScreenLine } from '../../../../src/components/wap/i2/layoutViews';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';

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

function line(text: string, top: number, left = 2): ScreenLine {
  return {
    left,
    top,
    fontPx: 12,
    rotation: 0,
    runs: [
      {
        text,
        bold: false,
        color: 'rgb(0 0 0)',
        strike: false,
        widthPx: measureRuns([{ text, weight: 'regular' }], 12),
      },
    ],
  };
}

describe('F-UX2 Runde 3: Treffen und Direktbearbeitung', () => {
  it('[R-5.1-01] UX-2-04: Marker unter einem höher gestapelten Block gilt nicht; sichtbarer Marker geht weiter vor', () => {
    const block = view('Block', 'block', r(0, 0, 100, 60), 9);
    const marker = view('ABV', 'marker', r(0, 3, 100, 1), 8);
    // Linie 3 px unter der Oberkante, vom Block überdeckt: die Kante des Blocks.
    expect(hitEntry([block, marker], 50, 3.5)?.view.id).toBe('Block');
    expect(hitEntry([block, marker], 50, 3.5)?.zone).toBe('start');
    // Marker über dem Block (höher gestapelt bzw. gleich hoch): weiter der Marker.
    const above = view('ABV', 'marker', r(0, 3, 100, 1), 9);
    expect(hitEntry([block, above], 50, 3.5)?.view.id).toBe('ABV');
    // Ein gewählter Block liegt 20 Stufen höher: auch ein sonst sichtbarer Marker ist dann verdeckt.
    expect(
      hitEntry([view('Block', 'block', r(0, 0, 100, 60), 2), marker], 50, 3.5, 'Block')?.view.id,
    ).toBe('Block');
    // Ohne Block an der Stelle bleibt der Marker treffbar.
    expect(hitEntry([block, marker], 150, 3.5)).toBeNull();
    expect(hitEntry([view('B', 'block', r(0, 10, 100, 50), 9), marker], 50, 3.5)?.view.id).toBe(
      'ABV',
    );
  });

  it('[R-5.1-14] UX-2-03: schmaler gewählter Block (< 24 px) hat den seitlichen Griff aussen an der Kante', () => {
    const narrow = view('S', 'block', r(40, 0, 19.5, 48), 2);
    const neighbour = view('N', 'block', r(59.5, 0, 19.5, 48), 2);
    // Über leerer Fläche aussen an der Kante: der Griff des gewählten Blocks.
    expect(hitEntry([narrow], 61, 24, 'S')).toMatchObject({ zone: 'right' });
    expect(hitEntry([narrow], 61, 24, 'S')?.view.id).toBe('S');
    expect(hitEntry([narrow, neighbour], 38, 24, 'S')).toMatchObject({ zone: 'left' });
    // Liegt dort ein anderer Eintrag, gilt dieser (R-5.1-26; CR-3-02, Koordinator 20.10.2026).
    expect(hitEntry([narrow, neighbour], 61, 24, 'S')?.view.id).toBe('N');
    // Innen bleibt die Fläche zum Verschieben; ungewählt kein Griff.
    expect(hitEntry([narrow, neighbour], 50, 24, 'S')?.zone).toBe('body');
    expect(hitEntry([narrow, neighbour], 61, 24, null)?.view.id).toBe('N');
  });

  it('[R-5.1-08] UX-2-05: Klick neben bzw. unter den Text setzt die Marke ans Ende der nächstgelegenen Zeile', () => {
    const l = placeFields([line('Wache', 2), line('Nord', 16)], ['Wache Nord', '', '', '']);
    expect(indexNear(l, 200, 4)).toEqual({ field: 0, index: 5 });
    expect(indexNear(l, 200, 60)).toEqual({ field: 0, index: 10 });
    // Im Text wie bisher: Stelle unter dem Zeiger.
    expect(indexNear(l, 3, 20)).toEqual({ field: 0, index: 6 });
  });

  it('[R-5.1-08] UX-2-14: Feld mit Leerzeichen auf einer Zeile gilt als ganz gezeichnet', () => {
    const l = placeFields(
      [line('Wache Süd', 2), line('Zfhr (Schiessplatz Nord)', 16)],
      ['Wache Süd', '', 'Zfhr', 'Schiessplatz Nord'],
    );
    expect(l.fields.map((f) => f.complete)).toEqual([true, true, true, true]);
    const cut = placeFields([line('Wache Sü…', 2)], ['Wache Süd', '', '', '']);
    expect(cut.fields[0]?.complete).toBe(false);
  });
});

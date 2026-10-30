// @vitest-environment node
// F-UX2 Runde 4 (code-reviewer-3 CR-3-02; R-5.1-26): der äussere Griff am schmalen gewählten Block gilt nur über
// leerer Fläche, ein anliegender Eintrag behält Klick und Zug; ein Marker im Griffbereich ebenso. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { hitEntry } from '../../../../src/components/wap/i2/hitTest';

function view(id: string, kind: EntryView['kind'], rect: Rect, z = 2): EntryView {
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

describe('F-UX2 Runde 4: äusserer Griff nur über leerer Fläche', () => {
  it('[R-5.1-26] CR-3-02: anliegender Block links und rechts, Marker im Griffbereich behalten den Treffer', () => {
    const s = view('S', 'block', r(40, 0, 19.5, 48));
    const rechts = view('R', 'block', r(59.5, 0, 19.5, 48));
    const links = view('L', 'block', r(20.5, 0, 19.5, 48));
    expect(hitEntry([s, rechts, links], 60, 24, 'S')?.view.id).toBe('R');
    expect(hitEntry([s, rechts, links], 38, 24, 'S')?.view.id).toBe('L');
    const marker = view('ABV', 'marker', r(0, 20, 200, 1), 8);
    expect(hitEntry([s, marker], 61, 20.5, 'S')?.view.id).toBe('ABV');
    // Ohne Nachbarn: Griff.
    expect(hitEntry([s], 60, 24, 'S')).toMatchObject({ zone: 'right' });
    expect(hitEntry([s], 38, 24, 'S')).toMatchObject({ zone: 'left' });
  });
});

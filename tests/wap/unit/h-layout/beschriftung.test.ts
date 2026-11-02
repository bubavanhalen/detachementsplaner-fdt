// @vitest-environment node
// Paket H-LAYOUT, Zusatzbefund visual-qa (d) (R-10-55; Auftraggeber R2): Eine Beschriftung neben dem Kästchen kommt in
// den nächsten freien Bereich des Tages – auch weiter weg –, nie über einen fremden Block, solange es freien Platz gibt.
import { describe, expect, it } from 'vitest';
import { findLabelSpot } from '../../../../src/model/wap/layout/entries/outsideLabel';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';

function schneiden(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.001 && h > 0.001;
}

describe('Freier Bereich für die Beschriftung (R-10-55)', () => {
  // Kästchen in einer schmalen Spalte; ringsum bis 60 pt Blockflächen, darunter frei.
  const box: Rect = { x: 50, y: 100, w: 6, h: 9 };
  const bounds: Rect = { x: 0, y: 0, w: 120, h: 400 };
  const block: Rect = { x: 0, y: 40, w: 120, h: 120 };
  const suche = { box, w: 20, h: 6, bounds, hard: [box], soft: [block] };

  it('[R-10-55] nahe nur Blockfläche, weiter unten frei: ohne Block (allowSoft false, far) → Lage im freien Bereich', () => {
    const r = findLabelSpot(suche, { allowSoft: false, far: true });
    expect(r).not.toBeNull();
    expect(schneiden(r as Rect, block)).toBe(false);
    expect(schneiden(r as Rect, box)).toBe(false);
    expect((r as Rect).y).toBeGreaterThanOrEqual(block.y + block.h);
  });

  it('[R-10-55] nahe gesucht ohne Blockfläche: keine Lage (null) statt über dem Block', () => {
    expect(findLabelSpot(suche, { allowSoft: false })).toBeNull();
  });

  it('[R-10-55] nirgends frei: als letzte Möglichkeit über der Blockfläche (wie bisher)', () => {
    const voll = { ...suche, soft: [bounds] };
    expect(findLabelSpot(voll, { allowSoft: false, far: true })).toBeNull();
    expect(findLabelSpot(voll)).not.toBeNull();
  });
});

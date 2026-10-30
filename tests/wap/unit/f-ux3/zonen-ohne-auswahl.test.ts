// @vitest-environment node
// F-UX3 (Rückmeldung Auftraggeber 21.10.2026 «ich mag nicht, dass ich einen Block zuerst anwählen muss, bevor ich ihn
// manipulieren kann»; Auftrag Koordinator 21.10.2026; Änderungsnotiz F-UX3 zu R-5.1-27): Kanten- und Körperzonen für
// jeden Block, die Auswahl ändert keine Zone; schmale Blöcke mit Kante aussen über leerer Fläche; sehr kleine Blöcke
// mit Band; Vorrang R-5.1-26 samt Ausnahme Kantenzone bleibt. Fiktive Ansichten.
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { hitEntry, zoneOf } from '../../../../src/components/wap/i2/hitTest';

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

describe('F-UX3: Zonen ohne vorheriges Wählen', () => {
  it('[R-5.1-27] breiter Block ohne Auswahl: seitliche Kanten 6 px innen, Körper dazwischen', () => {
    const b = view('B', 'block', r(0, 0, 60, 48));
    expect(hitEntry([b], 3, 24)).toMatchObject({ zone: 'left' });
    expect(hitEntry([b], 57, 24)).toMatchObject({ zone: 'right' });
    expect(hitEntry([b], 30, 24)).toMatchObject({ zone: 'body' });
    expect(hitEntry([b], 30, 3)).toMatchObject({ zone: 'start' });
  });

  it('[R-5.1-27] die Auswahl ändert keine Zone (gleiche Zone gewählt und nicht gewählt)', () => {
    const b = view('B', 'block', r(0, 0, 60, 20));
    const k = view('K', 'block', r(0, 40, 60, 10));
    for (const [v, x, y] of [
      [b, 3, 10],
      [b, 57, 10],
      [b, 30, 2],
      [b, 30, 10],
      [b, 30, 18],
      [k, 30, 41],
      [k, 30, 45],
      [k, 30, 49],
    ] as const)
      expect(zoneOf(v, x, y, null), `${v.id} ${String(x)}/${String(y)}`).toBe(
        zoneOf(v, x, y, v.id),
      );
  });

  it('[R-5.1-27] sehr kleiner Block (10 px) ohne Auswahl: Kante oben und unten je 3 px, Mitte zum Verschieben', () => {
    const k = view('K', 'block', r(0, 0, 60, 10));
    expect([1, 5, 9].map((y) => hitEntry([k], 30, y)?.zone)).toEqual(['start', 'body', 'end']);
  });

  it('[R-5.1-26] schmaler Block (< 24 px) ohne Auswahl: Kante aussen über leerer Fläche; ein Eintrag am Punkt geht vor', () => {
    const s = view('S', 'block', r(40, 0, 19.5, 48), 2);
    expect(hitEntry([s], 61, 24)).toMatchObject({ zone: 'right' });
    expect(hitEntry([s], 61, 24)?.view.id).toBe('S');
    expect(hitEntry([s], 37, 24)).toMatchObject({ zone: 'left' });
    // Innen bleibt die ganze Breite zum Verschieben.
    expect(hitEntry([s], 42, 24)?.zone).toBe('body');
    // Ausserhalb der Kantenzone (4 px) leere Fläche; über und unter dem Block keine Kante.
    expect(hitEntry([s], 64, 24)).toBeNull();
    expect(hitEntry([s], 61, 50)).toBeNull();
    // Nachbar am Punkt: der Nachbar (R-5.1-26), nicht die Kante.
    const n = view('N', 'block', r(59.5, 0, 19.5, 48), 2);
    expect(hitEntry([s, n], 61, 24)?.view.id).toBe('N');
  });

  it('[R-5.1-26] zwei schmale Blöcke mit Lücke: die nähere Kante gilt, bei gleichem Abstand der gewählte', () => {
    const a = view('A', 'block', r(0, 0, 20, 48));
    const b = view('B', 'block', r(26, 0, 20, 48));
    expect(hitEntry([a, b], 21, 24)).toMatchObject({ zone: 'right' });
    expect(hitEntry([a, b], 21, 24)?.view.id).toBe('A');
    expect(hitEntry([a, b], 25, 24)?.view.id).toBe('B');
    expect(hitEntry([a, b], 23, 24)?.view.id).toBe('A');
    expect(hitEntry([a, b], 23, 24, 'B')?.view.id).toBe('B');
  });

  it('[R-5.1-26] Vorrang bleibt: Marker vor dem nicht gewählten Block, an dessen sichtbarer Kante der Block', () => {
    const block = view('Block', 'block', r(0, 0, 100, 60), 9);
    const marker = view('ABV', 'marker', r(0, 30, 100, 1), 8);
    // Marker im Blockinnern vorn.
    expect(hitEntry([block, marker], 50, 30.5)?.view.id).toBe('ABV');
    // Seitliche Kante des Blocks (neu ohne Auswahl) über dem Marker: Marker bleibt vorn (Ausnahme nur oben/unten).
    expect(hitEntry([block, marker], 3, 30.5)?.view.id).toBe('ABV');
    // Ohne Marker an der Stelle (unter dem oberen Band von 12 px): seitliche Kante.
    expect(hitEntry([block, marker], 3, 20)).toMatchObject({ zone: 'left' });
  });
});

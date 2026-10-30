// @vitest-environment node
// Paket H-LAYOUT, Zusatzbefund visual-qa (b) (R-4.6-59; Beschrieb 4.6 «Marker liegen über Blöcken, verdecken aber
// keinen Text; ein betroffener Titel rückt unter den Marker»): Ein kurzer Block über alle Spalten mit einem Marker an
// seiner Oberkante zeigt seinen Titel neben dem Markerfeld statt nur «…». Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { textBounds } from '../../../../src/model/wap/layout/entries/outsideLabel';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';
import { lege, MO, rasterPlan, STD, teile, texte, zeilenText } from '../../support/grid/build';
import { block, marker, rt } from '../../support/model/builders';

function schneiden(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.001 && h > 0.001;
}

describe('Blocktext neben dem Markerfeld (R-4.6-59)', () => {
  it('[R-4.6-59] Block 0710–0745 über alle Planungsspalten, AV 0710: Titel vollständig, kein «…», kein Rückfall, Text schneidet weder Feld noch Linie', () => {
    const b = block('e1', 1, {
      date: MO,
      time: { form: 'range', from: 430, to: 465 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Vs Halle', true),
    });
    const m = marker('e2', 2, {
      date: MO,
      at: 430,
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
    });
    const L = lege(rasterPlan({ entries: [b, m] }));
    const zeilen = texte(L, 'e1');
    expect(zeilen.map(zeilenText).join(' ')).toBe('Vs Halle');
    expect(L.fallbacks.filter((e) => e.entryId === 'e1')).toEqual([]);
    const hindernisse = teile(L, 'e2').map((p) => p.rect);
    expect(hindernisse.length).toBeGreaterThan(1);
    for (const z of zeilen) {
      const u = textBounds(z);
      for (const h of hindernisse) expect(schneiden(u, h)).toBe(false);
    }
  });

  it('[R-4.6-59] genug Platz unter dem Marker: Titel wie bisher darunter (Fläche unter Linie und Feld)', () => {
    const b = block('e1', 1, {
      date: MO,
      time: { form: 'range', from: 430, to: 540 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Vs Halle', true),
    });
    const m = marker('e2', 2, {
      date: MO,
      at: 430,
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
    });
    const L = lege(rasterPlan({ entries: [b, m] }));
    const feld = teile(L, 'e2', 'markerField')[0]?.rect as Rect;
    const z = texte(L, 'e1')[0];
    expect(z).toBeDefined();
    expect(z?.frame.y ?? 0).toBeGreaterThanOrEqual(feld.y + feld.h - 1e-6);
  });

  it('[R-4.6-59] Marker 0700 knapp über dem Block: Feld ragt in den Block; reicht der Platz nicht ganz, zeigt der Text neben dem Feld mehr als nur «…»', () => {
    const b = block('e1', 1, {
      date: MO,
      time: { form: 'range', from: 430, to: 465 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Ausbildung Material Fahrzeuge Kontrolle Abgabe Rueckschub Halle', true),
    });
    const m = marker('e2', 2, {
      date: MO,
      at: 420,
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
    });
    const L = lege(rasterPlan({ entries: [b, m] }));
    const text = texte(L, 'e1').map(zeilenText).join(' ');
    expect(text.replace('…', '').trim().length).toBeGreaterThan(3);
    const feld = teile(L, 'e2', 'markerField')[0]?.rect as Rect;
    for (const z of texte(L, 'e1')) expect(schneiden(textBounds(z), feld)).toBe(false);
  });
});

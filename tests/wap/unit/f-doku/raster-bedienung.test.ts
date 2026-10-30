// @vitest-environment node
// F-DOKU, Befund SA-2-08 / TR-2-06: Belege der neuen Katalog-IDs zu den Zusatzpunkten des Auftraggebers vom
// 19.10.2026 (N1, N4, N5; Gestaltung `docs/wap-planer/ui/raster-bedienung-v2.md` §2, §3, §5, §7), umgesetzt in F-UX2:
// R-5.1-26 Vorrang der Treffer aus der Geometrie, R-5.1-27 Trefferzonen in Bildschirm-px und Mindest-Trefferbreite,
// R-5.1-28 Ziel des Auffüllens, R-5.2-12 Geltungsbereich «Nur dieser Tag / Alle Tage mit diesem Spaltensatz».
// Über die reinen Funktionen der Oberfläche bzw. den Befehl; fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import type { EntryView, Rect } from '../../../../src/components/wap/i2/entryViews';
import { fillTarget } from '../../../../src/components/wap/i2/fill';
import type { ColumnBox } from '../../../../src/components/wap/i2/geometry';
import { columnAt, edgeBand, hitEntry, zoneOf } from '../../../../src/components/wap/i2/hitTest';
import {
  columnSetUsage,
  insertOrRemoveDayColumn,
} from '../../../../src/model/wap/commands/dayColumns';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { Block, Id, Plan, Weekday } from '../../../../src/model/wap/types';
import { add, CTX, column, kpPlan, MO } from '../../support/i5/plan';
import { col } from '../../support/model/builders';

const r = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});

function ansicht(
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

describe('F-DOKU R-5.1-26: Vorrang der Treffer aus der Geometrie', () => {
  it('[R-5.1-26] Marker vor Kästchen und Blöcken, auch wenn diese kleiner sind oder höher liegen', () => {
    const blockGross = ansicht('Block', 'block', r(0, 0, 200, 200), 9);
    const beso = ansicht('Beso', 'beso', r(40, 80, 30, 30), 8);
    const marker = ansicht('HV', 'marker', r(0, 95, 200, 1), 0);
    expect(hitEntry([blockGross, beso, marker], 50, 95.5)?.view.id).toBe('HV');
    // Neben der Linie (mehr als 2 px): wieder der kleinste Eintrag.
    expect(hitEntry([blockGross, beso, marker], 50, 90)?.view.id).toBe('Beso');
  });

  it('[R-5.1-26] sonst der kleinste Eintrag, der den Punkt enthält – unabhängig von Reihenfolge und z-Index (auch ein gewählter, gehobener Block raubt keinen Treffer)', () => {
    const gross = ansicht('gross', 'block', r(0, 0, 100, 100), 100);
    const klein = ansicht('klein', 'block', r(10, 10, 20, 20), 1);
    expect(hitEntry([gross, klein], 15, 15)?.view.id).toBe('klein');
    expect(hitEntry([klein, gross], 15, 15)?.view.id).toBe('klein');
    expect(hitEntry([gross, klein], 15, 15, 'gross')?.view.id).toBe('klein');
    expect(hitEntry([gross, klein], 60, 60)?.view.id).toBe('gross');
  });

  it('[R-5.1-26] bei gleicher Fläche der oberste (höherer z-Index)', () => {
    const a = ansicht('a', 'block', r(0, 0, 40, 40), 3);
    const b = ansicht('b', 'block', r(0, 0, 40, 40), 7);
    expect(hitEntry([a, b], 20, 20)?.view.id).toBe('b');
    expect(hitEntry([b, a], 20, 20)?.view.id).toBe('b');
  });

  it('[R-5.1-26] Aussparungen gehören nicht zum Block: im ausgesparten Teil trifft nur die Ausnahme bzw. nichts', () => {
    const breit = ansicht('MiE', 'block', r(0, 0, 300, 90), 2, [
      r(0, 0, 100, 90),
      r(200, 0, 100, 90),
    ]);
    const ausnahme = ansicht('Ausnahme', 'block', r(100, 0, 100, 45), 1);
    expect(hitEntry([breit, ausnahme], 150, 20)?.view.id).toBe('Ausnahme');
    expect(hitEntry([breit, ausnahme], 150, 70)).toBeNull();
    expect(hitEntry([breit, ausnahme], 250, 70)?.view.id).toBe('MiE');
  });
});

describe('F-DOKU R-5.1-27: Trefferzonen in Bildschirm-px und Mindest-Trefferbreite', () => {
  // Auftrag Koordinator 21.10.2026 (F-UX3, Rückmeldung Auftraggeber «nicht zuerst anwählen»): Kanten- und Körperzonen
  // für jeden Block, die Auswahl ändert keine Zone; sehr kleine Blöcke haben ein Band von einem Drittel der Höhe.
  // Entscheid Auftraggeber 21.10.2026 Varianten 1a–5a (Runde 3): Band ab 24 px Höhe ein Drittel der Höhe, mindestens 8
  // und höchstens 12 px («Bandbreite ≤ 12 px»).
  it('[R-5.1-27] Kantenband oben/unten: ab 24 px Höhe ⅓ der Höhe (8 bis 12 px), 4 px von 12 bis 23 px, darunter ein Drittel der Höhe – nur von der Höhe in px abhängig', () => {
    expect([
      edgeBand(200),
      edgeBand(36),
      edgeBand(24),
      edgeBand(23),
      edgeBand(12),
      edgeBand(11),
    ]).toEqual([12, 12, 8, 4, 4, 3]);
    expect(edgeBand(23, true)).toBe(edgeBand(23));
    // Derselbe Block bei doppeltem Zoom (doppelte Höhe in px): Band höchstens 12 px, nicht 32.
    const v1 = ansicht('b', 'block', r(0, 0, 60, 48));
    const v2 = ansicht('b', 'block', r(0, 0, 120, 96));
    expect(zoneOf(v1, 30, 11.9, null)).toBe('start');
    expect(zoneOf(v1, 30, 12.1, null)).toBe('body');
    expect(zoneOf(v2, 60, 11.9, null)).toBe('start');
    expect(zoneOf(v2, 60, 12.1, null)).toBe('body');
    expect(zoneOf(v2, 60, 96 - 11.9, null)).toBe('end');
  });

  it('[R-5.1-27] Kleiner Block (16 px hoch): Band 4 px; sehr kleiner (10 px): Band 3 px, Mitte Körper', () => {
    const k = ansicht('k', 'block', r(0, 0, 60, 16));
    expect(zoneOf(k, 30, 3.9, null)).toBe('start');
    expect(zoneOf(k, 30, 4.1, null)).toBe('body');
    expect(zoneOf(k, 30, 12.1, null)).toBe('end');
    const s = ansicht('s', 'block', r(0, 0, 60, 10));
    expect([zoneOf(s, 30, 0.5, null), zoneOf(s, 30, 5, null), zoneOf(s, 30, 9.5, null)]).toEqual([
      'start',
      'body',
      'end',
    ]);
  });

  it('[R-5.1-27] Seitliche Kanten 6 px an jedem Block ab 24 px Breite, gewählt oder nicht', () => {
    const b = ansicht('b', 'block', r(0, 0, 60, 48));
    expect(zoneOf(b, 5.9, 24, null)).toBe('left');
    expect(zoneOf(b, 60 - 5.9, 24, null)).toBe('right');
    expect(zoneOf(b, 5.9, 24, 'b')).toBe('left');
    expect(zoneOf(b, 6.1, 24, 'b')).toBe('body');
    expect(zoneOf(b, 60 - 5.9, 24, 'b')).toBe('right');
    const schmal = ansicht('s', 'block', r(0, 0, 20, 48));
    expect(zoneOf(schmal, 2, 24, 's')).toBe('body');
  });

  it('[R-5.1-27] Schmale Spalte (6 px) gewinnt 16 px um ihre Mitte, höchstens bis zur Mitte der Nachbarn; breite Spalten nach ihrer Fläche', () => {
    let left = 0;
    const spalten: ColumnBox[] = [30, 30, 6, 30].map((w, i) => {
      const c = { column: col(`c${String(i)}`, `S${String(i)}`, 'planning'), left, width: w };
      left += w;
      return c;
    });
    // Schmale Spalte 60–66, Mitte 63 → Trefferbereich 55–71.
    expect(columnAt(spalten, 55)).toBe(2);
    expect(columnAt(spalten, 70.9)).toBe(2);
    expect(columnAt(spalten, 54.9)).toBe(1);
    expect(columnAt(spalten, 71)).toBe(3);
    expect(columnAt(spalten, 10)).toBe(0);
  });
});

describe('F-DOKU R-5.1-28: Ziel des Auffüllens', () => {
  /** Mo: «oben» 0700–0800 (Spalte 0), «mitte» 0900–1000 (Spalten 0, 1), «fremd» 1030–1100 (Spalte 2), «unten» 1200–1300 (Spalte 1). */
  function plan(): { plan: Plan; of: (id: Id) => Block; ids: Record<string, Id> } {
    let p = kpPlan(1);
    const neu = (title: string, from: number, to: number, cols: number[]) => {
      const res = add(p, {
        type: 'block',
        date: MO,
        time: { form: 'range', from, to },
        columns: { kind: 'ids', ids: cols.map((i) => column(p, i).id) },
        title: [{ text: title, bold: true }],
      });
      p = res.plan;
      return res.id;
    };
    const ids = {
      oben: neu('oben', 420, 480, [0]),
      mitte: neu('mitte', 540, 600, [0, 1]),
      fremd: neu('fremd', 630, 660, [2]),
      unten: neu('unten', 720, 780, [1]),
    };
    const fertig = p;
    return {
      plan: fertig,
      ids,
      of: (id: Id) => {
        const e = fertig.entries[id];
        if (e?.type !== 'block') throw new Error(id);
        return e;
      },
    };
  }

  it('[R-5.1-28] obere Kante → Ende des vorangehenden Blocks mit gemeinsamer Spalte; untere Kante → Beginn des folgenden; Blöcke ohne gemeinsame Spalte zählen nicht', () => {
    const { plan: p, of, ids } = plan();
    expect(fillTarget(p, of(ids.mitte as Id), 'start')).toBe(480);
    expect(fillTarget(p, of(ids.mitte as Id), 'end')).toBe(720);
  });

  it('[R-5.1-28] ohne Nachbarn: oben bis zum Rasterbeginn unter dem Band, unten bis zum Ende des Anzeigebereichs', () => {
    const { plan: p, of, ids } = plan();
    expect(fillTarget(p, of(ids.oben as Id), 'start')).toBe(p.displayRange.from + 60);
    expect(fillTarget(p, of(ids.unten as Id), 'end')).toBe(p.displayRange.to);
    expect(fillTarget(p, of(ids.fremd as Id), 'end')).toBe(p.displayRange.to);
  });
});

describe('F-DOKU R-5.2-12: Geltungsbereich «Nur dieser Tag / Alle Tage mit diesem Spaltensatz»', () => {
  const setOf = (p: Plan, wd: Weekday) =>
    p.weeks[0]?.days[['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].indexOf(wd)]?.columnSetId;
  const namen = (p: Plan, wd: Weekday) =>
    dayColumns(p, p.weeks[0]?.id ?? '', wd).map((c) => c.name);

  it('[R-5.2-12] «Nur dieser Tag» bei einem Spaltensatz an mehreren Tagen: der Tag erhält eine Kopie mit der neuen Spalte, die übrigen Tage und der Satz bleiben; ein Undo-Schritt', () => {
    const p = kpPlan(1);
    const w = p.weeks[0]?.id ?? '';
    const satz = setOf(p, 'Mo') ?? '';
    expect(columnSetUsage(p, satz)).toBeGreaterThan(1);
    const di = namen(p, 'Di');
    const r1 = insertOrRemoveDayColumn(
      p,
      w,
      'Mo',
      { op: 'insert', index: 1, name: 'Neue Spalte' },
      'day',
      CTX,
    );
    expect(setOf(r1.plan, 'Mo')).not.toBe(satz);
    expect(setOf(r1.plan, 'Di')).toBe(satz);
    expect(namen(r1.plan, 'Mo')[1]).toBe('Neue Spalte');
    expect(namen(r1.plan, 'Di')).toEqual(di);
    expect(r1.columnId).not.toBeNull();
    const zurueck = applyPatches(r1.plan, r1.inversePatches as Parameters<typeof applyPatches>[1]);
    expect(setOf(zurueck, 'Mo')).toBe(satz);
    expect(namen(zurueck, 'Mo')).toEqual(namen(p, 'Mo'));
  });

  it('[R-5.2-12] «Alle Tage mit diesem Spaltensatz»: die Spalte erscheint an jedem Tag des Satzes, andere Sätze bleiben', () => {
    const p = kpPlan(1);
    const w = p.weeks[0]?.id ?? '';
    const satz = setOf(p, 'Mi') ?? '';
    const mo = namen(p, 'Mo');
    const r1 = insertOrRemoveDayColumn(
      p,
      w,
      'Mi',
      { op: 'insert', index: 0, name: 'Neue Spalte' },
      'set',
      CTX,
    );
    for (const wd of ['Mi', 'Do', 'Fr'] as const) {
      expect(setOf(r1.plan, wd), wd).toBe(satz);
      expect(namen(r1.plan, wd)[0], wd).toBe('Neue Spalte');
    }
    expect(namen(r1.plan, 'Mo')).toEqual(mo);
  });

  it('[R-5.2-12] Satz nur an einem Tag verwendet: «Nur dieser Tag» legt keine weitere Kopie an (keine Rückfrage nötig)', () => {
    const p = kpPlan(1);
    const w = p.weeks[0]?.id ?? '';
    const eigen = insertOrRemoveDayColumn(
      p,
      w,
      'Mo',
      { op: 'insert', index: 1, name: 'Zug A' },
      'day',
      CTX,
    ).plan;
    const satz = setOf(eigen, 'Mo') ?? '';
    expect(columnSetUsage(eigen, satz)).toBe(1);
    const r2 = insertOrRemoveDayColumn(
      eigen,
      w,
      'Mo',
      { op: 'insert', index: 0, name: 'Zug B' },
      'day',
      CTX,
    );
    expect(setOf(r2.plan, 'Mo')).toBe(satz);
    expect(namen(r2.plan, 'Mo').slice(0, 3)).toEqual(['Zug B', namen(eigen, 'Mo')[0], 'Zug A']);
  });
});

// @vitest-environment node
// Paket F-LAYOUT2 Runde 2 (visual-qa-2, VQA-2-03, -06, -07; R-10-54, R-10-55; Entscheid Auftraggeber 19.10.2026
// «13: ja» «neben dem Kästchen»): Eine Beschriftung neben dem Kästchen steht zuerst unmittelbar am eigenen Kästchen
// (Abstand höchstens eine Zeile, über, unter oder neben ihm, mit gemeinsamer Projektion), nie nur über einem
// fremden Kästchen. Ein Spaltenkopf, der im Kopfbereich über seine Spalte hinausragt, ist weiss hinterlegt, damit
// keine Rasterlinie durch ihn läuft. Fiktive Nummern, Kürzel, Orte und Spalten.
import { describe, expect, it } from 'vitest';
import type { EntryPiece, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { headBounds } from '../../../../src/model/wap/layout/page/columnHeads';
import type { Rect, RectItem, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry, Plan } from '../../../../src/model/wap/types';
import { geo, lege, MO, rasterPlan, STD, texte, zeilenText } from '../../support/grid/build';
import { beso, block, rapport, rt, win } from '../../support/model/builders';
import { seite } from '../../support/page/seite';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';

const ZEILE = lineHeightPt(5);

/** Abstand zweier Rechtecke (0 bei Berührung oder Schnitt). */
function abstand(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/** Gemeinsame Projektion: waagrecht (über/unter) oder senkrecht (links/rechts) mehr als 0,01 pt. */
function angrenzend(t: Rect, box: Rect): boolean {
  const x = Math.min(t.x + t.w, box.x + box.w) - Math.max(t.x, box.x);
  const y = Math.min(t.y + t.h, box.y + box.h) - Math.max(t.y, box.y);
  return (x > 0.01 || y > 0.01) && abstand(t, box) <= ZEILE + 1e-6;
}

function traeger(L: GridLayout, id: string): { box: EntryPiece; label: EntryPiece } {
  const g = geo(L, id);
  const label = g.pieces.find((p) => p.kind === 'outsideLabel') as EntryPiece;
  expect(label, `Träger von ${id}`).toBeDefined();
  return { box: g.pieces[label.part] as EntryPiece, label };
}

describe('F-LAYOUT2 Runde 2: Beschriftung am eigenen Kästchen (VQA-2-03, VQA-2-07)', () => {
  it('[R-10-55] drei gleichzeitige Beso (Bahn 4,6 pt, Nummern 10, 11, 12): jede Nummer unmittelbar am eigenen Kästchen, keine nur über einem fremden', () => {
    // Wie Wo2 Mo 0800 der Referenzwoche: links davon belegte Planungsspalten (Blockfläche).
    const entries: Entry[] = [
      block('k1', 9, {
        date: MO,
        time: { form: 'range', from: 420, to: 720 },
        columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
        title: rt('Ausbildung'),
      }),
      ...[0, 1, 2].map((i) =>
        beso(`b${String(i)}`, i + 1, {
          date: MO,
          besoNumber: 10 + i,
          windows: [win(`w${String(i)}`, { time: { form: 'point', at: 480 } })],
        }),
      ),
    ];
    const L = lege(rasterPlan({ entries }), { W: 62 });
    const boxen = [0, 1, 2].map((i) => traeger(L, `b${String(i)}`));
    for (const [i, { box, label }] of boxen.entries()) {
      expect(box.rect.w).toBeLessThan(5);
      expect(angrenzend(label.rect, box.rect), `Nummer ${String(10 + i)} am eigenen Kästchen`).toBe(
        true,
      );
    }
    // Die Nummern stehen in der Reihenfolge der Bahnen (links → rechts), wo sie auf derselben Seite liegen.
    const mitte = (r: Rect) => r.x + r.w / 2;
    const oben = boxen.filter((b) => b.label.rect.y + b.label.rect.h <= b.box.rect.y + 1e-6);
    const unten = boxen.filter((b) => b.label.rect.y >= b.box.rect.y + b.box.rect.h - 1e-6);
    for (const seite of [oben, unten]) {
      for (let k = 1; k < seite.length; k++) {
        expect(mitte((seite[k] as { label: EntryPiece }).label.rect)).toBeGreaterThan(
          mitte((seite[k - 1] as { label: EntryPiece }).label.rect),
        );
      }
    }
    expect(L.fallbacks.filter((f) => f.kind === 'labelOutside')).toHaveLength(3);
  });

  it('[R-10-55] Kürzel mit Ort passt neben dem Kästchen nicht in den freien Bereich (Planungsspalten davor und danach belegt): das Kürzel steht unmittelbar am Kästchen, nicht eine Zeile tiefer', () => {
    const danach = block('k1', 2, {
      date: MO,
      // Planungsspalten bis eine halbe Stunde nach dem Rapport belegt; darunter wieder frei (wie KVK Mo 2000–2200).
      time: { form: 'range', from: 1080, to: 1290 },
      columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
      title: rt('Ausgang'),
    });
    const r = rapport('r1', 1, {
      date: MO,
      code: 'ARKXYZQ',
      time: { form: 'range', from: 1200, to: 1260 },
      ort: 'Werkhof Nord Ost',
    });
    const L = lege(rasterPlan({ entries: [danach, r] }), { W: 90 });
    // Vorbedingung: das Kürzel steht neben dem Kästchen (passt in 4,5 pt weder waagrecht noch senkrecht).
    const { box, label } = traeger(L, 'r1');
    const kuerzel = texte(L, 'r1').filter((t) => zeilenText(t).startsWith('ARKXYZQ'));
    expect(kuerzel).toHaveLength(1);
    const k = kuerzel[0] as TextItem;
    expect(k.frame.x >= label.rect.x - 0.01 && k.frame.x <= label.rect.x + label.rect.w).toBe(true);
    expect(angrenzend(label.rect, box.rect)).toBe(true);
    // Der Ort steht vollständig im freien Bereich oder entfällt mit Befund (Entscheid 13).
    const ort = texte(L, 'r1').some((t) => zeilenText(t).includes('(Werkhof Nord Ost)'));
    const entfallen = L.fallbacks.some((f) => f.entryId === 'r1' && f.dropped.includes('ort'));
    expect(ort !== entfallen).toBe(true);
  });
});

describe('F-LAYOUT2 Runde 2: überlaufender Spaltenkopf weiss hinterlegt (VQA-2-06)', () => {
  function mitKopf(name: string): Plan {
    const p = kvk();
    return {
      ...p,
      columnSets: p.columnSets.map((s) =>
        s.id === 's7'
          ? { ...s, columns: s.columns.map((c) => (c.id === 'c11' ? { ...c, name } : c)) }
          : s,
      ),
    };
  }

  it('[R-10-54] Kopf, der im Kopfbereich über seine schmale Spalte hinausragt (ohne Band): weisser Träger unter allen Zeilen, nach den Rasterlinien gezeichnet', () => {
    // «Uof» (schmal, 1 u) als Wort ohne Trennstelle: passt weder waagrecht noch senkrecht und auch mit höherer
    // Kopfzeile nicht in die Spalte; steht im Kopfbereich daneben (senkrecht, zwei Zeilen).
    const L = seite(mitKopf('XXXXXXXX'), KVK_WOCHE);
    expect(L.fallbacks.filter((f) => f.kind === 'tooManyColumns').length).toBeGreaterThan(0);
    expect(L.frame.grid.columnHeaderHeightPt).toBeCloseTo(
      seite(kvk(), KVK_WOCHE).frame.grid.columnHeaderHeightPt,
      6,
    );
    const items = L.pages[0]?.items ?? [];
    const koepfe = items
      .map((it, i) => ({ it, i }))
      .filter(
        (x): x is { it: TextItem; i: number } =>
          x.it.kind === 'text' &&
          x.it.role === 'columnHeader' &&
          x.it.runs.map((r) => r.text).join('') === 'XXXX',
      );
    expect(koepfe.length).toBeGreaterThan(0);
    const letzteLinie = Math.max(
      ...items.map((it, i) => (it.kind === 'line' && it.role === 'gridLine' ? i : -1)),
    );
    for (const { it, i } of koepfe) {
      const b = headBounds([
        {
          runs: it.runs,
          x: it.x,
          baselineY: it.baselineY,
          rotation: it.rotation === 90 ? 90 : 0,
          sizePt: it.sizePt,
        },
      ]) as Rect;
      const weiss = items.findIndex(
        (x, j) =>
          j < i &&
          j > letzteLinie &&
          x.kind === 'rect' &&
          x.role === 'columnHeader' &&
          (x as RectItem).fill?.r === 255 &&
          (x as RectItem).rect.x <= b.x + 1e-6 &&
          (x as RectItem).rect.x + (x as RectItem).rect.w >= b.x + b.w - 1e-6 &&
          (x as RectItem).rect.y <= b.y + 1e-6 &&
          (x as RectItem).rect.y + (x as RectItem).rect.h >= b.y + b.h - 1e-6,
      );
      expect(
        weiss,
        `weisser Träger unter «${it.runs.map((r) => r.text).join('')}»`,
      ).toBeGreaterThan(-1);
    }
  });
});

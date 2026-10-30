// @vitest-environment jsdom
// Paket E1-02d: Überdeckung von Blöcken – Nebeneinander, Aussparung, Textträger, verknüpfte Teilblöcke
// (Vertrag E1-02d Abschnitt 2b «Läufe», 2d Nr 2; Änderungsnotiz V07 (V-02d-15); Beschrieb 4.6 «Überdeckung und
// Ausnahmen»; F-06, F-07). Fiktive Pläne, Standardrahmen 0400–2400 mit 0,3 pt/min.
import { describe, expect, it } from 'vitest';
import type { EntryPiece, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';
import type { Block, Entry, Id } from '../../../../src/model/wap/types';
import {
  einTeil,
  feld,
  geo,
  lege,
  MO,
  nahe,
  nurMontag,
  rasterPlan,
  rechteckNahe,
  STD,
  STD_X,
  satz,
  schnittFlaeche,
  teile,
  texte,
  texteIn,
  X0,
  zeilenText,
} from '../../support/grid/build';
import { block, rt } from '../../support/model/builders';

function b(id: string, seq: number, ids: readonly Id[] | 'all', von: number, bis: number): Block {
  return block(id, seq, {
    date: MO,
    columns: ids === 'all' ? { kind: 'all' } : { kind: 'ids', ids: [...ids] },
    time: { form: 'range', from: von, to: bis },
    title: rt(`Titel ${id}`, true),
  });
}

const legeMo = (entries: readonly Entry[]): GridLayout => lege(rasterPlan({ entries }));

const flaeche = (r: Rect): number => r.w * r.h;
const summe = (ps: readonly EntryPiece[]): number => ps.reduce((s, p) => s + flaeche(p.rect), 0);

/** Satz mit sechs Planungsspalten zu 40 pt (W = 300: 15 Einheiten zu 20 pt). */
const SECHS = satz('s60', [
  { id: 'q1', kind: 'planning' },
  { id: 'q2', kind: 'planning' },
  { id: 'q3', kind: 'planning' },
  { id: 'q4', kind: 'planning' },
  { id: 'q5', kind: 'planning' },
  { id: 'q6', kind: 'planning' },
  { id: 'q7', kind: 'rap' },
  { id: 'q8', kind: 'beso' },
]);
const qx = (i: number) => X0 + 40 * (i - 1);
const legeSechs = (entries: readonly Entry[]): GridLayout =>
  lege(rasterPlan({ sets: [SECHS], tage: nurMontag('s60'), entries }), { W: 300 });

describe('Nebeneinander (2d Nr 2; R-4.6-58)', () => {
  it('[R-4.6-58] gleiche Spalten, überlappende Zeit → je halbe Breite, früher beginnender links', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p2], 480, 600),
      b('e2', 2, [STD.p1, STD.p2], 540, 660),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 40 }, 480, 600));
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: X0 + 40, w: 40 }, 540, 660));
    expect(einTeil(L, 'e1').textCarrier).toBe(true);
    expect(einTeil(L, 'e2').textCarrier).toBe(true);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Titel e1']);
    expect(texte(L, 'e2').map(zeilenText)).toEqual(['Titel e2']);
  });

  it('[R-4.6-58] Berührung zählt nicht: 0800-0900 und 0900-1000 behalten die volle Breite', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p2], 480, 540),
      b('e2', 2, [STD.p1, STD.p2], 540, 600),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 80 }, 480, 540));
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: X0, w: 80 }, 540, 600));
  });

  it('[R-4.6-58] Stelle nach Beginn, nicht nach Erfassung: später erfasster, früher beginnender liegt links', () => {
    const L = legeMo([b('e1', 1, [STD.p1], 540, 600), b('e2', 2, [STD.p1], 480, 600)]);
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: X0, w: 20 }, 480, 600));
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0 + 20, w: 20 }, 540, 600));
  });

  it('[R-4.6-58] (V-02d-15) drei gleichzeitige mit gleichen Spalten → je ein Drittel bei 0, 1/3, 2/3', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1], 480, 600),
      b('e2', 2, [STD.p1], 480, 600),
      b('e3', 3, [STD.p1], 480, 600),
    ]);
    ['e1', 'e2', 'e3'].forEach((id, k) => {
      rechteckNahe(
        einTeil(L, id).rect,
        feld({ x: X0 + (k * 40) / 3, w: 40 / 3 }, 480, 600),
        0.01,
        id,
      );
    });
  });

  it('[R-4.6-58] (V-02d-15) Kette A–B–C: kleinste freie Stelle, n = Anzahl Stellen der Gruppe (2)', () => {
    const L = legeMo([
      b('eA', 1, [STD.p1], 480, 600),
      b('eB', 2, [STD.p1], 540, 660),
      b('eC', 3, [STD.p1], 630, 690),
      b('eD', 4, [STD.p1], 840, 900),
    ]);
    rechteckNahe(einTeil(L, 'eA').rect, feld({ x: X0, w: 20 }, 480, 600));
    rechteckNahe(einTeil(L, 'eB').rect, feld({ x: X0 + 20, w: 20 }, 540, 660));
    rechteckNahe(einTeil(L, 'eC').rect, feld({ x: X0, w: 20 }, 630, 690));
    // Eigene Gruppe ohne Überschneidung: volle Breite.
    rechteckNahe(einTeil(L, 'eD').rect, feld({ x: X0, w: 40 }, 840, 900));
  });

  it('[R-4.6-58] ungleiche Spalten → Aussparung statt Teilung: der schmale behält seine volle Spaltenbreite', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p2, STD.p3], 480, 720),
      b('e2', 2, [STD.p2], 540, 600),
    ]);
    rechteckNahe(einTeil(L, 'e2').rect, feld(STD_X.p2, 540, 600));
    const ps = teile(L, 'e1', 'block');
    expect(ps).toHaveLength(4);
    rechteckNahe(ps[0]?.rect ?? leer(), feld({ x: X0, w: 120 }, 480, 540), 0.01, 'oben');
    rechteckNahe(ps[1]?.rect ?? leer(), feld(STD_X.p1, 540, 600), 0.01, 'links');
    rechteckNahe(ps[2]?.rect ?? leer(), feld(STD_X.p3, 540, 600), 0.01, 'rechts');
    rechteckNahe(ps[3]?.rect ?? leer(), feld({ x: X0, w: 120 }, 600, 720), 0.01, 'unten');
    expect(ps.map((p) => p.part)).toEqual([0, 0, 0, 0]);
    expect(ps.map((p) => p.textCarrier)).toEqual([false, false, false, true]);
  });
});

describe('Aussparung (2d Nr 2; R-4.6-56; F-06)', () => {
  it('[R-4.6-56] Block über alle Spalten 1130-1300 und Block in einer Spalte 1130-1230: keine Fläche im Ausnahmebereich, Rest bedeckt', () => {
    const L = legeMo([b('eA', 1, 'all', 690, 780), b('eB', 2, [STD.p2], 690, 750)]);
    const ausnahme = feld(STD_X.p2, 690, 750);
    rechteckNahe(einTeil(L, 'eB').rect, ausnahme);
    const ps = teile(L, 'eA', 'block');
    for (const p of ps) expect(schnittFlaeche(p.rect, ausnahme)).toBeLessThanOrEqual(1e-6);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        expect(
          schnittFlaeche((ps[i] as EntryPiece).rect, (ps[j] as EntryPiece).rect),
        ).toBeLessThanOrEqual(1e-6);
      }
    }
    const ganz = feld({ x: X0, w: 120 }, 690, 780);
    nahe(summe(ps), flaeche(ganz) - flaeche(ausnahme), 0.05);
    for (const p of ps) expect(schnittFlaeche(p.rect, ganz)).toBeCloseTo(flaeche(p.rect), 6);
    // Zerlegung in Streifen, Reihenfolge nach y, dann x.
    expect(ps).toHaveLength(3);
    rechteckNahe(ps[0]?.rect ?? leer(), feld(STD_X.p1, 690, 750));
    rechteckNahe(ps[1]?.rect ?? leer(), feld(STD_X.p3, 690, 750));
    rechteckNahe(ps[2]?.rect ?? leer(), feld({ x: X0, w: 120 }, 750, 780));
  });

  it('[R-4.6-56] teilweise Überschneidung (F-06): der früher erfasste wird in den gemeinsamen Spalten ausgespart', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p2], 480, 600),
      b('e2', 2, [STD.p2, STD.p3], 540, 660),
    ]);
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: X0 + 40, w: 80 }, 540, 660));
    const ps = teile(L, 'e1', 'block');
    expect(ps).toHaveLength(2);
    rechteckNahe(ps[0]?.rect ?? leer(), feld({ x: X0, w: 80 }, 480, 540));
    rechteckNahe(ps[1]?.rect ?? leer(), feld(STD_X.p1, 540, 600));
  });

  it('[R-4.6-56] teilweise Überschneidung, umgekehrte Erfassung: jetzt ist der andere ausgespart', () => {
    const L = legeMo([
      b('e1', 2, [STD.p1, STD.p2], 480, 600),
      b('e2', 1, [STD.p2, STD.p3], 540, 660),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 80 }, 480, 600));
    const ps = teile(L, 'e2', 'block');
    expect(ps).toHaveLength(2);
    rechteckNahe(ps[0]?.rect ?? leer(), feld(STD_X.p3, 540, 600));
    rechteckNahe(ps[1]?.rect ?? leer(), feld({ x: X0 + 40, w: 80 }, 600, 660));
  });
});

describe('Ganz ersetzter Block (Notiz Runde 2 R2-7; V-02d-21)', () => {
  it('[R-4.6-56] (V-02d-21) Block {A, B} 0800-1000 ganz von {A} und {B} bedeckt: kein Teilstück, kein Ereignis, kein Item; bleibt in entries', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p2], 480, 600),
      b('e2', 2, [STD.p1], 480, 600),
      b('e3', 3, [STD.p2], 480, 600),
    ]);
    expect(L.entries.filter((e) => e.entryId === 'e1')).toEqual([
      { entryId: 'e1', type: 'block', pieces: [] },
    ]);
    expect(L.items.some((i) => i.entryId === 'e1')).toBe(false);
    expect(L.fallbacks.filter((f) => f.entryId === 'e1')).toEqual([]);
    rechteckNahe(einTeil(L, 'e2').rect, feld(STD_X.p1, 480, 600));
    rechteckNahe(einTeil(L, 'e3').rect, feld(STD_X.p2, 480, 600));
  });
});

describe('Textträger (2d Nr 2; R-4.6-57; F-07)', () => {
  it('[R-4.6-57] Teilstücke 2 Spalten links, 3 Spalten rechts → Text rechts', () => {
    const L = legeSechs([b('eA', 1, 'all', 690, 780), b('eB', 2, ['q3'], 690, 780)]);
    const ps = teile(L, 'eA', 'block');
    expect(ps).toHaveLength(2);
    rechteckNahe(ps[0]?.rect ?? leer(), feld({ x: qx(1), w: 80 }, 690, 780));
    rechteckNahe(ps[1]?.rect ?? leer(), feld({ x: qx(4), w: 120 }, 690, 780));
    expect(ps.map((p) => p.textCarrier)).toEqual([false, true]);
    expect(ps.map((p) => p.textOrientation)).toEqual([null, 'horizontal']);
    expect(texteIn(L, 'eA', (ps[1] as EntryPiece).rect).map(zeilenText)).toEqual(['Titel eA']);
    expect(texteIn(L, 'eA', (ps[0] as EntryPiece).rect)).toEqual([]);
  });

  it('[R-4.6-57] gleich grosse Teilstücke nebeneinander → Text im linken', () => {
    const L = legeSechs([
      b('eA', 1, ['q1', 'q2', 'q3', 'q4', 'q5'], 690, 780),
      b('eB', 2, ['q3'], 690, 780),
    ]);
    const ps = teile(L, 'eA', 'block');
    expect(ps.map((p) => p.textCarrier)).toEqual([true, false]);
    expect(texte(L, 'eA')).toHaveLength(1);
  });

  it('[R-4.6-57] gleich grosse Teilstücke übereinander → Text im oberen', () => {
    const L = legeSechs([b('eA', 1, ['q1', 'q2'], 480, 720), b('eB', 2, ['q1'], 570, 630)]);
    const ps = teile(L, 'eA', 'block');
    expect(ps).toHaveLength(3);
    rechteckNahe(ps[0]?.rect ?? leer(), feld({ x: qx(1), w: 80 }, 480, 570));
    rechteckNahe(ps[1]?.rect ?? leer(), feld({ x: qx(2), w: 40 }, 570, 630));
    rechteckNahe(ps[2]?.rect ?? leer(), feld({ x: qx(1), w: 80 }, 630, 720));
    expect(ps.map((p) => p.textCarrier)).toEqual([true, false, false]);
  });
});

describe('Verknüpfte Teilblöcke (2b «Läufe»; R-4.6-60)', () => {
  it('[R-4.6-60] (V-02d-2) zwei nicht benachbarte Spalten → zwei Teilblöcke (part 0, 1) in einem Eintrag, jeder mit Text', () => {
    const L = legeMo([b('e1', 1, [STD.p3, STD.p1], 480, 600)]);
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = teile(L, 'e1', 'block');
    expect(ps).toHaveLength(2);
    rechteckNahe(ps[0]?.rect ?? leer(), feld(STD_X.p1, 480, 600));
    rechteckNahe(ps[1]?.rect ?? leer(), feld(STD_X.p3, 480, 600));
    expect(ps.map((p) => [p.part, p.textCarrier])).toEqual([
      [0, true],
      [1, true],
    ]);
    for (const p of ps) expect(texteIn(L, 'e1', p.rect).map(zeilenText)).toEqual(['Titel e1']);
  });

  it('[R-4.6-60] benachbarte Spalten → ein zusammenhängender Block', () => {
    const L = legeMo([b('e1', 1, [STD.p1, STD.p2], 480, 600)]);
    const p = einTeil(L, 'e1', 'block');
    rechteckNahe(p.rect, feld({ x: X0, w: 80 }, 480, 600));
    expect(geo(L, 'e1').pieces).toHaveLength(1);
  });

  it('[R-4.6-60] Teilblock neben einem Block mit derselben Spaltenmenge: jeder Lauf wird geteilt', () => {
    const L = legeMo([
      b('e1', 1, [STD.p1, STD.p3], 480, 600),
      b('e2', 2, [STD.p1, STD.p3], 480, 600),
    ]);
    const p1 = teile(L, 'e1', 'block');
    const p2 = teile(L, 'e2', 'block');
    rechteckNahe(p1[0]?.rect ?? leer(), feld({ x: X0, w: 20 }, 480, 600));
    rechteckNahe(p1[1]?.rect ?? leer(), feld({ x: X0 + 80, w: 20 }, 480, 600));
    rechteckNahe(p2[0]?.rect ?? leer(), feld({ x: X0 + 20, w: 20 }, 480, 600));
    rechteckNahe(p2[1]?.rect ?? leer(), feld({ x: X0 + 100, w: 20 }, 480, 600));
  });
});

function leer(): Rect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

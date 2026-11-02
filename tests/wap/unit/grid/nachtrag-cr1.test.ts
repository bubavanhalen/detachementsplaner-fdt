// @vitest-environment jsdom
// Paket E1-02d: Testnachtrag nach Code-Review Runde 1 (Vertrag E1-02d, Änderungsnotiz Code-Review Runde 1,
// C1 «Randhöhe höchstens Zeitbereich» und C2 «entries bei Fortsetzungen»; Beschrieb 4.5, F-63 b; R-7-07,
// R-4.5-07, R-4.5-10). Erwartungen aus den festen Rahmenmassen nachgerechnet. Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import { parsePathData } from '../../../../src/io/wap-pdf/pathData';
import type { EntryPiece, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';
import type { Beso, Block, Entry, IsoDate } from '../../../../src/model/wap/types';
import {
  DI,
  feld,
  geo,
  innerhalb,
  itemsVon,
  lege,
  MO,
  MO2,
  nahe,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  SO,
  STD,
  STD_X,
  type TagSpec,
  texte,
  WOCHE,
  WOCHE2,
  X0,
  Y0,
} from '../../support/grid/build';
import { beso, block, rt, WEEKDAYS, win } from '../../support/model/builders';

const range = (from: number, to: number) => ({ form: 'range' as const, from, to });

function sichtbar(...tage: readonly number[]): readonly TagSpec[] {
  return WEEKDAYS.map((_, i) => ({ set: STD.set, display: tage.includes(i) ? 'full' : 'hidden' }));
}

// ---------------------------------------------------------------------------------------------------------
// C1: Anzeigebereich 0400–0510 → V0 = 300, V1 = 310 (2a Nr 1: 240 + 60 < 310 ≤ 1440, Vielfache von 5).
// 0,3 pt/Min: y(0500) = Y0 + 60·0,3 = Y0 + 18, y(0510) = Y0 + 70·0,3 = Y0 + 21; Randhöhe 10 Min = 3 pt.
// Nutzbare Höhe 3 − 2·(0,5 + 0,48/2) = 1,52 pt < lineHeightPt(4,5) → kein Text, je Teil ein textOmitted.
// ---------------------------------------------------------------------------------------------------------

const KURZ = { from: 240, to: 310 } as const;
const Y_V0 = Y0 + 18;
const Y_V1 = Y0 + 21;

function b(id: string, seq: number, over: Partial<Block> = {}): Block {
  return block(id, seq, {
    date: MO,
    columns: { kind: 'ids', ids: [STD.p1] },
    title: rt('Ausb', true),
    ...over,
  });
}

/** Rechteck aus Spalten-x-Bereich und Zeitspanne im Anzeigebereich 0400–0510. */
const feldKurz = (xb: { readonly x: number; readonly w: number }, von: number, bis: number): Rect =>
  feld(xb, von, bis, KURZ.from);

/** Alle y-Werte der gezeichneten Flächen und Rahmen von `id` liegen in [y(V0), y(V1)] (R-7-07, F-63 b). */
function zeichnungImZeitbereich(L: GridLayout, id: string): void {
  const ys: number[] = [];
  for (const p of geo(L, id).pieces) ys.push(p.rect.y, p.rect.y + p.rect.h);
  for (const i of itemsVon(L, id)) {
    if (i.kind === 'rect') ys.push(i.rect.y, i.rect.y + i.rect.h);
    else if (i.kind === 'line') ys.push(i.y1, i.y2);
    else if (i.kind === 'path') {
      const seg = parsePathData(i.d);
      expect(seg, `Pfad «${i.d}» lesbar`).not.toBeNull();
      for (const s of seg ?? []) {
        for (let k = 1; k < s.values.length; k += 2) ys.push(s.values[k] ?? Number.NaN);
      }
    }
  }
  expect(ys.length).toBeGreaterThan(0);
  for (const y of ys) {
    expect(Number.isFinite(y), 'y endlich').toBe(true);
    expect(y, `y ${y} nicht im Band (≥ y(V0) = ${Y_V0})`).toBeGreaterThanOrEqual(Y_V0 - 0.01);
    expect(y, `y ${y} nicht unter y(to) = ${Y_V1}`).toBeLessThanOrEqual(Y_V1 + 0.01);
  }
}

/** Kein Text von `id`; je Teilstück genau ein textOmitted mit dropped [] (V01, V02/V18). */
function nurTextOmitted(L: GridLayout, id: string): void {
  expect(texte(L, id)).toEqual([]);
  const g = geo(L, id);
  expect(L.fallbacks.filter((f) => f.entryId === id)).toEqual(
    g.pieces.map((p, i) => ({
      kind: 'textOmitted',
      region: 'block',
      weekId: WOCHE,
      date: p.date,
      entryId: id,
      piece: i,
      dropped: [],
    })),
  );
}

describe('C1 Randhöhe höchstens Zeitbereich (Änderungsnotiz Code-Review Runde 1; F-63 b)', () => {
  it('[R-7-07] Anzeigebereich 0400–0510: Block 0200-0300 → span [120, 180], Fläche [0500, 0510], nur oben offen, kein Text', () => {
    const L = lege(rasterPlan({ range: KURZ, entries: [b('e1', 1, { time: range(120, 180) })] }));
    nahe(L.timeScale.yTop, Y0, 0.01, 'y(from)');
    nahe(L.timeScale.ptPerMinute, 0.3, 1e-9, 'ptPerMinute');
    const ps = geo(L, 'e1').pieces;
    expect(ps).toHaveLength(1);
    const p = ps[0] as EntryPiece;
    expect(p.kind).toBe('block');
    expect(p.date).toBe(MO);
    expect(p.span).toEqual({ from: 120, to: 180 });
    rechteckNahe(p.rect, feldKurz(STD_X.p1, 300, 310));
    nahe(p.rect.y, Y_V0, 0.01, 'Oberkante = y(0500)');
    nahe(p.rect.y + p.rect.h, Y_V1, 0.01, 'Unterkante = y(0510)');
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([true, false, 'none']);
    zeichnungImZeitbereich(L, 'e1');
    nurTextOmitted(L, 'e1');
  });

  it('[R-7-07] Anzeigebereich 0400–0510: Block Zeitpunkt 1640 → span [1000, 1030], Fläche [0500, 0510], nur unten offen, kein Text', () => {
    const L = lege(
      rasterPlan({ range: KURZ, entries: [b('e1', 1, { time: { form: 'point', at: 1000 } })] }),
    );
    const ps = geo(L, 'e1').pieces;
    expect(ps).toHaveLength(1);
    const p = ps[0] as EntryPiece;
    expect(p.kind).toBe('block');
    expect(p.span).toEqual({ from: 1000, to: 1030 });
    rechteckNahe(p.rect, feldKurz(STD_X.p1, 300, 310));
    nahe(p.rect.y, Y_V0, 0.01, 'Oberkante = y(0500)');
    nahe(p.rect.y + p.rect.h, Y_V1, 0.01, 'Unterkante = y(0510)');
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([false, true, 'none']);
    zeichnungImZeitbereich(L, 'e1');
    nurTextOmitted(L, 'e1');
  });

  it('[R-4.5-07] [R-7-07] (V-02d-20) Anzeigebereich 0400–0510: Block Mo 2400-0100 → Teil Mo span [1440, 1440] und Teil Di span [0, 60], je Fläche [0500, 0510], kein Text', () => {
    const L = lege(
      rasterPlan({
        range: KURZ,
        tage: sichtbar(0, 1),
        entries: [b('e1', 1, { time: range(1440, 1500), title: rt('Nacht') })],
      }),
      { W: 360 },
    );
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = geo(L, 'e1').pieces;
    expect(ps.map((p) => [p.kind, p.date])).toEqual([
      ['block', MO],
      ['block', DI],
    ]);
    const [mo, di] = ps as [EntryPiece, EntryPiece];
    expect(mo.span).toEqual({ from: 1440, to: 1440 });
    rechteckNahe(mo.rect, feldKurz(STD_X.p1, 300, 310));
    expect([mo.openTop, mo.openBottom, mo.continuation]).toEqual([false, true, 'toNextDay']);
    expect(di.span).toEqual({ from: 0, to: 60 });
    rechteckNahe(di.rect, feldKurz({ x: X0 + 180, w: 40 }, 300, 310));
    expect([di.openTop, di.openBottom, di.continuation]).toEqual([true, false, 'fromPreviousDay']);
    zeichnungImZeitbereich(L, 'e1');
    nurTextOmitted(L, 'e1');
  });
});

// ---------------------------------------------------------------------------------------------------------
// C2: Kp-Vorlage (fixed30), 0400–2400. Zeitfenster 2300-0100 → Kästchen [2300, 2330] am eigenen Tag; ohne
// Folgetag-Teil (nur Vorlage `duration` teilt) erscheint der Beso am Folgetag nicht in `entries`.
// ---------------------------------------------------------------------------------------------------------

function bs(id: string, date: IsoDate): Beso {
  return beso(id, 1, {
    date,
    title: rt(`Beso ${id}`),
    windows: [win(`t${id}`, { time: range(1380, 1500) })],
    besoNumber: 13,
  });
}

/** Beso-Spalte, linke Bahn (B/2 = 20 pt) eines Standardtags mit linkem Rand `xTag`. */
const bahn0 = (xTag: number) => ({ x: xTag + 140, w: 20 });

function idsIn(L: GridLayout): readonly string[] {
  return L.entries.map((e) => e.entryId);
}

describe('C2 entries bei Fortsetzungen (Änderungsnotiz Code-Review Runde 1; R-4.5-10)', () => {
  it('[R-4.5-10] Kp-Beso So 2300-0100: diese Woche ein EntryGeometry mit Kästchen So [2300, 2330]; Folgewoche kein EntryGeometry', () => {
    const entries: readonly Entry[] = [bs('e1', SO)];
    const plan = rasterPlan({ tage: sichtbar(6), tage2: sichtbar(0), entries });

    const L = lege(plan, { W: 180, weekId: WOCHE });
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = geo(L, 'e1').pieces;
    expect(ps.map((p) => [p.kind, p.date, p.continuation])).toEqual([['besoBox', SO, 'none']]);
    const p = ps[0] as EntryPiece;
    expect(p.span).toEqual({ from: 1380, to: 1410 });
    rechteckNahe(p.rect, feld(bahn0(X0), 1380, 1410));
    expect([p.openTop, p.openBottom]).toEqual([false, false]);

    const L2 = lege(plan, { W: 180, weekId: WOCHE2 });
    expect(L2.days.map((d) => d.date)).toEqual([MO2]);
    expect(idsIn(L2)).not.toContain('e1');
    expect(itemsVon(L2, 'e1')).toEqual([]);
    expect(L2.fallbacks.filter((f) => f.entryId === 'e1')).toEqual([]);
  });

  it('[R-4.5-10] Kp-Beso Mo 2300-0100, Mo und Di sichtbar: genau ein EntryGeometry, nur das Kästchen am Mo', () => {
    const L = lege(rasterPlan({ tage: sichtbar(0, 1), entries: [bs('e1', MO)] }), { W: 360 });
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = geo(L, 'e1').pieces;
    expect(ps.map((p) => [p.kind, p.date, p.continuation])).toEqual([['besoBox', MO, 'none']]);
    const p = ps[0] as EntryPiece;
    expect(p.span).toEqual({ from: 1380, to: 1410 });
    rechteckNahe(p.rect, feld(bahn0(X0), 1380, 1410));
    const montag: Rect = { x: X0, y: Y0, w: 180, h: 1200 * 0.3 };
    expect(rechtecke(L, 'e1').length).toBeGreaterThan(0);
    for (const r of rechtecke(L, 'e1')) {
      expect(innerhalb(r.rect, montag), 'Fläche nur am Mo').toBe(true);
    }
  });

  it('[R-4.5-10] Kp-Beso Mo 2300-0100, Mo ausgeblendet, Di sichtbar: kein EntryGeometry', () => {
    const L = lege(rasterPlan({ tage: sichtbar(1), entries: [bs('e1', MO)] }), { W: 180 });
    expect(L.days.map((d) => d.date)).toEqual([DI]);
    expect(idsIn(L)).not.toContain('e1');
    expect(itemsVon(L, 'e1')).toEqual([]);
    expect(L.fallbacks.filter((f) => f.entryId === 'e1')).toEqual([]);
  });
});

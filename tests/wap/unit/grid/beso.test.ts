// @vitest-environment jsdom
// Paket E1-02d: Beso-Kästchen – Zeitspanne, Spalte, Bahnen, Nummer (Vertrag E1-02d Abschnitt 1 besoBoxSpan,
// 2b «Beso-Zeitfenster», 2c, 2d Nr 4, 2e «Weitere Texte»; Änderungsnotizen V05, V10, Runde 2 V19 h; Beschrieb 4.6
// «Beso im Detail»; F-05, F-62). Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import { besoBoxSpan } from '../../../../src/model/wap/layout/entries/besoBox';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import type {
  Beso,
  BesoTimeWindow,
  Entry,
  LtgCategory,
  TimeSpec,
} from '../../../../src/model/wap/types';
import {
  einTeil,
  ereignisse,
  feld,
  geo,
  LINIEN,
  lege,
  MI,
  MO,
  nurMontag,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  STD,
  STD_X,
  satz,
  type TagSpec,
  teile,
  texte,
  texteIn,
  WOCHE,
  X0,
  zeilenText,
} from '../../support/grid/build';
import {
  beso,
  block,
  CAT,
  kpLegend,
  rt,
  setMiFr,
  setStufen,
  WEEKDAYS,
  win,
} from '../../support/model/builders';

const kp = kpTemplate();
const dauer: LevelTemplate = { ...kp, besoBox: { height: 'duration', numberBold: true } };
const punkt = (at: number): TimeSpec => ({ form: 'point', at });
const range = (from: number, to: number): TimeSpec => ({ form: 'range', from, to });

function bs(
  id: string,
  seq: number,
  fenster: readonly BesoTimeWindow[],
  over: Partial<Beso> = {},
): Beso {
  return beso(id, seq, { date: MO, title: rt(`Beso ${id}`), windows: [...fenster], ...over });
}
const lb = (
  entries: readonly Entry[],
  over: Parameters<typeof rasterPlan>[0] = {},
  W = 180,
): GridLayout => lege(rasterPlan({ entries, ...over }), { W });

/** Beso-Spalte des Standardtags (W = 180): x = 170, Breite 40, Bahnen 20. */
const BESO = STD_X.beso;
const bahn = (k: 0 | 1) => ({ x: BESO.x + 20 * k, w: 20 });

describe('besoBoxSpan (2c)', () => {
  it('[R-4.6-45] Kp «bis 1200» → 1130–1200; Frist mit Uhrzeit «bis 21.10. 1200» analog', () => {
    expect(besoBoxSpan({ form: 'until', to: 720 }, kp, 240)).toEqual({ from: 690, to: 720 });
    expect(besoBoxSpan({ form: 'deadline', to: 720 }, kp, 240)).toEqual({ from: 690, to: 720 });
  });

  it('[R-4.6-46] Kp «ab 1900» → 1900–1930', () => {
    expect(besoBoxSpan({ form: 'from', from: 1140 }, kp, 240)).toEqual({ from: 1140, to: 1170 });
  });

  it('[R-4.6-49] Kp fest 30 Min: 0900-1200 → 0900–0930, Zeitpunkt 0900 → 0900–0930, über Mitternacht ebenfalls 30 Min', () => {
    expect(besoBoxSpan(range(540, 720), kp, 240)).toEqual({ from: 540, to: 570 });
    expect(besoBoxSpan(punkt(540), kp, 240)).toEqual({ from: 540, to: 570 });
    expect(besoBoxSpan(range(1380, 1500), kp, 240)).toEqual({ from: 1380, to: 1410 });
  });

  it('[R-4.6-49] Frist ohne Uhrzeit → am Beginn des Zeitbereichs [displayFrom + 60, + 90] (F-05 × B-F-06)', () => {
    expect(besoBoxSpan({ form: 'deadline' }, kp, 240)).toEqual({ from: 300, to: 330 });
    expect(besoBoxSpan({ form: 'deadline' }, kp, 0)).toEqual({ from: 60, to: 90 });
    expect(besoBoxSpan({ form: 'deadline' }, kp, 300)).toEqual({ from: 360, to: 390 });
  });

  it('[R-4.6-49] Vorlage «Dauer» (Gegenprobe): von–bis über die ganze Dauer, übrige Formen wie Kp', () => {
    expect(besoBoxSpan(range(540, 720), dauer, 240)).toEqual({ from: 540, to: 720 });
    expect(besoBoxSpan(range(1380, 1500), dauer, 240)).toEqual({ from: 1380, to: 1500 });
    expect(besoBoxSpan(punkt(540), dauer, 240)).toEqual({ from: 540, to: 570 });
    expect(besoBoxSpan({ form: 'until', to: 720 }, dauer, 240)).toEqual({ from: 690, to: 720 });
  });
});

describe('Spalte des Kästchens (2b; R-4.6-42, R-4.6-43)', () => {
  it('[R-4.6-42] Zeitfenster ohne Spalte → Kästchen in der Beso-Spalte (erste Bahn), Rahmen besoBoxBorder', () => {
    const L = lb([bs('e1', 1, [win('t1', { time: punkt(810) })])]);
    const p = einTeil(L, 'e1', 'besoBox');
    rechteckNahe(p.rect, feld(bahn(0), 810, 840));
    expect(p.windowId).toBe('t1');
    expect([p.part, p.textCarrier]).toEqual([0, true]);
    expect(p.span).toEqual({ from: 810, to: 840 });
    const r = rechtecke(L, 'e1');
    expect(r.map((x) => [x.role, x.stroke])).toEqual([['besoBox', LINIEN.besoBoxBorder]]);
    expect(geo(L, 'e1').type).toBe('beso');
  });

  it('[R-4.6-43] Zeitfenster mit Planungsspalte → Kästchen in dieser Spalte (volle Breite bei einem Kästchen)', () => {
    const L = lb([bs('e1', 1, [win('t1', { time: punkt(810), columnId: STD.p2 })])]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(STD_X.p2, 810, 840));
  });

  it('[R-4.6-43] Zeitfenster mit Nebenspalte → Kästchen in der Nebenspalte', () => {
    const neben = satz('s50', [
      { id: 'n1', kind: 'planning' },
      { id: 'n2', kind: 'secondary' },
      { id: 'n3', kind: 'rap' },
      { id: 'n4', kind: 'beso' },
    ]);
    const L = lege(
      rasterPlan({
        sets: [neben],
        tage: nurMontag('s50'),
        entries: [bs('e1', 1, [win('t1', { time: punkt(810), columnId: 'n2' })])],
      }),
      { W: 140 },
    );
    // 2 + 2 + 1 + 2 = 7 Einheiten zu 20 pt (Nebenspalte 2: Entscheid Auftraggeber 19.10.2026 «12: ja», F-LAYOUT2):
    // Nebenspalte bei x = X0 + 40, Breite 40.
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0 + 40, w: 40 }, 810, 840));
  });

  it('[R-4.6-43] Spalte fehlt am Tag: an der relativen Lage (Mi «KVK Mi–Fr»: c10 → c18), exakt', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i < 2 ? 's7' : 's16',
      display: i === 2 ? 'full' : 'hidden',
    }));
    const L = lb([bs('e1', 1, [win('t1', { time: punkt(810), columnId: 'c10' })], { date: MI })], {
      sets: [setStufen(), setMiFr()],
      tage,
    });
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0 + 40, w: 40 }, 810, 840));
  });

  it('[R-4.6-43] (V-02d-6) Spalte ohne relative Lage oder Rap-Spalte genannt → Beso-Spalte', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: punkt(810), columnId: 'c999' })]),
      bs('e2', 2, [win('t2', { time: punkt(900), columnId: STD.rap })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(0), 810, 840));
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(0), 900, 930));
  });

  it('[R-4.6-49] (V10) Frist ohne Uhrzeit liegt immer in der Beso-Spalte, auch mit Spalte, am Beginn des Zeitbereichs', () => {
    const L = lb([bs('e1', 1, [win('t1', { time: { form: 'deadline' }, columnId: STD.p2 })])]);
    const p = einTeil(L, 'e1');
    expect(p.span).toEqual({ from: 300, to: 330 });
    rechteckNahe(p.rect, feld(bahn(0), 300, 330));
  });
});

describe('Zeit und Text (2c, 2e)', () => {
  it('[R-4.6-45] «bis 1200» im Raster 1130–1200; [R-4.6-46] «ab 1900» 1900–1930', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'until', to: 720 } })]),
      bs('e2', 2, [win('t2', { time: { form: 'from', from: 1140 } })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(0), 690, 720));
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(0), 1140, 1170));
  });

  it('[R-4.6-46] «ab 1900» im Raster beginnt bei 1900 (Oberkante = y(1900))', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'from', from: 1140 }, columnId: STD.p1 })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(STD_X.p1, 1140, 1170));
  });

  it('[R-4.6-49] (V19 h, V-02d-17) Zeitfenster 0430 mit Zuschnitt: Kästchen am Bandende, Text nur die Nummer', () => {
    const L = lb([bs('e1', 1, [win('t1', { time: punkt(270) })], { besoNumber: 13 })]);
    const p = einTeil(L, 'e1');
    rechteckNahe(p.rect, feld(bahn(0), 300, 330));
    expect(p.openTop).toBe(true);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['13']);
  });

  it('[R-4.6-47] drei Zeitfenster in drei Spalten → drei Kästchen 0900, 1300, 1600 je 30 Min, je in ihrer Spalte, alle «13»', () => {
    const L = lb([
      bs(
        'e1',
        1,
        [
          win('t1', { time: range(540, 720), columnId: STD.p1, supplement: 'Zug 1' }),
          win('t2', { time: range(780, 960), columnId: STD.p2, supplement: 'Zug 2' }),
          win('t3', { time: range(960, 1080), columnId: STD.p3, supplement: 'Zug 3' }),
        ],
        { besoNumber: 13 },
      ),
    ]);
    const ps = teile(L, 'e1', 'besoBox');
    expect(ps.map((p) => p.windowId)).toEqual(['t1', 't2', 't3']);
    rechteckNahe(ps[0]?.rect ?? feld(BESO, 0, 0), feld(STD_X.p1, 540, 570));
    rechteckNahe(ps[1]?.rect ?? feld(BESO, 0, 0), feld(STD_X.p2, 780, 810));
    rechteckNahe(ps[2]?.rect ?? feld(BESO, 0, 0), feld(STD_X.p3, 960, 990));
    for (const p of ps) expect(texteIn(L, 'e1', p.rect).map(zeilenText)).toEqual(['13']);
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
  });

  it('[R-4.6-44] Nummer null → «–»; normal ohne numberBold, fett mit numberBold; Grösse besoNumber', () => {
    const plan = rasterPlan({
      entries: [
        bs('e1', 1, [win('t1', { time: punkt(600) })], { besoNumber: null }),
        bs('e2', 2, [win('t2', { time: punkt(900) })], { besoNumber: 17 }),
      ],
    });
    const L = lege(plan);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['–']);
    const t2 = texte(L, 'e2');
    expect(t2.map((t) => [zeilenText(t), t.sizePt])).toEqual([['17', 5]]);
    expect(t2[0]?.runs.map((r) => r.weight)).toEqual(['regular']);
    const fett = lege(plan, {
      template: { ...kp, besoBox: { height: 'fixed30', numberBold: true } },
    });
    expect(texte(fett, 'e2')[0]?.runs.map((r) => r.weight)).toEqual(['bold']);
    expect(texte(L, 'e2')[0]?.role).toBe('besoBox');
  });

  it('[R-4.6-44] (V-02d-12; E1-02l R2) Nummer passt nicht: nie gekürzt, nie weggelassen – vollständig im Träger neben dem Kästchen (labelOutside)', () => {
    // W = 45: Beso-Spalte 10 pt, Bahn 5 pt, Textbreite 3,625 pt < «24» in 4,5 pt (5,0 pt).
    const L = lb([bs('e1', 1, [win('t1', { time: punkt(600) })])], {}, 45);
    // E1-02l R2 (TE-E102l-01): die Nummer steht vollständig im Träger (Teilstück outsideLabel).
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['24']);
    expect(einTeil(L, 'e1', 'outsideLabel').part).toBe(0);
    expect(L.items.some((i) => i.kind === 'text' && i.runs.some((r) => r.text.includes('…')))).toBe(
      false,
    );
    expect(ereignisse(L, 'e1')).toEqual([
      {
        kind: 'labelOutside',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e1',
        piece: 1,
        dropped: [],
      },
    ]);
  });
});

describe('Füllung (2f; R-4.6-48)', () => {
  it('[R-4.6-48] Kästchenfüllung = Legendenfarbe der Kategorie (Extern); unbekannte Kategorie → neutrale Kategorie', () => {
    const legende: LtgCategory[] = kpLegend().map((c) =>
      c.neutral ? { ...c, color: { r: 240, g: 240, b: 240 } } : c,
    );
    const L = lb(
      [
        bs('e1', 1, [win('t1', { time: punkt(600) })], { categoryId: CAT.extern }),
        bs('e2', 2, [win('t2', { time: punkt(900) })], { categoryId: 'k999' }),
      ],
      { over: { legend: legende } },
    );
    expect(rechtecke(L, 'e1').map((r) => r.fill)).toEqual([{ r: 191, g: 191, b: 191 }]);
    expect(rechtecke(L, 'e2').map((r) => r.fill)).toEqual([{ r: 240, g: 240, b: 240 }]);
  });
});

describe('Bahnen und geteilte Breite (2d Nr 4; R-4.6-51 bis -53, R-4.6-55; F-62)', () => {
  it('[R-4.6-52][R-6-04] zwei überlappende in der Beso-Spalte: früheres (Sortierzeit) Bahn 1, späteres Bahn 2, Zeit unverändert', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: punkt(795) })]),
      bs('e2', 2, [win('t2', { time: punkt(780) })]),
    ]);
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(0), 780, 810));
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(1), 795, 825));
  });

  it('[R-4.6-52] Berührung zählt nicht: 1300 und 1330 beide in Bahn 1', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: punkt(780) })]),
      bs('e2', 2, [win('t2', { time: punkt(810) })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(0), 780, 810));
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(0), 810, 840));
  });

  it('[R-4.6-52] (V05) Zusammenstoss nach der gezeichneten Spanne: 0400 (gezeichnet 0500–0530) und 0500 → zwei Bahnen', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: punkt(240) })]),
      bs('e2', 2, [win('t2', { time: punkt(300) })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(0), 300, 330));
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(1), 300, 330));
  });

  it('[R-4.6-53][R-6-04] 3 gleichzeitige → B/3 bei 0, B/3, 2B/3; 4 → B/4; 2 → B/2 (Bahnen)', () => {
    const L = lb([
      bs('a1', 1, [win('ta1', { time: punkt(480) })]),
      bs('a2', 2, [win('ta2', { time: punkt(480) })]),
      bs('a3', 3, [win('ta3', { time: punkt(480) })]),
      bs('b1', 4, [win('tb1', { time: punkt(720) })]),
      bs('b2', 5, [win('tb2', { time: punkt(720) })]),
      bs('b3', 6, [win('tb3', { time: punkt(720) })]),
      bs('b4', 7, [win('tb4', { time: punkt(720) })]),
      bs('c1', 8, [win('tc1', { time: punkt(960) })]),
      bs('c2', 9, [win('tc2', { time: punkt(960) })]),
    ]);
    const B = BESO.w;
    ['a1', 'a2', 'a3'].forEach((id, k) => {
      rechteckNahe(
        einTeil(L, id).rect,
        feld({ x: BESO.x + (k * B) / 3, w: B / 3 }, 480, 510),
        0.01,
        id,
      );
    });
    ['b1', 'b2', 'b3', 'b4'].forEach((id, k) => {
      rechteckNahe(
        einTeil(L, id).rect,
        feld({ x: BESO.x + (k * B) / 4, w: B / 4 }, 720, 750),
        0.01,
        id,
      );
    });
    rechteckNahe(einTeil(L, 'c1').rect, feld(bahn(0), 960, 990));
    rechteckNahe(einTeil(L, 'c2').rect, feld(bahn(1), 960, 990));
  });

  it('[R-4.6-53] Reihenfolge innerhalb gleicher Zeit: Erfassung, dann ID, dann Fensterindex', () => {
    const L = lb([
      bs('e2', 1, [win('t21', { time: punkt(480) })]),
      bs('e1', 1, [win('t11', { time: punkt(480) }), win('t12', { time: punkt(480) })]),
    ]);
    const B = BESO.w;
    rechteckNahe(
      teile(L, 'e1')[0]?.rect ?? feld(BESO, 0, 0),
      feld({ x: BESO.x, w: B / 3 }, 480, 510),
    );
    rechteckNahe(
      teile(L, 'e1')[1]?.rect ?? feld(BESO, 0, 0),
      feld({ x: BESO.x + B / 3, w: B / 3 }, 480, 510),
    );
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: BESO.x + (2 * B) / 3, w: B / 3 }, 480, 510));
  });

  it('[R-4.6-55] zwei gleichzeitige Kästchen in einer Planungsspalte → je halbe Spaltenbreite nebeneinander; eines → ganze Breite', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: punkt(600), columnId: STD.p1 })]),
      bs('e2', 2, [win('t2', { time: punkt(600), columnId: STD.p1 })]),
      bs('e3', 3, [win('t3', { time: punkt(900), columnId: STD.p1 })]),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 20 }, 600, 630));
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: X0 + 20, w: 20 }, 600, 630));
    rechteckNahe(einTeil(L, 'e3').rect, feld(STD_X.p1, 900, 930));
  });

  it('[R-4.6-51][R-6-04] Kästchen liegen auf ihrer wahren Zeit, auch bei Kollisionen und über Blöcken', () => {
    const L = lb([
      block('e9', 9, {
        date: MO,
        columns: { kind: 'ids', ids: [STD.p1] },
        time: { form: 'range', from: 600, to: 660 },
      }),
      bs('e1', 1, [
        win('t1', { time: punkt(600), columnId: STD.p1 }),
        win('t2', { time: punkt(610) }),
      ]),
      bs('e2', 2, [
        win('t3', { time: punkt(605), columnId: STD.p1 }),
        win('t4', { time: punkt(600) }),
      ]),
    ]);
    // Der Block 1000–1100 in p1 bleibt ganz (Kästchen sind keine Ausnahme) und liegt unter den Kästchen.
    rechteckNahe(einTeil(L, 'e9').rect, feld(STD_X.p1, 600, 660));
    const folge = L.items.map((i) => i.entryId);
    expect(folge.lastIndexOf('e9')).toBeLessThan(folge.indexOf('e1'));
    const soll: Record<string, number> = { t1: 600, t2: 610, t3: 605, t4: 600 };
    for (const id of ['e1', 'e2']) {
      for (const p of teile(L, id, 'besoBox')) {
        const t = soll[p.windowId ?? ''] ?? Number.NaN;
        rechteckNahe(
          { x: 0, w: 0, ...rectY(p.rect) },
          { x: 0, w: 0, ...rectY(feld(BESO, t, t + 30)) },
          0.1,
          String(p.windowId),
        );
      }
    }
  });
});

function rectY(r: { readonly y: number; readonly h: number }) {
  return { y: r.y, h: r.h };
}

describe('Spannen um 0000 und 2400 (Notiz test-engineer Runde 1 T2; V-02d-20)', () => {
  it('[R-4.6-45] (V-02d-20) besoBoxSpan «bis 0000» → [−30, 0] (unbegrenzt); Frist bis 0000 ebenso', () => {
    expect(besoBoxSpan({ form: 'until', to: 0 }, kp, 240)).toEqual({ from: -30, to: 0 });
    expect(besoBoxSpan({ form: 'deadline', to: 0 }, kp, 240)).toEqual({ from: -30, to: 0 });
  });

  it('[R-4.6-46] (V-02d-20) besoBoxSpan «ab 2400» → [2400, 2430] (unbegrenzt)', () => {
    expect(besoBoxSpan({ form: 'from', from: 1440 }, kp, 240)).toEqual({ from: 1440, to: 1470 });
  });

  it('[R-4.5-07] (V-02d-20) Beso «bis 0000»: Kästchen [0500, 0530] oben offen, Text nur die Nummer', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'until', to: 0 } })], { besoNumber: 13 }),
    ]);
    const p = einTeil(L, 'e1', 'besoBox');
    expect(p.span).toEqual({ from: -30, to: 0 });
    rechteckNahe(p.rect, feld(bahn(0), 300, 330));
    expect([p.openTop, p.openBottom]).toEqual([true, false]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['13']);
  });

  it('[R-4.5-07] (V-02d-20) Beso fixed30 «ab 2400»: Kästchen [2330, 2400] unten offen, Text nur die Nummer', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'from', from: 1440 } })], { besoNumber: 13 }),
    ]);
    const p = einTeil(L, 'e1', 'besoBox');
    expect(p.span).toEqual({ from: 1440, to: 1470 });
    rechteckNahe(p.rect, feld(bahn(0), 1410, 1440));
    expect([p.openTop, p.openBottom]).toEqual([false, true]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['13']);
  });

  it('[R-4.6-53] (V-02d-20) Beso «ab 2400» und Beso 2330 in der Beso-Spalte: beide [2330, 2400], 2330 in Bahn 0, «ab 2400» in Bahn 1', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'from', from: 1440 } })]),
      bs('e2', 2, [win('t2', { time: punkt(1410) })]),
    ]);
    rechteckNahe(einTeil(L, 'e2').rect, feld(bahn(0), 1410, 1440));
    rechteckNahe(einTeil(L, 'e1').rect, feld(bahn(1), 1410, 1440));
    expect(einTeil(L, 'e1').openBottom).toBe(true);
    expect(einTeil(L, 'e2').openBottom).toBe(false);
  });

  it('[R-4.6-45] (V-02d-20) Beso-Frist «bis 0000» (deadline, to 0): Kästchen [0500, 0530] oben offen, nur die Nummer', () => {
    const L = lb([
      bs('e1', 1, [win('t1', { time: { form: 'deadline', to: 0 } })], { besoNumber: 13 }),
    ]);
    const p = einTeil(L, 'e1', 'besoBox');
    expect(p.span).toEqual({ from: -30, to: 0 });
    rechteckNahe(p.rect, feld(bahn(0), 300, 330));
    expect([p.openTop, p.openBottom]).toEqual([true, false]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['13']);
  });
});

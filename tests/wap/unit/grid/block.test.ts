// @vitest-environment jsdom
// Paket E1-02d: Blöcke – Spalten, Zeitspannen, Zuschnitt auf den Zeitbereich, Mitternacht, offene Kanten
// (Vertrag E1-02d Abschnitt 2b, 2c, 2d Nr 2, 2f; Änderungsnotizen V01, Runde 2 V14, V19; Beschrieb 4.5, 4.6;
// F-04, F-63 b). Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import { parsePathData } from '../../../../src/io/wap-pdf/pathData';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { LineItem, PathItem, Rect } from '../../../../src/model/wap/layout/pageModel';
import type { Block, Entry } from '../../../../src/model/wap/types';
import {
  DI,
  einTeil,
  ereignisse,
  FR,
  feld,
  geo,
  itemsVon,
  LINIEN,
  lege,
  linien,
  MI,
  MO,
  MO2,
  nahe,
  pfade,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  SO,
  STD,
  STD_X,
  type TagSpec,
  teile,
  texte,
  texteIn,
  WOCHE,
  WOCHE2,
  X0,
  yZeit,
  zeilenText,
} from '../../support/grid/build';
import {
  block,
  dayRemark,
  multiDayRemark,
  rt,
  setMiFr,
  setStufen,
  WEEKDAYS,
} from '../../support/model/builders';

function b(id: string, seq: number, over: Partial<Block> = {}): Block {
  return block(id, seq, {
    date: MO,
    columns: { kind: 'ids', ids: [STD.p1] },
    title: rt('Ausb', true),
    ...over,
  });
}
const range = (from: number, to: number) => ({ form: 'range' as const, from, to });

function legeMo(
  entries: readonly Entry[],
  over: Parameters<typeof rasterPlan>[0] = {},
): GridLayout {
  return lege(rasterPlan({ entries, ...over }));
}

/** Zwei sichtbare volle Tage Mo und Di (Standardsatz, je 180 pt). */
const MO_DI: readonly TagSpec[] = WEEKDAYS.map((_, i) => ({
  set: STD.set,
  display: i < 2 ? 'full' : 'hidden',
}));

describe('Spanne je Zeitform (2c)', () => {
  it('[R-4.5-02] Block 0800-1000 in einer Spalte: Fläche, Spanne, Rahmen, Füllung, Rolle', () => {
    const L = legeMo([b('e1', 1, { time: range(480, 600) })]);
    const p = einTeil(L, 'e1', 'block');
    rechteckNahe(p.rect, feld(STD_X.p1, 480, 600));
    expect(p.span).toEqual({ from: 480, to: 600 });
    expect(p.date).toBe(MO);
    expect(p.part).toBe(0);
    expect(p.windowId).toBeNull();
    expect(p.textCarrier).toBe(true);
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([false, false, 'none']);
    const r = rechtecke(L, 'e1');
    expect(r).toHaveLength(1);
    expect(r[0]?.role).toBe('block');
    expect(r[0]?.fill).toEqual({ r: 255, g: 255, b: 153 });
    expect(r[0]?.stroke).toEqual(LINIEN.blockBorder);
    rechteckNahe(r[0]?.rect ?? p.rect, p.rect);
    expect(pfade(L, 'e1')).toEqual([]);
  });

  it('[R-4.5-02] Zeitpunkt 0700 → 0700–0730, «ab 1900» → 1900–1930, «bis 1200» → 1130–1200 (F-04)', () => {
    const L = legeMo([
      b('e1', 1, { time: { form: 'point', at: 420 } }),
      b('e2', 2, { time: { form: 'from', from: 1140 } }),
      b('e3', 3, { time: { form: 'until', to: 720 } }),
    ]);
    expect(einTeil(L, 'e1').span).toEqual({ from: 420, to: 450 });
    expect(einTeil(L, 'e2').span).toEqual({ from: 1140, to: 1170 });
    expect(einTeil(L, 'e3').span).toEqual({ from: 690, to: 720 });
    rechteckNahe(einTeil(L, 'e1').rect, feld(STD_X.p1, 420, 450));
    rechteckNahe(einTeil(L, 'e2').rect, feld(STD_X.p1, 1140, 1170));
    rechteckNahe(einTeil(L, 'e3').rect, feld(STD_X.p1, 690, 720));
  });
});

describe('Zuschnitt auf den Zeitbereich (2c; F-63 b; V-02d-5)', () => {
  it('[R-4.5-07] (V-02d-5, V-02d-17) Block 0430-0600: ab y(0500) gezeichnet, oben offen; erste Zeile «0430-0600», dann der Titel', () => {
    const L = legeMo([b('e1', 1, { time: range(270, 360), title: rt('Tagwache', true) })]);
    const p = einTeil(L, 'e1');
    rechteckNahe(p.rect, feld(STD_X.p1, 300, 360));
    expect(p.span).toEqual({ from: 270, to: 360 });
    expect([p.openTop, p.openBottom]).toEqual([true, false]);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['0430-0600', 'Tagwache']);
    // Zeitzeile normal in Grösse S, Titel fett in Grösse T; beide passen in Standardgrösse (5 / 5,5).
    expect(z[0]?.runs.every((r) => r.weight === 'regular')).toBe(true);
    expect(z[1]?.runs.every((r) => r.weight === 'bold')).toBe(true);
    expect(z.map((t) => t.sizePt)).toEqual([5, 5.5]);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.5-07] (V19 e) Block 0600-0800 ganz im Zeitbereich: keine Zeitzeile, Kanten geschlossen', () => {
    const L = legeMo([b('e1', 1, { time: range(360, 480), title: rt('Morgenturnen') })]);
    const p = einTeil(L, 'e1');
    expect([p.openTop, p.openBottom]).toEqual([false, false]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Morgenturnen']);
  });

  it('[R-4.5-07] (V-02d-5) ganz vor dem Bandende: am Rand des Zeitbereichs, höchstens 30 Min hoch, oben offen', () => {
    const L = legeMo([
      b('e1', 1, { time: range(240, 270) }),
      b('e2', 2, { time: range(250, 260), columns: { kind: 'ids', ids: [STD.p2] } }),
      b('e3', 3, { time: { form: 'point', at: 270 }, columns: { kind: 'ids', ids: [STD.p3] } }),
      b('e4', 4, { time: range(200, 300), columns: { kind: 'ids', ids: [STD.p3] } }),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld(STD_X.p1, 300, 330));
    rechteckNahe(einTeil(L, 'e2').rect, feld(STD_X.p2, 300, 310));
    expect(einTeil(L, 'e1').openTop).toBe(true);
    expect(einTeil(L, 'e2').openTop).toBe(true);
    expect(einTeil(L, 'e3').span).toEqual({ from: 270, to: 300 });
    expect(einTeil(L, 'e3').openTop).toBe(true);
    expect(einTeil(L, 'e1').openBottom).toBe(false);
    // e4 endet genau am Bandende (b = V0): ebenfalls an den Rand, 30 Min (d = min(100, 30)).
    expect(teile(L, 'e4').every((p) => p.openTop)).toBe(true);
  });

  it('[R-4.5-07] (V19 a, V-02d-17) Anzeigebereich 0400–2200, Block 2100-2300: bis y(2200), unten offen, erste Zeile «2100-2300»', () => {
    const L = legeMo([b('e1', 1, { time: range(1260, 1380), title: rt('Nachtmarsch') })], {
      range: { from: 240, to: 1320 },
    });
    const p = einTeil(L, 'e1');
    rechteckNahe(p.rect, feld(STD_X.p1, 1260, 1320));
    expect([p.openTop, p.openBottom]).toEqual([false, true]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['2100-2300', 'Nachtmarsch']);
  });

  it('[R-4.5-07] (V-02d-5) ganz nach dem Anzeigeende (Bereich bis 2200): [V1 − d, V1], unten offen', () => {
    const L = legeMo(
      [
        b('e1', 1, { time: range(1350, 1380) }),
        b('e2', 2, { time: { form: 'from', from: 1320 }, columns: { kind: 'ids', ids: [STD.p2] } }),
        b('e3', 3, { time: range(1400, 1410), columns: { kind: 'ids', ids: [STD.p3] } }),
      ],
      { range: { from: 240, to: 1320 } },
    );
    rechteckNahe(einTeil(L, 'e1').rect, feld(STD_X.p1, 1290, 1320));
    rechteckNahe(einTeil(L, 'e2').rect, feld(STD_X.p2, 1290, 1320));
    rechteckNahe(einTeil(L, 'e3').rect, feld(STD_X.p3, 1310, 1320));
    for (const id of ['e1', 'e2', 'e3']) {
      expect([einTeil(L, id).openTop, einTeil(L, id).openBottom], id).toEqual([false, true]);
    }
  });

  it('[R-4.5-07] (V-02d-5) Teilstück mit offener Kante: Fläche ohne Rahmen, dann Rahmen der übrigen Kanten als Pfad', () => {
    const L = legeMo([b('e1', 1, { time: range(270, 360) })]);
    const r = feld(STD_X.p1, 300, 360);
    const items = itemsVon(L, 'e1');
    const rect = rechtecke(L, 'e1');
    expect(rect).toHaveLength(1);
    expect(rect[0]?.stroke).toBeNull();
    expect(rect[0]?.fill).toEqual({ r: 255, g: 255, b: 153 });
    const pf = pfade(L, 'e1');
    expect(pf).toHaveLength(1);
    const pfad = pf[0] as PathItem;
    expect(pfad.fill).toBeNull();
    expect(pfad.stroke).toEqual(LINIEN.blockBorder);
    expect(pfad.role).toBe('block');
    expect(strecken(pfad.d)).toEqual(kanten(r, ['links', 'unten', 'rechts']).sort());
    // Fläche und Rahmen vor dem Text (2f).
    const iRect = items.indexOf(rect[0] as never);
    const iPfad = items.indexOf(pfad);
    const iText = items.findIndex((i) => i.kind === 'text');
    expect(iRect).toBeLessThan(iPfad);
    expect(iPfad).toBeLessThan(iText);
  });

  it('[R-4.5-07] (V-02d-5) beide Kanten offen (Bereich 0500–2300, Block 0300-2400): Fläche ohne Rahmen und zwei Linien links, rechts', () => {
    const L = legeMo([b('e1', 1, { time: range(180, 1440) })], { range: { from: 300, to: 1380 } });
    const p = einTeil(L, 'e1');
    rechteckNahe(p.rect, feld(STD_X.p1, 360, 1380, 300));
    expect([p.openTop, p.openBottom]).toEqual([true, true]);
    expect(rechtecke(L, 'e1')[0]?.stroke).toBeNull();
    expect(pfade(L, 'e1')).toEqual([]);
    const li = linien(L, 'e1');
    expect(li).toHaveLength(2);
    for (const l of li) expect(l.stroke).toEqual(LINIEN.blockBorder);
    expect(li.map(linienStrecke).sort()).toEqual(kanten(p.rect, ['links', 'rechts']).sort());
  });
});

describe('Mitternacht (2c; R-4.5-10; V-02d-10)', () => {
  it('[R-4.5-10] (V-02d-10) Block Mo 2200-0200: ein Eintrag, Teil Mo [1320, 1440] toNextDay, Teil Di [0, 120] fromPreviousDay', () => {
    const L = lege(
      rasterPlan({ tage: MO_DI, entries: [b('e1', 1, { time: range(1320, 1560) })] }),
      { W: 360 },
    );
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = teile(L, 'e1', 'block');
    expect(ps).toHaveLength(2);
    const [mo, di] = ps;
    expect(mo?.date).toBe(MO);
    expect(mo?.span).toEqual({ from: 1320, to: 1440 });
    expect(mo?.continuation).toBe('toNextDay');
    expect([mo?.openTop, mo?.openBottom]).toEqual([false, true]);
    rechteckNahe(mo?.rect ?? leer(), feld(STD_X.p1, 1320, 1440));
    expect(di?.date).toBe(DI);
    expect(di?.span).toEqual({ from: 0, to: 120 });
    expect(di?.continuation).toBe('fromPreviousDay');
    expect(di?.openTop).toBe(true);
    // Teil Di liegt vor dem Bandende: an den Rand des Zeitbereichs (2c), Spalte p1 des Di.
    rechteckNahe(di?.rect ?? leer(), feld({ x: X0 + 180, w: 40 }, 300, 330));
  });

  it('[R-4.5-10] (V19 g) Block Mo 2200-0600: Teil Di (Zuschnitt [0500, 0600]) beginnt mit «2200-0600», Teil Mo ohne Zeitzeile', () => {
    const L = lege(
      rasterPlan({
        tage: MO_DI,
        entries: [b('e1', 1, { time: range(1320, 1800), title: rt('Nachtübung') })],
      }),
      { W: 360 },
    );
    const [mo, di] = teile(L, 'e1', 'block');
    expect(di?.span).toEqual({ from: 0, to: 360 });
    rechteckNahe(di?.rect ?? leer(), feld({ x: X0 + 180, w: 40 }, 300, 360));
    expect(di?.openTop).toBe(true);
    const textMo = texte(L, 'e1').filter((t) => t.frame.x < X0 + 180);
    const textDi = texte(L, 'e1').filter((t) => t.frame.x >= X0 + 180);
    expect(textMo.map(zeilenText)).toEqual(['Nachtübung']);
    expect(textDi.map(zeilenText)).toEqual(['2200-0600', 'Nachtübung']);
    expect(mo?.continuation).toBe('toNextDay');
  });

  it('[R-4.5-10] (V-02d-10) So 2200-0200: Teil So im Layout der Woche, Teil Mo im Layout der Folgewoche', () => {
    const tage: TagSpec[] = WEEKDAYS.map(() => ({ set: STD.set, display: 'full' }));
    const plan = rasterPlan({
      tage,
      entries: [b('e1', 1, { date: SO, time: range(1320, 1560) })],
    });
    const L1 = lege(plan, { W: 7 * 180 });
    const L2 = lege(plan, { W: 7 * 180, weekId: WOCHE2 });
    expect(teile(L1, 'e1').map((p) => [p.date, p.continuation])).toEqual([[SO, 'toNextDay']]);
    expect(teile(L2, 'e1').map((p) => [p.date, p.continuation])).toEqual([
      [MO2, 'fromPreviousDay'],
    ]);
    expect(teile(L2, 'e1')[0]?.span).toEqual({ from: 0, to: 120 });
  });

  it('[R-4.5-10] (V-02d-20) nur erfasste Zeiten von–bis werden geteilt: «ab 2350», Zeitpunkt 2350 und 2300-2400 bleiben am Tag', () => {
    const L = lege(
      rasterPlan({
        tage: MO_DI,
        entries: [
          b('e1', 1, { time: { form: 'from', from: 1430 } }),
          b('e2', 2, {
            time: { form: 'point', at: 1430 },
            columns: { kind: 'ids', ids: [STD.p2] },
          }),
          b('e3', 3, { time: range(1380, 1440), columns: { kind: 'ids', ids: [STD.p3] } }),
        ],
      }),
      { W: 360 },
    );
    for (const id of ['e1', 'e2']) {
      const p = einTeil(L, id);
      expect(p.date, id).toBe(MO);
      expect(p.continuation, id).toBe('none');
      // R2-1: unbegrenzte Spanne [1430, 1460], zugeschnitten auf [2350, 2400], unten offen.
      expect(p.span, id).toEqual({ from: 1430, to: 1460 });
      nahe(p.rect.y + p.rect.h, yZeit(1440), 0.01, `${id} Unterkante`);
      nahe(p.rect.h, 10 * 0.3, 0.01, `${id} Höhe`);
      expect([p.openTop, p.openBottom], id).toEqual([false, true]);
      // 3 pt hoch: nutzbar 1,52 pt, nicht einmal die Zeitzeile passt.
      expect(texte(L, id), id).toEqual([]);
      expect(
        ereignisse(L, id).map((e) => e.kind),
        id,
      ).toEqual(['textOmitted']);
    }
    expect(einTeil(L, 'e3').continuation).toBe('none');
    expect(einTeil(L, 'e3').openBottom).toBe(false);
    expect(einTeil(L, 'e3').span).toEqual({ from: 1380, to: 1440 });
  });

  it('[R-4.5-07] (V-02d-20, V-02d-17) «ab 2350» und Zeitpunkt 2350 bei 0,7 pt/Min: erste (einzige) Zeile «ab 2350» bzw. «2350», ellipsis', () => {
    const L = lege(
      rasterPlan({
        entries: [
          b('e1', 1, { time: { form: 'from', from: 1430 } }),
          b('e2', 2, {
            time: { form: 'point', at: 1430 },
            columns: { kind: 'ids', ids: [STD.p2] },
          }),
        ],
      }),
      { ppm: 0.7 },
    );
    // 7 pt hoch, nutzbar 5,52 pt: eine Zeile in 4,5 pt (5,17 pt), die Zeitzeile bleibt, der Titel entfällt (V16 a).
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['ab 2350']);
    expect(texte(L, 'e2').map(zeilenText)).toEqual(['2350']);
    expect(einTeil(L, 'e1').openBottom).toBe(true);
    for (const id of ['e1', 'e2']) {
      expect(
        ereignisse(L, id).map((e) => [e.kind, e.dropped]),
        id,
      ).toEqual([['ellipsis', []]]);
    }
  });
});

describe('Spalten eines Blocks (2b)', () => {
  it('[R-7-07] «alle Spalten» = alle Planungsspalten des Tages, nicht Rap- und Beso-Spalte', () => {
    const L = legeMo([b('e1', 1, { columns: { kind: 'all' }, time: range(480, 600) })]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 120 }, 480, 600));
  });

  it('[R-7-07] Spalte fehlt am Tag: Block an der relativen Lage (Mi «KVK Mi–Fr»: c10 → c18), exakt', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i < 2 ? 's7' : 's16',
      display: i === 2 ? 'full' : 'hidden',
    }));
    const L = lege(
      rasterPlan({
        sets: [setStufen(), setMiFr()],
        tage,
        entries: [
          b('e1', 1, { date: MI, columns: { kind: 'ids', ids: ['c10'] }, time: range(480, 600) }),
        ],
      }),
      { W: 180 },
    );
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0 + 40, w: 40 }, 480, 600));
  });

  it('[R-7-07] keine Spalte auffindbar, obwohl IDs genannt: über alle Planungsspalten (O-1, Q-027)', () => {
    const L = legeMo([
      b('e1', 1, { columns: { kind: 'ids', ids: ['c999'] }, time: range(480, 600) }),
    ]);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 120 }, 480, 600));
  });

  it('[R-7-07] leere Auswahl oder Tag ohne Spaltensatz: keine Fläche, der Eintrag steht trotzdem in entries', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i === 0 ? STD.set : null,
      display: i < 2 ? 'full' : 'hidden',
    }));
    const L = lege(
      rasterPlan({
        tage,
        entries: [b('e1', 1, { columns: { kind: 'ids', ids: [] } }), b('e2', 2, { date: DI })],
      }),
      { W: 360 },
    );
    expect(geo(L, 'e1').pieces).toEqual([]);
    expect(geo(L, 'e2').pieces).toEqual([]);
    expect(itemsVon(L, 'e1')).toEqual([]);
    expect(itemsVon(L, 'e2')).toEqual([]);
    expect(L.fallbacks).toEqual([]);
  });

  it('[R-7-07] Ganztägige und Mehrtägige Bemerkungen gehören nicht zum Raster', () => {
    const L = legeMo([
      dayRemark('e1', 1, { date: MO }),
      multiDayRemark('e2', 2, { scope: { kind: 'plan' } }),
      b('e3', 3),
    ]);
    expect(L.entries.map((e) => e.entryId)).toEqual(['e3']);
  });
});

function leer(): Rect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

type Kante = 'links' | 'rechts' | 'oben' | 'unten';

/** Kanten eines Rechtecks als normierte Strecken «x1,y1-x2,y2» (2 Nachkommastellen, Endpunkte sortiert). */
function kanten(r: Rect, welche: readonly Kante[]): string[] {
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  const k: Record<Kante, [number, number, number, number]> = {
    links: [r.x, r.y, r.x, y2],
    rechts: [x2, r.y, x2, y2],
    oben: [r.x, r.y, x2, r.y],
    unten: [r.x, y2, x2, y2],
  };
  return welche.map((w) => norm(...k[w]));
}

function norm(x1: number, y1: number, x2: number, y2: number): string {
  const a = `${x1.toFixed(2)},${y1.toFixed(2)}`;
  const c = `${x2.toFixed(2)},${y2.toFixed(2)}`;
  return a < c ? `${a}-${c}` : `${c}-${a}`;
}

function linienStrecke(l: LineItem): string {
  return norm(l.x1, l.y1, l.x2, l.y2);
}

/**
 * Strecken eines offenen Rahmens: Grammatik E1-02c V06 (`parsePathData`), nur M und L (kein Z, das die offene
 * Kante schliessen würde), Zahlen ohne Exponent mit höchstens 4 Nachkommastellen (Vertrag 2f).
 */
function strecken(d: string): string[] {
  const segmente = parsePathData(d);
  expect(segmente, `Pfad «${d}» nach Grammatik V06`).not.toBeNull();
  for (const z of d.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []) {
    expect(z, `Zahl in «${d}»`).toMatch(/^-?(\d+(\.\d{1,4})?|\.\d{1,4})$/);
  }
  const out: string[] = [];
  let x = 0;
  let y = 0;
  for (const s of segmente ?? []) {
    expect(['M', 'L'], `Befehl ${s.cmd} in «${d}»`).toContain(s.cmd);
    const [nx = 0, ny = 0] = s.values;
    if (s.cmd === 'L') out.push(norm(x, y, nx, ny));
    x = nx;
    y = ny;
  }
  return out.sort();
}

describe('Spannen um 0000 und 2400 (Notiz test-engineer Runde 1 T2; V-02d-20)', () => {
  it('[R-4.5-07] (V-02d-20) Block «bis 0000»: unbegrenzte Spanne [−30, 0], am Bandende gezeichnet, oben offen, erste Zeile «bis 0000»', () => {
    const L = legeMo([b('e1', 1, { time: { form: 'until', to: 0 }, title: rt('Ausb', true) })]);
    const p = einTeil(L, 'e1', 'block');
    expect(p.span).toEqual({ from: -30, to: 0 });
    rechteckNahe(p.rect, feld(STD_X.p1, 300, 330));
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([true, false, 'none']);
    expect(p.date).toBe(MO);
    expect(texte(L, 'e1').map(zeilenText)[0]).toBe('bis 0000');
  });

  it('[R-4.5-07] (V-02d-20) Block Zeitpunkt 2400 und «ab 2400»: [2330, 2400], unten offen, erste Zeile «2400» bzw. «ab 2400»', () => {
    const L = legeMo([
      b('e1', 1, { time: { form: 'point', at: 1440 } }),
      b('e2', 2, { time: { form: 'from', from: 1440 }, columns: { kind: 'ids', ids: [STD.p2] } }),
    ]);
    const p1 = einTeil(L, 'e1', 'block');
    expect(p1.span).toEqual({ from: 1440, to: 1470 });
    rechteckNahe(p1.rect, feld(STD_X.p1, 1410, 1440));
    expect([p1.openTop, p1.openBottom, p1.continuation]).toEqual([false, true, 'none']);
    expect(texte(L, 'e1').map(zeilenText)[0]).toBe('2400');
    const p2 = einTeil(L, 'e2', 'block');
    rechteckNahe(p2.rect, feld(STD_X.p2, 1410, 1440));
    expect(p2.openBottom).toBe(true);
    expect(texte(L, 'e2').map(zeilenText)[0]).toBe('ab 2400');
  });

  /** Teil eines Blocks 2400-… : genau eine Zeile in 4,5 pt und genau ein ellipsis dieses Teils (R3-1). */
  function einTeilMitZeitzeile(
    L: GridLayout,
    id: string,
    datum: string,
    zeit: string,
    woche: string = WOCHE,
  ): void {
    const g = geo(L, id);
    const p = g.pieces.find((x) => x.date === datum);
    expect(p, `Teil am ${datum}`).toBeDefined();
    if (p === undefined) return;
    const z = texteIn(L, id, p.rect);
    expect(z.map((t) => [zeilenText(t), t.sizePt])).toEqual([[zeit, 4.5]]);
    const ev = ereignisse(L, id).filter((e) => e.date === datum);
    expect(ev).toEqual([
      {
        kind: 'ellipsis',
        region: 'block',
        weekId: woche,
        date: datum,
        entryId: id,
        piece: g.pieces.indexOf(p),
        dropped: [],
      },
    ]);
  }

  it('[R-4.5-10] (V-02d-20) Block Mo 2400-0100: Teil Mo [2330, 2400] unten offen toNextDay span [1440, 1440]; Teil Di [0, 60] am Bandende; je «2400-0100» und ein ellipsis', () => {
    const L = lege(
      rasterPlan({
        tage: MO_DI,
        entries: [b('e1', 1, { time: range(1440, 1500), title: rt('Nacht') })],
      }),
      { W: 360 },
    );
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const ps = teile(L, 'e1');
    expect(ps.map((p) => p.date)).toEqual([MO, DI]);
    const [mo, di] = ps;
    expect(mo?.span).toEqual({ from: 1440, to: 1440 });
    expect(mo?.continuation).toBe('toNextDay');
    expect([mo?.openTop, mo?.openBottom]).toEqual([false, true]);
    rechteckNahe(mo?.rect ?? leer(), feld(STD_X.p1, 1410, 1440));
    expect(di?.span).toEqual({ from: 0, to: 60 });
    expect(di?.continuation).toBe('fromPreviousDay');
    expect(di?.openTop).toBe(true);
    rechteckNahe(di?.rect ?? leer(), feld({ x: X0 + 180, w: 40 }, 300, 330));
    einTeilMitZeitzeile(L, 'e1', MO, '2400-0100');
    einTeilMitZeitzeile(L, 'e1', DI, '2400-0100');
    expect(ereignisse(L, 'e1')).toHaveLength(2);
  });

  it('[R-4.5-10] (V-02d-20) Block Fr 2400-0300, Sa ausgeblendet: Teil Fr wie Mo, kein Teilstück am Sa', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i === 4 ? 'full' : 'hidden',
    }));
    const L = lege(
      rasterPlan({ tage, entries: [b('e1', 1, { date: FR, time: range(1440, 1620) })] }),
      { W: 180 },
    );
    const ps = teile(L, 'e1');
    expect(ps.map((p) => [p.date, p.continuation, p.span])).toEqual([
      [FR, 'toNextDay', { from: 1440, to: 1440 }],
    ]);
    rechteckNahe(ps[0]?.rect ?? leer(), feld(STD_X.p1, 1410, 1440));
    expect(ps[0]?.openBottom).toBe(true);
    einTeilMitZeitzeile(L, 'e1', FR, '2400-0300');
    expect(ereignisse(L, 'e1')).toHaveLength(1);
  });

  it('[R-4.5-10] (V-02d-20) Block So 2400-0100 der letzten Woche: Teil So wie Mo, ein ellipsis', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i === 6 ? 'full' : 'hidden',
    }));
    const SO2 = '2026-10-11';
    const L = lege(
      rasterPlan({ tage, entries: [b('e1', 1, { date: SO2, time: range(1440, 1500) })] }),
      { W: 180, weekId: WOCHE2 },
    );
    const ps = teile(L, 'e1');
    expect(ps.map((p) => [p.date, p.continuation, p.span])).toEqual([
      [SO2, 'toNextDay', { from: 1440, to: 1440 }],
    ]);
    rechteckNahe(ps[0]?.rect ?? leer(), feld(STD_X.p1, 1410, 1440));
    einTeilMitZeitzeile(L, 'e1', SO2, '2400-0100', WOCHE2);
    expect(ereignisse(L, 'e1')).toHaveLength(1);
  });

  it('[R-4.5-07] (V-02d-20) Block «bis 0015»: span [−15, 15], gezeichnet [0500, 0530], oben offen', () => {
    const L = legeMo([b('e1', 1, { time: { form: 'until', to: 15 } })]);
    const p = einTeil(L, 'e1');
    expect(p.span).toEqual({ from: -15, to: 15 });
    rechteckNahe(p.rect, feld(STD_X.p1, 300, 330));
    expect([p.openTop, p.openBottom]).toEqual([true, false]);
    expect(texte(L, 'e1').map(zeilenText)[0]).toBe('bis 0015');
  });
});

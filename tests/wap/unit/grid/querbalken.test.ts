// @vitest-environment jsdom
// Paket E1-02d: Querbalken im Band (Vertrag E1-02d Abschnitt 2d Nr 1, 2e «Weitere Texte», 2f; Änderungsnotizen
// V04, V11, Runde 2 V17; Beschrieb 4.5, 4.6 «Querbalken»; B-F-06, F-63 c/d). Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry, LtgCategory, Querbalken } from '../../../../src/model/wap/types';
import {
  alleTage,
  DI,
  DO,
  einTeil,
  ereignisse,
  FR,
  geo,
  LINIEN,
  lege,
  MI,
  MO,
  MO2,
  nahe,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  SO,
  STD,
  type TagSpec,
  tag,
  teile,
  texte,
  textflaeche,
  WOCHE,
  WOCHE2,
  X0,
  yZeit,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import {
  CAT,
  kpLegend,
  querbalken,
  rt,
  setMiFr,
  setStufen,
  WEEKDAYS,
} from '../../support/model/builders';

/** Alle sieben Tage voll mit dem Standardsatz, je 180 pt breit (Mo bei x = 30). */
const W7 = 7 * 180;
const tagX = (i: number) => X0 + 180 * i;
const LAGE0 = { y: yZeit(270), h: 9 };
const LAGE1 = { y: yZeit(240), h: 9 };

function q(id: string, seq: number, von: string, bis: string, over: Partial<Querbalken> = {}) {
  return querbalken(id, seq, { fromDate: von, toDate: bis, title: rt(`Balken ${id}`), ...over });
}

function legeWoche(
  entries: readonly Entry[],
  over: Parameters<typeof rasterPlan>[0] = {},
): GridLayout {
  return lege(rasterPlan({ tage: alleTage(), entries, ...over }), { W: W7 });
}

describe('Fläche (2d Nr 1)', () => {
  it('[R-4.6-05] (V-02d-1, V-02d-14) «alle Spalten» Mo–Mi: ein Teilstück über die ganze Breite der drei Tage, Lage 0', () => {
    const L = legeWoche([q('e1', 1, MO, MI, { title: rt('Messe') })]);
    const p = einTeil(L, 'e1', 'querbalken');
    rechteckNahe(p.rect, { x: tagX(0), w: 3 * 180, ...LAGE0 });
    expect(p.date).toBe(MO);
    expect(p.span).toBeNull();
    expect(p.part).toBe(0);
    expect(p.windowId).toBeNull();
    expect(p.textCarrier).toBe(true);
    expect(p.textOrientation).toBe('horizontal');
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([false, false, 'none']);
    expect(geo(L, 'e1').type).toBe('querbalken');
  });

  it('[R-4.6-05] Rahmen, Füllung und Rolle: querbalkenBorder, Kategorie-Farbe, role querbalken', () => {
    const L = legeWoche([q('e1', 1, MO, MO, { categoryId: CAT.extern })]);
    const r = rechtecke(L, 'e1');
    expect(r).toHaveLength(1);
    expect(r[0]?.role).toBe('querbalken');
    expect(r[0]?.fill).toEqual({ r: 191, g: 191, b: 191 });
    expect(r[0]?.stroke).toEqual(LINIEN.querbalkenBorder);
    expect(L.items.filter((i) => i.entryId === 'e1').every((i) => i.role === 'querbalken')).toBe(
      true,
    );
  });

  it('[R-4.6-05] Text eine Zeile, Standardgrösse, waagrecht und senkrecht zentriert in der Textfläche', () => {
    const L = legeWoche([q('e1', 1, MO, MO, { title: rt('Messe') })]);
    const t = texte(L, 'e1');
    expect(t).toHaveLength(1);
    const z = t[0];
    if (z === undefined) return;
    expect(zeilenText(z)).toBe('Messe');
    expect(z.sizePt).toBe(5);
    expect(z.rotation).toBe(0);
    const f = textflaeche({ x: tagX(0), w: 180, ...LAGE0 }, 0.375);
    rechteckNahe(z.frame, f);
    const breite = measureRuns([{ text: 'Messe', weight: 'regular' }], 5);
    nahe(z.x, f.x + (f.w - breite) / 2);
    nahe(z.baselineY, f.y + (f.h - lineHeightPt(5)) / 2 + ascentPt(5));
    expect(z.runs.every((r) => r.strike === false)).toBe(true);
    zeileImRahmen(z);
  });

  it('[R-4.6-05] über die Wochengrenze: auf jeder Seite mit vollem Titel, ab dem ersten sichtbaren Tag', () => {
    const e = q('e1', 1, '2026-09-24', '2026-10-08', { title: rt('Wachtdienst Stao') });
    const plan = rasterPlan({ tage: alleTage(), entries: [e] });
    const L1 = lege(plan, { W: W7 });
    const p1 = einTeil(L1, 'e1', 'querbalken');
    rechteckNahe(p1.rect, { x: tagX(0), w: W7, ...LAGE0 });
    expect(p1.date).toBe(MO);
    const L2 = lege(plan, { W: W7, weekId: WOCHE2 });
    const p2 = einTeil(L2, 'e1', 'querbalken');
    rechteckNahe(p2.rect, { x: tagX(0), w: 4 * 180, ...LAGE0 });
    expect(p2.date).toBe(MO2);
    expect(texte(L1, 'e1').map(zeilenText)).toEqual(['Wachtdienst Stao']);
    expect(texte(L2, 'e1').map(zeilenText)).toEqual(['Wachtdienst Stao']);
  });

  it('[R-4.6-05] eine Spalte Mo–Di: je Tag ein Teilstück nur über dieser Spalte; Text im linken (gleich gross)', () => {
    const L = legeWoche([q('e1', 1, MO, DI, { columns: { kind: 'ids', ids: [STD.p2] } })]);
    const ps = teile(L, 'e1', 'querbalken');
    expect(ps).toHaveLength(2);
    rechteckNahe(ps[0]?.rect ?? LAGE0Rect(), { x: tagX(0) + 40, w: 40, ...LAGE0 });
    rechteckNahe(ps[1]?.rect ?? LAGE0Rect(), { x: tagX(1) + 40, w: 40, ...LAGE0 });
    expect(ps.map((p) => [p.date, p.part, p.textCarrier])).toEqual([
      [MO, 0, true],
      [DI, 1, false],
    ]);
    expect(ps[1]?.textOrientation).toBeNull();
    expect(texte(L, 'e1')).toHaveLength(1);
  });

  it('[R-4.6-05] nicht benachbarte Spalten über zwei Tage: part zählt die Läufe über die Woche von links', () => {
    const L = legeWoche([q('e1', 1, MO, DI, { columns: { kind: 'ids', ids: [STD.p1, STD.p3] } })]);
    const ps = teile(L, 'e1', 'querbalken');
    expect(ps.map((p) => [p.date, p.part])).toEqual([
      [MO, 0],
      [MO, 1],
      [DI, 2],
      [DI, 3],
    ]);
    nahe(ps[1]?.rect.x ?? 0, tagX(0) + 80);
    nahe(ps[3]?.rect.x ?? 0, tagX(1) + 80);
    expect(ps.filter((p) => p.textCarrier).map((p) => p.part)).toEqual([0]);
  });

  it('[R-4.6-05] fehlende Spalte an einem Tag: an der relativen Lage (E1-03 relativeColumns), exakt', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i < 2 ? 's7' : 's16',
      display: i < 3 ? 'full' : 'hidden',
    }));
    const plan = rasterPlan({
      sets: [setStufen(), setMiFr()],
      tage,
      entries: [q('e1', 1, MO, MI, { columns: { kind: 'ids', ids: ['c10'] } })],
    });
    const L = lege(plan, { W: 540 });
    const ps = teile(L, 'e1', 'querbalken');
    expect(ps.map((p) => p.date)).toEqual([MO, DI, MI]);
    // Mo/Di «KVK Stufen» (15 Einheiten zu 12 pt): c10 ist die dritte Planungsspalte.
    rechteckNahe(ps[0]?.rect ?? LAGE0Rect(), { x: X0 + 48, w: 24, ...LAGE0 });
    // Mi «KVK Mi–Fr» (9 Einheiten zu 20 pt): relative Lage der Mitte von c10 → c18 (zweite Spalte).
    rechteckNahe(ps[2]?.rect ?? LAGE0Rect(), { x: X0 + 360 + 40, w: 40, ...LAGE0 });
    expect(tag(L, MI).columns[1]?.columnId).toBe('c18');
  });

  it('[R-4.6-05] (V11) einzeiliger Titel: jeder Zeilenumbruch (LF, CR LF, CR) wird zu einem Leerzeichen', () => {
    const L = legeWoche([
      q('e1', 1, MO, MO, { title: rt('A\nB') }),
      q('e2', 2, DI, DI, { title: rt('A\r\nB') }),
      q('e3', 3, MI, MI, {
        title: [
          { text: 'A\r', bold: true },
          { text: 'B', bold: false },
        ],
      }),
    ]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['A B']);
    expect(texte(L, 'e2').map(zeilenText)).toEqual(['A B']);
    expect(texte(L, 'e3').map(zeilenText)).toEqual(['A B']);
    for (const id of ['e1', 'e2', 'e3']) expect(ereignisse(L, id)).toEqual([]);
  });

  it('[R-10-41] Querbalken-Titel zu lang für die Spalte: eine Zeile mit «…» in Mindestgrösse, Ereignis ellipsis', () => {
    const titel = 'Wachtdienst Standort durch Nachbarkompanie';
    const L = legeWoche([
      q('e1', 1, MO, MO, { title: rt(titel), columns: { kind: 'ids', ids: [STD.p1] } }),
    ]);
    const t = texte(L, 'e1');
    expect(t).toHaveLength(1);
    const z = t[0];
    if (z === undefined) return;
    const text = zeilenText(z);
    expect(text.endsWith('…')).toBe(true);
    expect(titel.startsWith(text.slice(0, -1))).toBe(true);
    expect(z.sizePt).toBe(4.5);
    zeileImRahmen(z);
    expect(ereignisse(L, 'e1')).toEqual([
      {
        kind: 'ellipsis',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e1',
        piece: 0,
        dropped: [],
      },
    ]);
  });
});

function LAGE0Rect() {
  return { x: 0, y: 0, w: 0, h: 0 };
}

describe('Schriftfarbe (2e «Farbe»)', () => {
  it('[R-4.6-09] dunkle Füllung → weisse Schrift, gelbe Füllung (Ltg Kp) → schwarze Schrift', () => {
    const dunkel: LtgCategory = {
      id: 'k9',
      name: 'Dunkel',
      legendLabel: 'Dunkel',
      color: { r: 0, g: 0, b: 128 },
      neutral: false,
      inLegend: true,
    };
    const L = legeWoche(
      [q('e1', 1, MO, MO, { categoryId: 'k9' }), q('e2', 2, DI, DI, { categoryId: CAT.kp })],
      { over: { legend: [...kpLegend(), dunkel] } },
    );
    const weiss = { r: 255, g: 255, b: 255 };
    const schwarz = { r: 0, g: 0, b: 0 };
    expect(texte(L, 'e1').flatMap((t) => t.runs.map((r) => r.color))).toEqual([weiss]);
    expect(texte(L, 'e2').flatMap((t) => t.runs.map((r) => r.color))).toEqual([schwarz]);
    expect(rechtecke(L, 'e1')[0]?.fill).toEqual({ r: 0, g: 0, b: 128 });
  });
});

describe('Lagen im Band (2d Nr 1; R-4.6-07, F-63 d)', () => {
  it('[R-4.6-07][R-4.5-07] zwei am selben Tag: zuerst erfasster unten (0430–0500), zweiter oben (0400–0430), beide im Band, ohne Überlappung', () => {
    // Erfassungsreihenfolge entscheidet, nicht die ID.
    const L = legeWoche([q('e9', 1, MO, MO), q('e1', 2, MO, MO)]);
    rechteckNahe(einTeil(L, 'e9').rect, { x: tagX(0), w: 180, ...LAGE0 });
    rechteckNahe(einTeil(L, 'e1').rect, { x: tagX(0), w: 180, ...LAGE1 });
    // R-4.5-07: jeder Querbalken liegt vollständig zwischen y(0400) und y(0500).
    for (const id of ['e9', 'e1']) {
      const r = einTeil(L, id).rect;
      expect(r.y).toBeGreaterThanOrEqual(yZeit(240) - 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(yZeit(300) + 0.01);
    }
    expect(L.fallbacks).toEqual([]);
  });

  it('[R-4.6-07] gleiche Erfassungsnummer: die kleinere ID (UTF-16) liegt unten', () => {
    const L = legeWoche([q('e2', 1, MO, MO), q('e10', 1, MO, MO)]);
    nahe(einTeil(L, 'e10').rect.y, LAGE0.y);
    nahe(einTeil(L, 'e2').rect.y, LAGE1.y);
  });

  it('[R-4.6-07] mehrtägig, A Mo–Fr vor B Mi erfasst: A überall unten, B am Mi oben', () => {
    const L = legeWoche([q('eA', 1, MO, FR), q('eB', 2, MI, MI)]);
    rechteckNahe(einTeil(L, 'eA').rect, { x: tagX(0), w: 5 * 180, ...LAGE0 });
    rechteckNahe(einTeil(L, 'eB').rect, { x: tagX(2), w: 180, ...LAGE1 });
  });

  it('[R-4.6-07] mehrtägig, B Mi vor A Mo–Fr erfasst: B unten, A an allen Tagen durchgehend oben (gleiche Höhe je Seite)', () => {
    const L = legeWoche([q('eA', 2, MO, FR), q('eB', 1, MI, MI)]);
    rechteckNahe(einTeil(L, 'eB').rect, { x: tagX(2), w: 180, ...LAGE0 });
    rechteckNahe(einTeil(L, 'eA').rect, { x: tagX(0), w: 5 * 180, ...LAGE1 });
    expect(L.fallbacks).toEqual([]);
  });
});

describe('Kein Platz im Band (R-4.6-62; F-63 c/d; Notizen V04, Runde 2 V17)', () => {
  it('[R-4.6-62] drei eintägige am selben Tag: der dritte ohne Teilstück, genau ein bandOverflow; Raster unverändert', () => {
    const zwei = [q('e1', 1, MI, MI), q('e2', 2, MI, MI)];
    const L2 = legeWoche(zwei);
    const L3 = legeWoche([...zwei, q('e3', 3, MI, MI)]);
    expect(geo(L3, 'e3').pieces).toEqual([]);
    expect(L3.items.some((i) => i.entryId === 'e3')).toBe(false);
    expect(L3.fallbacks).toEqual([
      {
        kind: 'bandOverflow',
        region: 'band',
        weekId: WOCHE,
        date: MI,
        entryId: 'e3',
        piece: null,
        dropped: [],
      },
    ]);
    expect(L3.timeScale).toEqual(L2.timeScale);
    expect(L3.band).toEqual(L2.band);
    expect(L3.days).toEqual(L2.days);
    expect(teile(L3, 'e1')).toEqual(teile(L2, 'e1'));
    expect(teile(L3, 'e2')).toEqual(teile(L2, 'e2'));
  });

  it('[R-4.6-62] A Mo–Fr (Lage 0), B Mi (Lage 1), D Mo–Fr → D fehlt, genau ein Ereignis am Mi (nur dort beide belegt)', () => {
    const L = legeWoche([q('eA', 1, MO, FR), q('eB', 2, MI, MI), q('eD', 3, MO, FR)]);
    expect(geo(L, 'eD').pieces).toEqual([]);
    expect(ereignisse(L, 'eD')).toEqual([
      {
        kind: 'bandOverflow',
        region: 'band',
        weekId: WOCHE,
        date: MI,
        entryId: 'eD',
        piece: null,
        dropped: [],
      },
    ]);
  });

  it('[R-4.6-62] nicht gezeichnete Querbalken belegen keine Lage: später erfasster E am Mo liegt oben', () => {
    const L = legeWoche([
      q('eA', 1, MO, FR),
      q('eB', 2, MI, MI),
      q('eD', 3, MO, FR),
      q('eE', 4, MO, MO),
    ]);
    rechteckNahe(einTeil(L, 'eE').rect, { x: tagX(0), w: 180, ...LAGE1 });
    expect(ereignisse(L, 'eE')).toEqual([]);
  });

  it('[R-4.6-62] Lückenfall (an keinem Tag beide belegt): Z fehlt an allen Tagen, genau ein bandNoCommonLane am Di', () => {
    const L = legeWoche([
      q('eA', 1, MO, MO),
      q('eQ', 2, MO, DI),
      q('eW', 3, MI, MI),
      q('eZ', 4, DI, MI),
    ]);
    nahe(einTeil(L, 'eA').rect.y, LAGE0.y);
    nahe(einTeil(L, 'eQ').rect.y, LAGE1.y);
    nahe(einTeil(L, 'eW').rect.y, LAGE0.y);
    expect(geo(L, 'eZ').pieces).toEqual([]);
    expect(L.fallbacks).toEqual([
      {
        kind: 'bandNoCommonLane',
        region: 'band',
        weekId: WOCHE,
        date: DI,
        entryId: 'eZ',
        piece: null,
        dropped: [],
      },
    ]);
  });

  it('[R-4.6-62] an zwei Tagen kein Platz: je Tag ein Ereignis; Reihenfolge Querbalken, dann Datum', () => {
    const L = legeWoche([
      q('eA', 1, MO, FR),
      q('eB', 2, MO, FR),
      q('eC', 3, MO, DI),
      q('eD', 4, MO, MO),
    ]);
    expect(L.fallbacks.map((f) => [f.kind, f.entryId, f.date])).toEqual([
      ['bandOverflow', 'eC', MO],
      ['bandOverflow', 'eC', DI],
      ['bandOverflow', 'eD', MO],
    ]);
    expect(geo(L, 'eC').pieces).toEqual([]);
    expect(geo(L, 'eD').pieces).toEqual([]);
  });

  it('[R-4.6-62] nur ein sichtbarer Tag zählt: Querbalken an ausgeblendeten Tagen beansprucht dort keine Lage', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i === 3 ? 'hidden' : 'full',
    }));
    const L = lege(
      rasterPlan({
        tage,
        entries: [q('eA', 1, DO, DO), q('eB', 2, DO, DO), q('eC', 3, MI, DO), q('eS', 4, SO, SO)],
      }),
      { W: 6 * 180 },
    );
    expect(L.entries.map((e) => e.entryId)).toEqual(['eC', 'eS']);
    rechteckNahe(einTeil(L, 'eC').rect, { x: X0 + 2 * 180, w: 180, ...LAGE0 });
    expect(L.fallbacks).toEqual([]);
  });
});

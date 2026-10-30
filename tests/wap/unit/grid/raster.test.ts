// @vitest-environment jsdom
// Paket E1-02d: Raster einer Woche – Tage, Spalten, Zeitskala, Band und Eingabeprüfung (Vertrag E1-02d
// Abschnitt 2a, 2g; Beschrieb 4.3–4.5; F-40, F-41, B-F-06, F-63 a). Fiktive Pläne und die pseudonymisierte
// KVK-Fixture.
import { describe, expect, it } from 'vitest';
import { ModelError } from '../../../../src/model/wap/errors';
import {
  GRID_LAYOUT_MESSAGES,
  GridLayoutError,
  type GridLayoutErrorCode,
} from '../../../../src/model/wap/layout/grid/errors';
import { layoutGrid } from '../../../../src/model/wap/layout/grid/layout';
import type { GridFrame, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { kpTemplate } from '../../../../src/model/wap/template';
import {
  alleTage,
  DI,
  feld,
  geo,
  lege,
  MI,
  MO,
  nahe,
  nurMontag,
  RAHMEN_Y,
  rahmen,
  rasterPlan,
  rechteckNahe,
  SA,
  STD,
  STD_BREITE,
  satz,
  stdSatz,
  type TagSpec,
  tag,
  WOCHE,
  X0,
  Y0,
  yZeit,
} from '../../support/grid/build';
import { block, catchError, WEEKDAYS } from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

function erwarteGridFehler(fn: () => unknown, code: GridLayoutErrorCode): void {
  const e = catchError(fn);
  expect(e).toBeInstanceOf(GridLayoutError);
  const err = e as GridLayoutError;
  expect(err.code).toBe(code);
  expect(err.userMessage).toEqual(GRID_LAYOUT_MESSAGES[code]);
  expect(err.message).toBe(GRID_LAYOUT_MESSAGES[code].cause);
}

/**
 * Satz mit je einer Spalte jeder Art (Planung normal und breit, Neben, Rap, Beso): 2 + 3 + 2 + 1 + 2 = 10 (Nebenspalte 2:
 * Entscheid Auftraggeber 19.10.2026 «12: ja», F-LAYOUT2).
 */
const VIER = satz('s70', [
  { id: 'c71', kind: 'planning' },
  { id: 'c72', kind: 'planning', weight: 'wide' },
  { id: 'c73', kind: 'secondary', weight: 'wide' },
  { id: 'c74', kind: 'rap' },
  { id: 'c75', kind: 'beso', weight: 'narrow' },
]);

describe('Spalten eines Tages (2a Nr 3)', () => {
  it('[R-2-02] Planungs-, Neben-, Rap-, Beso-Spalte: x streng steigend in Satzreihenfolge, lückenlos', () => {
    const L = lege(rasterPlan({ sets: [VIER], tage: nurMontag('s70') }), { W: 200 });
    const mo = tag(L, MO);
    expect(mo.columns.map((c) => c.columnId)).toEqual(['c71', 'c72', 'c73', 'c74', 'c75']);
    expect(mo.columns.map((c) => c.kind)).toEqual([
      'planning',
      'planning',
      'secondary',
      'rap',
      'beso',
    ]);
    const breiten = [40, 60, 40, 20, 40];
    let x = X0;
    mo.columns.forEach((c, i) => {
      nahe(c.x, x, 0.01, `x Spalte ${i}`);
      nahe(c.w, breiten[i] as number, 0.01, `w Spalte ${i}`);
      x += breiten[i] as number;
    });
    for (let i = 1; i < mo.columns.length; i++) {
      expect((mo.columns[i]?.x ?? 0) > (mo.columns[i - 1]?.x ?? 0)).toBe(true);
    }
    nahe(x, mo.x + mo.w, 0.01, 'rechter Rand = Tagesende');
  });

  it('[R-2-02] Beso-Spalte hat zwei Bahnen (linke und rechte Hälfte), alle anderen keine', () => {
    const L = lege(rasterPlan({ sets: [VIER], tage: nurMontag('s70') }), { W: 200 });
    const mo = tag(L, MO);
    for (const c of mo.columns.slice(0, 4)) expect(c.lanes, c.columnId).toEqual([]);
    const beso = mo.columns[4];
    expect(beso?.lanes).toHaveLength(2);
    rechteckNahe(
      { ...(beso?.lanes[0] ?? { x: 0, w: 0 }), y: 0, h: 0 },
      { x: X0 + 160, w: 20, y: 0, h: 0 },
    );
    rechteckNahe(
      { ...(beso?.lanes[1] ?? { x: 0, w: 0 }), y: 0, h: 0 },
      { x: X0 + 180, w: 20, y: 0, h: 0 },
    );
  });

  it('[R-2-02] unitPt = Tagesbreite / Summe der Gewichte; Tag ohne Spaltensatz: keine Spalten, unitPt 0', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i === 0 ? 's70' : null,
      display: i < 2 ? 'full' : 'hidden',
    }));
    const L = lege(rasterPlan({ sets: [VIER], tage }), { W: 400 });
    nahe(tag(L, MO).unitPt, 20);
    expect(tag(L, DI).columns).toEqual([]);
    expect(tag(L, DI).unitPt).toBe(0);
    nahe(tag(L, DI).w, 200);
  });

  it('[R-4.3-03] kompakter Tag mit eigenem Satz (Planung, Rap, Beso): genau diese Spalten, Breite ein Drittel', () => {
    const kompakt = satz('s80', [
      { id: 'c81', kind: 'planning' },
      { id: 'c82', kind: 'rap' },
      { id: 'c83', kind: 'beso' },
    ]);
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: i === 5 ? 's80' : STD.set,
      display: i === 0 ? 'full' : i === 5 ? 'compact' : 'hidden',
    }));
    const L = lege(rasterPlan({ sets: [stdSatz(), kompakt], tage }), { W: 400 });
    const sa = tag(L, SA);
    expect(sa.display).toBe('compact');
    expect(sa.weekday).toBe('Sa');
    expect(sa.columns.map((c) => c.columnId)).toEqual(['c81', 'c82', 'c83']);
    nahe(sa.w, 100);
    nahe(tag(L, MO).w, 300);
    nahe(sa.w / tag(L, MO).w, 1 / 3, 1e-6);
    // «kompakt» bestimmt nur die Breite: Verhältnis 2 : 1 : 2 wie bei einem vollen Tag.
    nahe(sa.columns[0]?.w ?? 0, 40);
    nahe(sa.columns[1]?.w ?? 0, 20);
    nahe(sa.columns[2]?.w ?? 0, 40);
    nahe(sa.unitPt, 20);
  });
});

describe('Tagesbreiten im Raster (2a Nr 2)', () => {
  it('[R-4.4-10] KVK-Fixture: volle Tage mit 9 und 5 Spalten gleich breit (Mo = Mi)', () => {
    const kvk = loadKvkPlan();
    const L = lege(kvk, { W: 652.51 });
    const voll = L.days.filter((d) => d.display === 'full');
    expect(voll.length).toBeGreaterThanOrEqual(2);
    expect(tag(L, MO).columns.length).not.toBe(tag(L, MI).columns.length);
    for (const d of voll) nahe(d.w, tag(L, MO).w, 0.01, d.date);
  });

  it('[R-4.4-11] KVK-Fixture: kompakte Tage (Sa, So) = ein Drittel eines vollen', () => {
    const L = lege(loadKvkPlan(), { W: 652.51 });
    const kompakt = L.days.filter((d) => d.display === 'compact');
    expect(kompakt.map((d) => d.weekday)).toEqual(['Sa', 'So']);
    for (const d of kompakt) nahe(d.w, tag(L, MO).w / 3, 0.01, d.date);
  });

  it('[R-4.4-12] ausgeblendete Tage fehlen in days; sichtbare lückenlos ab X0, Summe = Tagesfläche', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i === 0 ? 'full' : i === 2 ? 'compact' : 'hidden',
    }));
    const L = lege(rasterPlan({ tage }), { W: 400 });
    expect(L.days.map((d) => d.date)).toEqual([MO, MI]);
    expect(L.days.map((d) => d.weekday)).toEqual(['Mo', 'Mi']);
    nahe(tag(L, MO).x, X0);
    nahe(tag(L, MO).w, 300);
    nahe(tag(L, MI).x, X0 + 300);
    nahe(tag(L, MI).w, 100);
  });

  it('[R-4.4-12] kein Tag sichtbar: days leer, keine Einträge, keine Ausnahme (Grenzfall)', () => {
    const tage: TagSpec[] = WEEKDAYS.map(() => ({ set: STD.set, display: 'hidden' }));
    const plan = rasterPlan({ tage, entries: [block('e1', 1, { date: MO })] });
    const L = lege(plan, { W: 400 });
    expect(L.days).toEqual([]);
    expect(L.entries).toEqual([]);
    expect(L.items).toEqual([]);
    expect(L.fallbacks).toEqual([]);
  });

  it('[R-4.4-12] Einträge an ausgeblendeten Tagen fehlen in entries (P16, E1-06)', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i === 0 ? 'full' : 'hidden',
    }));
    const plan = rasterPlan({
      tage,
      entries: [
        block('e1', 1, { date: MO, columns: { kind: 'ids', ids: [STD.p1] } }),
        block('e2', 2, { date: DI, columns: { kind: 'ids', ids: [STD.p1] } }),
      ],
    });
    const L = lege(plan);
    expect(L.entries.map((e) => e.entryId)).toEqual(['e1']);
    expect(L.items.some((i) => i.entryId === 'e2')).toBe(false);
  });
});

describe('Zeitskala und Band (2a Nr 4, 5)', () => {
  it('[R-4.5-02] Anzeigebereich 0500–2300: timeScale 300/1380, y(to) = Rasterunterkante, Blockkanten folgen', () => {
    const plan = rasterPlan({
      range: { from: 300, to: 1380 },
      entries: [
        block('e1', 1, {
          date: MO,
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'ids', ids: [STD.p1] },
        }),
      ],
    });
    const L = lege(plan, { ppm: 0.5 });
    expect(L.timeScale.fromMin).toBe(300);
    expect(L.timeScale.toMin).toBe(1380);
    nahe(L.timeScale.yTop, Y0);
    nahe(L.timeScale.ptPerMinute, 0.5, 1e-9);
    const f = rahmen(STD_BREITE, plan.displayRange, 0.5);
    nahe(L.timeScale.yTop + 1080 * L.timeScale.ptPerMinute, f.rect.y + f.rect.h);
    const p = geo(L, 'e1').pieces[0];
    rechteckNahe(p?.rect ?? { x: 0, y: 0, w: 0, h: 0 }, {
      x: X0,
      y: Y0 + 180 * 0.5,
      w: 40,
      h: 120 * 0.5,
    });
  });

  it('[R-4.5-02] derselbe Block im Standardbereich 0400–2400 liegt anders (Abbildung geändert)', () => {
    const e = block('e1', 1, {
      date: MO,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: [STD.p1] },
    });
    const L = lege(rasterPlan({ entries: [e] }));
    expect(L.timeScale.fromMin).toBe(240);
    expect(L.timeScale.toMin).toBe(1440);
    rechteckNahe(
      geo(L, 'e1').pieces[0]?.rect ?? { x: 0, y: 0, w: 0, h: 0 },
      feld({ x: X0, w: 40 }, 480, 600),
    );
  });

  it('[R-4.5-07] 0400–2400: Band = erste Stunde, band.y = yTop = rect.y + Kopfhöhen, kein eigener Streifen', () => {
    const L = lege(rasterPlan({ tage: alleTage() }), { W: 700 });
    nahe(L.timeScale.yTop, RAHMEN_Y + 15 + 25);
    rechteckNahe(L.band, { x: X0, y: Y0, w: 700, h: 60 * 0.3 });
    nahe(L.band.y + L.band.h, yZeit(300));
  });

  it('[R-4.5-07] anderer Anzeigebereich 0500–2300: Band ist dessen erste Stunde 0500–0600 (F-63 a)', () => {
    const L = lege(rasterPlan({ range: { from: 300, to: 1380 } }), { ppm: 0.5 });
    rechteckNahe(L.band, { x: X0, y: Y0, w: STD_BREITE, h: 30 });
  });
});

describe('Eingabeprüfung (2a Nr 1, 2g)', () => {
  const gueltig = (): { plan: ReturnType<typeof rasterPlan>; frame: GridFrame } => {
    const plan = rasterPlan();
    return { plan, frame: rahmen(STD_BREITE, plan.displayRange) };
  };
  const mitRahmen = (frame: GridFrame, plan = rasterPlan()): GridLayout =>
    layoutGrid({ plan, weekId: WOCHE, template: kpTemplate(), frame });

  it('[R-4.5-02] ungültiger Anzeigebereich → GridLayoutError invalidDisplayRange mit Meldung', () => {
    const faelle = [
      { from: 302, to: 1440 },
      { from: 240, to: 1438 },
      { from: -60, to: 1440 },
      { from: 240, to: 1445 },
      { from: 300, to: 360 },
      { from: 600, to: 300 },
      { from: 240.5, to: 1440 },
      { from: Number.NaN, to: 1440 },
    ];
    for (const range of faelle) {
      const plan = rasterPlan({ range });
      erwarteGridFehler(
        () => mitRahmen(rahmen(STD_BREITE, { from: 240, to: 1440 }), plan),
        'invalidDisplayRange',
      );
    }
  });

  it('[R-4.5-02] Grenzwerte: 0000–2400 und from + 65 = to sind gültig', () => {
    for (const range of [
      { from: 0, to: 1440 },
      { from: 300, to: 365 },
    ]) {
      const plan = rasterPlan({ range });
      const L = layoutGrid({
        plan,
        weekId: WOCHE,
        template: kpTemplate(),
        frame: rahmen(STD_BREITE, range),
      });
      expect(L.timeScale.fromMin).toBe(range.from);
      expect(L.timeScale.toMin).toBe(range.to);
      nahe(L.band.h, 60 * 0.3);
    }
  });

  it('[R-4.4-12] Rahmen zu schmal (rect.w ≤ 2 · Zeitachse) → gridFrameTooSmall', () => {
    const { frame } = gueltig();
    erwarteGridFehler(
      () => mitRahmen({ ...frame, rect: { ...frame.rect, w: 40 } }),
      'gridFrameTooSmall',
    );
    erwarteGridFehler(() => mitRahmen({ ...frame, timeAxisWidthPt: -1 }), 'gridFrameTooSmall');
    erwarteGridFehler(
      () => mitRahmen({ ...frame, rect: { ...frame.rect, x: Number.NaN } }),
      'gridFrameTooSmall',
    );
  });

  it('[R-4.5-02] Rahmen zu niedrig (rect.h ≤ Kopfhöhen) oder Mass nicht endlich → gridFrameTooSmall', () => {
    const { frame } = gueltig();
    erwarteGridFehler(
      () => mitRahmen({ ...frame, rect: { ...frame.rect, h: 40 } }),
      'gridFrameTooSmall',
    );
    erwarteGridFehler(
      () => mitRahmen({ ...frame, dayHeaderHeightPt: Number.POSITIVE_INFINITY }),
      'gridFrameTooSmall',
    );
    erwarteGridFehler(() => mitRahmen({ ...frame, columnHeaderHeightPt: -5 }), 'gridFrameTooSmall');
  });

  it('[R-4.5-02] Grenzwert: knapp grösserer Rahmen (rect.w = 2 · Achse + 0,1) ist gültig', () => {
    const { frame } = gueltig();
    const L = mitRahmen({ ...frame, rect: { ...frame.rect, w: 40.1 } });
    nahe(L.band.w, 0.1);
  });

  it('[R-4.4-12] Reihenfolge der Prüfung: unbekannte Woche vor Anzeigebereich vor Rahmen', () => {
    const plan = rasterPlan({ range: { from: 302, to: 1440 } });
    const schlecht: GridFrame = { ...rahmen(STD_BREITE, plan.displayRange), timeAxisWidthPt: -1 };
    const e = catchError(() =>
      layoutGrid({ plan, weekId: 'w999', template: kpTemplate(), frame: schlecht }),
    );
    expect(e).toBeInstanceOf(ModelError);
    expect((e as ModelError).code).toBe('unknownWeek');
    erwarteGridFehler(() => mitRahmen(schlecht, plan), 'invalidDisplayRange');
  });

  it('[R-10-40] ungültige Schriftgrössen der Vorlage → RangeError (Programmfehler)', () => {
    const { plan, frame } = gueltig();
    const t = kpTemplate();
    const faelle = [
      { ...t.fontSizes, min: 6 },
      { ...t.fontSizes, min: 0 },
      { ...t.fontSizes, standard: Number.NaN },
      { ...t.fontSizes, besoNumber: 4 },
      { ...t.fontSizes, rapportCode: Number.POSITIVE_INFINITY },
    ];
    for (const fontSizes of faelle) {
      const e = catchError(() =>
        layoutGrid({ plan, weekId: WOCHE, template: { ...t, fontSizes }, frame }),
      );
      expect(e, JSON.stringify(fontSizes)).toBeInstanceOf(RangeError);
    }
  });

  it('[R-10-40] Grenzwert: min = standard = blockTitle = besoNumber = rapportCode ist gültig', () => {
    const { plan, frame } = gueltig();
    const t = kpTemplate();
    const fontSizes = { standard: 5, blockTitle: 5, besoNumber: 5, rapportCode: 5, min: 5 };
    const L = layoutGrid({ plan, weekId: WOCHE, template: { ...t, fontSizes }, frame });
    expect(L.days).toHaveLength(1);
  });
});

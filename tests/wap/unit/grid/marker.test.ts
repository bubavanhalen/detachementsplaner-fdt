// @vitest-environment jsdom
// Paket E1-02d: Marker – Linie je Lauf, Beschriftungsfeld, Lage über/unter der Linie, Beschriftung mit Zeit
// (Vertrag E1-02d Abschnitt 2c, 2d Nr 5, 2e «Weitere Texte», 2f; Änderungsnotizen V06 b/c, V11, Runde 2 V15, V16 b,
// V19 d, Nachtrag V-02d-18; Beschrieb 4.6 «Marker»; B-Kp-65 bis -68). Fiktive Pläne, 0,3 pt/min.
// Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten des Tags; gespeicherte
// Einzelspalten (alte Pläne) bleiben erhalten, wirken aber nicht. Fälle «in einer Spalte» legen deshalb einen Tag
// mit genau einer Planungsspalte (Satz EIN), Fälle «je Lauf» einen Tag, dessen Planungsspalten Rap trennt.
import { describe, expect, it } from 'vitest';
import type { EntryPiece, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { LineItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry, Marker } from '../../../../src/model/wap/types';
import {
  einTeil,
  ereignisse,
  geo,
  itemsVon,
  LINIEN,
  lege,
  MO,
  nahe,
  nurMontag,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  STD,
  satz,
  teile,
  texte,
  WOCHE,
  X0,
  yZeit,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import { kpLegend, marker } from '../../support/model/builders';

function m(id: string, seq: number, at: number, over: Partial<Marker> = {}): Marker {
  return marker(id, seq, {
    date: MO,
    at,
    kind: 'AV',
    columns: { kind: 'all' },
    ...over,
  });
}
const lm = (
  entries: readonly Entry[],
  W = 180,
  over: Parameters<typeof rasterPlan>[0] = {},
): GridLayout => lege(rasterPlan({ entries, ...over }), { W });

/** Satz mit genau einer Planungsspalte, Rap und Beso → 2 + 1 + 2 = 5 Einheiten. */
const EIN = 's91';
const einSatz = () =>
  satz(EIN, [
    { id: STD.p1, kind: 'planning' },
    { id: STD.rap, kind: 'rap' },
    { id: STD.beso, kind: 'beso' },
  ]);
/** Layout eines Tags mit einer Planungsspalte von `spalte` pt (Einheit spalte / 2) ab X0. */
const l1 = (
  entries: readonly Entry[],
  spalte = 40,
  over: Parameters<typeof rasterPlan>[0] = {},
): GridLayout =>
  lege(rasterPlan({ sets: [einSatz()], tage: nurMontag(EIN), entries, ...over }), {
    W: (spalte / 2) * 5,
  });

/** Feldhöhe nach V-02d-18: max(15 · 0,3, Zeilenhöhe 5 pt + 2 · (0,5 + 0,24)). */
const FELD_H = Math.max(15 * 0.3, lineHeightPt(5) + 2 * (0.5 + 0.24));
const HALB = 1.56 / 2;

function feldTeil(L: GridLayout, id: string): EntryPiece {
  return einTeil(L, id, 'markerField');
}

describe('Linie und Feld (2d Nr 5)', () => {
  it('[R-7-07] (V-02d-13, V-02d-18, V15) einzelner AV 0700 in einer Spalte: Linie, Feld unter der Linie, Text «AV», kein Ereignis', () => {
    const L = l1([m('e1', 1, 420)]);
    const Y = yZeit(420);
    const linie = einTeil(L, 'e1', 'markerLine');
    rechteckNahe(linie.rect, { x: X0, y: Y - HALB, w: 40, h: 1.56 });
    expect(linie.span).toEqual({ from: 420, to: 420 });
    expect(linie.part).toBe(0);
    const f = feldTeil(L, 'e1');
    rechteckNahe(f.rect, { x: X0, y: Y + 0.5, w: 40, h: FELD_H });
    expect(f.textCarrier).toBe(true);
    expect(f.textOrientation).toBe('horizontal');
    expect(f.part).toBe(0);
    expect(f.span).toEqual({ from: 420, to: 420 });
    const z = texte(L, 'e1');
    expect(z.map((t) => [zeilenText(t), t.sizePt])).toEqual([['AV', 5]]);
    expect(z[0]?.runs.map((r) => r.weight)).toEqual(['bold']);
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1')).toEqual([]);
    expect(geo(L, 'e1').type).toBe('marker');
  });

  it('[R-7-07] (V-02d-13) Zeichnen: Linie als LineItem mit markerLine, Feld mit Füllung «Ltg Kp» und markerFieldBorder, Rolle marker', () => {
    const L = l1([m('e1', 1, 420)]);
    const Y = yZeit(420);
    const li = itemsVon(L, 'e1').filter((i): i is LineItem => i.kind === 'line');
    expect(li).toHaveLength(1);
    expect(li[0]?.stroke).toEqual(LINIEN.markerLine);
    nahe(li[0]?.x1 ?? 0, X0);
    nahe(li[0]?.x2 ?? 0, X0 + 40);
    nahe(li[0]?.y1 ?? 0, Y);
    nahe(li[0]?.y2 ?? 0, Y);
    const r = rechtecke(L, 'e1');
    expect(r.map((x) => [x.fill, x.stroke])).toEqual([
      [{ r: 255, g: 255, b: 153 }, LINIEN.markerFieldBorder],
    ]);
    expect(itemsVon(L, 'e1').every((i) => i.role === 'marker')).toBe(true);
  });

  it('[R-7-07] Feldfüllung ohne Kategorie «Ltg Kp» in der Legende → neutrale Kategorie', () => {
    const legende = kpLegend()
      .filter((c) => c.name !== 'Ltg Kp')
      .map((c) => (c.neutral ? { ...c, color: { r: 240, g: 240, b: 240 } } : c));
    const L = lm([m('e1', 1, 420)], 180, { over: { legend: legende } });
    expect(rechtecke(L, 'e1')[0]?.fill).toEqual({ r: 240, g: 240, b: 240 });
  });

  it('[R-7-07] (V-02d-13) Feldbreite = min(Laufbreite, max(2 Einheiten, Beschriftung + 2 · 0,5)), waagrecht im Lauf zentriert', () => {
    const L = lm([
      m('e1', 1, 600, {
        kind: 'custom',
        customKind: 'Wachtablösung Nord',
        columns: { kind: 'all' },
      }),
    ]);
    const breite = measureRuns([{ text: 'Wachtablösung Nord', weight: 'bold' }], 5) + 1;
    expect(breite).toBeGreaterThan(40);
    const f = feldTeil(L, 'e1');
    nahe(f.rect.w, Math.min(120, breite));
    nahe(f.rect.x, X0 + (120 - f.rect.w) / 2);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Wachtablösung Nord']);
  });

  it('[R-7-07] Planungsspalten durch Rap getrennt: je Lauf eine Linie (part 0, 1), Feld unter dem breitesten Lauf, gleich breit → links', () => {
    // Satz p1 | Rap | p3 | Beso: 2 + 1 + 2 + 2 = 7 Einheiten zu 20 pt; Läufe p1 (X0) und p3 (X0 + 60).
    const getrennt = satz('s92', [
      { id: STD.p1, kind: 'planning' },
      { id: STD.rap, kind: 'rap' },
      { id: STD.p3, kind: 'planning' },
      { id: STD.beso, kind: 'beso' },
    ]);
    const L = lege(
      rasterPlan({ sets: [getrennt], tage: nurMontag('s92'), entries: [m('e1', 1, 600)] }),
      { W: 140 },
    );
    const linien = teile(L, 'e1', 'markerLine');
    expect(linien.map((p) => [p.part, p.rect.x])).toEqual([
      [0, expect.closeTo(X0, 2)],
      [1, expect.closeTo(X0 + 60, 2)],
    ]);
    expect(feldTeil(L, 'e1').part).toBe(0);
    nahe(feldTeil(L, 'e1').rect.x, X0);
  });

  it('[R-7-07] Feld unter dem breiteren Lauf (Lauf 2 aus zwei Spalten)', () => {
    const fuenf = satz('s60', [
      { id: 'q1', kind: 'planning' },
      { id: 'q2', kind: 'rap' },
      { id: 'q3', kind: 'planning' },
      { id: 'q4', kind: 'planning' },
      { id: 'q5', kind: 'beso' },
    ]);
    const L = lege(
      rasterPlan({
        sets: [fuenf],
        tage: nurMontag('s60'),
        // Gespeicherte Einzelspalte q1 (alter Plan) wirkt nicht: der Marker gilt über alle Planungsspalten.
        entries: [m('e1', 1, 600, { columns: { kind: 'ids', ids: ['q1'] } })],
      }),
      { W: 180 },
    );
    // 9 Einheiten zu 20 pt: Lauf 0 = q1 (40 pt), Lauf 1 = q3 + q4 (80 pt ab X0 + 60).
    expect(teile(L, 'e1', 'markerLine').map((p) => [p.rect.x, p.rect.w])).toEqual([
      [expect.closeTo(X0, 2), expect.closeTo(40, 2)],
      [expect.closeTo(X0 + 60, 2), expect.closeTo(80, 2)],
    ]);
    const f = feldTeil(L, 'e1');
    expect(f.part).toBe(1);
    nahe(f.rect.x, X0 + 60 + (80 - f.rect.w) / 2);
    nahe(f.rect.w, 40);
  });
});

describe('Lage des Felds (2d Nr 5; V06 c, V15; V-02d-13)', () => {
  it('[R-7-07] (V-02d-13) Feld läge unter y(Anzeigeende) → darüber (Unterkante Y − 0,5)', () => {
    const L = lm([m('e1', 1, 1435)]);
    const Y = yZeit(1435);
    const f = feldTeil(L, 'e1');
    nahe(f.rect.y + f.rect.h, Y - 0.5);
    nahe(f.rect.h, FELD_H);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-7-07] (V-02d-13, V06 c) Feld schnitte die Linie eines anderen Markers → darüber; der andere bleibt unten', () => {
    const L = lm([m('e1', 1, 420), m('e2', 2, 430, { kind: 'HV' })]);
    const f1 = feldTeil(L, 'e1');
    const f2 = feldTeil(L, 'e2');
    nahe(f1.rect.y + f1.rect.h, yZeit(420) - 0.5);
    nahe(f2.rect.y, yZeit(430) + 0.5);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    expect(texte(L, 'e2').map(zeilenText)).toEqual(['HV']);
    expect(L.fallbacks).toEqual([]);
  });

  it('[R-7-07] (V-02d-13) weder unten noch oben frei: Feld bleibt unten, Text entfällt (textOmitted am Feld)', () => {
    const L = lm([
      m('e0', 1, 410, { kind: 'HV' }),
      m('e1', 2, 420),
      m('e2', 3, 430, { kind: 'ABV' }),
    ]);
    const f = feldTeil(L, 'e1');
    nahe(f.rect.y, yZeit(420) + 0.5);
    expect(texte(L, 'e1')).toEqual([]);
    const index = geo(L, 'e1').pieces.indexOf(f);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ereignisse(L, 'e1')).toEqual([
      {
        kind: 'textOmitted',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e1',
        piece: index,
        dropped: [],
      },
    ]);
    // Der früher gelegte e0 (0650) liegt darüber und behält seinen Text.
    expect(texte(L, 'e0').map(zeilenText)).toEqual(['HV']);
  });

  it('[R-7-07] (V15; Entscheid 21.10.2026) gespeicherte verschiedene Einzelspalten trennen Marker nicht mehr: beide über alle Spalten, das Feld von 0700 weicht nach oben aus', () => {
    const L = lm([
      m('e1', 1, 420, { columns: { kind: 'ids', ids: [STD.p1] } }),
      m('e2', 2, 430, { columns: { kind: 'ids', ids: [STD.p3] } }),
    ]);
    for (const id of ['e1', 'e2']) {
      const linie = einTeil(L, id, 'markerLine');
      nahe(linie.rect.x, X0);
      nahe(linie.rect.w, 120);
    }
    const f1 = feldTeil(L, 'e1');
    nahe(f1.rect.y + f1.rect.h, yZeit(420) - 0.5);
    nahe(feldTeil(L, 'e2').rect.y, yZeit(430) + 0.5);
  });
});

describe('Marker am Anzeigeende (Notiz test-engineer Runde 1 T1; V-02d-19)', () => {
  const ENDE = yZeit(1440);

  it('[R-7-07] (V-02d-19) Marker 2330 und 2340: Feld von 2340 endet bei y(2400), unten offen, Text entfällt am Feld', () => {
    const L = lm([m('e1', 1, 1410), m('e2', 2, 1420, { kind: 'HV' })]);
    // 2330 liegt oben (unten schnitte es die Linie von 2340) und behält den Text.
    const f1 = feldTeil(L, 'e1');
    nahe(f1.rect.y + f1.rect.h, yZeit(1410) - 0.5);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    // 2340: unten unter y(V1), oben Hindernis → bleibt unten, abgeschnitten an y(V1).
    const f2 = feldTeil(L, 'e2');
    nahe(f2.rect.y, yZeit(1420) + 0.5);
    nahe(f2.rect.y + f2.rect.h, ENDE);
    expect(f2.openBottom).toBe(true);
    expect(f2.openTop).toBe(false);
    expect(texte(L, 'e2')).toEqual([]);
    const index = geo(L, 'e2').pieces.indexOf(f2);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ereignisse(L, 'e2')).toEqual([
      {
        kind: 'textOmitted',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e2',
        piece: index,
        dropped: [],
      },
    ]);
    // Linie unverändert auf ihrer Zeit (R-7-06).
    const linie = einTeil(L, 'e2', 'markerLine');
    nahe(linie.rect.y + linie.rect.h / 2, yZeit(1420));
  });

  it('[R-7-07] (V-02d-19) Marker 2350 und 2400: kein Feld für 2400, ihre Linie bei y(2400) ist Textträger mit textOmitted', () => {
    const L = l1([m('e1', 1, 1430), m('e2', 2, 1440, { kind: 'HV' })]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    nahe(feldTeil(L, 'e1').rect.y + feldTeil(L, 'e1').rect.h, yZeit(1430) - 0.5);
    expect(teile(L, 'e2', 'markerField')).toEqual([]);
    const linie = einTeil(L, 'e2', 'markerLine');
    rechteckNahe(linie.rect, { x: X0, y: ENDE - HALB, w: 40, h: 1.56 });
    expect(linie.textCarrier).toBe(true);
    expect(texte(L, 'e2')).toEqual([]);
    const index = geo(L, 'e2').pieces.indexOf(linie);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ereignisse(L, 'e2')).toEqual([
      {
        kind: 'textOmitted',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e2',
        piece: index,
        dropped: [],
      },
    ]);
  });

  it('[R-7-07] (V-02d-19) Marker 2400 allein, Spalte 30 pt: Feld oben mit Text, Linie auf y(2400)', () => {
    const L = l1([m('e1', 1, 1440)], 30);
    const linie = einTeil(L, 'e1', 'markerLine');
    nahe(linie.rect.y + linie.rect.h / 2, ENDE);
    expect(linie.textCarrier).toBe(false);
    const f = feldTeil(L, 'e1');
    nahe(f.rect.y + f.rect.h, ENDE - 0.5);
    nahe(f.rect.h, FELD_H);
    expect([f.openTop, f.openBottom]).toEqual([false, false]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
});

describe('Marker am Ende des Anzeigebereichs 0500–2300 (Notiz Runde 2 R2-4; V-02d-19)', () => {
  const B = { from: 300, to: 1380 } as const;
  const ENDE = yZeit(1380, 300);

  it('[R-7-07] (V-02d-19) AV 2330 allein (Bereich bis 2300): Linie bei y(2300), Feld oben, Text «AV 2330»', () => {
    const L = lm([m('e1', 1, 1410)], 135, { range: B });
    const linie = einTeil(L, 'e1', 'markerLine');
    nahe(linie.rect.y + linie.rect.h / 2, ENDE);
    expect(linie.span).toEqual({ from: 1410, to: 1410 });
    const f = feldTeil(L, 'e1');
    nahe(f.rect.y + f.rect.h, ENDE - 0.5);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV 2330']);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-7-07] (V-02d-19) AV 2255 und AV 2330: Feld von 2255 oben mit «AV»; 2330 ohne Feld, Linie bei y(2300) Textträger mit textOmitted', () => {
    const L = lm([m('e1', 1, 1375), m('e2', 2, 1410)], 135, { range: B });
    const f1 = feldTeil(L, 'e1');
    nahe(f1.rect.y + f1.rect.h, yZeit(1375, 300) - 0.5);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV']);
    expect(teile(L, 'e2', 'markerField')).toEqual([]);
    const linie = einTeil(L, 'e2', 'markerLine');
    nahe(linie.rect.y + linie.rect.h / 2, ENDE);
    expect(linie.textCarrier).toBe(true);
    expect(texte(L, 'e2')).toEqual([]);
    const index = geo(L, 'e2').pieces.indexOf(linie);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ereignisse(L, 'e2')).toEqual([
      {
        kind: 'textOmitted',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e2',
        piece: index,
        dropped: [],
      },
    ]);
  });
});

describe('Beschriftung (2e «Weitere Texte»; Notizen V11, Runde 2 V16 b, V19 d)', () => {
  it('[R-7-07] Beschriftung nach markerLabel: ABV mit Zeit «ABV 2330»', () => {
    const L = lm([m('e1', 1, 1410, { kind: 'ABV' })], 360);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['ABV 2330']);
  });

  it('[R-7-07] (V11) freie Art mit Zeilenumbruch wird einzeilig: «Wacht↵ablösung» → «Wacht ablösung»', () => {
    const L = lm([m('e1', 1, 600, { kind: 'custom', customKind: 'Wacht\r\nablösung' })], 360);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Wacht ablösung']);
  });

  it('[R-4.5-07] (V19 d, V-02d-17) AV 0430 ohne withTime, Spalte 30 pt: Beschriftung «AV 0430», Linie bei y(0500)', () => {
    const L = l1([m('e1', 1, 270)], 30);
    const linie = einTeil(L, 'e1', 'markerLine');
    nahe(linie.rect.y + linie.rect.h / 2, yZeit(300));
    expect(linie.span).toEqual({ from: 270, to: 270 });
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['AV 0430']);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.5-07] (V16 b, V-02d-17) frei «Wachtablösung» 0430 in Spalte 20 pt: nur die Art gekürzt, endet auf «… 0430»', () => {
    // Feld 20 pt, Textbreite 18,52 pt: «… 0430» fett 4,5 pt = 15,76 pt passt, «W… 0430» = 20,01 pt nicht.
    const L = l1([m('e1', 1, 270, { kind: 'custom', customKind: 'Wachtablösung' })], 20);
    const z = texte(L, 'e1');
    expect(z.map((t) => [zeilenText(t), t.sizePt])).toEqual([['… 0430', 4.5]]);
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1').map((e) => e.kind)).toEqual(['ellipsis']);
  });

  it('[R-4.5-07] (V16 b, V-02d-17) frei «Wachtablösung» 0430 in Spalte 30 pt: längster Anfang der Art mit «… 0430» in 4,5 pt', () => {
    const L = l1([m('e1', 1, 270, { kind: 'custom', customKind: 'Wachtablösung' })], 30);
    // Orakel nach 2e und V16 b: längstes Anfangsstück der Art, mit «… 0430» fett 4,5 pt in 30 − 1,48 pt.
    const punkte = [...'Wachtablösung'];
    let soll = '';
    for (let k = punkte.length; k >= 0; k--) {
      const t = `${punkte.slice(0, k).join('').trimEnd()}… 0430`;
      if (measureRuns([{ text: t, weight: 'bold' }], 4.5) <= 30 - 1.48) {
        soll = t;
        break;
      }
    }
    expect(soll.length).toBeGreaterThan('… 0430'.length);
    expect(texte(L, 'e1').map((t) => [zeilenText(t), t.sizePt])).toEqual([[soll, 4.5]]);
    expect(ereignisse(L, 'e1').map((e) => e.kind)).toEqual(['ellipsis']);
  });

  it('[R-7-07] (V-02d-13) AV 0500 und HV 0510: Feld von AV bleibt unten (oben ragte es über y(0500)), kein Text, textOmitted; kein Teilstück über y(0500)', () => {
    const L = l1([m('e1', 1, 300), m('e2', 2, 310, { kind: 'HV' })]);
    // Unten schneidet das AV-Feld [y + 0,5, y + 7,73] die HV-Linie bei y(0510) ± 0,78; oben läge es über y(V0).
    const f = feldTeil(L, 'e1');
    rechteckNahe(f.rect, { x: X0, y: yZeit(300) + 0.5, w: 40, h: FELD_H });
    expect(texte(L, 'e1')).toEqual([]);
    expect(ereignisse(L, 'e1')).toEqual([
      {
        kind: 'textOmitted',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e1',
        piece: geo(L, 'e1').pieces.indexOf(f),
        dropped: [],
      },
    ]);
    expect(geo(L, 'e1').pieces.indexOf(f)).toBeGreaterThanOrEqual(0);
    for (const id of ['e1', 'e2']) {
      for (const p of geo(L, id).pieces) {
        if (p.kind === 'markerLine') nahe(p.rect.y + p.rect.h / 2, yZeit(id === 'e1' ? 300 : 310));
        else expect(p.rect.y, `${id} ${p.kind}`).toBeGreaterThanOrEqual(yZeit(300) - 0.01);
      }
    }
  });

  it('[R-7-07] Beschriftung passt nicht einmal als «…»: textOmitted, nie eine Ausnahme', () => {
    // Spalte 4 pt, Feld 4 pt breit, Textbreite 2,52 pt < «…» in 4,5 pt.
    const L = l1([m('e1', 1, 600)], 4);
    expect(texte(L, 'e1')).toEqual([]);
    expect(ereignisse(L, 'e1').map((e) => e.kind)).toEqual(['textOmitted']);
  });
});

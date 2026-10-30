// @vitest-environment jsdom
// Paket E1-02d: Testnachtrag zur Änderungsnotiz «Q-032 Ausrichtung» (Vertrag E1-02d, Stand Runde 2; A1–A9 und
// Pflichtfälle P1–P19; Beschrieb 6 «Automatische Textausrichtung», 10 «Rückfallregel»; R-6-02, R-6-03, R-4.6-21,
// R-4.6-05, R-4.6-42, R-10-40, R-10-41; Bezug R-4.6-08 und R-4.6-54 von E1-02e). Die Ausrichtung «auto» wird in sechs Stufen gewählt (A3):
// Klasse, entfallene Arten L, Grössenstufe d, gezeigte Zeichen k vor «…», Trennstriche t, sonst waagrecht; in den
// Stufen 2, 3 und 5 gilt senkrecht nur mit höchstens so vielen Umbrüchen U wie waagrecht (V-02d-22, neu gefasst;
// Stufe 2 mit F-23-Ausnahme). Einzeilige Texte bleiben waagrecht (A5, V-02d-23); Hindernisse wirken mit ihrem
// äusseren Rechteck (A9, Befund E1-02d-AV-01). P9 und P14 sind bestehende Tests (text.test.ts). Erwartungen aus
// den festen Rahmenmassen und den Metriken (measureRuns, lineHeightPt, fontMetrics) nachgerechnet. Fiktive Pläne,
// Standardrahmen 0400–2400 mit 0,3 pt/min, Kp-Vorlage.
import { describe, expect, it } from 'vitest';
import type { FallbackEvent, GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, fontMetrics, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Block, Entry, Rapport } from '../../../../src/model/wap/types';
import {
  einTeil,
  ereignisse,
  feld,
  lege,
  MO,
  nahe,
  nurMontag,
  rasterPlan,
  rechteckNahe,
  STD,
  satz,
  texte,
  textflaeche,
  WOCHE,
  X0,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import { beso, block, marker, querbalken, rapport, rt, win } from '../../support/model/builders';

const range = (from: number, to: number) => ({ form: 'range' as const, from, to });

// ---------------------------------------------------------------------------------------------------------
// Aufbau wie text.test.ts (Block) und rapport.test.ts (Rapport-Kästchen)
// ---------------------------------------------------------------------------------------------------------

/** Block `e1` am Montag in der ersten Planungsspalte, Titel fett (wie text.test.ts). */
function b(over: Partial<Block> = {}): Block {
  return block('e1', 1, {
    date: MO,
    columns: { kind: 'ids', ids: [STD.p1] },
    time: range(480, 720),
    title: rt('Zugsschule', true),
    ...over,
  });
}

/** Standardsatz mit Tagesbreite W, nur Montag sichtbar: Planungsspalte = 2 · W / 9 bei x = X0. */
const lb = (entries: readonly Entry[], W: number, ppm?: number): GridLayout =>
  lege(rasterPlan({ entries }), ppm === undefined ? { W } : { W, ppm });

/** Textfläche des Blocks e1 (Rahmen blockBorder 0,48 → Innenabstand 0,74 pt je Seite). */
const blockFlaeche = (W: number, von: number, bis: number): Rect =>
  textflaeche(feld({ x: X0, w: (2 * W) / 9 }, von, bis), 0.48);

/** Rapport `e1` am Montag in der Rap-Spalte, Anzeige «Rap-Spalte» (wie rapport.test.ts). */
function r(over: Partial<Rapport> = {}): Rapport {
  return rapport('e1', 1, { date: MO, code: 'KR', time: range(780, 825), ...over });
}

/** Textfläche des Rapport-Kästchens (Rahmen rapportBorder 0,96 → Innenabstand 0,98 pt je Seite). */
const rapFlaeche = (W: number, von: number, bis: number): Rect =>
  textflaeche(feld({ x: X0 + (6 * W) / 9, w: W / 9 }, von, bis), 0.96);

const ALLE_ZEILEN: Partial<Block> = {
  supplement: 'Gefechtsdienst',
  ltg: 'Lt Muster B',
  ort: 'Kaserne',
  tn: 'Zug 1',
  tenue: 'Tarnanzug',
  printTn: true,
  printTenue: true,
};

/** Wie im bestehenden Test «schrittweise kleinere Blockhöhe» (text.test.ts). */
const LANG: Partial<Block> = {
  ...ALLE_ZEILEN,
  ltg: 'Hptm Muster A, Oblt Muster B',
  ort: 'Waffenplatz Nord',
};

/** Zeilen als [Text, Grösse, Drehung] in Zeichenreihenfolge. */
const zeilen = (z: readonly TextItem[]) => z.map((t) => [zeilenText(t), t.sizePt, t.rotation]);

/** Einziges Ereignis des Eintrags e1 am Montag, Teilstück 0. */
function ereignis(kind: FallbackEvent['kind'], dropped: FallbackEvent['dropped']): FallbackEvent {
  return { kind, region: 'block', weekId: WOCHE, date: MO, entryId: 'e1', piece: 0, dropped };
}

const breiteVon = (t: TextItem): number =>
  measureRuns(
    t.runs.map((x) => ({ text: x.text, weight: x.weight })),
    t.sizePt,
  );

/** Prüft die Breiten der Zeilen gegen die Fläche (Zeilenlänge senkrecht = Höhe der Fläche). */
function breitenPassen(z: readonly TextItem[], laenge: number): void {
  for (const t of z) {
    expect(breiteVon(t), `Breite «${zeilenText(t)}»`).toBeLessThanOrEqual(laenge + 1e-6);
  }
}

/**
 * Lage senkrechter Zeilen (2e «Lage», Notiz T3, A6): frame = Textfläche; Zeilen von links, Zeilenblock waagrecht
 * zentriert; Zeile i: x = xᵢ + Oberlänge, Grundlinie = senkrechte Mitte + Zeilenbreite / 2.
 */
function senkrechtLage(z: readonly TextItem[], f: Rect): void {
  const summe = z.reduce((a, t) => a + lineHeightPt(t.sizePt), 0);
  let links = f.x + (f.w - summe) / 2;
  z.forEach((t, i) => {
    expect(t.rotation, `Drehung ${i}`).toBe(90);
    rechteckNahe(t.frame, f, 0.01, `frame ${i}`);
    nahe(t.x, links + ascentPt(t.sizePt), 0.01, `x ${i}`);
    nahe(t.baselineY, f.y + (f.h + breiteVon(t)) / 2, 0.01, `Grundlinie ${i}`);
    links += lineHeightPt(t.sizePt);
    zeileImRahmen(t);
  });
}

/**
 * Umriss einer Zeile wie `textOutline` (E1-01b): entlang der Schrift x … x + Breite, quer Grundlinie − Oberlänge …
 * Grundlinie − Unterlänge (Metriken aus fontMetrics()); bei Drehung 90 gedreht (Oberlänge links).
 */
function umriss(t: TextItem): Rect {
  const m = fontMetrics();
  const oben = (m.ascender * t.sizePt) / m.unitsPerEm;
  const unten = (m.descender * t.sizePt) / m.unitsPerEm;
  const w = breiteVon(t);
  return t.rotation === 90
    ? { x: t.x - oben, y: t.baselineY - w, w: oben - unten, h: w }
    : { x: t.x, y: t.baselineY - oben, w, h: oben - unten };
}

/** Überdeckung zweier Rechtecke: kleinere der beiden Überlappungen in x und y (≤ 0 = kein Schnitt). */
function ueberdeckung(a: Rect, c: Rect): number {
  const x = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
  const y = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
  return Math.min(x, y);
}

// ---------------------------------------------------------------------------------------------------------
// Blöcke mit «auto» (A1–A3)
// ---------------------------------------------------------------------------------------------------------

describe('Ausrichtung «auto» in sechs Stufen (Notiz Q-032 A1–A3)', () => {
  it('[R-6-02] [R-10-41] (Notiz Q-032 P1, Stufe 1) Fläche 10,52 × 4,52, «Sport»: waagrecht kein Text, senkrecht «…» → senkrecht «…» 4,5 (normal), ellipsis', () => {
    // Waagrecht: Höhe 4,52 < Zeilenhöhe 4,5 pt (5,17) → textOmitted (Klasse 2). Senkrecht: Zeilenlänge 4,52;
    // «S…» fett 4,5 ist breiter, «…» (4,5) passt, Zeilenhöhe 5,17 ≤ 10,52 → ellipsis (Klasse 1).
    const f = blockFlaeche(54, 480, 500);
    nahe(f.w, 10.52);
    nahe(f.h, 4.52);
    expect(lineHeightPt(4.5)).toBeGreaterThan(f.h);
    expect(measureRuns([{ text: 'S…', weight: 'bold' }], 4.5)).toBeGreaterThan(f.h);
    const L = lb([b({ title: rt('Sport', true), time: range(480, 500) })], 54);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([['…', 4.5, 90]]);
    // «…» ohne Zeichen davor im normalen Schnitt (2e «Kürzung»).
    expect(z[0]?.runs.map((x) => x.weight)).toEqual(['regular']);
    breitenPassen(z, f.h);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([ereignis('ellipsis', [])]);
  });

  it('[R-6-02] [R-10-41] (Notiz Q-032 P2, Stufe 4) Fläche 10,52 × 7,52, «Mö Sch»: waagrecht «M…» (k 1), senkrecht «Mö», «S…» (k 3) → senkrecht', () => {
    const f = blockFlaeche(54, 480, 510);
    nahe(f.w, 10.52);
    nahe(f.h, 7.52);
    const L = lb([b({ title: rt('Mö Sch', true), time: range(480, 510) })], 54);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Mö', 4.5, 90],
      ['S…', 4.5, 90],
    ]);
    // «…» im Schnitt des letzten Zeichens (fett).
    for (const t of z) expect(t.runs.every((x) => x.weight === 'bold')).toBe(true);
    // Zwei Zeilen 4,5 pt nebeneinander: 10,35 ≤ 10,52.
    expect(2 * lineHeightPt(4.5)).toBeLessThanOrEqual(f.w + 1e-6);
    breitenPassen(z, f.h);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([ereignis('ellipsis', [])]);
  });

  it('[R-6-02] (Notiz Q-032 P3, Stufe 1) Fläche 10,52 × 12,02, «Sport»: waagrecht nur «Sp…», senkrecht ganz → senkrecht «Sport» 4,5, kein Ereignis', () => {
    const f = blockFlaeche(54, 480, 525);
    nahe(f.h, 12.02);
    // «Sport» fett: 4,5 pt (11,75) passt in 12,02, 4,75 pt nicht.
    expect(measureRuns([{ text: 'Sport', weight: 'bold' }], 4.5)).toBeLessThanOrEqual(f.h);
    expect(measureRuns([{ text: 'Sport', weight: 'bold' }], 4.75)).toBeGreaterThan(f.h);
    const L = lb([b({ title: rt('Sport', true), time: range(480, 525) })], 54);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([['Sport', 4.5, 90]]);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-02] [R-10-40] (Notiz Q-032 P4, Stufe 2) Fläche 10,52 × 25,52, «Mö Sch» mit Ort: waagrecht ohne Ort (U 1), senkrecht mit Ort (U 0) → senkrecht «Mö Sch», «(Kaserne)» 4,5', () => {
    const f = blockFlaeche(54, 480, 570);
    nahe(f.h, 25.52);
    const L = lb([b({ title: rt('Mö Sch', true), ort: 'Kaserne', time: range(480, 570) })], 54);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Mö Sch', 4.5, 90],
      ['(Kaserne)', 4.5, 90],
    ]);
    expect(z[0]?.runs.map((x) => x.weight)).toEqual(['bold']);
    expect(z[1]?.runs.map((x) => x.weight)).toEqual(['regular']);
    breitenPassen(z, f.h);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-02] (Notiz Q-032 P5, Stufe 3) Fläche 14,52 × 16,52, «Zugsschule»: waagrecht 4,75 (U 2), senkrecht 5 (U 1) → senkrecht «Zugs-», «schule» 5', () => {
    const f = blockFlaeche(72, 480, 540);
    nahe(f.w, 14.52);
    nahe(f.h, 16.52);
    const L = lb([b({ time: range(480, 540) })], 72);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Zugs-', 5, 90],
      ['schule', 5, 90],
    ]);
    // Zwei Zeilen 5 pt: 11,50 ≤ 14,52; in 5,25 pt passt «schule» fett (16,63) nicht in 16,52.
    expect(2 * lineHeightPt(5)).toBeLessThanOrEqual(f.w);
    expect(measureRuns([{ text: 'schule', weight: 'bold' }], 5.25)).toBeGreaterThan(f.h);
    breitenPassen(z, f.h);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-02] (Notiz Q-032 P6, Stufe 5) Fläche 14,52 × 25,52, «Sport» mit Ort: Stufen 1–4 gleich, waagrecht «(Ka-», «serne)» (t 1, U 1) → senkrecht (t 0, U 0)', () => {
    const f = blockFlaeche(72, 480, 570);
    nahe(f.h, 25.52);
    // Waagrecht: «(Kaserne)» in 5 pt (21,95) ist breiter als 14,52 und wird getrennt; senkrecht passt es.
    expect(measureRuns([{ text: '(Kaserne)', weight: 'regular' }], 5)).toBeGreaterThan(f.w);
    expect(measureRuns([{ text: '(Kaserne)', weight: 'regular' }], 5)).toBeLessThanOrEqual(f.h);
    const L = lb([b({ title: rt('Sport', true), ort: 'Kaserne', time: range(480, 570) })], 72);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Sport', 5.5, 90],
      ['(Kaserne)', 5, 90],
    ]);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-02] [R-10-40] (Notiz Q-032 P7, Stufe 2) Fläche 14,52 × 52,52, alle Zeilen: waagrecht entfallen 2 Arten, senkrecht 4 → waagrecht, 10 Zeilen 4,5, lineDropped [tn, tenue]', () => {
    const f = blockFlaeche(72, 480, 660);
    nahe(f.h, 52.52);
    // 10 Zeilen in 4,5 pt: 51,75 ≤ 52,52.
    expect(10 * lineHeightPt(4.5)).toBeLessThanOrEqual(f.h + 1e-6);
    const L = lb([b({ ...ALLE_ZEILEN, time: range(480, 660) })], 72);
    expect(einTeil(L, 'e1').textOrientation).toBe('horizontal');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual(
      ['Zugs-', 'schule', 'Ge-', 'fechts-', 'dienst', 'Lt', 'Muster', 'B', '(Ka-', 'serne)'].map(
        (s) => [s, 4.5, 0],
      ),
    );
    breitenPassen(z, f.w);
    for (const t of z) {
      rechteckNahe(t.frame, f);
      zeileImRahmen(t);
    }
    expect(ereignisse(L, 'e1')).toEqual([ereignis('lineDropped', ['tn', 'tenue'])]);
  });

  it('[R-6-02] (Notiz Q-032 P8, Stufe 3) Fläche 28,52 × 70,52, alle Zeilen: waagrecht Standardgrösse (d 0), senkrecht verkleinert → waagrecht, kein Ereignis', () => {
    const f = blockFlaeche(135, 480, 720);
    nahe(f.w, 28.52);
    nahe(f.h, 70.52);
    const L = lb([b({ ...ALLE_ZEILEN, time: range(480, 720) })], 135);
    expect(einTeil(L, 'e1').textOrientation).toBe('horizontal');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Zugsschu-', 5.5, 0],
      ['le', 5.5, 0],
      ['Gefechts-', 5, 0],
      ['dienst', 5, 0],
      ['Lt Muster B', 5, 0],
      ['(Kaserne)', 5, 0],
      ['Tn: Zug 1', 5, 0],
      ['Tenue', 5, 0],
      ['Tarnanzug', 5, 0],
    ]);
    // 2 · 6,32 + 7 · 5,75 = 52,90 ≤ 70,52.
    expect(2 * lineHeightPt(5.5) + 7 * lineHeightPt(5)).toBeLessThanOrEqual(f.h);
    breitenPassen(z, f.w);
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-02] (Notiz Q-032 P15, Stufe 3, V-02d-22) Fläche 78,52 × 34,52, «Zugsschule» mit langer Ltg: senkrecht grösser, aber U 4 > 1 → waagrecht 5,25 / 4,75 in 6 Zeilen', () => {
    const f = blockFlaeche(360, 480, 600);
    nahe(f.w, 78.52);
    nahe(f.h, 34.52);
    const L = lb([b({ ...LANG, time: range(480, 600) })], 360);
    expect(einTeil(L, 'e1').textOrientation).toBe('horizontal');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Zugsschule', 5.25, 0],
      ['Gefechtsdienst', 4.75, 0],
      ['Hptm Muster A, Oblt Muster B', 4.75, 0],
      ['(Waffenplatz Nord)', 4.75, 0],
      ['Tn: Zug 1', 4.75, 0],
      ['Tenue Tarnanzug', 4.75, 0],
    ]);
    // 6,04 + 5 · 5,46 = 33,35 ≤ 34,52; in 5,5 / 5 pt (6,32 + 5 · 5,75 = 35,07) nicht.
    expect(lineHeightPt(5.25) + 5 * lineHeightPt(4.75)).toBeLessThanOrEqual(f.h);
    expect(lineHeightPt(5.5) + 5 * lineHeightPt(5)).toBeGreaterThan(f.h);
    breitenPassen(z, f.w);
    for (const t of z) {
      rechteckNahe(t.frame, f);
      zeileImRahmen(t);
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
  it('[R-6-02] (Notiz Q-032 Stufe 2, F-23-Ausnahme, P20) Fläche 26,52 × 34,52, «Wachtdienst» mit langer Ltg und Ort: senkrecht ohne entfallene Zeile trotz U 3 > 2, weil F-23 erfüllt → senkrecht «Wachtdienst» 5, Ltg/Ort je 4,5', () => {
    // Waagrecht: «Wacht-», «dienst» 5,5, «(Waffen-», «platz Nord)» 5, lineDropped [ltg] (L 1, U 2). Senkrecht:
    // «Wachtdienst» 5, «Hptm Muster A,», «Oblt Muster B», «(Waffenplatz», «Nord)» 4,5 (L 0, U 3). Stufe 2: U(S) > U(W),
    // aber die F-23-Bedingung gilt: «Wachtdienst» fett 5,5 (32,70) passt waagrecht nicht in 26,52 und senkrecht in
    // 34,52. An HEAD (F-23) ebenfalls senkrecht: Regressionsschutz für die Ausnahme.
    const f = blockFlaeche(126, 480, 600);
    nahe(f.w, 26.52);
    nahe(f.h, 34.52);
    const titel55 = measureRuns([{ text: 'Wachtdienst', weight: 'bold' }], 5.5);
    expect(titel55).toBeGreaterThan(f.w);
    expect(titel55).toBeLessThanOrEqual(f.h);
    // Senkrecht: 5,75 + 4 · 5,17 = 26,45 ≤ 26,52; eine Stufe grösser (6,04 + 4 · 5,46 = 27,89) nicht.
    expect(lineHeightPt(5) + 4 * lineHeightPt(4.5)).toBeLessThanOrEqual(f.w);
    expect(lineHeightPt(5.25) + 4 * lineHeightPt(4.75)).toBeGreaterThan(f.w);
    const L = lb(
      [
        b({
          title: rt('Wachtdienst', true),
          ltg: 'Hptm Muster A, Oblt Muster B',
          ort: 'Waffenplatz Nord',
          time: range(480, 600),
        }),
      ],
      126,
    );
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Wachtdienst', 5, 90],
      ['Hptm Muster A,', 4.5, 90],
      ['Oblt Muster B', 4.5, 90],
      ['(Waffenplatz', 4.5, 90],
      ['Nord)', 4.5, 90],
    ]);
    breitenPassen(z, f.h);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Rapport-Kästchen und Rapport-Block (A1, A3, A4: immer «auto»)
// ---------------------------------------------------------------------------------------------------------

describe('Rapport-Kästchen und Rapport-Block in sechs Stufen (Notiz Q-032 A1–A4)', () => {
  it('[R-4.6-21] (Notiz Q-032 P10, Stufe 3) Rap-Spalte 9 pt, «KR» 1300-1345, Fläche 7,04 × 11,54: waagrecht 4,75, senkrecht 5 (U 0 ≤ 0) → senkrecht «KR» fett 5', () => {
    const f = rapFlaeche(81, 780, 825);
    nahe(f.w, 7.04);
    nahe(f.h, 11.54);
    // «KR» fett 5 pt (7,22) ist breiter als 7,04, passt aber senkrecht (Zeilenhöhe 5,75 ≤ 7,04).
    expect(measureRuns([{ text: 'KR', weight: 'bold' }], 5)).toBeGreaterThan(f.w);
    expect(lineHeightPt(5)).toBeLessThanOrEqual(f.w);
    const L = lege(rasterPlan({ entries: [r()] }), { W: 81 });
    expect(einTeil(L, 'e1', 'rapportBox').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([['KR', 5, 90]]);
    expect(z[0]?.runs.map((x) => x.weight)).toEqual(['bold']);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-21] [R-10-41] (Notiz Q-032 P11, Stufe 4; E1-02l R2) Rap-Spalte 8 pt, «Uof Rap», Fläche 6,04 × 11,54: passt weder waagrecht noch senkrecht → kein «…», Kürzel vollständig im Träger neben dem Kästchen, labelOutside', () => {
    const f = rapFlaeche(72, 780, 825);
    nahe(f.w, 6.04);
    nahe(f.h, 11.54);
    const L = lege(rasterPlan({ entries: [r({ code: 'Uof Rap' })] }), { W: 72 });
    // E1-02l R2 (TE-E102l-01): nie gekürzt; im Kästchen kein Text, das Kürzel steht im Träger daneben.
    expect(einTeil(L, 'e1', 'rapportBox').textOrientation).toBeNull();
    const traeger = einTeil(L, 'e1', 'outsideLabel');
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Uof Rap']);
    expect(z[0]?.sizePt).toBeGreaterThanOrEqual(4.5);
    expect(z[0]?.runs.every((x) => x.weight === 'bold')).toBe(true);
    for (const t of z) zeileImRahmen(t);
    expect(z[0]?.frame.x).toBeGreaterThanOrEqual(traeger.rect.x - 0.01);
    expect(ereignisse(L, 'e1')).toEqual([{ ...ereignis('labelOutside', []), piece: 1 }]);
  });

  it('[R-4.6-21] (Notiz Q-032 P12, Stufe 5) Rap-Spalte 15 pt, «KR» mit Ort, Fläche 13,04 × 25,04: waagrecht Ort dreifach getrennt (t 2, U 2) → senkrecht «KR», «(Kaserne)» 5, Zeilenblock zentriert', () => {
    const f = rapFlaeche(135, 780, 870);
    nahe(f.w, 13.04);
    nahe(f.h, 25.04);
    // Senkrecht: zwei Zeilen 5 pt (11,50) ≤ 13,04; «(Kaserne)» 5 pt (21,95) ≤ 25,04.
    expect(2 * lineHeightPt(5)).toBeLessThanOrEqual(f.w);
    expect(measureRuns([{ text: '(Kaserne)', weight: 'regular' }], 5)).toBeLessThanOrEqual(f.h);
    const L = lege(rasterPlan({ entries: [r({ time: range(780, 870), ort: 'Kaserne' })] }), {
      W: 135,
    });
    expect(einTeil(L, 'e1', 'rapportBox').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['KR', 5, 90],
      ['(Kaserne)', 5, 90],
    ]);
    expect(z.map((t) => t.runs.map((x) => x.weight))).toEqual([['bold'], ['regular']]);
    // A6: «oben bündig» gilt nur waagrecht; senkrecht ist der Zeilenblock waagrecht zentriert.
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-21] [R-6-02] (Notiz Q-032 P19, Stufe 3, V-02d-22) Rapport-Block «AR2» 0430 über zwei Spalten, 0,45 pt/Min, Fläche 158,52 × 12,02: senkrecht «0430» 5, «AR2» fett 5,5 (U 0 ≤ 0)', () => {
    // Gezeichnet [0500, 0530] (Zuschnitt), Höhe 13,5 → Textfläche 12,02; Spalten p1 + p2 = 4 · 360 / 9 = 160.
    const f = textflaeche(feld({ x: X0, w: 160 }, 300, 330, 240, 0.45), 0.48);
    nahe(f.w, 158.52);
    nahe(f.h, 12.02);
    // Waagrecht passen beide Zeilen erst in 5,25 / 4,75 pt (11,50), in 5,5 / 5 pt (12,07) nicht.
    expect(lineHeightPt(5.5) + lineHeightPt(5)).toBeGreaterThan(f.h);
    expect(lineHeightPt(5.25) + lineHeightPt(4.75)).toBeLessThanOrEqual(f.h);
    // Senkrecht: «AR2» fett 5,5 (11,00) und «0430» 5 (11,12) ≤ 12,02.
    expect(measureRuns([{ text: 'AR2', weight: 'bold' }], 5.5)).toBeLessThanOrEqual(f.h);
    expect(measureRuns([{ text: '0430', weight: 'regular' }], 5)).toBeLessThanOrEqual(f.h);
    const L = lb(
      [
        r({
          code: 'AR2',
          time: { form: 'point', at: 270 },
          display: 'onlyInColumns',
          displayColumns: { kind: 'ids', ids: [STD.p1, STD.p2] },
        }),
      ],
      360,
      0.45,
    );
    const p = einTeil(L, 'e1', 'block');
    rechteckNahe(p.rect, feld({ x: X0, w: 160 }, 300, 330, 240, 0.45));
    expect(p.openTop).toBe(true);
    expect(p.textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['0430', 5, 90],
      ['AR2', 5.5, 90],
    ]);
    expect(z.map((t) => t.runs.map((x) => x.weight))).toEqual([['regular'], ['bold']]);
    senkrechtLage(z, f);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Übersteuerung (A4)
// ---------------------------------------------------------------------------------------------------------

describe('Übersteuerung je Block (Notiz Q-032 A4)', () => {
  it('[R-6-03] (Notiz Q-032 P13) wie P5 mit «waagrecht»: kein Vergleich, waagrecht «Zugs-», «schu-», «le» je 4,75', () => {
    const f = blockFlaeche(72, 480, 540);
    const L = lb([b({ time: range(480, 540), textDirection: 'horizontal' })], 72);
    expect(einTeil(L, 'e1').textOrientation).toBe('horizontal');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Zugs-', 4.75, 0],
      ['schu-', 4.75, 0],
      ['le', 4.75, 0],
    ]);
    // Drei Zeilen 4,75 pt: 16,39 ≤ 16,52; in 5 pt (17,25) nicht.
    expect(3 * lineHeightPt(4.75)).toBeLessThanOrEqual(f.h);
    expect(3 * lineHeightPt(5)).toBeGreaterThan(f.h);
    breitenPassen(z, f.w);
    for (const t of z) {
      rechteckNahe(t.frame, f);
      zeileImRahmen(t);
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-6-03] (Notiz Q-032 A4) wie P5 mit «senkrecht»: gleiches Ergebnis wie die Wahl bei «auto»', () => {
    const v = lb([b({ time: range(480, 540), textDirection: 'vertical' })], 72);
    const a = lb([b({ time: range(480, 540), textDirection: 'auto' })], 72);
    expect(einTeil(v, 'e1').textOrientation).toBe('vertical');
    expect(zeilen(texte(v, 'e1'))).toEqual([
      ['Zugs-', 5, 90],
      ['schule', 5, 90],
    ]);
    expect(texte(a, 'e1')).toEqual(texte(v, 'e1'));
    expect(ereignisse(v, 'e1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Einzeilige Texte bleiben waagrecht (A5)
// ---------------------------------------------------------------------------------------------------------

describe('Einzeilige Texte bleiben waagrecht (Notiz Q-032 A5)', () => {
  it('[R-4.6-42] (Notiz Q-032 P16, V-02d-23; E1-02l R2) Beso «123» in der Beso-Bahn, Fläche 5,29 × 7,63: waagrecht passt nicht, senkrecht schon → senkrecht 4,5 pt, kein Ereignis', () => {
    // W 60: Beso-Spalte 13,33 pt, Bahn 6,67 pt; Innenabstand 0,5 + 0,1875. «123» in 4,5 pt = 7,51 pt.
    const B = 60 / 9 - 2 * (0.5 + 0.375 / 2);
    const H = 30 * 0.3 - 2 * (0.5 + 0.375 / 2);
    nahe(B, 5.29);
    nahe(H, 7.63);
    const breite = measureRuns([{ text: '123', weight: 'regular' }], 4.5);
    expect(breite).toBeGreaterThan(B);
    expect(breite).toBeLessThanOrEqual(H);
    expect(lineHeightPt(4.5)).toBeLessThanOrEqual(B);
    const L = lb(
      [
        beso('e1', 1, {
          date: MO,
          windows: [win('t1', { time: { form: 'point', at: 810 }, columnId: null })],
          besoNumber: 123,
        }),
      ],
      60,
    );
    rechteckNahe(einTeil(L, 'e1', 'besoBox').rect, feld({ x: X0 + 140 / 3, w: 60 / 9 }, 810, 840));
    // E1-02l R2 (TE-E102l-01): Nummer nie weggelassen; waagrecht passt nicht, senkrecht in 4,5 pt schon.
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['123']);
    expect(texte(L, 'e1').map((t) => [t.sizePt, t.rotation])).toEqual([[4.5, 90]]);
    expect(einTeil(L, 'e1', 'besoBox').textOrientation).toBe('vertical');
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-05] (Notiz Q-032 P17, V-02d-23) Querbalken «WK» in einer Spalte von 8 pt, Fläche 6,63 × 7,63: «…» 4,5 waagrecht, ellipsis, keine Drehung', () => {
    // W 36: Spalte p1 = 8 pt; Lage 0 = [0430, 0500], 9 pt hoch; Innenabstand 0,5 + 0,1875.
    const B = 8 - 2 * (0.5 + 0.375 / 2);
    const H = 30 * 0.3 - 2 * (0.5 + 0.375 / 2);
    nahe(B, 6.63);
    nahe(H, 7.63);
    // «WK» in 4,5 pt (7,25) ist breiter als 6,63, senkrecht passte es; «W…» (8,75) passt nicht, «…» (4,5) schon.
    expect(measureRuns([{ text: 'WK', weight: 'regular' }], 4.5)).toBeGreaterThan(B);
    expect(measureRuns([{ text: 'WK', weight: 'regular' }], 4.5)).toBeLessThanOrEqual(H);
    expect(measureRuns([{ text: 'W…', weight: 'regular' }], 4.5)).toBeGreaterThan(B);
    const L = lb(
      [
        querbalken('e1', 1, {
          fromDate: MO,
          toDate: MO,
          columns: { kind: 'ids', ids: [STD.p1] },
          title: rt('WK'),
        }),
      ],
      36,
    );
    rechteckNahe(einTeil(L, 'e1', 'querbalken').rect, feld({ x: X0, w: 8 }, 270, 300));
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([['…', 4.5, 0]]);
    expect(L.items.some((i) => i.kind === 'text' && i.rotation === 90)).toBe(false);
    expect(einTeil(L, 'e1', 'querbalken').textOrientation).toBe('horizontal');
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1')).toEqual([ereignis('ellipsis', [])]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Ausweichen bis zur äusseren Strichkante (A9, Befund E1-02d-AV-01)
// ---------------------------------------------------------------------------------------------------------

describe('Ausweichen an der äusseren Strichkante (Notiz Q-032 A9)', () => {
  it('[R-10-40] (Notiz Q-032 P18, A9, E1-02d-AV-01) Block 0800-0925 unter Marker AV 0805: frame beginnt an der äusseren Feldkante 141,47; senkrecht «Zugs-», «schule» 4,75; kein Umriss im Feldstrich', () => {
    // Entscheid Auftraggeber 21.10.2026: Marker gelten über alle Planungsspalten. Damit das Feld wie bisher
    // genau über p1 liegt, hat der Tag nur die Planungsspalte p1 (p1, Rap, Beso: 5 Einheiten zu 7 pt).
    // W 35: Spalte p1 14 pt. y(0805) = 60 + 245 · 0,3 = 133,5. Feldhöhe max(4,5; 5,75 + 2 · 0,74) = 7,23.
    const feldHoehe = lineHeightPt(5) + 2 * (0.5 + 0.48 / 2);
    const aussenUnten = 134 + feldHoehe + 0.24;
    nahe(aussenUnten, 141.47);
    const ein = satz('s91', [
      { id: STD.p1, kind: 'planning' },
      { id: STD.rap, kind: 'rap' },
      { id: STD.beso, kind: 'beso' },
    ]);
    const L = lege(
      rasterPlan({
        sets: [ein],
        tage: nurMontag('s91'),
        entries: [
          b({ time: range(480, 565) }),
          marker('e2', 2, { date: MO, at: 485, kind: 'AV', columns: { kind: 'all' } }),
        ],
      }),
      { W: 35 },
    );
    rechteckNahe(einTeil(L, 'e2', 'markerLine').rect, { x: 30, y: 132.72, w: 14, h: 1.56 });
    const feldTeil = einTeil(L, 'e2', 'markerField');
    rechteckNahe(feldTeil.rect, { x: 30, y: 134, w: 14, h: feldHoehe });
    const aussen: Rect = {
      x: feldTeil.rect.x - 0.24,
      y: feldTeil.rect.y - 0.24,
      w: feldTeil.rect.w + 0.48,
      h: feldTeil.rect.h + 0.48,
    };
    rechteckNahe(aussen, { x: 29.76, y: 133.76, w: 14.48, h: 7.71 });
    // Textfläche: x 30,74, Unterkante y(0925) − 0,74 = 156,76; Höhe 156,76 − 141,47 = 15,29.
    const f: Rect = { x: 30.74, y: aussenUnten, w: 12.52, h: 157.5 - 0.74 - aussenUnten };
    nahe(f.h, 15.29);
    // Senkrecht in 4,75 pt: «schule» fett 15,05 ≤ 15,29, zwei Zeilen 10,92 ≤ 12,52; waagrecht drei Zeilen
    // 4,5 pt (15,52) > 15,29.
    expect(measureRuns([{ text: 'schule', weight: 'bold' }], 4.75)).toBeLessThanOrEqual(f.h);
    expect(3 * lineHeightPt(4.5)).toBeGreaterThan(f.h);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(zeilen(z)).toEqual([
      ['Zugs-', 4.75, 90],
      ['schule', 4.75, 90],
    ]);
    senkrechtLage(z, f);
    for (const t of z) {
      expect(
        ueberdeckung(umriss(t), aussen),
        `«${zeilenText(t)}» im Feldstrich`,
      ).toBeLessThanOrEqual(0.001);
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
});

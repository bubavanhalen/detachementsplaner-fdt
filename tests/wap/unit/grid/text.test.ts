// @vitest-environment jsdom
// Paket E1-02d: Text der Blöcke – Zeilen, Grössen, Rückfallregel, Ausrichtung, Ausweichen, Zeitzeile
// (Vertrag E1-02d Abschnitt 2e; Änderungsnotizen V01, V02, Runde 2 V13, V14, V16, V18, V19; Beschrieb 6, 10
// «Rückfallregel»; F-23, F-61). Fiktive Pläne, Standardrahmen 0400–2400 mit 0,3 pt/min.
import { describe, expect, it } from 'vitest';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Block, Entry } from '../../../../src/model/wap/types';
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
  teile,
  texte,
  texteIn,
  textflaeche,
  WOCHE,
  X0,
  yZeit,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import { beso, block, marker, rt, win } from '../../support/model/builders';

const range = (from: number, to: number) => ({ form: 'range' as const, from, to });

function b(id: string, seq: number, over: Partial<Block> = {}): Block {
  return block(id, seq, {
    date: MO,
    columns: { kind: 'ids', ids: [STD.p1] },
    time: range(480, 720),
    title: rt('Zugsschule', true),
    ...over,
  });
}

/** Standardsatz mit Tagesbreite W: Planungsspalte = 2 · W / 9. */
const lb = (entries: readonly Entry[], W: number): GridLayout =>
  lege(rasterPlan({ entries }), { W });
/** Planungsspalte 80 pt (Textbreite 78,52 pt). */
const BREIT = 360;
/** Planungsspalte 40 pt (Textbreite 38,52 pt). */
const MITTEL = 180;
/** Planungsspalte 12 pt (Textbreite 10,52 pt). */
const SCHMAL = 54;

const ALLE_ZEILEN: Partial<Block> = {
  supplement: 'Gefechtsdienst',
  ltg: 'Lt Muster B',
  ort: 'Kaserne',
  tn: 'Zug 1',
  tenue: 'Tarnanzug',
  printTn: true,
  printTenue: true,
};

const REIHENFOLGE = ['tn', 'tenue', 'ltg', 'ort', 'supplement'] as const;

describe('Blockzeilen (2e; V-02d-7, V-02d-9)', () => {
  it('[R-10-40] (V-02d-7) Zeilen Titel, Zusatz, «Ltg (Ort)», «Tn: …», «Tenue …»; Titel fett 5,5, übrige normal 5', () => {
    const L = lb([b('e1', 1, ALLE_ZEILEN)], BREIT);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual([
      'Zugsschule',
      'Gefechtsdienst',
      'Lt Muster B (Kaserne)',
      'Tn: Zug 1',
      'Tenue Tarnanzug',
    ]);
    expect(z.map((t) => t.sizePt)).toEqual([5.5, 5, 5, 5, 5]);
    expect(z[0]?.runs.map((r) => r.weight)).toEqual(['bold']);
    for (const t of z.slice(1)) expect(t.runs.every((r) => r.weight === 'regular')).toBe(true);
    for (const t of z) {
      expect(t.role).toBe('block');
      expect(t.rotation).toBe(0);
      expect(t.runs.every((r) => r.strike === false)).toBe(true);
      expect(t.runs.every((r) => r.color.r === 0 && r.color.g === 0 && r.color.b === 0)).toBe(true);
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-10-40] (V-02d-9) Lage: Textfläche = Teilstück − (0,5 + halbe Rahmenbreite); Zeilen zentriert, Grundlinie = Oberkante + Oberlänge', () => {
    const L = lb([b('e1', 1, ALLE_ZEILEN)], BREIT);
    const f = textflaeche(feld({ x: X0, w: 80 }, 480, 720), 0.48);
    const z = texte(L, 'e1');
    const hoehen = z.map((t) => lineHeightPt(t.sizePt));
    let oben = f.y + (f.h - hoehen.reduce((a, c) => a + c, 0)) / 2;
    z.forEach((t, i) => {
      rechteckNahe(t.frame, f, 0.01, `frame ${i}`);
      const breite = measureRuns(
        t.runs.map((r) => ({ text: r.text, weight: r.weight })),
        t.sizePt,
      );
      nahe(t.x, f.x + (f.w - breite) / 2, 0.01, `x ${i}`);
      nahe(t.baselineY, oben + ascentPt(t.sizePt), 0.01, `Grundlinie ${i}`);
      oben += hoehen[i] as number;
      zeileImRahmen(t);
    });
  });

  it('[R-10-40] (V-02d-7) nur Ltg «‹Ltg›», nur Ort «(‹Ort›)»; Tn und Tenue ohne Häkchen nicht gedruckt; Leerraum inkl. U+00A0 am Rand getrimmt, leere Felder entfallen', () => {
    const L = lb(
      [
        b('e1', 1, { ltg: '\u00a0Lt Muster B\u00a0 ', tn: 'Zug 1', tenue: 'Tarnanzug' }),
        b('e2', 2, {
          ort: ' \u00a0Kaserne\u00a0',
          columns: { kind: 'ids', ids: [STD.p2] },
          supplement: '\u00a0 ',
        }),
        b('e3', 3, {
          title: [
            { text: '  Mö ', bold: false },
            { text: 'Sch\u00a0', bold: true },
          ],
          columns: { kind: 'ids', ids: [STD.p3] },
        }),
      ],
      BREIT,
    );
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Zugsschule', 'Lt Muster B']);
    expect(texte(L, 'e2').map(zeilenText)).toEqual(['Zugsschule', '(Kaserne)']);
    const t3 = texte(L, 'e3');
    expect(t3.map(zeilenText)).toEqual(['Mö Sch']);
    expect(t3[0]?.runs.map((r) => [r.text, r.weight])).toEqual([
      ['Mö ', 'regular'],
      ['Sch', 'bold'],
    ]);
  });

  it('[R-10-40] (V-02d-8) Weglassen vor Verkleinern: nach dem Weglassen von Tn wieder Standardgrösse', () => {
    // Fläche 24,02 pt hoch: alle fünf Zeilen passen auch in 4,5 pt nicht (25,87 pt), ohne Tn passen sie in 5,5 / 5 pt (23,57 pt).
    const L = lb([b('e1', 1, { ...ALLE_ZEILEN, time: range(480, 565) })], BREIT);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual([
      'Zugsschule',
      'Gefechtsdienst',
      'Lt Muster B (Kaserne)',
      'Tenue Tarnanzug',
    ]);
    expect(z.map((t) => t.sizePt)).toEqual([5.5, 5, 5, 5]);
    expect(ereignisse(L, 'e1')).toEqual([
      {
        kind: 'lineDropped',
        region: 'block',
        weekId: WOCHE,
        date: MO,
        entryId: 'e1',
        piece: 0,
        dropped: ['tn'],
      },
    ]);
  });
});

describe('Rückfallregel (2e; R-10-40, R-10-41; F-61)', () => {
  /** Lange Ltg: «Ltg (Ort)» braucht in 78,52 pt zwei Zeilen, «(Ort)» allein eine. */
  const LANG: Partial<Block> = {
    ...ALLE_ZEILEN,
    ltg: 'Hptm Muster A, Oblt Muster B',
    ort: 'Waffenplatz Nord',
  };
  /** Zeilen je Weglassstufe L: Titel, Zusatz, Ltg/Ort (2 bzw. 1), Tn, Tenue. */
  const ZEILEN_JE_STUFE = [6, 5, 4, 3, 2, 1];

  it('[R-10-40] schrittweise kleinere Blockhöhe → dropped wächst genau in der Reihenfolge tn, tenue, ltg, ort, supplement', () => {
    const gesehen = new Set<number>();
    let vorher = 0;
    for (let dauer = 140; dauer >= 25; dauer -= 5) {
      const L = lb([b('e1', 1, { ...LANG, time: range(480, 480 + dauer) })], BREIT);
      const ev = ereignisse(L, 'e1');
      const dropped = ev[0]?.dropped ?? [];
      expect(ev.length, `höchstens ein Ereignis bei ${dauer} Min`).toBeLessThanOrEqual(1);
      if (ev.length === 1) expect(ev[0]?.kind, `${dauer} Min`).toBe('lineDropped');
      expect(dropped, `${dauer} Min`).toEqual(REIHENFOLGE.slice(0, dropped.length));
      expect(dropped.length, `${dauer} Min: nie weniger als vorher`).toBeGreaterThanOrEqual(vorher);
      // Erwartete Stufe: kleinstes L, dessen Zeilen in Mindestgrösse (4,5 pt) in die Fläche passen.
      const h = dauer * 0.3 - 2 * 0.74;
      const soll = ZEILEN_JE_STUFE.findIndex((n) => n * lineHeightPt(4.5) <= h + 1e-6);
      expect(dropped.length, `${dauer} Min`).toBe(soll);
      const text = texte(L, 'e1').map(zeilenText).join(' | ');
      expect(text.startsWith('Zugsschule'), `${dauer} Min: Titel bleibt`).toBe(true);
      if (dropped.includes('tn')) expect(text).not.toContain('Tn:');
      if (dropped.includes('ltg')) expect(text).not.toContain('Muster');
      if (dropped.includes('ltg') && !dropped.includes('ort'))
        expect(text).toContain('(Waffenplatz Nord)');
      if (dropped.includes('supplement')) expect(text).not.toContain('Gefechtsdienst');
      for (const t of texte(L, 'e1')) {
        expect(t.sizePt).toBeGreaterThanOrEqual(4.5);
        zeileImRahmen(t);
      }
      vorher = dropped.length;
      gesehen.add(dropped.length);
    }
    expect([...gesehen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('[R-10-41] (V-02d-9) nur Titel, passt nicht: eine Zeile mit «…» (längstes Anfangsstück, Mindestgrösse), im frame, ellipsis', () => {
    const titel = 'Gefechtsausbildung im Zug';
    const L = lb(
      [b('e1', 1, { title: rt(titel, true), time: range(480, 510), textDirection: 'horizontal' })],
      MITTEL,
    );
    const f = textflaeche(feld({ x: X0, w: 40 }, 480, 510), 0.48);
    // Orakel nach 2e «Kürzung»: längstes Anfangsstück (ohne Leerzeichen am Ende), das mit «…» in 4,5 pt passt.
    const punkte = [...titel];
    let soll = '…';
    for (let k = punkte.length; k >= 0; k--) {
      const p = punkte.slice(0, k).join('').trimEnd();
      if (measureRuns([{ text: `${p}…`, weight: 'bold' }], 4.5) <= f.w) {
        soll = `${p}…`;
        break;
      }
    }
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual([soll]);
    expect(soll).toBe('Gefechtsausbil…');
    expect(z[0]?.sizePt).toBe(4.5);
    expect(z[0]?.runs.every((r) => r.weight === 'bold')).toBe(true);
    rechteckNahe(z[0]?.frame ?? f, f);
    for (const t of z) zeileImRahmen(t);
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

  it('[R-10-41] mit Zusatzzeilen: erst alle Zusatzzeilen weg, dann Kürzung; dropped nennt alle entfallenen Arten', () => {
    const L = lb(
      [
        b('e1', 1, {
          ...ALLE_ZEILEN,
          title: rt('Gefechtsausbildung im Zug', true),
          time: range(480, 510),
          textDirection: 'horizontal',
        }),
      ],
      MITTEL,
    );
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Gefechtsausbil…']);
    const ev = ereignisse(L, 'e1');
    expect(ev.map((e) => e.kind)).toEqual(['ellipsis']);
    expect(ev[0]?.dropped).toEqual(['tn', 'tenue', 'ltg', 'ort', 'supplement']);
  });

  it('[R-10-41] (V18) Blöcke 5 und 10 Min mit allen drei Textrichtungen: keine Ausnahme, kein Text, je genau ein textOmitted', () => {
    const sechs = satz('s60', [
      { id: 'q1', kind: 'planning' },
      { id: 'q2', kind: 'planning' },
      { id: 'q3', kind: 'planning' },
      { id: 'q4', kind: 'planning' },
      { id: 'q5', kind: 'planning' },
      { id: 'q6', kind: 'planning' },
      { id: 'q7', kind: 'rap' },
      { id: 'q8', kind: 'beso' },
    ]);
    const richtungen = ['auto', 'horizontal', 'vertical'] as const;
    const entries: Block[] = [];
    let i = 0;
    for (const dauer of [5, 10]) {
      for (const textDirection of richtungen) {
        i += 1;
        entries.push(
          b(`e${i}`, i, {
            columns: { kind: 'ids', ids: [`q${i}`] },
            time: range(480, 480 + dauer),
            textDirection,
          }),
        );
      }
    }
    const L = lege(rasterPlan({ sets: [sechs], tage: nurMontag('s60'), entries }), { W: 600 });
    for (const e of entries) {
      expect(texte(L, e.id), e.id).toEqual([]);
      expect(ereignisse(L, e.id), e.id).toEqual([
        {
          kind: 'textOmitted',
          region: 'block',
          weekId: WOCHE,
          date: MO,
          entryId: e.id,
          piece: 0,
          dropped: [],
        },
      ]);
      expect(einTeil(L, e.id).textOrientation, e.id).toBeNull();
    }
  });

  it('[R-10-41] (V18) 20 gleichzeitige Blöcke in derselben Spalte (je 1 pt breit): keine Ausnahme, je textOmitted', () => {
    const entries = Array.from({ length: 20 }, (_, k) => b(`e${k + 1}`, k + 1));
    const L = lb(entries, 90);
    for (const e of entries) {
      expect(einTeil(L, e.id).rect.w).toBeLessThan(1.48);
      expect(texte(L, e.id)).toEqual([]);
      expect(ereignisse(L, e.id).map((x) => x.kind)).toEqual(['textOmitted']);
    }
  });

  it('[R-10-41] (V16 a, V-02d-17) Block 0430-0500 in Spalte ≥ 40 pt: nur die Zeitzeile «0430-0500», Ereignis ellipsis', () => {
    const L = lb([b('e1', 1, { time: range(270, 300), title: rt('Tagwache', true) })], MITTEL);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: X0, w: 40 }, 300, 330));
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['0430-0500']);
    expect(ereignisse(L, 'e1').map((e) => [e.kind, e.dropped])).toEqual([['ellipsis', []]]);
  });

  it('[R-10-40] (V19 f, V-02d-17) Block 0430-0600 mit allen Zusatzzeilen, knapp: Zeilen entfallen nach F-61, die Zeitzeile bleibt', () => {
    // Fläche 16,52 pt: Zeitzeile, Titel, Zusatz passen in 4,5 / 5 / 4,5 pt; mit «(Kaserne)» nicht mehr.
    const L = lb([b('e1', 1, { ...ALLE_ZEILEN, time: range(270, 360) })], BREIT);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['0430-0600', 'Zugsschule', 'Gefechtsdienst']);
    expect(z.map((t) => t.sizePt)).toEqual([4.5, 5, 4.5]);
    const ev = ereignisse(L, 'e1');
    expect(ev.map((e) => [e.kind, e.dropped])).toEqual([
      ['lineDropped', ['tn', 'tenue', 'ltg', 'ort']],
    ]);
  });
});

describe('Ausrichtung (2e; R-6-02, R-6-03; F-23)', () => {
  it('[R-6-02] «auto», ein Wort breiter als die Textfläche, senkrecht passend → senkrecht (Drehung 90), kein Ereignis', () => {
    const L = lb([b('e1', 1, { title: rt('Schiessausbildung', true) })], SCHMAL);
    const p = einTeil(L, 'e1');
    expect(p.textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Schiessausbildung']);
    expect(z[0]?.rotation).toBe(90);
    expect(z[0]?.sizePt).toBe(5.5);
    expect(ereignisse(L, 'e1')).toEqual([]);
    // Lage senkrecht (2e): Zeilenblock waagrecht zentriert, Zeile senkrecht zentriert.
    const f = textflaeche(feld({ x: X0, w: 12 }, 480, 720), 0.48);
    const t = z[0];
    if (t === undefined) return;
    const breite = measureRuns([{ text: 'Schiessausbildung', weight: 'bold' }], 5.5);
    nahe(t.x, f.x + (f.w - lineHeightPt(5.5)) / 2 + ascentPt(5.5));
    nahe(t.baselineY, f.y + (f.h + breite) / 2);
    zeileImRahmen(t);
  });

  it('[R-6-02] «auto» ohne Trennung im Wort (F-23): Wort passt waagrecht nur getrennt → senkrecht', () => {
    const L = lb([b('e1', 1, { title: rt('Schiessausbildung', true) })], MITTEL);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    expect(texte(L, 'e1').every((t) => t.rotation === 90)).toBe(true);
  });

  it('[R-6-02] «auto», Titel passt waagrecht → waagrecht; passt auch senkrecht nicht → waagrecht', () => {
    const L1 = lb([b('e1', 1, { title: rt('Sport', true) })], MITTEL);
    expect(einTeil(L1, 'e1').textOrientation).toBe('horizontal');
    expect(texte(L1, 'e1').map((t) => t.rotation)).toEqual([0]);
    const L2 = lb(
      [b('e2', 2, { title: rt('Schiessausbildung', true), time: range(480, 510) })],
      SCHMAL,
    );
    expect(einTeil(L2, 'e2').textOrientation).toBe('horizontal');
    expect(texte(L2, 'e2').every((t) => t.rotation === 0)).toBe(true);
  });

  it('[R-6-03] «waagrecht», «senkrecht», «auto» wirken je wie festgelegt (gleicher Block)', () => {
    const fall = (textDirection: Block['textDirection']) =>
      lb([b('e1', 1, { title: rt('Schiessausbildung', true), textDirection })], SCHMAL);
    const h = fall('horizontal');
    expect(einTeil(h, 'e1').textOrientation).toBe('horizontal');
    expect(texte(h, 'e1').length).toBeGreaterThan(0);
    expect(texte(h, 'e1').every((t) => t.rotation === 0)).toBe(true);
    const v = fall('vertical');
    expect(einTeil(v, 'e1').textOrientation).toBe('vertical');
    expect(texte(v, 'e1').every((t) => t.rotation === 90)).toBe(true);
    const a = fall('auto');
    expect(einTeil(a, 'e1').textOrientation).toBe('vertical');
  });

  it('[R-6-03] «senkrecht» übersteuert auch einen breiten Block, in dem waagrecht passen würde', () => {
    const L = lb([b('e1', 1, { title: rt('Sport', true), textDirection: 'vertical' })], MITTEL);
    expect(einTeil(L, 'e1').textOrientation).toBe('vertical');
    expect(texte(L, 'e1').map((t) => [zeilenText(t), t.rotation])).toEqual([['Sport', 90]]);
  });
});

describe('Ausweichen vor Markern und Kästchen (2e; Notiz Runde 2 V13; Beschrieb 4.6)', () => {
  it('[R-10-40] (V13 1) Block 0500-0700 und AV 0700 in denselben Spalten: Titel gezeichnet, kein Ereignis, frame endet über der Markerlinie', () => {
    const L = lb(
      [
        b('e1', 1, { time: range(300, 420), title: rt('Morgenturnen', true) }),
        marker('e2', 2, { date: MO, at: 420, kind: 'AV', columns: { kind: 'ids', ids: [STD.p1] } }),
      ],
      MITTEL,
    );
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Morgenturnen']);
    expect(ereignisse(L, 'e1')).toEqual([]);
    const linie = einTeil(L, 'e2', 'markerLine');
    for (const t of z) {
      expect(t.frame.y + t.frame.h).toBeLessThanOrEqual(linie.rect.y + 1e-6);
      zeileImRahmen(t);
    }
  });

  it('[R-10-40] (V13 2) Block 0800-1200 und Beso «bis 1200» in seiner Spalte: Titel gezeichnet, frame endet über dem Kästchen', () => {
    const L = lb(
      [
        b('e1', 1, { title: rt('Zugsschule', true) }),
        beso('e2', 2, {
          date: MO,
          windows: [win('t2', { time: { form: 'until', to: 720 }, columnId: STD.p1 })],
        }),
      ],
      MITTEL,
    );
    const kaestchen = einTeil(L, 'e2', 'besoBox');
    rechteckNahe(kaestchen.rect, feld({ x: X0, w: 40 }, 690, 720));
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Zugsschule']);
    expect(ereignisse(L, 'e1')).toEqual([]);
    for (const t of z) expect(t.frame.y + t.frame.h).toBeLessThanOrEqual(kaestchen.rect.y + 1e-6);
  });

  it('[R-10-40] (V13 3) Block 0700-0900 und AV 0700: Titel rückt unter den Marker, frame beginnt unter dem Feld', () => {
    // Entscheid Auftraggeber 21.10.2026: der Marker gilt über alle Planungsspalten, sein Feld liegt mittig im
    // Lauf p1–p3; der Block über dieselben Spalten hat das Feld in seiner Textfläche.
    const L = lb(
      [
        b('e1', 1, {
          columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
          time: range(420, 540),
          title: rt('Zugsschule', true),
        }),
        marker('e2', 2, { date: MO, at: 420, kind: 'AV', columns: { kind: 'all' } }),
      ],
      MITTEL,
    );
    const feldTeil = einTeil(L, 'e2', 'markerField');
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Zugsschule']);
    for (const t of z) {
      expect(t.frame.y).toBeGreaterThanOrEqual(feldTeil.rect.y + feldTeil.rect.h - 1e-6);
      expect(t.frame.y + t.frame.h).toBeLessThanOrEqual(yZeit(540) - 0.74 + 1e-6);
      zeileImRahmen(t);
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-10-40] Hindernis nur, wenn es die Textfläche in x schneidet: Markerfeld neben der Textfläche wirkt nicht, nur die Linie', () => {
    // Entscheid Auftraggeber 21.10.2026: der Marker (gespeichert p3, alter Plan) gilt über alle Planungsspalten.
    // Seine Linie schneidet die Textfläche von p1, sein Feld (mittig in p2) nicht.
    const L = lb(
      [
        b('e1', 1, { time: range(420, 540), title: rt('Zugsschule', true) }),
        marker('e2', 2, { date: MO, at: 420, kind: 'AV', columns: { kind: 'ids', ids: [STD.p3] } }),
      ],
      MITTEL,
    );
    const feldTeil = einTeil(L, 'e2', 'markerField');
    expect(feldTeil.rect.x).toBeGreaterThanOrEqual(X0 + 40 - 1e-6);
    const f = textflaeche(feld({ x: X0, w: 40 }, 420, 540), 0.48);
    const linieUnten = yZeit(420) + 1.56 / 2;
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['Zugsschule']);
    for (const t of z) {
      rechteckNahe(t.frame, { x: f.x, y: linieUnten, w: f.w, h: f.y + f.h - linieUnten });
      expect(t.frame.y).toBeLessThan(feldTeil.rect.y + feldTeil.rect.h);
    }
  });
});

describe('Zeitzeile je Element (Notiz Runde 2 V14)', () => {
  it('[R-4.5-07] (V14, V-02d-17) Block A 0430-0700 über drei Spalten, B 0500-0600 in der mittleren: Textträger von A beginnt mit «0430-0700»', () => {
    const L = lb(
      [
        b('eA', 1, {
          columns: { kind: 'ids', ids: [STD.p1, STD.p2, STD.p3] },
          time: range(270, 420),
          title: rt('Tagwache', true),
        }),
        b('eB', 2, {
          columns: { kind: 'ids', ids: [STD.p2] },
          time: range(300, 360),
          title: rt('Wache', true),
        }),
      ],
      MITTEL,
    );
    const ps = teile(L, 'eA', 'block');
    const traeger = ps.filter((p) => p.textCarrier);
    expect(traeger).toHaveLength(1);
    rechteckNahe(traeger[0]?.rect ?? { x: 0, y: 0, w: 0, h: 0 }, feld({ x: X0, w: 120 }, 360, 420));
    const z = texteIn(L, 'eA', traeger[0]?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(z.map(zeilenText)).toEqual(['0430-0700', 'Tagwache']);
    expect(texte(L, 'eB').map(zeilenText)).toEqual(['Wache']);
  });

  it('[R-4.5-07] (V14) verknüpfte Teilblöcke mit Zuschnitt: jeder Teilblock trägt die Zeitzeile', () => {
    const L = lb(
      [
        b('e1', 1, {
          columns: { kind: 'ids', ids: [STD.p1, STD.p3] },
          time: range(270, 420),
          title: rt('Tagwache', true),
        }),
      ],
      MITTEL,
    );
    const ps = teile(L, 'e1', 'block');
    expect(ps).toHaveLength(2);
    for (const p of ps) {
      expect(texteIn(L, 'e1', p.rect).map(zeilenText)).toEqual(['0430-0700', 'Tagwache']);
    }
  });
});

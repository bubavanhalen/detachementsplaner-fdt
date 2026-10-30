// @vitest-environment jsdom
// Terminzeile und Termine eines Tages (Vertrag E1-02a Abschnitt 3 derive/agenda.ts, 8 P-11, P-12; Beschrieb 4.8).
import { describe, expect, it } from 'vitest';
import {
  agendaLine,
  agendaLinesForDate,
  resolveTitle,
} from '../../../../src/model/wap/derive/agenda';
import type { Beso } from '../../../../src/model/wap/types';
import {
  basePlan,
  beso,
  dayRemark,
  plain,
  rt,
  win,
  withEntries,
} from '../../support/model/builders';

const plan = basePlan();

function kontrlFsg(over: Partial<Beso> = {}): Beso {
  return beso('e1', 1, {
    date: '2026-10-01',
    besoNumber: 24,
    title: rt('Kontrl Fsg'),
    windows: [win('t1', { time: { form: 'point', at: 810 } })],
    ...over,
  });
}

describe('agendaLine', () => {
  it('[R-4.8-04] alle Felder gefüllt → «<Nr> <Zeit>: <Titel>, Ltg: …, Tn: …, Tpt: …, Ort: ….»', () => {
    const b = kontrlFsg({ ltg: 'Einh Fw', tn: 'Zfhr', tpt: 'Kaserne', ort: 'Säntisalp' });
    expect(plain(agendaLine(b, plan))).toBe(
      '24 1330: Kontrl Fsg, Ltg: Einh Fw, Tn: Zfhr, Tpt: Kaserne, Ort: Säntisalp.',
    );
  });

  it('[R-4.8-04] Beispiel aus dem Katalog: «24 1330: Kontrl Fsg, Ltg: Einh Fw, Tpt: Kaserne, Ort: Säntisalp.»', () => {
    const b = kontrlFsg({ ltg: 'Einh Fw', tpt: 'Kaserne', ort: 'Säntisalp' });
    expect(plain(agendaLine(b, plan))).toBe(
      '24 1330: Kontrl Fsg, Ltg: Einh Fw, Tpt: Kaserne, Ort: Säntisalp.',
    );
  });

  it('[R-4.8-05] leere Felder entfallen samt Bezeichnung und Komma: nur Titel und Ort', () => {
    expect(plain(agendaLine(kontrlFsg({ ort: 'Säntisalp' }), plan))).toBe(
      '24 1330: Kontrl Fsg, Ort: Säntisalp.',
    );
    expect(plain(agendaLine(kontrlFsg(), plan))).toBe('24 1330: Kontrl Fsg.');
    expect(plain(agendaLine(kontrlFsg({ tn: 'Zfhr' }), plan))).toBe(
      '24 1330: Kontrl Fsg, Tn: Zfhr.',
    );
  });

  it('[R-4.8-04] endet der Text schon mit einem Punkt, folgt kein zweiter', () => {
    expect(plain(agendaLine(kontrlFsg({ ort: 'Ukft.' }), plan))).toBe(
      '24 1330: Kontrl Fsg, Ort: Ukft.',
    );
    expect(plain(agendaLine(kontrlFsg({ title: rt('Fhr Fähigkeit erstellt.') }), plan))).toBe(
      '24 1330: Fhr Fähigkeit erstellt.',
    );
  });

  it('[R-4.6-37] Zeit in der erfassten Form: «bis 1200», «ab 1900», «0830-0900», «1130»', () => {
    const line = (time: Beso['windows'][number]['time'], n: number) =>
      plain(
        agendaLine(
          kontrlFsg({ besoNumber: n, title: rt('SEM'), windows: [win('t1', { time })] }),
          plan,
        ),
      );
    expect(line({ form: 'until', to: 720 }, 13)).toBe('13 bis 1200: SEM.');
    expect(line({ form: 'from', from: 1140 }, 16)).toBe('16 ab 1900: SEM.');
    expect(line({ form: 'range', from: 510, to: 540 }, 10)).toBe('10 0830-0900: SEM.');
    expect(line({ form: 'point', at: 690 }, 14)).toBe('14 1130: SEM.');
  });

  it('[R-4.6-36] (F-05) Frist ohne Uhrzeit am 21.10. → «<Nr> bis 21.10.: …»', () => {
    const b = kontrlFsg({
      date: '2026-10-21',
      besoNumber: 33,
      title: rt('Abgabe Unterlagen'),
      windows: [win('t1', { time: { form: 'deadline' } })],
    });
    expect(plain(agendaLine(b, plan))).toBe('33 bis 21.10.: Abgabe Unterlagen.');
  });

  it('[R-4.8-08] mehrere Zeitfenster ergeben exakt die Zeile aus Beschrieb 4.6 (mit Punkt am Ende)', () => {
    const b = beso('e2', 2, {
      date: '2026-10-05',
      besoNumber: 13,
      title: rt('Vorrevisionen'),
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 720 }, supplement: 'Inf Ustü Kp 61/4' }),
        win('t2', { time: { form: 'range', from: 780, to: 960 }, supplement: 'Inf Kp 61/3' }),
        win('t3', { time: { form: 'range', from: 960, to: 1080 }, supplement: 'Inf Stabskp 61' }),
      ],
    });
    expect(plain(agendaLine(b, plan))).toBe(
      '13 Vorrevisionen: 0900-1200 Inf Ustü Kp 61/4, 1300-1600 Inf Kp 61/3, 1600-1800 Inf Stabskp 61.',
    );
  });

  it('[R-4.8-08] (F-11) Ltg, Tn, Tpt, Ort folgen nach dem letzten Zeitfenster', () => {
    const b = beso('e2', 2, {
      date: '2026-10-05',
      besoNumber: 13,
      title: rt('Vorrevisionen'),
      ltg: 'S3',
      ort: 'Kaserne',
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 720 }, supplement: 'Inf Ustü Kp 61/4' }),
        win('t2', { time: { form: 'range', from: 960, to: 1080 }, supplement: 'Inf Stabskp 61' }),
      ],
    });
    expect(plain(agendaLine(b, plan))).toBe(
      '13 Vorrevisionen: 0900-1200 Inf Ustü Kp 61/4, 1600-1800 Inf Stabskp 61, Ltg: S3, Ort: Kaserne.',
    );
  });

  it('[R-4.8-08] mehrere Zeitfenster ohne Zusatz: Zeiten durch Komma getrennt', () => {
    const b = beso('e2', 2, {
      besoNumber: 21,
      title: rt('Spl Begehung'),
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 600 } }),
        win('t2', { time: { form: 'range', from: 840, to: 900 } }),
      ],
    });
    expect(plain(agendaLine(b, plan))).toBe('21 Spl Begehung: 0900-1000, 1400-1500.');
  });

  it('[R-4.8-08] (V-02a-2) ein Zeitfenster mit Zusatz im Muster mehrerer Zeitfenster', () => {
    const b = kontrlFsg({
      windows: [win('t1', { time: { form: 'point', at: 810 }, supplement: 'Zug 1' })],
      ort: 'Ukft',
    });
    expect(plain(agendaLine(b, plan))).toBe('24 Kontrl Fsg: 1330 Zug 1, Ort: Ukft.');
  });

  it('[R-4.6-28] (F-57) Freitext gesetzt → Nummer + Freitext unverändert; Freitext gelöscht → wieder aus Feldern', () => {
    const mitFreitext = kontrlFsg({
      ort: 'Säntisalp',
      agendaOverride: 'Kontrolle gemäss Bf 03-01',
    });
    expect(plain(agendaLine(mitFreitext, plan))).toBe('24 Kontrolle gemäss Bf 03-01');
    const ohne = { ...mitFreitext, agendaOverride: null };
    expect(plain(agendaLine(ohne, plan))).toBe('24 1330: Kontrl Fsg, Ort: Säntisalp.');
  });

  it('[R-4.6-28] (F-14) Beso ohne Nummer: «–» statt Nummer, auch vor dem Freitext', () => {
    expect(plain(agendaLine(kontrlFsg({ besoNumber: null }), plan))).toBe('– 1330: Kontrl Fsg.');
    expect(plain(agendaLine(kontrlFsg({ besoNumber: null, agendaOverride: 'Frei' }), plan))).toBe(
      '– Frei',
    );
  });

  it('[R-4.8-04] Fettläufe des Titels bleiben, benachbarte Läufe gleicher Stärke sind zusammengefasst', () => {
    const b = kontrlFsg({ title: rt('Kontrl Fsg', true), ort: 'Säntisalp' });
    expect(agendaLine(b, plan)).toEqual([
      { text: '24 1330: ', bold: false },
      { text: 'Kontrl Fsg', bold: true },
      { text: ', Ort: Säntisalp.', bold: false },
    ]);
    const teil = kontrlFsg({
      title: [
        { text: 'Mö', bold: true },
        { text: ' Sch', bold: false },
      ],
    });
    expect(agendaLine(teil, plan)).toEqual([
      { text: '24 1330: ', bold: false },
      { text: 'Mö', bold: true },
      { text: ' Sch.', bold: false },
    ]);
  });
});

describe('agendaLine ohne Titel (Vertrag P-15)', () => {
  it('[R-4.8-05] (F-03, Vertrag P-15) ohne Titel und ohne Teile: kein Doppelpunkt, «24 1330.»', () => {
    expect(plain(agendaLine(kontrlFsg({ title: [] }), plan))).toBe('24 1330.');
    expect(plain(agendaLine(kontrlFsg({ title: rt('') }), plan))).toBe('24 1330.');
  });

  it('[R-4.8-05] (F-03, Vertrag P-15) ohne Titel mit Ort: «24 1330: Ort: Säntisalp.»', () => {
    expect(plain(agendaLine(kontrlFsg({ title: [], ort: 'Säntisalp' }), plan))).toBe(
      '24 1330: Ort: Säntisalp.',
    );
  });

  it('[R-4.8-08] (F-03, Vertrag P-15) mehrere Zeitfenster ohne Titel: «13 0900-1200 Inf Kp 1, 1300-1600 Inf Kp 2.»', () => {
    const b = beso('e2', 2, {
      besoNumber: 13,
      title: [],
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 720 }, supplement: 'Inf Kp 1' }),
        win('t2', { time: { form: 'range', from: 780, to: 960 }, supplement: 'Inf Kp 2' }),
      ],
    });
    expect(plain(agendaLine(b, plan))).toBe('13 0900-1200 Inf Kp 1, 1300-1600 Inf Kp 2.');
  });

  it('[R-4.8-08] (F-03, F-11, Vertrag P-15) mehrere Zeitfenster ohne Titel mit übrigen Teilen: Komma nach dem letzten Fenster, kein Doppelpunkt', () => {
    const b = beso('e2', 2, {
      besoNumber: 13,
      title: [],
      ort: 'Säntisalp',
      windows: [
        win('t1', { time: { form: 'range', from: 540, to: 720 }, supplement: 'Inf Kp 1' }),
        win('t2', { time: { form: 'range', from: 780, to: 960 }, supplement: 'Inf Kp 2' }),
      ],
    });
    expect(plain(agendaLine(b, plan))).toBe(
      '13 0900-1200 Inf Kp 1, 1300-1600 Inf Kp 2, Ort: Säntisalp.',
    );
  });
});

describe('resolveTitle', () => {
  it('[R-4.8-04] (Vertrag P-11 resolveTitle; Beso-Verweis in E1-03) Verweis auf einen Beso wird zu «(<Nr>)»; fehlender Beso oder ohne Nummer → «(–)»; Fett bleibt', () => {
    const p = withEntries(plan, [
      beso('e21', 1, { besoNumber: 21 }),
      beso('e22', 2, { besoNumber: null }),
    ]);
    expect(
      resolveTitle(p, [
        { text: 'Spl Begehung ', bold: true },
        { text: '', bold: true, besoRef: 'e21' },
      ]).map((r) => [r.text, r.bold]),
    ).toEqual([
      ['Spl Begehung ', true],
      ['(21)', true],
    ]);
    expect(plain(resolveTitle(p, [{ text: '', bold: false, besoRef: 'e22' }]))).toBe('(–)');
    expect(plain(resolveTitle(p, [{ text: '', bold: false, besoRef: 'e99' }]))).toBe('(–)');
    expect(resolveTitle(p, rt('ohne Verweis'))).toEqual(rt('ohne Verweis'));
  });

  it('[R-4.8-04] Terminzeile löst Beso-Verweise im Titel auf', () => {
    const p = withEntries(plan, [beso('e21', 1, { besoNumber: 21 })]);
    const b = kontrlFsg({
      title: [
        { text: 'Nachbereitung ', bold: false },
        { text: '', bold: false, besoRef: 'e21' },
      ],
    });
    expect(plain(agendaLine(b, p))).toBe('24 1330: Nachbereitung (21).');
  });
});

describe('agendaLinesForDate', () => {
  it('[R-4.8-09] Nummern 12, 10, 11 erfasst → Reihenfolge 10, 11, 12', () => {
    const p = withEntries(plan, [
      beso('e12', 1, { date: '2026-09-28', besoNumber: 12 }),
      beso('e10', 2, { date: '2026-09-28', besoNumber: 10 }),
      beso('e11', 3, { date: '2026-09-28', besoNumber: 11 }),
    ]);
    const lines = agendaLinesForDate(p, '2026-09-28');
    expect(lines.map((l) => l.number)).toEqual([10, 11, 12]);
    expect(lines.map((l) => l.entryId)).toEqual(['e10', 'e11', 'e12']);
    expect(plain(lines[0]?.text ?? [])).toBe(
      plain(agendaLine(beso('e10', 2, { date: '2026-09-28', besoNumber: 10 }), p)),
    );
  });

  it('[R-4.8-09] (F-12) ganztägige Bemerkungen nach den nummerierten Zeilen in Erfassungsreihenfolge, ohne Nummer', () => {
    const p = withEntries(plan, [
      dayRemark('d2', 9, { date: '2026-10-02', text: 'Zweite Bemerkung' }),
      beso('e51', 5, { date: '2026-10-02', besoNumber: 51 }),
      dayRemark('d1', 3, { date: '2026-10-02', text: 'Erste Bemerkung' }),
      beso('e50', 6, { date: '2026-10-02', besoNumber: 50 }),
    ]);
    const lines = agendaLinesForDate(p, '2026-10-02');
    expect(lines.map((l) => [l.entryId, l.number])).toEqual([
      ['e50', 50],
      ['e51', 51],
      ['d1', null],
      ['d2', null],
    ]);
    expect(plain(lines[2]?.text ?? [])).toBe('Erste Bemerkung');
  });

  it('[R-4.8-09] Beso ohne Nummer nach den nummerierten; gleiche Nummer nach Sortierzeit des frühesten Zeitfensters', () => {
    const p = withEntries(plan, [
      beso('a', 1, { date: '2026-09-29', besoNumber: null }),
      beso('b', 2, {
        date: '2026-09-29',
        besoNumber: 20,
        windows: [win('t1', { time: { form: 'point', at: 900 } })],
      }),
      beso('c', 3, {
        date: '2026-09-29',
        besoNumber: 20,
        windows: [
          win('t2', { time: { form: 'point', at: 1000 } }),
          win('t3', { time: { form: 'point', at: 600 } }),
        ],
      }),
      beso('d', 4, { date: '2026-09-30', besoNumber: 30 }),
    ]);
    expect(agendaLinesForDate(p, '2026-09-29').map((l) => l.entryId)).toEqual(['c', 'b', 'a']);
  });

  it('[R-4.8-09] gestrichene Beso bleiben enthalten; andere Tage nicht', () => {
    const p = withEntries(plan, [
      beso('e1', 1, { date: '2026-09-28', besoNumber: 10, status: 'cancelled' }),
      beso('e2', 2, { date: '2026-09-29', besoNumber: 20 }),
    ]);
    expect(agendaLinesForDate(p, '2026-09-28').map((l) => l.entryId)).toEqual(['e1']);
    expect(agendaLinesForDate(p, '2026-10-03')).toEqual([]);
  });
});

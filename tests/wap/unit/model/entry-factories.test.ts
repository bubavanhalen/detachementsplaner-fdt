// @vitest-environment jsdom
// Eintrags-Fabriken (Vertrag E1-02a Abschnitt 3 factories.ts, 8 P-9; Beschrieb 4.6).
import { describe, expect, it } from 'vitest';
import {
  newBeso,
  newBlock,
  newDayRemark,
  newMarker,
  newMultiDayRemark,
  newQuerbalken,
  newRapport,
} from '../../../../src/model/wap/factories';
import type { EntryStatus, MarkerKind, TimeSpec } from '../../../../src/model/wap/types';
import {
  beso,
  besoInput,
  block,
  blockInput,
  CAT,
  dayRemark,
  dayRemarkInput,
  expectModelError,
  marker,
  markerInput,
  multiDayRemark,
  multiDayRemarkInput,
  querbalken,
  querbalkenInput,
  rapport,
  rapportInput,
  roundTrip,
  rt,
  win,
  without,
} from '../../support/model/builders';

const STATUSES: readonly EntryStatus[] = ['confirmed', 'open', 'cancelled'];

describe('Block', () => {
  it('[R-4.6-01] Block mit Titel, Zeit, Spalten und Kategorie: Eingabe plus id, type, createdSeq, Standardwerte', () => {
    expect(newBlock(blockInput(), 'e1', 5)).toEqual(block('e1', 5));
  });

  it('[R-4.6-01] (F-03) leerer Titel ist erlaubt', () => {
    const b = newBlock(blockInput({ title: [] }), 'e1', 1);
    expect(b.title).toEqual([]);
    expect(newBlock(blockInput({ title: rt('') }), 'e2', 2).title).toEqual(rt(''));
  });

  it('[R-4.6-01] Block ohne Zeit nicht erzeugbar → invalidEntry (time)', () => {
    expectModelError(() => newBlock(without(blockInput(), 'time'), 'e1', 1), {
      code: 'invalidEntry',
      field: 'time',
    });
  });

  it('[R-4.6-01] Block ohne Spalte nicht erzeugbar → invalidEntry (columns), auch bei leerer ID-Liste', () => {
    expectModelError(() => newBlock(without(blockInput(), 'columns'), 'e1', 1), {
      code: 'invalidEntry',
      field: 'columns',
    });
    expectModelError(() => newBlock(blockInput({ columns: { kind: 'ids', ids: [] } }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'columns',
    });
    expect(newBlock(blockInput({ columns: { kind: 'all' } }), 'e1', 1).columns).toEqual({
      kind: 'all',
    });
  });

  it('[R-4.7-02] Block ohne Kategorie nicht erzeugbar → invalidEntry (categoryId)', () => {
    expectModelError(() => newBlock(blockInput({ categoryId: '' }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'categoryId',
    });
    expectModelError(() => newBlock(without(blockInput(), 'categoryId'), 'e1', 1), {
      code: 'invalidEntry',
      field: 'categoryId',
    });
  });

  it('[R-4.7-02] zweite Kategorie gleich der ersten → invalidEntry (secondCategoryId); verschieden oder leer gültig', () => {
    expectModelError(
      () => newBlock(blockInput({ categoryId: CAT.kp, secondCategoryId: CAT.kp }), 'e1', 1),
      { code: 'invalidEntry', field: 'secondCategoryId' },
    );
    const b = newBlock(blockInput({ categoryId: CAT.bat, secondCategoryId: CAT.kp }), 'e1', 1);
    expect([b.categoryId, b.secondCategoryId]).toEqual([CAT.bat, CAT.kp]);
    expect(newBlock(blockInput({ secondCategoryId: null }), 'e2', 2).secondCategoryId).toBeNull();
  });

  it('[R-4.6-01] ungültiges Datum → invalidEntry (date); erster Fehler in Feldreihenfolge des Typs', () => {
    expectModelError(() => newBlock(blockInput({ date: '2026-02-30' }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'date',
    });
    expectModelError(
      () =>
        newBlock(
          blockInput({ date: 'x', columns: { kind: 'ids', ids: [] }, categoryId: '' }),
          'e1',
          1,
        ),
      { code: 'invalidEntry', field: 'date' },
    );
    expectModelError(
      () => newBlock(blockInput({ columns: { kind: 'ids', ids: [] }, categoryId: '' }), 'e1', 1),
      { code: 'invalidEntry', field: 'columns' },
    );
  });

  it('[R-4.6-35] (F-04) Block kennt Zeitpunkt, von–bis, ab X und bis X; Frist ist für Blöcke nicht zulässig', () => {
    const forms: TimeSpec[] = [
      { form: 'point', at: 690 },
      { form: 'range', from: 540, to: 720 },
      { form: 'range', from: 1320, to: 1560 },
      { form: 'from', from: 1140 },
      { form: 'until', to: 720 },
    ];
    for (const time of forms) {
      const b = newBlock(blockInput({ time: time as never }), 'e1', 1);
      expect(roundTrip(b).time).toEqual(time);
    }
    expectModelError(() => newBlock(blockInput({ time: { form: 'deadline' } as never }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'time',
    });
  });

  it('[R-4.5-09] Block mit Zeit ausserhalb des 5-Minuten-Rasters oder ungültiger Spanne → invalidEntry (time)', () => {
    const bad: TimeSpec[] = [
      { form: 'range', from: 513, to: 600 },
      { form: 'point', at: 691 },
      { form: 'range', from: 600, to: 600 },
      { form: 'range', from: 600, to: 540 },
      { form: 'range', from: 600, to: 2045 },
      { form: 'from', from: -5 },
    ];
    for (const time of bad) {
      expectModelError(() => newBlock(blockInput({ time: time as never }), 'e1', 1), {
        code: 'invalidEntry',
        field: 'time',
      });
    }
  });

  it('[R-4.6-02] Zusatzfelder Zusatz, Ltg, Tn, Tpt, Ort, Tenue, zweite Kategorie, Textrichtung, offenes Ende, Status und interne Notiz bleiben erhalten', () => {
    const input = blockInput({
      title: [
        { text: 'Mö', bold: true },
        { text: ' Sch', bold: false },
      ],
      supplement: 'Teil 2',
      ltg: 'Einh Fw',
      tn: 'Zfhr',
      tpt: 'Bus',
      ort: 'Ukft',
      tenue: 'Ausgang',
      printTn: true,
      printTenue: true,
      categoryId: CAT.zfhr,
      secondCategoryId: CAT.kp,
      textDirection: 'vertical',
      openEnd: true,
      status: 'open',
      internalNote: 'nur intern',
    });
    const b = newBlock(input, 'e9', 12);
    expect(b).toEqual({
      ...input,
      id: 'e9',
      type: 'block',
      createdSeq: 12,
      changed: false,
      removedText: [],
    });
    expect(roundTrip(b)).toEqual(b);
  });

  it('[R-6-07] interne Notiz am Block: Standard leer, gesetzt bleibt sie erhalten', () => {
    expect(newBlock(blockInput(), 'e1', 1).internalNote).toBe('');
    expect(newBlock(blockInput({ internalNote: 'Fz reservieren' }), 'e1', 1).internalNote).toBe(
      'Fz reservieren',
    );
  });
});

describe('Querbalken', () => {
  it('[R-4.6-04] Querbalken 08.10.–18.10.2026 über eine Wochengrenze als ein Objekt', () => {
    const q = newQuerbalken(querbalkenInput(), 'e3', 2);
    expect(q).toEqual(querbalken('e3', 2));
    expect(roundTrip(q)).toEqual(q);
  });

  it('[R-4.6-04] Datum von nach bis → invalidEntry (toDate); gleicher Tag gültig', () => {
    expectModelError(
      () =>
        newQuerbalken(querbalkenInput({ fromDate: '2026-10-18', toDate: '2026-10-08' }), 'e3', 2),
      { code: 'invalidEntry', field: 'toDate' },
    );
    const q = newQuerbalken(
      querbalkenInput({ fromDate: '2026-10-08', toDate: '2026-10-08' }),
      'e3',
      2,
    );
    expect([q.fromDate, q.toDate]).toEqual(['2026-10-08', '2026-10-08']);
  });
});

describe('Marker', () => {
  it('[R-4.6-11] Marker mit Art, Zeitpunkt und Spalten', () => {
    for (const kind of ['AV', 'ABV', 'HV'] as MarkerKind[]) {
      expect(newMarker(markerInput({ kind }), 'e4', 3)).toEqual(marker('e4', 3, { kind }));
    }
    const frei = newMarker(markerInput({ kind: 'custom', customKind: 'Appell' }), 'e5', 4);
    expect([frei.kind, frei.customKind]).toEqual(['custom', 'Appell']);
  });

  it('[R-4.6-11] Marker ohne Art oder mit unbekannter Art → invalidEntry (kind)', () => {
    expectModelError(() => newMarker(without(markerInput(), 'kind'), 'e4', 3), {
      code: 'invalidEntry',
      field: 'kind',
    });
    expectModelError(() => newMarker(markerInput({ kind: 'XY' as MarkerKind }), 'e4', 3), {
      code: 'invalidEntry',
      field: 'kind',
    });
  });

  it('[R-4.6-11] Marker ohne gültigen Zeitpunkt → invalidEntry (at)', () => {
    expectModelError(() => newMarker(without(markerInput(), 'at'), 'e4', 3), {
      code: 'invalidEntry',
      field: 'at',
    });
    expectModelError(() => newMarker(markerInput({ at: 433 }), 'e4', 3), {
      code: 'invalidEntry',
      field: 'at',
    });
    expect(newMarker(markerInput({ kind: 'ABV', at: 1440 }), 'e4', 3).at).toBe(1440);
  });

  it('[R-4.6-11] Art «frei» ohne Bezeichnung → invalidEntry (customKind)', () => {
    expectModelError(() => newMarker(markerInput({ kind: 'custom', customKind: '' }), 'e4', 3), {
      code: 'invalidEntry',
      field: 'customKind',
    });
  });
});

describe('Rapport', () => {
  it('[R-4.6-16] Rapport mit Kürzel aus der Liste und Zeit; freies Kürzel speicherbar', () => {
    expect(newRapport(rapportInput(), 'e6', 7)).toEqual(rapport('e6', 7));
    const frei = newRapport(
      rapportInput({ code: 'Qual Rap', time: { form: 'point', at: 600 } }),
      'e7',
      8,
    );
    expect(roundTrip(frei)).toEqual(
      rapport('e7', 8, { code: 'Qual Rap', time: { form: 'point', at: 600 } }),
    );
  });

  it('[R-4.6-16] Rapport ohne Kürzel (leer, nur Leerraum, fehlend) → invalidEntry (code)', () => {
    for (const code of ['', '   ']) {
      expectModelError(() => newRapport(rapportInput({ code }), 'e6', 7), {
        code: 'invalidEntry',
        field: 'code',
      });
    }
    expectModelError(() => newRapport(without(rapportInput(), 'code'), 'e6', 7), {
      code: 'invalidEntry',
      field: 'code',
    });
  });

  it('[R-4.6-16] (F-04) Rapport ohne Zeit oder mit anderer Zeitform als Zeitpunkt/von–bis → invalidEntry (time)', () => {
    expectModelError(() => newRapport(without(rapportInput(), 'time'), 'e6', 7), {
      code: 'invalidEntry',
      field: 'time',
    });
    const bad: TimeSpec[] = [
      { form: 'from', from: 600 },
      { form: 'until', to: 600 },
      { form: 'deadline' },
    ];
    for (const time of bad) {
      expectModelError(() => newRapport(rapportInput({ time: time as never }), 'e6', 7), {
        code: 'invalidEntry',
        field: 'time',
      });
    }
  });

  it('[R-4.6-17] Ort, Tn, Kategorie und Anzeige bleiben erhalten', () => {
    const input = rapportInput({
      code: 'BR 0',
      ort: 'Bat KP',
      tn: 'Kp Kdt',
      categoryId: CAT.bat,
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: ['c8'] },
    });
    const r = newRapport(input, 'e8', 9);
    expect(r).toEqual({
      ...input,
      id: 'e8',
      type: 'rapport',
      createdSeq: 9,
      status: 'confirmed',
      internalNote: '',
      changed: false,
      removedText: [],
    });
    expect(roundTrip(r)).toEqual(r);
    for (const display of ['rapColumn', 'onlyInColumns'] as const) {
      expect(newRapport(rapportInput({ display }), 'e8', 9).display).toBe(display);
    }
  });
});

describe('Beso', () => {
  it('[R-4.6-41] Beso mit drei Zeitfenstern, eines ohne Spalte, mit Zusatz', () => {
    const windows = [
      win('t1', {
        time: { form: 'range', from: 540, to: 720 },
        columnId: 'c8',
        supplement: 'Kp 1',
      }),
      win('t2', {
        time: { form: 'range', from: 780, to: 960 },
        columnId: null,
        supplement: 'Kp 2',
      }),
      win('t3', { time: { form: 'range', from: 960, to: 1080 }, columnId: 'c10', supplement: '' }),
    ];
    const b = newBeso(
      besoInput({ windows, title: rt('Vorrevisionen'), besoNumber: 13 }),
      'e10',
      11,
    );
    expect(b).toEqual(beso('e10', 11, { windows, title: rt('Vorrevisionen'), besoNumber: 13 }));
    expect(roundTrip(b)).toEqual(b);
  });

  it('[R-4.6-41] Beso ohne Zeitfenster → besoWithoutWindow (windows)', () => {
    expectModelError(() => newBeso(besoInput({ windows: [] }), 'e10', 11), {
      code: 'besoWithoutWindow',
      field: 'windows',
    });
  });

  it('[R-4.6-41] ungültige Zeit im zweiten Zeitfenster → invalidEntry (windows[1].time)', () => {
    const windows = [win('t1'), win('t2', { time: { form: 'point', at: 433 } })];
    expectModelError(() => newBeso(besoInput({ windows }), 'e10', 11), {
      code: 'invalidEntry',
      field: 'windows[1].time',
    });
  });

  it('[R-4.6-35] Beso kennt alle fünf Zeitformen im Zeitfenster', () => {
    const forms: TimeSpec[] = [
      { form: 'point', at: 690 },
      { form: 'range', from: 540, to: 720 },
      { form: 'from', from: 1140 },
      { form: 'until', to: 720 },
      { form: 'deadline' },
      { form: 'deadline', to: 720 },
    ];
    for (const time of forms) {
      const b = newBeso(besoInput({ windows: [win('t1', { time })] }), 'e10', 11);
      expect(roundTrip(b).windows[0]?.time).toEqual(time);
    }
  });

  it('[R-4.6-26] Ltg, Tn, Tpt, Ort, Kategorie, Status, Nummer und Freitext bleiben erhalten', () => {
    const input = besoInput({
      ltg: 'Einh Fw',
      tn: 'Zfhr',
      tpt: 'Kaserne',
      ort: 'Säntisalp',
      categoryId: CAT.zfhr,
      status: 'cancelled',
      besoNumber: 24,
      numberFixed: true,
      agendaOverride: 'Fsg gemäss Bf',
    });
    const b = newBeso(input, 'e11', 12);
    expect(b).toEqual({
      ...input,
      id: 'e11',
      type: 'beso',
      createdSeq: 12,
      internalNote: '',
      changed: false,
      removedText: [],
    });
    expect(roundTrip(b)).toEqual(b);
  });
});

describe('Ganztägige und mehrtägige Bemerkung', () => {
  it('[R-4.6-29] ganztägige Bemerkung mit Tag und Text, ohne Zeit und ohne Nummer', () => {
    const r = newDayRemark(dayRemarkInput(), 'e12', 13);
    expect(r).toEqual(dayRemark('e12', 13));
    expect(Object.keys(r).filter((k) => ['time', 'number', 'besoNumber'].includes(k))).toEqual([]);
    expect(newDayRemark(dayRemarkInput({ status: 'open' }), 'e13', 14).status).toBe('open');
  });

  it('[R-4.6-29] ganztägige Bemerkung mit ungültigem Tag → invalidEntry (date)', () => {
    expectModelError(() => newDayRemark(dayRemarkInput({ date: '2026-09-31' }), 'e12', 13), {
      code: 'invalidEntry',
      field: 'date',
    });
  });

  it('[R-4.2-10] mehrtägige Bemerkung mit Nummer und Zeitraum; Zeitraum mit von nach bis → invalidEntry', () => {
    const scope = { kind: 'range', fromDate: '2026-10-01', toDate: '2026-10-08' } as const;
    const r = newMultiDayRemark(multiDayRemarkInput({ number: 3, scope }), 'e14', 15);
    expect(r).toEqual(multiDayRemark('e14', 15, { number: 3, scope }));
    expect(roundTrip(r)).toEqual(r);
    expectModelError(
      () =>
        newMultiDayRemark(
          multiDayRemarkInput({
            scope: { kind: 'range', fromDate: '2026-10-08', toDate: '2026-10-01' },
          }),
          'e14',
          15,
        ),
      { code: 'invalidEntry', field: 'scope' },
    );
  });

  it('[R-4.2-07] (F-38) Bemerkung «gilt durchgehend» ist eine mehrtägige Bemerkung ohne Zeitraum (scope plan)', () => {
    const r = newMultiDayRemark(multiDayRemarkInput({ scope: { kind: 'plan' } }), 'e15', 16);
    expect(r.scope).toEqual({ kind: 'plan' });
    expect(r.number).toBeNull();
  });
});

describe('Status', () => {
  it('[R-4.6-32] neuer Eintrag jedes Typs → bestätigt', () => {
    expect(newBlock(blockInput(), 'a', 1).status).toBe('confirmed');
    expect(newQuerbalken(querbalkenInput(), 'b', 2).status).toBe('confirmed');
    expect(newMarker(markerInput(), 'c', 3).status).toBe('confirmed');
    expect(newRapport(rapportInput(), 'd', 4).status).toBe('confirmed');
    expect(newBeso(besoInput(), 'e', 5).status).toBe('confirmed');
    expect(newDayRemark(dayRemarkInput(), 'f', 6).status).toBe('confirmed');
    expect(newMultiDayRemark(multiDayRemarkInput(), 'g', 7).status).toBe('confirmed');
  });

  it('[R-4.6-32] alle drei Statuswerte speicherbar', () => {
    for (const status of STATUSES) {
      expect(roundTrip(newBlock(blockInput({ status }), 'a', 1)).status).toBe(status);
      expect(roundTrip(newBeso(besoInput({ status }), 'e', 5)).status).toBe(status);
      expect(roundTrip(newRapport(rapportInput({ status }), 'd', 4)).status).toBe(status);
      expect(roundTrip(newMarker(markerInput({ status }), 'c', 3)).status).toBe(status);
    }
  });

  it('[R-4.6-32] Fabriken verändern ihre Eingabe nicht', () => {
    const input = blockInput({ ltg: 'Kdt' });
    const copy = roundTrip(input);
    newBlock(input, 'a', 1);
    expect(input).toEqual(copy);
  });
});

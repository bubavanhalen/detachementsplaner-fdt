// @vitest-environment jsdom
// Beso: Zeitfenster, Fixierung, «Tag neu nummerieren» (Vertrag E1-03 Abschnitt 2d, 3, 1c; Änderungsnotiz V03,
// V04, V09; Beschrieb 4.6, 5.3; F-13, F-56; Vorschlag V-03-9).
import { describe, expect, it } from 'vitest';
import {
  addTimeWindow,
  removeTimeWindow,
  renumberDay,
  renumberDayPreview,
  setBesoNumberFixed,
  updateTimeWindow,
} from '../../../../src/model/wap/commands/beso';
import { createEntry, deleteEntries } from '../../../../src/model/wap/commands/entries';
import { agendaLinesForDate, resolveTitle } from '../../../../src/model/wap/derive/agenda';
import type { Beso, Block, Plan } from '../../../../src/model/wap/types';
import {
  besoUm,
  besoVon,
  ctx,
  DI,
  eintrag,
  expectCommandError,
  expectKeineWirkung,
  FR,
  fenster,
  MO,
  nummern,
  planMit,
  run,
  STAND,
  titelMitVerweis,
} from '../../support/commands/helpers';
import { beso, block, expectModelError, rt } from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

/** Mo 0800 #10, 0900 #11, 1000 #12. */
function dreiAmMontag(over: Partial<Plan> = {}): Plan {
  return planMit(
    [besoUm('e1', 1, MO, 480, 10), besoUm('e2', 2, MO, 540, 11), besoUm('e3', 3, MO, 600, 12)],
    over,
  );
}

/** Beso e5 mit zwei Zeitfenstern am Montag (#10). */
function zweiFenster(over: Partial<Plan> = {}): Plan {
  return planMit(
    [
      beso('e5', 5, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t5a', { form: 'point', at: 600 }),
          fenster('t5b', { form: 'point', at: 840 }),
        ],
      }),
      block('e6', 6, { date: MO }),
    ],
    over,
  );
}

describe('addTimeWindow', () => {
  it('[R-4.6-25] neues Zeitfenster am Ende mit ID aus nextId und Standardwerten; Bezeichnung', () => {
    const plan = zweiFenster();
    const r = run(plan, (p) =>
      addTimeWindow(p, 'e5', { time: { form: 'range', from: 960, to: 1080 } }, ctx),
    );
    expect(r.windowId).toBe('t100');
    expect(besoVon(r.plan, 'e5').windows).toEqual([
      ...besoVon(plan, 'e5').windows,
      { id: 't100', time: { form: 'range', from: 960, to: 1080 }, columnId: null, supplement: '' },
    ]);
    expect(r.plan.nextId).toBe(101);
    expect(r.label).toBe('Zeitfenster hinzugefügt');
    expect(r.affectedEntryIds).toEqual(['e5']);
    expect(r.affectedDates).toEqual([MO]);
  });

  it('[R-5.3-03] früheres Zeitfenster ändert die Sortierzeit: vor dem Stand wird der Tag neu nummeriert', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => addTimeWindow(p, 'e3', { time: { form: 'point', at: 360 } }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 12, e3: 10 });
  });

  it('[R-4.6-25][R-4.4-06] (§4) Fehler: kein Beso → wrongEntryType; unbekannt → notFound; ungültige Zeit oder Rap-Spalte', () => {
    const plan = zweiFenster();
    expectCommandError(
      plan,
      (p) => addTimeWindow(p, 'e6', { time: { form: 'point', at: 600 } }, ctx),
      {
        code: 'wrongEntryType',
        entryId: 'e6',
      },
    );
    expectCommandError(
      plan,
      (p) => addTimeWindow(p, 'e9', { time: { form: 'point', at: 600 } }, ctx),
      {
        code: 'notFound',
        entryId: 'e9',
      },
    );
    expectCommandError(
      plan,
      (p) => addTimeWindow(p, 'e5', { time: { form: 'point', at: 602 } }, ctx),
      {
        code: 'invalidEntry',
        field: 'windows[2].time',
        entryId: 'e5',
      },
    );
    expectCommandError(
      plan,
      (p) => addTimeWindow(p, 'e5', { time: { form: 'point', at: 600 }, columnId: 'c14' }, ctx),
      { code: 'invalidPlacement', field: 'windows[2].columnId', entryId: 'e5' },
    );
  });
});

describe('removeTimeWindow (F-56)', () => {
  it('[R-4.6-25] Zeitfenster eines Beso mit zwei Fenstern löschen; Bezeichnung', () => {
    const plan = zweiFenster();
    const r = run(plan, (p) => removeTimeWindow(p, 'e5', 't5a', ctx));
    expect(besoVon(r.plan, 'e5').windows.map((w) => w.id)).toEqual(['t5b']);
    expect(r.label).toBe('Zeitfenster gelöscht');
  });

  it('[R-4.6-25] letztes Zeitfenster löschen → lastTimeWindow, Plan unverändert; nach Bestätigung löscht deleteEntries den Beso samt Terminzeile', () => {
    const plan = dreiAmMontag();
    expectCommandError(plan, (p) => removeTimeWindow(p, 'e2', 'te2', ctx), {
      code: 'lastTimeWindow',
      field: 'windowId',
      entryId: 'e2',
    });
    const r = run(plan, (p) => deleteEntries(p, ['e2'], ctx));
    expect(r.plan.entries.e2).toBeUndefined();
    expect(agendaLinesForDate(r.plan, MO).map((l) => l.entryId)).toEqual(['e1', 'e3']);
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e3: 11 });
  });

  it('[R-4.6-25] Fehler: unbekanntes Zeitfenster → notFound (windowId, Beso); kein Beso → wrongEntryType', () => {
    const plan = zweiFenster();
    expectCommandError(plan, (p) => removeTimeWindow(p, 'e5', 't9', ctx), {
      code: 'notFound',
      field: 'windowId',
      entryId: 'e5',
    });
    expectCommandError(plan, (p) => removeTimeWindow(p, 'e6', 't5a', ctx), {
      code: 'wrongEntryType',
      entryId: 'e6',
    });
  });
});

describe('updateTimeWindow', () => {
  it('[R-5.3-03] Zeit, Spalte und Zusatz ändern; frühere Zeit nummeriert vor dem Stand neu; Bezeichnung', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) =>
      updateTimeWindow(
        p,
        'e3',
        'te3',
        { time: { form: 'point', at: 420 }, columnId: 'c10', supplement: 'Inf Kp 2' },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e3').windows).toEqual([
      { id: 'te3', time: { form: 'point', at: 420 }, columnId: 'c10', supplement: 'Inf Kp 2' },
    ]);
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 12, e3: 10 });
    expect(r.label).toBe('Zeitfenster geändert');
  });

  it('[R-5.3-13] gleiche Werte: ohne Wirkung', () => {
    const plan = dreiAmMontag();
    expectKeineWirkung(
      plan,
      updateTimeWindow(
        plan,
        'e2',
        'te2',
        { time: { form: 'point', at: 540 }, columnId: null, supplement: '' },
        ctx,
      ),
    );
  });

  it('[R-5.3-13] Zeit entfernen bei mehreren Zeitfenstern: das Zeitfenster entfällt, der Beso bleibt mit Nummer', () => {
    const plan = zweiFenster();
    const r = run(plan, (p) => updateTimeWindow(p, 'e5', 't5b', { time: null }, ctx));
    expect(besoVon(r.plan, 'e5').windows.map((w) => w.id)).toEqual(['t5a']);
    expect(besoVon(r.plan, 'e5').besoNumber).toBe(10);
  });

  it('[R-5.3-13] Beso-Zeit entfernt → Ganztägige Bemerkung mit gleicher ID und Grunddaten, ohne Nummer; Nummer frei (vor dem Stand)', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11, {
        title: rt('Vorrevisionen'),
        windows: [fenster('te2', { form: 'point', at: 540 }, { supplement: 'Inf Kp 2' })],
        ltg: 'S4',
        status: 'open',
        changed: true,
        internalNote: 'intern, fiktiv',
        removedText: ['alt'],
      }),
      besoUm('e3', 3, MO, 600, 12),
    ]);
    const r = run(plan, (p) => updateTimeWindow(p, 'e2', 'te2', { time: null }, ctx));
    expect(eintrag(r.plan, 'e2')).toEqual({
      id: 'e2',
      type: 'dayRemark',
      date: MO,
      text: 'Vorrevisionen: Inf Kp 2, Ltg: S4.',
      status: 'open',
      changed: true,
      createdSeq: 2,
      internalNote: 'intern, fiktiv',
      removedText: ['alt'],
    });
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e3: 11 });
    expect(agendaLinesForDate(r.plan, MO).map((l) => [l.entryId, l.number])).toEqual([
      ['e1', 10],
      ['e3', 11],
      ['e2', null],
    ]);
    expect(r.label).toBe('Beso «Vorrevisionen» in Ganztägige Bemerkung umgewandelt');
    expect(r.affectedEntryIds).toEqual(['e2', 'e3']);
  });

  it('[R-5.3-13] (V03) Text der Bemerkung: Verweis aufgelöst, ohne Zusatz «Titel, Teile.»', () => {
    const plan = planMit([
      besoUm('e1', 1, DI, 480, 21),
      besoUm('e2', 2, MO, 540, 10, {
        title: titelMitVerweis('Waffenplatzbegehung ', 'e1', true),
        ort: 'Säntisalp',
      }),
    ]);
    const r = run(plan, (p) => updateTimeWindow(p, 'e2', 'te2', { time: null }, ctx));
    expect(eintrag(r.plan, 'e2')).toMatchObject({
      type: 'dayRemark',
      text: 'Waffenplatzbegehung (21), Ort: Säntisalp.',
    });
  });

  it('[R-5.3-13] (V03) Freitext getrimmt ohne Punkt; Titel allein mit Punkt; kein zweiter Punkt; ohne Teile leer', () => {
    const fall = (over: Parameters<typeof besoUm>[5]) => {
      const plan = planMit([besoUm('e1', 1, MO, 480, 10, over)]);
      const e = eintrag(
        run(plan, (p) => updateTimeWindow(p, 'e1', 'te1', { time: null }, ctx)).plan,
        'e1',
      );
      expect(e.type).toBe('dayRemark');
      return e.type === 'dayRemark' ? e.text : '';
    };
    expect(fall({ agendaOverride: ' Abgabe Ukft ' })).toBe('Abgabe Ukft');
    expect(fall({ title: rt('Fz Kontrolle') })).toBe('Fz Kontrolle.');
    expect(fall({ title: rt('Abgabe Ukft.') })).toBe('Abgabe Ukft.');
    expect(fall({ title: [], ltg: 'S4', ort: 'Kaserne' })).toBe('Ltg: S4, Ort: Kaserne.');
    expect(
      fall({
        title: [
          { text: 'AVOR', bold: true },
          { text: ' Fahne', bold: false },
        ],
      }),
    ).toBe('AVOR Fahne.');
    expect(fall({ title: rt('Kontrl Fsg'), agendaOverride: '   ' })).toBe('Kontrl Fsg.');
    expect(fall({ title: [] })).toBe('');
  });

  it('[R-5.3-13] (V03, Orchestrator c) Zusatz ohne Titel: Text = Zusatz allein, ohne Doppelpunkt, Schlusspunkt wie P-12', () => {
    const text = (supplement: string) => {
      const plan = planMit([
        besoUm('e1', 1, MO, 480, 10, {
          title: [],
          windows: [fenster('te1', { form: 'point', at: 480 }, { supplement })],
        }),
      ]);
      const e = eintrag(
        run(plan, (p) => updateTimeWindow(p, 'e1', 'te1', { time: null }, ctx)).plan,
        'e1',
      );
      expect(e.type).toBe('dayRemark');
      return e.type === 'dayRemark' ? e.text : '';
    };
    expect(text('Inf Kp 2')).toBe('Inf Kp 2.');
    expect(text('Abgabe Ukft.')).toBe('Abgabe Ukft.');
  });

  it('[R-5.3-13] (V03, Orchestrator c, Klarstellung) Zusatz ohne Titel mit Ltg, Tn, Tpt, Ort: Zusatz an Stelle des Titels, Teile folgen getrimmt', () => {
    const text = (title: Beso['title']) => {
      const plan = planMit([
        besoUm('e1', 1, MO, 480, 10, {
          title,
          windows: [fenster('te1', { form: 'point', at: 480 }, { supplement: ' Inf Kp 2 ' })],
          ltg: ' S4 ',
          tn: 'Zfhr',
          tpt: 'Bus',
          ort: 'Kaserne.',
        }),
      ]);
      const e = eintrag(
        run(plan, (p) => updateTimeWindow(p, 'e1', 'te1', { time: null }, ctx)).plan,
        'e1',
      );
      expect(e.type).toBe('dayRemark');
      return e.type === 'dayRemark' ? e.text : '';
    };
    expect(text([])).toBe('Inf Kp 2, Ltg: S4, Tn: Zfhr, Tpt: Bus, Ort: Kaserne.');
    expect(text(rt('Vorrevisionen'))).toBe(
      'Vorrevisionen: Inf Kp 2, Ltg: S4, Tn: Zfhr, Tpt: Bus, Ort: Kaserne.',
    );
  });

  it('[R-5.3-13] (V03) Titel und Zusatz ohne übrige Teile: «Titel: Zusatz.»', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10, {
        title: rt('Vorrevisionen'),
        windows: [fenster('te1', { form: 'point', at: 480 }, { supplement: 'Inf Kp 2' })],
      }),
    ]);
    const e = eintrag(
      run(plan, (p) => updateTimeWindow(p, 'e1', 'te1', { time: null }, ctx)).plan,
      'e1',
    );
    expect(e).toMatchObject({ type: 'dayRemark', text: 'Vorrevisionen: Inf Kp 2.' });
  });

  it('[R-5.3-13] KVK Fr 51 ohne Zeit (Fixture): wird Bemerkung; nach dem Stand bleiben 50 und 52, vor dem Stand 50, 51', () => {
    const mitStand = loadKvkPlan();
    const fr51 = Object.values(mitStand.entries).find(
      (e) => e.type === 'beso' && e.date === FR && e.besoNumber === 51,
    );
    expect(fr51).toBeDefined();
    const id = fr51?.id as string;
    const fensterId = besoVon(mitStand, id).windows[0]?.id as string;
    const r = run(mitStand, (p) => updateTimeWindow(p, id, fensterId, { time: null }, ctx));
    expect(eintrag(r.plan, id).type).toBe('dayRemark');
    expect(Object.values(nummern(r.plan, FR)).sort()).toEqual([50, 52]);
    const ohneStand = { ...loadKvkPlan(), stand: null };
    const r2 = run(ohneStand, (p) => updateTimeWindow(p, id, fensterId, { time: null }, ctx));
    expect(Object.values(nummern(r2.plan, FR)).sort()).toEqual([50, 51]);
  });

  it('[R-5.3-07] (V-03-9) nach dem Stand gibt der umgewandelte Beso seine Nummer sofort frei', () => {
    const plan = planMit(
      Array.from({ length: 10 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, 10 + i)),
      { stand: STAND },
    );
    const r = run(plan, (p) => updateTimeWindow(p, 'e6', 'te6', { time: null }, ctx));
    const neu = run(r.plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 300 } }] },
        ctx,
      ),
    );
    expect(besoVon(neu.plan, neu.entryId).besoNumber).toBe(15);
  });

  it('[R-5.3-13] Fehler: unbekanntes Zeitfenster → notFound (windowId); kein Beso → wrongEntryType; ungültige Zeit', () => {
    const plan = zweiFenster();
    expectCommandError(plan, (p) => updateTimeWindow(p, 'e5', 't9', { supplement: 'x' }, ctx), {
      code: 'notFound',
      field: 'windowId',
      entryId: 'e5',
    });
    expectCommandError(plan, (p) => updateTimeWindow(p, 'e6', 't5a', { supplement: 'x' }, ctx), {
      code: 'wrongEntryType',
      entryId: 'e6',
    });
    expectCommandError(
      plan,
      (p) => updateTimeWindow(p, 'e5', 't5b', { time: { form: 'range', from: 600, to: 600 } }, ctx),
      { code: 'invalidEntry', field: 'windows[1].time', entryId: 'e5' },
    );
  });
});

describe('setBesoNumberFixed (F-13)', () => {
  it('[R-5.3-05] aktuelle Nummer fixieren: Nummer bleibt, numberFixed true; Bezeichnung «Nr 11 fixiert»', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e2', true, null, ctx));
    expect(besoVon(r.plan, 'e2')).toMatchObject({ besoNumber: 11, numberFixed: true });
    expect(r.label).toBe('Nr 11 fixiert');
  });

  it('[R-5.3-05] neue Nummer fixieren: übrige erhalten die freien Nummern ohne sie (vor dem Stand)', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e1', true, 15, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 15, e2: 10, e3: 11 });
    expect(besoVon(r.plan, 'e1').numberFixed).toBe(true);
    expect(r.label).toBe('Nr 15 fixiert');
    expect(r.affectedEntryIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('[R-5.3-05] Nummer ausserhalb des Kreises ist erlaubt (P2 ab Etappe 2)', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e3', true, 25, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 25 });
  });

  it('[R-5.3-05] lösen: vor dem Stand nummeriert der Tag neu; Bezeichnung mit Nummer danach', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 15, { numberFixed: true }),
      besoUm('e2', 2, MO, 540, 10),
      besoUm('e3', 3, MO, 600, 11),
    ]);
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e1', false, null, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12 });
    expect(besoVon(r.plan, 'e1').numberFixed).toBe(false);
    expect(r.label).toBe('Nr 10 gelöst');
  });

  it('[R-5.3-06] (2d) nach dem Stand: lösen ändert keine Nummer; Bezeichnung mit der Nummer danach', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 15, { numberFixed: true }),
        besoUm('e2', 2, MO, 540, 10),
        besoUm('e3', 3, MO, 600, 11),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e1', false, null, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 15, e2: 10, e3: 11 });
    expect(besoVon(r.plan, 'e1').numberFixed).toBe(false);
    expect(r.label).toBe('Nr 15 gelöst');
    expect(r.affectedEntryIds).toEqual(['e1']);
  });

  it('[R-5.3-06] (2d) nach dem Stand: freie Nummer fixieren ändert nur diesen Beso', () => {
    const plan = dreiAmMontag({ stand: STAND });
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e1', true, 15, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 15, e2: 11, e3: 12 });
    expect(r.affectedEntryIds).toEqual(['e1']);
  });

  it('[R-5.3-06] (1c) Bezeichnung «Nr – gelöst», wenn der Beso danach keine Nummer trägt (Kreis voll)', () => {
    const plan = planMit(
      [
        ...Array.from({ length: 10 }, (_, i) =>
          besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, 10 + i),
        ),
        besoUm('e11', 11, MO, 1200, null, { numberFixed: true }),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e11', false, null, ctx));
    expect(besoVon(r.plan, 'e11')).toMatchObject({ besoNumber: null, numberFixed: false });
    expect(r.label).toBe('Nr – gelöst');
  });

  it('[R-5.3-05] bereits so fixiert: ohne Wirkung', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10, { numberFixed: true })]);
    expectKeineWirkung(plan, setBesoNumberFixed(plan, 'e1', true, null, ctx));
    expectKeineWirkung(plan, setBesoNumberFixed(plan, 'e1', true, 10, ctx));
  });

  it('[R-5.3-05] Nummer von einem anderen gehaltenen Beso des Tages belegt → numberTaken (besoNumber)', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11, { numberFixed: true }),
      besoUm('e3', 3, MO, 600, 12, { status: 'cancelled' }),
    ]);
    expectCommandError(plan, (p) => setBesoNumberFixed(p, 'e1', true, 11, ctx), {
      code: 'numberTaken',
      field: 'besoNumber',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => setBesoNumberFixed(p, 'e1', true, 12, ctx), {
      code: 'numberTaken',
      field: 'besoNumber',
      entryId: 'e1',
    });
  });

  it('[R-5.3-05] Gegenprobe: Nummer eines nicht gehaltenen Beso (vor dem Stand) ist frei', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e3', true, 10, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 12, e3: 10 });
  });

  it('[R-5.3-06] nach dem Stand ist jede Nummer gehalten → numberTaken', () => {
    const plan = dreiAmMontag({ stand: STAND });
    expectCommandError(plan, (p) => setBesoNumberFixed(p, 'e3', true, 10, ctx), {
      code: 'numberTaken',
      field: 'besoNumber',
      entryId: 'e3',
    });
  });

  it('[R-5.3-05] ungültige Nummern → invalidNumber (besoNumber): ohne Nummer fixieren, negativ, gebrochen, lösen mit Nummer', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10), besoUm('e2', 2, MO, 540, null)]);
    for (const [fixed, nr, id] of [
      [true, null, 'e2'],
      [true, -1, 'e1'],
      [true, 12.5, 'e1'],
      [false, 12, 'e1'],
    ] as const) {
      expectCommandError(plan, (p) => setBesoNumberFixed(p, id, fixed, nr, ctx), {
        code: 'invalidNumber',
        field: 'besoNumber',
        entryId: id,
      });
    }
  });

  it('[R-5.3-05] Nummer 0 ist zulässig (ganze Zahl ab 0)', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => setBesoNumberFixed(p, 'e1', true, 0, ctx));
    expect(besoVon(r.plan, 'e1')).toMatchObject({ besoNumber: 0, numberFixed: true });
  });

  it('[R-5.3-05] kein Beso → wrongEntryType; unbekannt → notFound', () => {
    const plan = zweiFenster();
    expectCommandError(plan, (p) => setBesoNumberFixed(p, 'e6', true, null, ctx), {
      code: 'wrongEntryType',
      entryId: 'e6',
    });
    expectCommandError(plan, (p) => setBesoNumberFixed(p, 'e9', true, null, ctx), {
      code: 'notFound',
      entryId: 'e9',
    });
  });
});

describe('renumberDay und renumberDayPreview', () => {
  const durcheinander = () =>
    planMit(
      [besoUm('e1', 1, MO, 480, 12), besoUm('e2', 2, MO, 540, 10), besoUm('e3', 3, MO, 600, 11)],
      { stand: STAND },
    );

  it('[R-5.3-06] nach dem Stand: Vorschau alt → neu in Sortierreihenfolge; Befehl nummeriert danach', () => {
    const plan = durcheinander();
    expect(renumberDayPreview(plan, MO)).toEqual([
      { besoId: 'e1', from: 12, to: 10 },
      { besoId: 'e2', from: 10, to: 11 },
      { besoId: 'e3', from: 11, to: 12 },
    ]);
    const r = run(plan, (p) => renumberDay(p, MO, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12 });
    expect(r.label).toBe('Montag 28.09.2026 neu nummeriert');
    expect(r.affectedDates).toEqual([MO]);
  });

  it('[R-5.3-06] (2d) Vorschau in Sortierreihenfolge, nicht in Erfassungsreihenfolge', () => {
    const plan = planMit([besoUm('e1', 1, MO, 600, 10), besoUm('e2', 2, MO, 480, 11)], {
      stand: STAND,
    });
    expect(renumberDayPreview(plan, MO)).toEqual([
      { besoId: 'e2', from: 11, to: 10 },
      { besoId: 'e1', from: 10, to: 11 },
    ]);
  });

  it('[R-5.3-05] renumberDay hält fixierte Nummern; Vorschau nennt alle Beso des Tages', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 12),
        besoUm('e2', 2, MO, 540, 10, { numberFixed: true }),
        besoUm('e3', 3, MO, 600, 13),
      ],
      { stand: STAND },
    );
    expect(renumberDayPreview(plan, MO)).toEqual([
      { besoId: 'e1', from: 12, to: 11 },
      { besoId: 'e2', from: 10, to: 10 },
      { besoId: 'e3', from: 13, to: 12 },
    ]);
    const r = run(plan, (p) => renumberDay(p, MO, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 10, e3: 12 });
  });

  it('[R-5.3-12] nach «Tag neu nummerieren» zeigt ein Verweis die neue Nummer', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 12),
        besoUm('e2', 2, MO, 540, 10),
        block('e3', 3, { date: DI, title: titelMitVerweis('Nachbereitung ', 'e1') }),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) => renumberDay(p, MO, ctx));
    expect(eintrag(r.plan, 'e3')).toEqual(plan.entries.e3);
    expect(besoVon(r.plan, 'e1').besoNumber).toBe(10);
    const titel = resolveTitle(r.plan, (eintrag(r.plan, 'e3') as Block).title);
    expect(titel.map((x) => x.text).join('')).toBe('Nachbereitung (10)');
  });

  it('[R-5.3-06] Tag ohne Beso oder schon in Ordnung: leere Vorschau bzw. ohne Wirkung', () => {
    const plan = dreiAmMontag({ stand: STAND });
    expect(renumberDayPreview(plan, DI)).toEqual([]);
    expectKeineWirkung(plan, renumberDay(plan, DI, ctx));
    expectKeineWirkung(plan, renumberDay(plan, MO, ctx));
  });

  it('[R-5.3-06] ungültiges Datum: Befehl → invalidDate (date), Vorschau → ModelError invalidDate', () => {
    const plan = dreiAmMontag({ stand: STAND });
    expectCommandError(plan, (p) => renumberDay(p, '2026-02-30', ctx), {
      code: 'invalidDate',
      field: 'date',
    });
    expectModelError(() => renumberDayPreview(plan, '2026-02-30'), { code: 'invalidDate' });
  });
});

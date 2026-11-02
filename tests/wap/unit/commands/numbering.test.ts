// @vitest-environment jsdom
// Beso-Nummerierung, rein (Vertrag E1-03 Abschnitt 3; Beschrieb 5.3; F-13, F-14, F-52; O-2).
import { describe, expect, it } from 'vitest';
import { assignNumbers, numberRange } from '../../../../src/model/wap/commands/numbering';
import type { Plan, Weekday } from '../../../../src/model/wap/types';
import {
  besoUm,
  DI,
  FR,
  fenster,
  MO,
  MO2,
  nummern,
  planMit,
  SO,
  STAND,
} from '../../support/commands/helpers';
import { beso, block, expectModelError, win } from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

const WOCHENTAGE: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function zuordnung(plan: Plan, date: string, mode?: 'auto' | 'renumber'): Record<string, unknown> {
  const m = mode === undefined ? assignNumbers(plan, date) : assignNumbers(plan, date, mode);
  return Object.fromEntries(m);
}

describe('numberRange', () => {
  it('[R-5.3-02] Nummernkreise Mo 10er, Di 20er, Mi 30er, Do 40er, Fr 50er, Sa 60er, So 70er', () => {
    expect(WOCHENTAGE.map((d) => numberRange(d))).toEqual([
      { min: 10, max: 19 },
      { min: 20, max: 29 },
      { min: 30, max: 39 },
      { min: 40, max: 49 },
      { min: 50, max: 59 },
      { min: 60, max: 69 },
      { min: 70, max: 79 },
    ]);
  });

  it('[R-5.3-02] unbekannter Wochentag ist ein Programmfehler (RangeError, Änderungsnotiz V09c)', () => {
    expect(() => numberRange('Xx' as Weekday)).toThrow(RangeError);
  });
});

describe('assignNumbers vor dem ersten Stand', () => {
  it('[R-5.3-03] drei Beso 1400, 0800, 1000 → 12, 10, 11 (laufend nach Sortierzeit)', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 840, null),
      besoUm('e2', 2, MO, 480, null),
      besoUm('e3', 3, MO, 600, null),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e1: 12, e2: 10, e3: 11 });
  });

  it('[R-5.3-03] Sortierreihenfolge: kleinste Sortierzeit über alle Zeitfenster, dann createdSeq, dann id', () => {
    const plan = planMit([
      // e1: zwei Zeitfenster, das frühere (0700) zählt
      beso('e1', 1, {
        date: MO,
        besoNumber: null,
        windows: [
          fenster('t1a', { form: 'point', at: 840 }),
          fenster('t1b', { form: 'point', at: 420 }),
        ],
      }),
      // e3: «bis 0700» hat Sortierzeit 0700 wie e1, aber spätere Erfassung
      beso('e3', 3, {
        date: MO,
        besoNumber: null,
        windows: [fenster('t3', { form: 'until', to: 420 })],
      }),
      // e2 und e4: gleiche Zeit und gleiche Erfassung → nach id
      besoUm('e4', 2, MO, 540, null),
      besoUm('e2', 2, MO, 540, null),
      // e5: Frist ohne Zeit → Sortierzeit 0
      beso('e5', 9, { date: MO, besoNumber: null, windows: [fenster('t5', { form: 'deadline' })] }),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e5: 10, e1: 11, e3: 12, e2: 13, e4: 14 });
  });

  it('[R-5.3-03] nicht gehaltene Nummern werden neu vergeben; jeder Status zählt; nur Beso dieses Datums', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 15),
      besoUm('e2', 2, MO, 420, 10, { status: 'open' }),
      besoUm('e3', 3, DI, 400, 20),
      block('e4', 4, { date: MO }),
      besoUm('e5', 5, MO2, 300, null),
    ]);
    // e5 liegt am selben Wochentag einer anderen Woche: je Datum, nicht je Wochentag
    expect(zuordnung(plan, MO)).toEqual({ e2: 10, e1: 11 });
    expect(zuordnung(plan, MO2)).toEqual({ e5: 10 });
    expect(zuordnung(plan, '2026-10-03')).toEqual({});
  });

  it('[R-5.3-05] fixierte Nummer bleibt; die übrigen erhalten die freien Nummern aufsteigend (F-13)', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, null),
      besoUm('e2', 2, MO, 540, 13, { numberFixed: true }),
      besoUm('e3', 3, MO, 600, null),
      besoUm('e4', 4, MO, 660, null),
      besoUm('e5', 5, MO, 720, 11),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 13, e3: 11, e4: 12, e5: 14 });
  });

  it('[R-5.3-05] fixierte Nummer ausserhalb des Kreises bleibt und belegt im Kreis nichts', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 25, { numberFixed: true }),
      besoUm('e2', 2, MO, 420, null),
      besoUm('e3', 3, MO, 540, null),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e1: 25, e2: 10, e3: 11 });
  });

  it('[R-5.3-05] fixiert ohne Nummer ist nicht gehalten und erhält eine Nummer', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 360, null, { numberFixed: true }),
      besoUm('e2', 2, MO, 480, 10),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 11 });
  });

  it('[R-5.3-09] gestrichener Beso behält seine Nummer schon vor dem ersten Stand; sie wird nicht neu vergeben (P-9)', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11, { status: 'cancelled' }),
      besoUm('e3', 3, MO, 600, 12),
      besoUm('e4', 4, MO, 420, null),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e4: 10, e1: 12, e2: 11, e3: 13 });
  });

  it('[R-5.3-09] gestrichener Beso ohne Nummer ist nicht gehalten und erhält eine', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 420, null, { status: 'cancelled' }),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e2: 10, e1: 11 });
  });

  it('[R-5.3-10] elf Beso am Montag: 10 … 19 nach Sortierzeit, der elfte erhält keine Nummer, nie 20 (F-14)', () => {
    const plan = planMit(
      Array.from({ length: 11 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, null)),
    );
    const m = zuordnung(plan, MO);
    expect(m).toEqual({
      e1: 10,
      e2: 11,
      e3: 12,
      e4: 13,
      e5: 14,
      e6: 15,
      e7: 16,
      e8: 17,
      e9: 18,
      e10: 19,
      e11: null,
    });
  });

  it('[R-5.3-10] elf Beso am Sonntag: keine Nummer 80, der elfte bleibt ohne Nummer', () => {
    const plan = planMit(
      Array.from({ length: 11 }, (_, i) => besoUm(`e${i + 1}`, i + 1, SO, 360 + 60 * i, null)),
    );
    const werte = Object.values(zuordnung(plan, SO));
    expect(werte.filter((n) => n === null)).toHaveLength(1);
    expect(werte.filter((n) => n !== null).sort()).toEqual([
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
    ]);
  });

  it('[R-5.3-10] zehn fixierte Nummern im Kreis: ein weiterer Beso bleibt ohne Nummer', () => {
    const fixiert = Array.from({ length: 10 }, (_, i) =>
      besoUm(`e${i + 1}`, i + 1, MO, 600 + 10 * i, 10 + i, { numberFixed: true }),
    );
    const plan = planMit([...fixiert, besoUm('e11', 11, MO, 300, null)]);
    expect(zuordnung(plan, MO).e11).toBeNull();
  });

  it('[R-5.3-10] Gegenprobe: zehn Beso im Kreis und einer mit fixierter Nummer ausserhalb → alle nummeriert', () => {
    const plan = planMit([
      ...Array.from({ length: 10 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, null)),
      besoUm('e11', 11, MO, 300, 25, { numberFixed: true }),
    ]);
    const m = zuordnung(plan, MO);
    expect(Object.values(m).filter((n) => n === null)).toHaveLength(0);
    expect(m.e11).toBe(25);
    expect(m.e1).toBe(10);
    expect(m.e10).toBe(19);
  });
});

describe('assignNumbers ab dem ersten Stand (Modus auto)', () => {
  it('[R-5.3-06] jede vorhandene Nummer bleibt, auch gegen die Sortierreihenfolge', () => {
    const plan = planMit(
      [besoUm('e1', 1, MO, 480, 12), besoUm('e2', 2, MO, 540, 10), besoUm('e3', 3, MO, 600, 11)],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO)).toEqual({ e1: 12, e2: 10, e3: 11 });
  });

  it('[R-5.3-06] KVK-Fixture (mit Stand): jede Nummer jedes Tages bleibt', () => {
    const plan = loadKvkPlan();
    expect(plan.stand).not.toBeNull();
    for (const date of [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-04',
    ]) {
      expect(zuordnung(plan, date)).toEqual(nummern(plan, date));
    }
  });

  it('[R-5.3-07] Mo belegt 10–13 → neuer Beso erhält 14, unabhängig von seiner Zeit (F-13)', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 600, 12),
        besoUm('e4', 4, MO, 660, 13),
        besoUm('e5', 5, MO, 300, null),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12, e4: 13, e5: 14 });
  });

  it('[R-5.3-07] Lücke unter der höchsten belegten Nummer wird nicht genutzt (10, 11, 13 → 14)', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 600, 13),
        besoUm('e4', 4, MO, 300, null),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO).e4).toBe(14);
  });

  it('[R-5.3-07] ist 19 belegt, erhält der neue Beso die kleinste freie Nummer im Kreis', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 12),
        besoUm('e3', 3, MO, 600, 19),
        besoUm('e4', 4, MO, 900, null),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO).e4).toBe(11);
  });

  it('[R-5.3-07] mehrere neue Beso: in Sortierreihenfolge, jede vergebene Nummer gilt sofort als belegt', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 540, null),
        besoUm('e4', 4, MO, 420, null),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 11, e4: 12, e3: 13 });
  });

  it('[R-5.3-07] gehaltene Nummer ausserhalb des Kreises zählt nicht als höchste belegte (nie Folgekreis)', () => {
    const plan = planMit(
      [besoUm('e1', 1, MO, 480, 10), besoUm('e2', 2, MO, 540, 25), besoUm('e3', 3, MO, 600, null)],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 25, e3: 11 });
  });

  it('[R-5.3-09] (a) nach dem ersten Stand, Mo 10–12, Beso 12 gestrichen → neuer Beso erhält 13, nicht 12', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 600, 12, { status: 'cancelled' }),
        besoUm('e4', 4, MO, 300, null),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12, e4: 13 });
  });

  it('[R-5.3-09] (b) Mo 10–19 belegt, Beso 12 gestrichen, kein neuer Stand → neuer Beso ohne Nummer', () => {
    const plan = planMit(
      [
        ...Array.from({ length: 10 }, (_, i) =>
          besoUm(
            `e${i + 1}`,
            i + 1,
            MO,
            360 + 60 * i,
            10 + i,
            i === 2 ? { status: 'cancelled' } : {},
          ),
        ),
        besoUm('e11', 11, MO, 300, null),
      ],
      { stand: STAND },
    );
    const m = zuordnung(plan, MO);
    expect(m.e11).toBeNull();
    expect(m.e3).toBe(12);
  });

  it('[R-5.3-09] (c) nach neuem Stand fehlt der gestrichene Beso 12 → ein neuer Beso erhält 12 (F-52)', () => {
    const nummernOhne12 = [10, 11, 13, 14, 15, 16, 17, 18, 19];
    const plan = planMit(
      [
        ...nummernOhne12.map((nr, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, nr)),
        besoUm('e20', 20, MO, 1200, null),
      ],
      { stand: { date: '2026-09-25', version: 2 } },
    );
    expect(zuordnung(plan, MO).e20).toBe(12);
  });

  it('[R-5.3-10] nach dem Stand Mo 10–19 belegt → elfter Beso ohne Nummer, übrige unverändert', () => {
    const plan = planMit(
      [
        ...Array.from({ length: 10 }, (_, i) =>
          besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, 19 - i),
        ),
        besoUm('e11', 11, MO, 300, null),
      ],
      { stand: STAND },
    );
    const m = zuordnung(plan, MO);
    expect(m.e11).toBeNull();
    expect(m.e1).toBe(19);
    expect(m.e10).toBe(10);
  });
});

describe('assignNumbers im Modus renumber («Tag neu nummerieren»)', () => {
  it('[R-5.3-06] nach dem Stand nummeriert renumber den Tag nach Sortierzeit', () => {
    const plan = planMit(
      [besoUm('e1', 1, MO, 480, 12), besoUm('e2', 2, MO, 540, 10), besoUm('e3', 3, MO, 600, 11)],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO, 'renumber')).toEqual({ e1: 10, e2: 11, e3: 12 });
  });

  it('[R-5.3-05] renumber hält fixierte Nummern', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 12),
        besoUm('e2', 2, MO, 540, 10, { numberFixed: true }),
        besoUm('e3', 3, MO, 600, 11),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO, 'renumber')).toEqual({ e1: 11, e2: 10, e3: 12 });
  });

  it('[R-5.3-09] renumber hält gestrichene Beso mit Nummer', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 420, 15, { status: 'cancelled' }),
        besoUm('e2', 2, MO, 480, 12),
        besoUm('e3', 3, MO, 540, 10),
      ],
      { stand: STAND },
    );
    expect(zuordnung(plan, MO, 'renumber')).toEqual({ e1: 15, e2: 10, e3: 11 });
  });
});

describe('assignNumbers – Gleichstand nach id (Orchestrator b)', () => {
  it('[R-5.3-03] gleiche Sortierzeit und Erfassung: id nach UTF-16-Codeeinheiten, «e10» vor «e9», «e100» vor «e99»', () => {
    const plan = planMit([
      besoUm('e9', 4, MO, 600, null),
      besoUm('e10', 4, MO, 600, null),
      besoUm('e99', 7, MO, 660, null),
      besoUm('e100', 7, MO, 660, null),
    ]);
    expect(zuordnung(plan, MO)).toEqual({ e10: 10, e9: 11, e100: 12, e99: 13 });
  });
});

describe('assignNumbers – Eingaben', () => {
  it('[R-5.3-02] ungültiges Datum → ModelError invalidDate (Änderungsnotiz V09c)', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)]);
    expectModelError(() => assignNumbers(plan, '2026-02-30'), { code: 'invalidDate' });
  });

  it('[R-5.3-02] der Kreis hängt nur vom Wochentag ab: gleicher Beso am Freitag erhält 50', () => {
    const plan = planMit([
      beso('e1', 1, { date: FR, besoNumber: null, windows: [win('t1')] }),
      beso('e2', 2, { date: DI, besoNumber: null, windows: [win('t2')] }),
    ]);
    expect(zuordnung(plan, FR)).toEqual({ e1: 50 });
    expect(zuordnung(plan, DI)).toEqual({ e2: 20 });
  });
});

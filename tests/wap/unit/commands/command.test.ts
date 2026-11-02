// @vitest-environment jsdom
// Befehlsform (Vertrag E1-03 Abschnitt 1, 1a, 1b; 8 P-1, P-2, P-4, P-5; ADR-002 Punkt 7 und 8b; AR0-41).
// Die Befehlsform hat keine eigene Anforderungs-ID; die Tests tragen die ID des fachlichen Falls.
import { applyPatches, castDraft } from 'immer';
import { describe, expect, it } from 'vitest';
import { CommandError, command } from '../../../../src/model/wap/commands/command';
import type { Beso } from '../../../../src/model/wap/types';
import {
  besoUm,
  besoVon,
  ctx,
  DI,
  expectCommandError,
  expectKeineWirkung,
  MO,
  nummern,
  planMit,
  run,
} from '../../support/commands/helpers';
import { beso, block, catchError, querbalken, win } from '../../support/model/builders';

describe('command: Rezept, IDs und Patches', () => {
  it('[R-5.3-03] (1a, P-1) neuer Beso: IDs aus nextId, createdSeq aus nextSeq, Nummer vergeben, Undo stellt Zähler exakt her', () => {
    const plan = planMit([], { nextSeq: 7 });
    const r = run(plan, (p) =>
      command(
        p,
        'Testbefehl',
        (d, t) => {
          const id = t.newId('e');
          const fensterId = t.newId('t');
          const seq = t.newSeq();
          d.entries[id] = castDraft(
            beso(id, seq, {
              date: MO,
              besoNumber: null,
              windows: [win(fensterId, { time: { form: 'point', at: 600 } })],
            }),
          );
        },
        ctx,
      ),
    );
    const neu = besoVon(r.plan, 'e100');
    expect(neu.createdSeq).toBe(7);
    expect(neu.windows.map((w) => w.id)).toEqual(['t101']);
    expect(neu.besoNumber).toBe(10);
    expect(r.plan.nextId).toBe(102);
    expect(r.plan.nextSeq).toBe(8);
    expect(r.label).toBe('Testbefehl');
    expect(r.affectedEntryIds).toEqual(['e100']);
    expect(r.affectedDates).toEqual([MO]);
    const rueckgaengig = applyPatches(r.plan, r.inversePatches);
    expect(rueckgaengig.nextId).toBe(100);
    expect(rueckgaengig.nextSeq).toBe(7);
    expect(rueckgaengig.entries.e100).toBeUndefined();
  });

  it('[R-5.3-03] (1a Schritt 4) Rezept ohne Änderung: gleicher Plan, leere Patches, nichts betroffen', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)]);
    const r = command(plan, 'nichts', () => {}, ctx);
    expectKeineWirkung(plan, r);
  });

  it('[R-5.3-03] (1a Schritt 4) Rezept schreibt denselben Wert: ohne Wirkung', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)]);
    const r = command(
      plan,
      'gleich',
      (d) => {
        d.unit = plan.unit;
        const e = d.entries.e1;
        if (e !== undefined && e.type === 'beso') e.besoNumber = 10;
      },
      ctx,
    );
    expectKeineWirkung(plan, r);
  });
});

describe('command: Nummerierung (1a Schritt 3, P-5)', () => {
  const vorher = () =>
    planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11),
      besoUm('e3', 3, DI, 480, 20),
    ]);

  it("[R-5.3-04] numbering 'auto' (Standard): geänderter Beso → sein Tag wird neu nummeriert", () => {
    const plan = vorher();
    const r = run(plan, (p) =>
      command(
        p,
        'früher',
        (d) => {
          const e = d.entries.e2;
          if (e !== undefined && e.type === 'beso' && e.windows[0] !== undefined) {
            e.windows[0].time = { form: 'point', at: 420 };
          }
        },
        ctx,
      ),
    );
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 10 });
    expect(nummern(r.plan, DI)).toEqual({ e3: 20 });
    expect(r.affectedEntryIds).toEqual(['e1', 'e2']);
    expect(r.affectedDates).toEqual([MO]);
  });

  it("[R-5.3-04] numbering 'none' (Import, Stand; F-64-Schalter): Nummern bleiben, wie das Rezept sie hinterlässt", () => {
    const plan = vorher();
    const r = run(plan, (p) =>
      command(
        p,
        'früher',
        (d, t) => {
          const e = d.entries.e2;
          if (e !== undefined && e.type === 'beso' && e.windows[0] !== undefined) {
            e.windows[0].time = { form: 'point', at: 420 };
          }
          const id = t.newId('e');
          d.entries[id] = castDraft(besoUm(id, t.newSeq(), MO, 900, 33));
        },
        ctx,
        { numbering: 'none' },
      ),
    );
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e100: 33 });
  });

  it('[R-5.3-04] (1a Schritt 3) Änderung nur an einem Block: Beso des Tages bleiben unberührt, auch mit abweichender Nummer', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 17), block('e2', 2, { date: MO })]);
    const r = run(plan, (p) =>
      command(
        p,
        'Zusatz',
        (d) => {
          const e = d.entries.e2;
          if (e !== undefined && e.type === 'block') e.supplement = 'Ukft';
        },
        ctx,
      ),
    );
    expect(nummern(r.plan, MO)).toEqual({ e1: 17 });
    expect(r.affectedEntryIds).toEqual(['e2']);
  });
});

describe('command: Prüfung nach dem Rezept (1a Schritt 2, P-4) und Fehler (1a Schritt 5)', () => {
  it('[R-4.6-25] Rezept fügt Beso ohne Zeitfenster hinzu → besoWithoutWindow (windows, Eintrag); Plan unverändert', () => {
    const plan = planMit([]);
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'leer',
          (d, t) => {
            const id = t.newId('e');
            d.entries[id] = castDraft(beso(id, t.newSeq(), { date: MO, windows: [] }));
          },
          ctx,
        ),
      { code: 'besoWithoutWindow', field: 'windows', entryId: 'e100' },
    );
  });

  it('[R-4.7-11] (1a Schritt 2, §4) Rezept fügt Block mit unbekannter Kategorie hinzu → invalidEntry (categoryId, Eintrag)', () => {
    const plan = planMit([]);
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'Block',
          (d, t) => {
            const id = t.newId('e');
            d.entries[id] = castDraft(block(id, t.newSeq(), { categoryId: 'k99' }));
          },
          ctx,
        ),
      { code: 'invalidEntry', field: 'categoryId', entryId: 'e100' },
    );
  });

  it('[R-4.7-11][R-4.4-06] (1a Schritt 2, §4) Rezept legt Block in die Rap-Spalte → invalidPlacement (columns)', () => {
    const plan = planMit([]);
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'Block',
          (d, t) => {
            const id = t.newId('e');
            d.entries[id] = castDraft(
              block(id, t.newSeq(), { date: MO, columns: { kind: 'ids', ids: ['c14'] } }),
            );
          },
          ctx,
        ),
      { code: 'invalidPlacement', field: 'columns', entryId: 'e100' },
    );
  });

  it('[R-5.3-01] (P-4) Beso ausserhalb aller Wochen wäre auf keiner Seite sichtbar → outsidePlan (date)', () => {
    const plan = planMit([]);
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'aussen',
          (d, t) => {
            const id = t.newId('e');
            d.entries[id] = castDraft(besoUm(id, t.newSeq(), '2026-12-07', 600, null));
          },
          ctx,
        ),
      { code: 'outsidePlan', field: 'date', entryId: 'e100' },
    );
  });

  it('[R-5.3-01] (P-4) Querbalken: mindestens ein Tag im Plan genügt; ganz ausserhalb → outsidePlan (fromDate)', () => {
    const plan = planMit([]);
    const r = run(plan, (p) =>
      command(
        p,
        'Messe',
        (d, t) => {
          const id = t.newId('e');
          d.entries[id] = castDraft(
            querbalken(id, t.newSeq(), { fromDate: '2026-09-20', toDate: '2026-09-28' }),
          );
        },
        ctx,
      ),
    );
    expect(r.plan.entries.e100?.type).toBe('querbalken');
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'Messe',
          (d, t) => {
            const id = t.newId('e');
            d.entries[id] = castDraft(
              querbalken(id, t.newSeq(), { fromDate: '2026-12-01', toDate: '2026-12-03' }),
            );
          },
          ctx,
        ),
      { code: 'outsidePlan', field: 'fromDate', entryId: 'e100' },
    );
  });

  it('[R-4.6-25] (1a Schritt 5) CommandError aus dem Rezept wird unverändert weitergegeben', () => {
    const plan = planMit([]);
    const eigener = new CommandError(
      'notFound',
      { cause: 'fehlt', nextStep: 'wählen' },
      { entryId: 'e7' },
    );
    const e = catchError(() =>
      command(
        plan,
        'x',
        () => {
          throw eigener;
        },
        ctx,
      ),
    );
    expect(e).toBe(eigener);
  });

  it('[R-4.6-25] (1a Schritt 5) andere Ausnahmen sind Programmfehler und werden nicht umgedeutet', () => {
    const plan = planMit([]);
    const programmfehler = new TypeError('Programmfehler im Rezept');
    const e = catchError(() =>
      command(
        plan,
        'x',
        () => {
          throw programmfehler;
        },
        ctx,
      ),
    );
    expect(e).toBe(programmfehler);
  });
});

describe('command: Betroffenes (1b)', () => {
  it('[R-5.3-04] (1b) Zeitfenster über Mitternacht: Datum und Folgetag betroffen; IDs sortiert wie Array.prototype.sort()', () => {
    const plan = planMit([
      besoUm('e9', 1, MO, 480, 10),
      besoUm('e10', 2, MO, 540, 11),
      besoUm('e100', 3, MO, 600, 12),
    ]);
    const r = run(plan, (p) =>
      command(
        p,
        'Nacht',
        (d) => {
          const e = d.entries.e100;
          if (e !== undefined && e.type === 'beso' && e.windows[0] !== undefined) {
            e.windows[0].time = { form: 'range', from: 360, to: 1500 };
          }
        },
        ctx,
      ),
    );
    // e100 rückt an den Anfang: 10; e9 11; e10 12
    expect(nummern(r.plan, MO)).toEqual({ e9: 11, e10: 12, e100: 10 });
    expect(r.affectedEntryIds).toEqual(['e10', 'e100', 'e9']);
    expect(r.affectedDates).toEqual([MO, DI]);
  });

  it('[R-5.3-04] (1b) geänderte DayConfig trägt ihr Datum bei, ohne Einträge', () => {
    const plan = planMit([]);
    const r = run(plan, (p) =>
      command(
        p,
        'Notiz',
        (d) => {
          const w = d.weeks[0];
          if (w !== undefined) w.days[2].internalNote = 'intern';
        },
        ctx,
      ),
    );
    expect(r.affectedDates).toEqual(['2026-09-30']);
    expect(r.affectedEntryIds).toEqual([]);
  });

  it('[R-5.3-04] (1b) andere Änderungen (Planfelder) tragen keine Daten bei', () => {
    const plan = planMit([]);
    const r = run(plan, (p) =>
      command(
        p,
        'Einheit',
        (d) => {
          d.unit = 'Inf Kp 98/2';
        },
        ctx,
      ),
    );
    expect(r.plan.unit).toBe('Inf Kp 98/2');
    expect(r.affectedDates).toEqual([]);
    expect(r.affectedEntryIds).toEqual([]);
    expect(r.patches.length).toBeGreaterThan(0);
  });
});

describe('command: keine Aufgebotsart (AGENTS.md, Vertrag Kopf)', () => {
  it('[R-5.3-02] Plan.service bleibt Freitext: wird nie gesetzt oder aus Woche, Dauer oder Daten abgeleitet', () => {
    for (const service of ['', 'KVK', 'WK', 'FDT 2099']) {
      const plan = planMit([besoUm('e1', 1, MO, 480, null)], { service });
      const r = run(plan, (p) =>
        command(
          p,
          'Zeit',
          (d) => {
            const e = d.entries.e1;
            if (e !== undefined && e.type === 'beso' && e.windows[0] !== undefined) {
              e.windows[0].time = { form: 'point', at: 420 };
            }
          },
          ctx,
        ),
      );
      expect(r.plan.service).toBe(service);
      expect(Object.keys(r.plan).sort()).toEqual(Object.keys(plan).sort());
      expect((r.plan.entries.e1 as Beso).besoNumber).toBe(10);
    }
  });
});

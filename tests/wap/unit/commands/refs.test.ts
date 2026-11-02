// @vitest-environment jsdom
// Verweise auf Beso-Nummern in Titeln (Vertrag E1-03 Abschnitt 2, 2e; Änderungsnotiz V09c; Beschrieb 5.3;
// Vorschlag V-03-7).
import { describe, expect, it } from 'vitest';
import { createEntry, updateEntry } from '../../../../src/model/wap/commands/entries';
import { linkBesoRefs } from '../../../../src/model/wap/commands/refs';
import { resolveTitle } from '../../../../src/model/wap/derive/agenda';
import type { Plan, RichText } from '../../../../src/model/wap/types';
import {
  besoUm,
  ctx,
  DI,
  DI2,
  eintrag,
  MI,
  MI2,
  MO,
  planMit,
  run,
  SA,
  titelMitVerweis,
} from '../../support/commands/helpers';
import { block, expectModelError, plain, rt } from '../../support/model/builders';

/** Di (w26): e4 0700 #20, e5 0800 #21; Di (w27): e6 0800 #22. */
function planMitBeso(over: Partial<Plan> = {}): Plan {
  return planMit(
    [besoUm('e4', 4, DI, 420, 20), besoUm('e5', 5, DI, 480, 21), besoUm('e6', 6, DI2, 480, 22)],
    over,
  );
}

function verweis(id: string, bold = false): RichText[number] {
  return { text: '', bold, besoRef: id };
}

describe('linkBesoRefs (rein)', () => {
  it('[R-5.3-11] Titel «Waffenplatzbegehung (21)» → Verweis auf Beso 21 erkannt', () => {
    expect(linkBesoRefs(planMitBeso(), MI, rt('Waffenplatzbegehung (21)'))).toEqual([
      { text: 'Waffenplatzbegehung ', bold: false },
      verweis('e5'),
    ]);
  });

  it('[R-5.3-11] Fettung kommt vom Ursprungslauf; Text danach wird weiter geprüft', () => {
    expect(linkBesoRefs(planMitBeso(), MI, rt('Siehe (20) und (21).', true))).toEqual([
      { text: 'Siehe ', bold: true },
      verweis('e4', true),
      { text: ' und ', bold: true },
      verweis('e5', true),
      { text: '.', bold: true },
    ]);
  });

  it('[R-5.3-11] nur «(21)»: kein leerer Textlauf davor; leere Textläufe entfallen', () => {
    expect(linkBesoRefs(planMitBeso(), MI, rt('(21)'))).toEqual([verweis('e5')]);
    expect(
      linkBesoRefs(planMitBeso(), MI, [
        { text: '', bold: true },
        { text: 'A (21)', bold: false },
      ]),
    ).toEqual([{ text: 'A ', bold: false }, verweis('e5')]);
  });

  it('[R-5.3-11] ohne Beso dieser Nummer in der Woche bleibt der Titel unverändert', () => {
    const titel = rt('Waffenplatzbegehung (23)');
    expect(linkBesoRefs(planMitBeso(), MI, titel)).toEqual(titel);
  });

  it('[R-5.3-11] (V-03-7) nur innerhalb der Woche: (22) liegt in w27 → in w26 kein Verweis, in w27 schon', () => {
    const titel = rt('Nachbereitung (22)');
    expect(linkBesoRefs(planMitBeso(), MI, titel)).toEqual(titel);
    expect(linkBesoRefs(planMitBeso(), MI2, titel)).toEqual([
      { text: 'Nachbereitung ', bold: false },
      verweis('e6'),
    ]);
  });

  it('[R-5.3-11] (V-03-7) nur bei eindeutiger Nummer: zwei Beso der Woche mit 21 → kein Verweis', () => {
    const plan = planMit([
      besoUm('e5', 5, DI, 480, 21),
      besoUm('e7', 7, SA, 480, 21, { numberFixed: true }),
    ]);
    const titel = rt('Waffenplatzbegehung (21)');
    expect(linkBesoRefs(plan, MI, titel)).toEqual(titel);
  });

  it('[R-5.3-11] Muster: «(021)», «( 21)» und Beso ohne Nummer ergeben keinen Verweis; «(0)» schon', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 0, { numberFixed: true }),
      besoUm('e2', 2, MO, 540, null),
    ]);
    for (const text of ['A (021)', 'A ( 21)', 'A (null)', 'A ()']) {
      expect(linkBesoRefs(plan, MI, rt(text))).toEqual(rt(text));
    }
    expect(linkBesoRefs(plan, MI, rt('A (0)'))).toEqual([
      { text: 'A ', bold: false },
      verweis('e1'),
    ]);
  });

  it('[R-5.3-11] bestehende Verweis-Läufe bleiben unverändert', () => {
    const titel = titelMitVerweis('Vor ', 'e9');
    expect(linkBesoRefs(planMitBeso(), MI, titel)).toEqual(titel);
  });

  it('[R-5.3-11] Datum ausserhalb aller Wochen: unverändert; ungültiges Datum → ModelError invalidDate', () => {
    const titel = rt('Waffenplatzbegehung (21)');
    expect(linkBesoRefs(planMitBeso(), '2026-12-07', titel)).toEqual(titel);
    expectModelError(() => linkBesoRefs(planMitBeso(), '2026-02-30', titel), {
      code: 'invalidDate',
    });
  });
});

describe('Verweise in Befehlen (R-5.3-11, R-5.3-12)', () => {
  it('[R-5.3-11] createEntry: Block-Titel wird automatisch verlinkt und gespeichert', () => {
    const plan = planMitBeso();
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MI,
          time: { form: 'range', from: 840, to: 960 },
          columns: { kind: 'ids', ids: ['c17'] },
          title: rt('Waffenplatzbegehung (21)'),
        },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({
      title: [{ text: 'Waffenplatzbegehung ', bold: false }, verweis('e5')],
    });
    expect(r.label).toBe('Block «Waffenplatzbegehung (21)» erstellt');
  });

  it('[R-5.3-11] createEntry: auch Beso- und Querbalken-Titel (Querbalken: Woche von fromDate)', () => {
    const plan = planMitBeso();
    const b = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'beso',
          date: MI,
          title: rt('Vorbereitung (21)'),
          windows: [{ time: { form: 'point', at: 600 } }],
        },
        ctx,
      ),
    );
    expect(eintrag(b.plan, 'e100')).toMatchObject({
      title: [{ text: 'Vorbereitung ', bold: false }, verweis('e5')],
    });
    const q = run(plan, (p) =>
      createEntry(
        p,
        { type: 'querbalken', fromDate: SA, toDate: DI2, title: rt('Messe (21)') },
        ctx,
      ),
    );
    expect(eintrag(q.plan, 'e100')).toMatchObject({
      title: [{ text: 'Messe ', bold: false }, verweis('e5')],
    });
  });

  it('[R-5.3-11] updateEntry: neuer Titel wird verlinkt, mit der Woche des Datums nach dem Befehl', () => {
    const plan = planMitBeso({});
    const mitBlock = {
      ...plan,
      entries: {
        ...plan.entries,
        e1: block('e1', 1, { date: MI, columns: { kind: 'ids', ids: ['c17'] } }),
      },
    };
    const r = run(mitBlock, (p) =>
      updateEntry(p, 'e1', 'block', { title: rt('Nachbereitung (21)') }, ctx),
    );
    expect(eintrag(r.plan, 'e1')).toMatchObject({
      title: [{ text: 'Nachbereitung ', bold: false }, verweis('e5')],
    });
    const r2 = run(mitBlock, (p) =>
      updateEntry(p, 'e1', 'block', { date: MI2, title: rt('Nachbereitung (22)') }, ctx),
    );
    expect(eintrag(r2.plan, 'e1')).toMatchObject({
      title: [{ text: 'Nachbereitung ', bold: false }, verweis('e6')],
    });
  });

  it('[R-5.3-12] Beso 21 → 22 (früherer Beso am Di vor dem Stand) → Titel zeigt «(22)», Verweis über die ID', () => {
    const plan = planMitBeso();
    const mitBlock = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MI,
          time: { form: 'range', from: 840, to: 960 },
          columns: { kind: 'ids', ids: ['c17'] },
          title: rt('Waffenplatzbegehung (21)'),
        },
        ctx,
      ),
    ).plan;
    const r = run(mitBlock, (p) =>
      createEntry(
        p,
        { type: 'beso', date: DI, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    const titel = (eintrag(r.plan, 'e100') as { title: RichText }).title;
    expect(titel).toEqual([{ text: 'Waffenplatzbegehung ', bold: false }, verweis('e5')]);
    expect(plain(resolveTitle(r.plan, titel))).toBe('Waffenplatzbegehung (22)');
  });
});

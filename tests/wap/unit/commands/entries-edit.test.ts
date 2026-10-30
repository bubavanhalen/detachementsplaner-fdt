// @vitest-environment jsdom
// Ändern, Verschieben, Löschen, Kopieren (Vertrag E1-03 Abschnitt 2, 2a, 1b, 1c, 3; Änderungsnotiz V02, V04,
// V09; Beschrieb 4.7, 5.1, 5.3; F-13, F-22, F-48; Vorschläge V-03-4, V-03-5, V-03-9).
import { describe, expect, it } from 'vitest';
import {
  copyEntries,
  copyEntryToDates,
  deleteEntries,
  moveEntries,
  updateEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import { agendaLinesForDate, resolveTitle } from '../../../../src/model/wap/derive/agenda';
import { dayColumns, resolveColumns } from '../../../../src/model/wap/derive/columns';
import type { Block, Plan } from '../../../../src/model/wap/types';
import {
  besoUm,
  besoVon,
  blockIn,
  ctx,
  DI,
  DI2,
  DO,
  eintrag,
  expectCommandError,
  expectKeineWirkung,
  expectProgrammfehler,
  fenster,
  MI,
  MO,
  MO2,
  NACH_PLAN,
  nummern,
  planMit,
  run,
  SA,
  STAND,
  satz,
  titelMitVerweis,
} from '../../support/commands/helpers';
import {
  beso,
  block,
  CAT,
  dayRemark,
  days,
  marker,
  multiDayRemark,
  querbalken,
  rapport,
  rt,
  setMiFr,
  setStufen,
  setWochenende,
  week,
} from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

/** Mo 0800 #10, 0900 #11, 1000 #12; Di 0800 #20 (Beispiel Katalog R-5.3-04). */
function dreiAmMontag(over: Partial<Plan> = {}): Plan {
  return planMit(
    [
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11),
      besoUm('e3', 3, MO, 600, 12),
      besoUm('e4', 4, DI, 480, 20),
    ],
    over,
  );
}

/**
 * Wo 2 im Beispiel des Katalogs: Mo «Woche mit Sph Det 1–3», Di «Woche mit FALCON/HAWK» (COBRA 10 in beiden),
 * Mi wie Di. Spalten fiktiv benannt nach Beschrieb 4.4.
 */
function planCobra(entries: Parameters<typeof planMit>[0]): Plan {
  return planMit(entries, {
    columnSets: [
      satz('sSph', 'Woche mit Sph Det 1–3', [
        { id: 'cS1', name: 'SERVIZIO' },
        { id: 'cS2', name: 'COBRA 10' },
        { id: 'cS3', name: 'Sph Det 1' },
        { id: 'cS4', name: 'Sph Det 2' },
        { id: 'cS5', name: 'Sph Det 3' },
      ]),
      satz('sFH', 'Woche mit FALCON/HAWK', [
        { id: 'cF1', name: 'SERVIZIO' },
        { id: 'cF2', name: 'COBRA 10' },
        { id: 'cF3', name: 'COBRA 20' },
        { id: 'cF4', name: 'FALCON' },
        { id: 'cF5', name: 'HAWK' },
      ]),
      setStufen(),
      setMiFr(),
      setWochenende(),
    ],
    weeks: [
      week('w26', MO, { days: days(['sSph', 'sFH', 'sFH', 'sFH', 'sFH', 's7', 's7']) }),
      week('w27', MO2),
    ],
  });
}

describe('updateEntry', () => {
  it('[R-4.7-12] (V-03-4) Kategorie eines Blocks ändern führt «zuletzt verwendet» nach; Bezeichnung', () => {
    const plan = planMit([block('e1', 1, { date: MO })], { lastUsedCategoryId: CAT.kp });
    const r = run(plan, (p) => updateEntry(p, 'e1', 'block', { categoryId: CAT.extern }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ categoryId: CAT.extern });
    expect(r.plan.lastUsedCategoryId).toBe(CAT.extern);
    expect(r.label).toBe('Block «Ausb Thema» geändert');
    expect(r.affectedEntryIds).toEqual(['e1']);
    expect(r.affectedDates).toEqual([MO]);
  });

  it('[R-4.7-12] Kategorie gleich der zweiten Kategorie → zweite Kategorie entfällt; ausdrücklich angegeben bleibt sie', () => {
    const plan = planMit([block('e1', 1, { categoryId: CAT.kp, secondCategoryId: CAT.zfhr })]);
    const r = run(plan, (p) => updateEntry(p, 'e1', 'block', { categoryId: CAT.zfhr }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ categoryId: CAT.zfhr, secondCategoryId: null });
    const r2 = run(plan, (p) =>
      updateEntry(p, 'e1', 'block', { categoryId: CAT.zfhr, secondCategoryId: CAT.s2 }, ctx),
    );
    expect(eintrag(r2.plan, 'e1')).toMatchObject({
      categoryId: CAT.zfhr,
      secondCategoryId: CAT.s2,
    });
  });

  it('[R-4.7-12] (V-03-4) Kategorie eines Beso ändern lässt «zuletzt verwendet» unverändert', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)], { lastUsedCategoryId: CAT.kp });
    const r = run(plan, (p) => updateEntry(p, 'e1', 'beso', { categoryId: CAT.s2 }, ctx));
    expect(besoVon(r.plan, 'e1').categoryId).toBe(CAT.s2);
    expect(r.plan.lastUsedCategoryId).toBe(CAT.kp);
  });

  it('[R-5.3-04] Datum eines Beso ändern nummeriert Quell- und Zieltag neu (vor dem Stand)', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => updateEntry(p, 'e1', 'beso', { date: DI }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e2: 10, e3: 11 });
    expect(nummern(r.plan, DI)).toEqual({ e1: 20, e4: 21 });
    expect(r.affectedDates).toEqual([MO, DI]);
  });

  it('[R-5.1-17] Datum eines Blocks ändern: Spalten folgen wie beim Verschieben, ausser die Änderung nennt Spalten', () => {
    const plan = planCobra([blockIn('e1', 1, MO, ['cS2'])]);
    const r = run(plan, (p) => updateEntry(p, 'e1', 'block', { date: DI }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({
      date: DI,
      columns: { kind: 'ids', ids: ['cF2'] },
    });
    const r2 = run(plan, (p) =>
      updateEntry(p, 'e1', 'block', { date: DI, columns: { kind: 'ids', ids: ['cF5'] } }, ctx),
    );
    expect(eintrag(r2.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['cF5'] } });
  });

  it('[R-5.1-17] (2a updateEntry) Datum von Beso und Rapport ändern: Zeitfenster-Spalte und Anzeigespalten folgen wie beim Verschieben', () => {
    const plan = planCobra([
      beso('e2', 2, {
        date: MO,
        besoNumber: 10,
        windows: [fenster('t2', { form: 'point', at: 600 }, { columnId: 'cS2' })],
      }),
      rapport('e3', 3, {
        date: MO,
        display: 'alsoInColumns',
        displayColumns: { kind: 'ids', ids: ['cS1'] },
      }),
    ]);
    const b = run(plan, (p) => updateEntry(p, 'e2', 'beso', { date: DI }, ctx));
    expect(besoVon(b.plan, 'e2').windows.map((w) => w.columnId)).toEqual(['cF2']);
    expect(besoVon(b.plan, 'e2').besoNumber).toBe(20);
    const r = run(plan, (p) => updateEntry(p, 'e3', 'rapport', { date: DI }, ctx));
    expect(eintrag(r.plan, 'e3')).toMatchObject({
      date: DI,
      displayColumns: { kind: 'ids', ids: ['cF1'] },
    });
  });

  it('[R-4.7-12] (2a updateEntry, 1a Schritt 4) leere Änderung oder gleiche Werte: ohne Wirkung', () => {
    const plan = planMit([block('e1', 1)]);
    expectKeineWirkung(plan, updateEntry(plan, 'e1', 'block', {}, ctx));
    expectKeineWirkung(
      plan,
      updateEntry(plan, 'e1', 'block', { title: rt('Ausb Thema', true), categoryId: CAT.kp }, ctx),
    );
  });

  it('[R-4.7-12] (2a updateEntry, §4) falscher Typ → wrongEntryType; unbekannte ID → notFound (field null)', () => {
    const plan = planMit([block('e1', 1)]);
    expectCommandError(plan, (p) => updateEntry(p, 'e1', 'beso', { ltg: 'S4' }, ctx), {
      code: 'wrongEntryType',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => updateEntry(p, 'e9', 'block', { ltg: 'S4' }, ctx), {
      code: 'notFound',
      field: null,
      entryId: 'e9',
    });
  });

  it('[R-4.7-12][R-4.4-06][R-4.4-07] (2a updateEntry, §4) ungültige Änderungen: invalidEntry, invalidPlacement, outsidePlan mit Feld und Eintrag', () => {
    const plan = planMit([block('e1', 1), rapport('e2', 2)]);
    expectCommandError(plan, (p) => updateEntry(p, 'e1', 'block', { categoryId: 'k99' }, ctx), {
      code: 'invalidEntry',
      field: 'categoryId',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => updateEntry(p, 'e1', 'block', { date: '2026-02-30' }, ctx), {
      code: 'invalidEntry',
      field: 'date',
      entryId: 'e1',
    });
    expectCommandError(
      plan,
      (p) => updateEntry(p, 'e1', 'block', { columns: { kind: 'ids', ids: ['c14'] } }, ctx),
      { code: 'invalidPlacement', field: 'columns', entryId: 'e1' },
    );
    expectCommandError(
      plan,
      (p) =>
        updateEntry(p, 'e2', 'rapport', { displayColumns: { kind: 'ids', ids: ['c15'] } }, ctx),
      { code: 'invalidPlacement', field: 'displayColumns', entryId: 'e2' },
    );
    expectCommandError(plan, (p) => updateEntry(p, 'e1', 'block', { date: NACH_PLAN }, ctx), {
      code: 'outsidePlan',
      field: 'date',
      entryId: 'e1',
    });
  });
});

describe('updateEntries', () => {
  it('[R-4.7-12] Kategorie für Block, Querbalken, Rapport, Beso; Marker und Bemerkung behalten; «zuletzt verwendet» nachgeführt', () => {
    const plan = planMit([
      block('e1', 1),
      querbalken('e2', 2),
      rapport('e3', 3),
      besoUm('e4', 4, MO, 480, 10),
      marker('e5', 5),
      dayRemark('e6', 6),
    ]);
    const r = run(plan, (p) =>
      updateEntries(p, ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'], { categoryId: CAT.extern }, ctx),
    );
    for (const id of ['e1', 'e2', 'e3', 'e4']) {
      expect(eintrag(r.plan, id)).toMatchObject({ categoryId: CAT.extern });
    }
    expect(eintrag(r.plan, 'e5')).toEqual(plan.entries.e5);
    expect(eintrag(r.plan, 'e6')).toEqual(plan.entries.e6);
    expect(r.plan.lastUsedCategoryId).toBe(CAT.extern);
    expect(r.affectedEntryIds).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('[R-4.7-12] (V09e) ohne Block in der Auswahl oder ohne Kategorie bleibt «zuletzt verwendet»', () => {
    const plan = planMit([block('e1', 1), besoUm('e2', 2, MO, 480, 10)], {
      lastUsedCategoryId: CAT.kp,
    });
    const r = run(plan, (p) => updateEntries(p, ['e2'], { categoryId: CAT.s2 }, ctx));
    expect(r.plan.lastUsedCategoryId).toBe(CAT.kp);
    const r2 = run(plan, (p) => updateEntries(p, ['e1'], { status: 'open' }, ctx));
    expect(r2.plan.lastUsedCategoryId).toBe(CAT.kp);
  });

  it('[R-5.3-09] Beso streichen (Massenänderung): Nummern bleiben, gestrichene sind gehalten', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => updateEntries(p, ['e2', 'e1'], { status: 'cancelled' }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12 });
    expect(r.label).toBe('2 Einträge geändert');
    // e3 rückt vor beide gestrichenen: er erhält 12, nicht 10 oder 11
    const r2 = run(r.plan, (p) => moveEntries(p, ['e3'], { deltaMinutes: -300 }, ctx));
    expect(nummern(r2.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12 });
  });

  it('[R-5.3-09] gestrichene Nummer wird vor dem nächsten Stand nicht neu vergeben, auch nicht nach Verschieben anderer', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11, { status: 'cancelled' }),
      besoUm('e3', 3, MO, 600, 12),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e3'], { deltaMinutes: -240 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 12, e2: 11, e3: 10 });
  });

  it('[R-4.7-12] (2a updateEntries, §4) Fehler: leere Auswahl, unbekannte ID (erste in Eingabereihenfolge), unbekannte Kategorie', () => {
    const plan = planMit([block('e1', 1), block('e2', 2)]);
    expectCommandError(plan, (p) => updateEntries(p, [], { status: 'open' }, ctx), {
      code: 'emptySelection',
    });
    expectCommandError(plan, (p) => updateEntries(p, ['e1', 'e8', 'e7'], { status: 'open' }, ctx), {
      code: 'notFound',
      entryId: 'e8',
    });
    expectCommandError(plan, (p) => updateEntries(p, ['e2', 'e1'], { categoryId: 'k99' }, ctx), {
      code: 'invalidEntry',
      field: 'categoryId',
      entryId: 'e2',
    });
  });
});

describe('moveEntries: Nummern (R-5.3-04 bis R-5.3-06)', () => {
  it('[R-5.3-04] Beso 12 auf 0700 → 10; übrige 11, 12; Bezeichnung und Betroffenes', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => moveEntries(p, ['e3'], { deltaMinutes: -180 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 12, e3: 10 });
    expect(besoVon(r.plan, 'e3').windows[0]?.time).toEqual({ form: 'point', at: 420 });
    expect(r.label).toBe('Beso «Kontrl Fsg» verschoben');
    expect(r.affectedEntryIds).toEqual(['e1', 'e2', 'e3']);
    expect(r.affectedDates).toEqual([MO]);
  });

  it('[R-5.3-04] nach Verschieben auf Di: Mo und Di lückenlos', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => moveEntries(p, ['e2'], { dayOffset: 1 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e3: 11 });
    expect(nummern(r.plan, DI)).toEqual({ e4: 20, e2: 21 });
    expect(r.affectedDates).toEqual([MO, DI]);
    expect(r.affectedEntryIds).toEqual(['e2', 'e3']);
  });

  it('[R-5.3-05] Nr 13 fixiert, Beso verschoben → 13 bleibt; die übrigen bleiben lückenlos um 13 herum', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11),
      besoUm('e3', 3, MO, 600, 12),
      besoUm('e4', 4, MO, 660, 13, { numberFixed: true }),
      besoUm('e5', 5, MO, 720, 14),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e4'], { deltaMinutes: -300 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12, e4: 13, e5: 14 });
    const r2 = run(plan, (p) => moveEntries(p, ['e4'], { dayOffset: 1 }, ctx));
    expect(nummern(r2.plan, DI)).toEqual({ e4: 13 });
    expect(nummern(r2.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12, e5: 13 });
  });

  it('[R-5.3-05] Gegenprobe ohne Fixierung: der verschobene Beso erhält 10', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, MO, 540, 11),
      besoUm('e3', 3, MO, 600, 12),
      besoUm('e4', 4, MO, 660, 13),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e4'], { deltaMinutes: -300 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e2: 12, e3: 13, e4: 10 });
  });

  it('[R-5.3-06] nach dem Stand: Verschieben ändert keine Nummer, auch nicht über Tage', () => {
    const plan = dreiAmMontag({ stand: STAND });
    const r = run(plan, (p) => moveEntries(p, ['e3'], { deltaMinutes: -180 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12 });
    expect(r.affectedEntryIds).toEqual(['e3']);
    const r2 = run(plan, (p) => moveEntries(p, ['e2'], { dayOffset: 1 }, ctx));
    expect(nummern(r2.plan, MO)).toEqual({ e1: 10, e3: 12 });
    expect(nummern(r2.plan, DI)).toEqual({ e2: 11, e4: 20 });
  });

  it('[R-5.3-06] KVK-Fixture mit Stand: alle Beso des Montags um 2 h später → jede Nummer bleibt', () => {
    const plan = loadKvkPlan();
    const montag = Object.keys(nummern(plan, MO));
    const r = run(plan, (p) => moveEntries(p, montag, { deltaMinutes: 120 }, ctx));
    expect(nummern(r.plan, MO)).toEqual(nummern(plan, MO));
    expect(r.label).toBe(`${montag.length} Einträge verschoben`);
  });
});

describe('moveEntries: Spalten beim Tageswechsel (R-5.1-17 bis R-5.1-19, V02)', () => {
  it('[R-5.1-17] COBRA 10 am Mo → Di mit anderem Satz, der COBRA 10 enthält → COBRA 10', () => {
    const plan = planCobra([blockIn('e1', 1, MO, ['cS2'])]);
    const r = run(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 1 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({
      date: DI,
      columns: { kind: 'ids', ids: ['cF2'] },
    });
  });

  it('[R-5.1-18] Zieltag ohne gleichnamige Spalte: die Spalten-ID bleibt und fehlt in den Tagesspalten (Grundlage P1)', () => {
    const plan = planCobra([blockIn('e1', 1, MO, ['cS4'])]);
    const r = run(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 2 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({
      date: MI,
      columns: { kind: 'ids', ids: ['cS4'] },
    });
    expect(dayColumns(r.plan, 'w26', 'Mi').map((c) => c.id)).not.toContain('cS4');
  });

  it('[R-5.1-19] Block «alle» nach Tag mit 3 statt 6 Planungsspalten → «alle», gezeichnet über alle 3', () => {
    const plan = planMit([block('e1', 1, { date: MO, columns: { kind: 'all' } })]);
    const r = run(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 2 }, ctx));
    const b = eintrag(r.plan, 'e1') as Block;
    expect(b.columns).toEqual({ kind: 'all' });
    expect(resolveColumns(b.columns, dayColumns(r.plan, 'w26', 'Mi')).map((c) => c.id)).toEqual([
      'c17',
      'c18',
      'c19',
    ]);
  });

  it('[R-5.1-17] Marker-Spalten, Rapport-Anzeigespalten und Beso-Zeitfenster werden mitgenommen', () => {
    const plan = planCobra([
      marker('e1', 1, { date: MO, columns: { kind: 'ids', ids: ['cS2'] } }),
      rapport('e2', 2, {
        date: MO,
        display: 'alsoInColumns',
        displayColumns: { kind: 'ids', ids: ['cS1'] },
      }),
      beso('e3', 3, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t3a', { form: 'point', at: 600 }, { columnId: 'cS2' }),
          fenster('t3b', { form: 'point', at: 700 }),
        ],
      }),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e1', 'e2', 'e3'], { dayOffset: 1 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['cF2'] } });
    expect(eintrag(r.plan, 'e2')).toMatchObject({ displayColumns: { kind: 'ids', ids: ['cF1'] } });
    expect(besoVon(r.plan, 'e3').windows.map((w) => w.columnId)).toEqual(['cF2', null]);
    expect(besoVon(r.plan, 'e3').besoNumber).toBe(20);
    expect(r.label).toBe('3 Einträge verschoben');
  });

  it('[R-5.1-17] (V02) Reihenfolge: zuerst Tag und Mitnehmen, dann columnShift in den Spalten des Zieltags', () => {
    // Mo «KVK Stufen»: Zfhr = c10. Di: Uof, Zfhr, Stv. Zfhr → cB1, dann +1 → cB2 (nicht: c10+1 = Uof → cB0).
    const plan = planMit([blockIn('e1', 1, MO, ['c10'])], {
      columnSets: [
        setStufen(),
        satz('sB', 'Di', [
          { id: 'cB0', name: 'Uof' },
          { id: 'cB1', name: 'Zfhr' },
          { id: 'cB2', name: 'Stv' },
        ]),
      ],
      weeks: [week('w26', MO, { days: days(['s7', 'sB', 's7', 's7', 's7', 's7', 's7']) })],
    });
    const r = run(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 1, columnShift: 1 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['cB2'] } });
  });
});

describe('moveEntries: columnShift (P-6)', () => {
  // Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten; eine gespeicherte Spaltenliste
  // (alter Plan) rückt nicht mit und bleibt unverändert.
  it('[R-5.1-17] Block und Beso-Zeitfenster rücken um n Stellen; «alle», null und fehlende IDs bleiben; Rapport und Marker bleiben', () => {
    const plan = planMit([
      blockIn('e1', 1, MO, ['c9', 'c18']),
      marker('e2', 2, { date: MO, columns: { kind: 'ids', ids: ['c8'] } }),
      beso('e3', 3, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t3a', { form: 'point', at: 600 }, { columnId: 'c9' }),
          fenster('t3b', { form: 'point', at: 700 }),
        ],
      }),
      rapport('e4', 4, {
        date: MO,
        display: 'alsoInColumns',
        displayColumns: { kind: 'ids', ids: ['c8'] },
      }),
      block('e5', 5, { date: MO, columns: { kind: 'all' } }),
    ]);
    const r = run(plan, (p) =>
      moveEntries(p, ['e1', 'e2', 'e3', 'e4', 'e5'], { columnShift: 2 }, ctx),
    );
    expect(eintrag(r.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['c11', 'c18'] } });
    expect(eintrag(r.plan, 'e2')).toEqual(plan.entries.e2);
    expect(besoVon(r.plan, 'e3').windows.map((w) => w.columnId)).toEqual(['c11', null]);
    expect(eintrag(r.plan, 'e4')).toEqual(plan.entries.e4);
    expect(eintrag(r.plan, 'e5')).toEqual(plan.entries.e5);
  });

  it('[R-5.1-17] columnShift über den Rand der Planungs- und Nebenspalten → invalidPlacement', () => {
    const plan = planMit([
      blockIn('e1', 1, MO, ['c12', 'c13']),
      blockIn('e2', 2, MO, ['c8']),
      beso('e3', 3, {
        date: MO,
        windows: [fenster('t3', { form: 'point', at: 600 }, { columnId: 'c13' })],
      }),
    ]);
    expectCommandError(plan, (p) => moveEntries(p, ['e1'], { columnShift: 1 }, ctx), {
      code: 'invalidPlacement',
      field: 'columns',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e2'], { columnShift: -1 }, ctx), {
      code: 'invalidPlacement',
      field: 'columns',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e3'], { columnShift: 1 }, ctx), {
      code: 'invalidPlacement',
      field: 'windows[0].columnId',
      entryId: 'e3',
    });
  });

  it('[R-5.1-17] Nebenspalte zählt mit, Rap-Spalte nicht', () => {
    const plan = planMit([blockIn('e1', 1, MO, ['c41']), blockIn('e2', 2, MO, ['c42'])], {
      weeks: [week('w26', MO, { days: days(['s39', 's7', 's16', 's16', 's16', 's22', 's22']) })],
    });
    const r = run(plan, (p) => moveEntries(p, ['e1'], { columnShift: 1 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ columns: { kind: 'ids', ids: ['c42'] } });
    expectCommandError(plan, (p) => moveEntries(p, ['e2'], { columnShift: 1 }, ctx), {
      code: 'invalidPlacement',
      field: 'columns',
      entryId: 'e2',
    });
  });
});

describe('moveEntries: Zeit, Datum, Fehler', () => {
  it('[R-5.3-04] Zeitverschiebung: jede Zeitangabe, Frist nur mit Zeit; Querbalken und Bemerkungen ohne Zeit', () => {
    const plan = planMit([
      beso('e1', 1, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t1a', { form: 'range', from: 480, to: 600 }),
          fenster('t1b', { form: 'deadline' }),
          fenster('t1c', { form: 'deadline', to: 720 }),
          fenster('t1d', { form: 'until', to: 900 }),
        ],
      }),
      block('e2', 2, { date: MO, time: { form: 'from', from: 1200 } }),
      marker('e3', 3, { date: MO, at: 420 }),
      rapport('e4', 4, { date: MO, time: { form: 'point', at: 1080 } }),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e1', 'e2', 'e3', 'e4'], { deltaMinutes: 30 }, ctx));
    expect(besoVon(r.plan, 'e1').windows.map((w) => w.time)).toEqual([
      { form: 'range', from: 510, to: 630 },
      { form: 'deadline' },
      { form: 'deadline', to: 750 },
      { form: 'until', to: 930 },
    ]);
    expect(eintrag(r.plan, 'e2')).toMatchObject({ time: { form: 'from', from: 1230 } });
    expect(eintrag(r.plan, 'e3')).toMatchObject({ at: 450 });
    expect(eintrag(r.plan, 'e4')).toMatchObject({ time: { form: 'point', at: 1110 } });
  });

  it('[R-5.3-04] ungültige Zeit nach dem Verschieben → invalidTime mit Zeitfeld und Eintrag', () => {
    const plan = planMit([
      beso('e1', 1, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t1a', { form: 'point', at: 600 }),
          fenster('t1b', { form: 'point', at: 1400 }),
        ],
      }),
      block('e2', 2, { date: MO, time: { form: 'range', from: 1380, to: 1500 } }),
      marker('e3', 3, { date: MO, at: 1430 }),
    ]);
    expectCommandError(plan, (p) => moveEntries(p, ['e1'], { deltaMinutes: 60 }, ctx), {
      code: 'invalidTime',
      field: 'windows[1].time',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e2'], { deltaMinutes: 120 }, ctx), {
      code: 'invalidTime',
      field: 'time',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e3'], { deltaMinutes: 30 }, ctx), {
      code: 'invalidTime',
      field: 'at',
      entryId: 'e3',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e3', 'e2'], { deltaMinutes: 120 }, ctx), {
      code: 'invalidTime',
      entryId: 'e3',
    });
  });

  it('[R-5.1-17] (§4) Prüfreihenfolge je Eintrag in Eingabereihenfolge: erst alle Prüfungen von e1, dann e2; je Eintrag Zeit vor Plan-Bereich', () => {
    const plan = planMit([
      block('e1', 1, { date: '2026-10-18' }),
      marker('e2', 2, { at: 1430 }),
      block('e3', 3, { date: '2026-10-18', time: { form: 'range', from: 1380, to: 1500 } }),
    ]);
    // e1: Zeit gültig, Ziel 19.10.2026 ausserhalb → outsidePlan; e2 (Zeit ungültig) kommt erst danach
    expectCommandError(
      plan,
      (p) => moveEntries(p, ['e1', 'e2'], { dayOffset: 1, deltaMinutes: 60 }, ctx),
      {
        code: 'outsidePlan',
        field: 'date',
        entryId: 'e1',
      },
    );
    // e3: Zeit- und Bereichsfehler zugleich → Zeit zuerst
    expectCommandError(
      plan,
      (p) => moveEntries(p, ['e3'], { dayOffset: 1, deltaMinutes: 120 }, ctx),
      {
        code: 'invalidTime',
        field: 'time',
        entryId: 'e3',
      },
    );
  });

  it('[R-5.1-17] Querbalken: beide Daten; Bemerkung nur mit Zeitraum; Bemerkung «ganzer Plan» ohne Wirkung', () => {
    const plan = planMit([
      querbalken('e1', 1, { fromDate: MO2, toDate: '2026-10-08' }),
      multiDayRemark('e2', 2, { scope: { kind: 'range', fromDate: MO, toDate: DI } }),
      multiDayRemark('e3', 3, { scope: { kind: 'plan' } }),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e1', 'e2'], { dayOffset: 2 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ fromDate: '2026-10-07', toDate: '2026-10-10' });
    expect(eintrag(r.plan, 'e2')).toMatchObject({
      scope: { kind: 'range', fromDate: MI, toDate: DO },
    });
    expect(r.affectedDates).toEqual([
      MO,
      DI,
      MI,
      DO,
      MO2,
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expectKeineWirkung(plan, moveEntries(plan, ['e3'], { dayOffset: 1 }, ctx));
  });

  it('[R-5.1-17] (1b) Block über Mitternacht verschoben: vorher Mo, Di; nachher Di, Mi', () => {
    const plan = planMit([
      block('e1', 1, { date: MO, time: { form: 'range', from: 1320, to: 1560 } }),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 1 }, ctx));
    expect(r.affectedDates).toEqual([MO, DI, MI]);
  });

  it('[R-5.1-17] (P-4) Ziel ausserhalb der Wochen → outsidePlan; Spalten bleiben dabei unberührt', () => {
    const plan = planMit([
      block('e1', 1, { date: '2026-10-18' }),
      querbalken('e2', 2, { fromDate: '2026-10-17', toDate: '2026-10-18' }),
    ]);
    expectCommandError(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 1 }, ctx), {
      code: 'outsidePlan',
      field: 'date',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e2'], { dayOffset: 7 }, ctx), {
      code: 'outsidePlan',
      field: 'fromDate',
      entryId: 'e2',
    });
  });

  it('[R-5.1-17] MoveSpec: fehlend = 0 → ohne Wirkung; keine ganze Zahl oder deltaMinutes nicht Vielfaches von 5 → RangeError', () => {
    const plan = planMit([block('e1', 1)]);
    expectKeineWirkung(plan, moveEntries(plan, ['e1'], {}, ctx));
    expectKeineWirkung(
      plan,
      moveEntries(plan, ['e1'], { deltaMinutes: 0, dayOffset: 0, columnShift: 0 }, ctx),
    );
    expectProgrammfehler(plan, (p) => moveEntries(p, ['e1'], { deltaMinutes: 7 }, ctx), RangeError);
    expectProgrammfehler(plan, (p) => moveEntries(p, ['e1'], { dayOffset: 1.5 }, ctx), RangeError);
    expectProgrammfehler(
      plan,
      (p) => moveEntries(p, ['e1'], { columnShift: Number.NaN }, ctx),
      RangeError,
    );
  });

  it('[R-5.1-17] leere Auswahl → emptySelection; unbekannte ID → notFound; doppelte IDs zählen einmal', () => {
    const plan = planMit([block('e1', 1)]);
    expectCommandError(plan, (p) => moveEntries(p, [], { deltaMinutes: 30 }, ctx), {
      code: 'emptySelection',
    });
    expectCommandError(plan, (p) => moveEntries(p, ['e1', 'e9'], { deltaMinutes: 30 }, ctx), {
      code: 'notFound',
      entryId: 'e9',
    });
    const r = run(plan, (p) => moveEntries(p, ['e1', 'e1'], { deltaMinutes: 30 }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ time: { form: 'range', from: 510, to: 750 } });
    expect(r.label).toBe('Block «Ausb Thema» verschoben');
  });
});

describe('Beschriftung «‹n› Einträge» (1c, Orchestrator d)', () => {
  it('[R-4.7-12] n zählt die verschiedenen ausgewählten Einträge, auch unveränderte; n = 1 → Einzelbeschriftung', () => {
    const plan = planMit([block('e1', 1, { date: MO }), marker('e2', 2, { date: MO })]);
    const r = run(plan, (p) =>
      updateEntries(p, ['e1', 'e2', 'e1'], { categoryId: CAT.extern }, ctx),
    );
    expect(eintrag(r.plan, 'e2')).toEqual(plan.entries.e2);
    expect(r.affectedEntryIds).toEqual(['e1']);
    expect(r.label).toBe('2 Einträge geändert');
    const einzeln = run(plan, (p) =>
      updateEntries(p, ['e1', 'e1'], { categoryId: CAT.extern }, ctx),
    );
    expect(einzeln.label).toBe('Block «Ausb Thema» geändert');
  });

  it('[R-5.1-17] Verschieben mit unverändertem Querbalken in der Auswahl: «2 Einträge verschoben»', () => {
    const plan = planMit([block('e1', 1, { date: MO }), querbalken('e2', 2)]);
    const r = run(plan, (p) => moveEntries(p, ['e1', 'e2'], { deltaMinutes: 30 }, ctx));
    expect(eintrag(r.plan, 'e2')).toEqual(plan.entries.e2);
    expect(r.label).toBe('2 Einträge verschoben');
  });
});

describe('Rapport ohne Termintext (R-5.3-14)', () => {
  it('[R-5.3-14] Rapport verschieben oder kopieren: keine Nummer, keine Terminzeile; Beso der Tage unverändert', () => {
    const plan = planMit([
      besoUm('e1', 1, MO, 480, 10),
      besoUm('e2', 2, DI, 480, 20),
      rapport('e3', 3, { date: MO }),
    ]);
    const r = run(plan, (p) => moveEntries(p, ['e3'], { dayOffset: 1 }, ctx));
    expect(eintrag(r.plan, 'e3')).toMatchObject({ type: 'rapport', date: DI });
    expect(r.affectedEntryIds).toEqual(['e3']);
    expect(agendaLinesForDate(r.plan, DI).map((l) => l.entryId)).toEqual(['e2']);
    expect(agendaLinesForDate(r.plan, MO).map((l) => l.entryId)).toEqual(['e1']);
    const k = run(plan, (p) => copyEntries(p, ['e3'], { dayOffset: 1 }, ctx));
    expect('besoNumber' in eintrag(k.plan, 'e100')).toBe(false);
    expect(nummern(k.plan, DI)).toEqual({ e2: 20 });
    expect(agendaLinesForDate(k.plan, DI).map((l) => l.entryId)).toEqual(['e2']);
  });
});

describe('deleteEntries', () => {
  it('[R-5.3-03] vor dem Stand: Löschen nummeriert den Tag laufend neu; Bezeichnung mit Text vor dem Befehl', () => {
    const plan = dreiAmMontag();
    const r = run(plan, (p) => deleteEntries(p, ['e1'], ctx));
    expect(r.plan.entries.e1).toBeUndefined();
    expect(nummern(r.plan, MO)).toEqual({ e2: 10, e3: 11 });
    expect(r.label).toBe('Beso «Kontrl Fsg» gelöscht');
    expect(r.affectedEntryIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('[R-5.3-06] nach dem Stand: Löschen ändert keine andere Nummer', () => {
    const plan = dreiAmMontag({ stand: STAND });
    const r = run(plan, (p) => deleteEntries(p, ['e1'], ctx));
    expect(nummern(r.plan, MO)).toEqual({ e2: 11, e3: 12 });
    expect(r.affectedEntryIds).toEqual(['e1']);
  });

  it('[R-5.3-07] (V-03-9) nach dem Stand gibt ein gelöschter Beso seine Nummer frei; ein neuer Beso kann sie erhalten', () => {
    const plan = planMit(
      Array.from({ length: 10 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, 10 + i)),
      { stand: STAND },
    );
    const r = run(plan, (p) => deleteEntries(p, ['e6'], ctx));
    const amSelbenTag = run(r.plan, (p) => copyEntries(p, ['e7'], { deltaMinutes: 5 }, ctx));
    expect(besoVon(amSelbenTag.plan, amSelbenTag.newIds[0] as string).besoNumber).toBe(15);
  });

  it('[R-5.3-07] (V-03-9) auch ein gestrichener Beso gibt beim Löschen nach dem Stand seine Nummer frei', () => {
    const plan = planMit(
      Array.from({ length: 10 }, (_, i) =>
        besoUm(
          `e${i + 1}`,
          i + 1,
          MO,
          360 + 60 * i,
          10 + i,
          i === 2 ? { status: 'cancelled' } : {},
        ),
      ),
      { stand: STAND },
    );
    const r = run(plan, (p) => deleteEntries(p, ['e3'], ctx));
    const kopie = run(r.plan, (p) => copyEntries(p, ['e1'], { deltaMinutes: 5 }, ctx));
    expect(besoVon(kopie.plan, kopie.newIds[0] as string).besoNumber).toBe(12);
  });

  it('[R-5.3-07] (V-03-8, V-03-9) nach dem Stand erhält ein Beso ohne Nummer die frei werdende Nummer im selben Befehl', () => {
    const plan = planMit(
      [
        ...Array.from({ length: 10 }, (_, i) =>
          besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, 10 + i),
        ),
        besoUm('e11', 11, MO, 1000, null),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) => deleteEntries(p, ['e5'], ctx));
    expect(nummern(r.plan, MO)).toEqual({
      ...Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`e${i + 1}`, 10 + i]).filter(([id]) => id !== 'e5'),
      ),
      e11: 14,
    });
    expect(r.affectedEntryIds).toEqual(['e11', 'e5']);
  });

  it('[R-5.3-12] (V-03-5) Verweis auf einen gelöschten Beso bleibt und zeigt «(–)»', () => {
    const plan = planMit([
      besoUm('e1', 1, DI, 480, 20),
      besoUm('e2', 2, DI, 540, 21),
      block('e3', 3, {
        date: MI,
        columns: { kind: 'ids', ids: ['c17'] },
        title: titelMitVerweis('Waffenplatzbegehung ', 'e2'),
      }),
    ]);
    const r = run(plan, (p) => deleteEntries(p, ['e2'], ctx));
    expect(eintrag(r.plan, 'e3')).toEqual(plan.entries.e3);
    expect(
      resolveTitle(r.plan, (eintrag(r.plan, 'e3') as Block).title)
        .map((x) => x.text)
        .join(''),
    ).toBe('Waffenplatzbegehung (–)');
  });

  it('[R-5.3-03] (1b, 1c) mehrere Einträge: Bezeichnung, Betroffenes über Querbalken und Bemerkungen', () => {
    const plan = planMit([
      querbalken('e1', 1, { fromDate: SA, toDate: MO2 }),
      multiDayRemark('e2', 2, { scope: { kind: 'week', weekId: 'w26' } }),
      dayRemark('e3', 3, { date: DI }),
    ]);
    const r = run(plan, (p) => deleteEntries(p, ['e3', 'e1', 'e2', 'e3'], ctx));
    expect(r.label).toBe('3 Einträge gelöscht');
    expect(r.affectedEntryIds).toEqual(['e1', 'e2', 'e3']);
    expect(r.affectedDates).toEqual([MO, DI, MI, DO, '2026-10-02', SA, '2026-10-04', MO2]);
  });

  it('[R-5.3-03] Bemerkung «ganzer Plan» betrifft alle Daten aller Wochen', () => {
    const plan = planMit([multiDayRemark('e1', 1, { scope: { kind: 'plan' } })]);
    const r = run(plan, (p) => deleteEntries(p, ['e1'], ctx));
    expect(r.affectedDates).toHaveLength(21);
    expect(r.affectedDates[0]).toBe(MO);
    expect(r.affectedDates[20]).toBe('2026-10-18');
    expect(r.label).toBe('Bemerkung «Sport: 4h pro Woche.» gelöscht');
  });

  it('[R-5.3-03] Fehler: leere Auswahl, unbekannte ID', () => {
    const plan = dreiAmMontag();
    expectCommandError(plan, (p) => deleteEntries(p, [], ctx), { code: 'emptySelection' });
    expectCommandError(plan, (p) => deleteEntries(p, ['e1', 'e9', 'e8'], ctx), {
      code: 'notFound',
      field: null,
      entryId: 'e9',
    });
  });
});

describe('copyEntries und copyEntryToDates (F-22)', () => {
  it('[R-5.3-03] Kopie eines fixierten Beso: unabhängig, neue IDs, ohne Fixierung, im Zieltag nummeriert', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10, { numberFixed: true, ltg: 'S4' })]);
    const r = run(plan, (p) => copyEntries(p, ['e1'], { dayOffset: 1 }, ctx));
    expect(r.newIds).toEqual(['e100']);
    const kopie = besoVon(r.plan, 'e100');
    expect(kopie).toEqual({
      ...plan.entries.e1,
      id: 'e100',
      createdSeq: 50,
      date: DI,
      windows: [{ ...besoVon(plan, 'e1').windows[0], id: 't101' }],
      besoNumber: 20,
      numberFixed: false,
    });
    expect(eintrag(r.plan, 'e1')).toEqual(plan.entries.e1);
    expect(r.label).toBe('Beso «Kontrl Fsg» kopiert');
  });

  it('[R-5.3-04] Kopie an einen Tag vor dem Stand nummeriert den Zieltag neu', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10), besoUm('e2', 2, DI, 420, 20)]);
    const r = run(plan, (p) => copyEntries(p, ['e2'], { dayOffset: -1 }, ctx));
    expect(nummern(r.plan, MO)).toEqual({ e100: 10, e1: 11 });
  });

  it('[R-5.3-03] mehrere: newIds in Eingabereihenfolge; je Eintrag zuerst e, dann t; createdSeq in derselben Reihenfolge', () => {
    const plan = planMit([
      block('e1', 1, { date: MO }),
      beso('e2', 2, {
        date: MO,
        besoNumber: 10,
        windows: [
          fenster('t2a', { form: 'point', at: 600 }),
          fenster('t2b', { form: 'point', at: 700 }),
        ],
      }),
    ]);
    const r = run(plan, (p) => copyEntries(p, ['e2', 'e1'], { dayOffset: 7 }, ctx));
    expect(r.newIds).toEqual(['e100', 'e103']);
    expect(besoVon(r.plan, 'e100').windows.map((w) => w.id)).toEqual(['t101', 't102']);
    expect(besoVon(r.plan, 'e100').createdSeq).toBe(50);
    expect(eintrag(r.plan, 'e103')).toMatchObject({ createdSeq: 51, date: MO2 });
    expect(r.plan.nextId).toBe(104);
    expect(r.label).toBe('2 Einträge kopiert');
  });

  it('[R-4.7-12] (V-03-4) Kopien ändern «zuletzt verwendet» nicht', () => {
    const plan = planMit([block('e1', 1, { categoryId: CAT.zfhr })], {
      lastUsedCategoryId: CAT.kp,
    });
    const r = run(plan, (p) => copyEntries(p, ['e1'], { dayOffset: 1 }, ctx));
    expect(r.plan.lastUsedCategoryId).toBe(CAT.kp);
  });

  it('[R-5.1-19] «auch an anderen Tagen»: Daten ohne Doppel und ohne eigenes Datum, aufsteigend; «alle» bleibt', () => {
    const plan = planMit([block('e1', 1, { date: MO, columns: { kind: 'all' } })]);
    const r = run(plan, (p) => copyEntryToDates(p, 'e1', [DO, DI, MO, DI], ctx));
    expect(r.newIds).toEqual(['e100', 'e101']);
    expect(eintrag(r.plan, 'e100')).toMatchObject({
      date: DI,
      columns: { kind: 'all' },
      time: { form: 'range', from: 480, to: 720 },
    });
    expect(eintrag(r.plan, 'e101')).toMatchObject({ date: DO, columns: { kind: 'all' } });
    expect(r.label).toBe('Block «Ausb Thema» an 2 Tage kopiert');
    expect(r.affectedDates).toEqual([DI, DO]);
  });

  it('[R-5.1-17] «auch an anderen Tagen»: Spalten wie beim Verschieben (gleicher Name, sonst ID bleibt)', () => {
    const plan = planCobra([blockIn('e1', 1, MO, ['cS2', 'cS4'])]);
    const r = run(plan, (p) => copyEntryToDates(p, 'e1', [MI], ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({
      columns: { kind: 'ids', ids: ['cF2', 'cS4'] },
    });
  });

  it('[R-5.1-17] «auch an anderen Tagen»: Fehler wrongEntryType, emptySelection, invalidDate, outsidePlan', () => {
    const plan = planMit([block('e1', 1, { date: MO }), querbalken('e2', 2)]);
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e2', [DI], ctx), {
      code: 'wrongEntryType',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e1', [MO, MO], ctx), {
      code: 'emptySelection',
    });
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e1', [], ctx), { code: 'emptySelection' });
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e1', [DI, '2026-02-30'], ctx), {
      code: 'invalidDate',
      field: 'dates',
    });
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e1', [NACH_PLAN], ctx), {
      code: 'outsidePlan',
      field: 'date',
    });
    expectCommandError(plan, (p) => copyEntryToDates(p, 'e9', [DI], ctx), {
      code: 'notFound',
      entryId: 'e9',
    });
  });

  it('[R-5.3-12] (V09g) Kopien übernehmen die Titelläufe unverändert, Verweis auch in eine andere Woche', () => {
    const plan = planMit([
      besoUm('e1', 1, DI, 480, 21),
      block('e2', 2, {
        date: MI,
        columns: { kind: 'ids', ids: ['c17'] },
        title: titelMitVerweis('Waffenplatzbegehung ', 'e1'),
      }),
    ]);
    const r = run(plan, (p) => copyEntries(p, ['e2'], { dayOffset: 7 }, ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({
      title: titelMitVerweis('Waffenplatzbegehung ', 'e1'),
    });
  });

  it('[R-5.3-12] (V09g) Kopie verlinkt Klartext nicht neu: «Nachbereitung (22)» bleibt Klartext, auch wenn die Zielwoche genau einen Beso 22 hat', () => {
    const plan = planMit([
      besoUm('e6', 6, DI2, 480, 22),
      block('e2', 2, {
        date: MI,
        columns: { kind: 'ids', ids: ['c17'] },
        title: rt('Nachbereitung (22)'),
      }),
    ]);
    const r = run(plan, (p) => copyEntries(p, ['e2'], { dayOffset: 7 }, ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({
      date: '2026-10-07',
      title: rt('Nachbereitung (22)'),
    });
  });

  it('[R-5.3-03] Fehler copyEntries: leere Auswahl, unbekannte ID, Ziel ausserhalb', () => {
    const plan = planMit([block('e1', 1, { date: '2026-10-18' })]);
    expectCommandError(plan, (p) => copyEntries(p, [], { dayOffset: 1 }, ctx), {
      code: 'emptySelection',
    });
    expectCommandError(plan, (p) => copyEntries(p, ['e9'], { dayOffset: 1 }, ctx), {
      code: 'notFound',
      entryId: 'e9',
    });
    expectCommandError(plan, (p) => copyEntries(p, ['e1'], { dayOffset: 1 }, ctx), {
      code: 'outsidePlan',
      field: 'date',
    });
  });
});

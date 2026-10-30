// @vitest-environment jsdom
// Erfassen (Vertrag E1-03 Abschnitt 2, 2a createEntry, 1b, 1c; Abschnitt 3; Beschrieb 4.6, 4.7, 5.3; F-08, F-09,
// F-13, F-14, F-27, F-52; Vorschläge V-03-1 bis V-03-4, V-03-10).
import { describe, expect, it } from 'vitest';
import {
  type BlockDraft,
  createEntry,
  suggestCategory,
} from '../../../../src/model/wap/commands/entries';
import { agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import type { LtgCategory, Plan } from '../../../../src/model/wap/types';
import {
  besoUm,
  besoVon,
  ctx,
  DI,
  DO,
  eintrag,
  expectCommandError,
  MI,
  MO,
  MO2,
  nummern,
  planMit,
  run,
  SA,
  SO,
  STAND,
  stufenMitStandard,
} from '../../support/commands/helpers';
import {
  CAT,
  days,
  kpLegend,
  rt,
  setMiFr,
  setMitNebenspalte,
  setWochenende,
  week,
} from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

const ACHT_BIS_ZEHN = { form: 'range', from: 480, to: 600 } as const;

/** Plan mit Standard-Kategorien je Spalte im Satz «KVK Stufen» (Mo, Di). */
function planMitStandard(standard: Record<string, string | null>, over: Partial<Plan> = {}): Plan {
  return planMit([], {
    columnSets: [stufenMitStandard(standard), setMiFr(), setWochenende(), setMitNebenspalte()],
    ...over,
  });
}

function blockDraft(ids: readonly string[] | 'all', over: Partial<BlockDraft> = {}): BlockDraft {
  return {
    type: 'block' as const,
    date: MO,
    time: ACHT_BIS_ZEHN,
    columns: ids === 'all' ? ({ kind: 'all' } as const) : ({ kind: 'ids', ids: [...ids] } as const),
    title: rt('Ausb Thema'),
    ...over,
  };
}

describe('createEntry Block: Standardwerte und Standard-Kategorie', () => {
  it('[R-4.7-11] Block in Spalte mit Standard Ltg Zfhr → Ltg Zfhr; Standardwerte, IDs, Zähler, Bezeichnung', () => {
    const plan = planMitStandard(
      { c10: CAT.zfhr },
      { nextSeq: 5, printDefaults: { printTn: true, printTenue: false } },
    );
    const r = run(plan, (p) => createEntry(p, blockDraft(['c10']), ctx));
    expect(r.entryId).toBe('e100');
    expect(eintrag(r.plan, 'e100')).toEqual({
      id: 'e100',
      type: 'block',
      createdSeq: 5,
      status: 'confirmed',
      changed: false,
      internalNote: '',
      removedText: [],
      date: MO,
      time: ACHT_BIS_ZEHN,
      columns: { kind: 'ids', ids: ['c10'] },
      title: rt('Ausb Thema'),
      supplement: '',
      ltg: '',
      tn: '',
      tpt: '',
      ort: '',
      tenue: '',
      printTn: true,
      printTenue: false,
      categoryId: CAT.zfhr,
      secondCategoryId: null,
      textDirection: 'auto',
      openEnd: false,
    });
    expect(r.plan.nextId).toBe(101);
    expect(r.plan.nextSeq).toBe(6);
    expect(r.label).toBe('Block «Ausb Thema» erstellt');
    expect(r.affectedDates).toEqual([MO]);
    expect(r.affectedEntryIds).toEqual(['e100']);
  });

  it('[R-4.7-11] (F-08) mehrere Spalten mit verschiedenen Standards: die linke in Anzeigereihenfolge gilt', () => {
    const plan = planMitStandard({ c10: CAT.zfhr, c11: CAT.s2 });
    const r = run(plan, (p) => createEntry(p, blockDraft(['c11', 'c10']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.zfhr });
  });

  it('[R-4.7-11] (F-08) erste Spalte ohne Standard: die nächste mit Standard gilt', () => {
    const plan = planMitStandard({ c10: CAT.zfhr });
    const r = run(plan, (p) => createEntry(p, blockDraft(['c9', 'c10']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.zfhr });
  });

  it('[R-4.7-11] Block über alle Spalten: erste Planungsspalte mit Standard', () => {
    const plan = planMitStandard({ c12: CAT.s2, c13: CAT.extern });
    const r = run(plan, (p) => createEntry(p, blockDraft('all'), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.s2 });
  });

  it('[R-4.7-11] Standard, der nicht in der Legende steht, zählt nicht', () => {
    const plan = planMitStandard({ c8: 'k99', c9: CAT.zfhr });
    const r = run(plan, (p) => createEntry(p, blockDraft(['c8', 'c9']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.zfhr });
  });

  it('[R-4.7-11] (V-03-10) Ltg-Text ändert die Standard-Kategorie nicht (Vorschlag nur auf Aktion)', () => {
    const plan = planMitStandard(
      { c10: CAT.zfhr },
      { functionList: [{ code: 'S2', categoryId: CAT.s2, singleFunction: false }] },
    );
    const r = run(plan, (p) => createEntry(p, blockDraft(['c10'], { ltg: 'S2' }), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.zfhr, ltg: 'S2' });
  });

  it('[R-4.7-11] ausdrücklich gewählte Kategorie hat Vorrang vor dem Standard der Spalte', () => {
    const plan = planMitStandard({ c10: CAT.zfhr });
    const r = run(plan, (p) =>
      createEntry(p, blockDraft(['c10'], { categoryId: CAT.extern }), ctx),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.extern });
  });

  it('[R-4.7-12] Spalte ohne Standard, zuletzt Ltg S2 verwendet → Ltg S2', () => {
    const plan = planMitStandard({}, { lastUsedCategoryId: CAT.s2 });
    const r = run(plan, (p) => createEntry(p, blockDraft(['c9']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.s2 });
    expect(r.plan.lastUsedCategoryId).toBe(CAT.s2);
  });

  it('[R-4.7-12] Standard einer Nebenspalte zählt bei «alle Spalten» nicht (nur Planungsspalten)', () => {
    const nebenMitStandard = setMitNebenspalte();
    const plan = planMit([], {
      lastUsedCategoryId: CAT.s2,
      columnSets: [
        stufenMitStandard({}),
        setMiFr(),
        setWochenende(),
        {
          ...nebenMitStandard,
          columns: nebenMitStandard.columns.map((c) =>
            c.id === 'c42' ? { ...c, defaultCategoryId: CAT.extern } : c,
          ),
        },
      ],
      weeks: [week('w26', MO, { days: days(['s39', 's7', 's16', 's16', 's16', 's22', 's22']) })],
    });
    const r = run(plan, (p) => createEntry(p, blockDraft('all'), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.s2 });
  });

  it('[R-4.7-12] (V-03-1) ohne Standard und ohne zuletzt verwendete: erste nicht neutrale Kategorie der Legende', () => {
    const legende: LtgCategory[] = kpLegend();
    const neutral = legende.find((c) => c.neutral) as LtgCategory;
    const plan = planMitStandard(
      {},
      { legend: [neutral, ...legende.filter((c) => c.id !== CAT.bat && !c.neutral)] },
    );
    const r = run(plan, (p) => createEntry(p, blockDraft(['c9']), ctx));
    // Legende: neutral, Ltg Kp, Ltg Zfhr, … → erste nicht neutrale ist Ltg Kp
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.kp });
  });

  it('[R-4.7-12] (V-03-1, für Blöcke revidiert: Entscheid Auftraggeber 19.10.2026 «15: ja», F-LAYOUT2) zuletzt verwendete Kategorie nicht mehr in der Legende → Rückfall «Ltg Kp»', () => {
    const plan = planMitStandard({}, { lastUsedCategoryId: 'k99' });
    const r = run(plan, (p) => createEntry(p, blockDraft(['c9']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.kp });
  });

  it('[R-4.7-12] (V-03-1) Legende nur mit neutralen Kategorien → die erste', () => {
    const neutral = kpLegend().find((c) => c.neutral) as LtgCategory;
    const plan = planMitStandard(
      {},
      { legend: [neutral, { ...neutral, id: 'k7', name: 'Ausgang', legendLabel: 'Ausgang' }] },
    );
    const r = run(plan, (p) => createEntry(p, blockDraft(['c9']), ctx));
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.neutral });
  });

  it('[R-4.7-12] (V-03-4) jede Erfassung eines Blocks führt «zuletzt verwendet» nach, auch mit Standard', () => {
    const plan = planMitStandard({ c10: CAT.zfhr }, { lastUsedCategoryId: CAT.s2 });
    const r1 = run(plan, (p) => createEntry(p, blockDraft(['c10']), ctx));
    expect(r1.plan.lastUsedCategoryId).toBe(CAT.zfhr);
    const r2 = run(r1.plan, (p) => createEntry(p, blockDraft(['c9']), ctx));
    expect(eintrag(r2.plan, 'e101')).toMatchObject({ categoryId: CAT.zfhr });
  });

  it('[R-4.7-12] (2a Standard-Kategorie, §4) leere Legende → invalidEntry (categoryId)', () => {
    const plan = planMitStandard({}, { legend: [] });
    expectCommandError(plan, (p) => createEntry(p, blockDraft(['c9']), ctx), {
      code: 'invalidEntry',
      field: 'categoryId',
    });
  });
});

describe('createEntry Beso: Standard-Kategorie (V-03-3)', () => {
  it('[R-4.7-12] (V-03-3) Beso erhält die zuletzt verwendete Kategorie; der Standard der Spalte zählt nicht', () => {
    const plan = planMitStandard({ c10: CAT.zfhr }, { lastUsedCategoryId: CAT.s2 });
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'beso',
          date: MO,
          windows: [{ time: { form: 'point', at: 600 }, columnId: 'c10' }],
        },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').categoryId).toBe(CAT.s2);
    expect(r.plan.lastUsedCategoryId).toBe(CAT.s2);
  });

  it('[R-4.7-12] (V-03-3, V-03-4) Beso ohne zuletzt verwendete → Rückfall; «zuletzt verwendet» bleibt leer', () => {
    const plan = planMitStandard({});
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 600 } }] },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').categoryId).toBe(CAT.bat);
    expect(r.plan.lastUsedCategoryId).toBeNull();
  });
});

describe('createEntry Rapport (R-4.6-18, R-5.3-14)', () => {
  it('[R-4.6-18] neuer «KR» → Ltg Kp; neuer «BR 1» → Ltg Bat (Rapportliste der Vorlage, F-09)', () => {
    const plan = { ...loadKvkPlan(), stand: null };
    const kp = plan.legend.find((c) => c.name === 'Ltg Kp')?.id;
    const bat = plan.legend.find((c) => c.name === 'Ltg Bat')?.id;
    const r1 = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'KR', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(eintrag(r1.plan, r1.entryId)).toMatchObject({ type: 'rapport', categoryId: kp });
    const r2 = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'BR 1', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(eintrag(r2.plan, r2.entryId)).toMatchObject({ type: 'rapport', categoryId: bat });
  });

  it('[R-4.6-18] Kürzel wird für die Kategorie getrimmt; bei doppeltem Kürzel gilt der erste Eintrag', () => {
    const plan = planMit([], {
      rapportCodes: [
        { code: 'BR 0', categoryId: CAT.bat },
        { code: 'BR 0', categoryId: CAT.extern },
      ],
    });
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: ' BR 0 ', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.bat });
  });

  it('[R-4.6-18] (V-03-2) freies Kürzel → Kategorie namens «Ltg Kp», auch unter anderer ID', () => {
    const legende = kpLegend().map((c) => (c.name === 'Ltg Kp' ? { ...c, id: 'k9' } : c));
    const plan = planMit([], { legend: legende, rapportCodes: [] });
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'Tf Rap', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: 'k9' });
  });

  it('[R-4.6-18] (V-03-2) freies Kürzel ohne «Ltg Kp» in der Legende → erste nicht neutrale Kategorie', () => {
    const legende = kpLegend();
    const neutral = legende.find((c) => c.neutral) as LtgCategory;
    const plan = planMit([], {
      legend: [neutral, ...legende.filter((c) => c.name === 'Extern' || c.name === 'Ltg S2')],
      rapportCodes: [],
    });
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'Tf Rap', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.extern });
  });

  it('[R-4.6-18] ausdrücklich gewählte Kategorie hat Vorrang vor der Rapportliste', () => {
    const plan = planMit([]);
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'rapport',
          date: MO,
          code: 'KR',
          time: { form: 'point', at: 1080 },
          categoryId: CAT.extern,
        },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toMatchObject({ categoryId: CAT.extern });
  });

  it('[R-4.6-18] (V-03-4) Rapport ändert «zuletzt verwendet» nicht; leere Legende → invalidEntry (categoryId)', () => {
    const plan = planMit([], { lastUsedCategoryId: CAT.s2 });
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'KR', time: { form: 'point', at: 1080 } },
        ctx,
      ),
    );
    expect(r.plan.lastUsedCategoryId).toBe(CAT.s2);
    expectCommandError(
      planMit([], { legend: [] }),
      (p) =>
        createEntry(
          p,
          { type: 'rapport', date: MO, code: 'KR', time: { form: 'point', at: 1080 } },
          ctx,
        ),
      { code: 'invalidEntry', field: 'categoryId' },
    );
  });

  it('[R-5.3-14] Rapport erzeugt keine Nummer und keine Terminzeile; Beso des Tages unverändert', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)]);
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'rapport', date: MO, code: 'KR', time: { form: 'range', from: 1080, to: 1110 } },
        ctx,
      ),
    );
    const rap = eintrag(r.plan, 'e100');
    expect(rap).toMatchObject({
      type: 'rapport',
      ort: '',
      tn: '',
      display: 'rapColumn',
      displayColumns: { kind: 'ids', ids: [] },
      status: 'confirmed',
    });
    expect('besoNumber' in rap).toBe(false);
    expect(agendaLinesForDate(r.plan, MO).map((l) => l.entryId)).toEqual(['e1']);
    expect(nummern(r.plan, MO)).toEqual({ e1: 10 });
    expect(r.affectedEntryIds).toEqual(['e100']);
    expect(r.label).toBe('Rapport «KR» erstellt');
  });
});

describe('createEntry: nur durch die Nummerierung berührte Einträge (1a Schritt 2)', () => {
  it('[R-5.3-03] (1a Schritt 2) umnummerierter Beso mit eigenem Befund wird nicht geprüft: kein Fehler, er erhält 11', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10, { categoryId: 'k99' })]);
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    expect(nummern(r.plan, MO)).toEqual({ e1: 11, e100: 10 });
    expect(besoVon(r.plan, 'e1').categoryId).toBe('k99');
  });
});

describe('createEntry Beso: Zeitfenster und Nummern', () => {
  it('[R-4.6-25] Beso ohne Zeitfenster ist nicht erzeugbar → besoWithoutWindow (windows); Plan unverändert', () => {
    expectCommandError(
      planMit([]),
      (p) => createEntry(p, { type: 'beso', date: MO, windows: [], title: rt('Kontrl Fsg') }, ctx),
      { code: 'besoWithoutWindow', field: 'windows' },
    );
  });

  it('[R-4.6-25] (V09d) leere Legende und kein Zeitfenster zugleich → besoWithoutWindow', () => {
    expectCommandError(
      planMit([], { legend: [] }),
      (p) => createEntry(p, { type: 'beso', date: MO, windows: [] }, ctx),
      { code: 'besoWithoutWindow', field: 'windows' },
    );
  });

  it('[R-4.6-25][R-5.3-03] Beso mit zwei Zeitfenstern: IDs e, dann t in Fensterreihenfolge; Standardwerte; Nr 10', () => {
    const plan = planMit([], { nextSeq: 3, lastUsedCategoryId: CAT.zfhr });
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'beso',
          date: MO,
          title: rt('Vorrevisionen'),
          windows: [
            { time: { form: 'range', from: 780, to: 960 } },
            {
              time: { form: 'range', from: 540, to: 720 },
              columnId: 'c10',
              supplement: 'Inf Kp 2',
            },
          ],
        },
        ctx,
      ),
    );
    expect(eintrag(r.plan, 'e100')).toEqual({
      id: 'e100',
      type: 'beso',
      createdSeq: 3,
      status: 'confirmed',
      changed: false,
      internalNote: '',
      removedText: [],
      date: MO,
      title: rt('Vorrevisionen'),
      windows: [
        { id: 't101', time: { form: 'range', from: 780, to: 960 }, columnId: null, supplement: '' },
        {
          id: 't102',
          time: { form: 'range', from: 540, to: 720 },
          columnId: 'c10',
          supplement: 'Inf Kp 2',
        },
      ],
      ltg: '',
      tn: '',
      tpt: '',
      ort: '',
      categoryId: CAT.zfhr,
      besoNumber: 10,
      numberFixed: false,
      agendaOverride: null,
    });
    expect(r.plan.nextId).toBe(103);
    expect(r.label).toBe('Beso «Vorrevisionen» erstellt');
  });

  it('[R-5.3-02] erster Beso je Tag: 10, 20, 30, 40, 50, 60, 70', () => {
    let plan = planMit([]);
    const erhalten: (number | null)[] = [];
    for (const date of [MO, DI, MI, DO, '2026-10-02', SA, SO]) {
      const r = run(plan, (p) =>
        createEntry(
          p,
          { type: 'beso', date, windows: [{ time: { form: 'point', at: 600 } }] },
          ctx,
        ),
      );
      erhalten.push(besoVon(r.plan, r.entryId).besoNumber);
      plan = r.plan;
    }
    expect(erhalten).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('[R-5.3-03] Erfassen 1400, 0800, 1000 nacheinander → 12, 10, 11; umnummerierte Beso sind betroffen', () => {
    const neu = (p: Plan, at: number) =>
      createEntry(p, { type: 'beso', date: MO, windows: [{ time: { form: 'point', at } }] }, ctx);
    const r1 = run(planMit([]), (p) => neu(p, 840));
    const r2 = run(r1.plan, (p) => neu(p, 480));
    expect(nummern(r2.plan, MO)).toEqual({ e100: 11, e102: 10 });
    expect(r2.affectedEntryIds).toEqual(['e100', 'e102']);
    const r3 = run(r2.plan, (p) => neu(p, 600));
    expect(nummern(r3.plan, MO)).toEqual({ e100: 12, e102: 10, e104: 11 });
  });

  it('[R-5.3-07] nach dem Stand: Mo belegt 10–13 → neuer Beso um 0600 erhält 14; übrige unverändert', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 600, 12),
        besoUm('e4', 4, MO, 660, 13),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    expect(nummern(r.plan, MO)).toEqual({ e1: 10, e2: 11, e3: 12, e4: 13, e100: 14 });
    expect(r.affectedEntryIds).toEqual(['e100']);
  });

  it('[R-5.3-09] (a) nach dem Stand, Beso 12 gestrichen → neuer Beso erhält 13, nicht 12', () => {
    const plan = planMit(
      [
        besoUm('e1', 1, MO, 480, 10),
        besoUm('e2', 2, MO, 540, 11),
        besoUm('e3', 3, MO, 600, 12, { status: 'cancelled' }),
      ],
      { stand: STAND },
    );
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').besoNumber).toBe(13);
    expect(besoVon(r.plan, 'e3').besoNumber).toBe(12);
  });

  it('[R-5.3-09] (b) Mo 10–19, Beso 12 gestrichen, kein neuer Stand → neuer Beso ohne Nummer (F-14)', () => {
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
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 1200 } }] },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').besoNumber).toBeNull();
  });

  it('[R-5.3-09] (c) nach neuem Stand fehlt Beso 12 → neuer Beso am Mo erhält 12; übrige unverändert (F-52)', () => {
    const ohne12 = [10, 11, 13, 14, 15, 16, 17, 18, 19];
    const plan = planMit(
      ohne12.map((nr, i) => besoUm(`e${i + 1}`, i + 1, MO, 360 + 60 * i, nr)),
      { stand: { date: '2026-09-25', version: 2 } },
    );
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 300 } }] },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').besoNumber).toBe(12);
    expect(nummern(r.plan, MO)).toEqual({
      ...Object.fromEntries(ohne12.map((nr, i) => [`e${i + 1}`, nr])),
      e100: 12,
    });
  });

  it('[R-5.3-10] vor dem Stand: elfter Beso am Mo → genau einer ohne Nummer, keine Nummer ausserhalb 10–19', () => {
    const plan = planMit(
      Array.from({ length: 10 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 420 + 60 * i, 10 + i)),
    );
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    const werte = Object.values(nummern(r.plan, MO));
    expect(werte).toHaveLength(11);
    expect(werte.filter((n) => n === null)).toHaveLength(1);
    expect(werte.filter((n) => n !== null).sort()).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    // Sortierreihenfolge: der neue (0600) erhält 10, der späteste (1600) keine
    expect(besoVon(r.plan, 'e100').besoNumber).toBe(10);
    expect(besoVon(r.plan, 'e10').besoNumber).toBeNull();
  });

  it('[R-5.3-10] nach dem Stand: elfter Beso am Mo ohne Nummer, übrige unverändert, nie 20', () => {
    const plan = planMit(
      Array.from({ length: 10 }, (_, i) => besoUm(`e${i + 1}`, i + 1, MO, 420 + 60 * i, 10 + i)),
      { stand: STAND },
    );
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: MO, windows: [{ time: { form: 'point', at: 360 } }] },
        ctx,
      ),
    );
    expect(besoVon(r.plan, 'e100').besoNumber).toBeNull();
    expect(nummern(r.plan, MO)).toEqual({
      ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`e${i + 1}`, 10 + i])),
      e100: null,
    });
    expect(nummern(r.plan, DI)).toEqual({});
  });
});

describe('createEntry übrige Typen, Betroffenes und Bezeichnung', () => {
  it('[R-5.1-19] Querbalken und Marker ohne Spaltenangabe liegen über allen Spalten; Bezeichnungen', () => {
    const plan = planMit([]);
    const q = run(plan, (p) =>
      createEntry(
        p,
        { type: 'querbalken', fromDate: MO2, toDate: '2026-10-08', title: rt('Messe') },
        ctx,
      ),
    );
    expect(eintrag(q.plan, 'e100')).toMatchObject({ columns: { kind: 'all' }, categoryId: null });
    expect(q.label).toBe('Querbalken «Messe» erstellt');
    expect(q.affectedDates).toEqual([MO2, '2026-10-06', '2026-10-07', '2026-10-08']);
    const m = run(plan, (p) =>
      createEntry(p, { type: 'marker', date: MO, at: 1410, kind: 'ABV' }, ctx),
    );
    expect(eintrag(m.plan, 'e100')).toMatchObject({
      columns: { kind: 'all' },
      customKind: '',
      asFlatBlock: false,
    });
    expect(m.label).toBe('Marker «ABV 2330» erstellt');
  });

  it('[R-5.3-13] Ganztägige und mehrtägige Bemerkung tragen keine Nummer; Beso des Tages unverändert', () => {
    const plan = planMit([besoUm('e1', 1, MO, 480, 10)]);
    const r = run(plan, (p) =>
      createEntry(
        p,
        { type: 'dayRemark', date: MO, text: 'Fz für die Verschiebung vorbereiten.' },
        ctx,
      ),
    );
    expect(r.label).toBe('Ganztägige Bemerkung «Fz für die Verschiebung vorbereiten.» erstellt');
    expect(agendaLinesForDate(r.plan, MO).map((l) => [l.entryId, l.number])).toEqual([
      ['e1', 10],
      ['e100', null],
    ]);
    const m = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'multiDayRemark',
          text: 'Sport: 4h pro Woche.',
          scope: { kind: 'week', weekId: 'w27' },
        },
        ctx,
      ),
    );
    expect(eintrag(m.plan, 'e100')).toMatchObject({ number: null, refBoxColumnId: null });
    expect(m.label).toBe('Bemerkung «Sport: 4h pro Woche.» erstellt');
    expect(m.affectedDates).toEqual([
      MO2,
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('[R-4.7-11] (1b) Block über Mitternacht betrifft auch den Folgetag', () => {
    const plan = planMit([]);
    const r = run(plan, (p) =>
      createEntry(p, blockDraft(['c9'], { time: { form: 'range', from: 1320, to: 1560 } }), ctx),
    );
    expect(r.affectedDates).toEqual([MO, DI]);
  });

  it('[R-4.7-11] (1c) Kurztext: am Rand getrimmt, über 40 Codepunkte gekürzt mit «…», leer ohne Anführung', () => {
    const plan = planMit([]);
    const lang = '𝐀'.repeat(41);
    const genau = '𝐁'.repeat(40);
    expect(
      run(plan, (p) => createEntry(p, blockDraft(['c9'], { title: rt(lang) }), ctx)).label,
    ).toBe(`Block «${'𝐀'.repeat(40)}…» erstellt`);
    expect(
      run(plan, (p) => createEntry(p, blockDraft(['c9'], { title: rt(genau) }), ctx)).label,
    ).toBe(`Block «${genau}» erstellt`);
    expect(
      run(plan, (p) => createEntry(p, blockDraft(['c9'], { title: rt('  Mö Sch  ') }), ctx)).label,
    ).toBe('Block «Mö Sch» erstellt');
    expect(run(plan, (p) => createEntry(p, blockDraft(['c9'], { title: [] }), ctx)).label).toBe(
      'Block erstellt',
    );
  });

  it('[R-4.7-11] (P-4) Block ausserhalb aller Wochen → outsidePlan (date); ungültiges Datum → invalidEntry (date)', () => {
    expectCommandError(
      planMit([]),
      (p) => createEntry(p, blockDraft(['c9'], { date: '2026-12-07' }), ctx),
      { code: 'outsidePlan', field: 'date' },
    );
    expectCommandError(
      planMit([]),
      (p) => createEntry(p, blockDraft(['c9'], { date: '2026-02-30' }), ctx),
      { code: 'invalidEntry', field: 'date' },
    );
  });

  it('[R-4.7-11][R-4.4-07] (1a Schritt 2, §4) Block in der Beso-Spalte → invalidPlacement (columns)', () => {
    expectCommandError(planMit([]), (p) => createEntry(p, blockDraft(['c15']), ctx), {
      code: 'invalidPlacement',
      field: 'columns',
    });
  });
});

describe('suggestCategory (rein; Grundlage für den Vorschlag in E1-12)', () => {
  const plan = planMit([], {
    functionList: [
      { code: 'Zfhr', categoryId: CAT.zfhr, singleFunction: false },
      { code: 'S2', categoryId: CAT.s2, singleFunction: false },
      { code: 'Bat Kdt', categoryId: CAT.bat, singleFunction: false },
      { code: 'Kp', categoryId: CAT.extern, singleFunction: false },
      { code: 'Kp Kdt', categoryId: CAT.kp, singleFunction: true },
      { code: 'Einh Fw', categoryId: CAT.kp, singleFunction: true },
      { code: 'Four', categoryId: null, singleFunction: true },
    ],
  });

  it('[R-4.7-11] (2a suggestCategory, Grundlage R-4.7-10/E1-12) Ltg-Text gleich einem Kürzel → dessen Kategorie; getrimmt; leer → null', () => {
    expect(suggestCategory(plan, 'Zfhr')).toBe(CAT.zfhr);
    expect(suggestCategory(plan, ' S2 ')).toBe(CAT.s2);
    expect(suggestCategory(plan, 'Bat Kdt')).toBe(CAT.bat);
    expect(suggestCategory(plan, 'Kp')).toBe(CAT.extern);
    expect(suggestCategory(plan, 'Four')).toBeNull();
    expect(suggestCategory(plan, '')).toBeNull();
    expect(suggestCategory(plan, '   ')).toBeNull();
  });

  it('[R-4.7-11] (2a suggestCategory, Grundlage R-4.7-10/E1-12) Kürzel als ganzes Wort im Text: das früheste, bei gleicher Stelle das längste', () => {
    expect(suggestCategory(plan, 'Kp Kdt, Einh Fw')).toBe(CAT.kp);
    expect(suggestCategory(plan, 'S2 Zfhr')).toBe(CAT.s2);
    expect(suggestCategory(plan, 'Ltg: Zfhr/S2')).toBe(CAT.zfhr);
    expect(suggestCategory(plan, 'Kp Kdt Stv')).toBe(CAT.kp);
  });

  it('[R-4.7-11] (2a suggestCategory, Grundlage R-4.7-10/E1-12) kein ganzes Wort oder andere Schreibweise → null; der Plan bleibt unverändert', () => {
    const vorher = JSON.stringify(plan);
    expect(suggestCategory(plan, 'Zfhrs')).toBeNull();
    expect(suggestCategory(plan, 'XS2')).toBeNull();
    expect(suggestCategory(plan, 'zfhr')).toBeNull();
    expect(suggestCategory(plan, 'Einh Fwx')).toBeNull();
    expect(JSON.stringify(plan)).toBe(vorher);
  });
});

// @vitest-environment jsdom
// Neuer Plan aus der Vorlage und ID-Zähler (Vertrag E1-02a Abschnitt 3 factories.ts, 8 P-3, P-6).
import { describe, expect, expectTypeOf, it } from 'vitest';
import { allocateIds, createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import type { ColumnSet, Person, Plan } from '../../../../src/model/wap/types';
import {
  basePlan,
  CAT,
  catchError,
  days,
  expectModelError,
  kpLegend,
  roundTrip,
  setMiFr,
  setStufen,
  setWochenende,
} from '../../support/model/builders';

function byCode<T extends { readonly code: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.code.localeCompare(b.code));
}

const input = { planId: 'plan-a', startDate: '2026-09-28', weekCount: 2 } as const;

function expectedNewKpPlan(): Plan {
  return {
    schemaVersion: 1,
    id: 'plan-a',
    level: 'kp',
    templateId: 'kp',
    unit: '',
    parentUnit: '',
    service: '',
    exerciseName: '',
    beilage: '',
    classification: '',
    sunLocation: '',
    commander: { grad: '', name: '', vorname: '', funktion: '', nameOrder: 'gradVornameName' },
    signatureImage: null,
    signatureEnabled: false,
    coatOfArms: null,
    motto: '',
    persons: [],
    functionList: [
      { code: 'Zfhr', categoryId: CAT.zfhr, singleFunction: false },
      { code: 'S2', categoryId: CAT.s2, singleFunction: false },
      { code: 'Bat Kdt', categoryId: CAT.bat, singleFunction: false },
      { code: 'S3', categoryId: CAT.bat, singleFunction: false },
      { code: 'S4', categoryId: CAT.bat, singleFunction: false },
      { code: 'Kp Kdt', categoryId: CAT.kp, singleFunction: true },
      { code: 'Kdt Stv', categoryId: CAT.kp, singleFunction: true },
      { code: 'Einh Fw', categoryId: CAT.kp, singleFunction: true },
      { code: 'Four', categoryId: CAT.kp, singleFunction: true },
    ],
    legend: kpLegend(),
    rapportCodes: [
      { code: 'KR', categoryId: CAT.kp },
      { code: 'DR', categoryId: CAT.kp },
      { code: 'AR1', categoryId: CAT.kp },
      { code: 'AR2', categoryId: CAT.kp },
      { code: 'ARK', categoryId: CAT.kp },
      { code: 'BR 0', categoryId: CAT.bat },
      { code: 'BR 1', categoryId: CAT.bat },
      { code: 'BR 2', categoryId: CAT.bat },
      { code: 'BR 3', categoryId: CAT.bat },
    ],
    abbreviationsSelected: [],
    markerLabels: [
      { kind: 'AV', withTime: false },
      { kind: 'ABV', withTime: true },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ],
    columnSets: [stufenMitStandard(), setMiFr(), setWochenende()],
    weeks: [
      {
        id: 'w26',
        label: 'KVK',
        shortName: 'KVK',
        startDate: '2026-09-28',
        days: days([null, null, null, null, null, null, null]),
        weekGoals: [],
        heightenedReadiness: '',
        sunOverride: { sunrise: null, sunset: null },
        agendaWeekend: 'auto',
        hiddenRemarkIds: [],
      },
      {
        id: 'w27',
        label: 'Woche 1',
        shortName: 'Wo1',
        startDate: '2026-10-05',
        days: days([null, null, null, null, null, null, null]),
        weekGoals: [],
        heightenedReadiness: '',
        sunOverride: { sunrise: null, sunset: null },
        agendaWeekend: 'auto',
        hiddenRemarkIds: [],
      },
    ],
    deletedWeeks: [],
    entries: {},
    displayRange: { from: 240, to: 1440 },
    stand: null,
    nextSeq: 1,
    nextId: 28,
    lastUsedCategoryId: null,
    printDefaults: { printTn: false, printTenue: false },
    acknowledgedFindings: [],
  };
}

/**
 * «KVK Stufen» mit Standard-Kategorie aus der Funktionsliste der Vorlage: «Kp Kdt» → Ltg Kp, «Zfhr» → Ltg Zfhr
 * (F-LAYOUT2 Punkt 15, Entscheid Auftraggeber 19.10.2026 «15: ja»; UX-H-14, TE-HUI2-01).
 */
function stufenMitStandard(): ColumnSet {
  const s = setStufen();
  const standard: Record<string, string> = { 'Kp Kdt': CAT.kp, Zfhr: CAT.zfhr };
  return {
    ...s,
    columns: s.columns.map((c) => ({ ...c, defaultCategoryId: standard[c.name] ?? null })),
  };
}

describe('createPlanFromTemplate', () => {
  it('[R-4.1-01] Stufe Kp liefert einen Plan mit Kp-Vorlage; alle Werte gemäss Vertrag P-6 (V-02a-1)', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    const expected = expectedNewKpPlan();
    // Reihenfolge der Funktionsliste legt der Vertrag nicht fest (R-4.7-08 prüft sie gegen die Vorlage).
    expect({ ...plan, functionList: byCode(plan.functionList) }).toEqual({
      ...expected,
      functionList: byCode(expected.functionList),
    });
  });

  it('[R-4.1-01] (Vertrag P-6, ADR-002 8b/AR0-19) IDs in Vertragsreihenfolge: Legende k1–k6, Spaltensätze s/c, dann Wochen w; nextId danach', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan.legend.map((c) => c.id)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
    expect(plan.columnSets.map((s) => [s.id, ...s.columns.map((c) => c.id)])).toEqual([
      ['s7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15'],
      ['s16', 'c17', 'c18', 'c19', 'c20', 'c21'],
      ['s22', 'c23', 'c24', 'c25'],
    ]);
    expect(plan.weeks.map((w) => w.id)).toEqual(['w26', 'w27']);
    expect(plan.nextId).toBe(28);
  });

  it('[R-4.1-01] Plan ohne gültige Stufe ist nicht erzeugbar → invalidPlanInput (level)', () => {
    const stab = { ...kpTemplate(), level: 'stab' } as unknown as LevelTemplate;
    expectModelError(() => createPlanFromTemplate(stab, input), {
      code: 'invalidPlanInput',
      field: 'level',
    });
    const ohne = { ...kpTemplate(), level: undefined } as unknown as LevelTemplate;
    expectModelError(() => createPlanFromTemplate(ohne, input), {
      code: 'invalidPlanInput',
      field: 'level',
    });
  });

  it('[R-4.2-01] (V-02a-1) Standard-Bezeichnungen «KVK», «Woche 1», «Woche 2» mit Kurznamen «KVK», «Wo1», «Wo2»', () => {
    const plan = createPlanFromTemplate(kpTemplate(), { ...input, weekCount: 3 });
    expect(plan.weeks.map((w) => [w.label, w.shortName])).toEqual([
      ['KVK', 'KVK'],
      ['Woche 1', 'Wo1'],
      ['Woche 2', 'Wo2'],
    ]);
  });

  it('[R-4.2-01] Bezeichnungen aus der Eingabe werden übernommen und bleiben im JSON-Rundlauf erhalten', () => {
    const plan = createPlanFromTemplate(kpTemplate(), {
      ...input,
      weekLabels: ['KVK', 'FDT Woche 1'],
    });
    expect(plan.weeks.map((w) => w.label)).toEqual(['KVK', 'FDT Woche 1']);
    expect(roundTrip(plan)).toEqual(plan);
  });

  it('[R-4.2-03] Wochen beginnen am Startdatum plus 7 Tage je Woche, auch über den Jahreswechsel', () => {
    const plan = createPlanFromTemplate(kpTemplate(), {
      planId: 'p',
      startDate: '2026-12-21',
      weekCount: 3,
    });
    expect(plan.weeks.map((w) => w.startDate)).toEqual(['2026-12-21', '2026-12-28', '2027-01-04']);
  });

  it('[R-4.2-02] (F-15) Startdatum kein Montag → startNotMonday mit Vorschlag, kein Plan', () => {
    expectModelError(
      () => createPlanFromTemplate(kpTemplate(), { ...input, startDate: '2026-09-29' }),
      { code: 'startNotMonday', suggestion: '2026-09-28' },
    );
  });

  it('[R-4.1-01] Wochenanzahl keine ganze Zahl ≥ 1 → invalidPlanInput (weekCount); eine Woche ist gültig', () => {
    for (const weekCount of [0, -1, 1.5, Number.NaN]) {
      expectModelError(() => createPlanFromTemplate(kpTemplate(), { ...input, weekCount }), {
        code: 'invalidPlanInput',
        field: 'weekCount',
      });
    }
    expect(createPlanFromTemplate(kpTemplate(), { ...input, weekCount: 1 }).weeks).toHaveLength(1);
  });

  it('[R-4.2-01] Anzahl Bezeichnungen ≠ Wochenanzahl → invalidPlanInput (weekLabels)', () => {
    expectModelError(
      () => createPlanFromTemplate(kpTemplate(), { ...input, weekLabels: ['KVK'] }),
      { code: 'invalidPlanInput', field: 'weekLabels' },
    );
  });

  it('[R-4.4-09] (Vertrag P-16) ungültiger zweiter Spaltensatz in der Vorlage → invalidColumnSet (columnSets[1])', () => {
    const t = kpTemplate();
    const bad: LevelTemplate = {
      ...t,
      columnSets: [
        t.columnSets[0] as LevelTemplate['columnSets'][number],
        {
          name: 'Zwei Rap',
          columns: [
            {
              name: 'A',
              kind: 'planning',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
            {
              name: 'Rap',
              kind: 'rap',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
            {
              name: 'Rap',
              kind: 'rap',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
            {
              name: 'Beso',
              kind: 'beso',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
          ],
        },
      ],
    };
    expectModelError(() => createPlanFromTemplate(bad, input), {
      code: 'invalidColumnSet',
      field: 'columnSets[1]',
    });
  });

  it('[R-4.3-02] neuer Plan: alle Tage mit Darstellung «voll»; die drei Werte sind der Typ der Darstellung', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    for (const w of plan.weeks) {
      expect(w.days.map((d) => d.weekday)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
      for (const d of w.days) expect(d.display).toBe('full');
    }
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const displays = ['full', 'compact', 'hidden', 'full', 'full', 'hidden', 'compact'] as const;
    const days = week.days.map((d, i) => ({
      ...d,
      display: displays[i] ?? 'full',
    })) as unknown as typeof week.days;
    const geaendert: Plan = { ...plan, weeks: [{ ...week, days }, ...plan.weeks.slice(1)] };
    expect(roundTrip(geaendert).weeks[0]?.days.map((d) => d.display)).toEqual([...displays]);
    expectTypeOf<Plan['weeks'][number]['days'][number]['display']>().toEqualTypeOf<
      'full' | 'compact' | 'hidden'
    >();
  });

  it('[R-4.3-01] jeder Tag hat ein eigenes Feld für den Spaltensatz; neu ohne Zuweisung (null)', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    const day = plan.weeks[0]?.days[0];
    expect(day).toHaveProperty('columnSetId', null);
    expect(plan.weeks[0]?.days.every((d) => d.columnSetId === null)).toBe(true);
  });

  it('[R-4.5-01] neuer Plan: Anzeigebereich 0400–2400', () => {
    expect(createPlanFromTemplate(kpTemplate(), input).displayRange).toEqual({
      from: 240,
      to: 1440,
    });
  });

  it('[R-4.7-07] neuer Plan enthält die Kategorie «neutral» mit Füllung weiss', () => {
    const neutral = createPlanFromTemplate(kpTemplate(), input).legend.filter((c) => c.neutral);
    expect(neutral).toEqual([
      {
        id: 'k6',
        name: 'neutral',
        legendLabel: 'neutral',
        color: { r: 255, g: 255, b: 255 },
        neutral: true,
        inLegend: false,
      },
    ]);
  });

  it('[R-4.7-08] neuer Kp-Plan enthält die Funktionsliste der Vorlage mit Kategorie-IDs des Plans', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    const byId = new Map(plan.legend.map((c) => [c.id, c.name]));
    expect(
      plan.functionList.map((f) => [f.code, f.categoryId ? byId.get(f.categoryId) : null]),
    ).toEqual(kpTemplate().functionList.map((f) => [f.code, f.categoryName]));
  });

  it('[R-4.9-18] neuer Kp-Plan: Rapportkürzel mit Standard-Kategorie als ID des Plans (BR → Ltg Bat, übrige → Ltg Kp)', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    const byId = new Map(plan.legend.map((c) => [c.id, c.name]));
    expect(plan.rapportCodes.map((r) => `${r.code}=${byId.get(r.categoryId)}`)).toEqual([
      'KR=Ltg Kp',
      'DR=Ltg Kp',
      'AR1=Ltg Kp',
      'AR2=Ltg Kp',
      'ARK=Ltg Kp',
      'BR 0=Ltg Bat',
      'BR 1=Ltg Bat',
      'BR 2=Ltg Bat',
      'BR 3=Ltg Bat',
    ]);
  });

  it('[R-4.9-19] neuer Kp-Plan enthält genau die drei Spaltensätze der Vorlage; Standard-Kategorie nur aus der Funktionsliste («Kp Kdt» → Ltg Kp, «Zfhr» → Ltg Zfhr), übrige Spalten ohne (F-LAYOUT2, Entscheid 19.10.2026 «15: ja»)', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan.columnSets.map((s) => s.name)).toEqual([
      'KVK Stufen',
      'KVK Mi–Fr',
      'Wochenende kompakt',
    ]);
    const byId = new Map(plan.legend.map((c) => [c.id, c.name]));
    expect(
      plan.columnSets
        .flatMap((s) => s.columns)
        .filter((c) => c.defaultCategoryId !== null)
        .map((c) => [c.name, byId.get(c.defaultCategoryId as string)]),
    ).toEqual([
      ['Kp Kdt', 'Ltg Kp'],
      ['Zfhr', 'Ltg Zfhr'],
    ]);
  });

  it('[R-4.1-04] neuer Plan ohne Klassifizierung (leer) und mit Klassifizierung im JSON-Rundlauf gültig', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan.classification).toBe('');
    const intern: Plan = { ...plan, classification: 'INTERN' };
    expect(roundTrip(intern).classification).toBe('INTERN');
  });

  it('[R-15-01] neuer Kp-Plan: Feld Klassifizierung vorhanden, Wert leer', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan).toHaveProperty('classification', '');
  });

  it('[R-15-03] neuer Plan: Unterschrift-Bild aus und leer', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan.signatureEnabled).toBe(false);
    expect(plan.signatureImage).toBeNull();
  });

  it('[R-4.1-15] Stand gehört zum Plan: neu ohne Stand, keine Woche führt ein eigenes Stand-Feld', () => {
    const plan = createPlanFromTemplate(kpTemplate(), { ...input, weekCount: 3 });
    expect(plan).toHaveProperty('stand', null);
    for (const w of plan.weeks) {
      expect(Object.keys(w).some((k) => k.toLowerCase().includes('stand'))).toBe(false);
    }
    const mitStand: Plan = { ...plan, stand: { date: '2026-09-17', version: 2 } };
    expect(roundTrip(mitStand).stand).toEqual({ date: '2026-09-17', version: 2 });
  });

  it('[R-4.1-09] Personenliste: neu leer; Person mit Grad, Name, Vorname und Funktion bleibt im JSON-Rundlauf erhalten', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    expect(plan.persons).toEqual([]);
    const person: Person = {
      id: 'r28',
      grad: 'Lt',
      name: 'Muster',
      vorname: 'B',
      funktion: 'Zfhr',
    };
    const mitPerson: Plan = { ...plan, persons: [person], nextId: 29 };
    expect(roundTrip(mitPerson).persons).toEqual([person]);
    expectTypeOf<keyof Person>().toEqualTypeOf<'id' | 'grad' | 'name' | 'vorname' | 'funktion'>();
  });

  it('[R-6-07] neuer Plan: interne Notiz pro Tag vorhanden und leer', () => {
    const plan = createPlanFromTemplate(kpTemplate(), input);
    for (const d of plan.weeks.flatMap((w) => w.days)) expect(d.internalNote).toBe('');
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const days = week.days.map((d, i) =>
      i === 2 ? { ...d, internalNote: 'Fz für Mittwoch reservieren' } : d,
    ) as unknown as typeof week.days;
    const mitNotiz: Plan = { ...plan, weeks: [{ ...week, days }, ...plan.weeks.slice(1)] };
    expect(roundTrip(mitNotiz).weeks[0]?.days[2]?.internalNote).toBe('Fz für Mittwoch reservieren');
  });

  it('[R-4.1-01] Vorlage und Eingabe bleiben unverändert (rein)', () => {
    const t = kpTemplate();
    const before = roundTrip(t);
    const inp = { ...input, weekLabels: ['A', 'B'] };
    createPlanFromTemplate(t, inp);
    expect(t).toEqual(before);
    expect(inp.weekLabels).toEqual(['A', 'B']);
  });
});

describe('allocateIds', () => {
  it('[R-4.1-01] (Vertrag P-3, ADR-002 8b/AR0-19) IDs aus dem Zähler des Plans: Präfix + fortlaufende Zahl, Zähler erhöht, Plan unverändert', () => {
    const plan = basePlan({ nextId: 100 });
    expect(allocateIds(plan, 'e', 3)).toEqual({ ids: ['e100', 'e101', 'e102'], nextId: 103 });
    expect(allocateIds(plan, 'r', 1)).toEqual({ ids: ['r100'], nextId: 101 });
    expect(plan.nextId).toBe(100);
  });

  it('[R-4.1-01] (Vertrag P-3, ADR-002 8b/AR0-19) allocateIds mit 0 liefert keine ID und unveränderten Zähler; negative oder gebrochene Anzahl → RangeError', () => {
    const plan = basePlan({ nextId: 7 });
    expect(allocateIds(plan, 'w', 0)).toEqual({ ids: [], nextId: 7 });
    expect(catchError(() => allocateIds(plan, 'w', -1))).toBeInstanceOf(RangeError);
    expect(catchError(() => allocateIds(plan, 'w', 1.5))).toBeInstanceOf(RangeError);
  });
});

// Testhilfen für das Datenmodell (Paket E1-02a, Vertrag docs/wap-planer/plan/vertraege/E1-02a.md).
// Baut Pläne und Einträge als Literale, ohne Produktcode aufzurufen: Die Ableitungs- und
// Validierungstests sollen nur an der geprüften Funktion scheitern, nie an einer Fabrik.
// Alle Inhalte sind fiktiv.
import { expect } from 'vitest';
import { ModelError, type ModelErrorCode } from '../../../../src/model/wap/errors';
import type { EntryInput } from '../../../../src/model/wap/factories';
import type {
  Beso,
  BesoTimeWindow,
  Block,
  Column,
  ColumnKind,
  ColumnSet,
  DayConfig,
  DayRemark,
  Entry,
  Id,
  IsoDate,
  LtgCategory,
  Marker,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
  RichText,
  Week,
  Weekday,
} from '../../../../src/model/wap/types';

/** Kategorien-IDs wie bei `createPlanFromTemplate(kpTemplate(), …)` (Vertrag P-6: Legende zuerst). */
export const CAT = {
  bat: 'k1',
  kp: 'k2',
  zfhr: 'k3',
  extern: 'k4',
  s2: 'k5',
  neutral: 'k6',
} as const;

export const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Kp-Legende (Vertrag Abschnitt 2, Beschrieb 4.7). */
export function kpLegend(): LtgCategory[] {
  return [
    {
      id: CAT.bat,
      name: 'Ltg Bat',
      legendLabel: 'Leitung Bat',
      color: { r: 204, g: 236, b: 255 },
      neutral: false,
      inLegend: true,
    },
    {
      id: CAT.kp,
      name: 'Ltg Kp',
      legendLabel: 'Leitung Kp',
      color: { r: 255, g: 255, b: 153 },
      neutral: false,
      inLegend: true,
    },
    {
      id: CAT.zfhr,
      name: 'Ltg Zfhr',
      legendLabel: 'Leitung Zfhr',
      color: { r: 253, g: 234, b: 218 },
      neutral: false,
      inLegend: true,
    },
    {
      id: CAT.extern,
      name: 'Extern',
      legendLabel: 'Extern',
      color: { r: 191, g: 191, b: 191 },
      neutral: false,
      inLegend: true,
    },
    {
      id: CAT.s2,
      name: 'Ltg S2',
      legendLabel: 'Ltg S2',
      color: { r: 255, g: 204, b: 153 },
      neutral: false,
      inLegend: true,
    },
    {
      id: CAT.neutral,
      name: 'neutral',
      legendLabel: 'neutral',
      color: { r: 255, g: 255, b: 255 },
      neutral: true,
      inLegend: false,
    },
  ];
}

export function col(
  id: Id,
  name: string,
  kind: ColumnKind,
  extra: Partial<Omit<Column, 'id' | 'name' | 'kind'>> = {},
): Column {
  return {
    id,
    name,
    kind,
    weight: 'normal',
    labelOrientation: 'horizontal',
    defaultCategoryId: null,
    origin: 'manual',
    ...extra,
  };
}

/** Spaltensatz «KVK Stufen»: c8–c13 Planung, c14 Rap, c15 Beso (IDs wie Vertrag P-6). */
export function setStufen(): ColumnSet {
  return {
    id: 's7',
    name: 'KVK Stufen',
    columns: [
      col('c8', 'Kp Kdt', 'planning'),
      col('c9', 'Stv', 'planning'),
      col('c10', 'Zfhr', 'planning'),
      col('c11', 'Uof', 'planning'),
      col('c12', 'höh Uof', 'planning'),
      col('c13', 'Trp', 'planning'),
      col('c14', 'Rap', 'rap'),
      col('c15', 'Beso', 'beso'),
    ],
  };
}

/** Spaltensatz «KVK Mi–Fr»: c17 Kdo, c18 Mö, c19 Sph, c20 Rap, c21 Beso. */
export function setMiFr(): ColumnSet {
  return {
    id: 's16',
    name: 'KVK Mi–Fr',
    columns: [
      col('c17', 'Kdo', 'planning'),
      col('c18', 'Mö', 'planning'),
      col('c19', 'Sph', 'planning'),
      col('c20', 'Rap', 'rap'),
      col('c21', 'Beso', 'beso'),
    ],
  };
}

/** Spaltensatz «Wochenende kompakt»: c23 Kp, c24 Rap, c25 Beso. */
export function setWochenende(): ColumnSet {
  return {
    id: 's22',
    name: 'Wochenende kompakt',
    columns: [col('c23', 'Kp', 'planning'), col('c24', 'Rap', 'rap'), col('c25', 'Beso', 'beso')],
  };
}

/** Spaltensatz mit Nebenspalte «Det» (fiktiv): c40 Zug 1, c41 Zug 2, c42 Det, c43 Rap, c44 Beso. */
export function setMitNebenspalte(): ColumnSet {
  return {
    id: 's39',
    name: 'Züge mit Det',
    columns: [
      col('c40', 'Zug 1', 'planning'),
      col('c41', 'Zug 2', 'planning'),
      col('c42', 'Det', 'secondary', { weight: 'narrow' }),
      col('c43', 'Rap', 'rap'),
      col('c44', 'Beso', 'beso'),
    ],
  };
}

export function days(
  setIds: readonly (Id | null)[],
  over: Partial<Omit<DayConfig, 'weekday'>> = {},
): Week['days'] {
  const d = (i: number): DayConfig => ({
    weekday: WEEKDAYS[i] as Weekday,
    columnSetId: setIds[i] ?? null,
    display: 'full',
    internalNote: '',
    ...over,
  });
  return [d(0), d(1), d(2), d(3), d(4), d(5), d(6)];
}

/** Standard-Tage einer KVK-Woche: Mo–Di Stufen, Mi–Fr Mi–Fr, Sa–So Wochenende. */
export const KVK_SETS: readonly Id[] = ['s7', 's7', 's16', 's16', 's16', 's22', 's22'];

export function week(id: Id, startDate: IsoDate, over: Partial<Week> = {}): Week {
  return {
    id,
    label: id === 'w26' ? 'KVK' : `Woche ${id}`,
    shortName: id === 'w26' ? 'KVK' : `Wo${id}`,
    startDate,
    days: days(KVK_SETS),
    weekGoals: [],
    heightenedReadiness: '',
    sunOverride: { sunrise: null, sunset: null },
    agendaWeekend: 'auto',
    hiddenRemarkIds: [],
    ...over,
  };
}

/**
 * Fiktiver Kp-Plan mit drei Wochen: w26 ab 28.09.2026 (KW 40), w27 ab 05.10.2026,
 * w28 ab 12.10.2026. Ohne Einträge; `nextId` 100, `nextSeq` 1.
 */
export function basePlan(over: Partial<Plan> = {}): Plan {
  return {
    schemaVersion: 1,
    id: 'plan-test-1',
    level: 'kp',
    templateId: 'kp',
    unit: 'Inf Kp 99/1',
    parentUnit: 'Inf Bat 99',
    service: 'FDT 2099',
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
    functionList: [],
    legend: kpLegend(),
    rapportCodes: [
      { code: 'KR', categoryId: CAT.kp },
      { code: 'DR', categoryId: CAT.kp },
      { code: 'BR 0', categoryId: CAT.bat },
    ],
    abbreviationsSelected: [],
    markerLabels: [
      { kind: 'AV', withTime: false },
      { kind: 'ABV', withTime: true },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ],
    columnSets: [setStufen(), setMiFr(), setWochenende(), setMitNebenspalte()],
    weeks: [week('w26', '2026-09-28'), week('w27', '2026-10-05'), week('w28', '2026-10-12')],
    deletedWeeks: [],
    entries: {},
    displayRange: { from: 240, to: 1440 },
    stand: null,
    nextSeq: 1,
    nextId: 100,
    lastUsedCategoryId: null,
    printDefaults: { printTn: false, printTenue: false },
    acknowledgedFindings: [],
    ...over,
  };
}

export function withEntries(plan: Plan, entries: readonly Entry[]): Plan {
  const map: Record<Id, Entry> = { ...plan.entries };
  for (const e of entries) map[e.id] = e;
  return { ...plan, entries: map };
}

export function rt(text: string, bold = false): RichText {
  return [{ text, bold }];
}

/** Text eines RichText ohne Auszeichnung. */
export function plain(r: RichText): string {
  return r.map((run) => run.text).join('');
}

const base = { status: 'confirmed', changed: false, internalNote: '', removedText: [] } as const;

export function block(id: Id, seq: number, over: Partial<Block> = {}): Block {
  return {
    ...base,
    id,
    type: 'block',
    createdSeq: seq,
    date: '2026-09-28',
    time: { form: 'range', from: 480, to: 720 },
    columns: { kind: 'ids', ids: ['c8'] },
    title: rt('Ausb Thema', true),
    supplement: '',
    ltg: '',
    tn: '',
    tpt: '',
    ort: '',
    tenue: '',
    printTn: false,
    printTenue: false,
    categoryId: CAT.kp,
    secondCategoryId: null,
    textDirection: 'auto',
    openEnd: false,
    ...over,
  };
}

export function querbalken(id: Id, seq: number, over: Partial<Querbalken> = {}): Querbalken {
  return {
    ...base,
    id,
    type: 'querbalken',
    createdSeq: seq,
    title: rt('Messe'),
    fromDate: '2026-10-08',
    toDate: '2026-10-18',
    columns: { kind: 'all' },
    categoryId: CAT.neutral,
    ...over,
  };
}

export function marker(id: Id, seq: number, over: Partial<Marker> = {}): Marker {
  return {
    ...base,
    id,
    type: 'marker',
    createdSeq: seq,
    date: '2026-09-29',
    at: 420,
    kind: 'AV',
    customKind: '',
    columns: { kind: 'all' },
    asFlatBlock: false,
    ...over,
  };
}

export function rapport(id: Id, seq: number, over: Partial<Rapport> = {}): Rapport {
  return {
    ...base,
    id,
    type: 'rapport',
    createdSeq: seq,
    date: '2026-09-29',
    code: 'KR',
    time: { form: 'range', from: 600, to: 630 },
    ort: '',
    tn: '',
    categoryId: CAT.kp,
    display: 'rapColumn',
    displayColumns: { kind: 'ids', ids: [] },
    ...over,
  };
}

export function win(id: Id, over: Partial<BesoTimeWindow> = {}): BesoTimeWindow {
  return { id, time: { form: 'point', at: 810 }, columnId: null, supplement: '', ...over };
}

export function beso(id: Id, seq: number, over: Partial<Beso> = {}): Beso {
  return {
    ...base,
    id,
    type: 'beso',
    createdSeq: seq,
    date: '2026-09-28',
    title: rt('Kontrl Fsg'),
    windows: [win(`t${id}`)],
    ltg: '',
    tn: '',
    tpt: '',
    ort: '',
    categoryId: CAT.kp,
    besoNumber: 24,
    numberFixed: false,
    agendaOverride: null,
    ...over,
  };
}

export function dayRemark(id: Id, seq: number, over: Partial<DayRemark> = {}): DayRemark {
  return {
    ...base,
    id,
    type: 'dayRemark',
    createdSeq: seq,
    date: '2026-10-02',
    text: 'Fz für die Verschiebung vorbereiten.',
    ...over,
  };
}

export function multiDayRemark(
  id: Id,
  seq: number,
  over: Partial<MultiDayRemark> = {},
): MultiDayRemark {
  return {
    ...base,
    id,
    type: 'multiDayRemark',
    createdSeq: seq,
    text: 'Sport: 4h pro Woche.',
    scope: { kind: 'plan' },
    number: null,
    refBoxColumnId: null,
    ...over,
  };
}

/** Eingaben für die Factories (ohne id, type, createdSeq, changed, removedText, status, internalNote). */
export function blockInput(over: Partial<EntryInput<Block>> = {}): EntryInput<Block> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = block('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function besoInput(over: Partial<EntryInput<Beso>> = {}): EntryInput<Beso> {
  const { id: _i, type: _t, createdSeq: _c, changed: _ch, removedText: _r, ...rest } = beso('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function rapportInput(over: Partial<EntryInput<Rapport>> = {}): EntryInput<Rapport> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = rapport('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function markerInput(over: Partial<EntryInput<Marker>> = {}): EntryInput<Marker> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = marker('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function querbalkenInput(
  over: Partial<EntryInput<Querbalken>> = {},
): EntryInput<Querbalken> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = querbalken('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function dayRemarkInput(over: Partial<EntryInput<DayRemark>> = {}): EntryInput<DayRemark> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = dayRemark('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

export function multiDayRemarkInput(
  over: Partial<EntryInput<MultiDayRemark>> = {},
): EntryInput<MultiDayRemark> {
  const {
    id: _i,
    type: _t,
    createdSeq: _c,
    changed: _ch,
    removedText: _r,
    ...rest
  } = multiDayRemark('x', 0);
  const { status: _s, internalNote: _n, ...input } = rest;
  return { ...input, ...over };
}

/** Entfernt ein Pflichtfeld zur Laufzeit (Vertrag P-9: «auch fehlende Felder trotz Typ»). */
export function without<T extends object, K extends keyof T>(obj: T, key: K): T {
  const copy: Partial<T> = { ...obj };
  delete copy[key];
  return copy as T;
}

export function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

export interface ExpectedModelError {
  readonly code: ModelErrorCode;
  readonly field?: string | null;
  readonly suggestion?: IsoDate | null;
}

/** Prüft eine erwartete `ModelError` (Vertrag Abschnitt 4: code, field, suggestion, Meldung nicht leer). */
export function expectModelError(fn: () => unknown, expected: ExpectedModelError): ModelError {
  const e = catchError(fn);
  expect(e).toBeInstanceOf(ModelError);
  const err = e as ModelError;
  expect(err.code).toBe(expected.code);
  if (expected.field !== undefined) expect(err.field).toBe(expected.field);
  if (expected.suggestion !== undefined) expect(err.suggestion).toBe(expected.suggestion);
  expect(err.userMessage.cause.trim()).not.toBe('');
  expect(err.userMessage.nextStep.trim()).not.toBe('');
  expect(err.message).toBe(err.userMessage.cause);
  return err;
}

/** JSON-Rundlauf wie beim Speichern und Laden der Plan-Datei (ADR-002: reine Daten). */
export function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Reine Konstruktoren mit Validierung (Vertrag E1-02a Abschnitt 3 und 8 P-3, P-6, P-9).
// Fehler: ModelError 'invalidEntry' bzw. 'besoWithoutWindow' mit field.

import { addDays, weekDates } from './calendar';
import { modelError } from './errors';
import type { LevelTemplate, TemplateColumnSet } from './template/types';
import type {
  Beso,
  Block,
  Column,
  ColumnSet,
  DayConfig,
  DayRemark,
  Entry,
  FunctionEntry,
  Id,
  IdPrefix,
  IsoDate,
  LtgCategory,
  Marker,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
  RapportCode,
  Week,
  Weekday,
} from './types';
import { checkEntryStructure, validateColumnSet } from './validate';

/** IDs aus plan.nextId: ids[i] = prefix + (plan.nextId + i); gibt den erhöhten Zähler zurück (rein). */
export function allocateIds(
  plan: Plan,
  prefix: IdPrefix,
  count: number,
): { readonly ids: readonly Id[]; readonly nextId: number } {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('allocateIds: count muss eine ganze Zahl ab 0 sein.');
  }
  const ids = Array.from({ length: count }, (_, i) => `${prefix}${plan.nextId + i}`);
  return { ids, nextId: plan.nextId + count };
}

export interface CreatePlanInput {
  /** Aus src/io (crypto.randomUUID), nie aus dem Modell. */
  readonly planId: Id;
  readonly startDate: IsoDate;
  readonly weekCount: number;
  readonly weekLabels?: readonly string[];
}

function planInputError(field: string, cause: string, nextStep: string): never {
  throw modelError('invalidPlanInput', { field }, { cause, nextStep });
}

function newDays(): Week['days'] {
  const day = (weekday: Weekday): DayConfig => ({
    weekday,
    columnSetId: null,
    display: 'full',
    internalNote: '',
  });
  return [day('Mo'), day('Di'), day('Mi'), day('Do'), day('Fr'), day('Sa'), day('So')];
}

/** Neuer Plan aus der Vorlage (R-5.2-01, R-4.9-18, R-4.9-19; Standardwerte P-6). */
export function createPlanFromTemplate(template: LevelTemplate, input: CreatePlanInput): Plan {
  const { weekCount, weekLabels } = input;
  if (!Number.isInteger(weekCount) || weekCount < 1) {
    planInputError(
      'weekCount',
      'Die Anzahl Wochen muss eine ganze Zahl ab 1 sein.',
      'Eine Anzahl Wochen ab 1 eingeben.',
    );
  }
  if (weekLabels !== undefined && weekLabels.length !== weekCount) {
    planInputError(
      'weekLabels',
      'Die Anzahl Wochenbezeichnungen stimmt nicht mit der Anzahl Wochen überein.',
      'Für jede Woche genau eine Bezeichnung angeben.',
    );
  }
  const level: unknown = template.level;
  if (level !== 'kp' && level !== 'bat') {
    planInputError(
      'level',
      'Die Vorlage hat keine gültige Stufe (Kp oder Bat).',
      'Eine Vorlage der Stufe Kp oder Bat wählen.',
    );
  }
  weekDates(input.startDate);

  let nextId = 1;
  const id = (prefix: IdPrefix): Id => `${prefix}${nextId++}`;

  const legend: LtgCategory[] = template.legend.map((c) => ({
    id: id('k'),
    name: c.name,
    legendLabel: c.legendLabel,
    color: { r: c.color.r, g: c.color.g, b: c.color.b },
    neutral: c.neutral,
    inLegend: c.inLegend,
  }));
  const categoryByName = new Map<string, Id>();
  for (const c of legend) if (!categoryByName.has(c.name)) categoryByName.set(c.name, c.id);
  const categoryOf = (name: string, field: string): Id => {
    const found = categoryByName.get(name);
    if (found === undefined) {
      return planInputError(
        field,
        `Die Vorlage verweist auf die Kategorie «${name}», die in ihrer Legende fehlt.`,
        'Die Vorlage korrigieren oder eine andere Vorlage wählen.',
      );
    }
    return found;
  };

  // Standard-Kategorie einer Planungsspalte aus der Funktionsliste der Vorlage (F-LAYOUT2 Punkt 15, Entscheid
  // Auftraggeber 19.10.2026 «15: ja»; Beschrieb 4.7; R-4.4-03): Spaltenname = Funktionskürzel, z.B. «Kp Kdt» → Ltg Kp,
  // «Zfhr» → Ltg Zfhr; übrige Spalten ohne Standard.
  const functionCategory = new Map<string, string>();
  for (const f of template.functionList) {
    if (f.categoryName !== null && !functionCategory.has(f.code)) {
      functionCategory.set(f.code, f.categoryName);
    }
  }
  const defaultCategory = (c: TemplateColumnSet['columns'][number]): Id | null => {
    const name = c.kind === 'planning' ? functionCategory.get(c.name.trim()) : undefined;
    // Fehlt die Kategorie in der Legende, meldet das die Funktionsliste weiter unten (gleicher erster Fehler).
    return name === undefined ? null : (categoryByName.get(name) ?? null);
  };

  const columnSets: ColumnSet[] = template.columnSets.map((s, i) => {
    const set: ColumnSet = {
      id: id('s'),
      name: s.name,
      columns: s.columns.map(
        (c): Column => ({
          id: id('c'),
          name: c.name,
          kind: c.kind,
          weight: c.weight,
          labelOrientation: c.labelOrientation,
          defaultCategoryId: defaultCategory(c),
          origin: c.origin,
        }),
      ),
    };
    const first = validateColumnSet(set)[0];
    if (first !== undefined) {
      throw modelError(
        'invalidColumnSet',
        { field: `columnSets[${i}]` },
        {
          cause: `Der Spaltensatz «${s.name}» der Vorlage ist ungültig: ${first.message.cause}`,
          nextStep: first.message.nextStep,
        },
      );
    }
    return set;
  });

  const weeks: Week[] = Array.from({ length: weekCount }, (_, i) => ({
    id: id('w'),
    label: weekLabels?.[i] ?? (i === 0 ? 'KVK' : `Woche ${i}`),
    shortName: i === 0 ? 'KVK' : `Wo${i}`,
    startDate: addDays(input.startDate, 7 * i),
    days: newDays(),
    weekGoals: [],
    heightenedReadiness: '',
    sunOverride: { sunrise: null, sunset: null },
    agendaWeekend: 'auto',
    hiddenRemarkIds: [],
  }));

  const functionList: FunctionEntry[] = template.functionList.map((f, i) => ({
    code: f.code,
    categoryId: f.categoryName === null ? null : categoryOf(f.categoryName, `functionList[${i}]`),
    singleFunction: f.singleFunction,
  }));
  const rapportCodes: RapportCode[] = template.rapportCodes.map((r, i) => ({
    code: r.code,
    categoryId: categoryOf(r.categoryName, `rapportCodes[${i}]`),
  }));

  return {
    schemaVersion: 1,
    id: input.planId,
    level: template.level,
    templateId: template.id,
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
    functionList,
    legend,
    rapportCodes,
    abbreviationsSelected: [],
    markerLabels: template.markerLabels.map((m) => ({ kind: m.kind, withTime: m.withTime })),
    columnSets,
    weeks,
    deletedWeeks: [],
    entries: {},
    displayRange: { from: 240, to: 1440 },
    stand: null,
    nextSeq: 1,
    nextId,
    lastUsedCategoryId: null,
    printDefaults: { printTn: false, printTenue: false },
    acknowledgedFindings: [],
  };
}

/** Eingabe der Factories; Standard: status 'confirmed' (R-4.6-32), internalNote ''. */
export type EntryInput<T extends Entry> = Omit<
  T,
  'id' | 'type' | 'createdSeq' | 'changed' | 'removedText' | 'status' | 'internalNote'
> &
  Partial<Pick<T, 'status' | 'internalNote'>>;

/** Gemeinsame Felder eines neuen Eintrags (P-9). */
function base<T extends Entry>(p: EntryInput<T>, id: Id, seq: number) {
  return {
    id,
    createdSeq: seq,
    changed: false,
    removedText: [] as readonly string[],
    status: p.status ?? 'confirmed',
    internalNote: p.internalNote ?? '',
  } as const;
}

/** Prüft den neuen Eintrag (P-9) und wirft den ersten Befund in Feldreihenfolge als ModelError. */
function checked<T extends Entry>(entry: T): T {
  const first = checkEntryStructure(entry)[0];
  if (first !== undefined) {
    const code = first.code === 'besoWithoutWindow' ? 'besoWithoutWindow' : 'invalidEntry';
    throw modelError(code, { field: first.field }, first.message);
  }
  return entry;
}

export function newBlock(p: EntryInput<Block>, id: Id, seq: number): Block {
  return checked<Block>({ ...p, ...base(p, id, seq), type: 'block' });
}

export function newQuerbalken(p: EntryInput<Querbalken>, id: Id, seq: number): Querbalken {
  return checked<Querbalken>({ ...p, ...base(p, id, seq), type: 'querbalken' });
}

export function newMarker(p: EntryInput<Marker>, id: Id, seq: number): Marker {
  return checked<Marker>({ ...p, ...base(p, id, seq), type: 'marker' });
}

export function newRapport(p: EntryInput<Rapport>, id: Id, seq: number): Rapport {
  return checked<Rapport>({ ...p, ...base(p, id, seq), type: 'rapport' });
}

export function newBeso(p: EntryInput<Beso>, id: Id, seq: number): Beso {
  return checked<Beso>({ ...p, ...base(p, id, seq), type: 'beso' });
}

export function newDayRemark(p: EntryInput<DayRemark>, id: Id, seq: number): DayRemark {
  return checked<DayRemark>({ ...p, ...base(p, id, seq), type: 'dayRemark' });
}

export function newMultiDayRemark(
  p: EntryInput<MultiDayRemark>,
  id: Id,
  seq: number,
): MultiDayRemark {
  return checked<MultiDayRemark>({ ...p, ...base(p, id, seq), type: 'multiDayRemark' });
}

// Strenge Prüfung und kanonische Schlüsselreihenfolge von Plan-Datei und gespeicherten Dokumenten (Pakete E1-04
// und E1-04b, Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte D2, D3, E2 bis E6,
// Nachtrag Test-Engineer F1, Orchestrator-Zeilen TR-E104-14; CR-E103-07; Änderungsnotiz Runde 2 R2-1, R2-3).
// Kurzbezeichner nach der Schreibweise E3: s = S, s1 = S1, id = ID, b = B, n0 = N0, n1 = N1, d = D, t = T,
// iso = ISO, base64 = Base64 nach D2 (isBase64, lineare Zeichenschleife, R2-1). Unbekannte Schlüssel nur über
// Set und Object.hasOwn, nie mit `in` (E2, Spike S-3). Anforderungen: R-5.6-17, R-H-33, R-L-12, R-L-14.
import { isIsoDate, isMonday } from '../../model/wap/calendar';
import { isMilTime, isValidTimeSpec } from '../../model/wap/time';
import type { ColumnSet, Entry, Plan } from '../../model/wap/types';
import {
  checkEntryStructure,
  validateAbbreviationMeanings,
  validateColumnSet,
} from '../../model/wap/validate';

export class SchemaError extends Error {
  constructor(readonly path: string) {
    super('Ungültige Angabe in der Plan-Datei.');
  }
}

type Fields = Record<string, unknown>;
type Rule = (value: unknown, path: string) => unknown;
type Shape = Readonly<Record<string, Rule>>;
const fail = (path: string): never => {
  throw new SchemaError(path);
};
const join = (path: string, key: string) => (path === '' ? key : `${path}.${key}`);
export function isObject(v: unknown): v is Fields {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
/** Eigene Schlüssel mit undefined gelten beim Schreiben und Zurückholen rekursiv als fehlend. */
export function withoutUndefined(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutUndefined);
  if (!isObject(v)) return v;
  return Object.fromEntries(
    Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => [k, withoutUndefined(x)]),
  );
}
const predicate =
  (test: (v: unknown) => boolean): Rule =>
  (v, p) =>
    test(v) ? v : fail(p);
const s = predicate((v) => typeof v === 'string');
const s1 = predicate((v) => typeof v === 'string' && v.trim() !== '');
const id = predicate(
  (v) =>
    typeof v === 'string' && v !== '' && !['__proto__', 'constructor', 'prototype'].includes(v),
);
const b = predicate((v) => typeof v === 'boolean');
const n0 = predicate((v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0);
const n1 = predicate((v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1);
const d = predicate(isIsoDate);
const t = predicate(isMilTime);
const choice = (...values: readonly unknown[]): Rule => predicate((v) => values.includes(v));
const nullable =
  (rule: Rule): Rule =>
  (v, p) =>
    v === null ? null : rule(v, p);
const optional =
  (rule: Rule): Rule =>
  (v, p) =>
    v === undefined ? undefined : rule(v, p);
const list =
  (rule: Rule): Rule =>
  (v, p) => {
    if (!Array.isArray(v)) return fail(p);
    return v.map((item, i) => rule(item, `${p}[${i}]`));
  };
const object =
  (shape: Shape, extra?: (v: Fields, p: string, original: Fields) => void): Rule =>
  (v, p) => {
    if (!isObject(v)) return fail(p);
    const allowed = new Set(Object.keys(shape));
    for (const key of Object.keys(v)) if (!allowed.has(key)) fail(join(p, key));
    const out: Fields = {};
    for (const [key, rule] of Object.entries(shape)) {
      const value = rule(Object.hasOwn(v, key) ? v[key] : undefined, join(p, key));
      if (value !== undefined) out[key] = value;
    }
    extra?.(out, p, v);
    return out;
  };
const union =
  (key: string, variants: Readonly<Record<string, Rule>>): Rule =>
  (v, p) => {
    if (!isObject(v)) return fail(p);
    const kind = v[key];
    if (typeof kind !== 'string' || !Object.hasOwn(variants, kind)) return fail(join(p, key));
    const rule = variants[kind];
    if (rule === undefined) return fail(join(p, key));
    return rule(v, p);
  };

export function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))
    return false;
  const date = new Date(v);
  return Number.isFinite(date.getTime()) && date.toISOString() === v;
}
const iso = predicate(isIsoTimestamp);
export function isBase64(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length % 4 !== 0) return false;
  let end = v.length;
  if (v.charCodeAt(end - 1) === 61) end--;
  if (v.charCodeAt(end - 1) === 61) end--;
  for (let i = 0; i < end; i++) {
    const code = v.charCodeAt(i);
    if (
      !(
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) ||
        code === 43 ||
        code === 47
      )
    )
      return false;
  }
  return true;
}
const base64 = predicate(isBase64);
const image = nullable(object({ mime: choice('image/png', 'image/jpeg'), dataBase64: s }));
const rgb = object({ r: predicate(byte), g: predicate(byte), b: predicate(byte) });
function byte(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 255;
}
const run = object({ text: s, bold: b, besoRef: optional(id) });
const title = list(run);
const selection = union('kind', {
  all: object({ kind: choice('all') }),
  ids: object({ kind: choice('ids'), ids: list(id) }),
});
const scope = union('kind', {
  plan: object({ kind: choice('plan') }),
  week: object({ kind: choice('week'), weekId: id }),
  range: object({ kind: choice('range'), fromDate: d, toDate: d }),
});
const time =
  (forms: readonly string[]): Rule =>
  (v, p) => {
    const result = union('form', {
      point: object({ form: choice('point'), at: t }),
      range: object({
        form: choice('range'),
        from: t,
        to: predicate((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v % 5 === 0),
      }),
      from: object({ form: choice('from'), from: t }),
      until: object({ form: choice('until'), to: t }),
      deadline: object({ form: choice('deadline'), to: optional(t) }),
    })(v, p) as Fields;
    if (!forms.includes(result.form as string) || !isValidTimeSpec(result)) fail(p);
    return result;
  };
const blockTime = time(['point', 'range', 'from', 'until']);
const markerKind = choice('AV', 'ABV', 'HV', 'custom');
const common: Shape = {
  id,
  status: choice('confirmed', 'open', 'cancelled'),
  changed: b,
  createdSeq: n0,
  internalNote: s,
  removedText: list(s),
};
const entryObject = (kind: string, fields: Shape): Rule =>
  object({ ...common, type: choice(kind), ...fields }, (v, p) => {
    const issue = checkEntryStructure(v as unknown as Entry)[0];
    if (issue !== undefined) fail(join(p, issue.field));
  });
const entry = union('type', {
  block: entryObject('block', {
    date: d,
    time: blockTime,
    columns: selection,
    title,
    supplement: s,
    ltg: s,
    tn: s,
    tpt: s,
    ort: s,
    tenue: s,
    printTn: b,
    printTenue: b,
    categoryId: id,
    secondCategoryId: nullable(id),
    textDirection: choice('auto', 'horizontal', 'vertical'),
    openEnd: b,
    subtasks: optional(list(object({ title, ltg: s, ort: s }))),
  }),
  querbalken: entryObject('querbalken', {
    title,
    fromDate: d,
    toDate: d,
    columns: selection,
    categoryId: nullable(id),
  }),
  marker: entryObject('marker', {
    date: d,
    at: t,
    kind: markerKind,
    customKind: s,
    columns: selection,
    asFlatBlock: b,
    flatBlockMinutes: optional(
      predicate((v) => typeof v === 'number' && Number.isInteger(v) && v >= 5 && v <= 1440),
    ),
  }),
  rapport: entryObject('rapport', {
    date: d,
    code: s,
    time: time(['point', 'range']),
    ort: s,
    tn: s,
    categoryId: id,
    display: choice('rapColumn', 'alsoInColumns', 'onlyInColumns'),
    displayColumns: selection,
  }),
  beso: entryObject('beso', {
    date: d,
    title,
    windows: list(
      object({
        id,
        time: time(['point', 'range', 'from', 'until', 'deadline']),
        columnId: nullable(id),
        supplement: s,
      }),
    ),
    ltg: s,
    tn: s,
    tpt: s,
    ort: s,
    // Leitungskategorie optional (Beschrieb 4.6 Feldtabelle Beso; UX-AB-15): ältere Dateien tragen immer eine.
    categoryId: nullable(id),
    besoNumber: nullable(n0),
    numberFixed: b,
    agendaOverride: nullable(s),
  }),
  dayRemark: entryObject('dayRemark', { date: d, text: s }),
  multiDayRemark: entryObject('multiDayRemark', {
    text: s,
    scope,
    number: nullable(n0),
    refBoxColumnId: nullable(id),
  }),
});
const entries: Rule = (v, p) => {
  if (!isObject(v)) return fail(p);
  const out: Fields = {};
  for (const key of Object.keys(v)) {
    id(key, join(p, key));
    const e = entry(v[key], join(p, key)) as Fields;
    if (e.id !== key) fail(`${join(p, key)}.id`);
    out[key] = e;
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((key) => [key, out[key]]),
  );
};
const meanings: Rule = (v, p) => {
  if (!isObject(v)) return fail(p);
  return Object.fromEntries(
    Object.keys(v)
      .sort()
      .map((key) => [key, v[key]]),
  );
};
const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const week = object(
  {
    id,
    label: s,
    shortName: s,
    startDate: d,
    days: list(
      object({
        weekday: choice(...weekdays),
        columnSetId: nullable(id),
        display: choice('full', 'compact', 'hidden'),
        internalNote: s,
      }),
    ),
    weekGoals: list(object({ id, text: s, group: nullable(s) })),
    heightenedReadiness: s,
    sunOverride: object({ sunrise: nullable(t), sunset: nullable(t) }),
    agendaWeekend: choice('auto', 'separate', 'combined'),
    hiddenRemarkIds: list(id),
  },
  (v, p) => {
    if (!isMonday(v.startDate as string)) fail(join(p, 'startDate'));
    const days = v.days as Fields[];
    if (days.length !== 7) fail(join(p, 'days'));
    days.forEach((day, k) => {
      if (day.weekday !== weekdays[k]) fail(`${p}.days[${k}].weekday`);
    });
  },
);
const columnSet = object(
  {
    id,
    name: s,
    columns: list(
      object({
        id,
        name: s,
        kind: choice('planning', 'secondary', 'rap', 'beso'),
        weight: choice('narrow', 'normal', 'wide'),
        labelOrientation: choice('horizontal', 'vertical'),
        defaultCategoryId: nullable(id),
        origin: choice('manual', 'detachementsplaner'),
      }),
    ),
  },
  (v, p) => {
    const issue = validateColumnSet(v as unknown as ColumnSet)[0];
    if (issue !== undefined) fail(join(p, issue.field));
  },
);
const planRule = object(
  {
    schemaVersion: choice(1),
    id,
    level: choice('kp', 'bat'),
    templateId: s1,
    unit: s,
    parentUnit: s,
    service: s,
    exerciseName: s,
    beilage: s,
    classification: s,
    sunLocation: s,
    commander: object({
      grad: s,
      name: s,
      vorname: s,
      funktion: s,
      nameOrder: choice('gradVornameName', 'gradNameVorname'),
    }),
    signatureImage: image,
    signatureEnabled: b,
    coatOfArms: image,
    motto: s,
    persons: list(object({ id, grad: s, name: s, vorname: s, funktion: s })),
    functionList: list(object({ code: s, categoryId: nullable(id), singleFunction: b })),
    legend: list(object({ id, name: s, legendLabel: s, color: rgb, neutral: b, inLegend: b })),
    rapportCodes: list(object({ code: s, categoryId: id })),
    abbreviationsSelected: list(s),
    abbreviationMeanings: optional(meanings),
    markerLabels: list(object({ kind: markerKind, withTime: b })),
    columnSets: list(columnSet),
    weeks: list(week),
    deletedWeeks: list(object({ week, entries: list(entry) })),
    entries,
    displayRange: object({ from: t, to: t }),
    stand: nullable(object({ date: d, version: n1 })),
    nextSeq: n1,
    nextId: n1,
    lastUsedCategoryId: nullable(id),
    printDefaults: object({ printTn: b, printTenue: b }),
    acknowledgedFindings: list(object({ key: s, reason: s, at: d })),
  },
  (v, p, original) => {
    const range = v.displayRange as { from: number; to: number };
    if (range.from >= range.to) fail(join(p, 'displayRange'));
    const issue = validateAbbreviationMeanings(original as unknown as Plan)[0];
    if (issue !== undefined) fail(join(p, issue.field));
  },
);
export function validatePlan(raw: unknown, path = 'plan'): Plan {
  return planRule(raw, path) as Plan;
}

function unique(items: readonly Fields[], key: string, path: string): void {
  const seen = new Set<unknown>();
  items.forEach((v, i) => {
    if (seen.has(v[key])) fail(`${path}[${i}].${key}`);
    seen.add(v[key]);
  });
}
export function validateFile(
  raw: unknown,
  notes: (plan: Plan) => boolean,
  deriveNotes = false,
): Fields {
  return object(
    {
      format: choice('wap-planer-plan'),
      version: n1,
      planId: id,
      revision: n0,
      modifiedAt: iso,
      savedAt: iso,
      containsInternalNotes: b,
      plan: planRule,
      stands: list(
        object(
          {
            standId: id,
            date: d,
            version: n1,
            standsSameDay: n1,
            plan: planRule,
            pdfs: list(object({ key: id, base64 })),
          },
          (v, p) => {
            const pdfs = v.pdfs as Fields[];
            if (pdfs.length === 0) fail(join(p, 'pdfs'));
            unique(pdfs, 'key', join(p, 'pdfs'));
          },
        ),
      ),
    },
    (v, p) => {
      if (v.planId !== (v.plan as Plan).id) fail(join(p, 'planId'));
      const containsNotes = notes(v.plan as Plan);
      if (deriveNotes) v.containsInternalNotes = containsNotes;
      else if (v.containsInternalNotes !== containsNotes) fail(join(p, 'containsInternalNotes'));
      unique(v.stands as Fields[], 'standId', join(p, 'stands'));
    },
  )(raw, '') as Fields;
}

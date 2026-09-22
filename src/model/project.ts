import type { Detachment, Person, Project } from './types';

export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;
export function createProject(): Project {
  return {
    v: 5,
    id: newId('project'),
    name: 'Neue Dienstleistung',
    persons: [],
    dets: [],
    assign: {},
    connections: [],
    orderPolicy: { mode: 'unconfirmed', confirmedBy: '', confirmedAt: '' },
    generatedCodes: {},
    service: { start: '', end: '', year: '', note: '' },
    src: { pisa: null, milo: null },
    maps: { fkt: {}, lic: {} },
    settings: { eigeneEinheit: '', puffer: 60, nurMilo: false },
    pisa: { entered: {}, verified: null },
    archive: null,
    migrationNotes: [],
  };
}
export function createDetachment(patch: Partial<Detachment> = {}): Detachment {
  return {
    id: newId('det'),
    name: '',
    ec: '',
    datum: '',
    von: '',
    bis: '',
    bisDatum: '',
    ort: '',
    treffpunkt: '',
    anzug: '',
    entlassungsort: '',
    bem: '',
    soll: '',
    fahrzeug: '',
    zusatzIds: [],
    ...patch,
  };
}
export function assertWritable(project: Project): void {
  if (project.archive)
    throw new Error('Archivstände sind schreibgeschützt. Zuerst eine Arbeitskopie öffnen.');
}
const invalid = (): never => {
  throw new Error('Die Datei enthält kein gültiges Projekt. Der bisherige Stand bleibt erhalten.');
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function optionalRecord(value: unknown): Record<string, unknown> {
  return value == null ? {} : record(value);
}
function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    return invalid();
  return String(value);
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return invalid();
  return [...new Set(value as string[])];
}
function dictionary(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(optionalRecord(value)).map(([key, item]) => [key, text(item)]),
  );
}
function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    ['__proto__', 'constructor', 'prototype'].includes(value)
  ) {
    throw new Error('Personen, Gruppen oder Verbindungen haben fehlende oder ungültige IDs.');
  }
  return value;
}
function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    throw new Error('Personen, Gruppen oder Verbindungen haben doppelte IDs.');
  return values;
}
function person(input: unknown): Person {
  const p = record(input),
    planning = optionalRecord(p.planning);
  const status =
    planning.status === 'included' || planning.status === 'excluded'
      ? planning.status
      : 'unreviewed';
  return {
    ...p,
    id: identifier(p.id),
    name: text(p.name),
    grad: text(p.grad),
    funktion: text(p.funktion),
    lics: p.lics == null ? [] : strings(p.lics),
    raw: dictionary(p.raw),
    ...(p.rawSources == null
      ? {}
      : {
          rawSources: Object.fromEntries(
            Object.entries(record(p.rawSources)).map(([key, value]) => [key, dictionary(value)]),
          ),
        }),
    planning: { ...planning, status, reason: text(planning.reason) },
    ...Object.fromEntries(
      [
        'key',
        'pnr',
        'dt',
        'einteilung',
        'zug',
        'tel',
        'mail',
        'vorname',
        'nachname',
        'wohnort',
        'identityReview',
      ]
        .filter((key) => p[key] != null)
        .map((key) => [key, text(p[key])]),
    ),
  };
}
function detachment(input: unknown): Detachment {
  const d = record(input);
  const normalized = createDetachment({
    ...d,
    id: identifier(d.id),
    zusatzIds: d.zusatzIds == null ? [] : strings(d.zusatzIds),
  });
  for (const key of [
    'name',
    'ec',
    'datum',
    'von',
    'bis',
    'bisDatum',
    'ort',
    'treffpunkt',
    'anzug',
    'entlassungsort',
    'bem',
    'soll',
    'fahrzeug',
  ] as const)
    normalized[key] = text(d[key]);
  if (d.generatedFrom != null) normalized.generatedFrom = text(d.generatedFrom);
  return normalized;
}
function confirmation(input: unknown) {
  const value = record(input);
  return { ...value, signature: text(value.signature), at: text(value.at) };
}
/** Normalize a local JSON boundary without losing unknown legacy fields or repairing ambiguous assignments. */
export function normalizeProject(input: unknown): Project {
  const value = record(structuredClone(input)),
    base = createProject();
  if (!Array.isArray(value.persons) || (value.dets != null && !Array.isArray(value.dets)))
    return invalid();
  if (typeof value.v === 'number' && value.v > 5)
    throw new Error('Diese Projektversion benötigt eine neuere Anwendung.');
  const service = optionalRecord(value.service),
    settings = optionalRecord(value.settings),
    src = optionalRecord(value.src),
    pisa = optionalRecord(value.pisa),
    policy = optionalRecord(value.orderPolicy);
  const dets = unique(((value.dets ?? []) as unknown[]).map(detachment));
  const assign = Object.fromEntries(
    Object.entries(optionalRecord(value.assign)).map(([key, ids]) => [
      identifier(key),
      strings(ids),
    ]),
  );
  for (const det of dets) if (!Object.hasOwn(assign, det.id)) assign[det.id] = [];
  if (value.connections != null && !Array.isArray(value.connections)) return invalid();
  const connections = unique(
    ((value.connections ?? []) as unknown[]).map((item) => {
      const connection = record(item);
      return {
        ...connection,
        id: identifier(connection.id),
        from: identifier(connection.from),
        to: identifier(connection.to),
      };
    }),
  );
  const migrationNotes = value.migrationNotes == null ? [] : strings(value.migrationNotes);
  if (dets.some((d) => d.zusatzIds.length) && value.v !== 5)
    migrationNotes.push(
      'Bestehende Haupt-/Zusatz-MB wurden unverändert übernommen. Die bisherigen Zuteilungen bleiben erhalten; neue Planungsverbindungen werden getrennt geführt.',
    );
  const archive = value.archive == null ? null : record(value.archive);
  const normalized: Project = {
    ...base,
    ...value,
    v: 5,
    id: value.id == null ? base.id : identifier(value.id),
    name: text(value.name, base.name),
    persons: unique(value.persons.map(person)),
    dets,
    assign,
    connections,
    orderPolicy: {
      ...policy,
      mode:
        policy.mode === 'separate' || policy.mode === 'continuous' ? policy.mode : 'unconfirmed',
      confirmedBy: text(policy.confirmedBy),
      confirmedAt: text(policy.confirmedAt),
    },
    generatedCodes: dictionary(value.generatedCodes),
    service: {
      ...service,
      start: text(service.start),
      end: text(service.end),
      year: text(service.year),
      note: text(service.note),
    },
    src: { ...src, pisa: null, milo: null },
    maps: {
      ...base.maps,
      ...Object.fromEntries(
        Object.entries(optionalRecord(value.maps)).map(([key, item]) => [key, dictionary(item)]),
      ),
    },
    settings: {
      ...settings,
      eigeneEinheit: text(settings.eigeneEinheit),
      puffer:
        typeof settings.puffer === 'number' && Number.isFinite(settings.puffer)
          ? settings.puffer
          : 60,
      nurMilo: settings.nurMilo === true,
    },
    pisa: {
      ...pisa,
      entered: Object.fromEntries(
        Object.entries(optionalRecord(pisa.entered)).map(([key, item]) => [
          key,
          confirmation(item),
        ]),
      ),
      verified: pisa.verified == null ? null : confirmation(pisa.verified),
    },
    archive: archive?.at
      ? {
          ...archive,
          id: archive.id == null ? newId('archive') : identifier(archive.id),
          at: text(archive.at),
        }
      : null,
    migrationNotes: [...new Set(migrationNotes)],
  };
  for (const source of ['pisa', 'milo'] as const) {
    if (src[source] != null) {
      const sourceValue = record(src[source]);
      normalized.src[source] = {
        ...sourceValue,
        datei: text(sourceValue.datei),
        zeit: text(sourceValue.zeit),
        anz: typeof sourceValue.anz === 'number' ? sourceValue.anz : 0,
      };
    }
  }
  return normalized;
}
export function archiveSnapshot(project: Project): Project {
  const copy = structuredClone(project);
  copy.archive ??= { id: newId('archive'), at: new Date().toISOString() };
  return copy;
}
export function resumeProject(project: Project): Project {
  const copy = structuredClone(project);
  copy.id = newId('project');
  copy.archive = null;
  return copy;
}

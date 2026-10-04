import { directGroupIds, groupPeople } from './planning';
import { assertWritable, newId } from './project';
import type { Detachment, OnsiteEvent, Person, Project, SubDetachment } from './types';

// On-site events («KVK», von–bis) hold their own detachements («Det Mat», «Det VT», …).
// The PISA detachements (planning cards) only filter who takes part. Events are stored
// beside the planning cards and never feed PISA, validation or the PISA signatures, so
// organising the service on site cannot invalidate the handover.

export const DEFAULT_SUBDET_NAMES = ['Det Mat', 'Det VT', 'Det Kp'];
const MAX_NAME = 60;
const MAX_EVENT_NAME = 80;
const MAX_NOTE = 2000;

const cleanName = (value: string): string => value.replace(/\s+/g, ' ').trim();
const nameKey = (value: string): string => cleanName(value).toLocaleLowerCase('de-CH');
const validDate = (value: string): boolean =>
  !value ||
  (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);

// ─── Events ──────────────────────────────────────────────────────────────────────────

/** By start date (undated last), then by name. */
export function onsiteEvents(project: Project): OnsiteEvent[] {
  return [...(project.onsiteEvents ?? [])].sort(
    (a, b) =>
      (a.von || '9999').localeCompare(b.von || '9999') || a.name.localeCompare(b.name, 'de-CH'),
  );
}
function eventOf(project: Project, id: string): OnsiteEvent {
  const event = project.onsiteEvents?.find((item) => item.id === id);
  if (!event) throw new Error('Das Event ist nicht mehr vorhanden.');
  return event;
}
/** Events whose PISA filter contains the planning card. */
export function eventsForDet(project: Project, detId: string): OnsiteEvent[] {
  return onsiteEvents(project).filter((event) => event.detIds.includes(detId));
}

type EventFields = Pick<OnsiteEvent, 'name' | 'von' | 'bis' | 'detIds'>;
function checkedEvent(project: Project, fields: EventFields): EventFields {
  const name = cleanName(fields.name);
  if (!name) throw new Error('Bitte einen Namen für das Event eingeben.');
  if (name.length > MAX_EVENT_NAME)
    throw new Error(`Der Name eines Events hat höchstens ${MAX_EVENT_NAME} Zeichen.`);
  if (!validDate(fields.von) || !validDate(fields.bis))
    throw new Error('Das Datum des Events ist ungültig.');
  if (fields.von && fields.bis && fields.bis < fields.von)
    throw new Error('Das Event endet vor seinem Beginn.');
  const ids = new Set(fields.detIds);
  if ([...ids].some((id) => !project.dets.some((group) => group.id === id)))
    throw new Error('Ein gewähltes Detachement existiert nicht mehr.');
  return {
    name,
    von: fields.von,
    bis: fields.bis,
    // Board order keeps lists and filters stable.
    detIds: project.dets.filter((group) => ids.has(group.id)).map((group) => group.id),
  };
}

export function createEvent(project: Project, fields: EventFields): OnsiteEvent {
  assertWritable(project);
  const event = { id: newId('event'), ...checkedEvent(project, fields) };
  project.onsiteEvents = [...(project.onsiteEvents ?? []), event];
  return event;
}
export function updateEvent(project: Project, id: string, patch: Partial<EventFields>): void {
  assertWritable(project);
  const event = eventOf(project, id);
  Object.assign(event, checkedEvent(project, { ...event, ...patch }));
}
/** Text for the lists of an event; lines starting with «-» are printed as a list. */
export function setEventNote(project: Project, id: string, value: string): void {
  assertWritable(project);
  const event = eventOf(project, id);
  const note = value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  if (note.length > MAX_NOTE) throw new Error(`Der Zusatztext hat höchstens ${MAX_NOTE} Zeichen.`);
  if (note) event.hinweis = note;
  else delete event.hinweis;
}
/** A full copy with its detachements, leaders, tasks and people, e.g. for the next week. */
export function copyEvent(project: Project, id: string): OnsiteEvent {
  assertWritable(project);
  const source = eventOf(project, id);
  const taken = new Set((project.onsiteEvents ?? []).map((event) => nameKey(event.name)));
  const base = `${source.name} (Kopie)`.slice(0, MAX_EVENT_NAME);
  let name = base;
  for (let index = 2; taken.has(nameKey(name)); index++) name = `${base} ${index}`;
  const copy = { ...structuredClone(source), id: newId('event'), name };
  project.onsiteEvents = [...(project.onsiteEvents ?? []), copy];
  project.subDets = [
    ...(project.subDets ?? []),
    ...subDetsOf(project, id).map((sub) => ({
      ...structuredClone(sub),
      id: newId('sub'),
      parentId: copy.id,
    })),
  ];
  return copy;
}
/** Removes an event with its detachements; the planning cards stay unchanged. */
export function removeEvent(project: Project, id: string): void {
  assertWritable(project);
  eventOf(project, id);
  project.onsiteEvents = (project.onsiteEvents ?? []).filter((event) => event.id !== id);
  project.subDets = (project.subDets ?? []).filter((sub) => sub.parentId !== id);
}
/** A removed planning card leaves every event filter; the on-site detachements stay. */
export function removeDetFromOnsite(project: Project, detId: string): void {
  for (const event of project.onsiteEvents ?? [])
    if (event.detIds.includes(detId)) event.detIds = event.detIds.filter((id) => id !== detId);
}

// ─── On-site detachements of an event ────────────────────────────────────────────────

export function subDetsOf(project: Project, parentId: string): SubDetachment[] {
  return (project.subDets ?? []).filter((sub) => sub.parentId === parentId);
}
function subOf(project: Project, id: string): SubDetachment {
  const sub = project.subDets?.find((item) => item.id === id);
  if (!sub) throw new Error('Die Untergruppe ist nicht mehr vorhanden.');
  return sub;
}

/** «Mat, VT; Kp» or one name per line. */
export function parseSubDetNames(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map(cleanName)
    .filter(Boolean);
}

/** Names used in other events first, then the common defaults; never a duplicate. */
export function subDetSuggestions(project: Project, parentId: string): string[] {
  const seen = new Set(subDetsOf(project, parentId).map((sub) => nameKey(sub.name)));
  const result: string[] = [];
  for (const name of [...(project.subDets ?? []).map((sub) => sub.name), ...DEFAULT_SUBDET_NAMES]) {
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleanName(name));
  }
  return result;
}

export function addSubDets(project: Project, parentId: string, names: string[]): SubDetachment[] {
  assertWritable(project);
  eventOf(project, parentId);
  const taken = new Set(subDetsOf(project, parentId).map((sub) => nameKey(sub.name)));
  const created: SubDetachment[] = [];
  for (const raw of names) {
    const name = cleanName(raw);
    if (!name || taken.has(nameKey(name))) continue;
    if (name.length > MAX_NAME)
      throw new Error(`Der Name einer Untergruppe hat höchstens ${MAX_NAME} Zeichen.`);
    taken.add(nameKey(name));
    created.push({ id: newId('sub'), parentId, name, chefId: '', auftrag: '', personIds: [] });
  }
  if (!created.length)
    throw new Error(
      names.some((name) => cleanName(name))
        ? 'Diese Untergruppe besteht bereits.'
        : 'Bitte einen Namen für die Untergruppe eingeben.',
    );
  project.subDets = [...(project.subDets ?? []), ...created];
  return created;
}

export function renameSubDet(project: Project, id: string, value: string): void {
  assertWritable(project);
  const sub = subOf(project, id),
    name = cleanName(value);
  if (!name) throw new Error('Bitte einen Namen für die Untergruppe eingeben.');
  if (name.length > MAX_NAME)
    throw new Error(`Der Name einer Untergruppe hat höchstens ${MAX_NAME} Zeichen.`);
  if (
    subDetsOf(project, sub.parentId).some(
      (other) => other.id !== id && nameKey(other.name) === nameKey(name),
    )
  )
    throw new Error('Diese Untergruppe besteht bereits.');
  sub.name = name;
}

export function setSubDetAuftrag(project: Project, id: string, value: string): void {
  assertWritable(project);
  subOf(project, id).auftrag = value.trim();
}

/** Choosing a leader also moves that person into the sub-group. */
export function setSubDetChef(project: Project, id: string, personId: string): void {
  assertWritable(project);
  const sub = subOf(project, id);
  if (personId) moveToSubDet(project, sub.parentId, id, [personId]);
  sub.chefId = personId;
}

export function removeSubDet(project: Project, id: string): void {
  assertWritable(project);
  subOf(project, id);
  project.subDets = (project.subDets ?? []).filter((sub) => sub.id !== id);
}

/**
 * Moves people between the detachements of one event. `subId` null returns them to
 * «nicht eingeteilt». A person belongs to at most one detachement per event; the PISA
 * filter only narrows the list, so anyone of the service can be placed.
 */
export function moveToSubDet(
  project: Project,
  parentId: string,
  subId: string | null,
  personIds: string[],
): void {
  assertWritable(project);
  eventOf(project, parentId);
  const target = subId ? subOf(project, subId) : undefined;
  if (target && target.parentId !== parentId)
    throw new Error('Die Untergruppe gehört zu einem anderen Event.');
  const selected = new Set(personIds);
  if (target && personIds.some((id) => !project.persons.some((person) => person.id === id)))
    throw new Error('Die Auswahl enthält nicht mehr vorhandene Personen.');
  for (const sub of subDetsOf(project, parentId)) {
    if (sub === target) continue;
    sub.personIds = sub.personIds.filter((id) => !selected.has(id));
    if (selected.has(sub.chefId)) sub.chefId = '';
  }
  if (target)
    target.personIds = [
      ...target.personIds,
      ...[...selected].filter((id) => !target.personIds.includes(id)),
    ];
}

// ─── Ranks ───────────────────────────────────────────────────────────────────────────

/** Swiss Armed Forces grades, lowest first. Unknown values sort after all known grades. */
const RANKS = [
  'rekr',
  'sdt',
  'gfr',
  'obgfr',
  'kpl',
  'wm',
  'obwm',
  'fw',
  'four',
  'hptfw',
  'adjuof',
  'stabsadj',
  'hptadj',
  'chefadj',
  'lt',
  'oblt',
  'hptm',
  'maj',
  'oberstlt',
  'oberst',
  'br',
  'div',
  'kkdt',
];
const RANK_ALIASES: Record<string, string> = {
  rekrut: 'rekr',
  soldat: 'sdt',
  gefreiter: 'gfr',
  obergefreiter: 'obgfr',
  korporal: 'kpl',
  wachtmeister: 'wm',
  oberwachtmeister: 'obwm',
  oberwm: 'obwm',
  feldweibel: 'fw',
  fourier: 'four',
  hauptfeldweibel: 'hptfw',
  adj: 'adjuof',
  adjutantunteroffizier: 'adjuof',
  stabsadjutant: 'stabsadj',
  hauptadjutant: 'hptadj',
  chefadjutant: 'chefadj',
  leutnant: 'lt',
  oberleutnant: 'oblt',
  hauptmann: 'hptm',
  fachof: 'hptm',
  fachoffizier: 'hptm',
  major: 'maj',
  oberstleutnant: 'oberstlt',
  brigadier: 'br',
  divisionar: 'div',
  korpskommandant: 'kkdt',
};
function rankKey(grad: string): string {
  const key = grad
    .toLocaleLowerCase('de-CH')
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
  return RANK_ALIASES[key] ?? key;
}
/** Index in the grade order, -1 when unknown. */
export function rankIndex(grad: string): number {
  return RANKS.indexOf(rankKey(grad));
}
export type RankCategory = 'of' | 'hoehUof' | 'uof' | 'mannschaft' | 'other';
export const RANK_CATEGORY_LABELS: Record<RankCategory, string> = {
  of: 'Of',
  hoehUof: 'Höh Uof',
  uof: 'Uof',
  mannschaft: 'Mannschaft',
  other: 'Ohne Grad',
};
export function rankCategory(grad: string): RankCategory {
  const index = rankIndex(grad);
  if (index < 0) return 'other';
  if (index >= RANKS.indexOf('lt')) return 'of';
  if (index >= RANKS.indexOf('fw')) return 'hoehUof';
  if (index >= RANKS.indexOf('kpl')) return 'uof';
  return 'mannschaft';
}

/** «Nachname Vorname» where both parts are known, otherwise the name as imported. */
export function listName(person: Person): string {
  const first = person.vorname?.trim(),
    last = person.nachname?.trim();
  return first && last ? `${last} ${first}` : person.name;
}
/** Highest grade first, then alphabetically; the usual order of a military list. */
export function sortByRank(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    const ra = rankIndex(a.grad),
      rb = rankIndex(b.grad);
    if (ra !== rb) return rb - ra;
    return listName(a).localeCompare(listName(b), 'de-CH');
  });
}

// ─── Derived view ────────────────────────────────────────────────────────────────────

export interface SubDetGroup {
  sub: SubDetachment;
  /** Leader first, then by grade. */
  people: Person[];
  chef?: Person;
}
export interface OnsiteView {
  event: OnsiteEvent;
  /** PISA detachements of the filter, in board order. */
  dets: Detachment[];
  /** People matching the PISA filter (everyone not excluded without a filter). */
  candidates: Person[];
  /** Candidates plus everyone already placed in the event, by grade. */
  pool: Person[];
  groups: SubDetGroup[];
  /** Candidates not placed yet. */
  unassigned: Person[];
  /** Entries of people who no longer exist in the project. */
  staleIds: string[];
  /** person id → sub-group id */
  placement: Map<string, string>;
  /** person id → PISA detachement the person serves with; filtered cards take precedence. */
  origin: Map<string, Detachment>;
}
export function onsiteView(project: Project, eventId: string): OnsiteView {
  const event = eventOf(project, eventId);
  const dets = project.dets.filter((group) => event.detIds.includes(group.id));
  const members = new Map(
    dets.map((group) => [group.id, new Set(groupPeople(project, group.id).map(({ id }) => id))]),
  );
  const candidates = project.persons.filter((person) =>
    dets.length
      ? dets.some((group) => members.get(group.id)?.has(person.id))
      : person.planning.status !== 'excluded',
  );
  const subs = subDetsOf(project, eventId);
  const exists = new Set(project.persons.map((person) => person.id));
  const placement = new Map<string, string>();
  for (const sub of subs)
    for (const id of sub.personIds)
      if (exists.has(id) && !placement.has(id)) placement.set(id, sub.id);
  const candidateIds = new Set(candidates.map((person) => person.id));
  const pool = sortByRank(
    project.persons.filter((person) => candidateIds.has(person.id) || placement.has(person.id)),
  );
  const origin = new Map<string, Detachment>();
  for (const person of pool) {
    const direct = directGroupIds(project, person.id);
    const group =
      dets.find((item) => direct.includes(item.id)) ??
      dets.find((item) => members.get(item.id)?.has(person.id)) ??
      project.dets.find((item) => direct.includes(item.id));
    if (group) origin.set(person.id, group);
  }
  const groups = subs.map((sub) => {
    const people = pool.filter((person) => placement.get(person.id) === sub.id);
    const chef = people.find((person) => person.id === sub.chefId);
    return {
      sub,
      chef,
      people: chef ? [chef, ...people.filter((person) => person !== chef)] : people,
    };
  });
  return {
    event,
    dets,
    candidates,
    pool,
    groups,
    unassigned: pool.filter((person) => candidateIds.has(person.id) && !placement.has(person.id)),
    staleIds: [...new Set(subs.flatMap((sub) => sub.personIds).filter((id) => !exists.has(id)))],
    placement,
    origin,
  };
}

/** Short note for a planning card: the events whose filter contains it. */
export function onsiteSummary(
  project: Project,
  detId: string,
): { text: string; target: string } | null {
  const events = eventsForDet(project, detId);
  if (!events.length) return null;
  return {
    text: `Vor Ort: ${events.map((event) => event.name).join(' · ')}`,
    target: events[0].id,
  };
}

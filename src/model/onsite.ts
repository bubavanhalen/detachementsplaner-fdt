import { groupPeople } from './planning';
import { assertWritable, newId } from './project';
import type { Detachment, Person, Project, SubDetachment } from './types';

// On-site sub-groups («Det Mat», «Det VT», …) organise a planning card for the service on
// site. They are stored beside the planning cards and never feed PISA, validation or the
// PISA signatures, so splitting a detachement on site cannot invalidate the handover.

export const DEFAULT_SUBDET_NAMES = ['Det Mat', 'Det VT', 'Det Kp'];
const MAX_NAME = 60;

const cleanName = (value: string): string => value.replace(/\s+/g, ' ').trim();
const nameKey = (value: string): string => cleanName(value).toLocaleLowerCase('de-CH');

export function subDetsOf(project: Project, parentId: string): SubDetachment[] {
  return (project.subDets ?? []).filter((sub) => sub.parentId === parentId);
}
function parentOf(project: Project, parentId: string): Detachment {
  const group = project.dets.find((item) => item.id === parentId);
  if (!group) throw new Error('Das gewählte Detachement existiert nicht.');
  return group;
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

/** Names used elsewhere in this service first, then the common defaults; never a duplicate. */
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
  parentOf(project, parentId);
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

/** Removes every sub-group of a planning card, e.g. when the card itself is removed. */
export function removeSubDetsOf(project: Project, parentId: string): void {
  if (!project.subDets?.some((sub) => sub.parentId === parentId)) return;
  project.subDets = project.subDets.filter((sub) => sub.parentId !== parentId);
}

/**
 * Moves people between the sub-groups of one planning card. `subId` null returns them to
 * «nicht eingeteilt». A person belongs to at most one sub-group per planning card.
 */
export function moveToSubDet(
  project: Project,
  parentId: string,
  subId: string | null,
  personIds: string[],
): void {
  assertWritable(project);
  parentOf(project, parentId);
  const target = subId ? subOf(project, subId) : undefined;
  if (target && target.parentId !== parentId)
    throw new Error('Die Untergruppe gehört zu einem anderen Detachement.');
  const selected = new Set(personIds);
  if (target) {
    const pool = new Set(groupPeople(project, parentId).map((person) => person.id));
    if (personIds.some((id) => !pool.has(id)))
      throw new Error('Nur Personen dieses Detachements können eingeteilt werden.');
  }
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
  /** Everyone serving with the planning card, including incoming connections. */
  pool: Person[];
  groups: SubDetGroup[];
  unassigned: Person[];
  /** Sub-group entries of people who are no longer part of the planning card. */
  staleIds: string[];
  /** person id → sub-group id */
  placement: Map<string, string>;
}
export function onsiteView(project: Project, parentId: string): OnsiteView {
  const pool = sortByRank(groupPeople(project, parentId));
  const poolIds = new Set(pool.map((person) => person.id));
  const subs = subDetsOf(project, parentId);
  const placement = new Map<string, string>();
  for (const sub of subs)
    for (const id of sub.personIds)
      if (poolIds.has(id) && !placement.has(id)) placement.set(id, sub.id);
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
    pool,
    groups,
    unassigned: pool.filter((person) => !placement.has(person.id)),
    staleIds: [...new Set(subs.flatMap((sub) => sub.personIds).filter((id) => !poolIds.has(id)))],
    placement,
  };
}

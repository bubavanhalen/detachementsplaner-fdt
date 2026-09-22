import { groupPeople } from './planning';
import type { Detachment, PisaEntry, Project } from './types';

export function validEc(value: string): boolean {
  const allowed = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz£!#$*+-:=?@[]^{}~';
  return [...value].length === 2 && [...value].every((character) => allowed.includes(character));
}
export function generatedEntryId(mainId: string, extraIds: string[], mode: string): string {
  // JSON tuple encoding avoids ambiguous IDs even in historical files with punctuation in identifiers.
  return JSON.stringify([mode, mainId, [...extraIds].sort()]);
}
function entry(
  project: Project,
  group: Detachment,
  personIds: string[],
  extraIds: string[] = group.zusatzIds,
): PisaEntry {
  const additional =
    !personIds.length && project.dets.some((other) => other.zusatzIds.includes(group.id));
  return {
    id: group.id,
    sourceId: group.id,
    name: group.name,
    ec: group.ec,
    details: structuredClone(group),
    extraIds: [...extraIds],
    personIds: [...new Set(personIds)],
    kind: additional ? 'additional' : 'main',
    generated: false,
  };
}
/** This is a pure projection. EC edits are stored by the UI in generatedCodes[entry.id]. */
export function derivePisa(project: Project): PisaEntry[] {
  const mode = project.orderPolicy.mode;
  if (mode === 'unconfirmed' && project.connections.length) {
    return project.dets.map((group) =>
      entry(
        project,
        group,
        groupPeople(project, group.id).map((person) => person.id),
      ),
    );
  }
  const outgoing = new Set(project.connections.map((connection) => connection.from));
  const result: PisaEntry[] = [];
  for (const group of project.dets) {
    if (outgoing.has(group.id)) {
      if (mode === 'separate')
        result.push({ ...entry(project, group, [], []), kind: 'additional' });
      continue;
    }
    const incoming = project.connections.filter((connection) => connection.to === group.id);
    const direct = project.assign[group.id] ?? [];
    if (direct.length || !incoming.length) result.push(entry(project, group, direct));
    const cohorts = new Map<string, { extraIds: string[]; personIds: string[] }>();
    for (const connection of incoming) {
      for (const person of groupPeople(project, connection.from)) {
        const extraIds = incoming
          .filter((other) =>
            groupPeople(project, other.from).some((candidate) => candidate.id === person.id),
          )
          .map((other) => other.from)
          .sort();
        const key = JSON.stringify(extraIds);
        const cohort = cohorts.get(key) ?? { extraIds, personIds: [] };
        if (!cohort.personIds.includes(person.id)) cohort.personIds.push(person.id);
        cohorts.set(key, cohort);
      }
    }
    for (const { extraIds, personIds } of [...cohorts.values()].sort((a, b) =>
      JSON.stringify(a.extraIds).localeCompare(JSON.stringify(b.extraIds)),
    )) {
      const id = generatedEntryId(group.id, extraIds, mode);
      const names = extraIds.map(
        (extraId) =>
          project.dets.find((other) => other.id === extraId)?.name ?? 'Fehlendes Detachement',
      );
      const ec = project.generatedCodes[id] ?? '';
      const details = structuredClone(group);
      if (mode === 'continuous') {
        const first = project.dets
          .filter((other) => extraIds.includes(other.id))
          .sort((a, b) => `${a.datum} ${a.von}`.localeCompare(`${b.datum} ${b.von}`))[0];
        if (first)
          for (const key of ['datum', 'von', 'ort', 'treffpunkt', 'anzug'] as const)
            details[key] = first[key];
      }
      details.ec = ec;
      details.zusatzIds = mode === 'separate' ? [...extraIds] : [];
      result.push({
        id,
        sourceId: group.id,
        name: `${group.name} · ${names.join(' + ')}`,
        ec,
        details,
        extraIds: details.zusatzIds,
        personIds,
        kind: 'main',
        generated: true,
      });
    }
  }
  return result;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function serialize(value: unknown): string {
  return JSON.stringify(canonical(value));
}
export function entrySignature(project: Project, entryValue: PisaEntry): string {
  const linked = new Set([entryValue.sourceId, ...entryValue.extraIds]);
  for (const connection of project.connections)
    if (connection.to === entryValue.sourceId) linked.add(connection.from);
  const people = project.persons
    .filter(
      (person) =>
        entryValue.personIds.includes(person.id) ||
        (linked.has(entryValue.sourceId) &&
          groupPeople(project, entryValue.sourceId).some((member) => member.id === person.id)),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return serialize({
    entry: entryValue,
    policy: project.orderPolicy,
    groups: project.dets
      .filter((group) => linked.has(group.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
    people,
  });
}
export function projectSignature(project: Project): string {
  const { pisa: _pisa, archive: _archive, board: _board, ...content } = project;
  return serialize(content);
}

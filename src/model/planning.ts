import { assertWritable, newId } from './project';
import type { Person, Project } from './types';

export function directGroupIds(project: Project, personId: string): string[] {
  return project.dets
    .filter((group) => project.assign[group.id]?.includes(personId))
    .map((group) => group.id);
}
export function assignPeople(project: Project, groupId: string, personIds: string[]): void {
  assertWritable(project);
  if (!project.dets.some((group) => group.id === groupId))
    throw new Error('Das gewählte Detachement existiert nicht.');
  const selected = new Set(personIds);
  if (personIds.some((id) => !project.persons.some((person) => person.id === id)))
    throw new Error('Die Auswahl enthält nicht mehr vorhandene Personen.');
  for (const key of Object.keys(project.assign))
    project.assign[key] = (project.assign[key] ?? []).filter((id) => !selected.has(id));
  project.assign[groupId] = [...(project.assign[groupId] ?? []), ...selected];
  for (const person of project.persons.filter((person) => selected.has(person.id)))
    person.planning = {
      ...person.planning,
      status: 'included',
      reason: person.planning.status === 'excluded' ? '' : person.planning.reason,
    };
}
export function removePeople(project: Project, groupId: string, personIds: string[]): void {
  assertWritable(project);
  if (!project.dets.some((group) => group.id === groupId))
    throw new Error('Das gewählte Detachement existiert nicht.');
  const selected = new Set(personIds);
  project.assign[groupId] = (project.assign[groupId] ?? []).filter((id) => !selected.has(id));
}
/** Effective membership includes incoming planning connections and legacy explicit Zusatz-MB recipients. */
export function groupPeople(project: Project, groupId: string): Person[] {
  const ids = new Set<string>(),
    visited = new Set<string>();
  function collect(id: string): void {
    if (visited.has(id) || !project.dets.some((group) => group.id === id)) return;
    visited.add(id);
    for (const personId of project.assign[id] ?? []) ids.add(personId);
    for (const connection of project.connections.filter((connection) => connection.to === id))
      collect(connection.from);
    for (const parent of project.dets.filter((group) => group.zusatzIds.includes(id)))
      collect(parent.id);
  }
  collect(groupId);
  return project.persons.filter((person) => ids.has(person.id));
}
export function remainingPeople(project: Project): Person[] {
  return project.persons.filter(
    (person) =>
      person.planning.status !== 'excluded' && directGroupIds(project, person.id).length === 0,
  );
}
export function connectGroups(project: Project, from: string, to: string): void {
  assertWritable(project);
  const source = project.dets.find((group) => group.id === from),
    target = project.dets.find((group) => group.id === to);
  if (!source || !target || from === to)
    throw new Error('Zwei verschiedene vorhandene Detachemente auswählen.');
  if (project.connections.some((connection) => connection.from === from && connection.to === to))
    return;
  if (project.connections.some((connection) => connection.from === from))
    throw new Error(
      'Dieses Detachement ist bereits mit einem nachfolgenden Detachement verbunden.',
    );
  if (project.connections.some((connection) => connection.to === from || connection.from === to))
    throw new Error(
      'Verbindungsketten werden noch nicht unterstützt. Spezialdetachemente direkt mit dem gemeinsamen Folgedetachement verbinden.',
    );
  if (
    source.zusatzIds.length ||
    target.zusatzIds.length ||
    project.dets.some((group) => group.zusatzIds.includes(from) || group.zusatzIds.includes(to))
  )
    throw new Error(
      'Bestehende Haupt-/Zusatz-Verknüpfungen zuerst klären. Alte und neue Verbindungen dürfen nicht gemischt werden.',
    );
  const sourceIds = project.assign[from] ?? [];
  if (sourceIds.some((id) => !project.persons.some((person) => person.id === id)))
    throw new Error(
      'Im Spezialdetachement fehlen Personendatensätze. Die lokalen Zuteilungen zuerst prüfen.',
    );
  if (
    project.persons.some(
      (person) =>
        sourceIds.includes(person.id) &&
        (person.planning.status === 'excluded' ||
          directGroupIds(project, person.id).some((id) => id !== from && id !== to)),
    )
  )
    throw new Error(
      'Ausgeschlossene oder mehrfach zugeteilte Personen im Spezialdetachement zuerst klären.',
    );
  // A legacy overlap with the chosen destination is unambiguous: retain the direct source assignment once.
  project.assign[to] = (project.assign[to] ?? []).filter((id) => !sourceIds.includes(id));
  project.connections.push({ id: newId('connection'), from, to });
}
export function disconnectGroups(project: Project, connectionId: string): void {
  assertWritable(project);
  project.connections = project.connections.filter((connection) => connection.id !== connectionId);
}

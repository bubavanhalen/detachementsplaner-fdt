import type { Project } from './types';

// Every place a project refers to a person by id. A new reference must be added here,
// so merging duplicates or reviewing a removed person never leaves a dangling id.

export interface PersonRef {
  /** Where the reference lives, for the local interface, e.g. «Detachement Wache». */
  ort: string;
}

type Visitor = (id: string, ort: string) => string;

/** Visits each person id; the visitor returns the id to keep (possibly replaced). */
function visit(project: Project, visitor: Visitor): void {
  const names = new Map(project.dets.map((det) => [det.id, det.name || 'Detachement']));
  for (const [detId, ids] of Object.entries(project.assign))
    project.assign[detId] = unique(ids.map((id) => visitor(id, names.get(detId) ?? 'Zuteilung')));
  for (const sub of project.subDets ?? []) {
    sub.personIds = unique(sub.personIds.map((id) => visitor(id, `Vor Ort ${sub.name}`)));
    if (sub.chefId) sub.chefId = visitor(sub.chefId, `Chef ${sub.name}`);
  }
  if (project.tb) {
    project.tb.offiziere = unique(project.tb.offiziere.map((id) => visitor(id, 'Tagesoffiziere')));
    project.tb.offiziereEntfernt = unique(
      project.tb.offiziereEntfernt.map((id) => visitor(id, 'Tagesoffiziere entfernt')),
    );
    for (const week of Object.values(project.tb.wochen))
      for (const officer of Object.values(week.officers))
        if (officer?.personId)
          officer.personId = visitor(officer.personId, `Tagesbefehl ${week.sheet}`);
  }
  for (const entry of project.stamm.kader)
    if (entry.personId) entry.personId = visitor(entry.personId, 'Kader');
  for (const absence of project.milo?.absences ?? [])
    absence.personId = visitor(absence.personId, 'Urlaub (MILO)');
  for (const command of project.milo?.commands ?? [])
    command.personId = visitor(command.personId, 'Kommandierung (MILO)');
  // Pendenzen are owned by another workstream; any list of items with personIds is covered.
  const pendenzen = (project as { pendenzen?: unknown }).pendenzen;
  if (Array.isArray(pendenzen))
    for (const item of pendenzen)
      if (
        item &&
        typeof item === 'object' &&
        Array.isArray((item as { personIds?: unknown }).personIds)
      ) {
        const holder = item as {
          personIds: unknown[];
          vorschlag?: { felder?: { personIds?: unknown } };
        };
        holder.personIds = unique(
          holder.personIds.map((id) => (typeof id === 'string' ? visitor(id, 'Pendenz') : id)),
        );
        // A pending proposal may name people too.
        const proposal = holder.vorschlag?.felder;
        if (proposal && Array.isArray(proposal.personIds))
          proposal.personIds = unique(
            proposal.personIds.map((id) =>
              typeof id === 'string' ? visitor(id, 'Pendenz (Vorschlag)') : id,
            ),
          );
      }
}
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** All places that refer to the person; read only. */
export function personRefs(project: Project, personId: string): PersonRef[] {
  const refs: PersonRef[] = [];
  visit(structuredClone(project), (id, ort) => {
    if (id === personId) refs.push({ ort });
    return id;
  });
  return refs;
}

/** Points every reference to `from` at `to` (e.g. after merging a duplicate). Pure on the draft. */
export function replacePersonId(project: Project, from: string, to: string): number {
  if (!from || !to || from === to) return 0;
  let count = 0;
  visit(project, (id) => {
    if (id !== from) return id;
    count++;
    return to;
  });
  return count;
}

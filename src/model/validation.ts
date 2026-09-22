import { derivePisa, validEc } from './pisa';
import { directGroupIds, groupPeople } from './planning';
import type { Project, ValidationIssue } from './types';

const canonicalNumber = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const dateValid = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function validateProject(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (
    code: string,
    message: string,
    context: Pick<ValidationIssue, 'personId' | 'groupId' | 'entryId'> = {},
  ) => issues.push({ code, message, ...context });
  const groupedIds = new Set(project.dets.map((group) => group.id));
  const personIds = new Set(project.persons.map((person) => person.id));
  if (!project.persons.length) add('no-people', 'Noch keine Personen importiert.');
  if (!project.dets.length) add('no-groups', 'Noch keine Detachemente erstellt.');
  if (project.connections.length || project.dets.some((group) => group.zusatzIds.length)) {
    if (
      project.orderPolicy.mode === 'unconfirmed' ||
      !project.orderPolicy.confirmedBy.trim() ||
      !project.orderPolicy.confirmedAt.trim()
    )
      add(
        'policy-unconfirmed',
        'Aufgebotsart noch bestätigen: KVK/WK-Auslegung mit KF klären und die Bestätigung erfassen.',
      );
  }
  for (const person of project.persons) {
    const context = { personId: person.id },
      direct = directGroupIds(project, person.id);
    if (person.planning.status === 'unreviewed')
      add('participation-unreviewed', 'Teilnahme noch klären.', context);
    if (person.planning.status === 'included' && !direct.length)
      add('person-unassigned', 'Noch keinem Detachement zugeteilt.', context);
    if (direct.length > 1)
      add(
        'multiple-assignments',
        'Mehrere direkte Zuteilungen aus dem bisherigen Plan. Ein Detachement auswählen.',
        context,
      );
    if (person.planning.status === 'excluded' && direct.length)
      add('excluded-assigned', 'Trotz Ausschluss einem Detachement zugeteilt.', context);
    if (person.planning.status === 'excluded' && !person.planning.reason.trim())
      add('excluded-reason', 'Die Begründung für den Ausschluss fehlt.', context);
    if (person.identityReview)
      add('identity-review', 'Identität beim Quellenabgleich überprüfen.', context);
    const number = canonicalNumber(person.pnr ?? '');
    if (
      number &&
      project.persons.some(
        (other) => other.id !== person.id && canonicalNumber(other.pnr ?? '') === number,
      )
    )
      add(
        'duplicate-number',
        'Die Versicherten-Nr. ist mehrfach vorhanden. Quelldaten prüfen.',
        context,
      );
  }
  for (const [groupId, members] of Object.entries(project.assign)) {
    if (!groupedIds.has(groupId) && members.length)
      add(
        'missing-assignment-group',
        'Personenzuteilungen verweisen auf ein fehlendes Detachement.',
        { groupId },
      );
    for (const personId of members)
      if (!personIds.has(personId))
        add('missing-person', 'Eine zugeteilte Person fehlt im Personenbestand.', {
          groupId,
          personId,
        });
  }
  for (const group of project.dets) {
    const context = { groupId: group.id };
    if (!groupPeople(project, group.id).length)
      add('empty-group', 'Das Detachement hat keine Personen.', context);
    if (group.zusatzIds.length > 5)
      add('too-many-extras', 'Höchstens fünf Zusatz-MB pro Hauptmarschbefehl.', context);
    if (
      group.zusatzIds.some(
        (id) =>
          id === group.id ||
          !groupedIds.has(id) ||
          project.dets.find((other) => other.id === id)?.zusatzIds.length,
      )
    )
      add(
        'invalid-legacy-link',
        'Zusatz-MB müssen vorhandene andere Detachemente ohne eigene Zusätze sein.',
        context,
      );
    if (
      project.dets.some((other) => other.zusatzIds.includes(group.id)) &&
      (project.assign[group.id]?.length ?? 0) > 0
    )
      add(
        'additional-has-direct-people',
        'Ein reiner Zusatz-MB darf keine direkt zugeteilten Personen haben. Bestehende Zuteilungen zuerst klären.',
        context,
      );
  }
  for (const connection of project.connections) {
    const context = { groupId: connection.from };
    if (
      connection.from === connection.to ||
      !groupedIds.has(connection.from) ||
      !groupedIds.has(connection.to)
    )
      add(
        'invalid-connection',
        'Die Verbindung braucht zwei verschiedene vorhandene Detachemente.',
        context,
      );
    if (
      project.connections.some(
        (other) => other.id !== connection.id && other.from === connection.from,
      )
    )
      add(
        'multiple-destinations',
        'Ein Detachement darf nur ein nachfolgendes Detachement haben.',
        context,
      );
    if (
      project.connections.some(
        (other) => other.to === connection.from || other.from === connection.to,
      )
    )
      add(
        'connection-chain',
        'Verbindungsketten werden noch nicht unterstützt. Direkt mit dem gemeinsamen Folgedetachement verbinden.',
        context,
      );
    if (
      project.dets.some(
        (group) =>
          ([connection.from, connection.to].includes(group.id) && group.zusatzIds.length) ||
          group.zusatzIds.includes(connection.from) ||
          group.zusatzIds.includes(connection.to),
      )
    )
      add(
        'mixed-legacy-connection',
        'Alte Haupt-/Zusatz-Verknüpfungen und neue Planungsverbindungen zuerst getrennt klären.',
        context,
      );
    const from = project.dets.find((group) => group.id === connection.from),
      to = project.dets.find((group) => group.id === connection.to);
    if (from?.datum && to?.datum && from.datum > to.datum)
      add(
        'connection-order',
        'Das Spezialdetachement beginnt nach seinem Folgedetachement.',
        context,
      );
    if (from?.bisDatum && to?.datum && from.bisDatum >= to.datum)
      add(
        'connection-overlap',
        'Die Dienstperioden überschneiden sich oder berühren denselben Tag. Daten und Zeiten mit KF prüfen.',
        context,
      );
  }
  const entries = derivePisa(project);
  for (const entry of entries) {
    const context = { groupId: entry.sourceId, entryId: entry.id },
      details = entry.details;
    if (!validEc(entry.ec))
      add(
        'invalid-ec',
        `${entry.name || 'Detachement'}: Einrückcode mit genau zwei zulässigen Zeichen ergänzen.`,
        context,
      );
    if (
      entry.ec &&
      entries.some(
        (other) => other.id !== entry.id && other.ec.toUpperCase() === entry.ec.toUpperCase(),
      )
    )
      add('duplicate-ec', 'Der Einrückcode ist mehrfach vergeben.', context);
    if (entry.extraIds.length > 5)
      add('too-many-extras', 'Höchstens fünf Zusatz-MB pro Hauptmarschbefehl.', context);
    for (const [key, label] of [
      ['datum', 'Einrückdatum'],
      ['von', 'Einrückzeit'],
      ['ort', 'Einrückort'],
      ['treffpunkt', 'Treffpunkt'],
      ['anzug', 'Anzug'],
      ['bisDatum', 'Entlassungsdatum'],
      ['entlassungsort', 'Entlassungsort'],
    ] as const) {
      if (!details[key].trim())
        add('missing-details', `${entry.name || 'Detachement'}: ${label} fehlt.`, context);
    }
    if (
      (details.datum && !dateValid(details.datum)) ||
      (details.bisDatum && !dateValid(details.bisDatum))
    )
      add('invalid-date', 'Einrück- oder Entlassungsdatum ist ungültig.', context);
    if (details.datum && details.bisDatum && details.bisDatum < details.datum)
      add('reversed-period', 'Entlassung liegt vor dem Einrücken.', context);
    if (details.von && !/^([01]\d|2[0-3]):[0-5]\d$/.test(details.von))
      add('invalid-time', 'Die Einrückzeit ist ungültig.', context);
    if ([...details.bem].length > 240)
      add('remark-too-long', 'Bemerkung MB hat mehr als 240 Zeichen.', context);
  }
  return issues;
}

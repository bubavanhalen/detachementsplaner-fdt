import { derivePisa, validEc } from './pisa';
import { directGroupIds, groupPeople } from './planning';
import { assertWritable } from './project';
import type { PisaEntry, Project, ValidationIssue } from './types';
import { validateProject } from './validation';

export interface BoardPosition {
  x: number;
  y: number;
}
export interface BoardIssue extends ValidationIssue {
  severity: 'conflict' | 'incomplete';
  action: 'details' | 'people' | 'connections' | 'pisa';
  entryId?: string;
  correctionGroupId?: string;
}

function position(value: unknown): value is BoardPosition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as BoardPosition;
  return [candidate.x, candidate.y].every(
    (coordinate) =>
      typeof coordinate === 'number' &&
      Number.isFinite(coordinate) &&
      Math.abs(coordinate) <= 100_000,
  );
}

/** Old projects receive a deterministic arrangement; a saved position always takes precedence. */
export function getBoardPositions(project: Project): Record<string, BoardPosition> {
  const ids = new Set(project.dets.map((group) => group.id));
  const depths = new Map<string, number>();
  function depth(id: string, ancestors = new Set<string>()): number {
    if (ancestors.has(id)) return 0;
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    const incoming = project.connections.filter(
      (connection) => connection.to === id && ids.has(connection.from),
    );
    const next = new Set(ancestors).add(id);
    const result = incoming.length
      ? Math.max(...incoming.map((connection) => depth(connection.from, next) + 1))
      : 0;
    depths.set(id, result);
    return result;
  }
  const rows = new Map<number, number>();
  const saved = project.board?.positions;
  return Object.fromEntries(
    project.dets.map((group) => {
      const column = depth(group.id);
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      const value = saved && Object.hasOwn(saved, group.id) ? saved[group.id] : undefined;
      return [
        group.id,
        position(value) ? { x: value.x, y: value.y } : { x: 48 + column * 440, y: 48 + row * 470 },
      ];
    }),
  );
}

/** Save only finite coordinates for current groups. Invalid updates cannot destroy saved layout. */
export function saveBoardPositions(
  project: Project,
  positions: Record<string, BoardPosition>,
): void {
  assertWritable(project);
  const current = getBoardPositions(project);
  project.board = {
    positions: Object.fromEntries(
      project.dets.map(({ id }) => {
        const next = Object.hasOwn(positions, id) ? positions[id] : undefined;
        return [id, position(next) ? { x: next.x, y: next.y } : current[id]];
      }),
    ),
  };
}

const incompleteCodes = new Set([
  'no-people',
  'no-groups',
  'policy-unconfirmed',
  'participation-unreviewed',
  'person-unassigned',
  'excluded-reason',
  'empty-group',
  'missing-details',
]);
const connectionCodes = new Set([
  'invalid-connection',
  'multiple-destinations',
  'connection-chain',
  'mixed-legacy-connection',
  'connection-order',
  'connection-overlap',
  'invalid-legacy-link',
  'too-many-extras',
]);

const detailLabels = {
  datum: 'Einrückdatum',
  von: 'Einrückzeit',
  ort: 'Einrückort',
  treffpunkt: 'Treffpunkt',
  anzug: 'Anzug',
  bisDatum: 'Entlassungsdatum',
  entlassungsort: 'Entlassungsort',
};
/** Provenance only: the entry's initial details can originate in an earlier planning card. */
function firstGroup(project: Project, entry: PisaEntry): string {
  if (!entry.generated || project.orderPolicy.mode !== 'continuous') return entry.sourceId;
  const sources = new Set(
    project.connections
      .filter(
        (connection) =>
          connection.to === entry.sourceId &&
          groupPeople(project, connection.from).some((person) =>
            entry.personIds.includes(person.id),
          ),
      )
      .map((connection) => connection.from),
  );
  return (
    project.dets
      .filter((group) => sources.has(group.id))
      .sort((a, b) => `${a.datum} ${a.von}`.localeCompare(`${b.datum} ${b.von}`))[0]?.id ??
    entry.sourceId
  );
}

/** Attach existing validator results to their correction surfaces; no domain rules live here. */
export function boardIssues(project: Project): {
  byGroup: Record<string, BoardIssue[]>;
  global: BoardIssue[];
} {
  const entries = derivePisa(project);
  const groups = new Map<string, BoardIssue[]>(project.dets.map(({ id }) => [id, []]));
  const global: BoardIssue[] = [];
  const add = (target: BoardIssue[], issue: BoardIssue) => {
    if (
      !target.some(
        (existing) =>
          existing.code === issue.code &&
          existing.message === issue.message &&
          existing.personId === issue.personId &&
          existing.entryId === issue.entryId,
      )
    )
      target.push(issue);
  };
  for (const issue of validateProject(project)) {
    const sourceEntries = entries.filter((entry) => entry.sourceId === issue.groupId);
    let relatedEntry = entries.find((entry) => entry.id === issue.entryId);
    if (!relatedEntry && issue.code === 'invalid-ec')
      relatedEntry = sourceEntries.find(
        (entry) =>
          !validEc(entry.ec) &&
          issue.message ===
            `${entry.name || 'Detachement'}: Einrückcode mit genau zwei zulässigen Zeichen ergänzen.`,
      );
    else if (!relatedEntry && issue.code === 'missing-details')
      relatedEntry = sourceEntries.find((entry) =>
        issue.message.startsWith(`${entry.name || 'Detachement'}: `),
      );
    const entryCode = ['invalid-ec', 'duplicate-ec'].includes(issue.code);
    const startGroup = relatedEntry ? firstGroup(project, relatedEntry) : undefined;
    const missingField = Object.entries(detailLabels).find(([, label]) =>
      issue.message.endsWith(`: ${label} fehlt.`),
    )?.[0];
    const startIssue =
      issue.code === 'invalid-time' ||
      (missingField && ['datum', 'von', 'ort', 'treffpunkt', 'anzug'].includes(missingField));
    const correctionGroupId =
      relatedEntry && !entryCode ? (startIssue ? startGroup : relatedEntry.sourceId) : undefined;
    const sharedDateIssue =
      relatedEntry &&
      startGroup !== relatedEntry.sourceId &&
      ['invalid-date', 'reversed-period'].includes(issue.code);
    const boardIssue: BoardIssue = {
      ...issue,
      severity:
        incompleteCodes.has(issue.code) ||
        (issue.code === 'invalid-ec' && relatedEntry && !relatedEntry.ec.trim())
          ? 'incomplete'
          : 'conflict',
      action:
        (relatedEntry?.generated && entryCode) || issue.code === 'policy-unconfirmed'
          ? 'pisa'
          : sharedDateIssue
            ? 'connections'
            : issue.personId ||
                ['no-people', 'empty-group', 'additional-has-direct-people'].includes(issue.code)
              ? 'people'
              : connectionCodes.has(issue.code)
                ? 'connections'
                : 'details',
      ...(relatedEntry ? { entryId: relatedEntry.id } : {}),
      ...(correctionGroupId ? { correctionGroupId } : {}),
    };
    const targets = new Set<string>();
    if (issue.groupId && groups.has(issue.groupId)) targets.add(issue.groupId);
    if (correctionGroupId && groups.has(correctionGroupId)) targets.add(correctionGroupId);
    // Date/period conflicts can involve either the initial or final card of a continuous MB.
    if (
      relatedEntry &&
      ['invalid-date', 'reversed-period'].includes(issue.code) &&
      startGroup &&
      groups.has(startGroup)
    )
      targets.add(startGroup);
    if (issue.personId) for (const id of directGroupIds(project, issue.personId)) targets.add(id);
    if (issue.groupId && connectionCodes.has(issue.code)) {
      for (const connection of project.connections)
        if (connection.from === issue.groupId || connection.to === issue.groupId) {
          if (groups.has(connection.from)) targets.add(connection.from);
          if (groups.has(connection.to)) targets.add(connection.to);
        }
      const group = project.dets.find(({ id }) => id === issue.groupId);
      for (const id of group?.zusatzIds ?? []) if (groups.has(id)) targets.add(id);
    }
    if (!targets.size) add(global, boardIssue);
    for (const id of targets) {
      const target = groups.get(id);
      if (target) add(target, { ...boardIssue, groupId: id });
    }
  }
  return { byGroup: Object.fromEntries(groups), global };
}

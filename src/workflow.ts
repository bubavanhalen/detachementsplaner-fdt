import { useMemo } from 'react';
import { derivePisa, entrySignature, projectSignature, remainingPeople } from './model';
import { boardIssues } from './model/board';
import type { Project } from './model/types';
import { useProject } from './store';

export type StepState = 'todo' | 'active' | 'attention' | 'done';
export interface Step {
  to: '/sources' | '/' | '/pisa' | '/finish';
  number: number;
  label: string;
  title: string;
  description: string;
  state: StepState;
  status: string;
}

export function policyRequired(project: Project): boolean {
  return project.connections.length > 0;
}
export function policyConfirmed(project: Project): boolean {
  return (
    !policyRequired(project) ||
    (project.orderPolicy.mode !== 'unconfirmed' &&
      Boolean(project.orderPolicy.confirmedBy && project.orderPolicy.confirmedAt))
  );
}

/** Derives the guided workflow from the local project only; nothing is stored. */
export function workflowSteps(project: Project): Step[] {
  const people = project.persons.length;
  const free = remainingPeople(project).length;
  const issues = boardIssues(project);
  const conflicts = new Set(
    [...Object.values(issues.byGroup).flat(), ...issues.global]
      .filter((issue) => issue.severity === 'conflict')
      .map((issue) => `${issue.code}:${issue.personId ?? ''}:${issue.groupId ?? ''}`),
  ).size;
  const entries = derivePisa(project);
  const checked = entries.filter(
    (entry) => project.pisa.entered[entry.id]?.signature === entrySignature(project, entry),
  ).length;
  const verified = project.pisa.verified?.signature === projectSignature(project);
  const sources = (['pisa', 'milo'] as const)
    .filter((key) => project.src[key])
    .map((key) => (key === 'pisa' ? 'PISA' : 'MILO'));
  return [
    {
      to: '/sources',
      number: 1,
      label: 'Personen laden',
      title: 'Personen laden',
      description: 'PISA- oder MILOFFICE-Liste lokal einlesen',
      state: people ? 'done' : 'active',
      status: people
        ? `${people} Personen${sources.length ? ` · ${sources.join(' + ')}` : ''}`
        : 'Noch keine Liste',
    },
    {
      to: '/',
      number: 2,
      label: 'Planen',
      title: 'Detachemente planen',
      description: 'Gruppen bilden, Personen zuteilen, Dienstablauf verbinden',
      state: conflicts
        ? 'attention'
        : project.dets.length && people && !free
          ? 'done'
          : people
            ? 'active'
            : 'todo',
      status: conflicts
        ? `${conflicts} ${conflicts === 1 ? 'Konflikt' : 'Konflikte'}`
        : !project.dets.length
          ? 'Noch keine Gruppen'
          : free
            ? `${free} noch frei`
            : `${project.dets.length} Gruppen · alle verteilt`,
    },
    {
      to: '/pisa',
      number: 3,
      label: 'In PISA übertragen',
      title: 'In PISA übertragen',
      description: 'Einträge nach PAT-Feldfolge erfassen und abgleichen',
      state: verified
        ? 'done'
        : !policyConfirmed(project)
          ? 'attention'
          : entries.length
            ? 'active'
            : 'todo',
      status: verified
        ? 'Abgeglichen'
        : !policyConfirmed(project)
          ? 'Aufgebotsart offen'
          : entries.length
            ? `${checked} / ${entries.length} abgeglichen`
            : 'Noch keine Einträge',
    },
    {
      to: '/finish',
      number: 4,
      label: 'Sichern & archivieren',
      title: 'Sichern & archivieren',
      description: 'Exporte erstellen und den Planstand unveränderlich ablegen',
      state: project.archive ? 'done' : verified ? 'active' : 'todo',
      status: project.archive ? 'Archiviert' : 'Noch nicht archiviert',
    },
  ];
}

export function useWorkflow(): Step[] {
  const project = useProject();
  return useMemo(() => workflowSteps(project), [project]);
}
